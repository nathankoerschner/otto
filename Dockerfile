# Stage 1: Build frontend
FROM oven/bun:1 AS frontend-builder
WORKDIR /app/web
COPY web/package.json web/bun.lockb* ./
RUN bun install --frozen-lockfile
COPY web/ ./
RUN bun run build

# Stage 2: Build backend
FROM oven/bun:1 AS backend-builder
WORKDIR /app
COPY package.json bun.lockb* ./
COPY tsconfig.json ./
RUN bun install --frozen-lockfile
COPY src ./src
RUN bun run build

# Stage 3: Production
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --production --frozen-lockfile
COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/web/dist ./public

RUN groupadd --gid 1001 --system nodejs && \
    useradd --system --uid 1001 --gid nodejs nodejs
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1))"

CMD ["bun", "run", "dist/index.js"]
