import { describe, it, expect } from 'vitest'
import { buildPreviewSheet } from '../build-preview-sheet'
import type { PreviewTemplateSnapshot } from '../preview-types'

// ── Factory helpers ──

function makeMinimalTemplate(): PreviewTemplateSnapshot {
  return {
    id: 'tpl-1',
    name: 'Test Template',
    description: null,
    campaign: null,
    attributeModifierFormula: null,
    attributeModifiersEnabled: null,
    skillFormula: null,
    attributes: [
      { id: 'attr-1', key: 'str', name: 'Strength' },
      { id: 'attr-2', key: 'dex', name: 'Dexterity' },
    ],
    templateFields: [],
    templateSkills: [],
    skillModifierProfiles: [],
    coreResources: [],
    armorClasses: [],
    characterSections: [],
    resistances: null,
  }
}

function makeFullTemplate(): PreviewTemplateSnapshot {
  return {
    id: 'tpl-full',
    name: 'Full Template',
    description: 'A template with everything',
    campaign: 'Generic RPG',
    attributeModifierFormula: 'floor((value - 10) / 2)',
    attributeModifiersEnabled: true,
    skillFormula: 'base + profile + others',
    attributes: [
      { id: 'attr-1', key: 'str', name: 'Strength' },
      { id: 'attr-2', key: 'dex', name: 'Dexterity' },
      { id: 'attr-3', key: 'con', name: 'Constitution' },
    ],
    templateFields: [
      { id: 'field-1', key: 'background', label: 'Background', fieldType: 'text' },
      { id: 'field-2', key: 'alignment', label: 'Alignment', fieldType: 'select' },
    ],
    templateSkills: [
      {
        id: 'skill-1',
        name: 'Athletics',
        description: 'Climb, jump, swim',
        attributeId: 'attr-1',
        allowedAttributeIds: ['attr-1', 'attr-2'],
        defaultAttributeId: 'attr-1',
        attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
        defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
      },
      {
        id: 'skill-2',
        name: 'Stealth',
        description: 'Move silently',
        attributeId: 'attr-2',
        allowedAttributeIds: ['attr-2'],
        defaultAttributeId: 'attr-2',
        attribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' },
        defaultAttribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' },
      },
    ],
    skillModifierProfiles: [
      {
        id: 'prof-1',
        name: 'Proficiency Level',
        options: [
          { id: 'opt-half', label: 'Half', value: 1 },
          { id: 'opt-full', label: 'Full', value: 2 },
        ],
        targetMode: 'all',
      },
    ],
    coreResources: [
      { id: 'res-hp', slug: 'hp', displayName: 'Hit Points', enabled: true, editableByPlayer: true, showNotes: true },
      { id: 'res-mp', slug: 'mp', displayName: 'Mana Points', enabled: false, editableByPlayer: true, showNotes: false },
    ],
    armorClasses: [
      {
        id: 'ac-1',
        name: 'Armor Class',
        enabled: true,
        attributeModifiers: [
          {
            id: 'ac-mod-1',
            attributeId: 'attr-2',
            allowPlayerSelection: false,
            defaultAttributeId: 'attr-2',
            attribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' },
            defaultAttribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' },
          },
        ],
        fields: [
          { id: 'ac-field-1', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: null },
          { id: 'ac-field-2', name: 'Armor Bonus', key: 'armor', defaultValue: '0', editableByPlayer: true, description: null },
        ],
      },
    ],
    characterSections: [
      { id: 'sec-1', name: 'Backstory', order: 1 },
    ],
    resistances: [
      {
        id: 'res-fire',
        name: 'Fire Resistance',
        calculationType: 'CALCULATED',
        order: 1,
        components: [
          { id: 'comp-1', name: 'Base', editableByPlayer: true, defaultValue: '0', order: 1 },
        ],
        attributeModifiers: [
          { id: 'rmod-1', attributeId: 'attr-3', enabled: true },
        ],
      },
      {
        id: 'res-poison',
        name: 'Poison Resistance',
        calculationType: 'MANUAL',
        order: 2,
        components: [
          { id: 'comp-2', name: 'Base', editableByPlayer: true, defaultValue: '5', order: 1 },
        ],
        attributeModifiers: [],
      },
    ],
  }
}

// ════════════════════════════════════════════════════════════════
// buildPreviewSheet
// ════════════════════════════════════════════════════════════════

describe('buildPreviewSheet', () => {
  it('initializes characterName, playerName, level with defaults', () => {
    const state = buildPreviewSheet(makeMinimalTemplate())
    expect(state.characterName).toBe('')
    expect(state.playerName).toBe('')
    expect(state.level).toBe(1)
  })

  it('initializes abilities, inventoryItems, story, sectionEntries, professionalSkills as empty', () => {
    const state = buildPreviewSheet(makeMinimalTemplate())
    expect(state.abilities).toEqual([])
    expect(state.inventoryItems).toEqual([])
    expect(state.story).toBeNull()
    expect(state.sectionEntries).toEqual([])
    expect(state.professionalSkills).toEqual([])
  })

  it('creates empty attribute values for each template attribute', () => {
    const state = buildPreviewSheet(makeFullTemplate())
    expect(Object.keys(state.attributeValues)).toHaveLength(3)
    expect(state.attributeValues['attr-1']).toBe('')
    expect(state.attributeValues['attr-2']).toBe('')
    expect(state.attributeValues['attr-3']).toBe('')
  })

  it('creates empty field values for each template field', () => {
    const state = buildPreviewSheet(makeFullTemplate())
    expect(Object.keys(state.fieldValues)).toHaveLength(2)
    expect(state.fieldValues['field-1']).toBe('')
    expect(state.fieldValues['field-2']).toBe('')
  })

  it('initializes skillValues to "0|0" for each skill', () => {
    const state = buildPreviewSheet(makeFullTemplate())
    expect(state.skillValues['skill-1']).toBe('0|0')
    expect(state.skillValues['skill-2']).toBe('0|0')
  })

  it('sets default attribute for each skill from defaultAttributeId', () => {
    const state = buildPreviewSheet(makeFullTemplate())
    expect(state.skillAttributes['skill-1']).toBe('attr-1')
    expect(state.skillAttributes['skill-2']).toBe('attr-2')
  })

  it('auto-selects the first profile option for each skill', () => {
    const state = buildPreviewSheet(makeFullTemplate())
    expect(state.profileSelections['skill-1']['prof-1']).toBe('opt-half')
    expect(state.profileSelections['skill-2']['prof-1']).toBe('opt-half')
  })

  it('initializes activeSkills as false and othersValues as 0', () => {
    const state = buildPreviewSheet(makeFullTemplate())
    expect(state.activeSkills['skill-1']).toBe(false)
    expect(state.activeSkills['skill-2']).toBe(false)
    expect(state.othersValues['skill-1']).toBe(0)
    expect(state.othersValues['skill-2']).toBe(0)
  })

  it('initializes coreResources for all resources (enabled or not)', () => {
    const state = buildPreviewSheet(makeFullTemplate())
    expect(state.coreResources['res-hp']).toEqual({ current: null, maximum: null, notes: null })
    expect(state.coreResources['res-mp']).toEqual({ current: null, maximum: null, notes: null })
  })

  it('initializes AC field values from defaults and attribute modifiers', () => {
    const state = buildPreviewSheet(makeFullTemplate())
    expect(state.acFieldValues['ac-field-1']).toBe('10')
    expect(state.acFieldValues['ac-field-2']).toBe('0')
    expect(state.acAttributeModifiers['ac-mod-1']).toBe('attr-2')
  })

  it('initializes resistance components with defaults', () => {
    const state = buildPreviewSheet(makeFullTemplate())
    expect(state.resistanceComponents['comp-1']).toBe('0')
    expect(state.resistanceComponents['comp-2']).toBe('5')
  })

  it('initializes manual resistance values as empty string for MANUAL type', () => {
    const state = buildPreviewSheet(makeFullTemplate())
    expect(state.resistanceManualValues['res-poison']).toBe('')
  })

  it('does not set manual resistance value for CALCULATED type', () => {
    const state = buildPreviewSheet(makeFullTemplate())
    expect(state.resistanceManualValues['res-fire']).toBeUndefined()
  })

  it('preserves the template reference', () => {
    const template = makeFullTemplate()
    const state = buildPreviewSheet(template)
    expect(state.template).toBe(template)
  })

  it('handles empty/no-optional-fields template without error', () => {
    const state = buildPreviewSheet(makeMinimalTemplate())
    expect(state.fieldValues).toEqual({})
    expect(Object.keys(state.skillValues)).toHaveLength(0)
    expect(Object.keys(state.coreResources)).toHaveLength(0)
    expect(Object.keys(state.acFieldValues)).toHaveLength(0)
    expect(Object.keys(state.resistanceComponents)).toHaveLength(0)
    expect(Object.keys(state.resistanceManualValues)).toHaveLength(0)
  })

  it('skips disabled armor classes when building AC fields', () => {
    const template = makeFullTemplate()
    template.armorClasses[0].enabled = false
    const state = buildPreviewSheet(template)
    expect(Object.keys(state.acFieldValues)).toHaveLength(0)
    expect(Object.keys(state.acAttributeModifiers)).toHaveLength(0)
  })

  it('handles null resistances gracefully', () => {
    const template = makeMinimalTemplate()
    const state = buildPreviewSheet(template)
    expect(Object.keys(state.resistanceComponents)).toHaveLength(0)
    expect(Object.keys(state.resistanceManualValues)).toHaveLength(0)
  })

  it('handles template with profile targeting specific skills', () => {
    const template = makeFullTemplate()
    template.skillModifierProfiles = [
      {
        id: 'prof-targeted',
        name: 'Specialized',
        options: [
          { id: 'opt-a', label: 'Option A', value: 3 },
          { id: 'opt-b', label: 'Option B', value: 5 },
        ],
        targetMode: 'specific',
        targetSkillIds: ['skill-1'],
      },
    ]
    const state = buildPreviewSheet(template)
    // skill-1 should have the targeted profile's first option
    expect(state.profileSelections['skill-1']['prof-targeted']).toBe('opt-a')
    // skill-2 should NOT have this profile
    expect(state.profileSelections['skill-2']?.['prof-targeted']).toBeUndefined()
  })
})
