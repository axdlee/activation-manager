#!/bin/bash

# 数据库备份脚本
# 使用 sqlite3 .backup 生成一致性快照，避免高写入时直接 cp 得到不一致文件。
# 用法：
#   ./scripts/backup-db.sh [数据库路径] [备份目录]
#   DB_PATH 环境变量也可指定数据库路径。

set -eu

DB_PATH="${1:-${DB_PATH:-prisma/dev.db}}"
BACKUP_DIR="${2:-backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 解析可能存在的 symlink（Docker 部署中 prisma/dev.db -> /app/data/dev.db）
RESOLVED_DB_PATH="$(readlink -f "$DB_PATH" 2>/dev/null || echo "$DB_PATH")"

if [ ! -f "$RESOLVED_DB_PATH" ]; then
  echo "❌ 数据库文件不存在: $DB_PATH"
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "❌ 未找到 sqlite3 命令，请先安装（macOS 自带 / Linux: apt install sqlite3）"
  exit 1
fi

# 创建备份目录
mkdir -p "$BACKUP_DIR"

echo "开始备份数据库: $RESOLVED_DB_PATH"
echo "备份目录: $BACKUP_DIR"
echo ""

# 方法1：sqlite3 .backup 一致性快照（推荐，替换直接 cp）
echo "创建一致性数据库快照..."
sqlite3 "$RESOLVED_DB_PATH" ".backup '$BACKUP_DIR/dev.db.backup_$TIMESTAMP'"
echo "✅ 快照: $BACKUP_DIR/dev.db.backup_$TIMESTAMP"

# 方法2：SQL 转储
echo "创建 SQL 转储备份..."
sqlite3 "$RESOLVED_DB_PATH" .dump > "$BACKUP_DIR/backup_$TIMESTAMP.sql"
echo "✅ SQL: $BACKUP_DIR/backup_$TIMESTAMP.sql"

# 方法3：压缩 SQL 转储
echo "创建压缩备份..."
gzip -c "$BACKUP_DIR/backup_$TIMESTAMP.sql" > "$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"
echo "✅ GZ: $BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

# 备份完成后清理未压缩 SQL（可选，默认保留，方便直接查看）
echo ""
echo "备份完成！"
echo ""
echo "备份文件大小："
ls -lh "$BACKUP_DIR"/dev.db.backup_"$TIMESTAMP" "$BACKUP_DIR"/backup_"$TIMESTAMP".sql "$BACKUP_DIR"/backup_"$TIMESTAMP".sql.gz
