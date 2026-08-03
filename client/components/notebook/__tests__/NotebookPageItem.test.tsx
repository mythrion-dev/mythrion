import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { NotebookPageItem } from '../NotebookPageItem'

describe('NotebookPageItem', () => {
  const baseProps = {
    id: 'page-1',
    title: 'Session Notes',
    isActive: false,
    onClick: vi.fn(),
    onDelete: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the page title', () => {
    render(<NotebookPageItem {...baseProps} />)
    expect(screen.getByText('Session Notes')).toBeInTheDocument()
  })

  it('renders "Untitled" when title is empty', () => {
    render(<NotebookPageItem {...baseProps} title="" />)
    expect(screen.getByText('Untitled')).toBeInTheDocument()
  })

  it('calls onClick with the page id when clicked', () => {
    render(<NotebookPageItem {...baseProps} />)
    fireEvent.click(screen.getByText('Session Notes'))
    expect(baseProps.onClick).toHaveBeenCalledWith('page-1')
  })

  it('applies active styling when isActive is true', () => {
    const { container } = render(<NotebookPageItem {...baseProps} isActive />)
    expect(container.querySelector('button')).toHaveClass('bg-accent/10')
  })

  it('indents when inside a folder', () => {
    const { container } = render(<NotebookPageItem {...baseProps} indented />)
    expect(container.querySelector('button')).toHaveClass('pl-6')
  })

  it('shows the folder name badge when provided', () => {
    render(<NotebookPageItem {...baseProps} folderName="Lore" />)
    expect(screen.getByText('Lore')).toBeInTheDocument()
  })

  it('deletes the page when confirmed', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<NotebookPageItem {...baseProps} />)
    fireEvent.click(screen.getByLabelText('Delete page'))
    expect(confirmSpy).toHaveBeenCalledWith('Delete this page?')
    expect(baseProps.onDelete).toHaveBeenCalledWith('page-1')
  })

  it('does not delete the page when confirm is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<NotebookPageItem {...baseProps} />)
    fireEvent.click(screen.getByLabelText('Delete page'))
    expect(baseProps.onDelete).not.toHaveBeenCalled()
  })

  it('delete click does not trigger the row onClick', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<NotebookPageItem {...baseProps} />)
    fireEvent.click(screen.getByLabelText('Delete page'))
    expect(baseProps.onClick).not.toHaveBeenCalled()
  })

  it('sets page id in dataTransfer on drag start and notifies the parent', () => {
    const onDragStart = vi.fn()
    render(<NotebookPageItem {...baseProps} onDragStart={onDragStart} />)
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' }
    fireEvent.dragStart(screen.getByText('Session Notes'), { dataTransfer })
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'page-1')
    expect(dataTransfer.effectAllowed).toBe('move')
    expect(onDragStart).toHaveBeenCalledWith('page-1', expect.anything())
  })

  it('opens the context menu on right-click', () => {
    const onContextMenu = vi.fn()
    render(<NotebookPageItem {...baseProps} onContextMenu={onContextMenu} />)
    fireEvent.contextMenu(screen.getByText('Session Notes'))
    expect(onContextMenu).toHaveBeenCalledWith('page-1', expect.anything())
  })
})
