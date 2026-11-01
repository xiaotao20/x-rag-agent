import type {
  ConversationDetail,
  ConversationSummary,
  DocumentItem,
  IngestResponse,
  SourceItem,
  StreamEvent,
} from './types'

/** 浏览器访问后端的基地址；空值表示走 Next 同源代理。 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(
  /\/+$/,
  '',
)

/** API 请求错误。 */
export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** 读取后端错误响应并提取可读信息。 */
async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (typeof data?.detail === 'string') return data.detail
    return JSON.stringify(data)
  } catch {
    return response.statusText || `HTTP ${response.status}`
  }
}

/** 发送 JSON 请求并统一处理错误。 */
async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...init,
    })
  } catch {
    throw new ApiError(
      '无法连接后端服务，请确认 FastAPI 已启动（默认 http://127.0.0.1:8000）',
      0,
    )
  }
  if (!response.ok) {
    throw new ApiError(await readError(response), response.status)
  }
  return (await response.json()) as T
}

/** 检查后端健康状态。 */
export function checkHealth(): Promise<{ status: string }> {
  return requestJson('/api/v1/health')
}

/** 获取已入库文档列表。 */
export function listDocuments(): Promise<DocumentItem[]> {
  return requestJson('/api/v1/documents')
}

/** 上传文档。 */
export async function uploadDocument(file: File): Promise<IngestResponse> {
  const form = new FormData()
  form.append('file', file)
  return requestJson('/api/v1/documents', { method: 'POST', body: form })
}

/** 删除文档及其片段。 */
export function deleteDocument(
  documentId: string,
): Promise<{ document_id: string; chunks_deleted: number }> {
  return requestJson(`/api/v1/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  })
}

/** 直接调用检索接口。 */
export function searchKnowledge(
  query: string,
  topK?: number,
): Promise<{ query: string; results: SourceItem[] }> {
  return requestJson('/api/v1/retrieval/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(topK ? { query, top_k: topK } : { query }),
  })
}

/** 获取当前用户会话列表。 */
export function listConversations(): Promise<ConversationSummary[]> {
  return requestJson('/api/v1/conversations')
}

/** 获取会话详情和历史消息。 */
export function getConversation(
  conversationId: string,
): Promise<ConversationDetail> {
  return requestJson(`/api/v1/conversations/${encodeURIComponent(conversationId)}`)
}

/** 重命名会话。 */
export function renameConversation(
  conversationId: string,
  title: string,
): Promise<ConversationSummary> {
  return requestJson(
    `/api/v1/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    },
  )
}

/** 删除会话。 */
export function deleteConversation(
  conversationId: string,
): Promise<{ ok: boolean }> {
  return requestJson(`/api/v1/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
  })
}

/**
 * POST SSE 无法使用原生 EventSource，这里用 fetch + ReadableStream 手动解析。
 * 后端每条事件格式为 `data: <JSON>\n\n`。
 */
/** 通过 fetch 读取 POST SSE 流并逐事件回调。 */
export async function streamChat(
  question: string,
  conversationId: string | null,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/v1/chat/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(
        conversationId ? { question, conversation_id: conversationId } : { question },
      ),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('无法连接后端服务，请确认 FastAPI 已启动', 0)
  }

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status)
  }
  if (!response.body) {
    throw new ApiError('当前浏览器不支持流式响应', 0)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finished = false

  while (!finished) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      for (const line of frame.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload) continue
        try {
          const event = JSON.parse(payload) as StreamEvent
          onEvent(event)
          if (event.type === 'done') finished = true
        } catch {
          // 忽略无法解析的心跳或非 JSON 帧
        }
      }
      boundary = buffer.indexOf('\n\n')
    }
  }
}
