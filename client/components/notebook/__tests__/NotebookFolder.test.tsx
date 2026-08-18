import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { NotebookFolder } from '../NotebookFolder'

describe('NotebookFolder', () => {
  const baseProps = {
    id: 'folder-1',
    name: 'Lore',
    pages: [
      { id: 'page-1', title: 'Session Notes' },
      { id: 'page-2', title: 'NPCs' },
    ],
    activePageId: null,
    isExpanded: false,
    onToggle: vi.fn(),
    onPageClick: vi.fn(),
    onDeletePage: vi.fn(),
    onRename: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the folder name and page count', () => {
    render(<NotebookFolder {...baseProps} />)
    expect(screen.getByText('Lore')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('toggles when the header is clicked', () => {
    render(<NotebookFolder {...baseProps} />)
    fireEvent.click(screen.getByText('Lore'))
    expect(baseProps.onToggle).toHaveBeenCalledTimes(1)
  })

  it('toggles via the chevron without triggering a second toggle', () => {
    render(<NotebookFolder {...baseProps} isExpanded />)
    fireEvent.click(screen.getByLabelText('Collapse folder'))
    expect(baseProps.onToggle).toHaveBeenCalledTimes(1)
  })

  it('hides pages when collapsed and shows them when expanded', () => {
    const { rerender } = render(<NotebookFolder {...baseProps} isExpanded={false} />)
    expect(screen.queryByText('Session Notes')).not.toBeInTheDocument()

    rerender(<NotebookFolder {...baseProps} isExpanded />)
    expect(screen.getByText('Session Notes')).toBeInTheDocument()
    expect(screen.getByText('NPCs')).toBeInTheDocument()
  })

  it('calls onPageClick when a page is clicked', () => {
    render(<NotebookFolder {...baseProps} isExpanded />)
    fireEvent.click(screen.getByText('Session Notes'))
    expect(baseProps.onPageClick).toHaveBeenCalledWith('page-1')
  })

  it('shows an empty-state create button that calls onCreatePage', () => {
    const onCreatePage = vi.fn()
    render(<NotebookFolder {...baseProps} pages={[]} isExpanded onCreatePage={onCreatePage} />)
    expect(screen.getByText('No pages yet.')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Create Page'))
    expect(onCreatePage).toHaveBeenCalledWith('folder-1')
  })

  it('creates a new page from the folder action menu', () => {
    const onCreatePage = vi.fn()
    render(<NotebookFolder {...baseProps} onCreatePage={onCreatePage} />)
    fireEvent.click(screen.getByLabelText('Folder actions'))
    fireEvent.click(screen.getByText('New Page'))
    expect(onCreatePage).toHaveBeenCalledWith('folder-1')
  })

  it('renames the folder from the action menu', () => {
    render(<NotebookFolder {...baseProps} />)
    fireEvent.click(screen.getByLabelText('Folder actions'))
    fireEvent.click(screen.getByText('Rename Folder'))

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Worldbuilding' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(baseProps.onRename).toHaveBeenCalledWith('folder-1', 'Worldbuilding')
  })

  it('does not rename when the value is unchanged', () => {
    render(<NotebookFolder {...baseProps} />)
    fireEvent.click(screen.getByLabelText('Folder actions'))
    fireEvent.click(screen.getByText('Rename Folder'))

    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(baseProps.onRename).not.toHaveBeenCalled()
  })

  it('cancels renaming with Escape', () => {
    render(<NotebookFolder {...baseProps} />)
    fireEvent.click(screen.getByLabelText('Folder actions'))
    fireEvent.click(screen.getByText('Rename Folder'))

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Worldbuilding' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(baseProps.onRename).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('requests folder deletion from the action menu', () => {
    const onDeleteFolderRequest = vi.fn()
    render(<NotebookFolder {...baseProps} onDeleteFolderRequest={onDeleteFolderRequest} />)
    fireEvent.click(screen.getByLabelText('Folder actions'))
    fireEvent.click(screen.getByText('Delete Folder'))
    expect(onDeleteFolderRequest).toHaveBeenCalledWith('folder-1')
  })

  it('closes the menu when clicking outside', () => {
    render(<NotebookFolder {...baseProps} />)
    fireEvent.click(screen.getByLabelText('Folder actions'))
    expect(screen.getByText('New Page')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('New Page')).not.toBeInTheDocument()
  })

  it('deletes a page inside the folder directly when no confirmation flow is provided', () => {
    render(<NotebookFolder {...baseProps} isExpanded />)
    fireEvent.click(screen.getAllByLabelText('Delete page')[0])
    expect(baseProps.onDeletePage).toHaveBeenCalledWith('page-1')
  })

  it('requests confirmation before deleting a page when onRequestDeletePage is provided', () => {
    const onRequestDeletePage = vi.fn()
    render(<NotebookFolder {...baseProps} isExpanded onRequestDeletePage={onRequestDeletePage} />)
    fireEvent.click(screen.getAllByLabelText('Delete page')[0])
    expect(onRequestDeletePage).toHaveBeenCalledWith('page-1')
    expect(baseProps.onDeletePage).not.toHaveBeenCalled()
  })

  it('notifies onDragOverFolder and onDropOnFolder for drag and drop', () => {
    const onDragOverFolder = vi.fn()
    const onDropOnFolder = vi.fn()
    const { container } = render(
      <NotebookFolder
        {...baseProps}
        onDragOverFolder={onDragOverFolder}
        onDropOnFolder={onDropOnFolder}
      />,
    )

    const dropZone = container.firstChild as HTMLElement

    fireEvent.dragOver(dropZone, { dataTransfer: { dropEffect: 'none' } })
    expect(onDragOverFolder).toHaveBeenCalledWith('folder-1')

    // Firing dragOver again should not re-notify while already dragging over.
    fireEvent.dragOver(dropZone, { dataTransfer: { dropEffect: 'none' } })
    expect(onDragOverFolder).toHaveBeenCalledTimes(1)

    fireEvent.drop(dropZone, { dataTransfer: { getData: () => 'page-9' } })
    expect(onDropOnFolder).toHaveBeenCalledWith('folder-1', 'page-9')
    expect(onDragOverFolder).toHaveBeenCalledWith(null)
  })

  it('clears drag state when leaving the container', () => {
    const onDragOverFolder = vi.fn()
    const { container } = render(<NotebookFolder {...baseProps} onDragOverFolder={onDragOverFolder} />)
    fireEvent.dragLeave(container.firstChild as HTMLElement, { relatedTarget: null })
    expect(onDragOverFolder).toHaveBeenCalledWith(null)
  })
})
