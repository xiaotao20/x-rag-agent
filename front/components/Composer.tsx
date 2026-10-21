'use client'

import { useEffect, useRef } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { cx } from '@/lib/utils'

interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop: () => void
  streaming: boolean
  offline: boolean
}

export default function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  streaming,
  offline,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 176)}px`
  }, [value])

  return (
    <div className="shrink-0 border-t border-line/70 bg-canvas/90 px-3 pb-3 pt-3 backdrop-blur sm:px-6 sm:pb-4">
      <form
        className="mx-auto max-w-3xl"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <div
          className={cx(
            'rounded-2xl border border-line bg-surface p-2 shadow-card transition-all',
            !streaming && 'focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent-soft',
          )}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            maxLength={4000}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                onSubmit()
              }
            }}
            placeholder="问点什么，比如：这个项目的部署步骤是什么？"
            aria-label="输入问题"
            className="max-h-44 min-h-[44px] w-full resize-none bg-transparent px-2.5 py-2 text-[14px] leading-6 outline-none placeholder:text-faint"
          />
          <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
            <span className="hidden text-[11px] text-faint sm:block">
              Enter 发送 · Shift + Enter 换行
            </span>
            <span className="text-[11px] text-faint sm:hidden">
              {value.length > 0 ? `${value.length}/4000` : '输入问题'}
            </span>
            <div className="flex items-center gap-2">
              {value.length > 3600 && (
                <span className="text-[11px] text-warning">{value.length}/4000</span>
              )}
              {streaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12px] font-medium text-muted transition-colors hover:bg-subtle hover:text-ink"
                >
                  <Square className="h-3 w-3 fill-current" />
                  停止
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!value.trim()}
                  aria-label="发送"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line disabled:text-faint"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        {offline && (
          <p className="mt-2 text-center text-[11px] text-danger">
            后端服务离线，请先启动 FastAPI（默认 http://127.0.0.1:8000）
          </p>
        )}
      </form>
    </div>
  )
}
