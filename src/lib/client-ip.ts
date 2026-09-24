/**
 * 统一的客户端 IP 提取（全项目唯一实现）。
 *
 * 背景：此前有 5 份各自为政的实现（admin-auth-service / middleware /
 * admin-api-rate-limit / license-api-rate-limit / shop-api-rate-limit），
 * 兜底值各不相同（'127.0.0.1' / 'unknown' / ''），审计与限流的 key 口径不一致。
 *
 * 信任模型（XFF 计数，从右往左）：
 * - `X-Forwarded-For: client, proxy1`：每个可信代理在收到请求时把「自己看到的
 *   对端地址」追加到尾部，因此最后一个条目是最内层可信代理眼中的地址；
 * - `TRUSTED_PROXY_COUNT`（默认 1）声明客户端与本服务之间有几层可信代理。
 *   客户端 IP = 倒数第 N 个条目（entries[len - N]）。此前实现恒取第一个条目，
 *   客户端伪造的首段 XFF 可直接命中白名单——反代部署下伪造链
 *   （`X-Forwarded-For: 9.9.9.9`）会被计数规则正确跳过，只认代理追加的真实地址；
 * - Next standalone 会在请求未携带 XFF 时用 socket 对端地址注入一条
 *   （base-server `??=` 注入）。直连部署（默认 N=1）下单条目即真实 socket
 *   地址，行为与旧实现一致；「注入的 socket」与「客户端伪造的单条目」在
 *   头层面不可区分是平台限制，直连暴露的应用端口必须配合网络层 ACL；
 * - 显式设置 `TRUSTED_PROXY_COUNT=0`：不信任任何客户端可设的头——请求自带
 *   XFF 时返回 CLIENT_IP_UNTRUSTED，仅适用于已用 TCP 层白名单收敛来源的场景；
 * - 声明的可信跳数多于条目数 → CLIENT_IP_UNTRUSTED。该哨兵不命中白名单
 *   （精确/CIDR 均不匹配），限流层面把伪造流量归并到同一 key，绝不回退
 *   127.0.0.1 造成白名单绕过；
 * - `X-Real-IP` 仅在 XFF 缺失且 N≥1 时兜底（最内层可信代理覆写的场景）。
 *
 * 归一化：IPv4-mapped IPv6（`::ffff:a.b.c.d`）统一折算为 IPv4，避免双栈监听
 * （IPv6 通配）下白名单/限流口径分裂。
 *
 * 部署要求：反代必须转发/追加 X-Forwarded-For（nginx:
 * `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`），并按真实
 * 代理层数设置 TRUSTED_PROXY_COUNT；应用端口只允许反代网段访问（防止绕过
 * 代理直连伪造 XFF）。
 */

export type ClientIpRequestLike = {
  /** 部分请求封装（如 admin-auth-service 的 RequestLike）允许 null，统一放宽 */
  ip?: string | null
  headers: {
    get(name: string): string | null
  }
}

export type ExtractClientIpOptions = {
  /** 可信代理层数；缺省读环境变量 TRUSTED_PROXY_COUNT，默认 1 */
  trustedProxyCount?: number
}

/** 无法取得任何 IP 线索时的统一兜底值（仅用于无任何头的直连/开发场景） */
export const CLIENT_IP_FALLBACK = '127.0.0.1'

/** XFF 链不足/不可信时返回的哨兵：不命中白名单、限流归并伪造流量 */
export const CLIENT_IP_UNTRUSTED = 'unknown'

export const TRUSTED_PROXY_COUNT_DEFAULT = 1

export function resolveTrustedProxyCount(
  raw: string | undefined = process.env.TRUSTED_PROXY_COUNT,
): number {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) {
    return TRUSTED_PROXY_COUNT_DEFAULT
  }
  const parsed = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return TRUSTED_PROXY_COUNT_DEFAULT
  }
  return parsed
}

/** 折算 IPv4-mapped IPv6（`::ffff:192.168.1.9` → `192.168.1.9`），其余原样返回 */
export function normalizeClientIp(ip: string): string {
  const trimmed = ip.trim()
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(trimmed)
  return mapped ? mapped[1] : trimmed
}

function parseForwardedEntries(raw: string | null): string[] {
  return (raw ?? '')
    .split(',')
    .map((entry) => normalizeClientIp(entry))
    .filter(Boolean)
}

export function extractClientIp(
  request: ClientIpRequestLike,
  options: ExtractClientIpOptions = {},
): string {
  const trustedProxyCount =
    options.trustedProxyCount ?? resolveTrustedProxyCount()

  // 平台直接暴露 socket 地址（非 Next standalone 场景）时它是最可信的来源
  const socketIp = request.ip ? normalizeClientIp(request.ip) : ''
  if (socketIp) {
    return socketIp
  }

  const rawForwardedFor = request.headers.get('x-forwarded-for')
  const forwardedEntries = parseForwardedEntries(rawForwardedFor)

  if (forwardedEntries.length === 0) {
    // 无 XFF：N≥1 时 X-Real-IP 由最内层可信代理覆写，可信；N=0 时不信任任何头
    if (trustedProxyCount >= 1) {
      const realIp = normalizeClientIp(request.headers.get('x-real-ip') ?? '')
      if (realIp) {
        return realIp
      }
    }
    return CLIENT_IP_FALLBACK
  }

  // 头缺失时 Next standalone 会注入 socket 条目，因此能走到这里（entries 非空）
  // 就意味着请求自带 XFF：不再叠加「本机注入」这一跳，直接按声明的可信层数
  // 从右往左取位。N=0（严格模式）时 clientIndex=len 越界 → CLIENT_IP_UNTRUSTED。
  const clientIndex = forwardedEntries.length - trustedProxyCount
  if (clientIndex < 0 || clientIndex >= forwardedEntries.length) {
    return CLIENT_IP_UNTRUSTED
  }

  return forwardedEntries[clientIndex]
}
