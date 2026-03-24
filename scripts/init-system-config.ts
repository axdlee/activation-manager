import { ensureDefaultSystemConfigs } from '../src/lib/dev-bootstrap'

ensureDefaultSystemConfigs().catch((error) => {
  console.error('❌ 初始化系统配置失败:', error)
  process.exit(1)
})
