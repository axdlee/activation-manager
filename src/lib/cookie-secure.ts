import { NextRequest } from 'next/server'

const COOKIE_SECURE_ENV = process.env.COOKIE_SECURE

/**
 * 解析 auth-token 是否应带 Secure 属性。
 *
 * 背景：此前 secure 直接取 `NODE_ENV === 'production'`，导致 Docker 生产部署
 * 通过明文 HTTP（无 HTTPS 反代）访问时，浏览器拒绝保存 Secure cookie，
 * 表现为「登录成功但不跳转后台、无限 307 回登录页」。
 *
 * 策略（按优先级）：
 * 1. COOKIE_SECURE=true|false 环境变量显式覆盖（强制）
 * 2. 请求实际为 HTTPS（含 x-forwarded-proto=https 反代）→ true
 * 3. 明文 HTTP → false（允许内网/无 TLS 部署正常登录）
 */
export function resolveCookieSecure(request: NextRequest) {
  if (COOKIE_SECURE_ENV === 'true') {
    return true
  }

  if (COOKIE_SECURE_ENV === 'false') {
    return false
  }

  const forwardedProto = request.headers.get('x-forwarded-proto')
  if (forwardedProto && forwardedProto.split(',')[0]?.trim() === 'https') {
    return true
  }

  return request.nextUrl.protocol === 'https:'
}
