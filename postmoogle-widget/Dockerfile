# Step 1: Build the app
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the code and build
COPY . .
RUN npm run build

# Step 2: Serve the app
FROM node:20-slim

WORKDIR /app

# Install 'serve' to host the static files
RUN npm install -g serve

# Copy the built files from the builder stage
COPY --from=builder /app/dist ./dist

# Vite apps on Railway need to listen on the PORT variable
CMD ["sh", "-c", "serve -s dist -l ${PORT}"]