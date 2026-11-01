'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { getMe } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'

type AuthGateChildren = ReactNode | ((user: AuthUser) => ReactNode)

/** 校验登录态后再渲染聊天工作台，并把当前用户传给子节点。 */
export default function AuthGate({ children }: { children: AuthGateChildren }) {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    let active = true
    getMe()
      .then((current) => {
        if (active) setUser(current)
      })
      .catch(() => {
        if (active) router.replace('/?login=1')
      })
    return () => {
      active = false
    }
  }, [router])

  if (user) {
    return <>{typeof children === 'function' ? children(user) : children}</>
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-canvas text-muted">
      <span className="inline-flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        正在验证登录状态…
      </span>
    </div>
  )
}
