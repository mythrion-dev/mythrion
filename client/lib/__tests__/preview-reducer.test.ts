import { describe, it, expect } from 'vitest'
import { previewReducer } from '../preview-reducer'
import { buildPreviewSheet } from '../build-preview-sheet'
import type { PreviewTemplateSnapshot, PreviewSheetState } from '../preview-types'

// ── Fixture ──

const sampleTemplate: PreviewTemplateSnapshot = {
  id: 'tpl-test',
  name: 'Test',
  description: null,
  campaign: null,
  attributeModifierFormula: null,
  attributeModifiersEnabled: null,
  skillFormula: null,
  attributes: [
    { id: 'attr-1', key: 'str', name: 'Strength' },
    { id: 'attr-2', key: 'dex', name: 'Dexterity' },
  ],
  templateFields: [
    { id: 'field-1', key: 'bg', label: 'Background', fieldType: 'text' },
  ],
  templateSkills: [
    {
      id: 'skill-1',
      name: 'Athletics',
      description: null,
      attributeId: 'attr-1',
      allowedAttributeIds: ['attr-1'],
      defaultAttributeId: 'attr-1',
      attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
      defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
    },
  ],
  skillModifierProfiles: [
    {
      id: 'prof-1',
      name: 'Level',
      options: [
        { id: 'opt-half', label: 'Half', value: 1 },
        { id: 'opt-full', label: 'Full', value: 2 },
      ],
    },
  ],
  coreResources: [
    { id: 'res-hp', slug: 'hp', displayName: 'HP', enabled: true, editableByPlayer: true, showNotes: true },
  ],
  armorClasses: [
    {
      id: 'ac-1',
      name: 'AC',
      enabled: true,
      attributeModifiers: [
        {
          id: 'ac-mod-1',
          attributeId: 'attr-2',
          allowPlayerSelection: true,
          defaultAttributeId: 'attr-2',
          attribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' },
          defaultAttribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' },
        },
      ],
      fields: [
        { id: 'ac-field-1', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: null },
      ],
    },
  ],
  characterSections: [],
  resistances: [
    {
      id: 'res-fire',
      name: 'Fire',
      calculationType: 'CALCULATED',
      order: 1,
      components: [
        { id: 'comp-fire', name: 'Base', editableByPlayer: true, defaultValue: '0', order: 1 },
      ],
      attributeModifiers: [],
    },
  ],
}

function createState(overrides?: Partial<PreviewSheetState>): PreviewSheetState {
  return { ...buildPreviewSheet(sampleTemplate), ...overrides }
}

// ════════════════════════════════════════════════════════════════
// previewReducer
// ════════════════════════════════════════════════════════════════

describe('previewReducer', () => {
  describe('INIT', () => {
    it('replaces the entire state with the payload', () => {
      const initial = createState({ characterName: 'old' })
      const newState = buildPreviewSheet(sampleTemplate)
      const result = previewReducer(initial, { type: 'INIT', payload: newState })
      expect(result.characterName).toBe('')
      expect(result).toEqual(newState)
    })
  })

  describe('RESET', () => {
    it('replaces the entire state with the payload (same as INIT)', () => {
      const initial = createState({ characterName: 'modified' })
      const fresh = buildPreviewSheet(sampleTemplate)
      const result = previewReducer(initial, { type: 'RESET', payload: fresh })
      expect(result.characterName).toBe('')
      expect(result.level).toBe(1)
    })
  })

  describe('SET_CHARACTER_NAME', () => {
    it('updates characterName', () => {
      const state = createState()
      const result = previewReducer(state, { type: 'SET_CHARACTER_NAME', payload: 'Aragorn' })
      expect(result.characterName).toBe('Aragorn')
    })

    it('does not affect other state', () => {
      const state = createState({ level: 5 })
      const result = previewReducer(state, { type: 'SET_CHARACTER_NAME', payload: 'Aragorn' })
      expect(result.level).toBe(5)
    })
  })

  describe('SET_PLAYER_NAME', () => {
    it('updates playerName', () => {
      const state = createState()
      const result = previewReducer(state, { type: 'SET_PLAYER_NAME', payload: 'Dan' })
      expect(result.playerName).toBe('Dan')
    })
  })

  describe('SET_LEVEL', () => {
    it('updates level', () => {
      const state = createState()
      const result = previewReducer(state, { type: 'SET_LEVEL', payload: 10 })
      expect(result.level).toBe(10)
    })
  })

  describe('SET_ATTRIBUTE_VALUE', () => {
    it('updates a single attribute value', () => {
      const state = createState()
      const result = previewReducer(state, { type: 'SET_ATTRIBUTE_VALUE', attributeId: 'attr-1', value: '15' })
      expect(result.attributeValues['attr-1']).toBe('15')
    })

    it('does not affect other attributes', () => {
      const state = createState({ attributeValues: { 'attr-1': '', 'attr-2': '10' } })
      const result = previewReducer(state, { type: 'SET_ATTRIBUTE_VALUE', attributeId: 'attr-1', value: '15' })
      expect(result.attributeValues['attr-2']).toBe('10')
    })
  })

  describe('SET_FIELD_VALUE', () => {
    it('updates a single field value', () => {
      const state = createState()
      const result = previewReducer(state, { type: 'SET_FIELD_VALUE', fieldId: 'field-1', value: 'Soldier' })
      expect(result.fieldValues['field-1']).toBe('Soldier')
    })
  })

  describe('SET_SKILL_VALUE', () => {
    it('updates a single skill value', () => {
      const state = createState()
      const result = previewReducer(state, { type: 'SET_SKILL_VALUE', skillId: 'skill-1', value: '5|3' })
      expect(result.skillValues['skill-1']).toBe('5|3')
    })
  })

  describe('SET_SKILL_ATTRIBUTE', () => {
    it('updates a skill attribute selection', () => {
      const state = createState()
      const result = previewReducer(state, { type: 'SET_SKILL_ATTRIBUTE', skillId: 'skill-1', attributeId: 'attr-2' })
      expect(result.skillAttributes['skill-1']).toBe('attr-2')
    })

    it('accepts null to clear attribute selection', () => {
      const state = createState()
      const result = previewReducer(state, { type: 'SET_SKILL_ATTRIBUTE', skillId: 'skill-1', attributeId: null })
      expect(result.skillAttributes['skill-1']).toBeNull()
    })
  })

  describe('SET_PROFILE_SELECTION', () => {
    it('updates a nested profile selection', () => {
      const state = createState()
      const result = previewReducer(state, {
        type: 'SET_PROFILE_SELECTION',
        skillId: 'skill-1',
        profileId: 'prof-1',
        optionId: 'opt-full',
      })
      expect(result.profileSelections['skill-1']['prof-1']).toBe('opt-full')
    })

    it('preserves other profile selections for the same skill', () => {
      const state = createState({
        profileSelections: {
          'skill-1': { 'prof-1': 'opt-half', 'prof-2': 'opt-a' },
        },
      })
      const result = previewReducer(state, {
        type: 'SET_PROFILE_SELECTION',
        skillId: 'skill-1',
        profileId: 'prof-1',
        optionId: 'opt-full',
      })
      expect(result.profileSelections['skill-1']['prof-1']).toBe('opt-full')
      expect(result.profileSelections['skill-1']['prof-2']).toBe('opt-a')
    })

    it('creates a new profileSelections map when skill has none', () => {
      const state = createState({ profileSelections: {} })
      const result = previewReducer(state, {
        type: 'SET_PROFILE_SELECTION',
        skillId: 'skill-1',
        profileId: 'prof-1',
        optionId: 'opt-full',
      })
      expect(result.profileSelections['skill-1']['prof-1']).toBe('opt-full')
    })

    it('accepts null optionId to clear a profile selection', () => {
      const state = createState()
      const result = previewReducer(state, {
        type: 'SET_PROFILE_SELECTION',
        skillId: 'skill-1',
        profileId: 'prof-1',
        optionId: null,
      })
      expect(result.profileSelections['skill-1']['prof-1']).toBeNull()
    })
  })

  describe('SET_RESOURCE', () => {
    it('updates resource current value', () => {
      const state = createState()
      const result = previewReducer(state, {
        type: 'SET_RESOURCE',
        resourceId: 'res-hp',
        resource: { current: 20 },
      })
      expect(result.coreResources['res-hp'].current).toBe(20)
    })

    it('updates resource maximum and notes', () => {
      const state = createState()
      const result = previewReducer(state, {
        type: 'SET_RESOURCE',
        resourceId: 'res-hp',
        resource: { maximum: 30, notes: 'max HP' },
      })
      expect(result.coreResources['res-hp'].maximum).toBe(30)
      expect(result.coreResources['res-hp'].notes).toBe('max HP')
    })

    it('preserves existing resource fields not in the update', () => {
      const state = createState({
        coreResources: { 'res-hp': { current: 15, maximum: 25, notes: 'ok' } },
      })
      const result = previewReducer(state, {
        type: 'SET_RESOURCE',
        resourceId: 'res-hp',
        resource: { current: 20 },
      })
      expect(result.coreResources['res-hp'].current).toBe(20)
      expect(result.coreResources['res-hp'].maximum).toBe(25)
      expect(result.coreResources['res-hp'].notes).toBe('ok')
    })
  })

  describe('SET_AC_FIELD', () => {
    it('updates an AC field value', () => {
      const state = createState()
      const result = previewReducer(state, { type: 'SET_AC_FIELD', fieldId: 'ac-field-1', value: '12' })
      expect(result.acFieldValues['ac-field-1']).toBe('12')
    })
  })

  describe('SET_AC_ATTRIBUTE_MODIFIER', () => {
    it('updates an AC attribute modifier', () => {
      const state = createState()
      const result = previewReducer(state, { type: 'SET_AC_ATTRIBUTE_MODIFIER', modifierId: 'ac-mod-1', attributeId: 'attr-1' })
      expect(result.acAttributeModifiers['ac-mod-1']).toBe('attr-1')
    })

    it('accepts null to clear an AC modifier attribute', () => {
      const state = createState()
      const result = previewReducer(state, { type: 'SET_AC_ATTRIBUTE_MODIFIER', modifierId: 'ac-mod-1', attributeId: null })
      expect(result.acAttributeModifiers['ac-mod-1']).toBeNull()
    })
  })

  describe('SET_RESISTANCE_COMPONENT', () => {
    it('updates a resistance component value', () => {
      const state = createState()
      const result = previewReducer(state, { type: 'SET_RESISTANCE_COMPONENT', componentId: 'comp-fire', value: '5' })
      expect(result.resistanceComponents['comp-fire']).toBe('5')
    })
  })

  describe('SET_RESISTANCE_MANUAL', () => {
    it('updates a manual resistance value', () => {
      const state = createState()
      const result = previewReducer(state, { type: 'SET_RESISTANCE_MANUAL', resistanceId: 'res-fire', value: '10' })
      expect(result.resistanceManualValues['res-fire']).toBe('10')
    })

    it('accepts null to clear manual resistance', () => {
      const state = createState({ resistanceManualValues: { 'res-fire': '10' } })
      const result = previewReducer(state, { type: 'SET_RESISTANCE_MANUAL', resistanceId: 'res-fire', value: null })
      expect(result.resistanceManualValues['res-fire']).toBeNull()
    })
  })

  describe('SET_ACTIVE_SKILLS', () => {
    it('replaces the entire activeSkills map', () => {
      const state = createState()
      const result = previewReducer(state, { type: 'SET_ACTIVE_SKILLS', payload: { 'skill-1': true } })
      expect(result.activeSkills).toEqual({ 'skill-1': true })
    })
  })

  describe('SET_OTHERS_VALUES', () => {
    it('replaces the entire othersValues map', () => {
      const state = createState()
      const result = previewReducer(state, { type: 'SET_OTHERS_VALUES', payload: { 'skill-1': 2 } })
      expect(result.othersValues).toEqual({ 'skill-1': 2 })
    })
  })

  describe('UPDATE_ABILITIES', () => {
    it('replaces the abilities array', () => {
      const state = createState()
      const abilities = [{ id: 'ab-1', type: 'FEATURE', name: 'Action Surge', description: 'Extra action', sheetId: 'preview', fields: [], children: [], levels: [] }]
      const result = previewReducer(state, { type: 'UPDATE_ABILITIES', payload: abilities })
      expect(result.abilities).toEqual(abilities)
    })
  })

  describe('UPDATE_INVENTORY', () => {
    it('replaces the inventoryItems array', () => {
      const state = createState()
      const items = [{ id: 'inv-1', name: 'Longsword', quantity: 1, weight: 3, sheetId: 'preview', fields: [] }]
      const result = previewReducer(state, { type: 'UPDATE_INVENTORY', payload: items })
      expect(result.inventoryItems).toEqual(items)
    })
  })

  describe('UPDATE_STORY', () => {
    it('replaces the story with a Story object', () => {
      const state = createState()
      const story = { id: 'story-1', sheetId: 'preview', fields: [] }
      const result = previewReducer(state, { type: 'UPDATE_STORY', payload: story })
      expect(result.story).toEqual(story)
    })

    it('accepts null to clear the story', () => {
      const state = createState({ story: { id: 'story-1', sheetId: 'preview', fields: [] } })
      const result = previewReducer(state, { type: 'UPDATE_STORY', payload: null })
      expect(result.story).toBeNull()
    })
  })

  describe('UPDATE_SECTION_ENTRIES', () => {
    it('replaces the sectionEntries array', () => {
      const state = createState()
      const entries = [{ id: 'entry-1', sectionId: 'sec-1', sheetId: 'preview', fields: [] }]
      const result = previewReducer(state, { type: 'UPDATE_SECTION_ENTRIES', payload: entries })
      expect(result.sectionEntries).toEqual(entries)
    })
  })

  describe('SET_PROFESSIONAL_SKILLS', () => {
    it('replaces the professionalSkills array', () => {
      const state = createState()
      const skills = [{ id: 'ps-1', name: 'Crafting', level: 3, sheetId: 'preview' }]
      const result = previewReducer(state, { type: 'SET_PROFESSIONAL_SKILLS', payload: skills })
      expect(result.professionalSkills).toEqual(skills)
    })
  })

  describe('unknown action', () => {
    it('returns the state unchanged', () => {
      const state = createState({ characterName: 'Test' })
      const result = previewReducer(state, { type: 'UNKNOWN' as any })
      expect(result).toBe(state)
    })
  })

  describe('multiple dispatches compose correctly', () => {
    it('chains SET_CHARACTER_NAME then SET_LEVEL', () => {
      const state = createState()
      const afterName = previewReducer(state, { type: 'SET_CHARACTER_NAME', payload: 'Aragorn' })
      const afterLevel = previewReducer(afterName, { type: 'SET_LEVEL', payload: 5 })
      expect(afterLevel.characterName).toBe('Aragorn')
      expect(afterLevel.level).toBe(5)
    })

    it('chains SET_ATTRIBUTE_VALUE then SET_SKILL_ATTRIBUTE', () => {
      const state = createState()
      const a1 = previewReducer(state, { type: 'SET_ATTRIBUTE_VALUE', attributeId: 'attr-1', value: '18' })
      const a2 = previewReducer(a1, { type: 'SET_SKILL_ATTRIBUTE', skillId: 'skill-1', attributeId: 'attr-2' })
      expect(a2.attributeValues['attr-1']).toBe('18')
      expect(a2.skillAttributes['skill-1']).toBe('attr-2')
    })
  })
})
