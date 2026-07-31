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

vi.mock('@/components/character-sheet/SummonResourceCard', () => ({
  SummonResourceCard: ({ ability, attributeDisplays, acResult, permissions }: {
    ability: { id: string; name: string; description?: string | null; notes?: string | null }
    attributeDisplays: Array<{ key: string; name: string; value: string; modifier: number | null; attributeId: string }>
    acResult: number | null
    permissions: { canEditAbilities: boolean }
  }) => (
    <div data-testid="summon-resource-card">
      <div data-testid="resource-card-ability-id">{ability.id}</div>
      <div data-testid="resource-card-ability-name">{ability.name}</div>
      <div data-testid="resource-card-ac">{acResult !== null && acResult !== undefined ? acResult : 'null'}</div>
      <div data-testid="resource-card-attr-count">{attributeDisplays.length}</div>
      {attributeDisplays.map(ad => (
        <div key={ad.attributeId} data-testid={`attr-display-${ad.attributeId}`}>
          {ad.key}: {ad.value} (mod: {ad.modifier !== null && ad.modifier !== undefined ? ad.modifier : 'null'})
        </div>
      ))}
      <div data-testid="resource-card-can-edit">{String(permissions.canEditAbilities)}</div>
      {ability.description?.trim() && (
        <div data-testid="resource-card-description">{ability.description}</div>
      )}
      {ability.notes?.trim() && (
        <div data-testid="resource-card-notes">{ability.notes}</div>
      )}
    </div>
  ),
}))

// ── Import component under test (after mocks) ──

import { AbilitiesTab, evaluateSummonFormula } from '@/components/character-sheet/AbilitiesTab'

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
    summonSkills: [],
    summonAcValues: [],
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
    summonSkills: [],
    summonAcValues: [
      { id: 'acv-1', value: '12' },
    ],
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
const defaultSaveSummonHealth = vi.fn()
const defaultHandleAddSummonSkill = vi.fn()
const defaultHandleRemoveSummonSkill = vi.fn()
const defaultHandleUpdateSummonSkill = vi.fn()
const defaultHandleCreateSummonAbility = vi.fn()
const defaultSummonModifierResults = {}
const defaultSummonAcResults = {}

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
    saveSummonHealth: defaultSaveSummonHealth,
    handleAddSummonSkill: defaultHandleAddSummonSkill,
    handleRemoveSummonSkill: defaultHandleRemoveSummonSkill,
    handleUpdateSummonSkill: defaultHandleUpdateSummonSkill,
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
    renderAbilitiesTab({ abilities: [makeAbility()], searchQuery: 'zzz' })
    expect(screen.getByText('No entries match your search.')).toBeInTheDocument()
  })

  it('does not show search empty state when searchQuery is empty and no abilities', () => {
    renderAbilitiesTab({ searchQuery: '' })
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
    renderAbilitiesTab({
      abilities: [makeAbility()],
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
    // Badge + Select trigger both display "Level 1"
    expect(screen.getAllByText('Level 1').length).toBeGreaterThanOrEqual(1)
  })

  it('renders level select dropdown for abilities with levels', async () => {
    const user = userEvent.setup()
    renderAbilitiesTab({ abilities: [makeAbility()] })
    await user.click(screen.getAllByRole('combobox')[0])
    expect(screen.getByRole('option', { name: 'Level 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Level 2' })).toBeInTheDocument()
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
    const createBtn = screen.getByText('Create')
    fireEvent.click(createBtn)
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

  it('changes selected level when level select changes', async () => {
    const setLevels = vi.fn()
    renderAbilitiesTab({
      abilities: [makeAbility()],
      setSelectedLevels: setLevels,
    })
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(screen.getByRole('option', { name: 'Level 2' }))
    // Component uses a functional updater: setSelectedLevels(prev => ({ ...prev, [a.id]: val }))
    expect(setLevels).toHaveBeenCalled()
    const updater = setLevels.mock.calls[0][0]
    expect(updater({ 'abil-1': 'lvl-1' })).toEqual({ 'abil-1': 'lvl-2' })
  })

  it('selects last level by default when no selection exists', () => {
    renderAbilitiesTab({
      abilities: [makeAbility()],
      selectedLevels: {},
    })
    expect(screen.getAllByText('Level 2').length).toBeGreaterThanOrEqual(1)
  })

  // ── SummonResourceCard integration ──

  it('renders SummonResourceCard when summon expanded', () => {
    renderAbilitiesTab({ abilities: [makeSummon()], expandedAbilities: { 'summon-1': true } })
    const card = screen.getByTestId('summon-resource-card')
    expect(card).toBeInTheDocument()
  })

  it('does not render SummonResourceCard when summon not expanded', () => {
    renderAbilitiesTab({ abilities: [makeSummon()], expandedAbilities: {} })
    expect(screen.queryByTestId('summon-resource-card')).not.toBeInTheDocument()
  })

  it('does not render SummonResourceCard for ability type (not summon)', () => {
    renderAbilitiesTab({ abilities: [makeAbility()], expandedAbilities: { 'abil-1': true } })
    expect(screen.queryByTestId('summon-resource-card')).not.toBeInTheDocument()
  })

  it('passes correct ability id to SummonResourceCard', () => {
    renderAbilitiesTab({ abilities: [makeSummon()], expandedAbilities: { 'summon-1': true } })
    expect(screen.getByTestId('resource-card-ability-id').textContent).toBe('summon-1')
  })

  it('passes correct acResult to SummonResourceCard', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      summonAcResults: { 'summon-1': 18 },
    })
    expect(screen.getByTestId('resource-card-ac').textContent).toBe('18')
  })

  it('passes null acResult when no result in summonAcResults', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      summonAcResults: {},
    })
    expect(screen.getByTestId('resource-card-ac').textContent).toBe('null')
  })

  it('passes correct attribute displays from summonAttributes and template', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
    })
    expect(screen.getByTestId('resource-card-attr-count').textContent).toBe('2')
    expect(screen.getByTestId('attr-display-attr-1')).toBeInTheDocument()
    expect(screen.getByTestId('attr-display-attr-1').textContent).toContain('str')
    expect(screen.getByTestId('attr-display-attr-1').textContent).toContain('14')
    expect(screen.getByTestId('attr-display-attr-2')).toBeInTheDocument()
    expect(screen.getByTestId('attr-display-attr-2').textContent).toContain('dex')
    expect(screen.getByTestId('attr-display-attr-2').textContent).toContain('12')
  })

  it('passes modifier results computed from summonModifierResults', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      summonModifierResults: { 'summon-1': { 'attr-1': 7, 'attr-2': 6 } },
    })
    expect(screen.getByTestId('attr-display-attr-1').textContent).toContain('mod: 7')
    expect(screen.getByTestId('attr-display-attr-2').textContent).toContain('mod: 6')
  })

  it('passes null modifier when no modifier result exists', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
      summonModifierResults: {},
    })
    expect(screen.getByTestId('attr-display-attr-1').textContent).toContain('mod: null')
    expect(screen.getByTestId('attr-display-attr-2').textContent).toContain('mod: null')
  })

  it('passes empty attributeDisplays when no summonAttributes', () => {
    renderAbilitiesTab({
      abilities: [makeSummon({ summonAttributes: [] })],
      expandedAbilities: { 'summon-1': true },
    })
    expect(screen.getByTestId('resource-card-attr-count').textContent).toBe('0')
  })

  it('passes permissions correctly to SummonResourceCard', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
    })
    expect(screen.getByTestId('resource-card-can-edit').textContent).toBe('true')
  })

  it('passes false permissions for non-owner', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      isOwner: false,
      permissions: { canEditAbilities: false, canEditCharacter: false, canEditInventory: false, canEditPersonalAbilities: false, canEditResistances: false, canEditResources: false, canEditSkills: false, canEditStory: false, canEditProfessionalSkills: false },
      expandedAbilities: { 'summon-1': true },
    })
    expect(screen.getByTestId('resource-card-can-edit').textContent).toBe('false')
  })

  // ── Description/notes for summon ──

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

  // ── Child abilities (always visible, no longer behind a tab) ──

  it('shows child abilities heading and no abilities message', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
    })
    expect(screen.getByText('Abilities')).toBeInTheDocument()
    expect(screen.getByText('No abilities yet.')).toBeInTheDocument()
  })

  it('renders child abilities', () => {
    const childAbility = makeAbility({ id: 'child-1', name: 'Bite', levels: [{ id: 'cl-1', level: 1, manaCost: 5, range: 'melee', damage: '1d4', description: 'A sharp bite', notes: null }] })
    renderAbilitiesTab({
      abilities: [makeSummon({ childAbilities: [childAbility] })],
      expandedAbilities: { 'summon-1': true },
    })
    expect(screen.getByText('Bite')).toBeInTheDocument()
  })

  it('shows Add Ability button for owner', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      expandedAbilities: { 'summon-1': true },
    })
    expect(screen.getByText('Add Ability')).toBeInTheDocument()
  })

  it('hides Add Ability button for non-owner', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      isOwner: false,
      permissions: { canEditAbilities: false, canEditCharacter: false, canEditInventory: false, canEditPersonalAbilities: false, canEditResistances: false, canEditResources: false, canEditSkills: false, canEditStory: false, canEditProfessionalSkills: false },
      expandedAbilities: { 'summon-1': true },
    })
    expect(screen.queryByText('Add Ability')).not.toBeInTheDocument()
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
    const stopPropagation = vi.fn()
    fireEvent.click(selects[0], { stopPropagation })
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

  // ── Edge cases and multiple abilities ──

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

  it('renders level metadata for non-owner when manaCost is null', () => {
    renderAbilitiesTab({
      abilities: [makeAbility({
        levels: [{ id: 'lvl-1', level: 1, manaCost: null, range: null, damage: null, description: null, notes: null }],
      })],
      isOwner: false,
      expandedAbilities: { 'abil-1': true },
      selectedLevels: { 'abil-1': 'lvl-1' },
    })
  })

  it('includes SummonResourceCard when summon is expanded with child abilities', () => {
    const childAbility = makeAbility({ id: 'child-1', name: 'Bite', levels: [{ id: 'cl-1', level: 1, manaCost: 5, range: 'melee', damage: '1d4', description: null, notes: null }] })
    renderAbilitiesTab({
      abilities: [makeSummon({ childAbilities: [childAbility] })],
      expandedAbilities: { 'summon-1': true },
    })
    // SummonResourceCard renders, child abilities appear below
    expect(screen.getByTestId('summon-resource-card')).toBeInTheDocument()
    expect(screen.getByText('Bite')).toBeInTheDocument()
  })

  it('handles summon with no summonAcValues gracefully', () => {
    renderAbilitiesTab({
      abilities: [makeSummon({ summonAcValues: [] })],
      expandedAbilities: { 'summon-1': true },
    })
    // SummonResourceCard should still render, ac result is null
    expect(screen.getByTestId('summon-resource-card')).toBeInTheDocument()
    expect(screen.getByTestId('resource-card-ac').textContent).toBe('null')
  })

  it('handles summon with no health gracefully', () => {
    renderAbilitiesTab({
      abilities: [makeSummon({ summonHealth: null })],
      expandedAbilities: { 'summon-1': true },
    })
    // SummonResourceCard should still render with null health
    expect(screen.getByTestId('summon-resource-card')).toBeInTheDocument()
  })

  it('handles summon with no description or notes for non-owner', () => {
    renderAbilitiesTab({
      abilities: [makeSummon({ description: null, notes: null })],
      isOwner: false,
      permissions: { canEditAbilities: false, canEditCharacter: false, canEditInventory: false, canEditPersonalAbilities: false, canEditResistances: false, canEditResources: false, canEditSkills: false, canEditStory: false, canEditProfessionalSkills: false },
      expandedAbilities: { 'summon-1': true },
    })
    // Should render without crashing, no description/notes shown
    expect(screen.getByTestId('summon-resource-card')).toBeInTheDocument()
  })

  it('renders non-owner summon view without edit features', () => {
    renderAbilitiesTab({
      abilities: [makeSummon()],
      isOwner: false,
      permissions: { canEditAbilities: false, canEditCharacter: false, canEditInventory: false, canEditPersonalAbilities: false, canEditResistances: false, canEditResources: false, canEditSkills: false, canEditStory: false, canEditProfessionalSkills: false },
      expandedAbilities: { 'summon-1': true },
    })
    // SummonResourceCard renders with canEdit=false
    expect(screen.getByTestId('summon-resource-card')).toBeInTheDocument()
    expect(screen.getByTestId('resource-card-can-edit').textContent).toBe('false')
    // Description and notes visible
    expect(screen.getByText('A loyal spirit wolf')).toBeInTheDocument()
    expect(screen.getByText('Can be summoned once per day')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════════════════
// evaluateSummonFormula
// ════════════════════════════════════════════════════════════════

describe('evaluateSummonFormula', () => {
  // ── Basic arithmetic ──

  it('evaluates addition: 5 + 3 = 8', () => {
    expect(evaluateSummonFormula('5 + 3', {})).toBe(8)
  })

  it('evaluates subtraction: 10 - 3 = 7', () => {
    expect(evaluateSummonFormula('10 - 3', {})).toBe(7)
  })

  it('evaluates multiplication: 4 * 5 = 20', () => {
    expect(evaluateSummonFormula('4 * 5', {})).toBe(20)
  })

  it('evaluates division: 10 / 2 = 5', () => {
    expect(evaluateSummonFormula('10 / 2', {})).toBe(5)
  })

  it('evaluates modulo: 10 % 3 = 1', () => {
    expect(evaluateSummonFormula('10 % 3', {})).toBe(1)
  })

  // ── Operator precedence ──

  it('respects multiplication precedence: 5 + 3 * 2 = 11', () => {
    expect(evaluateSummonFormula('5 + 3 * 2', {})).toBe(11)
  })

  it('respects division precedence: 10 - 6 / 2 = 7', () => {
    expect(evaluateSummonFormula('10 - 6 / 2', {})).toBe(7)
  })

  it('respects modulo precedence: 10 + 8 % 3 = 12', () => {
    expect(evaluateSummonFormula('10 + 8 % 3', {})).toBe(12)
  })

  // ── Parentheses ──

  it('evaluates parentheses: (5 + 3) * 2 = 16', () => {
    expect(evaluateSummonFormula('(5 + 3) * 2', {})).toBe(16)
  })

  it('evaluates nested parentheses: ((2 + 3) * (4 + 1)) = 25', () => {
    expect(evaluateSummonFormula('((2 + 3) * (4 + 1))', {})).toBe(25)
  })

  // ── Unary operators ──

  it('evaluates unary minus: -5 + 3 = -2', () => {
    expect(evaluateSummonFormula('-5 + 3', {})).toBe(-2)
  })

  it('evaluates double unary minus: --5 = 5', () => {
    expect(evaluateSummonFormula('--5', {})).toBe(5)
  })

  it('evaluates unary plus: +5 = 5', () => {
    expect(evaluateSummonFormula('+5', {})).toBe(5)
  })

  it('evaluates unary minus with parentheses: -(5 + 3) = -8', () => {
    expect(evaluateSummonFormula('-(5 + 3)', {})).toBe(-8)
  })

  // ── Exponentiation ──

  it('evaluates exponentiation: 2 ** 3 = 8', () => {
    expect(evaluateSummonFormula('2 ** 3', {})).toBe(8)
  })

  it('evaluates exponentiation with caret: 2 ^ 3 = 8', () => {
    expect(evaluateSummonFormula('2 ^ 3', {})).toBe(8)
  })

  it('evaluates right-associative exponentiation: 2 ** 2 ** 3 = 256', () => {
    expect(evaluateSummonFormula('2 ** 2 ** 3', {})).toBe(256)
  })

  it('handles exponentiation precedence: 2 * 3 ** 2 = 18', () => {
    expect(evaluateSummonFormula('2 * 3 ** 2', {})).toBe(18)
  })

  // ── Math functions ──

  it('evaluates floor: floor(7 / 2) = 3', () => {
    expect(evaluateSummonFormula('floor(7 / 2)', {})).toBe(3)
  })

  it('evaluates ceil: ceil(7 / 2) = 4', () => {
    expect(evaluateSummonFormula('ceil(7 / 2)', {})).toBe(4)
  })

  it('evaluates round: round(3.5) = 4', () => {
    expect(evaluateSummonFormula('round(3.5)', {})).toBe(4)
  })

  it('evaluates round down: round(3.4) = 3', () => {
    expect(evaluateSummonFormula('round(3.4)', {})).toBe(3)
  })

  it('evaluates min: min(5, 10) = 5', () => {
    expect(evaluateSummonFormula('min(5, 10)', {})).toBe(5)
  })

  it('evaluates max: max(5, 10) = 10', () => {
    expect(evaluateSummonFormula('max(5, 10)', {})).toBe(10)
  })

  it('evaluates abs: abs(-5) = 5', () => {
    expect(evaluateSummonFormula('abs(-5)', {})).toBe(5)
  })

  it('evaluates abs with positive: abs(5) = 5', () => {
    expect(evaluateSummonFormula('abs(5)', {})).toBe(5)
  })

  // ── Nested functions ──

  it('evaluates nested functions: floor(max(5, 10) / 2) = 5', () => {
    expect(evaluateSummonFormula('floor(max(5, 10) / 2)', {})).toBe(5)
  })

  it('evaluates deeply nested functions: ceil(floor(3.7)) = 3', () => {
    expect(evaluateSummonFormula('ceil(floor(3.7))', {})).toBe(3)
  })

  it('evaluates functions with expression arguments: max(3 + 2, 4 * 2) = 8', () => {
    expect(evaluateSummonFormula('max(3 + 2, 4 * 2)', {})).toBe(8)
  })

  it('evaluates min with three arguments: min(10, 5, 8) = 5', () => {
    expect(evaluateSummonFormula('min(10, 5, 8)', {})).toBe(5)
  })

  // ── Variable substitution ──

  it('substitutes a single variable: value / 2 with {value: 10} = 5', () => {
    expect(evaluateSummonFormula('value / 2', { value: 10 })).toBe(5)
  })

  it('substitutes multiple variables: str + dex with {str: 10, dex: 8} = 18', () => {
    expect(evaluateSummonFormula('str + dex', { str: 10, dex: 8 })).toBe(18)
  })

  it('uses variable in function: floor(value / 2) with {value: 18} = 9', () => {
    expect(evaluateSummonFormula('floor(value / 2)', { value: 18 })).toBe(9)
  })

  it('treats unknown identifiers as 0', () => {
    expect(evaluateSummonFormula('unknown + 5', {})).toBe(5)
  })

  // ── Edge cases ──

  it('returns 0 for empty formula', () => {
    expect(evaluateSummonFormula('', {})).toBe(0)
  })

  it('returns 0 for whitespace-only formula', () => {
    expect(evaluateSummonFormula('   ', {})).toBe(0)
  })

  it('returns 0 for division by zero', () => {
    expect(evaluateSummonFormula('10 / 0', {})).toBe(0)
  })

  it('returns 0 for modulo by zero', () => {
    expect(evaluateSummonFormula('10 % 0', {})).toBe(0)
  })

  it('returns 0 for completely invalid formula', () => {
    expect(evaluateSummonFormula('abc @@@ def', {})).toBe(0)
  })

  it('tolerates trailing operator: 5 + = 5', () => {
    expect(evaluateSummonFormula('5 +', {})).toBe(5)
  })

  it('tolerates missing closing paren: (5 + 3 = 8', () => {
    expect(evaluateSummonFormula('(5 + 3', {})).toBe(8)
  })

  it('tolerates unclosed function call: floor(5 = 5', () => {
    expect(evaluateSummonFormula('floor(5', {})).toBe(5)
  })

  it('handles decimal numbers: 3.5 + 1.5 = 5', () => {
    expect(evaluateSummonFormula('3.5 + 1.5', {})).toBe(5)
  })

  it('handles negative result: 3 - 10 = -7', () => {
    expect(evaluateSummonFormula('3 - 10', {})).toBe(-7)
  })

  // ── Complex formulas typical in templates ──

  it('evaluates formula with mixed operators: 2 * (3 + 4) / 2 = 7', () => {
    expect(evaluateSummonFormula('2 * (3 + 4) / 2', {})).toBe(7)
  })

  it('evaluates complex formula with variable and function: floor((value - 10) / 2) + 5 with {value: 18} = 9', () => {
    expect(evaluateSummonFormula('floor((value - 10) / 2) + 5', { value: 18 })).toBe(9)
  })

  it('evaluates same formula as template default: floor(value / 2) with {value: 15} = 7', () => {
    expect(evaluateSummonFormula('floor(value / 2)', { value: 15 })).toBe(7)
  })

  it('evaluates chained arithmetic: 1 + 2 + 3 + 4 + 5 = 15', () => {
    expect(evaluateSummonFormula('1 + 2 + 3 + 4 + 5', {})).toBe(15)
  })

  it('evaluates chained multiplication: 2 * 3 * 4 = 24', () => {
    expect(evaluateSummonFormula('2 * 3 * 4', {})).toBe(24)
  })

  it('returns 0 for NaN result from Math function', () => {
    expect(evaluateSummonFormula('min()', {})).toBe(0)
  })

  it('handles multiple spaces and formatting:   5   +   3   ', () => {
    expect(evaluateSummonFormula('   5   +   3   ', {})).toBe(8)
  })

  it('evaluates formula with decimal in variable context: value * 1.5 with {value: 10} = 15', () => {
    expect(evaluateSummonFormula('value * 1.5', { value: 10 })).toBe(15)
  })
})
