#!/bin/sh
set -eu

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"
export APP_HOST="${APP_HOST:-0.0.0.0}"
export APP_UID="${APP_UID:-1000}"
export APP_GID="${APP_GID:-1000}"
# 数据库直指数据卷，不再依赖 prisma/ 下的 symlink
export DATABASE_URL="${DATABASE_URL:-file:/app/data/dev.db}"

prepare_runtime_paths() {
  mkdir -p "/app/data"
  touch "/app/data/dev.db"
}

if [ "$(id -u)" = "0" ]; then
  prepare_runtime_paths

  if ! chown -R "${APP_UID}:${APP_GID}" "/app/data"; then
    echo "❌ 无法修复 /app/data 权限，请改用 Docker named volume，或预先将宿主机目录授权给 ${APP_UID}:${APP_GID}" >&2
    exit 1
  fi

  exec setpriv --reuid "${APP_UID}" --regid "${APP_GID}" --clear-groups "$0" "$@"
fi

prepare_runtime_paths

# 生产镜像内置打包引导（免 tsx/TS 源码）；本地调试回退 tsx
if [ -f .next-bootstrap/bootstrap-runtime.cjs ]; then
  node .next-bootstrap/bootstrap-runtime.cjs
else
  npm run bootstrap:runtime
fi

# 自定义 server：入站请求统一追加 socket 对端地址到 X-Forwarded-For 尾部
# （防直连伪造 XFF 绕过 IP 白名单），镜像内构建输出目录为 .next-build
export NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-build}"
export APP_HOST="${APP_HOST:-0.0.0.0}"
exec node server.js
