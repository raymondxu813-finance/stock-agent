import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MultiAgent Stock Discussion',
  description: '重大决定的 AI 顾问团',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  )
}
