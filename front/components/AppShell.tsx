'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import ChatPanel from './ChatPanel'
import LibraryPanel from './LibraryPanel'
import Sidebar from './Sidebar'
import {
  checkHealth,
  deleteConversation,
  listConversations,
  listDocuments,
  renameConversation,
} from '@/lib/api'
import type { AuthUser } from '@/lib/auth'
import type { ConversationSummary, DocumentItem, WorkspaceView } from '@/lib/types'
import { cx, errorText } from '@/lib/utils'

const HOVER_OPEN_DELAY = 120
const HOVER_CLOSE_DELAY = 220
const SIDEBAR_TRANSITION_MS = 300
const PIN_SETTLE_MS = SIDEBAR_TRANSITION_MS + 20

/** 聊天工作台布局、会话/文档状态与侧栏交互。 */
export default function AppShell({ user }: { user: AuthUser }) {
  const [pinned, setPinned] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(true)
  const [documentsError, setDocumentsError] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [conversationsError, setConversationsError] = useState<string | null>(null)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [view, setView] = useState<WorkspaceView>('chat')
  const [online, setOnline] = useState<boolean | null>(null)
  const openTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const pinTimerRef = useRef<number | null>(null)
  const initialConversationSelected = useRef(false)

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

  /** 加载知识库文档列表。 */
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

  /** 加载会话列表，并在首次加载时恢复最近会话。 */
  const loadConversations = useCallback(async () => {
    setConversationsLoading(true)
    setConversationsError(null)
    try {
      const nextConversations = await listConversations()
      setConversations(nextConversations)
      if (!initialConversationSelected.current) {
        initialConversationSelected.current = true
        if (nextConversations.length > 0) {
          setActiveConversationId((current) => current ?? nextConversations[0].id)
        }
      }
    } catch (error) {
      setConversationsError(errorText(error))
    } finally {
      setConversationsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  /** 切换右侧工作区视图并关闭移动端侧栏。 */
  function changeView(next: WorkspaceView) {
    setView(next)
    setMobileOpen(false)
  }

  /** 清空当前会话，回到问答视图。 */
  function startNewConversation() {
    setView('chat')
    setActiveConversationId(null)
    setMobileOpen(false)
  }

  /** 切换当前会话，回到问答视图并关闭移动端侧栏。 */
  function selectConversation(conversationId: string) {
    setView('chat')
    setActiveConversationId(conversationId)
    setMobileOpen(false)
  }

  /** 重命名会话并同步本地列表。 */
  async function renameConversationItem(conversationId: string, title: string) {
    const updated = await renameConversation(conversationId, title)
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId ? updated : conversation,
      ),
    )
  }

  /** 删除会话；若为当前会话则回到新对话。 */
  async function deleteConversationItem(conversationId: string) {
    await deleteConversation(conversationId)
    setConversations((current) =>
      current.filter((conversation) => conversation.id !== conversationId),
    )
    setActiveConversationId((current) =>
      current === conversationId ? null : current,
    )
  }

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

  /** 取消延迟打开侧栏。 */
  function cancelPreviewOpen() {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
  }

  /** 取消延迟关闭侧栏。 */
  function cancelPreviewClose() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  /** 延迟打开悬停预览侧栏。 */
  function schedulePreviewOpen() {
    if (pinned) return
    cancelPreviewClose()
    cancelPreviewOpen()
    openTimerRef.current = window.setTimeout(() => {
      setPreviewOpen(true)
      openTimerRef.current = null
    }, HOVER_OPEN_DELAY)
  }

  /** 延迟关闭悬停预览侧栏。 */
  function schedulePreviewClose() {
    if (pinned) return
    cancelPreviewOpen()
    cancelPreviewClose()
    closeTimerRef.current = window.setTimeout(() => {
      setPreviewOpen(false)
      closeTimerRef.current = null
    }, HOVER_CLOSE_DELAY)
  }

  /** 取消侧栏固定过渡计时。 */
  function cancelPinSettle() {
    if (pinTimerRef.current !== null) {
      window.clearTimeout(pinTimerRef.current)
      pinTimerRef.current = null
    }
  }

  /** 固定侧栏并处理预览层过渡。 */
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

  /** 取消固定并收起侧栏。 */
  function unpinSidebar() {
    cancelPreviewOpen()
    cancelPreviewClose()
    cancelPinSettle()
    setPinned(false)
    setPreviewOpen(false)
  }

  /** 根据固定状态隐藏侧栏。 */
  function hideSidebar() {
    if (pinned) {
      unpinSidebar()
    } else {
      cancelPreviewOpen()
      cancelPreviewClose()
      setPreviewOpen(false)
    }
  }

  /** 切换移动端侧栏。 */
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
              user={user}
              online={online}
              activeView={view}
              onViewChange={changeView}
              conversations={conversations}
              conversationsLoading={conversationsLoading}
              conversationsError={conversationsError}
              activeConversationId={activeConversationId}
              onSelectConversation={selectConversation}
              onNewConversation={startNewConversation}
              onRefreshConversations={() => void loadConversations()}
              onRenameConversation={renameConversationItem}
              onDeleteConversation={deleteConversationItem}
            />
          </div>
        </div>
        {pinned && !previewOpen && (
          <div className="group/edge absolute left-full top-0 z-40 h-full w-3 -translate-x-1/2">
            <button
              type="button"
              onClick={unpinSidebar}
              aria-label="收起侧栏"
              title="收起侧栏"
              className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-muted opacity-0 shadow-card transition-opacity duration-150 hover:bg-subtle hover:text-ink group-hover/edge:opacity-100 focus-visible:opacity-100"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
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
            user={user}
            online={online}
            activeView={view}
            onViewChange={changeView}
            conversations={conversations}
            conversationsLoading={conversationsLoading}
            conversationsError={conversationsError}
            activeConversationId={activeConversationId}
            onSelectConversation={selectConversation}
            onNewConversation={startNewConversation}
            onRefreshConversations={() => void loadConversations()}
            onRenameConversation={renameConversationItem}
            onDeleteConversation={deleteConversationItem}
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
              user={user}
              online={online}
              activeView={view}
              onViewChange={changeView}
              conversations={conversations}
              conversationsLoading={conversationsLoading}
              conversationsError={conversationsError}
              activeConversationId={activeConversationId}
              onSelectConversation={selectConversation}
              onNewConversation={startNewConversation}
              onRefreshConversations={() => void loadConversations()}
              onRenameConversation={renameConversationItem}
              onDeleteConversation={deleteConversationItem}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {view === 'library' ? (
        <LibraryPanel
          documents={documents}
          loading={documentsLoading}
          error={documentsError}
          onRefresh={loadDocuments}
          onToggleSidebar={toggleMobileSidebar}
        />
      ) : (
        <ChatPanel
          documentCount={documents.length}
          online={online}
          onToggleSidebar={toggleMobileSidebar}
          onOpenLibrary={() => changeView('library')}
          conversationId={activeConversationId}
          onConversationChange={setActiveConversationId}
          onConversationsChanged={() => void loadConversations()}
        />
      )}
    </div>
  )
}
