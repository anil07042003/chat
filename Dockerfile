# Multi-stage build for BaatChit

# ─── Stage 1: Build client ────────────────────────────────────────────────────
FROM node:20-alpine AS client-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --only=production=false
COPY client/ ./
RUN npm run build

# ─── Stage 2: Production server ───────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install server dependencies
COPY server/package*.json ./
RUN npm ci --only=production

# Copy server code
COPY server/ ./

# Copy built client
COPY --from=client-builder /app/client/dist ./public

# Create upload directories
RUN mkdir -p uploads/profiles uploads/files uploads/groups

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

# Start server
CMD ["node", "index.js"]
