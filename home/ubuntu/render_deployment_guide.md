# Guía de Despliegue Permanente del Panel de Administración en Render.com

Esta guía te mostrará cómo desplegar el backend (panel de administración) de tu Biblioteca Digital "La Bruja de las Mates®" en Render.com para obtener una URL permanente y gratuita.

**Requisitos Previos:**

*   Una cuenta de GitHub ([https://github.com/](https://github.com/))
*   Una cuenta de Render.com ([https://render.com/](https://render.com/)) - Puedes registrarte gratis.
*   El archivo `bruja_mates_backend.zip` que te proporcionaré, conteniendo el código fuente del panel de administración.

**Pasos:**

**1. Preparar el Repositorio en GitHub:**

*   **Crea un nuevo repositorio**: Ve a tu cuenta de GitHub y crea un nuevo repositorio. Puedes llamarlo `bruja-mates-backend` (o como prefieras). Es recomendable hacerlo **privado**.
*   **Descomprime el archivo ZIP**: Extrae el contenido del archivo `bruja_mates_backend.zip` en una carpeta en tu ordenador.
*   **Sube el código**: Sube todos los archivos y carpetas extraídos (incluyendo `server.js`, `Dockerfile`, `package.json`, `admin.html`, la carpeta `public`, etc.) a tu nuevo repositorio de GitHub. Asegúrate de que los archivos estén en la raíz del repositorio.

**2. Crear el Servicio Web en Render:**

*   **Inicia sesión en Render**: Accede a tu cuenta de Render.com.
*   **Crea un nuevo servicio**: En el dashboard, haz clic en "New +" y selecciona "Web Service".
*   **Conecta tu repositorio**: Elige la opción "Build and deploy from a Git repository" y conecta tu cuenta de GitHub si aún no lo has hecho. Selecciona el repositorio `bruja-mates-backend` que creaste.
*   **Configura el servicio**:
    *   **Name**: Dale un nombre a tu servicio (ej: `bruja-mates-admin`). Render usará esto para generar parte de la URL.
    *   **Region**: Elige la región más cercana (Frankfurt suele ser una buena opción para Europa).
    *   **Branch**: Asegúrate de que esté seleccionada la rama principal (normalmente `main` o `master`).
    *   **Runtime**: Render debería detectar automáticamente que es un proyecto Docker. Asegúrate de que esté seleccionado "Docker".
    *   **Build Command**: Render debería usar el `Dockerfile`, así que puedes dejarlo vacío o poner `docker build -t backend .` (aunque generalmente no es necesario si el Dockerfile está en la raíz).
    *   **Start Command**: Render debería usar el `CMD` del `Dockerfile`, así que puedes dejarlo vacío o poner `node server.js`.
*   **Elige el Plan Gratuito**: Asegúrate de seleccionar la instancia "Free".

**3. Configurar el Almacenamiento Persistente (¡Muy Importante!)**

*   Antes de finalizar la creación del servicio, ve a la sección "Advanced" o busca la opción para añadir "Disks".
*   Necesitamos crear **dos discos** para que tus datos (base de datos SQLite) y los PDFs subidos no se pierdan cada vez que la aplicación se reinicie:
    *   **Disco 1 (Base de Datos)**:
        *   **Name**: `data`
        *   **Mount Path**: `/usr/src/app/data` (Esta es la ruta que configuramos en `server.js` dentro del contenedor Docker)
        *   **Size (GB)**: 1 (El plan gratuito suele ofrecer 1GB, suficiente para empezar)
    *   **Disco 2 (Uploads)**:
        *   **Name**: `uploads`
        *   **Mount Path**: `/usr/src/app/uploads` (Esta es la ruta que configuramos en `server.js`)
        *   **Size (GB)**: Puedes asignar el resto del espacio gratuito o empezar con 1GB.
*   **Guarda** la configuración de los discos.

**4. Desplegar la Aplicación:**

*   Haz clic en "Create Web Service".
*   Render comenzará a construir la imagen Docker y a desplegar tu aplicación. Esto puede tardar unos minutos.
*   Podrás ver el progreso en la pestaña "Events" o "Logs".
*   Una vez que el despliegue sea exitoso ("Live"), Render te proporcionará la **URL permanente** de tu panel de administración en la parte superior de la página del servicio (algo como `https://bruja-mates-admin.onrender.com`).

**5. Verificar el Panel de Administración:**

*   Accede a la URL permanente proporcionada por Render.
*   Deberías ver tu panel de administración "La Bruja de las Mates®".
*   Intenta subir un PDF de prueba para asegurarte de que el almacenamiento funciona correctamente.

**¡Listo!** Ahora tienes una URL permanente para tu panel de administración. El siguiente paso será actualizar la Biblioteca Digital (frontend) para que use esta nueva URL permanente.

**Nota sobre el Plan Gratuito:** Las instancias gratuitas de Render pueden "dormir" después de un período de inactividad. La primera visita después de un tiempo puede tardar un poco más (unos 30 segundos) mientras la aplicación se despierta. Esto es normal en los planes gratuitos.
