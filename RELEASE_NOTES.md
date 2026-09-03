# Release Notes — Activation Manager v2.0.0

> 全仓库安全基线加固与交付链路完善  
> 覆盖范围：`32cdb55..7f90e63` | 31 commits | 58 files | +5,177 / -2,360

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
- **数据保护**：生产环境 `prisma db push` 移除 `--accept-data-loss`，破坏性 Schema 变更直接报错，避免误操作丢数据
- **错误信息收敛**：License API 内部错误不再向客户端泄露具体 Error 消息（降级为通用 500）
- **CSV 公式注入防御**：`= + - @` 等公式字符前缀统一加 `\t`，消除 Excel/Google Sheets 执行恶意公式的风险
- **依赖清理**：移除废弃 `crypto` npm stub 依赖，源码改用 `node:crypto` 原生模块

---

## 🚀 可靠性提升

### 基础架构

| 改进 | 作用 |
|---|---|
| **Prisma 版本化迁移** | 新增 `prisma/migrations/20260902000000_init`，生产优先 `migrate deploy`，存量库 P3005 自动回退 `db push` |
| **DATABASE_URL 支持** | 数据库路径统一通过环境变量配置，消除 symlink 依赖，容器/CI/本地行为一致 |
| **SQLite 并发优化** | `sqlite3` CLI 调用增加 `.timeout 5000`，消除测试并发 `database is locked` |
| **备份原子性** | 备份脚本改用 `sqlite3 .backup` 而非 `dump`，保证一致性，支持 `DB_PATH` 环境变量 |

### 公开 License API 限流

- IP + 接口维度**内存滑动窗口**限流器，默认 120 次/分钟/端点
- 超限返回 `429 Too Many Requests` + `Retry-After` 头
- 限流器依赖注入，测试可 mock
- 相关测试覆盖

### SDK 与错误处理增强

- 新增错误码：`RATE_LIMITED`、`TIMEOUT`、`NETWORK_ERROR`、`HTTP_ERROR`、`INVALID_RESPONSE`
- `LicenseClientError.statusCode` 属性，按 HTTP 状态码分类
- 429 → RATE_LIMITED，5xx 非 JSON → HTTP_ERROR，JSON 5xx 返回标准化 payload
- Hook 错误隔离：`callHookSafely` 防止回调异常影响核心流程

### 审计日志补齐

新增 6 种审计操作类型，覆盖关键操作链路：

| 操作类型 | 标签 |
|---|---|
| `PROJECT_CREATED` | 创建项目 |
| `PROJECT_DELETED` | 删除项目 |
| `PROJECT_NAME_UPDATED` | 修改项目名称 |
| `PROJECT_DESCRIPTION_UPDATED` | 修改项目描述 |
| `PROJECT_STATUS_UPDATED` | 启停项目 |
| `CODE_BATCH_GENERATED` | 批量生成激活码 |
| `CODE_REBIND_SETTINGS_UPDATED` | 管理员调整单码策略 |
| `CODE_FORCE_UNBIND` | 管理员强制解绑 |
| `CODE_FORCE_REBIND` | 管理员强制换绑 |
| `PROJECT_REBIND_SETTINGS_UPDATED` | 管理员调整项目策略 |
| `SYSTEM_CONFIG_UPDATED` | 更新系统配置 |
| `PASSWORD_CHANGED` | 管理员修改密码 |

### 时间敏感 Bug 修复

- `license-auto-rebind-service` 中 `now` 参数未透传到 `isCodeExpired`，导致换绑过期判断依赖服务器时间而非请求时间 → 已修复，测试改为确定性断言

---

## 🧩 Dashboard 重构

**目标**：将 3488 行的单文件页面按领域模块拆分，降低维护成本。

### 拆分结果

| 度量 | 数值 |
|---|---|
| 原始行数 | 3,488 |
| 最终行数 | **2,596**（-892 行） |
| 新增 hook | **10 个** |
| 新增共享 lib | **4 个** |
| 全部行为等价 | ✅ 无回归 |

### 拆出模块

| 模块 | 文件 |
|---|---|
| 页面类型 & 常量 | `src/lib/dashboard-page-types.ts` |
| 表单工具 | `src/lib/dashboard-form-utils.ts` |
| 导出工具 | `src/lib/download-utils.ts` |
| 样式常量 | `src/lib/dashboard-class-names.ts` |
| 消费日志 hook | `src/lib/use-consumption-logs.ts` |
| 审计日志 hook | `src/lib/use-admin-audit-logs.ts` |
| 消费趋势 hook | `src/lib/use-consumption-trend.ts` |
| 统计模块 hook | `src/lib/use-dashboard-stats.ts` |
| 密码修改 hook | `src/lib/use-change-password.ts` |
| 系统配置 hook | `src/lib/use-system-config-workspace.ts` |
| 项目工作区 hook | `src/lib/use-project-workspace.ts` |
| 发码 hook | `src/lib/use-activation-code-generation.ts` |
| 单码治理 hook | `src/lib/use-activation-code-management.ts` |
| 共享数据层 hook | `src/lib/use-dashboard-data.ts` |

### 交互 Bug 修复

- **审计日志重置筛选不刷新**：`handleResetAuditLogFilters` 仅重置状态未重新拉取列表（消费日志有自动刷新 effect 兜底、审计日志没有），重置后显式以空筛选重新请求第 1 页
- **审计日志任意筛选变更不刷新**：搜索 / 项目 / 操作类型 / 时间范围变更只更新 state 不触发 fetch，列表停留在旧数据。补齐 `auditLogAutoRefreshKey` + debounce 自动刷新 effect + initialized/skip refs，与消费日志同款模式

---

## 🧪 测试体系

### 单元测试

| 度量 | 数值 |
|---|---|
| 总测试数 | **350** |
| 通过率 | 100% |
| 代码行覆盖率 | **92.54%** |
| 分支覆盖率 | **86.01%** |
| 函数覆盖率 | **90.24%** |

### 端到端冒烟（新增）

- **框架**：Playwright 1.62
- **配置**：独立 e2e 数据库（`DATABASE_URL=file:./e2e.db`）+ 3210 端口 dev server + setup/smoke 双 project
- **7 项冒烟全部通过**（13.9s 跑完）：

```
✓ 管理员登录并保存会话（auth.setup）
✓ 创建项目（UI 弹框表单 → 列表可见）
✓ 生成次数型激活码（UI 表单 → 结果表格抓 code）
✓ 公开 API 激活 → 状态 → 消费 ×2 + 幂等重放（剩余 3→2→1）
✓ 后台消费日志 API 断言 2 条 + UI 搜索定位 requestId
✓ 审计中心记录「创建项目」「批量生成激活码」
✓ 审计筛选自动刷新回归（关键词 → 空态 → 重置 → 恢复）
```

---

## 📦 Docker & CI

- `docker-compose.yml` 支持 `ADMIN_INITIAL_PASSWORD` 环境变量注入
- CI 工作流（`.github/workflows/docker-publish.yml`）在构建时自动 seed 管理员密码
- `DATABASE_URL` 容器内外一致，支持挂载持久化数据卷

---

## 📚 文档更新

- `CHANGELOG.md`：完整记录 9 轮迭代（2026-09 ~ 2026-09g）
- `ENGINEERING_HARDENING_PLAN.md`：任务表 + 9 轮迭代验证记录
- `README.md`：安全说明、限流配置、migration 流程、备份指南、e2e 使用说明
- `DATABASE_BACKUP_GUIDE.md`：存量库迁移基线流程

---

## 如何开始

```bash
# 开发
git clone https://github.com/axdlee/activation-manager.git
cd activation-manager
npm install
npm run dev  # 自动 bootstrap 开发数据库 + 默认 admin/123456

# 测试
npm test                # 350 单元测试
npm run test:coverage   # 覆盖率门禁
npm run test:e2e        # 7 项 e2e 冒烟

# 生产构建
npm run build
```

> **注意**：生产部署需设置 `ADMIN_INITIAL_PASSWORD` 环境变量，不再使用 `admin/123456` 默认凭证。