/** @type {import('next').NextConfig} */

// Next.js 运行时会注入少量内联脚本（RSC payload / 启动引导），
// 因此 script-src 需放行 'unsafe-inline'；样式部分使用内联 style 属性较多，
// style-src 放行 'unsafe-inline'。API 返回 JSON 不受影响。
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: cspDirectives },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
  async headers() {
    // 后台与公开页面统一加安全头；文档页为静态渲染同样受益
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = nextConfig
