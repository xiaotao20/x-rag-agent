'use client'

import { useState } from 'react'
import { ChevronDown, FileText, Quote } from 'lucide-react'
import type { SourceItem } from '@/lib/types'
import { cx, formatScore } from '@/lib/utils'

export default function Sources({ sources }: { sources: SourceItem[] }) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface/80">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-canvas/50"
      >
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
          <Quote className="h-3.5 w-3.5" />
          引用来源
          <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[10px] text-muted">
            {sources.length}
          </span>
        </span>
        <ChevronDown
          className={cx(
            'h-3.5 w-3.5 text-faint transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="space-y-1 border-t border-line p-1.5">
          {sources.map((source, index) => {
            const isExpanded = expanded === index
            return (
              <div key={`${source.document_id}-${source.chunk_index}`}>
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : index)}
                  aria-expanded={isExpanded}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-canvas/70',
                    isExpanded && 'bg-canvas/70',
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink">
                    {source.source}
                  </span>
                  <span className="shrink-0 text-[10px] text-faint">
                    #{source.chunk_index}
                  </span>
                  <span
                    className="shrink-0 rounded bg-subtle px-1.5 py-0.5 text-[10px] text-muted"
                    title="Chroma 向量距离，数值越小越相似"
                  >
                    距离 {formatScore(source.score)}
                  </span>
                </button>
                {isExpanded && (
                  <div className="mx-2 mb-2 mt-1 max-h-52 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-canvas/80 px-3 py-2 text-[12px] leading-6 text-muted">
                    {source.content}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
