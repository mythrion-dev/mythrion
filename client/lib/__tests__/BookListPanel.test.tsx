import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BookListPanel } from '@/components/books/BookListPanel'
import { api } from '@/lib/api'

/* ── Mock api module ── */
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  API_URL: 'http://localhost:3001/api',
  authFetch: (input: any, init?: any) => fetch(input, init),
}))

/* ── Mock fetch ── */
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

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

function renderPanel(isGM = true, onSelectBook = vi.fn()) {
  return render(
    <BookListPanel adventureId="adv-1" isGM={isGM} onSelectBook={onSelectBook} />,
  )
}

/* ── Tests ── */

describe('BookListPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(api.get as any).mockResolvedValue(mockBooks)
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    // Set localStorage token for upload/replace
    window.localStorage.setItem('accessToken', 'test-token')
  })

  /* ── Loading state ── */

  it('shows loading skeletons while fetching', () => {
    // Don't resolve the api.get promise yet
    ;(api.get as any).mockReturnValue(new Promise(() => {}))
    renderPanel()
    // Should show skeleton cards
    const skeletons = document.querySelectorAll('.skeleton')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })

  /* ── Empty state ── */

  it('shows empty state when no books exist', async () => {
    ;(api.get as any).mockResolvedValue([])
    renderPanel()
    expect(await screen.findByText(/No Books Yet/)).toBeInTheDocument()
  })

  it('shows GM-specific empty state message for GM', async () => {
    ;(api.get as any).mockResolvedValue([])
    renderPanel(true)
    expect(await screen.findByText(/Upload PDF rulebooks/i)).toBeInTheDocument()
  })

  it('shows player-specific empty state message for player', async () => {
    ;(api.get as any).mockResolvedValue([])
    renderPanel(false)
    expect(await screen.findByText(/Ask your GM to upload/i)).toBeInTheDocument()
  })

  /* ── Book list ── */

  it('renders book list with names', async () => {
    renderPanel()
    expect(await screen.findByText('Campaign Guide')).toBeInTheDocument()
    expect(screen.getByText('Player Handbook')).toBeInTheDocument()
  })

  it('shows visibility badges', async () => {
    renderPanel()
    expect(await screen.findByText('GM')).toBeInTheDocument()
    expect(screen.getByText('Player')).toBeInTheDocument()
  })

  it('shows file size', async () => {
    renderPanel()
    // 2_500_000 ≈ 2.4 MB, 1_200_000 ≈ 1.1 MB
    expect(await screen.findByText(/2\.4 MB/)).toBeInTheDocument()
  })

  /* ── View / Select book ── */

  it('calls onSelectBook when view button is clicked', async () => {
    const onSelectBook = vi.fn()
    renderPanel(true, onSelectBook)
    expect(await screen.findByText('Campaign Guide')).toBeInTheDocument()

    // Click the view icon button (the eye icon)
    const viewButtons = screen.getAllByRole('button', { name: /View/ })
    expect(viewButtons.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(viewButtons[0])

    expect(onSelectBook).toHaveBeenCalledWith('book-1')
  })

  /* ── GM upload ── */

  it('shows upload card for GM', async () => {
    renderPanel(true)
    expect(await screen.findByText('Upload New Book')).toBeInTheDocument()
  })

  it('hides upload card for player', async () => {
    renderPanel(false)
    await waitFor(() => {
      expect(screen.queryByText('Upload New Book')).not.toBeInTheDocument()
    })
  })

  it('performs upload when file is selected', async () => {
    renderPanel(true)
    expect(await screen.findByText('Campaign Guide')).toBeInTheDocument()

    // Set book name
    const nameInput = screen.getByPlaceholderText('Book name...')
    fireEvent.change(nameInput, { target: { value: 'New Book' } })

    // Trigger file selection
    const fileInput = document.querySelector('input[type="file"]')!
    const file = new File(['pdf-content'], 'test.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
      // Should POST to books endpoint
      const callUrl = (mockFetch.mock.calls[0][0] as string)
      expect(callUrl).toContain('/adventures/adv-1/books')
      expect((mockFetch.mock.calls[0][1] as any).method).toBe('POST')
      expect((mockFetch.mock.calls[0][1] as any).body).toBeInstanceOf(FormData)
    })
  })

  /* ── GM rename ── */

  it('shows rename input when rename button is clicked', async () => {
    renderPanel(true)
    expect(await screen.findByText('Campaign Guide')).toBeInTheDocument()

    const renameBtns = screen.getAllByRole('button', { name: /Rename/ })
    fireEvent.click(renameBtns[0])

    // Should show an input with the current name
    const input = screen.getByDisplayValue('Campaign Guide')
    expect(input).toBeInTheDocument()
  })

  it('calls api.patch on rename save', async () => {
    ;(api.patch as any).mockResolvedValue({})

    renderPanel(true)
    expect(await screen.findByText('Campaign Guide')).toBeInTheDocument()

    // Click rename
    const renameBtns = screen.getAllByRole('button', { name: /Rename/ })
    fireEvent.click(renameBtns[0])

    // Change the name
    const input = screen.getByDisplayValue('Campaign Guide')
    fireEvent.change(input, { target: { value: 'Updated Guide' } })

    // Click save (check icon)
    const saveBtn = screen.getByTitle('Save')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        '/adventures/adv-1/books/book-1',
        { name: 'Updated Guide' },
      )
    })
  })

  it('cancels rename on Escape', async () => {
    renderPanel(true)
    expect(await screen.findByText('Campaign Guide')).toBeInTheDocument()

    const renameBtns = screen.getAllByRole('button', { name: /Rename/ })
    fireEvent.click(renameBtns[0])

    const input = screen.getByDisplayValue('Campaign Guide')
    fireEvent.keyDown(input, { key: 'Escape' })

    // After cancel, the name should be visible again, not the input
    expect(screen.getByText('Campaign Guide')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Campaign Guide')).not.toBeInTheDocument()
  })

  /* ── GM delete ── */

  it('shows delete confirmation when delete button is clicked', async () => {
    renderPanel(true)
    expect(await screen.findByText('Campaign Guide')).toBeInTheDocument()

    const deleteBtns = screen.getAllByRole('button', { name: /Delete/ })
    fireEvent.click(deleteBtns[0])

    // Should show Confirm/Cancel buttons
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('calls api.delete on confirm delete', async () => {
    ;(api.delete as any).mockResolvedValue({})

    renderPanel(true)
    expect(await screen.findByText('Campaign Guide')).toBeInTheDocument()

    const deleteBtns = screen.getAllByRole('button', { name: /Delete/ })
    fireEvent.click(deleteBtns[0])

    fireEvent.click(screen.getByText('Confirm'))

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith(
        '/adventures/adv-1/books/book-1',
      )
    })
  })

  it('cancels delete when Cancel is clicked', async () => {
    renderPanel(true)
    expect(await screen.findByText('Campaign Guide')).toBeInTheDocument()

    const deleteBtns = screen.getAllByRole('button', { name: /Delete/ })
    fireEvent.click(deleteBtns[0])

    fireEvent.click(screen.getByText('Cancel'))

    // Confirm should be gone
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument()
  })

  /* ── Error state ── */

  it('shows error banner on API failure', async () => {
    ;(api.get as any).mockRejectedValue(new Error('Network error'))
    renderPanel(true)

    expect(await screen.findByText('Failed to load books')).toBeInTheDocument()
  })

  it('dismisses error banner on close click', async () => {
    ;(api.get as any).mockRejectedValue(new Error('Network error'))
    renderPanel(true)
    expect(await screen.findByText('Failed to load books')).toBeInTheDocument()

    // Click the dismiss button (X icon) — it's inside the error banner
    const dismissBtn = document.querySelector('.bg-danger-muted button')
    expect(dismissBtn).toBeInTheDocument()
    fireEvent.click(dismissBtn!)

    expect(screen.queryByText('Failed to load books')).not.toBeInTheDocument()
  })

  /* ── Player permissions ── */

  it('hides GM action buttons for player', async () => {
    renderPanel(false)
    expect(await screen.findByText('Campaign Guide')).toBeInTheDocument()

    // Should NOT have rename, replace, or delete buttons
    expect(screen.queryByRole('button', { name: /Rename/ })).not.toBeInTheDocument()
    expect(screen.queryByTitle('Replace file')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()
  })

  /* ── Upload error handling ── */

  it('shows error when upload fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({ message: 'Upload failed' }) })

    renderPanel(true)
    expect(await screen.findByText('Campaign Guide')).toBeInTheDocument()

    const nameInput = screen.getByPlaceholderText('Book name...')
    fireEvent.change(nameInput, { target: { value: 'Failing Book' } })

    const fileInput = document.querySelector('input[type="file"]')!
    const file = new File(['bad-content'], 'bad.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument()
    })
  })
})
