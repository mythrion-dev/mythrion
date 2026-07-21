import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InventoryTab } from '@/components/character-sheet/InventoryTab'

vi.mock('@/components/character-sheet', () => ({
  InlineClickEdit: ({ value, onSave, className, emptyDisplay }: any) => (
    <span
      data-testid="inline-click-edit"
      data-value={value}
      data-empty={emptyDisplay}
      className={className}
      onClick={() => onSave?.('updated')}
      role="button"
    >
      {value?.trim() || emptyDisplay || '—'}
    </span>
  ),
}))

function mockItem(overrides = {}) {
  return {
    id: 'item-1',
    name: 'Long Sword',
    weight: 3,
    cost: '150 gp',
    description: 'A finely crafted steel longsword',
    ...overrides,
  }
}

function defaultProps(overrides = {}) {
  return {
    inventoryItems: [mockItem()],
    isOwner: true,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    totalWeight: 3,
    saveItemField: vi.fn(),
    handleDeleteItem: vi.fn(),
    showNewItem: false,
    setShowNewItem: vi.fn(),
    newItem: { name: '', weight: '', cost: '', description: '' },
    setNewItem: vi.fn(),
    itemSaving: false,
    itemError: null,
    handleCreateItem: vi.fn(),
    resetNewItem: vi.fn(),
    expandedItems: {},
    setExpandedItems: vi.fn(),
    ...overrides,
  }
}

describe('InventoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state when no items and not searching', () => {
    render(<InventoryTab {...defaultProps({ inventoryItems: [] })} />)
    expect(screen.getByText(/inventory is empty/i)).toBeInTheDocument()
  })

  it('shows search empty state when searching but no match', () => {
    render(<InventoryTab {...defaultProps({ inventoryItems: [], searchQuery: 'zzz' })} />)
    expect(screen.getByText(/no items match your search/i)).toBeInTheDocument()
  })

  it('renders items list and shows weight badge', () => {
    render(<InventoryTab {...defaultProps()} />)
    expect(screen.getByText('Long Sword')).toBeInTheDocument()
    expect(screen.getByText(/3 kg/)).toBeInTheDocument()
    expect(screen.getAllByText('150 gp').length).toBeGreaterThan(0)
  })

  it('toggles description expansion on click', () => {
    const setExpandedItems = vi.fn()
    render(<InventoryTab {...defaultProps({ setExpandedItems })} />)
    const descBtn = screen.getByText('Description')
    fireEvent.click(descBtn)
    // setExpandedItems(p => ({ ...p, [item.id]: !p[item.id] }))
    expect(setExpandedItems).toHaveBeenCalled()
  })

  it('shows Add Item button for owner and clicks it', () => {
    const setShowNewItem = vi.fn()
    render(<InventoryTab {...defaultProps({ setShowNewItem })} />)
    const addBtn = screen.getByText('Add Item')
    fireEvent.click(addBtn)
    expect(setShowNewItem).toHaveBeenCalledWith(true)
  })

  it('shows new item form when showNewItem is true', () => {
    const setNewItem = vi.fn()
    const props = defaultProps({
      showNewItem: true,
      newItem: { name: 'Test', weight: '2', cost: '10 gp', description: 'test desc' },
      setNewItem,
    })
    render(<InventoryTab {...props} />)
    expect(screen.getByLabelText('Name')).toHaveValue('Test')

    // Fill weight field (line 238)
    const weightInput = screen.getByLabelText('Weight (kg)')
    fireEvent.change(weightInput, { target: { value: '5' } })
    expect(setNewItem).toHaveBeenCalled()

    // Fill cost field (line 248)
    const costInput = screen.getByLabelText('Cost')
    fireEvent.change(costInput, { target: { value: '200 gp' } })
    expect(setNewItem).toHaveBeenCalledTimes(2)

    // Fill description field (line 260)
    const descInput = screen.getByLabelText('Description')
    fireEvent.change(descInput, { target: { value: 'new desc' } })
    expect(setNewItem).toHaveBeenCalledTimes(3)
  })

  it('calls saveItemField when weight InlineClickEdit is clicked', () => {
    const saveItemField = vi.fn()
    render(<InventoryTab {...defaultProps({ saveItemField })} />)
    // There should be InlineClickEdit elements for each editable field
    const edits = screen.getAllByTestId('inline-click-edit')
    // click the weight one (second one — first is name, second is weight)
    fireEvent.click(edits[1])
    expect(saveItemField).toHaveBeenCalledWith('item-1', 'weight', 'updated')
  })

  it('calls saveItemField when cost InlineClickEdit is clicked', () => {
    const saveItemField = vi.fn()
    render(<InventoryTab {...defaultProps({ saveItemField })} />)
    const edits = screen.getAllByTestId('inline-click-edit')
    // click the cost one (third one — name, weight, cost)
    fireEvent.click(edits[2])
    expect(saveItemField).toHaveBeenCalledWith('item-1', 'cost', 'updated')
  })

  it('shows emptyDisplay for null weight', () => {
    render(<InventoryTab {...defaultProps({
      inventoryItems: [mockItem({ weight: null })],
    })} />)
    // weight edit should have emptyDisplay="—"
    const edits = screen.getAllByTestId('inline-click-edit')
    expect(edits[1]).toHaveAttribute('data-empty', '—')
  })

  it('filters items by search query', () => {
    render(<InventoryTab {...defaultProps({
      inventoryItems: [mockItem(), mockItem({ id: 'item-2', name: 'Steel Shield' })],
      searchQuery: 'shield',
    })} />)
    expect(screen.queryByText('Long Sword')).not.toBeInTheDocument()
    expect(screen.getByText('Steel Shield')).toBeInTheDocument()
  })

  it('handles delete item click for owner', () => {
    const handleDeleteItem = vi.fn()
    render(<InventoryTab {...defaultProps({ handleDeleteItem })} />)
    const deleteBtn = screen.getByTitle('Delete item')
    fireEvent.click(deleteBtn)
    expect(handleDeleteItem).toHaveBeenCalledWith('item-1')
  })

  it('cancels new item form', () => {
    const resetNewItem = vi.fn()
    render(<InventoryTab {...defaultProps({ showNewItem: true, resetNewItem })} />)
    const cancelBtn = screen.getByText('Cancel')
    fireEvent.click(cancelBtn)
    expect(resetNewItem).toHaveBeenCalled()
  })

  it('submits new item form', () => {
    const handleCreateItem = vi.fn()
    render(<InventoryTab {...defaultProps({
      showNewItem: true,
      newItem: { name: 'Test Sword', weight: '5', cost: '200', description: 'A test' },
      handleCreateItem,
    })} />)
    const submitBtn = screen.getByText('Create Item')
    fireEvent.click(submitBtn)
    expect(handleCreateItem).toHaveBeenCalled()
  })

  it('shows saving state on create button', () => {
    render(<InventoryTab {...defaultProps({
      showNewItem: true,
      itemSaving: true,
      newItem: { name: 'Test', weight: '1', cost: '10', description: 'desc' },
    })} />)
    expect(screen.getByText('Creating...')).toBeInTheDocument()
  })

  it('shows error message', () => {
    render(<InventoryTab {...defaultProps({
      showNewItem: true,
      itemError: 'Failed to create item',
      newItem: { name: 'Test', weight: '1', cost: '10', description: 'desc' },
    })} />)
    expect(screen.getByText('Failed to create item')).toBeInTheDocument()
  })

  it('hides owner controls when not owner', () => {
    render(<InventoryTab {...defaultProps({ isOwner: false })} />)
    expect(screen.queryByText('Add Item')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Delete item')).not.toBeInTheDocument()
    expect(screen.queryByTestId('inline-click-edit')).not.toBeInTheDocument()
  })
})
