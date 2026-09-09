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
- 同一台设备在**同一项目**下同时只能绑定一个有效激活码
- 当旧的次数卡已耗尽或旧的时间卡已过期后，才允许切换绑定新的激活码

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

## 4.4 SDK 接入（JS/TS 与 Python）

项目已内置两个可复用 SDK：

- JS/TS：`src/lib/license-sdk.ts`（Next.js 应用内 `@/lib/license-sdk` 引用）
- Python：`sdk/python/activation_manager.py`（单文件、零第三方依赖，Python 3.8+）
- Go / Java / PHP / Ruby：`sdk/` 下各语言目录（同样单文件零依赖，契约与错误分类与 JS SDK 对齐）
  - 总览与语言选择建议见 [sdk/README.md](./sdk/README.md)

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

SDK 同样内置购买端（Shop API）方法：

```ts
// 创建购买订单：返回 { success, order, payment }
// order.orderNo 用于支付跳转与后续查询 / 找回
const createResult = await client.createShopOrder({
  productId: 1,
  providerId: 'yipay',
  quantity: 2,
  contactEmail: 'buyer@example.com',
})

// 查询订单 / 找回卡密：联系方式需与下单时一致
const queryResult = await client.queryShopOrder({
  orderNo: createResult.order?.orderNo ?? '',
  contactEmail: 'buyer@example.com',
})

// 已发卡订单的 codes 数组包含卡密
console.log(queryResult.codes?.[0]?.code)
```

Python SDK 等价用法：

```python
from activation_manager import create_client

client = create_client(base_url="http://127.0.0.1:3000", project_key="browser-plugin")

activate_result = client.activate(code="A1B2C3D4E5F6G7H8", machine_id="machine-001")
status_result = client.status(code="A1B2C3D4E5F6G7H8", machine_id="machine-001")
consume_result = client.consume(code="A1B2C3D4E5F6G7H8", machine_id="machine-001", request_id="req-001")
```

Python SDK 自测：`python3 sdk/python/test_sdk.py`

购买端方法说明：

- `createShopOrder(payload)`：对应 `POST /api/shop/orders`，`contactEmail` / `contactPhone` / `contactWechat` 至少提供一个
- `queryShopOrder(payload)`：对应 `POST /api/shop/orders/query`，校验「订单号 + 联系方式」匹配后返回订单状态与卡密
- 与授权方法一致，网络异常时抛出异常；业务失败通过返回值 `success: false` 与 `message` 判断

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
- `page`：页码，默认 `1`
- `pageSize`：每页条数，默认 `10`，最大 `100`

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
- `pagination.total`
- `pagination.page`
- `pagination.pageSize`
- `pagination.totalPages`

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

---

## 11. 购买中心（Shop）公开 API

购买中心对外提供商品浏览、下单、支付渠道查询与订单查询找回四组公开接口。所有接口在后台关闭购买中心总开关（系统配置 `shopEnabled`）时统一返回 `403`：

```json
{ "success": false, "message": "购买中心已停用" }
```

### 11.1 商品列表

```http
GET /api/shop/products?sort=priceAsc
```

- `sort`（可选）：`recommended`（默认，按 sortOrder）| `priceAsc` | `priceDesc` | `newest`
- 仅返回启用中的商品；预定义码池商品附带 `availableStock`（剩余库存），售罄为 `0`

响应示例：

```json
{
  "success": true,
  "products": [
    {
      "id": 1,
      "name": "月卡",
      "description": "30 天有效期",
      "licenseMode": "TIME",
      "cardType": "月卡",
      "validDays": 30,
      "totalCount": null,
      "priceInCents": 990,
      "projectKey": "browser-plugin",
      "stockMode": "PREDEFINED",
      "availableStock": 12
    }
  ]
}
```

### 11.2 支付渠道列表

```http
GET /api/shop/payment/channels
```

仅返回**已启用且必需配置齐全**的渠道。响应示例：

```json
{
  "success": true,
  "channels": [
    { "id": "manual", "name": "手动收款确认", "supportsOnlinePayment": false },
    { "id": "yipay", "name": "易支付", "supportsOnlinePayment": true }
  ]
}
```

### 11.3 创建订单

```http
POST /api/shop/orders
```

请求体：

```json
{
  "productId": 1,
  "providerId": "yipay",
  "quantity": 2,
  "contactEmail": "buyer@example.com",
  "contactPhone": "",
  "contactWechat": ""
}
```

- `productId` 必填；`providerId` 必须是 11.2 中列出的渠道
- `quantity`（可选，默认 1）：购买数量，1-100；一单按数量发多张卡密，金额 = 单价 × 数量
- `contactEmail` / `contactPhone` / `contactWechat` 至少提供一个（用于卡密找回）
- 预定义码池商品售罄 / 库存不足时返回 `409`：

```json
{ "success": false, "message": "该商品已售罄，请等待补货" }
```

```json
{ "success": false, "message": "该商品库存不足，剩余 2 张" }
```

成功响应（`manual` 渠道附带收款说明，在线渠道返回支付跳转参数）：

```json
{
  "success": true,
  "order": {
    "orderNo": "SOABC123XYZ",
    "productName": "月卡",
    "quantity": 2,
    "amountInCents": 1980,
    "status": "pending",
    "provider": "yipay"
  }
}
```

### 11.4 订单超时自动取消

- 待支付（`pending`）订单超过 **30 分钟**未支付，会被后台「清理超时订单」按钮或外部 cron 触发的清理接口标记为 `cancelled`
- 超时订单在支付回调到达时不会再发卡（返回「订单已取消」）
- 管理员配置通知渠道后，清理动作会推送通知（含订单号列表）

### 11.5 订单查询 / 卡密找回

```http
POST /api/shop/orders/query
Content-Type: application/json
```

```json
{
  "orderNo": "SOABC123XYZ",
  "contactEmail": "buyer@example.com"
}
```

- `orderNo` 必填；`contactEmail` / `contactPhone` / `contactWechat` 需与下单时**任意一项完全一致**才能查询
- 不匹配返回 `403`；已发卡订单返回 `codes` 数组，未发卡返回当前状态

成功响应示例：

```json
{
  "success": true,
  "order": {
    "orderNo": "SOABC123XYZ",
    "status": "fulfilled",
    "amountInCents": 990,
    "productName": "月卡",
    "createdAt": "2026-09-08T04:00:00.000Z",
    "paidAt": "2026-09-08T04:01:00.000Z",
    "fulfilledAt": "2026-09-08T04:01:01.000Z"
  },
  "codes": [
    { "id": 1, "code": "A1B2C3D4E5F6G7H8", "cardType": "月卡" }
  ]
}
```

### 11.6 支付回调（由支付网关调用）

- **统一入口（推荐）**：`POST /api/shop/payment/notify/[provider]`，如 `.../notify/yipay`、`.../notify/alipay`、`.../notify/wechat`；内部按渠道适配器验签后自动发卡
- 独立入口（等价，可并存）：`POST /api/shop/payment/yipay` | `/wechat` | `/alipay`
- 通用回调（自建监控 / 其他渠道）：`POST /api/shop/payment/webhook`，请求体 `{ orderNo, paid, transactionId? }`；渠道配置 secret 后必须携带 `x-webhook-secret` 请求头
- 回调验签通过且订单匹配后自动发卡（超时已取消的订单回调会被拒绝）；全部回调接口带限流保护

### 11.7 限流

公开 Shop API 全部受统一速率限制（IP 维度，默认 60 次/分钟，`SHOP_API_RATE_LIMIT_MAX` 可调），超限返回 `429` 与 `Retry-After`。

---

## 12. 管理后台 Shop API

管理接口均需登录态（admin cookie），未登录返回 `401`。所有管理接口（含下表）统一受 Admin API 速率限制（IP + 路径维度，默认 300 次/分钟，`ADMIN_API_RATE_LIMIT_MAX` 可调），超限返回 `429` 与 `Retry-After`。

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/admin/shop/products` | GET / POST | 商品列表 / 创建（含 `stockMode`） |
| `/api/admin/shop/products/[id]` | PATCH / DELETE | 编辑商品 / 删除（有订单时拒绝） |
| `/api/admin/shop/products/restock` | POST | 预定义商品补货 `{productId, amount}`，1-100 |
| `/api/admin/shop/orders` | GET | 订单列表，支持 `status` / `provider` / `page` / `pageSize` |
| `/api/admin/shop/orders/[orderNo]/confirm` | POST | manual 渠道人工确认发卡 |
| `/api/admin/shop/orders/[orderNo]/resend-email` | POST | 重发买家卡密邮件（需已发卡且留了邮箱；邮件渠道未配置返回 502） |
| `/api/admin/shop/orders/cleanup` | POST | 取消超过 30 分钟未支付的待支付订单，返回 `{cancelled}` |
| `/api/admin/shop/payment-configs` | GET / POST | 渠道配置读写；GET 返回 `missingKeys` / `configComplete` |
| `/api/admin/notifications/logs` | GET | 通知投递日志，支持 `event` / `channel` / `status` / `relatedId` 筛选 |
| `/api/admin/system-config` | GET / POST | 系统配置（含 `shopEnabled`、`notify*` 通知渠道等全部配置项） |

### 12.1 通知渠道配置（管理员通知中心）

系统配置（后台「系统配置 → 通知与告警」分组，或 `POST /api/admin/system-config`）支持为关键业务事件配置三类通知渠道：

| 配置项 | 说明 |
| --- | --- |
| `notifyWebhookUrl` | 通用通知 Webhook：到期 / 发卡 / 超时取消等事件 POST JSON（`{event, title, body, data, notifiedAt}`） |
| `notifyEmailSmtp*` | 邮件通知（SMTP）：host / port / user / pass / from / to；配置后事件同时发邮件 |
| `notifySms*` | 短信通知（通用 HTTP 网关）：`notifySmsApiUrl` + `notifySmsApiBody` 模板（`{phone}`/`{content}` 占位符）+ `notifySmsPhones` |

行为约定：

- 事件类型：`LICENSE_EXPIRED`（激活码到期/耗尽）、`SHOP_ORDER_PAID_FULFILLED`（订单发卡）、`SHOP_ORDER_TIMEOUT_CANCELLED`（超时取消）
- 未配置的渠道自动跳过；单渠道失败不影响其他渠道
- 配置 `notifyWebhookUrl` 后，激活码到期事件优先走该地址；未配置时回落到旧「到期通知接口」`expiryWebhookUrl` 并保持原始扁平 payload 结构（向后兼容）
- 订单发卡时，若买家留了邮箱且邮件渠道已配置，系统会把卡密自动发送到买家邮箱
- 每次实际投递（非跳过）都会写入投递日志（`GET /api/admin/notifications/logs` 可查），失败便于排查与重发
