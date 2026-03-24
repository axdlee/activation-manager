import { bootstrapDevelopmentDatabase } from '../src/lib/dev-bootstrap'

bootstrapDevelopmentDatabase().catch((error) => {
  console.error('❌ 开发环境初始化失败:', error)
  process.exit(1)
})
