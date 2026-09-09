'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import zhCN from './zh-CN'
import enUS from './en-US'
import jaJP from './translations/ja-JP-client'
import koKR from './translations/ko-KR-client'
import esES from './translations/es-ES-client'
import frFR from './translations/fr-FR-client'
import deDE from './translations/de-DE-client'
import ptBR from './translations/pt-BR-client'
import ruRU from './translations/ru-RU-client'
import arSA from './translations/ar-SA-client'

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

/** 语言注册表：id 为 BCP-47 locale；label 为该语言的母语自称（切换器显示用） */
export const LOCALES: Array<{ id: SupportedLocale; label: string; tagPrefixes: string[] }> = [
  { id: 'zh-CN', label: '中文', tagPrefixes: ['zh'] },
  { id: 'en-US', label: 'English', tagPrefixes: ['en'] },
  { id: 'ja-JP', label: '日本語', tagPrefixes: ['ja'] },
  { id: 'ko-KR', label: '한국어', tagPrefixes: ['ko'] },
  { id: 'es-ES', label: 'Español', tagPrefixes: ['es'] },
  { id: 'fr-FR', label: 'Français', tagPrefixes: ['fr'] },
  { id: 'de-DE', label: 'Deutsch', tagPrefixes: ['de'] },
  { id: 'pt-BR', label: 'Português (BR)', tagPrefixes: ['pt'] },
  { id: 'ru-RU', label: 'Русский', tagPrefixes: ['ru'] },
  { id: 'ar-SA', label: 'العربية', tagPrefixes: ['ar'] },
]

const LOCALE_IDS = LOCALES.map((l) => l.id)

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (LOCALE_IDS as string[]).includes(value)
}

/** BCP-47 tag → 受支持 locale（前缀匹配，含 zh-TW→zh-CN 等回退到主简中） */
export function matchLocale(tag: string): SupportedLocale | null {
  const lower = tag.toLowerCase()
  for (const locale of LOCALES) {
    if (locale.tagPrefixes.some((prefix) => lower === prefix || lower.startsWith(prefix + '-'))) {
      return locale.id
    }
  }
  return null
}

const translations: Partial<Record<SupportedLocale, Record<string, string>>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'ja-JP': jaJP,
  'ko-KR': koKR,
  'es-ES': esES,
  'fr-FR': frFR,
  'de-DE': deDE,
  'pt-BR': ptBR,
  'ru-RU': ruRU,
  'ar-SA': arSA,
}

const STORAGE_KEY = 'activation-manager-locale'

/** 从浏览器语言推导默认 locale（navigator.languages 依次匹配） */
export function detectBrowserLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') {
    return 'zh-CN'
  }

  const candidates = [
    ...(typeof navigator.languages !== 'undefined' ? navigator.languages : []),
    navigator.language,
  ].filter(Boolean) as string[]

  for (const tag of candidates) {
    const matched = matchLocale(tag)
    if (matched) {
      return matched
    }
  }

  return 'zh-CN'
}

/**
 * 与服务端约定的语言 cookie（server-i18n.ts LOCALE_COOKIE）。
 * API 按此 cookie 决定返回语言，保证页面语言与接口报错语言一致。
 */
export function writeLocaleCookie(locale: SupportedLocale) {
  try {
    document.cookie = `${STORAGE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`
  } catch {
    // cookie 不可用时静默降级（仍存 localStorage 供前端使用）
  }
}

type I18nContextValue = {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
  t: (key: string, fallback?: string) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh-CN',
  setLocale: () => {},
  // 默认回退到中文翻译：即使组件未包裹 I18nProvider（如 SSR 或单测），
  // t() 也能返回可读的中文文案而非原始 key
  t: (key: string, fallback?: string) => translations['zh-CN']?.[key] ?? fallback ?? key,
})

export function useI18n() {
  return useContext(I18nContext)
}

/**
 * 预置脚本：在 hydration 前同步 locale，避免「中文闪切英文」FOUC。
 * 读取顺序与 provider 一致：localStorage 手动选择 > cookie > 浏览器语言。
 * 由 layout 内联注入，并同时设置 <html lang>。
 */
export const localeInitScript = `(function(){try{var K='${STORAGE_KEY}';var M=[["zh", "zh-CN"], ["en", "en-US"], ["ja", "ja-JP"], ["ko", "ko-KR"], ["es", "es-ES"], ["fr", "fr-FR"], ["de", "de-DE"], ["pt", "pt-BR"], ["ru", "ru-RU"], ["ar", "ar-SA"]];function ml(t){t=String(t).toLowerCase();for(var i=0;i<M.length;i++){var p=M[i][0];if(t===p||t.indexOf(p+'-')===0){return M[i][1]}}return null}var L=null;try{L=window.localStorage.getItem(K)}catch(e){}if(!ml(L)){L=null}if(!L){var m=document.cookie.match(/(?:^|;\\s*)${STORAGE_KEY}=([^;]+)/);if(m){L=ml(decodeURIComponent(m[1]))}}if(!L){var ls=(navigator.languages||[]).concat([navigator.language]).filter(Boolean);for(var j=0;j<ls.length;j++){L=ml(ls[j]);if(L){break}}}if(!L){L='zh-CN'}document.documentElement.lang=L.split('-')[0];document.documentElement.dir=L==='ar-SA'?'rtl':'ltr';window.__AM_LOCALE__=L}catch(e){}})()`

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // 初始值固定 zh-CN：SSR/hydration 标签一致；真实 locale 在挂载后立即接管
  // （首帧前 localeInitScript 已设置 <html lang>，避免可见的语言闪烁）
  const [locale, setLocaleState] = useState<SupportedLocale>('zh-CN')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (isSupportedLocale(stored)) {
        setLocaleState(stored)
        return
      }
    } catch {
      // localStorage 不可用时走 cookie / 浏览器语言
    }

    const cookieMatch = document.cookie.match(new RegExp(`(?:^|;\\s*)${STORAGE_KEY}=([^;]+)`))
    if (cookieMatch && isSupportedLocale(cookieMatch[1])) {
      setLocaleState(cookieMatch[1])
      return
    }

    setLocaleState(detectBrowserLocale())
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale.split('-')[0]
    document.documentElement.dir = locale === 'ar-SA' ? 'rtl' : 'ltr'
  }, [locale])

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale)
    try {
      localStorage.setItem(STORAGE_KEY, newLocale)
    } catch {
      // 忽略存储失败
    }
    writeLocaleCookie(newLocale)
  }, [])

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const dict = translations[locale] ?? translations['en-US']
      return dict?.[key] ?? translations['zh-CN']?.[key] ?? fallback ?? key
    },
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useI18n()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const current = LOCALES.find((item) => item.id === locale) ?? LOCALES[0]

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-surface-200 bg-surface-100 px-3 py-1.5 text-xs font-medium text-ink-300 transition hover:text-ink-50"
        title="Language / 语言"
      >
        <span aria-hidden>🌐</span>
        {current.label}
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1 max-h-72 w-40 overflow-y-auto rounded-md border border-surface-200 bg-surface-50 py-1 shadow-lg"
        >
          {LOCALES.map((item) => (
            <li key={item.id} role="option" aria-selected={item.id === locale}>
              <button
                type="button"
                onClick={() => {
                  setLocale(item.id)
                  setOpen(false)
                }}
                className={`block w-full px-3 py-1.5 text-left text-xs transition hover:bg-surface-100 ${
                  item.id === locale ? 'font-semibold text-brand-400' : 'text-ink-300'
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
