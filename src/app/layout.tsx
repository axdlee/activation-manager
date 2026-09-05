import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

import { ToastProvider } from '@/components/toast-provider'
import { ThemeProvider } from '@/lib/theme-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: '激活码管理系统',
    template: '%s | 激活码管理系统',
  },
  description: '支持多项目、时间型/次数型授权与 API 接入文档的激活码管理系统。',
}

const themeInitScript = `
(function () {
  try {
    var theme = localStorage.getItem('activation-manager-theme')
    if (theme && ['dark-tech', 'midnight', 'graphite', 'aurora'].indexOf(theme) !== -1) {
      document.documentElement.setAttribute('data-theme', theme)
    }
  } catch (e) {}
})()
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh" data-theme="dark-tech">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
