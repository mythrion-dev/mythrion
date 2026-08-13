'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { RichTextEditor } from './RichTextEditor'
import { NotebookFolder } from './NotebookFolder'
import { NotebookPageItem } from './NotebookPageItem'

/* ── Types ── */

interface Page {
  id: string
  folderId: string | null
  title: string
  content: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface Folder {
  id: string
  name: string
  sortOrder: number
  pages: Page[]
}

interface Notebook {
  id: string
  adventureId: string
  userId: string
  folders: Folder[]
  pages: Page[]
  createdAt: string
  updatedAt: string
}

interface NotebookSidebarProps {
  readonly adventureId: string
  readonly isGM: boolean
  /** Force-open the sidebar (from tab button click) */
  readonly forceOpen?: boolean
  /** Called when sidebar should close (from tab button) */
  readonly onClose?: () => void
  /** Hide floating toggle button (adventure page already has tab) */
  readonly hideToggle?: boolean
  /** Disable all edits (campaign read-only) */
  readonly readOnly?: boolean
}

interface ContextMenuState {
  pageId: string
  x: number
  y: number
}

interface FolderDeleteDialogState {
  folderId: string
  moveToFolderId: string | null
}

interface NotebookBodyProps {
  readonly isLoading: boolean
  readonly error: string | null
  readonly notebook: Notebook | null
  readonly allPages: Page[]
  readonly activePage: Page | null
  readonly activePageId: string | null
  readonly expandedFolders: string[]
  readonly searchQuery: string
  readonly onSearchQueryChange: (v: string) => void
  readonly onClearSearch: () => void
  readonly onOpenPage: (id: string) => void
  readonly onPageClick: (id: string) => void
  readonly onToggleFolder: (id: string) => void
  readonly onCreatePage: (folderId?: string) => void
  readonly onCreateFolder: () => void
  readonly creatingPage: boolean
  readonly creatingFolder: boolean
  readonly onDeletePage: (id: string) => void
  readonly onRequestDeletePage: (id: string) => void
  readonly onPageContextMenu: (pageId: string, e: React.MouseEvent) => void
  readonly onPageDragStart: (pageId: string, e: React.DragEvent) => void
  readonly onDropOnFolder: (folderId: string, pageId: string) => void
  readonly onDragOverRoot: (e: React.DragEvent) => void
  readonly onDragLeaveRoot: (e: React.DragEvent) => void
  readonly onDropOnRoot: (e: React.DragEvent) => void
  readonly dragOverRoot: boolean
  readonly onRenameFolder: (id: string, name: string) => void
  readonly onDeleteFolderRequest: (id: string) => void
  readonly onRetry: () => void
  readonly onExitPage: () => void
  readonly onStartEdit: () => void
  readonly onExitEdit: () => void
  readonly onDeleteRequest: () => void
  readonly editingTitle: boolean
  readonly titleValue: string
  readonly onTitleValueChange: (v: string) => void
  readonly onCommitTitle: (v: string) => void
  readonly saving: boolean
  readonly saveError: string | null
  readonly onContentChange: (html: string) => void
  readonly readOnly: boolean
}

/* ── Persistence helpers ── */

const LS_PREFIX = 'notebook'
const DEBOUNCE_MS = 800
const MAX_RETRIES = 3

function buildLSKey(adventureId: string, userId: string | null) {
  return `${LS_PREFIX}:${adventureId}:${userId ?? 'anon'}`
}

function loadPersistedState(adventureId: string, userId: string | null) {
  try {
    const raw = localStorage.getItem(buildLSKey(adventureId, userId))
    if (raw) return JSON.parse(raw) as { activePageId: string | null; expandedFolders: string[] }
  } catch {}
  return { activePageId: null as string | null, expandedFolders: [] as string[] }
}

function persistState(adventureId: string, userId: string | null, state: { activePageId: string | null; expandedFolders: string[] }) {
  try {
    localStorage.setItem(buildLSKey(adventureId, userId), JSON.stringify(state))
  } catch {}
}

/* ── Strip HTML for search ── */

function stripHtml(html: string): string {
  if (!html) return ''
  // Strip tags in linear time: find each '<' and its matching '>'. This avoids
  // the super-linear backtracking of /<[^>]*>/ on malformed input (e.g. many '<').
  let result = ''
  let cursor = 0
  while (cursor < html.length) {
    const open = html.indexOf('<', cursor)
    if (open === -1) {
      result += html.slice(cursor)
      break
    }
    result += html.slice(cursor, open)
    const close = html.indexOf('>', open + 1)
    if (close === -1) {
      // Unclosed tag — keep the remainder, matching the regex behavior
      result += html.slice(open)
      break
    }
    cursor = close + 1
  }
  return result
}

/* ── Folder helpers (extracted to avoid deeply nested callbacks) ── */

function removePageFromFolder(folder: Folder, pageId: string): Folder {
  return { ...folder, pages: folder.pages.filter((p) => p.id !== pageId) }
}

function findAndRemovePageFromFolder(
  folder: Folder,
  pageId: string,
): { folder: Folder; page: Page | null } {
  const page = folder.pages.find((p) => p.id === pageId) ?? null
  return { folder: removePageFromFolder(folder, pageId), page }
}

/* ── Shared helpers (kept under the complexity budget) ── */

function pageMatchesQuery(page: Page, query: string, notebook: Notebook): boolean {
  const q = query.toLowerCase()
  const titleMatch = page.title.toLowerCase().includes(q)
  const folder = notebook.folders.find((f) => f.id === page.folderId)
  const folderMatch = folder?.name.toLowerCase().includes(q) ?? false
  const contentMatch = stripHtml(page.content).toLowerCase().includes(q)
  return titleMatch || folderMatch || contentMatch
}

function commitTitle(
  value: string,
  currentTitle: string | undefined,
  onCommit: (v: string) => void,
) {
  if (value.trim() && value !== currentTitle) {
    onCommit(value)
  }
}

function flushPendingContent(
  saveTimerRef: { current: NodeJS.Timeout | null },
  pendingContentRef: { current: string | null },
  adventureId: string,
  activePageId: string,
) {
  if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  if (pendingContentRef.current && activePageId) {
    api.patch(`/adventures/${adventureId}/notebook/pages/${activePageId}`, {
      content: pendingContentRef.current,
    }).catch(() => {})
  }
}

/* ── Sub-components ── */

function SidebarToggleButton({
  isOpen,
  notebookLoaded,
  pageCount,
  onToggle,
}: {
  isOpen: boolean
  notebookLoaded: boolean
  pageCount: number
  onToggle: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onToggle}
      className="fixed top-40 right-0 z-40 flex items-center gap-2 px-3 py-2 rounded-l-lg bg-surface border border-r-0 border-border text-sm font-medium text-foreground hover:bg-hover transition-colors shadow-lg"
      aria-label={isOpen ? t('notebook:closeNotebook') : t('notebook:openNotebook')}
      title={t('notebook:campaignNotebook')}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
      {notebookLoaded && (
        <span className="text-xs text-muted-foreground">{pageCount}</span>
      )}
    </button>
  )
}

function SidebarHeader({
  notebookLoaded,
  activePagePresent,
  isGM,
  onMinimize,
  onClose,
}: {
  notebookLoaded: boolean
  activePagePresent: boolean
  isGM: boolean
  onMinimize: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
      <h2 className="text-sm font-semibold text-foreground">{t('notebook:campaignNotebook')}</h2>
      <div className="flex items-center gap-1">
        {notebookLoaded && !activePagePresent && (
          <span className="text-[10px] text-muted-foreground bg-hover px-1.5 py-0.5 rounded">
            {isGM ? t('notebook:gmOnly') : t('common:private')}
          </span>
        )}
        <button
          type="button"
          onClick={onMinimize}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
          aria-label={t('notebook:minimizeNotebook')}
          title={t('notebook:minimize')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
          aria-label={t('notebook:closeNotebook')}
          title={t('common:close')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function NotebookLoadingState() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
      <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">{t('notebook:loadingNotebook')}</p>
    </div>
  )
}

function NotebookErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
      <svg className="w-10 h-10 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <p className="text-sm text-destructive text-center">{error}</p>
      <button onClick={onRetry} className="btn-primary !py-1.5 !px-3 !text-xs">
        {t('notebook:retry')}
      </button>
    </div>
  )
}

function NotebookEmptyState({
  readOnly,
  onCreatePage,
}: {
  readOnly: boolean
  onCreatePage: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
      <span className="text-3xl">📝</span>
      <p className="text-sm text-muted-foreground text-center">
        {t('notebook:emptyNotebook')}
        <br />
        {t('notebook:emptyNotebookHint')}
      </p>
      <button
        onClick={readOnly ? undefined : () => onCreatePage()}
        disabled={readOnly}
        className={`btn-primary !py-1.5 !px-3 !text-xs ${readOnly ? '!opacity-50 !cursor-not-allowed' : ''}`}
        title={readOnly ? t('campaign:readOnlyTooltip') : undefined}
      >
        {t('notebook:createFirstPage')}
      </button>
    </div>
  )
}

function NotebookSearchBar({
  value,
  onChange,
  onClear,
}: {
  value: string
  onChange: (v: string) => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="relative">
      <svg
        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('notebook:searchPages')}
        className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground"
          aria-label={t('notebook:clearSearch')}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

function NotebookSearchResults({
  pages,
  folders,
  searchQuery,
  onOpenPage,
  onDeletePage,
  onRequestDeletePage,
  onPageContextMenu,
  onPageDragStart,
  readOnly,
}: {
  pages: Page[]
  folders: Folder[]
  searchQuery: string
  onOpenPage: (id: string) => void
  onDeletePage: (id: string) => void
  onRequestDeletePage: (id: string) => void
  onPageContextMenu?: (pageId: string, e: React.MouseEvent) => void
  onPageDragStart: (pageId: string, e: React.DragEvent) => void
  readOnly: boolean
}) {
  const { t } = useTranslation()
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">
        {t('notebook:searchResultsCount', { count: pages.length, query: searchQuery })}
      </p>
      <div className="space-y-0.5">
        {pages.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-2 py-1">
            {t('notebook:noPagesFound')}
          </p>
        ) : (
          pages.map((page) => {
            const folder = folders.find((f) => f.id === page.folderId)
            return (
              <NotebookPageItem
                key={page.id}
                id={page.id}
                title={page.title}
                isActive={false}
                folderName={folder?.name ?? null}
                onClick={onOpenPage}
                onDelete={onDeletePage}
                onRequestDelete={onRequestDeletePage}
                onContextMenu={readOnly ? undefined : onPageContextMenu}
                onDragStart={onPageDragStart}
                readOnly={readOnly}
              />
            )
          })
        )}
      </div>
    </div>
  )
}

function NotebookFolderList({
  folders,
  activePageId,
  expandedFolders,
  onToggleFolder,
  onPageClick,
  onDeletePage,
  onRequestDeletePage,
  onRenameFolder,
  onDeleteFolderRequest,
  onCreatePage,
  onPageContextMenu,
  onDropOnFolder,
  readOnly,
}: {
  folders: Folder[]
  activePageId: string | null
  expandedFolders: string[]
  onToggleFolder: (id: string) => void
  onPageClick: (id: string) => void
  onDeletePage: (id: string) => void
  onRequestDeletePage: (id: string) => void
  onRenameFolder: (id: string, name: string) => void
  onDeleteFolderRequest: (id: string) => void
  onCreatePage: (folderId?: string) => void
  onPageContextMenu: (pageId: string, e: React.MouseEvent) => void
  onDropOnFolder: (folderId: string, pageId: string) => void
  readOnly: boolean
}) {
  return (
    <div>
      {[...folders]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((folder) => (
          <NotebookFolder
            key={folder.id}
            id={folder.id}
            name={folder.name}
            pages={[...folder.pages].sort((a, b) => a.sortOrder - b.sortOrder)}
            activePageId={activePageId}
            isExpanded={expandedFolders.includes(folder.id)}
            onToggle={() => onToggleFolder(folder.id)}
            onPageClick={onPageClick}
            onDeletePage={onDeletePage}
            onRequestDeletePage={onRequestDeletePage}
            onRename={onRenameFolder}
            onDeleteFolderRequest={onDeleteFolderRequest}
            onCreatePage={onCreatePage}
            onPageContextMenu={onPageContextMenu}
            onDropOnFolder={onDropOnFolder}
            readOnly={readOnly}
          />
        ))}
    </div>
  )
}

function NotebookUncategorizedZone({
  notebook,
  activePageId,
  dragOverRoot,
  readOnly,
  onPageContextMenu,
  onPageClick,
  onDeletePage,
  onRequestDeletePage,
  onPageDragStart,
  onDragOverRoot,
  onDragLeaveRoot,
  onDropOnRoot,
}: {
  notebook: Notebook
  activePageId: string | null
  dragOverRoot: boolean
  readOnly: boolean
  onPageContextMenu?: (pageId: string, e: React.MouseEvent) => void
  onPageClick: (id: string) => void
  onDeletePage: (id: string) => void
  onRequestDeletePage: (id: string) => void
  onPageDragStart: (pageId: string, e: React.DragEvent) => void
  onDragOverRoot: (e: React.DragEvent) => void
  onDragLeaveRoot: (e: React.DragEvent) => void
  onDropOnRoot: (e: React.DragEvent) => void
}) {
  const { t } = useTranslation()
  const pageContextMenu = readOnly ? undefined : onPageContextMenu
  return (
    <div
      className={`rounded-md transition-colors ${
        dragOverRoot ? 'bg-accent/5 ring-1 ring-accent/30 py-2' : ''
      }`}
      onDragOver={onDragOverRoot}
      onDragLeave={onDragLeaveRoot}
      onDrop={onDropOnRoot}
    >
      {notebook.pages.length > 0 && (
        <>
          {notebook.folders.length > 0 && (
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 px-1 font-medium">
              {t('notebook:uncategorized')}
            </p>
          )}
          <div className="space-y-0.5">
            {[...notebook.pages]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((page) => (
                <NotebookPageItem
                  key={page.id}
                  id={page.id}
                  title={page.title}
                  isActive={activePageId === page.id}
                  onClick={onPageClick}
                  onDelete={onDeletePage}
                  onRequestDelete={onRequestDeletePage}
                  onContextMenu={pageContextMenu}
                  onDragStart={onPageDragStart}
                  readOnly={readOnly}
                />
              ))}
          </div>
        </>
      )}

      {notebook.pages.length === 0 && notebook.folders.length > 0 && dragOverRoot && (
        <p className="text-xs text-accent italic px-3 py-2">
          {t('notebook:dropHereToMoveToRoot')}
        </p>
      )}
    </div>
  )
}

function NotebookCreateButtons({
  creatingPage,
  creatingFolder,
  readOnly,
  onCreatePage,
  onCreateFolder,
}: {
  creatingPage: boolean
  creatingFolder: boolean
  readOnly: boolean
  onCreatePage: () => void
  onCreateFolder: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2 pt-1">
      <button
        type="button"
        onClick={readOnly ? undefined : () => onCreatePage()}
        disabled={creatingPage || readOnly}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors disabled:opacity-50 ${
          readOnly
            ? 'text-muted-foreground cursor-not-allowed'
            : 'text-accent hover:bg-accent/10'
        }`}
        title={readOnly ? t('campaign:readOnlyTooltip') : undefined}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        {t('notebook:newPage')}
      </button>
      <button
        type="button"
        onClick={readOnly ? undefined : () => onCreateFolder()}
        disabled={creatingFolder || readOnly}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors disabled:opacity-50 ${
          readOnly
            ? 'text-muted-foreground cursor-not-allowed'
            : 'text-accent hover:bg-accent/10'
        }`}
        title={readOnly ? t('campaign:readOnlyTooltip') : undefined}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-5 4h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        {t('notebook:newFolder')}
      </button>
    </div>
  )
}

type NotebookListBodyProps = Omit<NotebookBodyProps, 'notebook'> & {
  readonly notebook: Notebook
}

function NotebookListBody({
  notebook,
  allPages,
  activePageId,
  expandedFolders,
  searchQuery,
  onSearchQueryChange,
  onClearSearch,
  onOpenPage,
  onPageClick,
  onToggleFolder,
  onCreatePage,
  onCreateFolder,
  creatingPage,
  creatingFolder,
  onDeletePage,
  onRequestDeletePage,
  onPageContextMenu,
  onPageDragStart,
  onDropOnFolder,
  onDragOverRoot,
  onDragLeaveRoot,
  onDropOnRoot,
  dragOverRoot,
  onRenameFolder,
  onDeleteFolderRequest,
  readOnly,
}: NotebookListBodyProps) {
  const query = searchQuery.trim()
  const filteredPages = query
    ? allPages.filter((page) => pageMatchesQuery(page, searchQuery, notebook))
    : []
  return (
    <div className="p-3 space-y-3">
      <NotebookSearchBar value={searchQuery} onChange={onSearchQueryChange} onClear={onClearSearch} />
      {query && (
        <NotebookSearchResults
          pages={filteredPages}
          folders={notebook.folders}
          searchQuery={searchQuery}
          onOpenPage={onOpenPage}
          onDeletePage={onDeletePage}
          onRequestDeletePage={onRequestDeletePage}
          onPageContextMenu={onPageContextMenu}
          onPageDragStart={onPageDragStart}
          readOnly={readOnly}
        />
      )}
      {!query && notebook.folders.length > 0 && (
        <NotebookFolderList
          folders={notebook.folders}
          activePageId={activePageId}
          expandedFolders={expandedFolders}
          onToggleFolder={onToggleFolder}
          onPageClick={onPageClick}
          onDeletePage={onDeletePage}
          onRequestDeletePage={onRequestDeletePage}
          onRenameFolder={onRenameFolder}
          onDeleteFolderRequest={onDeleteFolderRequest}
          onCreatePage={onCreatePage}
          onPageContextMenu={onPageContextMenu}
          onDropOnFolder={onDropOnFolder}
          readOnly={readOnly}
        />
      )}
      {!query && (
        <NotebookUncategorizedZone
          notebook={notebook}
          activePageId={activePageId}
          dragOverRoot={dragOverRoot}
          readOnly={readOnly}
          onPageContextMenu={onPageContextMenu}
          onPageClick={onPageClick}
          onDeletePage={onDeletePage}
          onRequestDeletePage={onRequestDeletePage}
          onPageDragStart={onPageDragStart}
          onDragOverRoot={onDragOverRoot}
          onDragLeaveRoot={onDragLeaveRoot}
          onDropOnRoot={onDropOnRoot}
        />
      )}
      {!query && (
        <NotebookCreateButtons
          creatingPage={creatingPage}
          creatingFolder={creatingFolder}
          readOnly={readOnly}
          onCreatePage={onCreatePage}
          onCreateFolder={onCreateFolder}
        />
      )}
    </div>
  )
}

function TitleInput({
  value,
  currentTitle,
  onChange,
  onCommit,
  onReset,
}: {
  value: string
  currentTitle: string | undefined
  onChange: (v: string) => void
  onCommit: (v: string) => void
  onReset: () => void
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        commitTitle(value, currentTitle, onCommit)
        onReset()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commitTitle(value, currentTitle, onCommit)
          onReset()
        }
        if (e.key === 'Escape') {
          onChange(currentTitle ?? '')
          onReset()
        }
      }}
      className="w-full px-1 py-0 text-sm bg-input border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
      autoFocus
    />
  )
}

function TitleButton({
  title,
  readOnly,
  onClick,
  readOnlyTooltip,
}: {
  title: string | undefined
  readOnly: boolean
  onClick: () => void
  readOnlyTooltip: string
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={readOnly ? undefined : onClick}
      disabled={readOnly}
      className={`text-sm font-medium text-foreground truncate max-w-full text-left transition-colors ${
        readOnly ? 'cursor-default' : 'hover:text-accent'
      }`}
      title={readOnly ? readOnlyTooltip : t('notebook:clickToRename')}
    >
      {title || t('notebook:untitled')}
    </button>
  )
}

function EditorSaveIndicator({
  saving,
  saveError,
  savedAt,
}: {
  saving: boolean
  saveError: string | null
  savedAt?: string
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-1 shrink-0">
      {saving && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <div className="w-2.5 h-2.5 border-[1.5px] border-accent/30 border-t-accent rounded-full animate-spin" />
          {t('notebook:saving')}
        </div>
      )}
      {!saving && saveError && (
        <span className="text-[10px] text-destructive">{saveError}</span>
      )}
      {!saving && !saveError && (
        <span className="text-[10px] text-muted-foreground">
          {savedAt ? t('notebook:saved') : ''}
        </span>
      )}
    </div>
  )
}

function EditorBackButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
      aria-label={t('notebook:backToPageList')}
      title={t('common:back')}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  )
}

function EditorDeleteButton({
  readOnly,
  onClick,
}: {
  readOnly: boolean
  onClick?: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={readOnly ? undefined : onClick}
      disabled={readOnly}
      className={`p-1 rounded-md text-muted-foreground transition-colors ${
        readOnly
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:text-destructive hover:bg-destructive/10'
      }`}
      aria-label={t('notebook:deletePage')}
      title={readOnly ? t('campaign:readOnlyTooltip') : t('notebook:deletePage')}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  )
}

function EditorHeader({
  activePage,
  editingTitle,
  titleValue,
  onTitleValueChange,
  onCommitTitle,
  onExitEdit,
  onStartEdit,
  onDeleteRequest,
  onBack,
  saving,
  saveError,
  readOnly,
}: {
  activePage: Page
  editingTitle: boolean
  titleValue: string
  onTitleValueChange: (v: string) => void
  onCommitTitle: (v: string) => void
  onExitEdit: () => void
  onStartEdit: () => void
  onDeleteRequest: () => void
  onBack: () => void
  saving: boolean
  saveError: string | null
  readOnly: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
      <EditorBackButton onClick={onBack} />
      <div className="flex-1">
        {editingTitle ? (
          <TitleInput
            value={titleValue}
            currentTitle={activePage.title}
            onChange={onTitleValueChange}
            onCommit={onCommitTitle}
            onReset={onExitEdit}
          />
        ) : (
          <TitleButton
            title={activePage.title}
            readOnly={readOnly}
            onClick={onStartEdit}
            readOnlyTooltip={t('campaign:readOnlyTooltip')}
          />
        )}
      </div>
      <EditorSaveIndicator saving={saving} saveError={saveError} savedAt={activePage.updatedAt} />
      <EditorDeleteButton readOnly={readOnly} onClick={onDeleteRequest} />
    </div>
  )
}

function NotebookEditorBody({
  activePage,
  readOnly,
  onBack,
  onStartEdit,
  onExitEdit,
  onDeleteRequest,
  editingTitle,
  titleValue,
  onTitleValueChange,
  onCommitTitle,
  saving,
  saveError,
  onContentChange,
}: {
  activePage: Page
  readOnly: boolean
  onBack: () => void
  onStartEdit: () => void
  onExitEdit: () => void
  onDeleteRequest: () => void
  editingTitle: boolean
  titleValue: string
  onTitleValueChange: (v: string) => void
  onCommitTitle: (v: string) => void
  saving: boolean
  saveError: string | null
  onContentChange: (html: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col h-full">
      <EditorHeader
        activePage={activePage}
        editingTitle={editingTitle}
        titleValue={titleValue}
        onTitleValueChange={onTitleValueChange}
        onCommitTitle={onCommitTitle}
        onExitEdit={onExitEdit}
        onStartEdit={onStartEdit}
        onDeleteRequest={onDeleteRequest}
        onBack={onBack}
        saving={saving}
        saveError={saveError}
        readOnly={readOnly}
      />
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <RichTextEditor
          content={activePage.content}
          onChange={onContentChange}
          placeholder={t('notebook:startWriting')}
          editable={!readOnly}
        />
      </div>
    </div>
  )
}

function NotebookContextMenu({
  contextMenu,
  notebook,
  onMoveToRoot,
  onMoveToFolder,
  onClose,
  menuRef,
}: {
  contextMenu: ContextMenuState
  notebook: Notebook | null
  onMoveToRoot: () => void
  onMoveToFolder: (folderId: string) => void
  onClose: () => void
  menuRef: React.RefObject<HTMLDivElement | null>
}) {
  const { t } = useTranslation()
  const contextPageFolderId = notebook
    ? notebook.pages.find((p) => p.id === contextMenu.pageId)?.folderId
      ?? notebook.folders.find((f) => f.pages.some((p) => p.id === contextMenu.pageId))?.id
    : undefined
  const otherFolders = notebook?.folders.filter((f) => f.id !== contextPageFolderId) ?? []
  return (
    <>
      {/* Backdrop to close menu */}
      <div
        className="fixed inset-0 z-[60]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={menuRef}
        className="fixed z-[70] min-w-[180px] bg-surface border border-border rounded-lg shadow-xl py-1"
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {t('notebook:moveTo')}
        </div>

        {/* Root option */}
        <button
          type="button"
          onClick={onMoveToRoot}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-secondary-foreground hover:bg-hover hover:text-foreground text-left"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          {t('notebook:rootUncategorized')}
        </button>

        <div className="h-px bg-border my-1" />

        {/* Folder options */}
        {otherFolders.length === 0 && (
          <p className="px-3 py-1.5 text-xs text-muted-foreground italic">
            {t('notebook:noOtherFolders')}
          </p>
        )}
        {otherFolders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            onClick={() => onMoveToFolder(folder.id)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-secondary-foreground hover:bg-hover hover:text-foreground text-left"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {folder.name}
          </button>
        ))}
      </div>
    </>
  )
}

function PageDeleteDialog({
  readOnly,
  onCancel,
  onConfirm,
}: {
  readOnly: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-surface border border-border rounded-xl shadow-2xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2">{t('notebook:deletePage')}</h3>
        <p className="text-sm text-muted-foreground mb-4">{t('notebook:deletePageConfirm')}</p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-md btn-ghost"
          >
            {t('common:cancel')}
          </button>
          <button
            type="button"
            onClick={readOnly ? undefined : onConfirm}
            disabled={readOnly}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              readOnly
                ? 'bg-destructive/50 text-destructive-foreground cursor-not-allowed'
                : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            }`}
            title={readOnly ? t('campaign:readOnlyTooltip') : undefined}
          >
            {t('notebook:deletePage')}
          </button>
        </div>
      </div>
    </>
  )
}

function FolderDeleteDialog({
  folderDeleteDialog,
  notebook,
  readOnly,
  onCancel,
  onConfirm,
  onMoveToFolderIdChange,
  dialogRef,
}: {
  folderDeleteDialog: FolderDeleteDialogState
  notebook: Notebook | null
  readOnly: boolean
  onCancel: () => void
  onConfirm: () => void
  onMoveToFolderIdChange: (moveToFolderId: string | null) => void
  dialogRef: React.RefObject<HTMLDivElement | null>
}) {
  const { t } = useTranslation()
  const otherFolders = notebook?.folders.filter((f) => f.id !== folderDeleteDialog.folderId) ?? []
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-surface border border-border rounded-xl shadow-2xl p-5"
      >
        <h3 className="text-sm font-semibold text-foreground mb-1">{t('notebook:deleteFolder')}</h3>
        <p className="text-xs text-muted-foreground mb-4">
          {t('notebook:deleteFolderWarning')}
        </p>

        {/* Move to Root */}
        <label
          htmlFor="delete-move-root"
          className="flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-hover transition-colors mb-1"
        >
          <input
            type="radio"
            id="delete-move-root"
            name="delete-move-option"
            checked={folderDeleteDialog.moveToFolderId === null}
            onChange={() => onMoveToFolderIdChange(null)}
            className="mt-0.5 accent-accent"
          />
          <div className="text-sm text-secondary-foreground font-medium">
            {t('notebook:movePagesToRoot')}
            <p className="text-xs text-muted-foreground mt-0.5 font-normal">
              {t('notebook:pagesBecomeUncategorized')}
            </p>
          </div>
        </label>

        {/* Move to another folder */}
        <label
          htmlFor="delete-move-folder"
          className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-hover transition-colors mb-3 ${
            otherFolders.length === 0 ? 'opacity-50' : ''
          }`}
        >
          <input
            type="radio"
            id="delete-move-folder"
            name="delete-move-option"
            checked={folderDeleteDialog.moveToFolderId !== null}
            disabled={otherFolders.length === 0}
            onChange={() => {
              const firstOther = otherFolders[0]
              onMoveToFolderIdChange(firstOther?.id ?? null)
            }}
            className="mt-0.5 accent-accent"
          />
          <div className="flex-1 text-sm text-secondary-foreground font-medium">
            {t('notebook:moveToAnotherFolder')}
            {folderDeleteDialog.moveToFolderId !== null && otherFolders.length > 0 && (
              <select
                value={folderDeleteDialog.moveToFolderId ?? ''}
                onChange={(e) =>
                  onMoveToFolderIdChange(e.target.value || null)
                }
                className="w-full mt-1.5 px-2 py-1 text-sm rounded-lg bg-input border border-border text-foreground font-normal focus:outline-none focus:ring-1 focus:ring-accent/50"
                onClick={(e) => e.stopPropagation()}
              >
                {otherFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
            {otherFolders.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1 font-normal">{t('notebook:noOtherFoldersAvailable')}</p>
            )}
          </div>
        </label>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-md btn-ghost"
          >
            {t('common:cancel')}
          </button>
          <button
            type="button"
            onClick={readOnly ? undefined : onConfirm}
            disabled={readOnly}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              readOnly
                ? 'bg-destructive/50 text-destructive-foreground cursor-not-allowed'
                : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            }`}
            title={readOnly ? t('campaign:readOnlyTooltip') : undefined}
          >
            {t('notebook:deleteFolder')}
          </button>
        </div>
      </div>
    </>
  )
}

function NotebookBody(props: NotebookBodyProps) {
  if (props.isLoading) return <NotebookLoadingState />
  if (props.error) return <NotebookErrorState error={props.error} onRetry={props.onRetry} />
  if (!props.notebook) return null
  if (props.activePage) {
    return (
      <NotebookEditorBody
        activePage={props.activePage}
        readOnly={props.readOnly}
        onBack={props.onExitPage}
        onStartEdit={props.onStartEdit}
        onExitEdit={props.onExitEdit}
        onDeleteRequest={props.onDeleteRequest}
        editingTitle={props.editingTitle}
        titleValue={props.titleValue}
        onTitleValueChange={props.onTitleValueChange}
        onCommitTitle={props.onCommitTitle}
        saving={props.saving}
        saveError={props.saveError}
        onContentChange={props.onContentChange}
      />
    )
  }
  if (props.allPages.length === 0) {
    return (
      <NotebookEmptyState readOnly={props.readOnly} onCreatePage={() => props.onCreatePage()} />
    )
  }
  return <NotebookListBody {...props} notebook={props.notebook} />
}

/* ── Component ── */

export function NotebookSidebar({
  adventureId,
  isGM,
  forceOpen = false,
  onClose,
  hideToggle = false,
  readOnly = false,
}: NotebookSidebarProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [notebook, setNotebook] = useState<Notebook | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [creatingPage, setCreatingPage] = useState(false)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // Folder deletion dialog state
  const [folderDeleteDialog, setFolderDeleteDialog] = useState<FolderDeleteDialogState | null>(null)
  const [pageDeleteDialog, setPageDeleteDialog] = useState<string | null>(null)

  // Drag-over tracking
  const [dragOverRoot, setDragOverRoot] = useState(false)

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)
  const pendingContentRef = useRef<string | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const deleteDialogRef = useRef<HTMLDivElement>(null)

  /* ── Extract userId from JWT ── */
  useEffect(() => {
    try {
      const token = localStorage.getItem('accessToken')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setUserId(payload.sub ?? null)
      }
    } catch {}
  }, [])

  /* ── Force-open / close from parent ── */
  useEffect(() => {
    if (forceOpen) setIsOpen(true)
  }, [forceOpen])

  /* ── Toggle sidebar ── */
  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev)
    if (onClose && isOpen) onClose()
  }, [isOpen, onClose])

  // Minimize hides the panel while the aside stays mounted, so all editor state (folders,
  // active note, caret, undo history, pending autosave) survives. Must call onClose() so the
  // parent's forceOpen flag resets — otherwise the tab/forceOpen path can't reopen it.
  const handleMinimize = useCallback(() => {
    setIsOpen(false)
    onClose?.()
  }, [onClose])

  // Full close: flush pending autosave content, then reset every piece of state so reopening
  // behaves like a fresh launch (root view, no folder expanded, no note selected).
  const handleClose = useCallback(() => {
    // Flush any pending autosave before discarding the editor state (mirrors the back button)
    flushPendingContent(saveTimerRef, pendingContentRef, adventureId, activePageId ?? '')
    // Null pending content + retry counter so the untracked retry setTimeout (queueSave)
    // becomes a no-op and the debounced save can't fire after close.
    pendingContentRef.current = null
    retryCountRef.current = 0
    try {
      localStorage.removeItem(buildLSKey(adventureId, userId))
    } catch {
      // ignore storage errors (privacy mode, quota)
    }
    setNotebook(null)
    setActivePageId(null)
    setExpandedFolders([])
    setSearchQuery('')
    setSaving(false)
    setSaveError(null)
    setError(null)
    setEditingTitle(false)
    setTitleValue('')
    setCreatingFolder(false)
    setCreatingPage(false)
    setContextMenu(null)
    setFolderDeleteDialog(null)
    setDragOverRoot(false)
    setIsOpen(false)
    onClose?.()
  }, [adventureId, activePageId, onClose, userId])

  // Editor back button: flush pending autosave content, then return to the page list.
  const handleEditorBack = useCallback(() => {
    flushPendingContent(saveTimerRef, pendingContentRef, adventureId, activePageId ?? '')
    setActivePageId(null)
    setEditingTitle(false)
  }, [adventureId, activePageId])

  /* ── Fetch notebook ── */
  const fetchNotebook = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.get<Notebook>(`/adventures/${adventureId}/notebook`)
      setNotebook(data)

      // Restore persisted state
      const persisted = loadPersistedState(adventureId, userId)
      if (persisted.activePageId) {
        // Verify page still exists
        const allPages = [...data.pages, ...data.folders.flatMap((f) => f.pages)]
        if (allPages.some((p) => p.id === persisted.activePageId)) {
          setActivePageId(persisted.activePageId)
        }
      }
      setExpandedFolders(persisted.expandedFolders)
    } catch (err: any) {
      setError(err?.message ?? t('notebook:failedToLoadNotebook'))
    } finally {
      setIsLoading(false)
    }
  }, [adventureId, t, userId])

  // Fetch when sidebar opens
  useEffect(() => {
    if (isOpen && !notebook) {
      fetchNotebook()
    }
  }, [isOpen, notebook, fetchNotebook])

  /* ── Persist state ── */
  useEffect(() => {
    if (userId) {
      persistState(adventureId, userId, { activePageId, expandedFolders })
    }
  }, [adventureId, userId, activePageId, expandedFolders])

  /* ── Helper: get all pages ── */
  const allPages = notebook
    ? [...notebook.pages, ...notebook.folders.flatMap((f) => f.pages)]
    : []

  /* ── Active page ── */
  const activePage = allPages.find((p) => p.id === activePageId) ?? null

  /* ── Folder toggle ── */
  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId],
    )
  }, [])

  /* ── Close context menu on outside click ── */
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    const handleScroll = () => setContextMenu(null)
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [contextMenu])

  /* ── Close delete dialog on outside click ── */
  useEffect(() => {
    if (!folderDeleteDialog) return
    const handleClick = (e: MouseEvent) => {
      if (deleteDialogRef.current && !deleteDialogRef.current.contains(e.target as Node)) {
        setFolderDeleteDialog(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [folderDeleteDialog])

  /* ── Auto-save ── */
  const queueSave = useCallback(
    (pageId: string, content: string) => {
      pendingContentRef.current = content

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

      saveTimerRef.current = setTimeout(async () => {
        const contentToSave = pendingContentRef.current
        if (!contentToSave) return

        setSaving(true)
        setSaveError(null)

        try {
          await api.patch(`/adventures/${adventureId}/notebook/pages/${pageId}`, {
            content: contentToSave,
          })
          retryCountRef.current = 0
          pendingContentRef.current = null
        } catch {
          retryCountRef.current++
          if (retryCountRef.current < MAX_RETRIES) {
            // Retry after 2s
            setTimeout(() => {
              if (pendingContentRef.current) {
                queueSave(pageId, pendingContentRef.current)
              }
            }, 2000)
          } else {
            setSaveError(t('notebook:failedToSaveCheckConnection'))
          }
        } finally {
          setSaving(false)
        }
      }, DEBOUNCE_MS)
    },
    [adventureId, t],
  )

  /* ── Content change handler ── */
  const handleContentChange = useCallback(
    (html: string) => {
      if (!activePageId) return

      // Optimistic update local state
      setNotebook((prev) => {
        if (!prev) return prev

        const updatePageInList = (page: Page): Page =>
          page.id === activePageId ? { ...page, content: html } : page

        return {
          ...prev,
          pages: prev.pages.map(updatePageInList),
          folders: prev.folders.map((f) => ({
            ...f,
            pages: f.pages.map(updatePageInList),
          })),
        }
      })

      queueSave(activePageId, html)
    },
    [activePageId, queueSave],
  )

  /* ── Title change handler ── */
  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      if (!activePageId || !newTitle.trim()) return

      // Optimistic update
      setNotebook((prev) => {
        if (!prev) return prev
        const updatePageInList = (page: Page): Page =>
          page.id === activePageId ? { ...page, title: newTitle } : page
        return {
          ...prev,
          pages: prev.pages.map(updatePageInList),
          folders: prev.folders.map((f) => ({
            ...f,
            pages: f.pages.map(updatePageInList),
          })),
        }
      })

      try {
        await api.patch(`/adventures/${adventureId}/notebook/pages/${activePageId}`, {
          title: newTitle,
        })
      } catch {
        setSaveError(t('notebook:failedToSaveTitle'))
      }
    },
    [adventureId, activePageId, t],
  )

  /* ── Create page ── */
  const handleCreatePage = useCallback(
    async (folderId?: string) => {
      if (creatingPage) return
      setCreatingPage(true)
      try {
        const newPage = await api.post<Page>(`/adventures/${adventureId}/notebook/pages`, {
          title: t('notebook:untitledPage'),
          folderId: folderId ?? null,
        })
        setNotebook((prev) => {
          if (!prev) return prev
          if (folderId) {
            return {
              ...prev,
              folders: prev.folders.map((f) =>
                f.id === folderId ? { ...f, pages: [...f.pages, newPage] } : f,
              ),
            }
          }
          return { ...prev, pages: [...prev.pages, newPage] }
        })
        setActivePageId(newPage.id)
      } catch {
        setError(t('notebook:failedToCreatePage'))
      } finally {
        setCreatingPage(false)
      }
    },
    [adventureId, creatingPage, t],
  )

  /* ── Delete page ── */
  const handleDeletePage = useCallback(
    async (pageId: string) => {
      try {
        await api.delete(`/adventures/${adventureId}/notebook/pages/${pageId}`)
        setNotebook((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            pages: prev.pages.filter((p) => p.id !== pageId),
            folders: prev.folders.map((f) => removePageFromFolder(f, pageId)),
          }
        })
        if (activePageId === pageId) {
          setActivePageId(null)
        }
        if (pageDeleteDialog === pageId) {
          setPageDeleteDialog(null)
        }
      } catch {
        setError(t('notebook:failedToDeletePage'))
      }
    },
    [adventureId, activePageId, pageDeleteDialog, t],
  )

  const handleDeletePageRequest = useCallback((pageId: string) => {
    setPageDeleteDialog(pageId)
  }, [])

  const handleConfirmDeletePage = useCallback(() => {
    if (!pageDeleteDialog) return
    handleDeletePage(pageDeleteDialog)
  }, [handleDeletePage, pageDeleteDialog])

  /* ── Move page to a folder (or root) ── */
  const handleMovePage = useCallback(
    async (pageId: string, targetFolderId: string | null) => {
      try {
        await api.patch(`/adventures/${adventureId}/notebook/pages/${pageId}`, {
          folderId: targetFolderId,
        })

        // Optimistic update: remove from old location, add to new location
        setNotebook((prev) => {
          if (!prev) return prev

          // Find the page in current state
          let movedPage: Page | null = null

          // Remove from its current location
          const updatedFolders = prev.folders.map((f) => {
            const { folder, page } = findAndRemovePageFromFolder(f, pageId)
            if (page) movedPage = page
            return folder
          })

          if (!movedPage) {
            const page = prev.pages.find((p) => p.id === pageId)
            if (page) movedPage = page
          }

          if (!movedPage) return prev

          const updatedPage = { ...movedPage, folderId: targetFolderId }

          if (targetFolderId) {
            return {
              ...prev,
              pages: prev.pages.filter((p) => p.id !== pageId),
              folders: updatedFolders.map((f) =>
                f.id === targetFolderId ? { ...f, pages: [...f.pages, updatedPage] } : f,
              ),
            }
          } else {
            return {
              ...prev,
              pages: [...prev.pages.filter((p) => p.id !== pageId), updatedPage],
              folders: updatedFolders,
            }
          }
        })
      } catch {
        setError(t('notebook:failedToMovePage'))
      }
    },
    [adventureId, t],
  )

  /* ── Context menu handler (right-click on page) ── */
  const handlePageContextMenu = useCallback((pageId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ pageId, x: e.clientX, y: e.clientY })
  }, [])

  /* ── Create folder ── */
  const handleCreateFolder = useCallback(async () => {
    if (creatingFolder) return
    setCreatingFolder(true)
    try {
      const newFolder = await api.post<Folder>(`/adventures/${adventureId}/notebook/folders`, {
        name: t('notebook:newFolder'),
      })
      setNotebook((prev) => {
        if (!prev) return prev
        return { ...prev, folders: [...prev.folders, { ...newFolder, pages: [] }] }
      })
      setExpandedFolders((prev) => [...prev, newFolder.id])
    } catch {
      setError(t('notebook:failedToCreateFolder'))
    } finally {
      setCreatingFolder(false)
    }
  }, [adventureId, creatingFolder, t])

  /* ── Rename folder ── */
  const handleRenameFolder = useCallback(
    async (folderId: string, newName: string) => {
      try {
        await api.patch(`/adventures/${adventureId}/notebook/folders/${folderId}`, {
          name: newName,
        })
        setNotebook((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            folders: prev.folders.map((f) =>
              f.id === folderId ? { ...f, name: newName } : f,
            ),
          }
        })
      } catch {
        setError(t('notebook:failedToRenameFolder'))
      }
    },
    [adventureId, t],
  )

  /* ── Open folder deletion dialog ── */
  const handleDeleteFolderRequest = useCallback((folderId: string) => {
    setFolderDeleteDialog({ folderId, moveToFolderId: null })
  }, [])

  /* ── Confirm folder deletion with move option ── */
  const handleConfirmDeleteFolder = useCallback(async () => {
    if (!folderDeleteDialog) return

    const { folderId, moveToFolderId } = folderDeleteDialog

    try {
      // Find pages that need moving
      const folder = notebook?.folders.find((f) => f.id === folderId)
      const orphanedPages = folder?.pages ?? []

      // If moving to another folder, move each page first
      if (moveToFolderId) {
        for (const page of orphanedPages) {
          await api.patch(`/adventures/${adventureId}/notebook/pages/${page.id}`, {
            folderId: moveToFolderId,
          })
        }
      }

      // Delete the folder (server moves remaining pages to root)
      await api.delete(`/adventures/${adventureId}/notebook/folders/${folderId}`)

      setNotebook((prev) => {
        if (!prev) return prev
        const deletedFolder = prev.folders.find((f) => f.id === folderId)
        if (!deletedFolder) return prev

        const movedPages = deletedFolder.pages.map((p) => ({
          ...p,
          folderId: moveToFolderId ?? null,
        }))

        // Remove folder
        const remainingFolders = prev.folders.filter((f) => f.id !== folderId)

        if (moveToFolderId) {
          // Add pages to target folder
          return {
            ...prev,
            folders: remainingFolders.map((f) =>
              f.id === moveToFolderId
                ? { ...f, pages: [...f.pages, ...movedPages] }
                : f,
            ),
          }
        } else {
          // Add pages to root
          return {
            ...prev,
            pages: [...prev.pages, ...movedPages],
            folders: remainingFolders,
          }
        }
      })

      setFolderDeleteDialog(null)
    } catch {
      setError(t('notebook:failedToDeleteFolder'))
    }
  }, [adventureId, folderDeleteDialog, notebook, t])

  /* ── Drag & Drop handlers ── */

  const handlePageDragStart = useCallback((_pageId: string, _e: React.DragEvent) => {
    // Nothing special to do — pageId is in dataTransfer
  }, [])

  const handleDropOnFolder = useCallback(
    (folderId: string, pageId: string) => {
      handleMovePage(pageId, folderId)
    },
    [handleMovePage],
  )

  const handleDragOverRoot = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverRoot(true)
  }, [])

  const handleDragLeaveRoot = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragOverRoot(false)
  }, [])

  const handleDropOnRoot = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOverRoot(false)
      const pageId = e.dataTransfer.getData('text/plain')
      if (pageId) {
        handleMovePage(pageId, null)
      }
    },
    [handleMovePage],
  )

  /* ── Refresh notebook ── */
  const refreshNotebook = useCallback(() => {
    setNotebook(null)
    setActivePageId(null)
    setError(null)
    fetchNotebook()
  }, [fetchNotebook])

  /* ── Cleanup timers ── */
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  /* ── Sidebar close handler for mobile overlay ── */
  const handleOverlayClick = useCallback(() => {
    setIsOpen(false)
    onClose?.()
  }, [onClose])

  /* ── Render: Toggle button ── */
  const toggleButton = !hideToggle && (
    <SidebarToggleButton
      isOpen={isOpen}
      notebookLoaded={!!notebook}
      pageCount={allPages.length}
      onToggle={toggle}
    />
  )

  /* ── Render ── */
  return (
    <>
      {toggleButton}

      {/* ── Mobile overlay ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar panel ── */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full bg-surface border-l border-border shadow-2xl transition-all duration-300 flex flex-col ${
          isOpen
            ? 'translate-x-0 w-1/2 max-sm:w-full sm:max-w-[95vw] lg:w-1/2 xl:w-[45%]'
            : 'translate-x-full w-1/2 max-sm:w-full sm:max-w-[95vw] lg:w-1/2 xl:w-[45%]'
        }`}
        aria-label={t('notebook:campaignNotebookSidebar')}
      >
        {/* ── Header ── */}
        <SidebarHeader
          notebookLoaded={!!notebook}
          activePagePresent={!!activePage}
          isGM={isGM}
          onMinimize={handleMinimize}
          onClose={handleClose}
        />

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          <NotebookBody
            isLoading={isLoading}
            error={error}
            notebook={notebook}
            allPages={allPages}
            activePage={activePage}
            activePageId={activePageId}
            expandedFolders={expandedFolders}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onClearSearch={() => setSearchQuery('')}
            onOpenPage={(id) => {
              setActivePageId(id)
              setSearchQuery('')
            }}
            onPageClick={setActivePageId}
            onToggleFolder={toggleFolder}
            onCreatePage={handleCreatePage}
            onCreateFolder={handleCreateFolder}
            creatingPage={creatingPage}
            creatingFolder={creatingFolder}
            onDeletePage={handleDeletePage}
            onRequestDeletePage={handleDeletePageRequest}
            onPageContextMenu={handlePageContextMenu}
            onPageDragStart={handlePageDragStart}
            onDropOnFolder={handleDropOnFolder}
            onDragOverRoot={handleDragOverRoot}
            onDragLeaveRoot={handleDragLeaveRoot}
            onDropOnRoot={handleDropOnRoot}
            dragOverRoot={dragOverRoot}
            onRenameFolder={handleRenameFolder}
            onDeleteFolderRequest={handleDeleteFolderRequest}
            onRetry={refreshNotebook}
            onExitPage={handleEditorBack}
            onStartEdit={() => {
              setTitleValue(activePage?.title ?? '')
              setEditingTitle(true)
            }}
            onExitEdit={() => setEditingTitle(false)}
            onDeleteRequest={() => setPageDeleteDialog(activePage?.id ?? '')}
            editingTitle={editingTitle}
            titleValue={titleValue}
            onTitleValueChange={setTitleValue}
            onCommitTitle={handleTitleChange}
            saving={saving}
            saveError={saveError}
            onContentChange={handleContentChange}
            readOnly={readOnly}
          />
        </div>
      </aside>

      {/* ── Context Menu (right-click on page) ── */}
      {contextMenu && (
        <NotebookContextMenu
          contextMenu={contextMenu}
          notebook={notebook}
          onMoveToRoot={() => {
            handleMovePage(contextMenu.pageId, null)
            setContextMenu(null)
          }}
          onMoveToFolder={(folderId) => {
            handleMovePage(contextMenu.pageId, folderId)
            setContextMenu(null)
          }}
          onClose={() => setContextMenu(null)}
          menuRef={contextMenuRef}
        />
      )}

      {/* ── Page Deletion Dialog ── */}
      {pageDeleteDialog && (
        <PageDeleteDialog
          readOnly={readOnly}
          onCancel={() => setPageDeleteDialog(null)}
          onConfirm={handleConfirmDeletePage}
        />
      )}

      {/* ── Folder Deletion Dialog ── */}
      {folderDeleteDialog && (
        <FolderDeleteDialog
          folderDeleteDialog={folderDeleteDialog}
          notebook={notebook}
          readOnly={readOnly}
          onCancel={() => setFolderDeleteDialog(null)}
          onConfirm={handleConfirmDeleteFolder}
          onMoveToFolderIdChange={(moveToFolderId) =>
            setFolderDeleteDialog({ ...folderDeleteDialog, moveToFolderId })
          }
          dialogRef={deleteDialogRef}
        />
      )}
    </>
  )
}
