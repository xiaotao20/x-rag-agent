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

export type ToolActionRequest = {
  name: string
  args: Record<string, unknown>
  description?: string
}

export type ReviewConfig = {
  action_name: string
  allowed_decisions: Array<'approve' | 'edit' | 'reject'>
}

export type InterruptPayload = {
  action_requests: ToolActionRequest[]
  review_configs: ReviewConfig[]
}

export type MessageStatus =
  | 'streaming'
  | 'done'
  | 'error'
  | 'stopped'
  | 'awaiting_approval'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceItem[]
  tools?: ToolRun[]
  interrupt?: InterruptPayload
  status: MessageStatus
  error?: string
}

export type StreamEvent =
  | { type: 'thread'; thread_id: string; memory: boolean }
  | { type: 'token'; content: string }
  | { type: 'tool_start'; name: string; args?: unknown }
  | { type: 'tool_end'; name: string }
  | {
      type: 'interrupt'
      thread_id: string
      action_requests: ToolActionRequest[]
      review_configs: ReviewConfig[]
    }
  | { type: 'sources'; sources: SourceItem[] }
  | { type: 'done' }
  | { type: 'error'; message: string }
