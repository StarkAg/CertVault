# CertVault — custom Dockerfile to avoid Railway's node_modules/.cache mount (EBUSY)
# Node 20.20+ for @vitejs/plugin-react and Supabase

# Build stage — no cache mount on node_modules
FROM node:20.20-alpine AS builder
WORKDIR /app

# Railway passes Variables as build args; expose so Vite can inline them at build time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

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
COPY convex ./convex

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
