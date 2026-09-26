# Release Notes — Activation Manager v2.11.0

> 安全评审专项（第二轮）：v2.10.0 复审发现的 2 项高危、2 项中危、1 项低危收口
> 覆盖范围：`v2.10.0..v2.11.0`（三个批次，TDD 驱动，每批独立提交）

---

## 🔐 高危修复

### 1. 签名 v4 防降级重构（批次 1，f2ca219）
- **SDK 不再按响应版本头切换验签算法**：原实现按响应头降级选算法，攻击者可
  拿自己的激活码向服务端请求旧版本签名再转发给目标客户端。现 SDK 请求声明
  `x-license-signature-version: 4`，响应版本 ≠ 4 一律拒绝
  （`response signature version not supported (anti-downgrade)`）
- **签名输入追加 `requestId`**：v4 消息 =
  `HMAC(secret, ts + "." + code|machineId|requestId + "." + body)`，同码同机
  5 分钟签名窗口内截获的旧响应重放失效
- 服务端版本白名单收窄为 2/3/4，v1 下线（声明 1 回落 2）；内嵌 + 16 语言 SDK
  与各自测试桩同步升级

### 2. 同机反代 XFF 白名单绕过修复（批次 2，ce194a6）
- 原 `server.js` 对回环 socket 一律不追加 `X-Forwarded-For`——同机 nginx 部署下
  攻击者伪造 XFF 条目直接命中「倒数第 N 个」取位、穿透 IP 白名单
- 现改为**回环 socket + 进程随机密钥头**（`x-internal-xff-secret`，启动时生成于
  `require('next')` 之前）才豁免追加（middleware 内部鉴权跳专用），其余连接
  一律追加：伪造条目被追加的 `127.0.0.1` 挤出取位
- 部署语义见 `docs/operations.md`：同机反代对应 `TRUSTED_PROXY_COUNT=2`

---

## 🛡️ 中危修复

- **管理员登录锁定期失败计数**（批次 2）：用户名维度锁定期间，白名单来源的
  错密码尝试原直接 429 不计数——白名单 IP 可在锁定窗口内无限试错。现锁定
  窗口内失败尝试同样落 IP + 用户名两维度计数，锁定随持续撞库滚动延长
- **商店待支付订单频控**（批次 3，434bb9a）：同一联系方式（邮箱/手机/微信任一
  命中）最多 3 笔、同一 IP 最多 10 笔待支付订单
  （`SHOP_MAX_PENDING_ORDERS_PER_CONTACT` / `SHOP_MAX_PENDING_ORDERS_PER_IP` 可调），
  达上限下单返回 409 `shop.tooManyPendingOrders`；已支付/已取消不占额度。
  封死「少量激活码 × 循环下单锁库存 60 分钟」的预占滥用路径；订单新增
  `clientIp` 落库便于审计

---

## 🧹 低危修复

- **统计聚合下沉**（批次 3）：看板统计/项目统计/消耗趋势由全表 `findMany` 拉行
  + JS 聚合改为 Prisma `groupBy`/`_sum`/`_count` 并行聚合 + 过期判定行窄拉，
  全表加载不再发生；趋势查询按桶区间并行 `count`（命中
  `LicenseConsumption [createdAt, id]` 索引）；统计口径经真实数据库回归钉住
  与原实现等价，方言 SQL 不回潮（测试断言 `$queryRaw` 抛错）

---

## ⬆️ 升级注意

1. **SDK 必须同步升级**：旧版 SDK（按响应头降级）向 v2.11.0 服务端发起的请求
   仍可工作（服务端兼容 2/3 版本签名），但建议全部升级到 v4 以获得防降级与
   `requestId` 防重放保护；新版 SDK 对 v2.10.0 及更早服务端会因响应版本 ≠ 4
   而拒绝——**先升服务端，再升 SDK**
2. **新增环境变量（均可选）**：`SHOP_MAX_PENDING_ORDERS_PER_CONTACT`（默认 3，
   钳 1–100）、`SHOP_MAX_PENDING_ORDERS_PER_IP`（默认 10，钳 1–1000）
3. **同机 nginx 反代部署**：`TRUSTED_PROXY_COUNT` 从 1 调整为 2（语义见
   `docs/operations.md`）；middleware 内部鉴权跳走进程随机密钥头，无需配置
4. SQLite 部署 `db push` 自动加 `ShopOrder.clientIp` 可空列，无数据迁移风险

**Full Changelog**: https://github.com/axdlee/activation-manager/compare/v2.10.0...v2.11.0
