import { describe, it, expect, vi } from 'vitest'
import { buildAdapter } from '../preview-adapter'
import { buildPreviewSheet } from '../build-preview-sheet'
import type { PreviewTemplateSnapshot, PreviewSheetState } from '../preview-types'

// ── Fixture ──

const sampleTemplate: PreviewTemplateSnapshot = {
  id: 'tpl-adapt',
  name: 'Adapter Test',
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
      allowedAttributeIds: ['attr-1', 'attr-2'],
      defaultAttributeId: 'attr-1',
      attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
      defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
    },
    {
      id: 'skill-2',
      name: 'Stealth',
      description: null,
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
      name: 'Proficiency',
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
      name: 'Armor Class',
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
  resistances: null,
}

// ════════════════════════════════════════════════════════════════
// buildAdapter
// ════════════════════════════════════════════════════════════════

describe('buildAdapter', () => {
  it('produces previewAdapterResult with all expected top-level keys', () => {
    const state = buildPreviewSheet(sampleTemplate)
    const dispatch = vi.fn()
    const result = buildAdapter(state, {}, {}, {}, [], dispatch)

    expect(result).toHaveProperty('characterTabProps')
    expect(result).toHaveProperty('abilities')
    expect(result).toHaveProperty('inventoryItems')
    expect(result).toHaveProperty('story')
    expect(result).toHaveProperty('sectionEntries')
    expect(result).toHaveProperty('professionalSkills')
    expect(result).toHaveProperty('resistanceData')
  })

  describe('synthetic ID generation', () => {
    it('generates IDs with preview- prefix for sheet values', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const result = buildAdapter(state, {}, {}, {}, [], vi.fn())

      expect(result.characterTabProps.sheet.values).toHaveLength(2)
      for (const val of result.characterTabProps.sheet.values) {
        expect(val.id).toMatch(/^preview-/)
      }
    })

    it('generates IDs with preview- prefix for field values', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const result = buildAdapter(state, {}, {}, {}, [], vi.fn())

      expect(result.characterTabProps.sheet.fieldValues).toHaveLength(1)
      for (const fv of result.characterTabProps.sheet.fieldValues) {
        expect(fv.id).toMatch(/^preview-/)
      }
    })

    it('generates IDs with preview- prefix for skill values', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const result = buildAdapter(state, {}, {}, {}, [], vi.fn())

      expect(result.characterTabProps.sheet.skillValues).toHaveLength(2)
      for (const sv of result.characterTabProps.sheet.skillValues) {
        expect(sv.id).toMatch(/^preview-/)
      }
    })

    it('generates unique synthetic IDs per entity type', () => {
      // Run twice to ensure counter reset
      const state = buildPreviewSheet(sampleTemplate)
      const first = buildAdapter(state, {}, {}, {}, [], vi.fn())
      const firstIds = first.characterTabProps.sheet.values.map(v => v.id)

      const second = buildAdapter(state, {}, {}, {}, [], vi.fn())
      const secondIds = second.characterTabProps.sheet.values.map(v => v.id)

      // Each fresh call should start from 1
      expect(firstIds).toEqual(['preview-val-1', 'preview-val-2'])
      expect(secondIds).toEqual(['preview-val-1', 'preview-val-2'])
    })
  })

  describe('CharacterSheet shape', () => {
    it('sets sheet.id to "preview"', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const result = buildAdapter(state, {}, {}, {}, [], vi.fn())
      expect(result.characterTabProps.sheet.id).toBe('preview')
    })

    it('maps attributeValues to sheet.values with matching attribute IDs', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const result = buildAdapter(state, {}, {}, {}, [], vi.fn())

      const attrIds = result.characterTabProps.sheet.values.map(v => v.attributeId)
      expect(attrIds).toContain('attr-1')
      expect(attrIds).toContain('attr-2')
    })

    it('maps skillValues with matching skill IDs', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const result = buildAdapter(state, {}, {}, {}, [], vi.fn())

      const skillIds = result.characterTabProps.sheet.skillValues.map(sv => sv.skillId)
      expect(skillIds).toContain('skill-1')
      expect(skillIds).toContain('skill-2')
    })

    it('passes characterName through', () => {
      const state = buildPreviewSheet(sampleTemplate)
      state.characterName = 'Gimli'
      const result = buildAdapter(state, {}, {}, {}, [], vi.fn())
      expect(result.characterTabProps.sheet.characterName).toBe('Gimli')
    })

    it('passes level through', () => {
      const state = buildPreviewSheet(sampleTemplate)
      state.level = 8
      const result = buildAdapter(state, {}, {}, {}, [], vi.fn())
      expect(result.characterTabProps.sheet.level).toBe(8)
    })
  })

  describe('permissions', () => {
    it('sets all permissions to true', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const result = buildAdapter(state, {}, {}, {}, [], vi.fn())
      const perms = result.characterTabProps.permissions

      expect(perms.canEditCharacter).toBe(true)
      expect(perms.canEditSkills).toBe(true)
      expect(perms.canEditResources).toBe(true)
      expect(perms.canEditInventory).toBe(true)
      expect(perms.canEditStory).toBe(true)
      expect(perms.canEditProfessionalSkills).toBe(true)
      expect(perms.canEditPersonalAbilities).toBe(true)
      expect(perms.canEditResistances).toBe(true)
      expect(perms.canEditAbilities).toBe(true)
    })
  })

  describe('callbacks', () => {
    it('saveFieldValue dispatches SET_FIELD_VALUE', async () => {
      const state = buildPreviewSheet(sampleTemplate)
      const dispatch = vi.fn()
      const result = buildAdapter(state, {}, {}, {}, [], dispatch)

      await result.characterTabProps.saveFieldValue('field-1', 'Soldier')
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_FIELD_VALUE', fieldId: 'field-1', value: 'Soldier' })
    })

    it('saveFieldValue returns a resolved promise', async () => {
      const state = buildPreviewSheet(sampleTemplate)
      const result = buildAdapter(state, {}, {}, {}, [], vi.fn())

      // Should not throw
      await expect(result.characterTabProps.saveFieldValue('field-1', 'test')).resolves.toBeUndefined()
    })

    it('saveAttributeValue dispatches SET_ATTRIBUTE_VALUE', async () => {
      const state = buildPreviewSheet(sampleTemplate)
      const dispatch = vi.fn()
      const result = buildAdapter(state, {}, {}, {}, [], dispatch)

      await result.characterTabProps.saveAttributeValue('attr-1', '15')
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ATTRIBUTE_VALUE', attributeId: 'attr-1', value: '15' })
    })

    it('handleCoreResourceChange dispatches SET_RESOURCE', async () => {
      const state = buildPreviewSheet(sampleTemplate)
      const dispatch = vi.fn()
      const result = buildAdapter(state, {}, {}, {}, [], dispatch)

      await result.characterTabProps.handleCoreResourceChange('res-hp', 'current', '20')
      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_RESOURCE',
        resourceId: 'res-hp',
        resource: { current: 20 },
      })
    })

    it('handleCoreResourceModify dispatches SET_RESOURCE with clamped value', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const dispatch = vi.fn()
      const result = buildAdapter(state, {}, {}, {}, [], dispatch)

      result.characterTabProps.handleCoreResourceModify('res-hp', 5)
      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_RESOURCE',
        resourceId: 'res-hp',
        resource: { current: 5 },
      })
    })

    it('handleProfileChange dispatches SET_PROFILE_SELECTION', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const dispatch = vi.fn()
      const result = buildAdapter(state, {}, {}, {}, [], dispatch)

      result.characterTabProps.handleProfileChange('skill-1', 'prof-1', 'opt-full')
      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_PROFILE_SELECTION',
        skillId: 'skill-1',
        profileId: 'prof-1',
        optionId: 'opt-full',
      })
    })

    it('handleSkillAttributeChange dispatches SET_SKILL_ATTRIBUTE', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const dispatch = vi.fn()
      const result = buildAdapter(state, {}, {}, {}, [], dispatch)

      result.characterTabProps.handleSkillAttributeChange('skill-1', 'attr-2')
      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_SKILL_ATTRIBUTE',
        skillId: 'skill-1',
        attributeId: 'attr-2',
      })
    })

    it('handleAcFieldChange dispatches SET_AC_FIELD', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const dispatch = vi.fn()
      const result = buildAdapter(state, {}, {}, {}, [], dispatch)

      result.characterTabProps.handleAcFieldChange('ac-field-1', '15')
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_AC_FIELD', fieldId: 'ac-field-1', value: '15' })
    })

    it('handleAcAttributeModifierChange dispatches SET_AC_ATTRIBUTE_MODIFIER', async () => {
      const state = buildPreviewSheet(sampleTemplate)
      const dispatch = vi.fn()
      const result = buildAdapter(state, {}, {}, {}, [], dispatch)

      await result.characterTabProps.handleAcAttributeModifierChange('ac-mod-1', 'attr-1')
      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_AC_ATTRIBUTE_MODIFIER',
        modifierId: 'ac-mod-1',
        attributeId: 'attr-1',
      })
    })

    it('handleSkillToggle dispatches SET_ACTIVE_SKILLS with all skills', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const dispatch = vi.fn()
      const result = buildAdapter(state, {}, {}, {}, [], dispatch)

      result.characterTabProps.handleSkillToggle('skill-1')
      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_ACTIVE_SKILLS',
        payload: expect.objectContaining({ 'skill-1': true, 'skill-2': false }),
      })
    })

    it('handleOthersChange dispatches SET_OTHERS_VALUES with all skills', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const dispatch = vi.fn()
      const result = buildAdapter(state, {}, {}, {}, [], dispatch)

      result.characterTabProps.handleOthersChange('skill-1', 3)
      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_OTHERS_VALUES',
        payload: expect.objectContaining({ 'skill-1': 3, 'skill-2': 0 }),
      })
    })
  })

  describe('modifierResults', () => {
    it('passes modifierResults through', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const mods = { 'attr-1': 2, 'attr-2': 3 }
      const result = buildAdapter(state, mods, {}, {}, [], vi.fn())

      expect(result.characterTabProps.modifierResults['attr-1']).toBe(2)
      expect(result.characterTabProps.modifierResults['attr-2']).toBe(3)
    })
  })

  describe('skillResults', () => {
    it('maps skill results to flat number | null records', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const skillResults = {
        'skill-1': { total: 5, name: 'Athletics', selectedAttribute: 'attr-1', selectedAttributeName: 'Strength', attributeValue: 2, selectedProfileValue: 1 },
        'skill-2': { total: 3, name: 'Stealth', selectedAttribute: 'attr-2', selectedAttributeName: 'Dexterity', attributeValue: 3, selectedProfileValue: null },
      }
      const result = buildAdapter(state, {}, skillResults, {}, [], vi.fn())

      expect(result.characterTabProps.skillResults['skill-1']).toBe(5)
      expect(result.characterTabProps.skillResults['skill-2']).toBe(3)
    })

    it('returns null for skills not in results map', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const result = buildAdapter(state, {}, {}, {}, [], vi.fn())

      expect(result.characterTabProps.skillResults['skill-1']).toBeNull()
    })
  })

  describe('acResults', () => {
    it('passes AC results through', () => {
      const state = buildPreviewSheet(sampleTemplate)
      const acResults = { 'ac-1': { total: 15, name: 'Armor Class' } }
      const result = buildAdapter(state, {}, {}, acResults, [], vi.fn())

      expect(result.characterTabProps.acResults).toBe(acResults)
    })
  })
})
