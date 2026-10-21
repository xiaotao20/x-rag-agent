'use client'

import { useEffect, useRef, useState } from 'react'
import { Menu, Plus } from 'lucide-react'
import Composer from './Composer'
import EmptyState from './EmptyState'
import Message from './Message'
import { streamChat } from '@/lib/api'
import type { ChatMessage, StreamEvent } from '@/lib/types'
import { cx, errorText } from '@/lib/utils'

interface ChatPanelProps {
  online: boolean | null
  documentCount: number
  onToggleSidebar: () => void
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

export default function ChatPanel({
  online,
  documentCount,
  onToggleSidebar,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const busyRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  useEffect(() => {
    if (!stickToBottom.current) return
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages])

  function handleScroll() {
    const element = scrollRef.current
    if (!element) return
    stickToBottom.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 96
  }

  async function send(raw?: string) {
    const question = (raw ?? input).trim()
    if (!question || busyRef.current) return

    busyRef.current = true
    setStreaming(true)
    setInput('')
    stickToBottom.current = true

    const assistantId = newId()
    const userMessage: ChatMessage = {
      id: newId(),
      role: 'user',
      content: question,
      status: 'done',
    }
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      tools: [],
      status: 'streaming',
    }
    setMessages((previous) => [...previous, userMessage, assistantMessage])

    const controller = new AbortController()
    abortRef.current = controller

    const updateAssistant = (updater: (message: ChatMessage) => ChatMessage) => {
      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantId ? updater(message) : message,
        ),
      )
    }

    const onEvent = (event: StreamEvent) => {
      if (event.type === 'token') {
        updateAssistant((message) => ({
          ...message,
          content: message.content + event.content,
        }))
        return
      }
      if (event.type === 'tool_start') {
        updateAssistant((message) => ({
          ...message,
          tools: [...(message.tools ?? []), { name: event.name, state: 'running' }],
        }))
        return
      }
      if (event.type === 'tool_end') {
        updateAssistant((message) => {
          const tools = [...(message.tools ?? [])]
          for (let index = tools.length - 1; index >= 0; index -= 1) {
            if (tools[index].name === event.name && tools[index].state === 'running') {
              tools[index] = { ...tools[index], state: 'done' }
              break
            }
          }
          return { ...message, tools }
        })
        return
      }
      if (event.type === 'sources') {
        updateAssistant((message) => ({ ...message, sources: event.sources }))
        return
      }
      if (event.type === 'error') {
        updateAssistant((message) => ({
          ...message,
          status: 'error',
          error: event.message,
        }))
        return
      }
      if (event.type === 'done') {
        updateAssistant((message) => ({ ...message, status: 'done' }))
      }
    }

    try {
      await streamChat(question, onEvent, controller.signal)
      updateAssistant((message) =>
        message.status === 'streaming' ? { ...message, status: 'done' } : message,
      )
    } catch (error) {
      const aborted =
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError')
      if (aborted) {
        updateAssistant((message) => ({ ...message, status: 'stopped' }))
      } else {
        updateAssistant((message) => ({
          ...message,
          status: 'error',
          error: errorText(error),
        }))
      }
    } finally {
      busyRef.current = false
      setStreaming(false)
      abortRef.current = null
    }
  }

  function stop() {
    abortRef.current?.abort()
  }

  function newChat() {
    abortRef.current?.abort()
    busyRef.current = false
    setStreaming(false)
    setMessages([])
    setInput('')
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-canvas/80 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="打开文档侧栏"
            className="rounded-lg border border-line bg-surface p-1.5 text-muted transition-colors hover:text-ink lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[14px] font-semibold tracking-tight">
              知识库问答
            </h1>
            <p className="hidden text-[11px] text-muted sm:block">
              基于已上传文档回答，并附带引用来源
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-muted sm:flex">
            <span
              className={cx(
                'h-1.5 w-1.5 rounded-full',
                online === null ? 'bg-faint' : online ? 'bg-success' : 'bg-danger',
              )}
            />
            {online === null ? '连接中' : online ? '在线' : '离线'}
          </span>
          <button
            type="button"
            onClick={newChat}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-medium shadow-sm transition-colors hover:bg-subtle"
          >
            <Plus className="h-3.5 w-3.5" />
            新对话
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          {messages.length === 0 ? (
            <EmptyState
              documentCount={documentCount}
              onPick={(question) => void send(question)}
              onOpenSidebar={onToggleSidebar}
            />
          ) : (
            <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-8 sm:px-6">
              <div className="space-y-8">
                {messages.map((message) => (
                  <Message key={message.id} message={message} />
                ))}
              </div>
            </div>
          )}
        </div>

        <Composer
          value={input}
          onChange={setInput}
          onSubmit={() => void send()}
          onStop={stop}
          streaming={streaming}
          offline={online === false}
        />
      </div>
    </div>
  )
}
