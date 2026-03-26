#!/bin/sh
set -eu

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"
export APP_HOST="${APP_HOST:-0.0.0.0}"
export APP_UID="${APP_UID:-1000}"
export APP_GID="${APP_GID:-1000}"

prepare_runtime_paths() {
  mkdir -p "/app/data" "/app/prisma"
  touch "/app/data/dev.db"
  ln -sf "/app/data/dev.db" "/app/prisma/dev.db"
}

if [ "$(id -u)" = "0" ]; then
  prepare_runtime_paths

  if ! chown -R "${APP_UID}:${APP_GID}" "/app/data" "/app/prisma"; then
    echo "❌ 无法修复 /app/data 权限，请改用 Docker named volume，或预先将宿主机目录授权给 ${APP_UID}:${APP_GID}" >&2
    exit 1
  fi

  exec setpriv --reuid "${APP_UID}" --regid "${APP_GID}" --clear-groups "$0" "$@"
fi

prepare_runtime_paths

npm run bootstrap:runtime

exec npm run start -- --hostname "${APP_HOST}" --port "${PORT}"
