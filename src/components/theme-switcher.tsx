'use client'

import React, { useEffect, useRef, useState } from 'react'

import { useI18n } from '@/lib/i18n/i18n-provider'
import { THEMES, useTheme, type ThemeId } from '@/lib/theme-provider'

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const current = THEMES.find((item) => item.id === theme) ?? THEMES[0]

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

  // 弹出定位自适应（fixed 视口坐标，逃逸抽屉/滚动容器的 overflow 裁剪）：
  // 垂直：上方放不下则向下；水平：右侧放不下则右对齐。
  const [menuPos, setMenuPos] = useState<React.CSSProperties>({})
  useEffect(() => {
    if (!open) return
    const compute = () => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const panelHeight = Math.min(window.innerHeight * 0.7, 416)
      const panelWidth = 256
      const dropUp = rect.top >= panelHeight + 12 || rect.top >= window.innerHeight - rect.bottom
      const alignRight = rect.right + panelWidth > window.innerWidth - 8
      setMenuPos({
        position: 'fixed',
        ...(dropUp
          ? { bottom: window.innerHeight - rect.top + 8 }
          : { top: rect.bottom + 8 }),
        ...(alignRight
          ? { right: window.innerWidth - rect.right }
          : { left: rect.left }),
        maxHeight: Math.min(window.innerHeight * 0.7, 416),
      })
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
    }
  }, [open])

  const handleSelect = (id: ThemeId) => {
    setTheme(id)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('theme.switchTitle', '切换主题')}
        className="inline-flex w-full items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground/80 shadow-sm transition-all hover:border-primary/40 hover:text-foreground"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex shrink-0 items-center">
            {current.preview.map((color, index) => (
              <span
                key={index}
                className="h-3.5 w-3.5 rounded-full border border-white/10"
                style={{ backgroundColor: color, marginLeft: index === 0 ? 0 : -5 }}
              />
            ))}
          </span>
          <span className={compact ? 'sr-only' : 'truncate'}>{current.name}</span>
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('theme.switchTitle', '切换主题')}
          style={menuPos}
          className="fixed z-[60] w-64 overflow-y-auto rounded-lg border border-border bg-card p-1.5 shadow-modal theme-scroll animate-fade-in"
        >
          {THEMES.map((item) => {
            const isActive = item.id === theme
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(item.id)}
                className={`flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-all ${
                  isActive
                    ? 'bg-primary/10 text-foreground'
                    : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <span className="mt-0.5 flex shrink-0 items-center">
                  {item.preview.map((color, index) => (
                    <span
                      key={index}
                      className="h-4 w-4 rounded-full border border-white/10"
                      style={{ backgroundColor: color, marginLeft: index === 0 ? 0 : -6 }}
                    />
                  ))}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.name}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                {isActive && (
                  <span className="ml-auto mt-0.5 text-primary">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                      <path d="M5 10.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
