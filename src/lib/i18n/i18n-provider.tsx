'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import zhCN from './zh-CN'
import enUS from './en-US'

export type SupportedLocale = 'zh-CN' | 'en-US'

export const LOCALES: Array<{ id: SupportedLocale; label: string }> = [
  { id: 'zh-CN', label: '中文' },
  { id: 'en-US', label: 'English' },
]

const translations: Record<SupportedLocale, Record<string, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
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
    const lower = tag.toLowerCase()
    if (lower.startsWith('zh')) {
      return 'zh-CN'
    }
    if (lower.startsWith('en')) {
      return 'en-US'
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
  t: (key: string, fallback?: string) => translations['zh-CN'][key] ?? fallback ?? key,
})

export function useI18n() {
  return useContext(I18nContext)
}

/**
 * 预置脚本：在 hydration 前同步 locale，避免「中文闪切英文」FOUC。
 * 读取顺序与 provider 一致：localStorage 手动选择 > cookie > 浏览器语言。
 * 由 layout 内联注入，并同时设置 <html lang>。
 */
export const localeInitScript = `(function(){try{var K='${STORAGE_KEY}';var L=null;try{L=window.localStorage.getItem(K)}catch(e){}if(L!=='zh-CN'&&L!=='en-US'){L=null}if(!L){var m=document.cookie.match(/(?:^|;\\s*)${STORAGE_KEY}=([^;]+)/);if(m&&(m[1]==='zh-CN'||m[1]==='en-US')){L=m[1]}}if(!L){var ls=(navigator.languages||[]).concat([navigator.language]).filter(Boolean);for(var i=0;i<ls.length;i++){var t=String(ls[i]).toLowerCase();if(t.indexOf('zh')===0){L='zh-CN';break}if(t.indexOf('en')===0){L='en-US';break}}}if(!L){L='zh-CN'}document.documentElement.lang=L==='zh-CN'?'zh':'en';window.__AM_LOCALE__=L}catch(e){}})()`

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // 初始值固定 zh-CN：SSR/hydration 标签一致；真实 locale 在挂载后立即接管
  // （首帧前 localeInitScript 已设置 <html lang>，避免可见的语言闪烁）
  const [locale, setLocaleState] = useState<SupportedLocale>('zh-CN')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as SupportedLocale | null
      if (stored === 'zh-CN' || stored === 'en-US') {
        setLocaleState(stored)
        return
      }
    } catch {
      // localStorage 不可用时走 cookie / 浏览器语言
    }

    const cookieMatch = document.cookie.match(new RegExp(`(?:^|;\\s*)${STORAGE_KEY}=([^;]+)`))
    if (cookieMatch && (cookieMatch[1] === 'zh-CN' || cookieMatch[1] === 'en-US')) {
      setLocaleState(cookieMatch[1] as SupportedLocale)
      return
    }

    setLocaleState(detectBrowserLocale())
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale === 'zh-CN' ? 'zh' : 'en'
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
      const dict = translations[locale]
      return dict[key] ?? translations['zh-CN'][key] ?? fallback ?? key
    },
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useI18n()

  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}
      className={`rounded-md border border-surface-200 bg-surface-100 px-3 py-1.5 text-xs font-medium text-ink-300 transition hover:text-ink-50 ${className}`}
      title={locale === 'zh-CN' ? 'Switch to English' : '切换为中文'}
    >
      {locale === 'zh-CN' ? 'EN' : '中文'}
    </button>
  )
}
