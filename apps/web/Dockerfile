# Stage 1: Build the Solid.js / Vite frontend
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy lock and root package files to optimize dependency caching
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui-core/package.json ./packages/ui-core/

# Install dependencies for the workspace
RUN npm ci

# Copy the source code for the apps and shared packages
COPY packages/ui-core ./packages/ui-core
COPY apps/web ./apps/web

# Build the web application
RUN npm run web:build

# Stage 2: Serve using Nginx
FROM nginx:alpine

# Copy built static files to Nginx public folder
COPY --from=builder /usr/src/app/apps/web/dist /usr/share/nginx/html

# Copy our custom Nginx config to proxy /api and listen on 5173
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 5173
EXPOSE 5173

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
