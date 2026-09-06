# Release Notes — Activation Manager v2.3.0

> 支付自动发卡体系、社区反馈修复、可观测性与 43 个 e2e 全覆盖
> 覆盖范围：`v2.2.0..HEAD` | 17 commits | 82 files | +6,357 / -167

---

## 💰 支付自动发卡体系（无商户资质方案）

参考独角数卡/彩虹发卡的多渠道适配 + 订单状态机设计，核心是**支付网关抽象层**——不绑死任何渠道：

| 能力 | 说明 |
| --- | --- |
| **购买页 `/shop`** | 选套餐 → 留联系方式（邮箱/手机/微信，至少一项）→ 生成订单 → 支付信息 → 轮询状态 → 卡密展示 |
| **支付适配器** | `PaymentProvider` 接口：manual 手动确认 / webhook 通用回调；未来接微信/支付宝/易支付只需新增适配器 |
| **订单闭环** | `pending → paid → fulfilled` 状态机；支付确认后事务自动发卡（原子抢占，并发不重复发卡） |
| **卡密找回** | 凭「订单号 + 联系方式」重新获取；联系方式不匹配拒绝（403） |
| **后台购买中心** | 商品 CRUD / 订单管理（确认收款发卡）/ 支付渠道启停 |
| **安全** | webhook 回调 secret 鉴权（timingSafeEqual）防免费刷卡；公开 Shop API 限流 |

## 🐛 社区反馈修复

- **登录死循环**：生产环境明文 HTTP 部署 Secure cookie 误设 → 协议感知（`x-forwarded-proto`）+ `COOKIE_SECURE` 环境变量覆盖
- **响应签名防篡改**：License API 响应附加 HMAC-SHA256 签名 + SDK 验签（`SIGNATURE_INVALID`）+ 5 分钟时间窗防重放
- **激活/换绑并发竞态**：原子条件更新（compare-and-swap），同码并发不再被多设备绑定、换绑不再突破次数上限
- **设备绑定开关**：激活 + 消费路径统一生效（修复 consume 路径绕过重新绑定的 bug）
- **到期通知**：status 查询触发 + 主动扫描管理 API（`/api/admin/notifications/scan-expired`，可 cron 调用）+ 系统配置页按钮
- **前端 CSV 公式注入**：激活码导出复用 `sanitizeCsvValue`（= + - @ 前缀转义）
- **有订单商品删除**：409 明确提示「建议下架」，不再 500

## 📈 可观测性与健康检查

- `/api/health` 轻量健康检查端点（SELECT 1 探活 + 503 降级）+ Docker HEALTHCHECK 接入
- **License API 运行指标**：内存滑动窗口（请求量 / 成功率 / 失败 / 限流 / 平均耗时，按接口维度），数据统计页实时面板 + 30s 自动刷新
- SQLite WAL 模式 + busy_timeout（读写不互斥，降低 `database is locked`）

## 🎨 体验优化

- 23 处「开发注释味」副标题 → 用户向产品文案
- 首页新增「购买激活码」入口；README 新增支付发卡章节
- 主题/Toast/控件库体系（v2.2.0 已发布）

## 🧪 测试与质量

| 指标 | 数值 |
| --- | --- |
| 单元测试 | **476 个**（+31） |
| 行覆盖率 | **92.52%**（≥90%） |
| 分支覆盖率 | **86.23%**（≥85%） |
| 函数覆盖率 | **90.61%**（≥90%） |
| e2e | **43 个**（+8：支付闭环 / 工程化能力 / 系统配置分区 / 运维指标） |

CI：Quality Gate 与 Docker Publish 双工作流全绿。

---

**升级提示**：本次新增 `shop_*` 三张表，Docker 部署启动时 `migrate deploy` 自动应用（存量库回退 db push 同步）。生产环境建议同时配置 `COOKIE_SECURE`（HTTPS 反代时设 `true`）、webhook 回调密钥与 License API 响应签名密钥。
