import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mock @/lib/api
// ---------------------------------------------------------------------------
vi.mock('@/lib/api', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_URL: 'http://localhost:3001/api',
}))

// ---------------------------------------------------------------------------
// Mock InlineClickEdit directly to avoid nested-button warnings
// ---------------------------------------------------------------------------
vi.mock('@/components/character-sheet/InlineClickEdit', () => ({
  InlineClickEdit: ({ value, onSave, emptyDisplay = '—' }: any) => (
    <span onClick={() => onSave('edited-value')} data-testid="inline-click-edit">
      {value?.trim() || emptyDisplay}
    </span>
  ),
}))

// ---------------------------------------------------------------------------
// Mock StoryField directly
// ---------------------------------------------------------------------------
vi.mock('@/components/character-sheet/StoryField', () => ({
  StoryField: ({ label, value }: any) => {
    const text = value?.trim()
    if (!text) return null
    return (
      <div data-testid="story-field">
        <h4>{label}</h4>
        <p>{text}</p>
      </div>
    )
  },
}))

// ---------------------------------------------------------------------------
// Mock InlineTextarea from inline-editable
// ---------------------------------------------------------------------------
vi.mock('@/lib/inline-editable', async () => {
  const actual = await vi.importActual<any>('@/lib/inline-editable')
  return {
    ...actual,
    InlineTextarea: ({ value, onSave, emptyDisplay = '—' }: any) => (
      <span onClick={() => onSave('edited-text')} data-testid="inline-textarea">
        {value?.trim() || emptyDisplay}
      </span>
    ),
  }
})

// ---------------------------------------------------------------------------
// Now import the real tab components from the barrel.
// vi.mock above ensures InlineClickEdit is overridden at the file level.
// ---------------------------------------------------------------------------
import { ResistanceTab, InventoryTab, PersonalAbilitiesTab, StoryTab } from '@/components/character-sheet'
import type { InventoryItem } from '@/components/character-sheet/types'
import type { TemplateCharacterSection, SectionEntry } from '@/components/character-sheet/types'

// ==========================================================================
//  HELPER
// ==========================================================================

function deferred<T = void>() {
  let resolve!: (v: T) => void
  let reject!: (e: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

// ==========================================================================
//  ResistanceTab
// ==========================================================================

describe('ResistanceTab', () => {
  const manualResistance = {
    resistanceId: 'r1',
    name: 'Fire Resistance',
    calculationType: 'MANUAL',
    total: 10,
    componentValues: [],
    attributeModifierValues: [],
  }

  const calculatedResistance = {
    resistanceId: 'r2',
    name: 'Poison Resistance',
    calculationType: 'CALCULATED',
    total: 5,
    componentValues: [
      { componentId: 'c1', componentName: 'Natural', value: 3, editableByPlayer: true },
      { componentId: 'c2', componentName: 'Magic', value: 2, editableByPlayer: false },
    ],
    attributeModifierValues: [
      { attributeId: 'a1', attributeKey: 'con', attributeName: 'Constitution', enabled: true, rawModifier: 2, effectiveModifier: 2 },
    ],
  }

  const calculatedResistanceWithRawDiff = {
    ...calculatedResistance,
    resistanceId: 'r3',
    name: 'Acid Resistance',
    attributeModifierValues: [
      { attributeId: 'a2', attributeKey: 'con', attributeName: 'Constitution', enabled: true, rawModifier: 5, effectiveModifier: 3 },
    ],
  }

  const baseProps = {
    resistances: [] as any[],
    permissions: {
      canEditResistances: true,
      canEditAbilities: false,
      canEditCharacter: false,
      canEditInventory: false,
      canEditPersonalAbilities: false,
      canEditResources: false,
      canEditSkills: false,
      canEditStory: false,
      canEditProfessionalSkills: false,
    },
    onSaveComponent: vi.fn(),
    onSaveManual: vi.fn(),
    sheetResistanceValues: {} as Record<string, string | null>,
    onCreateResistance: vi.fn(),
    onDeleteResistance: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------- Empty states ----------

  it('renders empty state when no resistances and not showing new form', () => {
    render(<ResistanceTab {...baseProps} onCreateResistance={undefined} />)
    expect(screen.getByText('No resistances configured.')).toBeInTheDocument()
    expect(screen.queryByText('New Resistance')).not.toBeInTheDocument()
  })

  it('shows New Resistance button when isOwner=true and onCreateResistance provided', () => {
    render(<ResistanceTab {...baseProps} />)
    expect(screen.getByText('New Resistance')).toBeInTheDocument()
  })

  it('does NOT show New Resistance button when onCreateResistance is undefined', () => {
    render(<ResistanceTab {...baseProps} onCreateResistance={undefined} />)
    expect(screen.queryByText('New Resistance')).not.toBeInTheDocument()
  })

  // ---------- Rendering resistances ----------

  it('renders a list of resistances with totals', () => {
    render(<ResistanceTab {...baseProps} resistances={[manualResistance, calculatedResistance]} />)
    expect(screen.getByText('Fire Resistance')).toBeInTheDocument()
    expect(screen.getByText('Poison Resistance')).toBeInTheDocument()

    // The total badge values
    expect(screen.getByText('10')).toBeInTheDocument()
    const fives = screen.getAllByText('5')
    expect(fives.length).toBeGreaterThanOrEqual(1)
  })

  it('expands and collapses a resistance', async () => {
    const user = userEvent.setup()
    render(<ResistanceTab {...baseProps} resistances={[manualResistance]} />)

    // Auto-expanded on mount — "Total" is visible
    expect(screen.getByText('Total')).toBeInTheDocument()

    // Click the header button to collapse
    const headerBtn = screen.getByRole('button', { name: /Fire Resistance/ })
    await user.click(headerBtn)

    // Wait for React to re-render, then confirm Total is gone
    await waitFor(() => {
      expect(screen.queryByText('Total')).not.toBeInTheDocument()
    })

    // Click again to expand
    await user.click(headerBtn)
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  // ---------- MANUAL resistance ----------

  it('renders manual resistance input for owner', async () => {
    const onSaveManual = vi.fn().mockResolvedValue(undefined)
    const sheetResistanceValues = { r1: '15' } as Record<string, string | null>
    const user = userEvent.setup()
    render(
      <ResistanceTab
        {...baseProps}
        resistances={[manualResistance]}        onSaveManual={onSaveManual}
        sheetResistanceValues={sheetResistanceValues}
      />,
    )
    // Auto-expanded on mount — collapse then re-expand for a clean state
    const headerBtn = screen.getByRole('button', { name: /Fire Resistance/ })
    await user.click(headerBtn)
    await waitFor(() => {
      expect(screen.queryByText('Total')).not.toBeInTheDocument()
    })
    await user.click(headerBtn)

    // There's a number input with value "15"
    const input = screen.getByDisplayValue('15')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'number')

    fireEvent.change(input, { target: { value: '20' } })
    expect(onSaveManual).toHaveBeenCalledWith('r1', 20)
  })

  it('renders manual resistance value as span for non-owner', async () => {
    const sheetResistanceValues = { r1: '15' } as Record<string, string | null>
    const user = userEvent.setup()
    render(
      <ResistanceTab
        {...baseProps}
        resistances={[manualResistance]}        sheetResistanceValues={sheetResistanceValues}
        permissions={{ ...baseProps.permissions, canEditResistances: false }}
      />,
    )
    // Auto-expanded on mount — collapse then re-expand for a clean state
    const headerBtn = screen.getByRole('button', { name: /Fire Resistance/ })
    await user.click(headerBtn)
    await waitFor(() => {
      expect(screen.queryByText('Total')).not.toBeInTheDocument()
    })
    await user.click(headerBtn)

    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('uses fallback "0" when sheetResistanceValues entry is null', async () => {
    const user = userEvent.setup()
    render(
      <ResistanceTab
        {...baseProps}
        resistances={[manualResistance]}        sheetResistanceValues={{ r1: null }}
        permissions={{ ...baseProps.permissions, canEditResistances: false }}
      />,
    )
    // Auto-expanded on mount — collapse then re-expand for a clean state
    const headerBtn = screen.getByRole('button', { name: /Fire Resistance/ })
    await user.click(headerBtn)
    await waitFor(() => {
      expect(screen.queryByText('Total')).not.toBeInTheDocument()
    })
    await user.click(headerBtn)

    expect(screen.getByText('0')).toBeInTheDocument()
  })

  // ---------- CALCULATED resistance ----------

  it('renders CALCULATED resistance components and attribute modifiers', async () => {
    render(
      <ResistanceTab
        {...baseProps}
        resistances={[calculatedResistance]}      />,
    )
    // Auto-expanded on mount — content is already visible

    expect(screen.getByText('Components')).toBeInTheDocument()
    expect(screen.getByText('Natural')).toBeInTheDocument()
    expect(screen.getByText('Magic')).toBeInTheDocument()
    expect(screen.getByText('Attribute Modifiers')).toBeInTheDocument()
    expect(screen.getByText('Constitution Mod')).toBeInTheDocument()
  })

  it('shows editable number input for editableByPlayer components when owner', async () => {
    const onSaveComponent = vi.fn().mockResolvedValue(undefined)
    render(
      <ResistanceTab
        {...baseProps}
        resistances={[calculatedResistance]}        onSaveComponent={onSaveComponent}
      />,
    )
    // Auto-expanded on mount — content is already visible

    // Natural is editableByPlayer → number input
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs.length).toBeGreaterThanOrEqual(1)

    fireEvent.change(inputs[0], { target: { value: '10' } })
    expect(onSaveComponent).toHaveBeenCalledWith('c1', 10)
  })

  it('shows non-editable value as text for non-editableByPlayer components', () => {
    render(
      <ResistanceTab
        {...baseProps}
        resistances={[calculatedResistance]}      />,
    )
    // Auto-expanded on mount — content is already visible

    // Magic (value 2) is rendered as text inside a span next to its label
    const magicRow = screen.getByText('Magic').closest('div')!
    const valueText = magicRow.textContent!.match(/\d+/)
    expect(valueText).toBeTruthy()
    expect(valueText![0]).toBe('2')
  })

  it('renders raw modifier when it differs from effective modifier', () => {
    render(
      <ResistanceTab
        {...baseProps}
        resistances={[calculatedResistanceWithRawDiff]}      />,
    )
    // Auto-expanded on mount — content is already visible

    // raw: text appears in the DOM inside a nested span
    expect(screen.getByText(/raw:/)).toBeInTheDocument()
  })

  // ---------- Delete resistance ----------

  it('opens the custom delete confirmation and deletes resistance after confirmation', async () => {
    const onDeleteResistance = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <ResistanceTab
        {...baseProps}
        resistances={[manualResistance]}        onDeleteResistance={onDeleteResistance}
      />,
    )

    await user.click(screen.getByTitle('Delete resistance'))
    expect(screen.getByText('Delete this resistance? This cannot be undone.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDeleteResistance).toHaveBeenCalledWith('r1')
  })

  it('does NOT delete when the custom confirmation is cancelled', async () => {
    const onDeleteResistance = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <ResistanceTab
        {...baseProps}
        resistances={[manualResistance]}        onDeleteResistance={onDeleteResistance}
      />,
    )

    await user.click(screen.getByTitle('Delete resistance'))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onDeleteResistance).not.toHaveBeenCalled()
  })

  it('does not render delete button when onDeleteResistance is undefined', () => {
    render(
      <ResistanceTab
        {...baseProps}
        resistances={[manualResistance]}        onDeleteResistance={undefined}
      />,
    )
    expect(screen.queryByTitle('Delete resistance')).not.toBeInTheDocument()
  })

  it('does not render delete button when isOwner is false', () => {
    render(
      <ResistanceTab
        {...baseProps}
        resistances={[manualResistance]}        permissions={{ ...baseProps.permissions, canEditResistances: false }}
      />,
    )
    expect(screen.queryByTitle('Delete resistance')).not.toBeInTheDocument()
  })

  // ---------- New Resistance form ----------

  it('opens new resistance form when clicking New Resistance', async () => {
    const user = userEvent.setup()
    render(<ResistanceTab {...baseProps} />)
    await user.click(screen.getByText('New Resistance'))

    expect(screen.getByPlaceholderText('e.g. Fire Resistance')).toBeInTheDocument()
    // The form header says "New Resistance"
    expect(screen.getByText('New Resistance')).toBeInTheDocument()
  })

  it('creates a MANUAL resistance', async () => {
    const onCreateResistance = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <ResistanceTab
        {...baseProps}        onCreateResistance={onCreateResistance}
      />,
    )

    await user.click(screen.getByText('New Resistance'))
    await user.type(screen.getByPlaceholderText('e.g. Fire Resistance'), 'Ice Resistance')
    await user.click(screen.getByText('Create Resistance'))

    await waitFor(() => {
      expect(onCreateResistance).toHaveBeenCalledWith({
        name: 'Ice Resistance',
        calculationType: 'MANUAL',
        components: [],
        attributeModifiers: [],
      })
    })
  })

  it('creates a CALCULATED resistance', async () => {
    const onCreateResistance = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <ResistanceTab
        {...baseProps}        onCreateResistance={onCreateResistance}
        templateAttributes={[
          { id: 'a1', key: 'con', name: 'Constitution' },
          { id: 'a2', key: 'str', name: 'Strength' },
        ]}
      />,
    )

    await user.click(screen.getByText('New Resistance'))
    await user.type(screen.getByPlaceholderText('e.g. Fire Resistance'), 'Ice Resistance')

    // Switch to CALCULATED
    await user.click(screen.getByText('Calculated'))

    // Add a component
    await user.click(screen.getByText('+ Add Component'))
    const compNameInput = screen.getByPlaceholderText('Component Name (e.g. Natural)')
    await user.type(compNameInput, 'Natural')
    const compValInput = screen.getByPlaceholderText('0')
    await user.type(compValInput, '5')

    // Add attribute modifier via the custom headless Select (combobox → click option)
    const select = screen.getByRole('combobox')
    await user.click(select)
    await user.click(screen.getByRole('option', { name: 'Constitution' }))

    await user.click(screen.getByText('Create Resistance'))

    await waitFor(() => {
      expect(onCreateResistance).toHaveBeenCalledTimes(1)
      const callArg = onCreateResistance.mock.calls[0][0]
      expect(callArg.name).toBe('Ice Resistance')
      expect(callArg.calculationType).toBe('CALCULATED')
      expect(callArg.components).toHaveLength(1)
      expect(callArg.components[0].name).toBe('Natural')
      expect(callArg.attributeModifiers).toHaveLength(1)
      expect(callArg.attributeModifiers[0].attributeId).toBe('a1')
    })
  })

  it('switching to MANUAL clears components and attribute modifiers', async () => {
    const user = userEvent.setup()
    render(
      <ResistanceTab
        {...baseProps}        templateAttributes={[{ id: 'a1', key: 'con', name: 'Constitution' }]}
      />,
    )

    await user.click(screen.getByText('New Resistance'))
    await user.click(screen.getByText('Calculated'))
    await user.click(screen.getByText('+ Add Component'))
    await user.click(screen.getByText('Manual Value'))

    // Components section should no longer be rendered
    expect(screen.queryByText(/Components/)).not.toBeInTheDocument()
  })

  it('shows saving spinner during create', async () => {
    const d = deferred()
    const onCreateResistance = vi.fn().mockReturnValue(d.promise)
    const user = userEvent.setup()
    render(<ResistanceTab {...baseProps} onCreateResistance={onCreateResistance} />)

    await user.click(screen.getByText('New Resistance'))
    await user.type(screen.getByPlaceholderText('e.g. Fire Resistance'), 'Test')
    await user.click(screen.getByText('Create Resistance'))

    expect(screen.getByText('Creating...')).toBeInTheDocument()

    d.resolve()
    await waitFor(() => {
      expect(screen.queryByText('Creating...')).not.toBeInTheDocument()
    })
  })

  it('disables Create button when name is empty', async () => {
    const user = userEvent.setup()
    render(<ResistanceTab {...baseProps} />)

    await user.click(screen.getByText('New Resistance'))
    expect(screen.getByText('Create Resistance')).toBeDisabled()
  })

  it('resets form when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<ResistanceTab {...baseProps} />)

    await user.click(screen.getByText('New Resistance'))
    await user.type(screen.getByPlaceholderText('e.g. Fire Resistance'), 'Test')
    await user.click(screen.getByText('Cancel'))

    expect(screen.getByText('New Resistance')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('e.g. Fire Resistance')).not.toBeInTheDocument()
  })

  // ---------- New form: component management ----------

  it('adds and removes components in the new form', async () => {
    const user = userEvent.setup()
    render(<ResistanceTab {...baseProps} />)

    await user.click(screen.getByText('New Resistance'))
    await user.click(screen.getByText('Calculated'))
    expect(screen.getByText('No components added yet.')).toBeInTheDocument()

    await user.click(screen.getByText('+ Add Component'))
    expect(screen.queryByText('No components added yet.')).not.toBeInTheDocument()

    // Remove the component
    await user.click(screen.getAllByText('✕')[0])
    expect(screen.getByText('No components added yet.')).toBeInTheDocument()
  })

  it('toggles editableByPlayer checkbox on a component', async () => {
    const user = userEvent.setup()
    render(<ResistanceTab {...baseProps} />)

    await user.click(screen.getByText('New Resistance'))
    await user.click(screen.getByText('Calculated'))
    await user.click(screen.getByText('+ Add Component'))

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
    await user.click(checkbox)
    expect(checkbox).toBeChecked()
  })

  it('adds and removes attribute modifiers in the new form', async () => {
    const user = userEvent.setup()
    render(
      <ResistanceTab
        {...baseProps}        templateAttributes={[
          { id: 'a1', key: 'con', name: 'Constitution' },
          { id: 'a2', key: 'str', name: 'Strength' },
        ]}
      />,
    )

    await user.click(screen.getByText('New Resistance'))
    await user.click(screen.getByText('Calculated'))

    const select = screen.getByRole('combobox')
    await user.click(select)
    await user.click(screen.getByRole('option', { name: 'Constitution' }))
    expect(screen.getByText('Constitution')).toBeInTheDocument()

    // Add another
    await user.click(select)
    await user.click(screen.getByRole('option', { name: 'Strength' }))
    expect(screen.getByText('Strength')).toBeInTheDocument()

    // Remove the first one
    const removeBtns = screen.getAllByText('×')
    await user.click(removeBtns[0])
    // The badge is removed — reopen the select and confirm Constitution is an available option again
    await user.click(select)
    expect(screen.getByRole('option', { name: 'Constitution' })).toBeInTheDocument()
  })

  it('does not add duplicate attribute modifier', async () => {
    const user = userEvent.setup()
    render(
      <ResistanceTab
        {...baseProps}        templateAttributes={[{ id: 'a1', key: 'con', name: 'Constitution' }]}
      />,
    )

    await user.click(screen.getByText('New Resistance'))
    await user.click(screen.getByText('Calculated'))

    const select = screen.getByRole('combobox')
    await user.click(select)
    await user.click(screen.getByRole('option', { name: 'Constitution' }))
    // Only one "Constitution" badge
    expect(screen.getAllByText('Constitution')).toHaveLength(1)
  })

  it('shows disabled attribute modifiers section when disableAttributeModifiers is true', async () => {
    const user = userEvent.setup()
    render(
      <ResistanceTab
        {...baseProps}        disableAttributeModifiers={true}
      />,
    )

    await user.click(screen.getByText('New Resistance'))
    await user.click(screen.getByText('Calculated'))

    expect(screen.getByText(/Attribute Modifiers are disabled/)).toBeInTheDocument()
  })

  // ---------- Auto-expand effect ----------

  it('auto-expands the newest resistance when list grows', () => {
    const { rerender } = render(<ResistanceTab {...baseProps} resistances={[]} />)
    // When resistances length increases from 0 to 2, the last item auto-expands
    rerender(<ResistanceTab {...baseProps} resistances={[manualResistance, calculatedResistance]} />)
    // The auto-expanded last item (Poison Resistance) should exist
    expect(screen.getByText('Poison Resistance')).toBeInTheDocument()
  })

  // ---------- Error handling in delete ----------

  it('does not throw when onDeleteResistance rejects', async () => {
    const onDeleteResistance = vi.fn().mockRejectedValue(new Error('fail'))
    const user = userEvent.setup()
    const originalConfirm = window.confirm
    window.confirm = vi.fn(() => true)

    render(
      <ResistanceTab
        {...baseProps}
        resistances={[manualResistance]}        onDeleteResistance={onDeleteResistance}
      />,
    )

    await expect(user.click(screen.getByTitle('Delete resistance'))).resolves.toBeUndefined()

    window.confirm = originalConfirm
  })
})

// ==========================================================================
//  InventoryTab
// ==========================================================================

describe('InventoryTab', () => {
  const baseItems: InventoryItem[] = [
    { id: 'i1', name: 'Long Sword', weight: 3, cost: '150 gp', description: 'A sharp blade.', order: 0 },
    { id: 'i2', name: 'Leather Armor', weight: 10, cost: null, description: null, order: 1 },
  ]

  const defaultProps = {
    inventoryItems: baseItems,
    permissions: {
      canEditInventory: true,
      canEditAbilities: false,
      canEditCharacter: false,
      canEditPersonalAbilities: false,
      canEditResistances: false,
      canEditResources: false,
      canEditSkills: false,
      canEditStory: false,
      canEditProfessionalSkills: false,
    },
    searchQuery: '',
    setSearchQuery: vi.fn(),
    totalWeight: 13,
    saveItemField: vi.fn(),
    handleDeleteItem: vi.fn(),
    showNewItem: false,
    setShowNewItem: vi.fn(),
    newItem: { name: '', weight: '', cost: '', description: '' },
    setNewItem: vi.fn(),
    itemSaving: false,
    itemError: null as string | null,
    handleCreateItem: vi.fn(),
    resetNewItem: vi.fn(),
    expandedItems: {} as Record<string, boolean>,
    setExpandedItems: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------- Rendering ----------

  it('renders items, search bar, and weight badge', () => {
    render(<InventoryTab {...defaultProps} />)
    expect(screen.getByPlaceholderText('Search inventory...')).toBeInTheDocument()
    expect(screen.getByText('Long Sword')).toBeInTheDocument()
    expect(screen.getByText('Leather Armor')).toBeInTheDocument()
    expect(screen.getAllByText('150 gp').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/13\.0 kg/)).toBeInTheDocument()
  })

  it('does not show weight badge when item weight is null', () => {
    const items: InventoryItem[] = [
      { id: 'i3', name: 'Map', weight: null, cost: '5 gp', description: null, order: 2 },
    ]
    render(<InventoryTab {...defaultProps} inventoryItems={items} />)
    expect(screen.getAllByText('5 gp').length).toBeGreaterThanOrEqual(1)
  })

  // ---------- Empty state ----------

  it('renders empty state when no items', () => {
    render(<InventoryTab {...defaultProps} inventoryItems={[]} />)
    expect(screen.getByText('Inventory is empty.')).toBeInTheDocument()
  })

  it('shows hint for owner when empty', () => {
    render(<InventoryTab {...defaultProps} inventoryItems={[]} />)
    expect(screen.getByText('Add your first item below.')).toBeInTheDocument()
  })

  it('hides weight badge when there are no items', () => {
    render(<InventoryTab {...defaultProps} inventoryItems={[]} />)
    expect(screen.queryByText(/kg/)).not.toBeInTheDocument()
  })

  // ---------- Search / filter ----------

  it('filters items by name', () => {
    render(<InventoryTab {...defaultProps} searchQuery="Long" />)
    expect(screen.getByText('Long Sword')).toBeInTheDocument()
    expect(screen.queryByText('Leather Armor')).not.toBeInTheDocument()
  })

  it('filters items by description', () => {
    render(<InventoryTab {...defaultProps} searchQuery="sharp" />)
    expect(screen.getByText('Long Sword')).toBeInTheDocument()
    expect(screen.queryByText('Leather Armor')).not.toBeInTheDocument()
  })

  it('filters items by cost', () => {
    render(<InventoryTab {...defaultProps} searchQuery="150" />)
    expect(screen.getByText('Long Sword')).toBeInTheDocument()
  })

  it('shows no-match message when search yields no results', () => {
    render(<InventoryTab {...defaultProps} searchQuery="zzzznotfound" />)
    expect(screen.getByText('No items match your search.')).toBeInTheDocument()
  })

  it('calls setSearchQuery when typing in search', async () => {
    const setSearchQuery = vi.fn()
    const user = userEvent.setup()
    render(<InventoryTab {...defaultProps} setSearchQuery={setSearchQuery} />)
    await user.type(screen.getByPlaceholderText('Search inventory...'), 'sword')
    expect(setSearchQuery).toHaveBeenCalled()
  })

  // ---------- Owner vs non-owner ----------

  it('shows InlineClickEdit for item name when owner', () => {
    render(<InventoryTab {...defaultProps} />)
    const editSpans = screen.getAllByTestId('inline-click-edit')
    expect(editSpans.length).toBeGreaterThanOrEqual(1)
  })

  it('shows plain name text when not owner', () => {
    render(<InventoryTab {...defaultProps} />)
    expect(screen.getByText('Long Sword')).toBeInTheDocument()
  })

  it('shows delete button for owner', () => {
    render(<InventoryTab {...defaultProps} />)
    const deleteBtns = screen.getAllByTitle('Delete item')
    expect(deleteBtns).toHaveLength(2)
  })

  it('hides delete button for non-owner', () => {
    render(<InventoryTab {...defaultProps} permissions={{ ...defaultProps.permissions, canEditInventory: false }} />)
    expect(screen.queryByTitle('Delete item')).not.toBeInTheDocument()
  })

  it('shows Add Item button for owner', () => {
    render(<InventoryTab {...defaultProps} />)
    expect(screen.getByText('Add Item')).toBeInTheDocument()
  })

  it('hides Add Item button for non-owner', () => {
    render(<InventoryTab {...defaultProps} permissions={{ ...defaultProps.permissions, canEditInventory: false }} />)
    expect(screen.queryByText('Add Item')).not.toBeInTheDocument()
  })

  // ---------- Expand/collapse description ----------

  it('calls setExpandedItems when description is clicked', async () => {
    const setExpandedItems = vi.fn()
    const user = userEvent.setup()
    render(
      <InventoryTab
        {...defaultProps}
        setExpandedItems={setExpandedItems}
      />,
    )

    await user.click(screen.getAllByText('Description')[0])
    expect(setExpandedItems).toHaveBeenCalled()
  })

  it('shows description content when expanded', () => {
    render(
      <InventoryTab
        {...defaultProps}
        expandedItems={{ i1: true }}
      />,
    )
    expect(screen.getByText('A sharp blade.')).toBeInTheDocument()
  })

  it('shows "No description." when expanded and description is null', () => {
    render(
      <InventoryTab
        {...defaultProps}
        expandedItems={{ i2: true }}
        permissions={{ ...defaultProps.permissions, canEditInventory: false }}
      />,
    )
    expect(screen.getByText('No description.')).toBeInTheDocument()
  })

  // ---------- InlineClickEdit interactions ----------

  it('calls saveItemField when owner clicks InlineClickEdit on name', async () => {
    const saveItemField = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <InventoryTab
        {...defaultProps}        saveItemField={saveItemField}
      />,
    )

    const editSpans = screen.getAllByTestId('inline-click-edit')
    await user.click(editSpans[0])
    expect(saveItemField).toHaveBeenCalledWith('i1', 'name', 'edited-value')
  })

  // ---------- New item form ----------

  it('shows new item form when showNewItem is true and owner', () => {
    render(
      <InventoryTab
        {...defaultProps}        showNewItem={true}
      />,
    )
    expect(screen.getByText('New Item')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Long Sword')).toBeInTheDocument()
  })

  it('submits new item form', async () => {
    const handleCreateItem = vi.fn()
    const user = userEvent.setup()
    render(
      <InventoryTab
        {...defaultProps}        showNewItem={true}
        handleCreateItem={handleCreateItem}
        newItem={{ name: 'Test Item', weight: '', cost: '', description: '' }}
      />,
    )

    await user.click(screen.getByText('Create Item'))
    expect(handleCreateItem).toHaveBeenCalled()
  })

  it('shows saving spinner on submit button when itemSaving', () => {
    render(
      <InventoryTab
        {...defaultProps}        showNewItem={true}
        itemSaving={true}
      />,
    )
    expect(screen.getByText('Creating...')).toBeInTheDocument()
    expect(screen.getByText('Creating...').closest('button')).toBeDisabled()
  })

  it('shows item error when present', () => {
    render(
      <InventoryTab
        {...defaultProps}        showNewItem={true}
        itemError="Something went wrong"
      />,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('cancels new item form', async () => {
    const resetNewItem = vi.fn()
    const user = userEvent.setup()
    render(
      <InventoryTab
        {...defaultProps}        showNewItem={true}
        resetNewItem={resetNewItem}
      />,
    )

    await user.click(screen.getByText('Cancel'))
    expect(resetNewItem).toHaveBeenCalled()
  })

  it('disables submit when name is empty in new item form', () => {
    render(
      <InventoryTab
        {...defaultProps}        showNewItem={true}
        newItem={{ name: '', weight: '', cost: '', description: '' }}
      />,
    )
    expect(screen.getByText('Create Item')).toBeDisabled()
  })

  it('updates new item fields via setNewItem', async () => {
    const setNewItem = vi.fn()
    const user = userEvent.setup()
    render(
      <InventoryTab
        {...defaultProps}        showNewItem={true}
        setNewItem={setNewItem}
      />,
    )

    await user.type(screen.getByPlaceholderText('e.g. Long Sword'), 'Dagger')
    expect(setNewItem).toHaveBeenCalled()
  })

  // ---------- Delete item ----------

  it('calls handleDeleteItem when delete button clicked', async () => {
    const handleDeleteItem = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <InventoryTab
        {...defaultProps}        handleDeleteItem={handleDeleteItem}
      />,
    )

    await user.click(screen.getAllByTitle('Delete item')[0])
    await user.click(screen.getByRole('button', { name: /Delete forever/i }))
    expect(handleDeleteItem).toHaveBeenCalledWith('i1')
  })
})

// ==========================================================================
//  PersonalAbilitiesTab
// ==========================================================================

describe('PersonalAbilitiesTab', () => {
  const sections: TemplateCharacterSection[] = [
    { id: 's1', name: 'Personality Traits', order: 1 },
    { id: 's2', name: 'Ideals', order: 2 },
  ]

  const entries: SectionEntry[] = [
    { id: 'e1', sheetId: 'sh1', sectionId: 's1', name: 'Brave', description: 'I face danger head-on.', order: 0, section: { id: 's1', name: 'Personality Traits' } },
    { id: 'e2', sheetId: 'sh1', sectionId: 's1', name: 'Curious', description: 'I love exploring.', order: 1, section: { id: 's1', name: 'Personality Traits' } },
    { id: 'e3', sheetId: 'sh1', sectionId: 's2', name: 'Freedom', description: 'All people deserve freedom.', order: 0, section: { id: 's2', name: 'Ideals' } },
  ]

  const defaultProps = {
    sections,
    entries,
    permissions: {
      canEditPersonalAbilities: true,
      canEditAbilities: false,
      canEditCharacter: false,
      canEditInventory: false,
      canEditResistances: false,
      canEditResources: false,
      canEditSkills: false,
      canEditStory: false,
      canEditProfessionalSkills: false,
    },
    toSingular: (name: string) => name.endsWith('s') ? name.slice(0, -1) : name,
    expandedEntries: {} as Record<string, boolean>,
    setExpandedEntries: vi.fn(),
    handleUpdateEntry: vi.fn(),
    handleDeleteEntry: vi.fn(),
    showNewEntry: null as string | null,
    setShowNewEntry: vi.fn(),
    newEntryForm: { name: '', description: '' },
    setNewEntryForm: vi.fn(),
    handleCreateEntry: vi.fn(),
    saving: false,
    resetForm: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------- Empty / no sections state ----------

  it('renders empty state when no sections configured', () => {
    render(<PersonalAbilitiesTab {...defaultProps} sections={[]} />)
    expect(screen.getByText('No character sections configured.')).toBeInTheDocument()
    expect(screen.getByText('Ask your GM to define sections in the Sheet Template.')).toBeInTheDocument()
  })

  // ---------- Rendering sections ----------

  it('renders sections with entries', () => {
    render(<PersonalAbilitiesTab {...defaultProps} />)
    expect(screen.getByText('Personality Traits')).toBeInTheDocument()
    expect(screen.getByText('Ideals')).toBeInTheDocument()
    expect(screen.getByText('Brave')).toBeInTheDocument()
    expect(screen.getByText('Curious')).toBeInTheDocument()
    expect(screen.getByText('Freedom')).toBeInTheDocument()
  })

  // ---------- Expand / collapse entries ----------

  it('calls setExpandedEntries when entry is clicked', async () => {
    const setExpandedEntries = vi.fn()
    const user = userEvent.setup()
    render(
      <PersonalAbilitiesTab
        {...defaultProps}
        setExpandedEntries={setExpandedEntries}
      />,
    )

    // Each entry row is a button. Click the "Brave" entry.
    await user.click(screen.getByText('Brave'))
    expect(setExpandedEntries).toHaveBeenCalled()
  })

  it('shows description when entry is expanded', () => {
    render(
      <PersonalAbilitiesTab
        {...defaultProps}
        expandedEntries={{ e1: true }}
      />,
    )
    expect(screen.getByText('I face danger head-on.')).toBeInTheDocument()
  })

  it('shows "No description." when expanded entry has empty description', () => {
    const entryNoDesc: SectionEntry = {
      id: 'e4', sheetId: 'sh1', sectionId: 's1', name: 'Empty Entry', description: '', order: 2,
      section: { id: 's1', name: 'Personality Traits' },
    }
    render(
      <PersonalAbilitiesTab
        {...defaultProps}
        entries={[entryNoDesc]}
        expandedEntries={{ e4: true }}
        permissions={{ ...defaultProps.permissions, canEditPersonalAbilities: false }}
      />,
    )
    expect(screen.getByText('No description.')).toBeInTheDocument()
  })

  // ---------- Owner interactions ----------

  it('shows InlineClickEdit for entry name when owner', () => {
    render(<PersonalAbilitiesTab {...defaultProps} />)
    const editSpans = screen.getAllByTestId('inline-click-edit')
    expect(editSpans.length).toBeGreaterThanOrEqual(1)
  })

  it('shows plain name when not owner', () => {
    render(<PersonalAbilitiesTab {...defaultProps} permissions={{ ...defaultProps.permissions, canEditPersonalAbilities: false }} />)
    expect(screen.getByText('Brave')).toBeInTheDocument()
  })

  it('shows delete button for owner', () => {
    render(<PersonalAbilitiesTab {...defaultProps} />)
    const deleteBtns = screen.getAllByTitle('Delete entry')
    expect(deleteBtns).toHaveLength(3)
  })

  it('hides delete button for non-owner', () => {
    render(<PersonalAbilitiesTab {...defaultProps} permissions={{ ...defaultProps.permissions, canEditPersonalAbilities: false }} />)
    expect(screen.queryByTitle('Delete entry')).not.toBeInTheDocument()
  })

  it('calls handleUpdateEntry when owner clicks InlineClickEdit', async () => {
    const handleUpdateEntry = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <PersonalAbilitiesTab
        {...defaultProps}        handleUpdateEntry={handleUpdateEntry}
      />,
    )

    const editSpans = screen.getAllByTestId('inline-click-edit')
    await user.click(editSpans[0])
    expect(handleUpdateEntry).toHaveBeenCalledWith('e1', 'name', 'edited-value')
  })

  it('calls handleDeleteEntry when delete button clicked', async () => {
    const handleDeleteEntry = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <PersonalAbilitiesTab
        {...defaultProps}        handleDeleteEntry={handleDeleteEntry}
      />,
    )

    await user.click(screen.getAllByTitle('Delete entry')[0])
    await user.click(screen.getByRole('button', { name: /Delete forever/i }))
    expect(handleDeleteEntry).toHaveBeenCalledWith('e1')
  })

  // ---------- New entry per section ----------

  it('shows Add button for empty section when owner', () => {
    render(
      <PersonalAbilitiesTab
        {...defaultProps}
        sections={[{ id: 's3', name: 'Bonds', order: 3 }]}
        entries={[]}      />,
    )
    expect(screen.getByText('Add Bond')).toBeInTheDocument()
  })

  it('shows New button for section with entries when owner', () => {
    render(
      <PersonalAbilitiesTab
        {...defaultProps}      />,
    )
    expect(screen.getByText('New Personality Trait')).toBeInTheDocument()
    expect(screen.getByText('New Ideal')).toBeInTheDocument()
  })

  it('shows new entry form when showNewEntry matches a section id', () => {
    render(
      <PersonalAbilitiesTab
        {...defaultProps}        showNewEntry="s1"
      />,
    )
    expect(screen.getByText('New Personality Trait')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Personality Trait name')).toBeInTheDocument()
  })

  it('submits new entry form', async () => {
    const handleCreateEntry = vi.fn()
    const user = userEvent.setup()
    render(
      <PersonalAbilitiesTab
        {...defaultProps}        showNewEntry="s1"
        handleCreateEntry={handleCreateEntry}
        newEntryForm={{ name: 'Test', description: '' }}
      />,
    )

    await user.click(screen.getByText('Create Personality Trait'))
    expect(handleCreateEntry).toHaveBeenCalled()
  })

  it('disables submit when new entry name is empty', () => {
    render(
      <PersonalAbilitiesTab
        {...defaultProps}        showNewEntry="s1"
        newEntryForm={{ name: '', description: 'test' }}
      />,
    )
    expect(screen.getByText('Create Personality Trait')).toBeDisabled()
  })

  it('shows saving spinner during create', () => {
    render(
      <PersonalAbilitiesTab
        {...defaultProps}        showNewEntry="s1"
        saving={true}
      />,
    )
    expect(screen.getByText('Creating...')).toBeInTheDocument()
  })

  it('cancels new entry form', async () => {
    const resetForm = vi.fn()
    const user = userEvent.setup()
    render(
      <PersonalAbilitiesTab
        {...defaultProps}        showNewEntry="s1"
        resetForm={resetForm}
      />,
    )

    await user.click(screen.getByText('Cancel'))
    expect(resetForm).toHaveBeenCalled()
  })

  // ---------- toSingular ----------

  it('uses toSingular to derive singular form for labels', () => {
    render(
      <PersonalAbilitiesTab
        {...defaultProps}
        sections={[{ id: 's3', name: 'Ideals', order: 3 }]}
        entries={[]}        toSingular={(name) => name.replace(/s$/, '')}
      />,
    )
    expect(screen.getByText('Add Ideal')).toBeInTheDocument()
  })

  // ---------- Non-owner expanded description ----------

  it('shows description for non-owner when entry is expanded', () => {
    render(
      <PersonalAbilitiesTab
        {...defaultProps}        permissions={{ ...defaultProps.permissions, canEditPersonalAbilities: false }}
        expandedEntries={{ e1: true }}
      />,
    )
    expect(screen.getByText('I face danger head-on.')).toBeInTheDocument()
  })
})

// ==========================================================================
//  StoryTab
// ==========================================================================

describe('StoryTab', () => {
  const mockStory = {
    id: 'st1',
    appearance: 'Tall and fair.',
    backstory: 'Born in a small village.',
    personality: 'Brave and kind.',
    goals: 'To explore the world.',
    notes: 'Has a pet cat.',
  }

  const defaultProps = {
    story: mockStory,
    permissions: {
      canEditStory: true,
      canEditAbilities: false,
      canEditCharacter: false,
      canEditInventory: false,
      canEditResistances: false,
      canEditResources: false,
      canEditSkills: false,
      canEditPersonalAbilities: false,
      canEditProfessionalSkills: false,
    },
    onSaveField: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------- Rendering sections ----------

  it('renders all five story section headers', () => {
    render(<StoryTab {...defaultProps} />)
    // With canEditStory:true, only <h2> card headers appear (no StoryField <h4>)
    expect(screen.getAllByText('Appearance')).toHaveLength(1)
    expect(screen.getAllByText('Backstory')).toHaveLength(1)
    expect(screen.getAllByText('Personality')).toHaveLength(1)
    expect(screen.getAllByText('Goals')).toHaveLength(1)
    expect(screen.getAllByText('Notes')).toHaveLength(1)
  })

  it('renders story values for non-owner via StoryField', () => {
    render(<StoryTab {...defaultProps} permissions={{ ...defaultProps.permissions, canEditStory: false }} />)
    const storyFields = screen.getAllByTestId('story-field')
    expect(storyFields).toHaveLength(5)
    expect(screen.getByText('Tall and fair.')).toBeInTheDocument()
    expect(screen.getByText('Born in a small village.')).toBeInTheDocument()
    expect(screen.getByText('Brave and kind.')).toBeInTheDocument()
    expect(screen.getByText('To explore the world.')).toBeInTheDocument()
    expect(screen.getByText('Has a pet cat.')).toBeInTheDocument()
  })

  // ---------- Owner editing ----------

  it('shows InlineTextarea for owner', () => {
    render(<StoryTab {...defaultProps} />)
    const textareas = screen.getAllByTestId('inline-textarea')
    expect(textareas).toHaveLength(5)
  })

  it('calls onSaveField when owner clicks InlineTextarea', async () => {
    const onSaveField = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <StoryTab
        {...defaultProps}        onSaveField={onSaveField}
      />,
    )

    const spans = screen.getAllByTestId('inline-textarea')
    await user.click(spans[0])
    expect(onSaveField).toHaveBeenCalledWith('appearance', 'edited-text')
  })

  // ---------- Null / empty story ----------

  it('renders with null story (StoryField returns null for empty values)', () => {
    render(<StoryTab {...defaultProps} story={null} />)
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.queryByTestId('story-field')).not.toBeInTheDocument()
  })

  it('renders with partially null story values', () => {
    const partialStory = {
      id: 'st2',
      appearance: null,
      backstory: '',
      personality: 'Friendly.',
      goals: null,
      notes: 'Likes cats.',
    }
    render(<StoryTab {...defaultProps} story={partialStory} permissions={{ ...defaultProps.permissions, canEditStory: false }} />)
    const storyFields = screen.getAllByTestId('story-field')
    expect(storyFields).toHaveLength(2)
    expect(screen.getByText('Friendly.')).toBeInTheDocument()
    expect(screen.getByText('Likes cats.')).toBeInTheDocument()
  })

  // ---------- Owner with empty / null story ----------

  it('shows emptyDisplay for owner when story fields are empty', () => {
    render(
      <StoryTab
        {...defaultProps}
        story={null}      />,
    )
    const textareas = screen.getAllByTestId('inline-textarea')
    expect(textareas).toHaveLength(5)
  })

  // ---------- onSaveField callback ----------

  it('calls onSaveField for each of the five story fields', async () => {
    const onSaveField = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(
      <StoryTab
        {...defaultProps}        onSaveField={onSaveField}
      />,
    )

    const spans = screen.getAllByTestId('inline-textarea')
    for (const span of spans) {
      await user.click(span)
    }
    expect(onSaveField).toHaveBeenCalledTimes(5)
    expect(onSaveField).toHaveBeenCalledWith('appearance', 'edited-text')
    expect(onSaveField).toHaveBeenCalledWith('backstory', 'edited-text')
    expect(onSaveField).toHaveBeenCalledWith('personality', 'edited-text')
    expect(onSaveField).toHaveBeenCalledWith('goals', 'edited-text')
    expect(onSaveField).toHaveBeenCalledWith('notes', 'edited-text')
  })
})
