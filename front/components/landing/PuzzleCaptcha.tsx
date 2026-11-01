'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { getCaptchaChallenge, verifyCaptcha } from '@/lib/auth'
import type { CaptchaChallenge } from '@/lib/auth'
import { errorText } from '@/lib/utils'

const PHONE_RE = /^\d{11}$/

type Status = 'loading' | 'ready' | 'verifying' | 'verified' | 'error'

/** 可选的拼图人机验证组件。 */
export default function PuzzleCaptcha({
  phone,
  onVerified,
  onReset,
}: {
  phone: string
  onVerified: (ticket: string) => void
  onReset?: () => void
}) {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null)
  const [offset, setOffset] = useState(0)
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')
  const phoneRef = useRef(phone)

  /** 加载新的拼图挑战并重置进度。 */
  const loadChallenge = useCallback(async () => {
    setStatus('loading')
    setOffset(0)
    setMessage('')
    try {
      const next = await getCaptchaChallenge()
      setChallenge(next)
      setStatus('ready')
    } catch (error) {
      setStatus('error')
      setMessage(errorText(error))
    }
  }, [])

  useEffect(() => {
    void loadChallenge()
  }, [loadChallenge])

  useEffect(() => {
    if (phoneRef.current === phone) return
    phoneRef.current = phone
    if (status === 'verified' || status === 'verifying') {
      setStatus('ready')
      setOffset(0)
      setMessage('')
    }
  }, [phone, status])

  /** 提交滑动偏移并处理验证成功或失败。 */
  async function handleVerify() {
    if (!challenge || status !== 'ready') return
    if (!PHONE_RE.test(phone)) {
      setMessage('请先输入 11 位手机号')
      return
    }

    const verifyPhone = phone
    setStatus('verifying')
    setMessage('')
    try {
      const result = await verifyCaptcha({
        challenge_id: challenge.challenge_id,
        offset,
        phone: verifyPhone,
      })
      if (phoneRef.current !== verifyPhone) return
      setStatus('verified')
      setMessage('验证通过')
      onVerified(result.ticket)
    } catch (error) {
      if (phoneRef.current !== verifyPhone) return
      setStatus('ready')
      setOffset(0)
      setMessage(errorText(error))
    }
  }

  const maxOffset = challenge
    ? challenge.image_width - challenge.piece_width
    : 0
  const pieceLeft = challenge ? (offset / challenge.image_width) * 100 : 0
  const pieceTop = challenge
    ? (challenge.piece_y / challenge.image_height) * 100
    : 0
  const pieceWidth = challenge
    ? (challenge.piece_width / challenge.image_width) * 100
    : 0
  const pieceHeight = challenge
    ? (challenge.piece_height / challenge.image_height) * 100
    : 0

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-300/80">
          人机验证
        </span>
        <button
          type="button"
          onClick={() => {
            onReset?.()
            void loadChallenge()
          }}
          disabled={status === 'loading' || status === 'verifying'}
          className="inline-flex items-center gap-1 text-[11px] text-slate-400 transition-colors hover:text-cyan-300 disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${status === 'loading' ? 'animate-spin' : ''}`} />
          换一张
        </button>
      </div>

      <div className="relative aspect-[2/1] w-full overflow-hidden rounded-xl border border-white/10 bg-[#020617]">
        {challenge ? (
          <>
            <img
              src={`data:image/png;base64,${challenge.background}`}
              alt="拼图验证背景"
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full select-none"
            />
            <img
              src={`data:image/png;base64,${challenge.piece}`}
              alt=""
              draggable={false}
              className="pointer-events-none absolute select-none drop-shadow-[0_0_10px_rgba(34,211,238,0.45)]"
              style={{
                left: `${pieceLeft}%`,
                top: `${pieceTop}%`,
                width: `${pieceWidth}%`,
                height: `${pieceHeight}%`,
              }}
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            {status === 'error' ? '拼图加载失败' : '正在生成拼图…'}
          </div>
        )}

        {status === 'verified' && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-400/10 backdrop-blur-[1px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              人机验证通过
            </span>
          </div>
        )}

        {status === 'verifying' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
          </div>
        )}
      </div>

      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={maxOffset}
          value={offset}
          onChange={(event) => setOffset(Number(event.target.value))}
          onPointerUp={() => void handleVerify()}
          onKeyUp={(event) => {
            if (event.key === 'Enter') void handleVerify()
          }}
          disabled={!challenge || status === 'loading' || status === 'verifying' || status === 'verified'}
          aria-label="拖动滑块完成拼图"
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
          <span className="text-slate-500">
            {status === 'verified' ? '已完成，可以发送验证码' : '拖动滑块，让拼图块对准缺口'}
          </span>
          {message && (
            <span
              className={
                status === 'verified'
                  ? 'text-emerald-300'
                  : 'text-rose-300'
              }
            >
              {message}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
