'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  adventureId: string
  isGM: boolean
  /** Force-open the sidebar (from tab button click) */
  forceOpen?: boolean
  /** Called when sidebar should close (from tab button) */
  onClose?: () => void
  /** Hide floating toggle button (adventure page already has tab) */
  hideToggle?: boolean
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
  return html.replace(/<[^>]*>/g, '')
}

/* ── Component ── */

export function NotebookSidebar({
  adventureId,
  isGM,
  forceOpen = false,
  onClose,
  hideToggle = false,
}: NotebookSidebarProps) {
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

  // Drag-over tracking
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
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

  const handleClose = useCallback(() => {
    setIsOpen(false)
    onClose?.()
  }, [onClose])

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
      setError(err?.message ?? 'Failed to load notebook')
    } finally {
      setIsLoading(false)
    }
  }, [adventureId, userId])

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

  /* ── Search filtering ── */
  const filteredPages = searchQuery.trim()
    ? allPages.filter((page) => {
        const q = searchQuery.toLowerCase()
        const titleMatch = page.title.toLowerCase().includes(q)
        const folder = notebook?.folders.find((f) => f.id === page.folderId)
        const folderMatch = folder?.name.toLowerCase().includes(q) ?? false
        const contentMatch = stripHtml(page.content).toLowerCase().includes(q)
        return titleMatch || folderMatch || contentMatch
      })
    : []

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
            setSaveError('Failed to save — check connection')
          }
        } finally {
          setSaving(false)
        }
      }, DEBOUNCE_MS)
    },
    [adventureId],
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
        setSaveError('Failed to save title')
      }
    },
    [adventureId, activePageId],
  )

  /* ── Create page ── */
  const handleCreatePage = useCallback(
    async (folderId?: string) => {
      if (creatingPage) return
      setCreatingPage(true)
      try {
        const newPage = await api.post<Page>(`/adventures/${adventureId}/notebook/pages`, {
          title: 'Untitled page',
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
        setError('Failed to create page')
      } finally {
        setCreatingPage(false)
      }
    },
    [adventureId, creatingPage],
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
            folders: prev.folders.map((f) => ({
              ...f,
              pages: f.pages.filter((p) => p.id !== pageId),
            })),
          }
        })
        if (activePageId === pageId) {
          setActivePageId(null)
        }
      } catch {
        setError('Failed to delete page')
      }
    },
    [adventureId, activePageId],
  )

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
            const page = f.pages.find((p) => p.id === pageId)
            if (page) movedPage = page
            return {
              ...f,
              pages: f.pages.filter((p) => p.id !== pageId),
            }
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
        setError('Failed to move page')
      }
    },
    [adventureId],
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
        name: 'New folder',
      })
      setNotebook((prev) => {
        if (!prev) return prev
        return { ...prev, folders: [...prev.folders, { ...newFolder, pages: [] }] }
      })
      setExpandedFolders((prev) => [...prev, newFolder.id])
    } catch {
      setError('Failed to create folder')
    } finally {
      setCreatingFolder(false)
    }
  }, [adventureId, creatingFolder])

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
        setError('Failed to rename folder')
      }
    },
    [adventureId],
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
      setError('Failed to delete folder')
    }
  }, [adventureId, folderDeleteDialog, notebook])

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
    <button
      type="button"
      onClick={toggle}
      className="fixed top-40 right-0 z-40 flex items-center gap-2 px-3 py-2 rounded-l-lg bg-surface border border-r-0 border-border text-sm font-medium text-foreground hover:bg-hover transition-colors shadow-lg"
      aria-label={isOpen ? 'Close notebook' : 'Open notebook'}
      title="Campaign Notebook"
    >
      {/* Notebook icon */}
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
      {notebook && (
        <span className="text-xs text-muted-foreground">{allPages.length}</span>
      )}
    </button>
  )

  // Current page's folder (for context menu — exclude from move targets)
  const contextPageFolderId = contextMenu
    ? notebook?.pages.find((p) => p.id === contextMenu.pageId)?.folderId
      ?? notebook?.folders.find((f) => f.pages.some((p) => p.id === contextMenu.pageId))?.id
    : undefined

  const otherFoldersForContext =
    notebook?.folders.filter((f) => f.id !== contextPageFolderId) ?? []

  const otherFoldersForDelete =
    notebook?.folders.filter((f) => f.id !== folderDeleteDialog?.folderId) ?? []

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
        aria-label="Campaign notebook sidebar"
        role="complementary"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Campaign Notebook</h2>
          <div className="flex items-center gap-1">
            {notebook && !activePage && (
              <>
                <span className="text-[10px] text-muted-foreground bg-hover px-1.5 py-0.5 rounded">
                  {isGM ? 'GM Only' : 'Private'}
                </span>
              </>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
              aria-label="Close notebook"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Loading state ── */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
              <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading notebook...</p>
            </div>
          )}

          {/* ── Error state ── */}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
              <svg className="w-10 h-10 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm text-destructive text-center">{error}</p>
              <button onClick={refreshNotebook} className="btn-primary !py-1.5 !px-3 !text-xs">
                Retry
              </button>
            </div>
          )}

          {/* ── Empty state (notebook exists but no pages) ── */}
          {!isLoading && !error && notebook && allPages.length === 0 && !activePage && (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
              <span className="text-3xl">📝</span>
              <p className="text-sm text-muted-foreground text-center">
                Your notebook is empty.
                <br />
                Create your first page to get started.
              </p>
              <button
                onClick={() => handleCreatePage()}
                className="btn-primary !py-1.5 !px-3 !text-xs"
              >
                + New Page
              </button>
            </div>
          )}

          {/* ── LIST mode ── */}
          {!isLoading && !error && notebook && !activePage && allPages.length > 0 && (
            <div className="p-3 space-y-3">
              {/* ── Search ── */}
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pages..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* ── Search results ── */}
              {searchQuery.trim() && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {filteredPages.length} result{filteredPages.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
                  </p>
                  <div className="space-y-0.5">
                    {filteredPages.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic px-2 py-1">
                        No pages found
                      </p>
                    ) : (
                      filteredPages.map((page) => {
                        const folder = notebook.folders.find((f) => f.id === page.folderId)
                        return (
                          <NotebookPageItem
                            key={page.id}
                            id={page.id}
                            title={page.title}
                            isActive={false}
                            folderName={folder?.name ?? null}
                            onClick={(id) => {
                              setActivePageId(id)
                              setSearchQuery('')
                            }}
                            onDelete={handleDeletePage}
                            onContextMenu={handlePageContextMenu}
                            onDragStart={handlePageDragStart}
                          />
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {/* ── Folders section ── */}
              {!searchQuery.trim() && notebook.folders.length > 0 && (
                <div>
                  {notebook.folders
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((folder) => (
                      <NotebookFolder
                        key={folder.id}
                        id={folder.id}
                        name={folder.name}
                        pages={folder.pages.sort((a, b) => a.sortOrder - b.sortOrder)}
                        activePageId={activePageId}
                        isExpanded={expandedFolders.includes(folder.id)}
                        onToggle={() => toggleFolder(folder.id)}
                        onPageClick={setActivePageId}
                        onDeletePage={handleDeletePage}
                        onRename={handleRenameFolder}
                        onDeleteFolderRequest={handleDeleteFolderRequest}
                        onCreatePage={handleCreatePage}
                        onPageContextMenu={handlePageContextMenu}
                        onDropOnFolder={handleDropOnFolder}
                        onDragOverFolder={setDragOverFolderId}
                      />
                    ))}
                </div>
              )}

              {/* ── Uncategorized pages (root drop zone) ── */}
              {!searchQuery.trim() && (
                <div
                  className={`rounded-md transition-colors ${
                    dragOverRoot
                      ? 'bg-accent/5 ring-1 ring-accent/30 py-2'
                      : ''
                  }`}
                  onDragOver={handleDragOverRoot}
                  onDragLeave={handleDragLeaveRoot}
                  onDrop={handleDropOnRoot}
                >
                  {notebook.pages.length > 0 && (
                    <>
                      {notebook.folders.length > 0 && (
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 px-1 font-medium">
                          Uncategorized
                        </p>
                      )}
                      <div className="space-y-0.5">
                        {notebook.pages
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                          .map((page) => (
                            <NotebookPageItem
                              key={page.id}
                              id={page.id}
                              title={page.title}
                              isActive={activePageId === page.id}
                              onClick={setActivePageId}
                              onDelete={handleDeletePage}
                              onContextMenu={handlePageContextMenu}
                              onDragStart={handlePageDragStart}
                            />
                          ))}
                      </div>
                    </>
                  )}

                  {/* Drop indicator when empty but dragging */}
                  {notebook.pages.length === 0 && notebook.folders.length > 0 && dragOverRoot && (
                    <p className="text-xs text-accent italic px-3 py-2">
                      Drop here to move to Root
                    </p>
                  )}
                </div>
              )}

              {/* ── Create buttons ── */}
              {!searchQuery.trim() && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCreatePage()}
                    disabled={creatingPage}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    New page
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateFolder}
                    disabled={creatingFolder}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-5 4h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    New folder
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── EDITOR mode ── */}
          {!isLoading && !error && activePage && (
            <div className="flex flex-col h-full">
              {/* │ Editor header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    // Save any pending content before navigating away
                    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
                    if (pendingContentRef.current && activePageId) {
                      api.patch(`/adventures/${adventureId}/notebook/pages/${activePageId}`, {
                        content: pendingContentRef.current,
                      }).catch(() => {})
                    }
                    setActivePageId(null)
                    setEditingTitle(false)
                  }}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
                  aria-label="Back to page list"
                  title="Back"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="flex-1">
                  {editingTitle ? (
                    <input
                      type="text"
                      value={titleValue}
                      onChange={(e) => setTitleValue(e.target.value)}
                      onBlur={() => {
                        if (titleValue.trim() && titleValue !== activePage?.title) {
                          handleTitleChange(titleValue)
                        }
                        setEditingTitle(false)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (titleValue.trim() && titleValue !== activePage?.title) {
                            handleTitleChange(titleValue)
                          }
                          setEditingTitle(false)
                        }
                        if (e.key === 'Escape') {
                          setTitleValue(activePage?.title ?? '')
                          setEditingTitle(false)
                        }
                      }}
                      className="w-full px-1 py-0 text-sm bg-input border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTitleValue(activePage?.title ?? '')
                        setEditingTitle(true)
                      }}
                      className="text-sm font-medium text-foreground truncate max-w-full text-left hover:text-accent transition-colors"
                      title="Click to rename"
                    >
                      {activePage?.title || 'Untitled'}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Save indicator */}
                  {saving && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <div className="w-2.5 h-2.5 border-[1.5px] border-accent/30 border-t-accent rounded-full animate-spin" />
                      Saving...
                    </div>
                  )}
                  {!saving && saveError && (
                    <span className="text-[10px] text-destructive">{saveError}</span>
                  )}
                  {!saving && !saveError && (
                    <span className="text-[10px] text-muted-foreground">
                      {activePage?.updatedAt ? `Saved` : ''}
                    </span>
                  )}

                  {/* Delete page */}
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Delete this page?')) {
                        handleDeletePage(activePage.id)
                      }
                    }}
                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label="Delete page"
                    title="Delete page"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* │ Editor body */}
              <div className="flex-1 overflow-y-auto px-3 py-2">
                <RichTextEditor
                  content={activePage?.content ?? ''}
                  onChange={handleContentChange}
                  placeholder="Start writing..."
                />
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Context Menu (right-click on page) ── */}
      {contextMenu && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-[60]"
            onClick={() => setContextMenu(null)}
            aria-hidden="true"
          />
          <div
            ref={contextMenuRef}
            className="fixed z-[70] min-w-[180px] bg-surface border border-border rounded-lg shadow-xl py-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Move to...
            </div>

            {/* Root option */}
            <button
              type="button"
              onClick={() => {
                handleMovePage(contextMenu.pageId, null)
                setContextMenu(null)
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-secondary-foreground hover:bg-hover hover:text-foreground text-left"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Root (uncategorized)
            </button>

            <div className="h-px bg-border my-1" />

            {/* Folder options */}
            {otherFoldersForContext.length === 0 && (
              <p className="px-3 py-1.5 text-xs text-muted-foreground italic">
                No other folders
              </p>
            )}
            {otherFoldersForContext.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => {
                  handleMovePage(contextMenu.pageId, folder.id)
                  setContextMenu(null)
                }}
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
      )}

      {/* ── Folder Deletion Dialog ── */}
      {folderDeleteDialog && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={() => setFolderDeleteDialog(null)}
            aria-hidden="true"
          />
          <div
            ref={deleteDialogRef}
            className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-surface border border-border rounded-xl shadow-2xl p-5"
          >
            <h3 className="text-sm font-semibold text-foreground mb-1">Delete Folder</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Folder pages will NOT be deleted. Choose where to move them:
            </p>

            {/* Move to Root */}
            <label className="flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-hover transition-colors mb-1">
              <input
                type="radio"
                name="delete-move-option"
                checked={folderDeleteDialog.moveToFolderId === null}
                onChange={() =>
                  setFolderDeleteDialog({ ...folderDeleteDialog, moveToFolderId: null })
                }
                className="mt-0.5 accent-accent"
              />
              <div>
                <span className="text-sm text-secondary-foreground font-medium">Move pages to Root</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pages become uncategorized in the root list
                </p>
              </div>
            </label>

            {/* Move to another folder */}
            <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-hover transition-colors mb-3 ${
              otherFoldersForDelete.length === 0 ? 'opacity-50' : ''
            }`}>
              <input
                type="radio"
                name="delete-move-option"
                checked={folderDeleteDialog.moveToFolderId !== null}
                disabled={otherFoldersForDelete.length === 0}
                onChange={() => {
                  const firstOther = otherFoldersForDelete[0]
                  setFolderDeleteDialog({
                    ...folderDeleteDialog,
                    moveToFolderId: firstOther?.id ?? null,
                  })
                }}
                className="mt-0.5 accent-accent"
              />
              <div className="flex-1">
                <span className="text-sm text-secondary-foreground font-medium">Move to another folder</span>
                {folderDeleteDialog.moveToFolderId !== null && otherFoldersForDelete.length > 0 && (
                  <select
                    value={folderDeleteDialog.moveToFolderId ?? ''}
                    onChange={(e) =>
                      setFolderDeleteDialog({
                        ...folderDeleteDialog,
                        moveToFolderId: e.target.value || null,
                      })
                    }
                    className="w-full mt-1.5 px-2 py-1 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {otherFoldersForDelete.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                  </select>
                )}
                {otherFoldersForDelete.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">No other folders available</p>
                )}
              </div>
            </label>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setFolderDeleteDialog(null)}
                className="px-3 py-1.5 text-xs rounded-md btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFolder}
                className="px-3 py-1.5 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Delete Folder
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
