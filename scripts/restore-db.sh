#!/bin/bash

# 数据库恢复脚本
# 安全性说明：
# - SQLite 在 WAL 模式下直接 cp 会得到不一致快照，恢复一律走 sqlite3
#   .backup/.restore API；
# - 恢复前先对当前库做 .backup 安全快照；
# - 目标库路径从 DATABASE_URL 解析（file: 相对路径按项目根解析），
#   未设置时回退 prisma/dev.db。
set -eu

DB_PATH="${DB_PATH:-}"
if [ -z "$DB_PATH" ]; then
  if [ -n "${DATABASE_URL:-}" ]; then
    DB_PATH="${DATABASE_URL#file:}"
    case "$DB_PATH" in
      /*) ;;                                  # 绝对路径原样保留
      *) DB_PATH="$(pwd)/$DB_PATH" ;;         # 相对路径按项目根解析
    esac
  else
    DB_PATH="prisma/dev.db"
  fi
fi
BACKUP_DIR="${BACKUP_DIR:-backups}"

echo "目标数据库: $DB_PATH"
echo ""
echo "可用的备份文件："
echo ""

# 显示可用的备份文件
if [ -d "$BACKUP_DIR" ]; then
    echo "=== 数据库文件备份 ==="
    ls -la "$BACKUP_DIR"/*.backup_* 2>/dev/null | head -10 || true
    echo ""
    echo "=== SQL备份文件 ==="
    ls -la "$BACKUP_DIR"/*.sql 2>/dev/null | head -10 || true
    echo ""
    echo "=== 压缩备份文件 ==="
    ls -la "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -10 || true
else
    echo "没有找到备份目录 $BACKUP_DIR"
fi

echo ""
echo "恢复选项："
echo "1. 从数据库文件恢复: ./scripts/restore-db.sh file <备份文件路径>"
echo "2. 从SQL文件恢复: ./scripts/restore-db.sh sql <SQL文件路径>"
echo "3. 从压缩文件恢复: ./scripts/restore-db.sh gz <压缩文件路径>"

echo ""
echo "示例："
echo "  ./scripts/restore-db.sh file backups/dev.db.backup_20241206_120000"
echo "  ./scripts/restore-db.sh sql backups/backup_20241206_120000.sql"
echo "  ./scripts/restore-db.sh gz backups/backup_20241206_120000.sql.gz"

if [ $# -eq 2 ]; then
    RESTORE_TYPE=$1
    RESTORE_FILE=$2

    if [ ! -f "$RESTORE_FILE" ]; then
        echo "错误：备份文件 $RESTORE_FILE 不存在！"
        exit 1
    fi

    if ! command -v sqlite3 >/dev/null 2>&1; then
        echo "❌ 未找到 sqlite3 命令，请先安装（macOS 自带 / Linux: apt install sqlite3）"
        exit 1
    fi

    # 创建当前数据库的安全快照（.backup API 保证 WAL 一致性）
    SAFETY_BACKUP="${DB_PATH}.safety_backup_$(date +%Y%m%d_%H%M%S)"
    sqlite3 "$DB_PATH" ".backup '$SAFETY_BACKUP'"
    echo "已保存恢复前安全快照: $SAFETY_BACKUP"

    case $RESTORE_TYPE in
        "file")
            echo "从数据库文件恢复: $RESTORE_FILE"
            # .restore 会正确处理目标库的 WAL/SHM，避免直接 cp 的不一致问题
            sqlite3 "$DB_PATH" ".restore '$RESTORE_FILE'"
            echo "恢复完成！"
            ;;
        "sql")
            echo "从SQL文件恢复: $RESTORE_FILE"
            sqlite3 "$DB_PATH" < "$RESTORE_FILE"
            echo "恢复完成！"
            ;;
        "gz")
            echo "从压缩文件恢复: $RESTORE_FILE"
            gunzip -c "$RESTORE_FILE" | sqlite3 "$DB_PATH"
            echo "恢复完成！"
            ;;
        *)
            echo "错误：不支持的恢复类型 $RESTORE_TYPE"
            echo "支持的类型：file, sql, gz"
            exit 1
            ;;
    esac

    echo "数据库已从 $RESTORE_FILE 恢复"
    echo "当前数据库大小: $(ls -lh "$DB_PATH" | awk '{print $5}')"
fi
