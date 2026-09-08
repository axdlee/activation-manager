# Next.js 15/16 升级计划

> 状态：**待立项**。本文档是升级的范围评估与执行清单，未执行实际迁移。

## 为什么必须升级

当前 `next@14.2.35` 是 14.x 分支的**最终版本**，`npm audit` 显示累计 20+ 条高危公告
（DoS / 缓存投毒 / SSRF / XSS 类，多数命中 self-hosted 部署形态），14.x 分支**不再出安全补丁**。
依赖链上的 `postcss`（next 内嵌）与 `glob`（仅 devDependencies，经 eslint-config-next 引入）同样无 14.x 修复。

## 升级路径选择

| 目标 | 优势 | 代价 |
| --- | --- | --- |
| **Next 15（推荐）** | 修复全部已知高危；React 19；成熟稳定 | React 19 大版本 + 异步 API 迁移 |
| Next 16 | 更新，但生态插件兼容面较新 | 同上 + 更高的未知风险 |

推荐 **14.2.35 → 15 最新小版本**，React 18 → 19，ESLint 配置同步升 15。

## 主要破坏性变更清单（对照本仓库）

1. **异步请求 API**：`cookies()` / `headers()` / `searchParams` / `params` 变为异步
   - 涉及：`src/middleware.ts`（NextRequest 本身不变，影响小）、全部 `app/api/**/route.ts`（`params` 参数需 `await`，如 `/api/admin/codes/[id]`、`/api/shop/orders/[orderNo]`）
   - 官方 codemod：`npx @next/codemod@latest upgrade`（next 15 分支）
2. **React 19**：`react` / `react-dom` / `@types/react*` 同步升级；本仓库前端为自写组件，未用重度依赖 React 行为的库，风险可控
3. **缓存语义变更**：`fetch` / 路由默认不再缓存——本仓库 API 路由全部 `dynamic`，客户端 SDK 直连，影响集中在 `fetch` 默认值（代码内 `fetch` 均为出站通知/支付请求，不依赖缓存）
4. **`next lint` 弃用**：15 仍可用，16 移除；顺势迁移到 `eslint` CLI + `eslint-config-next`
5. **`experimental.instrumentationHook` 转正**：若启用进程内定时器（见 operations.md）更简单
6. **Prisma 5.22 与 Next 15 兼容**：无阻碍；可顺势评估 Prisma 6（非必须）

## 执行清单（预计 1~2 个工作日）

- [ ] 独立分支 `chore/next-15`，升级 `next@15` / `react@19` / `react-dom@19` / `@types/react*` / `eslint-config-next@15`
- [ ] 跑官方 codemod，逐个核对 `app/api/**` 的动态 `params` 与 `searchParams`
- [ ] 全量 `npm run quality:gate`
- [ ] `npm run test:e2e`（53 用例覆盖登录/后台/购买/支付回调全流程，是本次升级的主要安全网）
- [ ] 真实支付渠道沙箱回归（易支付 / 微信 / 支付宝回调各一笔）
- [ ] Docker 构建验证（`npm run build` + 容器启动 smoke）
- [ ] 观察期：升级后一周关注 `license-api` 指标面板的失败率异常

## 回滚方案

升级分支不合入即零影响；合入后如发现运行时问题，回滚镜像 tag 即可（SQLite 数据文件与 14/15 无格式耦合）。
