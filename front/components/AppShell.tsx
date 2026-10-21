'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import ChatPanel from './ChatPanel'
import Sidebar from './Sidebar'
import { checkHealth, listDocuments } from '@/lib/api'
import type { DocumentItem } from '@/lib/types'
import { cx, errorText } from '@/lib/utils'

const HOVER_OPEN_DELAY = 120
const HOVER_CLOSE_DELAY = 220
const SIDEBAR_TRANSITION_MS = 300
const PIN_SETTLE_MS = SIDEBAR_TRANSITION_MS + 20

export default function AppShell() {
  const [pinned, setPinned] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(true)
  const [documentsError, setDocumentsError] = useState<string | null>(null)
  const [online, setOnline] = useState<boolean | null>(null)
  const openTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const pinTimerRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function ping() {
      try {
        await checkHealth()
        if (!cancelled) setOnline(true)
      } catch {
        if (!cancelled) setOnline(false)
      }
    }

    void ping()
    const timer = window.setInterval(ping, 30000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const loadDocuments = useCallback(async () => {
    setDocumentsLoading(true)
    setDocumentsError(null)
    try {
      setDocuments(await listDocuments())
      setOnline(true)
    } catch (error) {
      setDocumentsError(errorText(error))
      setOnline(false)
    } finally {
      setDocumentsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPreviewOpen(false)
        setMobileOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    return () => {
      if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current)
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
      if (pinTimerRef.current !== null) window.clearTimeout(pinTimerRef.current)
    }
  }, [])

  function cancelPreviewOpen() {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
  }

  function cancelPreviewClose() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  function schedulePreviewOpen() {
    if (pinned) return
    cancelPreviewClose()
    cancelPreviewOpen()
    openTimerRef.current = window.setTimeout(() => {
      setPreviewOpen(true)
      openTimerRef.current = null
    }, HOVER_OPEN_DELAY)
  }

  function schedulePreviewClose() {
    if (pinned) return
    cancelPreviewOpen()
    cancelPreviewClose()
    closeTimerRef.current = window.setTimeout(() => {
      setPreviewOpen(false)
      closeTimerRef.current = null
    }, HOVER_CLOSE_DELAY)
  }

  function cancelPinSettle() {
    if (pinTimerRef.current !== null) {
      window.clearTimeout(pinTimerRef.current)
      pinTimerRef.current = null
    }
  }

  function pinSidebar() {
    cancelPreviewOpen()
    cancelPreviewClose()
    cancelPinSettle()
    setPinned(true)
    if (previewOpen) {
      // 预览层先留在原位，等固定侧栏展开后再隐藏，避免切换瞬间闪一下。
      pinTimerRef.current = window.setTimeout(() => {
        setPreviewOpen(false)
        pinTimerRef.current = null
      }, PIN_SETTLE_MS)
    } else {
      setPreviewOpen(false)
    }
  }

  function unpinSidebar() {
    cancelPreviewOpen()
    cancelPreviewClose()
    cancelPinSettle()
    setPinned(false)
    setPreviewOpen(false)
  }

  function hideSidebar() {
    if (pinned) {
      unpinSidebar()
    } else {
      cancelPreviewOpen()
      cancelPreviewClose()
      setPreviewOpen(false)
    }
  }

  function toggleMobileSidebar() {
    setMobileOpen((value) => !value)
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-canvas text-ink">
      <aside
        className={cx(
          'relative hidden shrink-0 transition-[width] duration-300 ease-out lg:block',
          pinned ? 'w-[304px]' : 'w-0',
        )}
        aria-hidden={!pinned}
        inert={!pinned}
      >
        <div className="h-full overflow-hidden">
          <div
            className={cx(
              'h-full w-[304px] transition-transform duration-300 ease-out',
              pinned ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            <Sidebar
              documents={documents}
              loading={documentsLoading}
              error={documentsError}
              online={online}
              onRefresh={loadDocuments}
              onChanged={loadDocuments}
            />
          </div>
        </div>
        {pinned && !previewOpen && (
          <button
            type="button"
            onClick={unpinSidebar}
            aria-label="收起侧栏"
            title="收起侧栏"
            className="absolute left-full top-1/2 z-40 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-card transition-colors hover:bg-subtle hover:text-ink"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </aside>

      <div
        className={cx(
          'group fixed inset-y-0 left-0 z-30 hidden lg:block',
          pinned ? 'transition-none' : 'transition-[width] duration-300 ease-out',
          previewOpen ? 'w-[304px]' : 'w-3',
          pinned && 'pointer-events-none',
        )}
        onMouseEnter={schedulePreviewOpen}
        onMouseLeave={schedulePreviewClose}
      >
        <div
          className={cx(
            'relative h-full w-[304px]',
            previewOpen && 'shadow-pop',
            pinned ? 'transition-none' : 'transition-transform duration-300 ease-out',
            previewOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          aria-hidden={!previewOpen || pinned}
          inert={!previewOpen || pinned}
          onMouseMove={cancelPreviewClose}
          onClick={(event) => {
            const target = event.target as HTMLElement
            // 上传、删除、刷新等按钮保留原有交互，不在点击时切换为固定状态。
            if (target.closest('button, a, input, textarea, select, label, summary')) return
            pinSidebar()
          }}
        >
          <Sidebar
            documents={documents}
            loading={documentsLoading}
            error={documentsError}
            online={online}
            onRefresh={loadDocuments}
            onChanged={loadDocuments}
          />
          {previewOpen && (
            <button
              type="button"
              onClick={hideSidebar}
              onMouseEnter={cancelPreviewClose}
              onMouseLeave={schedulePreviewClose}
              aria-label="收起侧栏"
              title="收起侧栏"
              className="absolute right-0 top-1/2 z-40 flex h-7 w-7 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-card transition-colors hover:bg-subtle hover:text-ink"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>


      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="关闭侧栏"
            className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[304px] max-w-[86vw] shadow-pop">
            <Sidebar
              documents={documents}
              loading={documentsLoading}
              error={documentsError}
              online={online}
              onRefresh={loadDocuments}
              onChanged={loadDocuments}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <ChatPanel
        documentCount={documents.length}
        online={online}
        onToggleSidebar={toggleMobileSidebar}
      />
    </div>
  )
}
