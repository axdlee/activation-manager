# 激活码管理系统

这是一个基于 Next.js 开发的激活码管理系统，支持**多项目**、**时间型激活码**、**次数型激活码**与**插件正式接入 API**。系统包含管理后台和验证接口，支持本地开发自动初始化。

## 功能特性

- ✅ 多项目管理（每个项目独立 `projectKey` 与激活码空间）
- ✅ `projectKey` 规范校验（统一为小写字母 / 数字 / 短横线）
- ✅ 同设备单项目唯一绑定（旧卡耗尽/过期后才允许切换新卡）
- ✅ 项目名称 / 描述编辑 / `projectKey` 一键复制
- ✅ 项目管理搜索 / 状态筛选 / 排序 / 分页
- ✅ 项目启停管理（可停用项目，停用后不可继续发码/校验）
- ✅ 激活码生成（支持批量生成，支持时间型 / 次数型）
- ✅ 激活码验证（支持一码一机，自动失效，从激活时开始计算过期时间）
- ✅ 次数型授权（支持“一个激活码 = N 次使用”）
- ✅ 插件正式接口（`activate` / `consume` / `status`）
- ✅ 插件 JS/TS SDK（统一封装 `activate` / `consume` / `status`）
- ✅ 次数扣减幂等（`consume` 支持 `requestId` 防重）
- ✅ 消费日志查询（后台可按项目 / requestId / 机器ID / 时间范围观察扣次记录）
- ✅ 消费日志服务端分页（按筛选条件返回分页结果，避免前端一次性拉全量）
- ✅ 消费日志导出（CSV 导出当前筛选结果，便于对账与排查）
- ✅ 消费日志快捷时间范围（今天 / 最近7天 / 最近30天，点击后自动刷新）
- ✅ 消费趋势图（后台可按项目查看最近 7 / 30 天每日扣次趋势）
- ✅ 消费趋势周/月聚合（支持按日 / 周 / 月观察趋势）
- ✅ 消费趋势周期对比（自动对比当前周期与上一周期的总扣次变化）
- ✅ 消费趋势项目对比（支持在后台选择第二个项目做同口径趋势对比）
- ✅ 消费趋势非零桶视图（可切换仅显示实际发生消费的时间桶）
- ✅ 消费趋势导出（可导出当前趋势视图为 CSV，并同步项目对比与非零桶筛选）
- ✅ 激活码管理（列表查看、搜索筛选、**套餐类型分类**、删除操作）
- ✅ 过期激活码处理（自动判断过期状态，支持重新绑定）
- ✅ 过期绑定清理（管理员可清理过期激活码的绑定关系）
- ✅ 数据统计面板（全局统计 + 项目级统计）
- ✅ 项目级统计筛选（可按项目聚焦查看统计数据，统计卡片与表格联动）
- ✅ 统计页运营洞察（次数使用率、峰值消费项目）
- ✅ 使用率可视化图表
- ✅ 管理员登录（单一管理员，固定账号）
- ✅ 管理员登录防暴力破解（同一 IP 连续失败自动限流）
- ✅ IP白名单访问控制
- ✅ JWT会话管理
- ✅ 现代化UI界面（标签页导航）
- ✅ 导出功能（CSV格式，支持激活码与消费日志筛选结果导出，**包含套餐类型信息**）
- ✅ 分页显示（激活码列表分页）
- ✅ 密码修改功能（管理员可在后台修改登录密码）
- ✅ 系统配置管理（前台可配置IP白名单、JWT设置等，服务端含 schema 校验 / allowlist / 事务）

## 技术栈

- **框架**: Next.js 14 (App Router)
- **数据库**: SQLite3 + Prisma ORM
- **认证**: JWT (使用jose库)
- **UI**: Tailwind CSS
- **运行环境**: Node.js >= 18

## 系统原理

### 系统体系图

![系统体系图](./Readmeimg/001.png)

### 客户端验证流程图

![激活码验证流程](./Readmeimg/002.png)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置系统

开发环境默认使用 `src/config.ts` 文件进行配置管理，无需创建 `.env` 文件。所有配置都在代码中管理，包括：

- 数据库连接配置
- JWT密钥和过期时间
- 安全配置（IP白名单、密码加密强度）
- 服务器配置

您可以根据需要修改 `src/config.ts` 中的配置项。

> 说明：本地开发可直接使用仓库内默认配置完成启动；**生产环境请务必显式提供安全的 `JWT_SECRET` 后再初始化系统配置**，系统不会再静默回退到仓库默认 JWT 密钥。

### 3. 初始化系统（推荐直接自动化）

> 从现在开始，执行 `npm run dev` 时会自动检查并初始化本地开发数据库、默认管理员账号和系统配置。<br />
> 如果你希望手动执行初始化，仍然可以继续使用下面的命令。

```bash
# 一次性执行开发环境初始化
npm run bootstrap:dev

# 初始化默认管理员账号
npm run init-default-admin

# 初始化系统配置
npm run init-system-config
```

这会在数据库中创建：

- 默认管理员账号（用户名: admin，密码: 123456）
- 默认项目（`default`）
- 系统配置项（IP白名单、JWT设置等）

其中 `npm run bootstrap:dev` 会先基于 `prisma/schema.prisma` 自动同步本地 SQLite 结构，再补齐默认项目、管理员与系统配置；对旧版 `activation_codes` 表也会自动做兼容迁移与项目回填。

生产环境初始化前，建议显式提供安全的 JWT 密钥：

```bash
JWT_SECRET="请替换为高强度随机字符串" npm run init-system-config
```

### 4. 初始化数据库

```bash
npm run db:generate
npm run db:push
```

### 5. 启动开发服务器

```bash
npm run dev
```

服务器默认会在 `http://localhost:3000` 启动；如果端口被占用，Next.js 会自动切换到其他端口。

首次启动时如果检测到本地数据库未初始化，系统会自动完成以下操作：

- 创建 `prisma/dev.db`
- 基于 Prisma schema 同步业务表结构
- 写入默认项目（`default`）
- 写入默认管理员账号（`admin / 123456`）
- 写入默认系统配置

如果你只想单独执行这一步，也可以运行：

```bash
npm run bootstrap:dev
```

## 激活码过期时间逻辑

**重要更新**：从版本 1.1.0 开始，激活码的过期时间计算方式已经优化：

### 新逻辑（推荐）

- **过期时间从激活时开始计算**
- 未激活的激活码不会自动过期
- 只有在激活码被首次使用时，才开始计算过期倒计时
- 这意味着激活码可以长期存储，不用担心因为没及时使用而过期

### 优势对比

| 特性 | 旧逻辑 | 新逻辑 |
|------|--------|--------|
| 过期计时起点 | 创建时间 | 激活时间 |
| 未使用激活码 | 可能过期 | 永不过期 |
| 存储灵活性 | 需要及时使用 | 可以长期保存 |
| 用户体验 | 可能买了激活码忘记使用导致过期 | 激活码激活后才开始计时，更合理 |

### 兼容性说明

- 系统完全兼容旧版本数据
- 现有的激活码会按照新逻辑重新计算
- 管理后台界面会智能显示过期时间信息

## 使用指南

### 管理后台

1. 访问 `http://localhost:3000/admin/login`
2. 使用默认账号密码登录：
   - 用户名：`admin`
   - 密码：`123456`
   - **重要：首次登录后请立即修改密码！**
3. 在管理后台中可以：
   - **数据统计**: 查看激活码总体使用情况和可视化图表
   - **项目级统计**: 按项目查看总发码、已激活、有效、已过期、次数剩余、次数消耗；切换项目后统计卡片、使用率与表格联动，并支持服务端 CSV 导出
   - **运营洞察**: 基于当前统计口径自动展示次数使用率与峰值消费项目，便于快速判断项目消耗效率
   - **消费趋势**: 按项目切换查看最近 7 / 30 天的日 / 周 / 月扣次趋势，支持选择第二个项目进行对比，支持仅显示非零桶，观察消费峰值、总扣次、日均扣次以及相对上一周期的变化，并可按当前视图导出单项目或双项目对比趋势数据
   - **项目管理**: 创建项目、编辑项目名称/描述、复制 `projectKey`、按关键字搜索、按状态筛选、按名称/创建时间排序、分页浏览、启用/停用项目、删除空项目
   - **生成激活码**: 批量生成时间型或次数型激活码
   - **激活码管理**: 查看所有激活码，按项目/状态筛选，删除操作，清理过期绑定
   - **消费日志**: 查看次数型激活码的扣次记录，按项目 / requestId / 机器ID / 时间范围检索；列表改为服务端分页返回，搜索与筛选支持防抖自动刷新，并显示刷新状态与最近刷新时间，快捷时间范围可立即刷新，并导出当前筛选结果
   - **修改密码**: 管理员可以修改登录密码，修改后自动登出重新登录
   - **系统配置**: 管理IP白名单、JWT设置、加密强度等系统参数

项目创建时，`projectKey` 需满足以下规则：

- 长度 `2-50`
- 仅支持小写字母 `a-z`、数字 `0-9`、短横线 `-`
- 不能以短横线开头或结尾
- 不能包含连续短横线 `--`
- 推荐使用稳定且具业务语义的 key，例如：`browser-plugin`、`plugin-a`

项目绑定规则补充说明：

- 同一台设备可以在**不同项目**下分别绑定激活码
- 但在**同一项目**下，同时只允许存在一个有效绑定
- 当旧的次数卡已耗尽，或旧的时间卡已过期后，系统才允许该设备切换并绑定新的激活码

### 插件正式接入

推荐插件端使用以下正式接口：

- `POST /api/license/activate`
- `POST /api/license/consume`
- `POST /api/license/status`

兼容接口：

- `POST /api/verify`

其中：

- `activate`：绑定设备；次数型不会扣减次数
- `status`：查询授权状态
- `consume`：真实业务发生时扣次；推荐传入 `requestId` 保证幂等

项目内已提供一个可直接复用的 SDK：

- `src/lib/license-sdk.ts`

示例：

```ts
import { createLicenseClient, isLicenseClientError } from '@/lib/license-sdk'

const client = createLicenseClient({
  baseUrl: 'http://127.0.0.1:3000',
  projectKey: 'browser-plugin',
  timeoutMs: 10000,
  maxRetries: 1,
  retryDelayMs: 200,
  onRetry(event) {
    console.warn('license retry', event.path, event.attemptCount, event.error.code)
  },
  onError(event) {
    console.error('license failed', event.path, event.attemptCount, event.error.code)
  },
  onSuccess(event) {
    console.info('license success', event.path, event.response.success)
  },
})

const activated = await client.activate({
  code: 'A1B2C3D4E5F6G7H8',
  machineId: 'machine-001',
})

const status = await client.status({
  code: 'A1B2C3D4E5F6G7H8',
  machineId: 'machine-001',
})

const consumed = await client.consume({
  code: 'A1B2C3D4E5F6G7H8',
  machineId: 'machine-001',
  requestId: 'req-001',
})

try {
  await client.consume({
    code: 'A1B2C3D4E5F6G7H8',
    machineId: 'machine-001',
    requestId: 'req-001',
  })
} catch (error) {
  if (isLicenseClientError(error)) {
    console.error(error.code, error.path, error.attemptCount)
  }
}
```

说明：

- SDK 请求统一使用 camelCase
- 响应会自动归一化为 camelCase
- `baseUrl` 支持带或不带尾部 `/`
- 可通过 `projectKey` 配置默认项目，也可在单次请求中覆盖
- 支持 `timeoutMs`、`maxRetries`、`retryDelayMs`
- 支持 `onRetry`、`onError`、`onSuccess` 生命周期 hooks，便于插件埋点与日志上报
- `activate` / `status` 可自动重试瞬时网络错误
- `consume` 仅在传入 `requestId` 时建议开启自动重试，避免重复扣次
- hook 内若抛出异常，会中断当前请求，建议仅执行轻量观测逻辑
- 业务失败会返回 `success: false`
- 网络异常、超时、响应格式异常会抛出 `LicenseClientError`

详细示例请查看：

- [API 文档](./apidocs.md)

### 本地联调自动化

服务启动后，可以直接运行：

```bash
BASE_URL=http://127.0.0.1:3000 npm run smoke:license-api
```

如果本地端口不是 `3000`，例如 `3001`：

```bash
BASE_URL=http://127.0.0.1:3001 npm run smoke:license-api
```

这个脚本会自动完成登录、建项目、生成次数卡、激活、查询状态、幂等扣次等整条链路验证。

## 开发质量门禁

日常开发可使用以下命令：

```bash
# 常规测试
npm test

# 仅统计 src/ 业务代码覆盖率，并执行最低门槛校验
npm run test:coverage

# 提交前完整门禁：lint + 覆盖率门槛 + build
npm run quality:gate
```

当前覆盖率门槛仅针对 `src/` 业务代码生效：

- 行覆盖率 `>= 90%`
- 分支覆盖率 `>= 85%`
- 函数覆盖率 `>= 90%`

补充说明：

- `npm run dev` 继续使用默认 `.next`
- `npm run build` / `npm start` 已切换为独立的 `.next-build`
- 这样在本地一边跑开发服务、一边执行构建/质量门禁时，不会再互相污染构建产物

## 项目结构

```
├── prisma/                    # Prisma配置和数据库模型
│   ├── schema.prisma         # 数据库模型定义
│   └── dev.db               # 开发环境SQLite数据库
├── scripts/                  # 工具脚本
│   ├── init-admin.ts        # 初始化管理员账号
│   ├── init-default-admin.ts # 初始化默认管理员
│   ├── init-system-config.ts # 初始化系统配置
│   ├── bootstrap-dev.ts     # 开发环境自动初始化入口
│   ├── smoke-license-api.sh # 正式接口联调脚本
│   ├── backup-db.sh         # 数据库备份脚本
│   └── restore-db.sh        # 数据库恢复脚本
├── src/
│   ├── app/                 # Next.js应用代码
│   │   ├── admin/          # 管理后台页面
│   │   │   ├── login/     # 登录页面
│   │   │   └── dashboard/ # 仪表板（含统计、生成、管理功能）
│   │   ├── api/            # API路由
│   │   │   ├── admin/     # 管理接口
│   │   │   │   ├── codes/ # 激活码相关接口
│   │   │   │   │   ├── generate/ # 生成激活码
│   │   │   │   │   ├── list/     # 获取激活码列表
│   │   │   │   │   ├── stats/    # 获取统计数据
│   │   │   │   │   ├── delete/   # 删除激活码
│   │   │   │   │   └── cleanup/  # 清理过期激活码绑定
│   │   │   │   └── projects/     # 项目管理接口
│   │   │   │   ├── login/ # 管理员登录
│   │   │   │   ├── logout/ # 管理员登出
│   │   │   │   ├── change-password/ # 修改密码
│   │   │   │   └── system-config/ # 系统配置管理
│   │   │   ├── license/   # 正式插件接入接口
│   │   │   │   ├── activate/
│   │   │   │   ├── consume/
│   │   │   │   └── status/
│   │   │   ├── verify/    # 激活码验证接口
│   │   │   ├── test-env/  # 测试环境接口
│   │   │   ├── env-test/  # 环境测试接口
│   │   │   └── debug/     # 调试接口
│   │   ├── globals.css     # 全局样式
│   │   ├── layout.tsx      # 根布局
│   │   └── page.tsx        # 首页
│   ├── lib/                # 工具库
│   │   ├── db.ts          # 数据库连接
│   │   ├── dev-bootstrap.ts # 开发环境初始化逻辑
│   │   ├── license-api.ts # license API 请求/响应适配
│   │   ├── license-route-handlers.ts # license route handler 复用逻辑
│   │   ├── license-service.ts # 激活码/项目核心服务
│   │   ├── license-status.ts # 授权状态计算
│   │   ├── jwt.ts         # JWT工具
│   │   ├── auth-middleware.ts # 认证中间件库
│   │   ├── config-service.ts  # 配置服务
│   │   └── system-config-defaults.ts # 默认系统配置
│   ├── config.ts           # 系统配置文件
│   └── middleware.ts       # Next.js中间件
├── CHANGELOG.md            # 版本更新日志
├── DATABASE_BACKUP_GUIDE.md # 数据库备份指南
├── apidocs.md             # API文档
├── xitonkaifa.md          # 系统开发文档
├── simple_test.js         # 简单测试脚本
├── package.json
├── next.config.js         # Next.js配置
├── postcss.config.js      # PostCSS配置
├── tailwind.config.js     # Tailwind配置
└── tsconfig.json          # TypeScript配置                 
```

## 安全特性

1. **密码安全**
   - 使用bcrypt加密存储密码（强度可配置）
   - 数据库存储管理员账号信息

2. **会话安全**
   - 使用httpOnly cookie
   - JWT有效期24小时（可配置）
   - 支持安全登出

3. **访问控制**
   - IP 白名单限制（开发环境可用默认配置，生产环境以系统配置为准）
   - 页面层与 API 层使用统一的后台认证 / 白名单校验策略
   - 路由级别的认证保护

4. **激活码安全**
   - 一机器一码限制
   - 智能过期处理（从激活时开始计算过期时间）
   - 自动防重复绑定

5. **配置安全**
   - 数据库驱动的配置管理
   - 前台可视化配置界面
   - 实时配置更新和缓存机制

## 部署说明

### 生产环境配置

1. 修改 `src/config.ts`，设置更强的JWT密钥
2. 配置正确的IP白名单
3. 使用生产数据库（修改Prisma schema和config.ts）
4. 启用HTTPS
5. 修改默认管理员密码

### Docker部署

可以使用以下Dockerfile：

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

## 相关文档

- 📋 **[更新日志](./CHANGELOG.md)** - 查看版本更新记录和新功能介绍
- 💾 **[数据库备份指南](./DATABASE_BACKUP_GUIDE.md)** - 详细的数据库备份与恢复操作指南
- 📖 **[API文档](./apidocs.md)** - 完整的API接口文档
- 🔧 **[系统开发文档](./xitonkaifa.md)** - 系统开发和维护相关文档

## Stargazers over time

[![Stargazers over time](https://starchart.cc/Fiftonb/Easytoac.svg?variant=adaptive)](https://starchart.cc/Fiftonb/Easytoac)
