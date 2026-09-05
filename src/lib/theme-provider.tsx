'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeId = 'dark-tech' | 'midnight' | 'graphite' | 'aurora'

export const THEMES: Array<{
  id: ThemeId
  name: string
  description: string
  preview: [string, string, string]
}> = [
  {
    id: 'dark-tech',
    name: '深空科技',
    description: '深蓝黑底 + 品牌光晕，默认主题',
    preview: ['#5b74f4', '#111420', '#0d0f1a'],
  },
  {
    id: 'midnight',
    name: '午夜蓝',
    description: '冷调蓝黑，更沉静的夜间观感',
    preview: ['#4f64e8', '#101326', '#0c0f1c'],
  },
  {
    id: 'graphite',
    name: '石墨灰',
    description: '中性灰阶，克制商务感',
    preview: ['#586ace', '#14161e', '#0f1117'],
  },
  {
    id: 'aurora',
    name: '极简浅色',
    description: '白底深字，适合日间办公',
    preview: ['#526aeb', '#ffffff', '#f7f8fc'],
  },
]

const THEME_STORAGE_KEY = 'activation-manager-theme'

type ThemeContextValue = {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark-tech',
  setTheme: () => undefined,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('dark-tech')

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null
    if (stored && THEMES.some((item) => item.id === stored)) {
      setThemeState(stored)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    root.classList.add('theme-transition')
    const timer = window.setTimeout(() => root.classList.remove('theme-transition'), 400)
    return () => window.clearTimeout(timer)
  }, [theme])

  const setTheme = useCallback((nextTheme: ThemeId) => {
    setThemeState(nextTheme)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    } catch {
      // localStorage 不可用时静默降级
    }
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
