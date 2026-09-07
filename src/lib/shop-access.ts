import { getConfigWithDefault } from './config-service'

/**
 * 购买中心总开关。
 * shopEnabled=false 时：
 * - /shop 页面展示停用提示
 * - 商品/下单/支付渠道公开 API 返回 403
 * 后台购买中心管理仍可访问（维护商品与渠道配置）。
 */
export async function isShopEnabled(): Promise<boolean> {
  const value = await getConfigWithDefault('shopEnabled')
  return value !== false
}

export async function requireShopEnabled(): Promise<{ ok: true } | { ok: false }> {
  const enabled = await isShopEnabled()
  return enabled ? { ok: true } : { ok: false }
}
