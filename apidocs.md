# API 对接指南

## 1. 接口说明

当前系统同时提供两套接口：

- **推荐正式接口**
  - `POST /api/license/activate`
  - `POST /api/license/consume`
  - `POST /api/license/status`
- **兼容旧接口**
  - `POST /api/verify`

> 新插件或新业务接入时，建议优先使用 `/api/license/*`。<br />
> `/api/verify` 仅保留为兼容入口。

---

## 2. 授权模型

### 2.1 时间型激活码（`TIME`）

- 首次激活时绑定设备
- 从**激活时刻**开始计算有效期
- 后续同设备查询/校验不扣减次数

### 2.2 次数型激活码（`COUNT`）

- 首次激活时绑定设备
- `activate` **只绑定设备，不扣减次数**
- `consume` 每次成功调用扣减 1 次
- 使用 `requestId` 可实现消费幂等

### 2.3 多项目

- 每个项目通过 `projectKey` 区分
- 激活码归属于某一个项目
- 同一台设备可在**不同项目**下各自绑定激活码

---

## 3. 字段约定

### 3.1 通用请求字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `projectKey` / `project_key` | string | 否 | 项目标识；不传时默认 `default` |
| `code` | string | 是 | 激活码 |
| `machineId` / `machine_id` | string | 是 | 设备唯一标识 |
| `requestId` / `request_id` | string | 否 | 仅 `consume` 推荐传入，用于幂等 |

### 3.2 响应字段

接口会同时返回 camelCase 和 snake_case，便于不同客户端接入：

| 字段 | 说明 |
|---|---|
| `success` | 是否成功 |
| `message` | 提示信息 |
| `licenseMode` / `license_mode` | 授权类型：`TIME` / `COUNT` |
| `expiresAt` / `expires_at` | 时间型过期时间 |
| `remainingCount` / `remaining_count` | 次数型剩余次数 |
| `isActivated` / `is_activated` | 是否已绑定设备 |
| `valid` | 当前是否仍有效 |
| `idempotent` | 本次 `consume` 是否为幂等重放 |

---

## 4. 推荐接入流程

### 4.1 用户输入激活码时

调用：

```http
POST /api/license/activate
```

用途：

- 校验激活码是否合法
- 将激活码绑定到当前设备
- 时间型：首次激活时开始计算过期时间
- 次数型：仅绑定，不扣减次数

### 4.2 展示授权状态时

调用：

```http
POST /api/license/status
```

用途：

- 查询当前激活码状态
- 获取剩余次数 / 过期时间 / 是否已激活

### 4.3 每次真实业务使用时

调用：

```http
POST /api/license/consume
```

用途：

- 次数型：每次成功使用扣减 1 次
- 时间型：只做有效性校验，不扣减次数
- 推荐每次都传 `requestId`，避免客户端重试导致重复扣次

---

## 4.4 JS / TS SDK 接入

项目已内置一个可复用 SDK：

- `src/lib/license-sdk.ts`

推荐用法：

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

const activateResult = await client.activate({
  code: 'A1B2C3D4E5F6G7H8',
  machineId: 'machine-001',
})

const statusResult = await client.status({
  code: 'A1B2C3D4E5F6G7H8',
  machineId: 'machine-001',
})

const consumeResult = await client.consume({
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

SDK 特性：

- 统一用 camelCase 发送请求
- 自动将响应归一化为 camelCase
- 支持默认 `projectKey`
- 单次请求可覆盖默认 `projectKey`
- 支持 `timeoutMs`、`maxRetries`、`retryDelayMs`
- 支持 `onRetry`、`onError`、`onSuccess` 生命周期 hooks
- `activate` / `status` 可自动重试瞬时网络错误
- `consume` 仅在传入 `requestId` 时建议开启自动重试，避免重复扣次

错误处理约定：

- 服务端正常返回时，无论业务成功还是失败，SDK 都返回统一结构，失败时可通过 `success: false` 判断
- 网络异常、超时、`fetch` 不可用、响应 JSON 解析失败时，SDK 会抛出 `LicenseClientError`
- `LicenseClientError.code` 目前包含：
  - `FETCH_UNAVAILABLE`
  - `TIMEOUT`
  - `NETWORK_ERROR`
  - `INVALID_RESPONSE`

hooks 事件说明：

- `onRetry(event)`
  - 在真正发生自动重试前触发
  - 可读取 `event.path`、`event.attemptCount`、`event.nextAttemptCount`、`event.error.code`
- `onError(event)`
  - 在最终失败前触发
  - 可读取 `event.path`、`event.attemptCount`、`event.totalAttempts`、`event.error`
- `onSuccess(event)`
  - 在请求成功并完成响应归一化后触发
  - 可读取 `event.path`、`event.attemptCount`、`event.requestBody`、`event.response`
- 当前 hooks 为请求生命周期的一部分；若 hook 内抛出异常，会中断当前请求，因此建议仅执行轻量日志 / 埋点逻辑

---

## 5. 正式接口

## 5.1 激活接口

### 请求

```http
POST /api/license/activate
Content-Type: application/json
```

```json
{
  "projectKey": "browser-plugin",
  "code": "A1B2C3D4E5F6G7H8",
  "machineId": "machine-001"
}
```

### 成功响应示例（次数型）

```json
{
  "success": true,
  "message": "激活码激活成功",
  "licenseMode": "COUNT",
  "license_mode": "COUNT",
  "expiresAt": null,
  "expires_at": null,
  "remainingCount": 2,
  "remaining_count": 2,
  "isActivated": true,
  "is_activated": true,
  "valid": true,
  "idempotent": null
}
```

### 关键行为

- `TIME`：首次激活后写入 `usedBy`、`usedAt`、`expiresAt`
- `COUNT`：首次激活后写入 `usedBy`、`usedAt`，**不扣减 `remainingCount`**

---

## 5.2 状态接口

### 请求

```http
POST /api/license/status
Content-Type: application/json
```

```json
{
  "project_key": "browser-plugin",
  "code": "A1B2C3D4E5F6G7H8",
  "machine_id": "machine-001"
}
```

### 成功响应示例

```json
{
  "success": true,
  "message": "获取激活码状态成功",
  "licenseMode": "COUNT",
  "license_mode": "COUNT",
  "expiresAt": null,
  "expires_at": null,
  "remainingCount": 2,
  "remaining_count": 2,
  "isActivated": true,
  "is_activated": true,
  "valid": true,
  "idempotent": null
}
```

---

## 5.3 扣次接口

### 请求

```http
POST /api/license/consume
Content-Type: application/json
```

```json
{
  "projectKey": "browser-plugin",
  "code": "A1B2C3D4E5F6G7H8",
  "machineId": "machine-001",
  "requestId": "req-001"
}
```

### 第一次扣次成功响应

```json
{
  "success": true,
  "message": "激活码验证成功",
  "licenseMode": "COUNT",
  "license_mode": "COUNT",
  "remainingCount": 1,
  "remaining_count": 1,
  "isActivated": true,
  "is_activated": true,
  "valid": true,
  "idempotent": false
}
```

### 同一 `requestId` 重放响应

```json
{
  "success": true,
  "message": "请求已处理",
  "licenseMode": "COUNT",
  "license_mode": "COUNT",
  "remainingCount": 1,
  "remaining_count": 1,
  "isActivated": true,
  "is_activated": true,
  "valid": true,
  "idempotent": true
}
```

### 关键行为

- `COUNT`
  - 剩余次数 > 0 才允许扣减
  - 同一 `requestId` 只会成功扣减一次
- `TIME`
  - 行为等同“有效性校验”
  - 不扣减次数

---

## 6. 兼容接口

## 6.1 旧接口 `/api/verify`

### 请求

```http
POST /api/verify
Content-Type: application/json
```

```json
{
  "project_key": "browser-plugin",
  "code": "A1B2C3D4E5F6G7H8",
  "machine_id": "machine-001"
}
```

### 当前兼容行为

- 本质上走当前系统的“验证 / 消费”逻辑
- `TIME`：首次调用会激活，后续做有效性校验
- `COUNT`：**每调用一次就会扣减一次**

> 因此，新的浏览器插件不要继续把 `/api/verify` 当成正式扣次接口使用。<br />
> 正式接入请拆分为 `activate + status + consume`。

---

## 7. 常见错误

### 激活码不存在

```json
{
  "success": false,
  "message": "激活码不存在"
}
```

### 激活码已被其他设备使用

```json
{
  "success": false,
  "message": "激活码已被其他设备使用"
}
```

### 次数已用完

```json
{
  "success": false,
  "message": "激活码可用次数已用完"
}
```

### requestId 冲突

```json
{
  "success": false,
  "message": "requestId 已被其他请求使用"
}
```

### 参数缺失

```json
{
  "success": false,
  "message": "激活码和机器ID不能为空"
}
```

---

## 8. 本地联调示例

### 8.1 启动服务

```bash
npm run dev
```

### 8.2 自动化烟雾测试

```bash
BASE_URL=http://127.0.0.1:3000 npm run smoke:license-api
```

如果你的本地服务跑在别的端口，例如 `3001`：

```bash
BASE_URL=http://127.0.0.1:3001 npm run smoke:license-api
```

这个脚本会自动完成：

1. 管理员登录
2. 创建项目
3. 生成次数型激活码
4. 调用 `activate`
5. 调用 `status`
6. 用同一个 `requestId` 连续调用两次 `consume`
7. 用新的 `requestId` 再调用一次 `consume`

---

## 9. 机器 ID 建议

- 保证**同一设备稳定**
- 保证**不同设备唯一**
- 不要直接使用容易变化的临时值

建议做法：

- 浏览器插件：本地生成并持久化一个 UUID
- 桌面客户端：优先使用系统机器标识，再做哈希

---

## 10. 管理后台接口（补充）

目前后台已支持：

- 项目管理：`/api/admin/projects`
- 项目启停：`PATCH /api/admin/projects/{id}`
- 项目名称更新：`PATCH /api/admin/projects/{id}`（传 `name`）
- 项目描述更新：`PATCH /api/admin/projects/{id}`（传 `description`）
- 删除空项目：`DELETE /api/admin/projects/{id}`
- 生成激活码：`/api/admin/codes/generate`
- 激活码列表：`/api/admin/codes/list`
- 统计：`/api/admin/codes/stats`
- 项目统计导出：`/api/admin/codes/stats/export`
- 消费日志：`/api/admin/consumptions`
- 消费日志导出：`/api/admin/consumptions/export`

推荐管理流程：

1. 创建项目
2. 根据业务情况启用/停用项目
3. 为项目生成时间型或次数型激活码
4. 插件端按 `projectKey` 调用正式接口

### 项目管理规则

- 默认项目 `default` 不允许删除
- 默认项目不允许停用
- 默认项目名称固定，不允许修改
- 支持直接在后台编辑项目名称（非默认项目）与项目描述
- 支持在后台一键复制 `projectKey`
- 支持项目列表关键字搜索、状态筛选、排序与分页
- 只有**空项目**允许删除
- 项目停用后，正式接口会返回“项目已停用”

### 消费日志查询示例

```http
GET /api/admin/consumptions?projectKey=browser-plugin
```

支持参数：

- `projectKey`：按项目过滤
- `keyword`：按 `requestId` / `machineId` / 激活码模糊过滤
- `createdFrom`：按消费时间起始值过滤（ISO 时间）
- `createdTo`：按消费时间结束值过滤（ISO 时间）

### 消费日志导出示例

```http
GET /api/admin/consumptions/export?projectKey=browser-plugin&keyword=req-001&createdFrom=2026-03-01T00:00:00.000Z&createdTo=2026-03-31T23:59:59.999Z
```

返回：

- `text/csv` 文件下载
- 表头包含：项目、项目标识、激活码、requestId、机器ID、授权类型、剩余次数、消费时间

返回字段包含：

- `requestId`
- `machineId`
- `remainingCountAfter`
- `createdAt`
- `activationCode.code`
- `activationCode.project.projectKey`

### 消费趋势示例

```http
GET /api/admin/consumptions/trend?projectKey=browser-plugin&days=7
```

支持参数：

- `projectKey`：按项目过滤；不传时汇总全部项目
- `days`：趋势范围天数，当前支持 `1-90`，后台默认使用 `7`，界面内置快捷项为 `7` / `30`
- `granularity`：聚合粒度，支持 `day` / `week` / `month`，默认 `day`

返回：

- `trend.days`
- `trend.granularity`
- `trend.totalConsumptions`
- `trend.maxBucketConsumptions`
- `trend.maxDailyConsumptions`
- `trend.comparison`
- `trend.points[]`

`trend.comparison` 包含：

- `previousRangeStart`：上一周期开始日期，格式 `YYYY-MM-DD`
- `previousRangeEnd`：上一周期结束日期，格式 `YYYY-MM-DD`
- `previousTotalConsumptions`：上一周期总扣次
- `changeCount`：当前周期相较上一周期的增减值
- `changePercentage`：当前周期相较上一周期的变化百分比；若上一周期为 `0` 且当前周期大于 `0`，返回 `null`

`trend.points[]` 每项包含：

- `date`：`YYYY-MM-DD`
- `label`：当前时间桶展示文案（如 `03-18`、`03-16~03-22`、`2026-03`）
- `count`：当前时间桶内的消费次数

### 消费趋势导出示例

```http
GET /api/admin/consumptions/trend/export?projectKey=browser-plugin&days=30&granularity=week
```

双项目对比导出示例：

```http
GET /api/admin/consumptions/trend/export?projectKey=browser-plugin&compareProjectKey=desktop-helper&days=30&granularity=week&hideZeroBuckets=true
```

支持参数：

- `projectKey`：主项目；不传时汇总全部项目
- `compareProjectKey`：可选，对比项目；当其存在且与 `projectKey` 不同时，导出双项目对比 CSV
- `days`：趋势范围天数
- `granularity`：聚合粒度，支持 `day` / `week` / `month`
- `hideZeroBuckets`：可选，传 `true` 时仅导出非零时间桶；单项目导出时过滤 `count = 0` 的时间桶，双项目导出时过滤“主项目与对比项目都为 0”的时间桶

返回：

- `text/csv` 文件下载
- 单项目导出表头包含：项目、项目标识、统计粒度、时间范围、消费次数
- 双项目导出表头包含：项目、项目标识、对比项目、对比项目标识、统计粒度、时间范围、当前项目消费次数、对比项目消费次数、差值

### 统计接口返回扩展

```http
GET /api/admin/codes/stats
```

当前除全局 `stats` 外，还会返回：

- `projectStats[]`

每项包含：

- `name`
- `projectKey`
- `isEnabled`
- `totalCodes`
- `usedCodes`
- `activeCodes`
- `expiredCodes`
- `countRemainingTotal`
- `countConsumedTotal`

管理后台当前支持：

- 项目级统计按项目筛选
- 将当前筛选结果通过服务端接口导出为 CSV
- 基于当前统计口径展示次数使用率与峰值消费项目
- 按项目查看最近 7 / 30 天消费趋势图
- 支持在后台选择第二个项目进行同时间范围、同粒度的趋势对比
- 支持按日 / 周 / 月聚合趋势
- 支持切换仅显示非零消费时间桶（仅影响后台图表展示）
- 自动展示当前周期相较上一周期的总扣次变化
- 支持导出当前趋势视图为 CSV，项目对比与非零桶筛选可同步带入导出

### 项目统计导出示例

```http
GET /api/admin/codes/stats/export?projectKey=browser-plugin
```

支持参数：

- `projectKey`：按项目标识过滤；不传时导出全部项目统计

返回：

- `text/csv` 文件下载
- 表头包含：项目、项目标识、状态、总激活码、已激活、有效、已过期、次数剩余、次数消耗
