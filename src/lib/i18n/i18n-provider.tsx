'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

import zhCN from './zh-CN'
import enUS from './en-US'

export type SupportedLocale = 'zh-CN' | 'en-US'

const translations: Record<SupportedLocale, Record<string, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

const STORAGE_KEY = 'activation-manager-locale'

type I18nContextValue = {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
  t: (key: string, fallback?: string) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh-CN',
  setLocale: () => {},
  t: (key: string) => key,
})

export function useI18n() {
  return useContext(I18nContext)
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>('zh-CN')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as SupportedLocale | null
      if (stored && (stored === 'zh-CN' || stored === 'en-US')) {
        setLocaleState(stored)
      }
    } catch {
      // localStorage 不可用时静默降级
    }
  }, [])

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale)
    localStorage.setItem(STORAGE_KEY, newLocale)
  }

  const t = (key: string, fallback?: string): string => {
    const dict = translations[locale]
    return dict[key] ?? fallback ?? key
  }

  // SSR 时使用默认 locale（zh-CN），hydrate 后由客户端接管
  // 始终提供 Context 以确保 useI18n 在 SSR 期间也能正确返回翻译文本
  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
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