/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production'

// Next.js 运行时会注入少量内联脚本（RSC payload / 启动引导），
// 因此 script-src 需放行 'unsafe-inline'；样式部分使用内联 style 属性较多，
// style-src 放行 'unsafe-inline'。
// 'unsafe-eval' 仅开发模式（webpack HMR）需要，生产环境收紧，降低 XSS 面。
const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'"

const cspDirectives = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
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
  // 防跨源读取（配合 CSP frame-ancestors 'none' 防点击劫持与嵌入）
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // 隔离 opener 上下文，降低 tabnabbing / window.opener 攻击面
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Content-Security-Policy', value: cspDirectives },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  // 项目未使用 next/image；关闭图片优化接口以消除
  // Next.js 14.x 已知未授权 RCE（CVE-2024-34351 类）攻击面
  images: { unoptimized: true },
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  async headers() {
    // 后台与公开页面统一加安全头；文档页为静态渲染同样受益
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = nextConfig
