# 激活码管理系统开发说明

这是当前项目的开发者视角文档，描述系统的真实结构与核心设计。

## 项目概述

系统基于 Next.js 14 + Prisma + SQLite 构建，当前支持：

1. 管理员后台登录
2. 多项目管理
3. 时间型激活码（`TIME`）
4. 次数型激活码（`COUNT`）
5. 插件正式接入 API（`activate / consume / status`）
6. 旧接口 `/api/verify` 兼容
7. 本地开发自动初始化
8. 后台消费日志查询
9. 项目级统计面板
10. 项目启停与空项目删除
11. 项目名称/描述编辑与项目列表搜索筛选排序分页

## 技术栈

- 框架：Next.js 14（App Router）
- 数据库：SQLite3 + Prisma ORM
- 认证：JWT（`jose`）
- 密码加密：`bcryptjs`
- UI：React + Tailwind CSS
- 运行环境：Node.js >= 22（仓库通过 `.nvmrc` 统一本地、CI 与 Docker 主版本）

## 当前架构重点

### 1. 多项目

- 每个项目用 `projectKey` 唯一标识
- 激活码必须归属于某个项目
- 默认兼容项目为 `default`
- 默认项目不可停用、不可删除，名称固定
- 支持在后台编辑项目名称（非默认项目）与描述
- 支持在后台按关键字搜索项目、按状态筛选、按名称/创建时间排序与分页
- 空项目允许删除；有激活码的项目不允许删除

### 2. 双授权模型

#### 时间型 `TIME`

- 首次激活时绑定设备
- 从激活时间开始计算过期时间
- 后续同设备校验不扣次

#### 次数型 `COUNT`

- 一个激活码代表 N 次使用
- `activate` 只绑定设备
- `consume` 每次真实使用扣减 1 次
- 支持 `requestId` 幂等防重

### 3. 接口分层

- `src/lib/license-project-service.ts`
  - 默认项目维护
  - 项目 CRUD
  - 项目解析（`resolveProject` / `findProjectByProjectKey`）
- `src/lib/admin-auth-service.ts`
  - 后台请求白名单与 JWT 校验
  - 统一提取客户端 IP
  - 避免将 Next 构建期 `Dynamic server usage` 哨兵错误误记为认证失败日志
- `src/lib/admin-login-rate-limit.ts`
  - 登录限流规则与共享限流器编排
  - 支持进程内 limiter 与数据库共享 limiter
- `src/lib/admin-login-rate-limit-store.ts`
  - 登录限流状态 Prisma store
  - 用数据库表在多实例间共享失败计数与锁定窗口
- `src/lib/admin-login-route-handler.ts`
  - 登录 API handler 编排
  - 便于注入限流器并保持 route 文件纯导出
- `src/lib/license-generation-service.ts`
  - 激活码批量生成
  - 批次内唯一 code 生成
  - 发码结果顺序恢复
- `src/lib/license-consumption-service.ts`
  - 消费日志查询
  - 服务端分页与筛选
- `src/lib/license-analytics-service.ts`
  - 消费趋势聚合
  - 总览统计 / 项目统计聚合
- `src/lib/license-binding-service.ts`
  - 项目内激活码查询
  - 设备绑定查询
  - 旧绑定释放
  - 同项目单设备唯一绑定冲突收敛
- `src/lib/license-binding-preflight-service.ts`
  - 授权事务前置收敛
  - 旧绑定可复用判定与释放
  - 前置绑定冲突结果收口
- `src/lib/license-code-access-service.ts`
  - 授权主链路共享查码 helper
  - 统一“不存在 / 被其他设备占用”结果
- `src/lib/license-status-query-service.ts`
  - 状态查询共享服务
  - 收敛 `getLicenseStatus` 的查码与状态结果装配
- `src/lib/license-transaction-preparation-service.ts`
  - 授权事务前置准备编排
  - 收敛“旧绑定预检查 + 查码 + helper 装配”
- `src/lib/license-action-context.ts`
  - 授权共享输入模型
  - `code / machineId / requestId` 规范化
  - request context 构造
- `src/lib/license-activation-flow-service.ts`
  - 激活链路 TIME / COUNT 分支处理
  - 首次绑定写入与唯一约束冲突收敛
- `src/lib/license-consume-flow-service.ts`
  - 校验/消费链路 TIME / COUNT 分支处理
  - requestId 占位回滚、次数扣减与状态变化收敛
- `src/lib/license-consumption-idempotency-service.ts`
  - `requestId` 占位写入
  - 幂等结果复用
  - pending 请求轮询收敛
- `src/lib/license-transaction-helpers.ts`
  - 授权事务共享 helper
  - 激活码 reload
  - 项目内设备冲突收敛
  - requestId 回滚与剩余次数结算
- `src/lib/license-result-service.ts`
  - 授权返回模型 `LicenseResult`
  - 成功/失败结果构造器收口
  - 供主链路与幂等链路复用
- `src/lib/license-service.ts`
  - 激活 / 扣次 / 校验核心链路
- `src/lib/prisma-error-utils.ts`
  - Prisma 唯一约束识别
  - 为发码链路与授权主链路提供共享错误收敛能力
- `src/lib/license-route-handlers.ts`
  - 把 route 层与 service 层解耦
  - 统一正式接口与兼容接口的请求读取、错误收敛与响应编排
  - 便于单测复用
- `src/lib/license-api.ts`
  - 统一处理请求字段兼容与响应字段格式
  - 支持正式接口响应与 legacy `/api/verify` 响应收口

### 4. 开发环境自动初始化

启动 `npm run dev` 时，会先执行：

```bash
predev -> bootstrap:dev
```

自动补齐：

- 数据库表
- 登录限流共享状态表
- 默认项目
- 默认管理员
- 默认系统配置

### 5. 构建产物隔离

- `npm run dev` 使用默认 `.next`
- `npm run build` / `npm start` 使用 `.next-build`
- 目的是避免本地开发服务运行时，再执行生产构建导致 `.next` 互相覆盖

### 6. CI / Docker Node 版本对齐

- 仓库根目录提供 `.nvmrc`
- `package.json` 通过 `engines.node` 声明 `>= 22`
- GitHub Actions 的 `quality-gate.yml` 与 `docker-publish.yml` 统一通过 `.nvmrc` 安装 Node
- Dockerfile 同步切到 Node 22，避免“本地通过 / CI 失败”或“CI 通过 / 容器行为不同”的版本漂移
- 当前 `npm run test:coverage` 使用了 Node 22 的原生覆盖率阈值参数，因此如果降回 Node 20，会在 CI 中直接以 `exit code 9` 失败

### 7. Docker 本地白名单约定

- `.env.docker.example` 默认放行：
  - `127.0.0.1`
  - `::1`
  - `10.0.0.0/8`
  - `172.16.0.0/12`
  - `192.168.0.0/16`
- 目的：兼容 Docker Desktop、Colima、Lima 及常见虚拟网桥下，宿主机通过私网地址访问容器后台的场景
- 这组配置是**本地联调默认值**，正式部署时必须按真实来源 IP 收紧

## 目录结构

```text
prisma/
├── schema.prisma

scripts/
├── bootstrap-dev.ts
├── init-default-admin.ts
├── init-system-config.ts
└── smoke-license-api.sh

src/
├── app/
│   ├── admin/
│   │   ├── login/
│   │   └── dashboard/
│   └── api/
│       ├── admin/
│       │   ├── login/
│       │   ├── logout/
│       │   ├── projects/
│       │   ├── codes/
│       │   ├── change-password/
│       │   └── system-config/
│       ├── license/
│       │   ├── activate/
│       │   ├── consume/
│       │   └── status/
│       └── verify/
├── lib/
│   ├── db.ts
│   ├── dev-bootstrap.ts
│   ├── admin-login-rate-limit.ts
│   ├── admin-login-rate-limit-store.ts
│   ├── admin-login-route-handler.ts
│   ├── license-api.ts
│   ├── license-analytics-service.ts
│   ├── license-action-context.ts
│   ├── license-activation-flow-service.ts
│   ├── license-binding-preflight-service.ts
│   ├── license-binding-service.ts
│   ├── license-code-access-service.ts
│   ├── license-status-query-service.ts
│   ├── license-transaction-preparation-service.ts
│   ├── license-consume-flow-service.ts
│   ├── license-consumption-service.ts
│   ├── license-consumption-idempotency-service.ts
│   ├── license-transaction-helpers.ts
│   ├── license-generation-service.ts
│   ├── license-project-service.ts
│   ├── license-result-service.ts
│   ├── license-route-handlers.ts
│   ├── license-service.ts
│   ├── license-status.ts
│   ├── prisma-error-utils.ts
│   ├── system-config-defaults.ts
│   ├── config-service.ts
│   ├── auth-middleware.ts
│   └── jwt.ts
└── middleware.ts

tests/
├── dev-bootstrap.test.ts
├── admin-login-rate-limit-store.test.ts
├── license-action-context.test.ts
├── license-activation-flow-service.test.ts
├── license-binding-preflight-service.test.ts
├── license-code-access-service.test.ts
├── license-status-query-service.test.ts
├── license-transaction-preparation-service.test.ts
├── license-consume-flow-service.test.ts
├── license-result-service.test.ts
├── license-service.test.ts
└── license-api-routes.test.ts
```

## 核心数据模型

### Project

| 字段 | 说明 |
|---|---|
| `id` | 主键 |
| `name` | 项目名称 |
| `projectKey` | 项目标识，唯一 |
| `description` | 项目描述 |
| `isEnabled` | 是否启用 |

### ActivationCode

| 字段 | 说明 |
|---|---|
| `code` | 激活码，唯一 |
| `projectId` | 所属项目 |
| `licenseMode` | `TIME` / `COUNT` |
| `validDays` | 时间型有效天数 |
| `totalCount` | 次数型总次数 |
| `remainingCount` | 次数型剩余次数 |
| `consumedCount` | 已消费次数 |
| `usedBy` | 绑定设备 |
| `usedAt` | 首次激活时间 |
| `expiresAt` | 时间型到期时间 |

### LicenseConsumption

用于次数型幂等扣次。

| 字段 | 说明 |
|---|---|
| `requestId` | 请求唯一标识，全局唯一 |
| `activationCodeId` | 关联激活码 |
| `machineId` | 调用设备 |
| `remainingCountAfter` | 本次处理后的剩余次数 |

### AdminLoginRateLimitState

用于后台登录失败限流共享状态。

| 字段 | 说明 |
|---|---|
| `key` | 限流维度键，当前为客户端 IP |
| `failuresJson` | 当前窗口内失败时间戳列表 |
| `lockedUntil` | 锁定截止时间 |

## API 设计

### 正式接口

#### `POST /api/license/activate`

- 绑定设备
- 时间型首次激活开始计算过期时间
- 次数型不扣次

#### `POST /api/license/status`

- 查询当前状态
- 返回是否激活、剩余次数、过期时间、是否有效

#### `POST /api/license/consume`

- 次数型扣减一次
- 推荐传 `requestId`
- 同一个 `requestId` 只处理一次

### 后台观察接口

#### `GET /api/admin/consumptions`

- 返回次数型激活码消费日志
- 支持按 `projectKey` 过滤
- 支持按 `keyword` 对 `requestId` / `machineId` / 激活码进行检索
- 支持按 `createdFrom` / `createdTo` 过滤消费时间范围
- 用于后台观察 requestId、机器ID、剩余次数变化

#### `GET /api/admin/consumptions/export`

- 导出消费日志 CSV
- 支持复用 `projectKey`、`keyword`、`createdFrom`、`createdTo` 筛选参数
- 用于后台对账、排查插件扣次行为

#### `GET /api/admin/codes/stats`

- 返回全局统计 `stats`
- 返回项目级统计 `projectStats`
- 用于后台统计页展示每个项目的发码、激活、有效、过期、次数剩余、次数消耗
- 后台可基于该结果做项目筛选与服务端 CSV 导出

#### `GET /api/admin/codes/stats/export`

- 导出项目级统计 CSV
- 支持按 `projectKey` 过滤
- 用于后台导出当前项目统计结果，方便对账与归档

### 兼容接口

#### `POST /api/verify`

旧客户端兼容入口。

当前行为：

- 时间型：激活 / 校验
- 次数型：每次调用都会扣次

因此新客户端不要再把它当正式扣次接口。

## 后台路由治理

当前后台大部分受保护 API 已统一收口到：

- `src/lib/admin-route-handler.ts`

统一能力包括：

1. 后台 JWT 鉴权失败时直接返回标准鉴权响应
2. 业务 handler 只关注自身逻辑，不再重复手写 `verifyAuth + try/catch`
3. 支持透传路由上下文参数（例如 `projects/[id]`）
4. 支持把已验证的管理员 payload 透出给业务层
5. 支持自定义错误映射

当前已迁移的后台路由类别包括：

- 消费日志 / 趋势 / 导出
- 项目统计
- 系统配置
- 修改密码
- 项目管理
- 激活码列表 / 生成 / 删除 / 过期清理

约定：

- 预期业务错误（例如非法配置、校验失败）优先走自定义错误映射，避免记录误导性的 error 栈
- 非预期异常仍统一记录 `console.error` 并返回兜底错误响应

## Dashboard 结构治理

后台 dashboard 仍是大页面，但已经开始分阶段拆分。

当前新增：

- `src/components/dashboard-data-table.tsx`
- `src/components/dashboard-action-panel.tsx`
- `src/components/dashboard-empty-state.tsx`
- `src/components/dashboard-filter-field-card.tsx`
- `src/components/dashboard-form-field.tsx`
- `src/components/dashboard-inline-action-button.tsx`
- `src/components/dashboard-loading-state.tsx`
- `src/components/dashboard-pagination-bar.tsx`
- `src/components/dashboard-project-management-row.tsx`
- `src/components/dashboard-section-header.tsx`
- `src/components/dashboard-status-badge.tsx`
- `src/components/dashboard-submit-field.tsx`
- `src/components/dashboard-summary-strip.tsx`
- `src/components/dashboard-table-container.tsx`
- `src/components/dashboard-token-list.tsx`
- `src/lib/license-command-context-service.ts`
- `src/components/workspace-hero-panel.tsx`
- `src/components/workspace-tab-nav.tsx`
- `src/components/workspace-metric-card.tsx`

已先收口的重复区域：

1. 项目 / 激活码 / 消费工作区内容区块头部
2. 项目 / 激活码 / 消费工作区 hero 头部
3. 项目工作区 tab 导航
4. 激活码工作区 tab 导航
5. 消费日志工作区 tab 导航
6. 项目 / 激活码 / 消费工作区 summary metric card
7. 激活码 / 消费工作区筛选 token 与空状态胶囊列表
8. 激活码结果页 / 消费日志结果页顶部摘要条
9. 项目列表 / 激活码结果 / 消费日志结果分页条
10. 激活码结果页 / 消费日志结果页空状态提示
11. 项目列表 / 本次生成激活码 / 激活码结果 / 消费日志结果表格容器
12. 激活码 / 消费日志工作区筛选字段卡片
13. 激活码结果页 / 消费日志结果页 loading 区块
14. 项目统计 / 项目管理 / 发码结果 / 激活码结果 / 消费日志结果的表格骨架（thead / tbody / th）
15. 项目 / 激活码状态徽标
16. 行内复制 / 删除 / 保存类操作按钮
17. 项目创建、项目筛选与发码页的表单字段结构
18. 项目创建 / 修改密码 / 系统配置保存的深色行动卡
19. 发码页时间型 / 次数型的提交区与 loading 文案切换
20. 项目管理表格中的单行编辑块（名称 / projectKey / 描述 / 状态 / 操作）
21. license-service 中的命令上下文准备（标准化 / 缺参短路 / 项目解析 / consume requestContext）
22. license-route-handlers 的统一工厂装配（request 解析 / 响应映射 / legacy 切换 / 错误响应）
23. API 文档 / 改密页 / 系统配置页通用摘要卡（DashboardSummaryCard）
24. 设置页编号提示块（DashboardNumberedList）
25. 设置页小型统计卡（DashboardStatTile）
26. API 文档请求/响应/多语言示例代码展示面板（DashboardCodePanel）
27. API 文档后台接口组卡（ApiDocsAdminGroupCard）
28. API 文档本地联调命令卡（ApiDocsDebugCommandCard）

这样做的目标：

- 降低 `src/app/admin/dashboard/page.tsx` 的重复 UI 样板
- 统一 tab 卡片视觉与交互
- 统一筛选字段卡片、加载反馈与表格容器语义
- 统一表格骨架，避免每张表都重复维护 `thead / tbody / th` 样板
- 统一状态颜色语义与行内操作按钮交互
- 统一表单字段的 label / description / control 语义结构
- 统一深色 CTA 面板的 badge / 标题 / 描述 / 操作布局
- 统一提交按钮的 loading / disabled / submit 语义
- 统一项目管理行的编辑语义与默认项目特殊限制
- 统一 license-service 入口编排前的命令上下文准备流程
- 统一 license route handler 的装配模式与 legacy/正式响应切换
- 统一设置页与 API 文档页的摘要卡视觉与结构
- 统一设置页的编号提示块和小型指标卡语义
- 统一 API 文档页的请求示例、响应示例与多语言代码展示骨架
- 统一 API 文档页后台接口分组卡与本地联调命令卡结构
- 统一 API 文档工作区的初始 tab 测试入口与高层组合回归
- 统一系统配置页的总览 / 分区导航 / 分区编辑工作区结构
- 统一改密页的摘要 / 提示 / 表单工作区结构
- 统一项目管理页的 create / manage 双工作区结构
- 统一激活码管理页的 filters / results 双工作区结构
- 统一消费日志页的 filters / logs 双工作区结构
- 统一项目筛选区与创建区的卡片式输入样式
- 为后续继续拆分 workspace 内容块打基础

## 测试策略

当前已有测试覆盖：

- 后台认证 / 白名单 / JWT 校验
- 后台项目管理 route 回归（列表 / 创建 / 更新 / 删除）
- dashboard section header 组件渲染与布局回归
- dashboard stat tile 组件渲染与样式覆盖回归
- dashboard data table 组件渲染与表头样式回归
- api docs admin group card 组件渲染与后台接口组样式回归
- api docs debug command card 组件渲染与联调命令卡样式回归
- api docs workspace 的 endpoints / examples / admin 初始 tab 组合回归
- change password workspace 的摘要、行为提示、字段可见性与 loading 态回归
- project workspace 的 create / manage 高层结构与空状态回归
- activation code workspace 的 filters / results 高层结构、结果列表与空状态回归
- consumption workspace 的 filters / logs 高层结构、快捷时间范围、结果列表与空状态回归
- system config workspace 的 tabs 构建、overview 初始态与 security 初始态回归
- dashboard action panel 组件渲染、背景插槽与样式覆盖回归
- dashboard code panel 组件渲染与代码块结构回归
- dashboard empty state 组件渲染与空状态文案回归
- dashboard filter field card 组件渲染、htmlFor 透传与样式覆盖回归
- dashboard form field 组件渲染、htmlFor 透传与样式覆盖回归
- dashboard inline action button 组件渲染与按钮属性透传回归
- dashboard loading state 组件渲染与加载态文案回归
- dashboard pagination bar 组件渲染与分页状态回归
- dashboard numbered list 组件渲染与编号样式回归
- dashboard project management row 组件渲染与默认/普通项目行回归
- dashboard summary strip 组件渲染与布局回归
- dashboard status badge 组件渲染与 tone 样式回归
- dashboard submit field 组件渲染与 loading / disabled / type 透传回归
- dashboard summary card 组件渲染与摘要视觉回归
- dashboard table container 组件渲染与容器样式回归
- dashboard token list 组件渲染与空状态回归
- dashboard workspace hero 组件渲染与结构回归
- dashboard workspace tab 组件渲染与激活态样式
- dashboard workspace metric card 组件渲染与样式覆盖
- license command context service 的缺参短路、项目解析与 requestContext 构建回归
- license route handler factory 的 request 标准化、legacyOnly 输出与错误响应回归
- 数据库 bootstrap 创建与兼容补齐
- 多项目隔离
- 次数型激活码扣次
- `activate` 对次数型不扣次
- `consume` 的 `requestId` 幂等
- 正式 `/api/license/*` 路由请求格式与返回格式

运行方式：

```bash
npm test
npm run test:coverage
npm run quality:gate
```

其中：

- `npm test`：快速回归
- `npm run test:coverage`：只统计 `src/` 业务代码覆盖率，并校验最低门槛
- `npm run quality:gate`：执行 `lint + 覆盖率门槛 + build`

当前覆盖率门槛为：

- 行覆盖率 `>= 90%`
- 分支覆盖率 `>= 85%`
- 函数覆盖率 `>= 90%`

最近一次提交级门禁结果：

- `git diff --check` ✅
- `npm run lint` ✅
- `npm run quality:gate` ✅
- 全量测试：`283 / 283` ✅
- 覆盖率：
  - 行覆盖率 `95.34%`
  - 分支覆盖率 `87.02%`
  - 函数覆盖率 `92.75%`

## 本地联调

### 启动

```bash
npm run dev
```

### 一键联调正式接口

```bash
BASE_URL=http://127.0.0.1:3000 npm run smoke:license-api
```

如果端口被占用，例如服务实际跑在 `3001`：

```bash
BASE_URL=http://127.0.0.1:3001 npm run smoke:license-api
```

## 安全与约束

1. 管理后台通过 JWT Cookie 做认证
2. 支持 IP 白名单限制
3. 登录失败限流状态已持久化到数据库，支持多实例共享锁定窗口
4. 管理员账号与系统配置已转为数据库持久化
5. 默认管理员仅用于本地初始化，生产环境应立即修改

## 后续扩展建议

1. 项目启停与删除流程完善
2. 激活码批量导出 / 导入增强
3. 项目级统计报表
4. 插件 SDK 封装（前端 / Node / Python）
5. 消费日志导出与审计筛选
