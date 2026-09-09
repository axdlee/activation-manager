// 服务端 i18n：API 响应消息按请求语言返回。
//
// 设计：
// - resolveServerLocale(request)：cookie（activation-manager-locale，与前端持久化同源）
//   > Accept-Language（浏览器默认语言）> 默认 zh-CN
// - serverMessages：结构化消息目录（en-US / zh-CN 双份），key 为点分域
// - createServerT(locale)：t(key, params) 支持简单 {param} 插值
// - 客户端 SDK 消费的是 message 字符串；语言由请求头决定，SDK 无需感知
//
// License API 响应签名：签名发生在消息组装之后（对最终 body 签名），
// 因此按语言返回不同 message 不影响验签一致性。

export type SupportedLocale =
  | 'zh-CN'
  | 'en-US'
  | 'ja-JP'
  | 'ko-KR'
  | 'es-ES'
  | 'fr-FR'
  | 'de-DE'
  | 'pt-BR'
  | 'ru-RU'
  | 'ar-SA'

export const LOCALE_COOKIE = 'activation-manager-locale'
export const DEFAULT_LOCALE: SupportedLocale = 'zh-CN'

const LOCALE_PATTERN = /^[a-zA-Z]{2}(-[a-zA-Z]{2,4})?$/

/** BCP-47 前缀 → 受支持 locale（与服务端/客户端词典装配顺序一致） */
const TAG_PREFIX_MAP: ReadonlyArray<readonly [string, SupportedLocale]> = [
  ['zh', 'zh-CN'],
  ['en', 'en-US'],
  ['ja', 'ja-JP'],
  ['ko', 'ko-KR'],
  ['es', 'es-ES'],
  ['fr', 'fr-FR'],
  ['de', 'de-DE'],
  ['pt', 'pt-BR'],
  ['ru', 'ru-RU'],
  ['ar', 'ar-SA'],
]

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    typeof value === 'string' && TAG_PREFIX_MAP.some(([, id]) => id === value)
  )
}

/** BCP-47 tag → 受支持 locale（前缀匹配） */
export function matchLocale(tag: string): SupportedLocale | null {
  const lower = tag.toLowerCase()
  for (const [prefix, id] of TAG_PREFIX_MAP) {
    if (lower === prefix || lower.startsWith(prefix + '-')) {
      return id
    }
  }
  return null
}

/** 解析 Accept-Language 头的第一个可支持区域（q 值顺序） */
export function localeFromAcceptLanguage(header: string | null | undefined): SupportedLocale | null {
  if (!header) {
    return null
  }

  const candidates = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const qParam = params.find((p) => p.trim().startsWith('q='))
      const q = qParam ? Number(qParam.split('=')[1]) : 1
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 1 }
    })
    .filter((item) => item.tag && LOCALE_PATTERN.test(item.tag))
    .sort((a, b) => b.q - a.q)

  for (const { tag } of candidates) {
    const matched = matchLocale(tag)
    if (matched) {
      return matched
    }
  }

  return null
}

/** 从 Cookie 头解析持久化 locale（与前端 localStorage 同步写入） */
export function localeFromCookieHeader(header: string | null | undefined): SupportedLocale | null {
  if (!header) {
    return null
  }

  const match = header.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`))
  const value = match?.[1]?.trim()
  return isSupportedLocale(value) ? value : null
}

/**
 * 服务端 locale 判定顺序：
 * 1. 显式 cookie（用户手动切换过语言，与前端 localStorage 双写）
 * 2. Accept-Language（浏览器默认语言）
 * 3. zh-CN（中文为主的项目默认）
 */
export function resolveServerLocale(request: {
  headers: { get(name: string): string | null }
}): SupportedLocale {
  const cookieLocale = localeFromCookieHeader(request.headers.get('cookie'))
  if (cookieLocale) {
    return cookieLocale
  }

  const headerLocale = localeFromAcceptLanguage(request.headers.get('accept-language'))
  if (headerLocale) {
    return headerLocale
  }

  return DEFAULT_LOCALE
}

export type ServerMessageParams = Record<string, string | number>

export type ServerT = {
  (key: string, params?: ServerMessageParams): string
}

function interpolate(template: string, params?: ServerMessageParams) {
  if (!params) {
    return template
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

/**
 * 创建服务端翻译函数。
 * messages 由调用方注入（server.ts 装配 zh/en 两份目录），
 * 保持本模块不直接依赖具体词典，便于单测注入。
 */
export function createServerT(
  locale: SupportedLocale,
  messages: Partial<Record<SupportedLocale, Record<string, string>>>,
): ServerT {
  const dict = messages[locale] ?? messages[DEFAULT_LOCALE] ?? {}
  const fallbackDict = messages[DEFAULT_LOCALE] ?? {}

  return (key, params) => {
    const template = dict[key] ?? fallbackDict[key] ?? key
    return interpolate(template, params)
  }
}
