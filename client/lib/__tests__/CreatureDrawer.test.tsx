import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { CreatureDrawer } from '@/components/adventure/CreatureDrawer'

/* ── Mock @/lib/api ── */

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/lib/api', () => {
  const API_URL = 'https://mythrion-dev.up.railway.app/api'
  return { api: mockApi, API_URL, authFetch: (input: any, init?: any) => fetch(input, init) }
})

/* ── Mock NumericInput as a simple <input>, stripping component-only props ── */

vi.mock('@/components/shared/NumericInput', () => ({
  NumericInput: ({ value, onChange, placeholder, className, wrapperClassName, inputClassName, ...rest }: any) => (
    <input
      type="text"
      data-testid="numeric-input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      {...rest}
    />
  ),
}))

/* ── Helpers ── */

function mockAbility(overrides: Record<string, any> = {}): any {
  return {
    id: 'ability-1',
    name: 'Goblin Scout',
    type: 'creature',
    description: 'A sneaky goblin scout',
    notes: null,
    sheetId: 'sheet-1',
    summonAttributes: [
      { id: 'sa-str', abilityId: 'ability-1', attributeId: 'attr-str', value: '14' },
      { id: 'sa-dex', abilityId: 'ability-1', attributeId: 'attr-dex', value: '16' },
    ],
    summonAcValues: [],
    summonAcAttributeValues: [],
    summonHealth: null,
    summonResistanceValues: [],
    summonResistanceComponentValues: [],
    summonSkills: [],
    childAbilities: [],
    levels: [],
    ...overrides,
  }
}

function mockTemplate(overrides: Record<string, any> = {}): any {
  return {
    id: 'tpl-1',
    name: 'Goblin Template',
    description: 'A template for goblin-type creatures',
    attributeModifierFormula: 'floor(({value} - 10) / 2)',
    skillFormula: null,
    attributes: [
      { id: 'attr-str', key: 'str', name: 'Strength' },
      { id: 'attr-dex', key: 'dex', name: 'Dexterity' },
    ],
    templateFields: [],
    templateSkills: [],
    skillModifierProfiles: [],
    coreResources: [],
    armorClasses: [],
    characterSections: [],
    resistances: [],
    ...overrides,
  }
}

function mockSheet(overrides: Record<string, any> = {}): any {
  return {
    id: 'sheet-1',
    templateId: 'tpl-1',
    adventureId: 'adv-1',
    ...overrides,
  }
}

function mockChildAbility(overrides: Record<string, any> = {}): any {
  return {
    id: 'child-1',
    name: 'Sneak Attack',
    description: 'Deals extra damage when unseen',
    notes: null,
    levels: [],
    ...overrides,
  }
}

/**
 * Setup a successful load scenario.
 * - api.get('/character-sheets/{id}') returns the sheet
 * - api.get('/adventures/{advId}/templates/{tplId}') returns the template
 * - api.get('/character-sheets/{id}/resistances') returns []
 * - api.post('/formula/evaluate') returns { result: 2 }
 */
function setupSuccessfulLoad(
  template?: any,
  sheet?: any,
  resistances: any[] = [],
  formulaResult: any = { result: 2 },
) {
  const tpl = template ?? mockTemplate()
  const sht = sheet ?? mockSheet()
  mockApi.get.mockImplementation((path: string) => {
    if (path.includes('templates')) return Promise.resolve(tpl)
    if (path.includes('resistances')) return Promise.resolve(resistances)
    return Promise.resolve(sht)
  })
  mockApi.post.mockImplementation((path: string) => {
    if (path.includes('/formula/evaluate')) return Promise.resolve(formulaResult)
    return Promise.resolve({})
  })
  return { tpl, sht }
}

const defaultProps = {
  ability: null as any,
  sheetId: 'sheet-1',
  onClose: vi.fn(),
  onUpdate: vi.fn(),
}

function findCloseButton() {
  // The close button has no aria-label; find it by its SVG X icon path
  return Array.from(document.querySelectorAll('button')).find(btn => {
    const svg = btn.querySelector('svg')
    return svg && svg.innerHTML.includes('M6 18L18 6M6 6l12 12')
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  })
})

/* ── Tests ── */

describe('CreatureDrawer', () => {
  /* ── 1. Null ability ── */
  describe('Null ability', () => {
    it('returns null when ability is null', () => {
      const { container } = render(
        <CreatureDrawer {...defaultProps} ability={null} />,
      )
      expect(container.innerHTML).toBe('')
    })

    it('returns null when ability is null even with sheetId', () => {
      const { container } = render(
        <CreatureDrawer {...defaultProps} ability={null} sheetId="sheet-1" />,
      )
      expect(container.innerHTML).toBe('')
      expect(mockApi.get).not.toHaveBeenCalled()
    })
  })

  /* ── 2. Loading skeleton ── */
  describe('Loading state', () => {
    it('does not show attribute sections until template resolves', async () => {
      let resolveTemplate!: (value: any) => void
      const templatePromise = new Promise(resolve => { resolveTemplate = resolve })

      mockApi.get.mockImplementation((path: string) => {
        if (path.includes('templates')) return templatePromise
        if (path.includes('resistances')) return Promise.resolve([])
        return Promise.resolve(mockSheet())
      })

      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      // Template-dependent sections should not render while template is loading
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Creature name')).toBeInTheDocument()
      })
      expect(screen.queryByText('Attributes')).not.toBeInTheDocument()

      await act(async () => {
        resolveTemplate(mockTemplate())
      })

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument()
      })
    })
  })

  /* ── 3. Header ── */
  describe('Header', () => {
    it('renders header with name input, avatar, save button, and NPC badge', async () => {
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Creature name')).toBeInTheDocument()
      })

      const nameInput = screen.getByPlaceholderText('Creature name') as HTMLInputElement
      expect(nameInput.value).toBe('Goblin Scout')

      expect(screen.getByText('NPC')).toBeInTheDocument()

      const avatarImg = document.querySelector('img')
      expect(avatarImg).toBeInTheDocument()
      expect(avatarImg!.getAttribute('src')).toContain('/images/abilities/ability-1/avatar')

      const fileInput = document.querySelector('input[type="file"]')
      expect(fileInput).toBeInTheDocument()

      expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument()
    })

    it('renders the name input with ability name', async () => {
      setupSuccessfulLoad()
      const ability = mockAbility({ name: 'Shadow Wolf' })
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText('Creature name') as HTMLInputElement
        expect(nameInput.value).toBe('Shadow Wolf')
      })
    })
  })

  /* ── 4. MOB badge ── */
  describe('Badges', () => {
    it('renders MOB badge when notes start with [MOB]', async () => {
      setupSuccessfulLoad()
      const ability = mockAbility({ notes: '[MOB] A group of goblin scouts' })
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('MOB')).toBeInTheDocument()
      })

      expect(screen.queryByText('NPC')).not.toBeInTheDocument()

      // The textarea shows displayNotes (stripped [MOB] prefix)
      const notesTextarea = screen.getByPlaceholderText('GM notes...') as HTMLTextAreaElement
      expect(notesTextarea.value).toBe('A group of goblin scouts')
    })

    it('shows NPC badge when notes do not start with [MOB]', async () => {
      setupSuccessfulLoad()
      const ability = mockAbility({ notes: 'Just some notes' })
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('NPC')).toBeInTheDocument()
      })
      expect(screen.queryByText('MOB')).not.toBeInTheDocument()
    })

    it('shows empty string in notes textarea when notes is null without MOB', async () => {
      setupSuccessfulLoad()
      const ability = mockAbility({ notes: null })
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        const notesTextarea = screen.getByPlaceholderText('GM notes...') as HTMLTextAreaElement
        expect(notesTextarea.value).toBe('')
      })
    })

    it('notes textarea displays stripped [MOB] text and internal state includes prefix', async () => {
      setupSuccessfulLoad()
      const ability = mockAbility({ notes: '[MOB] Pack of wolves' })
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('MOB')).toBeInTheDocument()
      })

      const notesTextarea = screen.getByPlaceholderText('GM notes...') as HTMLTextAreaElement
      expect(notesTextarea.value).toBe('Pack of wolves')

      // Note: the textarea value is bound to displayNotes (derived from ability.notes),
      // not to the notes state. After typing, displayNotes won't change visually,
      // but the notes state is updated internally. The save handler sends the
      // updated notes including the [MOB] prefix. We verify the save flow instead.

      // Verify on save that the internal notes state includes [MOB] prefix
      mockApi.patch.mockResolvedValue({})

      fireEvent.change(notesTextarea, { target: { value: 'Lone wolf' } })

      // Click save
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /Save/i }))
      })

      await waitFor(() => {
        // When saved, notes should include the [MOB] prefix
        expect(mockApi.patch).toHaveBeenCalledWith(
          '/character-sheets/sheet-1/abilities/ability-1',
          expect.objectContaining({
            notes: '[MOB] Lone wolf',
          }),
        )
      })
    })
  })

  /* ── 5. Health section ── */
  describe('Health section', () => {
    it('renders health section with current HP, max HP, and HP notes inputs', async () => {
      const ability = mockAbility({
        summonHealth: {
          id: 'sh-1',
          abilityId: 'ability-1',
          current: 30,
          maximum: 50,
          notes: 'Has temp HP',
        },
      })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Health')).toBeInTheDocument()
      })

      // Health uses NumericInput — find by data-testid
      const numericInputs = screen.getAllByTestId('numeric-input')
      expect(numericInputs.length).toBeGreaterThanOrEqual(2)

      expect((numericInputs[0] as HTMLInputElement).value).toBe('30')
      expect((numericInputs[1] as HTMLInputElement).value).toBe('50')

      const hpNotesInput = screen.getByDisplayValue('Has temp HP')
      expect(hpNotesInput).toBeInTheDocument()
    })

    it('renders health section with null current and max HP values', async () => {
      const ability = mockAbility({
        summonHealth: {
          id: 'sh-1',
          abilityId: 'ability-1',
          current: null,
          maximum: null,
          notes: null,
        },
      })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Health')).toBeInTheDocument()
      })

      const numericInputs = screen.getAllByTestId('numeric-input')
      expect(numericInputs.length).toBeGreaterThanOrEqual(2)
      expect((numericInputs[0] as HTMLInputElement).value).toBe('')
      expect((numericInputs[1] as HTMLInputElement).value).toBe('')

      // HP notes placeholder
      const hpNotesInput = screen.getByPlaceholderText(/temp HP/) as HTMLInputElement
      expect(hpNotesInput.value).toBe('')
    })

    it('renders health section when summonHealth is null', async () => {
      const ability = mockAbility({ summonHealth: null })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Health')).toBeInTheDocument()
      })

      const numericInputs = screen.getAllByTestId('numeric-input')
      expect((numericInputs[0] as HTMLInputElement).value).toBe('')
      expect((numericInputs[1] as HTMLInputElement).value).toBe('')
    })

    it('updates HP current value when user types', async () => {
      const ability = mockAbility({
        summonHealth: {
          id: 'sh-1',
          abilityId: 'ability-1',
          current: 30,
          maximum: 50,
          notes: '',
        },
      })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Health')).toBeInTheDocument()
      })

      const numericInputs = screen.getAllByTestId('numeric-input')
      const currentHpInput = numericInputs[0]

      await act(async () => {
        fireEvent.change(currentHpInput, { target: { value: '35' } })
      })

      expect((currentHpInput as HTMLInputElement).value).toBe('35')

      expect((numericInputs[1] as HTMLInputElement).value).toBe('50')
    })

    it('clears HP current when user types empty string', async () => {
      const ability = mockAbility({
        summonHealth: {
          id: 'sh-1',
          abilityId: 'ability-1',
          current: 30,
          maximum: 50,
          notes: '',
        },
      })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Health')).toBeInTheDocument()
      })

      const numericInputs = screen.getAllByTestId('numeric-input')
      const currentHpInput = numericInputs[0]

      await act(async () => {
        fireEvent.change(currentHpInput, { target: { value: '' } })
      })

      expect((currentHpInput as HTMLInputElement).value).toBe('')
    })
  })

  /* ── 6. Attributes section ── */
  describe('Attributes section', () => {
    it('renders attributes section with computed modifiers', async () => {
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Attributes')).toBeInTheDocument()
      })

      expect(screen.getByText('Strength')).toBeInTheDocument()
      expect(screen.getByText('Dexterity')).toBeInTheDocument()

      // Attribute values are rendered as plain inputs (not NumericInput)
      const strInput = screen.getByDisplayValue('14') as HTMLInputElement
      expect(strInput).toBeInTheDocument()
      const dexInput = screen.getByDisplayValue('16') as HTMLInputElement
      expect(dexInput).toBeInTheDocument()

      await waitFor(() => {
        const plus2Elements = screen.getAllByText('+2')
        expect(plus2Elements.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('renders attribute names after template resolves', async () => {
      let resolveTemplate!: (value: any) => void
      const templatePromise = new Promise(resolve => { resolveTemplate = resolve })

      mockApi.get.mockImplementation((path: string) => {
        if (path.includes('templates')) return templatePromise
        if (path.includes('resistances')) return Promise.resolve([])
        return Promise.resolve(mockSheet())
      })

      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Creature name')).toBeInTheDocument()
      })

      expect(screen.queryByText('Strength')).not.toBeInTheDocument()

      await act(async () => {
        resolveTemplate(mockTemplate())
      })

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument()
        expect(screen.getByText('Dexterity')).toBeInTheDocument()
      })
    })

    it('updates attribute value when user types', async () => {
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByDisplayValue('14')).toBeInTheDocument()
      })

      const strInput = screen.getByDisplayValue('14')

      await act(async () => {
        fireEvent.change(strInput, { target: { value: '18' } })
      })

      expect((strInput as HTMLInputElement).value).toBe('18')
    })
  })

  /* ── 7. Armor Class section ── */
  describe('Armor Class section', () => {
    it('renders AC section with the ability AC value', async () => {
      const ability = mockAbility({
        summonAcValues: [{ id: 'acv-1', abilityId: 'ability-1', value: '17' }],
      })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Armor Class')).toBeInTheDocument()
      })

      expect(screen.getByText('AC')).toBeInTheDocument()

      const acInput = screen.getByDisplayValue('17') as HTMLInputElement
      expect(acInput).toBeInTheDocument()
    })

    it('renders AC section with default value when template has no armorClasses', async () => {
      const template = mockTemplate({ armorClasses: [] })
      setupSuccessfulLoad(template)
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Armor Class')).toBeInTheDocument()
      })

      expect(screen.getByText('AC')).toBeInTheDocument()
      expect(screen.getByDisplayValue('10')).toBeInTheDocument()
    })

    it('saves the AC value via the summon-ac endpoint', async () => {
      const ability = mockAbility({
        summonAcValues: [{ id: 'acv-1', abilityId: 'ability-1', value: '17' }],
      })
      mockApi.patch.mockResolvedValue({})
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Save/i }))
      })

      await waitFor(() => {
        expect(mockApi.patch).toHaveBeenCalledWith(
          '/character-sheets/sheet-1/abilities/ability-1/summon-ac',
          { value: '17' },
        )
      })
    })
  })

  /* ── 8. Resistances section ── */
  // Note: the current CreatureDrawer has no Resistances section — the template's
  // resistances are no longer rendered. The previous section-level tests were
  // removed; the "Sections visibility" tests below still assert "Resistances"
  // never renders.

  /* ── 9. Skills section ── */
  describe('Skills section', () => {
    it('renders skills section with manual values', async () => {
      const ability = mockAbility({
        summonSkills: [
          { id: 'ss-stealth', name: 'Stealth', manualValue: 4 },
          { id: 'ss-acrobatics', name: 'Acrobatics', manualValue: -1 },
        ],
      })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Skills')).toBeInTheDocument()
      })

      expect(screen.getByText('Stealth')).toBeInTheDocument()
      expect(screen.getByText('+4')).toBeInTheDocument()
      expect(screen.getByText('Acrobatics')).toBeInTheDocument()
      expect(screen.getByText('-1')).toBeInTheDocument()
    })
  })

  /* ── 10-11. Child abilities ── */
  describe('Child abilities', () => {
    it('renders child abilities list', async () => {
      const childAbilities = [
        mockChildAbility({ id: 'child-1', name: 'Sneak Attack' }),
        mockChildAbility({ id: 'child-2', name: 'Poison Blade' }),
      ]
      const ability = mockAbility({ childAbilities })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })

      // Child ability name inputs have placeholder="Ability name"
      const nameInputs = screen.getAllByDisplayValue(/Sneak Attack|Poison Blade/)
      expect(nameInputs).toHaveLength(2)
    })

    it('shows empty state message when no child abilities', async () => {
      const ability = mockAbility({ childAbilities: [] })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })

      expect(screen.getByText('No abilities defined yet.')).toBeInTheDocument()
    })

    it('does not show empty state message when Add Ability form is visible', async () => {
      const ability = mockAbility({ childAbilities: [] })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Add Ability'))
      })

      expect(screen.queryByText('No abilities defined yet.')).not.toBeInTheDocument()

      // The Add Ability form's name input
      expect(screen.getByPlaceholderText('Ability name')).toBeInTheDocument()
    })
  })

  /* ── 12. Close on overlay click ── */
  describe('Close behavior', () => {
    it('calls onClose when overlay is clicked', async () => {
      const onClose = vi.fn()
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
          onClose={onClose}
        />,
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Creature name')).toBeInTheDocument()
      })

      const overlay = document.querySelector('.fixed.inset-0.z-50')
      expect(overlay).toBeInTheDocument()

      fireEvent.click(overlay!)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when close button in header is clicked', async () => {
      const onClose = vi.fn()
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
          onClose={onClose}
        />,
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Creature name')).toBeInTheDocument()
      })

      const closeBtn = findCloseButton()
      expect(closeBtn).toBeTruthy()
      fireEvent.click(closeBtn!)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  /* ── 13. Save button ── */
  describe('Save functionality', () => {
    beforeEach(() => {
      // Mock formula evaluation separately
      mockApi.post.mockResolvedValue({ result: 2 })
    })

    it('calls onUpdate when save button is clicked and all API calls succeed', async () => {
      const onUpdate = vi.fn()
      mockApi.patch.mockResolvedValue({})
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
          onUpdate={onUpdate}
        />,
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Save/i }))
      })

      await waitFor(() => {
        expect(mockApi.patch).toHaveBeenCalled()
      })

      expect(onUpdate).toHaveBeenCalledTimes(1)
    })

    it('shows saving spinner while save is in progress', async () => {
      let resolvePatch!: (value: any) => void
      const patchPromise = new Promise(resolve => { resolvePatch = resolve })

      mockApi.patch.mockReturnValue(patchPromise)
      setupSuccessfulLoad()

      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Save/i }))

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument()
      })

      await act(async () => { resolvePatch({}) })
    })

    it('calls api.patch for ability metadata on save', async () => {
      mockApi.patch.mockResolvedValue({})
      setupSuccessfulLoad()

      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Save/i }))
      })

      await waitFor(() => {
        expect(mockApi.patch).toHaveBeenCalledWith(
          '/character-sheets/sheet-1/abilities/ability-1',
          expect.objectContaining({
            name: 'Goblin Scout',
          }),
        )
      })
    })

    it('calls api.patch for health data on save', async () => {
      const ability = mockAbility({
        summonHealth: {
          id: 'sh-1',
          abilityId: 'ability-1',
          current: 30,
          maximum: 50,
          notes: 'Temp HP active',
        },
      })
      mockApi.patch.mockResolvedValue({})
      setupSuccessfulLoad()

      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Save/i }))
      })

      await waitFor(() => {
        expect(mockApi.patch).toHaveBeenCalledWith(
          '/character-sheets/sheet-1/abilities/ability-1/summon-health',
          expect.objectContaining({
            current: 30,
            maximum: 50,
            notes: 'Temp HP active',
          }),
        )
      })
    })

    it('calls api.patch for attribute values on save', async () => {
      mockApi.patch.mockResolvedValue({})
      setupSuccessfulLoad()

      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Save/i }))
      })

      await waitFor(() => {
        expect(mockApi.patch).toHaveBeenCalledWith(
          '/character-sheets/sheet-1/abilities/ability-1/summon-attributes/attr-str',
          { value: '14' },
        )
        expect(mockApi.patch).toHaveBeenCalledWith(
          '/character-sheets/sheet-1/abilities/ability-1/summon-attributes/attr-dex',
          { value: '16' },
        )
      })
    })

    it('calls onUpdate exactly once after a complete save', async () => {
      const onUpdate = vi.fn()
      mockApi.patch.mockResolvedValue({})
      setupSuccessfulLoad()

      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
          onUpdate={onUpdate}
        />,
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Save/i }))
      })

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledTimes(1)
      })
    })
  })

  /* ── 14. Avatar upload ── */
  describe('Avatar upload', () => {
    it('calls fetch with POST when a file is selected', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
      global.fetch = fetchMock

      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Creature name')).toBeInTheDocument()
      })

      const fileInput = document.querySelector('input[type="file"]')!
      expect(fileInput).toBeInTheDocument()

      const file = new File(['avatar-data'], 'avatar.png', { type: 'image/png' })

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/images/abilities/ability-1/avatar'),
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('does not upload when no file is selected', async () => {
      const fetchMock = vi.fn()
      global.fetch = fetchMock

      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Creature name')).toBeInTheDocument()
      })

      const fileInput = document.querySelector('input[type="file"]')!
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [] } })
      })

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('shows uploading spinner while avatar upload is in progress', async () => {
      let resolveFetch!: (value: any) => void
      const fetchPromise = new Promise(resolve => { resolveFetch = resolve })
      global.fetch = vi.fn().mockReturnValue(fetchPromise)

      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Creature name')).toBeInTheDocument()
      })

      const fileInput = document.querySelector('input[type="file"]')!
      const file = new File(['avatar-data'], 'avatar.png', { type: 'image/png' })

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      const spinner = document.querySelector('svg.animate-spin')
      expect(spinner).toBeInTheDocument()

      await act(async () => { resolveFetch({ ok: true, json: async () => ({}) }) })
    })

    it('handles avatar upload error silently', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Upload failed'))

      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Creature name')).toBeInTheDocument()
      })

      const fileInput = document.querySelector('input[type="file"]')!
      const file = new File(['avatar-data'], 'avatar.png', { type: 'image/png' })

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      expect(screen.getByPlaceholderText('Creature name')).toBeInTheDocument()
    })
  })

  /* ── 15. Child ability create form ── */
  describe('Child ability create', () => {
    it('shows the create form when Add Ability button is clicked', async () => {
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Add Ability'))
      })

      // The form renders its own inputs — only one with "Ability name" since childAbilities is []
      expect(screen.getByPlaceholderText('Ability name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('What does this ability do?')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('MP')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('e.g. 30ft')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('e.g. 2d6')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('e.g. 1')).toBeInTheDocument()

      expect(screen.getByText('Create Ability')).toBeInTheDocument()
      // Both the toggle button (" Cancel") and the form Cancel button render
      expect(screen.getAllByText('Cancel').length).toBeGreaterThanOrEqual(1)
    })

    it('calls api.post when create form is submitted with required name', async () => {
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Add Ability'))
      })

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText('Ability name'), { target: { value: 'Fire Breath' } })
        fireEvent.change(screen.getByPlaceholderText('What does this ability do?'), { target: { value: 'Breathes fire' } })
        fireEvent.change(screen.getByPlaceholderText('MP'), { target: { value: '5' } })
        fireEvent.change(screen.getByPlaceholderText('e.g. 30ft'), { target: { value: '15ft' } })
        fireEvent.change(screen.getByPlaceholderText('e.g. 2d6'), { target: { value: '3d6' } })
        fireEvent.change(screen.getByPlaceholderText('e.g. 1'), { target: { value: '2' } })
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Create Ability'))
      })

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith(
          '/character-sheets/sheet-1/abilities/ability-1/summon-abilities',
          expect.objectContaining({
            name: 'Fire Breath',
            description: 'Breathes fire',
            manaCost: 5,
            range: '15ft',
            damage: '3d6',
          }),
        )
      })
    })

    it('does not submit when name is empty', async () => {
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Add Ability'))
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Create Ability'))
      })

      // Wait a tick to let any pending effects resolve
      await waitFor(() => {
        // Formula evaluation calls post during load, so check specifically for summon-abilities
        const createCalls = mockApi.post.mock.calls.filter(
          call => call[0]?.includes('/summon-abilities'),
        )
        expect(createCalls).toHaveLength(0)
      })
    })

    it('creates initial level when level field is filled', async () => {
      setupSuccessfulLoad()
      mockApi.post.mockImplementation((path: string) => {
        if (path.includes('/formula/evaluate')) return Promise.resolve({ result: 2 })
        if (path.includes('/summon-abilities')) return Promise.resolve({ id: 'new-child-1', name: 'Fire Breath', levels: [] })
        if (path.includes('/levels')) return Promise.resolve({ id: 'lvl-1', abilityId: 'new-child-1', level: '2', manaCost: null, range: null, description: null, notes: null, damage: null })
        return Promise.resolve({})
      })
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Add Ability'))
      })
      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText('Ability name'), { target: { value: 'Fire Breath' } })
        fireEvent.change(screen.getByPlaceholderText('e.g. 1'), { target: { value: '2' } })
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Create Ability'))
      })

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith(
          '/character-sheets/sheet-1/abilities/ability-1/summon-abilities',
          expect.objectContaining({ name: 'Fire Breath' }),
        )
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/character-sheets/sheet-1/abilities/new-child-1/levels',
        expect.objectContaining({ level: '2', copyFromPrevious: false }),
      )
    })

    it('shows error message when create fails', async () => {
      setupSuccessfulLoad()
      mockApi.post.mockImplementation((path: string) => {
        if (path.includes('/formula/evaluate')) return Promise.resolve({ result: 2 })
        return Promise.reject(new Error('Failed to create ability'))
      })
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Add Ability'))
      })

      await act(async () => {
        fireEvent.change(screen.getByPlaceholderText('Ability name'), { target: { value: 'Fire Breath' } })
      })

      await act(async () => {
        fireEvent.click(screen.getByText('Create Ability'))
      })

      await waitFor(() => {
        expect(screen.getByText('Failed to create ability')).toBeInTheDocument()
      })
    })

    it('shows "Creating..." on submit button while creating', async () => {
      let resolvePost!: (value: any) => void
      setupSuccessfulLoad()
      mockApi.post.mockImplementation((path: string) => {
        if (path.includes('/formula/evaluate')) return Promise.resolve({ result: 2 })
        return new Promise(resolve => { resolvePost = resolve })
      })
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })
      await act(async () => { fireEvent.click(screen.getByText('Add Ability')) })
      await act(async () => { fireEvent.change(screen.getByPlaceholderText('Ability name'), { target: { value: 'Fire Breath' } }) })

      await act(async () => {
        fireEvent.click(screen.getByText('Create Ability'))
      })

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument()
      })

      await act(async () => { resolvePost({ id: 'new-child', name: 'Fire Breath', levels: [] }) })
    })

    it('closes the form when Cancel is clicked', async () => {
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })

      await act(async () => { fireEvent.click(screen.getByText('Add Ability')) })
      expect(screen.getByPlaceholderText('Ability name')).toBeInTheDocument()

      // Click the form's Cancel button (second match: toggle shows " Cancel", form has "Cancel")
      await act(async () => { fireEvent.click(screen.getAllByText('Cancel')[1]) })

      expect(screen.queryByPlaceholderText('Ability name')).not.toBeInTheDocument()
    })

    it('toggles showNewChildAbility when Add Ability / Cancel is clicked', async () => {
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })

      await act(async () => { fireEvent.click(screen.getByText('Add Ability')) })
      expect(screen.getByPlaceholderText('Ability name')).toBeInTheDocument()

      // Click the toggle Cancel button (first match)
      await act(async () => { fireEvent.click(screen.getAllByText('Cancel')[0]) })
      expect(screen.queryByPlaceholderText('Ability name')).not.toBeInTheDocument()
    })
  })

  /* ── 16. Child ability delete ── */
  describe('Child ability delete', () => {
    it('calls api.delete when delete button on a child ability is clicked', async () => {
      mockApi.delete.mockResolvedValue({})

      const childAbilities = [
        mockChildAbility({ id: 'child-1', name: 'Sneak Attack' }),
      ]
      const ability = mockAbility({ childAbilities })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })

      const deleteBtn = screen.getByLabelText('Delete Sneak Attack')
      expect(deleteBtn).toBeInTheDocument()

      await act(async () => {
        fireEvent.click(deleteBtn)
      })

      expect(mockApi.delete).toHaveBeenCalledWith(
        '/character-sheets/sheet-1/abilities/child-1',
      )
    })

    it('removes the child ability from the list after delete succeeds', async () => {
      mockApi.delete.mockResolvedValue({})

      const childAbilities = [
        mockChildAbility({ id: 'child-1', name: 'Sneak Attack' }),
        mockChildAbility({ id: 'child-2', name: 'Poison Blade' }),
      ]
      const ability = mockAbility({ childAbilities })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })

      // Find child ability inputs by their display value
      expect(screen.getByDisplayValue('Sneak Attack')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Poison Blade')).toBeInTheDocument()

      const deleteBtn = screen.getByLabelText('Delete Sneak Attack')
      await act(async () => {
        fireEvent.click(deleteBtn)
      })

      expect(screen.queryByDisplayValue('Sneak Attack')).not.toBeInTheDocument()
      expect(screen.getByDisplayValue('Poison Blade')).toBeInTheDocument()
    })

    it('handles delete error silently', async () => {
      mockApi.delete.mockRejectedValue(new Error('Delete failed'))

      const childAbilities = [
        mockChildAbility({ id: 'child-1', name: 'Sneak Attack' }),
      ]
      const ability = mockAbility({ childAbilities })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })

      const deleteBtn = screen.getByLabelText('Delete Sneak Attack')
      await act(async () => {
        fireEvent.click(deleteBtn)
      })

      expect(screen.getByText('Abilities')).toBeInTheDocument()
    })
  })

  /* ── 17. No AC/skills/resistances when empty ── */
  describe('Sections visibility', () => {
    it('does not render skills or resistances sections when template has none', async () => {
      const template = mockTemplate({
        armorClasses: [],
        templateSkills: [],
        resistances: [],
      })
      setupSuccessfulLoad(template)
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Attributes')).toBeInTheDocument()
      })

      // The single manual AC input always renders; skills/resistances never do
      expect(screen.getByText('Armor Class')).toBeInTheDocument()
      expect(screen.queryByText('Resistances')).not.toBeInTheDocument()
      expect(screen.queryByText('Skills')).not.toBeInTheDocument()

      expect(screen.getByText('Details')).toBeInTheDocument()
      expect(screen.getByText('Health')).toBeInTheDocument()
      expect(screen.getByText('Attributes')).toBeInTheDocument()
      expect(screen.getByText('Abilities')).toBeInTheDocument()
    })

    it('renders AC but not skills or resistances when only AC is present', async () => {
      const template = mockTemplate({
        armorClasses: [
          {
            id: 'ac-main',
            name: 'Main AC',
            enabled: true,
            fields: [
              {
                id: 'field-base',
                name: 'Base',
                key: 'base',
                defaultValue: '10',
                editableByPlayer: false,
                description: null,
              },
            ],
            attributeModifiers: [],
          },
        ],
        templateSkills: [],
        resistances: [],
      })
      setupSuccessfulLoad(template)
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Armor Class')).toBeInTheDocument()
      })

      expect(screen.queryByText('Resistances')).not.toBeInTheDocument()
      expect(screen.queryByText('Skills')).not.toBeInTheDocument()
    })

    it('does not render a Resistances section even when the template has resistances', async () => {
      const template = mockTemplate({
        armorClasses: [],
        templateSkills: [],
        resistances: [
          {
            id: 'res-fire',
            name: 'Fire',
            calculationType: 'MANUAL',
            order: 0,
            components: [],
            attributeModifiers: [],
          },
        ],
      })
      setupSuccessfulLoad(template, undefined, [
        { resistanceId: 'res-fire', name: 'Fire', calculationType: 'MANUAL', total: 0 },
      ])
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Attributes')).toBeInTheDocument()
      })

      expect(screen.queryByText('Resistances')).not.toBeInTheDocument()
      expect(screen.getByText('Armor Class')).toBeInTheDocument()
      expect(screen.queryByText('Skills')).not.toBeInTheDocument()
    })
  })

  /* ── 18. Edge cases ── */
  describe('Edge cases', () => {
    it('handles null/null health values gracefully', async () => {
      const ability = mockAbility({
        summonHealth: {
          id: 'sh-1',
          abilityId: 'ability-1',
          current: null,
          maximum: null,
          notes: null,
        },
      })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Health')).toBeInTheDocument()
      })

      const numericInputs = screen.getAllByTestId('numeric-input')
      expect(numericInputs.length).toBeGreaterThanOrEqual(2)
      expect((numericInputs[0] as HTMLInputElement).value).toBe('')
      expect((numericInputs[1] as HTMLInputElement).value).toBe('')

      const hpNotesInput = screen.getByPlaceholderText(/temp HP/) as HTMLInputElement
      expect(hpNotesInput.value).toBe('')
    })

    it('handles save errors gracefully without crashing', async () => {
      mockApi.patch.mockRejectedValue(new Error('Network error'))
      setupSuccessfulLoad()

      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Save/i }))
      })

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Creature name')).toBeInTheDocument()
      })
    })

    it('handles empty description and notes fields', async () => {
      const ability = mockAbility({
        description: null,
        notes: null,
      })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Creature name')).toBeInTheDocument()
      })

      const descTextarea = screen.getByPlaceholderText(/Brief description/) as HTMLTextAreaElement
      expect(descTextarea.value).toBe('')

      const notesTextarea = screen.getByPlaceholderText('GM notes...') as HTMLTextAreaElement
      expect(notesTextarea.value).toBe('')
    })

    it('handles template fetch failure gracefully', async () => {
      mockApi.get.mockImplementation((path: string) => {
        if (path.includes('templates')) return Promise.reject(new Error('Template fetch failed'))
        if (path.includes('resistances')) return Promise.resolve([])
        return Promise.resolve(mockSheet())
      })
      mockApi.post.mockResolvedValue({ result: 2 })

      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Creature name')).toBeInTheDocument()
      })

      expect(screen.queryByText('Attributes')).not.toBeInTheDocument()

      expect(screen.getByText('Details')).toBeInTheDocument()
      expect(screen.getByText('Health')).toBeInTheDocument()
      expect(screen.getByText('Abilities')).toBeInTheDocument()
    })

    it('handles attribute values that are not numbers gracefully', async () => {
      const ability = mockAbility({
        summonAttributes: [
          { id: 'sa-str', abilityId: 'ability-1', attributeId: 'attr-str', value: '' },
          { id: 'sa-dex', abilityId: 'ability-1', attributeId: 'attr-dex', value: 'abc' },
        ],
      })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Attributes')).toBeInTheDocument()
      })

      // Find inputs by their parent attribute labels
      expect(screen.getByText('Strength')).toBeInTheDocument()
      expect(screen.getByText('Dexterity')).toBeInTheDocument()

      // There are multiple empty inputs; use getAllByDisplayValue and check length
      const emptyInputs = screen.getAllByDisplayValue('')
      expect(emptyInputs.length).toBeGreaterThanOrEqual(1)

      const abcInput = screen.getByDisplayValue('abc')
      expect(abcInput).toBeInTheDocument()
    })

    it('renders details section with description and notes textareas', async () => {
      const ability = mockAbility({
        description: 'A sneaky goblin scout',
        notes: 'Some GM notes',
      })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Details')).toBeInTheDocument()
      })

      const descTextarea = screen.getByPlaceholderText(/Brief description/) as HTMLTextAreaElement
      expect(descTextarea.value).toBe('A sneaky goblin scout')

      const notesTextarea = screen.getByPlaceholderText('GM notes...') as HTMLTextAreaElement
      expect(notesTextarea.value).toBe('Some GM notes')
    })

    it('updates description when user types in textarea', async () => {
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={mockAbility()}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Details')).toBeInTheDocument()
      })

      const descTextarea = screen.getByPlaceholderText(/Brief description/) as HTMLTextAreaElement

      await act(async () => {
        fireEvent.change(descTextarea, { target: { value: 'Updated description' } })
      })

      expect(descTextarea.value).toBe('Updated description')
    })

    it('updates description and notes textareas visually when user types', async () => {
      setupSuccessfulLoad()
      const ability = mockAbility({ notes: 'Some GM notes' })
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Details')).toBeInTheDocument()
      })

      const notesTextarea = screen.getByPlaceholderText('GM notes...') as HTMLTextAreaElement
      expect(notesTextarea.value).toBe('Some GM notes')

      mockApi.patch.mockResolvedValue({})

      await act(async () => {
        fireEvent.change(notesTextarea, { target: { value: 'Updated notes' } })
      })

      // The textarea value updates visually since displayNotes now uses local state
      await waitFor(() => {
        expect(notesTextarea.value).toBe('Updated notes')
      })

      // Clicking save sends the updated internal state
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Save/i }))
      })

      await waitFor(() => {
        expect(mockApi.patch).toHaveBeenCalledWith(
          '/character-sheets/sheet-1/abilities/ability-1',
          expect.objectContaining({
            notes: 'Updated notes',
          }),
        )
      })
    })

    it('renders child ability with levels when expanded', async () => {
      const childAbilities = [
        {
          id: 'child-1',
          name: 'Sneak Attack',
          description: 'Extra damage',
          notes: null,
          levels: [
            { id: 'lvl-1', abilityId: 'child-1', level: '1', manaCost: 2, range: '5ft', description: 'Basic sneak', notes: null, damage: '1d6' },
          ],
        },
      ]
      const ability = mockAbility({ childAbilities })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer
          {...defaultProps}
          ability={ability}
          sheetId="sheet-1"
        />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })

      // Find the expand/collapse chevron button by its SVG path
      const expandBtn = Array.from(document.querySelectorAll('button')).find(btn => {
        const svg = btn.querySelector('svg')
        return svg && svg.innerHTML.includes('M9 5l7 7-7 7')
      })
      expect(expandBtn).not.toBeNull()

      fireEvent.click(expandBtn!)

      await waitFor(() => {
        expect(screen.getByText('Levels')).toBeInTheDocument()
      })

      const descTextarea = screen.getByPlaceholderText('Ability description...') as HTMLTextAreaElement
      expect(descTextarea.value).toBe('Extra damage')
    })
  })

  /* ── 19. User interaction coverage (targeted function coverage) ── */
  describe('User interaction coverage', () => {
    it('updates HP max value when user types in max HP input', async () => {
      const ability = mockAbility({
        summonHealth: { id: 'sh-1', abilityId: 'ability-1', current: 30, maximum: 50, notes: '' },
      })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer {...defaultProps} ability={ability} sheetId="sheet-1" />,
      )

      await waitFor(() => {
        expect(screen.getByText('Health')).toBeInTheDocument()
      })

      const numericInputs = screen.getAllByTestId('numeric-input')
      const maxHpInput = numericInputs[1]

      await act(async () => {
        fireEvent.change(maxHpInput, { target: { value: '75' } })
      })

      expect((maxHpInput as HTMLInputElement).value).toBe('75')
    })

    it('updates HP notes when user types in HP notes input', async () => {
      const ability = mockAbility({
        summonHealth: { id: 'sh-1', abilityId: 'ability-1', current: 30, maximum: 50, notes: '' },
      })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer {...defaultProps} ability={ability} sheetId="sheet-1" />,
      )

      await waitFor(() => {
        expect(screen.getByText('Health')).toBeInTheDocument()
      })

      const hpNotesInput = screen.getByPlaceholderText(/temp HP/) as HTMLInputElement
      await act(async () => {
        fireEvent.change(hpNotesInput, { target: { value: 'Has temp HP from spell' } })
      })

      expect(hpNotesInput.value).toBe('Has temp HP from spell')
    })

    it('updates AC field when user types in an AC field input', async () => {
      const template = mockTemplate({
        armorClasses: [
          {
            id: 'ac-main',
            name: 'Main AC',
            enabled: true,
            fields: [
              { id: 'field-base', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: false, description: null },
            ],
            attributeModifiers: [],
          },
        ],
      })
      setupSuccessfulLoad(template)
      render(
        <CreatureDrawer {...defaultProps} ability={mockAbility()} sheetId="sheet-1" />,
      )

      await waitFor(() => {
        expect(screen.getByText('Armor Class')).toBeInTheDocument()
      })

      const baseInput = screen.getByDisplayValue('10') as HTMLInputElement
      await act(async () => {
        fireEvent.change(baseInput, { target: { value: '12' } })
      })

      expect(baseInput.value).toBe('12')
    })


    it('changes creature name, description, notes, and attribute inputs', async () => {
      const ability = mockAbility({
        name: 'Goblin Scout',
        description: 'A sneaky goblin',
        notes: 'GM note',
      })
      const template = mockTemplate()
      setupSuccessfulLoad(template)
      render(
        <CreatureDrawer {...defaultProps} ability={ability} sheetId="sheet-1" />,
      )

      // Wait for sections to render
      await waitFor(() => {
        expect(screen.getByText('Details')).toBeInTheDocument()
      })

      // Creature name (line 599)
      const nameInput = screen.getByDisplayValue('Goblin Scout') as HTMLInputElement
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Goblin Champion' } })
      })
      expect(nameInput.value).toBe('Goblin Champion')

      // Description textarea (line 648)
      const descInput = screen.getByDisplayValue('A sneaky goblin') as HTMLTextAreaElement
      await act(async () => {
        fireEvent.change(descInput, { target: { value: 'A fierce goblin champion' } })
      })
      expect(descInput.value).toBe('A fierce goblin champion')

      // Notes textarea (line 654) — use waitFor since controlled inputs re-render async
      await act(async () => {
        fireEvent.change(screen.getByDisplayValue('GM note'), { target: { value: 'Updated GM note' } })
      })
      await waitFor(() => {
        expect((screen.getByDisplayValue('Updated GM note') as HTMLTextAreaElement).value).toBe('Updated GM note')
      })

      // Attribute input (line 713)
      const attrInputs = screen.getAllByDisplayValue(/^\d+$/) as HTMLInputElement[]
      if (attrInputs.length > 0) {
        await act(async () => {
          fireEvent.change(attrInputs[0], { target: { value: '18' } })
        })
        expect(attrInputs[0].value).toBe('18')
      }
    })

    it('opens, fills, and cancels the new child ability form', async () => {
      setupSuccessfulLoad()
      render(
        <CreatureDrawer {...defaultProps} ability={mockAbility()} sheetId="sheet-1" />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })

      // Click "Add Ability" (line 849)
      const addBtn = screen.getByText(/Add Ability/)
      await act(async () => {
        fireEvent.click(addBtn)
      })

      // Fill in form fields
      const nameInput = screen.getByPlaceholderText('Ability name') as HTMLInputElement
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Fireball' } })
      })
      expect(nameInput.value).toBe('Fireball')

      const descInput = screen.getByPlaceholderText(/What does this ability/) as HTMLTextAreaElement
      await act(async () => {
        fireEvent.change(descInput, { target: { value: 'A fiery explosion' } })
      })
      expect(descInput.value).toBe('A fiery explosion')

      // Click "Cancel" (line 910) — pick the form's Cancel button (second match)
      const cancelBtns = screen.getAllByText('Cancel')
      const formCancelBtn = cancelBtns[cancelBtns.length - 1]
      await act(async () => {
        fireEvent.click(formCancelBtn)
      })
    })

    it('edits child ability name and description inline', async () => {
      const childAbilities: any[] = [
        {
          id: 'child-1',
          name: 'Sneak Attack',
          description: 'Extra damage when unseen',
          notes: null,
          levels: [
            { id: 'lvl-1', abilityId: 'child-1', level: '1', manaCost: 2, range: '5ft', description: 'Basic', notes: null, damage: '1d6' },
          ],
        },
      ]
      const ability = mockAbility({ childAbilities })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer {...defaultProps} ability={ability} sheetId="sheet-1" />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })
      await waitFor(() => {
        expect(screen.getByDisplayValue('Sneak Attack')).toBeInTheDocument()
      })

      // Edit child ability name inline (line 936 → saveChildAbilityField)
      const nameInput = screen.getByDisplayValue('Sneak Attack') as HTMLInputElement
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Backstab' } })
      })
      expect(nameInput.value).toBe('Backstab')

      // Expand the child ability
      const expandBtn = Array.from(document.querySelectorAll('button')).find(btn => {
        const svg = btn.querySelector('svg')
        return svg && svg.innerHTML.includes('M9 5l7 7-7 7')
      })
      expect(expandBtn).not.toBeNull()
      await act(async () => {
        fireEvent.click(expandBtn!)
      })

      await waitFor(() => {
        expect(screen.getByText('Levels')).toBeInTheDocument()
      })

      // Edit child ability description (line 951 → saveChildAbilityField)
      const descTextarea = screen.getByDisplayValue('Extra damage when unseen') as HTMLTextAreaElement
      await act(async () => {
        fireEvent.change(descTextarea, { target: { value: 'Deals massive extra damage' } })
      })
      expect(descTextarea.value).toBe('Deals massive extra damage')
    })

    it('interacts with child ability level fields', async () => {
      const childAbilities: any[] = [
        {
          id: 'child-1',
          name: 'Sneak Attack',
          description: 'Extra damage',
          notes: null,
          levels: [
            { id: 'lvl-1', abilityId: 'child-1', level: '1', manaCost: 2, range: '5ft', description: 'Basic', notes: null, damage: '1d6' },
          ],
        },
      ]
      const ability = mockAbility({ childAbilities })
      setupSuccessfulLoad()
      render(
        <CreatureDrawer {...defaultProps} ability={ability} sheetId="sheet-1" />,
      )

      await waitFor(() => {
        expect(screen.getByText('Abilities')).toBeInTheDocument()
      })

      // Expand the child ability
      const expandBtn = Array.from(document.querySelectorAll('button')).find(btn => {
        const svg = btn.querySelector('svg')
        return svg && svg.innerHTML.includes('M9 5l7 7-7 7')
      })
      expect(expandBtn).not.toBeNull()
      await act(async () => {
        fireEvent.click(expandBtn!)
      })

      await waitFor(() => {
        expect(screen.getByText('Levels')).toBeInTheDocument()
      })

      // Edit level fields (handleSaveLevelField)
      // Level number input (line 972) — change to a value that won't collide with manaCost's '2'
      const lvlInput = screen.getByDisplayValue('1') as HTMLInputElement
      await act(async () => {
        fireEvent.change(lvlInput, { target: { value: '3' } })
      })
      expect(lvlInput.value).toBe('3')

      // Mana cost input (line 986)
      const mpInput = screen.getByDisplayValue('2') as HTMLInputElement
      await act(async () => {
        fireEvent.change(mpInput, { target: { value: '3' } })
      })
      expect(mpInput.value).toBe('3')

      // Range input (line 992)
      const rangeInput = screen.getByDisplayValue('5ft') as HTMLInputElement
      await act(async () => {
        fireEvent.change(rangeInput, { target: { value: '10ft' } })
      })
      expect(rangeInput.value).toBe('10ft')

      // Damage input (line 998)
      const dmgInput = screen.getByDisplayValue('1d6') as HTMLInputElement
      await act(async () => {
        fireEvent.change(dmgInput, { target: { value: '2d6' } })
      })
      expect(dmgInput.value).toBe('2d6')

      // Level description (line 1003)
      const lvlDescInput = screen.getByDisplayValue('Basic') as HTMLTextAreaElement
      await act(async () => {
        fireEvent.change(lvlDescInput, { target: { value: 'Advanced' } })
      })
      expect(lvlDescInput.value).toBe('Advanced')
    })
  })
})
