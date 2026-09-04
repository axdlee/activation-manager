const DEFAULT_ALLOWED_IPS = ['127.0.0.1', '::1']

function resolveAllowedIPs(allowedIPsEnv: string | undefined = process.env.ALLOWED_IPS) {
  if (!allowedIPsEnv) {
    return DEFAULT_ALLOWED_IPS
  }

  const normalizedAllowedIPs = Array.from(
    new Set(
      allowedIPsEnv
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )

  return normalizedAllowedIPs.length > 0 ? normalizedAllowedIPs : DEFAULT_ALLOWED_IPS
}

// 仅开发环境的回退密钥：公开仓库中不应再存放任何可用于生产签发的固定密钥。
// 生产环境必须通过 JWT_SECRET 环境变量或数据库 jwtSecret 配置提供真实密钥
// （dev-bootstrap 在 NODE_ENV=production 且缺失时会直接拒绝初始化）。
const DEV_FALLBACK_JWT_SECRET = 'dev-only-insecure-secret-do-not-use-in-production'

function resolveJwtSecret(jwtSecretEnv: string | undefined = process.env.JWT_SECRET) {
  return jwtSecretEnv?.trim() || DEV_FALLBACK_JWT_SECRET
}

export const config = {
  // 数据库配置
  database: {
    url: "file:./dev.db"
  },
  
  // JWT配置
  jwt: {
    secret: resolveJwtSecret(),
    expiresIn: "24h"
  },
  
  // 安全配置
  security: {
    allowedIPs: resolveAllowedIPs(),
    bcryptRounds: 12
  },
  
  // 服务器配置
  server: {
    port: 3000,
    nodeEnv: process.env.NODE_ENV || "development"
  }
}
