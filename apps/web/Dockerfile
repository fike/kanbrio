FROM node:20-alpine

WORKDIR /usr/src/app

# Copy lock and root package files to optimize dependency caching
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui-core/package.json ./packages/ui-core/

# Install dependencies for the workspace
RUN npm ci && apk add --no-cache curl

# Copy the source code for the apps and shared packages
COPY packages/ui-core ./packages/ui-core
COPY apps/web ./apps/web

# Expose port 5173
EXPOSE 5173

# Start Vite dev server in host mode
CMD ["npm", "run", "dev", "-w", "apps/web", "--", "--host", "0.0.0.0"]
