'use client'

import { useEffect } from 'react'
import { Search, ShieldCheck, Sparkles, X } from 'lucide-react'
import AccountAuthForm from './AccountAuthForm'

/** 账号登录/注册模态框。 */
export default function LoginModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#020617]/80 p-0 backdrop-blur-md sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        className="relative w-full max-w-4xl overflow-hidden rounded-t-3xl border border-white/10 bg-[#080f24] shadow-[0_30px_120px_-20px_rgba(0,0,0,0.9)] sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭登录框"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400 transition-colors hover:border-white/20 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="grid md:grid-cols-[0.9fr_1.1fr]">
          <div className="relative hidden overflow-hidden border-r border-white/10 bg-gradient-to-br from-cyan-500/10 via-blue-600/10 to-violet-600/10 p-8 md:flex md:flex-col md:justify-between">
            <div className="absolute -left-16 top-24 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

            <div className="relative">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-500 text-slate-950 shadow-[0_0_30px_-6px_rgba(34,211,238,0.8)]">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold tracking-tight text-white">X RAG</span>
              </div>

              <h2 className="mt-10 max-w-xs text-2xl font-semibold leading-tight tracking-tight text-white">
                把团队知识
                <span className="block bg-gradient-to-r from-cyan-200 to-violet-300 bg-clip-text text-transparent">
                  变成可对话的资产
                </span>
              </h2>
              <p className="mt-3 max-w-xs text-[13px] leading-6 text-slate-400">
                混合检索、Rerank 与 Agent 协作，让每个回答都有出处。
              </p>
            </div>

            <div className="relative space-y-3">
              {[
                { icon: Search, text: '向量 + BM25 混合召回' },
                { icon: ShieldCheck, text: '引用可追溯，回答有依据' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-[12px] text-slate-300">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-cyan-300">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {text}
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="mb-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-cyan-300/80">
                Welcome back
              </p>
              <h2 id="login-title" className="mt-2 text-xl font-semibold tracking-tight text-white">
                登录 X RAG
              </h2>
              <p className="mt-1.5 text-[12px] leading-5 text-slate-400">
                使用账号密码登录，或创建一个新账号。
              </p>
            </div>

            <AccountAuthForm
              onAuthenticated={() => {
                onClose()
                window.location.assign('/chat')
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
