import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { PdfViewerSidebar } from '@/components/books/PdfViewerSidebar'
import { api, getAccessToken } from '@/lib/api'

/* ── Mock api module ── */

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
  API_URL: 'http://localhost:3001/api',
  getAccessToken: vi.fn(() => null),
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
    ;(getAccessToken as any).mockReturnValue(null)
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

  /* ── Open via toggle button → book list ── */

  it('opens book list when toggle button is clicked', async () => {
    renderSidebar()
    expect(screen.getByLabelText('Open books sidebar')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Open books sidebar'))

    expect(await screen.findByText('Campaign Books')).toBeInTheDocument()
    expect(await screen.findByText('Campaign Guide')).toBeInTheDocument()
    expect(screen.getByText('Player Handbook')).toBeInTheDocument()
    expect(screen.getByText('2 books')).toBeInTheDocument()
  })

  it('shows GM badge for GM_BOOK and Player badge for PLAYER_BOOK', async () => {
    renderSidebar()

    fireEvent.click(screen.getByLabelText('Open books sidebar'))

    await screen.findByText('Campaign Guide')
    expect(screen.getByText('GM')).toBeInTheDocument()
    expect(screen.getByText('Player')).toBeInTheDocument()
  })

  it('shows file size for each book', async () => {
    renderSidebar()

    fireEvent.click(screen.getByLabelText('Open books sidebar'))

    await screen.findByText('Campaign Guide')
    expect(screen.getByText('2.4 MB')).toBeInTheDocument()
    expect(screen.getByText('1.1 MB')).toBeInTheDocument()
  })

  /* ── Viewer mode via external bookId ── */

  it('opens in viewer mode when bookId is provided', async () => {
    renderSidebar({ bookId: 'book-1' })

    expect(await screen.findByText('Campaign Guide')).toBeInTheDocument()
    expect(screen.queryByText('Campaign Books')).not.toBeInTheDocument()
  })

  it('renders iframe with correct src URL pointing to streaming endpoint', async () => {
    renderSidebar({ bookId: 'book-1' })

    const iframe = await screen.findByTestId('pdf-iframe')
    expect(iframe).toBeInTheDocument()
    expect(iframe).toHaveAttribute('src', 'http://localhost:3001/api/adventures/adv-1/books/book-1/file')
  })

  it('includes ?token= query param in iframe URL when access token is available', async () => {
    ;(getAccessToken as any).mockReturnValue('test-jwt-token')
    renderSidebar({ bookId: 'book-1' })

    const iframe = await screen.findByTestId('pdf-iframe')
    expect(iframe).toHaveAttribute(
      'src',
      'http://localhost:3001/api/adventures/adv-1/books/book-1/file?token=test-jwt-token',
    )
  })

  it('iframe has book name as title', async () => {
    renderSidebar({ bookId: 'book-1' })

    const iframe = await screen.findByTestId('pdf-iframe')
    expect(iframe).toHaveAttribute('title', 'Campaign Guide')
  })

  /* ── Viewer mode via internal book selection ── */

  it('opens book in iframe viewer when clicked in internal list', async () => {
    renderSidebar()

    fireEvent.click(screen.getByLabelText('Open books sidebar'))
    const bookButton = await screen.findByText('Campaign Guide')
    fireEvent.click(bookButton)

    const iframe = await screen.findByTestId('pdf-iframe')
    expect(iframe).toHaveAttribute('src', 'http://localhost:3001/api/adventures/adv-1/books/book-1/file')
  })

  it('shows back button in internal viewer mode', async () => {
    renderSidebar()

    fireEvent.click(screen.getByLabelText('Open books sidebar'))
    const bookButton = await screen.findByText('Campaign Guide')
    fireEvent.click(bookButton)

    expect(await screen.findByLabelText('Back to book list')).toBeInTheDocument()
  })

  it('returns to book list when back button is clicked in internal viewer mode', async () => {
    renderSidebar()

    fireEvent.click(screen.getByLabelText('Open books sidebar'))
    const bookButton = await screen.findByText('Campaign Guide')
    fireEvent.click(bookButton)

    expect(await screen.findByLabelText('Back to book list')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Back to book list'))
    expect(await screen.findByText('Campaign Books')).toBeInTheDocument()
    expect(screen.queryByTestId('pdf-iframe')).not.toBeInTheDocument()
  })

  /* ── Loading state ── */

  it('shows loading spinner when iframe is loading', async () => {
    renderSidebar({ bookId: 'book-1' })

    // The iframe should be present and loading spinner shown initially
    const iframe = await screen.findByTestId('pdf-iframe')
    expect(iframe).toBeInTheDocument()
    expect(screen.getByText('Loading PDF…')).toBeInTheDocument()
  })

  /* ── Close button ── */

  it('calls onClose when close button is clicked in external viewer mode', async () => {
    const onClose = vi.fn()
    renderSidebar({ bookId: 'book-1', onClose })

    expect(await screen.findByText('Campaign Guide')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Close sidebar'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes sidebar from internal list mode', async () => {
    const onClose = vi.fn()
    renderSidebar({ onClose })

    fireEvent.click(screen.getByLabelText('Open books sidebar'))
    expect(await screen.findByText('Campaign Books')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Close sidebar'))
    await waitFor(() => {
      expect(screen.queryByText('Campaign Books')).not.toBeInTheDocument()
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('returns to book list when close is clicked in internal viewer mode', async () => {
    const onClose = vi.fn()
    renderSidebar({ onClose })

    fireEvent.click(screen.getByLabelText('Open books sidebar'))
    const book = await screen.findByText('Campaign Guide')
    fireEvent.click(book)

    expect(await screen.findByTestId('pdf-iframe')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Close sidebar'))
    await waitFor(() => {
      expect(screen.getByText('Campaign Books')).toBeInTheDocument()
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  /* ── Responsive sidebar ── */

  it('renders sidebar with responsive width classes', async () => {
    renderSidebar({ bookId: 'book-1' })
    const aside = await screen.findByRole('complementary')
    expect(aside.className).toContain('w-1/2')
    expect(aside.className).toContain('max-sm:w-full')
  })

  /* ── State persistence ── */

  it('saves bookId and bookName to localStorage when viewer is open', async () => {
    renderSidebar({ bookId: 'book-1' })
    await screen.findByTestId('pdf-iframe')

    // Books are fetched asynchronously; wait for name to resolve from fetched data
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('pdf-viewer:adv-1') || '{}')
      expect(stored.bookId).toBe('book-1')
      expect(stored.bookName).toBe('Campaign Guide')
    })
  })

  /* ── Empty/loading book list ── */

  it('shows empty state when no books are available (GM)', async () => {
    ;(api.get as any).mockResolvedValue([])
    renderSidebar({ isGM: true })

    fireEvent.click(screen.getByLabelText('Open books sidebar'))
    expect(await screen.findByText(/Upload one from the adventure page!/)).toBeInTheDocument()
  })

  it('shows empty state when no books are available (Player)', async () => {
    ;(api.get as any).mockResolvedValue([])
    renderSidebar({ isGM: false })

    fireEvent.click(screen.getByLabelText('Open books sidebar'))
    expect(await screen.findByText(/Ask your GM to upload some!/)).toBeInTheDocument()
  })

  it('calls onBookSelect when book is selected in internal list mode', async () => {
    const onBookSelect = vi.fn()
    renderSidebar({ onBookSelect })

    fireEvent.click(screen.getByLabelText('Open books sidebar'))
    const book = await screen.findByText('Campaign Guide')
    fireEvent.click(book)

    expect(onBookSelect).toHaveBeenCalledWith('book-1')
  })

  /* ── Visibility badges in list ── */

  it('shows visibility badges for GM and Player books in list', async () => {
    renderSidebar()

    fireEvent.click(screen.getByLabelText('Open books sidebar'))

    await screen.findByText('Campaign Guide')
    const gmBadge = screen.getByText('GM')
    const playerBadge = screen.getByText('Player')
    expect(gmBadge).toBeInTheDocument()
    expect(playerBadge).toBeInTheDocument()
  })

  /* ── Badge count ── */

  it('shows book count badge on toggle button', async () => {
    renderSidebar()

    fireEvent.click(screen.getByLabelText('Open books sidebar'))
    await screen.findByText('Campaign Guide')
    fireEvent.click(screen.getByLabelText('Close sidebar'))

    const toggleBtn = await screen.findByLabelText('Open books sidebar')
    expect(toggleBtn).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  /* ── Book list skeleton loading ── */

  it('shows loading skeleton while fetching books', () => {
    ;(api.get as any).mockReturnValue(new Promise(() => {})) // never resolves
    renderSidebar()

    fireEvent.click(screen.getByLabelText('Open books sidebar'))
    expect(screen.getByText('Campaign Books')).toBeInTheDocument()
    const skeletons = document.querySelectorAll('.skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  /* ── iframe URL changes when book changes ── */

  it('updates iframe src when a different book is selected', async () => {
    const { rerender } = render(
      <PdfViewerSidebar
        adventureId="adv-1"
        isGM={true}
        bookId="book-1"
        onClose={vi.fn()}
      />,
    )

    let iframe = await screen.findByTestId('pdf-iframe')
    expect(iframe).toHaveAttribute('src', 'http://localhost:3001/api/adventures/adv-1/books/book-1/file')

    rerender(
      <PdfViewerSidebar
        adventureId="adv-1"
        isGM={true}
        bookId="book-2"
        onClose={vi.fn()}
      />,
    )

    iframe = await screen.findByTestId('pdf-iframe')
    expect(iframe).toHaveAttribute('src', 'http://localhost:3001/api/adventures/adv-1/books/book-2/file')
  })

  /* ── Mobile overlay ── */

  it('renders mobile overlay when sidebar is open', async () => {
    renderSidebar({ bookId: 'book-1' })
    await screen.findByTestId('pdf-iframe')

    // Mobile overlay should exist (sm:hidden so not visible on desktop, but in DOM)
    const overlay = document.querySelector('.fixed.inset-0.z-40.bg-black\\/40')
    expect(overlay).toBeInTheDocument()
  })
})
