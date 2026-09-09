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
import serverMessagesJa from './translations/ja-JP-server'
import serverMessagesKo from './translations/ko-KR-server'
import serverMessagesEs from './translations/es-ES-server'
import serverMessagesFr from './translations/fr-FR-server'
import serverMessagesDe from './translations/de-DE-server'
import serverMessagesPt from './translations/pt-BR-server'
import serverMessagesRu from './translations/ru-RU-server'
import serverMessagesAr from './translations/ar-SA-server'

const serverMessages: Partial<Record<SupportedLocale, Record<string, string>>> = {
  'zh-CN': serverMessagesZh,
  'en-US': serverMessagesEn,
  'ja-JP': serverMessagesJa,
  'ko-KR': serverMessagesKo,
  'es-ES': serverMessagesEs,
  'fr-FR': serverMessagesFr,
  'de-DE': serverMessagesDe,
  'pt-BR': serverMessagesPt,
  'ru-RU': serverMessagesRu,
  'ar-SA': serverMessagesAr,
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
