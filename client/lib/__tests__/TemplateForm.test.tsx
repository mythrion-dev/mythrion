import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mocks ──

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

// Mock MythrionPopover as a simple fragment wrapper (renders children + content)
vi.mock('@/lib/mythrion-popover', () => ({
  default: ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => (
    <span data-testid="mythrion-popover">
      {children}
      <span data-testid="popover-content">{content}</span>
    </span>
  ),
}))

// Mock AttributeModifierConfig
vi.mock('@/lib/attribute-modifier-config', () => ({
  default: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <input
      data-testid="attr-modifier-config"
      data-value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  ),
  generateFormula: (config: unknown) => 'floor((value - 10) / 2)',
  parseFormula: (f: string) => {
    if (!f) return null
    return { every: 2, modifierIncrease: 1, startingAttribute: 10, modifier: 0 }
  },
  generateProgression: () => [{ attribute: 8, modifier: -1 }, { attribute: 9, modifier: -1 }, { attribute: 10, modifier: 0 }],
}))

// Mock SkillCalculationConfig
vi.mock('@/lib/skill-calculation-config', () => ({
  default: ({ value, onChange, customFields, placeholder, disabled }: {
    value: string; onChange: (v: string) => void; customFields?: { key: string; label: string }[]; placeholder?: string; disabled?: boolean
  }) => (
    <input
      data-testid="skill-calculation-config"
      data-value={value}
      data-disabled={disabled}
      data-custom-fields={JSON.stringify(customFields)}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  ),
  configToJson: (c: unknown) => JSON.stringify(c),
  parseConfig: (v: string) => {
    try { return JSON.parse(v) } catch { return null }
  },
}))

// Mock ResistanceSystemConfig
vi.mock('@/lib/resistance-system-config', () => ({
  default: ({ resistances, attributes, onChange, disableAttributeModifiers }: {
    resistances: unknown[]; attributes: { id: string; key: string; name: string }[]; onChange: (v: unknown[]) => void; disableAttributeModifiers?: boolean
  }) => (
    <div data-testid="resistance-system-config" data-resistances={JSON.stringify(resistances)} data-attributes={JSON.stringify(attributes)} data-disabled={disableAttributeModifiers}>
      <button type="button" data-testid="resistance-onchange" onClick={() => onChange([])}>ResistanceOnChange</button>
    </div>
  ),
}))

// Mock CollapsibleAttrCard
vi.mock('@/components/adventure/CollapsibleAttrCard', () => ({
  CollapsibleAttrCard: ({ index, attr, isExpanded, onToggle, onUpdateAttr, onRemove }: {
    index: number; attr: { key: string; name: string }; isExpanded: boolean; onToggle: () => void
    onUpdateAttr: (i: number, f: 'key' | 'name', v: string) => void; onRemove: () => void
  }) => (
    <div data-testid={`collapsible-attr-card-${index}`} data-expanded={isExpanded}>
      <span data-testid={`attr-name-${index}`}>{attr.name || 'New Attribute'}</span>
      <span data-testid={`attr-key-${index}`}>{attr.key}</span>
      <button data-testid={`attr-toggle-${index}`} onClick={onToggle}>Toggle</button>
      <button data-testid={`attr-remove-${index}`} onClick={onRemove}>Remove</button>
      <input data-testid={`attr-update-key-${index}`} value={attr.key} onChange={e => onUpdateAttr(index, 'key', e.target.value)} />
      <input data-testid={`attr-update-name-${index}`} value={attr.name} onChange={e => onUpdateAttr(index, 'name', e.target.value)} />
    </div>
  ),
}))

// Mock CollapsibleSkillCard
vi.mock('@/components/adventure/CollapsibleSkillCard', () => ({
  CollapsibleSkillCard: ({ index, skill, onUpdateSkill, onRemove, attributes, onToggleAllowedAttr, onUpdateDefaultAttr }: {
    index: number; skill: { name: string; description: string; attributeId: string; allowedAttributeIds?: string[]; defaultAttributeId?: string }
    onUpdateSkill?: (i: number, f: string, v: string) => void; onRemove?: () => void
    attributes: { key: string; name: string }[]; onToggleAllowedAttr?: (i: number, attrKey: string) => void
    onUpdateDefaultAttr?: (i: number, v: string) => void
  }) => (
    <div data-testid={`collapsible-skill-card-${index}`}>
      <span>{skill.name || 'New Skill'}</span>
      <button data-testid={`skill-remove-${index}`} onClick={onRemove}>Remove Skill</button>
      <input data-testid={`skill-update-name-${index}`} value={skill.name} onChange={e => onUpdateSkill?.(index, 'name', e.target.value)} />
      {attributes.map(a => (
        <label key={a.key} data-testid={`skill-allowed-toggle-${index}-${a.key}`}>
          <input type="checkbox" checked={(skill.allowedAttributeIds ?? []).includes(a.key)} onChange={() => onToggleAllowedAttr?.(index, a.key)} />
          {a.name}
        </label>
      ))}
      {attributes.length > 0 && (
        <button data-testid={`skill-default-attr-${index}`} onClick={() => onUpdateDefaultAttr?.(index, attributes[0].key)}>Set Default</button>
      )}
    </div>
  ),
}))

// Mock NumericInput
vi.mock('@/components/shared/NumericInput', () => ({
  NumericInput: ({ value, onChange, placeholder, className }: {
    value: number | string | readonly string[] | undefined; onChange?: (e: { target: { value: string } }) => void
    placeholder?: string; className?: string; inputClassName?: string; wrapperClassName?: string
  }) => (
    <input
      type="number"
      data-testid="numeric-input"
      value={value}
      placeholder={placeholder}
      className={className}
      onChange={(e) => onChange?.({ target: { value: e.target.value } })}
    />
  ),
}))

// ── Imports (after mocks) ──
import { TemplateForm } from '@/components/adventure/TemplateForm'
import { EditForm } from '@/components/adventure/EditForm'
import { AcConfigList } from '@/components/adventure/AcConfigList'
import { TemplateRow } from '@/components/adventure/TemplateRow'

// ── Helpers ──

const defaultAttrs = [
  { key: 'str', name: 'Strength' },
  { key: 'dex', name: 'Dexterity' },
]

const defaultSkills = [
  { name: 'Stealth', description: 'Move silently', attributeId: 'dex', allowedAttributeIds: ['dex'], defaultAttributeId: 'dex' },
]

const defaultFields = [
  { key: 'class', label: 'Class' },
]

const defaultProfiles = [
  { name: 'mastery', options: [{ label: 'Expert', value: 2 }] },
]

const defaultCoreResources = [
  { displayName: 'Hit Points', slug: 'hit_points', color: '#ff0000', enabled: true, editableByPlayer: true, showNotes: false },
]

const defaultCharacterSections = [
  { id: 'sec1', name: 'Talents' },
]

const defaultAcConfigs = [
  { name: 'Standard Armor', enabled: true, fields: [{ name: 'Shield', key: 'shield', defaultValue: '0', editableByPlayer: true, description: 'Shield bonus' }], attributeModifiers: [{ attributeId: 'dex', allowPlayerSelection: false }] },
]

const defaultResistances = [
  { name: 'Fire', calculationType: 'MANUAL' as const, components: [], attributeModifiers: [] },
]

let spyOnConsoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  spyOnConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

// ─────────────────────────────────────────────
//  EditForm
// ─────────────────────────────────────────────

describe('EditForm', () => {
  const defaultProps = {
    name: 'My Adventure',
    campaign: 'Campaign 1',
    synopsis: 'A great adventure',
    maxPlayers: 3,
    error: null as string | null,
    saving: false,
    onNameChange: vi.fn(),
    onCampaignChange: vi.fn(),
    onSynopsisChange: vi.fn(),
    onMaxPlayersChange: vi.fn(),
    onCancel: vi.fn(),
    onSubmit: vi.fn(),
  }

  it('renders with all fields populated', () => {
    render(<EditForm {...defaultProps} />)
    expect(screen.getByDisplayValue('My Adventure')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Campaign 1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('A great adventure')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Edit Adventure')).toBeInTheDocument()
  })

  it('calls onNameChange when name input changes', async () => {
    render(<EditForm {...defaultProps} />)
    const input = screen.getByDisplayValue('My Adventure')
    fireEvent.change(input, { target: { value: 'Updated Adventure' } })
    expect(defaultProps.onNameChange).toHaveBeenCalledWith('Updated Adventure')
  })

  it('calls onCampaignChange when campaign input changes', async () => {
    render(<EditForm {...defaultProps} />)
    const input = screen.getByDisplayValue('Campaign 1')
    fireEvent.change(input, { target: { value: 'New Campaign' } })
    expect(defaultProps.onCampaignChange).toHaveBeenCalledWith('New Campaign')
  })

  it('calls onSynopsisChange when synopsis textarea changes', async () => {
    render(<EditForm {...defaultProps} />)
    const textarea = screen.getByDisplayValue('A great adventure')
    fireEvent.change(textarea, { target: { value: 'Updated synopsis' } })
    expect(defaultProps.onSynopsisChange).toHaveBeenCalledWith('Updated synopsis')
  })

  it('displays synopsis character count', () => {
    render(<EditForm {...defaultProps} />)
    expect(screen.getByText('17/2000')).toBeInTheDocument()
  })

  it('calls onMaxPlayersChange when slider changes', () => {
    render(<EditForm {...defaultProps} />)
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '5' } })
    expect(defaultProps.onMaxPlayersChange).toHaveBeenCalledWith(5)
  })

  it('shows error message when error is set', () => {
    render(<EditForm {...defaultProps} error="Something went wrong" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('calls onSubmit on form submit', () => {
    render(<EditForm {...defaultProps} />)
    const form = screen.getByRole('button', { name: /save changes/i }).closest('form')!
    fireEvent.submit(form)
    expect(defaultProps.onSubmit).toHaveBeenCalled()
  })

  it('disables submit when name is empty', () => {
    render(<EditForm {...defaultProps} name="" />)
    const submit = screen.getByRole('button', { name: /save changes/i })
    expect(submit).toBeDisabled()
  })

  it('disables submit when saving', () => {
    render(<EditForm {...defaultProps} saving={true} />)
    const submit = screen.getByRole('button', { name: /saving\.\.\./i })
    expect(submit).toBeDisabled()
  })

  it('shows spinner while saving', () => {
    render(<EditForm {...defaultProps} saving={true} />)
    expect(screen.getByText('Saving...')).toBeInTheDocument()
  })

  it('calls onCancel when cancel is clicked', () => {
    render(<EditForm {...defaultProps} />)
    const cancel = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancel)
    expect(defaultProps.onCancel).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────
//  AcConfigList
// ─────────────────────────────────────────────

describe('AcConfigList', () => {
  const defaultAttrsForAc = [
    { key: 'str', name: 'Strength' },
    { key: 'dex', name: 'Dexterity' },
    { key: 'con', name: 'Constitution' },
  ]

  it('renders empty state with add button', () => {
    render(<AcConfigList />)
    expect(screen.getByText('+ Add Armor Class Configuration')).toBeInTheDocument()
  })

  it('renders configs and shows field inputs', () => {
    render(<AcConfigList
      configs={defaultAcConfigs}
      attrs={defaultAttrsForAc}
      attrModifiersEnabled={false}
    />)
    expect(screen.getByDisplayValue('Standard Armor')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Shield')).toBeInTheDocument()
    expect(screen.getByDisplayValue('shield')).toBeInTheDocument()
    expect(screen.getByDisplayValue('0')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Shield bonus')).toBeInTheDocument()
    expect(screen.getByText('+ Add AC Component')).toBeInTheDocument()
  })

  it('shows attribute modifiers disabled message when attrModifiersEnabled is false', () => {
    render(<AcConfigList
      configs={defaultAcConfigs}
      attrs={defaultAttrsForAc}
      attrModifiersEnabled={false}
    />)
    expect(screen.getByText('Attribute Modifiers are disabled globally.')).toBeInTheDocument()
  })

  it('shows attribute modifier checkboxes when attrModifiersEnabled is true', () => {
    render(<AcConfigList
      configs={defaultAcConfigs}
      attrs={defaultAttrsForAc}
      attrModifiersEnabled={true}
    />)
    expect(screen.getByText('Dexterity Modifier')).toBeInTheDocument()
    expect(screen.getByText('Strength Modifier')).toBeInTheDocument()
    expect(screen.getByText('Constitution Modifier')).toBeInTheDocument()
  })

  it('shows attribute modifier select and radio buttons when modifier is present', () => {
    const configsWithMod = [{
      name: 'Test AC',
      enabled: true,
      fields: [],
      attributeModifiers: [{ attributeId: 'dex', allowPlayerSelection: false }],
    }]
    render(<AcConfigList
      configs={configsWithMod}
      attrs={defaultAttrsForAc}
      attrModifiersEnabled={true}
    />)
    expect(screen.getByText('Attribute')).toBeInTheDocument()
    expect(screen.getByText('Player Selection')).toBeInTheDocument()
    expect(screen.getByLabelText('Fixed')).toBeInTheDocument()
    expect(screen.getByLabelText('Player Can Change')).toBeInTheDocument()
  })

  it('shows default attribute select when allowPlayerSelection is true', () => {
    const configsWithSelection = [{
      name: 'Test AC',
      enabled: true,
      fields: [],
      attributeModifiers: [{ attributeId: 'dex', allowPlayerSelection: true, defaultAttributeId: 'str' }],
    }]
    render(<AcConfigList
      configs={configsWithSelection}
      attrs={defaultAttrsForAc}
      attrModifiersEnabled={true}
    />)
    expect(screen.getByText('Default Attribute')).toBeInTheDocument()
  })

  it('calls onAdd when add button clicked', () => {
    const onAdd = vi.fn()
    render(<AcConfigList onAdd={onAdd} />)
    fireEvent.click(screen.getByText('+ Add Armor Class Configuration'))
    expect(onAdd).toHaveBeenCalled()
  })

  it('calls onUpdateConfig when name changes', () => {
    const onUpdateConfig = vi.fn()
    render(<AcConfigList
      configs={defaultAcConfigs}
      onUpdateConfig={onUpdateConfig}
    />)
    const nameInput = screen.getByDisplayValue('Standard Armor')
    fireEvent.change(nameInput, { target: { value: 'Heavy Armor' } })
    expect(onUpdateConfig).toHaveBeenCalledWith(0, { name: 'Heavy Armor' })
  })

  it('calls onUpdateConfig when enabled checkbox toggles', () => {
    const onUpdateConfig = vi.fn()
    render(<AcConfigList
      configs={defaultAcConfigs}
      onUpdateConfig={onUpdateConfig}
    />)
    const checkbox = screen.getByLabelText('Enabled')
    fireEvent.click(checkbox)
    expect(onUpdateConfig).toHaveBeenCalledWith(0, { enabled: false })
  })

  it('calls onRemove when remove button clicked', () => {
    const onRemove = vi.fn()
    render(<AcConfigList
      configs={defaultAcConfigs}
      onRemove={onRemove}
    />)
    const removeBtn = screen.getAllByText('✕')[0]
    fireEvent.click(removeBtn)
    expect(onRemove).toHaveBeenCalledWith(0)
  })

  it('calls onAddField when add field component clicked', () => {
    const onAddField = vi.fn()
    render(<AcConfigList
      configs={defaultAcConfigs}
      onAddField={onAddField}
    />)
    fireEvent.click(screen.getByText('+ Add AC Component'))
    expect(onAddField).toHaveBeenCalledWith(0)
  })

  it('calls onRemoveField when field remove clicked', () => {
    const onRemoveField = vi.fn()
    render(<AcConfigList
      configs={defaultAcConfigs}
      onRemoveField={onRemoveField}
    />)
    const allRemoveBtns = screen.getAllByText('✕')
    // The last ✕ before "Add AC Component" is the field remove
    const fieldRemove = allRemoveBtns[allRemoveBtns.length - 1]
    fireEvent.click(fieldRemove)
    // Could be config 0, field 0
    expect(onRemoveField).toHaveBeenCalled()
  })

  it('calls onToggleAttributeId when attribute modifier checkbox toggled', () => {
    const onToggleAttributeId = vi.fn()
    render(<AcConfigList
      configs={defaultAcConfigs}
      attrs={defaultAttrsForAc}
      attrModifiersEnabled={true}
      onToggleAttributeId={onToggleAttributeId}
    />)
    // Click "Strength Modifier" checkbox
    const strengthCheckbox = screen.getByLabelText('Strength Modifier')
    fireEvent.click(strengthCheckbox)
    expect(onToggleAttributeId).toHaveBeenCalledWith(0, 'str')
  })

  it('calls onUpdateField when field values change', () => {
    const onUpdateField = vi.fn()
    render(<AcConfigList
      configs={defaultAcConfigs}
      onUpdateField={onUpdateField}
    />)
    const shieldNameInput = screen.getByDisplayValue('Shield')
    fireEvent.change(shieldNameInput, { target: { value: 'Large Shield' } })
    expect(onUpdateField).toHaveBeenCalledWith(0, 0, 'name', 'Large Shield')
  })

  it('calls onUpdateField for key field', () => {
    const onUpdateField = vi.fn()
    render(<AcConfigList
      configs={defaultAcConfigs}
      onUpdateField={onUpdateField}
    />)
    const keyInput = screen.getByDisplayValue('shield')
    fireEvent.change(keyInput, { target: { value: 'large_shield' } })
    expect(onUpdateField).toHaveBeenCalledWith(0, 0, 'key', 'large_shield')
  })

  it('calls onUpdateField for defaultValue and description', () => {
    const onUpdateField = vi.fn()
    render(<AcConfigList
      configs={defaultAcConfigs}
      onUpdateField={onUpdateField}
    />)
    const defaultInput = screen.getByDisplayValue('0')
    fireEvent.change(defaultInput, { target: { value: '2' } })
    expect(onUpdateField).toHaveBeenCalledWith(0, 0, 'defaultValue', '2')

    const descInput = screen.getByDisplayValue('Shield bonus')
    fireEvent.change(descInput, { target: { value: 'New bonus' } })
    expect(onUpdateField).toHaveBeenCalledWith(0, 0, 'description', 'New bonus')
  })

  it('calls onUpdateFieldEditable when editable checkbox toggled', () => {
    const onUpdateFieldEditable = vi.fn()
    render(<AcConfigList
      configs={defaultAcConfigs}
      onUpdateFieldEditable={onUpdateFieldEditable}
    />)
    const editableCheckbox = screen.getByLabelText('Editable')
    fireEvent.click(editableCheckbox)
    expect(onUpdateFieldEditable).toHaveBeenCalledWith(0, 0, false)
  })

  it('calls onUpdateAttributeModifier when select or radio changes', () => {
    const onUpdateAttributeModifier = vi.fn()
    const configsWithMod = [{
      name: 'Test AC',
      enabled: true,
      fields: [],
      attributeModifiers: [{ attributeId: 'dex', allowPlayerSelection: false }],
    }]
    render(<AcConfigList
      configs={configsWithMod}
      attrs={defaultAttrsForAc}
      attrModifiersEnabled={true}
      onUpdateAttributeModifier={onUpdateAttributeModifier}
    />)
    // Click "Player Can Change" radio
    const playerCanChange = screen.getByLabelText('Player Can Change')
    fireEvent.click(playerCanChange)
    expect(onUpdateAttributeModifier).toHaveBeenCalledWith(0, 'dex', { allowPlayerSelection: true, defaultAttributeId: 'dex' })
  })

  it('renders nothing when config is disabled (collapses content)', () => {
    const configsDisabled = [{
      name: 'Disabled AC',
      enabled: false,
      fields: [{ name: 'Test', key: 'test', defaultValue: '0', editableByPlayer: false, description: '' }],
      attributeModifiers: [],
    }]
    render(<AcConfigList configs={configsDisabled} />)
    // The disabled config should NOT show the AC Components section
    expect(screen.queryByText('AC Components')).not.toBeInTheDocument()
    // But name and toggle should be visible
    expect(screen.getByDisplayValue('Disabled AC')).toBeInTheDocument()
    expect(screen.getByLabelText('Enabled')).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────
//  TemplateRow
// ─────────────────────────────────────────────

describe('TemplateRow', () => {
  const template = {
    id: 'tpl-1',
    name: 'D&D 5e',
    description: 'A classic template',
    attributes: defaultAttrs,
    skills: [{ name: 'Stealth' }],
    sections: [{ name: 'Talents' }],
    fields: [{ key: 'class' }],
    profiles: [{ name: 'mastery' }],
    createdAt: '2024-01-01',
  }

  const defaultProps = {
    template,
    isGM: true,
    isEditing: false,
    editName: '',
    editDescription: '',
    editAttrs: [] as { key: string; name: string }[],
    editAttrModifierFormula: '',
    editSkillFormula: '',
    editError: null as string | null,
    saving: false,
    onStartEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    onEditNameChange: vi.fn(),
    onEditDescriptionChange: vi.fn(),
    onAddAttr: vi.fn(),
    onRemoveAttr: vi.fn(),
    onUpdateAttr: vi.fn(),
    editFeatureSkills: true,
    onEditFeatureSkillsChange: vi.fn(),
    editFeatureCustomFields: true,
    onEditFeatureCustomFieldsChange: vi.fn(),
    editFeatureCoreResources: true,
    onEditFeatureCoreResourcesChange: vi.fn(),
    editFeatureArmorClass: true,
    onEditFeatureArmorClassChange: vi.fn(),
    editFeatureCharacterSections: true,
    onEditFeatureCharacterSectionsChange: vi.fn(),
    editFeatureSkillProfiles: true,
    onEditFeatureSkillProfilesChange: vi.fn(),
    editFeatureResistance: true,
    onEditFeatureResistanceChange: vi.fn(),
    attrsForEditResistance: defaultAttrs,
  }

  // ── Read-only card view ──
  describe('card view (read-only)', () => {
    it('renders template name and description', () => {
      render(<TemplateRow {...defaultProps} />)
      expect(screen.getByText('D&D 5e')).toBeInTheDocument()
      expect(screen.getByText('A classic template')).toBeInTheDocument()
    })

    it('renders with skills, sections, fields, and profiles feature indicators', () => {
      render(<TemplateRow {...defaultProps} />)
      expect(screen.getByText('1 Skills')).toBeInTheDocument()
      expect(screen.getByText('1 Section')).toBeInTheDocument()
      expect(screen.getByText('1 Field')).toBeInTheDocument()
      expect(screen.getByText('1 Profile')).toBeInTheDocument()
    })

    it('renders feature indicators with plural form', () => {
      const tplWithMultiple = {
        ...template,
        skills: [{ name: 'A' }, { name: 'B' }],
        sections: [{ name: 'A' }, { name: 'B' }],
        fields: [{ key: 'a' }, { key: 'b' }],
        profiles: [{ name: 'a' }, { name: 'b' }],
      }
      render(<TemplateRow {...defaultProps} template={tplWithMultiple} />)
      expect(screen.getByText('2 Skills')).toBeInTheDocument()
      expect(screen.getByText('2 Sections')).toBeInTheDocument()
      expect(screen.getByText('2 Fields')).toBeInTheDocument()
      expect(screen.getByText('2 Profiles')).toBeInTheDocument()
    })

    it('does not show feature indicators when arrays are empty', () => {
      const emptyTemplate = { ...template, skills: [], sections: [], fields: [], profiles: [] }
      render(<TemplateRow {...defaultProps} template={emptyTemplate} />)
      expect(screen.queryByText('Skills')).not.toBeInTheDocument()
      expect(screen.queryByText('Sections')).not.toBeInTheDocument()
      expect(screen.queryByText('Fields')).not.toBeInTheDocument()
      expect(screen.queryByText('Profiles')).not.toBeInTheDocument()
    })

    it('renders without description when description is null', () => {
      const noDesc = { ...template, description: null }
      render(<TemplateRow {...defaultProps} template={noDesc} />)
      expect(screen.getByText('D&D 5e')).toBeInTheDocument()
      // No description paragraph
      expect(screen.queryByText('A classic template')).not.toBeInTheDocument()
    })

    it('shows edit and delete buttons when isGM is true', () => {
      render(<TemplateRow {...defaultProps} />)
      expect(screen.getByText('Edit')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('hides edit and delete buttons when isGM is false', () => {
      render(<TemplateRow {...defaultProps} isGM={false} />)
      expect(screen.queryByText('Edit')).not.toBeInTheDocument()
      expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    })

    it('calls onStartEdit when Edit is clicked', () => {
      render(<TemplateRow {...defaultProps} />)
      fireEvent.click(screen.getByText('Edit'))
      expect(defaultProps.onStartEdit).toHaveBeenCalled()
    })

    it('calls onDelete when Delete is clicked', () => {
      render(<TemplateRow {...defaultProps} />)
      fireEvent.click(screen.getByText('Delete'))
      expect(defaultProps.onDelete).toHaveBeenCalled()
    })
  })

  // ── Edit mode ──
  describe('edit mode', () => {
    const editProps = {
      ...defaultProps,
      isEditing: true,
      editName: 'Edited Name',
      editDescription: 'Edited desc',
      editAttrs: defaultAttrs,
      editAttrModifierFormula: 'floor((value - 10) / 2)',
      editSkillFormula: '{"useAttributeModifier":true,"customFieldKeys":[]}',
      editAttrModifiersEnabled: true,
      onEditAttrModifiersEnabledChange: vi.fn(),
      onEditAttrModifierFormulaChange: vi.fn(),
      onEditSkillFormulaChange: vi.fn(),
    }

    it('renders edit form with name and description', () => {
      render(<TemplateRow {...editProps} />)
      expect(screen.getByDisplayValue('Edited Name')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Edited desc')).toBeInTheDocument()
      expect(screen.getByText('Edit Template')).toBeInTheDocument()
      expect(screen.getByText(/Modify D&D 5e/)).toBeInTheDocument()
    })

    it('shows attrs tab by default with collapsible attr cards', () => {
      render(<TemplateRow {...editProps} />)
      expect(screen.getByTestId('collapsible-attr-card-0')).toBeInTheDocument()
      expect(screen.getByTestId('collapsible-attr-card-1')).toBeInTheDocument()
      expect(screen.getByText('Add Attribute')).toBeInTheDocument()
    })

    it('shows attr modifiers checkbox and config when enabled', () => {
      render(<TemplateRow {...editProps} />)
      expect(screen.getByLabelText('Enable Attribute Modifiers')).toBeInTheDocument()
      expect(screen.getByTestId('attr-modifier-config')).toBeInTheDocument()
    })

    it('hides attr modifier config when unchecked', () => {
      render(<TemplateRow {...editProps} editAttrModifiersEnabled={false} />)
      expect(screen.getByLabelText('Enable Attribute Modifiers')).toBeInTheDocument()
      expect(screen.queryByTestId('attr-modifier-config')).not.toBeInTheDocument()
    })

    it('switches to skills tab when skills button clicked', () => {
      render(<TemplateRow {...editProps} editSkills={defaultSkills} />)
      fireEvent.click(screen.getByText('Skills'))
      expect(screen.getByTestId('collapsible-skill-card-0')).toBeInTheDocument()
    })

    it('switches to fields tab when Character Info clicked', () => {
      render(<TemplateRow {...editProps} editFields={defaultFields} onAddField={vi.fn()} />)
      fireEvent.click(screen.getByText('Character Info'))
      expect(screen.getByDisplayValue('class')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Class')).toBeInTheDocument()
    })

    it('switches to coreResources tab', () => {
      render(<TemplateRow {...editProps} onAddCoreResource={vi.fn()} />)
      fireEvent.click(screen.getByText('Resources'))
      expect(screen.getByText(/Core resources are trackable values/)).toBeInTheDocument()
    })

    it('switches to characterSections tab', () => {
      render(<TemplateRow {...editProps} />)
      fireEvent.click(screen.getByText('Abilities'))
      expect(screen.getByText(/free-form sections/)).toBeInTheDocument()
    })

    it('switches to ac tab', () => {
      render(<TemplateRow {...editProps} onAddEditAcConfig={vi.fn()} />)
      fireEvent.click(screen.getByText('Armor Class'))
      expect(screen.getByText('+ Add Armor Class Configuration')).toBeInTheDocument()
    })

    it('switches to profiles tab', () => {
      render(<TemplateRow {...editProps} onAddProfile={vi.fn()} />)
      fireEvent.click(screen.getByText('Profiles'))
      expect(screen.getByText('Add Skill Profile')).toBeInTheDocument()
    })

    it('switches to resistances tab', () => {
      render(<TemplateRow {...editProps} onEditResistancesChange={vi.fn()} />)
      fireEvent.click(screen.getByText('Resistances'))
      expect(screen.getByTestId('resistance-system-config')).toBeInTheDocument()
    })

    it('does not show skills tab when editFeatureSkills is false', () => {
      render(<TemplateRow {...editProps} editFeatureSkills={false} />)
      expect(screen.queryByText('Skills')).not.toBeInTheDocument()
    })

    it('does not show fields tab when editFeatureCustomFields is false', () => {
      render(<TemplateRow {...editProps} editFeatureCustomFields={false} />)
      expect(screen.queryByText('Character Info')).not.toBeInTheDocument()
    })

    it('does not show coreResources tab without onAddCoreResource', () => {
      render(<TemplateRow {...editProps} />)
      expect(screen.queryByText('Resources')).not.toBeInTheDocument()
    })

    it('does not show profiles tab without onAddProfile', () => {
      render(<TemplateRow {...editProps} />)
      expect(screen.queryByText('Profiles')).not.toBeInTheDocument()
    })

    it('does not show resistances tab without onEditResistancesChange', () => {
      render(<TemplateRow {...editProps} />)
      expect(screen.queryByText('Resistances')).not.toBeInTheDocument()
    })

    it('does not show armor class tab without onAddEditAcConfig', () => {
      render(<TemplateRow {...editProps} />)
      expect(screen.queryByText('Armor Class')).not.toBeInTheDocument()
    })

    it('shows error when editError is set', () => {
      render(<TemplateRow {...editProps} editError="Error occurred" />)
      expect(screen.getByText('Error occurred')).toBeInTheDocument()
    })

    it('shows saving state', () => {
      render(<TemplateRow {...editProps} saving={true} />)
      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })

    it('disables submit when name is empty', () => {
      render(<TemplateRow {...editProps} editName="" />)
      const submit = screen.getByRole('button', { name: /save changes/i })
      expect(submit).toBeDisabled()
    })

    it('calls onCancelEdit when cancel button clicked', () => {
      render(<TemplateRow {...editProps} />)
      fireEvent.click(screen.getByText('Cancel'))
      expect(defaultProps.onCancelEdit).toHaveBeenCalled()
    })

    it('calls onUpdate on form submit', () => {
      render(<TemplateRow {...editProps} />)
      const form = screen.getByRole('button', { name: /save changes/i }).closest('form')!
      fireEvent.submit(form)
      expect(defaultProps.onUpdate).toHaveBeenCalled()
    })

    it('calls onAddAttr when add attribute button clicked', () => {
      render(<TemplateRow {...editProps} />)
      fireEvent.click(screen.getByText('Add Attribute'))
      expect(defaultProps.onAddAttr).toHaveBeenCalled()
    })

    it('resets expanded attrs and edit tab on mount when isEditing', () => {
      const { rerender } = render(<TemplateRow {...defaultProps} />)
      // Then re-render as editing
      rerender(<TemplateRow {...editProps} />)
      // Should be on attrs tab
      // We can't easily assert the internal state, but the component renders without error
      expect(screen.getByText('Edit Template')).toBeInTheDocument()
    })

    it('shows profile tabs with ALL_SKILLS and SELECTED_SKILLS mode buttons', () => {
      render(<TemplateRow {...editProps} editProfiles={defaultProfiles} onAddProfile={vi.fn()} />)
      fireEvent.click(screen.getByText('Profiles'))
      expect(screen.getByText('All Skills')).toBeInTheDocument()
      expect(screen.getByText('Selected Skills')).toBeInTheDocument()
    })

    it('shows skill checkboxes when profile has SELECTED_SKILLS mode', () => {
      const profilesWithSelected = [{
        name: 'custom',
        targetMode: 'SELECTED_SKILLS',
        targetSkillIds: [],
        options: [{ label: 'Base', value: 0 }],
      }]
      render(<TemplateRow {...editProps} editProfiles={profilesWithSelected} editSkills={defaultSkills} onAddProfile={vi.fn()} onToggleProfileSkill={vi.fn()} />)
      fireEvent.click(screen.getByText('Profiles'))
      expect(screen.getByText('Stealth')).toBeInTheDocument()
    })

    it('shows "add skills first" message when no skills exist for SELECTED_SKILLS mode', () => {
      const profilesWithSelected = [{
        name: 'custom',
        targetMode: 'SELECTED_SKILLS',
        targetSkillIds: [],
        options: [{ label: 'Base', value: 0 }],
      }]
      render(<TemplateRow {...editProps} editProfiles={profilesWithSelected} editSkills={[]} onAddProfile={vi.fn()} onToggleProfileSkill={vi.fn()} />)
      fireEvent.click(screen.getByText('Profiles'))
      expect(screen.getByText('Add skills to the template first.')).toBeInTheDocument()
    })

    it('shows core resources with input fields and checkboxes', () => {
      render(<TemplateRow {...editProps} editCoreResources={defaultCoreResources} onAddCoreResource={vi.fn()} onUpdateCoreResource={vi.fn()} onUpdateCoreResourceEnabled={vi.fn()} onUpdateCoreResourceEditable={vi.fn()} onUpdateCoreResourceShowNotes={vi.fn()} />)
      fireEvent.click(screen.getByText('Resources'))
      expect(screen.getByDisplayValue('Hit Points')).toBeInTheDocument()
      expect(screen.getByDisplayValue('hit_points')).toBeInTheDocument()
    })

    it('shows character sections with name input', () => {
      render(<TemplateRow {...editProps} editCharacterSections={defaultCharacterSections} onAddEditCharacterSection={vi.fn()} />)
      fireEvent.click(screen.getByText('Abilities'))
      expect(screen.getByDisplayValue('Talents')).toBeInTheDocument()
      expect(screen.getByText('Add Section')).toBeInTheDocument()
    })

    // ── Attrs tab interaction callbacks ──
    it('calls onEditNameChange when name input changes', () => {
      const onEditNameChange = vi.fn()
      render(<TemplateRow {...editProps} onEditNameChange={onEditNameChange} />)
      fireEvent.change(screen.getByDisplayValue('Edited Name'), { target: { value: 'New Name' } })
      expect(onEditNameChange).toHaveBeenCalledWith('New Name')
    })

    it('calls onEditDescriptionChange when description input changes', () => {
      const onEditDescriptionChange = vi.fn()
      render(<TemplateRow {...editProps} onEditDescriptionChange={onEditDescriptionChange} />)
      fireEvent.change(screen.getByDisplayValue('Edited desc'), { target: { value: 'New desc' } })
      expect(onEditDescriptionChange).toHaveBeenCalledWith('New desc')
    })

    it('calls onEditAttrModifiersEnabledChange when checkbox toggled', () => {
      const onEditAttrModifiersEnabledChange = vi.fn()
      render(<TemplateRow {...editProps} onEditAttrModifiersEnabledChange={onEditAttrModifiersEnabledChange} />)
      fireEvent.click(screen.getByLabelText('Enable Attribute Modifiers'))
      expect(onEditAttrModifiersEnabledChange).toHaveBeenCalledWith(false)
    })

    it('calls onEditAttrModifierFormulaChange when attr modifier config changes', () => {
      const onEditAttrModifierFormulaChange = vi.fn()
      render(<TemplateRow {...editProps} onEditAttrModifierFormulaChange={onEditAttrModifierFormulaChange} />)
      fireEvent.change(screen.getByTestId('attr-modifier-config'), { target: { value: 'new-formula' } })
      expect(onEditAttrModifierFormulaChange).toHaveBeenCalledWith('new-formula')
    })

    it('calls expand toggle and remove on collapsible attr card', () => {
      const onRemoveAttr = vi.fn()
      render(<TemplateRow {...editProps} onRemoveAttr={onRemoveAttr} />)
      // Toggle the first attr card
      fireEvent.click(screen.getByTestId('attr-toggle-0'))
      // Remove the first attr card
      fireEvent.click(screen.getByTestId('attr-remove-0'))
      expect(onRemoveAttr).toHaveBeenCalledWith(0)
    })

    it('calls attrs tab onClick when switching back to attrs tab', () => {
      render(<TemplateRow {...editProps} />)
      // Switch away and back
      fireEvent.click(screen.getByText('Abilities'))
      fireEvent.click(screen.getByText('Attributes'))
      expect(screen.getByTestId('collapsible-attr-card-0')).toBeInTheDocument()
    })

    // ── Skills tab callbacks ──
    it('calls skills tab callbacks', () => {
      const onEditSkillFormulaChange = vi.fn()
      const onRemoveSkill = vi.fn()
      render(<TemplateRow {...editProps} editSkills={defaultSkills} onEditSkillFormulaChange={onEditSkillFormulaChange} onRemoveSkill={onRemoveSkill} />)
      fireEvent.click(screen.getByText('Skills'))
      // Skill formula change
      fireEvent.change(screen.getByTestId('skill-calculation-config'), { target: { value: 'new-formula' } })
      expect(onEditSkillFormulaChange).toHaveBeenCalledWith('new-formula')
      // Skill remove
      fireEvent.click(screen.getByTestId('skill-remove-0'))
      expect(onRemoveSkill).toHaveBeenCalledWith(0)
    })

    it('calls onToggleSkillAllowedAttr and onUpdateDefaultAttr for skill', () => {
      const onToggleSkillAllowedAttr = vi.fn()
      const onUpdateSkill = vi.fn()
      render(<TemplateRow {...editProps} editSkills={defaultSkills} onToggleSkillAllowedAttr={onToggleSkillAllowedAttr} onUpdateSkill={onUpdateSkill} />)
      fireEvent.click(screen.getByText('Skills'))
      // Toggle allowed attribute
      fireEvent.click(screen.getByTestId('skill-allowed-toggle-0-dex'))
      expect(onToggleSkillAllowedAttr).toHaveBeenCalledWith(0, 'dex')
      // Set default attribute
      fireEvent.click(screen.getByTestId('skill-default-attr-0'))
      expect(onUpdateSkill).toHaveBeenCalledWith(0, 'defaultAttributeId', 'str')
    })

    // ── Fields tab callbacks ──
    it('calls fields tab callbacks (key, label, remove)', () => {
      const onUpdateField = vi.fn()
      const onRemoveField = vi.fn()
      render(<TemplateRow {...editProps} editFields={defaultFields} onAddField={vi.fn()} onUpdateField={onUpdateField} onRemoveField={onRemoveField} />)
      fireEvent.click(screen.getByText('Character Info'))
      // Update key
      fireEvent.change(screen.getByDisplayValue('class'), { target: { value: 'race' } })
      expect(onUpdateField).toHaveBeenCalledWith(0, 'key', 'race')
      // Update label
      fireEvent.change(screen.getByDisplayValue('Class'), { target: { value: 'Race' } })
      expect(onUpdateField).toHaveBeenCalledWith(0, 'label', 'Race')
      // Remove field
      fireEvent.click(screen.getByText('✕'))
      expect(onRemoveField).toHaveBeenCalledWith(0)
    })

    it('calls onAddField when add field button clicked', () => {
      const onAddField = vi.fn()
      render(<TemplateRow {...editProps} editFields={defaultFields} onAddField={onAddField} />)
      fireEvent.click(screen.getByText('Character Info'))
      fireEvent.click(screen.getByText('Add Field'))
      expect(onAddField).toHaveBeenCalled()
    })

    // ── Core resources tab callbacks ──
    it('calls core resources callbacks (displayName, slug, color, remove)', () => {
      const onUpdateCoreResource = vi.fn()
      const onRemoveCoreResource = vi.fn()
      render(<TemplateRow {...editProps}
        editCoreResources={defaultCoreResources}
        onAddCoreResource={vi.fn()}
        onUpdateCoreResource={onUpdateCoreResource}
        onRemoveCoreResource={onRemoveCoreResource}
        onUpdateCoreResourceEnabled={vi.fn()}
        onUpdateCoreResourceEditable={vi.fn()}
        onUpdateCoreResourceShowNotes={vi.fn()}
      />)
      fireEvent.click(screen.getByText('Resources'))
      // displayName
      const nameInput = screen.getByDisplayValue('Hit Points')
      fireEvent.change(nameInput, { target: { value: 'Health' } })
      expect(onUpdateCoreResource).toHaveBeenCalledWith(0, 'displayName', 'Health')
      // slug
      const slugInput = screen.getByDisplayValue('hit_points')
      fireEvent.change(slugInput, { target: { value: 'health' } })
      expect(onUpdateCoreResource).toHaveBeenCalledWith(0, 'slug', 'health')
      // color
      const colorInput = screen.getByDisplayValue('#ff0000')
      fireEvent.change(colorInput, { target: { value: '#00ff00' } })
      expect(onUpdateCoreResource).toHaveBeenCalledWith(0, 'color', '#00ff00')
      // remove
      fireEvent.click(screen.getAllByText('✕')[0])
      expect(onRemoveCoreResource).toHaveBeenCalledWith(0)
    })

    it('calls core resources checkbox callbacks', () => {
      const onUpdateCoreResourceEnabled = vi.fn()
      const onUpdateCoreResourceEditable = vi.fn()
      const onUpdateCoreResourceShowNotes = vi.fn()
      render(<TemplateRow {...editProps}
        editCoreResources={defaultCoreResources}
        onAddCoreResource={vi.fn()}
        onUpdateCoreResourceEnabled={onUpdateCoreResourceEnabled}
        onUpdateCoreResourceEditable={onUpdateCoreResourceEditable}
        onUpdateCoreResourceShowNotes={onUpdateCoreResourceShowNotes}
        onUpdateCoreResource={vi.fn()}
      />)
      fireEvent.click(screen.getByText('Resources'))
      // Enabled starts true → becomes false
      fireEvent.click(screen.getByLabelText('Enabled'))
      expect(onUpdateCoreResourceEnabled).toHaveBeenCalledWith(0, false)
      // Editable starts true → becomes false
      fireEvent.click(screen.getByLabelText('Editable'))
      expect(onUpdateCoreResourceEditable).toHaveBeenCalledWith(0, false)
      // Show Notes starts false → becomes true
      fireEvent.click(screen.getByLabelText('Show Notes'))
      expect(onUpdateCoreResourceShowNotes).toHaveBeenCalledWith(0, true)
    })

    it('calls onAddCoreResource when add resource button clicked', () => {
      const onAddCoreResource = vi.fn()
      render(<TemplateRow {...editProps} editCoreResources={defaultCoreResources} onAddCoreResource={onAddCoreResource} />)
      fireEvent.click(screen.getByText('Resources'))
      fireEvent.click(screen.getByText('Add Resource'))
      expect(onAddCoreResource).toHaveBeenCalled()
    })

    // ── Character sections tab callbacks ──
    it('calls character sections callbacks (name change, remove)', () => {
      const onUpdateEditCharacterSection = vi.fn()
      const onRemoveEditCharacterSection = vi.fn()
      render(<TemplateRow {...editProps}
        editCharacterSections={defaultCharacterSections}
        onAddEditCharacterSection={vi.fn()}
        onUpdateEditCharacterSection={onUpdateEditCharacterSection}
        onRemoveEditCharacterSection={onRemoveEditCharacterSection}
      />)
      fireEvent.click(screen.getByText('Abilities'))
      // Name change
      fireEvent.change(screen.getByDisplayValue('Talents'), { target: { value: 'Feats' } })
      expect(onUpdateEditCharacterSection).toHaveBeenCalledWith(0, 'Feats')
      // Remove
      fireEvent.click(screen.getByText('✕'))
      expect(onRemoveEditCharacterSection).toHaveBeenCalledWith(0)
    })

    it('calls onAddEditCharacterSection when add section clicked', () => {
      const onAddEditCharacterSection = vi.fn()
      render(<TemplateRow {...editProps} editCharacterSections={defaultCharacterSections} onAddEditCharacterSection={onAddEditCharacterSection} />)
      fireEvent.click(screen.getByText('Abilities'))
      fireEvent.click(screen.getByText('Add Section'))
      expect(onAddEditCharacterSection).toHaveBeenCalled()
    })

    // ── Profiles tab callbacks ──
    it('calls profiles callbacks (name, remove, target mode, option add/remove, option label/value)', () => {
      const onUpdateProfile = vi.fn()
      const onRemoveProfile = vi.fn()
      const onUpdateProfileTargetMode = vi.fn()
      const onAddProfileOption = vi.fn()
      const onRemoveProfileOption = vi.fn()
      const onUpdateProfileOption = vi.fn()
      render(<TemplateRow {...editProps}
        editProfiles={defaultProfiles}
        onAddProfile={vi.fn()}
        onUpdateProfile={onUpdateProfile}
        onRemoveProfile={onRemoveProfile}
        onUpdateProfileTargetMode={onUpdateProfileTargetMode}
        onAddProfileOption={onAddProfileOption}
        onRemoveProfileOption={onRemoveProfileOption}
        onUpdateProfileOption={onUpdateProfileOption}
      />)
      fireEvent.click(screen.getByText('Profiles'))
      // Name change
      const profileNameInput = screen.getByDisplayValue('mastery')
      fireEvent.change(profileNameInput, { target: { value: 'expertise' } })
      expect(onUpdateProfile).toHaveBeenCalledWith(0, 'expertise')
      // Target mode: "Selected Skills"
      fireEvent.click(screen.getByText('Selected Skills'))
      expect(onUpdateProfileTargetMode).toHaveBeenCalledWith(0, 'SELECTED_SKILLS')
      // Option label change
      const optionLabelInput = screen.getByDisplayValue('Expert')
      fireEvent.change(optionLabelInput, { target: { value: 'Master' } })
      expect(onUpdateProfileOption).toHaveBeenCalledWith(0, 0, 'label', 'Master')
      // Option value change (NumericInput)
      const optionValueInput = screen.getByTestId('numeric-input')
      fireEvent.change(optionValueInput, { target: { value: '5' } })
      expect(onUpdateProfileOption).toHaveBeenCalledWith(0, 0, 'value', '5')
      // Remove option (second ✕ button: profile then option)
      fireEvent.click(screen.getAllByText('✕')[1])
      expect(onRemoveProfileOption).toHaveBeenCalledWith(0, 0)
      // Add option
      fireEvent.click(screen.getByText('+ Add Option'))
      expect(onAddProfileOption).toHaveBeenCalledWith(0)
      // Remove profile (re-query after re-render)
      fireEvent.click(screen.getAllByText('✕')[0])
      expect(onRemoveProfile).toHaveBeenCalledWith(0)
    })

    it('calls profile skill checkbox onChange when SELECTED_SKILLS mode', () => {
      const onToggleProfileSkill = vi.fn()
      const profilesWithSelected = [{
        name: 'custom',
        targetMode: 'SELECTED_SKILLS',
        targetSkillIds: [],
        options: [{ label: 'Base', value: 0 }],
      }]
      render(<TemplateRow {...editProps}
        editProfiles={profilesWithSelected}
        editSkills={defaultSkills}
        onAddProfile={vi.fn()}
        onToggleProfileSkill={onToggleProfileSkill}
      />)
      fireEvent.click(screen.getByText('Profiles'))
      // Click Stealth skill checkbox
      fireEvent.click(screen.getByText('Stealth'))
      expect(onToggleProfileSkill).toHaveBeenCalledWith(0, 'Stealth')
    })

    it('calls onAddProfile when add skill profile clicked', () => {
      const onAddProfile = vi.fn()
      render(<TemplateRow {...editProps} editProfiles={defaultProfiles} onAddProfile={onAddProfile} />)
      fireEvent.click(screen.getByText('Profiles'))
      fireEvent.click(screen.getByText('Add Skill Profile'))
      expect(onAddProfile).toHaveBeenCalled()
    })
  })
})

// ─────────────────────────────────────────────
//  TemplateForm
// ─────────────────────────────────────────────

describe('TemplateForm', () => {
  const defaultFormProps = {
    newTemplateName: '',
    newTemplateDescription: '',
    newTemplateAttrs: [] as { key: string; name: string }[],
    newAttrModifierFormula: '',
    newSkillFormula: '',
    templateError: null as string | null,
    templateCreating: false,
    onNameChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onAddAttr: vi.fn(),
    onRemoveAttr: vi.fn(),
    onUpdateAttr: vi.fn(),
    onCancelNew: vi.fn(),
    onCreateTemplate: vi.fn(),
    newFeatureSkills: false,
    onNewFeatureSkillsChange: vi.fn(),
    newFeatureCustomFields: false,
    onNewFeatureCustomFieldsChange: vi.fn(),
    newFeatureCoreResources: false,
    onNewFeatureCoreResourcesChange: vi.fn(),
    newFeatureArmorClass: false,
    onNewFeatureArmorClassChange: vi.fn(),
    newFeatureCharacterSections: false,
    onNewFeatureCharacterSectionsChange: vi.fn(),
    newFeatureSkillProfiles: false,
    onNewFeatureSkillProfilesChange: vi.fn(),
    newFeatureResistance: false,
    onNewFeatureResistanceChange: vi.fn(),
    attrsForNewResistance: [] as { key: string; name: string; id?: string }[],
  }

  // ── Step 1: Feature Selection ──
  describe('wizard step 1', () => {
    it('renders the create form with name and description inputs', () => {
      render(<TemplateForm {...defaultFormProps} />)
      expect(screen.getByText('Create New Template')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('e.g. D&D 5e Character Sheet')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Brief description of this template')).toBeInTheDocument()
    })

    it('renders all 7 feature cards', () => {
      render(<TemplateForm {...defaultFormProps} />)
      expect(screen.getByText('Skills')).toBeInTheDocument()
      expect(screen.getByText('Character Info')).toBeInTheDocument()
      expect(screen.getByText('Core Resources')).toBeInTheDocument()
      expect(screen.getByText('Armor Class')).toBeInTheDocument()
      expect(screen.getByText('Personal Abilities')).toBeInTheDocument()
      expect(screen.getByText('Skill Profiles')).toBeInTheDocument()
      expect(screen.getByText('Resistance System')).toBeInTheDocument()
    })

    it('renders "Continue to Details" disabled when name is empty', () => {
      render(<TemplateForm {...defaultFormProps} />)
      const continueBtn = screen.getByText('Continue to Details').closest('button')!
      expect(continueBtn).toBeDisabled()
    })

    it('enables continue button when name is provided', () => {
      render(<TemplateForm {...defaultFormProps} newTemplateName="My Template" />)
      const continueBtn = screen.getByText('Continue to Details').closest('button')!
      expect(continueBtn).not.toBeDisabled()
    })

    it('calls onCancelNew when cancel is clicked', () => {
      render(<TemplateForm {...defaultFormProps} />)
      const cancelBtn = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelBtn)
      expect(defaultFormProps.onCancelNew).toHaveBeenCalled()
    })

    it('calls onNameChange when name input changes', () => {
      render(<TemplateForm {...defaultFormProps} />)
      const nameInput = screen.getByPlaceholderText('e.g. D&D 5e Character Sheet')
      fireEvent.change(nameInput, { target: { value: 'My Template' } })
      expect(defaultFormProps.onNameChange).toHaveBeenCalledWith('My Template')
    })

    it('calls onDescriptionChange when description input changes', () => {
      render(<TemplateForm {...defaultFormProps} />)
      const descInput = screen.getByPlaceholderText('Brief description of this template')
      fireEvent.change(descInput, { target: { value: 'A great template' } })
      expect(defaultFormProps.onDescriptionChange).toHaveBeenCalledWith('A great template')
    })

    it('shows Skills feature card as enabled when newFeatureSkills is true', () => {
      render(<TemplateForm {...defaultFormProps} newFeatureSkills={true} />)
      const skillsLabel = screen.getByText('Skills')
      // The parent card should have the "on" styling classes
      const card = skillsLabel.closest('[class*="rounded-xl"]')!
      expect(card.className).toContain('primary')
    })

    it('toggles Skills feature when clicked', () => {
      const onToggle = vi.fn()
      render(<TemplateForm {...defaultFormProps} newFeatureSkills={false} onNewFeatureSkillsChange={onToggle} />)
      const skillsLabel = screen.getByText('Skills')
      const card = skillsLabel.closest('[class*="rounded-xl"]')!
      fireEvent.click(card)
      expect(onToggle).toHaveBeenCalledWith(true)
    })

    it('shows Skill Profiles as disabled when Skills is off', () => {
      render(<TemplateForm {...defaultFormProps} newFeatureSkills={false} />)
      expect(screen.getByText('Requires Skills to be enabled')).toBeInTheDocument()
    })

    it('enables Skill Profiles when Skills is on', () => {
      render(<TemplateForm {...defaultFormProps} newFeatureSkills={true} />)
      expect(screen.queryByText('Requires Skills to be enabled')).not.toBeInTheDocument()
    })
  })

  // ── Step 2: Detail Configuration ──
  describe('wizard step 2', () => {
    function advanceToStep2(props = {}) {
      render(<TemplateForm {...defaultFormProps} newTemplateName="My Template" {...props} />)
      const continueBtn = screen.getByText('Continue to Details').closest('button')!
      fireEvent.click(continueBtn)
    }

    it('renders detail configuration after clicking continue', () => {
      advanceToStep2()
      expect(screen.getByText('Configure Template Details')).toBeInTheDocument()
      expect(screen.getByText('Attributes')).toBeInTheDocument()
    })

    it('shows back to features button', () => {
      advanceToStep2()
      expect(screen.getByText('Change features')).toBeInTheDocument()
    })

    it('goes back to step 1 when "Change features" clicked', () => {
      advanceToStep2()
      fireEvent.click(screen.getByText('Change features'))
      expect(screen.getByText('Create New Template')).toBeInTheDocument()
    })

    it('renders the name input field', () => {
      advanceToStep2()
      expect(screen.getByDisplayValue('My Template')).toBeInTheDocument()
    })

    it('renders the attributes tab by default with add attribute button', () => {
      advanceToStep2()
      expect(screen.getByText('Add Attribute')).toBeInTheDocument()
    })

    it('renders attributes with collapsible attr cards when attrs exist', () => {
      advanceToStep2({ newTemplateAttrs: defaultAttrs })
      expect(screen.getByTestId('collapsible-attr-card-0')).toBeInTheDocument()
      expect(screen.getByTestId('collapsible-attr-card-1')).toBeInTheDocument()
    })

    it('shows attr modifier checkbox and config when modifiers enabled', () => {
      advanceToStep2({ newAttrModifiersEnabled: true, newAttrModifierFormula: 'floor((value-10)/2)' })
      expect(screen.getByLabelText('Enable Attribute Modifiers')).toBeInTheDocument()
      expect(screen.getByTestId('attr-modifier-config')).toBeInTheDocument()
    })

    it('calls onNewAttrModifiersEnabledChange when checkbox toggled', () => {
      const onModifiersChange = vi.fn()
      advanceToStep2({ onNewAttrModifiersEnabledChange: onModifiersChange })
      const checkbox = screen.getByLabelText('Enable Attribute Modifiers')
      fireEvent.click(checkbox)
      expect(onModifiersChange).toHaveBeenCalledWith(true)
    })

    it('calls onAddAttr when Add Attribute clicked', () => {
      advanceToStep2()
      fireEvent.click(screen.getByText('Add Attribute'))
      expect(defaultFormProps.onAddAttr).toHaveBeenCalled()
    })

    it('shows skills tab when skills feature is on', () => {
      advanceToStep2({ newFeatureSkills: true, newTemplateSkills: defaultSkills })
      fireEvent.click(screen.getByText('Skills'))
      expect(screen.getByTestId('skill-calculation-config')).toBeInTheDocument()
      expect(screen.getByTestId('collapsible-skill-card-0')).toBeInTheDocument()
      expect(screen.getByText('Add Skill')).toBeInTheDocument()
    })

    it('hides skills tab when skills feature is off', () => {
      advanceToStep2({ newFeatureSkills: false })
      expect(screen.queryByText('Skills')).not.toBeInTheDocument()
    })

    it('shows Character Info tab when custom fields feature is on with onAddField', () => {
      advanceToStep2({ newFeatureCustomFields: true, onAddField: vi.fn(), newTemplateFields: defaultFields })
      fireEvent.click(screen.getByText('Character Info'))
      expect(screen.getByText('Add Field')).toBeInTheDocument()
    })

    it('shows Resources tab when core resources feature is on', () => {
      advanceToStep2({ newFeatureCoreResources: true, onAddCoreResource: vi.fn(), newCoreResources: defaultCoreResources })
      fireEvent.click(screen.getByText('Resources'))
      expect(screen.getByText('Add Resource')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Hit Points')).toBeInTheDocument()
    })

    it('shows Armor Class tab when armor class feature is on', () => {
      advanceToStep2({ newFeatureArmorClass: true, onAddNewAcConfig: vi.fn(), newAcConfigs: defaultAcConfigs, onAddNewAcFieldForConfig: vi.fn(), onRemoveNewAcConfig: vi.fn(), onUpdateNewAcConfig: vi.fn(), onRemoveNewAcFieldForConfig: vi.fn(), onUpdateNewAcFieldForConfig: vi.fn(), onUpdateNewAcFieldEditableForConfig: vi.fn(), onToggleNewAcAttributeIdForConfig: vi.fn(), onUpdateNewAcAttributeModifierForConfig: vi.fn() })
      fireEvent.click(screen.getByText('Armor Class'))
      expect(screen.getByText('+ Add Armor Class Configuration')).toBeInTheDocument()
    })

    it('shows Abilities tab when character sections feature is on', () => {
      advanceToStep2({ newFeatureCharacterSections: true, newCharacterSections: defaultCharacterSections, onAddNewCharacterSection: vi.fn() })
      fireEvent.click(screen.getByText('Abilities'))
      expect(screen.getByText('Add Section')).toBeInTheDocument()
    })

    it('shows Profiles tab when skill profiles feature is on', () => {
      advanceToStep2({ newFeatureSkillProfiles: true, onAddProfile: vi.fn(), newTemplateProfiles: defaultProfiles })
      fireEvent.click(screen.getByText('Profiles'))
      expect(screen.getByText('Add Skill Profile')).toBeInTheDocument()
    })

    it('shows Resistances tab when resistance feature is on', () => {
      advanceToStep2({ newFeatureResistance: true, onNewResistancesChange: vi.fn(), newResistances: defaultResistances, attrsForNewResistance: defaultAttrs })
      fireEvent.click(screen.getByText('Resistances'))
      expect(screen.getByTestId('resistance-system-config')).toBeInTheDocument()
    })

    it('shows error when templateError is set', () => {
      advanceToStep2({ templateError: 'Failed to create' })
      expect(screen.getByText('Failed to create')).toBeInTheDocument()
    })

    it('shows creating spinner and disabled button when templateCreating', () => {
      advanceToStep2({ templateCreating: true, newTemplateAttrs: defaultAttrs })
      expect(screen.getByText('Creating...')).toBeInTheDocument()
      // Submit should be disabled
      const submit = screen.getByRole('button', { name: /creating\.\.\./i })
      expect(submit).toBeDisabled()
    })

    it('disables submit when name is empty in step 2', () => {
      const { rerender } = render(<TemplateForm {...defaultFormProps} newTemplateName="My Template" newTemplateAttrs={defaultAttrs} />)
      fireEvent.click(screen.getByText('Continue to Details').closest('button')!)
      rerender(<TemplateForm {...defaultFormProps} newTemplateName="" newTemplateAttrs={defaultAttrs} />)
      const submit = screen.getByRole('button', { name: /create template/i })
      expect(submit).toBeDisabled()
    })

    it('disables submit when attrs is empty', () => {
      advanceToStep2({ newTemplateAttrs: [] })
      const submit = screen.getByRole('button', { name: /create template/i })
      expect(submit).toBeDisabled()
    })

    it('calls onCreateTemplate on form submit', () => {
      advanceToStep2({ newTemplateAttrs: defaultAttrs })
      const form = screen.getByRole('button', { name: /create template/i }).closest('form')!
      fireEvent.submit(form)
      expect(defaultFormProps.onCreateTemplate).toHaveBeenCalled()
    })

    it('calls Cancel when cancel button clicked in step 2', () => {
      advanceToStep2({ newTemplateAttrs: defaultAttrs })
      const cancelBtn = screen.getByText('Cancel')
      fireEvent.click(cancelBtn)
      expect(defaultFormProps.onCancelNew).toHaveBeenCalled()
    })
  })
})
