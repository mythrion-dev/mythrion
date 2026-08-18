import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

// ── next/navigation (adds useParams; overrides setup.ts) ────────────────────
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'tpl-1' }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// ── next/link ───────────────────────────────────────────────────────────────
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// ── Hoisted mock state (referenced inside vi.mock factories below) ──────────
const h = vi.hoisted(() => {
  return {
    mockPreviewReducer: vi.fn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (state: any, action: any) => (action.type === 'INIT' ? action.payload : state),
    ),
    mockBuildPreviewSheet: vi.fn(),
    mockComputeModifiers: vi.fn(),
    mockComputeSkills: vi.fn(),
    mockComputeAC: vi.fn(),
    mockComputeSummonModifiers: vi.fn(),
    mockComputeSummonAC: vi.fn(),
    mockComputeResistances: vi.fn(),
    mockBuildAdapter: vi.fn(),
    mockBuildPreviewSheetAsCharacterSheet: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    abilitiesTabProps: { current: null as Record<string, any> | null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inventoryTabProps: { current: null as Record<string, any> | null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storyTabProps: { current: null as Record<string, any> | null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    personalAbilitiesTabProps: { current: null as Record<string, any> | null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resistanceTabProps: { current: null as Record<string, any> | null },
  }
})

const {
  mockPreviewReducer,
  mockBuildPreviewSheet,
  mockComputeModifiers,
  mockComputeSkills,
  mockComputeAC,
  mockComputeSummonModifiers,
  mockComputeSummonAC,
  mockComputeResistances,
  mockBuildAdapter,
  mockBuildPreviewSheetAsCharacterSheet,
  abilitiesTabProps,
  inventoryTabProps,
  storyTabProps,
  personalAbilitiesTabProps,
  resistanceTabProps,
} = h

// ── API mock (page uses raw fetch with API_URL) ─────────────────────────────
vi.mock('@/lib/api', () => ({
  API_URL: 'http://test',
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

// ── preview-reducer: spy so tests can assert dispatch types ─────────────────
vi.mock('@/lib/preview-reducer', () => ({ previewReducer: h.mockPreviewReducer }))

// ── build-preview-sheet ─────────────────────────────────────────────────────
vi.mock('@/lib/build-preview-sheet', () => ({ buildPreviewSheet: h.mockBuildPreviewSheet }))

// ── character-sheet-engine ──────────────────────────────────────────────────
vi.mock('@/lib/character-sheet-engine', () => ({
  computeModifiers: (...a: unknown[]) => h.mockComputeModifiers(...a),
  computeSkills: (...a: unknown[]) => h.mockComputeSkills(...a),
  computeAC: (...a: unknown[]) => h.mockComputeAC(...a),
  computeSummonModifiers: (...a: unknown[]) => h.mockComputeSummonModifiers(...a),
  computeSummonAC: (...a: unknown[]) => h.mockComputeSummonAC(...a),
}))

// ── preview-computations ────────────────────────────────────────────────────
vi.mock('@/lib/preview-computations', () => ({
  computeResistances: (...a: unknown[]) => h.mockComputeResistances(...a),
}))

// ── preview-adapter ─────────────────────────────────────────────────────────
vi.mock('@/lib/preview-adapter', () => ({
  buildAdapter: (...a: unknown[]) => h.mockBuildAdapter(...a),
  buildPreviewSheetAsCharacterSheet: (...a: unknown[]) =>
    h.mockBuildPreviewSheetAsCharacterSheet(...a),
}))

// ── PreviewBanner mock ──────────────────────────────────────────────────────
vi.mock('@/components/community/PreviewBanner', () => ({
  PreviewBanner: () => <div data-testid="preview-banner" />,
}))

// ── character-sheet tabs (captured-props stubs) ─────────────────────────────
vi.mock('@/components/character-sheet', () => ({
  CharacterTab: () => <div data-testid="character-tab" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AbilitiesTab: (props: Record<string, any>) => {
    h.abilitiesTabProps.current = props
    return <div data-testid="abilities-tab" />
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InventoryTab: (props: Record<string, any>) => {
    h.inventoryTabProps.current = props
    return <div data-testid="inventory-tab" />
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  StoryTab: (props: Record<string, any>) => {
    h.storyTabProps.current = props
    return <div data-testid="story-tab" />
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PersonalAbilitiesTab: (props: Record<string, any>) => {
    h.personalAbilitiesTabProps.current = props
    return <div data-testid="personal-tab" />
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ResistanceTab: (props: Record<string, any>) => {
    h.resistanceTabProps.current = props
    return <div data-testid="resistance-tab" />
  },
}))

import PreviewPage from '@/app/dashboard/public-templates/[id]/preview/page'

const mockFetch = vi.fn()
const preventDefault = vi.fn()

// ── Fixtures ────────────────────────────────────────────────────────────────
const templateFixture = {
  id: 'tpl-1',
  name: 'Fighter',
  description: 'A fighter',
  campaign: 'D&D',
  attributeModifierFormula: '(STR - 10) / 2',
  attributeModifiersEnabled: true,
  skillFormula: 'floor(STR / 2)',
  attributes: [{ id: 'attr-1', key: 'STR', name: 'Strength' }],
  templateFields: [{ id: 'field-1', key: 'f1', label: 'F1' }],
  templateSkills: [
    {
      id: 'skill-1',
      name: 'Athletics',
      description: null,
      attributeId: null,
      allowedAttributeIds: [],
      defaultAttributeId: null,
      attribute: null,
      defaultAttribute: null,
    },
    {
      id: 'skill-2',
      name: 'Perception',
      description: 'Notice things',
      attributeId: null,
      allowedAttributeIds: [],
      defaultAttributeId: null,
      attribute: null,
      defaultAttribute: null,
    },
  ],
  skillModifierProfiles: [],
  coreResources: [
    { id: 'cr-1', slug: 'hp', displayName: 'Hit Points', enabled: true, editableByPlayer: true, showNotes: false, color: '#ef4444' },
  ],
  armorClasses: [
    {
      id: 'ac-1',
      name: 'AC',
      enabled: true,
      attributeModifiers: [],
      fields: [{ id: 'acf-1', name: 'Armor', key: 'armor', defaultValue: '10', editableByPlayer: true, description: null }],
    },
  ],
  characterSections: [{ id: 'sec-1', name: 'Bio', order: 0 }],
  resistances: [
    {
      id: 'res-1',
      name: 'Fire',
      calculationType: 'MANUAL',
      order: 0,
      components: [{ id: 'rc-1', name: 'Res', editableByPlayer: true, defaultValue: '0', order: 0 }],
      attributeModifiers: [],
    },
  ],
}

const abilitySummon = {
  id: 'ab-1',
  name: 'Summon Wolf',
  type: 'SUMMON',
  description: null,
  notes: null,
  order: 0,
  levels: [],
  summonAttributes: [{ id: 'sa-1', abilityId: 'ab-1', attributeId: 'attr-1', value: '10' }],
  summonAcValues: [],
  summonHealth: { id: 'sh-1', abilityId: 'ab-1', current: 5, maximum: 10, notes: null },
  childAbilities: [],
}

const abilityBasic = {
  id: 'ab-2',
  name: 'Slash',
  type: 'ABILITY',
  description: 'desc',
  notes: null,
  order: 1,
  levels: [],
  summonAttributes: [],
  summonAcValues: [],
  summonHealth: null,
  childAbilities: [],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const previewStateFixture: Record<string, any> = {
  template: templateFixture,
  characterName: 'Aragorn',
  playerName: 'Alice',
  level: 1,
  attributeValues: {},
  fieldValues: {},
  skillValues: {},
  skillAttributes: { 'skill-1': 'attr-1' },
  profileSelections: {},
  activeSkills: {},
  othersValues: {},
  coreResources: {},
  acFieldValues: {},
  acAttributeModifiers: {},
  resistanceComponents: {},
  resistanceManualValues: {},
  abilities: [abilitySummon, abilityBasic],
  inventoryItems: [
    { id: 'item-1', name: 'Sword', weight: 2, cost: '10', description: null, order: 0 },
    { id: 'item-2', name: 'Potion', weight: null, cost: null, description: 'Heals', order: 1 },
  ],
  story: { id: 'preview-story', title: 'Backstory' },
  sectionEntries: [
    { id: 'entry-1', sheetId: 'preview', sectionId: 'sec-1', name: 'Entry', description: 'd', order: 0, section: { id: 'sec-1', name: 'Bio' } },
  ],
  professionalSkills: [],
}

const previewStateNoStory = { ...previewStateFixture, story: null }

const adapterResultFixture = {
  characterTabProps: { sheet: { id: 'preview' }, permissions: {}, sheetId: 'preview' },
  abilities: [abilitySummon, abilityBasic],
  inventoryItems: previewStateFixture.inventoryItems,
  story: previewStateFixture.story,
  sectionEntries: previewStateFixture.sectionEntries,
  professionalSkills: [],
  resistanceData: [
    {
      resistanceId: 'res-1',
      name: 'Fire',
      calculationType: 'MANUAL',
      total: 0,
      componentValues: [{ componentId: 'rc-1', componentName: 'Res', value: 0, editableByPlayer: true }],
      attributeModifierValues: [],
    },
  ],
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function defaultFetchImpl(url: unknown) {
  const u = String(url)
  if (u.includes('/public/templates/')) {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(templateFixture) })
  }
  if (u.includes('/public/formula/evaluate')) {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: 5 }) })
  }
  return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
}

async function renderAndSettle() {
  render(<PreviewPage />)
  await waitFor(() => expect(mockBuildPreviewSheet).toHaveBeenCalled())
  await waitFor(() => expect(screen.queryByText('Loading template...')).not.toBeInTheDocument())
  await waitFor(() => expect(mockComputeModifiers).toHaveBeenCalled())
}

function clickTab(name: string) {
  fireEvent.click(screen.getByRole('button', { name }))
}

beforeEach(() => {
  vi.clearAllMocks()
  abilitiesTabProps.current = null
  inventoryTabProps.current = null
  storyTabProps.current = null
  personalAbilitiesTabProps.current = null
  resistanceTabProps.current = null

  mockFetch.mockReset()
  mockFetch.mockImplementation(defaultFetchImpl)
  vi.stubGlobal('fetch', mockFetch)

  mockBuildPreviewSheet.mockReturnValue(previewStateFixture)
  mockBuildPreviewSheetAsCharacterSheet.mockReturnValue({ id: 'preview' })
  mockBuildAdapter.mockReturnValue(adapterResultFixture)

  mockComputeModifiers.mockResolvedValue({ 'attr-1': 10 })
  mockComputeSkills.mockResolvedValue({ 'skill-1': 5 })
  mockComputeAC.mockReturnValue({})
  mockComputeResistances.mockReturnValue([])
  mockComputeSummonModifiers.mockResolvedValue({ 'summon-attr-1': 5 })
  mockComputeSummonAC.mockReturnValue(12)
})

describe('TemplatePreviewPage (public-templates/[id]/preview)', () => {
  it('shows the loading spinner while the template is being fetched', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}))
    render(<PreviewPage />)
    expect(screen.getByText('Loading template...')).toBeInTheDocument()
  })

  it('keeps the loading spinner when the fetch 404s', async () => {
    mockFetch.mockImplementation(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    render(<PreviewPage />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(screen.getByText('Loading template...')).toBeInTheDocument()
    expect(mockBuildPreviewSheet).not.toHaveBeenCalled()
  })

  it('keeps the loading spinner on a non-404 fetch failure', async () => {
    mockFetch.mockImplementation(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    render(<PreviewPage />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(screen.getByText('Loading template...')).toBeInTheDocument()
  })

  it('handles a fetch rejection that is an Error', async () => {
    mockFetch.mockRejectedValue(new Error('boom'))
    render(<PreviewPage />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(screen.getByText('Loading template...')).toBeInTheDocument()
  })

  it('falls back to the generic message when the fetch rejection is not an Error', async () => {
    mockFetch.mockRejectedValue('oops')
    render(<PreviewPage />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(screen.getByText('Loading template...')).toBeInTheDocument()
  })

  it('shows failed-to-init-preview when the adapter returns null', async () => {
    mockBuildAdapter.mockReturnValue(null)
    render(<PreviewPage />)
    expect(await screen.findByText('Failed to initialize preview.')).toBeInTheDocument()
  })

  it('renders the banner, the character tab and switches through all tabs', async () => {
    await renderAndSettle()

    expect(screen.getByTestId('preview-banner')).toBeInTheDocument()
    expect(screen.getByTestId('character-tab')).toBeInTheDocument()

    // engine + computations all ran during the debounced compute pass
    expect(mockComputeModifiers).toHaveBeenCalled()
    expect(mockComputeSkills).toHaveBeenCalled()
    expect(mockComputeAC).toHaveBeenCalled()
    expect(mockComputeResistances).toHaveBeenCalled()
    expect(mockComputeSummonModifiers).toHaveBeenCalled()
    expect(mockComputeSummonAC).toHaveBeenCalled()

    clickTab('Abilities')
    expect(screen.getByTestId('abilities-tab')).toBeInTheDocument()
    expect(abilitiesTabProps.current?.abilities).toHaveLength(2)

    clickTab('Inventory')
    expect(screen.getByTestId('inventory-tab')).toBeInTheDocument()
    expect(inventoryTabProps.current?.totalWeight).toBe(2)

    clickTab('Story')
    expect(screen.getByTestId('story-tab')).toBeInTheDocument()
    expect(storyTabProps.current?.story?.title).toBe('Backstory')

    clickTab('Personal Abilities')
    expect(screen.getByTestId('personal-tab')).toBeInTheDocument()
    expect(personalAbilitiesTabProps.current?.sections).toHaveLength(1)

    clickTab('Resistances')
    expect(screen.getByTestId('resistance-tab')).toBeInTheDocument()
    expect(resistanceTabProps.current?.resistances).toHaveLength(1)
    expect(resistanceTabProps.current?.disableAttributeModifiers).toBe(false)

    clickTab('Character')
    expect(screen.getByTestId('character-tab')).toBeInTheDocument()
  })

  it('renders with attribute modifiers disabled', async () => {
    const disabledTemplate = { ...templateFixture, attributeModifiersEnabled: false }
    mockBuildPreviewSheet.mockReturnValueOnce({ ...previewStateFixture, template: disabledTemplate })
    await renderAndSettle()
    clickTab('Resistances')
    expect(resistanceTabProps.current?.disableAttributeModifiers).toBe(true)
  })

  it('logs a computation error when the engine throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockComputeModifiers.mockRejectedValue(new Error('compute boom'))
    render(<PreviewPage />)
    await waitFor(() =>
      expect(consoleSpy).toHaveBeenCalledWith('[Preview] Computation error:', expect.any(Error)),
    )
    consoleSpy.mockRestore()
  })

  it('drives the AbilitiesTab create/delete handlers', async () => {
    await renderAndSettle()
    clickTab('Abilities')
    const apt = () => abilitiesTabProps.current!

    // empty-name guard
    await act(async () => {
      await apt().handleCreateAbility({ preventDefault })
    })

    // create an ABILITY with a level
    await act(async () => {
      apt().setNewAbility({
        name: 'Fireball', description: 'd', manaCost: '3', range: '30', notes: 'n',
        damage: '8', level: '2', hpCurrent: '', hpMax: '',
      })
    })
    await waitFor(() => expect(apt().newAbility.name).toBe('Fireball'))
    await act(async () => {
      await apt().handleCreateAbility({ preventDefault })
    })
    expect(mockPreviewReducer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'UPDATE_ABILITIES' }),
    )

    // create a SUMMON ability with hp
    await act(async () => {
      apt().setNewAbilityType('SUMMON')
    })
    await act(async () => {
      apt().setNewAbility({
        name: 'Summon', description: '', manaCost: '', range: '', notes: '', damage: '',
        level: '', hpCurrent: '10', hpMax: '20',
      })
    })
    await waitFor(() => expect(apt().newAbility.name).toBe('Summon'))
    await act(async () => {
      await apt().handleCreateAbility({ preventDefault })
    })

    // delete an ability
    await act(async () => {
      await apt().handleDeleteAbility('ab-2')
    })

    // setAbilities wrapper: functional + value forms
    await act(async () => {
      apt().setAbilities((prev: unknown[]) => [...prev])
    })
    await act(async () => {
      apt().setAbilities([abilitySummon])
    })

    // resetNewAbility
    await act(async () => {
      apt().resetNewAbility()
    })
    await waitFor(() => expect(apt().newAbility.name).toBe(''))
  })

  it('drives the AbilitiesTab summon handlers', async () => {
    await renderAndSettle()
    clickTab('Abilities')
    const apt = () => abilitiesTabProps.current!

    // summon attributes: existing attribute (map) + new attribute (append)
    await act(async () => {
      await apt().saveSummonAttribute('ab-1', 'attr-1', '15')
    })
    await act(async () => {
      await apt().saveSummonAttribute('ab-1', 'attr-2', '8')
    })

    // summon AC: numeric + non-numeric
    await act(async () => {
      await apt().saveSummonAcValue('ab-1', '15')
    })
    await act(async () => {
      await apt().saveSummonAcValue('ab-1', 'abc')
    })

    // summon health: existing object + null fallback
    await act(async () => {
      await apt().saveSummonHealth('ab-1', 'current', 12)
    })
    await act(async () => {
      await apt().saveSummonHealth('ab-2', 'maximum', 20)
    })

    // summon skills: add / update(match) / update(no-match) / remove
    await act(async () => {
      await apt().handleAddSummonSkill('ab-1', 'Howl', 3)
    })
    await act(async () => {
      await apt().handleUpdateSummonSkill('ab-1', 'ss-1', 'Bite', 4)
    })
    await act(async () => {
      await apt().handleUpdateSummonSkill('ab-1', 'nope', 'Bite', 4)
    })
    await act(async () => {
      await apt().handleRemoveSummonSkill('ab-1', 'ss-1')
    })

    // summon resistances: add / update(match) / update(no-match) / remove
    await act(async () => {
      await apt().handleAddSummonResistance('ab-1', 'Fire', '5')
    })
    await act(async () => {
      await apt().handleUpdateSummonResistance('ab-1', 'sr-1', 'Ice', '3')
    })
    await act(async () => {
      await apt().handleUpdateSummonResistance('ab-1', 'nope', 'Ice', '3')
    })
    await act(async () => {
      await apt().handleRemoveSummonResistance('ab-1', 'sr-1')
    })

    // create a child summon ability (empty-name guard first)
    await act(async () => {
      await apt().handleCreateSummonAbility('ab-1', { preventDefault })
    })
    await act(async () => {
      apt().setNewAbility({
        name: 'Child', description: '', manaCost: '', range: '', notes: 'note', damage: '',
        level: '', hpCurrent: '', hpMax: '',
      })
    })
    await waitFor(() => expect(apt().newAbility.name).toBe('Child'))
    await act(async () => {
      await apt().handleCreateSummonAbility('ab-1', { preventDefault })
    })

    expect(mockPreviewReducer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'UPDATE_ABILITIES' }),
    )
  })

  it('drives the InventoryTab handlers', async () => {
    await renderAndSettle()
    clickTab('Inventory')
    const ipt = () => inventoryTabProps.current!

    // empty-name guard
    await act(async () => {
      await ipt().handleCreateItem({ preventDefault })
    })

    // create with all optional fields populated
    await act(async () => {
      ipt().setNewItem({ name: 'Axe', weight: '3.5', cost: '50', description: 'Heavy' })
    })
    await waitFor(() => expect(ipt().newItem.name).toBe('Axe'))
    await act(async () => {
      await ipt().handleCreateItem({ preventDefault })
    })
    expect(mockPreviewReducer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'UPDATE_INVENTORY' }),
    )

    // delete
    await act(async () => {
      await ipt().handleDeleteItem('item-1')
    })

    // saveItemField branches
    await act(async () => {
      await ipt().saveItemField('item-1', 'name', 'Big Axe')
    })
    await act(async () => {
      await ipt().saveItemField('item-1', 'weight', '4')
    })
    await act(async () => {
      await ipt().saveItemField('item-1', 'weight', '')
    })
    await act(async () => {
      await ipt().saveItemField('item-1', 'cost', '60')
    })
    await act(async () => {
      await ipt().saveItemField('item-1', 'cost', '')
    })
    await act(async () => {
      await ipt().saveItemField('item-1', 'description', 'Sharp')
    })
    await act(async () => {
      await ipt().saveItemField('item-1', 'unknown', 'x')
    })

    // resetNewItem
    await act(async () => {
      ipt().resetNewItem()
    })
    await waitFor(() => expect(ipt().newItem.name).toBe(''))
  })

  it('saves story fields when a story already exists', async () => {
    await renderAndSettle()
    clickTab('Story')
    const spt = () => storyTabProps.current!

    await act(async () => {
      await spt().onSaveField('title', 'New Title')
    })
    expect(mockPreviewReducer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'UPDATE_STORY',
        payload: expect.objectContaining({ id: 'preview-story', title: 'New Title' }),
      }),
    )

    // whitespace value coerces to null
    await act(async () => {
      await spt().onSaveField('title', '   ')
    })
    expect(mockPreviewReducer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'UPDATE_STORY', payload: expect.objectContaining({ title: null }) }),
    )
  })

  it('creates a new story object when no story exists', async () => {
    mockBuildPreviewSheet.mockReturnValueOnce(previewStateNoStory)
    await renderAndSettle()
    clickTab('Story')
    const spt = () => storyTabProps.current!

    await act(async () => {
      await spt().onSaveField('title', 'Fresh')
    })
    expect(mockPreviewReducer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'UPDATE_STORY',
        payload: expect.objectContaining({ id: 'preview-story', title: 'Fresh' }),
      }),
    )
  })

  it('drives the PersonalAbilitiesTab handlers', async () => {
    await renderAndSettle()
    clickTab('Personal Abilities')
    const ppt = () => personalAbilitiesTabProps.current!

    // toSingular variants
    expect(ppt().toSingular('abilities')).toBe('ability')
    expect(ppt().toSingular('stats')).toBe('stat')
    expect(ppt().toSingular('status')).toBe('status')
    expect(ppt().toSingular('class')).toBe('class')
    expect(ppt().toSingular('bio')).toBe('bio')

    // create entry (section found)
    await act(async () => {
      ppt().setNewEntryForm({ name: 'New Entry', description: 'Desc' })
    })
    await waitFor(() => expect(ppt().newEntryForm.name).toBe('New Entry'))
    await act(async () => {
      await ppt().handleCreateEntry('sec-1', { preventDefault })
    })

    // create entry (section not found -> fallback section object)
    await act(async () => {
      ppt().setNewEntryForm({ name: 'X', description: '' })
    })
    await waitFor(() => expect(ppt().newEntryForm.name).toBe('X'))
    await act(async () => {
      await ppt().handleCreateEntry('sec-99', { preventDefault })
    })

    // empty-name guard
    await act(async () => {
      ppt().setNewEntryForm({ name: '', description: '' })
    })
    await waitFor(() => expect(ppt().newEntryForm.name).toBe(''))
    await act(async () => {
      await ppt().handleCreateEntry('sec-1', { preventDefault })
    })
    expect(mockPreviewReducer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'UPDATE_SECTION_ENTRIES' }),
    )

    // update (match + no-match)
    await act(async () => {
      await ppt().handleUpdateEntry('entry-1', 'name', 'Renamed')
    })
    await act(async () => {
      await ppt().handleUpdateEntry('nope', 'name', 'x')
    })

    // delete
    await act(async () => {
      await ppt().handleDeleteEntry('entry-1')
    })

    // resetForm
    await act(async () => {
      ppt().resetForm()
    })
    await waitFor(() => expect(ppt().newEntryForm.name).toBe(''))
  })

  it('drives the ResistanceTab handlers', async () => {
    await renderAndSettle()
    clickTab('Resistances')
    const rpt = () => resistanceTabProps.current!

    await act(async () => {
      await rpt().onSaveComponent('rc-1', 5)
    })
    expect(mockPreviewReducer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'SET_RESISTANCE_COMPONENT' }),
    )

    await act(async () => {
      await rpt().onSaveManual('res-1', 3)
    })
    expect(mockPreviewReducer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'SET_RESISTANCE_MANUAL' }),
    )
    await waitFor(() => expect(rpt().sheetResistanceValues['res-1']).toBe('3'))

    // no-op handlers
    await act(async () => {
      rpt().onCreateResistance()
    })
    await act(async () => {
      rpt().onDeleteResistance()
    })
  })
})
