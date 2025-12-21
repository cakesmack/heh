FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build the application (for production)
# RUN npm run build

# Expose port
EXPOSE 3000

# Run the application (development mode)
CMD ["npm", "run", "dev"]

# For production, use:
# CMD ["npm", "start"]
