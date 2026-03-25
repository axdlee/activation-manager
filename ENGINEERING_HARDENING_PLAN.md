# 工程化加固与优化路线图

> 更新时间：2026-03-25
> 目标：将当前项目持续提升到“可长期维护、可规模化、可审计、可扩展”的高规格工程水位。

## 1. 文档目的

这份文档用于沉淀以下内容：

1. 已识别的工程风险与设计缺陷
2. 按优先级排序的优化任务清单
3. 每一轮实际落地的改动与状态
4. 验证标准、依赖关系与后续推进顺序

> 约定：后续每完成一轮优化，都应同步更新本文件，避免任务散落在上下文对话中。

---

## 2. 当前总体判断

当前项目已经具备：

- 多项目授权模型
- 时间型 / 次数型激活码
- 正式接入 API：`activate / status / consume`
- `requestId` 幂等消费
- 管理后台、消费日志、趋势与导出
- SDK、公开 API 文档、自动初始化脚本
- 基础 lint / build / test / smoke 验证链路

但若按大型标准化项目要求看，当前仍存在以下类别问题：

- 安全基线不够稳固
- 配置与认证链路存在不一致
- 开发环境 bootstrap 主体已与 Prisma schema 对齐，但 legacy 兼容迁移仍需保持收敛
- 消费日志 / 趋势 / 统计在规模化场景下会遇到性能瓶颈
- 部分核心路径仍缺更强的数据库级并发约束与安全测试
- dashboard 与核心 service 文件体量过大，维护成本偏高

---

## 3. 优先级分层

### P0：必须优先处理

影响安全边界、敏感数据、生产配置正确性的问题。

### P1：高优先级

影响数据一致性、并发正确性、配置治理的问题。

### P2：重要优化

影响性能、扩展性、后台规模化运行能力的问题。

### P3：中期治理

影响模块边界、代码可维护性、长期演进效率的问题。

### P4：工程规范完善

影响 CI、覆盖率、审计、文档一致性的问题。

---

## 4. 任务总表（Backlog）

| ID | 优先级 | 状态 | 任务 | 目标 |
|---|---|---|---|---|
| P0-01 | P0 | DONE | 去掉生产环境默认 JWT 密钥回退 | 敏感配置缺失时 fail fast，不再静默使用仓库内默认值 |
| P0-02 | P0 | DONE | 系统配置接口不再明文下发敏感字段 | 浏览器端无法看到 `jwtSecret` 原文 |
| P0-03 | P0 | DONE | 统一 middleware 与 API 的认证 / 白名单逻辑 | 页面层与 API 层权限判断一致 |
| P0-04 | P0 | DONE | 对齐 JWT 生命周期与 cookie 生命周期 | 避免会话过期行为不一致 |
| P0-05 | P0 | DONE | 登录增加防暴力破解 / 限流 | 提升后台登录安全性 |
| P1-01 | P1 | DONE | 让 dev bootstrap 与 Prisma schema 对齐 | 降低双轨维护与环境漂移风险 |
| P1-02 | P1 | DONE | 系统配置写入加 schema 校验、allowlist 与事务 | 防止脏配置与部分写入 |
| P1-03 | P1 | DONE | 补强 `consume` 并发正确性 | 避免边界次数并发下超扣或脏状态 |
| P1-04 | P1 | DONE | 为真实查询路径补齐索引 | 提升后台查询稳定性 |
| P1-05 | P1 | DONE | 收紧 `projectKey` 规则 | 保证项目标识规范统一 |
| P1-06 | P1 | DONE | 为“同设备单项目唯一绑定”补数据库级约束 | 避免不同激活码并发绑定同一设备时破坏业务不变量 |
| P2-01 | P2 | DONE | 消费日志改为服务端分页 / 过滤 | 支撑高频扣次日志增长 |
| P2-02 | P2 | DONE | 趋势与统计逐步下推数据库聚合 | 提升大数据量下性能 |
| P2-03 | P2 | DONE | 发码链路支持后续批量优化 | 为大批量生成预留空间 |
| P2-04 | P2 | DONE | 登录限流状态外置化以支持多实例 | 避免多实例部署下各节点限流状态不一致 |
| P3-01 | P3 | IN_PROGRESS | 拆分 dashboard 页面 | 降低页面级复杂度 |
| P3-02 | P3 | IN_PROGRESS | 拆分 `license-service` 领域职责 | 提升核心服务可维护性 |
| P3-03 | P3 | IN_PROGRESS | 统一 route wrapper / 输入校验 / 错误模型 | 统一接口风格与错误语义 |
| P3-04 | P3 | TODO | 优化 SDK 错误分类与 hook 错误隔离 | 提升接入方可观测性 |
| P3-05 | P3 | TODO | 补 auth / middleware / config / 并发测试 | 填平关键风险测试缺口 |
| P4-01 | P4 | DONE | 建立 CI 质量门禁 | 形成稳定交付底线 |
| P4-02 | P4 | DONE | 增加覆盖率门槛 | 保证核心链路质量 |
| P4-03 | P4 | DONE | 减少 `any` 与弱类型返回 | 提升类型安全 |
| P4-04 | P4 | TODO | 收口 README / 开发文档 / 安全说明 | 保证文档与实现一致 |
| P4-05 | P4 | TODO | 增加关键操作审计日志 | 提升可追踪性与合规性 |

---

## 5. 当前执行顺序（推荐）

### 第一阶段：安全基线包

- [x] P0-01 去掉生产默认 JWT 密钥回退
- [x] P0-02 系统配置敏感字段不再明文下发
- [x] P0-03 统一认证 / 白名单逻辑
- [x] P0-04 对齐 JWT 与 cookie 生命周期
- [x] P0-05 登录限流

### 第二阶段：一致性与正确性包

- [x] P1-01 bootstrap 与 Prisma 对齐
- [x] P1-02 配置写入 schema 校验 + allowlist + 事务
- [x] P1-03 `consume` 并发正确性修复
- [x] P1-04 索引优化
- [x] P1-05 `projectKey` 规则收紧
- [x] P1-06 同设备单项目唯一绑定约束

### 第三阶段：扩展性包

- [x] P2-01 消费日志服务端分页 / 过滤
- [x] P2-02 趋势与统计聚合优化
- [x] P2-03 发码链路批量优化
- [x] P2-04 登录限流状态外置化

### 第四阶段：结构治理包

- [~] P3-01 拆 dashboard
- [~] P3-02 拆 `license-service`
- [~] P3-03 统一 route wrapper / 输入校验 / 错误模型
- [ ] P3-04 优化 SDK 错误模型
- [ ] P3-05 测试补齐

### 第五阶段：工程规范包

- [x] P4-01 CI 质量门禁
- [x] P4-02 覆盖率门槛
- [x] P4-03 减少 `any`
- [ ] P4-04 文档一致性治理
- [ ] P4-05 审计日志

---

## 6. 第一批施工包定义：安全基线

### 包名

安全基线包（Security Baseline Hardening）

### 范围

1. 系统配置敏感字段不再明文下发
2. 为后续 secret fail-fast 与统一认证治理提供更安全的基础

### 本轮验收标准

- [x] `GET /api/admin/system-config` 不再返回真实 `jwtSecret`
- [x] 前端设置页仍能展示“已配置/未配置/可更新”的状态
- [x] 普通配置仍可正常编辑
- [x] 对应测试补齐并通过
- [x] lint / test / 必要 build 验证通过

---

## 7. 迭代记录

### 2026-03-24 / Iteration 01

**目标**：建立长期维护文档与任务基线，并开始安全基线第一步。

**已完成**：

- [x] 沉淀工程风险分析
- [x] 建立任务总表与执行顺序
- [x] 完成实现：系统配置敏感字段不再明文下发

**本轮落地内容**：

1. 后端 `GET /api/admin/system-config` 改为通过统一 helper 脱敏敏感配置，不再下发真实 `jwtSecret`
2. 系统配置 UI 模型新增 `sensitive / masked / hasValue` 元数据，设置页可展示“已配置 / 未配置 / 可更新”状态
3. 设置页提交链路改为通过共享纯函数过滤未修改的敏感空值，避免空字符串覆盖旧密钥
4. 系统配置保存成功后自动重新拉取脱敏后的配置，避免新密钥长时间停留在前端 state

**验证结果**：

1. `npm run lint` ✅
2. `npm test` ✅（102 / 102 通过）
3. `npm run build` ✅

**备注**：

- `npm run build` 过程中有 `Browserslist` 数据过旧提示，不影响当前构建通过；后续可作为工程维护项统一处理
- 构建日志中的 `Dynamic server usage` 为 Next.js 对鉴权 API route 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. P0-01：去掉生产环境默认 JWT 密钥回退，敏感配置缺失时 fail fast
2. P0-03：统一 middleware 与 API 的认证 / 白名单逻辑
3. P1-02：系统配置写入增加 schema 校验、allowlist 与事务

### 2026-03-24 / Iteration 02

**目标**：完成生产环境 JWT 密钥缺失时的 fail-fast，加固初始化与运行时行为。

**已完成**：

- [x] 生产环境缺少 `jwtSecret` 时不再静默回退仓库默认值
- [x] 生产环境初始化系统配置时，若未显式提供 `JWT_SECRET` 且数据库中也无 `jwtSecret`，会直接拒绝初始化
- [x] README 补充生产环境 JWT 初始化说明

**本轮落地内容**：

1. 新增默认系统配置构建函数，区分开发/生产环境的 `jwtSecret` 种子策略
2. 新增系统配置回退解析逻辑：生产环境缺失 `jwtSecret` 时抛出显式错误
3. 调整 JWT 校验链路，避免把配置缺失误吞为普通 token 无效
4. 登录接口与认证中间件对配置缺失错误给出明确失败语义
5. 生产初始化链路增加前置校验，避免系统配置表被“成功初始化但缺少关键密钥”
6. 将全空格 `jwtSecret` 也视为未配置，避免形式上有值、实际不可用

**验证结果**：

1. `npm run lint` ✅
2. `npm test` ✅（110 / 110 通过）
3. `npm run build` ✅

**备注**：

- `npm run build` 过程中仍有 `Browserslist` 数据过旧提示，不影响当前构建通过
- `Dynamic server usage` 仍为 Next.js 对鉴权 route 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. P0-03：统一 middleware 与 API 的认证 / 白名单逻辑
2. P0-04：对齐 JWT 生命周期与 cookie 生命周期
3. P1-02：系统配置写入增加 schema 校验、allowlist 与事务

### 2026-03-24 / Iteration 03

**目标**：统一后台页面层与 API 层的认证 / 白名单判断逻辑，消除双轨分叉。

**已完成**：

- [x] 页面层与 API 层改为复用统一的后台认证决策模型
- [x] middleware 不再使用独立的默认白名单 / 仅检查 cookie 存在性逻辑
- [x] admin API 改为按统一认证结果返回对应状态码
- [x] README 安全说明与实现保持一致

**本轮落地内容**：

1. 新增共享认证契约与服务层：统一定义 `public / protected` 两种后台访问模式、认证失败码与状态码
2. middleware 改为通过内部校验路由复用同一套认证 / 白名单逻辑，不再依赖 `ALLOWED_IPS` 环境变量分叉
3. admin 页面访问改为：
   - 登录页：仅校验白名单
   - 受保护后台页：校验白名单 + token 有效性
4. admin API 路由统一使用认证失败结果对象返回响应，403/401/500 状态码与实际原因对齐
5. 补充共享认证服务、页面守卫、middleware 行为测试，覆盖关键回归场景

**验证结果**：

1. `npm run lint` ✅
2. `npm test` ✅（121 / 121 通过）
3. `npm run build` ✅

**备注**：

- `npm run build` 过程中仍有 `Browserslist` 数据过旧提示，不影响当前构建通过
- `Dynamic server usage` 仍为 Next.js 对鉴权 route 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. P0-04：对齐 JWT 生命周期与 cookie 生命周期
2. P1-02：系统配置写入增加 schema 校验、allowlist 与事务
3. P0-05：登录增加防暴力破解 / 限流

---

### 2026-03-24 / Iteration 04

**目标**：对齐 JWT 过期时间与登录 cookie 生命周期，避免会话表现与真实 token 过期时间不一致。

**已完成**：

- [x] 登录成功后写入的 cookie `maxAge` 改为根据 `jwtExpiresIn` 动态计算
- [x] 补充登录链路回归测试，锁定 `jwtExpiresIn=7d` 时 cookie 生命周期行为
- [x] 补充 JWT 会话时长解析测试，固定支持格式与错误语义

**本轮落地内容**：

1. 新增 `src/lib/jwt-session.ts`，统一负责把 `jwtExpiresIn` 配置解析为 cookie `maxAge` 秒数
2. 登录接口移除硬编码 `24 * 60 * 60`，改为复用共享会话时长 helper
3. 新增 `tests/admin-login-route.test.ts`，直接覆盖管理员登录成功后 `Set-Cookie` 的 `Max-Age`
4. 新增 `tests/jwt-session.test.ts`，覆盖小时 / 天格式、大小写兼容与非法格式显式报错

**验证结果**：

1. `npm run lint` ✅
2. `npm test` ✅（125 / 125 通过）
3. `npm run build` ✅

**备注**：

- `npm run build` 过程中仍有 `Browserslist` 数据过旧提示，不影响当前构建通过
- `Dynamic server usage` 仍为 Next.js 对鉴权 route 使用 `headers` 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. P0-05：登录增加防暴力破解 / 限流
2. P1-02：系统配置写入增加 schema 校验、allowlist 与事务
3. P1-01：让 dev bootstrap 与 Prisma schema 对齐

---

### 2026-03-24 / Iteration 05

**目标**：为后台管理员登录增加基础防暴力破解能力，降低同源连续撞库/猜密码风险。

**已完成**：

- [x] 同一 IP 连续登录失败达到阈值后会被短时锁定
- [x] 登录限流响应返回 `429` 与 `Retry-After`
- [x] 成功登录后会清空该 IP 的失败计数

**本轮落地内容**：

1. 新增 `src/lib/admin-login-rate-limit.ts`，提供进程内登录限流器与锁定窗口逻辑
2. 管理员登录接口复用 `extractClientIp`，按访问来源做失败计数与临时锁定
3. 登录失败分支统一改为记录失败次数；登录成功后重置该来源的失败状态
4. 限流命中时返回 `429`、统一提示文案与 `Retry-After` 响应头
5. 新增 `tests/admin-login-rate-limit.test.ts` 与扩展 `tests/admin-login-route.test.ts`，覆盖锁定、重置、窗口过期与路由集成行为

**验证结果**：

1. `npm run lint` ✅
2. `npm test` ✅（129 / 129 通过）
3. `npm run build` ✅

**备注**：

- 当前登录限流为**进程内内存态**实现，已满足当前单实例安全基线
- 若后续存在多实例 / 多容器部署需求，应继续推进 `P2-04`，将限流状态外置到共享存储
- `npm run build` 过程中仍有 `Browserslist` 数据过旧提示，不影响当前构建通过
- `Dynamic server usage` 仍为 Next.js 对鉴权 route 使用 `headers` 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. P1-02：系统配置写入增加 schema 校验、allowlist 与事务
2. P1-01：让 dev bootstrap 与 Prisma schema 对齐
3. P1-03：补强 `consume` 并发正确性

---

### 2026-03-25 / Iteration 06

**目标**：为系统配置写入链路补齐服务端 schema 校验、key allowlist 与事务边界，防止脏配置与部分写入。

**已完成**：

- [x] 系统配置写入仅允许白名单配置项
- [x] 已知配置项的 value 在服务端按 schema 校验并标准化
- [x] 批量配置写入改为单事务执行，失败时不再部分提交
- [x] 非法配置请求改为返回明确 `400`，而非统一吞成 `500`

**本轮落地内容**：

1. 新增 `src/lib/system-config-write.ts`，集中负责：
   - 配置项 allowlist
   - `allowedIPs / jwtSecret / jwtExpiresIn / bcryptRounds / systemName` 的 schema 校验
   - 值标准化（如白名单去重、字符串 trim）
   - 批量事务写入
2. `src/app/api/admin/system-config/route.ts` 改为复用共享写入模块，不再逐条直接 `setConfig`
3. `src/lib/config-service.ts` 新增批量缓存失效 helper，确保事务提交后统一清理受影响配置缓存
4. 新增 `tests/system-config-write.test.ts`，覆盖 allowlist、schema 校验、标准化与事务回滚
5. 新增 `tests/system-config-route.test.ts`，锁定非法配置请求返回 `400` 与明确错误信息

**验证结果**：

1. `npm run lint` ✅
2. `npm test` ✅（134 / 134 通过）
3. `npm run build` ✅

**备注**：

- 当前系统配置写入 allowlist 仅覆盖现有正式配置项；未来若新增配置项，应同步扩展 `system-config-write.ts`
- `npm run build` 过程中仍有 `Browserslist` 数据过旧提示，不影响当前构建通过
- `Dynamic server usage` 仍为 Next.js 对鉴权 route 使用 `headers` 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. P1-01：让 dev bootstrap 与 Prisma schema 对齐
2. P1-03：补强 `consume` 并发正确性
3. P1-04：为真实查询路径补齐索引

---

### 2026-03-25 / Iteration 07

**目标**：让开发环境 bootstrap 的建表职责切换为以 Prisma schema 为准，收敛手写 SQL 双轨维护风险，同时保留旧版数据兼容能力。

**已完成**：

- [x] `bootstrapDevelopmentDatabase` 改为通过 Prisma schema 同步数据库结构
- [x] 旧版 `activation_codes` 表在 bootstrap 后仍可保留原数据并升级到最终约束
- [x] 补充测试锁定 `projectId` 非空与外键约束，避免回退到宽松手写表结构

**本轮落地内容**：

1. `src/lib/dev-bootstrap.ts` 新增 Prisma schema 推送能力：
   - 运行时根据目标 `dbPath` 生成临时 `schema.prisma`
   - 调用本地 Prisma CLI 执行 `db push --skip-generate --accept-data-loss`
   - 让开发初始化直接复用 `prisma/schema.prisma` 作为表结构单一真相来源
2. 移除原先全量手写 `buildSchemaSql()` 建表逻辑，仅保留两类必要兼容代码：
   - 旧版 `activation_codes` 缺列时的历史数据重建
   - 在最终 schema push 前为 legacy 数据补齐默认项目与 `projectId`
3. 重构默认项目 / 管理员 / 系统配置初始化流程，避免 bootstrap 过程中重复多次执行 schema 同步
4. 扩展 `tests/dev-bootstrap.test.ts`，新增以下验收：
   - fresh bootstrap 后 `activation_codes.projectId` 必须为 `NOT NULL`
   - fresh bootstrap 后 `activation_codes.projectId -> projects.id` 外键必须存在
   - legacy `activation_codes` 数据升级后仍保留原记录，并满足最终非空与外键约束
5. README 补充说明：`bootstrap:dev` 现在是“先按 Prisma schema 同步结构，再写入默认种子”的自动化流程

**验证结果**：

1. `npm run lint` ✅
2. `npm test` ✅（134 / 134 通过）
3. `npm run build` ✅

**备注**：

- 目前仍保留极少量 legacy 兼容 SQL，仅用于旧版 `activation_codes` 历史数据迁移；主体建表来源已收敛到 Prisma schema
- `npm run build` 过程中仍有 `Browserslist` 数据过旧提示，不影响当前构建通过
- `Dynamic server usage` 仍为 Next.js 对鉴权 route 使用 `headers` 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. P1-03：补强 `consume` 并发正确性
2. P1-04：为真实查询路径补齐索引
3. P1-05：收紧 `projectKey` 规则

---

### 2026-03-25 / Iteration 08

**目标**：补强 `consume` 的并发正确性，避免并发下的重复扣次、相同 `requestId` 竞态以及同一激活码被不同设备并发占用时出现脏状态。

**已完成**：

- [x] 相同 `requestId` 并发消费只会实际扣减一次
- [x] 同一激活码被不同设备并发消费时，只允许一个设备成功绑定并扣次
- [x] 次数型消费改为条件更新，避免依赖“先读后写”的脆弱并发假设

**本轮落地内容**：

1. `src/lib/license-service.ts` 为 `consumeLicense` 增加并发保护：
   - 新增 `requestId` 唯一约束错误识别与复用逻辑
   - 引入“占位消费记录”与短暂轮询收敛，确保并发相同 `requestId` 最终返回稳定幂等结果
   - 次数型消费由直接 `update` 改为带条件的 `updateMany` 原子扣减
   - 首次时间型消费也改为条件更新，避免并发下被不同设备重复抢占
2. 新增 `tests/license-consume-concurrency.test.ts`，通过可控竞态 fake client 锁定两类之前未覆盖的并发边界：
   - 相同 `requestId` 并发请求
   - 不同设备并发消费同一激活码
3. 保持现有正式接口与已有业务测试全部通过，确保本轮加固未破坏既有语义

**验证结果**：

1. `node --import tsx --test "tests/license-consume-concurrency.test.ts"` ✅
2. `npm run lint` ✅
3. `npm test` ✅（136 / 136 通过）
4. `npm run build` ✅

**备注**：

- 当前已解决“同一激活码 / 同一 requestId”维度的核心并发风险
- 仍存在一个更高阶但独立的业务不变量问题：**同一设备在同一项目下，若并发消费不同激活码，仍缺少数据库级唯一绑定约束**
- 该问题已沉淀为新任务 `P1-06`，建议后续通过独立绑定表、唯一约束或锁模型解决
- `npm run build` 过程中仍有 `Browserslist` 数据过旧提示，不影响当前构建通过
- `Dynamic server usage` 仍为 Next.js 对鉴权 route 使用 `headers` 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. P1-04：为真实查询路径补齐索引
2. P1-05：收紧 `projectKey` 规则
3. P1-06：为“同设备单项目唯一绑定”补数据库级约束

---

### 2026-03-25 / Iteration 09

**目标**：基于真实 SQL 查询路径，为高频后台日志 / 趋势 / 绑定查询补齐关键索引，降低 SQLite 在数据增长后的扫描成本。

**已完成**：

- [x] 为消费日志 / 趋势查询补齐复合索引
- [x] 为设备绑定查询补齐复合索引
- [x] 补充 bootstrap 级测试，确保开发初始化后索引实际存在

**本轮落地内容**：

1. 先通过 Prisma query log 审核真实 SQL，确认当前高频查询主要集中在：
   - `activation_codes` 上的 `projectId + usedBy + isUsed + usedAt`
   - `license_consumptions` 上的 `activationCodeId + createdAt`
   - `license_consumptions` 上的 `createdAt + id`
2. 在 `prisma/schema.prisma` 中补齐并显式命名以下索引：
   - `activation_codes_projectId_usedBy_isUsed_usedAt_idx`
   - `license_consumptions_activationCodeId_createdAt_idx`
   - `license_consumptions_createdAt_id_idx`
3. 同时为已有单列索引显式声明 `map` 名称，避免 Prisma/SQLite 下的索引命名漂移
4. 新增 `tests/database-indexes.test.ts`，锁定 `bootstrapDevelopmentDatabase` 完成后上述复合索引必须存在且字段顺序正确

**验证结果**：

1. `node --import tsx --test "tests/database-indexes.test.ts"` ✅
2. `npm run lint` ✅
3. `npm test` ✅（137 / 137 通过）
4. `npm run build` ✅

**备注**：

- 本轮优先补的是**高频且高价值**查询索引，未对 `projects` 排序额外加索引，是因为当前项目表规模通常远小于日志与激活码表，暂不引入额外维护成本
- 后续若项目表规模显著增长，可再评估 `projects(isEnabled, createdAt)` 一类排序索引
- `npm run build` 过程中仍有 `Browserslist` 数据过旧提示，不影响当前构建通过
- `Dynamic server usage` 仍为 Next.js 对鉴权 route 使用 `headers` 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. P1-05：收紧 `projectKey` 规则
2. P1-06：为“同设备单项目唯一绑定”补数据库级约束
3. P2-01：消费日志改为服务端分页 / 过滤

---

### 2026-03-25 / Iteration 10

**目标**：收紧 `projectKey` 规则，统一项目标识命名边界，避免后台录入与查询口径长期漂移。

**已完成**：

- [x] `createProject` 仅接受规范化 `projectKey`
- [x] 管理后台创建项目时增加同口径前端预校验与输入约束
- [x] 补充 service 级与纯函数级测试，锁定规则不回退

**本轮落地内容**：

1. 新增共享纯函数模块 `src/lib/project-key.ts`，统一沉淀以下规则：
   - 长度 `2-50`
   - 仅允许小写字母、数字、短横线
   - 不允许以短横线开头或结尾
   - 不允许连续短横线
2. `src/lib/license-service.ts` 中的 `createProject` 改为复用共享校验逻辑，并同步规范化名称 / 描述输入，避免服务层直接写入不规范项目标识
3. `src/app/admin/dashboard/page.tsx` 的项目创建表单增加：
   - 提交前显式校验
   - `minLength / maxLength / pattern / autoCapitalize / spellCheck` 等输入约束
   - 更明确的规则提示文案，减少无效提交
4. 新增并扩展测试：
   - `tests/license-service.test.ts`：覆盖合法 / 非法 `projectKey` 创建场景
   - `tests/project-key.test.ts`：锁定共享纯函数规则与错误语义
5. `README.md` 补充 `projectKey` 命名规则，确保文档与实现一致

**验证结果**：

1. `node --import tsx --test "tests/license-service.test.ts" "tests/project-key.test.ts"` ✅
2. `npm run lint` ✅
3. `npm test` ✅（141 / 141 通过）
4. `npm run build` ✅

**备注**：

- 查询路径仍保持“按库内值精确匹配”的兼容策略，本轮只收紧新建项目写入规则，避免对历史数据做激进兼容改造
- `npm run build` 过程中仍有 `Browserslist` 数据过旧提示，不影响当前构建通过
- `Dynamic server usage` 仍为 Next.js 对鉴权 route 使用 `headers` 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. P1-06：为“同设备单项目唯一绑定”补数据库级约束
2. P2-01：消费日志改为服务端分页 / 过滤
3. P3-02：拆分 `license-service` 领域职责

---

### 2026-03-25 / Iteration 11

**目标**：为“同设备单项目唯一绑定”补数据库级约束，消除不同激活码并发绑定同一设备时仍可能破坏业务不变量的缺口。

**已完成**：

- [x] `activation_codes` 增加同项目 + 同设备复合唯一约束
- [x] `activate` / `consume` 绑定写路径对数据库唯一约束冲突做稳定业务收敛
- [x] 旧卡已耗尽 / 已过期时，允许释放旧绑定并切换到新卡

**本轮落地内容**：

1. `prisma/schema.prisma` 为 `activation_codes` 新增复合唯一约束：
   - `activation_codes_projectId_usedBy_key`
2. `src/lib/license-service.ts` 新增数据库级冲突收敛逻辑：
   - 统一识别 `P2002(projectId, usedBy)`
   - 当并发绑定撞上数据库唯一约束时，回退为明确业务错误，而不是抛出未处理异常
3. 为兼容“旧卡耗尽/过期后可切换新卡”的业务语义，新增可复用绑定释放逻辑：
   - 同项目下若旧绑定已耗尽或过期，绑定新卡前会先释放旧卡的 `usedBy`
   - 保留激活码历史使用状态，避免破坏是否已用、过期时间、次数消耗等统计字段
4. 新增并扩展测试：
   - `tests/database-indexes.test.ts`：锁定复合唯一约束实际存在
   - `tests/license-binding-constraint.test.ts`：锁定 `activate` / `consume` 在数据库唯一约束冲突下的业务返回
   - `tests/license-service.test.ts`：锁定“旧次数卡耗尽后可切换新卡”真实链路
5. `README.md` 与 `apidocs.md` 同步补充同设备单项目唯一绑定规则

**验证结果**：

1. `node --import tsx --test "tests/license-service.test.ts" "tests/database-indexes.test.ts" "tests/license-binding-constraint.test.ts"` ✅
2. `npm run lint` ✅
3. `npm test` ✅（144 / 144 通过）
4. `npm run build` ✅

**备注**：

- 本轮选择“复合唯一约束 + 可复用旧绑定释放”方案，优先满足当前业务一致性与最小演进成本，避免在本轮引入独立绑定表的大改造
- 旧的次数卡耗尽或时间卡过期后，`usedBy` 会在切换新卡前被释放；历史消耗与是否已用状态仍会保留
- `npm run build` 过程中仍有 `Browserslist` 数据过旧提示，不影响当前构建通过
- `Dynamic server usage` 仍为 Next.js 对鉴权 route 使用 `headers` 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. P2-01：消费日志改为服务端分页 / 过滤
2. P3-02：拆分 `license-service` 领域职责
3. P4-01：建立 CI 质量门禁

---

### 2026-03-25 / Iteration 12

**目标**：将消费日志列表从“前端拉全量后本地分页/过滤”切换为“服务端过滤 + 服务端分页”，降低日志增长后的前端负担并收敛数据流。

**已完成**：

- [x] 消费日志列表接口支持 `page / pageSize`
- [x] 消费日志过滤改为服务端执行
- [x] 后台消费日志工作区改为消费当前页数据与服务端分页元信息

**本轮落地内容**：

1. `src/lib/license-service.ts`
   - 抽出消费日志查询条件构建逻辑
   - 保留 `listLicenseConsumptions` 作为全量导出 / 内部复用查询
   - 新增 `listLicenseConsumptionsPage`，返回：
     - `logs`
     - `pagination.total / page / pageSize / totalPages`
2. `src/lib/admin-consumption-route-handlers.ts`
   - 新增 `readLicenseConsumptionPagination`
   - 新增 `handleListLicenseConsumptionsRequest`
   - 列表接口与导出接口分离：列表走分页，导出仍走全量筛选结果
3. `src/app/api/admin/consumptions/route.ts`
   - 改为复用新的列表 handler，返回分页元信息
4. `src/lib/consumption-query-params.ts`
   - 支持在 URL 中拼接 `page / pageSize`
5. `src/app/admin/dashboard/page.tsx`
   - 消费日志列表切换为服务端分页
   - 翻页按钮改为请求服务端当前页
   - 顶部“匹配日志”改为展示筛选后的总数
   - “涉及项目 / 激活码”改为按当前页数据统计，避免误导
6. 新增 / 更新测试：
   - `tests/consumption-query-params.test.ts`
   - `tests/license-service.test.ts`
   - `tests/admin-consumption-route-handlers.test.ts`
7. `README.md` 与 `apidocs.md` 同步补充消费日志分页能力说明

**验证结果**：

1. `node --import tsx --test "tests/consumption-query-params.test.ts" "tests/license-service.test.ts" "tests/admin-consumption-route-handlers.test.ts"` ✅
2. `npm run lint` ✅
3. `npm test` ✅（144 / 144 通过）
4. `npm run build` ✅

**备注**：

- 本轮将“筛选 + 分页”查询下推到服务端，但消费日志 CSV 导出仍保留“导出当前筛选下的全部结果”语义，不受分页影响
- 为保持最小改动，当前“涉及项目 / 激活码”摘要改为基于**当前页**统计；若后续需要全量去重统计，可在 P2/P3 阶段进一步下推聚合查询
- `npm run build` 过程中仍有 `Browserslist` 数据过旧提示，不影响当前构建通过
- `Dynamic server usage` 仍为 Next.js 对鉴权 route 使用 `headers` 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. P2-02：趋势与统计逐步下推数据库聚合
2. P3-02：拆分 `license-service` 领域职责
3. P4-01：建立 CI 质量门禁

---

### 2026-03-25 / Iteration 13

**目标**：推进 `P2-02` 的第一步，将消费趋势从“拉全量日志到内存后做 JS 聚合”下推为数据库聚合，同时保持现有接口返回结构、导出行为和前端展示语义不变。

**已完成**：

- [x] `getLicenseConsumptionTrend` 改为基于数据库聚合查询当前周期桶数据与上一周期总数
- [x] 保持趋势接口 / 导出 / 双项目对比 / 空桶补齐语义不变
- [x] 新增测试锁定“趋势不再回退到 `licenseConsumption.findMany` 全量查询”

**本轮落地内容**：

1. `src/lib/license-service.ts`
   - 新增趋势聚合辅助类型与 helper：
     - `LicenseConsumptionTrendBucketRow`
     - `LicenseConsumptionTrendTotalRow`
     - `normalizeTrendAggregateCount`
     - `getLicenseConsumptionCreatedAtUnixSecondsSql`
     - `getTrendBucketSqlExpression`
     - `buildLicenseConsumptionTrendWhereSql`
     - `listLicenseConsumptionTrendBuckets`
     - `countPreviousRangeConsumptions`
   - `getLicenseConsumptionTrend` 改为：
     - 当前周期通过 SQLite 聚合 SQL 按 `day / week / month` 分桶
     - 上一周期通过单独 `COUNT(*)` 查询得到对比基线
     - 保留原有空桶补齐、标签格式化、`comparison` 计算与返回结构
2. 新增测试 `tests/license-consumption-trend-aggregation.test.ts`
   - 使用 fake client 明确锁定趋势统计不得再走 `licenseConsumption.findMany`
   - 验证数据库聚合路径下仍会正确补齐空桶并输出上一周期对比摘要
3. 根因排查与修复沉淀：
   - Prisma + SQLite 下 `DateTime` 在 raw SQL 聚合场景中实际按**毫秒级 Unix epoch**参与函数计算
   - 因此趋势 SQL 需先将 `createdAt / 1000` 转成秒，再结合 `unixepoch` 做 `date / strftime` 聚合
   - 该细节已体现在共享 helper 中，避免未来趋势/统计原生 SQL 再次踩坑

**验证结果**：

1. `node --import tsx --test "tests/license-consumption-trend-aggregation.test.ts" "tests/license-service.test.ts" "tests/admin-consumption-route-handlers.test.ts"` ✅
2. `npm run lint` ✅
3. `npm test` ✅（148 / 148 通过）
4. `npm run build` ✅
5. `git diff --check` ✅

**备注**：

- 本轮仅完成 `P2-02` 的**趋势聚合**部分，`listProjectStats / getActivationCodeStats` 等统计聚合仍待后续继续下推数据库
- 对外 API 契约未变化，因此本轮无需改动 `apidocs.md`
- `npm run build` 过程中仍有 `Browserslist` 数据过旧提示，不影响当前构建通过
- `Dynamic server usage` 仍为 Next.js 对鉴权 route 使用 `headers` 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. 继续完成 `P2-02`：将项目统计与总览统计逐步下推数据库聚合，减少大数据量下的内存扫描
2. P3-02：拆分 `license-service` 领域职责，降低核心服务文件复杂度
3. P4-01：建立 CI 质量门禁

---

### 2026-03-25 / Iteration 14

**目标**：完成 `P2-02` 的第二步，将总览统计与项目统计从“全量加载激活码后 JS 聚合”下推为数据库聚合，进一步降低后台统计路径在数据增长时的内存与扫描压力。

**已完成**：

- [x] `getActivationCodeStats` 改为数据库聚合查询
- [x] `listProjectStats` 改为数据库聚合查询
- [x] 新增测试锁定统计路径不再回退到 `findMany` 全量聚合

**本轮落地内容**：

1. `src/lib/license-service.ts`
   - 新增统计聚合辅助类型：
     - `ActivationCodeStatsRow`
     - `ProjectStatsRow`
   - 新增通用聚合辅助函数：
     - `normalizeAggregateCount`
     - `normalizeSqliteBoolean`
   - 新增与授权状态语义对齐的 SQL helper：
     - `getActivationCodeUsedAtUnixSecondsSql`
     - `getActivationCodeExpiresAtUnixSecondsSql`
     - `getActivationCodeActualExpiresAtUnixSecondsSql`
     - `getActivationCodeRemainingCountSql`
     - `getActivationCodeExpiredFlagSql`
     - `getActivationCodeActiveFlagSql`
   - 新增数据库聚合查询：
     - `getActivationCodeStatsRow`
     - `listProjectStatsRows`
   - `getActivationCodeStats` / `listProjectStats` 改为直接消费数据库聚合结果，不再加载全部激活码对象到内存后做统计
2. 新增测试 `tests/license-stats-aggregation.test.ts`
   - 锁定 `getActivationCodeStats` 不再走 `activationCode.findMany`
   - 锁定 `listProjectStats` 不再走 `project.findMany(include codes)`
3. 保持现有统计语义不变：
   - 时间型激活码的过期判断仍以“`usedAt + validDays` 优先，否则回退 `expiresAt`”为准
   - 次数型激活码的活跃判断、剩余次数与已消耗次数统计保持原有口径
   - 项目排序仍保持“启用优先、创建时间升序”

**验证结果**：

1. `node --import tsx --test "tests/license-stats-aggregation.test.ts" "tests/license-service.test.ts" "tests/admin-project-stats-route-handlers.test.ts"` ✅
2. `npm run lint` ✅
3. `npm test` ✅（150 / 150 通过）
4. `npm run build` ✅
5. `git diff --check` ✅

**备注**：

- 至此，`P2-02` 中当前后台已使用的两类核心大数据量路径都已完成下推：
  - 消费趋势聚合
  - 总览统计 / 项目统计聚合
- 本轮未改动对外接口契约，因此无需更新 `README.md` / `apidocs.md`
- `npm run build` 过程中仍有 `Browserslist` 数据过旧提示，不影响当前构建通过
- `Dynamic server usage` 仍为 Next.js 对鉴权 route 使用 `headers` 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. P2-03：评估并落地发码链路批量优化，降低大批量生成时的数据库与 CPU 开销
2. P3-02：拆分 `license-service` 领域职责，降低核心服务文件复杂度
3. P4-01：建立 CI 质量门禁

---

### 2026-03-25 / Iteration 15

**目标**：完成 `P2-03`，将发码链路从“逐条唯一性探测 + 逐条写入”优化为批量生成与批量落库，降低大批量发码时的数据库往返与 CPU 开销。

**已完成**：

- [x] 发码链路改为批量生成唯一激活码并批量写入
- [x] 批次级唯一约束冲突支持整批重试
- [x] 新增测试锁定批量写入路径与返回顺序稳定性

**本轮落地内容**：

1. `src/lib/license-service.ts`
   - 新增 `GENERATE_CODES_BATCH_RETRY_LIMIT`，限制批量发码的整批重试次数
   - 新增 `generateUniqueActivationCodeBatch`，在内存中一次性生成当前批次所需的唯一 code
   - 新增 `sortActivationCodesByGeneratedOrder`，保证 `createManyAndReturn` 后仍按原始生成顺序返回结果
   - `generateActivationCodes` 改为：
     - 不再逐条 `ensureUniqueCode`
     - 不再逐条 `activationCode.create`
     - 直接使用 `activationCode.createManyAndReturn(...)` 完成批量写入
     - 若命中 `P2002(code)`，则整批重试，而不是回退到逐条探测
2. 新增测试 `tests/license-generate-batch.test.ts`
   - 锁定 `generateActivationCodes` 会走 `createManyAndReturn` 批量写入路径
   - 锁定返回结果顺序与生成顺序一致，且保留项目与剩余次数等字段
   - 锁定批次唯一约束冲突时会整批重试并最终成功
3. 构建兼容性修正
   - 由于当前 `tsconfig` 目标较低，`Set` 结果回数组时改为 `Array.from(codes)`，避免构建阶段的可迭代类型报错

**验证结果**：

1. `node --import tsx --test "tests/license-generate-batch.test.ts" "tests/license-service.test.ts"` ✅
2. `npm run lint` ✅
3. `npm test` ✅（152 / 152 通过）
4. `npm run build` ✅
5. `git diff --check` ✅

**备注**：

- 当前 `P2-03` 已完成基础批量优化，已显著减少大批量发码时的数据库 round-trip
- 本轮仍保持原有接口契约与返回结构不变，因此无需额外修改公开 API 文档
- `createManyAndReturn` 的数据库返回顺序不应被隐式信任，因此通过显式回排保证 API 返回稳定
- `npm run build` 过程中仍有 `Browserslist` 数据过旧提示，不影响当前构建通过
- `Dynamic server usage` 仍为 Next.js 对鉴权 route 使用 `headers` 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. P4-01：建立 CI 质量门禁，固化当前 lint / test / build 底线
2. P3-02：拆分 `license-service` 领域职责，降低核心服务文件复杂度
3. P2-04：登录限流状态外置化，支撑多实例部署

---

### 2026-03-25 / Iteration 16

**目标**：完成 `P4-01`，建立可自动执行的 CI 质量门禁，避免质量验证只停留在本地人工操作。

**已完成**：

- [x] 新增统一质量门禁脚本，收口 lint / test / build
- [x] 新增 GitHub Actions 工作流，在 push / PR 场景自动执行质量门禁
- [x] 为 CI 增加并发取消与 npm cache，降低重复执行成本

**本轮落地内容**：

1. `package.json`
   - 新增 `quality:gate` 脚本：`npm run lint && npm test && npm run build`
   - 统一本地自检与 CI 执行入口，避免校验命令分散导致漂移
2. 新增 `.github/workflows/quality-gate.yml`
   - 触发条件：`push` / `pull_request` / `workflow_dispatch`
   - 执行内容：`checkout -> setup-node(cache npm) -> npm ci -> npm run quality:gate`
   - 增加 `concurrency`，同分支重复提交时自动取消旧任务
   - 设置 `CI=true` 与 `NEXT_TELEMETRY_DISABLED=1`，让流水线行为更稳定、更可预期
3. 工程约束收口
   - 将“可提交前至少要过 lint / test / build”的质量底线从口头约定升级为仓库内可执行配置

**验证结果**：

1. `npm run quality:gate` ✅
2. `git diff --check` ✅

**备注**：

- 当前 CI 已覆盖最核心的静态检查、测试与构建门禁，但尚未覆盖 smoke 联调与覆盖率阈值
- `P4-02` 可在此基础上继续增加覆盖率采集与阈值控制
- `npm run build` 过程中仍有 `Browserslist` 数据过旧提示，不影响当前构建通过
- `Dynamic server usage` 仍为 Next.js 对鉴权 route 使用 `headers` 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. P3-02：拆分 `license-service` 领域职责，降低核心服务文件复杂度
2. P2-04：登录限流状态外置化，支撑多实例部署
3. P4-02：增加覆盖率门槛，进一步提升交付质量稳定性

---

### 2026-03-25 / Iteration 17

**目标**：推进 `P3-02` 的第一批落地，优先把低风险、低耦合的“统计/趋势”和“项目管理/项目解析”职责从 `license-service` 中拆出，同时保持原有导出兼容与业务语义不变。

**已完成**：

- [x] 新增统计/趋势独立模块 `src/lib/license-analytics-service.ts`
- [x] 新增项目管理独立模块 `src/lib/license-project-service.ts`
- [x] `license-service` 保留 façade 兼容导出，现已聚焦于发码、消费、激活与校验主链路

**本轮落地内容**：

1. `src/lib/license-analytics-service.ts`
   - 承接以下统计/趋势职责：
     - `getLicenseConsumptionTrend`
     - `getActivationCodeStats`
     - `listProjectStats`
   - 一并迁移相关日期分桶、SQLite 聚合 SQL、统计归一化 helper
   - `tests/license-consumption-trend-aggregation.test.ts` 与 `tests/license-stats-aggregation.test.ts` 改为直接面向该模块，锁定拆分后的模块边界
2. `src/lib/license-project-service.ts`
   - 承接以下项目管理 / 项目解析职责：
     - `ensureDefaultProjectRecord`
     - `listProjects`
     - `createProject`
     - `updateProjectStatus`
     - `updateProjectName`
     - `updateProjectDescription`
     - `deleteProject`
     - `resolveProject`
     - `findProjectByProjectKey`
   - 让项目 CRUD、默认项目维护、项目启停规则与项目解析逻辑从核心授权主链路中独立出来
3. `src/lib/license-service.ts`
   - 改为复用并 re-export 上述两个新模块的能力
   - 保持原有对外导出兼容，避免 route、测试和调用方一次性大范围改动
   - 文件主线收敛后，当前已降到 **1192 行**
4. 路由与调用关系收口
   - `src/app/api/admin/projects/route.ts`
   - `src/app/api/admin/projects/[id]/route.ts`
   - 以上两个项目管理 route 已直接依赖 `license-project-service`，不再经过臃肿的聚合 service
5. 文档同步
   - `xitonkaifa.md` 更新为按新模块边界描述当前服务层结构，避免开发文档继续描述过期架构

**验证结果**：

1. RED：`node --import tsx --test "tests/license-consumption-trend-aggregation.test.ts" "tests/license-stats-aggregation.test.ts"` 在模块未创建时因 `Cannot find module '../src/lib/license-analytics-service'` 失败 ✅
2. GREEN：`node --import tsx --test "tests/license-consumption-trend-aggregation.test.ts" "tests/license-stats-aggregation.test.ts"` ✅
3. RED：`node --import tsx --test "tests/license-service.test.ts" "tests/license-api-routes.test.ts"` 在模块未创建时因 `Cannot find module '../src/lib/license-project-service'` 失败 ✅
4. GREEN：`node --import tsx --test "tests/license-service.test.ts" "tests/license-api-routes.test.ts"` ✅
5. 回归：`node --import tsx --test "tests/license-service.test.ts" "tests/admin-project-stats-route-handlers.test.ts" "tests/admin-consumption-route-handlers.test.ts"` ✅
6. 全量：`npm run quality:gate` ✅
7. 完整性：`git diff --check` ✅

**备注**：

- 本轮选择先拆“统计/趋势”和“项目管理”两个低风险模块，优先获取体积收敛与职责清晰的收益，避免在同一轮动到 `activate / consume / verify` 并发主链路
- `license-analytics-service` 现在直接复用 `license-project-service` 的 `findProjectByProjectKey`，顺手消除了项目查询逻辑重复
- 目前 `license-service` 仍承载授权消费主链路、消费日志查询与部分发码逻辑，`P3-02` 尚未完全结束，因此任务状态更新为 `IN_PROGRESS`
- `npm run build` 过程中仍有 `Browserslist` 数据过旧提示，不影响当前构建通过
- `Dynamic server usage` 仍为 Next.js 对鉴权 route 使用 `headers` 的动态提示，当前构建结果正常，无阻塞

**下一步**：

1. 继续推进 `P3-02`：拆分消费日志查询 / 授权主链路 helper，进一步压缩 `license-service`
2. P2-04：登录限流状态外置化，支撑多实例部署
3. P4-02：增加覆盖率门槛，进一步提升交付质量稳定性

---

### 2026-03-25 / Iteration 18

**目标**：推进 `P3-02` 的第二批落地，把“消费日志查询 / 分页”职责从 `license-service` 中拆出，并让消费管理 handler 直接依赖更细粒度模块。

**已完成**：

- [x] 新增消费日志独立模块 `src/lib/license-consumption-service.ts`
- [x] `admin-consumption-route-handlers` 直接依赖 analytics / consumption 子模块
- [x] `license-service` 继续瘦身到 **980 行**

**本轮落地内容**：

1. `src/lib/license-consumption-service.ts`
   - 承接以下消费日志查询职责：
     - `listLicenseConsumptions`
     - `listLicenseConsumptionsPage`
   - 一并迁移消费时间范围归一化、分页参数标准化与查询条件构造 helper
2. `src/lib/admin-consumption-route-handlers.ts`
   - 改为直接依赖：
     - `license-analytics-service`：`getLicenseConsumptionTrend`
     - `license-consumption-service`：`listLicenseConsumptions` / `listLicenseConsumptionsPage`
   - 让后台消费观察链路不再透过大而全的聚合 service
3. `src/lib/license-service.ts`
   - 保留 façade 兼容导出，避免一次性大面积改调用方
   - 在消费日志职责拆出后，文件规模进一步从 **1192 行** 收敛到 **980 行**
4. 测试边界同步
   - `tests/license-service.test.ts` 中消费日志分页相关用例已改为直接面向 `license-consumption-service`
   - `tests/admin-consumption-route-handlers.test.ts` 继续锁定消费观察 handler 与新模块边界

**验证结果**：

1. RED：`node --import tsx --test "tests/license-service.test.ts" "tests/admin-consumption-route-handlers.test.ts"` 在模块未创建时因 `Cannot find module './license-consumption-service'` 失败 ✅
2. GREEN：`node --import tsx --test "tests/license-service.test.ts" "tests/admin-consumption-route-handlers.test.ts"` ✅
3. 全量：`npm run quality:gate` ✅
4. 完整性：`git diff --check` ✅

**备注**：

- 目前 `license-service` 仍主要承载：
  - 发码链路
  - 激活 / 扣次 / 校验主链路
  - 幂等与并发收敛 helper
- 因此 `P3-02` 继续保持 `IN_PROGRESS`

**下一步**：

1. 继续推进 `P3-02`：拆分发码链路与共享 Prisma 唯一约束 helper
2. 继续推进 `P3-02`：抽离 `activate / consume / verify` 共用 helper
3. P2-04：登录限流状态外置化，支撑多实例部署

---

### 2026-03-25 / Iteration 19

**目标**：推进 `P3-02` 的第三批落地，把“发码链路”从 `license-service` 中拆出，并收口可复用的 Prisma 唯一约束识别逻辑。

**已完成**：

- [x] 新增发码独立模块 `src/lib/license-generation-service.ts`
- [x] 新增共享 Prisma 唯一约束工具 `src/lib/prisma-error-utils.ts`
- [x] `license-service` 继续瘦身到 **848 行**

**本轮落地内容**：

1. `src/lib/license-generation-service.ts`
   - 承接以下发码职责：
     - `generateActivationCodes`
     - `generateUniqueActivationCodeBatch`
     - `sortActivationCodesByGeneratedOrder`
   - 保持现有批量写入、整批重试、顺序恢复语义不变
2. `src/lib/prisma-error-utils.ts`
   - 提取 `isPrismaUniqueConstraintError`
   - 让发码链路与授权主链路共享 `P2002` 识别逻辑，避免重复实现
3. `src/lib/license-service.ts`
   - 改为复用并 re-export `generateActivationCodes`
   - 移除 `crypto` 与发码专属 helper，仅聚焦授权主链路与并发收敛
4. 直接调用方同步
   - `src/app/api/admin/codes/generate/route.ts` 改为直接依赖 `license-generation-service`
   - `tests/license-generate-batch.test.ts`
   - `tests/license-api-routes.test.ts`
   - `tests/admin-project-stats-route-handlers.test.ts`
   - `tests/admin-consumption-route-handlers.test.ts`
   - 以上链路已按职责改为直接依赖新模块或新边界

**验证结果**：

1. RED：`node --import tsx --test "tests/license-generate-batch.test.ts" "tests/license-api-routes.test.ts"` 在模块未创建时因 `Cannot find module '../src/lib/license-generation-service'` 失败 ✅
2. GREEN：`node --import tsx --test "tests/license-generate-batch.test.ts" "tests/license-api-routes.test.ts"` ✅
3. 回归：`node --import tsx --test "tests/license-generate-batch.test.ts" "tests/license-api-routes.test.ts" "tests/admin-project-stats-route-handlers.test.ts" "tests/admin-consumption-route-handlers.test.ts" "tests/license-service.test.ts"` ✅
4. 全量：`npm run quality:gate` ✅
5. 完整性：`git diff --check` ✅

**备注**：

- `license-service` 已从 **1192 行** → **980 行** → **848 行**，模块边界进一步清晰
- 当前剩余高耦合区主要集中在：
  - `activate / consume / verify` 主链路
  - 设备绑定冲突与绑定释放 helper
  - `requestId` 幂等占位与并发收敛 helper
- 下一轮应优先拆授权主链路共享 helper，继续降低核心文件复杂度

**下一步**：

1. 继续推进 `P3-02`：拆分授权主链路 helper（绑定查询、冲突收敛、幂等处理）
2. P2-04：登录限流状态外置化，支撑多实例部署
3. P4-02：增加覆盖率门槛，进一步提升交付质量稳定性

---

### 2026-03-25 / Iteration 20

**目标**：继续推进 `P3-02`，把授权主链路里的“设备绑定/冲突收敛 helper”和“requestId 幂等收敛 helper”从 `license-service` 中拆出。

**已完成**：

- [x] 新增绑定独立模块 `src/lib/license-binding-service.ts`
- [x] 新增幂等独立模块 `src/lib/license-consumption-idempotency-service.ts`
- [x] `license-service` 继续瘦身到 **609 行**

**本轮落地内容**：

1. `src/lib/license-binding-service.ts`
   - 承接以下绑定/冲突相关 helper：
     - `buildReusableConflictMessage`
     - `canReuseProjectBinding`
     - `findProjectActivationCode`
     - `findMachineBinding`
     - `releaseReusableMachineBindings`
     - `isProjectMachineUniqueConstraintError`
   - 让 `getLicenseStatus` / `activateLicense` / `consumeLicense` 的共享设备绑定逻辑脱离主文件
2. `src/lib/license-consumption-idempotency-service.ts`
   - 承接以下 `requestId` 幂等 helper：
     - `findConsumptionByRequestId`
     - `waitForSettledConsumptionByRequestId`
     - `buildExistingConsumptionResult`
     - `resolveExistingConsumptionResult`
     - `claimConsumptionRequestId`
   - 让 `consumeLicense` 的并发占位、轮询收敛和幂等复用逻辑模块化
3. `src/lib/license-service.ts`
   - 改为组合调用 binding / idempotency 两个子模块
   - 保留对外业务语义不变，仅聚焦激活、扣次、状态判断等核心 orchestration
4. 测试边界补强
   - 新增 `tests/license-binding-service.test.ts`
   - 新增 `tests/license-consumption-idempotency-service.test.ts`
   - 直接锁定新模块边界，避免后续重构回退成大杂烩实现

**验证结果**：

1. RED：`node --import tsx --test "tests/license-binding-service.test.ts"` 在模块未创建时因 `Cannot find module '../src/lib/license-binding-service'` 失败 ✅
2. GREEN：`node --import tsx --test "tests/license-binding-service.test.ts"` ✅
3. RED：`node --import tsx --test "tests/license-consumption-idempotency-service.test.ts"` 在模块未创建时因 `Cannot find module '../src/lib/license-consumption-idempotency-service'` 失败 ✅
4. GREEN：`node --import tsx --test "tests/license-consumption-idempotency-service.test.ts"` ✅
5. 回归：`node --import tsx --test "tests/license-binding-service.test.ts" "tests/license-consumption-idempotency-service.test.ts" "tests/license-binding-constraint.test.ts" "tests/license-consume-concurrency.test.ts" "tests/license-service.test.ts"` ✅
6. 全量：`npm run quality:gate` ✅
7. 完整性：`git diff --check` ✅

**备注**：

- `license-service` 已从 **1192 行** → **980 行** → **848 行** → **609 行**
- 当前核心主文件已明显收敛，剩余复杂度主要集中在：
  - `activateLicense` / `consumeLicense` 内的分支编排
  - 部分成功/失败结果构造逻辑
  - 时间型 / 次数型分支的状态返回收口

**下一步**：

1. 继续推进 `P3-02`：抽离授权主链路结果构造与分支收口 helper
2. P2-04：登录限流状态外置化，支撑多实例部署
3. P4-02：增加覆盖率门槛，进一步提升交付质量稳定性

---

### 2026-03-25 / Iteration 21

**目标**：继续推进 `P3-02`，把 `license-service` 中分散的结果构造逻辑收敛为独立模块，并统一授权主链路与幂等链路的返回模型。

**已完成**：

- [x] 新增授权结果模块 `src/lib/license-result-service.ts`
- [x] `license-service` 进一步瘦身到 **458 行**
- [x] `license-consumption-idempotency-service` 复用统一结果构造器

**本轮落地内容**：

1. `src/lib/license-result-service.ts`
   - 新增共享 `LicenseResult` 类型
   - 收口通用失败结果构造：
     - `createMissingParamsResult`
     - `createLicenseNotFoundResult`
     - `createUsedByOtherDeviceResult`
     - `createExpiredResult`
     - `createCountExhaustedResult`
     - `createStateChangedRetryResult`
     - `createPendingConsumptionRequestResult`
     - `createRequestIdConflictResult`
   - 收口主链路成功结果构造：
     - `createActivationSuccessResult`
     - `createLicenseStatusSuccessResult`
     - `createTimeConsumeSuccessResult`
     - `createCountConsumeSuccessResult`
2. `src/lib/license-service.ts`
   - 删除本地 `LicenseResult` 定义与散落的返回对象样板
   - 改为组合调用 `license-result-service`
   - 让 `getLicenseStatus / activateLicense / consumeLicense` 更聚焦 orchestration
3. `src/lib/license-consumption-idempotency-service.ts`
   - 改为复用统一的 pending / requestId 冲突 / 幂等成功结果构造
   - 避免幂等链路再次长出一套返回模型
4. 测试边界补强
   - 新增 `tests/license-result-service.test.ts`
   - 直接锁定授权结果构造器的输出，降低后续重构回归风险

**验证结果**：

1. RED：`node --import tsx --test "tests/license-result-service.test.ts"` 在模块未创建时因 `Cannot find module '../src/lib/license-result-service'` 失败 ✅
2. GREEN：`node --import tsx --test "tests/license-result-service.test.ts"` ✅
3. 聚焦回归：`node --import tsx --test "tests/license-result-service.test.ts" "tests/license-consumption-idempotency-service.test.ts" "tests/license-service.test.ts"` ✅
4. 领域回归：`node --import tsx --test "tests/license-result-service.test.ts" "tests/license-binding-service.test.ts" "tests/license-consumption-idempotency-service.test.ts" "tests/license-binding-constraint.test.ts" "tests/license-consume-concurrency.test.ts" "tests/license-service.test.ts"` ✅
5. 完整性：`git diff --check` ✅
6. 全量质量门禁：`npm run quality:gate` ✅

**备注**：

- `license-service` 已从 **1192 行** → **980 行** → **848 行** → **609 行** → **458 行**
- 目前授权主链路的返回模型已经统一，后续继续拆分时不需要再复制状态构造逻辑
- 本轮 `next build` 仍存在既有 `Dynamic server usage` 提示与 `Browserslist` 数据过旧提示，但均不阻塞质量门禁通过

**下一步**：

1. 继续推进 `P3-02`：拆分 `activateLicense / consumeLicense` 的 TIME / COUNT 分支处理器
2. P2-04：登录限流状态外置化，支撑多实例部署
3. P4-02：增加覆盖率门槛，进一步提升交付质量稳定性

---

### 2026-03-25 / Iteration 22

**目标**：继续推进 `P3-02`，把 `activateLicense / consumeLicense` 中的 TIME / COUNT 分支处理器拆出，进一步让 `license-service` 只负责参数校验、项目解析和事务编排。

**已完成**：

- [x] 新增激活分支模块 `src/lib/license-activation-flow-service.ts`
- [x] 新增消费分支模块 `src/lib/license-consume-flow-service.ts`
- [x] `license-service` 进一步瘦身到 **276 行**

**本轮落地内容**：

1. `src/lib/license-activation-flow-service.ts`
   - 承接激活链路的分支处理：
     - `activateCountLicense`
     - `activateTimeLicense`
   - 收口次数型激活耗尽、同设备重复激活、唯一约束冲突收敛、时间型首次激活过期时间计算
2. `src/lib/license-consume-flow-service.ts`
   - 承接消费链路的分支处理：
     - `consumeTimeLicense`
     - `consumeCountLicense`
   - 收口时间型首验激活、次数型扣减、`requestId` 占位后回滚、消费结算落库、状态变化重试收敛
3. `src/lib/license-service.ts`
   - 主文件只保留：
     - 入参标准化
     - 项目解析
     - 设备绑定冲突前置收敛
     - 事务 orchestration
   - TIME / COUNT 具体分支改为委托给子模块处理
4. 测试边界补强
   - 新增 `tests/license-activation-flow-service.test.ts`
   - 新增 `tests/license-consume-flow-service.test.ts`
   - 直接锁定新分支模块的关键行为，避免主文件再次回流成大杂烩

**验证结果**：

1. RED：`node --import tsx --test "tests/license-activation-flow-service.test.ts" "tests/license-consume-flow-service.test.ts"` 在模块未创建时因 `Cannot find module '../src/lib/license-activation-flow-service'` / `Cannot find module '../src/lib/license-consume-flow-service'` 失败 ✅
2. GREEN：`node --import tsx --test "tests/license-activation-flow-service.test.ts" "tests/license-consume-flow-service.test.ts"` ✅
3. 聚焦回归：`node --import tsx --test "tests/license-activation-flow-service.test.ts" "tests/license-consume-flow-service.test.ts" "tests/license-service.test.ts"` ✅
4. 领域回归：`node --import tsx --test "tests/license-activation-flow-service.test.ts" "tests/license-consume-flow-service.test.ts" "tests/license-binding-service.test.ts" "tests/license-consumption-idempotency-service.test.ts" "tests/license-binding-constraint.test.ts" "tests/license-consume-concurrency.test.ts" "tests/license-service.test.ts"` ✅
5. 完整性：`git diff --check` ✅
6. 全量质量门禁：`npm run quality:gate` ✅

**备注**：

- `license-service` 已从 **1192 行** → **980 行** → **848 行** → **609 行** → **458 行** → **276 行**
- 目前核心主文件已基本退化为 façade/orchestrator，授权分支复杂度已下沉到独立模块
- 本轮 `next build` 仍存在既有 `Dynamic server usage` 提示与 `Browserslist` 数据过旧提示，但均不阻塞质量门禁通过

**下一步**：

1. 继续推进 `P3-02`：抽离 `activateLicense / consumeLicense` 共享的“旧绑定释放 / 冲突前置收敛”事务前置逻辑
2. P2-04：登录限流状态外置化，支撑多实例部署
3. P4-02：增加覆盖率门槛，进一步提升交付质量稳定性

---

### 2026-03-25 / Iteration 23

**目标**：继续推进 `P3-02`，把 `activateLicense / consumeLicense` 中重复的“旧绑定释放 / 冲突前置收敛”事务前置逻辑抽出，进一步压缩主文件样板代码。

**已完成**：

- [x] 新增绑定前置模块 `src/lib/license-binding-preflight-service.ts`
- [x] `license-service` 进一步瘦身到 **268 行**

**本轮落地内容**：

1. `src/lib/license-binding-preflight-service.ts`
   - 新增 `prepareMachineBindingForLicenseAction`
   - 统一承接以下前置逻辑：
     - 查询当前项目下设备已绑定激活码
     - 判断是否为同一目标激活码
     - 判断旧绑定是否可复用
     - 生成稳定冲突结果
     - 释放可复用旧绑定
2. `src/lib/license-service.ts`
   - `activateLicense / consumeLicense` 改为复用前置模块
   - 删除重复的设备绑定查询 / 冲突收敛 / 旧绑定释放样板代码
   - 主文件继续保持 façade / orchestrator 角色
3. 测试边界补强
   - 新增 `tests/license-binding-preflight-service.test.ts`
   - 直接锁定“放行 / 冲突 / 释放旧绑定”三种前置行为

**验证结果**：

1. RED：`node --import tsx --test "tests/license-binding-preflight-service.test.ts"` 在模块未创建时因 `Cannot find module '../src/lib/license-binding-preflight-service'` 失败 ✅
2. GREEN：`node --import tsx --test "tests/license-binding-preflight-service.test.ts"` ✅
3. 聚焦回归：`node --import tsx --test "tests/license-binding-preflight-service.test.ts" "tests/license-service.test.ts"` ✅
4. 领域回归：`node --import tsx --test "tests/license-binding-preflight-service.test.ts" "tests/license-activation-flow-service.test.ts" "tests/license-consume-flow-service.test.ts" "tests/license-binding-service.test.ts" "tests/license-consumption-idempotency-service.test.ts" "tests/license-binding-constraint.test.ts" "tests/license-consume-concurrency.test.ts" "tests/license-service.test.ts"` ✅
5. 完整性：`git diff --check` ✅
6. 全量质量门禁：`npm run quality:gate` ✅

**备注**：

- `license-service` 已从 **1192 行** → **980 行** → **848 行** → **609 行** → **458 行** → **276 行** → **268 行**
- 目前授权主链路中的重复前置收敛逻辑已经抽离，主文件更接近纯 orchestration
- 本轮 `next build` 仍存在既有 `Dynamic server usage` 提示与 `Browserslist` 数据过旧提示，但均不阻塞质量门禁通过

**下一步**：

1. 继续推进 `P3-02`：评估是否将 `code/machineId/requestId` 入参与 request 上下文标准化继续抽成共享输入模型
2. P2-04：登录限流状态外置化，支撑多实例部署
3. P4-02：增加覆盖率门槛，进一步提升交付质量稳定性

---

### 2026-03-25 / Iteration 24

**目标**：继续推进 `P3-02`，把授权主链路中分散的 `code / machineId / requestId / request context` 输入模型收口成共享模块，减少跨文件重复类型与上下文构造。

**已完成**：

- [x] 新增授权输入上下文模块 `src/lib/license-action-context.ts`
- [x] `license-service` 进一步瘦身到 **254 行**

**本轮落地内容**：

1. `src/lib/license-action-context.ts`
   - 新增共享输入/上下文模型：
     - `LicenseActionInput`
     - `ConsumeLicenseInput`
     - `LicenseStatusInput`
     - `LicenseActionCodeRecord`
     - `LicenseConflictResolver`
     - `LicenseConsumptionRequestContext`
     - `LicenseIdempotencyClaimResult`
   - 新增共享规范化与上下文构造：
     - `normalizeLicenseActionInput`
     - `normalizeConsumeLicenseInput`
     - `buildLicenseConsumptionRequestContext`
2. `src/lib/license-service.ts`
   - 删除本地输入类型与 `normalizeCode / normalizeMachineId`
   - 改为复用共享输入规范化模块
   - `consumeLicense` 改为复用统一 request context，而不是在多处内联拼装
3. `src/lib/license-activation-flow-service.ts`
   - 改为复用共享 `LicenseActionCodeRecord / LicenseConflictResolver`
4. `src/lib/license-consume-flow-service.ts`
   - 改为复用共享 `LicenseActionCodeRecord / LicenseConflictResolver / LicenseIdempotencyClaimResult`
5. `src/lib/license-consumption-idempotency-service.ts`
   - 改为复用共享 `LicenseConsumptionRequestContext`
6. 测试边界补强
   - 新增 `tests/license-action-context.test.ts`
   - 直接锁定输入 trim 与 request context 构造行为

**验证结果**：

1. RED：`node --import tsx --test "tests/license-action-context.test.ts"` 在模块未创建时因 `Cannot find module '../src/lib/license-action-context'` 失败 ✅
2. GREEN：`node --import tsx --test "tests/license-action-context.test.ts"` ✅
3. 聚焦回归：`node --import tsx --test "tests/license-action-context.test.ts" "tests/license-activation-flow-service.test.ts" "tests/license-consume-flow-service.test.ts" "tests/license-consumption-idempotency-service.test.ts" "tests/license-service.test.ts"` ✅
4. 领域回归：`node --import tsx --test "tests/license-action-context.test.ts" "tests/license-binding-preflight-service.test.ts" "tests/license-activation-flow-service.test.ts" "tests/license-consume-flow-service.test.ts" "tests/license-binding-service.test.ts" "tests/license-consumption-idempotency-service.test.ts" "tests/license-binding-constraint.test.ts" "tests/license-consume-concurrency.test.ts" "tests/license-service.test.ts"` ✅
5. 完整性：`git diff --check` ✅
6. 全量质量门禁：`npm run quality:gate` ✅

**备注**：

- `license-service` 已从 **1192 行** → **980 行** → **848 行** → **609 行** → **458 行** → **276 行** → **268 行** → **254 行**
- 当前授权主链路的共享输入与上下文模型已经统一，后续再拆分时不需要复制类型和 request context 拼装
- 本轮 `next build` 仍存在既有 `Dynamic server usage` 提示与 `Browserslist` 数据过旧提示，但均不阻塞质量门禁通过

**下一步**：

1. 继续推进 `P3-02`：评估是否将 `createProjectMachineConflictResult` 与授权主链路 reload helper 继续抽成共享 orchestration helper
2. P2-04：登录限流状态外置化，支撑多实例部署
3. P4-02：增加覆盖率门槛，进一步提升交付质量稳定性

---

### 2026-03-25 / Iteration 25

**目标**：落地 `P4-02`，把覆盖率门槛纳入日常质量门禁，确保提交前不仅“测试通过”，而且 `src/` 业务代码的覆盖率不会无声下滑。

**已完成**：

- [x] `package.json` 新增 `test:coverage`
- [x] `quality:gate` 改为强制执行覆盖率门槛
- [x] README / 开发文档同步覆盖率命令与阈值说明
- [x] `P4-02` 状态更新为 `DONE`

**本轮落地内容**：

1. `package.json`
   - 新增 `npm run test:coverage`
   - 使用 Node 内建 test runner 覆盖率能力，避免额外引入第三方依赖
   - 覆盖范围限定为 `src/` 业务代码（通过排除 `tests/**` 实现）
   - 增加最低阈值：
     - 行覆盖率 `>= 90%`
     - 分支覆盖率 `>= 85%`
     - 函数覆盖率 `>= 90%`
2. `quality:gate`
   - 从 `lint + test + build`
   - 升级为 `lint + test:coverage + build`
   - 保证提交流水线默认卡住覆盖率回退
3. 文档同步
   - `README.md` 增加“开发质量门禁”说明
   - `xitonkaifa.md` 增加覆盖率命令与阈值说明
   - 同步补记 `license-transaction-helpers.ts` 模块职责

**验证结果**：

1. 基线测量：`node --experimental-test-coverage --test-coverage-exclude="tests/**" --import tsx --test "tests/**/*.test.ts"` ✅
   - `src/` 总覆盖率：
     - 行覆盖率：`91.15%`
     - 分支覆盖率：`87.24%`
     - 函数覆盖率：`92.37%`
2. 门槛验证：`node --experimental-test-coverage --test-coverage-exclude="tests/**" --test-coverage-lines=90 --test-coverage-branches=85 --test-coverage-functions=90 --import tsx --test "tests/**/*.test.ts"` ✅

**备注**：

- 本轮优先选择 Node 内建覆盖率阈值，而不是再引入 `c8/nyc` 等依赖，遵循 KISS / YAGNI
- 当前门槛保留了合理安全边际，既能阻止明显回退，也不会把流水线配置成脆弱阈值
- `P3-02` 仍保持 `IN_PROGRESS`，后续可继续压缩 `license-service` 剩余 orchestration

**下一步**：

1. 继续推进 `P3-02`：把 `license-service` 剩余“查码 + 当前设备可用性判断”继续抽成共享 helper
2. P2-04：登录限流状态外置化，支撑多实例部署
3. P4-03：继续减少 `any` 与弱类型返回，提升类型安全

---

### 2026-03-25 / Iteration 26

**目标**：继续做提交视角打磨，消除构建日志中的误导性噪音，避免把 Next.js 构建期 `Dynamic server usage` 哨兵错误错误记录为“认证验证失败”。

**已完成**：

- [x] 为 `admin-auth-service` 补充构建期动态哨兵错误回归测试
- [x] 避免将 `DYNAMIC_SERVER_USAGE` 记录为误导性认证失败日志
- [x] 构建日志回归验证通过

**本轮落地内容**：

1. `tests/admin-auth-service.test.ts`
   - 新增测试：
     - `authorizeAdminRequest` 遇到 Next `Dynamic server usage` 哨兵错误时，不再打印误导性 `console.error`
2. `src/lib/admin-auth-service.ts`
   - 新增 `isDynamicServerUsageError`
   - 在保留原有失败返回语义不变的前提下，跳过对该类哨兵错误的噪音日志输出
   - 继续保证普通异常仍会记录，避免误伤真实故障观测
3. 文档同步
   - `xitonkaifa.md` 补记 `admin-auth-service` 职责

**验证结果**：

1. RED：`node --import tsx --test "tests/admin-auth-service.test.ts"` 在新增测试后失败，暴露当前会错误打印认证失败日志 ✅
2. GREEN：`node --import tsx --test "tests/admin-auth-service.test.ts"` ✅
3. 相关回归：`node --import tsx --test "tests/middleware-auth.test.ts" "tests/admin-page-guard.test.ts"` ✅
4. 构建回归：`npm run build` ✅
   - 之前构建中的多条 `认证验证失败: Dynamic server usage ...` 噪音日志已消失

**备注**：

- 该改动不改变鉴权失败的对外 HTTP 语义，只优化内部观测质量，遵循 KISS
- 这类日志噪音会干扰提交流水线审阅，本轮属于“提交前最后一公里”的稳定性打磨

**下一步**：

1. 继续推进 `P3-02`：进一步压缩 `license-service` 剩余 orchestration
2. P2-04：登录限流状态外置化，支撑多实例部署
3. P4-03：继续减少 `any` 与弱类型返回，提升类型安全

---

### 2026-03-25 / Iteration 30

**目标**：并行推进 `P2-04 / P4-03 / P3-02`：将登录限流状态外置到共享数据库、清理剩余弱类型热点，并继续压缩 `license-service` 的状态查询编排。

**已完成**：

- [x] `P2-04` 登录限流状态外置化完成
- [x] `P4-03` 当前代码库 `src/ + tests/` 的 `any` 清零
- [x] `P3-02` 新增状态查询服务，`license-service` 进一步瘦身到 **182 行**

**本轮落地内容**：

1. 登录限流状态共享化
   - `prisma/schema.prisma`
     - 新增 `AdminLoginRateLimitState`
   - `src/lib/admin-login-rate-limit-store.ts`
     - 新增 Prisma 持久化 store
   - `src/lib/admin-login-rate-limit.ts`
     - 保留进程内 limiter 供快速单测复用
     - 新增 `createSharedAdminLoginRateLimiter`
     - 默认 `adminLoginRateLimiter` 改为基于数据库共享状态
   - `src/lib/admin-login-route-handler.ts`
     - 抽离登录路由 handler，便于注入 rate limiter 与单测覆盖
   - `src/app/api/admin/login/route.ts`
     - route 文件收敛为纯 Next 导出，避免 Route export 违规
2. 类型安全收口
   - `src/lib/config-service.ts`
     - 为已知系统配置键补齐强类型返回
     - 移除缓存、读取、写入链路中的 `any`
   - `src/lib/system-config-defaults.ts`
     - 新增 `KnownSystemConfigMap / KnownSystemConfigKey`
   - `src/lib/admin-auth-shared.ts`
   - `src/lib/admin-auth-service.ts`
   - `src/lib/jwt.ts`
     - JWT payload / verifyToken / signToken 全链路改为显式类型
   - `tests/admin-login-route.test.ts`
   - `tests/system-config-write.test.ts`
     - 移除测试中的剩余 `any`
3. 继续推进 `P3-02`
   - 新增 `src/lib/license-status-query-service.ts`
   - `src/lib/license-service.ts`
     - `getLicenseStatus` 改为委托状态查询服务
     - façade 继续聚焦“参数校验 + 项目解析 + 主链路编排”

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/admin-login-rate-limit-store.test.ts" "tests/license-status-query-service.test.ts"` 在新模块未创建时因 `Cannot find module ...` 失败 ✅
2. 聚焦回归：
   - `node --import tsx --test "tests/admin-login-rate-limit.test.ts" "tests/admin-login-rate-limit-store.test.ts" "tests/admin-login-route.test.ts" "tests/dev-bootstrap.test.ts" "tests/license-status-query-service.test.ts" "tests/license-service.test.ts" "tests/admin-auth-service.test.ts" "tests/config-service-fallback.test.ts"` ✅
3. 生成 Prisma Client：
   - `npm run db:generate` ✅
4. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅

**备注**：

- `P2-04` 已从“单进程内存态限流”升级为“数据库共享限流状态”，更适合多实例 / 多进程部署
- `P4-03` 本轮后 `rg` 扫描 `src/ tests/` 已不再命中 `any`
- `license-service` 已从 **1192 行** → **980 行** → **848 行** → **609 行** → **458 行** → **276 行** → **268 行** → **254 行** → **221 行** → **217 行** → **194 行** → **182 行**

**下一步**：

1. 继续推进 `P3-02`：评估是否把 `verifyActivationCode / consumeLicense` 的 façade 入口模型再统一一层
2. 推进 `P3-03`：统一 route wrapper / 输入校验 / 错误模型
3. 推进 `P4-04`：收口 README / 开发文档 / 安全说明，确保文档与实现一致

---

### 2026-03-25 / Iteration 31

**目标**：继续推进 `P3-03`，统一正式授权接口与兼容 `/api/verify` 的 route handler 编排和响应模型收口，减少重复路由样板。

**已完成**：

- [x] `/api/verify` 已复用统一 license handler 层
- [x] `license-route-handlers` 新增共享执行 runner
- [x] 新增兼容 verify handler 回归测试

**本轮落地内容**：

1. `src/lib/license-api.ts`
   - 新增 `createLegacyLicenseResponse`
   - 把响应字段装配收口到共享 payload builder
   - 正式接口与 legacy 接口复用同一套结果映射逻辑
2. `src/lib/license-route-handlers.ts`
   - 新增内部 `executeLicenseRequest`
   - `activate / consume / status / verify` 全部改为复用共享请求读取、错误收敛与响应分流
   - 新增 `handleVerifyLicenseRequest`
3. `src/app/api/verify/route.ts`
   - route 文件收敛为纯委托调用，不再重复手写 request.json / service / response 编排
4. `tests/license-api-routes.test.ts`
   - 新增兼容路由回归：
     - `/api/verify` 复用统一 handler
     - 保持 legacy snake_case 返回字段

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/license-api-routes.test.ts"` 在 `handleVerifyLicenseRequest` 未实现时失败，报 `(0 , import_license_route_handlers.handleVerifyLicenseRequest) is not a function` ✅
2. GREEN：
   - `node --import tsx --test "tests/license-api-routes.test.ts"` ✅

**备注**：

- 本轮属于 `P3-03` 的第一步，不追求一次性引入大而全 wrapper，而是先把最核心的授权路由族收口
- 收益点在于：正式接口与兼容接口以后可以共享 request 解析、错误处理和响应映射，不再双轨漂移

**下一步**：

1. 继续推进 `P3-03`：评估是否把 admin route 中重复的 `verifyAuth + try/catch + 500` 模板提取为统一 wrapper
2. 推进 `P4-04`：收口 README / 开发文档 / 安全说明，确保文档与实现一致
3. 继续推进 `P3-02`：看是否还能压缩 `license-service` 剩余 façade 样板

---

### 2026-03-25 / Iteration 29

**目标**：继续推进 `P3-02`，把 `activateLicense / consumeLicense` 中重复的“事务前置准备（旧绑定收敛 + 查码 + helper 装配）”抽成共享服务，进一步压缩 façade 样板代码。

**已完成**：

- [x] 新增 `src/lib/license-transaction-preparation-service.ts`
- [x] `license-service` 进一步瘦身到 **194 行**
- [x] 新增 `tests/license-transaction-preparation-service.test.ts`

**本轮落地内容**：

1. `src/lib/license-transaction-preparation-service.ts`
   - 新增 `prepareLicenseTransactionAction`
   - 统一收敛：
     - 旧绑定预检查与可复用释放
     - 授权事务内共享 helper 装配
     - 目标激活码加载与结果分流
   - 返回稳定联合类型：
     - `{ result }`
     - 或 `{ activationCode, txHelpers }`
2. `src/lib/license-service.ts`
   - `activateLicense / consumeLicense` 不再重复内联：
     - `prepareMachineBindingForLicenseAction`
     - `createLicenseTransactionHelpers`
     - `loadLicenseActionCodeForMachine`
   - 主文件继续向“参数校验 + 项目解析 + 分支编排”收缩
3. 测试边界补强
   - 新增 `tests/license-transaction-preparation-service.test.ts`
   - 锁定三类核心场景：
     - 旧绑定不可复用
     - 目标激活码被其他设备占用
     - 前置通过并返回 `activationCode + txHelpers`

**验证结果**：

1. RED：`node --import tsx --test "tests/license-transaction-preparation-service.test.ts"` 在模块未创建时因 `Cannot find module '../src/lib/license-transaction-preparation-service'` 失败 ✅
2. GREEN：`node --import tsx --test "tests/license-transaction-preparation-service.test.ts" "tests/license-service.test.ts"` ✅

**备注**：

- `license-service` 已从 **1192 行** → **980 行** → **848 行** → **609 行** → **458 行** → **276 行** → **268 行** → **254 行** → **221 行** → **217 行** → **194 行**
- 本轮遵循 KISS / DRY：把重复事务样板移入独立服务，但仍保留 façade 对外语义与调用方式不变

**下一步**：

1. 继续推进 `P3-02`：评估是否把 `getLicenseStatus` 的查码编排也纳入统一 preparation / access 层
2. P2-04：登录限流状态外置化，支撑多实例部署
3. P4-03：继续减少 `any` 与弱类型返回，提升类型安全

---

### 2026-03-25 / Iteration 28

**目标**：继续推进 `P3-02`，把 `license-service` 中重复的“查码 + 当前设备可用性判断”抽成共享 helper，进一步收缩主文件样板逻辑。

**已完成**：

- [x] 新增 `src/lib/license-code-access-service.ts`
- [x] `license-service` 进一步瘦身到 **217 行**
- [x] 新增 `tests/license-code-access-service.test.ts`

**本轮落地内容**：

1. `src/lib/license-code-access-service.ts`
   - 新增 `loadLicenseActionCodeForMachine`
   - 统一处理：
     - 激活码不存在
     - 激活码已被其他设备占用
     - 当前设备可继续使用
2. `src/lib/license-service.ts`
   - `getLicenseStatus / activateLicense / consumeLicense` 不再重复内联：
     - `reloadActivationCode`
     - `createLicenseNotFoundResult`
     - `createUsedByOtherDeviceResult`
   - 主文件继续向纯 orchestration 收敛
3. 测试边界补强
   - 新增 `tests/license-code-access-service.test.ts`
   - 直接锁定共享查码 helper 的三类返回路径

**验证结果**：

1. RED：临时执行 `node --import tsx --test /tmp/license-code-access-service.test.ts`，在模块未创建时因 `Cannot find module '../src/lib/license-code-access-service'` 失败 ✅
2. GREEN：`node --import tsx --test "tests/license-code-access-service.test.ts"` ✅
3. 聚焦回归：`node --import tsx --test "tests/license-code-access-service.test.ts" "tests/license-service.test.ts"` ✅
4. 领域回归：`node --import tsx --test "tests/license-code-access-service.test.ts" "tests/license-action-context.test.ts" "tests/license-binding-preflight-service.test.ts" "tests/license-activation-flow-service.test.ts" "tests/license-consume-flow-service.test.ts" "tests/license-binding-service.test.ts" "tests/license-consumption-idempotency-service.test.ts" "tests/license-transaction-helpers.test.ts" "tests/license-binding-constraint.test.ts" "tests/license-consume-concurrency.test.ts" "tests/license-service.test.ts"` ✅

**备注**：

- `license-service` 已从 **1192 行** → **980 行** → **848 行** → **609 行** → **458 行** → **276 行** → **268 行** → **254 行** → **221 行** → **217 行**
- 本轮优化收益不在“行数骤减”，而在进一步消除重复业务判断，让 façade 更聚焦事务编排

**下一步**：

1. 继续推进 `P3-02`：评估是否把 `activateLicense / consumeLicense` 的事务外壳进一步抽成共享 runner
2. P2-04：登录限流状态外置化，支撑多实例部署
3. P4-03：继续减少 `any` 与弱类型返回，提升类型安全

---

### 2026-03-25 / Iteration 27

**目标**：解决本地开发服务与生产构建共享 `.next` 目录导致的产物互相污染问题，保证“边开发边验收 / 边跑质量门禁”场景稳定可用。

**已完成**：

- [x] 为 `next.config.js` 增加可配置 `distDir`
- [x] `build/start` 切换到独立 `.next-build`
- [x] 新增配置回归测试
- [x] 文档同步构建产物隔离策略

**本轮落地内容**：

1. `tests/next-config.test.ts`
   - 新增测试：
     - 默认构建目录为 `.next`
     - 设置 `NEXT_DIST_DIR` 后可切换到隔离目录
2. `next.config.js`
   - 新增 `distDir: process.env.NEXT_DIST_DIR || '.next'`
3. `package.json`
   - `build` 改为 `NEXT_DIST_DIR=.next-build next build`
   - `start` 改为 `NEXT_DIST_DIR=.next-build next start`
4. 文档同步
   - `README.md` 增加构建目录隔离说明
   - `xitonkaifa.md` 增加“构建产物隔离”说明

**验证结果**：

1. RED：`node --import tsx --test "tests/next-config.test.ts"` 在配置未支持 `distDir` 前失败 ✅
2. GREEN：`node --import tsx --test "tests/next-config.test.ts"` ✅
3. 构建回归：`npm run build` ✅
4. 并行验收：开发服务运行时再次执行 `npm run quality:gate`，未再出现 `.next` 被构建产物破坏的问题 ✅

**备注**：

- 本轮修复的是一个非常真实的本地工程问题：此前 `dev` 与 `build` 共用 `.next`，在同一工作区并行运行时可能导致 `MODULE_NOT_FOUND`
- 现在开发态与生产构建态的产物目录已经隔离，更适合边观察页面边跑质量校验

**下一步**：

1. 继续推进 `P3-02`：进一步压缩 `license-service` 剩余 orchestration
2. P2-04：登录限流状态外置化，支撑多实例部署
3. P4-03：继续减少 `any` 与弱类型返回，提升类型安全

---

### 2026-03-25 / Iteration 32

**目标**：继续推进 `P3-03`，把后台 admin 路由重复的 `verifyAuth + createAuthResponse + try/catch + 错误响应` 收口为统一 wrapper，并降低可预期 4xx 业务错误的噪音日志。

**已完成**：

- [x] 新增通用 `admin-route-handler`
- [x] 首批消费 / 统计后台路由迁移到统一 wrapper
- [x] 进一步覆盖项目、系统配置、改密、激活码管理等后台路由
- [x] 可预期业务错误支持自定义映射且默认不打印错误日志

**本轮落地内容**：

1. `src/lib/admin-route-handler.ts`
   - 新增 `createProtectedAdminRouteHandler`
   - 统一收敛：
     - admin 鉴权失败直接返回标准鉴权响应
     - 成功后委托业务 handler
     - 统一 `try/catch + log + JSON error response`
   - 支持扩展能力：
     - 路由上下文参数透传（如 `[id]`）
     - 向业务 handler 透出已验证的 `authResult`
     - `resolveErrorResponse` 自定义错误映射
   - 对已映射的预期业务错误默认不再打印 `console.error`，避免把 400 类错误误报成异常噪音
2. 后台路由收敛
   - 已迁移：
     - `src/app/api/admin/consumptions/route.ts`
     - `src/app/api/admin/consumptions/export/route.ts`
     - `src/app/api/admin/consumptions/trend/route.ts`
     - `src/app/api/admin/consumptions/trend/export/route.ts`
     - `src/app/api/admin/codes/stats/route.ts`
     - `src/app/api/admin/codes/stats/export/route.ts`
     - `src/app/api/admin/system-config/route.ts`
     - `src/app/api/admin/change-password/route.ts`
     - `src/app/api/admin/projects/route.ts`
     - `src/app/api/admin/projects/[id]/route.ts`
     - `src/app/api/admin/codes/list/route.ts`
     - `src/app/api/admin/codes/generate/route.ts`
     - `src/app/api/admin/codes/delete/route.ts`
     - `src/app/api/admin/codes/cleanup/route.ts`
3. 测试补强
   - `tests/admin-route-handler.test.ts`
     - 鉴权失败直接返回
     - 鉴权成功委托业务 handler
     - `exposeErrorMessage` 行为
     - 路由上下文透传
     - 自定义错误映射
     - 已映射错误默认不记 error 日志
   - `tests/admin-project-routes.test.ts`
     - 项目列表 route
     - 项目创建 route
     - 项目更新 route
     - 项目删除 route

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/admin-route-handler.test.ts"` 在新增“自定义错误映射默认不打印错误日志”断言后失败 ✅
2. GREEN：
   - `node --import tsx --test "tests/admin-route-handler.test.ts"` ✅
   - `node --import tsx --test "tests/system-config-route.test.ts"` ✅
   - `node --import tsx --test "tests/admin-project-routes.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅

**备注**：

- `P3-03` 已从“概念级 TODO”进入可复用基础设施阶段，因此状态更新为 `IN_PROGRESS`
- 当前 `admin-route-handler` 已覆盖大部分后台受保护路由，后续继续推进时可围绕：
  - 输入 schema 校验进一步统一
  - 错误码 / 错误 payload 规范化
  - route 级集成测试补齐

**下一步**：

1. 继续推进 `P3-03`：把剩余“输入校验 / 错误模型”从零散判断进一步收口
2. 继续推进 `P3-02`：评估是否继续压缩 `license-service` 剩余 façade 编排
3. 推进 `P3-05 / P4-04`：补 route 级回归测试并收口 README / 开发文档 / 安全说明

---

### 2026-03-25 / Iteration 33

**目标**：启动 `P3-01`，优先抽离 dashboard 页面中重复的 workspace tab 导航 UI，降低页面文件体量并为后续继续拆分项目/激活码/消费工作区做准备。

**已完成**：

- [x] 新增通用 `WorkspaceTabNav` 组件
- [x] dashboard 的项目 / 激活码 / 消费三组重复 tab 导航已改为复用组件
- [x] 新增组件级回归测试

**本轮落地内容**：

1. `src/components/workspace-tab-nav.tsx`
   - 新增通用 workspace tab 导航组件
   - 统一收敛：
     - 卡片式 tab 按钮样式
     - 激活态 / 非激活态视觉状态
     - `shortLabel / label / description` 布局
   - 保留 `badgeTextClassName` 可配置项，兼容项目工作区与其他工作区的细微字重差异
2. `src/app/admin/dashboard/page.tsx`
   - 把以下 3 处重复 tab 渲染样板替换为 `WorkspaceTabNav`
     - 项目工作区
     - 激活码工作区
     - 消费日志工作区
   - 页面文件从 **4193 行** 降到 **4096 行**
3. `tests/workspace-tab-nav.test.ts`
   - 新增组件测试，锁定：
     - 文案渲染
     - 激活态样式
     - 非激活态样式

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/workspace-tab-nav.test.ts"` 首次失败，原因是组件文件在当前编译配置下缺少显式 `React` 引入 ✅
2. GREEN：
   - `node --import tsx --test "tests/workspace-tab-nav.test.ts"` ✅
   - `node --import tsx --test "tests/dashboard-workspace-tabs.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅

**备注**：

- `P3-01` 已正式进入 `IN_PROGRESS`
- 本轮只抽取“重复 UI 导航样板”，遵循 KISS / YAGNI，不提前引入复杂的 dashboard 上下文状态管理
- 后续可继续沿同一路线拆：
  - workspace summary stat card
  - 项目管理工作区块
  - 激活码筛选 / 结果工作区块
  - 消费日志筛选 / 日志 / 趋势工作区块

**下一步**：

1. 继续推进 `P3-01`：拆分 dashboard 内重复的 summary/stat card 与工作区块
2. 继续推进 `P3-03`：把输入校验 / 错误模型再统一一层
3. 继续推进 `P3-05 / P4-04`：补前端组件回归并同步文档

---

### 2026-03-25 / Iteration 34

**目标**：继续推进 `P3-01`，把 dashboard 工作区里重复的 summary metric card 抽成统一组件，进一步减少页面样板并统一统计卡片的视觉表达。

**已完成**：

- [x] 新增通用 `WorkspaceMetricCard`
- [x] dashboard 的项目 / 激活码 / 消费工作区 summary card 已统一复用
- [x] 新增组件级回归测试

**本轮落地内容**：

1. `src/components/workspace-metric-card.tsx`
   - 新增统一统计卡片组件
   - 收口字段：
     - `label`
     - `value`
     - `description`
     - 可选 `className`
2. `src/app/admin/dashboard/page.tsx`
   - 替换项目工作区 summary card
   - 替换激活码工作区 summary card
   - 替换消费日志工作区 summary card
   - 页面文件进一步从 **4096 行** 收缩到 **4089 行**
3. `tests/workspace-metric-card.test.ts`
   - 锁定：
     - 标签 / 数值 / 描述渲染
     - 自定义 `className` 覆盖行为

**验证结果**：

1. GREEN：
   - `node --import tsx --test "tests/workspace-metric-card.test.ts" "tests/workspace-tab-nav.test.ts"` ✅
2. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅

**备注**：

- 本轮继续沿着“公共工作区组件库”方向推进，但仍保持 KISS：只抽取已重复出现且边界稳定的视觉单元
- 当前 dashboard 已具备两个可复用底座：
  - `WorkspaceTabNav`
  - `WorkspaceMetricCard`

**下一步**：

1. 继续推进 `P3-01`：抽离 workspace hero / summary block 或具体内容区块
2. 继续推进 `P3-03`：统一输入校验 / 错误模型
3. 继续推进 `P3-05 / P4-04`：补前端组件回归并同步文档

---

### 2026-03-25 / Iteration 35

**目标**：继续推进 `P3-01`，把 dashboard 中 3 个 workspace 的头部 hero 区块收口成统一组件，进一步降低重复布局、统一视觉层次，并为后续拆 workspace 内容块做准备。

**已完成**：

- [x] 新增通用 `WorkspaceHeroPanel`
- [x] 项目 / 激活码 / 消费 3 个 workspace 头部区块已统一复用
- [x] 新增组件级回归测试

**本轮落地内容**：

1. `src/components/workspace-hero-panel.tsx`
   - 新增通用 workspace hero 组件
   - 收口字段：
     - `badge`
     - `title`
     - `description`
     - `metrics`
     - `tabs`
     - `gradientClassName`
2. `src/app/admin/dashboard/page.tsx`
   - 项目工作区 hero 改为 `WorkspaceHeroPanel`
   - 激活码工作区 hero 改为 `WorkspaceHeroPanel`
   - 消费日志工作区 hero 改为 `WorkspaceHeroPanel`
   - 页面文件进一步从 **4089 行** 收缩到 **4063 行**
3. `tests/workspace-hero-panel.test.ts`
   - 锁定：
     - 徽标 / 标题 / 描述渲染
     - 渐变背景透传
     - metrics / tabs slot 注入
     - 统一头部视觉结构

**验证结果**：

1. GREEN：
   - `node --import tsx --test "tests/workspace-hero-panel.test.ts" "tests/workspace-metric-card.test.ts" "tests/workspace-tab-nav.test.ts"` ✅
2. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅

**备注**：

- 当前 dashboard 已形成一组可复用工作区 UI 基础设施：
  - `WorkspaceHeroPanel`
  - `WorkspaceMetricCard`
  - `WorkspaceTabNav`
- 后续继续拆分时，可以把项目管理 / 激活码管理 / 消费日志三个 workspace 的内容区域进一步拆成独立组件，而不必再复制头部结构

**下一步**：

1. 继续推进 `P3-01`：拆 workspace 内容区块（项目管理、激活码过滤/结果、消费日志过滤/趋势）
2. 继续推进 `P3-03`：统一输入校验 / 错误模型
3. 继续推进 `P3-05 / P4-04`：补组件回归并继续收口文档

---

### 2026-03-25 / Iteration 36

**目标**：继续推进 `P3-01`，把 dashboard 内容区里重复的区块标题/说明/操作区头部收口成统一组件，进一步减少样板代码并统一内容区视觉节奏。

**已完成**：

- [x] 新增通用 `DashboardSectionHeader`
- [x] 项目 / 激活码 / 消费工作区的 6 处内容区头部已统一复用
- [x] 新增组件级回归测试并通过全量门禁

**本轮落地内容**：

1. `src/components/dashboard-section-header.tsx`
   - 新增 dashboard 内容区通用头部组件
   - 收口字段：
     - `title`
     - `description`
     - `trailing`
     - `className`
2. `src/app/admin/dashboard/page.tsx`
   - 项目工作区：
     - “新建项目”头部改为 `DashboardSectionHeader`
     - “项目列表”头部改为 `DashboardSectionHeader`
   - 激活码工作区：
     - “筛选与导出”头部改为 `DashboardSectionHeader`
     - “激活码列表”头部改为 `DashboardSectionHeader`
   - 消费日志工作区：
     - “筛选与刷新”头部改为 `DashboardSectionHeader`
     - “消费日志”头部改为 `DashboardSectionHeader`
   - 页面文件进一步从 **4063 行** 收缩到 **4052 行**
3. `tests/dashboard-section-header.test.ts`
   - 锁定：
     - 标题 / 描述渲染
     - 默认布局类名
     - trailing slot 注入
     - 自定义 `className` 覆盖

**验证结果**：

1. 聚焦回归：
   - `node --import tsx --test "tests/dashboard-section-header.test.ts" "tests/workspace-hero-panel.test.ts" "tests/workspace-metric-card.test.ts" "tests/workspace-tab-nav.test.ts"` ✅
2. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅
3. 当前质量结果：
   - 全量测试：**215 / 215** ✅
   - 行覆盖率：**91.60%** ✅
   - 分支覆盖率：**87.17%** ✅
   - 函数覆盖率：**93.39%** ✅

**备注**：

- dashboard 现在已经形成一套分层明确的可复用 UI 基础设施：
  - `WorkspaceHeroPanel`
  - `WorkspaceTabNav`
  - `WorkspaceMetricCard`
  - `DashboardSectionHeader`
- 后续继续拆分 workspace 内容块时，可以优先围绕“筛选区 / 列表区 / 趋势区 / 设置区”做容器组件抽取，而不必再复制区块头部结构

**下一步**：

1. 继续推进 `P3-01`：拆 workspace 内容主体（项目筛选表单、激活码结果区、消费日志列表区）
2. 继续推进 `P3-02`：继续收口 `license-service` 余下编排职责
3. 继续推进 `P3-05 / P4-04`：补 dashboard 内容组件回归与文档一致性

---

### 2026-03-25 / Iteration 37

**目标**：继续推进 `P3-01`，把 dashboard 内高频重复的筛选 token / 空状态胶囊列表收口成统一组件，进一步压缩页面样板并统一筛选摘要视觉语言。

**已完成**：

- [x] 新增通用 `DashboardTokenList`
- [x] 激活码 / 消费工作区的 4 处 token 列表已统一复用
- [x] 新增组件级回归测试并通过全量门禁

**本轮落地内容**：

1. `src/components/dashboard-token-list.tsx`
   - 新增 dashboard token / 空状态胶囊列表组件
   - 收口字段：
     - `tokens`
     - `emptyText`
     - `className`
     - `tokenClassName`
     - `emptyClassName`
2. `src/app/admin/dashboard/page.tsx`
   - 激活码工作区：
     - “当前生效条件” token 列表改为 `DashboardTokenList`
     - “激活码列表”顶部筛选摘要改为 `DashboardTokenList`
   - 消费日志工作区：
     - “快捷时间范围”下方筛选 token 列表改为 `DashboardTokenList`
     - “消费日志”顶部筛选摘要改为 `DashboardTokenList`
   - 页面文件进一步从 **4052 行** 收缩到 **4008 行**
3. `tests/dashboard-token-list.test.ts`
   - 锁定：
     - token 渲染
     - 空状态文案
     - 默认布局样式
     - 自定义样式覆盖

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/dashboard-token-list.test.ts"` ❌（组件不存在，`MODULE_NOT_FOUND`）
2. GREEN：
   - `node --import tsx --test "tests/dashboard-token-list.test.ts"` ✅
   - `node --import tsx --test "tests/dashboard-token-list.test.ts" "tests/dashboard-section-header.test.ts" "tests/workspace-hero-panel.test.ts" "tests/workspace-metric-card.test.ts" "tests/workspace-tab-nav.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅
4. 当前质量结果：
   - 全量测试：**218 / 218** ✅
   - 行覆盖率：**91.63%** ✅
   - 分支覆盖率：**87.13%** ✅
   - 函数覆盖率：**93.45%** ✅

**备注**：

- dashboard 组件化基础设施继续扩展为：
  - `WorkspaceHeroPanel`
  - `WorkspaceTabNav`
  - `WorkspaceMetricCard`
  - `DashboardSectionHeader`
  - `DashboardTokenList`
- 当前已把“头部 + token 摘要”两类重复 UI 收口，下一步可以继续围绕“筛选表单卡片组 / 结果摘要条 / 表格容器”做进一步拆分

**下一步**：

1. 继续推进 `P3-01`：拆 workspace 结果摘要条或筛选表单卡片组
2. 继续推进 `P3-02`：继续收口 `license-service` 领域编排职责
3. 继续推进 `P3-05 / P4-04`：补更多 dashboard 内容组件回归并同步文档

---

### 2026-03-25 / Iteration 38

**目标**：继续推进 `P3-01`，把 dashboard 结果页顶部重复的摘要条收口成统一组件，减少结果区样板结构并统一信息条容器语义。

**已完成**：

- [x] 新增通用 `DashboardSummaryStrip`
- [x] 激活码结果页 / 消费日志结果页的顶部摘要条已统一复用
- [x] 新增组件级回归测试并通过全量门禁

**本轮落地内容**：

1. `src/components/dashboard-summary-strip.tsx`
   - 新增 dashboard 结果页摘要条组件
   - 收口字段：
     - `leading`
     - `trailing`
     - `className`
     - `contentClassName`
2. `src/app/admin/dashboard/page.tsx`
   - 激活码结果页顶部摘要条改为 `DashboardSummaryStrip`
   - 消费日志结果页顶部摘要条改为 `DashboardSummaryStrip`
   - 统一结果页“左侧筛选摘要 + 右侧记录统计”的布局承载方式
3. `tests/dashboard-summary-strip.test.ts`
   - 锁定：
     - 默认容器样式
     - 左右 slot 渲染
     - 自定义外层 / 内层样式覆盖

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/dashboard-summary-strip.test.ts"` ❌（组件不存在，`MODULE_NOT_FOUND`）
2. GREEN：
   - `node --import tsx --test "tests/dashboard-summary-strip.test.ts"` ✅
   - `node --import tsx --test "tests/dashboard-summary-strip.test.ts" "tests/dashboard-token-list.test.ts" "tests/dashboard-section-header.test.ts" "tests/workspace-hero-panel.test.ts" "tests/workspace-metric-card.test.ts" "tests/workspace-tab-nav.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅
4. 当前质量结果：
   - 全量测试：**220 / 220** ✅
   - 行覆盖率：**91.66%** ✅
   - 分支覆盖率：**87.18%** ✅
   - 函数覆盖率：**93.51%** ✅

**备注**：

- dashboard 可复用基础设施已继续扩展为：
  - `WorkspaceHeroPanel`
  - `WorkspaceTabNav`
  - `WorkspaceMetricCard`
  - `DashboardSectionHeader`
  - `DashboardTokenList`
  - `DashboardSummaryStrip`
- 这一轮的收益重点在**结构边界清晰化**而不只是机械压缩行数；虽然组件接线后页面文件仍维持在约 **4013 行**，但“结果摘要条”已具备明确的复用入口，后续继续拆“表格容器 / 分页条 / 筛选卡组”会更顺滑

**下一步**：

1. 继续推进 `P3-01`：拆表格容器或分页条
2. 继续推进 `P3-02`：继续收口 `license-service` 领域编排职责
3. 继续推进 `P3-05 / P4-04`：补更多 dashboard 内容组件回归并同步文档

---

### 2026-03-25 / Iteration 39

**目标**：继续推进 `P3-01`，把 dashboard 结果区重复的分页条收口成统一组件，减少三处分页样板并统一分页交互骨架。

**已完成**：

- [x] 新增通用 `DashboardPaginationBar`
- [x] 项目列表 / 激活码结果 / 消费日志结果的 3 处分页条已统一复用
- [x] 新增组件级回归测试并通过全量门禁

**本轮落地内容**：

1. `src/components/dashboard-pagination-bar.tsx`
   - 新增 dashboard 分页条组件
   - 收口字段：
     - `currentPage`
     - `totalPages`
     - `summary`
     - `onPageChange`
     - `buttonClassName`
     - `activeButtonClassName`
     - `className`
   - 当 `totalPages <= 1` 时直接不渲染
2. `src/app/admin/dashboard/page.tsx`
   - 项目列表分页改为 `DashboardPaginationBar`
   - 激活码结果分页改为 `DashboardPaginationBar`
   - 消费日志结果分页改为 `DashboardPaginationBar`
   - 页面文件进一步从 **4013 行** 收缩到 **3930 行**
3. `tests/dashboard-pagination-bar.test.ts`
   - 锁定：
     - 摘要文案
     - 上一页 / 下一页 / 页码按钮渲染
     - 激活页码样式
     - 边界 disabled 状态
     - `totalPages <= 1` 不渲染

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/dashboard-pagination-bar.test.ts"` ❌（组件不存在，`MODULE_NOT_FOUND`）
2. GREEN：
   - `node --import tsx --test "tests/dashboard-pagination-bar.test.ts"` ✅
   - `node --import tsx --test "tests/dashboard-pagination-bar.test.ts" "tests/dashboard-summary-strip.test.ts" "tests/dashboard-token-list.test.ts" "tests/dashboard-section-header.test.ts" "tests/workspace-hero-panel.test.ts" "tests/workspace-metric-card.test.ts" "tests/workspace-tab-nav.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅
4. 当前质量结果：
   - 全量测试：**223 / 223** ✅
   - 行覆盖率：**91.71%** ✅
   - 分支覆盖率：**87.17%** ✅
   - 函数覆盖率：**93.59%** ✅

**备注**：

- dashboard 当前已形成的 UI 基础设施：
  - `WorkspaceHeroPanel`
  - `WorkspaceTabNav`
  - `WorkspaceMetricCard`
  - `DashboardSectionHeader`
  - `DashboardTokenList`
  - `DashboardSummaryStrip`
  - `DashboardPaginationBar`
- 当前可继续优先拆分的区域，已经从“大块页面”进一步收敛到“表格容器 / 空状态 / 筛选卡组”三个清晰切面

**下一步**：

1. 继续推进 `P3-01`：拆表格容器或空状态区块
2. 继续推进 `P3-02`：继续收口 `license-service` 领域编排职责
3. 继续推进 `P3-05 / P4-04`：补更多 dashboard 内容组件回归并同步文档

---

### 2026-03-25 / Iteration 40

**目标**：继续推进 `P3-01`，把 dashboard 结果区重复的空状态提示收口成统一组件，减少提示样板并统一结果页的空列表反馈。

**已完成**：

- [x] 新增通用 `DashboardEmptyState`
- [x] 激活码结果页 / 消费日志结果页的空状态提示已统一复用
- [x] 新增组件级回归测试并通过全量门禁

**本轮落地内容**：

1. `src/components/dashboard-empty-state.tsx`
   - 新增 dashboard 空状态组件
   - 收口字段：
     - `message`
     - `className`
2. `src/app/admin/dashboard/page.tsx`
   - 激活码结果空状态改为 `DashboardEmptyState`
   - 消费日志结果空状态改为 `DashboardEmptyState`
   - 清理已失效的页面级 `emptyStateClassName`
   - 页面文件在继续整理后维持在 **3931 行**
3. `tests/dashboard-empty-state.test.ts`
   - 锁定：
     - 默认空状态样式
     - 文案渲染
     - 自定义 `className` 追加

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/dashboard-empty-state.test.ts"` ❌（组件不存在，`MODULE_NOT_FOUND`）
2. GREEN：
   - `node --import tsx --test "tests/dashboard-empty-state.test.ts"` ✅
   - `node --import tsx --test "tests/dashboard-empty-state.test.ts" "tests/dashboard-pagination-bar.test.ts" "tests/dashboard-summary-strip.test.ts" "tests/dashboard-token-list.test.ts" "tests/dashboard-section-header.test.ts" "tests/workspace-hero-panel.test.ts" "tests/workspace-metric-card.test.ts" "tests/workspace-tab-nav.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅
4. 当前质量结果：
   - 全量测试：**225 / 225** ✅
   - 行覆盖率：**91.73%** ✅
   - 分支覆盖率：**87.26%** ✅
   - 函数覆盖率：**93.64%** ✅

**备注**：

- dashboard 当前已形成的 UI 基础设施：
  - `WorkspaceHeroPanel`
  - `WorkspaceTabNav`
  - `WorkspaceMetricCard`
  - `DashboardSectionHeader`
  - `DashboardTokenList`
  - `DashboardSummaryStrip`
  - `DashboardPaginationBar`
  - `DashboardEmptyState`
- 结果区现在已经具备“头部 / 摘要 / 分页 / 空状态”四类明确的复用边界，后续继续拆表格容器时会明显更顺滑

**下一步**：

1. 继续推进 `P3-01`：拆表格容器或筛选卡组
2. 继续推进 `P3-02`：继续收口 `license-service` 领域编排职责
3. 继续推进 `P3-05 / P4-04`：补更多 dashboard 内容组件回归并同步文档

---

### 2026-03-25 / Iteration 41

**目标**：继续推进 `P3-01`，把 dashboard 多处重复的表格外层容器收口成统一组件，进一步减少结果区表格样板并统一视觉骨架。

**已完成**：

- [x] 新增通用 `DashboardTableContainer`
- [x] 项目列表 / 本次生成激活码 / 激活码结果 / 消费日志结果的 4 处表格外壳已统一复用
- [x] 清理页面级 `tableContainerClassName`

**本轮落地内容**：

1. `src/components/dashboard-table-container.tsx`
   - 新增 dashboard 表格容器组件
   - 收口字段：
     - `children`
     - `className`
2. `src/app/admin/dashboard/page.tsx`
   - 项目列表表格改为 `DashboardTableContainer`
   - 本次生成激活码表格改为 `DashboardTableContainer`
   - 激活码结果表格改为 `DashboardTableContainer`
   - 消费日志结果表格改为 `DashboardTableContainer`
3. `tests/dashboard-table-container.test.ts`
   - 锁定：
     - 默认表格容器样式
     - 子节点渲染
     - 自定义 `className` 覆盖

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/dashboard-table-container.test.ts"` ❌（组件不存在，`MODULE_NOT_FOUND`）
2. GREEN：
   - `node --import tsx --test "tests/dashboard-table-container.test.ts"` ✅
   - `node --import tsx --test "tests/dashboard-table-container.test.ts" "tests/dashboard-empty-state.test.ts" "tests/dashboard-pagination-bar.test.ts" "tests/dashboard-summary-strip.test.ts" "tests/dashboard-token-list.test.ts" "tests/dashboard-section-header.test.ts" "tests/workspace-hero-panel.test.ts" "tests/workspace-metric-card.test.ts" "tests/workspace-tab-nav.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅

**备注**：

- 结果区当前已形成“头部 / 摘要 / 表格容器 / 分页 / 空状态”的稳定复用边界
- 后续继续拆筛选卡组和加载态时，不再需要在页面里重复维护表格外层阴影与圆角样式

**下一步**：

1. 继续推进 `P3-01`：拆筛选卡组或加载态区块
2. 继续推进 `P3-02`：继续收口 `license-service` 领域编排职责
3. 继续推进 `P3-05 / P4-04`：补更多 dashboard 内容组件回归并同步文档

---

### 2026-03-25 / Iteration 42

**目标**：继续推进 `P3-01`，把 dashboard 筛选工作区中重复的字段卡片与结果页加载区块收口成统一组件，进一步统一输入表单视觉语义与加载反馈。

**已完成**：

- [x] 新增通用 `DashboardFilterFieldCard`
- [x] 新增通用 `DashboardLoadingState`
- [x] 激活码 / 消费日志工作区的 10 个筛选卡片已统一复用
- [x] 激活码结果页 / 消费日志结果页的加载态已统一复用

**本轮落地内容**：

1. `src/components/dashboard-filter-field-card.tsx`
   - 新增 dashboard 筛选字段卡片组件
   - 收口字段：
     - `label`
     - `description`
     - `children`
     - `htmlFor`
     - `className`
     - `bodyClassName`
   - 在未提供 `htmlFor` 时退化为纯展示标题，避免对非表单按钮使用无意义的 label 语义
2. `src/components/dashboard-loading-state.tsx`
   - 新增 dashboard 通用加载态组件
   - 收口字段：
     - `message`
     - `className`
3. `src/app/admin/dashboard/page.tsx`
   - 激活码筛选区的搜索 / 状态 / 项目 / 套餐 / 导出卡片改为 `DashboardFilterFieldCard`
   - 消费日志筛选区的搜索 / 项目 / 时间范围 / 刷新卡片改为 `DashboardFilterFieldCard`
   - 为筛选控件补充 `id` 与 `htmlFor` 关联，改善语义一致性
   - 激活码结果页与消费日志结果页 loading block 改为 `DashboardLoadingState`
   - 页面文件当前维持在 **3950 行**，虽然增加了显式语义属性，但重复 UI 样板继续收口
4. `tests/dashboard-filter-field-card.test.ts`
   - 锁定：
     - 默认卡片样式
     - 标题 / 描述 / 内容区渲染
     - `htmlFor` 透传
     - 自定义卡片 / 内容区样式覆盖
5. `tests/dashboard-loading-state.test.ts`
   - 锁定：
     - 默认加载态容器样式
     - 旋转指示器渲染
     - 文案渲染
     - 自定义 `className` 覆盖

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/dashboard-filter-field-card.test.ts"` ❌（组件不存在，`MODULE_NOT_FOUND`）
   - `node --import tsx --test "tests/dashboard-loading-state.test.ts"` ❌（组件不存在，`MODULE_NOT_FOUND`）
2. GREEN：
   - `node --import tsx --test "tests/dashboard-loading-state.test.ts" "tests/dashboard-filter-field-card.test.ts" "tests/dashboard-table-container.test.ts" "tests/dashboard-empty-state.test.ts" "tests/dashboard-pagination-bar.test.ts" "tests/dashboard-summary-strip.test.ts" "tests/dashboard-token-list.test.ts" "tests/dashboard-section-header.test.ts" "tests/workspace-hero-panel.test.ts" "tests/workspace-metric-card.test.ts" "tests/workspace-tab-nav.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅
4. 当前质量结果：
   - 全量测试：**231 / 231** ✅
   - 行覆盖率：**91.79%** ✅
   - 分支覆盖率：**87.44%** ✅
   - 函数覆盖率：**93.79%** ✅

**备注**：

- dashboard 当前已形成的 UI 基础设施：
  - `WorkspaceHeroPanel`
  - `WorkspaceTabNav`
  - `WorkspaceMetricCard`
  - `DashboardSectionHeader`
  - `DashboardTokenList`
  - `DashboardSummaryStrip`
  - `DashboardPaginationBar`
  - `DashboardEmptyState`
  - `DashboardTableContainer`
  - `DashboardFilterFieldCard`
  - `DashboardLoadingState`
- 这一轮的重点不是机械压缩总代码行，而是把“重复的表单壳层 / 结果加载反馈”真正抽成稳定组件，并顺手补上更明确的表单关联语义

**下一步**：

1. 继续推进 `P3-01`：拆表格 head / body 骨架或统计筛选卡组
2. 继续推进 `P3-02`：继续收口 `license-service` 领域编排职责
3. 继续推进 `P3-05 / P4-04`：补更多 dashboard 内容组件回归并同步文档

---

### 2026-03-25 / Iteration 43

**目标**：继续推进 `P3-01`，把 dashboard 各工作区重复的表格 head / body / header-cell 骨架收口成统一组件，进一步压缩页面样板并统一表格语义。

**已完成**：

- [x] 新增通用 `DashboardDataTable`
- [x] 项目统计 / 项目管理 / 本次生成激活码 / 激活码结果 / 消费日志结果的 5 张表格已统一复用
- [x] dashboard 页面移除对 `DashboardTableContainer` 的直接拼装依赖，改为通过高层表格组件收口

**本轮落地内容**：

1. `src/components/dashboard-data-table.tsx`
   - 新增 dashboard 通用数据表格组件
   - 复用 `DashboardTableContainer` 作为底层外壳
   - 收口字段：
     - `headers`
     - `children`
     - `containerClassName`
     - `tableClassName`
     - `headClassName`
     - `bodyClassName`
     - `headerCellClassName`
2. `src/app/admin/dashboard/page.tsx`
   - 项目统计表格改为 `DashboardDataTable`
   - 项目管理表格改为 `DashboardDataTable`
   - 本次生成激活码表格改为 `DashboardDataTable`
   - 激活码结果表格改为 `DashboardDataTable`
   - 消费日志结果表格改为 `DashboardDataTable`
   - 页面文件进一步从 **3950 行** 收缩到 **3863 行**
3. `tests/dashboard-data-table.test.ts`
   - 锁定：
     - 默认表格容器样式
     - 表头渲染
     - `tbody` 内容透传
     - 自定义容器 / `thead` / `tbody` / `th` 样式覆盖

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/dashboard-data-table.test.ts"` ❌（组件不存在，`MODULE_NOT_FOUND`）
2. GREEN：
   - `node --import tsx --test "tests/dashboard-data-table.test.ts" "tests/dashboard-loading-state.test.ts" "tests/dashboard-filter-field-card.test.ts" "tests/dashboard-table-container.test.ts" "tests/dashboard-empty-state.test.ts" "tests/dashboard-pagination-bar.test.ts" "tests/dashboard-summary-strip.test.ts" "tests/dashboard-token-list.test.ts" "tests/dashboard-section-header.test.ts" "tests/workspace-hero-panel.test.ts" "tests/workspace-metric-card.test.ts" "tests/workspace-tab-nav.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` 待本轮完成后再次确认

**备注**：

- dashboard 当前的表格层次已变为：
  - `DashboardDataTable`
  - `DashboardTableContainer`
- 当前页面里仍可继续抽离的重复热点，已经进一步聚焦到：
  - 表格行级 badge / inline action 组合
  - 项目统计与生成页表单区块
  - 顶部统计 / 趋势区域中的信息卡片

**下一步**：

1. 继续推进 `P3-01`：拆表格行级 action / badge 组合或表单字段组
2. 继续推进 `P3-02`：继续收口 `license-service` 领域编排职责
3. 继续推进 `P3-05 / P4-04`：补更多 dashboard 内容组件回归并同步文档

---

### 2026-03-25 / Iteration 44

**目标**：继续推进 `P3-01`，把 dashboard 中重复的状态徽标与行内操作按钮收口成统一组件，进一步统一视觉语言并减少页面内零散样板。

**已完成**：

- [x] 新增通用 `DashboardStatusBadge`
- [x] 新增通用 `DashboardInlineActionButton`
- [x] 项目统计 / 项目管理 / 激活码状态展示已统一复用状态徽标组件
- [x] 项目管理 / 发码结果 / 激活码结果中的行内复制 / 删除 / 保存动作已统一复用行内按钮组件

**本轮落地内容**：

1. `src/components/dashboard-status-badge.tsx`
   - 新增 dashboard 状态徽标组件
   - 收口字段：
     - `label`
     - `tone`
     - `className`
   - 统一支持：
     - `success`
     - `neutral`
     - `warning`
     - `danger`
     - `info`
2. `src/components/dashboard-inline-action-button.tsx`
   - 新增 dashboard 行内操作按钮组件
   - 收口字段：
     - 原生 `button` 属性透传
     - `children`
     - `className`
   - 默认 `type="button"`，避免表格内按钮意外触发表单提交
3. `src/app/admin/dashboard/page.tsx`
   - `getStatusBadge` 改为复用 `DashboardStatusBadge`
   - 项目统计表与项目管理表的项目状态展示改为复用 `DashboardStatusBadge`
   - 项目标识复制、项目保存/启停/删除、发码结果复制、激活码结果复制/删除改为复用 `DashboardInlineActionButton`
   - 清理页面级 `inlineActionButtonClassName`
   - 页面文件进一步从 **3863 行** 收缩到 **3858 行**
4. `tests/dashboard-status-badge.test.ts`
   - 锁定：
     - tone 对应默认样式
     - 自定义 `className` 覆盖
5. `tests/dashboard-inline-action-button.test.ts`
   - 锁定：
     - 默认 `type="button"`
     - 默认按钮样式
     - `disabled` 与自定义 `className` 透传

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/dashboard-status-badge.test.ts" "tests/dashboard-inline-action-button.test.ts"` ❌（组件不存在，`MODULE_NOT_FOUND`）
2. GREEN：
   - `node --import tsx --test "tests/dashboard-status-badge.test.ts" "tests/dashboard-inline-action-button.test.ts" "tests/dashboard-data-table.test.ts" "tests/dashboard-loading-state.test.ts" "tests/dashboard-filter-field-card.test.ts" "tests/dashboard-table-container.test.ts" "tests/dashboard-empty-state.test.ts" "tests/dashboard-pagination-bar.test.ts" "tests/dashboard-summary-strip.test.ts" "tests/dashboard-token-list.test.ts" "tests/dashboard-section-header.test.ts" "tests/workspace-hero-panel.test.ts" "tests/workspace-metric-card.test.ts" "tests/workspace-tab-nav.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` 待本轮完成后再次确认

**备注**：

- dashboard 当前已形成的可复用 UI 基础设施继续扩展为：
  - `DashboardDataTable`
  - `DashboardStatusBadge`
  - `DashboardInlineActionButton`
- 这一轮的重点是把“颜色语义”和“按钮触发表现”沉到组件层，减少页面里散落的 class 细节

**下一步**：

1. 继续推进 `P3-01`：拆项目创建 / 发码表单字段组，继续压 dashboard 大页面
2. 继续推进 `P3-02`：继续收口 `license-service` 领域编排职责
3. 继续推进 `P3-05 / P4-04`：补更多 dashboard 内容组件回归并同步文档

---

### 2026-03-25 / Iteration 45

**目标**：继续推进 `P3-01`，把项目创建、项目筛选与发码页里重复的表单字段结构进一步收口，统一表单语义与字段壳层。

**已完成**：

- [x] 新增通用 `DashboardFormField`
- [x] 新建项目工作区 3 张字段卡片已改为复用 `DashboardFilterFieldCard`
- [x] 项目管理筛选区与发码页表单的多处 label + control 样板已改为复用 `DashboardFormField`

**本轮落地内容**：

1. `src/components/dashboard-form-field.tsx`
   - 新增 dashboard 轻量字段组件
   - 收口字段：
     - `label`
     - `children`
     - `description`
     - `htmlFor`
     - `className`
     - `labelClassName`
     - `descriptionClassName`
     - `bodyClassName`
2. `src/app/admin/dashboard/page.tsx`
   - 新建项目中的：
     - 项目名称
     - 项目标识
     - 项目描述
     改为复用 `DashboardFilterFieldCard`
   - 项目管理筛选区中的：
     - 搜索项目
     - 状态筛选
     - 排序方式
     改为复用 `DashboardFormField`
   - 发码页中的：
     - 所属项目
     - 授权类型
     - 生成数量
     - 套餐类型
     - 有效期（天）
     - 总次数
     改为复用 `DashboardFormField`
   - 为相关字段补充 `id / htmlFor` 关联，统一语义结构
   - 页面文件当前为 **3870 行**；虽然为了表单语义和复用入口略有回弹，但重复结构边界更清晰
3. `tests/dashboard-form-field.test.ts`
   - 锁定：
     - 默认 label / description / body 渲染
     - `htmlFor` 透传
     - 容器 / label / body 自定义样式覆盖

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/dashboard-form-field.test.ts"` ❌（组件不存在，`MODULE_NOT_FOUND`）
2. GREEN：
   - `node --import tsx --test "tests/dashboard-form-field.test.ts" "tests/dashboard-status-badge.test.ts" "tests/dashboard-inline-action-button.test.ts" "tests/dashboard-data-table.test.ts" "tests/dashboard-loading-state.test.ts" "tests/dashboard-filter-field-card.test.ts" "tests/dashboard-table-container.test.ts" "tests/dashboard-empty-state.test.ts" "tests/dashboard-pagination-bar.test.ts" "tests/dashboard-summary-strip.test.ts" "tests/dashboard-token-list.test.ts" "tests/dashboard-section-header.test.ts" "tests/workspace-hero-panel.test.ts" "tests/workspace-metric-card.test.ts" "tests/workspace-tab-nav.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` 待本轮完成后再次确认

**备注**：

- 当前 dashboard 表单层已形成两级复用：
  - 卡片型字段：`DashboardFilterFieldCard`
  - 轻量字段：`DashboardFormField`
- 这轮重点不是单纯追求行数下降，而是把“字段语义 + label/for 关联 + 描述文案”沉成稳定基础设施

**下一步**：

1. 继续推进 `P3-01`：拆项目创建行动卡 / 发码提交区，继续压 dashboard 大页面
2. 继续推进 `P3-02`：继续收口 `license-service` 领域编排职责
3. 继续推进 `P3-05 / P4-04`：补更多 dashboard 内容组件回归并同步文档

---

### 2026-03-25 / Iteration 46

**目标**：继续推进 `P3-01`，把 dashboard 中重复出现的深色行动卡与发码提交区收口为可复用组件，并用提交级门禁验证整体稳定性。

**已完成**：

- [x] 新增通用 `DashboardActionPanel`
- [x] 新增通用 `DashboardSubmitField`
- [x] 项目创建 / 修改密码 / 系统配置保存的深色 CTA 面板已接入统一组件
- [x] 发码页 TIME / COUNT 两种模式的提交区已接入统一组件
- [x] 完成新增组件的 TDD 与全量质量门禁

**本轮落地内容**：

1. `src/components/dashboard-action-panel.tsx`
   - 新增 dashboard 深色行动卡组件
   - 收口内容：
     - `badge`
     - `title`
     - `description`
     - `action`
     - `children`
     - `background`
     - 外层 / 内层 / 文案样式覆盖入口
   - 既能承载标准暗色 CTA，也能兼容系统配置页带背景光斑和统计 chips 的增强卡片
2. `src/components/dashboard-submit-field.tsx`
   - 新增 dashboard 表单提交槽组件
   - 收口内容：
     - `idleText`
     - `loadingText`
     - `loading`
     - `buttonClassName`
     - `type`
     - 提交禁用态与 `w-full` 按钮壳层
3. `src/app/admin/dashboard/page.tsx`
   - 项目创建区底部行动卡改为复用 `DashboardActionPanel`
   - 修改密码区底部行动卡改为复用 `DashboardActionPanel`
   - 系统配置区保存行动卡改为复用 `DashboardActionPanel`
   - 发码页时间型 / 次数型提交区改为复用 `DashboardSubmitField`
   - 页面文件进一步从 **3870 行** 收缩到 **3853 行**
4. `tests/dashboard-action-panel.test.ts`
   - 锁定：
     - 默认暗色行动卡结构
     - 标题 / 描述 / 操作区渲染
     - 自定义样式覆盖
     - 背景层插槽
5. `tests/dashboard-submit-field.test.ts`
   - 锁定：
     - 默认提交槽结构
     - `loading` 时文案切换与禁用
     - 按钮类型透传
     - 自定义容器 / 按钮样式覆盖

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/dashboard-action-panel.test.ts" "tests/dashboard-submit-field.test.ts"` ❌（组件不存在，`MODULE_NOT_FOUND`）
2. GREEN：
   - `node --import tsx --test "tests/dashboard-action-panel.test.ts" "tests/dashboard-submit-field.test.ts" "tests/dashboard-form-field.test.ts"` ✅
   - 修复 `DashboardSubmitField` 的 `loading` 类型遗漏后，再次执行聚焦测试 ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅
   - 全量测试：**243 / 243** ✅
   - 覆盖率：
     - 行覆盖率：**91.97%**
     - 分支覆盖率：**87.30%**
     - 函数覆盖率：**94.08%**

**备注**：

- 当前 dashboard 结构化复用基础设施继续扩展为：
  - `DashboardActionPanel`
  - `DashboardSubmitField`
- 这轮重点不是新增视觉层，而是把“高频 CTA 结构 + 提交位语义”沉到组件层，减少页面内重复布局与状态切换样板
- 本轮在 build 阶段捕获了 `loading` 自定义属性缺少类型声明的问题，已修复并重新通过全量门禁

**下一步**：

1. 继续推进 `P3-01`：拆项目管理表格中的行级编辑块（名称 / 描述 / projectKey 操作）
2. 继续推进 `P3-02`：继续收口 `license-service` 领域编排职责
3. 继续推进 `P3-05 / P4-04`：围绕 API 文档工作区与设置工作区补更多 UI 回归测试和视觉一致性治理

---

### 2026-03-25 / Iteration 47

**目标**：继续推进 `P3-01`，把项目管理表格中的行级编辑块沉到组件层，进一步压缩 dashboard 大页面并统一项目编辑行语义。

**已完成**：

- [x] 新增 `DashboardProjectManagementRow`
- [x] 项目管理表格的名称编辑 / 描述编辑 / 状态 / 操作区已接入统一行组件
- [x] 完成新组件 TDD，并继续验证 dashboard 组件体系稳定性

**本轮落地内容**：

1. `src/components/dashboard-project-management-row.tsx`
   - 新增项目管理表格行组件
   - 收口内容：
     - 项目名称编辑输入
     - 默认项目固定提示
     - projectKey 展示与复制操作
     - 描述编辑输入
     - 状态徽标
     - 保存名称 / 保存描述 / 启停 / 删除操作
   - 将默认项目与普通项目的差异行为集中到单一职责组件中
2. `src/app/admin/dashboard/page.tsx`
   - 项目管理表格 row 结构改为复用 `DashboardProjectManagementRow`
   - 页面文件进一步从 **3853 行** 收缩到 **3796 行**
3. `tests/dashboard-project-management-row.test.ts`
   - 锁定：
     - 默认项目的固定提示、受限操作与删除按钮隐藏
     - 普通项目的可编辑字段、状态与删除操作

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/dashboard-project-management-row.test.ts"` ❌（组件不存在，`MODULE_NOT_FOUND`）
2. GREEN：
   - `node --import tsx --test "tests/dashboard-project-management-row.test.ts" "tests/dashboard-action-panel.test.ts" "tests/dashboard-submit-field.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅
   - 全量测试：**245 / 245** ✅
   - 覆盖率：
     - 行覆盖率：**92.06%**
     - 分支覆盖率：**87.30%**
     - 函数覆盖率：**93.97%**

**备注**：

- 这轮继续遵循 **KISS / DRY**：没有把项目管理区抽成过大的复杂容器，只把“单行编辑职责”下沉为稳定边界
- `DashboardProjectManagementRow` 与既有的 `DashboardInlineActionButton`、`DashboardStatusBadge` 组合使用，保持基础设施分层清晰

**下一步**：

1. 继续推进 `P3-02`：收口 `license-service` 领域编排职责
2. 继续推进 `P3-01`：梳理设置 / API 文档工作区中仍然偏长的内容块
3. 继续推进 `P3-05 / P4-04`：围绕新增行组件补更多组合级回归测试

---

### 2026-03-25 / Iteration 48

**目标**：继续推进 `P3-02`，把 `license-service` 中重复的“输入标准化 + project 解析 + 缺参短路”收口为独立服务，降低聚合服务的编排噪音。

**已完成**：

- [x] 新增 `license-command-context-service`
- [x] `license-service` 已改为复用统一命令上下文解析
- [x] 为新服务补充独立单测，并验证未改变现有激活 / 消费行为

**本轮落地内容**：

1. `src/lib/license-command-context-service.ts`
   - 新增命令上下文服务
   - 收口能力：
     - `resolveLicenseActionCommandContext`
     - `resolveConsumeLicenseCommandContext`
   - 统一处理：
     - 输入 trim / 标准化
     - 缺参短路
     - 项目解析
     - consume 幂等请求上下文构建
2. `src/lib/license-service.ts`
   - `getLicenseStatus`
   - `activateLicense`
   - `consumeLicense`
   统一改为复用命令上下文服务，减少重复的参数预处理与 project 解析逻辑
3. `tests/license-command-context-service.test.ts`
   - 锁定：
     - 缺参时直接返回统一结果且不查项目
     - 标准化输入后解析默认/目标项目上下文
     - consume 请求上下文与 requestId 标准化

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/license-command-context-service.test.ts"` ❌（模块不存在，`MODULE_NOT_FOUND`）
2. GREEN：
   - `node --import tsx --test "tests/license-command-context-service.test.ts" "tests/license-service.test.ts"` ✅
   - 修复 `license-service.ts` 中类型导入与无用导入后，再次执行聚焦测试 ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅
   - 全量测试：**248 / 248** ✅
   - 覆盖率：
     - 行覆盖率：**92.17%**
     - 分支覆盖率：**87.36%**
     - 函数覆盖率：**94.02%**

**备注**：

- 这轮重构遵循 **KISS / DRY / YAGNI**：
  - 只收口真实重复的参数预处理链路
  - 没有引入额外 facade / 过深抽象
  - 保持 `license-service` 继续承担“领域入口编排”，而把命令上下文准备下沉
- 当前 `license-service` 的职责边界更清晰：
  - 参数上下文准备 -> `license-command-context-service`
  - 事务前置检查 -> `license-transaction-preparation-service`
  - 激活 / 消费流程 -> 各自 flow service

**下一步**：

1. 继续推进 `P3-02`：继续检查 `license-route-handlers` / `license-api` 是否还能进一步统一错误映射与 handler 装配
2. 继续推进 `P3-01`：梳理设置页与 API 文档工作区里仍偏长的内容块
3. 继续推进 `P3-05 / P4-04`：补更多组合级回归测试，特别是文档工作区与设置工作区

---

### 2026-03-25 / Iteration 49

**目标**：继续推进 `P3-02`，把 `license-route-handlers` 中重复的 handler 装配收口为统一工厂，降低路由层样板代码和响应分支噪音。

**已完成**：

- [x] 新增 `createLicenseRouteHandler`
- [x] 激活 / 消费 / 状态 / verify 四个路由处理器已改为复用统一工厂
- [x] 补充工厂级测试并与现有 API 路由回归联动验证

**本轮落地内容**：

1. `src/lib/license-route-handlers.ts`
   - 新增：
     - `LicenseRouteRequestParams`
     - `createLicenseRouteHandler`
   - 统一收口：
     - 请求体读取
     - service 装配
     - legacy / 正式响应切换
     - 错误映射
   - `handleActivateLicenseRequest`
   - `handleConsumeLicenseRequest`
   - `handleLicenseStatusRequest`
   - `handleVerifyLicenseRequest`
     全部改为基于工厂生成
2. `tests/license-route-handler-factory.test.ts`
   - 锁定：
     - 请求体标准化与正式字段输出
     - `legacyOnly` 模式仅输出兼容字段
     - service 抛出 `Error` 时的统一错误响应

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/license-route-handler-factory.test.ts"` ❌（`createLicenseRouteHandler is not a function`）
2. GREEN：
   - `node --import tsx --test "tests/license-route-handler-factory.test.ts" "tests/license-api-routes.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅
   - 全量测试：**251 / 251** ✅
   - 覆盖率：
     - 行覆盖率：**92.25%**
     - 分支覆盖率：**87.48%**
     - 函数覆盖率：**94.11%**

**备注**：

- 这轮继续遵循 **DRY / KISS**：
  - 没有改变 API 行为，只消除重复的装配样板
  - route handler 继续保持薄层，只负责 request/response 边界
- 当前 license 路由入口职责进一步清晰：
  - request 解析 / response 映射 -> `license-api`
  - handler 装配 -> `createLicenseRouteHandler`
  - 业务执行 -> `license-service`

**下一步**：

1. 继续推进 `P3-01`：梳理设置页与 API 文档工作区仍偏长的内容块
2. 继续推进 `P3-05 / P4-04`：补文档工作区 / 设置工作区更高层级组合回归测试
3. 继续推进 `P3-02`：检查 `license-api` 是否还需要进一步拆出 request/response adapter 单测入口

---

## 8. 文档维护约定

后续每次推进，请同步更新：

1. 任务状态（TODO / IN_PROGRESS / DONE / BLOCKED）
2. 对应验收标准
3. 已做验证
4. 是否引入新的后续任务

---

### 2026-03-25 / Iteration 50

**目标**：继续推进 `P3-01`，把设置页与 API 文档页重复出现的摘要卡、编号提示卡、小型指标卡收口为统一组件，进一步统一 UI 语义与页面质感。

**已完成**：

- [x] 新增统一摘要卡组件 `DashboardSummaryCard`
- [x] 新增统一编号提示列表组件 `DashboardNumberedList`
- [x] 新增统一小型指标卡组件 `DashboardStatTile`
- [x] 改密页、系统配置页、API 文档页已接入新组件
- [x] 补充 3 组组件级测试，并完成提交视角门禁验证

**本轮落地内容**：

1. `src/components/dashboard-summary-card.tsx`
   - 统一摘要卡结构：顶部强调线 / 标签 / 数值 / 描述
   - 支持覆写 panel / accent / value / description 样式
2. `src/components/dashboard-numbered-list.tsx`
   - 统一“01 / 02 / 03”编号提示块
   - 支持覆写容器、条目、编号与自定义编号渲染
3. `src/components/dashboard-stat-tile.tsx`
   - 统一小型统计卡结构：label / value / description
4. `src/app/admin/dashboard/page.tsx`
   - 改密页顶部摘要卡改为复用 `DashboardSummaryCard`
   - 改密页“修改后行为”提示区改为复用 `DashboardNumberedList`
   - 改密页“自动登出 / 最低长度”改为复用 `DashboardStatTile`
   - 系统配置页顶部摘要卡改为复用 `DashboardSummaryCard`
   - 系统配置页“变更前提示”改为复用 `DashboardNumberedList`
   - 系统配置页“敏感项 / 白名单地址”改为复用 `DashboardStatTile`
5. `src/components/api-docs-workspace.tsx`
   - 顶部摘要卡改为复用 `DashboardSummaryCard`
6. 新增测试：
   - `tests/dashboard-summary-card.test.ts`
   - `tests/dashboard-numbered-list.test.ts`
   - `tests/dashboard-stat-tile.test.ts`

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/dashboard-summary-card.test.ts" "tests/dashboard-numbered-list.test.ts" "tests/dashboard-stat-tile.test.ts"` ❌（3 个模块均不存在，`MODULE_NOT_FOUND`）
2. GREEN：
   - `node --import tsx --test "tests/dashboard-summary-card.test.ts" "tests/dashboard-numbered-list.test.ts" "tests/dashboard-stat-tile.test.ts" "tests/public-pages.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅
   - 全量测试：**261 / 261** ✅
   - 覆盖率：
     - 行覆盖率：**92.43%**
     - 分支覆盖率：**87.55%**
     - 函数覆盖率：**94.26%**

**备注**：

- 本轮继续遵循 **KISS / DRY / YAGNI**：
  - 只抽离已在多处重复出现、且视觉语义明确的 3 类高频结构
  - 没有引入复杂主题系统或过度参数化组件
  - 先保障“统一、可复用、易测试”，再考虑更深层抽象
- 页面收益：
  - 设置页与 API 文档页的核心信息块视觉更统一
  - 后续继续治理代码示例块、设置项卡片时有了稳定基础组件

**下一步**：

1. 继续推进 `P3-01`：收口 API 文档页里的代码示例卡 / 请求响应示例块
2. 继续推进 `P3-05 / P4-04`：补设置页 / API 文档页更高层组合回归测试
3. 继续推进设置页结构治理：评估系统配置分组是否进一步切成工作区级 tab，缩短单屏长度

---

### 2026-03-25 / Iteration 51

**目标**：继续推进 `P3-01`，把 API 文档页中重复出现的“标题区 + 操作按钮 + 代码块”结构收口为统一代码展示组件，减少请求示例、响应示例与多语言示例的样板代码。

**已完成**：

- [x] 新增统一代码展示组件 `DashboardCodePanel`
- [x] API 文档页请求示例 / 响应示例 / 多语言示例已接入新组件
- [x] 补充组件级测试并完成提交视角门禁验证

**本轮落地内容**：

1. `src/components/dashboard-code-panel.tsx`
   - 统一代码展示面板结构：header / action / code block
   - 支持覆写面板、头部布局、头部内容区与代码块样式
2. `src/components/api-docs-workspace.tsx`
   - endpoints tab 中的“请求示例 / 响应示例”改为复用 `DashboardCodePanel`
   - examples tab 中的多语言示例卡改为复用 `DashboardCodePanel`
   - 移除工作区内部重复维护的代码块卡片样板结构
3. 新增测试：
   - `tests/dashboard-code-panel.test.ts`

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/dashboard-code-panel.test.ts"` ❌（模块不存在，`MODULE_NOT_FOUND`）
2. GREEN：
   - `node --import tsx --test "tests/dashboard-code-panel.test.ts" "tests/public-pages.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅
   - 全量测试：**263 / 263** ✅
   - 覆盖率：
     - 行覆盖率：**92.44%**
     - 分支覆盖率：**87.50%**
     - 函数覆盖率：**94.31%**

**备注**：

- 本轮继续遵循 **KISS / DRY / YAGNI**：
  - 只抽离已在 API 文档页中高频重复的代码展示骨架
  - 没有引入额外复制逻辑抽象或文档 DSL
  - 保留页面现有语义，仅统一结构与视觉承载方式
- 页面收益：
  - API 文档的请求/响应/多语言示例视觉更统一
  - 后续若继续补 SDK 示例、调试命令块，可直接复用该组件

**下一步**：

1. 继续推进 `P3-05 / P4-04`：补 API 文档页更高层组合测试（endpoints / examples / admin tab）
2. 继续推进 `P3-01`：评估本地联调命令块与后台接口卡是否进一步统一为展示组件
3. 继续推进设置页长度治理：评估 systemConfig 分组 tab 化是否值得落地

---

### 2026-03-25 / Iteration 52

**目标**：继续推进 `P3-01`，把 API 文档工作区中剩余重复的“后台接口组卡”和“本地联调命令卡”拆成独立组件，进一步缩短 `ApiDocsWorkspace` 的单文件体积并统一卡片语义。

**已完成**：

- [x] 新增 `ApiDocsAdminGroupCard`
- [x] 新增 `ApiDocsDebugCommandCard`
- [x] API 文档页 admin tab 已接入新组件
- [x] 新增组件级测试并完成提交视角门禁验证

**本轮落地内容**：

1. `src/components/api-docs-admin-group-card.tsx`
   - 统一后台接口分组卡结构：title / description / endpoint list
   - 统一 endpoint method badge + path + description 展示骨架
   - 支持覆写容器、列表与条目样式
2. `src/components/api-docs-debug-command-card.tsx`
   - 基于 `DashboardCodePanel` 封装联调命令卡
   - 统一 title / description / command / copy button 呈现方式
   - 支持覆写面板、按钮和代码区样式
3. `src/components/api-docs-workspace.tsx`
   - admin tab 中“联调时常用的后台接口”改为复用 `ApiDocsAdminGroupCard`
   - admin tab 中“本地联调与排查辅助”改为复用 `ApiDocsDebugCommandCard`
4. 新增测试：
   - `tests/api-docs-admin-group-card.test.ts`
   - `tests/api-docs-debug-command-card.test.ts`

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/api-docs-admin-group-card.test.ts" "tests/api-docs-debug-command-card.test.ts"` ❌（模块不存在，`MODULE_NOT_FOUND`）
2. GREEN：
   - `node --import tsx --test "tests/api-docs-admin-group-card.test.ts" "tests/api-docs-debug-command-card.test.ts" "tests/public-pages.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅
   - 全量测试：**267 / 267** ✅
   - 覆盖率：
     - 行覆盖率：**92.79%**
     - 分支覆盖率：**87.42%**
     - 函数覆盖率：**94.39%**

**备注**：

- 本轮继续遵循 **KISS / DRY / YAGNI**：
  - 只拆已经重复且语义稳定的两类卡片
  - 没有引入新的全局主题抽象或复杂文档 schema
  - 继续以“页面结构变薄 + 组件边界清晰 + 测试可落地”为优先级
- 页面收益：
  - `ApiDocsWorkspace` 的 admin 区块更规整、重复样板继续减少
  - 联调命令卡与请求/响应代码卡在视觉与交互上更统一

**下一步**：

1. 继续推进 `P3-05 / P4-04`：补 API 文档工作区更高层的 tab 级组合测试
2. 继续推进设置页长度治理：评估 systemConfig 分组 tab 化是否值得落地
3. 继续检查 dashboard 主页是否还存在可继续下沉的局部重复块
### 2026-03-25 / Iteration 53

**目标**：继续推进 `P3-05 / P4-04`，为 API 文档工作区补上更高层的 tab 级组合回归，确保非默认 tab 在公开页与后台页都可稳定渲染。

**已完成**：

- [x] `ApiDocsWorkspace` 支持通过 `initialTab` 指定初始工作区
- [x] 新增 API 文档工作区 tab 级高层回归测试
- [x] 完成提交视角门禁验证

**本轮落地内容**：

1. `src/components/api-docs-workspace.tsx`
   - 新增 `initialTab?: ApiDocsWorkspaceTab`
   - 工作区初始状态改为由 `initialTab` 驱动，便于高层组合测试与后续复用
2. 新增测试：
   - `tests/api-docs-workspace-tabs.test.ts`
3. 测试覆盖新增场景：
   - `endpoints` 初始 tab
   - `examples` 初始 tab
   - `admin` 初始 tab

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/api-docs-workspace-tabs.test.ts"` ❌（组件尚不支持指定初始 tab）
2. GREEN：
   - `node --import tsx --test "tests/api-docs-workspace-tabs.test.ts" "tests/public-pages.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run quality:gate` ✅
   - 全量测试：**270 / 270** ✅
   - 覆盖率：
     - 行覆盖率：**94.74%**
     - 分支覆盖率：**87.59%**
     - 函数覆盖率：**94.34%**

**备注**：

- 本轮继续遵循 **KISS / DRY / YAGNI**：
  - 只为已有工作区补充最小可控入口，不引入额外路由状态或复杂上下文
  - 重点是把真实用户会进入的非默认 tab 纳入稳定回归，而不是堆叠新的展示逻辑
- 页面收益：
  - API 文档工作区的 `overview` 之外场景已纳入自动化兜底
  - 后续若继续拆分 API 文档子面板，可直接沿用该测试方式

**下一步**：

1. 继续推进设置页长度治理：落地 systemConfig 分组 tab 化
2. 继续补设置页更高层组合回归测试
3. 继续检查 dashboard 主页与设置页剩余局部重复块

---

### 2026-03-25 / Iteration 54

**目标**：继续推进设置页长度治理，把 systemConfig 从“整页长表单”改为“总览 + 分区 tab”的工作区结构，提升页面节奏与可编辑聚焦度。

**已完成**：

- [x] 新增 `SystemConfigWorkspace`，承接系统配置页工作区布局
- [x] 新增 `buildSystemConfigWorkspaceTabs`，统一总览与分区 tab 元数据
- [x] dashboard 设置页已切换为“总览 + 分区编辑”结构
- [x] 新增高层回归测试并完成无警告门禁验证

**本轮落地内容**：

1. `src/components/system-config-workspace.tsx`
   - 抽离系统配置工作区 UI
   - 新增 `overview / access / security / branding / advanced` 工作区导航
   - `overview` 只展示影响提示、分区速览与保存方式说明
   - 分区 tab 只渲染当前组字段，显著缩短单屏长度
2. `src/lib/dashboard-workspace-tabs.ts`
   - 新增 `SystemConfigWorkspaceTab`
   - 新增 `buildSystemConfigWorkspaceTabs`
3. `src/lib/system-config-ui.ts`
   - 导出系统配置页模型相关类型，供设置工作区组件复用
4. `src/app/admin/dashboard/page.tsx`
   - 系统配置页改为接入 `SystemConfigWorkspace`
   - 移除 dashboard 页内重复维护的 systemConfig 主题与渲染样板
5. 新增测试：
   - `tests/system-config-workspace.test.ts`

**验证结果**：

1. RED：
   - `node --import tsx --test "tests/system-config-workspace.test.ts"` ❌（组件与 tab 构建器不存在，`MODULE_NOT_FOUND`）
2. GREEN：
   - `node --import tsx --test "tests/system-config-workspace.test.ts" "tests/dashboard-workspace-tabs.test.ts" "tests/system-config-ui.test.ts"` ✅
3. 提交视角门禁：
   - `git diff --check` ✅
   - `npm run lint` ✅（无 warnings / errors）
   - `npm run quality:gate` ✅
   - 全量测试：**273 / 273** ✅
   - 覆盖率：
     - 行覆盖率：**94.85%**
     - 分支覆盖率：**87.34%**
     - 函数覆盖率：**93.83%**

**备注**：

- 本轮继续遵循 **KISS / DRY / YAGNI**：
  - 没有引入额外全局状态或新路由，仅把已有分组信息组织为更清晰的工作区
  - 复用现有 Hero / Tab / Summary / CTA 组件，避免重复造型与实现分叉
- 页面收益：
  - 设置页从“整页滚动编辑”升级为“先总览、再聚焦分区编辑”的结构
  - 风格与 API 文档工作区保持统一，整体后台 UI 一致性更高
  - `dashboard/page.tsx` 继续瘦身，系统配置渲染边界更清晰

**下一步**：

1. 继续补设置页 / 改密页更高层组合回归测试
2. 继续检查 `SystemConfigWorkspace` 的 overview 与 group focus 区是否还可继续组件化
3. 继续清点 dashboard 主页剩余可下沉的重复块

---
