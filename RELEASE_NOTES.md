# Release Notes — Activation Manager v2.2.0

> 深色科技主题体系、全局 Toast、定制控件库与工程化完善
> 覆盖范围：`41f44ee..0ceaf1a` | 10 commits | 92 files | +3,022 / -1,082

---

## 🎨 主题体系（14 套内置主题）

- **CSS 变量主题引擎**：所有颜色通过 `--brand-*` / `--ink-*` / `--surface-*` 定义，Tailwind 类名不变、值随 `data-theme` 切换，切换带 300ms 过渡
- **14 套内置主题**，覆盖冷暖深浅各类审美：
  - 深色系：深空科技（默认）/ 午夜蓝 / 石墨灰 / 翡翠绿 / 紫夜 / 绯红 / 海洋青 / 琥珀金
  - 浅色系：极简浅色 / 樱花粉 / 森林绿 / 朝霞橙 / 复古纸 / 黑白极简
- **主题切换器**：登录页右上角 + 后台侧边栏底部，localStorage 持久化，布局预加载脚本避免首屏闪烁
- **主题扩展性**：新增主题只需在 `globals.css` 添加变量块 + 在 `theme-provider.tsx` 注册元数据

## 🍞 全局 Toast 提示体系

- 右上角堆叠 Toast：成功 / 错误 / 信息三态，带图标、自动消失（3.2s / 5.2s / 3.6s）、可关闭、入场动画
- 替换 dashboard 原有内联 message 渲染块
- 公开 API 文档页复制反馈同样接入全局 Toast
- `useToast()` / `useOptionalToast()` API，任意组件可调用

## 🧩 定制控件库

| 控件 | 亮点 |
|---|---|
| `AppInput` | 前置/后置图标插槽、聚焦光晕、主题变量驱动 |
| `AppTextarea` | 统一深色样式 |
| `AppSelect` | 保留原生 `select` 语义（无障碍 + 自动化测试兼容），自定义下拉箭头与深色样式 |

已应用于登录页、系统配置、修改密码、生成激活码等高频表单。

## 🐛 深色主题可见性修复

- 修复 `text-ink-950`（页面背景色）误用作标题文字色导致的黑字黑底不可见（首页 / 登录 / 后台 4 处）
- 清除 20+ 处 `text-gray-*` 残留、44 处非法多段 alpha 类（`bg-brand-500/100/10` 等 Tailwind 不生成的类）
- 修复 `bg-surface-800` 未定义导致输入框背景静默失效
- 公开文档页调研路径卡片白底渐变改为深色卡片
- **全页对比度扫描**：首页 / 登录 / 后台全部 0 问题

## 🧪 测试与 CI

- **e2e 补全**：新增 `workspaces.spec.ts`（未登录重定向 / 首页入口 / 公开文档 / 统计页 / 时间卡发码+激活 / 系统配置保存 / 修改密码 / API 分区 / 登出），17/17 通过
- **修复 GitHub Actions 失败**：
  - 函数覆盖率 89.71% → 90.04%（补 14 个纯函数测试），通过 90% 阈值
  - Docker smoke 登录密码与初始化密码不一致 → workflow 显式传 `ADMIN_PASSWORD`
- **代码卫生**：清理 49 处未使用代码，tsconfig 开启 `noUnusedLocals` / `noUnusedParameters`
- 顺带修复 `hasConfigValue(null)` 将空配置误标为已配置的 bug

## 📄 工程化页面

- 新增 `not-found.tsx`（404）、`error.tsx`（500 + 重试）、`loading.tsx`（骨架屏）
- 新增 `robots.ts`（禁止爬取 /admin/ /api/）、`sitemap.ts`（首页 + API 文档）
- README 新增主题体系 / Toast / 控件库章节

## 🔧 其他修复

- 修复公开文档页调研路径卡片白底白字不可见
- dashboard stats 区拆分 `DashboardStatsOverviewPanel` 组件（2563 → 2310 行）

---

## 如何开始

```bash
npm install
npm run dev
# 打开 http://localhost:3000
# 登录页右上角 / 后台侧边栏底部可切换 14 套主题
```

生产部署见 [Docker 部署章节](https://github.com/axdlee/activation-manager/blob/main/README.md#docker-%E9%83%A8%E7%BD%B2)。
