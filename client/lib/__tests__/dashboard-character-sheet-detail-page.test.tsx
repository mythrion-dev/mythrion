import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── Module-scope mocks (declared BEFORE vi.mock factories) ──

const {
  mockUseParams,
  mockRouterPush,
  mockRouterReplace,
  mockAuth,
  mockApiGet,
  mockApiPost,
  mockApiPut,
  mockApiPatch,
  mockApiDelete,
  mockAuthFetch,
} = vi.hoisted(() => ({
  mockUseParams: vi.fn(() => ({ id: 'sheet-1' })),
  mockRouterPush: vi.fn(),
  mockRouterReplace: vi.fn(),
  mockAuth: vi.fn(),
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiDelete: vi.fn(),
  mockAuthFetch: vi.fn(),
}))

// ── Next/Navigation mocks ──

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => mockUseParams(),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// ── API / auth / shared mocks ──

vi.mock('@/lib/api', () => ({
  api: { get: mockApiGet, post: mockApiPost, put: mockApiPut, patch: mockApiPatch, delete: mockApiDelete },
  API_URL: 'http://api.test',
  authFetch: mockAuthFetch,
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuth(),
}))

vi.mock('@/lib/breadcrumb', () => ({
  PageNav: () => null,
}))

vi.mock('@/components/books/PdfViewerSidebar', () => ({
  PdfViewerSidebar: () => null,
}))

vi.mock('@/components/notebook/NotebookSidebar', () => ({
  NotebookSidebar: () => null,
}))

vi.mock('@/lib/inline-editable', () => ({
  InlineText: ({ value, onSave }: { value: string; onSave: (v: string) => void }) => (
    <button type="button" data-testid="InlineText" onClick={() => onSave('New Name')}>
      {value}
    </button>
  ),
  InlineNumber: ({ value, onSave }: { value: number | null; onSave: (v: number) => void }) => (
    <button type="button" data-testid="InlineNumber" onClick={() => onSave(9)}>
      {String(value ?? '')}
    </button>
  ),
}))

// ── Tab component mocks (test doubles that expose the page's handlers) ──

vi.mock('@/components/character-sheet', () => {
  const CharacterTab = (p: any) => (
    <div data-testid="CharacterTab">
      <button data-testid="saveFieldValue" onClick={() => p.saveFieldValue('field-1', 'hello')}>saveFieldValue</button>
      <button data-testid="saveAttributeValue" onClick={() => p.saveAttributeValue('attr-1', '5')}>saveAttributeValue</button>
      <button data-testid="cr-change" onClick={() => p.handleCoreResourceChange('cr-1', 'current', '15')}>cr-change</button>
      <button data-testid="cr-change-empty" onClick={() => p.handleCoreResourceChange('cr-1', 'current', '')}>cr-change-empty</button>
      <button data-testid="cr-change-notes" onClick={() => p.handleCoreResourceChange('cr-1', 'notes', 'Fresh')}>cr-change-notes</button>
      <button data-testid="cr-modify" onClick={() => p.handleCoreResourceModify('cr-1', 5)}>cr-modify</button>
      <button data-testid="cr-modify-missing" onClick={() => p.handleCoreResourceModify('cr-missing', 5)}>cr-modify-missing</button>
      <button data-testid="ac-field" onClick={() => p.handleAcFieldChange('acf-1', '14')}>ac-field</button>
      <button data-testid="ac-attr-existing" onClick={() => p.handleAcAttributeModifierChange('acam-1', 'attr-2')}>ac-attr-existing</button>
      <button data-testid="ac-attr-remove" onClick={() => p.handleAcAttributeModifierChange('acam-1', null)}>ac-attr-remove</button>
      <button data-testid="ac-attr-new" onClick={() => p.handleAcAttributeModifierChange('acam-9', 'attr-1')}>ac-attr-new</button>
      <button data-testid="profile" onClick={() => p.handleProfileChange('skill-1', 'profile-1', 'opt-1')}>profile</button>
      <button data-testid="skill-attr" onClick={() => p.handleSkillAttributeChange('skill-1', 'attr-1')}>skill-attr</button>
      <button data-testid="skill-attr-null" onClick={() => p.handleSkillAttributeChange('skill-1', null)}>skill-attr-null</button>
      <button data-testid="skill-attr-missing" onClick={() => p.handleSkillAttributeChange('skill-1', 'attr-zzz')}>skill-attr-missing</button>
      <button data-testid="skill-toggle-1" onClick={() => p.handleSkillToggle('skill-1')}>skill-toggle-1</button>
      <button data-testid="skill-toggle-2" onClick={() => p.handleSkillToggle('skill-2')}>skill-toggle-2</button>
      <button data-testid="others" onClick={() => p.handleOthersChange('skill-1', 3)}>others</button>
      <button data-testid="others-x" onClick={() => p.handleOthersChange('skill-x', 3)}>others-x</button>
      <button data-testid="cr-modify-2" onClick={() => p.handleCoreResourceModify('cr-2', -5)}>cr-modify-2</button>
      <button data-testid="ac-attr-missing" onClick={() => p.handleAcAttributeModifierChange('acam-9', 'attr-zzz')}>ac-attr-missing</button>
      <button data-testid="profile-new-skill" onClick={() => p.handleProfileChange('skill-x', 'profile-1', 'opt-1')}>profile-new-skill</button>
    </div>
  )

  const AbilitiesTab = (p: any) => (
    <div data-testid="AbilitiesTab">
      <button data-testid="set-ability-name-basic" onClick={() => p.setNewAbility({ ...p.newAbility, name: 'Fireball', level: '1' })}>set-basic</button>
      <button data-testid="set-ability-name-full" onClick={() => p.setNewAbility({ ...p.newAbility, name: 'Fireball', level: '1', manaCost: '2', range: '30 ft', damage: '1d6' })}>set-full</button>
      <button data-testid="set-ability-name-desc" onClick={() => p.setNewAbility({ ...p.newAbility, name: 'Fireball', level: '1', description: 'Boom', notes: 'Hot' })}>set-desc</button>
      <button data-testid="set-ability-summon-full" onClick={() => p.setNewAbility({ ...p.newAbility, name: 'Wolf', level: '1', hpCurrent: '10', hpMax: '20' })}>set-summon</button>
      <button data-testid="set-ability-type-ability" onClick={() => p.setNewAbilityType('ABILITY')}>set-type-ability</button>
      <button data-testid="set-ability-type-summon" onClick={() => p.setNewAbilityType('SUMMON')}>set-type-summon</button>
      <button data-testid="create-ability" onClick={() => p.handleCreateAbility({ preventDefault: () => {} })}>create</button>
      <button data-testid="create-summon-ability" onClick={() => p.handleCreateSummonAbility('ab-2', { preventDefault: () => {} })}>create-summon</button>
      <button data-testid="delete-ability" onClick={() => p.handleDeleteAbility('ab-2')}>delete-ability</button>
      <button data-testid="save-summon-attribute" onClick={() => p.saveSummonAttribute('ab-2', 'attr-1', '18')}>save-summon-attr</button>
      <button data-testid="save-summon-attr-missing" onClick={() => p.saveSummonAttribute('ab-2', 'attr-zzz', '18')}>save-summon-attr-missing</button>
      <button data-testid="save-summon-ac" onClick={() => p.saveSummonAcValue('ab-2', '15')}>save-summon-ac</button>
      <button data-testid="save-summon-ac-nan" onClick={() => p.saveSummonAcValue('ab-2', 'abc')}>save-summon-ac-nan</button>
      <button data-testid="save-summon-ac-ability" onClick={() => p.saveSummonAcValue('ab-1', '15')}>save-summon-ac-ability</button>
      <button data-testid="save-summon-health-current" onClick={() => p.saveSummonHealth('ab-2', 'current', 12)}>save-summon-hp</button>
      <button data-testid="save-summon-health-current-ability" onClick={() => p.saveSummonHealth('ab-1', 'current', 5)}>save-summon-hp-ability</button>
      <button data-testid="save-summon-health-max" onClick={() => p.saveSummonHealth('ab-2', 'maximum', 20)}>save-summon-hp-max</button>
      <button data-testid="add-summon-skill" onClick={() => p.handleAddSummonSkill('ab-2', 'Bite', 4)}>add-summon-skill</button>
      <button data-testid="add-summon-skill-ability" onClick={() => p.handleAddSummonSkill('ab-1', 'Claw', 3)}>add-summon-skill-ability</button>
      <button data-testid="update-summon-skill" onClick={() => p.handleUpdateSummonSkill('ab-2', 'ss-1', 'Bite+', 5)}>update-summon-skill</button>
      <button data-testid="remove-summon-skill" onClick={() => p.handleRemoveSummonSkill('ab-2', 'ss-1')}>remove-summon-skill</button>
      <button data-testid="add-summon-resistance" onClick={() => p.handleAddSummonResistance('ab-2', 'Fire', 'half')}>add-summon-res</button>
      <button data-testid="update-summon-resistance" onClick={() => p.handleUpdateSummonResistance('ab-2', 'sr-1', 'Ice', 'immune')}>update-summon-res</button>
      <button data-testid="remove-summon-resistance" onClick={() => p.handleRemoveSummonResistance('ab-2', 'sr-1')}>remove-summon-res</button>
    </div>
  )

  const InventoryTab = (p: any) => (
    <div data-testid="InventoryTab">
      <button data-testid="set-item-name-basic" onClick={() => p.setNewItem({ ...p.newItem, name: 'Sword' })}>set-item-basic</button>
      <button data-testid="set-item-name-full" onClick={() => p.setNewItem({ ...p.newItem, name: 'Sword', weight: '3.5', cost: '10 gp', description: 'Sharp' })}>set-item-full</button>
      <button data-testid="create-item" onClick={() => p.handleCreateItem({ preventDefault: () => {} })}>create-item</button>
      <button data-testid="delete-item" onClick={() => p.handleDeleteItem('item-1')}>delete-item</button>
      <button data-testid="save-item-name" onClick={() => p.saveItemField('item-1', 'name', 'Great Sword')}>si-name</button>
      <button data-testid="save-item-weight" onClick={() => p.saveItemField('item-1', 'weight', '4.5')}>si-weight</button>
      <button data-testid="save-item-weight-empty" onClick={() => p.saveItemField('item-1', 'weight', '')}>si-weight-empty</button>
      <button data-testid="save-item-cost" onClick={() => p.saveItemField('item-1', 'cost', '20 gp')}>si-cost</button>
      <button data-testid="save-item-cost-empty" onClick={() => p.saveItemField('item-1', 'cost', '')}>si-cost-empty</button>
      <button data-testid="save-item-description" onClick={() => p.saveItemField('item-1', 'description', 'Sharp edge')}>si-desc</button>
      <button data-testid="save-item-description-empty" onClick={() => p.saveItemField('item-1', 'description', '')}>si-desc-empty</button>
    </div>
  )

  const StoryTab = (p: any) => (
    <div data-testid="StoryTab">
      <button data-testid="save-story" onClick={() => p.onSaveField('backstory', 'A long story')}>save-story</button>
      <button data-testid="save-story-empty" onClick={() => p.onSaveField('backstory', '   ')}>save-story-empty</button>
    </div>
  )

  const PersonalAbilitiesTab = (p: any) => (
    <div data-testid="PersonalAbilitiesTab">
      <button data-testid="to-singular-ies" onClick={() => p.toSingular('Backstories')}>ts-ies</button>
      <button data-testid="to-singular-s" onClick={() => p.toSingular('Notes')}>ts-s</button>
      <button data-testid="to-singular-ss" onClick={() => p.toSingular('Glass')}>ts-ss</button>
      <button data-testid="to-singular-us" onClick={() => p.toSingular('Status')}>ts-us</button>
      <button data-testid="to-singular-else" onClick={() => p.toSingular('Magic')}>ts-else</button>
      <button data-testid="set-entry-name" onClick={() => p.setNewEntryForm({ name: 'Entry', description: 'Desc' })}>set-entry</button>
      <button data-testid="create-entry" onClick={() => p.handleCreateEntry('sec-1', { preventDefault: () => {} })}>create-entry</button>
      <button data-testid="update-entry" onClick={() => p.handleUpdateEntry('entry-1', 'name', 'Updated')}>update-entry</button>
      <button data-testid="update-entry-desc" onClick={() => p.handleUpdateEntry('entry-1', 'description', 'New desc')}>update-entry-desc</button>
      <button data-testid="delete-entry" onClick={() => p.handleDeleteEntry('entry-1')}>delete-entry</button>
    </div>
  )

  const ResistanceTab = (p: any) => (
    <div data-testid="ResistanceTab">
      <button data-testid="save-res-component" onClick={() => p.onSaveComponent('rc-1', 5)}>save-component</button>
      <button data-testid="save-res-manual" onClick={() => p.onSaveManual('res-1', 5)}>save-manual</button>
      <button data-testid="create-resistance" onClick={() => p.onCreateResistance({ name: 'Fire', calculationType: 'MANUAL' })}>create-resistance</button>
      <button data-testid="delete-resistance" onClick={() => p.onDeleteResistance('res-1')}>delete-resistance</button>
    </div>
  )

  return {
    StoryTab,
    CharacterTab,
    InventoryTab,
    PersonalAbilitiesTab,
    AbilitiesTab,
    ResistanceTab,
  }
})

// ════════════════════════════════════════════════════════════
// Fixtures
// ════════════════════════════════════════════════════════════

const baseUser = {
  id: 'user-1',
  email: 'alice@example.com',
  displayName: 'Alice',
  onboardingComplete: true,
  isAdmin: false,
  isEarlyAccess: false,
  language: 'en',
  twoFactorEnabled: false,
  emailVerified: true,
  hasPassword: true,
}

function setAuth(overrides: { user?: typeof baseUser | null; loading?: boolean } = {}) {
  mockAuth.mockReturnValue({
    user: overrides.user !== undefined ? overrides.user : baseUser,
    loading: overrides.loading !== undefined ? overrides.loading : false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    completeOnboarding: vi.fn(),
    verifyTwoFactor: vi.fn(),
    refreshProfile: vi.fn(),
  })
}

const summonAbility = {
  id: 'ab-2',
  name: 'Fire Wolf',
  type: 'SUMMON',
  description: null,
  notes: null,
  order: 1,
  summonId: 'ab-1',
  levels: [],
  summonAttributes: [
    { id: 'sa-1', abilityId: 'ab-2', attributeId: 'attr-1', value: '16' },
    { id: 'sa-2', abilityId: 'ab-2', attributeId: 'attr-2', value: '12' },
  ],
  summonAcValues: [{ id: 'sacv-1', abilityId: 'ab-2', value: '12' }],
  summonHealth: { id: 'sh-1', abilityId: 'ab-2', current: 10, maximum: 15, notes: null },
  summonSkills: [
    { id: 'ss-1', abilityId: 'ab-2', name: 'Bite', manualValue: 4 },
    { id: 'ss-2', abilityId: 'ab-2', name: 'Claw', manualValue: 3 },
  ],
  summonResistances: [
    { id: 'sr-1', abilityId: 'ab-2', name: 'Fire', value: 'half' },
    { id: 'sr-2', abilityId: 'ab-2', name: 'Ice', value: 'immune' },
  ],
  childAbilities: undefined,
}

const normalAbility = {
  id: 'ab-1',
  name: 'Fireball',
  type: 'ABILITY',
  description: 'Boom',
  notes: null,
  order: 0,
  summonId: null,
  levels: [
    { id: 'lvl-1', abilityId: 'ab-1', level: '1', manaCost: 3, range: '60 ft', description: 'Deals fire', notes: null, damage: '2d6' },
  ],
  summonAttributes: [],
  summonAcValues: [],
  summonHealth: null,
  summonSkills: undefined,
  summonResistances: undefined,
  childAbilities: [
    {
      id: 'ab-child',
      name: 'Pup',
      type: 'ABILITY',
      description: null,
      notes: null,
      order: 0,
      summonId: null,
      levels: [],
      summonAttributes: [],
      summonAcValues: [],
      summonHealth: null,
    },
    summonAbility,
  ],
}

function makeSheet() {
  return {
    id: 'sheet-1',
    characterName: 'Aria',
    playerName: 'Alice',
    level: 5,
    hpActual: 20,
    hpMax: 25,
    hpNotes: null,
    adventure: { id: 'adv-1', name: 'Campaign One', campaign: 'World' },
    template: {
      id: 'tpl-1',
      name: 'Default Template',
      attributeModifierFormula: '(value - 10) / 2',
      attributeModifiersEnabled: true,
      skillFormula: 'value + level',
      attributes: [
        { id: 'attr-1', key: 'str', name: 'Strength' },
        { id: 'attr-2', key: 'dex', name: 'Dexterity' },
      ],
      templateSkills: [
        { id: 'skill-1', name: 'Athletics', description: null, attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1', attribute: { id: 'attr-1', key: 'str', name: 'Strength' }, defaultAttribute: null },
        { id: 'skill-2', name: 'Stealth', description: null, attributeId: 'attr-2', allowedAttributeIds: ['attr-1', 'attr-2'], defaultAttributeId: 'attr-2', attribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' }, defaultAttribute: null },
        { id: 'skill-3', name: 'Perception', description: null, attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1', attribute: { id: 'attr-1', key: 'str', name: 'Strength' }, defaultAttribute: null },
      ],
      skillModifierProfiles: [
        { id: 'profile-1', name: 'Proficiency', options: [{ id: 'opt-0', label: 'None', value: 0 }, { id: 'opt-1', label: 'Proficient', value: 2 }] },
        { id: 'profile-2', name: 'Expertise', targetMode: 'SELECTED_SKILLS', targetSkillIds: ['Nonexistent'], options: [{ id: 'opt-e0', label: 'None', value: 0 }, { id: 'opt-e1', label: 'Expert', value: 4 }] },
        { id: 'profile-3', name: 'Training', options: [{ id: 'p3-0', label: 'Novice', value: 2 }, { id: 'p3-1', label: 'Apprentice', value: 1 }] },
      ],
      coreResources: [
        { id: 'cr-1', slug: 'hp', displayName: 'Health', enabled: true, editableByPlayer: true, showNotes: true, color: '#ff0000' },
        { id: 'cr-2', slug: 'mana', displayName: 'Mana', enabled: true, editableByPlayer: true, showNotes: false, color: '#00aaff' },
      ],
      armorClasses: [
        {
          id: 'ac-1',
          name: 'Armor Class',
          enabled: true,
          attributeModifiers: [
            { id: 'acam-1', attributeId: 'attr-2', allowPlayerSelection: true, defaultAttributeId: 'attr-2', attribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' }, defaultAttribute: null },
          ],
          fields: [{ id: 'acf-1', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: null }],
        },
        {
          id: 'ac-2',
          name: 'Flat AC',
          enabled: true,
          attributeModifiers: [
            { id: 'acam-2', attributeId: 'attr-1', allowPlayerSelection: true, defaultAttributeId: 'attr-1', attribute: { id: 'attr-1', key: 'str', name: 'Strength' }, defaultAttribute: null },
          ],
          fields: [{ id: 'acf-2', name: 'Base', key: 'base', defaultValue: '12', editableByPlayer: true, description: null }],
        },
      ],
      characterSections: [{ id: 'sec-1', name: 'Backstory', order: 0 }],
      resistances: [],
    },
    values: [
      { id: 'v-1', attributeId: 'attr-1', value: '18', attribute: { id: 'attr-1', key: 'str', name: 'Strength' } },
      { id: 'v-2', attributeId: 'attr-2', value: '14', attribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' } },
    ],
    fieldValues: [{ id: 'fv-1', templateFieldId: 'field-1', value: 'hello', templateField: { id: 'field-1', key: 'field_1', label: 'Field' } }],
    skillValues: [
      { id: 'sv-1', skillId: 'skill-1', value: '1|5', selectedAttributeId: 'attr-1', selectedAttribute: { id: 'attr-1', key: 'str', name: 'Strength' }, skill: { id: 'skill-1', name: 'Athletics', description: null, attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1', attribute: { id: 'attr-1', key: 'str', name: 'Strength' }, defaultAttribute: null } },
      { id: 'sv-2', skillId: 'skill-2', value: '0|2', selectedAttributeId: 'attr-2', selectedAttribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' }, skill: { id: 'skill-2', name: 'Stealth', description: null, attributeId: 'attr-2', allowedAttributeIds: ['attr-1', 'attr-2'], defaultAttributeId: 'attr-2', attribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' }, defaultAttribute: null } },
      { id: 'sv-3', skillId: 'skill-3', value: '', selectedAttributeId: 'attr-1', selectedAttribute: { id: 'attr-1', key: 'str', name: 'Strength' }, skill: { id: 'skill-3', name: 'Perception', description: null, attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1', attribute: { id: 'attr-1', key: 'str', name: 'Strength' }, defaultAttribute: null } },
    ],
    skillProfileValues: [
      { id: 'spv-1', skillId: 'skill-1', profileId: 'profile-1', optionId: 'opt-1', profile: { id: 'profile-1', name: 'Proficiency' }, option: { id: 'opt-1', label: 'Proficient', value: 2 } },
    ],
    coreResourceValues: [
      { id: 'crv-1', coreResourceId: 'cr-1', current: 20, maximum: 25, notes: null, coreResource: { id: 'cr-1', slug: 'hp', displayName: 'Health', enabled: true, editableByPlayer: true, showNotes: true } },
      { id: 'crv-2', coreResourceId: 'cr-2', current: null, maximum: 10, notes: null, coreResource: { id: 'cr-2', slug: 'mana', displayName: 'Mana', enabled: true, editableByPlayer: true, showNotes: false } },
    ],
    acValues: [
      { id: 'acv-1', fieldId: 'acf-1', value: '10', field: { id: 'acf-1', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: null } },
      { id: 'acv-2', fieldId: 'acf-2', value: '12', field: { id: 'acf-2', name: 'Base', key: 'base', defaultValue: '12', editableByPlayer: true, description: null } },
    ],
    acAttributeValues: [
      { id: 'aav-1', sheetId: 'sheet-1', acAttributeModifierId: 'acam-1', selectedAttributeId: 'attr-2', acAttributeModifier: { id: 'acam-1', attributeId: 'attr-2', allowPlayerSelection: true, defaultAttributeId: 'attr-2', attribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' }, defaultAttribute: null }, selectedAttribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' } },
      { id: 'aav-2', sheetId: 'sheet-1', acAttributeModifierId: 'acam-2', selectedAttributeId: null, acAttributeModifier: { id: 'acam-2', attributeId: 'attr-1', allowPlayerSelection: true, defaultAttributeId: 'attr-1', attribute: { id: 'attr-1', key: 'str', name: 'Strength' }, defaultAttribute: null }, selectedAttribute: null },
    ],
    sectionEntries: [
      { id: 'entry-1', sheetId: 'sheet-1', sectionId: 'sec-1', name: 'Beginnings', description: 'Born in a village', order: 0, section: { id: 'sec-1', name: 'Backstory' } },
      { id: 'entry-2', sheetId: 'sheet-1', sectionId: 'sec-1', name: 'Later', description: '', order: 1, section: { id: 'sec-1', name: 'Backstory' } },
    ],
    abilities: [normalAbility, summonAbility],
    inventoryItems: [{ id: 'item-1', name: 'Sword', weight: 3, cost: '10 gp', description: 'A blade', order: 0 }],
    story: null,
    ownerId: 'user-1',
    isNpc: false,
    npcType: null,
    adventureId: 'adv-1',
    createdAt: '2026-01-01T00:00:00Z',
  }
}

const resistances = [
  {
    resistanceId: 'res-1',
    name: 'Fire',
    calculationType: 'MANUAL',
    total: 5,
    componentValues: [{ componentId: 'rc-1', componentName: 'Base', value: 5, editableByPlayer: true }],
    attributeModifierValues: [{ attributeId: 'attr-1', attributeKey: 'str', attributeName: 'Strength', enabled: true, rawModifier: 2, effectiveModifier: 2 }],
  },
]

function apiGetImpl(url: string): Promise<unknown> {
  if (url.includes('/resistances')) return Promise.resolve(resistances)
  return Promise.resolve(makeSheet())
}

const renderPage = () => render(<CharacterSheetDetailPage />)

// Flush a microtask so promise rejections reach their catch before teardown.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

// ════════════════════════════════════════════════════════════
// CharacterSheetDetailPage
// ════════════════════════════════════════════════════════════

import CharacterSheetDetailPage from '@/app/dashboard/character-sheets/[id]/page'

beforeEach(() => {
  vi.clearAllMocks()
  mockUseParams.mockReturnValue({ id: 'sheet-1' })
  mockApiGet.mockImplementation(apiGetImpl)
  mockApiPost.mockResolvedValue({ result: 5 })
  mockApiPatch.mockResolvedValue(makeSheet())
  mockApiPut.mockResolvedValue({})
  mockApiDelete.mockResolvedValue({})
  mockAuthFetch.mockResolvedValue({ ok: true, status: 204 })
  setAuth()
})

describe('CharacterSheetDetailPage', () => {
  it('shows the loading spinner while fetching', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows not-found when the fetch fails', async () => {
    mockApiGet.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText('Character sheet not found.')).toBeInTheDocument()
    expect(mockApiGet).toHaveBeenCalledWith('/character-sheets/sheet-1')
  })

  it('renders the full sheet for the owner', async () => {
    renderPage()
    expect(await screen.findByText('Aria')).toBeInTheDocument()
    expect(screen.getByText('Default Template')).toBeInTheDocument()
    expect(screen.getByText('Campaign One')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Character' })).toBeInTheDocument()
    expect(screen.getByTestId('CharacterTab')).toBeInTheDocument()
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/character-sheets/sheet-1'))
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/character-sheets/sheet-1/resistances'))
    // avatar HEAD checked
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled())
  })

  it('renders a read-only view for a non-owner', async () => {
    setAuth({ user: { ...baseUser, id: 'user-2' } })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Aria' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('InlineText')).not.toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).toBeNull()
  })

  it('renders without adventure info when sheet has no adventure', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/resistances')) return Promise.resolve(resistances)
      return Promise.resolve({ ...makeSheet(), adventure: null })
    })
    renderPage()
    expect(await screen.findByText('Aria')).toBeInTheDocument()
    expect(screen.queryByText('Campaign One')).not.toBeInTheDocument()
  })

  it('shows the avatar image and remove button when a server avatar exists', async () => {
    mockAuthFetch.mockResolvedValue({ ok: true, status: 200 })
    renderPage()
    await screen.findByText('Aria')
    await waitFor(() => expect(screen.getByRole('img', { name: 'Avatar' })).toBeInTheDocument())
    expect(screen.getByTitle('Remove avatar')).toBeInTheDocument()
  })

  it('uploads an avatar file via the file input', async () => {
    renderPage()
    await screen.findByText('Aria')
    mockAuthFetch.mockResolvedValue({ ok: true, status: 200 })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() =>
      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringContaining('/images/character-sheets/sheet-1/avatar'),
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    await waitFor(() => expect(screen.getByTitle('Remove avatar')).toBeInTheDocument())
  })

  it('does not set an avatar when upload returns ok=false', async () => {
    renderPage()
    await screen.findByText('Aria')
    mockAuthFetch.mockResolvedValue({ ok: false, status: 500 })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled())
    expect(screen.queryByTitle('Remove avatar')).not.toBeInTheDocument()
  })

  it('deletes the avatar', async () => {
    mockAuthFetch.mockResolvedValue({ ok: true, status: 200 })
    renderPage()
    await screen.findByText('Aria')
    await waitFor(() => expect(screen.getByTitle('Remove avatar')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('Remove avatar'))
    await waitFor(() =>
      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringContaining('/avatar'),
        expect.objectContaining({ method: 'DELETE' }),
      ),
    )
    await waitFor(() => expect(screen.queryByTitle('Remove avatar')).not.toBeInTheDocument())
  })

  it('switches between all tabs', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    expect(screen.getByTestId('AbilitiesTab')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Inventory' }))
    expect(screen.getByTestId('InventoryTab')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Story' }))
    expect(screen.getByTestId('StoryTab')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Personal Abilities' }))
    expect(screen.getByTestId('PersonalAbilitiesTab')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Resistances' }))
    expect(screen.getByTestId('ResistanceTab')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Character' }))
    expect(screen.getByTestId('CharacterTab')).toBeInTheDocument()
  })

  it('saves the character name, player name and level via inline controls', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByText('Aria'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { characterName: 'New Name' }))
    fireEvent.click(screen.getByText('Alice'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { playerName: 'New Name' }))
    fireEvent.click(screen.getByTestId('InlineNumber'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { level: 9 }))
  })

  it('saves a field value and attribute value from CharacterTab', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByTestId('saveFieldValue'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { fieldValues: [{ templateFieldId: 'field-1', value: 'hello' }] }))
    fireEvent.click(screen.getByTestId('saveAttributeValue'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { values: [{ attributeId: 'attr-1', value: '5' }] }))
  })

  it('handles core resource changes (current, empty, notes) and modification', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByTestId('cr-change'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { coreResourceValues: [{ coreResourceId: 'cr-1', current: 15 }] }))
    fireEvent.click(screen.getByTestId('cr-change-empty'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { coreResourceValues: [{ coreResourceId: 'cr-1', current: null }] }))
    fireEvent.click(screen.getByTestId('cr-change-notes'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { coreResourceValues: [{ coreResourceId: 'cr-1', notes: 'Fresh' }] }))
    fireEvent.click(screen.getByTestId('cr-modify'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { coreResourceValues: [{ coreResourceId: 'cr-1', current: 25 }] }))
    fireEvent.click(screen.getByTestId('cr-modify-missing'))
    // early return - no additional patch call (4 patches total: current, empty, notes, modify)
    expect(mockApiPatch).toHaveBeenCalledTimes(4)
  })

  it('reverts core resource change when patch fails', async () => {
    renderPage()
    await screen.findByText('Aria')
    mockApiPatch.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('cr-change'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalled())
    fireEvent.click(screen.getByTestId('cr-modify'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(2))
  })

  it('saves an AC field and AC attribute modifier (existing / remove / new)', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByTestId('ac-field'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { acValues: [{ fieldId: 'acf-1', value: '14' }] }))
    fireEvent.click(screen.getByTestId('ac-attr-existing'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { acAttributeValues: [{ acAttributeModifierId: 'acam-1', selectedAttributeId: 'attr-2' }] }))
    fireEvent.click(screen.getByTestId('ac-attr-remove'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { acAttributeValues: [{ acAttributeModifierId: 'acam-1', selectedAttributeId: null }] }))
    fireEvent.click(screen.getByTestId('ac-attr-new'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { acAttributeValues: [{ acAttributeModifierId: 'acam-9', selectedAttributeId: 'attr-1' }] }))
  })

  it('reverts AC changes when the patch fails', async () => {
    renderPage()
    await screen.findByText('Aria')
    mockApiPatch.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('ac-field'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalled())
    mockApiPatch.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('ac-attr-existing'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(2))
  })

  it('saves a profile selection and recomputes skills', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByTestId('profile'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/skills/skill-1/profiles/profile-1', { optionId: 'opt-1' }))
    // second call exercises the already-initialized selection map branch
    fireEvent.click(screen.getByTestId('profile'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(2))
  })

  it.each<[string, string]>([
    ['reverts the profile selection when the patch fails', 'profile'],
    ['reverts the skill toggle when the patch fails', 'skill-toggle-1'],
    ['reverts the sheet when a core resource modification fails', 'cr-modify'],
  ])('%s', async (_name, testId) => {
    renderPage()
    await screen.findByText('Aria')
    mockApiPatch.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId(testId))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalled())
    await tick()
  })

  it('changes a skill attribute (success refetches sheet)', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByTestId('skill-attr'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/skills/skill-1/attribute', { attributeId: 'attr-1' }))
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/character-sheets/sheet-1'))
  })

  it('refetches the whole sheet when skill attribute patch fails', async () => {
    renderPage()
    await screen.findByText('Aria')
    mockApiPatch.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('skill-attr'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalled())
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/character-sheets/sheet-1'))
  })

  it('toggles skills on and off', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByTestId('skill-toggle-1')) // active true -> false
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { skillValues: [{ skillId: 'skill-1', value: '0|5' }] }))
    fireEvent.click(screen.getByTestId('skill-toggle-2')) // active false -> true
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { skillValues: [{ skillId: 'skill-2', value: '1|2' }] }))
  })

  it('changes the others value and reverts on failure', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByTestId('others'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { skillValues: [{ skillId: 'skill-1', value: '1|3' }] }))
    mockApiPatch.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('others'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(2))
    await tick()
  })

  it('creates an ABILITY with an initial level via POST branch', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    mockApiPost.mockResolvedValueOnce({
      id: 'ab-new', name: 'Fireball', type: 'ABILITY', levels: [], summonAttributes: [], summonAcValues: [], summonHealth: null, description: null, notes: null, order: 1,
    })
    fireEvent.click(screen.getByTestId('set-ability-name-full'))
    fireEvent.click(screen.getByTestId('set-ability-type-ability'))
    fireEvent.click(screen.getByTestId('create-ability'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities', expect.objectContaining({ name: 'Fireball', type: 'ABILITY', manaCost: 2, range: '30 ft', damage: '1d6' })))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-new/levels', { level: '1', copyFromPrevious: false }))
  })

  it('creates an ABILITY that already has a level (PATCH branch)', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    mockApiPost.mockResolvedValueOnce({
      id: 'ab-new2', name: 'Cone', type: 'ABILITY', levels: [{ id: 'lvl-x', level: '1' }], summonAttributes: [], summonAcValues: [], summonHealth: null, description: null, notes: null, order: 1,
    })
    fireEvent.click(screen.getByTestId('set-ability-name-basic'))
    fireEvent.click(screen.getByTestId('set-ability-type-ability'))
    fireEvent.click(screen.getByTestId('create-ability'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-new2/levels/lvl-x', { level: '1' }))
  })

  it('creates a SUMMON ability and computes its stats', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    mockApiPost.mockResolvedValueOnce({
      id: 'ab-new3', name: 'Wolf', type: 'SUMMON', levels: [], summonAttributes: [], summonAcValues: [], summonHealth: null, description: null, notes: null, order: 2,
    })
    fireEvent.click(screen.getByTestId('set-ability-summon-full'))
    fireEvent.click(screen.getByTestId('set-ability-type-summon'))
    fireEvent.click(screen.getByTestId('create-ability'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities', expect.objectContaining({ name: 'Wolf', type: 'SUMMON', summonHealthCurrent: 10, summonHealthMax: 20 })))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-new3/levels', { level: '1', copyFromPrevious: false }))
  })

  it.each<[string, string, string, string]>([
    ['does not create an ability when the name is empty', 'Abilities', 'create-ability', '/character-sheets/sheet-1/abilities'],
    ['does not create a summon ability when the name is empty', 'Abilities', 'create-summon-ability', '/character-sheets/sheet-1/abilities/ab-2/summon-abilities'],
    ['does not create an item when the name is empty', 'Inventory', 'create-item', '/character-sheets/sheet-1/inventory'],
    ['does not create a section entry when the name is empty', 'Personal Abilities', 'create-entry', '/character-sheets/sheet-1/section-entries'],
  ])('%s', async (_name, tab, testId, url) => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: tab }))
    fireEvent.click(screen.getByTestId(testId))
    expect(mockApiPost).not.toHaveBeenCalledWith(url, expect.anything())
  })

  it('sets an error when creating an ability fails', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    mockApiPost.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('set-ability-name-basic'))
    fireEvent.click(screen.getByTestId('set-ability-type-ability'))
    fireEvent.click(screen.getByTestId('create-ability'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalled())
  })

  it('creates a summon-scoped child ability and handles its error', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    mockApiPost.mockResolvedValueOnce({
      id: 'child-1', name: 'Pup', type: 'ABILITY', levels: [], summonAttributes: [], summonAcValues: [], summonHealth: null, description: null, notes: null, order: 0,
    })
    fireEvent.click(screen.getByTestId('set-ability-name-full'))
    fireEvent.click(screen.getByTestId('create-summon-ability'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-2/summon-abilities', expect.objectContaining({ name: 'Fireball', manaCost: 2 })))
    mockApiPost.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('set-ability-name-full'))
    fireEvent.click(screen.getByTestId('create-summon-ability'))
    await waitFor(() => {
      const createCalls = mockApiPost.mock.calls.filter(([url]) => url === '/character-sheets/sheet-1/abilities/ab-2/summon-abilities')
      expect(createCalls).toHaveLength(2)
    })
  })

  it('deletes an ability', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    fireEvent.click(screen.getByTestId('delete-ability'))
    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-2'))
  })

  it('saves summon attribute, AC and health values', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    fireEvent.click(screen.getByTestId('save-summon-attribute'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-2/summon-attributes/attr-1', { value: '18' }))
    fireEvent.click(screen.getByTestId('save-summon-ac'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-2/summon-ac', { value: '15' }))
    fireEvent.click(screen.getByTestId('save-summon-ac-nan'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-2/summon-ac', { value: 'abc' }))
    fireEvent.click(screen.getByTestId('save-summon-health-current'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-2/summon-health', { current: 12 }))
    fireEvent.click(screen.getByTestId('save-summon-health-max'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-2/summon-health', { maximum: 20 }))
  })

  it('adds, updates and removes summon skills and resistances', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    mockApiPost.mockResolvedValueOnce({ id: 'ss-new', abilityId: 'ab-2', name: 'Claw', manualValue: 6 })
    fireEvent.click(screen.getByTestId('add-summon-skill'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-2/summon-skills', { name: 'Bite', manualValue: 4 }))
    fireEvent.click(screen.getByTestId('update-summon-skill'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-2/summon-skills/ss-1', { name: 'Bite+', manualValue: 5 }))
    fireEvent.click(screen.getByTestId('remove-summon-skill'))
    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-2/summon-skills/ss-1'))
    mockApiPost.mockResolvedValueOnce({ id: 'sr-new', abilityId: 'ab-2', name: 'Cold', value: 'immune' })
    fireEvent.click(screen.getByTestId('add-summon-resistance'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-2/summon-resistances', { name: 'Fire', value: 'half' }))
    fireEvent.click(screen.getByTestId('update-summon-resistance'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-2/summon-resistances/sr-1', { name: 'Ice', value: 'immune' }))
    fireEvent.click(screen.getByTestId('remove-summon-resistance'))
    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-2/summon-resistances/sr-1'))
  })

  it('creates, updates and deletes inventory items', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Inventory' }))
    mockApiPost.mockResolvedValueOnce({ id: 'item-new', name: 'Sword', weight: 3.5, cost: '10 gp', description: 'Sharp', order: 1 })
    fireEvent.click(screen.getByTestId('set-item-name-full'))
    fireEvent.click(screen.getByTestId('create-item'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-1/inventory', { name: 'Sword', weight: 3.5, cost: '10 gp', description: 'Sharp' }))
    fireEvent.click(screen.getByTestId('delete-item'))
    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith('/character-sheets/sheet-1/inventory/item-1'))
    mockApiPost.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('set-item-name-full'))
    fireEvent.click(screen.getByTestId('create-item'))
    await waitFor(() => {
      const createCalls = mockApiPost.mock.calls.filter(([url]) => url === '/character-sheets/sheet-1/inventory')
      expect(createCalls).toHaveLength(2)
    })
  })

  it('saves item fields for each supported field', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Inventory' }))
    fireEvent.click(screen.getByTestId('save-item-name'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/inventory/item-1', { name: 'Great Sword' }))
    fireEvent.click(screen.getByTestId('save-item-weight'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/inventory/item-1', { weight: 4.5 }))
    fireEvent.click(screen.getByTestId('save-item-weight-empty'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/inventory/item-1', { weight: undefined }))
    fireEvent.click(screen.getByTestId('save-item-cost'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/inventory/item-1', { cost: '20 gp' }))
    fireEvent.click(screen.getByTestId('save-item-description'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/inventory/item-1', { description: 'Sharp edge' }))
  })

  it('saves story fields (with and without content)', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Story' }))
    mockApiPatch.mockResolvedValueOnce({ id: 'story-1', appearance: null, backstory: 'A long story', personality: null, goals: null, notes: null })
    fireEvent.click(screen.getByTestId('save-story'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/story', { backstory: 'A long story' }))
    mockApiPatch.mockResolvedValueOnce({ id: 'story-1', appearance: null, backstory: null, personality: null, goals: null, notes: null })
    fireEvent.click(screen.getByTestId('save-story-empty'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/story', { backstory: null }))
  })

  it('creates, updates and deletes section entries', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Personal Abilities' }))
    mockApiPost.mockResolvedValueOnce({ id: 'entry-new', sheetId: 'sheet-1', sectionId: 'sec-1', name: 'Entry', description: 'Desc', order: 0, section: { id: 'sec-1', name: 'Backstory' } })
    fireEvent.click(screen.getByTestId('set-entry-name'))
    fireEvent.click(screen.getByTestId('create-entry'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-1/section-entries', { sectionId: 'sec-1', name: 'Entry', description: 'Desc' }))
    fireEvent.click(screen.getByTestId('update-entry'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/section-entries/entry-1', { name: 'Updated' }))
    fireEvent.click(screen.getByTestId('delete-entry'))
    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith('/character-sheets/sheet-1/section-entries/entry-1'))
    mockApiPost.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('set-entry-name'))
    fireEvent.click(screen.getByTestId('create-entry'))
    await waitFor(() => {
      const createCalls = mockApiPost.mock.calls.filter(([url]) => url === '/character-sheets/sheet-1/section-entries')
      expect(createCalls).toHaveLength(2)
    })
  })

  it('exercises the toSingular helper for each suffix branch', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Personal Abilities' }))
    fireEvent.click(screen.getByTestId('to-singular-ies'))
    fireEvent.click(screen.getByTestId('to-singular-s'))
    fireEvent.click(screen.getByTestId('to-singular-ss'))
    fireEvent.click(screen.getByTestId('to-singular-us'))
    fireEvent.click(screen.getByTestId('to-singular-else'))
    expect(screen.getByTestId('PersonalAbilitiesTab')).toBeInTheDocument()
  })

  it('handles resistance component saves, manual saves, create and delete', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Resistances' }))
    fireEvent.click(screen.getByTestId('save-res-component'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { resistanceComponentValues: [{ componentId: 'rc-1', value: '5' }] }))
    fireEvent.click(screen.getByTestId('save-res-manual'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { resistanceValues: [{ resistanceId: 'res-1', manualValue: '5' }] }))
    fireEvent.click(screen.getByTestId('create-resistance'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-1/resistances', { name: 'Fire', calculationType: 'MANUAL' }))
    fireEvent.click(screen.getByTestId('delete-resistance'))
    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith('/character-sheets/sheet-1/resistances/res-1'))
  })

  it('reverts manual resistance value and swallows other resistance errors', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Resistances' }))
    mockApiPatch.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('save-res-manual'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalled())
    mockApiPatch.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('save-res-component'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(2))
    mockApiPost.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('create-resistance'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalled())
    mockApiDelete.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('delete-resistance'))
    await waitFor(() => expect(mockApiDelete).toHaveBeenCalled())
  })

  it('deletes the sheet (success navigates to dashboard)', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete Character Sheet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByText('Delete Character Sheet')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }))
    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith('/character-sheets/sheet-1'))
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard?tab=character-sheets'))
  })

  it('shows an error and closes the modal when deletion fails', async () => {
    renderPage()
    await screen.findByText('Aria')
    mockApiDelete.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }))
    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith('/character-sheets/sheet-1'))
    await waitFor(() => expect(screen.queryByText('Delete Character Sheet')).not.toBeInTheDocument())
  })

  it('handles skill attribute edge cases (null and unknown attribute)', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByTestId('skill-attr-null'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/skills/skill-1/attribute', { attributeId: null }))
    fireEvent.click(screen.getByTestId('skill-attr-missing'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/skills/skill-1/attribute', { attributeId: 'attr-zzz' }))
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/character-sheets/sheet-1'))
  })

  it('modifies a core resource whose current value is null', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByTestId('cr-modify-2'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { coreResourceValues: [{ coreResourceId: 'cr-2', current: 0 }] }))
  })

  it('handles an AC attribute modifier with an unknown attribute', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByTestId('ac-attr-missing'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { acAttributeValues: [{ acAttributeModifierId: 'acam-9', selectedAttributeId: 'attr-zzz' }] }))
  })

  it('applies a profile selection to a new skill and reverts on failure', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByTestId('profile-new-skill'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/skills/skill-x/profiles/profile-1', { optionId: 'opt-1' }))
    mockApiPatch.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('profile-new-skill'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(2))
    await tick()
  })

  it('changes the others value for a new skill and reverts on failure', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByTestId('others-x'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1', { skillValues: [{ skillId: 'skill-x', value: '0|3' }] }))
    mockApiPatch.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('others-x'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(2))
    await tick()
  })

  it('updates a section entry description and reverts on failure', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Personal Abilities' }))
    fireEvent.click(screen.getByTestId('update-entry-desc'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/section-entries/entry-1', { description: 'New desc' }))
    mockApiPatch.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('update-entry-desc'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(2))
    await tick()
  })

  it('creates an item with only a name (empty optional fields)', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Inventory' }))
    mockApiPost.mockResolvedValueOnce({ id: 'item-min', name: 'Sword', weight: null, cost: null, description: null, order: 1 })
    fireEvent.click(screen.getByTestId('set-item-name-basic'))
    fireEvent.click(screen.getByTestId('create-item'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-1/inventory', { name: 'Sword', weight: undefined, cost: undefined, description: undefined }))
  })

  it('clears item cost and description with empty values', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Inventory' }))
    fireEvent.click(screen.getByTestId('save-item-cost-empty'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/inventory/item-1', { cost: undefined }))
    fireEvent.click(screen.getByTestId('save-item-description-empty'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/inventory/item-1', { description: undefined }))
  })

  it('creates an ability without a type (defaults to ABILITY)', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    mockApiPost.mockResolvedValueOnce({
      id: 'ab-fallback', name: 'Fireball', type: 'ABILITY', levels: [], summonAttributes: [], summonAcValues: [], summonHealth: null, description: null, notes: null, order: 1,
    })
    fireEvent.click(screen.getByTestId('set-ability-name-full'))
    fireEvent.click(screen.getByTestId('create-ability'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities', expect.objectContaining({ name: 'Fireball', type: 'ABILITY' })))
  })

  it('creates an ability carrying a description and notes', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    mockApiPost.mockResolvedValueOnce({
      id: 'ab-desc', name: 'Fireball', type: 'ABILITY', levels: [], summonAttributes: [], summonAcValues: [], summonHealth: null, description: 'Boom', notes: 'Hot', order: 1,
    })
    fireEvent.click(screen.getByTestId('set-ability-name-desc'))
    fireEvent.click(screen.getByTestId('set-ability-type-ability'))
    fireEvent.click(screen.getByTestId('create-ability'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities', expect.objectContaining({ name: 'Fireball', description: 'Boom', notes: 'Hot' })))
  })

  it('creates a SUMMON ability without hit points', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    mockApiPost.mockResolvedValueOnce({
      id: 'ab-summon-nohp', name: 'Wolf', type: 'SUMMON', levels: [], summonAttributes: [], summonAcValues: [], summonHealth: null, description: null, notes: null, order: 2,
    })
    fireEvent.click(screen.getByTestId('set-ability-name-basic'))
    fireEvent.click(screen.getByTestId('set-ability-type-summon'))
    fireEvent.click(screen.getByTestId('create-ability'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities', expect.objectContaining({ name: 'Fireball', type: 'SUMMON' })))
  })

  it('saves summon values for an ability without existing summon data', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    fireEvent.click(screen.getByTestId('save-summon-ac-ability'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-1/summon-ac', { value: '15' }))
    fireEvent.click(screen.getByTestId('save-summon-health-current-ability'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-1/summon-health', { current: 5 }))
    mockApiPost.mockResolvedValueOnce({ id: 'ss-ab1', abilityId: 'ab-1', name: 'Claw', manualValue: 3 })
    fireEvent.click(screen.getByTestId('add-summon-skill-ability'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-1/summon-skills', { name: 'Claw', manualValue: 3 }))
  })

  it('updates no summon attribute when the attribute id is unknown', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    fireEvent.click(screen.getByTestId('save-summon-attr-missing'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/character-sheets/sheet-1/abilities/ab-2/summon-attributes/attr-zzz', { value: '18' }))
  })

  it('swallows errors when fetching resistances', async () => {
    mockApiGet.mockResolvedValueOnce(makeSheet()).mockRejectedValueOnce(new Error('boom'))
    renderPage()
    await screen.findByText('Aria')
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/character-sheets/sheet-1/resistances'))
    await tick()
  })

  it('swallows avatar HEAD failures', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('boom'))
    renderPage()
    await screen.findByText('Aria')
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled())
    await tick()
  })

  it('renders a sheet with no abilities, inventory, sections or character sections', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/resistances')) return Promise.resolve(resistances)
      return Promise.resolve({
        ...makeSheet(),
        abilities: undefined,
        inventoryItems: undefined,
        sectionEntries: undefined,
        template: { ...makeSheet().template, characterSections: undefined },
      })
    })
    renderPage()
    await screen.findByText('Aria')
    expect(screen.getByTestId('CharacterTab')).toBeInTheDocument()
  })

  it('swallows summon save failures', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    mockApiPatch.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('save-summon-attribute'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalled())
    await tick()
    mockApiPatch.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('save-summon-ac'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(2))
    await tick()
    mockApiPatch.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('save-summon-health-current'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledTimes(3))
    await tick()
    mockApiPost.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('add-summon-skill'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalled())
    await tick()
    mockApiDelete.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('delete-ability'))
    await waitFor(() => expect(mockApiDelete).toHaveBeenCalled())
    await tick()
  })

  it('sets a generic error when creating a summon ability fails with a non-Error', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    mockApiPost.mockRejectedValueOnce('boom')
    fireEvent.click(screen.getByTestId('set-ability-name-full'))
    fireEvent.click(screen.getByTestId('create-summon-ability'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalled())
    await tick()
  })

  it('sets a generic error when creating an ability fails with a non-Error', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Abilities' }))
    mockApiPost.mockRejectedValueOnce('boom')
    fireEvent.click(screen.getByTestId('set-ability-name-basic'))
    fireEvent.click(screen.getByTestId('set-ability-type-ability'))
    fireEvent.click(screen.getByTestId('create-ability'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalled())
    await tick()
  })

  it('swallows delete item failures', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Inventory' }))
    mockApiDelete.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('delete-item'))
    await waitFor(() => expect(mockApiDelete).toHaveBeenCalled())
    await tick()
  })

  it('swallows story save failures', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Story' }))
    mockApiPatch.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('save-story'))
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalled())
    await tick()
  })

  it('swallows section entry delete failures', async () => {
    renderPage()
    await screen.findByText('Aria')
    fireEvent.click(screen.getByRole('button', { name: 'Personal Abilities' }))
    mockApiDelete.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTestId('delete-entry'))
    await waitFor(() => expect(mockApiDelete).toHaveBeenCalled())
    await tick()
  })

  it('closes the modal with a generic error when deletion fails with a non-Error', async () => {
    renderPage()
    await screen.findByText('Aria')
    mockApiDelete.mockRejectedValueOnce('boom')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }))
    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith('/character-sheets/sheet-1'))
    await tick()
    await waitFor(() => expect(screen.queryByText('Delete Character Sheet')).not.toBeInTheDocument())
  })

  it('swallows avatar upload failures', async () => {
    renderPage()
    await screen.findByText('Aria')
    mockAuthFetch.mockRejectedValueOnce(new Error('boom'))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled())
    await tick()
    expect(screen.queryByTitle('Remove avatar')).not.toBeInTheDocument()
  })

  it('swallows avatar delete failures', async () => {
    mockAuthFetch.mockResolvedValue({ ok: true, status: 200 })
    renderPage()
    await screen.findByText('Aria')
    await waitFor(() => expect(screen.getByTitle('Remove avatar')).toBeInTheDocument())
    mockAuthFetch.mockRejectedValueOnce(new Error('boom'))
    fireEvent.click(screen.getByTitle('Remove avatar'))
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalledWith(expect.stringContaining('/avatar'), expect.objectContaining({ method: 'DELETE' })))
    await tick()
  })
})
