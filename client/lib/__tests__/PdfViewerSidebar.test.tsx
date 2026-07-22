import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { PdfViewerSidebar } from '@/components/books/PdfViewerSidebar'
import { api } from '@/lib/api'

/* ── Mock react-pdf ── */

vi.mock('react-pdf', () => {
  const mockWorker = { workerSrc: '' }
  return {
    pdfjs: {
      GlobalWorkerOptions: mockWorker,
    },
    Document: ({
      children,
      onLoadSuccess,
      onLoadError,
      onLoadProgress,
      file,
      loading: Loading,
      error: ErrorEl,
    }: any) => {
      // If no file provided but loading is shown, render loading
      if (!file) {
        return Loading || null
      }
      // Simulate PDF load progress then success
      onLoadProgress?.({ loaded: 500_000, total: 1_000_000 })
      // Schedule onLoadSuccess asynchronously so React can process the state
      Promise.resolve().then(() => {
        onLoadSuccess?.({ numPages: 10 })
      })
      // Don't render children until load is "complete" — in test we just render them
      // to allow the Page mock to appear
      return (
        <div data-testid="document-mock">
          {children}
        </div>
      )
    },
    Page: ({ pageNumber, scale }: any) => (
      <div data-testid="pdf-page" data-page-number={pageNumber} data-scale={scale}>
        Page {pageNumber}
      </div>
    ),
  }
})

/* ── Mock api module ── */

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
  API_URL: 'http://localhost:3001/api',
}))

/* ── Test data ── */

const mockBooks = [
  {
    id: 'book-1',
    name: 'Campaign Guide',
    visibility: 'GM_BOOK' as const,
    fileLength: 2_500_000,
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z',
  },
  {
    id: 'book-2',
    name: 'Player Handbook',
    visibility: 'PLAYER_BOOK' as const,
    fileLength: 1_200_000,
    createdAt: '2025-02-01T00:00:00Z',
    updatedAt: '2025-02-01T00:00:00Z',
  },
]

/* ── Helpers ── */

function renderSidebar(props: Partial<React.ComponentProps<typeof PdfViewerSidebar>> = {}) {
  return render(
    <PdfViewerSidebar
      adventureId="adv-1"
      isGM={true}
      bookId={null}
      onClose={vi.fn()}
      {...props}
    />,
  )
}

/* ── Tests ── */

describe('PdfViewerSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    ;(api.get as any).mockResolvedValue(mockBooks)
  })

  afterEach(() => {
    cleanup()
  })

  /* ── Closed state ── */

  it('renders floating toggle button when closed and hideToggle is false', () => {
    renderSidebar({ hideToggle: false })
    expect(screen.getByLabelText('Open books sidebar')).toBeInTheDocument()
    expect(screen.getByText('Books')).toBeInTheDocument()
  })

  it('returns null when default closed with hideToggle', () => {
    const { container } = renderSidebar({ hideToggle: true })
    expect(container.innerHTML).toBe('')
  })

  /* ── Open via toggle button ── */

  it('opens book list when toggle button is clicked', async () => {
    renderSidebar()
    expect(screen.getByLabelText('Open books sidebar')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Open books sidebar'))

    // After click, sidebar should show book list
    expect(await screen.findByText('Campaign Books')).toBeInTheDocument()
    // Should fetch and display books
    expect(await screen.findByText('Campaign Guide')).toBeInTheDocument()
    expect(screen.getByText('Player Handbook')).toBeInTheDocument()
    // Should show book count
    expect(screen.getByText('2 books')).toBeInTheDocument()
  })

  /* ── Viewer mode via external bookId ── */

  it('opens in viewer mode when bookId is provided', async () => {
    renderSidebar({ bookId: 'book-1' })

    // Should show PDF Viewer header
    expect(await screen.findByText('PDF Viewer')).toBeInTheDocument()
    // Should show toolbar with zoom/page controls
    expect(screen.getByLabelText('Zoom out')).toBeInTheDocument()
    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument()
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument()
    expect(screen.getByLabelText('Next page')).toBeInTheDocument()
    // Should not show book list back button (externally managed)
    expect(screen.queryByLabelText('Back to book list')).not.toBeInTheDocument()
  })

  it('shows page navigation with numPages after PDF loads', async () => {
    renderSidebar({ bookId: 'book-1' })

    // Wait for onLoadSuccess to fire — shows "1 / 10"
    await waitFor(() => {
      expect(screen.getByText(/1 \/ 10/)).toBeInTheDocument()
    })
  })

  /* ── Zoom controls ── */

  it('zooms in when zoom in button is clicked', async () => {
    renderSidebar({ bookId: 'book-1' })
    // Initial zoom is 100%
    expect(await screen.findByText('100%')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Zoom in'))

    // Should now show 125%
    expect(screen.getByText('125%')).toBeInTheDocument()
  })

  it('zooms out when zoom out button is clicked', async () => {
    renderSidebar({ bookId: 'book-1' })
    expect(await screen.findByText('100%')).toBeInTheDocument()

    // Zoom in twice to 150%
    fireEvent.click(screen.getByLabelText('Zoom in'))
    fireEvent.click(screen.getByLabelText('Zoom in'))
    expect(screen.getByText('150%')).toBeInTheDocument()

    // Zoom out once
    fireEvent.click(screen.getByLabelText('Zoom out'))
    expect(screen.getByText('125%')).toBeInTheDocument()
  })

  it('resets zoom when zoom percentage button is clicked', async () => {
    renderSidebar({ bookId: 'book-1' })
    expect(await screen.findByText('100%')).toBeInTheDocument()

    // Zoom in
    fireEvent.click(screen.getByLabelText('Zoom in'))
    expect(screen.getByText('125%')).toBeInTheDocument()

    // Click the zoom percentage button to reset
    fireEvent.click(screen.getByTitle('Reset zoom'))
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('disables zoom out at minimum scale', async () => {
    renderSidebar({ bookId: 'book-1' })
    expect(await screen.findByText('100%')).toBeInTheDocument()

    // Zoom out until minimum
    const zoomOut = screen.getByLabelText('Zoom out')
    fireEvent.click(zoomOut) // 75%
    fireEvent.click(zoomOut) // 50%
    fireEvent.click(zoomOut) // stays 50%, disabled

    expect(zoomOut).toBeDisabled()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('disables zoom in at maximum scale', async () => {
    renderSidebar({ bookId: 'book-1' })
    expect(await screen.findByText('100%')).toBeInTheDocument()

    const zoomIn = screen.getByLabelText('Zoom in')
    // 100% → 125% → 150% → 175% → 200% (max)
    fireEvent.click(zoomIn)
    fireEvent.click(zoomIn)
    fireEvent.click(zoomIn)
    fireEvent.click(zoomIn)

    expect(zoomIn).toBeDisabled()
    expect(screen.getByText('200%')).toBeInTheDocument()
  })

  /* ── Page navigation ── */

  it('navigates to next page when next button is clicked', async () => {
    renderSidebar({ bookId: 'book-1' })

    // Wait for PDF to load (showing page 1 of 10)
    await waitFor(() => {
      expect(screen.getByText(/1 \/ 10/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Next page'))
    expect(screen.getByText(/2 \/ 10/)).toBeInTheDocument()
  })

  it('navigates to previous page when prev button is clicked', async () => {
    renderSidebar({ bookId: 'book-1' })

    await waitFor(() => {
      expect(screen.getByText(/1 \/ 10/)).toBeInTheDocument()
    })

    // Go to page 5
    const next = screen.getByLabelText('Next page')
    fireEvent.click(next)
    fireEvent.click(next)
    fireEvent.click(next)
    fireEvent.click(next)
    expect(screen.getByText(/5 \/ 10/)).toBeInTheDocument()

    // Go back
    fireEvent.click(screen.getByLabelText('Previous page'))
    expect(screen.getByText(/4 \/ 10/)).toBeInTheDocument()
  })

  it('disables prev button on first page', async () => {
    renderSidebar({ bookId: 'book-1' })

    await waitFor(() => {
      expect(screen.getByText(/1 \/ 10/)).toBeInTheDocument()
    })

    expect(screen.getByLabelText('Previous page')).toBeDisabled()
  })

  it('disables next button on last page', async () => {
    renderSidebar({ bookId: 'book-1' })

    await waitFor(() => {
      expect(screen.getByText(/1 \/ 10/)).toBeInTheDocument()
    })

    const next = screen.getByLabelText('Next page')

    // Go to page 10
    for (let i = 0; i < 9; i++) {
      fireEvent.click(next)
    }
    expect(screen.getByText(/10 \/ 10/)).toBeInTheDocument()
    expect(next).toBeDisabled()
  })

  /* ── Search ── */

  it('shows search input in viewer mode', async () => {
    renderSidebar({ bookId: 'book-1' })
    expect(await screen.findByPlaceholderText('Search...')).toBeInTheDocument()
  })

  it('shows match count after searching', async () => {
    renderSidebar({ bookId: 'book-1' })
    const searchInput = await screen.findByPlaceholderText('Search...')

    // Type a query and submit
    fireEvent.change(searchInput, { target: { value: 'dragon' } })
    fireEvent.submit(searchInput)

    // Should show 1/1 (MVP: any non-empty query returns 1 match)
    expect(screen.getByText('1/1')).toBeInTheDocument()
  })

  /* ── Close button ── */

  it('calls onClose when close button is clicked in external viewer mode', async () => {
    const onClose = vi.fn()
    renderSidebar({ bookId: 'book-1', onClose })

    expect(await screen.findByText('PDF Viewer')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Close sidebar'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  /* ── Search clears on book change ── */

  it('clears search when bookId changes', async () => {
    const { rerender } = render(
      <PdfViewerSidebar
        adventureId="adv-1"
        isGM={true}
        bookId="book-1"
        onClose={vi.fn()}
      />,
    )

    const searchInput = await screen.findByPlaceholderText('Search...')
    fireEvent.change(searchInput, { target: { value: 'test' } })
    fireEvent.submit(searchInput)

    expect(screen.getByText('1/1')).toBeInTheDocument()

    // Rerender with new bookId
    rerender(
      <PdfViewerSidebar
        adventureId="adv-1"
        isGM={true}
        bookId="book-2"
        onClose={vi.fn()}
      />,
    )

    // Search should be cleared (submit again with empty query → no match display)
    await waitFor(() => {
      expect(screen.queryByText('1/1')).not.toBeInTheDocument()
    })
  })
})
