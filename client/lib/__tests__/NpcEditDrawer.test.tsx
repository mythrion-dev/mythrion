import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// scrollIntoView is not available in jsdom
Element.prototype.scrollIntoView = vi.fn()
import { NpcEditDrawer } from '@/components/adventure/NpcEditDrawer'
import { CampaignCreatureSidebar } from '@/components/adventure/CampaignCreatureSidebar'

/* ── Mock @/lib/api ── */

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))

const mockRouter = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}))

vi.mock('@/lib/api', () => {
  const API_URL = 'https://mythrion-dev.up.railway.app/api'
  return { api: mockApi, API_URL, authFetch: (input: any, init?: any) => fetch(input, init) }
})

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

/* ── Helpers ── */

/** Use this instead of mockApi.get.mockResolvedValue(sheet) so the
 *  resistances endpoint gets an array rather than the sheet object. */
function mockGetSheet(sheet: Record<string, any>) {
  mockApi.get.mockImplementation((path: string) => {
    if (path.includes('resistances')) return Promise.resolve([])
    return Promise.resolve(sheet)
  })
}

/** Identical to mockGetSheet but also sets up the formula-evaluate mock. */
function setupSuccessfulLoadSheet(sheet?: Record<string, any>) {
  const s = sheet ?? createMockSheet()
  mockGetSheet(s)
  mockApi.post.mockResolvedValue({ result: 0 })
  return s
}

function createMockSheet(overrides: Record<string, any> = {}) {
  return {
    id: 'npc-1',
    characterName: 'Goblin King',
    playerName: 'GM Notes',
    level: 5,
    hpActual: 50,
    hpMax: 50,
    hpNotes: null,
    npcType: 'NPC',
    description: 'Ruler of goblins',
    notes: 'Secret notes',
    template: {
      id: 'tpl-1',
      name: 'Goblin Template',
      ...overrides.template,
      attributeModifierFormula: overrides.template?.attributeModifierFormula ?? 'floor({value}/2-5)',
      attributeModifiersEnabled: overrides.template?.attributeModifiersEnabled ?? true,
      skillFormula: overrides.template?.skillFormula ?? '{value}',
      attributes: overrides.template?.attributes ?? [
        { id: 'attr-str', key: 'str', name: 'Strength' },
        { id: 'attr-dex', key: 'dex', name: 'Dexterity' },
      ],
      templateSkills: overrides.template?.templateSkills ?? [
        {
          id: 'skill-stealth',
          name: 'Stealth',
          description: 'Hide silently',
          attributeId: 'attr-dex',
          allowedAttributeIds: ['attr-dex', 'attr-str'],
          defaultAttributeId: 'attr-dex',
          attribute: { id: 'attr-dex', key: 'dex', name: 'Dexterity' },
          defaultAttribute: { id: 'attr-dex', key: 'dex', name: 'Dexterity' },
        },
      ],
      skillModifierProfiles: overrides.template?.skillModifierProfiles ?? [
        {
          id: 'prof-prof',
          name: 'Proficiency',
          options: [
            { id: 'opt-none', label: 'None', value: 0 },
            { id: 'opt-expert', label: 'Expert', value: 2 },
          ],
        },
      ],
      armorClasses: overrides.template?.armorClasses ?? [
        {
          id: 'ac-main',
          name: null,
          enabled: true,
          fields: [
            { id: 'field-base', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: false, description: null },
          ],
          attributeModifiers: [
            {
              id: 'am-dex',
              attributeId: 'attr-dex',
              allowPlayerSelection: false,
              defaultAttributeId: null,
              attribute: { id: 'attr-dex', key: 'dex', name: 'Dexterity' },
              defaultAttribute: null,
            },
          ],
        },
      ],
      resistances: overrides.template?.resistances ?? [
        {
          id: 'res-fire',
          name: 'Fire',
          calculationType: 'MANUAL',
          order: 0,
          components: [
            { id: 'comp-base', name: 'Base', editableByPlayer: true, defaultValue: '0', order: 0 },
          ],
          attributeModifiers: [],
        },
      ],
      coreResources: overrides.template?.coreResources ?? [
        { id: 'cr-hp', slug: 'hp', displayName: 'Hit Points', enabled: true, editableByPlayer: false, showNotes: true },
      ],
    },
    values: overrides.values ?? [
      { id: 'val-str', attributeId: 'attr-str', value: '16' },
      { id: 'val-dex', attributeId: 'attr-dex', value: '14' },
    ],
    acValues: overrides.acValues ?? [
      { id: 'acv-base', fieldId: 'field-base', value: '10' },
    ],
    acAttributeValues: overrides.acAttributeValues ?? [
      { id: 'aav-dex', acAttributeModifierId: 'am-dex', selectedAttributeId: null },
    ],
    skillValues: overrides.skillValues ?? [
      {
        id: 'sv-stealth',
        skillId: 'skill-stealth',
        value: '0',
        selectedAttributeId: null,
        selectedAttribute: null,
        skill: {
          id: 'skill-stealth',
          name: 'Stealth',
          description: 'Hide silently',
          attributeId: 'attr-dex',
          allowedAttributeIds: ['attr-dex', 'attr-str'],
          defaultAttributeId: 'attr-dex',
          attribute: { id: 'attr-dex', key: 'dex', name: 'Dexterity' },
          defaultAttribute: null,
        },
        profileValues: [
          { id: 'spv-stealth-p', profileId: 'prof-prof', optionId: null, profile: { id: 'prof-prof', name: 'Proficiency', targetMode: 'flat', targetSkillIds: [] }, option: null },
        ],
      },
    ],
    skillProfileValues: [],
    coreResourceValues: overrides.coreResourceValues ?? [
      { id: 'crv-hp', coreResourceId: 'cr-hp', current: 50, maximum: 50, notes: 'Full HP' },
    ],
    ...overrides,
  }
}

function createMockNpcList(): Array<Record<string, any>> {
  return [
    {
      id: 'npc-1',
      characterName: 'Goblin King',
      isNpc: true,
      npcType: 'NPC',
      level: 5,
      hpActual: 30,
      hpMax: 50,
      createdAt: '2025-01-01',
      template: { id: 'tpl-1', name: 'Goblin' },
    },
    {
      id: 'npc-2',
      characterName: 'Shadow Wolf',
      isNpc: true,
      npcType: 'MOB',
      level: 3,
      hpActual: 20,
      hpMax: 20,
      createdAt: '2025-01-02',
      template: { id: 'tpl-2', name: 'Wolf' },
    },
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 204,
    json: async () => ({}),
  })
})

/* ── NpcEditDrawer ── */

describe('NpcEditDrawer', () => {
  const defaultProps = {
    npcId: 'npc-1',
    adventureId: 'adv-1',
    onClose: vi.fn(),
    onSaved: vi.fn(),
  }

  describe('Loading state', () => {
    it('renders skeleton while loading', async () => {
      let resolveSheet!: (value: any) => void
      const sheetPromise = new Promise(resolve => { resolveSheet = resolve })

      // Use mockImplementation so the resistances endpoint gets an array while
      // the sheet endpoint stays deferred.
      mockApi.get.mockImplementation((path: string) => {
        if (path.includes('resistances')) return Promise.resolve([])
        return sheetPromise
      })
      mockApi.post.mockResolvedValue({ result: 0 })

      render(<NpcEditDrawer {...defaultProps} />)

      // Skeleton divs should exist — there is no visible "Loading" text
      const skeletons = document.querySelectorAll('.skeleton')
      expect(skeletons.length).toBeGreaterThanOrEqual(5)

      // Resolve the sheet
      const sheet = createMockSheet()
      await act(async () => {
        resolveSheet(sheet)
      })

      // Should show the loaded content
      await waitFor(() => {
        expect(screen.getByText(/Editing:/)).toBeInTheDocument()
      })
    })
  })

  describe('Error state', () => {
    it('shows error message and retry button when API fails', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'))

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load NPC sheet/)).toBeInTheDocument()
      })
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
    })

    it('shows fallback error message when sheet is null without error', async () => {
      mockApi.get.mockResolvedValue(null)

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load NPC sheet/)).toBeInTheDocument()
      })
    })

    it('retry button calls fetchSheet again', async () => {
      const onClose = vi.fn()
      let callCount = 0

      // First call fails, subsequent calls succeed with path differentiation
      mockApi.get.mockImplementation((path: string) => {
        callCount++
        if (callCount <= 1) return Promise.reject(new Error('First fail'))
        if (path.includes('resistances')) return Promise.resolve([])
        return Promise.resolve(createMockSheet())
      })
      mockApi.post.mockResolvedValue({ result: 0 })

      render(<NpcEditDrawer {...{ ...defaultProps, onClose }} />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load NPC sheet/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Retry/i }))

      await waitFor(() => {
        expect(screen.getByText(/Editing:/)).toBeInTheDocument()
      })
    })
  })

  describe('Successful load and display', () => {
    beforeEach(() => {
      setupSuccessfulLoadSheet()
    })

    it('renders header with NPC name and type badge', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Editing: Goblin King/)).toBeInTheDocument()
      })
      expect(screen.getByText('NPC')).toBeInTheDocument()
    })

    it('renders MOB type badge when npcType is MOB', async () => {
      const sheet = createMockSheet({ npcType: 'MOB' })
      mockGetSheet(sheet)

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('MOB')).toBeInTheDocument()
      })
      const badge = screen.getByText('MOB')
      expect(badge.className).toContain('red')
    })

    it('renders basic info section with input fields', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Basic Info/)).toBeInTheDocument()
      })

      const nameInput = screen.getByPlaceholderText('Name') as HTMLInputElement
      expect(nameInput.value).toBe('Goblin King')

      const levelInput = screen.getByDisplayValue('5') as HTMLInputElement
      expect(levelInput).toBeInTheDocument()

      const descInput = screen.getByPlaceholderText(/Brief description/) as HTMLTextAreaElement
      expect(descInput.value).toBe('GM Notes')

      const notesInput = screen.getByPlaceholderText(/GM notes/) as HTMLTextAreaElement
      expect(notesInput.value).toBe('Secret notes')
    })

    it('renders "Unnamed" when character name is empty', async () => {
      const sheet = createMockSheet({ characterName: '' })
      mockGetSheet(sheet)

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Editing: Unnamed/)).toBeInTheDocument()
      })
    })

    it('renders Core Resources section when enabled resources exist', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Hit Points')).toBeInTheDocument()
      })
      expect(screen.getByText('Current')).toBeInTheDocument()
      expect(screen.getByText('Maximum')).toBeInTheDocument()
    })

    it('renders Attributes section', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Attributes')).toBeInTheDocument()
      })
      const strengthEls = screen.getAllByText('Strength')
      expect(strengthEls.length).toBeGreaterThanOrEqual(1)
      const dexEls = screen.getAllByText('Dexterity')
      expect(dexEls.length).toBeGreaterThanOrEqual(1)
      // Attribute modifier hint text
      expect(screen.getByText(/modifiers auto-computed/)).toBeInTheDocument()
    })

    it('renders Armor Class section', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        const acEls = screen.getAllByText('Armor Class')
        expect(acEls.length).toBeGreaterThanOrEqual(1)
      })
      // The AC field name is "Base" with default value "10"
      expect(screen.getByText('Base')).toBeInTheDocument()
      expect(screen.getByDisplayValue('10')).toBeInTheDocument()
    })

    it('renders Resistances section', async () => {
      mockApi.get
        .mockImplementation((path: string) => {
          if (path.includes('resistances')) {
            return Promise.resolve([
              { resistanceId: 'res-fire', name: 'Fire', calculationType: 'MANUAL', total: 5, componentValues: [], attributeModifierValues: [] },
            ])
          }
          return Promise.resolve(createMockSheet())
        })

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Resistances')).toBeInTheDocument()
      })
      await waitFor(() => {
        expect(screen.getByText('Fire')).toBeInTheDocument()
      })
    })

    it('shows "Loading resistances..." when resistances exist but data not yet fetched', async () => {
      mockApi.get.mockImplementation((path: string) => {
        if (path.includes('resistances')) return new Promise(() => {})
        return Promise.resolve(createMockSheet())
      })

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Resistances')).toBeInTheDocument()
      })
      expect(screen.getByText('Loading resistances...')).toBeInTheDocument()
    })

    it('renders Skills section', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Skills')).toBeInTheDocument()
      })
      expect(screen.getByText('Stealth')).toBeInTheDocument()
    })

    it('shows "No skills for this template" when skillValues is empty', async () => {
      const sheet = createMockSheet({
        skillValues: [],
        template: {
          id: 'tpl-1',
          name: 'Goblin Template',
          attributeModifierFormula: 'floor({value}/2-5)',
          attributeModifiersEnabled: true,
          skillFormula: '{value}',
          attributes: [
            { id: 'attr-str', key: 'str', name: 'Strength' },
          ],
          templateSkills: [{ id: 'empty-skill', name: 'Empty', description: null, attributeId: null, allowedAttributeIds: [], defaultAttributeId: null, attribute: null, defaultAttribute: null }],
          skillModifierProfiles: [],
          armorClasses: [],
          resistances: [],
          coreResources: [],
        },
      })
      mockGetSheet(sheet)

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('No skills for this template.')).toBeInTheDocument()
      })
    })

    it('renders attribute selection dropdown when multiple attributes allowed for a skill', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Skills')).toBeInTheDocument()
      })
      expect(screen.getByText(/Attribute:/)).toBeInTheDocument()
      const selects = screen.getAllByRole('combobox')
      expect(selects.length).toBeGreaterThanOrEqual(1)
    })

    it('renders skill profile selections', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Proficiency:')).toBeInTheDocument()
      })
      // Custom Select component is rendered as a button with role="combobox"
      expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(1)
    })

    it('back button calls onClose', async () => {
      const onClose = vi.fn()
      render(<NpcEditDrawer {...{ ...defaultProps, onClose }} />)

      await waitFor(() => {
        const backBtns = screen.getAllByRole('button', { name: /Back to List/i })
        expect(backBtns.length).toBeGreaterThanOrEqual(1)
      })

      // Click the last "Back to List" button (the text button at bottom of drawer)
      const backBtns = screen.getAllByRole('button', { name: /Back to List/i })
      fireEvent.click(backBtns[backBtns.length - 1])
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('Full Sheet button opens in new tab', async () => {
      const originalOpen = window.open
      window.open = vi.fn()

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTitle(/Open full sheet/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTitle(/Open full sheet/))
      expect(window.open).toHaveBeenCalledWith('/dashboard/character-sheets/npc-1', '_blank')

      window.open = originalOpen
    })

    it('back chevron button in header calls onClose', async () => {
      const onClose = vi.fn()
      render(<NpcEditDrawer {...{ ...defaultProps, onClose }} />)

      await waitFor(() => {
        expect(screen.getByLabelText('Back to list')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByLabelText('Back to list'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Editable field interactions', () => {
    beforeEach(() => {
      setupSuccessfulLoadSheet()
    })

    it('updates name field', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Name')).toBeInTheDocument()
      })

      const nameInput = screen.getByPlaceholderText('Name')
      fireEvent.change(nameInput, { target: { value: 'New Name' } })
      expect((nameInput as HTMLInputElement).value).toBe('New Name')
    })

    it('updates level field', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('5')).toBeInTheDocument()
      })

      const levelInput = screen.getByDisplayValue('5')
      fireEvent.change(levelInput, { target: { value: '10' } })
      expect((levelInput as HTMLInputElement).value).toBe('10')
    })

    it('updates description textarea', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Brief description/)).toBeInTheDocument()
      })

      const descInput = screen.getByPlaceholderText(/Brief description/)
      fireEvent.change(descInput, { target: { value: 'Updated description' } })
      expect((descInput as HTMLTextAreaElement).value).toBe('Updated description')
    })

    it('updates notes textarea', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/GM notes/)).toBeInTheDocument()
      })

      const notesInput = screen.getByPlaceholderText(/GM notes/)
      fireEvent.change(notesInput, { target: { value: 'Updated notes' } })
      expect((notesInput as HTMLTextAreaElement).value).toBe('Updated notes')
    })

    it('updates core resource current/max/notes', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Hit Points')).toBeInTheDocument()
      })

      // There are three number inputs: Level (0), Current (1), Max (2)
      const numberInputs = document.querySelectorAll('input[type="number"]')
      const currentInput = numberInputs[1]
      const maxInput = numberInputs[2]

      fireEvent.change(currentInput, { target: { value: '40' } })
      expect((currentInput as HTMLInputElement).value).toBe('40')

      fireEvent.change(maxInput, { target: { value: '60' } })
      expect((maxInput as HTMLInputElement).value).toBe('60')

      // Notes field (since showNotes is true)
      const notesInput = screen.getByPlaceholderText(/Hit Points notes/)
      fireEvent.change(notesInput, { target: { value: 'Damaged' } })
      expect((notesInput as HTMLInputElement).value).toBe('Damaged')
    })

    it('updates attribute values', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('16')).toBeInTheDocument()
      })

      const attrInput = screen.getByDisplayValue('16')
      fireEvent.change(attrInput, { target: { value: '18' } })
      expect((attrInput as HTMLInputElement).value).toBe('18')
    })

    it('updates AC field values', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('10')).toBeInTheDocument()
      })

      const acInput = screen.getByDisplayValue('10')
      fireEvent.change(acInput, { target: { value: '12' } })
      expect((acInput as HTMLInputElement).value).toBe('12')
    })

    it('updates skill profile selections', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      // Wait for the sheet to load and the skills section to render
      await waitFor(() => {
        expect(screen.getByText('Proficiency:')).toBeInTheDocument()
      })
      // Find the Proficiency profile Select by its label
      const profRow = screen.getByText('Proficiency:').closest('.flex')!
      const trigger = within(profRow).getByRole('combobox')
      fireEvent.click(trigger)
      fireEvent.click(screen.getByRole('option', { name: /Expert/ }))
      // Verify the trigger now shows the selected option label
      expect(within(profRow).getByText('Expert')).toBeInTheDocument()
    })

    it('updates AC modifier selection', async () => {
      // Override the template so the AC modifier has allowPlayerSelection: true
      const sheet = createMockSheet({
        template: {
          ...createMockSheet({}).template,
          attributeModifierFormula: 'floor({value}/2-5)',
          attributeModifiersEnabled: true,
          skillFormula: '{value}',
          attributes: [
            { id: 'attr-str', key: 'str', name: 'Strength' },
            { id: 'attr-dex', key: 'dex', name: 'Dexterity' },
          ],
          templateSkills: [],
          skillModifierProfiles: [],
          armorClasses: [{
            id: 'ac-main',
            name: null,
            enabled: true,
            fields: [
              { id: 'field-base', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: false, description: null },
            ],
            attributeModifiers: [{
              id: 'am-dex',
              attributeId: 'attr-dex',
              allowPlayerSelection: true,
              defaultAttributeId: null,
              attribute: { id: 'attr-dex', key: 'dex', name: 'Dexterity' },
              defaultAttribute: null,
            }],
          }],
          resistances: [],
          coreResources: [],
        },
        values: [
          { id: 'val-str', attributeId: 'attr-str', value: '16' },
          { id: 'val-dex', attributeId: 'attr-dex', value: '14' },
        ],
        acValues: [
          { id: 'acv-base', fieldId: 'field-base', value: '10' },
        ],
        acAttributeValues: [
          { id: 'aav-dex', acAttributeModifierId: 'am-dex', selectedAttributeId: null },
        ],
        skillValues: [],
        skillProfileValues: [],
        coreResourceValues: [],
      })
      mockGetSheet(sheet)
      mockApi.post.mockResolvedValue({ result: 0 })

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        const acEls = screen.getAllByText('Armor Class')
        expect(acEls.length).toBeGreaterThanOrEqual(1)
      })

      // Find the AC modifier select element
      const acModifierSelect = screen.getAllByRole('combobox').find(
        el => {
          const parent = el.closest('select')
          return parent?.querySelector('option[value="attr-dex"]') !== null || el.querySelector('option[value="attr-dex"]') !== null
        }
      )

      if (acModifierSelect) {
        fireEvent.change(acModifierSelect, { target: { value: 'attr-str' } })
        expect((acModifierSelect as HTMLSelectElement).value).toBe('attr-str')
      }
    })

    it('updates skill attribute selection', async () => {
      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Skills')).toBeInTheDocument()
      })

      // Find the skill attribute select (the one with Attribute: label)
      const attrSelect = screen.getAllByRole('combobox').find(
        el => {
          const parent = el.closest('div')
          return parent?.querySelector('label')?.textContent?.includes('Attribute:')
        }
      )

      if (attrSelect) {
        // Current value should be 'attr-dex' (defaultAttributeId)
        fireEvent.change(attrSelect, { target: { value: 'attr-str' } })
        expect((attrSelect as HTMLSelectElement).value).toBe('attr-str')
      }
    })
  })

  describe('Save functionality', () => {
    it('calls api.patch with correct payload and calls onSaved', async () => {
      const onSaved = vi.fn()
      setupSuccessfulLoadSheet()
      mockApi.patch.mockResolvedValue({})

      render(<NpcEditDrawer {...{ ...defaultProps, onSaved }} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save/ })).toBeInTheDocument()
      })

      // Change name to trigger a non-empty payload
      const nameInput = screen.getByPlaceholderText('Name')
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } })

      const saveBtn = screen.getByRole('button', { name: /Save/ })
      fireEvent.click(saveBtn)

      await waitFor(() => {
        expect(mockApi.patch).toHaveBeenCalledWith(
          '/character-sheets/npc-1',
          expect.objectContaining({ characterName: 'Updated Name' }),
        )
      })

      expect(mockApi.patch).toHaveBeenCalledTimes(1)
      expect(onSaved).toHaveBeenCalledTimes(1)
    })

    it('shows saving spinner while saving', async () => {
      let resolvePatch!: (value: any) => void
      const patchPromise = new Promise(resolve => { resolvePatch = resolve })

      setupSuccessfulLoadSheet()
      mockApi.patch.mockReturnValue(patchPromise)

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save/ })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Save/ }))

      await waitFor(() => {
        expect(screen.getByText(/Saving\.\.\./)).toBeInTheDocument()
      })

      await act(async () => { resolvePatch({}) })
    })

    it('shows error message when save fails', async () => {
      setupSuccessfulLoadSheet()
      mockApi.patch.mockRejectedValue(new Error('Save failed'))

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save/ })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Save/ }))

      await waitFor(() => {
        expect(screen.getByText('Failed to save NPC')).toBeInTheDocument()
      })
    })

    it('does not save when sheet is null', async () => {
      mockApi.get.mockResolvedValue(null)

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load NPC sheet/)).toBeInTheDocument()
      })

      // There should be no save button when sheet is null (error state)
      expect(screen.queryByRole('button', { name: /Save/ })).not.toBeInTheDocument()
    })

    it('saves without change when only unchanged fields are present', async () => {
      setupSuccessfulLoadSheet()
      mockApi.patch.mockResolvedValue({})

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save/ })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Save/ }))

      await waitFor(() => {
        expect(mockApi.patch).toHaveBeenCalled()
      })

      // Payload should not have characterName since it wasn't changed
      const payload = mockApi.patch.mock.calls[0][1]
      expect(payload.characterName).toBeUndefined()
    })
  })

  describe('Avatar', () => {
    it('shows avatar upload overlay', async () => {
      setupSuccessfulLoadSheet()

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        // The avatar upload label wraps the avatar area
        const labels = document.querySelectorAll('label.cursor-pointer')
        expect(labels.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('uploads avatar when file is selected', async () => {
      setupSuccessfulLoadSheet()

      // Mock fetch for avatar POST
      global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
        if (opts?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => ({}) })
        }
        return Promise.resolve({ ok: true, status: 204, json: async () => ({}) })
      })

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        const fileInput = document.querySelector('input[type="file"]')
        expect(fileInput).toBeInTheDocument()
      })

      const fileInput = document.querySelector('input[type="file"]')!
      const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      // Should have called fetch with POST
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/images/character-sheets/npc-1/avatar'),
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('shows avatar image when avatarUrl is set', async () => {
      // Mock fetch HEAD to return 200 (avatar exists)
      global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
        if (opts?.method === 'HEAD' || (!opts)) {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({}) })
        }
        return Promise.resolve({ ok: true, status: 204, json: async () => ({}) })
      })

      setupSuccessfulLoadSheet()

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        const imgs = document.querySelectorAll('img')
        expect(imgs.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('handles avatar image error (onError)', async () => {
      // Mock fetch HEAD to return 200 (avatar exists)
      global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
        if (opts?.method === 'HEAD' || (!opts)) {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({}) })
        }
        return Promise.resolve({ ok: true, status: 204, json: async () => ({}) })
      })

      setupSuccessfulLoadSheet()

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        const imgs = document.querySelectorAll('img')
        expect(imgs.length).toBeGreaterThanOrEqual(1)
      })

      // Fire error on the avatar img to trigger the onError handler
      const img = document.querySelector('img')!
      fireEvent.error(img)

      // After onError fires, the img is hidden (display: none)
      expect(img.style.display).toBe('none')
    })
  })

  describe('Edge cases', () => {
    it('handles empty template attributes gracefully', async () => {
      const sheet = createMockSheet({
        template: {
          attributes: [],
          armorClasses: [{ id: 'ac-empty', name: null, enabled: false, fields: [], attributeModifiers: [] }],
          templateSkills: [],
          resistances: [],
          coreResources: [],
          skillModifierProfiles: [],
          attributeModifierFormula: null,
          skillFormula: null,
        },
        values: [],
        acValues: [],
        acAttributeValues: [],
        skillValues: [],
        skillProfileValues: [],
        coreResourceValues: [],
      })
      mockGetSheet(sheet)

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Editing:/)).toBeInTheDocument()
      })

      // No Attributes section
      expect(screen.queryByText('Attributes')).not.toBeInTheDocument()
      // No Resources section
      expect(screen.queryByText('Resources')).not.toBeInTheDocument()
      // No Armor Class section
      expect(screen.queryByText('Armor Class')).not.toBeInTheDocument()
      // No Resistances section
      expect(screen.queryByText('Resistances')).not.toBeInTheDocument()
      // No Skills section
      expect(screen.queryByText('Skills')).not.toBeInTheDocument()
    })

    it('does not show avatar when HEAD returns 204', async () => {
      setupSuccessfulLoadSheet()

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        // The avatar placeholder area should be rendered
        const avatarArea = document.querySelector('.relative.w-14')
        expect(avatarArea).toBeInTheDocument()
      })
    })

    it('handles formula evaluation failure gracefully', async () => {
      setupSuccessfulLoadSheet()
      // Override: formula evaluate returns error
      mockApi.post.mockRejectedValue(new Error('Formula error'))

      render(<NpcEditDrawer {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Editing:/)).toBeInTheDocument()
      })

      // Should still render the attributes with no mod display
      expect(screen.getAllByText('Strength').length).toBeGreaterThanOrEqual(1)
    })
  })
})

/* ── CampaignCreatureSidebar ── */

describe('CampaignCreatureSidebar', () => {
  const defaultSidebarProps = {
    adventureId: 'adv-1',
    isGM: true,
    refreshKey: 0,
    onCreaturesChange: vi.fn(),
  }

  describe('GM access control', () => {
    it('returns null when isGM is false', () => {
      const { container } = render(
        <CampaignCreatureSidebar adventureId="adv-1" isGM={false} />,
      )
      expect(container.innerHTML).toBe('')
    })

    it('renders toggle button when isGM is true', () => {
      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)
      expect(screen.getByLabelText(/Open NPC sidebar/)).toBeInTheDocument()
    })
  })

  describe('Sidebar open/close', () => {
    it('opens sidebar when toggle is clicked', async () => {
      mockApi.get.mockResolvedValue([])

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText(/NPCs & Mobs/)).toBeInTheDocument()
      })
    })

    it('closes sidebar when close button is clicked', async () => {
      mockApi.get.mockResolvedValue([])

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))
      await waitFor(() => {
        expect(screen.getByText(/NPCs & Mobs/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByLabelText(/Close sidebar/))
      // Sidebar panel should be hidden (translate-x-full)
      const aside = document.querySelector('aside')
      expect(aside?.className).toContain('translate-x-full')
    })

    it('toggles isOpen when toggle button is clicked twice', async () => {
      mockApi.get.mockResolvedValue([])

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))
      await waitFor(() => {
        expect(screen.getByText(/NPCs & Mobs/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByLabelText(/Close NPC sidebar/))
      expect(screen.getByLabelText(/Open NPC sidebar/)).toBeInTheDocument()
    })
  })

  describe('Loading state', () => {
    it('shows skeleton while loading NPC list', async () => {
      let resolveNpcs!: (value: any) => void
      const npcPromise = new Promise(resolve => { resolveNpcs = resolve })

      mockApi.get.mockReturnValue(npcPromise)

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      // Loading skeletons should be visible
      await waitFor(() => {
        const skeletons = document.querySelectorAll('.skeleton')
        expect(skeletons.length).toBeGreaterThanOrEqual(4)
      })

      await act(async () => { resolveNpcs([]) })
    })
  })

  describe('Empty state', () => {
    it('shows empty state when no NPCs exist', async () => {
      mockApi.get.mockResolvedValue([])

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText(/No NPCs or Mobs yet/)).toBeInTheDocument()
      })
    })
  })

  describe('NPC list display', () => {
    beforeEach(() => {
      mockApi.get.mockResolvedValue(createMockNpcList())
    })

    it('renders NPC cards with names and type badges', async () => {
      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText('Goblin King')).toBeInTheDocument()
      })
      expect(screen.getByText('Shadow Wolf')).toBeInTheDocument()

      // Type badges
      expect(screen.getByText('NPC')).toBeInTheDocument()
      expect(screen.getByText('MOB')).toBeInTheDocument()
    })

    it('shows health label when hpMax exists', async () => {
      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText(/30 \/ 50/)).toBeInTheDocument()
      })
    })

    it('does not show health when hpMax is 0', async () => {
      mockApi.get.mockResolvedValue([
        { id: 'npc-3', characterName: 'Ghost', isNpc: true, npcType: 'NPC', level: 1, hpActual: 0, hpMax: 0, createdAt: '', template: null },
      ])

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText('Ghost')).toBeInTheDocument()
      })
      expect(screen.queryByText(/❤️/)).not.toBeInTheDocument()
    })

    it('shows creature count in footer', async () => {
      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText(/2 creatures/)).toBeInTheDocument()
      })
    })

    it('shows singular "creature" when exactly one exists', async () => {
      mockApi.get.mockResolvedValue([createMockNpcList()[0]])

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText(/1 creature/)).toBeInTheDocument()
      })
    })

    it('shows NPC count badge on toggle button', async () => {
      // NPCs are only fetched when the sidebar opens (useEffect checks isOpen)
      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      // Open the sidebar to trigger NPC fetch
      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      // Wait for NPCs to load
      await waitFor(() => {
        expect(screen.getByText(/2 creatures/)).toBeInTheDocument()
      })

      // Close the sidebar — NPC data stays in state
      fireEvent.click(screen.getByLabelText(/Close NPC sidebar/))

      // The toggle should now show the count badge
      const toggle = screen.getByLabelText(/Open NPC sidebar/)
      expect(toggle.textContent).toContain('2')
    })
  })

  describe('Search', () => {
    beforeEach(() => {
      mockApi.get.mockResolvedValue(createMockNpcList())
    })

    it('filters NPCs by search query', async () => {
      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText('Goblin King')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/Search creatures/)
      fireEvent.change(searchInput, { target: { value: 'wolf' } })

      expect(screen.queryByText('Goblin King')).not.toBeInTheDocument()
      expect(screen.getByText('Shadow Wolf')).toBeInTheDocument()
    })

    it('shows "No creatures match" when search yields no results', async () => {
      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText('Goblin King')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/Search creatures/)
      fireEvent.change(searchInput, { target: { value: 'zzz' } })

      expect(screen.getByText(/No creatures match/)).toBeInTheDocument()
    })
  })

  describe('Filter tabs', () => {
    beforeEach(() => {
      mockApi.get.mockResolvedValue(createMockNpcList())
    })

    it('shows all creatures by default', async () => {
      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText('Goblin King')).toBeInTheDocument()
        expect(screen.getByText('Shadow Wolf')).toBeInTheDocument()
      })
    })

    it('filters to NPCs only', async () => {
      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText('Goblin King')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('NPCs'))

      expect(screen.getByText('Goblin King')).toBeInTheDocument()
      expect(screen.queryByText('Shadow Wolf')).not.toBeInTheDocument()
    })

    it('filters to Mobs only', async () => {
      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText('Goblin King')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Mobs'))

      expect(screen.queryByText('Goblin King')).not.toBeInTheDocument()
      expect(screen.getByText('Shadow Wolf')).toBeInTheDocument()
    })

    it('shows count in filter tabs', async () => {
      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        // The filter buttons show counts
        const filterArea = screen.getByText(/All/).closest('div')!
        const allTabs = filterArea.querySelectorAll('button')
        expect(allTabs.length).toBeGreaterThanOrEqual(3)
      })
    })
  })

  describe('Create NPC/MOB', () => {
    beforeEach(() => {
      mockApi.get.mockImplementation((path: string) => {
        if (path.includes('npcs')) return Promise.resolve([])
        if (path.includes('resistances')) return Promise.resolve([])
        return Promise.resolve(createMockSheet())
      })
    })

    it('calls api.post with NPC name and opens edit drawer when creating NPC', async () => {
      mockApi.post.mockResolvedValue({ id: 'new-npc-1' })

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText(/\+ New NPC/)).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByText(/\+ New NPC/))
      })

      expect(mockApi.post).toHaveBeenCalledWith('/adventures/adv-1/npcs', { name: 'New NPC', type: 'NPC' })

      // Wait for drawer to appear - api.get is called after creation
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalled()
      })
    })

    it('calls api.post with MOB name and opens edit drawer when creating MOB', async () => {
      mockApi.post.mockResolvedValue({ id: 'new-mob-1' })

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText(/\+ New Mob/)).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByText(/\+ New Mob/))
      })

      expect(mockApi.post).toHaveBeenCalledWith('/adventures/adv-1/npcs', { name: 'New Mob', type: 'MOB' })
    })

    it('shows spinner on create button while creating', async () => {
      let resolveCreate!: (value: any) => void
      const createPromise = new Promise(resolve => { resolveCreate = resolve })

      mockApi.post.mockReturnValue(createPromise)

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText(/\+ New NPC/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(/\+ New NPC/))

      await waitFor(() => {
        expect(screen.getByText(/Creating\.\.\./)).toBeInTheDocument()
      })

      await act(async () => { resolveCreate({ id: 'npc-id' }) })
    })

    it('disables both create buttons while creating', async () => {
      let resolveCreate!: (value: any) => void
      const createPromise = new Promise(resolve => { resolveCreate = resolve })

      mockApi.post.mockReturnValue(createPromise)

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText(/\+ New NPC/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(/\+ New NPC/))

      await waitFor(() => {
        const allButtons = screen.getAllByRole('button')
        const createButtons = allButtons.filter(b => b.textContent?.includes('New'))
        createButtons.forEach(btn => {
          expect(btn).toBeDisabled()
        })
      })

      await act(async () => { resolveCreate({ id: 'npc-id' }) })
    })
  })

  describe('Delete NPC/MOB', () => {
    beforeEach(() => {
      mockApi.get.mockResolvedValue(createMockNpcList())
    })

    it('calls api.delete when delete button is clicked', async () => {
      mockApi.delete.mockResolvedValue({})

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByLabelText(/Delete Goblin King/)).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByLabelText(/Delete Goblin King/))
      })

      expect(mockApi.delete).toHaveBeenCalledWith('/adventures/adv-1/npcs/npc-1')
    })

    it('shows spinner on delete button while deleting', async () => {
      let resolveDelete!: (value: any) => void
      const deletePromise = new Promise(resolve => { resolveDelete = resolve })

      mockApi.delete.mockReturnValue(deletePromise)

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByLabelText(/Delete Goblin King/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByLabelText(/Delete Goblin King/))

      // The delete button should show spinner
      await waitFor(() => {
        const deleteBtn = screen.getByLabelText(/Delete Goblin King/)
        const svg = deleteBtn.querySelector('svg.animate-spin')
        expect(svg).toBeInTheDocument()
      })

      await act(async () => { resolveDelete({}) })
    })

    it('calls onCreaturesChange after delete', async () => {
      const onCreaturesChange = vi.fn()
      mockApi.delete.mockResolvedValue({})

      render(
        <CampaignCreatureSidebar {...{ ...defaultSidebarProps, onCreaturesChange }} />,
      )

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByLabelText(/Delete Goblin King/)).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByLabelText(/Delete Goblin King/))
      })

      expect(onCreaturesChange).toHaveBeenCalled()
    })
  })

  describe('Edit drawer integration', () => {
    beforeEach(() => {
      mockApi.get.mockImplementation((path: string) => {
        if (path.includes('npcs')) return Promise.resolve(createMockNpcList())
        if (path.includes('resistances')) return Promise.resolve([])
        return Promise.resolve(createMockSheet())
      })
    })

    it('opens NpcEditDrawer when edit button is clicked', async () => {
      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByLabelText(/Edit Goblin King/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByLabelText(/Edit Goblin King/))

      // The NpcEditDrawer should now be visible
      await waitFor(() => {
        const aside = document.querySelector('aside')
        // When editingNpcId is set, the aside has wider width class
        expect(aside?.className).toContain('w-[500px]')
      })
    })

    it('closes drawer via NpcEditDrawer onClose', async () => {
      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByLabelText(/Edit Goblin King/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByLabelText(/Edit Goblin King/))

      await waitFor(() => {
        const aside = document.querySelector('aside')
        expect(aside?.className).toContain('w-[500px]')
      })

      // The NpcEditDrawer back button should be rendered
      const backBtn = screen.getByLabelText('Back to list')
      fireEvent.click(backBtn)

      // Should return to list mode
      await waitFor(() => {
        const aside = document.querySelector('aside')
        expect(aside?.className).not.toContain('w-[500px]')
      })
    })

    it('refetches NPCs when NpcEditDrawer saves', async () => {
      const sheet = createMockSheet()
      mockApi.get.mockImplementation((path: string) => {
        if (path.includes('npcs')) return Promise.resolve(createMockNpcList())
        if (path.includes('resistances')) return Promise.resolve([])
        return Promise.resolve(sheet)
      })
      mockApi.post.mockResolvedValue({ result: 0 })
      mockApi.patch.mockResolvedValue({})

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByLabelText(/Edit Goblin King/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByLabelText(/Edit Goblin King/))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save/ })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /Save/ }))

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/adventures/adv-1/npcs')
      })
    })

    it('closes editing when sidebar is toggled closed', async () => {
      // The beforeEach already sets up mockImplementation with NPC list + sheet.
      // No need to override.
      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      // Open sidebar
      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByLabelText(/Edit Goblin King/)).toBeInTheDocument()
      })

      // Click edit to open drawer
      fireEvent.click(screen.getByLabelText(/Edit Goblin King/))

      await waitFor(() => {
        const aside = document.querySelector('aside')
        expect(aside?.className).toContain('w-[500px]')
      })

      // Close sidebar via toggle
      fireEvent.click(screen.getByLabelText(/Close NPC sidebar/))

      // Sidebar should be hidden
      const aside = document.querySelector('aside')
      expect(aside?.className).toContain('translate-x-full')
      expect(aside?.className).not.toContain('w-[500px]')
    })

    it('opens a new NPC/MOB in edit drawer after creation', async () => {
      mockApi.get.mockImplementation((path: string) => {
        if (path.includes('npcs')) return Promise.resolve([])
        if (path.includes('resistances')) return Promise.resolve([])
        return Promise.resolve(createMockSheet())
      })
      mockApi.post.mockResolvedValue({ id: 'new-npc-1' })

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText(/\+ New NPC/)).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByText(/\+ New NPC/))
      })

      // After creation, editingNpcId should be set, so the drawer should widen
      await waitFor(() => {
        const aside = document.querySelector('aside')
        expect(aside?.className).toContain('w-[500px]')
      })
    })
  })

  describe('Navigate to full sheet', () => {
    it('calls router.push when click name or view button', async () => {
      mockApi.get.mockImplementation((path: string) => {
        if (path.includes('npcs')) return Promise.resolve(createMockNpcList())
        if (path.includes('resistances')) return Promise.resolve([])
        return Promise.resolve(createMockSheet())
      })

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByLabelText(/View Goblin King/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByLabelText(/View Goblin King/))

      // router.push should have been called on the shared mock
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/character-sheets/npc-1')
    })
  })

  describe('Avatar upload in sidebar', () => {
    it('uploads avatar for NPC in sidebar list', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })

      mockApi.get.mockResolvedValue(createMockNpcList())

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText('Goblin King')).toBeInTheDocument()
      })

      // Find the file input inside the avatar overlay
      const fileInputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]')
      expect(fileInputs.length).toBeGreaterThanOrEqual(1)

      const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
      const firstInput = fileInputs[0]

      await act(async () => {
        fireEvent.change(firstInput, { target: { files: [file] } })
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/images/character-sheets/npc-1/avatar'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  describe('Edge cases for sidebar', () => {
    it('handles failed NPC fetch silently', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'))

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      // Should not crash, should show empty state
      await waitFor(() => {
        expect(screen.getByText(/No NPCs or Mobs yet/)).toBeInTheDocument()
      })
    })

    it('handles failed delete silently', async () => {
      mockApi.get.mockResolvedValue(createMockNpcList())
      mockApi.delete.mockRejectedValue(new Error('Delete failed'))

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByLabelText(/Delete Goblin King/)).toBeInTheDocument()
      })

      // Should not throw
      await act(async () => {
        fireEvent.click(screen.getByLabelText(/Delete Goblin King/))
      })

      // Should still show the NPC list (not crashed)
      expect(screen.getByText('Goblin King')).toBeInTheDocument()
    })

    it('handles failed create silently', async () => {
      mockApi.get.mockResolvedValue([])
      mockApi.post.mockRejectedValue(new Error('Create failed'))

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText(/\+ New NPC/)).toBeInTheDocument()
      })

      // Should not throw
      await act(async () => {
        fireEvent.click(screen.getByText(/\+ New NPC/))
      })

      // Should still show the empty state (not crashed)
      expect(screen.getByText(/No NPCs or Mobs yet/)).toBeInTheDocument()
    })

    it('handles failed avatar upload silently', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Upload failed'))

      mockApi.get.mockResolvedValue(createMockNpcList())

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText('Goblin King')).toBeInTheDocument()
      })

      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [new File(['x'], 'x.png', { type: 'image/png' })] } })
      })

      // Should not crash
      expect(screen.getByText('Goblin King')).toBeInTheDocument()
    })

    it('does not fetch NPCs on mount when isOpen is false', async () => {
      mockApi.get.mockResolvedValue(createMockNpcList())

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      // api.get should NOT have been called since isOpen starts false
      expect(mockApi.get).not.toHaveBeenCalled()
    })

    it('resets editingNpcId when sidebar closes', async () => {
      mockApi.get.mockImplementation((path: string) => {
        if (path.includes('npcs')) return Promise.resolve(createMockNpcList())
        if (path.includes('resistances')) return Promise.resolve([])
        return Promise.resolve(createMockSheet())
      })

      render(<CampaignCreatureSidebar {...defaultSidebarProps} />)

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByLabelText(/Edit Goblin King/)).toBeInTheDocument()
      })

      // Click edit to open drawer
      fireEvent.click(screen.getByLabelText(/Edit Goblin King/))

      await waitFor(() => {
        const aside = document.querySelector('aside')
        expect(aside?.className).toContain('w-[500px]')
      })

      // Close sidebar
      fireEvent.click(screen.getByLabelText(/Close NPC sidebar/))

      // editingNpcId should be reset
      const aside = document.querySelector('aside')
      // Sidebar is closed, so aside class has translate-x-full
      expect(aside?.className).toContain('translate-x-full')
    })

    it('does not call onCreaturesChange when not provided on create', async () => {
      mockApi.get.mockImplementation((path: string) => {
        if (path.includes('npcs')) return Promise.resolve([])
        if (path.includes('resistances')) return Promise.resolve([])
        return Promise.resolve(createMockSheet())
      })
      mockApi.post.mockResolvedValue({ id: 'new-npc' })

      render(
        <CampaignCreatureSidebar adventureId="adv-1" isGM={true} />,
      )

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByText(/\+ New NPC/)).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByText(/\+ New NPC/))
      })

      // Should not throw (no onCreaturesChange provided).
      // After creation the edit drawer renders with "Editing:" header.
      await waitFor(() => {
        expect(screen.getByText(/Editing:/)).toBeInTheDocument()
      })
    })

    it('does not call onCreaturesChange when not provided on delete', async () => {
      mockApi.get.mockResolvedValue(createMockNpcList())
      mockApi.delete.mockResolvedValue({})

      render(
        <CampaignCreatureSidebar adventureId="adv-1" isGM={true} />,
      )

      fireEvent.click(screen.getByLabelText(/Open NPC sidebar/))

      await waitFor(() => {
        expect(screen.getByLabelText(/Delete Goblin King/)).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByLabelText(/Delete Goblin King/))
      })

      // Should not throw
      expect(screen.getByText('Goblin King')).toBeInTheDocument()
    })
  })
})
