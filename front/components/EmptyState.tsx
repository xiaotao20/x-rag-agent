'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, Info } from 'lucide-react'

const HEADING_PHRASES = [
  '从你的知识库开始提问',
  '今天想了解点什么？',
  '让文档替你回答',
  '有问题，直接问知识库',
  '从一份文档开始探索',
]

const SUGGESTIONS = [
  'RAG 的常见步骤有哪些？',
  '总结一下我上传的文档',
  '文档里有哪些关键概念？',
]

interface EmptyStateProps {
  documentCount: number
  onPick: (question: string) => void
  onOpenLibrary: () => void
}

/** 无消息时的引导、打字机标题和随机话题。 */
export default function EmptyState({
  documentCount,
  onPick,
  onOpenLibrary,
}: EmptyStateProps) {
  const [typedHeading, setTypedHeading] = useState('')

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTypedHeading(HEADING_PHRASES[0])
      return
    }

    let cancelled = false
    let timer: number | undefined
    let phraseIndex = 0
    let charCount = 0
    let deleting = false

    function tick() {
      if (cancelled) return
      const characters = Array.from(HEADING_PHRASES[phraseIndex])

      if (!deleting) {
        charCount += 1
        setTypedHeading(characters.slice(0, charCount).join(''))
        if (charCount >= characters.length) {
          deleting = true
          timer = window.setTimeout(tick, 5000)
        } else {
          timer = window.setTimeout(tick, 75)
        }
        return
      }

      charCount -= 1
      setTypedHeading(characters.slice(0, charCount).join(''))
      if (charCount <= 0) {
        deleting = false
        phraseIndex = (phraseIndex + 1) % HEADING_PHRASES.length
        timer = window.setTimeout(tick, 350)
      } else {
        timer = window.setTimeout(tick, 30)
      }
    }

    timer = window.setTimeout(tick, 300)
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [])

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-5 py-12 sm:px-6">
      <div className="animate-rise">
        <h2
          className="min-h-[1.25em] text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]"
          aria-label={HEADING_PHRASES[0]}
        >
          <span aria-hidden="true">{typedHeading}</span>
        </h2>
        <p className="mt-2 max-w-xl text-[14px] leading-7 text-muted">
          上传文档后，我会先检索相关片段，再基于证据回答，并在答案下方附上引用来源。
        </p>

        {documentCount === 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-warning/20 bg-warning-soft px-3 py-2 text-[12px] text-warning">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>知识库还是空的，先去资料库上传一份文档。</span>
            <button
              type="button"
              onClick={onOpenLibrary}
              className="ml-auto shrink-0 font-medium underline underline-offset-2"
            >
              去资料库
            </button>
          </div>
        )}

        <div className="mt-7 grid gap-2.5 sm:grid-cols-3">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onPick(suggestion)}
              className="group rounded-xl border border-line bg-surface px-3.5 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-card"
            >
              <span className="flex items-start justify-between gap-2 text-[13px] font-medium leading-5 text-ink">
                {suggestion}
                <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint transition-colors group-hover:text-accent" />
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 text-[11px] text-faint">
          <span className="rounded-full border border-line bg-surface px-2.5 py-1">
            带来源引用
          </span>
          <span className="rounded-full border border-line bg-surface px-2.5 py-1">
            流式回答
          </span>
          <span className="rounded-full border border-line bg-surface px-2.5 py-1">
            txt / md / pdf
          </span>
        </div>
      </div>
    </div>
  )
}
