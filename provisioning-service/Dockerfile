FROM node:20-slim

WORKDIR /app

# Copy package files first (better for caching)
COPY package.json ./

# Install the dependencies we just added to package.json
RUN npm install

# Copy your index.js
COPY . .

# Ensure the app uses the PORT Railway provides 
ENV PORT=3000

CMD ["node", "index.js"]