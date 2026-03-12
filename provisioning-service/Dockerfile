# Use a lightweight Node.js image
FROM node:20-slim

# Create app directory
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install libraries
RUN npm install --production

# Copy the rest of your code (index.js)
COPY . .

# Vite/Express apps need to listen on the PORT variable provided by Railway
ENV PORT=3000

# Start the service
CMD ["node", "index.js"]