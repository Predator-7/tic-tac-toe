# Stage 1: Build the TypeScript code into a single index.js bundle
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build configuration
COPY . .
RUN npm run build

# Stage 2: Deploy the built module with Nakama
FROM heroiclabs/nakama:3.21.1

# Sync the built JavaScript file to the Nakama modules directory
COPY --from=builder /app/build/index.js /nakama/data/modules/index.js

# Copy and set permissions for the startup script
COPY start.sh /nakama/start.sh
USER root
RUN chmod +x /nakama/start.sh

# Use the startup script as the container entrypoint
ENTRYPOINT ["/bin/sh", "/nakama/start.sh"]
