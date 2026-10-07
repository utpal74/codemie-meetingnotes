# =============================================================================
# Doctor Appointment Booking System -- Backend Dockerfile (Production)
# =============================================================================
#
# Multi-stage build strategy:
#   deps       -- install all deps including devDependencies (for prisma CLI)
#   prisma-gen -- generate Prisma Client artefacts from the schema
#   prod-deps  -- install only production deps for a lean final image
#   runner     -- minimal Alpine image that runs the Express API
#

# -------------------------------------------------------------------
# Stage 1 -- deps
# Install ALL npm deps so prisma generate can run in the next stage.
# -------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

# -------------------------------------------------------------------
# Stage 2 -- prisma-gen
# Generate Prisma Client binaries; artefacts cherry-picked in runner.
# -------------------------------------------------------------------
FROM deps AS prisma-gen

COPY prisma ./prisma
RUN npx prisma generate

# -------------------------------------------------------------------
# Stage 3 -- prod-deps
# Re-install with --omit=dev (~150-200 MB saved in final image).
# -------------------------------------------------------------------
FROM node:20-alpine AS prod-deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# -------------------------------------------------------------------
# Stage 4 -- runner  (final production image)
# -------------------------------------------------------------------
FROM node:20-alpine AS runner

# Security: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Production node_modules (no devDependencies)
COPY --from=prod-deps /app/node_modules ./node_modules

# Prisma schema + generated client binaries
COPY --from=prisma-gen /app/prisma                 ./prisma
COPY --from=prisma-gen /app/node_modules/.prisma   ./node_modules/.prisma
COPY --from=prisma-gen /app/node_modules/@prisma   ./node_modules/@prisma

# Application source
COPY src           ./src
COPY package*.json ./

# Drop privileges
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 4000

# Health check -- polls the lightweight /health route
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

# Run migrations (idempotent) then start the API.
# db seed is excluded from production; run as a one-off job when needed.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
