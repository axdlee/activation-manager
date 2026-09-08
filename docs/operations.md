# 运维手册

生产部署后的日常运维要点：定时任务、多实例注意事项、升级计划索引。

## 定时任务

系统有两类「扫描/清理」动作，默认**不会自动执行**，需要外部定时触发（或后台手动按钮）：

| 任务 | 作用 | 手动触发 |
| --- | --- | --- |
| 超时订单清理 | pending 订单超过 30 分钟未支付 → cancelled | 后台购买中心「清理超时订单」按钮 / `POST /api/admin/shop/orders/cleanup` |
| 到期通知扫描 | 主动扫描已到期/耗尽的激活码并触发通知（与客户端查询触发的惰性通知互补） | 后台系统配置页按钮 / `POST /api/admin/notifications/scan-expired` |

两个接口都需要管理员登录态（admin cookie），外部 cron 建议使用**通用 Webhook 中转**或以下任一方式：

### 方式 A：crontab + curl（带登录态）

先登录拿 cookie，再触发接口（示例：每 10 分钟执行一次）：

```bash
# /etc/crontab 或 crontab -e
*/10 * * * * curl -s -c /tmp/am-cookie -b /tmp/am-cookie \
  -X POST http://127.0.0.1:3000/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}' > /dev/null

*/10 * * * * curl -s -b /tmp/am-cookie -X POST \
  http://127.0.0.1:3000/api/admin/shop/orders/cleanup > /dev/null

*/30 * * * * curl -s -b /tmp/am-cookie -X POST \
  http://127.0.0.1:3000/api/admin/notifications/scan-expired > /dev/null
```

> 密码明文落在 crontab 有泄露风险；建议使用低权限专用管理员 + 只允许本机访问（ALLOWED_IPS 已默认仅本机）。

### 方式 B：系统配置页手动按钮

小体量部署可不配 cron，每天在后台点一次「清理超时订单」与「扫描到期激活码」即可（超时清理的滞后只是订单状态显示滞后，不影响发卡正确性——超时订单的支付回调会被拒绝）。

## 多实例部署注意

以下能力当前是**单实例内存态**，横向扩容前需要改造：

| 能力 | 现状 | 多实例影响 |
| --- | --- | --- |
| License / Shop / Admin API 限流 | 进程内滑动窗口 | 各实例独立计数，实际阈值 = 配置值 × 实例数 |
| 到期通知去重 | 进程内 Set | 最多重复通知（每实例一次），不丢通知 |
| Admin 登录限流 | 进程内 + DB 混合 | 登录限流部分失效 |

横向扩容前建议：限流上移到网关层（nginx `limit_req` / 云 WAF），或为限流器接入 Redis 后端（代码已预留存储接口缝，见 `src/lib/license-api-rate-limit.ts` 的 `RateLimitStore` 抽象）。

## 升级计划索引

- [Next.js 15/16 升级计划](./nextjs-upgrade-plan.md)——当前 14.2.35 已无安全补丁，升级需专项执行
- [Postgres 接入指南](./postgres.md)——SQLite 并发写瓶颈出现时的迁移路径
