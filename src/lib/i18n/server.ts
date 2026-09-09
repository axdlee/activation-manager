import {
  createServerT,
  isSupportedLocale,
  localeFromAcceptLanguage,
  localeFromCookieHeader,
  resolveServerLocale,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type ServerMessageParams,
  type SupportedLocale,
} from './server-i18n'
import serverMessagesZh from './server-messages-zh'
import serverMessagesEn from './server-messages-en'

const serverMessages: Record<SupportedLocale, Record<string, string>> = {
  'zh-CN': serverMessagesZh,
  'en-US': serverMessagesEn,
}

export {
  createServerT,
  isSupportedLocale,
  localeFromAcceptLanguage,
  localeFromCookieHeader,
  resolveServerLocale,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
}
export type { ServerMessageParams, SupportedLocale }

/** 服务端翻译函数：按请求 locale 生成 */
export function serverT(locale: SupportedLocale) {
  return createServerT(locale, serverMessages)
}

export type { ServerT } from './server-i18n'
