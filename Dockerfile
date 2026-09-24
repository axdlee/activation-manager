# syntax=docker/dockerfile:1

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 生产依赖层：仅装 dependencies（不含 tsx/esbuild 等开发工具），
# 并在此生成 Prisma Client（查询引擎二进制随层进入运行镜像）
FROM base AS prod-deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci --omit=dev && npx prisma generate

FROM base AS builder
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate && npm run build \
    # 运行时数据库引导打包为独立 CJS 文件：运行镜像无需 tsx/TS 源码
    && ./node_modules/.bin/esbuild scripts/bootstrap-runtime.ts \
        --bundle --platform=node --format=cjs \
        --external:@prisma/client --external:bcryptjs \
        --outfile=.next-bootstrap/bootstrap-runtime.cjs

FROM node:${NODE_VERSION}-bookworm-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates sqlite3 util-linux \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/data /app/prisma

# 仅拷贝生产依赖（含 Prisma Client 引擎），开发工具链不再进入运行镜像
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next-build ./.next-build
COPY --from=builder --chown=node:node /app/.next-bootstrap ./.next-bootstrap
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/next.config.js ./next.config.js
COPY --from=builder --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/prisma ./prisma

RUN chmod +x /app/scripts/docker-entrypoint.sh \
    && chown -R node:node /app

EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
