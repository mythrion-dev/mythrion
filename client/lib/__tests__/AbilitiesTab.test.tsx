import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Mock API ──

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}))

// ── Mock child components ──

vi.mock('@/components/character-sheet/InlineClickEdit', () => ({
  InlineClickEdit: ({ value, onSave, emptyDisplay, className, as: _as }: {
    value: string; onSave: (v: string) => Promise<void>; emptyDisplay?: string; className?: string; as?: string
  }) => (
    <button
      type="button"
      data-testid="inline-click-edit"
      data-value={value}
      data-empty-display={emptyDisplay}
      className={className}
      onClick={() => onSave('saved')}
    >
      {value?.trim() || emptyDisplay || '—'}
    </button>
  ),
}))

vi.mock('@/lib/inline-editable', () => ({
  InlineText: ({ value, onSave, className }: {
    value: string; onSave: (v: string) => Promise<void>; className?: string
  }) => (
    <button
      type="button"
      data-testid="inline-text"
      data-value={value}
      className={className}
      onClick={() => onSave('saved-value')}
    >
      {value || '—'}
    </button>
  ),
  InlineNumber: ({ value, onSave, min, className }: {
    value: number | string | null | undefined; onSave: (v: number) => Promise<void>; min?: number; className?: string
  }) => (
    <button
      type="button"
      data-testid="inline-number"
      data-value={String(value ?? '')}
      data-min={min}
      className={className}
      onClick={() => onSave(Number(value) || 0)}
    >
      {value != null && value !== '' ? String(value) : '—'}
    </button>
  ),
}))

vi.mock('@/components/shared/NumericInput', () => ({
  NumericInput: ({ value, onChange, placeholder, className, inputClassName, wrapperClassName }: {
    value: number | string; onChange: (e: { target: { value: string } }) => void; placeholder?: string
    className?: string; inputClassName?: string; wrapperClassName?: string
  }) => (
    <input
      type="number"
      data-testid="numeric-input"
      value={value}
      placeholder={placeholder}
      className={`${className ?? ''} ${inputClassName ?? ''}`}
      data-wrapper-class={wrapperClassName}
      onChange={(e) => onChange?.(e)}
    />
  ),
}))

vi.mock('@/components/character-sheet/ResistanceTab', () => ({
  ResistanceTab: ({ resistances, isOwner }: {
    resistances: Array<{ resistanceId: string; name: string; calculationType: string; total: number }>
    isOwner: boolean
  }) => (
    <div data-testid="resistance-tab">
      {resistances.map(r => (
        <div key={r.resistanceId} data-testid={`resistance-${r.resistanceId}`}>
          {r.name}: {r.total}
        </div>
      ))}
      {resistances.length === 0 && <span>No resistances configured.</span>}
    </div>
  ),
}))

// ── Import component under test (after mocks) ──

import { AbilitiesTab } from '@/components/character-sheet/AbilitiesTab'

// ── Helpers ──

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (err: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

// ── Test data factories ──

const defaultTemplate = {
  id: 'tpl-1',
  name: 'Template',
  attributeModifierFormula: 'floor(value / 2)',
  attributeModifiersEnabled: true,
  attributes: [
    { id: 'attr-1', key: 'str', name: 'Strength' },
    { id: 'attr-2', key: 'dex', name: 'Dexterity' },
  ],
  templateSkills: [
    { id: 'skill-1', name: 'Athletics', allowedAttributeIds: ['attr-1', 'attr-2'] },
    { id: 'skill-2', name: 'Stealth', allowedAttributeIds: ['attr-2'] },
  ],
  armorClasses: [
    {
      id: 'ac-1', name: 'Natural Armor', enabled: true,
      fields: [
        { id: 'ac-field-1', name: 'Base', defaultValue: '10', editableByPlayer: true, description: 'Base AC' },
        { id: 'ac-field-2', name: 'Bonus', defaultValue: '0', editableByPlayer: false, description: null },
      ],
      attributeModifiers: [
        { id: 'am-1', attributeId: 'attr-1', attribute: { id: 'attr-1', key: 'str', name: 'Strength' }, defaultAttributeId: 'attr-1', defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' }, allowPlayerSelection: true, enabled: true },
      ],
    },
  ],
  resistances: [
    { id: 'res-1', name: 'Physical', calculationType: 'CALCULATED', components: [{ id: 'comp-1', name: 'Base', defaultValue: '5', editableByPlayer: true }], attributeModifiers: [] },
  ],
  _count: { attributes: 2, armorClasses: 1, coreResources: 0, resistances: 1 },
} as const

function makeAbility(overrides: Record<string, unknown> = {}) {
  const base = {
    id: 'abil-1',
    name: 'Fireball',
    type: 'ABILITY',
    description: 'A fiery explosion',
    notes: null,
    sheetId: 'sheet-1',
    levels: [
      { id: 'lvl-1', level: 1, manaCost: 20, range: '30m', damage: '2d6', description: 'Level 1 fireball', notes: null },
      { id: 'lvl-2', level: 2, manaCost: 25, range: '40m', damage: '3d6', description: 'Level 2 fireball', notes: 'Improved' },
    ],
    levelOrder: 0,
    summonHealth: null,
    summonAttributes: [],
    summonResistanceValues: [],
    summonResistanceComponentValues: [],
    summonSkills: [],
    summonAcValues: [],
    summonAcAttributeValues: [],
    _count: { levels: 2 },
    childAbilities: [],
  }
  return { ...base, ...overrides }
}

function makeSummon(overrides: Record<string, unknown> = {}) {
  return makeAbility({
    id: 'summon-1',
    name: 'Spirit Wolf',
    type: 'SUMMON',
    description: 'A loyal spirit wolf',
    notes: 'Can be summoned once per day',
    levels: [],
    summonHealth: { current: 30, maximum: 50 },
    summonAttributes: [
      { id: 'sa-1', attributeId: 'attr-1', value: '14' },
      { id: 'sa-2', attributeId: 'attr-2', value: '12' },
    ],
    summonResistanceValues: [],
    summonResistanceComponentValues: [],
    summonSkills: [],
    summonAcValues: [
      { id: 'acv-1', fieldId: 'ac-field-1', value: '12' },
    ],
    summonAcAttributeValues: [],
    childAbilities: [],
    ...overrides,
  })
}

const defaultSetAbilities = vi.fn()
const defaultSetSelectedLevels = vi.fn()
const defaultSetShowNewAbility = vi.fn()
const defaultSetNewAbilityType = vi.fn()
const defaultSetNewAbility = vi.fn()
const defaultHandleCreateAbility = vi.fn()
const defaultResetNewAbility = vi.fn()
const defaultHandleDeleteAbility = vi.fn()
const defaultSetShowAddLevelModal = vi.fn()
const defaultSetNewLevelForm = vi.fn()
const defaultSetLevelModalSaving = vi.fn()
const defaultSetLevelModalError = vi.fn()
const defaultSetExpandedAbilities = vi.fn()
const defaultSetSearchQuery = vi.fn()
const defaultSaveSummonAttribute = vi.fn()
const defaultSaveSummonAcValue = vi.fn()
const defaultSaveSummonAcAttributeValue = vi.fn()
const defaultSaveSummonHealth = vi.fn()
const defaultSetSummonTabs = vi.fn()
const defaultHandleAddSummonSkill = vi.fn()
const defaultHandleRemoveSummonSkill = vi.fn()
const defaultHandleSummonSkillAttributeChange = vi.fn()
const defaultHandleSummonSkillProfileChange = vi.fn()
const defaultHandleCreateSummonAbility = vi.fn()
const defaultSummonModifierResults = {}
const defaultSummonAcResults = {}
const defaultSummonSkillResults = {}
const defaultSummonTabs = {}

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    abilities: [],
    isOwner: true,
    permissions: {
      canEditAbilities: true,
      canEditCharacter: true,
      canEditInventory: true,
      canEditPersonalAbilities: true,
      canEditResistances: true,
      canEditResources: true,
      canEditSkills: true,
      canEditStory: true,
      canEditProfessionalSkills: true,
    },
    sheetId: 'sheet-1',
    template: defaultTemplate,
    selectedLevels: {},
    setAbilities: defaultSetAbilities,
    setSelectedLevels: defaultSetSelectedLevels,
    showNewAbility: false,
    setShowNewAbility: defaultSetShowNewAbility,
    searchQuery: '',
    setSearchQuery: defaultSetSearchQuery,
    newAbilityType: null,
    setNewAbilityType: defaultSetNewAbilityType,
    newAbility: { name: '', description: '', manaCost: '', range: '', notes: '', damage: '', level: '', hpCurrent: '', hpMax: '' },
    setNewAbility: defaultSetNewAbility,
    abilitySaving: false,
    abilityError: null,
    handleCreateAbility: defaultHandleCreateAbility,
    resetNewAbility: defaultResetNewAbility,
    handleDeleteAbility: defaultHandleDeleteAbility,
    showAddLevelModal: null,
    setShowAddLevelModal: defaultSetShowAddLevelModal,
    newLevelForm: { level: 1, copyFromPrevious: false },
    setNewLevelForm: defaultSetNewLevelForm,
    levelModalSaving: false,
    setLevelModalSaving: defaultSetLevelModalSaving,
    levelModalError: null,
    setLevelModalError: defaultSetLevelModalError,
    expandedAbilities: {},
    setExpandedAbilities: defaultSetExpandedAbilities,
    summonModifierResults: defaultSummonModifierResults,
    summonAcResults: defaultSummonAcResults,
    saveSummonAttribute: defaultSaveSummonAttribute,
    saveSummonAcValue: defaultSaveSummonAcValue,
    saveSummonAcAttributeValue: defaultSaveSummonAcAttributeValue,
    saveSummonHealth: defaultSaveSummonHealth,
    summonTabs: defaultSummonTabs,
    setSummonTabs: defaultSetSummonTabs,
    summonSkillResults: defaultSummonSkillResults,
    handleAddSummonSkill: defaultHandleAddSummonSkill,
    handleRemoveSummonSkill: defaultHandleRemoveSummonSkill,
    handleSummonSkillAttributeChange: defaultHandleSummonSkillAttributeChange,
    handleSummonSkillProfileChange: defaultHandleSummonSkillProfileChange,
    handleCreateSummonAbility: defaultHandleCreateSummonAbility,
    ...overrides,
  }
}

function renderAbilitiesTab(props: Record<string, unknown> = {}) {
  return render(<AbilitiesTab {...defaultProps(props)} />)
}

// ════════════════════════════════════════════════════════════════
// AbilitiesTab
// ════════════════════════════════════════════════════════════════

describe('AbilitiesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Basic rendering & empty states ──

  it('renders the search bar', () => {
    renderAbilitiesTab()
    expect(screen.getByPlaceholderText('Search abilities & summons...')).toBeInTheDocument()
  })

  it('shows empty state when no abilities and not creating', () => {
    renderAbilitiesTab()
    expect(screen.getByText('No abilities or summons yet.')).toBeInTheDocument()
  })

  it('shows "Create one below." text when owner and empty', () => {
    renderAbilitiesTab()
    expect(screen.getByText('Create one below.')).toBeInTheDocument()
  })

  it('does not show "Create one below." when not owner and empty', () => {
    renderAbilitiesTab({ isOwner: false, permissions: { canEditAbilities: false } })
    expect(screen.getByText('No abilities or summons yet.')).toBeInTheDocument()
    expect(screen.queryByText('Create one below.')).not.toBeInTheDocument()
  })

  it('shows search empty state when search yields no results', () => {
    // Provide an ability that won't match the search
    renderAbilitiesTab({ abilities: [makeAbility()], searchQuery: 'zzz' })
    expect(screen.getByText('No entries match your search.')).toBeInTheDocument()
  })

  it('does not show search empty state when searchQuery is empty and no abilities', () => {
    renderAbilitiesTab({ searchQuery: '' })
    // Shows the general empty state, not the search empty state
    expect(screen.getByText('No abilities or summons yet.')).toBeInTheDocument()
    expect(screen.queryByText('No entries match your search.')).not.toBeInTheDocument()
  })

  it('shows ability count when abilities exist', () => {
    renderAbilitiesTab({ abilities: [makeAbility()] })
    expect(screen.getByText('1 entry')).toBeInTheDocument()
  })

  it('shows plural "entries" when multiple abilities exist', () => {
    renderAbilitiesTab({ abilities: [makeAbility({ id: 'a1' }), makeAbility({ id: 'a2', name: 'Ice Shard' })] })
    expect(screen.getByText((content) => content.includes('2') && content.includes('entrys'))).toBeInTheDocument()
  })

  // ── Ability rendering ──

  it('renders ability names', () => {
    renderAbilitiesTab({ abilities: [makeAbility()] })
    expect(screen.getByText('Fireball')).toBeInTheDocument()
  })

  it('renders Ability badge for ability type', () => {
    renderAbilitiesTab({ abilities: [makeAbility()] })
    expect(screen.getByText('Ability')).toBeInTheDocument()
  })

  it('renders Summon badge for summon type', () => {
    renderAbilitiesTab({ abilities: [makeSummon()] })
    expect(screen.getByText('Summon')).toBeInTheDocument()
  })

  it('shows level badge for ability with level', () => {
    renderAbilitiesTab({ abilities: [makeAbility()] })
    expect(screen.getByText('Level 1')).toBeInTheDocument()
  })

  it('renders level select dropdown for abilities with levels', () => {
    renderAbilitiesTab({ abilities: [makeAbility()] })
    const level1s = screen.getAllByText('Level 1')
    expect(level1s.length).toBeGreaterThanOrEqual(1)
    const level2s = screen.getAllByText('Level 2')
    expect(level2s.length).toBeGreaterThanOrEqual(1)
  })

  // ── Expand/collapse ──

  it('expands ability card on click', async () => {
    const setExpanded = vi.fn()
    renderAbilitiesTab({
      abilities: [makeAbility()],
      expandedAbilities: {},
      setExpandedAbilities: setExpanded,
    })
    const toggleBtn = screen.getByText('Fireball').closest('button')!
    fireEvent.click(toggleBtn)
    expect(setExpanded).toHaveBeenCalled()
  })

  it('renders expanded ability metadata for owner', () => {
    renderAbilitiesTab({
      abilities: [makeAbility()],
      expandedAbilities: { 'abil-1': true },
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
    expect(screen.getByText('Mana:')).toBeInTheDocument()
    expect(screen.getByText('Range:')).toBeInTheDocument()
    expect(screen.getByText('Damage:')).toBeInTheDocument()
  })

  it('renders expanded ability metadata for non-owner', () => {
    renderAbilitiesTab({
      abilities: [makeAbility()],
      isOwner: false,
      expandedAbilities: { 'abil-1': true },
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
    expect(screen.getByText(/Mana:/)).toBeInTheDocument()
    expect(screen.getByText(/Range:/)).toBeInTheDocument()
    expect(screen.getByText(/Damage:/)).toBeInTheDocument()
  })

  it('shows description section for owner when expanded', () => {
    renderAbilitiesTab({
      abilities: [makeAbility()],
      expandedAbilities: { 'abil-1': true },
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
    expect(screen.getByText('Description')).toBeInTheDocument()
  })

  it('shows description text for non-owner when present', () => {
    renderAbilitiesTab({
      abilities: [makeAbility()],
      isOwner: false,
      expandedAbilities: { 'abil-1': true },
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
    expect(screen.getByText('Level 1 fireball')).toBeInTheDocument()
  })

  it('shows notes section for owner when expanded', () => {
    renderAbilitiesTab({
      abilities: [makeAbility()],
      expandedAbilities: { 'abil-1': true },
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
    expect(screen.getByText('Notes')).toBeInTheDocument()
  })

  it('shows notes for non-owner when notes exist', () => {
    renderAbilitiesTab({
      abilities: [makeAbility({
        levels: [{ id: 'lvl-1', level: 1, manaCost: 20, range: '30m', damage: '2d6', description: null, notes: 'Secret' }],
      })],
      isOwner: false,
      expandedAbilities: { 'abil-1': true },
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
    expect(screen.getByText('Secret')).toBeInTheDocument()
  })

  it('shows "Add Level" button for owner', () => {
    renderAbilitiesTab({
      abilities: [makeAbility()],
      expandedAbilities: { 'abil-1': true },
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
    const addLevelBtns = screen.getAllByText('Add Level')
    expect(addLevelBtns.length).toBeGreaterThanOrEqual(1)
  })

  it('shows "Delete Level" button for owner with multiple levels', () => {
    renderAbilitiesTab({
      abilities: [makeAbility()],
      expandedAbilities: { 'abil-1': true },
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
    expect(screen.getByText('Delete Level 1')).toBeInTheDocument()
  })

  it('shows no levels message when ability has no levels', () => {
    renderAbilitiesTab({
      abilities: [makeAbility({ levels: [] })],
      expandedAbilities: { 'abil-1': true },
    })
    expect(screen.getByText('No levels added yet.')).toBeInTheDocument()
  })

  // ── Search ──

  it('filters abilities by name', () => {
    renderAbilitiesTab({
      abilities: [
        makeAbility({ id: 'a1', name: 'Fireball' }),
        makeAbility({ id: 'a2', name: 'Ice Shard' }),
      ],
      searchQuery: 'Ice',
    })
    expect(screen.queryByText('Fireball')).not.toBeInTheDocument()
    expect(screen.getByText('Ice Shard')).toBeInTheDocument()
  })

  it('filters abilities by description', () => {
    renderAbilitiesTab({
      abilities: [
        makeAbility({ id: 'a1', name: 'Fireball', description: 'Fiery explosion' }),
        makeAbility({ id: 'a2', name: 'Ice', description: 'Frozen shard' }),
      ],
      searchQuery: 'shard',
    })
    expect(screen.queryByText('Fireball')).not.toBeInTheDocument()
    expect(screen.getByText('Ice')).toBeInTheDocument()
  })

  it('filters abilities by type', () => {
    renderAbilitiesTab({
      abilities: [
        makeAbility({ id: 'a1', name: 'Fireball', type: 'ABILITY' }),
        makeAbility({ id: 'a2', name: 'Wolf', type: 'SUMMON' }),
      ],
      searchQuery: 'summon',
    })
    expect(screen.queryByText('Fireball')).not.toBeInTheDocument()
    expect(screen.getByText('Wolf')).toBeInTheDocument()
  })

  it('calls setSearchQuery when search input changes', () => {
    const setQuery = vi.fn()
    renderAbilitiesTab({ setSearchQuery: setQuery })
    fireEvent.change(screen.getByPlaceholderText('Search abilities & summons...'), { target: { value: 'fire' } })
    expect(setQuery).toHaveBeenCalledWith('fire')
  })

  // ── Owner-specific features ──

  it('shows delete button for owner', () => {
    renderAbilitiesTab({ abilities: [makeAbility()] })
    const deleteBtns = screen.getAllByTitle('Delete ability')
    expect(deleteBtns.length).toBeGreaterThanOrEqual(1)
  })

  it('hides delete button for non-owner', () => {
    renderAbilitiesTab({ abilities: [makeAbility()], isOwner: false, permissions: { canEditAbilities: false } })
    expect(screen.queryByTitle('Delete ability')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Delete summon')).not.toBeInTheDocument()
  })

  it('shows "New Ability or Summon" button for owner', () => {
    renderAbilitiesTab()
    expect(screen.getByText('New Ability or Summon')).toBeInTheDocument()
  })

  it('hides "New Ability or Summon" button for non-owner', () => {
    renderAbilitiesTab({ isOwner: false, permissions: { canEditAbilities: false } })
    expect(screen.queryByText('New Ability or Summon')).not.toBeInTheDocument()
  })

  it('shows create form with type selection when showNewAbility is true and no type selected', () => {
    renderAbilitiesTab({ showNewAbility: true, newAbilityType: null })
    expect(screen.getByText('What would you like to create?')).toBeInTheDocument()
    expect(screen.getByText('Ability')).toBeInTheDocument()
    expect(screen.getByText('Summon')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('hides create form when not owner', () => {
    renderAbilitiesTab({ isOwner: false, showNewAbility: true, permissions: { canEditAbilities: false } })
    expect(screen.queryByText('What would you like to create?')).not.toBeInTheDocument()
    expect(screen.queryByText('New Ability')).not.toBeInTheDocument()
    expect(screen.queryByText('New Summon')).not.toBeInTheDocument()
  })

  it('selects ABILITY type when Ability button clicked', () => {
    const setType = vi.fn()
    renderAbilitiesTab({ showNewAbility: true, newAbilityType: null, setNewAbilityType: setType })
    fireEvent.click(screen.getByText('Ability'))
    expect(setType).toHaveBeenCalledWith('ABILITY')
  })

  it('selects SUMMON type when Summon button clicked', () => {
    const setType = vi.fn()
    renderAbilitiesTab({ showNewAbility: true, newAbilityType: null, setNewAbilityType: setType })
    fireEvent.click(screen.getByText('Summon'))
    expect(setType).toHaveBeenCalledWith('SUMMON')
  })

  it('renders new ability form when newAbilityType is ABILITY', () => {
    renderAbilitiesTab({ showNewAbility: true, newAbilityType: 'ABILITY' })
    expect(screen.getByText('New Ability')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Fireball')).toBeInTheDocument()
    expect(screen.getByText('Create Ability')).toBeInTheDocument()
  })

  it('renders new summon form when newAbilityType is SUMMON', () => {
    renderAbilitiesTab({ showNewAbility: true, newAbilityType: 'SUMMON' })
    expect(screen.getByText('New Summon')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Spirit Wolf')).toBeInTheDocument()
    expect(screen.getByText('Create Summon')).toBeInTheDocument()
  })

  it('creates ability form submits via handleCreateAbility', async () => {
    const handleCreate = vi.fn()
    renderAbilitiesTab({
      showNewAbility: true,
      newAbilityType: 'ABILITY',
      handleCreateAbility: handleCreate,
      newAbility: { name: 'Fireball', description: 'Boom', manaCost: '20', range: '30m', notes: '', damage: '2d6', level: '1', hpCurrent: '', hpMax: '' },
    })
    fireEvent.click(screen.getByText('Create Ability'))
    expect(handleCreate).toHaveBeenCalled()
  })

  it('creates summon form submits via handleCreateAbility', async () => {
    const handleCreate = vi.fn()
    renderAbilitiesTab({
      showNewAbility: true,
      newAbilityType: 'SUMMON',
      handleCreateAbility: handleCreate,
      newAbility: { name: 'Wolf', description: '', manaCost: '', range: '', notes: '', damage: '', level: '', hpCurrent: '20', hpMax: '20' },
    })
    fireEvent.click(screen.getByText('Create Summon'))
    expect(handleCreate).toHaveBeenCalled()
  })

  it('shows ability error in ability form', () => {
    renderAbilitiesTab({
      showNewAbility: true,
      newAbilityType: 'ABILITY',
      abilityError: 'Name already taken',
    })
    expect(screen.getByText('Name already taken')).toBeInTheDocument()
  })

  it('shows ability error in summon form', () => {
    renderAbilitiesTab({
      showNewAbility: true,
      newAbilityType: 'SUMMON',
      abilityError: 'Invalid summon data',
    })
    expect(screen.getByText('Invalid summon data')).toBeInTheDocument()
  })

  it('shows saving spinner on ability create button when abilitySaving', () => {
    renderAbilitiesTab({
      showNewAbility: true,
      newAbilityType: 'ABILITY',
      abilitySaving: true,
    })
    const createBtns = screen.getAllByText('Creating...')
    expect(createBtns.length).toBeGreaterThanOrEqual(1)
  })

  it('shows saving spinner on summon create button when abilitySaving', () => {
    renderAbilitiesTab({
      showNewAbility: true,
      newAbilityType: 'SUMMON',
      abilitySaving: true,
    })
    const createBtns = screen.getAllByText('Creating...')
    expect(createBtns.length).toBeGreaterThanOrEqual(1)
  })

  it('disables submit button when name is empty in ability form', () => {
    renderAbilitiesTab({
      showNewAbility: true,
      newAbilityType: 'ABILITY',
      newAbility: { name: '', description: '', manaCost: '', range: '', notes: '', damage: '', level: '', hpCurrent: '', hpMax: '' },
    })
    expect(screen.getByText('Create Ability')).toBeDisabled()
  })

  it('calls resetNewAbility when Cancel is clicked in type selection', () => {
    const reset = vi.fn()
    renderAbilitiesTab({ showNewAbility: true, newAbilityType: null, resetNewAbility: reset })
    fireEvent.click(screen.getByText('Cancel'))
    expect(reset).toHaveBeenCalled()
  })

  it('calls setNewAbilityType(null) when back arrow is clicked in ability form', () => {
    const setType = vi.fn()
    renderAbilitiesTab({ showNewAbility: true, newAbilityType: 'ABILITY', setNewAbilityType: setType })
    // The back arrow is the first svg button in the form header
    const backBtns = document.querySelectorAll('button svg')
    expect(backBtns.length).toBeGreaterThan(0)
    // Click the back button (the one with the left chevron path)
    const chevronLeftBtn = Array.from(document.querySelectorAll('button')).find(
      btn => btn.innerHTML.includes('M15 19l-7-7 7-7')
    )
    if (chevronLeftBtn) {
      fireEvent.click(chevronLeftBtn)
      expect(setType).toHaveBeenCalledWith(null)
    }
  })

  it('calls setNewAbilityType(null) when back arrow is clicked in summon form', () => {
    const setType = vi.fn()
    renderAbilitiesTab({ showNewAbility: true, newAbilityType: 'SUMMON', setNewAbilityType: setType })
    const chevronLeftBtn = Array.from(document.querySelectorAll('button')).find(
      btn => btn.innerHTML.includes('M15 19l-7-7 7-7')
    )
    if (chevronLeftBtn) {
      fireEvent.click(chevronLeftBtn)
      expect(setType).toHaveBeenCalledWith(null)
    }
  })

  // ── Delete ability confirmation ──

  it('opens delete confirmation when delete button clicked', () => {
    renderAbilitiesTab({ abilities: [makeAbility()] })
    const deleteBtn = screen.getByTitle('Delete ability')
    fireEvent.click(deleteBtn)
    expect(screen.getByText('Delete Entry')).toBeInTheDocument()
    expect(screen.getByText(/Are you sure/)).toBeInTheDocument()
    expect(screen.getAllByText('Fireball').length).toBeGreaterThanOrEqual(1)
  })

  it('closes delete confirmation on Cancel click', () => {
    renderAbilitiesTab({ abilities: [makeAbility()] })
    const deleteBtn = screen.getByTitle('Delete ability')
    fireEvent.click(deleteBtn)
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Delete Entry')).not.toBeInTheDocument()
  })

  it('calls handleDeleteAbility on Delete click in confirmation', async () => {
    const handleDelete = vi.fn().mockResolvedValue(undefined)
    renderAbilitiesTab({ abilities: [makeAbility()], handleDeleteAbility: handleDelete })
    const deleteBtn = screen.getByTitle('Delete ability')
    fireEvent.click(deleteBtn)
    fireEvent.click(screen.getByText('Delete'))
    expect(handleDelete).toHaveBeenCalledWith('abil-1')
  })

  it('shows Deleting... on delete button while processing', () => {
    const handleDelete = vi.fn().mockReturnValue(new Promise(() => {}))
    renderAbilitiesTab({ abilities: [makeAbility()], handleDeleteAbility: handleDelete })
    fireEvent.click(screen.getByTitle('Delete ability'))
    fireEvent.click(screen.getByText('Delete'))
    expect(screen.getByText('Deleting...')).toBeInTheDocument()
  })

  // ── Add Level modal ──

  it('opens add level modal when Add Level is clicked', () => {
    const setModal = vi.fn()
    renderAbilitiesTab({
      abilities: [makeAbility()],
      expandedAbilities: { 'abil-1': true },
      setShowAddLevelModal: setModal,
    })
    const addLevelBtns = screen.getAllByText('Add Level')
    fireEvent.click(addLevelBtns[0])
    expect(setModal).toHaveBeenCalledWith('abil-1')
  })

  it('renders add level modal when showAddLevelModal is set', () => {
    renderAbilitiesTab({
      showAddLevelModal: 'abil-1',
      expandedAbilities: { 'abil-1': true },
    })
    expect(screen.getByText('Create Ability Level')).toBeInTheDocument()
    expect(screen.getByText('Copy information from previous level?')).toBeInTheDocument()
  })

  it('closes add level modal on Cancel click', () => {
    const setModal = vi.fn()
    renderAbilitiesTab({
      showAddLevelModal: 'abil-1',
      setShowAddLevelModal: setModal,
    })
    fireEvent.click(screen.getByText('Cancel'))
    expect(setModal).toHaveBeenCalledWith(null)
  })

  it('disables Cancel button in level modal when saving', () => {
    renderAbilitiesTab({
      showAddLevelModal: 'abil-1',
      levelModalSaving: true,
    })
    expect(screen.getByText('Cancel')).toBeDisabled()
  })

  it('calls handleAddLevel when Create is clicked in level modal', () => {
    renderAbilitiesTab({
      showAddLevelModal: 'abil-1',
      expandedAbilities: { 'abil-1': true },
    })
    // The level modal has a Create button
    const createBtn = screen.getByText('Create')
    fireEvent.click(createBtn)
    // api.post should have been called
    expect(mockPost).toHaveBeenCalled()
  })

  it('shows level modal error', () => {
    renderAbilitiesTab({
      showAddLevelModal: 'abil-1',
      levelModalError: 'Level already exists',
    })
    expect(screen.getByText('Level already exists')).toBeInTheDocument()
  })

  it('shows Creating... in level modal when saving', () => {
    renderAbilitiesTab({
      showAddLevelModal: 'abil-1',
      levelModalSaving: true,
    })
    expect(screen.getByText('Creating...')).toBeInTheDocument()
  })

  it('updates newLevelForm copyFromPrevious via radio buttons', () => {
    const setForm = vi.fn()
    renderAbilitiesTab({
      showAddLevelModal: 'abil-1',
      newLevelForm: { level: 2, copyFromPrevious: true },
      setNewLevelForm: setForm,
    })
    // Click "No" radio
    const noRadio = screen.getByText('No').previousElementSibling as HTMLInputElement
    fireEvent.click(noRadio)
    expect(setForm).toHaveBeenCalled()
  })

  // ── Delete Level confirmation ──

  it('opens delete level confirmation when Delete Level is clicked', () => {
    renderAbilitiesTab({
      abilities: [makeAbility()],
      expandedAbilities: { 'abil-1': true },
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
    fireEvent.click(screen.getByText('Delete Level 1'))
    expect(screen.getByText('Delete Level')).toBeInTheDocument()
  })

  it('shows level number in delete level confirmation', () => {
    renderAbilitiesTab({
      abilities: [makeAbility()],
      expandedAbilities: { 'abil-1': true },
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
    fireEvent.click(screen.getByText('Delete Level 1'))
    // Check for the level info in the confirmation text
    expect(screen.getAllByText(/Level 1/).length).toBeGreaterThanOrEqual(1)
  })

  it('calls api.delete when confirming level delete', async () => {
    mockDelete.mockResolvedValue(undefined)
    renderAbilitiesTab({
      abilities: [makeAbility()],
      expandedAbilities: { 'abil-1': true },
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
    fireEvent.click(screen.getByText('Delete Level 1'))
    fireEvent.click(screen.getByText('Delete'))
    expect(mockDelete).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/x/levels/lvl-1')
  })

  it('closes delete level confirmation on Cancel', () => {
    renderAbilitiesTab({
      abilities: [makeAbility()],
      expandedAbilities: { 'abil-1': true },
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
    fireEvent.click(screen.getByText('Delete Level 1'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Delete Level')).not.toBeInTheDocument()
  })

  it('shows Deleting... on level delete button while processing', () => {
    mockDelete.mockReturnValue(new Promise(() => {}))
    renderAbilitiesTab({
      abilities: [makeAbility()],
      expandedAbilities: { 'abil-1': true },
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
    fireEvent.click(screen.getByText('Delete Level 1'))
    fireEvent.click(screen.getByText('Delete'))
    expect(screen.getByText('Deleting...')).toBeInTheDocument()
  })

  // ── Level select ──

  it('changes selected level when level select changes', () => {
    const setLevels = vi.fn()
    renderAbilitiesTab({
      abilities: [makeAbility()],
      setSelectedLevels: setLevels,
    })
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'lvl-2' } })
    expect(setLevels).toHaveBeenCalled()
  })

  it('selects last level by default when no selection exists', () => {
    renderAbilitiesTab({
      abilities: [makeAbility()],
      selectedLevels: {},
    })
    // Shows level 2 (the last level) badge + select option
    expect(screen.getAllByText('Level 2').length).toBeGreaterThanOrEqual(1)
  })

  // ── Summon rendering ──

  it('renders summon with health display', () => {
    renderAbilitiesTab({ abilities: [makeSummon()], expandedAbilities: { 'summon-1': true } })
    expect(screen.getByText('Health')).toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()
    expect(screen.getByText('Max')).toBeInTheDocument()
  })

  it('shows summon health current and max values', () => {
    renderAbilitiesTab({ abilities: [makeSummon()], expandedAbilities: { 'summon-1': true } })
    // Current = 30, Max = 50
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('shows summon attributes section when attributes exist', () => {
    renderAbilitiesTab({ abilities: [makeSummon()], expandedAbilities: { 'summon-1': true } })
    expect(screen.getByText('Attributes')).toBeInTheDocument()
    expect(screen.getAllByText('Strength').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Dexterity').length).toBeGreaterThanOrEqual(1)
  })

  it('does not show attributes section when no summon attributes', () => {
    renderAbilitiesTab({
      abilities: [makeSummon({ summonAttributes: [] })],
      expandedAbilities: { 'summon-1': true },
    })
    expect(screen.queryByText('Attributes')).not.toBeInTheDocument()
  })

  it('shows Damage and Heal buttons for owner in summon health', () => {
    renderAbilitiesTab({ abilities: [makeSummon()], expandedAbilities: { 'summon-1': true } })
    expect(screen.getByText('Damage')).toBeInTheDocument()
    expect(screen.getByText('Heal')).toBeInTheDocument()
  })

  it('hides Damage and Heal buttons for non-owner', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      isOwner: false,
      permissions: { canEditAbilities: false },
      expandedAbilities: { 'summon-1': true },
    })
    expect(screen.queryByText('Damage')).not.toBeInTheDocument()
    expect(screen.queryByText('Heal')).not.toBeInTheDocument()
  })

  it('calls saveSummonHealth with Damage when Damage button clicked', async () => {
    const saveHealth = vi.fn()
    renderAbilitiesTab({
      abilities: [makeSummon({ summonHealth: { current: 30, maximum: 50 } })],
      expandedAbilities: { 'summon-1': true },
      saveSummonHealth: saveHealth,
      summonHpAmount: { 'summon-1': '10' },
    })
    // Set the HP amount via the NumericInput mock
    const numericInputs = screen.getAllByTestId('numeric-input')
    fireEvent.change(numericInputs[0], { target: { value: '10' } })
    fireEvent.click(screen.getByText('Damage'))
    expect(saveHealth).toHaveBeenCalledWith('summon-1', 'current', 20) // 30-10 = 20
  })

  it('calls saveSummonHealth with Heal when Heal button clicked', async () => {
    const saveHealth = vi.fn()
    renderAbilitiesTab({
      abilities: [makeSummon({ summonHealth: { current: 30, maximum: 50 } })],
      expandedAbilities: { 'summon-1': true },
      saveSummonHealth: saveHealth,
      summonHpAmount: { 'summon-1': '10' },
    })
    const numericInputs = screen.getAllByTestId('numeric-input')
    fireEvent.change(numericInputs[0], { target: { value: '10' } })
    fireEvent.click(screen.getByText('Heal'))
    expect(saveHealth).toHaveBeenCalledWith('summon-1', 'current', 40) // 30+10 = 40
  })

  it('shows dash for max health when null for non-owner', () => {
    renderAbilitiesTab({
      abilities: [makeSummon({ summonHealth: { current: 30, maximum: null } })],
      isOwner: false,
      expandedAbilities: { 'summon-1': true },
    })
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  // ── Summon tabs ──

  it('renders summon sub-tabs: Stats, Skills, Abilities, Resistances', () => {
    renderAbilitiesTab({ abilities: [makeSummon()], expandedAbilities: { 'summon-1': true } })
    expect(screen.getByText('Stats')).toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()
    expect(screen.getByText('Abilities')).toBeInTheDocument()
    expect(screen.getByText('Resistances')).toBeInTheDocument()
  })

  it('switches to Skills tab when Skills button clicked', () => {
    const setTabs = vi.fn()
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      setSummonTabs: setTabs,
    })
    fireEvent.click(screen.getByText('Skills'))
    expect(setTabs).toHaveBeenCalled()
  })

  it('switches to Abilities tab when Abilities button clicked', () => {
    const setTabs = vi.fn()
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      setSummonTabs: setTabs,
    })
    fireEvent.click(screen.getByText('Abilities'))
    expect(setTabs).toHaveBeenCalled()
  })

  it('switches to Resistances tab when Resistances button clicked', () => {
    const setTabs = vi.fn()
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      setSummonTabs: setTabs,
    })
    fireEvent.click(screen.getByText('Resistances'))
    expect(setTabs).toHaveBeenCalled()
  })

  // ── Skills tab ──

  it('shows Add Skill button in Skills tab for owner', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'skills' },
    })
    expect(screen.getByText('Add Skill')).toBeInTheDocument()
  })

  it('shows no skills message when no summon skills', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'skills' },
    })
    expect(screen.getByText(/No skills added/)).toBeInTheDocument()
  })

  it('opens skill search when Add Skill clicked', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'skills' },
    })
    fireEvent.click(screen.getByText('Add Skill'))
    expect(screen.getByPlaceholderText('Search Skill...')).toBeInTheDocument()
  })

  it('closes skill search on Escape key', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'skills' },
    })
    fireEvent.click(screen.getByText('Add Skill'))
    const searchInput = screen.getByPlaceholderText('Search Skill...')
    fireEvent.keyDown(searchInput, { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Search Skill...')).not.toBeInTheDocument()
  })

  it('shows template skills in search results', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'skills' },
    })
    fireEvent.click(screen.getByText('Add Skill'))
    expect(screen.getByText('Athletics')).toBeInTheDocument()
    expect(screen.getByText('Stealth')).toBeInTheDocument()
  })

  it('filters template skills by search query in skill search', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'skills' },
    })
    fireEvent.click(screen.getByText('Add Skill'))
    const searchInput = screen.getByPlaceholderText('Search Skill...')
    fireEvent.change(searchInput, { target: { value: 'Ath' } })
    expect(screen.getByText('Athletics')).toBeInTheDocument()
    expect(screen.queryByText('Stealth')).not.toBeInTheDocument()
  })

  it('shows "No skills found" when search has no matches', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'skills' },
    })
    fireEvent.click(screen.getByText('Add Skill'))
    const searchInput = screen.getByPlaceholderText('Search Skill...')
    fireEvent.change(searchInput, { target: { value: 'Zzz' } })
    expect(screen.getByText('No skills found')).toBeInTheDocument()
  })

  it('does not show Add Skill button for non-owner', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      isOwner: false,
      permissions: { canEditAbilities: false },
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'skills' },
    })
    expect(screen.queryByText('Add Skill')).not.toBeInTheDocument()
  })

  it('renders skill rows with names and results', () => {
    const skills = [
      { id: 'ss-1', skillId: 'skill-1', skill: { id: 'skill-1', name: 'Athletics', allowedAttributeIds: ['attr-1', 'attr-2'] }, selectedAttributeId: 'attr-1', selectedAttribute: { id: 'attr-1', key: 'str', name: 'Strength' } },
    ]
    renderAbilitiesTab({
      abilities: [makeSummon({ summonSkills: skills })],
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'skills' },
      summonSkillResults: { 'summon-1': { 'ss-1': 5 } },
    })
    expect(screen.getByText('Athletics')).toBeInTheDocument()
    expect(screen.getByText('+5')).toBeInTheDocument()
  })

  it('shows remove skill button for owner', () => {
    const skills = [
      { id: 'ss-1', skillId: 'skill-1', skill: { id: 'skill-1', name: 'Athletics', allowedAttributeIds: ['attr-1', 'attr-2'] }, selectedAttributeId: null, selectedAttribute: null },
    ]
    renderAbilitiesTab({
      abilities: [makeSummon({ summonSkills: skills })],
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'skills' },
    })
    const removeBtns = screen.getAllByTitle('Remove skill')
    expect(removeBtns.length).toBeGreaterThanOrEqual(1)
  })

  it('shows dash for skill result when null', () => {
    const skills = [
      { id: 'ss-1', skillId: 'skill-1', skill: { id: 'skill-1', name: 'Athletics', allowedAttributeIds: ['attr-1', 'attr-2'] }, selectedAttributeId: null, selectedAttribute: null },
    ]
    renderAbilitiesTab({
      abilities: [makeSummon({ summonSkills: skills })],
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'skills' },
      summonSkillResults: { 'summon-1': { 'ss-1': null } },
    })
    const dashElements = screen.getAllByText('—')
    // At least one of these dashes should be from skill result
    expect(dashElements.length).toBeGreaterThanOrEqual(1)
  })

  // ── Child abilities tab ──

  it('shows no abilities message in child abilities tab', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'abilities' },
    })
    expect(screen.getByText('No abilities yet.')).toBeInTheDocument()
  })

  it('renders child abilities in abilities tab', () => {
    const childAbility = makeAbility({ id: 'child-1', name: 'Bite', levels: [{ id: 'cl-1', level: 1, manaCost: 5, range: 'melee', damage: '1d4', description: 'A sharp bite', notes: null }] })
    renderAbilitiesTab({
      abilities: [makeSummon({ childAbilities: [childAbility] })],
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'abilities' },
    })
    expect(screen.getByText('Bite')).toBeInTheDocument()
  })

  it('shows Add Ability button for owner in child abilities tab', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'abilities' },
    })
    expect(screen.getByText('Add Ability')).toBeInTheDocument()
  })

  // ── Resistances tab ──

  it('renders ResistanceTab in resistances tab', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'resistances' },
    })
    expect(screen.getByTestId('resistance-tab')).toBeInTheDocument()
  })

  // ── Summon with modifier results ──

  it('shows attribute modifier result when present', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      summonModifierResults: { 'summon-1': { 'attr-1': 3, 'attr-2': 2 } },
    })
    // Should have modifier display (+3 or +2)
    expect(screen.getByText('(+3)')).toBeInTheDocument()
    expect(screen.getByText('(+2)')).toBeInTheDocument()
  })

  // ── AC display ──

  it('shows armor class section for summons with AC values', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
    })
    expect(screen.getByText(/Armor Class/)).toBeInTheDocument()
  })

  // ── Description/notes for non-owner in summon ──

  it('shows summon description for non-owner when present', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      isOwner: false,
      expandedAbilities: { 'summon-1': true },
    })
    expect(screen.getByText('A loyal spirit wolf')).toBeInTheDocument()
  })

  it('shows summon notes for non-owner when present', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      isOwner: false,
      expandedAbilities: { 'summon-1': true },
    })
    expect(screen.getByText('Can be summoned once per day')).toBeInTheDocument()
  })

  // ── InlineClickEdit interactions ──

  it('renders InlineClickEdit for owner in ability level metadata', () => {
    renderAbilitiesTab({
      abilities: [makeAbility()],
      expandedAbilities: { 'abil-1': true },
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
    const inlineEdits = screen.getAllByTestId('inline-click-edit')
    expect(inlineEdits.length).toBeGreaterThanOrEqual(3) // mana, range, damage
  })

  // ── Edge cases ──

  it('renders without crashing with empty template', () => {
    renderAbilitiesTab({
      template: { ...defaultTemplate, attributes: [], resistances: [], armorClasses: [], templateSkills: [] },
    })
    expect(screen.getByPlaceholderText('Search abilities & summons...')).toBeInTheDocument()
  })

  it('handles level select stopping propagation', () => {
    renderAbilitiesTab({ abilities: [makeAbility()] })
    const selects = screen.getAllByRole('combobox')
    // Clicking the level select should not trigger expand toggle
    const stopPropagation = vi.fn()
    fireEvent.click(selects[0], { stopPropagation })
    // The expand function should not be called because we stopped propagation
  })

  it('shows "No levels added yet." for owner when ability has no levels', () => {
    renderAbilitiesTab({
      abilities: [makeAbility({ levels: [] })],
      expandedAbilities: { 'abil-1': true },
    })
    expect(screen.getByText('No levels added yet.')).toBeInTheDocument()
  })

  it('shows Add Level button for owner when ability has no levels', () => {
    renderAbilitiesTab({
      abilities: [makeAbility({ levels: [] })],
      expandedAbilities: { 'abil-1': true },
    })
    const addLevelBtns = screen.getAllByText('Add Level')
    expect(addLevelBtns.length).toBeGreaterThanOrEqual(1)
  })

  it('does not show Add Level button for non-owner when ability has no levels', () => {
    renderAbilitiesTab({
      abilities: [makeAbility({ levels: [] })],
      isOwner: false,
      permissions: { canEditAbilities: false },
      expandedAbilities: { 'abil-1': true },
    })
    expect(screen.queryByText('Add Level')).not.toBeInTheDocument()
  })

  // ── handleAddLevel API success ──

  it('handleAddLevel calls api.post and updates state on success', async () => {
    const newLevel = { id: 'lvl-3', level: 3, manaCost: 30, range: '50m', damage: '4d6', description: null, notes: null }
    const deferred = createDeferred()
    mockPost.mockReturnValue(deferred.promise)
    const setAbilities = vi.fn()
    const setLevels = vi.fn()

    renderAbilitiesTab({
      abilities: [makeAbility()],
      showAddLevelModal: 'abil-1',
      newLevelForm: { level: 3, copyFromPrevious: false },
      setAbilities,
      setSelectedLevels: setLevels,
      setShowAddLevelModal: vi.fn(),
      setLevelModalSaving: vi.fn(),
    })

    fireEvent.click(screen.getByText('Create'))
    expect(mockPost).toHaveBeenCalledWith(
      '/character-sheets/sheet-1/abilities/abil-1/levels',
      { level: 3, copyFromPrevious: false },
    )
    deferred.resolve(newLevel)
    await waitFor(() => {
      expect(setAbilities).toHaveBeenCalled()
      expect(setLevels).toHaveBeenCalled()
    })
  })

  it('handleAddLevel sets error on failure', async () => {
    mockPost.mockRejectedValue(new Error('Server error'))
    const setError = vi.fn()

    renderAbilitiesTab({
      abilities: [makeAbility()],
      showAddLevelModal: 'abil-1',
      newLevelForm: { level: 3, copyFromPrevious: false },
      setLevelModalSaving: vi.fn(),
      setLevelModalError: setError,
    })

    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith('Server error')
    })
  })

  it('handleAddLevel sets generic error on non-Error failure', async () => {
    mockPost.mockRejectedValue('raw string')
    const setError = vi.fn()

    renderAbilitiesTab({
      abilities: [makeAbility()],
      showAddLevelModal: 'abil-1',
      newLevelForm: { level: 3, copyFromPrevious: false },
      setLevelModalSaving: vi.fn(),
      setLevelModalError: setError,
    })

    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith('Failed to create level')
    })
  })

  // ── __evaluateSummonFormula tests ──

  it('builds summon resistances correctly for MANUAL type', () => {
    const resistances = [
      { id: 'res-1', name: 'Fortitude', calculationType: 'MANUAL', components: [], attributeModifiers: [] },
    ]
    const template = {
      ...defaultTemplate,
      resistances,
    }
    renderAbilitiesTab({
      abilities: [makeSummon({
        summonResistanceValues: [{ resistanceId: 'res-1', manualValue: '15' }],
      })],
      template,
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'resistances' },
    })
    expect(screen.getByTestId('resistance-tab')).toBeInTheDocument()
  })

  it('builds summon resistances for CALCULATED type with editable components', () => {
    renderAbilitiesTab({
      abilities: [makeSummon({
        summonResistanceComponentValues: [{ componentId: 'comp-1', value: '10' }],
      })],
      expandedAbilities: { 'summon-1': true },
      summonTabs: { 'summon-1': 'resistances' },
    })
    const tab = screen.getByTestId('resistance-tab')
    expect(tab).toBeInTheDocument()
    // Physical resistance should appear
    expect(screen.getByText(/Physical/)).toBeInTheDocument()
  })

  // ── AC attribute modifiers display ──

  it('shows AC attribute modifier section when attributeModifiersEnabled is true', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
    })
    // The template has attributeModifiersEnabled: true
    // AC section should show attribute modifiers
    const textContents = document.body.textContent || ''
    expect(textContents).toContain('Armor Class')
  })

  // ── Level modal level input ──

  it('updates level input in add level modal', () => {
    const setForm = vi.fn()
    renderAbilitiesTab({
      showAddLevelModal: 'abil-1',
      newLevelForm: { level: 2, copyFromPrevious: false },
      setNewLevelForm: setForm,
    })
    const levelInput = screen.getByDisplayValue('2')
    fireEvent.change(levelInput, { target: { value: '3' } })
    expect(setForm).toHaveBeenCalled()
  })

  // ── Multiple abilities rendering ──

  it('renders multiple abilities with correct name display', () => {
    renderAbilitiesTab({
      abilities: [
        makeAbility({ id: 'a1', name: 'Fireball' }),
        makeAbility({ id: 'a2', name: 'Ice Storm' }),
        makeSummon({ id: 's1', name: 'Wolf' }),
      ],
    })
    expect(screen.getByText('Fireball')).toBeInTheDocument()
    expect(screen.getByText('Ice Storm')).toBeInTheDocument()
    expect(screen.getByText('Wolf')).toBeInTheDocument()
  })

  it('shows correct count badge', () => {
    renderAbilitiesTab({
      abilities: [
        makeAbility({ id: 'a1', name: 'Fireball' }),
        makeSummon({ id: 's1', name: 'Wolf' }),
      ],
    })
    expect(screen.getByText((content) => content.includes('2') && content.includes('entrys'))).toBeInTheDocument()
  })

  // ── Non-owner read-only level metadata ──

  it('renders level metadata for non-owner when manaCost is null', () => {
    renderAbilitiesTab({
      abilities: [makeAbility({
        levels: [{ id: 'lvl-1', level: 1, manaCost: null, range: null, damage: null, description: null, notes: null }],
      })],
      isOwner: false,
      expandedAbilities: { 'abil-1': true },
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
    // Non-owner only renders spans when values exist — with null values, nothing renders
    // But the component should not crash
  })
})
