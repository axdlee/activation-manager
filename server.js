/**
 * 生产入口：薄自定义 server，在请求进入 Next 之前把本进程观察到的
 * socket 对端地址追加到 X-Forwarded-For 末尾。
 *
 * 背景（v2.9.1 评审·高危 1）：直连部署（docker-compose 直接暴露 3000）下，
 * Next 仅在请求未携带 XFF 时才注入 socket 地址；客户端自带的伪造
 * `X-Forwarded-For: 10.9.9.9` 会被原样保留，而 TRUSTED_PROXY_COUNT=1 的
 * 取位规则（倒数第 1 个）恰好命中伪造值——IP 白名单形同虚设。根治方式是
 * 让「倒数第 N 个」永远从可信值起算：每个入站请求无条件追加本机观察到的
 * socket 地址，伪造条目全部被挤到链条左侧。
 *
 * 追加规则：
 * - socket 地址先做 IPv4-mapped IPv6 归一化（与 src/lib/client-ip.ts 一致）；
 * - **除可信内部跳外一律追加**（v2.11.0 评审·高危 2）：middleware 的页面
 *   鉴权会从本进程回环再发一次内部校验请求，该跳携带进程随机密钥头
 *   `x-internal-xff-secret`（与 LICENSE_INTERNAL_XFF_SECRET 比对），豁免追加以
 *   保持「XFF 与边缘收到时一致」；来自宿主机回环的其他连接（同机 nginx
 *   反代、本机直连）不再豁免——伪造的 XFF 条目会被追加的 127.0.0.1 挤出
 *   「倒数第 N 个」取位，同机反代不再能借回环穿透 IP 白名单。同机 nginx
 *   部署对应 TRUSTED_PROXY_COUNT=2（nginx + 本层）。
 * - socket 地址缺失（异常场景）时不改动请求头，交由 client-ip.ts 原有
 *   分支处理。
 *
 * 取位语义（TRUSTED_PROXY_COUNT，从右往左）：
 * - 直连（无代理）：链条 = [socket]，默认 1 即命中真实地址；
 * - 经 N 层可信反代：链条 = [..., client, socket]，应设为 N+1。
 *   （v2.9.0 及之前语义为「代理层数」，反代用户升级后需 +1，见 CHANGELOG。）
 *
 * 其余与 `next start` 对齐：压缩使用 Next 内置的 compiled/compression
 * （compress 配置默认开启），监听地址/端口读 APP_HOST / PORT 环境变量。
 */

const http = require('node:http')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const compression = require('next/dist/compiled/compression')

const IPV4_MAPPED_IPV6_RE = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', 'localhost'])

/**
 * 内部校验跳豁免密钥（v2.11.0 评审·高危 2）：进程启动时生成一次随机密钥并
 * 写入环境变量，middleware 的页面鉴权内部回环跳会携带同名请求头；server.js
 * 看到回环 socket + 匹配密钥才认定是可信内部跳。密钥不经配置、不落盘，
 * 外部进程无法预测，来自宿主机回环的普通直连/反代流量一律不豁免。
 *
 * 注意：必须在 require('next')（startServer 内）之前赋值——Next 的 middleware
 * 运行时会从宿主进程环境快照 process.env，赋值晚于沙箱创建会读不到。
 */
const INTERNAL_XFF_SECRET_HEADER = 'x-internal-xff-secret'
process.env.LICENSE_INTERNAL_XFF_SECRET = crypto.randomBytes(24).toString('hex')

/** 折算 IPv4-mapped IPv6（`::ffff:192.168.1.9` → `192.168.1.9`），其余原样返回 */
function normalizeSocketAddress(raw) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) {
    return ''
  }
  const mapped = IPV4_MAPPED_IPV6_RE.exec(trimmed)
  return mapped ? mapped[1] : trimmed
}

function isLoopbackAddress(address) {
  return LOOPBACK_ADDRESSES.has(normalizeSocketAddress(address).toLowerCase())
}

/**
 * 计算追加后的 X-Forwarded-For 值。
 * @param {string|undefined} [internalSecretHeader] 请求头 `x-internal-xff-secret` 的值
 * @returns {string|null} 追加后的头值；仅可信内部跳（回环 socket + 密钥匹配）或
 *   socket 缺失时返回原值（可能为 null），其余一律追加
 */
function appendSocketAddressToForwardedFor(existingHeader, socketAddress, internalSecretHeader) {
  const socket = normalizeSocketAddress(socketAddress)
  if (!socket) {
    return existingHeader ?? null
  }
  if (
    isLoopbackAddress(socket) &&
    typeof internalSecretHeader === 'string' &&
    internalSecretHeader === process.env.LICENSE_INTERNAL_XFF_SECRET
  ) {
    // 可信内部跳：链条保持与边缘请求一致（XFF 不变），取位语义不偏移
    return existingHeader ?? null
  }
  // 其余连接（含无密钥/错密钥的回环连接）一律追加：同机 nginx 部署下，
  // 伪造的 X-Forwarded-For 条目会被追加的 127.0.0.1 挤出「倒数第 N 个」取位
  const existing = typeof existingHeader === 'string' ? existingHeader.trim() : ''
  return existing ? `${existing}, ${socket}` : socket
}

function resolveListenPort(raw = process.env.PORT) {
  const parsed = Number.parseInt(String(raw ?? '').trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3000
}

function resolveListenHost(raw = process.env.APP_HOST) {
  const trimmed = String(raw ?? '').trim()
  return trimmed || '0.0.0.0'
}

async function startServer(options = {}) {
  const port = options.port ?? resolveListenPort()
  const hostname = options.hostname ?? resolveListenHost()
  const dev = options.dev ?? process.env.NODE_ENV !== 'production'
  const dir = options.dir ?? __dirname
  const distDir = options.distDir ?? (process.env.NEXT_DIST_DIR || '.next')

  // 友好提示：自定义 server 不再有 next start 的内置构建校验文案
  if (!dev && !fs.existsSync(path.join(dir, distDir, 'BUILD_ID'))) {
    console.error(
      `❌ 未找到生产构建（${path.join(dir, distDir, 'BUILD_ID')}），请先执行 \`npm run build\`。`,
    )
    process.exit(1)
  }

  const next = require('next')
  // distDir 由 next.config.js 读取 NEXT_DIST_DIR 环境变量决定，这里保持一致
  const app = next({ dev, dir, hostname, port })
  const handle = app.getRequestHandler()
  await app.prepare()

  const shouldCompress = process.env.NEXT_COMPRESS !== '0'
  const withCompression = shouldCompress ? compression() : (req, res, next) => next()

  const server = http.createServer((req, res) => {
    const appended = appendSocketAddressToForwardedFor(
      req.headers['x-forwarded-for'],
      req.socket.remoteAddress,
      req.headers[INTERNAL_XFF_SECRET_HEADER],
    )
    if (appended !== null) {
      req.headers['x-forwarded-for'] = appended
    }
    withCompression(req, res, () => handle(req, res))
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, hostname, resolve)
  })

  console.log(`> ${dev ? 'Development' : 'Production'} server ready on http://${hostname}:${port}`)
  return server
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('❌ 服务启动失败:', error)
    process.exit(1)
  })
}

module.exports = {
  INTERNAL_XFF_SECRET_HEADER,
  appendSocketAddressToForwardedFor,
  isLoopbackAddress,
  normalizeSocketAddress,
  resolveListenHost,
  resolveListenPort,
  startServer,
}
