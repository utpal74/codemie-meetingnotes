# =============================================================================
# Doctor Appointment Booking System -- Frontend Dockerfile (Production)
# =============================================================================
#
# Multi-stage build strategy:
#   builder  -- Node.js image that installs deps and runs vite build
#   runner   -- nginx:alpine that serves the compiled static bundle
#
# The nginx reverse-proxy config (nginx.conf) forwards /api and /health
# requests to the backend API container so the browser never needs to know
# the API host at build time.
#
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 -- builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Layer-cache the dependency install separately from the source copy
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2 -- runner  (final production image)
# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

# Remove the default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy the compiled Vite bundle
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy the nginx site config
# nginx.conf proxies /api and /health to the backend service
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose the port declared in nginx.conf (3000)
EXPOSE 3000

# Health check -- nginx returns 200 on the root path once started
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
