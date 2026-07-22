'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api, API_URL } from '@/lib/api'
import { Document, Page, pdfjs } from 'react-pdf'
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api'

/* ── Configure PDF.js worker ── */

// Use CDN worker matching the pdfjs-dist version react-pdf depends on internally
// react-pdf v10.4.1 ships pdfjs-dist@5.4.296 — the worker version must match the API version
pdfjs.GlobalWorkerOptions.workerSrc =
  'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs'

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

/* ── localStorage constants ── */

const LS_PREFIX = 'pdf-viewer:'
const LS_VERSION = 1

interface PersistedState {
  version: number
  bookId: string
  pageNumber: number
  scale: number
}

/* ── Helpers ── */

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
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

  /* ── Book list state ── */
  const [books, setBooks] = useState<Book[]>([])
  const [loadingList, setLoadingList] = useState(false)

  /* ── PDF viewer state ── */
  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [scale, setScale] = useState(1.0)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [loadProgress, setLoadProgress] = useState(0)
  const [token, setToken] = useState<string | null>(null)

  /* ── Search state ── */
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatches, setSearchMatches] = useState(0)
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)

  /* ── Derived state ── */
  const activeBookId = bookId ?? internalBookId
  const isViewerMode = activeBookId !== null

  /* ── Sidebar visibility ── */
  const sidebarVisible = bookId !== null || internalBookId !== null || internalListOpen

  // Get auth token on mount
  useEffect(() => {
    setToken(localStorage.getItem('accessToken'))
  }, [])

  /* ── Open when external bookId changes to non-null ── */
  useEffect(() => {
    if (bookId) {
      setInternalBookId(null)
      setInternalListOpen(false)
      setIsOpen(true)
    }
  }, [bookId])

  /* ── Open sidebar when internalListOpen is toggled ── */
  useEffect(() => {
    if (internalListOpen) {
      setIsOpen(true)
    }
  }, [internalListOpen])

  /* ── Fetch books for internal list ── */
  const fetchBooks = useCallback(async () => {
    if (!adventureId) return
    setLoadingList(true)
    try {
      const data = await api.get<Book[]>(`/adventures/${adventureId}/books`)
      setBooks(data)
    } catch {
      /* silently fail */
    } finally {
      setLoadingList(false)
    }
  }, [adventureId])

  useEffect(() => {
    if (sidebarVisible && !isViewerMode) {
      fetchBooks()
    }
  }, [sidebarVisible, isViewerMode, fetchBooks])

  /* ── Restore localStorage state on book selection ── */
  useEffect(() => {
    if (activeBookId) {
      try {
        const raw = localStorage.getItem(`${LS_PREFIX}${adventureId}`)
        if (raw) {
          const saved: PersistedState = JSON.parse(raw)
          if (saved.version === LS_VERSION && saved.bookId === activeBookId) {
            setPageNumber(saved.pageNumber)
            setScale(saved.scale)
            return
          }
        }
      } catch {
        /* ignore corrupt data */
      }
      // No saved state or different book → reset
      setPageNumber(1)
      setScale(1.0)
    }
  }, [activeBookId, adventureId])

  /* ── Persist viewer state to localStorage ── */
  useEffect(() => {
    if (activeBookId && pageNumber > 0) {
      try {
        const state: PersistedState = {
          version: LS_VERSION,
          bookId: activeBookId,
          pageNumber,
          scale,
        }
        localStorage.setItem(`${LS_PREFIX}${adventureId}`, JSON.stringify(state))
      } catch {
        /* quota exceeded — ignore */
      }
    }
  }, [activeBookId, adventureId, pageNumber, scale])

  /* ── Reset search when book changes ── */
  useEffect(() => {
    setSearchQuery('')
    setSearchMatches(0)
    setCurrentMatchIndex(0)
    setPdfError(null)
    setLoadProgress(0)
  }, [activeBookId])

  /* ── PDF callbacks ── */
  function handleLoadSuccess(pdf: { numPages: number }) {
    setNumPages(pdf.numPages)
    setPdfError(null)
  }

  function handleLoadError(error: Error) {
    setPdfError(error.message || 'Failed to load PDF')
    setNumPages(null)
  }

  function handleLoadProgress(progress: { loaded: number; total: number }) {
    if (progress.total > 0) {
      setLoadProgress(Math.round((progress.loaded / progress.total) * 100))
    }
  }

  /* ── Zoom controls ── */
  function zoomIn() {
    setScale((s) => Math.min(s + 0.25, 2.0))
  }

  function zoomOut() {
    setScale((s) => Math.max(s - 0.25, 0.5))
  }

  function resetZoom() {
    setScale(1.0)
  }

  /* ── Page navigation ── */
  function goToPage(n: number) {
    if (numPages && n >= 1 && n <= numPages) {
      setPageNumber(n)
    }
  }

  /* ── Search ── */
  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) {
      setSearchMatches(0)
      setCurrentMatchIndex(0)
      return
    }
    // Simple search: count matches in the search query
    // For MVP, we just show query was found; full text search would need pdfjs page iteration
    setSearchMatches(searchQuery.length > 0 ? 1 : 0)
    setCurrentMatchIndex(1)
  }

  /* ── Sidebar close — respects internal vs external state ── */
  function handleClose() {
    if (internalBookId) {
      // Go back to list mode
      setInternalBookId(null)
      setPageNumber(1)
      setInternalListOpen(true)
      return
    }
    if (internalListOpen) {
      setInternalListOpen(false)
    }
    setIsOpen(false)
    onClose()
  }

  /* ── Internal book selection ── */
  function handleInternalSelect(id: string) {
    setInternalBookId(id)
    setInternalListOpen(false)
    onBookSelect?.(id)
  }

  /* ── Floating toggle button ── */
  function handleToggle() {
    if (isOpen && !isViewerMode && !internalListOpen) {
      // Sidebar was showing list — close it
      handleClose()
    } else if (isOpen && isViewerMode) {
      // In viewer mode — go back to list if internally managed
      if (internalBookId) {
        setInternalBookId(null)
        setInternalListOpen(true)
      } else {
        handleClose()
      }
    } else {
      // Closed — open list
      setInternalListOpen(true)
    }
  }

  /* ── PDF URL + auth options ── */
  const pdfUrl = activeBookId
    ? `${API_URL}/adventures/${adventureId}/books/${activeBookId}/file`
    : null

  const pdfOptions: DocumentInitParameters | undefined = useMemo(() => {
    if (!token) return undefined
    return {
      httpHeaders: { Authorization: `Bearer ${token}` },
    } as DocumentInitParameters & { httpHeaders: Record<string, string> }
  }, [token])

  /* ── Render: closed state ── */
  if (!isOpen && !sidebarVisible) {
    if (hideToggle) return null

    return (
      <button
        onClick={handleToggle}
        className="fixed top-32 right-0 z-40 flex items-center gap-2 px-3 py-2 rounded-l-lg bg-surface border border-r-0 border-border text-sm font-medium text-foreground hover:bg-hover transition-colors shadow-lg"
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
      {/* Mobile overlay */}
      {sidebarVisible && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={handleClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full bg-surface border-l border-border shadow-2xl transition-all duration-300 flex flex-col w-[420px] max-w-[95vw] ${
          sidebarVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold text-foreground">
            {isViewerMode ? 'PDF Viewer' : 'Campaign Books'}
          </h2>
          <div className="flex items-center gap-1">
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
              onClick={handleClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        {isViewerMode ? (
          /* ══════ VIEWER MODE ══════ */
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0 gap-2 flex-wrap">
              {/* Zoom controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={zoomOut}
                  disabled={scale <= 0.5}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors disabled:opacity-40"
                  aria-label="Zoom out"
                  title="Zoom out"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                  </svg>
                </button>
                <button
                  onClick={resetZoom}
                  className="px-2 py-0.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-hover rounded transition-colors"
                  title="Reset zoom"
                >
                  {Math.round(scale * 100)}%
                </button>
                <button
                  onClick={zoomIn}
                  disabled={scale >= 2.0}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors disabled:opacity-40"
                  aria-label="Zoom in"
                  title="Zoom in"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {/* Page navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(pageNumber - 1)}
                  disabled={pageNumber <= 1}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                  {pageNumber}
                  {numPages ? ` / ${numPages}` : ''}
                </span>
                <button
                  onClick={() => goToPage(pageNumber + 1)}
                  disabled={!numPages || pageNumber >= numPages}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors disabled:opacity-40"
                  aria-label="Next page"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Search */}
              <form
                onSubmit={handleSearch}
                className="flex items-center gap-1"
              >
                <div className="relative">
                  <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-24 pl-7 pr-2 py-1 rounded bg-input border border-border text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
                  />
                </div>
                {searchQuery && searchMatches > 0 && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap tabular-nums">
                    {currentMatchIndex}/{searchMatches}
                  </span>
                )}
              </form>
            </div>

            {/* PDF viewer */}
            <div className="flex-1 overflow-y-auto bg-[#525659]">
              {loadProgress > 0 && loadProgress < 100 && (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-32 h-1.5 rounded-full bg-surface overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-300"
                        style={{ width: `${loadProgress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Loading PDF… {loadProgress}%
                    </span>
                  </div>
                </div>
              )}

              {pdfError && (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-danger-muted flex items-center justify-center text-xl mb-3">
                    ⚠️
                  </div>
                  <p className="text-sm text-danger font-medium mb-1">Failed to load PDF</p>
                  <p className="text-xs text-muted-foreground">{pdfError}</p>
                  <button
                    onClick={() => setPdfError(null)}
                    className="mt-3 btn-primary !py-1 !px-3 !text-xs"
                  >
                    Retry
                  </button>
                </div>
              )}

              {pdfUrl && !pdfError && (
                <div className="flex flex-col items-center py-4 px-2">
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={handleLoadSuccess}
                    onLoadError={handleLoadError}
                    onLoadProgress={handleLoadProgress}
                    options={pdfOptions as any}
                    loading={
                      <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <svg className="w-8 h-8 text-accent animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span className="text-xs text-muted-foreground">Loading PDF…</span>
                        </div>
                      </div>
                    }
                    error={
                      <div className="flex items-center justify-center py-12">
                        <p className="text-sm text-danger">Failed to load PDF.</p>
                      </div>
                    }
                    noData={
                      <div className="flex items-center justify-center py-12">
                        <p className="text-sm text-muted-foreground">No PDF file specified.</p>
                      </div>
                    }
                  >
                    <Page
                      pageNumber={pageNumber}
                      scale={scale}
                      width={380}
                      renderTextLayer
                      renderAnnotationLayer
                      loading={
                        <div className="flex items-center justify-center py-8">
                          <div className="skeleton w-[380px] h-[500px] rounded" />
                        </div>
                      }
                      error={
                        <div className="flex items-center justify-center py-8">
                          <p className="text-xs text-danger">Failed to load page {pageNumber}.</p>
                        </div>
                      }
                    />
                  </Document>
                </div>
              )}
            </div>
          </>
        ) : (
          /* ══════ LIST MODE ══════ */
          <>
            {/* Book list content */}
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
                          <span className="text-sm font-medium text-foreground truncate">
                            {book.name}
                          </span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                            book.visibility === 'GM_BOOK'
                              ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                              : 'bg-green-500/10 text-green-500 border border-green-500/20'
                          }`}>
                            {book.visibility === 'GM_BOOK' ? 'GM' : 'Player'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatFileSize(book.fileLength)}
                        </p>
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
    </>
  )
}
