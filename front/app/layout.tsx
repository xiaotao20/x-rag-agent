import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

// 字体文件随项目分发，构建和运行都不再访问 Google Fonts。
const brandFont = localFont({
  src: './fonts/SpaceGrotesk-Variable.woff2',
  weight: '300 700',
  style: 'normal',
  variable: '--font-space-grotesk',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'X-AGENT',
  description: '基于 FastAPI + LangChain + Chroma 的企业知识库检索问答',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f5f1',
}

/** 全局 HTML 布局和页面元信息。 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={brandFont.variable}>
      <body>{children}</body>
    </html>
  )
}
