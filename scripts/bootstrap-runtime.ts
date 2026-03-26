import { bootstrapRuntimeDatabase } from '../src/lib/dev-bootstrap'

bootstrapRuntimeDatabase().catch((error) => {
  console.error('❌ 运行环境初始化失败:', error)
  process.exit(1)
})
