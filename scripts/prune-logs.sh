#!/usr/bin/env bash
# 归档清理：删除 N 天前的审计日志与消费日志。
# SQLite 单文件数据库长期运行会无限膨胀，建议定期执行本脚本（如 cron 每周）。
#
# 用法：
#   RETENTION_DAYS=180 bash ./scripts/prune-logs.sh
#   DB_PATH=/app/data/dev.db RETENTION_DAYS=90 bash ./scripts/prune-logs.sh
#
# 数据库路径优先级：DB_PATH 环境变量 > DATABASE_URL（file: 前缀）> 默认 prisma/dev.db
# 默认保留 180 天；可通过 RETENTION_DAYS 覆盖。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

resolve_db_path() {
  if [[ -n "${DB_PATH:-}" ]]; then
    echo "$DB_PATH"
    return
  fi

  if [[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" == file:* ]]; then
    local file_path="${DATABASE_URL#file:}"
    if [[ "${file_path}" == /* ]]; then
      echo "$file_path"
    else
      echo "${PROJECT_ROOT}/prisma/${file_path}"
    fi
    return
  fi

  echo "${PROJECT_ROOT}/prisma/dev.db"
}

DB_PATH="$(resolve_db_path)"
RETENTION_DAYS="${RETENTION_DAYS:-180}"

if [[ ! -f "$DB_PATH" ]]; then
  echo "❌ 数据库文件不存在: $DB_PATH" >&2
  exit 1
fi

CUTOFF="$(date -u -v-${RETENTION_DAYS}d +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -d "${RETENTION_DAYS} days ago" +%Y-%m-%dT%H:%M:%S)"

TIMEOUT_PREFIX=".timeout 5000"

echo "== 清理前统计 =="
echo "审计日志总数: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM admin_operation_audit_logs;")"
echo "消费日志总数: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM license_consumptions;")"
echo "保留阈值: ${RETENTION_DAYS} 天前（${CUTOFF} 之前的数据将被删除）"
echo "数据库: $DB_PATH"

echo
echo "== 删除审计日志（createdAt < ${CUTOFF}） =="
sqlite3 "$DB_PATH" <<SQL
${TIMEOUT_PREFIX}
DELETE FROM admin_operation_audit_logs WHERE createdAt < '${CUTOFF}';
SELECT changes();
SQL

echo
echo "== 删除消费日志（createdAt < ${CUTOFF}） =="
sqlite3 "$DB_PATH" <<SQL
${TIMEOUT_PREFIX}
DELETE FROM license_consumptions WHERE createdAt < '${CUTOFF}';
SELECT changes();
SQL

echo
echo "== VACUUM 回收空间 =="
sqlite3 "$DB_PATH" <<SQL
${TIMEOUT_PREFIX}
VACUUM;
SQL

echo
echo "== 清理后统计 =="
echo "审计日志总数: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM admin_operation_audit_logs;")"
echo "消费日志总数: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM license_consumptions;")"
echo "✅ 日志清理完成"
