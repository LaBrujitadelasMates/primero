// server.js - Servidor principal para la API de gestión de PDFs y servir archivos estáticos
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const pdfParse = require("pdf-parse");

// Configuración del servidor
const app = express();
// Render proporciona el puerto a través de la variable de entorno PORT
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/public", express.static(path.join(__dirname, "public")));

// Servir el panel de administración
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// Configuración de la base de datos
// En Render, el sistema de archivos puede ser efímero. Usar un directorio específico.
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, "pdf_database.db");
const db = new sqlite3.Database(dbPath);

// Crear tablas si no existen
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS pdfs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT,
    filepath TEXT NOT NULL,
    filename TEXT NOT NULL,
    upload_date TEXT NOT NULL,
    course TEXT,
    num_pages INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pdf_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pdf_id INTEGER NOT NULL,
    page_num INTEGER NOT NULL,
    content TEXT,
    FOREIGN KEY (pdf_id) REFERENCES pdfs (id) ON DELETE CASCADE
  )`);
});

// Configuración de almacenamiento para multer
// En Render, el sistema de archivos puede ser efímero. Usar un directorio específico.
const uploadsBaseDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsBaseDir)) {
  fs.mkdirSync(uploadsBaseDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const course = req.body.course || "general";
    const uploadDir = path.join(uploadsBaseDir, course);

    // Crear directorio si no existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generar nombre de archivo único
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

// Filtro para aceptar solo PDFs
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten archivos PDF"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // Límite de 10MB
});

// Función para extraer texto de un PDF
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return {
      text: data.text,
      numPages: data.numpages,
    };
  } catch (error) {
    console.error("Error al extraer texto del PDF:", error);
    return { text: "", numPages: 0 };
  }
}

// Rutas API

// Obtener todos los PDFs
app.get("/api/pdfs", (req, res) => {
  const query = req.query.search || "";
  const course = req.query.course || "";

  let sql = "SELECT * FROM pdfs";
  let params = [];

  if (query || course) {
    sql += " WHERE";

    if (query) {
      sql += " (title LIKE ? OR id IN (SELECT pdf_id FROM pdf_content WHERE content LIKE ?))";
      params.push(`%${query}%`, `%${query}%`);

      if (course && course !== "all") {
        sql += " AND";
      }
    }

    if (course && course !== "all") {
      sql += " course = ?";
      params.push(course);
    }
  }

  sql += " ORDER BY upload_date DESC";

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al obtener PDFs" });
    }
    res.json(rows);
  });
});

// Obtener un PDF específico por ID
app.get("/api/pdfs/:id", (req, res) => {
  const id = req.params.id;

  db.get("SELECT * FROM pdfs WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al obtener el PDF" });
    }

    if (!row) {
      return res.status(404).json({ error: "PDF no encontrado" });
    }

    res.json(row);
  });
});

// Obtener el contenido de un PDF por ID
app.get("/api/pdfs/:id/content", (req, res) => {
  const id = req.params.id;

  db.all("SELECT page_num, content FROM pdf_content WHERE pdf_id = ? ORDER BY page_num", [id], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al obtener el contenido del PDF" });
    }

    res.json(rows);
  });
});

// Subir un nuevo PDF
app.post("/api/pdfs", upload.single("pdf"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se ha subido ningún archivo" });
  }

  try {
    const { title, author, course } = req.body;
    const filepath = req.file.path;
    const filename = req.file.originalname;
    const uploadDate = new Date().toISOString();

    // Extraer texto del PDF
    const { text, numPages } = await extractTextFromPDF(filepath);

    // Insertar información del PDF en la base de datos
    db.run(
      "INSERT INTO pdfs (title, author, filepath, filename, upload_date, course, num_pages) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [title || filename, author || "La Bruja de las Mates", filepath, filename, uploadDate, course || "general", numPages],
      function (err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: "Error al guardar el PDF en la base de datos" });
        }

        const pdfId = this.lastID;

        // Dividir el texto en páginas (aproximadamente)
        const pages = text.split("\n\n\n").filter((page) => page.trim());

        // Si no se pudo dividir bien, usar el texto completo como una página
        const contentPages = pages.length > 0 ? pages : [text];

        // Insertar el contenido de cada página
        const stmt = db.prepare("INSERT INTO pdf_content (pdf_id, page_num, content) VALUES (?, ?, ?)");

        for (let i = 0; i < contentPages.length; i++) {
          stmt.run(pdfId, i, contentPages[i]);
        }

        stmt.finalize();

        res.status(201).json({
          id: pdfId,
          title: title || filename,
          author: author || "La Bruja de las Mates",
          filepath,
          filename,
          upload_date: uploadDate,
          course: course || "general",
          num_pages: numPages,
        });
      }
    );
  } catch (error) {
    console.error("Error al procesar el PDF:", error);
    res.status(500).json({ error: "Error al procesar el PDF" });
  }
});

// Actualizar un PDF existente
app.put("/api/pdfs/:id", upload.single("pdf"), async (req, res) => {
  const id = req.params.id;

  // Verificar si el PDF existe
  db.get("SELECT * FROM pdfs WHERE id = ?", [id], async (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al verificar el PDF" });
    }

    if (!row) {
      return res.status(404).json({ error: "PDF no encontrado" });
    }

    try {
      const { title, author, course } = req.body;
      let filepath = row.filepath;
      let filename = row.filename;
      let numPages = row.num_pages;

      // Si se ha subido un nuevo archivo
      if (req.file) {
        // Eliminar el archivo anterior
        if (fs.existsSync(row.filepath)) {
          fs.unlinkSync(row.filepath);
        }

        filepath = req.file.path;
        filename = req.file.originalname;

        // Extraer texto del nuevo PDF
        const { text, numPages: newNumPages } = await extractTextFromPDF(filepath);
        numPages = newNumPages;

        // Eliminar el contenido anterior
        db.run("DELETE FROM pdf_content WHERE pdf_id = ?", [id]);

        // Dividir el texto en páginas (aproximadamente)
        const pages = text.split("\n\n\n").filter((page) => page.trim());

        // Si no se pudo dividir bien, usar el texto completo como una página
        const contentPages = pages.length > 0 ? pages : [text];

        // Insertar el contenido de cada página
        const stmt = db.prepare("INSERT INTO pdf_content (pdf_id, page_num, content) VALUES (?, ?, ?)");

        for (let i = 0; i < contentPages.length; i++) {
          stmt.run(id, i, contentPages[i]);
        }

        stmt.finalize();
      }

      // Actualizar la información del PDF
      db.run(
        "UPDATE pdfs SET title = ?, author = ?, filepath = ?, filename = ?, course = ?, num_pages = ? WHERE id = ?",
        [
          title || row.title,
          author || row.author,
          filepath,
          filename,
          course || row.course,
          numPages,
          id,
        ],
        function (err) {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: "Error al actualizar el PDF" });
          }

          res.json({
            id: parseInt(id),
            title: title || row.title,
            author: author || row.author,
            filepath,
            filename,
            upload_date: row.upload_date,
            course: course || row.course,
            num_pages: numPages,
          });
        }
      );
    } catch (error) {
      console.error("Error al actualizar el PDF:", error);
      res.status(500).json({ error: "Error al actualizar el PDF" });
    }
  });
});

// Eliminar un PDF
app.delete("/api/pdfs/:id", (req, res) => {
  const id = req.params.id;

  // Verificar si el PDF existe
  db.get("SELECT * FROM pdfs WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al verificar el PDF" });
    }

    if (!row) {
      return res.status(404).json({ error: "PDF no encontrado" });
    }

    // Eliminar el archivo
    if (fs.existsSync(row.filepath)) {
      fs.unlinkSync(row.filepath);
    }

    // Eliminar de la base de datos
    db.run("DELETE FROM pdfs WHERE id = ?", [id], function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al eliminar el PDF" });
      }

      // El contenido se eliminará automáticamente por la restricción ON DELETE CASCADE

      res.json({ message: "PDF eliminado correctamente" });
    });
  });
});

// Obtener estadísticas
app.get("/api/stats", (req, res) => {
  const stats = {};

  db.get("SELECT COUNT(*) as total FROM pdfs", [], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error al obtener estadísticas" });
    }

    stats.totalPdfs = row.total;

    db.get("SELECT SUM(num_pages) as totalPages FROM pdfs", [], (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error al obtener estadísticas" });
      }

      stats.totalPages = row.totalPages || 0;

      db.all("SELECT course, COUNT(*) as count FROM pdfs GROUP BY course", [], (err, rows) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: "Error al obtener estadísticas" });
        }

        stats.courseDistribution = rows;

        res.json(stats);
      });
    });
  });
});

// Iniciar el servidor
// Escuchar en 0.0.0.0 para ser accesible externamente
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor backend ejecutándose en http://0.0.0.0:${PORT}`);
  console.log(`Base de datos en: ${dbPath}`);
  console.log(`Directorio de uploads: ${uploadsBaseDir}`);
  console.log(`Panel de administración disponible en: http://localhost:${PORT}`);
});

