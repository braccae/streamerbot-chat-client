# Builder stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install build tools and production dependencies
# node-gyp requires python, make, and g++ to build native addons (e.g. bufferutil on arm64)
RUN apt-get update && apt-get install -y python3 make g++ \
    && npm install --omit=dev

# Final stage
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy built node_modules from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY server.js ./

# Expose the relay port
EXPOSE 8081

# Command to run the server
CMD ["node", "server.js"]
