type ApiDocsSummaryTone = 'sky' | 'emerald' | 'violet'

export type ApiDocsSummaryCard = {
  label: string
  value: string
  description: string
  tone: ApiDocsSummaryTone
}

export type ApiResearchStep = {
  step: string
  title: string
  description: string
  outcome: string
}

export type ApiLicenseModelCard = {
  title: string
  badge: string
  description: string
  bullets: string[]
}

export type ApiFieldDoc = {
  field: string
  type: string
  required: string
  description: string
}

export type ApiEndpointDoc = {
  key: 'activate' | 'status' | 'consume' | 'verify'
  title: string
  audience: 'recommended' | 'compat'
  method: 'POST'
  path: string
  summary: string
  whenToUse: string
  highlights: string[]
  requestExample: string
  responseExample: string
}

export type ApiLanguageSnippet = {
  key: 'sdk' | 'python' | 'curl'
  label: string
  description: string
  code: string
}

export type AdminEndpointDoc = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  description: string
}

export type AdminEndpointGroup = {
  title: string
  description: string
  endpoints: AdminEndpointDoc[]
}

export function buildApiDocsPageModel() {
  const summaryCards: ApiDocsSummaryCard[] = [
    {
      label: '正式接口',
      value: '3 个',
      description: '推荐插件或客户端正式接入时使用 activate / status / consume 三段式流程。',
      tone: 'sky',
    },
    {
      label: '兼容入口',
      value: '1 个',
      description: '旧接口 /api/verify 仍可使用，但新业务不建议继续把它当正式扣次入口。',
      tone: 'violet',
    },
    {
      label: '建议调研路径',
      value: '6 步',
      description: '从 projectKey、设备绑定、幂等消费到后台日志核对，形成完整联调闭环。',
      tone: 'emerald',
    },
  ]

  const researchSteps: ApiResearchStep[] = [
    {
      step: '01',
      title: '先确认项目与授权模型',
      description: '在项目管理里确认当前插件对应的 projectKey，并区分是时间型还是次数型激活码。',
      outcome: '避免把错误项目的激活码带入联调，也能提前判断是否需要 requestId。',
    },
    {
      step: '02',
      title: '先调 activate 绑定设备',
      description: '用户首次输入激活码时调用 /api/license/activate，让系统先绑定 machineId。',
      outcome: '时间型会从此刻开始计算有效期；次数型只绑定设备，不会立即扣次。',
    },
    {
      step: '03',
      title: '再调 status 观察返回字段',
      description: '拿同一组 code + machineId 调用 /api/license/status，确认 expiresAt / remainingCount / valid 等字段。',
      outcome: '可以快速验证当前激活码是否处于正确状态，便于插件前端显示授权信息。',
    },
    {
      step: '04',
      title: '真实业务再调 consume',
      description: '只有发生真实业务动作时才调用 /api/license/consume，并且推荐始终带上 requestId。',
      outcome: '同一 requestId 会幂等返回，不会因为客户端重试或网络抖动重复扣次。',
    },
    {
      step: '05',
      title: '去后台消费日志按 requestId 反查',
      description: '联调时把 requestId、machineId 带到“消费日志”页搜索，核对每次扣次是否正确落库。',
      outcome: '可以把接口行为与后台日志一一对应，快速定位重复请求、错误设备或项目混用问题。',
    },
    {
      step: '06',
      title: '最后跑 smoke 脚本做回归',
      description: '本地启动后执行 smoke:license-api，让项目自动走完登录、建项目、生成卡、激活、状态、幂等扣次。',
      outcome: '把接口调研从人工验证升级为可重复的联调回归流程。',
    },
  ]

  const licenseModels: ApiLicenseModelCard[] = [
    {
      title: '时间型激活码',
      badge: 'TIME',
      description: '适合按天/月/年计费的授权模式，首次激活后开始计算有效期。',
      bullets: [
        '首次 activate 时写入 usedBy / usedAt / expiresAt。',
        '后续 status / consume 只做有效性校验，不扣减次数。',
        '插件展示剩余有效期时，优先使用 expiresAt / expires_at。',
      ],
    },
    {
      title: '次数型激活码',
      badge: 'COUNT',
      description: '适合浏览器插件、桌面工具等按次数消耗的场景。',
      bullets: [
        'activate 只绑定设备，不扣减 remainingCount。',
        'consume 每次成功调用扣减 1 次，且支持 requestId 幂等。',
        'status 可用于展示剩余次数、是否已激活与当前是否仍有效。',
      ],
    },
    {
      title: '多项目隔离',
      badge: 'PROJECT',
      description: '同一个服务端可同时给多个产品、插件或客户提供独立授权空间。',
      bullets: [
        '每张激活码都归属于某个 projectKey。',
        '同一台设备可以在不同 projectKey 下分别绑定激活码。',
        '项目停用后，正式接口会直接返回“项目已停用”。',
      ],
    },
  ]

  const requestFields: ApiFieldDoc[] = [
    {
      field: 'projectKey / project_key',
      type: 'string',
      required: '否',
      description: '项目标识；不传时默认走 default 项目。',
    },
    {
      field: 'code',
      type: 'string',
      required: '是',
      description: '激活码正文。',
    },
    {
      field: 'machineId / machine_id',
      type: 'string',
      required: '是',
      description: '设备唯一标识，建议插件本地持久化一个稳定 UUID。',
    },
    {
      field: 'requestId / request_id',
      type: 'string',
      required: '仅 consume 推荐',
      description: '请求幂等键；同一 requestId 的 consume 只会成功扣减一次。',
    },
  ]

  const responseFields: ApiFieldDoc[] = [
    {
      field: 'success',
      type: 'boolean',
      required: '总是返回',
      description: '业务层是否成功。',
    },
    {
      field: 'message',
      type: 'string',
      required: '总是返回',
      description: '提示信息或失败原因。',
    },
    {
      field: 'licenseMode / license_mode',
      type: 'TIME | COUNT | null',
      required: '按场景返回',
      description: '授权类型。',
    },
    {
      field: 'expiresAt / expires_at',
      type: 'string | null',
      required: '时间型常用',
      description: '时间型过期时间。',
    },
    {
      field: 'remainingCount / remaining_count',
      type: 'number | null',
      required: '次数型常用',
      description: '次数型剩余次数。',
    },
    {
      field: 'isActivated / is_activated',
      type: 'boolean | null',
      required: '按场景返回',
      description: '当前激活码是否已绑定到设备。',
    },
    {
      field: 'valid',
      type: 'boolean | null',
      required: '按场景返回',
      description: '当前是否仍有效。',
    },
    {
      field: 'idempotent',
      type: 'boolean | null',
      required: 'consume 常用',
      description: '本次是否命中了 requestId 幂等重放。',
    },
  ]

  const endpoints: ApiEndpointDoc[] = [
    {
      key: 'activate',
      title: '激活接口',
      audience: 'recommended',
      method: 'POST',
      path: '/api/license/activate',
      summary: '在用户输入激活码时绑定设备，建立正式授权关系。',
      whenToUse: '首次录入激活码，或客户端重新验证当前设备是否仍可继续使用时。',
      highlights: [
        '时间型会在首次激活时开始计算有效期。',
        '次数型只绑定设备，不扣减 remainingCount。',
        '支持 camelCase 与 snake_case 混合请求字段。',
      ],
      requestExample: `{
  "projectKey": "browser-plugin",
  "code": "A1B2C3D4E5F6G7H8",
  "machineId": "machine-001"
}`,
      responseExample: `{
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
}`,
    },
    {
      key: 'status',
      title: '状态接口',
      audience: 'recommended',
      method: 'POST',
      path: '/api/license/status',
      summary: '查询当前授权是否有效，以及剩余次数 / 过期时间 / 绑定状态。',
      whenToUse: '插件启动、设置页展示授权信息、或用户手动点击“刷新授权状态”时。',
      highlights: [
        '适合展示当前授权摘要，不会额外扣减次数。',
        '建议与 activate 配套使用，先绑定再查状态。',
        '返回字段同时兼容 camelCase 与 snake_case。',
      ],
      requestExample: `{
  "project_key": "browser-plugin",
  "code": "A1B2C3D4E5F6G7H8",
  "machine_id": "machine-001"
}`,
      responseExample: `{
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
}`,
    },
    {
      key: 'consume',
      title: '扣次接口',
      audience: 'recommended',
      method: 'POST',
      path: '/api/license/consume',
      summary: '在真实业务动作发生时完成次数扣减，或对时间型授权做有效性校验。',
      whenToUse: '浏览器插件真正完成一次计算、分析、导出或调用高价值功能时。',
      highlights: [
        'COUNT 模式下每次成功 consume 扣减 1 次。',
        '同一 requestId 的重放会返回 idempotent: true，不重复扣次。',
        'TIME 模式下只校验有效性，不会扣减次数。',
      ],
      requestExample: `{
  "projectKey": "browser-plugin",
  "code": "A1B2C3D4E5F6G7H8",
  "machineId": "machine-001",
  "requestId": "req-001"
}`,
      responseExample: `{
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
}`,
    },
    {
      key: 'verify',
      title: '兼容接口',
      audience: 'compat',
      method: 'POST',
      path: '/api/verify',
      summary: '保留给旧插件的兼容入口，本质上走当前系统的验证 / 消费逻辑。',
      whenToUse: '只用于历史客户端兼容；新插件不要再把它当正式扣次接口。',
      highlights: [
        'TIME 模式下首次调用会激活，后续做有效性校验。',
        'COUNT 模式下每调用一次就会扣减一次。',
        '推荐新业务改造成 activate + status + consume 三段式。',
      ],
      requestExample: `{
  "project_key": "browser-plugin",
  "code": "A1B2C3D4E5F6G7H8",
  "machine_id": "machine-001"
}`,
      responseExample: `{
  "success": true,
  "message": "激活码验证成功",
  "license_mode": "COUNT",
  "expires_at": null,
  "remaining_count": 1
}`,
    },
  ]

  const languageSnippets: ApiLanguageSnippet[] = [
    {
      key: 'sdk',
      label: 'JavaScript / TypeScript SDK',
      description: '项目内已提供 src/lib/license-sdk.ts，最适合浏览器插件、桌面前端和 Node 环境快速接入。',
      code: String.raw`import { createLicenseClient, isLicenseClientError } from '@/lib/license-sdk'

const client = createLicenseClient({
  baseUrl: 'http://127.0.0.1:3000',
  projectKey: 'browser-plugin',
  timeoutMs: 10000,
  maxRetries: 1,
  retryDelayMs: 200,
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
}`,
    },
    {
      key: 'python',
      label: 'Python requests',
      description: '适合桌面自动化脚本、内网工具或测试平台调试正式授权接口。',
      code: String.raw`import requests

BASE_URL = "http://127.0.0.1:3000"
COMMON_BODY = {
    "projectKey": "browser-plugin",
    "code": "A1B2C3D4E5F6G7H8",
    "machineId": "machine-001",
}

activate_resp = requests.post(f"{BASE_URL}/api/license/activate", json=COMMON_BODY, timeout=10)
print("activate", activate_resp.status_code, activate_resp.json())

status_resp = requests.post(f"{BASE_URL}/api/license/status", json=COMMON_BODY, timeout=10)
print("status", status_resp.status_code, status_resp.json())

consume_resp = requests.post(
    f"{BASE_URL}/api/license/consume",
    json={**COMMON_BODY, "requestId": "req-001"},
    timeout=10,
)
print("consume", consume_resp.status_code, consume_resp.json())

legacy_resp = requests.post(
    f"{BASE_URL}/api/verify",
    json={
        "project_key": "browser-plugin",
        "code": "A1B2C3D4E5F6G7H8",
        "machine_id": "machine-001",
    },
    timeout=10,
)
print("verify", legacy_resp.status_code, legacy_resp.json())`,
    },
    {
      key: 'curl',
      label: 'cURL / Postman 参考',
      description: '适合联调、写 Postman collection、或快速把请求复制给后端和测试同学复现。',
      code: String.raw`# activate
curl -X POST "http://127.0.0.1:3000/api/license/activate" \
  -H "Content-Type: application/json" \
  -d '{
    "projectKey": "browser-plugin",
    "code": "A1B2C3D4E5F6G7H8",
    "machineId": "machine-001"
  }'

# status
curl -X POST "http://127.0.0.1:3000/api/license/status" \
  -H "Content-Type: application/json" \
  -d '{
    "project_key": "browser-plugin",
    "code": "A1B2C3D4E5F6G7H8",
    "machine_id": "machine-001"
  }'

# consume
curl -X POST "http://127.0.0.1:3000/api/license/consume" \
  -H "Content-Type: application/json" \
  -d '{
    "projectKey": "browser-plugin",
    "code": "A1B2C3D4E5F6G7H8",
    "machineId": "machine-001",
    "requestId": "req-001"
  }'

# legacy verify
curl -X POST "http://127.0.0.1:3000/api/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "project_key": "browser-plugin",
    "code": "A1B2C3D4E5F6G7H8",
    "machine_id": "machine-001"
  }'`,
    },
  ]

  const adminGroups: AdminEndpointGroup[] = [
    {
      title: '项目与发码',
      description: '联调之前先准备 projectKey 和测试激活码。',
      endpoints: [
        {
          method: 'POST',
          path: '/api/admin/projects',
          description: '创建项目，适合为浏览器插件、桌面端或不同客户生成独立 projectKey。',
        },
        {
          method: 'PATCH',
          path: '/api/admin/projects/{id}',
          description: '启停项目或修改项目名称、描述。',
        },
        {
          method: 'POST',
          path: '/api/admin/codes/generate',
          description: '为指定项目生成时间型或次数型激活码。',
        },
        {
          method: 'GET',
          path: '/api/admin/codes/list',
          description: '查看所有已发放激活码，便于反查状态与批量导出。',
        },
      ],
    },
    {
      title: '日志与统计',
      description: '当插件调用异常时，可反向查消费日志与趋势数据。',
      endpoints: [
        {
          method: 'GET',
          path: '/api/admin/consumptions',
          description: '按 projectKey、keyword、createdFrom、createdTo 查询消费日志。',
        },
        {
          method: 'GET',
          path: '/api/admin/consumptions/export',
          description: '按当前筛选条件导出消费日志 CSV。',
        },
        {
          method: 'GET',
          path: '/api/admin/consumptions/trend',
          description: '获取最近 1-90 天的消费趋势，支持按日 / 周 / 月聚合。',
        },
        {
          method: 'GET',
          path: '/api/admin/codes/stats',
          description: '查看全局统计与项目级统计结果。',
        },
      ],
    },
  ]

  const localDebugging = [
    {
      title: '自动化烟雾测试',
      command: 'BASE_URL=http://127.0.0.1:3000 npm run smoke:license-api',
      description: '自动完成登录、建项目、生成次数卡、激活、状态查询、幂等扣次等整条链路验证。',
    },
    {
      title: '查看详细对接文档',
      command: '打开项目根目录下的 apidocs.md',
      description: '适合把完整 API 文档同步给前端、测试或第三方接入方。',
    },
    {
      title: '复用 SDK 源码',
      command: 'src/lib/license-sdk.ts',
      description: '如果你的插件也是 JS / TS 生态，直接复用 SDK 比手写 fetch 更稳。',
    },
  ]

  return {
    summaryCards,
    researchSteps,
    licenseModels,
    requestFields,
    responseFields,
    endpoints,
    languageSnippets,
    adminGroups,
    localDebugging,
  }
}
