# Dockerfile for Render deployment

# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

# Create necessary directories (Render might handle this via Disks, but good practice)
RUN mkdir -p data uploads public

# Expose the port the app runs on
EXPOSE 3001

# Define the command to run your app
CMD [ "node", "server.js" ]
