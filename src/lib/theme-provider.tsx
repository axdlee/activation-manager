'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeId =
  | 'dark-tech'
  | 'midnight'
  | 'graphite'
  | 'aurora'
  | 'emerald'
  | 'violet'
  | 'crimson'
  | 'ocean'
  | 'amber'
  | 'sakura'
  | 'forest'
  | 'sunrise'
  | 'sepia'
  | 'mono'

export const THEMES: Array<{
  id: ThemeId
  name: string
  description: string
  preview: [string, string, string]
}> = [
  // ===== 深色系 =====
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
    id: 'emerald',
    name: '翡翠绿',
    description: '深绿科技感，清爽不刺眼',
    preview: ['#34be80', '#102219', '#0c1c14'],
  },
  {
    id: 'violet',
    name: '紫夜',
    description: '深紫赛博，神秘而有张力',
    preview: ['#8462ec', '#141226', '#0e0c1c'],
  },
  {
    id: 'crimson',
    name: '绯红',
    description: '深红激情，醒目而有力量',
    preview: ['#e05e74', '#1a1217', '#140e13'],
  },
  {
    id: 'ocean',
    name: '海洋青',
    description: '深青清新，像深海与极光',
    preview: ['#3ec2b2', '#102623', '#0c1e1b'],
  },
  {
    id: 'amber',
    name: '琥珀金',
    description: '深棕金调，沉稳奢雅',
    preview: ['#e4a444', '#1c1914', '#161410'],
  },
  // ===== 浅色系 =====
  {
    id: 'aurora',
    name: '极简浅色',
    description: '白底深字，适合日间办公',
    preview: ['#526aeb', '#ffffff', '#f7f8fc'],
  },
  {
    id: 'sakura',
    name: '樱花粉',
    description: '浅粉温柔，治愈系观感',
    preview: ['#e476a2', '#fffdfe', '#faf5f9'],
  },
  {
    id: 'forest',
    name: '森林绿',
    description: '浅绿自然，护眼清新',
    preview: ['#60c288', '#ffffff', '#fafdfb'],
  },
  {
    id: 'sunrise',
    name: '朝霞橙',
    description: '浅橙活力，温暖有朝气',
    preview: ['#ee8e58', '#fffdfa', '#fffaf5'],
  },
  {
    id: 'sepia',
    name: '复古纸',
    description: '米色纸感，怀旧文艺',
    preview: ['#c2ae84', '#fffefb', '#fcf9f2'],
  },
  {
    id: 'mono',
    name: '黑白极简',
    description: '纯黑白灰，极致克制',
    preview: ['#8e8e8e', '#ffffff', '#fafafa'],
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
