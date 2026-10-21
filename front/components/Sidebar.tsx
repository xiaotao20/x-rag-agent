'use client'

import { useRef, useState } from 'react'
import {
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { deleteDocument, uploadDocument } from '@/lib/api'
import type { DocumentItem } from '@/lib/types'
import { cx, errorText, formatBytes } from '@/lib/utils'

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['txt', 'md', 'pdf']

interface SidebarProps {
  documents: DocumentItem[]
  loading: boolean
  error: string | null
  online: boolean | null
  onRefresh: () => void
  onChanged: () => void
  onClose?: () => void
}

export default function Sidebar({
  documents,
  loading,
  error,
  online,
  onRefresh,
  onChanged,
  onClose,
}: SidebarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setUploadError('仅支持 .txt、.md、.pdf 文件')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(`文件不能超过 ${formatBytes(MAX_UPLOAD_BYTES)}`)
      return
    }

    setUploading(true)
    setUploadError(null)
    try {
      await uploadDocument(file)
      await onChanged()
    } catch (error) {
      setUploadError(errorText(error))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(document: DocumentItem) {
    setDeletingId(document.document_id)
    setDeleteError(null)
    try {
      await deleteDocument(document.document_id)
      setPendingDelete(null)
      await onChanged()
    } catch (error) {
      setDeleteError(errorText(error))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex h-full flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-accent to-accent-ink text-white shadow-card">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-tight">X RAG Agent</div>
          <div className="text-[12px] text-muted">知识库工作台</div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭侧栏"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-subtle hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mx-4 mb-4 flex items-center gap-2 rounded-xl border border-line bg-canvas/60 px-3 py-2 text-[12px]">
        <span
          className={cx(
            'h-1.5 w-1.5 rounded-full',
            online === null ? 'bg-faint' : online ? 'bg-success' : 'bg-danger',
          )}
        />
        <span className="text-muted">
          {online === null ? '连接中…' : online ? '服务正常' : '服务离线'}
        </span>
      </div>

      <div className="px-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            void handleFile(event.dataTransfer.files?.[0])
          }}
          disabled={uploading}
          className={cx(
            'flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-5 text-center transition-colors',
            dragging
              ? 'border-accent bg-accent-soft'
              : 'border-line bg-canvas/40 hover:border-accent/50 hover:bg-accent-soft/60',
            uploading && 'cursor-wait opacity-70',
          )}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          ) : (
            <UploadCloud className="h-5 w-5 text-muted" />
          )}
          <span className="mt-2 text-[13px] font-medium">
            {uploading ? '正在解析并入库…' : '上传文档'}
          </span>
          <span className="mt-0.5 text-[11px] text-muted">
            拖拽或点击 · txt / md / pdf · ≤ 20MB
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.pdf"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        {uploadError && (
          <p className="mt-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-[12px] text-danger">
            {uploadError}
          </p>
        )}
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-5 pb-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            知识库
          </h2>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-faint">{documents.length}</span>
            <button
              type="button"
              onClick={onRefresh}
              aria-label="刷新文档列表"
              title="刷新文档列表"
              className="rounded-md p-1.5 text-faint transition-colors hover:bg-subtle hover:text-ink"
            >
              <RefreshCw className={cx('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {loading && documents.length === 0 ? (
            <div className="space-y-2 px-2">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex animate-pulse items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-subtle" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-2/3 rounded bg-subtle" />
                    <div className="h-2 w-1/3 rounded bg-subtle" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="mx-1 rounded-xl border border-danger/20 bg-danger-soft px-3 py-2.5">
              <p className="text-[12px] text-danger">{error}</p>
              <button
                type="button"
                onClick={onRefresh}
                className="mt-2 text-[12px] font-medium text-danger underline underline-offset-2"
              >
                重试
              </button>
            </div>
          ) : documents.length === 0 ? (
            <div className="mx-2 rounded-xl border border-dashed border-line px-3 py-6 text-center">
              <FileText className="mx-auto h-5 w-5 text-faint" />
              <p className="mt-2 text-[12px] text-muted">还没有文档</p>
              <p className="mt-0.5 text-[11px] text-faint">
                上传后会自动切分并写入向量库
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {documents.map((document) => {
                const isPending = pendingDelete === document.document_id
                const isDeleting = deletingId === document.document_id
                return (
                  <li key={document.document_id}>
                    {isPending ? (
                      <div className="rounded-xl border border-danger/20 bg-danger-soft px-2.5 py-2">
                        <p className="text-[12px] leading-5 text-danger">
                          删除「{document.source}」及其 {document.chunks} 个片段？
                        </p>
                        <div className="mt-1.5 flex gap-1.5">
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => void handleDelete(document)}
                            className="inline-flex items-center gap-1 rounded-md bg-danger px-2 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                          >
                            {isDeleting && <Loader2 className="h-3 w-3 animate-spin" />}
                            {isDeleting ? '删除中…' : '删除'}
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => setPendingDelete(null)}
                            className="rounded-md border border-line bg-surface px-2 py-1 text-[11px] text-muted transition-colors hover:bg-subtle"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-canvas/70">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-muted">
                          <FileText className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className="truncate text-[13px] font-medium"
                            title={document.source}
                          >
                            {document.source}
                          </div>
                          <div className="text-[11px] text-faint">
                            {document.chunks} 个片段
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label={`删除 ${document.source}`}
                          onClick={() => {
                            setDeleteError(null)
                            setPendingDelete(document.document_id)
                          }}
                          className="rounded-md p-1 text-faint opacity-100 transition-all hover:bg-danger-soft hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {deleteError && (
            <p className="mx-2 mt-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-[12px] text-danger">
              {deleteError}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-line px-5 py-3 text-[11px] leading-relaxed text-faint">
        回答基于 Chroma 向量检索，引用片段可展开查看。
      </div>
    </div>
  )
}
