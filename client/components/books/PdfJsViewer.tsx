'use client'

import {
  forwardRef,
  useEffect,
  useRef,
  useImperativeHandle,
  useState,
  useCallback,
  type ForwardedRef,
} from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import {
  PDFViewer,
  PDFLinkService,
  PDFFindController,
  EventBus,
  type IL10n,
} from 'pdfjs-dist/web/pdf_viewer.mjs'
import 'pdfjs-dist/web/pdf_viewer.css'

/* ── Types ── */

export interface OutlineItem {
  title: string
  dest?: string | unknown[] | null
  url?: string | null
  items?: OutlineItem[]
  bold?: boolean
  italic?: boolean
  color?: number[]
}

export interface FindResults {
  current: number
  total: number
}

export interface PdfJsViewerHandle {
  zoomIn: () => void
  zoomOut: () => void
  setScale: (value: number | string) => void
  goToPage: (pageNumber: number) => void
  nextPage: () => void
  previousPage: () => void
  search: (query: string) => void
  searchNext: () => void
  searchPrevious: () => void
  rotate: (degrees: number) => void
  getCurrentPage: () => number
  getScale: () => number
  getPagesCount: () => number
  cleanup: () => void
  goToDestination: (dest: string | unknown[]) => void
}

export interface PdfJsViewerProps {
  pdfData: ArrayBuffer | null
  fetchError?: string | null
  onDocumentLoad?: (info: { pagesCount: number }) => void
  onPageChange?: (pageNumber: number) => void
  onScaleChange?: (scale: number) => void
  onOutline?: (items: OutlineItem[]) => void
  onFindResults?: (current: number, total: number) => void
}

/* ── null-l10n (avoids GenericL10n's Fluent .ftl network fetches) ── */

const nullL10n: IL10n = {
  getLanguage: () => 'en-US',
  getDirection: () => 'ltr',
  get: (_ids: string | string[], _args?: Record<string, unknown> | null, fallback?: string) =>
    Promise.resolve((fallback ?? '') as string),
  translate: (_element: HTMLElement) => Promise.resolve(),
  pause: () => {},
  resume: () => {},
}

/* ── PDF Worker ── */

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
}

/* ── Helper: map pdfjs outline item to our interface ── */

function mapOutlineItem(item: {
  title: string
  dest?: string | unknown[] | null
  url?: string | null
  items?: unknown[]
  bold?: boolean
  italic?: boolean
  color?: number[]
}): OutlineItem {
  return {
    title: item.title,
    dest: item.dest,
    url: item.url,
    bold: item.bold,
    italic: item.italic,
    color: item.color,
    items: item.items?.map(mapOutlineItem),
  }
}

/* ── Component ── */

export const PdfJsViewer = forwardRef(function PdfJsViewer(
  {
    pdfData,
    fetchError,
    onDocumentLoad,
    onPageChange,
    onScaleChange,
    onOutline,
    onFindResults,
  }: PdfJsViewerProps,
  ref: ForwardedRef<PdfJsViewerHandle>,
) {
  // ── Refs for imperative instances ──
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const eventBusRef = useRef<EventBus | null>(null)
  const linkServiceRef = useRef<PDFLinkService | null>(null)
  const findControllerRef = useRef<PDFFindController | null>(null)
  const pdfViewerRef = useRef<PDFViewer | null>(null)
  const pdfDocumentRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const listenersRef = useRef<Array<{ event: string; handler: () => void }>>([])

  // ── Callback refs (avoid stale closures in EventBus handlers) ──
  const onPageChangeRef = useRef(onPageChange)
  onPageChangeRef.current = onPageChange
  const onScaleChangeRef = useRef(onScaleChange)
  onScaleChangeRef.current = onScaleChange
  const onDocumentLoadRef = useRef(onDocumentLoad)
  onDocumentLoadRef.current = onDocumentLoad
  const onOutlineRef = useRef(onOutline)
  onOutlineRef.current = onOutline
  const onFindResultsRef = useRef(onFindResults)
  onFindResultsRef.current = onFindResults

  // ── State for imperative handle reads ──
  const pageRef = useRef(1)
  const scaleRef = useRef(1)
  const pagesCountRef = useRef(0)

  const [loading, setLoading] = useState(false)

  // ── Track listener registrations for clean removal ──
  const addListener = useCallback(function addListener(
    eventBus: EventBus,
    event: string,
    handler: (...args: unknown[]) => void,
  ) {
    eventBus.on(event, handler)
    listenersRef.current.push({ event, handler: handler as () => void })
  }, [])

  // ── Cleanup helper ──
  const destroy = useCallback(async function destroy() {
    // Remove all EventBus listeners
    const bus = eventBusRef.current
    if (bus) {
      for (const { event, handler } of listenersRef.current) {
        bus.off(event, handler)
      }
    }
    listenersRef.current = []

    // Clean up PDFViewer
    if (pdfViewerRef.current) {
      pdfViewerRef.current.cleanup()
      pdfViewerRef.current = null
    }

    // Destroy document
    if (pdfDocumentRef.current) {
      try {
        await pdfDocumentRef.current.destroy()
      } catch {
        // ignore destroy errors
      }
      pdfDocumentRef.current = null
    }

    // Clear DOM
    if (viewerRef.current) {
      viewerRef.current.innerHTML = ''
    }

    eventBusRef.current = null
    linkServiceRef.current = null
    findControllerRef.current = null
    pageRef.current = 1
    scaleRef.current = 1
    pagesCountRef.current = 0
  }, [])

  // ── Initialize PDF viewer when pdfData changes ──
  useEffect(
    function initPdfViewer() {
      if (!pdfData || !containerRef.current || !viewerRef.current) return

      let cancelled = false

      async function init() {
        setLoading(true)
        await destroy()

        if (cancelled) return

        const container = containerRef.current!
        const viewerDiv = viewerRef.current!

        // Create services
        const eventBus = new EventBus()
        const linkService = new PDFLinkService({ eventBus })
        const findController = new PDFFindController({
          linkService,
          eventBus,
          updateMatchesCountOnProgress: true,
        })

        // Create PDFViewer
        const pdfViewer = new PDFViewer({
          container,
          viewer: viewerDiv,
          eventBus,
          linkService,
          findController,
          textLayerMode: 2, // ENABLE
          annotationMode: 2, // ENABLE_FORMS
          l10n: nullL10n,
        })

        linkService.setViewer(pdfViewer)

        if (cancelled) {
          pdfViewer.cleanup()
          return
        }

        // Wire EventBus → React state (via refs to avoid stale closures)
        addListener(eventBus, 'pagechanging', (evt: unknown) => {
          const e = evt as { pageNumber: number }
          pageRef.current = e.pageNumber
          onPageChangeRef.current?.(e.pageNumber)
        })

        addListener(eventBus, 'scalechanging', (evt: unknown) => {
          const e = evt as { scale: number }
          scaleRef.current = e.scale
          onScaleChangeRef.current?.(e.scale)
        })

        addListener(eventBus, 'updatefindmatchescount', (evt: unknown) => {
          const e = evt as { matchesCount: { current: number; total: number } }
          onFindResultsRef.current?.(e.matchesCount.current, e.matchesCount.total)
        })

        // Store refs
        eventBusRef.current = eventBus
        linkServiceRef.current = linkService
        findControllerRef.current = findController
        pdfViewerRef.current = pdfViewer

        // Load document
        try {
          const doc = await pdfjsLib.getDocument({ data: pdfData }).promise
          if (cancelled) {
            doc.destroy()
            return
          }

          pdfDocumentRef.current = doc
          pagesCountRef.current = doc.numPages

          pdfViewer.setDocument(doc)
          linkService.setDocument(doc, null)
          findController.setDocument(doc)

          onDocumentLoadRef.current?.({ pagesCount: doc.numPages })

          // Extract outline
          try {
            const outline = await doc.getOutline()
            if (!cancelled && outline) {
              const items: OutlineItem[] = outline.map(mapOutlineItem)
              onOutlineRef.current?.(items)
            }
          } catch {
            // outline may not be available
          }
        } catch {
          // document loading error — parent handles via fetchError
        } finally {
          if (!cancelled) setLoading(false)
        }
      }

      void init()

      return () => {
        cancelled = true
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pdfData],
  )

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      void destroy()
    }
  }, [destroy])

  // ── Imperative handle ──
  useImperativeHandle(
    ref,
    () => ({
      zoomIn() {
        pdfViewerRef.current?.increaseScale()
      },
      zoomOut() {
        pdfViewerRef.current?.decreaseScale()
      },
      setScale(value: number | string) {
        if (pdfViewerRef.current) {
          pdfViewerRef.current.currentScaleValue = value
        }
      },
      goToPage(pageNumber: number) {
        if (pdfViewerRef.current) {
          pdfViewerRef.current.currentPageNumber = pageNumber
        }
      },
      nextPage() {
        pdfViewerRef.current?.nextPage()
      },
      previousPage() {
        pdfViewerRef.current?.previousPage()
      },
      search(query: string) {
        const bus = eventBusRef.current
        if (!bus) return
        bus.dispatch('find', {
          source: this,
          type: '',
          query: query.trim(),
          caseSensitive: false,
          entireWord: false,
          highlightAll: true,
          findPrevious: false,
          matchDiacritics: false,
        })
      },
      searchNext() {
        const bus = eventBusRef.current
        if (!bus) return
        bus.dispatch('find', {
          source: this,
          type: 'again',
          query: null,
          caseSensitive: false,
          entireWord: false,
          highlightAll: true,
          findPrevious: false,
          matchDiacritics: false,
        })
      },
      searchPrevious() {
        const bus = eventBusRef.current
        if (!bus) return
        bus.dispatch('find', {
          source: this,
          type: 'again',
          query: null,
          caseSensitive: false,
          entireWord: false,
          highlightAll: true,
          findPrevious: true,
          matchDiacritics: false,
        })
      },
      rotate(degrees: number) {
        const viewer = pdfViewerRef.current
        if (!viewer) return
        // PDFViewer doesn't have a rotate method — iterate pages
        const pages = viewer as unknown as { pages: Array<{ rotate: number }> }
        if (pages.pages) {
          for (const page of pages.pages) {
            page.rotate = (page.rotate + degrees) % 360
          }
        }
      },
      getCurrentPage() {
        return pageRef.current
      },
      getScale() {
        return scaleRef.current
      },
      getPagesCount() {
        return pagesCountRef.current
      },
      cleanup() {
        void destroy()
      },
      goToDestination(dest: string | unknown[]) {
        linkServiceRef.current?.goToDestination(dest)
      },
    }),
    [destroy],
  )

  // ── Render ──
  return (
    <div className="relative w-full h-full">
      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#525659]/80">
          <div className="flex flex-col items-center gap-3">
            <svg className="w-8 h-8 text-white/80 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs text-white/70">Loading PDF…</span>
          </div>
        </div>
      )}

      {/* PDF viewer container — absolutely positioned per pdfjs requirement */}
      <div className="absolute inset-0 bg-[#525659]" ref={containerRef}>
        <div className="pdfViewer" ref={viewerRef} />
      </div>
    </div>
  )
})
