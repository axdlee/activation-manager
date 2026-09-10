# TypeScript / JavaScript SDK

独立副本，方便 npm 之外的使用者直接复制单文件使用。**源码维护在仓库 `src/lib/license-sdk.ts`**，本目录副本与其同步（修改请改源文件再复制）。

最小组装：

```ts
import { createLicenseClient } from './license-sdk'

const client = createLicenseClient({
  baseUrl: 'http://127.0.0.1:3000',
  projectKey: 'browser-plugin',
  timeoutMs: 10000,
  maxRetries: 1,
})

const result = await client.activate({ code: 'A1B2C3D4E5F6G7H8', machineId: 'machine-001' })
if (!result.success) console.log('激活失败:', result.message)
```

完整方法与选项见 `license-sdk.ts` 文件头注释与仓库 `apidocs.md` 第 4 章。
