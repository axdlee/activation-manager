#!/bin/sh
set -eu

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

mkdir -p "/app/data" "/app/prisma"
touch "/app/data/dev.db"
ln -sf "/app/data/dev.db" "/app/prisma/dev.db"

npm run bootstrap:runtime

exec npm run start -- --hostname "${HOSTNAME}" --port "${PORT}"
