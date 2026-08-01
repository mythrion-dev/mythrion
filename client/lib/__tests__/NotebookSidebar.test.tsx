import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { NotebookSidebar } from '@/components/notebook/NotebookSidebar'
import { api } from '@/lib/api'

/* ── Mock api module ── */

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  API_URL: 'http://localhost:3001/api',
  getAccessToken: vi.fn(() => null),
}))

/* ── Mock tree/editor children so tests focus on container logic ── */

// Editor stub fires onChange (simulating typing) via a button so the pending-autosave
// flush path is exercisable before the 800ms debounce elapses.
vi.mock('../../components/notebook/RichTextEditor', () => ({
  RichTextEditor: ({ onChange }: any) => (
    <div data-testid="notebook-editor">
      <button type="button" onClick={() => onChange('<p>typed content</p>')}>
        type
      </button>
    </div>
  ),
}))

// Folder stub renders its page titles only while expanded, so tests can assert on
// whether the parent's expandedFolders state survived a minimize/close cycle.
vi.mock('../../components/notebook/NotebookFolder', () => ({
  NotebookFolder: ({ id, name, pages, isExpanded, onToggle, onPageClick }: any) => (
    <div>
      <button type="button" onClick={() => onToggle(id)}>
        {name}
      </button>
      {isExpanded &&
        pages.map((p: any) => (
          <button key={p.id} type="button" onClick={() => onPageClick(p.id)}>
            {p.title}
          </button>
        ))}
    </div>
  ),
}))

vi.mock('../../components/notebook/NotebookPageItem', () => ({
  NotebookPageItem: ({ id, title, onClick }: any) => (
    <button type="button" onClick={() => onClick(id)}>
      {title}
    </button>
  ),
}))

/* ── Test data ── */

const mockNotebook = {
  id: 'notebook-1',
  adventureId: 'adv-1',
  userId: 'user-1',
  folders: [
    {
      id: 'folder-1',
      name: 'Lore',
      sortOrder: 0,
      pages: [
        {
          id: 'page-1',
          folderId: 'folder-1',
          title: 'Folder Page',
          content: '<p>folder content</p>',
          sortOrder: 0,
          createdAt: '2025-01-15T00:00:00Z',
          updatedAt: '2025-01-15T00:00:00Z',
        },
      ],
    },
  ],
  pages: [
    {
      id: 'page-2',
      folderId: null,
      title: 'Root Page',
      content: '<p>root content</p>',
      sortOrder: 0,
      createdAt: '2025-01-15T00:00:00Z',
      updatedAt: '2025-01-15T00:00:00Z',
    },
  ],
  createdAt: '2025-01-15T00:00:00Z',
  updatedAt: '2025-01-15T00:00:00Z',
}

/* ── Helpers ── */

// The sidebar reads userId from the JWT's `sub` claim, so seed a real-looking token.
function seedToken() {
  const header = btoa(JSON.stringify({ alg: 'HS256' }))
  const payload = btoa(JSON.stringify({ sub: 'user-1' }))
  const signature = btoa('sig')
  window.localStorage.setItem('accessToken', `${header}.${payload}.${signature}`)
}

function renderNotebook(props: Partial<React.ComponentProps<typeof NotebookSidebar>> = {}) {
  return render(
    <NotebookSidebar adventureId="adv-1" isGM={true} onClose={vi.fn()} {...props} />,
  )
}

// Open the sidebar from its closed state and wait for the list to load.
async function openSidebar() {
  fireEvent.click(screen.getByLabelText('Open notebook'))
  await screen.findByText('Root Page')
}

const aside = () => screen.getByRole('complementary')

/* ── Tests ── */

describe('NotebookSidebar minimize/close', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    seedToken()
    ;(api.get as any).mockResolvedValue(mockNotebook)
    ;(api.post as any).mockResolvedValue({})
    ;(api.patch as any).mockResolvedValue({})
    ;(api.delete as any).mockResolvedValue({})
  })

  afterEach(() => {
    cleanup()
  })

  it('minimize from the list preserves expanded folders and does not refetch', async () => {
    const onClose = vi.fn()
    renderNotebook({ onClose })

    await openSidebar()

    // Expand the folder → its page title becomes visible.
    fireEvent.click(screen.getByText('Lore'))
    expect(screen.getByText('Folder Page')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('Minimize notebook'))

    // Panel hidden but still mounted — folder expansion survives.
    expect(aside().className).toContain('translate-x-full')
    expect(screen.getByText('Folder Page')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalledTimes(1)

    // Reopen — notebook is still in memory, so no refetch and folder still expanded.
    fireEvent.click(screen.getByLabelText('Open notebook'))
    await waitFor(() => {
      expect(aside().className).toContain('translate-x-0')
    })
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Folder Page')).toBeInTheDocument()
    expect(screen.getByText('Root Page')).toBeInTheDocument()
  })

  it('minimize from the editor preserves the active page', async () => {
    const onClose = vi.fn()
    renderNotebook({ onClose })

    await openSidebar()
    fireEvent.click(screen.getByText('Lore'))
    fireEvent.click(screen.getByText('Folder Page'))

    // Editor mode active.
    expect(screen.getByTestId('notebook-editor')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Minimize notebook'))
    expect(aside().className).toContain('translate-x-full')
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('Open notebook'))
    await waitFor(() => {
      expect(aside().className).toContain('translate-x-0')
    })

    // Active page survives minimize → still in editor mode.
    expect(screen.getByTestId('notebook-editor')).toBeInTheDocument()
    expect(screen.getByText('Folder Page')).toBeInTheDocument()
  })

  it('close resets to a fresh root view on reopen', async () => {
    const onClose = vi.fn()
    renderNotebook({ onClose })

    await openSidebar()
    fireEvent.click(screen.getByText('Lore'))
    fireEvent.click(screen.getByText('Folder Page'))
    expect(screen.getByTestId('notebook-editor')).toBeInTheDocument()

    // Full close: X in the header (scoped to the aside — the floating toggle
    // shares the "Close notebook" label when open).
    fireEvent.click(within(aside()).getByLabelText('Close notebook'))
    expect(onClose).toHaveBeenCalledTimes(1)

    // Reopen → fresh launch: refetches, root list shown, no folder expanded,
    // no editor active.
    fireEvent.click(screen.getByLabelText('Open notebook'))
    await screen.findByText('Root Page')
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(screen.queryByTestId('notebook-editor')).not.toBeInTheDocument()
    expect(screen.queryByText('Folder Page')).not.toBeInTheDocument()
    expect(screen.getByText('Root Page')).toBeInTheDocument()
  })

  it('close calls onClose', async () => {
    const onClose = vi.fn()
    renderNotebook({ onClose })

    await openSidebar()
    fireEvent.click(within(aside()).getByLabelText('Close notebook'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(aside().className).toContain('translate-x-full')
  })

  it('close flushes pending autosave content before resetting', async () => {
    renderNotebook()

    await openSidebar()
    fireEvent.click(screen.getByText('Lore'))
    fireEvent.click(screen.getByText('Folder Page'))
    expect(screen.getByTestId('notebook-editor')).toBeInTheDocument()

    // Type (sets pendingContentRef + schedules a debounced save), then close
    // immediately — before the 800ms debounce fires.
    fireEvent.click(screen.getByText('type'))
    fireEvent.click(within(aside()).getByLabelText('Close notebook'))

    expect(api.patch).toHaveBeenCalledWith('/adventures/adv-1/notebook/pages/page-1', {
      content: '<p>typed content</p>',
    })
  })
})
