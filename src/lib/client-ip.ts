/**
 * 统一的客户端 IP 提取（全项目唯一实现）。
 *
 * 背景：此前有 5 份各自为政的实现（admin-auth-service / middleware /
 * admin-api-rate-limit / license-api-rate-limit / shop-api-rate-limit），
 * 兜底值各不相同（'127.0.0.1' / 'unknown' / ''），审计与限流的 key 口径不一致。
 *
 * 安全须知：自托管（standalone node server）模式下 Next.js 的 request.ip
 * 恒为空，X-Forwarded-For 由客户端可控。因此：
 * - 直连部署时，限流/白名单口径可被伪造头部轮换绕过（登录限流已叠加
 *   用户名维度计数缓解爆破）；
 * - 反代部署时应在代理层重写 XFF（只保留真实 socket IP），或显式信任
 *   固定代理层数后再启用按 IP 封禁类策略。
 */

export type ClientIpRequestLike = {
  /** 部分请求封装（如 admin-auth-service 的 RequestLike）允许 null，统一放宽 */
  ip?: string | null
  headers: {
    get(name: string): string | null
  }
}

/** 无法取得任何 IP 线索时的统一兜底值 */
export const CLIENT_IP_FALLBACK = '127.0.0.1'

export function extractClientIp(request: ClientIpRequestLike): string {
  return (
    request.ip ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    CLIENT_IP_FALLBACK
  )
}
