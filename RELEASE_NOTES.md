# Release Notes — Activation Manager v2.9.0

> 三大平台能力升级：PostgreSQL 支持、Next.js 15 升级、客户端 IP 信任模型根治
> 覆盖范围：`v2.8.2..v2.9.0`

---

## 🐘 PostgreSQL 支持

- **事务冲突边界化**：唯一约束冲突（项目内一机一码、requestId 幂等）从流程内层
  冒泡到事务边界，在事务外解析——Prisma 交互式事务自动回滚，兼容 PostgreSQL
  的事务中止（25P02）语义；码库补充/商城发卡的码生成移出事务，失败重试合法
- **启动引导双路径**：`DATABASE_URL` 指向 `postgres(ql)://` 时自动走 PG 实现
  （`db push` + 重新 generate + `ON CONFLICT` 幂等种子：系统配置/默认项目/
  支付渠道/管理员），SQLite 路径原样保留；Docker 镜像同样自动识别
- **provider 一键切换**：`npm run db:provider -- postgresql|sqlite`
- **schema 兼容**：复合索引名缩至 PG 63 字节上限内

详见 `docs/postgres.md`。

## ⚛️ Next.js 15 升级（停维护版本迁移）

- Next **14.2.35 → 15.5.26**，React **18 → 19**，types 与 eslint-config 全套同步
- `experimental.serverComponentsExternalPackages` → `serverExternalPackages`
- 文档工作区导航改 `<Link>`（15 的 lint 规则）
- 同步 `params`/`searchParams` 在 15.5 保持运行时兼容，Next 16 强制 Promise 时
  再统一 await 化

## 🌐 客户端 IP 信任模型（XFF 根治）

- 客户端 IP 改为从 `X-Forwarded-For` **从右往左数第 `TRUSTED_PROXY_COUNT` 个条目**
  （默认 1），不再信任客户端可伪造的最左侧值
- 可信条目不足返回 `unknown`：不命中 IP 白名单、限流归并伪造流量，**绝不回退
  `127.0.0.1`**（防白名单绕过）
- IPv6-mapped IPv4（`::ffff:a.b.c.d`）自动归一化后再做 CIDR 匹配
- 新环境变量 `TRUSTED_PROXY_COUNT`（默认 1；直连部署设 0，多层代理按层数设置）

---

## 升级说明

```bash
docker pull xdlee/activation-manager:v2.9.0
```

- SQLite 用户：数据卷直接兼容，无任何动作
- PostgreSQL 用户：把 `DATABASE_URL` 换成 PG 连接串即可——首次启动自动建表 +
  种子（管理员 `admin`，密码取 `ADMIN_INITIAL_PASSWORD`，未设则用默认 `123456`
  并强烈建议登录后立即修改）；存量 SQLite → PG 数据搬迁用 `pgloader` 或 CSV 导入，
  迁移前停服并 `npm run db:backup`
- 反向代理用户：按实际代理层数设置 `TRUSTED_PROXY_COUNT`（如 nginx 一层 = 1，
  Cloudflare + nginx = 2）；设错会让白名单/限流把真实用户当代理流量
- React 19 / Next 15 为渲染层升级，API 契约（License API / 商城 API / 管理端 API）
  与 v2.8.2 完全一致，对接方无需改动

**验证**：778 单测全绿（覆盖率 lines 96.12 / branches 85.71 / functions 91.29），
E2E 126 例全绿；`postgres:16-alpine` 实测干净库一次引导全过，登录/建项目/TIME+COUNT
发码激活消费/同机冲突 409/requestId 幂等重放全部正常；Next 15 生产构建 52 页 +
全量 E2E 通过。
