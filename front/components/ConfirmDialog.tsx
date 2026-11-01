'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

/** 全屏遮罩上的确认对话框，用于删除等不可撤销操作。 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = '取消',
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const onCancelRef = useRef(onCancel)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    onCancelRef.current = onCancel
  })

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancelRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, busy])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/30 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="animate-rise w-full max-w-[440px] rounded-3xl border border-line bg-surface p-6 shadow-pop"
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id="confirm-dialog-title"
            className="text-[18px] font-semibold tracking-tight text-ink"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="关闭确认框"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-subtle hover:text-ink disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-1.5 text-[14px] leading-6 text-muted">{description}</div>

        {error && (
          <p className="mt-4 rounded-xl bg-danger-soft px-3 py-2 text-[12px] leading-5 text-danger">
            {error}
          </p>
        )}

        <div className="mt-7 flex justify-end gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border border-accent/60 bg-surface px-4 py-2 text-[14px] font-medium text-accent transition-colors hover:bg-accent-soft disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-danger-tint px-4 py-2 text-[14px] font-medium text-danger transition-colors hover:brightness-[0.97] disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {busy ? '删除中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
