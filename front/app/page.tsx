import type { Metadata } from 'next'
import LandingPage from '@/components/landing/LandingPage'

export const metadata: Metadata = {
  title: 'X-AGENT',
  description: '基于混合检索与 Agent 的企业知识库问答平台',
}

/** 产品落地页入口。 */
export default function Page() {
  return <LandingPage />
}
