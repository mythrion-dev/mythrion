'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { api, API_URL } from '@/lib/api'
import { PdfJsViewer, type PdfJsViewerHandle, type OutlineItem } from './PdfJsViewer'
import { SearchToolbar, type SearchState } from './SearchToolbar'
import { OutlinePanel } from './OutlinePanel'

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
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3] as const
const DEFAULT_PAGE_INPUT = ''

interface PersistedState {
  page: number
  scale: string | number
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
    if (typeof state.page === 'number' && (typeof state.scale === 'number' || typeof state.scale === 'string')) {
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

  /* ── Refs ── */
  const bookNameMapRef = useRef<Map<string, string>>(new Map())
  const viewerRef = useRef<PdfJsViewerHandle>(null)
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Book list state ── */
  const [books, setBooks] = useState<Book[]>([])
  const [loadingList, setLoadingList] = useState(false)

  /* ── PDF loading state ── */
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetchingPdf, setFetchingPdf] = useState(false)

  /* ── Viewer metadata ── */
  const [pagesCount, setPagesCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [currentScale, setCurrentScale] = useState(1)
  const [pageInput, setPageInput] = useState(DEFAULT_PAGE_INPUT)

  /* ── Search state ── */
  const [searchState, setSearchState] = useState<SearchState | null>(null)

  /* ── Outline state ── */
  const [outlineItems, setOutlineItems] = useState<OutlineItem[]>([])
  const [outlineOpen, setOutlineOpen] = useState(false)

  /* ── Derived state ── */
  const activeBookId = bookId ?? internalBookId
  const isViewerMode = activeBookId !== null
  const sidebarVisible = isOpen || bookId !== null || internalBookId !== null || internalListOpen
  const activeBookName = books.find((b) => b.id === activeBookId)?.name ?? 'PDF Viewer'

  // Restore persisted state
  const persistedState = useMemo(() => loadPersistedState(adventureId), [adventureId])

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

  // Fetch books on mount when sidebar is visible (e.g., external viewer mode)
  useEffect(() => {
    if (adventureId) {
      void fetchBooks()
    }
  }, [adventureId, fetchBooks])

  /* ── Fetch PDF as ArrayBuffer ── */
  const pdfUrl = activeBookId
    ? `${API_URL}/adventures/${adventureId}/books/${activeBookId}/file`
    : null

  useEffect(() => {
    if (!activeBookId || !pdfUrl) {
      setPdfData(null)
      setFetchError(null)
      setPagesCount(0)
      setCurrentPage(1)
      setCurrentScale(1)
      setSearchState(null)
      setOutlineItems([])
      return
    }

    let isCancelled = false

    async function loadPdf() {
      setFetchError(null)
      setPdfData(null)
      setFetchingPdf(true)
      setPagesCount(0)
      setCurrentPage(1)
      setSearchState(null)
      setOutlineItems([])

      try {
        const token = localStorage.getItem('accessToken')
        const res = await fetch(pdfUrl, {
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })

        if (!res.ok) {
          throw new Error(`Failed to load PDF: ${res.status}`)
        }

        const buffer = await res.arrayBuffer()
        if (isCancelled) return

        setPdfData(buffer)

        // Restore persisted page/scale after document loads
        if (persistedState) {
          // The viewer callbacks will pick this up on document load
        }
      } catch (err) {
        if (!isCancelled) {
          setFetchError(err instanceof Error ? err.message : 'Failed to load PDF')
        }
      } finally {
        if (!isCancelled) setFetchingPdf(false)
      }
    }

    void loadPdf()

    return () => {
      isCancelled = true
    }
  }, [activeBookId, adventureId, pdfUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Apply persisted state after document loads ── */
  const handleDocumentLoad = useCallback(
    (info: { pagesCount: number }) => {
      setPagesCount(info.pagesCount)

      // Restore persisted state
      const state = loadPersistedState(adventureId)
      if (state && state.page >= 1 && state.page <= info.pagesCount) {
        if (viewerRef.current) {
          viewerRef.current.goToPage(state.page)
        }
      }
      if (state && state.scale) {
        if (viewerRef.current) {
          viewerRef.current.setScale(state.scale)
        }
      }
    },
    [adventureId],
  )

  /* ── Persist state (debounced) ── */
  const schedulePersist = useCallback(
    (page: number, scale: number) => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current)
      persistTimeoutRef.current = setTimeout(() => {
        savePersistedState(adventureId, { page, scale })
      }, 500)
    },
    [adventureId],
  )

  const handlePageChange = useCallback(
    (pageNumber: number) => {
      setCurrentPage(pageNumber)
      setPageInput(DEFAULT_PAGE_INPUT)
      schedulePersist(pageNumber, currentScale)
    },
    [currentScale, schedulePersist],
  )

  const handleScaleChange = useCallback(
    (scale: number) => {
      setCurrentScale(scale)
      schedulePersist(currentPage, scale)
    },
    [currentPage, schedulePersist],
  )

  const handleFindResults = useCallback((current: number, total: number) => {
    if (total === 0) {
      setSearchState(null)
    } else {
      setSearchState({ current, total })
    }
  }, [])

  const handleOutline = useCallback((items: OutlineItem[]) => {
    setOutlineItems(items)
  }, [])

  /* ── Toolbar actions ── */

  const handleZoomIn = useCallback(() => {
    viewerRef.current?.zoomIn()
  }, [])

  const handleZoomOut = useCallback(() => {
    viewerRef.current?.zoomOut()
  }, [])

  const handleZoomReset = useCallback(() => {
    viewerRef.current?.setScale(1)
  }, [])

  const handleZoomActualSize = useCallback(() => {
    viewerRef.current?.setScale('page-actual')
  }, [])

  const handlePagePrev = useCallback(() => {
    viewerRef.current?.previousPage()
  }, [])

  const handlePageNext = useCallback(() => {
    viewerRef.current?.nextPage()
  }, [])

  const handlePageInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value)
  }, [])

  const handlePageInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const num = parseInt(pageInput, 10)
        if (!isNaN(num) && num >= 1 && num <= pagesCount) {
          viewerRef.current?.goToPage(num)
        }
        setPageInput(DEFAULT_PAGE_INPUT)
      }
    },
    [pageInput, pagesCount],
  )

  const handleSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchState(null)
      return
    }
    viewerRef.current?.search(query)
  }, [])

  const handleSearchNext = useCallback(() => {
    viewerRef.current?.searchNext()
  }, [])

  const handleSearchPrev = useCallback(() => {
    viewerRef.current?.searchPrevious()
  }, [])

  const handleRotate = useCallback(() => {
    viewerRef.current?.rotate(90)
  }, [])

  const handleOutlineToggle = useCallback(() => {
    setOutlineOpen((prev) => !prev)
  }, [])

  const handleOutlineNavigate = useCallback(
    (dest: string | unknown[]) => {
      viewerRef.current?.goToDestination(dest)
    },
    [],
  )

  /* ── Sidebar close ── */
  function handleClose() {
    if (internalBookId) {
      setInternalBookId(null)
      setInternalListOpen(true)
      setIsOpen(true)
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

  /* ── Cleanup persist timeout on unmount ── */
  useEffect(() => {
    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current)
    }
  }, [])

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
        <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={handleClose} />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full bg-surface border-l border-border shadow-2xl transition-all duration-300 flex flex-col w-1/2 max-sm:w-full sm:max-w-[95vw] lg:w-1/2 xl:w-[45%] ${
          sidebarVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
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

          /* Toolbar */
          <>
            {/* Main toolbar: Zoom, page nav, rotate, outline toggle */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border shrink-0 flex-wrap">
              {/* Zoom out */}
              <button
                onClick={handleZoomOut}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
                aria-label="Zoom out"
                title="Zoom out"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                </svg>
              </button>

              {/* Zoom level display */}
              <button
                onClick={handleZoomReset}
                className="px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground hover:text-foreground hover:bg-hover rounded transition-colors min-w-[4ch] text-center"
                title="Reset zoom to 100%"
              >
                {Math.round(currentScale * 100)}%
              </button>

              {/* Zoom in */}
              <button
                onClick={handleZoomIn}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
                aria-label="Zoom in"
                title="Zoom in"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>

              {/* Zoom to actual size */}
              <button
                onClick={handleZoomActualSize}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
                aria-label="Actual size"
                title="Actual size"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>

              {/* Separator */}
              <div className="w-px h-4 bg-border mx-1" />

              {/* Page prev */}
              <button
                onClick={handlePagePrev}
                disabled={currentPage <= 1}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Previous page"
                title="Previous page"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Page input */}
              <div className="flex items-center gap-0.5">
                <input
                  type="text"
                  inputMode="numeric"
                  value={pageInput || currentPage}
                  onChange={handlePageInputChange}
                  onKeyDown={handlePageInputKeyDown}
                  className="w-8 text-center text-xs tabular-nums bg-transparent text-foreground border border-border rounded px-1 py-0.5 outline-none focus:border-accent"
                  aria-label="Current page number"
                />
                <span className="text-xs text-muted-foreground tabular-nums">
                  / {pagesCount}
                </span>
              </div>

              {/* Page next */}
              <button
                onClick={handlePageNext}
                disabled={currentPage >= pagesCount}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Next page"
                title="Next page"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Separator */}
              <div className="w-px h-4 bg-border mx-1" />

              {/* Rotate */}
              <button
                onClick={handleRotate}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
                aria-label="Rotate 90°"
                title="Rotate 90°"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 13v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              {/* Separator */}
              <div className="w-px h-4 bg-border mx-1" />

              {/* Outline toggle */}
              <button
                onClick={handleOutlineToggle}
                className={`p-1 rounded transition-colors ${
                  outlineOpen
                    ? 'text-accent bg-accent/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-hover'
                }`}
                aria-label="Toggle table of contents"
                title="Table of contents"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </button>
            </div>

            {/* Search toolbar */}
            <SearchToolbar
              onSearch={handleSearch}
              onNextMatch={handleSearchNext}
              onPrevMatch={handleSearchPrev}
              searchState={searchState}
            />

            {/* Viewer + Outline panel */}
            <div className="flex-1 flex overflow-hidden">
              {/* PDF viewer */}
              <div className="flex-1 min-w-0 relative bg-[#525659]">
                {fetchError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-danger-muted flex items-center justify-center text-xl mb-3">
                      ⚠️
                    </div>
                    <p className="text-sm text-danger font-medium mb-1">Failed to load PDF</p>
                    <p className="text-xs text-muted-foreground">{fetchError}</p>
                  </div>
                ) : fetchingPdf ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-8 h-8 text-white/60 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-xs text-white/60">Loading PDF…</span>
                    </div>
                  </div>
                ) : (
                  <PdfJsViewer
                    ref={viewerRef}
                    pdfData={pdfData}
                    onDocumentLoad={handleDocumentLoad}
                    onPageChange={handlePageChange}
                    onScaleChange={handleScaleChange}
                    onOutline={handleOutline}
                    onFindResults={handleFindResults}
                  />
                )}
              </div>

              {/* Outline panel */}
              {outlineOpen && (
                <OutlinePanel
                  items={outlineItems}
                  onNavigate={handleOutlineNavigate}
                  isOpen={outlineOpen}
                  onToggle={handleOutlineToggle}
                />
              )}
            </div>
          </>
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
    </>
  )
}
