FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies — npm hoists everything to root node_modules
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/core/package.json ./packages/core/
COPY services/api/package.json ./services/api/
RUN npm install

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY packages/core ./packages/core
COPY services/api ./services/api
COPY tsconfig.base.json ./
RUN npm run build --workspace=@cmgym/core && npm run build --workspace=@cmgym/api

# Run
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/services/api/dist ./services/api/dist
COPY --from=builder /app/services/api/package.json ./services/api/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
EXPOSE 3001
CMD ["node", "services/api/dist/server.js"]
