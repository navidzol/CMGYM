FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/core/package.json ./packages/core/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/
RUN npm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY packages/core ./packages/core
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web
COPY tsconfig.base.json ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@cmgym/core && npm run build --workspace=@cmgym/ui && npm run build --workspace=@cmgym/web

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy the standalone output (includes its own node_modules and server.js)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Copy static files
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# Copy public assets
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
