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
- 运行环境：Node.js >= 18

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

- `src/lib/license-service.ts`
  - 项目管理
  - 激活码生成
  - 授权状态计算
  - 激活 / 扣次 / 校验核心逻辑
- `src/lib/license-route-handlers.ts`
  - 把 route 层与 service 层解耦
  - 便于单测复用
- `src/lib/license-api.ts`
  - 统一处理请求字段兼容与响应字段格式

### 4. 开发环境自动初始化

启动 `npm run dev` 时，会先执行：

```bash
predev -> bootstrap:dev
```

自动补齐：

- 数据库表
- 默认项目
- 默认管理员
- 默认系统配置

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
│   ├── license-api.ts
│   ├── license-route-handlers.ts
│   ├── license-service.ts
│   ├── license-status.ts
│   ├── system-config-defaults.ts
│   ├── config-service.ts
│   ├── auth-middleware.ts
│   └── jwt.ts
└── middleware.ts

tests/
├── dev-bootstrap.test.ts
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

## 测试策略

当前已有测试覆盖：

- 数据库 bootstrap 创建与兼容补齐
- 多项目隔离
- 次数型激活码扣次
- `activate` 对次数型不扣次
- `consume` 的 `requestId` 幂等
- 正式 `/api/license/*` 路由请求格式与返回格式

运行方式：

```bash
npm test
```

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
3. 管理员账号与系统配置已转为数据库持久化
4. 默认管理员仅用于本地初始化，生产环境应立即修改

## 后续扩展建议

1. 项目启停与删除流程完善
2. 激活码批量导出 / 导入增强
3. 项目级统计报表
4. 插件 SDK 封装（前端 / Node / Python）
5. 消费日志导出与审计筛选
