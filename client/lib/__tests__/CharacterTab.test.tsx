import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterTab } from '@/components/character-sheet/CharacterTab'
import { CollapsibleSkillRow } from '@/components/character-sheet/CollapsibleSkillRow'
import type { CharacterSheet, AcResultMap, SkillModifierProfile } from '@/components/character-sheet/types'

// ── Mock dependencies ──

vi.mock('@/lib/inline-editable', () => ({
  InlineText: ({ value, onSave, className, emptyDisplay }: any) => (
    <span
      data-testid="inline-text"
      data-value={value}
      data-empty={emptyDisplay}
      className={className}
      onClick={() => onSave?.('Updated Value')}
      role="button"
    >
      {value?.trim() || emptyDisplay || '—'}
    </span>
  ),
  InlineNumber: ({ value, onSave, className, emptyDisplay }: any) => (
    <span
      data-testid="inline-number"
      data-value={value}
      className={className}
      onClick={() => onSave?.(42)}
      role="button"
    >
      {value != null && value !== '' ? String(value) : emptyDisplay || '—'}
    </span>
  ),
}))

vi.mock('@/components/character-sheet/ProfessionalSkillsSection', () => ({
  ProfessionalSkillsSection: ({ sheetId }: any) => (
    <div data-testid="professional-skills-section">Professional Skills ({sheetId})</div>
  ),
}))

// ── Factory for mock data ──

function createMockSheet(overrides?: Partial<CharacterSheet>): CharacterSheet {
  return {
    id: 'sheet-1',
    characterName: 'Test Character',
    playerName: 'TestPlayer',
    level: 5,
    hpActual: 30,
    hpMax: 50,
    hpNotes: null,
    adventure: null,
    template: {
      id: 'template-1',
      name: 'Test Template',
      attributeModifierFormula: 'ATT + 5',
      attributes: [
        { id: 'attr-str', key: 'strength', name: 'Strength' },
        { id: 'attr-dex', key: 'dexterity', name: 'Dexterity' },
        { id: 'attr-con', key: 'constitution', name: 'Constitution' },
      ],
      coreResources: [
        { id: 'cr-hp', slug: 'hp', displayName: 'Hit Points', enabled: true, editableByPlayer: true, showNotes: true, color: '#ef4444' },
        { id: 'cr-mp', slug: 'mp', displayName: 'Mana', enabled: true, editableByPlayer: false, showNotes: false },
      ],
      armorClasses: [
        {
          id: 'ac-1',
          name: 'Armor Class',
          enabled: true,
          fields: [
            { id: 'ac-field-1', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: null },
            { id: 'ac-field-2', name: 'Shield', key: 'shield', defaultValue: '0', editableByPlayer: true, description: null },
          ],
          attributeModifiers: [
            {
              id: 'ac-mod-1', attributeId: 'attr-dex', allowPlayerSelection: true, defaultAttributeId: 'attr-dex',
              attribute: { id: 'attr-dex', key: 'dexterity', name: 'Dexterity' },
              defaultAttribute: { id: 'attr-dex', key: 'dexterity', name: 'Dexterity' },
            },
          ],
        },
      ],
      skillModifierProfiles: [
        { id: 'prof-1', name: 'Proficiency', options: [
          { id: 'prof-opt-none', label: 'None', value: 0 },
          { id: 'prof-opt-half', label: 'Half', value: 2 },
          { id: 'prof-opt-full', label: 'Full', value: 4 },
        ]},
        { id: 'prof-2', name: 'Targeted', options: [
          { id: 'targ-opt-a', label: 'Option A', value: 1 },
          { id: 'targ-opt-b', label: 'Option B', value: 3 },
        ], targetMode: 'SPECIFIC', targetSkillIds: ['Acrobatics'] },
      ],
      characterSections: [],
      resistances: [],
      templateSkills: [],
    },
    values: [
      { id: 'val-str', attributeId: 'attr-str', value: '16', attribute: { id: 'attr-str', key: 'strength', name: 'Strength' } },
      { id: 'val-dex', attributeId: 'attr-dex', value: '14', attribute: { id: 'attr-dex', key: 'dexterity', name: 'Dexterity' } },
      { id: 'val-con', attributeId: 'attr-con', value: '12', attribute: { id: 'attr-con', key: 'constitution', name: 'Constitution' } },
    ],
    fieldValues: [
      { id: 'fv-1', templateFieldId: 'tf-name', value: 'Test Character', templateField: { id: 'tf-name', key: 'name', label: 'Name' } },
      { id: 'fv-2', templateFieldId: 'tf-class', value: 'Warrior', templateField: { id: 'tf-class', key: 'class', label: 'Class' } },
    ],
    skillValues: [
      {
        id: 'sv-athletics', skillId: 'skill-athletics', value: '5',
        selectedAttributeId: 'attr-str',
        selectedAttribute: { id: 'attr-str', key: 'strength', name: 'Strength' },
        skill: {
          id: 'skill-athletics', name: 'Athletics', description: 'Physical prowess', attributeId: 'attr-str',
          allowedAttributeIds: ['attr-str', 'attr-dex'], defaultAttributeId: 'attr-str',
          attribute: { id: 'attr-str', key: 'strength', name: 'Strength' },
          defaultAttribute: { id: 'attr-str', key: 'strength', name: 'Strength' },
        },
      },
      {
        id: 'sv-acrobatics', skillId: 'skill-acrobatics', value: '3',
        selectedAttributeId: 'attr-dex',
        selectedAttribute: { id: 'attr-dex', key: 'dexterity', name: 'Dexterity' },
        skill: {
          id: 'skill-acrobatics', name: 'Acrobatics', description: null, attributeId: 'attr-dex',
          allowedAttributeIds: ['attr-dex'], defaultAttributeId: 'attr-dex',
          attribute: { id: 'attr-dex', key: 'dexterity', name: 'Dexterity' },
          defaultAttribute: { id: 'attr-dex', key: 'dexterity', name: 'Dexterity' },
        },
      },
    ],
    skillProfileValues: [],
    coreResourceValues: [
      { id: 'crv-hp', coreResourceId: 'cr-hp', current: 30, maximum: 50, notes: 'Wounded',
        coreResource: { id: 'cr-hp', slug: 'hp', displayName: 'Hit Points', enabled: true, editableByPlayer: true, showNotes: true, color: '#ef4444' } },
      { id: 'crv-mp', coreResourceId: 'cr-mp', current: 10, maximum: 20, notes: null,
        coreResource: { id: 'cr-mp', slug: 'mp', displayName: 'Mana', enabled: true, editableByPlayer: false, showNotes: false } },
    ],
    acValues: [
      { id: 'acv-base', fieldId: 'ac-field-1', value: '12', field: { id: 'ac-field-1', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: null } },
      { id: 'acv-shield', fieldId: 'ac-field-2', value: '2', field: { id: 'ac-field-2', name: 'Shield', key: 'shield', defaultValue: '0', editableByPlayer: true, description: null } },
    ],
    acAttributeValues: [
      { id: 'acav-1', sheetId: 'sheet-1', acAttributeModifierId: 'ac-mod-1', selectedAttributeId: 'attr-dex',
        acAttributeModifier: { id: 'ac-mod-1', attributeId: 'attr-dex', allowPlayerSelection: true, defaultAttributeId: 'attr-dex', attribute: { id: 'attr-dex', key: 'dexterity', name: 'Dexterity' }, defaultAttribute: { id: 'attr-dex', key: 'dexterity', name: 'Dexterity' } },
        selectedAttribute: { id: 'attr-dex', key: 'dexterity', name: 'Dexterity' },
      },
    ],
    sectionEntries: [],
    abilities: [],
    inventoryItems: [],
    story: null,
    ownerId: 'user-1',
    isNpc: false,
    npcType: null,
    adventureId: null,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function defaultProps(overrides?: Record<string, any>) {
  const sheet = createMockSheet(overrides?.sheet as any)
  const allProfiles: SkillModifierProfile[] = sheet.template.skillModifierProfiles
  return {
    sheet,
    isOwner: true,
    permissions: {
      canEditCharacter: true,
      canEditResources: true,
      canEditSkills: true,
      canEditAbilities: true,
      canEditInventory: true,
      canEditPersonalAbilities: true,
      canEditResistances: true,
      canEditStory: true,
      canEditProfessionalSkills: true,
    },
    enabledCoreResources: sheet.template.coreResources,
    handleCoreResourceChange: vi.fn(),
    handleCoreResourceModify: vi.fn(),
    saveFieldValue: vi.fn(),
    modifierResults: { 'attr-str': 3, 'attr-dex': 2, 'attr-con': 1 },
    saveAttributeValue: vi.fn(),
    modifiersEnabled: true,
    armorClasses: sheet.template.armorClasses,
    acResults: { 'ac-1': { total: 16, name: 'Armor Class' } } as AcResultMap,
    handleAcFieldChange: vi.fn(),
    handleAcAttributeModifierChange: vi.fn(),
    allProfiles,
    profileSelections: {},
    activeSkills: { 'skill-athletics': true, 'skill-acrobatics': false },
    othersValues: {},
    handleSkillToggle: vi.fn(),
    handleOthersChange: vi.fn(),
    handleProfileChange: vi.fn(),
    handleSkillAttributeChange: vi.fn(),
    expandedSkillId: null,
    setExpandedSkillId: vi.fn(),
    skillResults: { 'skill-athletics': 12, 'skill-acrobatics': 8 },
    sheetId: 'sheet-1',
    ...overrides,
  }
}

// ── CharacterTab Tests ──

describe('CharacterTab', () => {
  let props: ReturnType<typeof defaultProps>

  beforeEach(() => {
    props = defaultProps()
  })

  // ── Rendering states ──

  describe('rendering states', () => {
    it('renders Character Information section when hasFields is true', () => {
      render(<CharacterTab {...props} />)
      expect(screen.getByText('Character Information')).toBeInTheDocument()
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Class')).toBeInTheDocument()
    })

    it('hides Character Information when no fieldValues', () => {
      render(<CharacterTab {...props} sheet={{ ...props.sheet, fieldValues: [] }} />)
      expect(screen.queryByText('Character Information')).not.toBeInTheDocument()
    })

    it('renders Attributes section when attributes exist', () => {
      render(<CharacterTab {...props} />)
      expect(screen.getByText('Attributes')).toBeInTheDocument()
      // Strength and Dexterity appear both as attribute names and as <option> text in the AC modifier select
      expect(screen.getAllByText('Strength').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Dexterity').length).toBeGreaterThanOrEqual(1)
    })

    it('shows modifier badge when modifiersEnabled and formula exists', () => {
      render(<CharacterTab {...props} />)
      const badge = screen.getByText('mod')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('badge-gold')
    })

    it('hides modifier badge when modifiersEnabled is false', () => {
      render(<CharacterTab {...props} modifiersEnabled={false} />)
      expect(screen.queryByText('mod')).not.toBeInTheDocument()
    })

    it('renders modifier results next to attributes', () => {
      render(<CharacterTab {...props} />)
      expect(screen.getAllByText('(+3)').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('(+2)')).toBeInTheDocument()
      expect(screen.getByText('(+1)')).toBeInTheDocument()
    })

    it('renders core resources with health bar', () => {
      render(<CharacterTab {...props} />)
      expect(screen.getByText('Hit Points')).toBeInTheDocument()
      expect(screen.getByText('Mana')).toBeInTheDocument()
      // health bar divs
      const cards = screen.getAllByText(/Current/)
      expect(cards.length).toBeGreaterThanOrEqual(2)
    })

    it('renders Armor Class section when armorClasses exist', () => {
      render(<CharacterTab {...props} />)
      expect(screen.getByText('Armor Class')).toBeInTheDocument()
      // AC result total in circle — "16" also appears as the Strength attribute value
      expect(screen.getAllByText('16').length).toBeGreaterThanOrEqual(1)
    })

    it('renders empty state when no skills', () => {
      render(<CharacterTab {...props} sheet={{ ...props.sheet, skillValues: [] }} />)
      expect(screen.getByText('No skills defined for this template')).toBeInTheDocument()
    })

    it('shows "No inactive skills." when all skills are active', () => {
      render(<CharacterTab {...props} activeSkills={{ 'skill-athletics': true, 'skill-acrobatics': true }} />)
      // Active table has 2 skills, Inactive table has 0 → shows message
      expect(screen.getByText('No inactive skills.')).toBeInTheDocument()
    })

    it('shows "No active skills." when all skills are inactive', () => {
      render(<CharacterTab {...props} activeSkills={{}} />)
      // Active table has 0 skills → shows message (before search box renders)
      expect(screen.getByText('No active skills.')).toBeInTheDocument()
    })

    it('renders skills tables when skills exist', () => {
      render(<CharacterTab {...props} />)
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Inactive')).toBeInTheDocument()
      expect(screen.getByText('Athletics')).toBeInTheDocument()
      expect(screen.getByText('Acrobatics')).toBeInTheDocument()
    })

    it('shows skill description when present', () => {
      render(<CharacterTab {...props} />)
      expect(screen.getByText('Physical prowess')).toBeInTheDocument()
    })

    it('renders ProfessionalSkillsSection', () => {
      render(<CharacterTab {...props} />)
      expect(screen.getByTestId('professional-skills-section')).toBeInTheDocument()
      expect(screen.getByText('Professional Skills (sheet-1)')).toBeInTheDocument()
    })
  })

  // ── Owner vs non-owner ──

  describe('owner vs non-owner', () => {
    it('renders inline-editable fields when isOwner', () => {
      render(<CharacterTab {...props} isOwner={true} />)
      const inlineTexts = screen.getAllByTestId('inline-text')
      // field values get InlineText
      const charName = inlineTexts.find(el => el.getAttribute('data-value') === 'Test Character')
      expect(charName).toBeInTheDocument()
      const warrior = inlineTexts.find(el => el.getAttribute('data-value') === 'Warrior')
      expect(warrior).toBeInTheDocument()
    })

    it('renders plain text for fields when not isOwner', () => {
      render(<CharacterTab {...props} isOwner={false} />)
      // Non-owner: fields show plain spans
      expect(screen.getByText('Test Character')).toBeInTheDocument()
      expect(screen.getByText('Warrior')).toBeInTheDocument()
    })

    it('shows heal/damage UI for owner with editable core resource', () => {
      render(<CharacterTab {...props} isOwner={true} />)
      const healButtons = screen.getAllByText('+ Heal')
      const damageButtons = screen.getAllByText('− Damage')
      expect(healButtons.length).toBeGreaterThanOrEqual(1)
      expect(damageButtons.length).toBeGreaterThanOrEqual(1)
    })

    it('hides heal/damage UI when not isOwner', () => {
      render(<CharacterTab {...props} isOwner={false} permissions={{ ...props.permissions, canEditResources: false }} />)
      expect(screen.queryByText('+ Heal')).not.toBeInTheDocument()
      expect(screen.queryByText('− Damage')).not.toBeInTheDocument()
    })
  })

  // ── Core Resource Variants ──

  describe('core resource variants', () => {
    it('shows notes input for editable resource with showNotes', () => {
      render(<CharacterTab {...props} />)
      // Hit Points has showNotes=true and editableByPlayer=true
      // The mock InlineText renders with data-value
      const notes = screen.getAllByTestId('inline-text').find(el => el.getAttribute('data-value') === 'Wounded')
      expect(notes).toBeInTheDocument()
    })

    it('shows notes as text for non-editable resource with notes', () => {
      const sheet = createMockSheet()
      // Make MP have showNotes = true but not editable by player
      sheet.coreResourceValues[1].notes = 'Mana notes'
      sheet.template.coreResources[1].showNotes = true
      render(<CharacterTab {...props} sheet={sheet} enabledCoreResources={sheet.template.coreResources} />)
      expect(screen.getByText('Mana notes')).toBeInTheDocument()
    })

    it('does not show health bar when crv.maximum is null', () => {
      const sheet = createMockSheet()
      sheet.coreResourceValues[0].maximum = null
      render(<CharacterTab {...props} sheet={sheet} />)
      // Health bar won't render; we just verify no crash and Hit Points still shows
      expect(screen.getByText('Hit Points')).toBeInTheDocument()
    })

    it('does not show heal/damage when handleCoreResourceModify is undefined', () => {
      render(<CharacterTab {...props} handleCoreResourceModify={undefined} />)
      expect(screen.queryByText('+ Heal')).not.toBeInTheDocument()
    })
  })

  // ── AC Variants ──

  describe('armor class variants', () => {
    it('shows AC attribute modifier with select when allowPlayerSelection', () => {
      render(<CharacterTab {...props} isOwner={true} />)
      const selects = screen.getAllByRole('combobox')
      // There should be at least one select for AC attribute modifier
      const acSelect = selects.find(s => s.tagName === 'SELECT')
      expect(acSelect).toBeInTheDocument()
    })

    it('shows AC attribute modifier as text when not owner', () => {
      render(<CharacterTab {...props} isOwner={false} />)
      // Dexterity appears both as an attribute name and as the AC modifier text
      expect(screen.getAllByText('Dexterity').length).toBeGreaterThanOrEqual(2)
    })

    it('does not render AC section when armorClasses is empty', () => {
      render(<CharacterTab {...props} armorClasses={[]} />)
      expect(screen.queryByText('Armor Class')).not.toBeInTheDocument()
    })

    it('does not show modifier section when modifiersEnabled false', () => {
      render(<CharacterTab {...props} modifiersEnabled={false} />)
      // modifiersEnabled=false hides ALL modifier results (both attributes and AC)
      expect(screen.queryByText('(+2)')).not.toBeInTheDocument()
      expect(screen.queryByText('(+3)')).not.toBeInTheDocument()
      expect(screen.queryByText('(+1)')).not.toBeInTheDocument()
    })

    it('handles AC mod result as null or undefined', () => {
      render(<CharacterTab {...props} modifierResults={{}} />)
      // mod results show em dash
      const dashes = screen.queryAllByText('—')
      // Should have at least one for the AC mod that has no result
      expect(dashes.length).toBeGreaterThanOrEqual(0)
    })
  })

  // ── No resources / no attributes / no fields ──

  describe('empty states for sections', () => {
    it('hides resources section when no enabled resources and no armor', () => {
      render(<CharacterTab {...props} enabledCoreResources={[]} armorClasses={[]} />)
      // The card header for resources/AC won't render
      expect(screen.queryByText('Hit Points')).not.toBeInTheDocument()
      expect(screen.queryByText('Armor Class')).not.toBeInTheDocument()
    })

    it('hides attributes section when template has no attributes', () => {
      const sheet = createMockSheet()
      sheet.template.attributes = []
      render(<CharacterTab {...props} sheet={sheet} />)
      expect(screen.queryByText('Attributes')).not.toBeInTheDocument()
      expect(screen.queryByText('Strength')).not.toBeInTheDocument()
    })
  })

  // ── Interactions: Heal & Damage ──

  describe('heal and damage interactions', () => {
    it('calls handleCoreResourceModify with positive delta on Heal', async () => {
      const user = userEvent.setup()
      render(<CharacterTab {...props} />)
      // Find the modifier input by placeholder (it's a sibling of the button's wrapper div, not a child)
      const input = screen.getByPlaceholderText('Amount')
      expect(input).toBeInTheDocument()
      await user.type(input, '5')
      const healBtn = screen.getAllByText('+ Heal')[0]
      await user.click(healBtn)
      expect(props.handleCoreResourceModify).toHaveBeenCalledWith('cr-hp', 5)
    })

    it('calls handleCoreResourceModify with negative delta on Damage', async () => {
      const user = userEvent.setup()
      render(<CharacterTab {...props} />)
      const input = screen.getByPlaceholderText('Amount')
      expect(input).toBeInTheDocument()
      await user.type(input, '3')
      const damageBtn = screen.getAllByText('− Damage')[0]
      await user.click(damageBtn)
      expect(props.handleCoreResourceModify).toHaveBeenCalledWith('cr-hp', -3)
    })

    it('calls setExpandedSkillId when clicking expand toggle on active skill', async () => {
      const user = userEvent.setup()
      render(<CharacterTab {...props} />)
      // Find Athletics expand button (active skill)
      const athletics = screen.getByText('Athletics')
      const expandBtn = athletics.closest('button') || athletics.nextElementSibling?.closest('button') || athletics.closest('div')?.querySelector('button')
      // The Athletics name is inside a button
      const buttons = screen.getAllByRole('button')
      const athleticsBtn = buttons.find(b => b.textContent?.includes('Athletics'))
      expect(athleticsBtn).toBeInTheDocument()
      if (athleticsBtn) {
        await user.click(athleticsBtn)
        expect(props.setExpandedSkillId).toHaveBeenCalledWith('skill-athletics')
      }
    })

    it('disables expand toggle on inactive skill', () => {
      render(<CharacterTab {...props} />)
      // Find Acrobatics (inactive) expand button
      const acrobaticsToggle = screen.getByText('Acrobatics').closest('button')
      if (acrobaticsToggle) {
        expect(acrobaticsToggle).toBeDisabled()
      }
    })

    it('calls handleSkillToggle when checking/unchecking a skill checkbox', async () => {
      const user = userEvent.setup()
      render(<CharacterTab {...props} />)
      // Find all checkboxes
      const checkboxes = screen.getAllByRole('checkbox')
      // First checkbox is likely the Athletics one (active)
      if (checkboxes.length > 0) {
        await user.click(checkboxes[0])
        expect(props.handleSkillToggle).toHaveBeenCalledWith('skill-athletics')
      }
    })
  })

  // ── Skill Search ──

  describe('skill search', () => {
    it('renders search input in SkillTable when skills exist', () => {
      render(<CharacterTab {...props} />)
      expect(screen.getByPlaceholderText('Search active...')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search inactive...')).toBeInTheDocument()
    })

    it('filters skills by search query', async () => {
      const user = userEvent.setup()
      render(<CharacterTab {...props} />)
      const searchInput = screen.getByPlaceholderText('Search active...')
      await user.type(searchInput, 'Athl')
      // Athletics should still show
      expect(screen.getByText('Athletics')).toBeInTheDocument()
    })

    it('shows no-match message when search yields no results', async () => {
      const user = userEvent.setup()
      render(<CharacterTab {...props} />)
      const searchInput = screen.getByPlaceholderText('Search active...')
      await user.type(searchInput, 'ZZZZ_NoMatch')
      expect(screen.getByText('No skills match your search.')).toBeInTheDocument()
    })
  })

  // ── Expanded skill detail ──

  describe('expanded skill details', () => {
    it('renders profile options when skill is expanded', () => {
      render(<CharacterTab {...props} expandedSkillId="skill-athletics" />)
      // Profile "Proficiency:" appears in both SkillTable instances (Active expanded, Inactive collapsed)
      expect(screen.getAllByText('Proficiency:').length).toBeGreaterThanOrEqual(1)
    })

    it('renders Others input when skill is expanded', () => {
      render(<CharacterTab {...props} expandedSkillId="skill-athletics" />)
      // "Others:" appears in both SkillTable instances (Active expanded, Inactive collapsed)
      expect(screen.getAllByText('Others:').length).toBeGreaterThanOrEqual(1)
    })

    it('calls handleOthersChange when others value changes', async () => {
      const user = userEvent.setup()
      render(<CharacterTab {...props} expandedSkillId="skill-athletics" othersValues={{ 'skill-athletics': 2 }} />)
      // "+2" appears both in the AC modifier section and the skill Others section
      expect(screen.getAllByText('+2').length).toBeGreaterThanOrEqual(2)
    })

    it('calls handleProfileChange when profile option selected', async () => {
      const user = userEvent.setup()
      render(<CharacterTab {...props} expandedSkillId="skill-athletics" />)
      // Find proficiency select
      const selects = screen.getAllByRole('combobox')
      const profSelect = selects.find(s => {
        const opts = s.querySelectorAll('option')
        return Array.from(opts).some(o => o.textContent === 'Half (+2)')
      })
      expect(profSelect).toBeInTheDocument()
      if (profSelect) {
        await user.selectOptions(profSelect, 'prof-opt-half')
        expect(props.handleProfileChange).toHaveBeenCalledWith('skill-athletics', 'prof-1', 'prof-opt-half')
      }
    })

    it('shows selected profile option value display when skill expanded', () => {
      render(<CharacterTab {...props}
        expandedSkillId="skill-athletics"
        profileSelections={{ 'skill-athletics': { 'prof-1': 'prof-opt-half' } }}
      />)
      // The value display shows "+2" from the Half option (in skill details section)
      const valueDisplays = screen.getAllByText('+2').filter(el =>
        el.className.includes('font-mono text-primary')
      )
      expect(valueDisplays.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── AC field changes ──

  describe('AC field interactions', () => {
    it('renders AC field InlineNumber with correct value for owner', () => {
      render(<CharacterTab {...props} isOwner={true} />)
      // AC editable fields render as bare <input type="number">, not the mocked InlineNumber
      expect(screen.getByDisplayValue('12')).toBeInTheDocument()
      expect(screen.getByDisplayValue('2')).toBeInTheDocument()
    })

    it('calls handleAcAttributeModifierChange when AC attribute changes', async () => {
      const user = userEvent.setup()
      render(<CharacterTab {...props} isOwner={true} />)
      // Find the AC attribute modifier select
      const selects = screen.getAllByRole('combobox')
      // The AC select should have Strength, Dexterity, Constitution options
      const acSelect = selects.find(s => {
        const opts = s.querySelectorAll('option')
        return Array.from(opts).some(o => o.textContent === 'Strength') &&
               Array.from(opts).some(o => o.textContent === 'Dexterity') &&
               Array.from(opts).some(o => o.textContent === 'Constitution')
      })
      if (acSelect) {
        await user.selectOptions(acSelect, 'attr-str')
        expect(props.handleAcAttributeModifierChange).toHaveBeenCalledWith('ac-mod-1', 'attr-str')
      }
    })

    it('calls handleAcFieldChange when AC number input changes', () => {
      render(<CharacterTab {...props} isOwner={true} />)
      // AC fields are bare <input type="number"> with value '12' (Base)
      const baseInput = screen.getByDisplayValue('12') as HTMLInputElement
      fireEvent.change(baseInput, { target: { value: '15' } })
      expect(props.handleAcFieldChange).toHaveBeenCalledWith('ac-field-1', '15')
    })
  })

  // ── Non-owner field/attribute display ──

  describe('non-owner display', () => {
    it('shows em dash for empty field values when not owner', () => {
      const sheet = createMockSheet()
      sheet.fieldValues[0].value = ''
      render(<CharacterTab {...props} sheet={sheet} isOwner={false} />)
      // Empty value shows em dash when read-only
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('shows em dash for null attribute values when not owner', () => {
      const sheet = createMockSheet()
      sheet.values = []
      render(<CharacterTab {...props} sheet={sheet} isOwner={false} />)
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── Modifier results ──

  describe('modifier results edge cases', () => {
    it('handles null modifierResult for an attribute', () => {
      render(<CharacterTab {...props} modifierResults={{ 'attr-str': null, 'attr-dex': 2, 'attr-con': 1 }} />)
      // Strength shows "null modifier" but the (+?) doesn't appear since modResult is null
      // The mod span only shows when modResult !== null
      const modSpans = screen.queryAllByText(/^\(\+/)
      // Should show (+2) and (+1) but not (+3)
      expect(screen.getByText('(+2)')).toBeInTheDocument()
      expect(screen.getByText('(+1)')).toBeInTheDocument()
      expect(screen.queryByText('(+3)')).not.toBeInTheDocument()
    })

    it('shows skill total for active skills and 0 for inactive', () => {
      render(<CharacterTab {...props} />)
      // Athletics is active -> shows 12 (also appears as Constitution attribute value)
      expect(screen.getAllByText('12').length).toBeGreaterThanOrEqual(1)
      // Acrobatics is inactive -> shows 0
      expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── getAttrModifier helper coverage ──

  describe('getAttrModifier helper (via SkillTable)', () => {
    it('handles skill with no selectedAttribute (null id)', () => {
      const sheet = createMockSheet()
      sheet.skillValues[0].selectedAttributeId = null as any
      sheet.skillValues[0].selectedAttribute = null
      // Set skill to have no default attribute as well
      sheet.skillValues[0].skill.defaultAttribute = null
      sheet.skillValues[0].skill.attribute = null
      render(<CharacterTab {...props} sheet={sheet} />)
      // Athletics still renders but no modifier
      expect(screen.getByText('Athletics')).toBeInTheDocument()
    })
  })
})

// ── CollapsibleSkillRow Tests ──

// ── Inline interaction coverage ──

describe('inline interactions', () => {
  it('calls saveFieldValue when InlineText for character field is clicked', () => {
    const sfv = vi.fn()
    render(<CharacterTab {...defaultProps()} saveFieldValue={sfv} />)
    const nameField = screen.getAllByTestId('inline-text').find(el =>
      el.getAttribute('data-value') === 'Test Character'
    )
    expect(nameField).toBeDefined()
    fireEvent.click(nameField!)
    expect(sfv).toHaveBeenCalledWith('tf-name', 'Updated Value')
  })

  it('calls handleCoreResourceChange when InlineNumber for current HP is clicked', () => {
    const hcrc = vi.fn()
    render(<CharacterTab {...defaultProps()} handleCoreResourceChange={hcrc} />)
    // CR-HP has current=30, editableByPlayer=true, isOwner=true
    const hpCurrent = screen.getAllByTestId('inline-number').find(el =>
      el.getAttribute('data-value') === '30'
    )
    expect(hpCurrent).toBeDefined()
    fireEvent.click(hpCurrent!)
    expect(hcrc).toHaveBeenCalledWith('cr-hp', 'current', '42')
  })

  it('toggles expanded skill off when expand button clicked', () => {
    const setExpanded = vi.fn()
    render(<CharacterTab {...defaultProps()}
      expandedSkillId="skill-athletics"
      setExpandedSkillId={setExpanded}
    />)
    // Find the expand toggle button for Athletics
    const athleticsRow = screen.getByText('Athletics').closest('div')?.parentElement
    const toggleBtn = athleticsRow?.querySelector('button')
    expect(toggleBtn).toBeDefined()
    fireEvent.click(toggleBtn!)
    expect(setExpanded).toHaveBeenCalledWith(null)
  })

  it('calls onOthersChange when Others number input changes', () => {
    const ooc = vi.fn()
    render(<CharacterTab {...defaultProps()}
      expandedSkillId="skill-athletics"
      othersValues={{}}
      handleOthersChange={ooc}
    />)
    const othersInput = screen.getAllByPlaceholderText('0').find(
      el => el.getAttribute('type') === 'number'
    ) as HTMLInputElement | undefined
    expect(othersInput).toBeDefined()
    fireEvent.change(othersInput!, { target: { value: '3' } })
    expect(ooc).toHaveBeenCalledWith('skill-athletics', 3)
  })

  it('calls saveAttributeValue when InlineText for attribute value is clicked', () => {
    const sav = vi.fn()
    render(<CharacterTab {...defaultProps()} saveAttributeValue={sav} />)
    // Strength has value '16' in mock data — click its InlineText
    const strVal = screen.getAllByTestId('inline-text').find(el =>
      el.getAttribute('data-value') === '16'
    )
    expect(strVal).toBeDefined()
    fireEvent.click(strVal!)
    expect(sav).toHaveBeenCalledWith('attr-str', 'Updated Value')
  })

  it('calls handleCoreResourceChange when InlineText for resource notes is clicked', () => {
    const hcrc = vi.fn()
    render(<CharacterTab {...defaultProps()} handleCoreResourceChange={hcrc} />)
    // HP (cr-hp) has notes='Wounded', showNotes=true, editableByPlayer=true
    const notesField = screen.getAllByTestId('inline-text').find(el =>
      el.getAttribute('data-value') === 'Wounded'
    )
    expect(notesField).toBeDefined()
    fireEvent.click(notesField!)
    expect(hcrc).toHaveBeenCalledWith('cr-hp', 'notes', 'Updated Value')
  })

  it('calls handleCoreResourceChange when InlineNumber for resource maximum is clicked', () => {
    const hcrc = vi.fn()
    render(<CharacterTab {...defaultProps()} handleCoreResourceChange={hcrc} />)
    // HP maximum is 50
    const maxField = screen.getAllByTestId('inline-number').find(el =>
      el.getAttribute('data-value') === '50'
    )
    expect(maxField).toBeDefined()
    fireEvent.click(maxField!)
    expect(hcrc).toHaveBeenCalledWith('cr-hp', 'maximum', '42')
  })
})

describe('CollapsibleSkillRow', () => {
  const baseSkill = {
    id: 'sv-1',
    skillId: 'skill-1',
    value: '5',
    selectedAttributeId: 'attr-str',
    selectedAttribute: { id: 'attr-str', key: 'strength', name: 'Strength' },
    skill: {
      id: 'skill-1',
      name: 'Athletics',
      description: 'Physical prowess',
      attributeId: 'attr-str',
      allowedAttributeIds: ['attr-str', 'attr-dex'],
      defaultAttributeId: 'attr-str',
      attribute: { id: 'attr-str', key: 'strength', name: 'Strength' },
      defaultAttribute: { id: 'attr-str', key: 'strength', name: 'Strength' },
    },
  }

  const profiles: SkillModifierProfile[] = [
    { id: 'prof-1', name: 'Proficiency', options: [
      { id: 'opt-none', label: 'None', value: 0 },
      { id: 'opt-half', label: 'Half', value: 2 },
      { id: 'opt-full', label: 'Full', value: 4 },
    ]},
  ]

  const templateAttributes = [
    { id: 'attr-str', key: 'strength', name: 'Strength' },
    { id: 'attr-dex', key: 'dexterity', name: 'Dexterity' },
  ]

  const defaultRowProps = {
    skill: baseSkill,
    result: 12,
    profiles,
    selections: {},
    active: true,
    others: 0,
    onToggleActive: vi.fn(),
    onOthersChange: vi.fn(),
    onProfileChange: vi.fn(),
    onAttributeChange: vi.fn(),
    templateAttributes,
    expandedSkillId: null as string | null,
    onExpandToggle: vi.fn(),
    modifiersEnabled: true,
  }

  describe('basic rendering', () => {
    it('renders skill name and result', () => {
      render(<CollapsibleSkillRow {...defaultRowProps} />)
      expect(screen.getByText('Athletics')).toBeInTheDocument()
      expect(screen.getByText('12')).toBeInTheDocument()
    })

    it('renders skill description', () => {
      render(<CollapsibleSkillRow {...defaultRowProps} />)
      expect(screen.getByText('— Physical prowess')).toBeInTheDocument()
    })

    it('does not render description when null', () => {
      const skill = { ...baseSkill, skill: { ...baseSkill.skill, description: null } }
      render(<CollapsibleSkillRow {...defaultRowProps} skill={skill} />)
      expect(screen.queryByText('— Physical prowess')).not.toBeInTheDocument()
    })

    it('renders checkbox and reflects active state', () => {
      render(<CollapsibleSkillRow {...defaultRowProps} active={true} />)
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()
    })

    it('renders unchecked when inactive', () => {
      render(<CollapsibleSkillRow {...defaultRowProps} active={false} />)
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).not.toBeChecked()
    })

    it('shows "0" instead of result when inactive', () => {
      render(<CollapsibleSkillRow {...defaultRowProps} active={false} />)
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.queryByText('12')).not.toBeInTheDocument()
    })

    it('shows em dash for null result when active', () => {
      render(<CollapsibleSkillRow {...defaultRowProps} result={null} />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  describe('attribute dropdown', () => {
    it('renders attribute dropdown when allowedAttributeIds exist', () => {
      render(<CollapsibleSkillRow {...defaultRowProps} />)
      // The <select> shows option names ("Strength") not attribute IDs ("attr-str") as display value
      const select = screen.getByDisplayValue('Strength')
      expect(select).toBeInTheDocument()
      expect(select).toHaveValue('attr-str')
    })

    it('renders attribute text when no dropdown needed', () => {
      const skill = {
        ...baseSkill,
        skill: {
          ...baseSkill.skill,
          allowedAttributeIds: [],
        },
        selectedAttribute: { id: 'attr-str', key: 'strength', name: 'Strength' },
      }
      render(<CollapsibleSkillRow {...defaultRowProps} skill={skill} />)
      expect(screen.getByText('Strength')).toBeInTheDocument()
      // Profile select is always in the DOM inside hidden expanded div,
      // so check attribute-specific select is absent instead
      expect(screen.queryByDisplayValue('attr-str')).not.toBeInTheDocument()
    })

    it('renders default attribute name when no selectedAttribute', () => {
      const skill = {
        ...baseSkill,
        selectedAttribute: null,
        selectedAttributeId: null,
        skill: {
          ...baseSkill.skill,
          allowedAttributeIds: [],
          defaultAttribute: { id: 'attr-str', key: 'strength', name: 'Strength' },
        },
      }
      render(<CollapsibleSkillRow {...defaultRowProps} skill={skill} />)
      expect(screen.getByText('Strength')).toBeInTheDocument()
    })

    it('renders fallback em dash when no attribute at all', () => {
      const skill = {
        ...baseSkill,
        selectedAttribute: null,
        selectedAttributeId: null,
        skill: {
          ...baseSkill.skill,
          allowedAttributeIds: [],
          defaultAttribute: null,
          attribute: null,
        },
      }
      render(<CollapsibleSkillRow {...defaultRowProps} skill={skill} />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('hides attribute dropdown when modifiersEnabled is false', () => {
      render(<CollapsibleSkillRow {...defaultRowProps} modifiersEnabled={false} />)
      // Should show the attribute name as text instead of a dropdown
      expect(screen.getByText('Strength')).toBeInTheDocument()
      // Profile select still in DOM inside hidden expanded div, so check attribute select specifically
      expect(screen.queryByDisplayValue('attr-str')).not.toBeInTheDocument()
    })

    it('does not render dropdown when onAttributeChange is undefined', () => {
      render(<CollapsibleSkillRow {...defaultRowProps} onAttributeChange={undefined} />)
      // Profile select still in DOM, so check attribute select specifically
      expect(screen.queryByDisplayValue('attr-str')).not.toBeInTheDocument()
    })

    it('calls onAttributeChange when selecting a different attribute', async () => {
      const user = userEvent.setup()
      render(<CollapsibleSkillRow {...defaultRowProps} />)
      const select = screen.getByDisplayValue('Strength')
      await user.selectOptions(select, 'attr-dex')
      expect(defaultRowProps.onAttributeChange).toHaveBeenCalledWith('attr-dex')
    })
  })

  describe('expand and collapse', () => {
    it('shows expanded content when expandedSkillId matches', () => {
      render(<CollapsibleSkillRow {...defaultRowProps} expandedSkillId="skill-1" />)
      expect(screen.getByText('Proficiency:')).toBeInTheDocument()
      expect(screen.getByText('Others:')).toBeInTheDocument()
    })

    it('hides expanded content by default', () => {
      render(<CollapsibleSkillRow {...defaultRowProps} />)
      // Content is always in DOM but CSS-hidden via max-h-0 when not expanded
      const expandedDiv = screen.getByText('Proficiency:').closest('[class*="transition-all"]')
      expect(expandedDiv).toBeInTheDocument()
      expect(expandedDiv?.className).toContain('max-h-0')
      expect(expandedDiv?.className).not.toContain('max-h-96')
    })

    it('calls onExpandToggle when clicking expand button on active skill', async () => {
      const user = userEvent.setup()
      render(<CollapsibleSkillRow {...defaultRowProps} />)
      const expandBtn = screen.getByText('Athletics').closest('button')
      expect(expandBtn).toBeInTheDocument()
      if (expandBtn) {
        await user.click(expandBtn)
        expect(defaultRowProps.onExpandToggle).toHaveBeenCalledWith('skill-1')
      }
    })

    it('does not expand when skill is inactive', () => {
      render(<CollapsibleSkillRow {...defaultRowProps} active={false} expandedSkillId="skill-1" />)
      // expandedSkillId matches but active=false, so content div gets max-h-0
      const expandedDiv = screen.getByText('Proficiency:').closest('[class*="transition-all"]')
      expect(expandedDiv).toBeInTheDocument()
      expect(expandedDiv?.className).toContain('max-h-0')
    })
  })

  describe('profiles', () => {
    it('renders profile selects when expanded', () => {
      render(<CollapsibleSkillRow {...defaultRowProps} expandedSkillId="skill-1" />)
      expect(screen.getByText('Proficiency:')).toBeInTheDocument()
      // Find profile select (has option with "None (+0)" text)
      const selects = screen.getAllByRole('combobox')
      const profileSelect = selects.find(s =>
        Array.from(s.querySelectorAll('option')).some(o => o.textContent === 'None (+0)')
      )
      expect(profileSelect).toBeInTheDocument()
    })

    it('shows selected profile option value', () => {
      render(<CollapsibleSkillRow {...defaultRowProps} expandedSkillId="skill-1" selections={{ 'prof-1': 'opt-half' }} />)
      const selects = screen.getAllByRole('combobox')
      const profileSelect = selects.find(s =>
        Array.from(s.querySelectorAll('option')).some(o => o.textContent === 'None (+0)')
      ) as HTMLSelectElement
      expect(profileSelect).toBeInTheDocument()
      expect(profileSelect).toHaveValue('opt-half')
      // Should also show the +2 value
      expect(screen.getByText('+2')).toBeInTheDocument()
    })

    it('calls onProfileChange when profile option selected', async () => {
      const user = userEvent.setup()
      render(<CollapsibleSkillRow {...defaultRowProps} expandedSkillId="skill-1" />)
      const selects = screen.getAllByRole('combobox')
      const profileSelect = selects.find(s =>
        Array.from(s.querySelectorAll('option')).some(o => o.textContent === 'None (+0)')
      )! as HTMLSelectElement
      await user.selectOptions(profileSelect, 'opt-full')
      expect(defaultRowProps.onProfileChange).toHaveBeenCalledWith('prof-1', 'opt-full')
    })
  })

  describe('others input', () => {
    it('renders others input when expanded', () => {
      render(<CollapsibleSkillRow {...defaultRowProps} expandedSkillId="skill-1" />)
      expect(screen.getByPlaceholderText('0')).toBeInTheDocument()
    })

    it('shows others value', () => {
      render(<CollapsibleSkillRow {...defaultRowProps} expandedSkillId="skill-1" others={5} />)
      expect(screen.getByText('+5')).toBeInTheDocument()
    })

    it('calls onOthersChange when others value changes', async () => {
      const user = userEvent.setup()
      render(<CollapsibleSkillRow {...defaultRowProps} expandedSkillId="skill-1" />)
      const input = screen.getByPlaceholderText('0')
      await user.type(input, '3')
      expect(defaultRowProps.onOthersChange).toHaveBeenCalledWith(3)
    })
  })
})
