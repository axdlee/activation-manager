# Postgres 接入指南

系统默认使用 SQLite（零配置、单文件、WAL 模式），适合单实例部署。当出现以下信号时，考虑迁移到 Postgres：

- 并发写入频繁，出现 `database is locked` 告警（WAL 已缓解但无法根治）
- 需要多应用服务器共享同一个数据库（SQLite 不能跨机器共享文件）
- 托管数据库需求（自动备份、只读副本、监控告警）

## 迁移步骤

### 1. 切换 Prisma provider

修改 `prisma/schema.prisma`：

```prisma
datasource db {
  provider = "postgresql"   // 原 "sqlite"
  url      = env("DATABASE_URL")
}
```

### 2. 调整 schema 中的 SQLite 特有写法

当前 schema 对 Postgres 兼容良好，仅需注意：

- `String` 默认映射 `text`，无需修改
- `DateTime` 默认映射 `timestamp(3)`，无需修改
- `Json` 字段（如 `ShopOrder.fulfilledCodeIds` 当前为 `String` 存储）可顺势改为 `Json` 类型（可选优化，非必须）

### 3. 环境变量

```bash
# Postgres 连接串
DATABASE_URL="postgresql://user:password@host:5432/activation_manager?schema=public"
```

### 4. 建库与初始化

```bash
npx prisma migrate deploy          # 应用迁移
npm run init-default-admin         # 初始化管理员
npm run init-system-config         # 初始化系统配置种子
```

> 历史数据迁移：SQLite → Postgres 可用 `pgloader`（自动类型映射），或按表导出 CSV 后 `\copy` 导入。迁移前务必停服并做 SQLite 备份（`npm run db:backup`）。

### 5. 部署形态

```yaml
# docker-compose.yml 片段
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: activation_manager
      POSTGRES_USER: am
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
  app:
    image: YOUR_IMAGE
    environment:
      DATABASE_URL: postgresql://am:${POSTGRES_PASSWORD}@db:5432/activation_manager?schema=public
    depends_on:
      - db
volumes:
  pgdata:
```

## 迁移后可以解锁的能力

- 多应用实例共享数据库（配合网关层限流即可横向扩容）
- Prisma `transaction` 隔离级别调优、`READ COMMITTED` 并发写
- 托管备份 / PITR / 只读副本（统计查询走副本）
