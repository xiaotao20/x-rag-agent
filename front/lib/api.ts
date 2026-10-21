import type { DocumentItem, IngestResponse, SourceItem, StreamEvent } from './types'

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000'
).replace(/\/+$/, '')

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    if (typeof data?.detail === 'string') return data.detail
    return JSON.stringify(data)
  } catch {
    return response.statusText || `HTTP ${response.status}`
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, init)
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

export function checkHealth(): Promise<{ status: string }> {
  return requestJson('/api/v1/health')
}

export function listDocuments(): Promise<DocumentItem[]> {
  return requestJson('/api/v1/documents')
}

export async function uploadDocument(file: File): Promise<IngestResponse> {
  const form = new FormData()
  form.append('file', file)
  return requestJson('/api/v1/documents', { method: 'POST', body: form })
}

export function deleteDocument(
  documentId: string,
): Promise<{ document_id: string; chunks_deleted: number }> {
  return requestJson(`/api/v1/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  })
}

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

export type ResumeDecision = {
  type: 'approve' | 'reject'
  message?: string
}

/**
 * POST SSE 无法使用原生 EventSource，这里用 fetch + ReadableStream 手动解析。
 * 后端每条事件格式为 `data: <JSON>\n\n`。
 */
async function streamSSE(
  path: string,
  body: Record<string, unknown>,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
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

export function streamChat(
  question: string,
  threadId: string,
  memory: boolean,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return streamSSE(
    '/api/v1/chat/stream',
    { question, thread_id: threadId, memory },
    onEvent,
    signal,
  )
}

export function streamResume(
  threadId: string,
  memory: boolean,
  decisions: ResumeDecision[],
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return streamSSE(
    '/api/v1/chat/stream/resume',
    { thread_id: threadId, memory, decisions },
    onEvent,
    signal,
  )
}
