# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Runtime stage
FROM heroiclabs/nakama:3.21.1
COPY --from=builder /app/build/index.js /nakama/data/modules/index.js
