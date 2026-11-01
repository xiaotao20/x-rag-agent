'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Menu } from 'lucide-react'
import Composer from './Composer'
import EmptyState from './EmptyState'
import Message from './Message'
import { getConversation, streamChat } from '@/lib/api'
import type {
  ChatMessage,
  MessageStatus,
  StoredConversationMessage,
  StreamEvent,
} from '@/lib/types'
import { errorText } from '@/lib/utils'

interface ChatPanelProps {
  online: boolean | null
  documentCount: number
  onToggleSidebar: () => void
  onOpenLibrary: () => void
  conversationId: string | null
  onConversationChange: (conversationId: string | null) => void
  onConversationsChanged: () => void
}

/** 把后端持久化消息转换成前端消息。 */
function storedToChatMessage(message: StoredConversationMessage): ChatMessage {
  const status: MessageStatus =
    message.status === 'error'
      ? 'error'
      : message.status === 'stopped'
        ? 'stopped'
        : 'done'
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    sources: message.sources ?? undefined,
    tools: message.tool_calls?.map((call) => ({
      name: call.name,
      state: 'done' as const,
    })),
    status,
  }
}

/** 生成前端消息 ID。 */
function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

/** 消息列表、会话历史加载和 SSE 流式状态。 */
export default function ChatPanel({
  online,
  documentCount,
  onToggleSidebar,
  onOpenLibrary,
  conversationId,
  onConversationChange,
  onConversationsChanged,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const busyRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const skipLoadRef = useRef<string | null>(null)

  useEffect(() => {
    if (!stickToBottom.current) return
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages])

  useEffect(() => {
    if (conversationId && skipLoadRef.current === conversationId) {
      skipLoadRef.current = null
      setHistoryLoading(false)
      setHistoryError(null)
      return
    }

    abortRef.current?.abort()
    busyRef.current = false
    setStreaming(false)

    if (!conversationId) {
      setMessages([])
      setHistoryLoading(false)
      setHistoryError(null)
      return
    }

    let active = true
    setHistoryLoading(true)
    setHistoryError(null)
    setMessages([])

    getConversation(conversationId)
      .then((detail) => {
        if (!active) return
        setMessages(detail.messages.map(storedToChatMessage))
      })
      .catch((error) => {
        if (active) setHistoryError(errorText(error))
      })
      .finally(() => {
        if (active) setHistoryLoading(false)
      })

    return () => {
      active = false
    }
  }, [conversationId])

  /** 记录用户是否仍停留在消息底部。 */
  function handleScroll() {
    const element = scrollRef.current
    if (!element) return
    stickToBottom.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 96
  }

  /** 发送问题并通过 SSE 更新助手消息。 */
  async function send(raw?: string) {
    const question = (raw ?? input).trim()
    if (!question || busyRef.current || historyLoading) return

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
      if (event.type === 'conversation') {
        if (event.conversation_id !== conversationId) {
          skipLoadRef.current = event.conversation_id
          onConversationChange(event.conversation_id)
        }
        onConversationsChanged()
        return
      }
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
        onConversationsChanged()
        return
      }
      if (event.type === 'done') {
        updateAssistant((message) => ({ ...message, status: 'done' }))
        onConversationsChanged()
      }
    }

    try {
      await streamChat(question, conversationId, onEvent, controller.signal)
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

  /** 中断当前流式生成。 */
  function stop() {
    abortRef.current?.abort()
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="打开文档侧栏"
          className="absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-lg bg-surface/90 text-muted shadow-sm backdrop-blur transition-colors hover:text-ink lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          {historyLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" />
              正在加载会话…
            </div>
          ) : historyError ? (
            <div className="mx-auto mt-16 max-w-md rounded-2xl border border-danger/20 bg-danger-soft px-5 py-4 text-center">
              <p className="text-[13px] text-danger">{historyError}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 text-[12px] font-medium text-danger underline underline-offset-2"
              >
                重新加载
              </button>
            </div>
          ) : messages.length === 0 ? (
            <EmptyState
              documentCount={documentCount}
              onPick={(question) => void send(question)}
              onOpenLibrary={onOpenLibrary}
            />
          ) : (
            <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-14 sm:px-6 lg:pt-8">
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
