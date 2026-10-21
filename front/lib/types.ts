export interface SourceItem {
  document_id: string
  source: string
  chunk_index: number
  content: string
  score?: number | null
}

export interface DocumentItem {
  document_id: string
  source: string
  chunks: number
}

export interface IngestResponse {
  document_id: string
  filename: string
  chunks_created: number
  message: string
}

export type ToolRun = {
  name: string
  state: 'running' | 'done'
}

export type MessageStatus = 'streaming' | 'done' | 'error' | 'stopped'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceItem[]
  tools?: ToolRun[]
  status: MessageStatus
  error?: string
}

export type StreamEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_start'; name: string; args?: unknown }
  | { type: 'tool_end'; name: string }
  | { type: 'sources'; sources: SourceItem[] }
  | { type: 'done' }
  | { type: 'error'; message: string }
