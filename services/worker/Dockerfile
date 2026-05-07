FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/core/package.json ./packages/core/
COPY services/worker/package.json ./services/worker/
RUN npm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY packages/core ./packages/core
COPY services/worker ./services/worker
COPY tsconfig.base.json ./
RUN npm run build --workspace=@cmgym/core && npm run build --workspace=@cmgym/worker

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/services/worker/dist ./services/worker/dist
COPY --from=builder /app/services/worker/package.json ./services/worker/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
CMD ["node", "services/worker/dist/index.js"]
