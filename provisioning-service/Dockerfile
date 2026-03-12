FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port (Railway will override with PORT env var)
EXPOSE 3000

# Start the service
CMD ["node", "index.js"]