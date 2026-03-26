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

export const config = {
  // 数据库配置
  database: {
    url: "file:./dev.db"
  },
  
  // JWT配置
  jwt: {
    secret: "72a99ef4352d55f8c6c5bdbe8a54e0d58df60740e229318cbc2dea4154ef48dd",
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
