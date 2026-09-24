# Release Notes — Activation Manager v2.10.0

> 安全评审专项：v2.9.0 第三方安全评审发现的 3 项高危、4 项中危与全部低危问题收口
> 覆盖范围：`v2.9.0..v2.10.0`（六个批次，TDD 驱动，每批独立提交）

---

## 🔐 高危修复

### 1. 客户端 IP 伪造 + 无限撞库根治
- 新增薄反向代理层 `server.js`：每个请求在 `X-Forwarded-For` **末尾追加 socket 真实
  地址**——客户端携带伪造 XFF 不再能冒充白名单 IP（从右往左第 N 个可信条目取到的一定是 socket 值）
- `docker-compose.yml` 端口绑定 `127.0.0.1:3000`：直连宿主机场景下必须经反代访问
- **锁定期间仅白名单 IP 可凭正确密码解锁**：非白名单流量一律 429（含正确密码），
  攻击者换 XFF 重试不再重置撞库成本；白名单管理员凭正确密码 1 次通过并自动重置计数
- `TRUSTED_PROXY_COUNT` 语义明确：直连部署 = 1，前面有 N 层反代 = N+1

### 2. 人工收款 + 码池库存锁死
- 预占库存引入独立过期 `reservedUntil`（默认 **60 分钟**，`SHOP_STOCK_RESERVATION_TTL_MINUTES`
  可调 1 分钟–24 小时），下单抢占、履约消耗、后台清理三条路径都先过期释放
- 新增管理员取消订单接口 `POST /api/admin/shop/orders/:orderNo/cancel`（仅 pending 单，
  事务内释放预占库存；订单详情抽屉与列表页均有入口）+ 审计日志
- 单笔订单数量上限默认 **10**（`SHOP_ORDER_MAX_QUANTITY_PER_ORDER`），超限 400

### 3. PostgreSQL 生产化
- 统计看板/项目统计/消费趋势从 SQLite 方言原生 SQL（`"isUsed"=1`、`strftime`/`unixepoch`）
  重写为 **Prisma 聚合 + JS 分桶**——双库同一路径，任何 provider 不再报 SQL 方言错误
- 生产引导的 `db push` **不再携带 `--accept-data-loss`**：删列/删表/重建唯一约束等
  破坏性变更直接报错退出；空库初始化、加可空列正常通过
- 官方镜像新增 `-postgres` 变体：构建期 `TARGET_DB_PROVIDER=postgresql` 切换 schema
  并重新生成客户端，`xdlee/activation-manager:v2.10.0-postgres` 开箱即用
- CI 新增 **PostgreSQL 16 兼容任务**（服务容器 + 干净库引导 + 集成测试）

---

## 🛡️ 中危修复

- **软删码释放绑定**：软删除已绑定激活码时同步清空 `usedBy`（审计记录原值），
  该设备换绑其他码不再永久 409
- **并发回调孤儿码回收**：商城 DYNAMIC 履约预生成的码在抢占失败/事务异常时按生成
  批次回收（仅删 `isUsed:false` 的孤儿行），并发回调不再累积无主库存
- **支付配置回显脱敏**：POST 保存响应与 GET 一致走 `maskConfigPayload`
  （敏感键正则补 `appKey`），掩码占位提交自动还原原值
- **响应签名 v3（绑定请求上下文）**：新增 `x-license-signature-version: 3`——
  签名输入 `HMAC(secret, timestamp + "." + code + "|" + machineId + "." + body)`，
  截获的合法响应**无法转发**给其他激活码/设备使用；服务端按客户端声明版本签发
  （未声明回落 v2 保持兼容），**全部 16 语言 SDK 同步升级**；修复内嵌 TS 客户端
  与 Swift SDK 的 v1 验签残留

> ⚠️ **补记 v2.9.0 破坏性变更**：v2.9.0 将响应签名从 v1（`HMAC(body)`）改为 v2
> （`HMAC(timestamp + "." + body)`），未升级的自定义 v1 验签客户端升级后会验签失败。
> 当时未在发布说明标注，在此补记。验签方请升级 SDK 至 v3 并发送
> `x-license-signature-version: 3` 请求头。

---

## 🧹 低危修复

- 管理员令牌 username 不存在时**生产环境拒绝**（不再静默跳过 tokenVersion 校验；
  开发模式保留兜底令牌兼容）
- 看板统计统一过滤 `deletedAt`（软删码不计入统计，随批次 4 重写一并完成）
- 下单入口前置拒绝占位渠道（`callbackTrust === 'placeholder'`，如未接验签的
  官方支付宝/微信），防止直调 API 生成永远无法支付的单
- 订单卡密令牌支持 `X-Order-Token` 请求头（URL `?token=` 保留兼容），
  降低令牌进入访问日志与 Referrer 的泄漏面
- `restore-db.sh` 相对路径 `file:./dev.db` 按 schema 目录解析

## 已知问题（暂不处理）

- `postcss` 依赖审计告警：修复依赖 Next.js 16 内置版本升级（Next 15.5 锁定
  postcss 8.4.31），待框架大版本升级时一并解决

---

## 升级说明

1. **管理员需重新登录**：v2.10.0 起 `tokenVersion` 严格校验，改密后旧令牌立即失效
2. **验签方升级签名 v3**：SDK 全部 16 语言已同步；自研验签方请按
   `x-license-signature-version` 响应头分派（v3 绑定 `code|machineId`）
3. **订单对接方**：下单响应新增 `accessToken`，读卡密时以 `X-Order-Token` 头或
   `?token=` 参数携带；订单号本身不再返回卡密
4. **PostgreSQL 部署**：使用 `-postgres` 镜像变体，或 `npm run db:provider -- postgresql`
   后自行引导；存量库升级不再执行破坏性 schema 变更
5. **docker-compose 用户**：端口已绑定 `127.0.0.1`，远程访问请配置反向代理并按
   层数设置 `TRUSTED_PROXY_COUNT`

**Full Changelog**: https://github.com/axdlee/activation-manager/compare/v2.9.0...v2.10.0
