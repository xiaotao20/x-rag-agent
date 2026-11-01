import { Loader2, Sparkles } from 'lucide-react'
import Markdown from './Markdown'
import Sources from './Sources'
import type { ChatMessage } from '@/lib/types'

/** 用户或助手消息的渲染。 */
export default function Message({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="animate-rise flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-bubble-line bg-bubble px-4 py-2.5 text-[15px] leading-7 text-ink shadow-[0_1px_2px_rgba(36,56,143,0.04)]">
          {message.content}
        </div>
      </div>
    )
  }

  const streaming = message.status === 'streaming'

  return (
    <div className="animate-rise flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-accent shadow-sm">
        <Sparkles className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[12px] font-semibold text-ink">助手</span>
          {streaming && (
            <span
              role="status"
              aria-live="polite"
              className="animate-pulse-soft text-[11px] text-faint"
            >
              生成中…
            </span>
          )}
          {message.status === 'stopped' && (
            <span className="text-[11px] text-faint">已停止</span>
          )}
        </div>

        {message.content ? (
          <div className="max-w-reading text-[15px] leading-7 text-ink">
            <Markdown content={message.content} />
          </div>
        ) : streaming ? (
          <div className="flex items-center gap-2 py-1 text-[13px] text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
            正在检索并组织答案…
          </div>
        ) : message.status === 'stopped' ? (
          <p className="py-1 text-[13px] text-muted">已停止生成。</p>
        ) : null}

        {message.status === 'error' && (
          <div className="mt-3 rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-[12px] leading-5 text-danger">
            {message.error ?? '回答失败，请重试。'}
          </div>
        )}

        {message.sources && message.sources.length > 0 && (
          <Sources sources={message.sources} />
        )}
      </div>
    </div>
  )
}
