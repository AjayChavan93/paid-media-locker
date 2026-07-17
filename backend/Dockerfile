FROM node:20-slim

WORKDIR /app

# Copy package config first to leverage caching
COPY package*.json ./

# Install dependencies (ignoring devDependencies for lighter build)
RUN npm ci --only=production

# Copy source code files
COPY . .

# Expose backend (5000) and mock S3 (9000)
EXPOSE 5000
EXPOSE 9000

ENV NODE_ENV=production

# Start Express server and S3rver
CMD ["node", "app.js"]
