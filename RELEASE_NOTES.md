# Release Notes — Activation Manager v2.5.0

> 通用通知系统 · 订单数量（一单多码）· Admin API 限流 · 统一支付回调 · Python SDK · CI 加固
> 覆盖范围：`v2.4.0..HEAD`

---

## 📣 通用通知系统（管理员通知中心）

- 三类事件统一分发：**激活码到期/耗尽**、**订单发卡**、**超时订单取消**
- 三类渠道可叠加：**Webhook**（统一 envelope）/ **邮件**（SMTP，nodemailer）/ **短信**（通用 HTTP 网关 + 请求体模板）
- 发卡成功自动把卡密邮件发给买家（留了邮箱即可）；管理员可后台一键**重发卡密邮件**
- 向后兼容：未配置新 Webhook 时到期事件回落旧 `expiryWebhookUrl`，payload 结构不变
- **通知投递日志**（notification_logs）：渠道/目标/状态/错误/payload 快照，管理 API 可筛选查询
- 后台「系统配置 → 通知与告警」分组；SMTP 授权码敏感掩码、空值不覆盖

## 🛒 订单数量（一单多码）

- 下单 `quantity` 1-100：金额 = 单价 × 数量，支付后一次发 N 张卡密
- 预定义码池事务内逐张原子抢占，库存不足整体回滚（不超卖）；动态商品批量生成
- 购买页数量选择 + 合计金额；后台订单 ×N 徽标；SDK 同步支持
- 库存不足 409：「该商品库存不足，剩余 N 张」

## ⏱ 订单超时自动取消

- pending 订单超 30 分钟未支付自动取消（后台按钮 / `POST /api/admin/shop/orders/cleanup` / 外部 cron）
- 超时订单支付回调拒绝发卡；清理动作推送通知（含订单号列表）
- 后台购买中心「清理超时订单」按钮

## 🔒 安全与运维

- **Admin API 统一限流**：IP + 路径维度，默认 300 次/分钟（`ADMIN_API_RATE_LIMIT_MAX` 可调），429 + Retry-After
- **支付回调统一入口** `POST /api/shop/payment/notify/[provider]`，与独立路由并存
- **CI 加固**：新增 Playwright e2e job（失败上传报告）+ Dependabot（npm/actions 每周）
- 单测文件串行化，消除共享 SQLite 并行竞态
- 限流器预留 `RateLimitStore` 存储接口缝（多实例 Redis 预留）
- 新增运维/升级文档：`docs/operations.md`（crontab 示例、多实例注意）、`docs/postgres.md`、`docs/nextjs-upgrade-plan.md`；历史文档归档 `docs/archive/`

## 📖 SDK 与文档

- JS/TS SDK 新增 `createShopOrder` / `queryShopOrder`（含 quantity）
- **新增 Python SDK**（`sdk/python/activation_manager.py`）：activate/status/consume + 响应验签 + 重试，单文件零依赖
- API 文档重写 Shop 章节：统一回调入口、订单数量、超时取消、投递日志、双语言 SDK 用法

## 🐛 修复

- 支付回调路由限流 key 模板字符串字面量（yipay/alipay/wechat 共用同一计数桶）
- License API 项目不存在/已停用时返回业务失败而非异常
