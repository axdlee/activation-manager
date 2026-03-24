import { ensureDefaultAdmin } from '../src/lib/dev-bootstrap'

ensureDefaultAdmin().catch((error) => {
  console.error('❌ 创建管理员账号失败:', error)
  process.exit(1)
})
