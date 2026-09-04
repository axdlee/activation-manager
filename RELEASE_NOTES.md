# Release Notes — Activation Manager v2.1.0

> 安全基线加固、运维治理与交付链路完善  
> 覆盖范围：`32cdb55..7dc5038` | 42 commits | 97 files | +7,086 / -2,611

---

## 🔒 安全加固

### 关键漏洞修复

| 漏洞 | 修复方式 |
|---|---|
| **CVE-2025-29927** — Next.js middleware 授权绕过 | Next.js 14.0.0 → **14.2.35**（eslint-config-next 同步） |
| **CVE-2024-34351** — SSRF | 随版本升级修复 |
| **CVE-2024-46982** — 缓存投毒 | 随版本升级修复 |

### 生产环境安全策略

- **弱口令消除**：生产 bootstrap 强制要求 `ADMIN_INITIAL_PASSWORD` 环境变量，不再自动创建 `admin/123456` 默认凭证
- **JWT 密钥卫生**：移除公开仓库中硬编码的固定 JWT 密钥，改为 `JWT_SECRET` 环境变量注入；dev 仅用明确标注的占位串，生产缺失即拒绝初始化
- **数据保护**：生产环境 `prisma db push` 移除 `--accept-data-loss`，破坏性 Schema 变更直接报错
- **错误信息收敛**：License API 内部错误不向客户端泄露具体 Error 消息
- **CSV 公式注入防御**：`= + - @` 前缀统一加 `\t`，消除电子表格执行恶意公式风险
- **统一安全响应头**：CSP（生产不含 `unsafe-eval`、`frame-ancestors 'none'`）、X-Frame-Options DENY、nosniff、Referrer-Policy、Permissions-Policy，关闭 `X-Powered-By`
- **依赖清理**：移除废弃 `crypto` npm stub，改用 `node:crypto`

---

## 🚀 可靠性提升

| 改进 | 作用 |
|---|---|
| **Prisma 版本化迁移** | `migrate deploy` 优先，存量库 P3005 自动回退 `db push` |
| **DATABASE_URL 支持** | 数据库路径环境变量统一，容器/CI/本地行为一致 |
| **SQLite 并发优化** | `sqlite3` CLI 增加 `.timeout 5000` |
| **备份原子性** | 备份脚本改用 `sqlite3 .backup`，支持 `DB_PATH`；新增 `restore-db.sh` |
| **日志保留治理** | 新增 `scripts/prune-logs.sh`：按保留窗口（默认 180 天）清理审计/消费日志并 VACUUM 回收空间；`npm run db:prune` |
| **限流器内存治理** | 公开 License API 限流器定时清理过期 key，防伪造 IP 导致 Map 无限增长 |
| **导出边界保护** | 消费日志与审计日志导出上限 100,000 条，超限返回 400 提示缩小范围 |

### 公开 License API 限流

- IP + 接口维度内存滑动窗口，默认 120 次/分钟/端点；429 + Retry-After
- 限流器依赖注入，测试可 mock

### SDK 与错误处理增强

- 错误码：`RATE_LIMITED` / `TIMEOUT` / `NETWORK_ERROR` / `HTTP_ERROR` / `INVALID_RESPONSE`
- `LicenseClientError.statusCode`；Hook 错误隔离 `callHookSafely`

### 审计日志（15 种操作类型全链路覆盖）

`PROJECT_CREATED/DELETED/NAME_UPDATED/DESCRIPTION_UPDATED/STATUS_UPDATED`、`CODE_BATCH_GENERATED`、`CODE_REBIND_SETTINGS_UPDATED`、`CODE_FORCE_UNBIND/REBIND`、`PROJECT_REBIND_SETTINGS_UPDATED`、`SYSTEM_CONFIG_UPDATED`、`PASSWORD_CHANGED`、**`CODE_DELETED`**、**`CODE_CLEANUP_EXPIRED`**、**`ADMIN_LOGIN`**

- 关键操作审计全覆盖（含登录成功来源 IP）
- **审计故障隔离**：审计写入失败不再阻塞登录/删除/清理等业务主操作

---

## 🧩 Dashboard 重构与服务端分页

**目标**：3488 行单文件页面按领域模块拆分 + 激活码列表服务端分页。

- 页面由 3488 行降至 2600 行：**10 hooks + 5 共享 lib**，行为等价
- **激活码列表服务端分页**：`/api/admin/codes/list` 支持关键词/状态/项目/套餐筛选与分页，返回 total/totalPages/statusSummary/projectCoverage/availableCardTypes；不再嵌套绑定历史/审计（消除 N+1 加载）
- **单码详情接口** `GET /api/admin/codes/[id]`：绑定历史 + 管理员审计按需加载
- 筛选/翻页变化触发 400ms 防抖自动请求；导出走服务端筛选
- 移除客户端全量加载死代码；hero 卡改用 stats.total

### 交互 Bug 修复

- 审计日志重置筛选不刷新、任意筛选变更不刷新（自动刷新 effect 补齐）
- 激活码列表 aggregate 竞态：选中码弹框数据由详情接口接管

---

## 🧪 测试体系

| 度量 | 数值 |
|---|---|
| 单元测试 | **364**（100% 通过） |
| 代码行覆盖率 | **92.38%** |
| 分支覆盖率 | **85.82%** |
| 函数覆盖率 | **90.49%** |
| **TypeScript 全量检查**（`tsc --noEmit`） | 0 错误（纳入 quality:gate） |
| **e2e 冒烟** | **8/8 通过**（登录 → 建项目 → 发码 → 激活 → 消费 → 审计 → 分页回归） |

- 修复 tests 目录 65 个长期隐藏的类型错误（Prisma mock、组件 children、NODE_ENV 只读等）
- `quality:gate` = lint + typecheck + coverage + build；`quality:gate:full` 追加 e2e

---

## 📦 Docker & CI

- `docker-compose.yml` 支持 `ADMIN_INITIAL_PASSWORD` / `JWT_SECRET` / `ALLOWED_IPS` 注入
- CI 三道闸：**verify**（quality:gate）→ **e2e**（Playwright 冒烟，失败上传 trace）→ **smoke**（Docker Compose 真实容器 + 绑定挂载验证），全部通过才 publish
- 数据卷 `activation_manager_data:/app/data`；数据库直指卷路径（移除 symlink 与 0777 宽权限）

---

## 📚 文档更新

- `CHANGELOG.md` / `ENGINEERING_HARDENING_PLAN.md`（Iteration 09~09k）/ `README.md` / `DATABASE_BACKUP_GUIDE.md`

---

## 如何开始

```bash
# 开发
git clone https://github.com/axdlee/activation-manager.git
cd activation-manager
npm install
npm run dev  # 自动 bootstrap 开发数据库 + 默认 admin/123456

# 测试
npm test                # 364 单元测试
npm run test:coverage   # 覆盖率门禁
npm run typecheck       # TypeScript 全量检查
npm run test:e2e        # 8 项 e2e 冒烟
npm run quality:gate    # lint + typecheck + coverage + build

# 运维
npm run db:backup       # 原子备份
npm run db:prune        # 日志保留清理（默认 180 天）

# 生产构建
npm run build
```

> **注意**：生产部署需设置 `ADMIN_INITIAL_PASSWORD` 与 `JWT_SECRET` 环境变量，不再使用 `admin/123456` 默认凭证与仓库内固定密钥。