# ============================================================
# Manga-Kindle — Multi-stage Docker build
# Stage 1: Install deps & build all packages
# Stage 2: Slim production image with Node + Python (for KCC)
# ============================================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Install deps first (layer caching)
COPY package.json package-lock.json ./
COPY packages/scraper/package.json packages/scraper/
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/

RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY packages/scraper/ packages/scraper/
COPY packages/api/ packages/api/
COPY packages/web/ packages/web/

# Generate Prisma client
RUN npx -w packages/api prisma generate

# Build scraper → api → web
RUN npm run build -w packages/scraper
RUN npm run build -w packages/api
RUN npm run build -w packages/web

# ── Stage 2: Production ────────────────────────────────────
FROM node:18-alpine AS production

# Install Python 3 + pip for KCC
RUN apk add --no-cache python3 py3-pip

# Install KCC (Kindle Comic Converter CLI)
RUN pip3 install --no-cache-dir --break-system-packages kindle-comic-converter

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json ./
COPY packages/scraper/package.json packages/scraper/
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/

# Install production deps only
RUN npm ci --omit=dev

# Copy Prisma schema & generate client for production
COPY packages/api/prisma packages/api/prisma
RUN npx -w packages/api prisma generate

# Copy built artifacts from builder
COPY --from=builder /app/packages/scraper/dist packages/scraper/dist
COPY --from=builder /app/packages/api/dist packages/api/dist
COPY --from=builder /app/packages/web/.next packages/web/.next
COPY --from=builder /app/packages/web/public packages/web/public

# Copy Next.js config (needed at runtime for rewrites)
COPY packages/web/next.config.js packages/web/
COPY packages/web/postcss.config.js packages/web/
COPY packages/web/tailwind.config.ts packages/web/

# Create directories for downloads and converted files
RUN mkdir -p /data/downloads /data/converted /data/temp

# Default env vars
ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_URL="file:/data/manga-kindle.db" \
    DOWNLOAD_DIR="/data/downloads" \
    CONVERTED_DIR="/data/converted" \
    TEMP_DIR="/data/temp" \
    KCC_PATH="/usr/bin/kcc-c2e" \
    NEXT_PUBLIC_API_URL="http://localhost:3001"

# Expose ports: API (3001) and Web (3000)
EXPOSE 3000 3001

# Push Prisma schema to SQLite on first run, then start both services
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
