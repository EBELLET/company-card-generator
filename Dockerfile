# Use lightweight Node Alpine image
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies to run Vite build)
RUN npm ci

# Copy the rest of the project source files
COPY . .

# Build the frontend production assets into /app/dist
RUN npm run build

# Clean up dev dependencies to make the image smaller
RUN npm prune --production

# Expose backend port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Define start command
CMD ["node", "server/index.cjs"]
