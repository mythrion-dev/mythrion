import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PersonalAbilitiesTab } from '@/components/character-sheet/PersonalAbilitiesTab'

vi.mock('@/components/character-sheet', () => ({
  InlineClickEdit: ({ value, onSave, className, emptyDisplay, as }: any) => (
    <span
      data-testid="inline-click-edit"
      data-value={value}
      data-empty={emptyDisplay}
      data-as={as}
      className={className}
      onClick={() => onSave?.('updated name')}
      role="button"
    >
      {value?.trim() || emptyDisplay || '—'}
    </span>
  ),
}))

function mockSection(overrides = {}) {
  return { id: 'sec-1', name: 'Features', sortOrder: 1, ...overrides }
}

function mockEntry(overrides = {}) {
  return {
    id: 'entry-1',
    sectionId: 'sec-1',
    name: 'Darkvision',
    description: 'See in darkness up to 60ft',
    ...overrides,
  }
}

function defaultProps(overrides = {}) {
  return {
    sections: [mockSection()],
    entries: [mockEntry()],
    isOwner: true,
    permissions: {
      canEditPersonalAbilities: true,
      canEditAbilities: true,
      canEditCharacter: true,
      canEditInventory: true,
      canEditResistances: true,
      canEditResources: true,
      canEditSkills: true,
      canEditStory: true,
      canEditProfessionalSkills: true,
    },
    toSingular: (name: string) => name === 'Features' ? 'Feature' : name.slice(0, -1),
    expandedEntries: {},
    setExpandedEntries: vi.fn(),
    handleUpdateEntry: vi.fn(),
    handleDeleteEntry: vi.fn(),
    showNewEntry: null,
    setShowNewEntry: vi.fn(),
    newEntryForm: { name: '', description: '' },
    setNewEntryForm: vi.fn(),
    handleCreateEntry: vi.fn(),
    saving: false,
    resetForm: vi.fn(),
    ...overrides,
  }
}

describe('PersonalAbilitiesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state when no sections', () => {
    render(<PersonalAbilitiesTab {...defaultProps({ sections: [] })} />)
    expect(screen.getByText(/no character sections configured/i)).toBeInTheDocument()
  })

  it('renders section name and entry', () => {
    render(<PersonalAbilitiesTab {...defaultProps()} />)
    expect(screen.getByText('Features')).toBeInTheDocument()
    expect(screen.getByText('Darkvision')).toBeInTheDocument()
  })

  it('toggles entry expansion on click (line 94)', () => {
    const setExpandedEntries = vi.fn()
    render(<PersonalAbilitiesTab {...defaultProps({ setExpandedEntries })} />)
    const header = screen.getByText('Darkvision')
    fireEvent.click(header)
    expect(setExpandedEntries).toHaveBeenCalled()
  })

  it('shows empty section state and calls setShowNewEntry', () => {
    const setShowNewEntry = vi.fn()
    const sections = [mockSection({ id: 'sec-2', name: 'Traits' })]
    render(<PersonalAbilitiesTab {...defaultProps({ sections, entries: [], setShowNewEntry })} />)
    // First section (sec-1) has entries, second section (sec-2) doesn't
    expect(screen.getAllByText(/no entries yet/i)).toHaveLength(1)
    // section name is "Traits", toSingular strips trailing 's' → "Trait"
    const addBtn = screen.getByText('Add Trait')
    fireEvent.click(addBtn)
    // Line 64: onClick={() => setShowNewEntry(section.id)}
    expect(setShowNewEntry).toHaveBeenCalledWith('sec-2')
  })

  it('shows new entry form and fills fields', () => {
    const setNewEntryForm = vi.fn()
    render(<PersonalAbilitiesTab {...defaultProps({
      showNewEntry: 'sec-1',
      setNewEntryForm,
      sections: [mockSection({ id: 'sec-1', name: 'Features' })],
      entries: [],
    })} />)
    // The form should be visible
    expect(screen.getByText(/new feature/i)).toBeInTheDocument()

    // Fill name field (line 180)
    const nameInput = screen.getByPlaceholderText('e.g. Feature name')
    fireEvent.change(nameInput, { target: { value: 'Elven Grace' } })
    expect(setNewEntryForm).toHaveBeenCalled()

    // Fill description field (line 193)
    const descInput = screen.getByPlaceholderText(/describe this feature/i)
    fireEvent.change(descInput, { target: { value: 'A graceful elven trait' } })
    expect(setNewEntryForm).toHaveBeenCalledTimes(2)
  })

  it('calls handleUpdateEntry via InlineClickEdit save', () => {
    const handleUpdateEntry = vi.fn()
    render(<PersonalAbilitiesTab {...defaultProps({ handleUpdateEntry })} />)
    // Entry is not expanded yet, so name InlineClickEdit is visible
    const edits = screen.getAllByTestId('inline-click-edit')
    // First edit is the name field (line 110)
    fireEvent.click(edits[0])
    expect(handleUpdateEntry).toHaveBeenCalledWith('entry-1', 'name', 'updated name')
  })

  it('calls handleUpdateEntry description save when entry expanded', () => {
    const handleUpdateEntry = vi.fn()
    render(<PersonalAbilitiesTab {...defaultProps({
      expandedEntries: { 'entry-1': true },
      handleUpdateEntry,
    })} />)
    const edits = screen.getAllByTestId('inline-click-edit')
    // Second edit is the description field (line 137)
    fireEvent.click(edits[1])
    expect(handleUpdateEntry).toHaveBeenCalledWith('entry-1', 'description', 'updated name')
  })

  it('shows New button for section with entries', () => {
    const setShowNewEntry = vi.fn()
    render(<PersonalAbilitiesTab {...defaultProps({ setShowNewEntry })} />)
    const newBtn = screen.getByText('New Feature')
    fireEvent.click(newBtn)
    // Line 159: onClick={() => setShowNewEntry(section.id)}
    expect(setShowNewEntry).toHaveBeenCalledWith('sec-1')
  })

  it('handles delete entry click', () => {
    const handleDeleteEntry = vi.fn()
    render(<PersonalAbilitiesTab {...defaultProps({ handleDeleteEntry })} />)
    const deleteBtn = screen.getByTitle('Delete entry')
    fireEvent.click(deleteBtn)
    expect(handleDeleteEntry).toHaveBeenCalledWith('entry-1')
  })

  it('cancels new entry form', () => {
    const resetForm = vi.fn()
    render(<PersonalAbilitiesTab {...defaultProps({
      showNewEntry: 'sec-1',
      resetForm,
      entries: [],
    })} />)
    const cancelBtn = screen.getByText('Cancel')
    fireEvent.click(cancelBtn)
    expect(resetForm).toHaveBeenCalled()
  })

  it('submits new entry form', () => {
    const handleCreateEntry = vi.fn()
    render(<PersonalAbilitiesTab {...defaultProps({
      showNewEntry: 'sec-1',
      newEntryForm: { name: 'Test', description: 'Test desc' },
      handleCreateEntry,
      entries: [],
    })} />)
    const createBtn = screen.getByText('Create Feature')
    fireEvent.click(createBtn)
    expect(handleCreateEntry).toHaveBeenCalled()
  })

  it('shows saving state', () => {
    render(<PersonalAbilitiesTab {...defaultProps({
      showNewEntry: 'sec-1',
      saving: true,
      newEntryForm: { name: 'Test', description: 'Test' },
      entries: [],
    })} />)
    expect(screen.getByText('Creating...')).toBeInTheDocument()
  })

  it('hides owner controls when not owner', () => {
    render(<PersonalAbilitiesTab {...defaultProps({ isOwner: false, permissions: { canEditPersonalAbilities: false } })} />)
    expect(screen.queryByTitle('Delete entry')).not.toBeInTheDocument()
    expect(screen.queryByText('New Feature')).not.toBeInTheDocument()
  })

  it('expands entry to show description when toggled', () => {
    const setExpandedEntries = vi.fn()
    render(<PersonalAbilitiesTab {...defaultProps({
      expandedEntries: { 'entry-1': true },
      setExpandedEntries,
    })} />)
    // Description should be visible
    expect(screen.getByText(/see in darkness/i)).toBeInTheDocument()
  })

  it('shows description placeholder when no description', () => {
    render(<PersonalAbilitiesTab {...defaultProps({
      expandedEntries: { 'entry-1': true },
      entries: [mockEntry({ description: '' })],
      isOwner: true,
    })} />)
    const edits = screen.getAllByTestId('inline-click-edit')
    expect(edits[1]).toHaveAttribute('data-empty', 'Add a description...')
  })
})
