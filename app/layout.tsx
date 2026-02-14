import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider, themeInitScript } from '@/lib/ThemeContext'

export const metadata: Metadata = {
  title: 'LeapAgents Stock Discussion',
  description: '重大决定的 AI 专家团',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 防闪烁：在 React 水合前设置 .dark 类 */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased bg-surface-page">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
