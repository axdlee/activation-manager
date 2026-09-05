'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'

export type ToastType = 'success' | 'error' | 'info'

export type ToastItem = {
  id: string
  type: ToastType
  title: string
  message?: string
}

type ToastInput = {
  title?: string
  message?: string
}

type ToastContextValue = {
  toast: {
    success: (message: string, options?: ToastInput) => void
    error: (message: string, options?: ToastInput) => void
    info: (message: string, options?: ToastInput) => void
  }
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_DURATION: Record<ToastType, number> = {
  success: 3200,
  error: 5200,
  info: 3600,
}

let toastCounter = 0

function buildToastId() {
  toastCounter += 1
  return `toast-${Date.now()}-${toastCounter}`
}

const toastIconMap: Record<ToastType, React.ReactNode> = {
  success: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M5 10.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path d="M10 9v5M10 6.2v.1" strokeLinecap="round" />
    </svg>
  ),
}

const toastToneMap: Record<ToastType, { icon: string; bar: string; title: string }> = {
  success: {
    icon: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    bar: 'bg-emerald-500',
    title: '操作成功',
  },
  error: {
    icon: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
    bar: 'bg-rose-500',
    title: '操作失败',
  },
  info: {
    icon: 'bg-brand-500/15 text-brand-400 border-brand-500/20',
    bar: 'bg-brand-500',
    title: '提示',
  },
}

function resolveTitle(type: ToastType, options: ToastInput | undefined) {
  if (options?.title) return options.title
  return toastToneMap[type].title
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (type: ToastType, message: string, options?: ToastInput) => {
      const id = buildToastId()
      setToasts((current) => [...current.slice(-4), { id, type, title: resolveTitle(type, options), message }])
      const timer = setTimeout(() => dismiss(id), TOAST_DURATION[type])
      timersRef.current.set(id, timer)
    },
    [dismiss],
  )

  const toast = useMemo(
    () => ({
      success: (message: string, options?: ToastInput) => push('success', message, options),
      error: (message: string, options?: ToastInput) => push('error', message, options),
      info: (message: string, options?: ToastInput) => push('info', message, options),
    }),
    [push],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast 视口 */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2.5"
      >
        {toasts.map((item) => {
          const tone = toastToneMap[item.type]
          return (
            <div
              key={item.id}
              role="status"
              className="pointer-events-auto relative overflow-hidden rounded-lg border border-surface-200 bg-surface-100 shadow-modal animate-toast-in"
            >
              <div className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} />
              <div className="flex items-start gap-3 pl-4 pr-3 py-3">
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${tone.icon}`}
                >
                  {toastIconMap[item.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink-50">{item.title}</div>
                  {item.message ? (
                    <div className="mt-0.5 text-sm leading-6 text-ink-400">{item.message}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="关闭提示"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-500 transition hover:bg-surface-50 hover:text-ink-200"
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
                    <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast 必须在 ToastProvider 内使用')
  }
  return context
}

export function useOptionalToast(): { toast: ToastContextValue['toast'] | null } {
  const context = useContext(ToastContext)
  return context ? { toast: context.toast } : { toast: null }
}
