FROM node:20-slim AS base
RUN corepack enable pnpm

# ---- Dependencies (full image for native module compilation) ----
FROM node:20 AS deps
RUN corepack enable pnpm
WORKDIR /app

# Copy only what pnpm needs to resolve + install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/cli/package.json apps/cli/

RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm build

# Prune dev dependencies for a leaner runtime image
RUN pnpm prune --prod

# ---- Runtime ----
FROM base AS runtime
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/DinoMorphica/safeclaw"
LABEL org.opencontainers.image.description="Security management dashboard for AI agents"
LABEL org.opencontainers.image.licenses="MIT"

# Copy pruned production node_modules
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/cli/node_modules ./apps/cli/node_modules

# Copy build output
COPY --from=build /app/apps/cli/dist ./apps/cli/dist
COPY --from=build /app/apps/cli/public ./apps/cli/public
COPY --from=build /app/apps/cli/bin ./apps/cli/bin
COPY --from=build /app/apps/cli/package.json ./apps/cli/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# SafeClaw stores its DB, config, and logs in ~/.safeclaw
# Mount a volume here to persist data across container restarts
VOLUME ["/root/.safeclaw"]

ENV NODE_ENV=production
EXPOSE 54335

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:54335/api/health').then(r => { if (!r.ok) process.exit(1) })" || exit 1

CMD ["node", "apps/cli/bin/safeclaw.js", "start", "--no-open"]
