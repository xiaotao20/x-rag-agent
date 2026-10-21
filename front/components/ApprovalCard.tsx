'use client'

import { Check, Shield, X } from 'lucide-react'
import type { InterruptPayload } from '@/lib/types'

const TOOL_LABELS: Record<string, string> = {
  search_knowledge_base: '检索知识库',
}

interface ApprovalCardProps {
  payload: InterruptPayload
  onApprove: () => void
  onReject: () => void
}

export default function ApprovalCard({
  payload,
  onApprove,
  onReject,
}: ApprovalCardProps) {
  return (
    <div className="mt-3 rounded-xl border border-warning/25 bg-warning-soft/60 p-3">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
          <Shield className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-warning">需要确认</p>
          <p className="mt-0.5 text-[12px] leading-5 text-muted">
            模型请求执行以下工具，确认后才会检索知识库。
          </p>

          <div className="mt-2 space-y-1.5">
            {payload.action_requests.map((action, index) => {
              const fallback = typeof action.args.query === 'string' ? `查询：${action.args.query}` : ''
              return (
                <div
                  key={`${action.name}-${index}`}
                  className="rounded-lg border border-warning/15 bg-surface/80 px-2.5 py-2"
                >
                  <div className="text-[12px] font-medium text-ink">
                    {TOOL_LABELS[action.name] ?? action.name}
                  </div>
                  <div className="mt-0.5 text-[12px] leading-5 text-muted">
                    {action.description || fallback}
                  </div>
                </div>
              )
            })}
          </div>

          {payload.action_requests.length > 1 && (
            <p className="mt-2 text-[11px] text-faint">
              共 {payload.action_requests.length} 个操作，将统一应用你的选择。
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onApprove}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12px] font-medium text-white transition-colors hover:bg-accent-hover"
            >
              <Check className="h-3.5 w-3.5" />
              允许
            </button>
            <button
              type="button"
              onClick={onReject}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12px] font-medium text-muted transition-colors hover:bg-subtle hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
              拒绝
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
