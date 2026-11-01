'use client'

import AppShell from '@/components/AppShell'
import AuthGate from '@/components/AuthGate'

/** 受 AuthGate 保护的聊天工作台页面。 */
export default function ChatPage() {
  return (
    <AuthGate>{(user) => <AppShell user={user} />}</AuthGate>
  )
}
