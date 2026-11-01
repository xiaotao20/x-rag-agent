'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Library,
  Loader2,
  LogOut,
  Pencil,
  SquarePen,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { logout } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'
import type { ConversationSummary, WorkspaceView } from '@/lib/types'
import { cx, errorText } from '@/lib/utils'

interface SidebarProps {
  user: AuthUser
  online: boolean | null
  activeView: WorkspaceView
  onViewChange: (view: WorkspaceView) => void
  conversations: ConversationSummary[]
  conversationsLoading: boolean
  conversationsError: string | null
  activeConversationId: string | null
  onSelectConversation: (conversationId: string) => void
  onNewConversation: () => void
  onRefreshConversations: () => void
  onRenameConversation: (conversationId: string, title: string) => Promise<void>
  onDeleteConversation: (conversationId: string) => Promise<void>
  onClose?: () => void
}

/** 视图导航、会话列表和账号菜单侧栏。 */
export default function Sidebar({
  user,
  online,
  activeView,
  onViewChange,
  conversations,
  conversationsLoading,
  conversationsError,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onRefreshConversations,
  onRenameConversation,
  onDeleteConversation,
  onClose,
}: SidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)
  const [pendingDeleteConversation, setPendingDeleteConversation] = useState<string | null>(null)
  const [deletingConversation, setDeletingConversation] = useState<string | null>(null)
  const [conversationActionError, setConversationActionError] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)

  const pendingConversation = pendingDeleteConversation
    ? conversations.find((item) => item.id === pendingDeleteConversation) ?? null
    : null
  const accountName = user.display_name?.trim() || user.username
  const accountSubtitle = user.display_name?.trim() ? `@${user.username}` : '已登录'

  useEffect(() => {
    if (!accountOpen) return
    function onPointerDown(event: MouseEvent) {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [accountOpen])

  /** 退出登录并回到落地页。 */
  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logout()
    } catch {
      // 即使网络失败也回到登录页，由服务端 Cookie 兜底。
    } finally {
      window.location.assign('/?login=1')
    }
  }

  /** 进入会话重命名状态。 */
  function startRename(conversation: ConversationSummary) {
    setRenamingId(conversation.id)
    setRenameValue(conversation.title)
    setPendingDeleteConversation(null)
    setConversationActionError(null)
  }

  /** 退出会话重命名状态。 */
  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
    setConversationActionError(null)
  }

  /** 保存会话新标题。 */
  async function saveRename(conversationId: string) {
    const title = renameValue.trim()
    if (!title) {
      setConversationActionError('会话标题不能为空')
      return
    }
    setRenameSaving(true)
    setConversationActionError(null)
    try {
      await onRenameConversation(conversationId, title)
      setRenamingId(null)
      setRenameValue('')
    } catch (error) {
      setConversationActionError(errorText(error))
    } finally {
      setRenameSaving(false)
    }
  }

  /** 关闭删除确认框并清除操作错误。 */
  function cancelDeleteConversation() {
    if (deletingConversation) return
    setPendingDeleteConversation(null)
    setConversationActionError(null)
  }

  /** 确认删除会话并清理当前选中状态。 */
  async function confirmDeleteConversation(conversationId: string) {
    if (deletingConversation) return
    setDeletingConversation(conversationId)
    setConversationActionError(null)
    try {
      await onDeleteConversation(conversationId)
      setPendingDeleteConversation(null)
    } catch (error) {
      setConversationActionError(errorText(error))
    } finally {
      setDeletingConversation(null)
    }
  }

  return (
    <div className="flex h-full flex-col border-r border-line bg-canvas">
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0 flex-1 font-brand text-[18px] font-bold uppercase tracking-[0.08em]">
          X-AGENT
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

      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={onNewConversation}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-medium text-ink transition-colors hover:bg-subtle"
        >
          <SquarePen className="h-4 w-4" />
          新聊天
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-2 pb-3">
          <button
            type="button"
            onClick={() => onViewChange('library')}
            aria-current={activeView === 'library' ? 'page' : undefined}
            className={cx(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors',
              activeView === 'library'
                ? 'bg-subtle text-ink'
                : 'text-muted hover:bg-subtle hover:text-ink',
            )}
          >
            <Library className="h-4 w-4" />
            资料库
          </button>
        </div>

        <div className="flex items-center justify-between px-5 pb-1.5">
          <h2 className="text-[12px] font-medium text-faint">最近</h2>
        </div>

        <div className="space-y-0.5 px-2 pb-2">
          {conversationActionError && (
            <p className="mx-1 rounded-lg bg-danger-soft px-2 py-1.5 text-[11px] leading-5 text-danger">
              {conversationActionError}
            </p>
          )}
          {conversationsLoading && conversations.length === 0 ? (
            <div className="space-y-1">
              {[0, 1, 2].map((item) => (
                <div key={item} className="animate-pulse px-3 py-2">
                  <div className="h-2.5 w-2/3 rounded bg-subtle" />
                </div>
              ))}
            </div>
          ) : conversationsError ? (
            <div className="px-3 py-2 text-[11px] text-danger">
              <p>{conversationsError}</p>
              <button
                type="button"
                onClick={onRefreshConversations}
                className="mt-1 font-medium text-danger underline underline-offset-2"
              >
                重试
              </button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-3 py-3 text-left text-[13px] text-faint">
              还没有对话，点击“新对话”开始
            </div>
          ) : (
            conversations.map((conversation) => {
              const active = activeConversationId === conversation.id

              if (renamingId === conversation.id) {
                return (
                  <div
                    key={conversation.id}
                    className="rounded-lg bg-subtle/60 px-2 py-2"
                  >
                    <input
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void saveRename(conversation.id)
                        }
                        if (event.key === 'Escape') cancelRename()
                      }}
                      maxLength={120}
                      autoFocus
                      aria-label="会话标题"
                      className="h-8 w-full rounded-md border border-line bg-surface px-2 text-[12px] text-ink outline-none focus:border-accent"
                    />
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        type="button"
                        disabled={renameSaving}
                        onClick={() => void saveRename(conversation.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        {renameSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                        {renameSaving ? '保存中…' : '保存'}
                      </button>
                      <button
                        type="button"
                        disabled={renameSaving}
                        onClick={cancelRename}
                        className="rounded-md border border-line bg-surface px-2 py-1 text-[11px] text-muted transition-colors hover:bg-subtle"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={conversation.id}
                  className={cx(
                    'group/item flex items-center gap-0.5 rounded-lg transition-colors',
                    active ? 'bg-subtle' : 'hover:bg-subtle',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectConversation(conversation.id)}
                    title={conversation.title}
                    className="min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-[14px] text-ink"
                  >
                    {conversation.title}
                  </button>
                  <div className="flex shrink-0 items-center pr-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/item:opacity-100 sm:group-focus-within/item:opacity-100">
                    <button
                      type="button"
                      aria-label={`重命名会话 ${conversation.title}`}
                      title="重命名"
                      onClick={() => startRename(conversation)}
                      className="rounded-md p-1 text-faint transition-colors hover:bg-surface hover:text-ink"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`删除会话 ${conversation.title}`}
                      title="删除会话"
                      onClick={() => {
                        setConversationActionError(null)
                        setRenamingId(null)
                        setPendingDeleteConversation(conversation.id)
                      }}
                      className="rounded-md p-1 text-faint transition-colors hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div ref={accountRef} className="relative px-3 pb-3 pt-1">
        {accountOpen && (
          <div
            role="menu"
            className="absolute bottom-full left-3 right-3 z-20 mb-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
          >
            <div className="flex items-center gap-2.5 px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <UserRound className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium text-ink">
                  {accountName}
                </span>
                <span className="block truncate text-[12px] text-faint">
                  {accountSubtitle}
                </span>
              </span>
            </div>
            <div className="h-px bg-line" />
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] text-ink transition-colors hover:bg-subtle disabled:opacity-60"
            >
              {loggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted" />
              ) : (
                <LogOut className="h-4 w-4 text-muted" />
              )}
              {loggingOut ? '正在退出…' : '退出登录'}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setAccountOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={accountOpen}
          className={cx(
            'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-subtle',
            accountOpen && 'bg-subtle',
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <UserRound className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-ink">
              {accountName}
            </span>
            <span className="block truncate text-[11px] text-faint">
              {accountSubtitle}
            </span>
          </span>
        </button>
      </div>

      <ConfirmDialog
        open={pendingDeleteConversation !== null}
        title="删除对话？"
        description={
          <>
            这将永久删除「{pendingConversation?.title ?? '该对话'}」。此操作无法撤销。
          </>
        }
        confirmLabel="删除对话"
        busy={deletingConversation !== null}
        error={conversationActionError}
        onConfirm={() => {
          if (pendingDeleteConversation) {
            void confirmDeleteConversation(pendingDeleteConversation)
          }
        }}
        onCancel={cancelDeleteConversation}
      />
    </div>
  )
}
