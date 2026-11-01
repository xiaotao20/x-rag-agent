export interface SourceItem {
  document_id: string
  source: string
  chunk_index: number
  content: string
  score?: number | null
  score_type?: 'vector' | 'bm25' | 'rrf' | 'rerank'
  vector_distance?: number | null
  bm25_score?: number | null
  rerank_score?: number | null
}

export interface DocumentItem {
  document_id: string
  source: string
  chunks: number
}

export type WorkspaceView = 'chat' | 'library'

export interface IngestResponse {
  document_id: string
  filename: string
  chunks_created: number
  message: string
}

export interface ConversationSummary {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface StoredConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceItem[] | null
  tool_calls?: Array<{ name: string; args?: unknown }> | null
  status: string
  created_at: string
}

export interface ConversationDetail extends ConversationSummary {
  messages: StoredConversationMessage[]
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
  | { type: 'conversation'; conversation_id: string; title: string }
  | { type: 'intent'; intent: string }
  | { type: 'token'; content: string }
  | { type: 'tool_start'; name: string; args?: unknown }
  | { type: 'tool_end'; name: string }
  | { type: 'sources'; sources: SourceItem[] }
  | { type: 'done' }
  | { type: 'error'; message: string }
