FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --only=production

# Copy server code
COPY server.js ./

# Expose the relay port
EXPOSE 8081

# Command to run the server
CMD ["node", "server.js"]
