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
  NotebookFolder: ({
    id,
    name,
    pages,
    isExpanded,
    onToggle,
    onPageClick,
    onCreatePage,
    onRename,
    onDeleteFolderRequest,
    onDragOverFolder,
    onDropOnFolder,
    onPageContextMenu,
  }: any) => (
    <div
      onDragOver={() => onDragOverFolder?.(id)}
      onDrop={(e: any) => onDropOnFolder?.(id, e.dataTransfer.getData('text/plain'))}
    >
      <button type="button" onClick={() => onToggle(id)}>
        {name}
      </button>
      <button type="button" aria-label={`New page in ${name}`} onClick={() => onCreatePage?.(id)}>
        new page
      </button>
      <button type="button" aria-label={`Rename folder ${name}`} onClick={() => onRename?.(id, 'Renamed Folder')}>
        rename
      </button>
      <button type="button" aria-label={`Delete folder ${name}`} onClick={() => onDeleteFolderRequest?.(id)}>
        delete folder
      </button>
      {isExpanded &&
        pages.map((p: any) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPageClick(p.id)}
            onContextMenu={(e: any) => {
              e.preventDefault()
              onPageContextMenu?.(p.id, e)
            }}
          >
            {p.title}
          </button>
        ))}
    </div>
  ),
}))

vi.mock('../../components/notebook/NotebookPageItem', () => ({
  NotebookPageItem: ({ id, title, onClick, onDelete, onContextMenu, onDragStart }: any) => (
    <div
      draggable
      onDragStart={(e: any) => onDragStart?.(id, e)}
      onContextMenu={(e: any) => {
        e.preventDefault()
        onContextMenu?.(id, e)
      }}
    >
      <button type="button" onClick={() => onClick(id)}>
        {title}
      </button>
      <button type="button" aria-label={`Delete ${id}`} onClick={() => onDelete?.(id)}>
        delete
      </button>
    </div>
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

describe('NotebookSidebar extended actions', () => {
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
    vi.restoreAllMocks()
  })

  it('forceOpen renders the sidebar open and loads without the toggle', async () => {
    renderNotebook({ forceOpen: true })
    await screen.findByText('Root Page')
    expect(aside().className).toContain('translate-x-0')
  })

  it('creates the first page from the empty state', async () => {
    ;(api.get as any).mockResolvedValue({ ...mockNotebook, pages: [], folders: [] })
    ;(api.post as any).mockResolvedValue({
      id: 'page-3',
      title: 'Untitled page',
      folderId: null,
      content: '',
      sortOrder: 0,
      createdAt: '2025-01-15T00:00:00Z',
      updatedAt: '2025-01-15T00:00:00Z',
    })
    renderNotebook()

    fireEvent.click(screen.getByLabelText('Open notebook'))
    await screen.findByText(/Your notebook is empty/)
    fireEvent.click(screen.getByText('+ New Page'))

    expect(api.post).toHaveBeenCalledWith('/adventures/adv-1/notebook/pages', {
      title: 'Untitled page',
      folderId: null,
    })
    expect(await screen.findByTestId('notebook-editor')).toBeInTheDocument()
    expect(screen.getByText('Untitled page')).toBeInTheDocument()
  })

  it('creates a root page from the toolbar', async () => {
    ;(api.post as any).mockResolvedValue({
      id: 'page-3',
      title: 'Untitled page',
      folderId: null,
      content: '',
      sortOrder: 1,
      createdAt: '2025-01-15T00:00:00Z',
      updatedAt: '2025-01-15T00:00:00Z',
    })
    renderNotebook()
    await openSidebar()

    fireEvent.click(screen.getByText('New page'))
    expect(api.post).toHaveBeenCalledWith('/adventures/adv-1/notebook/pages', {
      title: 'Untitled page',
      folderId: null,
    })
    expect(await screen.findByTestId('notebook-editor')).toBeInTheDocument()
  })

  it('creates a page inside a folder', async () => {
    ;(api.post as any).mockResolvedValue({
      id: 'page-3',
      title: 'Untitled page',
      folderId: 'folder-1',
      content: '',
      sortOrder: 1,
      createdAt: '2025-01-15T00:00:00Z',
      updatedAt: '2025-01-15T00:00:00Z',
    })
    renderNotebook()
    await openSidebar()

    fireEvent.click(screen.getByLabelText('New page in Lore'))
    expect(api.post).toHaveBeenCalledWith('/adventures/adv-1/notebook/pages', {
      title: 'Untitled page',
      folderId: 'folder-1',
    })
    expect(await screen.findByTestId('notebook-editor')).toBeInTheDocument()
  })

  it('creates a folder and expands it', async () => {
    ;(api.post as any).mockResolvedValue({ id: 'folder-2', name: 'New folder', sortOrder: 1 })
    renderNotebook()
    await openSidebar()

    fireEvent.click(screen.getByText('New folder'))
    expect(api.post).toHaveBeenCalledWith('/adventures/adv-1/notebook/folders', {
      name: 'New folder',
    })
    // Toolbar button + the new folder's name button.
    await waitFor(() => expect(screen.getAllByText('New folder')).toHaveLength(2))
  })

  it('renames a folder', async () => {
    renderNotebook()
    await openSidebar()

    fireEvent.click(screen.getByLabelText('Rename folder Lore'))
    expect(api.patch).toHaveBeenCalledWith('/adventures/adv-1/notebook/folders/folder-1', {
      name: 'Renamed Folder',
    })
    await waitFor(() => expect(screen.getByText('Renamed Folder')).toBeInTheDocument())
    expect(screen.queryByText('Lore')).not.toBeInTheDocument()
  })

  it('deletes a page from the list', async () => {
    renderNotebook()
    await openSidebar()

    fireEvent.click(screen.getByLabelText('Delete page-2'))
    expect(api.delete).toHaveBeenCalledWith('/adventures/adv-1/notebook/pages/page-2')
    await waitFor(() => expect(screen.queryByText('Root Page')).not.toBeInTheDocument())
  })

  it('opens the custom delete confirmation and deletes the active page after confirmation', async () => {
    renderNotebook()
    await openSidebar()
    fireEvent.click(screen.getByText('Lore'))
    fireEvent.click(screen.getByText('Folder Page'))
    expect(screen.getByTestId('notebook-editor')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Delete page'))
    expect(screen.getByText('Delete this page?')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete page' }).at(-1)!)

    expect(api.delete).toHaveBeenCalledWith('/adventures/adv-1/notebook/pages/page-1')
    await waitFor(() => expect(screen.queryByTestId('notebook-editor')).not.toBeInTheDocument())
    expect(screen.queryByText('Folder Page')).not.toBeInTheDocument()
  })

  it('keeps the page when the custom delete confirmation is cancelled', async () => {
    renderNotebook()
    await openSidebar()
    fireEvent.click(screen.getByText('Lore'))
    fireEvent.click(screen.getByText('Folder Page'))

    fireEvent.click(screen.getByLabelText('Delete page'))
    expect(screen.getByText('Delete this page?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(api.delete).not.toHaveBeenCalled()
    expect(screen.getByTestId('notebook-editor')).toBeInTheDocument()
  })

  it('renames the active page title with Enter', async () => {
    renderNotebook()
    await openSidebar()
    fireEvent.click(screen.getByText('Lore'))
    fireEvent.click(screen.getByText('Folder Page'))

    fireEvent.click(screen.getByTitle('Click to rename'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'New Title' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(api.patch).toHaveBeenCalledWith('/adventures/adv-1/notebook/pages/page-1', {
      title: 'New Title',
    })
    expect(screen.getByText('New Title')).toBeInTheDocument()
  })

  it('renames the active page title on blur', async () => {
    renderNotebook()
    await openSidebar()
    fireEvent.click(screen.getByText('Lore'))
    fireEvent.click(screen.getByText('Folder Page'))

    fireEvent.click(screen.getByTitle('Click to rename'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Blur Title' } })
    fireEvent.blur(input)

    expect(api.patch).toHaveBeenCalledWith('/adventures/adv-1/notebook/pages/page-1', {
      title: 'Blur Title',
    })
  })

  it('discards a title edit with Escape', async () => {
    renderNotebook()
    await openSidebar()
    fireEvent.click(screen.getByText('Lore'))
    fireEvent.click(screen.getByText('Folder Page'))

    fireEvent.click(screen.getByTitle('Click to rename'))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Discard Me' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(api.patch).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('Folder Page')).toBeInTheDocument()
  })

  it('does not patch when the title is unchanged', async () => {
    renderNotebook()
    await openSidebar()
    fireEvent.click(screen.getByText('Lore'))
    fireEvent.click(screen.getByText('Folder Page'))

    fireEvent.click(screen.getByTitle('Click to rename'))
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(api.patch).not.toHaveBeenCalled()
  })

  it('filters pages by title in search', async () => {
    renderNotebook()
    await openSidebar()

    fireEvent.change(screen.getByPlaceholderText('Search pages...'), {
      target: { value: 'Root' },
    })
    expect(screen.getByText(/1 result for "Root"/)).toBeInTheDocument()
    expect(screen.getByText('Root Page')).toBeInTheDocument()
    expect(screen.queryByText('Lore')).not.toBeInTheDocument()
    expect(screen.queryByText('Folder Page')).not.toBeInTheDocument()
  })

  it('filters pages by folder name in search', async () => {
    renderNotebook()
    await openSidebar()

    fireEvent.change(screen.getByPlaceholderText('Search pages...'), {
      target: { value: 'Lore' },
    })
    expect(screen.getByText(/1 result for "Lore"/)).toBeInTheDocument()
    expect(screen.getByText('Folder Page')).toBeInTheDocument()
  })

  it('filters pages by stripped content in search', async () => {
    renderNotebook()
    await openSidebar()

    fireEvent.change(screen.getByPlaceholderText('Search pages...'), {
      target: { value: 'folder content' },
    })
    expect(screen.getByText(/1 result for "folder content"/)).toBeInTheDocument()
    expect(screen.getByText('Folder Page')).toBeInTheDocument()
  })

  it('shows a no-results state', async () => {
    renderNotebook()
    await openSidebar()

    fireEvent.change(screen.getByPlaceholderText('Search pages...'), {
      target: { value: 'zzz' },
    })
    expect(screen.getByText(/0 results for "zzz"/)).toBeInTheDocument()
    expect(screen.getByText('No pages found')).toBeInTheDocument()
  })

  it('clears search and restores the list', async () => {
    renderNotebook()
    await openSidebar()

    const search = screen.getByPlaceholderText('Search pages...')
    fireEvent.change(search, { target: { value: 'Root' } })
    fireEvent.click(screen.getByLabelText('Clear search'))

    expect((search as HTMLInputElement).value).toBe('')
    expect(screen.getByText('Lore')).toBeInTheDocument()
    expect(screen.getByText('Uncategorized')).toBeInTheDocument()
  })

  it('opens a search result and clears the query', async () => {
    renderNotebook()
    await openSidebar()

    const search = screen.getByPlaceholderText('Search pages...')
    fireEvent.change(search, { target: { value: 'Root' } })
    fireEvent.click(screen.getByText('Root Page'))

    // Opening a result enters the editor, which unmounts the search input, so
    // verify the query cleared by going back to the list.
    expect(screen.getByTestId('notebook-editor')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Back to page list'))
    const restored = screen.getByPlaceholderText('Search pages...')
    expect((restored as HTMLInputElement).value).toBe('')
    expect(screen.getByText('Lore')).toBeInTheDocument()
    expect(screen.getByText('Root Page')).toBeInTheDocument()
  })

  it('moves a folder page to root via the context menu', async () => {
    renderNotebook()
    await openSidebar()
    fireEvent.click(screen.getByText('Lore'))

    fireEvent.contextMenu(screen.getByText('Folder Page'))
    expect(screen.getByText('Move to...')).toBeInTheDocument()
    expect(screen.getByText('No other folders')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Root (uncategorized)'))
    expect(api.patch).toHaveBeenCalledWith('/adventures/adv-1/notebook/pages/page-1', {
      folderId: null,
    })
    expect(screen.queryByText('Move to...')).not.toBeInTheDocument()
  })

  it('moves a root page into a folder via the context menu', async () => {
    renderNotebook()
    await openSidebar()

    fireEvent.contextMenu(screen.getByText('Root Page'))
    const menu = document.querySelector('[class*="min-w-[180px]"]') as HTMLElement
    fireEvent.click(within(menu).getByText('Lore'))

    expect(api.patch).toHaveBeenCalledWith('/adventures/adv-1/notebook/pages/page-2', {
      folderId: 'folder-1',
    })
    expect(screen.queryByText('Move to...')).not.toBeInTheDocument()
  })

  it('closes the context menu on outside click', async () => {
    renderNotebook()
    await openSidebar()

    fireEvent.contextMenu(screen.getByText('Root Page'))
    expect(screen.getByText('Move to...')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Move to...')).not.toBeInTheDocument()
  })

  it('deletes a folder and moves its pages to root', async () => {
    renderNotebook()
    await openSidebar()

    fireEvent.click(screen.getByLabelText('Delete folder Lore'))
    expect(screen.getByRole('heading', { name: 'Delete Folder' })).toBeInTheDocument()
    expect(screen.getByText('Move pages to Root')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Folder' }))
    expect(api.delete).toHaveBeenCalledWith('/adventures/adv-1/notebook/folders/folder-1')
    expect(api.patch).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText('Lore')).not.toBeInTheDocument())
    expect(screen.getByText('Folder Page')).toBeInTheDocument()
  })

  it('deletes a folder and moves its pages to another folder', async () => {
    ;(api.get as any).mockResolvedValue({
      ...mockNotebook,
      folders: [
        mockNotebook.folders[0],
        { id: 'folder-2', name: 'Maps', sortOrder: 1, pages: [] },
      ],
    })
    renderNotebook()
    await openSidebar()

    fireEvent.click(screen.getByLabelText('Delete folder Lore'))
    fireEvent.click(screen.getByLabelText(/Move to another folder/))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Folder' }))

    expect(api.patch).toHaveBeenCalledWith('/adventures/adv-1/notebook/pages/page-1', {
      folderId: 'folder-2',
    })
    // api.delete only runs after the per-page patch awaits resolve, so wait for it.
    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith('/adventures/adv-1/notebook/folders/folder-1'),
    )
  })

  it('cancels folder deletion', async () => {
    renderNotebook()
    await openSidebar()

    fireEvent.click(screen.getByLabelText('Delete folder Lore'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByText('Delete Folder')).not.toBeInTheDocument()
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('drops a page onto a folder', async () => {
    renderNotebook()
    await openSidebar()
    fireEvent.click(screen.getByText('Lore'))

    fireEvent.dragStart(screen.getByText('Root Page'), {
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    })
    const folderZone = screen.getByText('Lore').parentElement as HTMLElement
    fireEvent.dragOver(folderZone, { dataTransfer: { dropEffect: 'none' } })
    fireEvent.drop(folderZone, { dataTransfer: { getData: () => 'page-2' } })

    expect(api.patch).toHaveBeenCalledWith('/adventures/adv-1/notebook/pages/page-2', {
      folderId: 'folder-1',
    })
  })

  it('drops a page onto the root zone', async () => {
    renderNotebook()
    await openSidebar()
    fireEvent.click(screen.getByText('Lore'))

    const rootZone = screen.getByText('Uncategorized').parentElement as HTMLElement
    fireEvent.dragOver(rootZone, { dataTransfer: { dropEffect: 'move' } })
    fireEvent.drop(rootZone, { dataTransfer: { getData: () => 'page-1' } })

    expect(api.patch).toHaveBeenCalledWith('/adventures/adv-1/notebook/pages/page-1', {
      folderId: null,
    })
  })

  it('closes the sidebar from the mobile overlay', async () => {
    const onClose = vi.fn()
    const { container } = renderNotebook({ onClose })
    await openSidebar()

    const overlay = container.querySelector('[class*="bg-black/40"]') as HTMLElement
    fireEvent.click(overlay)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(aside().className).toContain('translate-x-full')
  })

  it('shows an error state and retries', async () => {
    ;(api.get as any).mockRejectedValueOnce(new Error('boom'))
    renderNotebook()

    fireEvent.click(screen.getByLabelText('Open notebook'))
    await screen.findByText('boom')
    expect(screen.getByText('Retry')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Retry'))
    await screen.findByText('Root Page')
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('autosaves editor content after the debounce', async () => {
    renderNotebook()
    await openSidebar()
    fireEvent.click(screen.getByText('Lore'))
    fireEvent.click(screen.getByText('Folder Page'))

    fireEvent.click(screen.getByText('type'))
    await waitFor(
      () => {
        expect(api.patch).toHaveBeenCalledWith('/adventures/adv-1/notebook/pages/page-1', {
          content: '<p>typed content</p>',
        })
      },
      { timeout: 2500 },
    )
  })
})
