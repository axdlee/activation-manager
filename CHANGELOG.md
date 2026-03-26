# 更新日志

## [Unreleased] - 2026-03-26

> 本节根据 `2026-03-24 ~ 2026-03-26` 的真实 `git log` 归档整理，覆盖提交范围：`64f1081..9f243cc`，以及当前工作区尚未提交的 CI / Node 版本修复。

### 2026-03-24：核心能力基线落地 ✨
- 落地多项目激活码管理系统核心能力：
  - 项目管理（创建、编辑、启停、删除空项目）
  - 时间型 `TIME` / 次数型 `COUNT` 双授权模型
  - 正式接口 `activate / status / consume`
  - 兼容接口 `/api/verify`
- 新增公开 API 文档页与 JS/TS SDK：
  - `src/app/docs/api/page.tsx`
  - `src/lib/license-sdk.ts`
  - `apidocs.md`
- 新增后台统计与排查能力：
  - 项目统计
  - 消费日志
  - 消费趋势
  - CSV 导出
- 新增开发环境自动初始化与联调脚本：
  - `scripts/bootstrap-dev.ts`
  - `scripts/smoke-license-api.sh`
- 为核心业务链路补齐大量测试覆盖，包括：
  - License API
  - SDK
  - 项目统计
  - 消费日志与趋势
  - 公共页面与后台页面内容

### 2026-03-24：系统配置安全增强 🔐
- 实现敏感配置脱敏展示与安全更新机制
- 新增系统配置规则、更新标准化与后台管理测试
- 强化后台对 `jwtSecret` 等敏感项的处理，避免明文回显

### 2026-03-25：认证、授权与后端架构重构 🧱
- 重构后台认证链路：
  - 新增 `/api/admin/auth/validate`
  - 中间件与后台页面鉴权解耦
  - 登录限流与共享限流 store
  - JWT 会话时长与 cookie 行为统一
- 重构授权主链路，拆分领域服务：
  - `license-activation-flow-service`
  - `license-consume-flow-service`
  - `license-consumption-idempotency-service`
  - `license-binding-*`
  - `license-transaction-*`
  - `license-analytics-service`
  - `license-project-service`
- 引入授权事务前置准备服务，进一步降低 `license-service.ts` 职责耦合
- 增加并发、幂等、绑定冲突、聚合统计等专项测试
- 新增 GitHub Actions 质量门禁工作流 `quality-gate.yml`

### 2026-03-25：后台工作区与 UI 组件体系完善 🎨
- 将后台大页面进一步拆分为可复用工作区组件：
  - `activation-code-workspace`
  - `consumption-workspace`
  - `project-workspace`
  - `system-config-workspace`
  - `change-password-workspace`
  - `api-docs-workspace`
- 新增一批统一视觉与交互组件：
  - `WorkspaceHeroPanel`
  - `WorkspaceTabNav`
  - `DashboardSummaryCard`
  - `DashboardPaginationBar`
  - `DashboardStatusBadge`
  - `DashboardDataTable`
  - `DashboardActionPanel`
  - `DashboardCodePanel`
  - 以及多种表单/空态/加载态基础组件
- 公共页面与文档工作区样式更新，配色与视觉层次更统一

### 2026-03-26：Docker、README 与交付链路完善 🚀
- 新增 Docker 运行与部署支持：
  - `Dockerfile`
  - `docker-compose.yml`
  - `.env.docker.example`
  - `scripts/bootstrap-runtime.ts`
  - `scripts/docker-entrypoint.sh`
- 新增 DockerHub 自动发布工作流：
  - `verify -> smoke -> publish`
  - 先过质量门禁，再做容器健康检查与 smoke 联调，最后推送多架构镜像
- 支持 IPv4 CIDR 白名单规则
- README 完整重构：
  - Docker 部署说明
  - 自动发布说明
  - 接入流程说明
  - Mermaid 系统图 / 客户端流程图
  - 最新截图与功能就近配图
- 新增并更新 `Readmeimg/validation-20260325`、`validation-20260326` 截图资产，随后清理旧截图与未使用原图，降低仓库体积

### 工程修复 🔧
- **修复 GitHub Actions 持续失败问题**：将 `quality-gate.yml` 与 `docker-publish.yml` 的 Node 版本从固定 `20` 升级为跟随仓库 `.nvmrc`
- **统一 Node 主版本**：
  - 新增 `.nvmrc`
  - `package.json` 增加 `engines.node >= 22`
  - Dockerfile 同步切换到 Node 22
  - GitHub Actions 官方基础 Action 升级到 `actions/checkout@v5`、`actions/setup-node@v5`
- 修复原因：当前 `test:coverage` 使用的原生覆盖率阈值参数仅 Node 22+ 支持，Node 20 在 CI 中会直接以 `exit code 9` 失败
- **修复 GitHub Actions 在 Ubuntu Runner 上缺少 `sqlite3` 导致的质量门禁失败**：为 `quality-gate.yml` 与 `docker-publish.yml` 的 verify 阶段显式安装 `sqlite3`
- **修复 GitHub README 首个 Mermaid 图在仓库页渲染失败**：去除不兼容的节点写法与 HTML 标签，改为 GitHub Mermaid 可稳定解析的文本节点
- **修复 Docker 本地 smoke 白名单问题**：示例环境变量与 CI smoke 环境补齐常见私网段，避免 Docker / Colima / Lima 场景下后台接口被白名单误拦

### 部署与交付能力 🚀
- 新增并完善 Docker 部署链路：
  - `Dockerfile`
  - `docker-compose.yml`
  - `scripts/docker-entrypoint.sh`
  - `scripts/bootstrap-runtime.ts`
- GitHub Actions 新增 Docker 发布流水线：
  - `verify -> smoke -> publish`
  - 先执行 `quality:gate`
  - 再做容器健康检查与 smoke 联调
  - 最后发布 DockerHub 多架构镜像

### 文档与展示优化 📚
- README 重构为按功能模块配图展示
- 将系统体系图与客户端验证流程图改为 Mermaid
- 更新首页、登录页、公开 API 文档页与后台工作区截图
- 清理历史截图目录与未使用原图，降低仓库体积并减少重复资源
- 补充 Docker 部署、DockerHub 自动发布、Node 版本要求与工程保障说明

---

## [1.2.0] - 2025-06-06

> 根据 `git log`，`1.2.0版本`、`修复编译报错`、`更新测试文件`、`更新文档` 均发生在 `2025-06-06`，因此该版本的发布与同日维护记录统一归档在此。

### 新增功能 ✨
- **套餐类型系统**：支持预设套餐类型（周卡、月卡、季卡、半年卡、年卡）
  - 生成激活码时可选择套餐类型，自动设置对应有效期
  - 支持自定义天数选项
  - 套餐类型信息存储在数据库中

### 用户体验优化 💫
- **智能过期时间显示**：
  - 未激活激活码显示"激活后生效"而不是"无限期"
  - 已激活激活码显示具体的过期时间
  - 套餐类型在激活码列表中清晰显示
- **增强的筛选功能**：
  - 激活码管理页面新增套餐类型筛选
  - 状态筛选改为"未激活"、"已使用"、"已过期"
  - 筛选选项动态显示实际存在的套餐类型
- **改进的导出功能**：
  - CSV导出包含套餐类型信息
  - 过期时间显示更加准确和直观

### 界面改进 🎨
- 生成激活码页面重新设计，支持套餐类型选择
- 激活码管理页面新增套餐类型列
- 筛选区域优化为2x2布局，提升操作体验

### 同日维护补充 🛠
- 修复编译报错
- 更新测试文件
- 更新项目文档

---

## [1.1.0] - 2025-01-06

### 重要变更 🔥
- **激活码过期时间逻辑优化**：激活码现在从激活时开始计算过期时间，而不是从创建时开始
  - 未激活的激活码不会自动过期
  - 激活码可以长期存储，不用担心因为没及时使用而过期
  - 只有在激活码被首次使用时，才开始计算过期倒计时

### 新增功能 ✨
- 在数据库中添加 `validDays` 字段，用于存储激活码的有效天数
- 管理后台智能显示过期时间信息：
  - 未激活：显示"X天有效期（激活后生效）"
  - 已激活：显示具体的过期时间
  - 无限期：显示"无限期"

### 改进功能 🔧
- 更新激活码验证逻辑，支持新的过期时间计算方式
- 更新统计数据计算，正确区分已过期和可用的激活码
- 更新清理过期激活码功能，按照新逻辑识别过期激活码
- 改进CSV导出功能，正确显示激活码状态和过期信息

### 兼容性 🔄
- **完全向后兼容**：现有的激活码数据会按照新逻辑重新计算
- 旧的 `expiresAt` 字段保留，用于兼容已激活的旧数据
- 系统会自动识别新旧数据格式，无需手动迁移

### 用户体验改进 💫
- 激活码购买后可以长期保存，不用担心过期
- 管理后台显示更加直观的过期时间信息
- 更符合用户的使用习惯和期望

### 技术细节 🔧
- 新增 `validDays` 字段到 `ActivationCode` 模型
- 更新 Prisma schema 和数据库结构
- 重构验证、统计、清理等核心逻辑
- 前端界面适配新的过期时间显示逻辑

---

## [1.0.0] - 2025-01-01

### 初始版本 🎉
- 激活码生成和管理功能
- 一机器一码验证机制
- 管理员后台系统
- IP白名单访问控制
- JWT会话管理
- 数据统计和导出功能
