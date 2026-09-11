# 管理后台全量重构 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** 在不改变业务规则、API 契约、数据库和权限的前提下，把管理后台从单页 tab 拼装重构为任务型、可深链、响应式且交互一致的现代后台。

**Architecture:** 用新的 `AdminShell`/`PageHeader`/`PageToolbar`/`PageSection`/`DetailDrawer`/`ConfirmDialog`/`EmptyState`/`ErrorState`/`StickySaveBar` 组成页面骨架；每个业务能力通过 pathname 定位，旧 `/admin/dashboard?tab=...` 兼容跳转到新路径。业务 hooks 和 API 调用保留，页面组件只重排数据和交互。

**Tech Stack:** Next.js 14 App Router、React 18、TypeScript、Tailwind CSS、Radix/shadcn primitives、lucide-react、Recharts、Playwright、node:test。

---

## Task 1: 固化入口兼容与路由模型

**Files:**
- Create: `src/lib/admin-route-map.ts`
- Modify: `src/app/admin/dashboard/page.tsx`
- Modify: `src/app/admin/dashboard/redirect.tsx`（若不存在则创建）
- Create: `src/app/admin/overview/page.tsx`
- Create: `src/app/admin/projects/page.tsx`
- Create: `src/app/admin/licenses/page.tsx`
- Create: `src/app/admin/licenses/generate/page.tsx`
- Create: `src/app/admin/consumptions/page.tsx`
- Create: `src/app/admin/audit/page.tsx`
- Create: `src/app/admin/integration/page.tsx`
- Create: `src/app/admin/shop/products/page.tsx`
- Create: `src/app/admin/shop/orders/page.tsx`
- Create: `src/app/admin/shop/payment/page.tsx`
- Create: `src/app/admin/settings/page.tsx`
- Create: `src/app/admin/settings/security/page.tsx`
- Test: `tests/admin-route-map.test.ts`

**Step 1: Write the failing test**

覆盖每个 tab 到 pathname 的映射、未知 tab 回退 `/admin/overview`、旧 query 的兼容解析，以及 settings/security 从用户菜单可达。

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/admin-route-map.test.ts`
Expected: FAIL，因为 `admin-route-map.ts` 不存在。

**Step 3: Implement the route map**

导出：

```ts
export const ADMIN_ROUTES = {
  overview: '/admin/overview',
  projects: '/admin/projects',
  generate: '/admin/licenses/generate',
  licenses: '/admin/licenses',
  consumptions: '/admin/consumptions',
  audit: '/admin/audit',
  integration: '/admin/integration',
  shopProducts: '/admin/shop/products',
  shopOrders: '/admin/shop/orders',
  shopPayment: '/admin/shop/payment',
  settings: '/admin/settings',
  security: '/admin/settings/security',
} as const

export function resolveLegacyAdminTab(tab: string | null): string
```

旧 dashboard 页面只做兼容：读取 `tab`，`redirect(resolveLegacyAdminTab(tab))`；没有 tab 时跳 `/admin/overview`。每个新 page 先复用现有 dashboard data hooks/工作区组件，保证路径先可用，再逐页重排。

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/admin-route-map.test.ts`
Expected: PASS。

**Step 5: Commit**

```bash
git add src/lib/admin-route-map.ts src/app/admin tests/admin-route-map.test.ts
git commit -m "refactor(admin): 建立任务型路由与旧 dashboard 兼容映射"
```

---

## Task 2: 建立统一 AdminShell 与页面原语

**Files:**
- Create: `src/components/admin/admin-shell.tsx`
- Create: `src/components/admin/page-header.tsx`
- Create: `src/components/admin/page-toolbar.tsx`
- Create: `src/components/admin/page-section.tsx`
- Create: `src/components/admin/detail-drawer.tsx`
- Create: `src/components/admin/confirm-dialog.tsx`
- Create: `src/components/admin/empty-state.tsx`
- Create: `src/components/admin/error-state.tsx`
- Create: `src/components/admin/sticky-save-bar.tsx`
- Modify: `src/components/admin/sidebar-nav.tsx`
- Test: `tests/admin-page-primitives.test.ts`

**Step 1: Write failing render tests**

用 `renderToStaticMarkup` 验证：PageHeader 只有一个 h1、Toolbar 的搜索/动作槽、Drawer 有 `role=dialog` 和标题、ConfirmDialog 有取消/确认、StickySaveBar 显示未保存数量和 reset/save。

**Step 2: Run failing tests**

Run: `node --import tsx --test tests/admin-page-primitives.test.ts`
Expected: FAIL。

**Step 3: Implement primitives**

- `AdminShell` 接收 `navItems`, `activePath`, `children`, `breadcrumbs`, `actions`；桌面固定 aside，移动端使用已有 `ui-admin/sheet`，导航点击后关闭 Sheet。
- `PageHeader` props：`eyebrow?`, `title`, `description?`, `breadcrumbs?`, `actions?`；默认不绘制重复的说明卡。
- `PageToolbar` 用 `role=toolbar`，左侧 search/filter，右侧 refresh/export/more；统一 `gap-2`、最小 40px 高度。
- `DetailDrawer` 使用 Radix Dialog，打开时焦点进入标题/首控件，Escape/遮罩关闭，关闭后恢复触发按钮焦点。
- `ConfirmDialog` 显示目标、影响范围、危险级别，确认按钮 loading 时禁用。
- `EmptyState` 必须有标题 + 下一步 action；`ErrorState` 保留已有数据并提供 retry。
- `StickySaveBar` 接 `dirtyCount`, `onReset`, `onSave`, `saving`。

**Step 4: Run tests**

Run: `node --import tsx --test tests/admin-page-primitives.test.ts`
Expected: PASS。

**Step 5: Commit**

```bash
git add src/components/admin tests/admin-page-primitives.test.ts
git commit -m "refactor(admin): 建立统一 AdminShell 与页面交互原语"
```

---

## Task 3: 重构概览页

**Files:**
- Create: `src/components/admin/overview-page.tsx`
- Modify: `src/app/admin/overview/page.tsx`
- Modify: `src/components/admin/stats-overview-panel.tsx`
- Modify: `src/components/admin/license-metrics-chart.tsx`
- Test: `tests/admin-overview-page.test.ts`
- Test: `e2e/admin-overview.spec.ts`

**Step 1:** 测试页面结构：单一 PageHeader；KPI 分为总量/健康度；异常卡有 action；最近操作列表点击可打开详情。

**Step 2:** 运行测试确认失败。

**Step 3:** 实现：复用 `useDashboardStats`、`useAdminAuditLogs`；顶部只保留 4 个主 KPI；第二行放使用率和 API 指标图；第三行最近审计/异常。把“当前统计口径”作为筛选控件放到 Toolbar，不做全宽 banner。

**Step 4:** Playwright 验证 `/admin/overview`：空态、图表空态、刷新、项目范围选择、审计行详情抽屉。

**Step 5:** Commit：`refactor(admin): 重做概览页信息层级与运营入口`。

---

## Task 4: 重构项目模块

**Files:**
- Create: `src/components/admin/projects-page.tsx`
- Create: `src/components/admin/project-create-dialog.tsx`
- Create: `src/components/admin/project-detail-drawer.tsx`
- Modify: `src/app/admin/projects/page.tsx`
- Modify: `src/components/project-workspace.tsx`（拆出数据/展示，删除重复 Hero）
- Test: `tests/admin-projects-page.test.ts`
- Test: `e2e/admin-projects.spec.ts`

**Step 1:** 测试列表优先、Dialog/Drawer 语义和筛选 query。

**Step 2:** 运行失败。

**Step 3:** 实现：PageHeader 的唯一主动作“新建项目”；Toolbar 合并搜索/状态/排序为一行；列表行只显示名称/key/状态/最近活动/更多；创建和基础编辑共用 Dialog；换绑策略从“更多 → 项目详情 Drawer → 策略 section”进入；默认项目的禁用原因用 tooltip/辅助文案而非占据整行。

**Step 4:** 浏览器逐项验证：新建必填校验、projectKey 规则、Escape/遮罩/焦点恢复、编辑保存、策略保存、停用确认、URL 筛选/刷新保留。

**Step 5:** Commit：`refactor(admin): 项目列表优先并拆分创建与策略详情交互`。

---

## Task 5: 重构激活码生成与管理

**Files:**
- Create: `src/components/admin/license-generation-page.tsx`
- Create: `src/components/admin/license-filter-toolbar.tsx`
- Create: `src/components/admin/license-detail-drawer.tsx`
- Modify: `src/app/admin/licenses/page.tsx`
- Modify: `src/app/admin/licenses/generate/page.tsx`
- Modify: `src/components/activation-code-workspace.tsx`
- Modify: `src/lib/use-activation-code-generation.ts`
- Test: `tests/admin-license-pages.test.ts`
- Test: `e2e/admin-licenses.spec.ts`

**Step 1:** 测试核心字段/高级折叠、筛选 URL、危险操作确认。

**Step 2:** 运行失败。

**Step 3:** 实现：
- `/licenses/generate`：三段式表单（项目+授权类型+数量；TIME/COUNT 条件字段；高级换绑策略折叠），右下唯一 primary action；移除“更圆润表单”等实现说明。
- `/licenses`：PageToolbar 中搜索、状态、项目、套餐类型、导出；“清理过期绑定”进入 ConfirmDialog；行点击打开 DetailDrawer（绑定历史、审计、策略），复制是次动作，删除放更多。
- 列表移动端切换为记录卡，保留复制/详情/删除。

**Step 4:** 浏览器验证生成成功/失败、复制反馈、详情 Drawer、清理确认、分页/筛选 query。

**Step 5:** Commit：`refactor(admin): 拆分激活码生成与管理并优化危险操作`。

---

## Task 6: 重构消费日志与审计中心

**Files:**
- Create: `src/components/admin/consumptions-page.tsx`
- Create: `src/components/admin/consumption-detail-drawer.tsx`
- Create: `src/components/admin/audit-page.tsx`
- Create: `src/components/admin/audit-detail-drawer.tsx`
- Modify: `src/app/admin/consumptions/page.tsx`
- Modify: `src/app/admin/audit/page.tsx`
- Modify: `src/components/consumption-workspace.tsx`
- Modify: `src/components/audit-log-workspace.tsx`
- Test: `tests/admin-log-pages.test.ts`
- Test: `e2e/admin-logs.spec.ts`

**Step 1:** 测试筛选、刷新、导出、详情 Drawer。

**Step 2:** 运行失败。

**Step 3:** 实现：统一“筛选 → 结果 → 详情”结构；自动刷新改 Toolbar toggle；requestId/machineId/code/project 全部进入可折叠筛选面板；审计表不直接展示 detail JSON，改行点击 Drawer 时间线；导出/分页 query 可分享。

**Step 4:** 浏览器验证空态、错误态保留旧数据、自动刷新开关、行详情、键盘关闭。

**Step 5:** Commit：`refactor(admin): 统一消费与审计日志的排障交互`。

---

## Task 7: 重构购买中心为三个任务页

**Files:**
- Create: `src/components/admin/shop-products-page.tsx`
- Create: `src/components/admin/shop-orders-page.tsx`
- Create: `src/components/admin/shop-payment-page.tsx`
- Create: `src/components/admin/shop-product-dialog.tsx`
- Create: `src/components/admin/shop-order-detail-drawer.tsx`
- Modify: `src/app/admin/shop/products/page.tsx`
- Modify: `src/app/admin/shop/orders/page.tsx`
- Modify: `src/app/admin/shop/payment/page.tsx`
- Modify: `src/components/shop-admin-panel.tsx`（拆分数据加载与三个展示页）
- Test: `tests/admin-shop-pages.test.ts`
- Test: `e2e/admin-shop.spec.ts`

**Step 1:** 测试默认商品列表、新建 Dialog、订单筛选、渠道配置。

**Step 2:** 运行失败。

**Step 3:** 实现：
- `/shop/products` 默认列表优先；PageHeader 主动作“新建商品”；商品编辑与创建共用 Dialog；预定义码补货从商品详情/更多进入。
- `/shop/orders` 只显示订单状态/金额/联系方式摘要；订单详情 Drawer 展示卡密、投递日志与操作；清理超时订单单独 ConfirmDialog。
- `/shop/payment` 按渠道 Card 展示 enabled/configComplete/missingKeys；敏感字段显示/保存规则不变；Webhook secret、易支付、微信、支付宝各自折叠 section。
- 三页共享 ShopSubnav，pathname 驱动 active，不在一个组件里同时加载三类数据。

**Step 4:** 浏览器逐项验证创建/编辑/补货、订单详情、重发邮件、支付配置保存和失败反馈。

**Step 5:** Commit：`refactor(admin): 购买中心拆分为商品/订单/支付渠道任务页`。

---

## Task 8: 重构系统设置与账户安全

**Files:**
- Create: `src/components/admin/settings-page.tsx`
- Create: `src/components/admin/settings-section-nav.tsx`
- Create: `src/components/admin/security-page.tsx`
- Modify: `src/app/admin/settings/page.tsx`
- Modify: `src/app/admin/settings/security/page.tsx`
- Modify: `src/components/system-config-workspace.tsx`
- Modify: `src/components/change-password-workspace.tsx`
- Test: `tests/admin-settings-pages.test.ts`
- Test: `e2e/admin-settings.spec.ts`

**Step 1:** 测试设置概览、分区导航、dirty state、StickySaveBar、改密倒计时。

**Step 2:** 运行失败。

**Step 3:** 实现：设置页面只保留概览摘要+分区链接；进入分区后单一表单区和 StickySaveBar；移除重复的“配置工作台/系统配置中心/配置总览”层层标题。账户安全独立路由，用户菜单只提供“安全设置”入口；改密成功倒计时 3 秒退出。

**Step 4:** 浏览器验证白名单保护、敏感配置、保存/重置/离开提醒、改密错误和成功。

**Step 5:** Commit：`refactor(admin): 设置分区与账户安全独立成任务页`。

---

## Task 9: 重构 API 接入页

**Files:**
- Create: `src/components/admin/integration-page.tsx`
- Create: `src/components/admin/docs-sidebar.tsx`
- Create: `src/components/admin/code-example-block.tsx`
- Modify: `src/app/admin/integration/page.tsx`
- Modify: `src/components/api-docs-workspace.tsx`
- Test: `tests/admin-integration-page.test.ts`
- Test: `e2e/admin-integration.spec.ts`

**Step 1:** 测试章节导航、代码复制、后台联调入口。

**Step 2:** 运行失败。

**Step 3:** 实现：左侧章节目录/移动端下拉，右侧内容；接口/示例使用可折叠 CodeExampleBlock；“后台联调”作为明确 CTA，不和文档概览卡重复；复制反馈用统一 toast。

**Step 4:** 浏览器验证滚动定位、复制、移动端阅读、语言切换。

**Step 5:** Commit：`refactor(admin): API 接入改为章节导航与可读示例布局`。

---

## Task 10: 视觉收口、可访问性与响应式验收

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/admin/*.tsx`
- Modify: `src/app/layout.tsx`
- Test: `tests/admin-accessibility.test.ts`
- Test: `e2e/admin-responsive.spec.ts`
- Create: `docs/admin-console-operations.md`

**Step 1:** 写验收测试：所有页面最多一个 h1；所有 icon-only button 有 aria-label；所有 Dialog 有 labelledby；按钮触控尺寸 ≥40px；桌面/移动无横向溢出。

**Step 2:** 运行失败，记录基线。

**Step 3:** 收口：移除 `bg-zinc-950/30-sm` 等无效 class；修正 SSR `dir` 额外属性 warning（让服务端初始 `dir` 与脚本策略一致）；统一焦点环、滚动容器、z-index、empty/error/loading；补页面操作手册。

**Step 4:** 运行全套：

```bash
npm run lint
npx tsc --noEmit
npm test
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers npx playwright test
npm run build
```

再用真实浏览器分别操作 12 个新路由的主流程，并截图保存到临时目录而非仓库。

**Step 5:** Commit：`refactor(admin): 全量后台视觉与可访问性验收收口`。

---

## Task 11: 发布前评审与合入

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `RELEASE_NOTES.md`
- Modify: `README.md`
- Test: `e2e/admin-release-smoke.spec.ts`

**Step 1:** 更新文档：新路由表、旧兼容入口、管理员工作流、截图/验收结论。

**Step 2:** 运行 release smoke，期望所有新路由可加载且旧 query 全部跳转。

**Step 3:** 进行一次 code review：检查业务调用未变、权限/错误码未变、无旧 dashboard 入口死链。

**Step 4:** 创建 PR，等待 Quality Gate、E2E 和 SDK CI 全绿。

**Step 5:** 合入 main。确认用户后再打版本 tag（预计 v2.7.0），避免把未验收的半成品发布到 DockerHub。
