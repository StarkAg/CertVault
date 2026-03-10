# CertVault — custom Dockerfile to avoid Railway's node_modules/.cache mount (EBUSY)
# Node 20.20+ for @vitejs/plugin-react and Supabase

# Build stage — no cache mount on node_modules
FROM node:20.20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Run stage — production deps only
FROM node:20.20-alpine AS runner
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY server.js ./
COPY api ./api
COPY lib ./lib

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
