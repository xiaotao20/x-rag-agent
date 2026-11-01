'use client'

import { useEffect, useRef, useState } from 'react'
import {
  FileText,
  LayoutGrid,
  Library,
  List,
  Loader2,
  Menu,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { deleteDocument, uploadDocument } from '@/lib/api'
import type { DocumentItem } from '@/lib/types'
import { cx, errorText, formatBytes } from '@/lib/utils'

type Layout = 'grid' | 'list'

const LAYOUT_STORAGE_KEY = 'rag-library-layout'
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['txt', 'md', 'pdf']

/** 根据扩展名返回文档类型标签和配色。 */
function documentType(source: string) {
  const extension = source.split('.').pop()?.toLowerCase() ?? ''
  if (extension === 'pdf') {
    return { label: 'PDF', iconClass: 'text-rose-500', badgeClass: 'bg-rose-50 text-rose-600' }
  }
  if (extension === 'md') {
    return { label: 'MD', iconClass: 'text-sky-500', badgeClass: 'bg-sky-50 text-sky-600' }
  }
  return { label: 'TXT', iconClass: 'text-slate-500', badgeClass: 'bg-slate-100 text-slate-600' }
}

interface LibraryPanelProps {
  documents: DocumentItem[]
  loading: boolean
  error: string | null
  onRefresh: () => Promise<void>
  onToggleSidebar: () => void
}

/** 资料库页面：文档卡片/列表切换、刷新和删除。 */
export default function LibraryPanel({
  documents,
  loading,
  error,
  onRefresh,
  onToggleSidebar,
}: LibraryPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [layout, setLayout] = useState<Layout>('grid')
  const [pendingDocument, setPendingDocument] = useState<DocumentItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(LAYOUT_STORAGE_KEY) === 'list') setLayout('list')
    } catch {
      // 本地存储不可用时保持默认卡片视图。
    }
  }, [])

  /** 切换视图并记住用户选择。 */
  function changeLayout(next: Layout) {
    setLayout(next)
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, next)
    } catch {
      // 忽略本地存储写入失败。
    }
  }

  /** 校验并上传文档，成功后刷新资料库。 */
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
      await onRefresh()
    } catch (uploadFailure) {
      setUploadError(errorText(uploadFailure))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  /** 关闭删除确认框并清除错误。 */
  function cancelDelete() {
    if (deletingId) return
    setPendingDocument(null)
    setDeleteError(null)
  }

  /** 删除文档并刷新资料库。 */
  async function confirmDelete(document: DocumentItem) {
    if (deletingId) return
    setDeletingId(document.document_id)
    setDeleteError(null)
    try {
      await deleteDocument(document.document_id)
      setPendingDocument(null)
      await onRefresh()
    } catch (deleteFailure) {
      setDeleteError(errorText(deleteFailure))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="relative flex min-w-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="打开侧栏"
        className="absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-lg bg-surface/90 text-muted shadow-sm backdrop-blur transition-colors hover:text-ink lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-14 sm:px-6 lg:pt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-[24px] font-semibold tracking-tight">资料库</h2>
              <p className="mt-1 text-[12px] text-muted">
                共 {documents.length} 个文档 · 上传后自动切分并写入向量库
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {uploading ? '上传中…' : '新增文档'}
              </button>
              <button
                type="button"
                onClick={() => void onRefresh()}
                disabled={loading}
                aria-label="刷新文档列表"
                title="刷新文档列表"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[12px] font-medium text-muted shadow-sm transition-colors hover:bg-subtle hover:text-ink disabled:opacity-60"
              >
                <RefreshCw className={cx('h-3.5 w-3.5', loading && 'animate-spin')} />
                刷新
              </button>

              <div className="flex items-center rounded-lg border border-line bg-surface p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => changeLayout('grid')}
                  aria-label="卡片视图"
                  title="卡片视图"
                  aria-pressed={layout === 'grid'}
                  className={cx(
                    'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                    layout === 'grid'
                      ? 'bg-accent-soft text-accent'
                      : 'text-muted hover:text-ink',
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => changeLayout('list')}
                  aria-label="列表视图"
                  title="列表视图"
                  aria-pressed={layout === 'list'}
                  className={cx(
                    'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                    layout === 'list'
                      ? 'bg-accent-soft text-accent'
                      : 'text-muted hover:text-ink',
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {uploadError && (
            <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-[12px] text-danger">
              {uploadError}
            </p>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".txt,.md,.pdf"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />

          {loading && documents.length === 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-[170px] animate-pulse rounded-2xl border border-line bg-surface"
                />
              ))}
            </div>
          ) : error ? (
            <div className="mt-10 rounded-2xl border border-danger/20 bg-danger-soft px-6 py-10 text-center">
              <p className="text-[13px] text-danger">{error}</p>
              <button
                type="button"
                onClick={() => void onRefresh()}
                className="mt-3 text-[12px] font-medium text-danger underline underline-offset-2"
              >
                重新加载
              </button>
            </div>
          ) : documents.length === 0 ? (
            <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-16 text-center">
              <Library className="h-9 w-9 text-faint" />
              <p className="mt-3 text-[14px] font-medium">资料库还是空的</p>
              <p className="mt-1 text-[12px] text-muted">
                上传 PDF、Markdown 或 TXT 文档，自动切分后即可问答。
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {uploading ? '上传中…' : '新增文档'}
              </button>
            </div>
          ) : layout === 'grid' ? (
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {documents.map((document) => {
                const type = documentType(document.source)
                return (
                  <article
                    key={document.document_id}
                    className="group flex min-h-[170px] flex-col rounded-2xl border border-line bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-pop"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cx(
                          'rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide',
                          type.badgeClass,
                        )}
                      >
                        {type.label}
                      </span>
                      <h3
                        className="min-w-0 flex-1 truncate text-[13px] font-medium"
                        title={document.source}
                      >
                        {document.source}
                      </h3>
                    </div>

                    <div className="flex flex-1 items-center justify-center py-6">
                      <FileText className={cx('h-14 w-14 stroke-[1.3]', type.iconClass)} />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-faint">
                        {document.chunks} 个片段
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null)
                          setPendingDocument(document)
                        }}
                        aria-label={`删除 ${document.source}`}
                        title="删除文档"
                        className="rounded-md p-1.5 text-faint transition-colors hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              <ul className="divide-y divide-line">
                {documents.map((document) => {
                  const type = documentType(document.source)
                  return (
                    <li
                      key={document.document_id}
                      className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-canvas/50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas">
                        <FileText className={cx('h-4 w-4', type.iconClass)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium" title={document.source}>
                          {document.source}
                        </p>
                        <p className="text-[11px] text-faint">
                          {type.label} · {document.chunks} 个片段
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null)
                          setPendingDocument(document)
                        }}
                        aria-label={`删除 ${document.source}`}
                        title="删除文档"
                        className="rounded-md p-1.5 text-faint transition-colors hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pendingDocument !== null}
        title="删除文档？"
        description={
          pendingDocument
            ? `这将永久删除「${pendingDocument.source}」及其 ${pendingDocument.chunks} 个片段。此操作无法撤销。`
            : '这将永久删除该文档及其所有片段。此操作无法撤销。'
        }
        confirmLabel="删除文档"
        busy={deletingId !== null}
        error={deleteError}
        onConfirm={() => {
          if (pendingDocument) {
            void confirmDelete(pendingDocument)
          }
        }}
        onCancel={cancelDelete}
      />
    </div>
  )
}
