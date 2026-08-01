'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api, API_URL, getAccessToken } from '@/lib/api'

/* ── Types ── */

interface Book {
  id: string
  name: string
  visibility: 'GM_BOOK' | 'PLAYER_BOOK'
  fileLength: number
  createdAt: string
  updatedAt: string
}

interface PdfViewerSidebarProps {
  adventureId: string
  isGM: boolean
  /** Non-null opens sidebar in viewer mode for this book. Null → closed. */
  bookId: string | null
  /** Called when sidebar should close entirely. */
  onClose: () => void
  /** Called when user selects a book from the internal list (character-sheet use). */
  onBookSelect?: (bookId: string) => void
  /** Hide the floating toggle button (adventure-page use where BookListPanel drives it). */
  hideToggle?: boolean
}

/* ── Constants ── */

const LS_PREFIX = 'pdf-viewer'

interface PersistedState {
  bookId: string
  bookName: string
}

/* ── Helpers ── */

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function loadPersistedState(adventureId: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}:${adventureId}`)
    if (!raw) return null
    const state = JSON.parse(raw) as PersistedState
    if (typeof state.bookId === 'string' && typeof state.bookName === 'string') {
      return state
    }
    return null
  } catch {
    return null
  }
}

function savePersistedState(adventureId: string, state: PersistedState): void {
  try {
    localStorage.setItem(`${LS_PREFIX}:${adventureId}`, JSON.stringify(state))
  } catch {
    // silently fail (quota exceeded, etc.)
  }
}

/* ── Component ── */

export function PdfViewerSidebar({
  adventureId,
  isGM,
  bookId,
  onClose,
  onBookSelect,
  hideToggle = false,
}: PdfViewerSidebarProps) {
  /* ── Core state ── */
  const [isOpen, setIsOpen] = useState(false)
  const [internalBookId, setInternalBookId] = useState<string | null>(null)
  const [internalListOpen, setInternalListOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)

  /* ── Book list state ── */
  const [books, setBooks] = useState<Book[]>([])
  const [loadingList, setLoadingList] = useState(false)

  /* ── iframe state ── */
  const [iframeLoading, setIframeLoading] = useState(false)
  const [iframeError, setIframeError] = useState(false)

  /* ── Refs ── */
  const bookNameMapRef = useRef<Map<string, string>>(new Map())

  /* ── Derived state ── */
  const activeBookId = bookId ?? internalBookId
  const isViewerMode = activeBookId !== null
  const sidebarVisible = isOpen || bookId !== null || internalBookId !== null || internalListOpen
  // Whether the panel is actually on screen (false while minimized — component stays mounted so
  // the native PDF iframe's page/zoom/scroll are preserved and reopening is instant).
  const panelVisible = sidebarVisible && !minimized
  const activeBookName =
    books.find((b) => b.id === activeBookId)?.name ??
    bookNameMapRef.current.get(activeBookId ?? '') ??
    'PDF Viewer'

  const iframeUrl = (() => {
    if (!activeBookId) return null
    const token = getAccessToken()
    const base = `${API_URL}/adventures/${adventureId}/books/${activeBookId}/file`
    return token ? `${base}?token=${encodeURIComponent(token)}` : base
  })()

  /* ── Fetch books for internal list ── */
  const fetchBooks = useCallback(async () => {
    if (!adventureId) return
    setLoadingList(true)
    try {
      const data = await api.get<Book[]>(`/adventures/${adventureId}/books`)
      setBooks(data)
      const map = new Map<string, string>()
      for (const book of data) {
        map.set(book.id, book.name)
      }
      bookNameMapRef.current = map
    } catch {
      /* silently fail */
    } finally {
      setLoadingList(false)
    }
  }, [adventureId])

  // Fetch books on mount when adventure page
  useEffect(() => {
    if (adventureId) {
      void fetchBooks()
    }
  }, [adventureId, fetchBooks])

  /* ── iframe load/error handlers ── */

  const handleIframeLoad = useCallback(() => {
    setIframeLoading(false)
    setIframeError(false)
  }, [])

  const handleIframeError = useCallback(() => {
    setIframeLoading(false)
    setIframeError(true)
  }, [])

  // Reset iframe state when book changes
  useEffect(() => {
    if (activeBookId && iframeUrl) {
      setIframeLoading(true)
      setIframeError(false)
    } else {
      setIframeLoading(false)
      setIframeError(false)
    }
  }, [activeBookId, iframeUrl])

  // Persist current book when viewer mode changes
  useEffect(() => {
    if (activeBookId) {
      savePersistedState(adventureId, { bookId: activeBookId, bookName: activeBookName })
    }
  }, [activeBookId, activeBookName, adventureId])

  // Reopen the panel when a book is selected from the adventure page (BookListPanel eye).
  // Re-selecting the same book bails (state setter no-op) and stays minimized — the restore
  // pill remains the affordance in that case.
  useEffect(() => {
    if (bookId) setMinimized(false)
  }, [bookId])

  /* ── Sidebar close / minimize ── */
  // Minimize hides the panel but keeps the component mounted, so all viewer state (including
  // the native PDF iframe's page/zoom/scroll) is preserved. Deliberately does NOT call onClose —
  // the parent's bookId must stay set so restore needs no fresh book.
  function handleMinimize() {
    setIsOpen(false)
    setMinimized(true)
  }

  // Full close: clear every piece of in-memory state and the persisted selection, so reopening
  // behaves like a fresh launch (no PDF loaded, list collapsed).
  function handleClose() {
    setInternalBookId(null)
    setInternalListOpen(false)
    setMinimized(false)
    setIsOpen(false)
    try {
      localStorage.removeItem(`${LS_PREFIX}:${adventureId}`)
    } catch {
      // ignore storage errors (privacy mode, quota)
    }
    onClose()
  }

  /* ── Internal book selection ── */
  function handleInternalSelect(id: string) {
    setInternalBookId(id)
    setInternalListOpen(false)
    setIsOpen(true)
    onBookSelect?.(id)
  }

  /* ── Floating toggle button ── */
  function handleToggle() {
    if (isOpen && !isViewerMode && !internalListOpen) {
      handleClose()
      return
    }

    if (isOpen && isViewerMode) {
      if (internalBookId) {
        setInternalBookId(null)
        setInternalListOpen(true)
        setIsOpen(true)
      } else {
        handleClose()
      }
      return
    }

    setInternalListOpen(true)
    setIsOpen(true)
    void fetchBooks()
  }

  /* ── Render: closed state ── */
  if (!isOpen && !sidebarVisible) {
    if (hideToggle) return null

    return (
      <button
        onClick={handleToggle}
        className="fixed top-24 right-0 z-40 flex items-center gap-2 px-3 py-2 rounded-l-lg bg-surface border border-r-0 border-border text-sm font-medium text-foreground hover:bg-hover transition-colors shadow-lg"
        aria-label="Open books sidebar"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <span className="hidden sm:inline text-xs">Books</span>
        {books.length > 0 && <span className="badge">{books.length}</span>}
      </button>
    )
  }

  /* ── Render: sidebar panel ── */
  return (
    <>
      {/* Mobile overlay — tapping the scrim minimizes (preserves state), never destroys */}
      {panelVisible && (
        <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={handleMinimize} />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full bg-surface border-l border-border shadow-2xl transition-all duration-300 flex flex-col w-1/2 max-sm:w-full sm:max-w-[95vw] lg:w-1/2 xl:w-[45%] ${
          panelVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="complementary"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          {isViewerMode ? (
            <h2 className="text-lg font-semibold text-foreground truncate pr-2">{activeBookName}</h2>
          ) : (
            <h2 className="text-lg font-semibold text-foreground">Campaign Books</h2>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {/* Back to list (internal viewer mode) */}
            {isViewerMode && internalBookId && (
              <button
                onClick={() => {
                  setInternalBookId(null)
                  setInternalListOpen(true)
                }}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
                aria-label="Back to book list"
                title="Book list"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m0 0l4-4m-4 4l4 4" />
                </svg>
              </button>
            )}
            <button
              onClick={handleMinimize}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
              aria-label="Minimize books sidebar"
              title="Minimize"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
              aria-label="Close sidebar"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        {isViewerMode ? (
          /* ══════ VIEWER MODE (iframe) ══════ */
          <div className="flex-1 relative bg-[#525659]">
            {/* Loading spinner */}
            {iframeLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#525659]">
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-8 h-8 text-white/60 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-xs text-white/60">Loading PDF…</span>
                </div>
              </div>
            )}

            {/* Error state */}
            {iframeError && !iframeLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-danger-muted flex items-center justify-center text-xl mb-3">
                  ⚠️
                </div>
                <p className="text-sm text-danger font-medium mb-1">Failed to load PDF</p>
                <p className="text-xs text-muted-foreground">
                  The PDF could not be loaded. Please try again.
                </p>
              </div>
            ) : null}

            {/* iframe — native browser PDF viewer */}
            {iframeUrl && (
              <iframe
                src={iframeUrl}
                className="w-full h-full border-0"
                title={activeBookName}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                data-testid="pdf-iframe"
              />
            )}
          </div>
        ) : (
          /* ══════ LIST MODE ══════ */
          <>
            <div className="flex-1 overflow-y-auto">
              {loadingList && (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="card !p-3 flex items-center gap-3">
                      <div className="skeleton w-10 h-10 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="skeleton h-4 w-28" />
                        <div className="skeleton h-3 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loadingList && books.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-14 h-14 rounded-full bg-surface border border-border flex items-center justify-center text-2xl mb-3">
                    📚
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No books available. {isGM ? 'Upload one from the adventure page!' : 'Ask your GM to upload some!'}
                  </p>
                </div>
              )}

              {!loadingList && books.length > 0 && (
                <div className="p-3 space-y-2">
                  {books.map((book) => (
                    <div
                      key={book.id}
                      className="w-full card !p-3 flex items-center gap-3 hover:bg-hover transition-colors text-left group"
                    >
                      {/* Book icon */}
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>

                      {/* Book info */}
                      <button
                        onClick={() => handleInternalSelect(book.id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">{book.name}</span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                              book.visibility === 'GM_BOOK'
                                ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                                : 'bg-green-500/10 text-green-500 border border-green-500/20'
                            }`}
                          >
                            {book.visibility === 'GM_BOOK' ? 'GM' : 'Player'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatFileSize(book.fileLength)}</p>
                      </button>

                      {/* Open button */}
                      <button
                        onClick={() => handleInternalSelect(book.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all shrink-0"
                        aria-label={`Open ${book.name}`}
                        title="Open"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-border shrink-0 text-[11px] text-muted-foreground">
              {books.length} book{books.length !== 1 ? 's' : ''}
            </div>
          </>
        )}
      </aside>

      {/* Restore pill — shown while minimized. The aside stays mounted (offscreen) so the
          native PDF iframe's page/zoom/scroll survive; this is the only restore affordance on
          the adventure page, where hideToggle suppresses the floating toggle. */}
      {minimized && (
        <button
          onClick={() => {
            setMinimized(false)
            setIsOpen(true)
          }}
          className="fixed top-24 right-0 z-40 flex items-center gap-2 px-3 py-2 rounded-l-lg bg-surface border border-r-0 border-border text-sm font-medium text-foreground hover:bg-hover transition-colors shadow-lg"
          aria-label="Restore books sidebar"
          title="Restore books sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline text-xs">{isViewerMode ? activeBookName : 'Books'}</span>
        </button>
      )}
    </>
  )
}
