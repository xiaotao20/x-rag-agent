'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff, Loader2, LockKeyhole, UserRound } from 'lucide-react'
import { loginAccount, registerAccount } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'
import { cx, errorText } from '@/lib/utils'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/

type Mode = 'login' | 'register'

/** 账号登录/注册表单。 */
export default function AccountAuthForm({
  onAuthenticated,
}: {
  onAuthenticated: (user: AuthUser) => void
}) {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRegister = mode === 'register'

  /** 切换登录/注册模式并重置密码字段。 */
  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setPassword('')
    setConfirmPassword('')
  }

  /** 校验表单并提交登录或注册请求。 */
  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!USERNAME_RE.test(username)) {
      setError('账号需为 3-32 位字母、数字或下划线')
      return
    }
    if (isRegister && password.length < 8) {
      setError('密码至少 8 位')
      return
    }
    if (!password) {
      setError('请输入密码')
      return
    }
    if (isRegister && password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      const user = isRegister
        ? await registerAccount(username, password)
        : await loginAccount(username, password)
      onAuthenticated(user)
    } catch (submitError) {
      setError(errorText(submitError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <div>
        <label className="mb-2 block text-[12px] font-medium text-slate-300" htmlFor="auth-username">
          账号
        </label>
        <div className="flex h-12 items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] transition-colors focus-within:border-cyan-400/60">
          <UserRound className="ml-3 h-4 w-4 shrink-0 text-slate-500" />
          <input
            id="auth-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoFocus
            placeholder="3-32 位字母、数字或下划线"
            maxLength={32}
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-600"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-[12px] font-medium text-slate-300" htmlFor="auth-password">
          密码
        </label>
        <div className="flex h-12 items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] transition-colors focus-within:border-cyan-400/60">
          <LockKeyhole className="ml-3 h-4 w-4 shrink-0 text-slate-500" />
          <input
            id="auth-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            placeholder={isRegister ? '至少 8 位' : '请输入密码'}
            maxLength={128}
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-600"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
            className="mr-2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:text-slate-300"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {isRegister && (
        <div>
          <label className="mb-2 block text-[12px] font-medium text-slate-300" htmlFor="auth-confirm">
            确认密码
          </label>
          <div className="flex h-12 items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] transition-colors focus-within:border-cyan-400/60">
            <LockKeyhole className="ml-3 h-4 w-4 shrink-0 text-slate-500" />
            <input
              id="auth-confirm"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="再次输入密码"
              maxLength={128}
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-600"
            />
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-[12px] leading-5 text-rose-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className={cx(
          'flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all',
          loading
            ? 'cursor-wait bg-white/20 text-slate-300'
            : 'bg-gradient-to-r from-cyan-300 to-blue-500 text-slate-950 shadow-[0_10px_30px_-12px_rgba(34,211,238,0.65)] hover:from-cyan-200 hover:to-blue-400',
        )}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? '请稍候…' : isRegister ? '创建账号' : '登录'}
      </button>

      <p className="text-center text-[12px] text-slate-400">
        {isRegister ? '已经有账号？' : '还没有账号？'}
        <button
          type="button"
          onClick={() => switchMode(isRegister ? 'login' : 'register')}
          className="ml-1 font-medium text-cyan-300 transition-colors hover:text-cyan-200"
        >
          {isRegister ? '去登录' : '立即注册'}
        </button>
      </p>

      <p className="text-center text-[11px] leading-5 text-slate-500">
        继续即表示同意
        <a href="#" className="mx-1 text-slate-300 underline-offset-2 hover:text-cyan-300">
          用户协议
        </a>
        和
        <a href="#" className="mx-1 text-slate-300 underline-offset-2 hover:text-cyan-300">
          隐私政策
        </a>
      </p>
    </form>
  )
}
