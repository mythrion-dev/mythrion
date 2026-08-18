import { describe, it, expect, vi } from 'vitest'
import {
  computeModifiers,
  computeSkills,
  computeAC,
  computeSummonModifiers,
  computeSummonAC,
  type FormulaEvaluator,
} from '../character-sheet-engine'
import type { CharacterSheet, Ability, AcResultMap } from '@/components/character-sheet/types'

// ── Helpers ──

const noopEvaluate: FormulaEvaluator = vi.fn(async (_f, _v) => 0)

function makeSheet(overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    id: 'sheet-1',
    characterName: 'Test',
    playerName: null,
    level: 1,
    hpActual: null,
    hpMax: null,
    hpNotes: null,
    adventure: null,
    template: {
      id: 'tpl-1',
      name: 'Test Template',
      attributeModifierFormula: null,
      attributeModifiersEnabled: undefined,
      skillFormula: null,
      attributes: [],
      templateSkills: [],
      skillModifierProfiles: [],
      coreResources: [],
      armorClasses: [],
      characterSections: [],
      resistances: [],
    },
    values: [],
    fieldValues: [],
    skillValues: [],
    skillProfileValues: [],
    coreResourceValues: [],
    acValues: [],
    acAttributeValues: [],
    abilities: [],
    inventoryItems: [],
    story: null,
    sectionEntries: [],
    ownerId: null,
    isNpc: false,
    npcType: null,
    adventureId: null,
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── computeModifiers ──

describe('computeModifiers', () => {
  it('returns empty object when modifiers are disabled', async () => {
    const sheet = makeSheet({ template: { ...makeSheet().template, attributeModifiersEnabled: false } })
    const result = await computeModifiers(sheet, noopEvaluate)
    expect(result).toEqual({})
  })

  it('returns empty object when no formula is set', async () => {
    const sheet = makeSheet()
    const result = await computeModifiers(sheet, noopEvaluate)
    expect(result).toEqual({})
  })

  it('evaluates formula for each attribute with correct variables', async () => {
    // Return the "value" variable — the formula `'value'` just returns the attribute's value as-is
    const valueEval: FormulaEvaluator = vi.fn(async (_f, vars) => vars.value)
    const sheet = makeSheet({
      level: 5,
      template: {
        ...makeSheet().template,
        attributeModifierFormula: 'value',
        attributes: [
          { id: 'attr-1', key: 'str', name: 'Strength' },
          { id: 'attr-2', key: 'dex', name: 'Dexterity' },
        ],
      },
      values: [
        { id: 'v-1', attributeId: 'attr-1', value: '18', attribute: { id: 'attr-1', key: 'str', name: 'Strength' } },
        { id: 'v-2', attributeId: 'attr-2', value: '14', attribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' } },
      ],
    })
    const result = await computeModifiers(sheet, valueEval)
    expect(result).toEqual({ 'attr-1': 18, 'attr-2': 14 })
    expect(valueEval).toHaveBeenCalledTimes(2)
    // Each call passes all attribute keys + `value` for the current attribute
    expect(valueEval).toHaveBeenCalledWith('value', expect.objectContaining({ str: 18, dex: 14, value: 18 }))
    expect(valueEval).toHaveBeenCalledWith('value', expect.objectContaining({ str: 18, dex: 14, value: 14 }))
  })

  it('returns null for attributes that fail evaluation', async () => {
    const evaluate = vi.fn(async (_f: string, vars: Record<string, number>) => {
      if (vars.value === 18) throw new Error('eval failed')
      return 2
    })
    const sheet = makeSheet({
      template: {
        ...makeSheet().template,
        attributeModifierFormula: 'value',
        attributes: [
          { id: 'attr-1', key: 'str', name: 'Strength' },
          { id: 'attr-2', key: 'dex', name: 'Dexterity' },
        ],
      },
      values: [
        { id: 'v-1', attributeId: 'attr-1', value: '18', attribute: { id: 'attr-1', key: 'str', name: 'Strength' } },
        { id: 'v-2', attributeId: 'attr-2', value: '10', attribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' } },
      ],
    })
    const result = await computeModifiers(sheet, evaluate)
    expect(result).toEqual({ 'attr-1': null, 'attr-2': 2 })
  })
})

// ── computeSkills ──

describe('computeSkills', () => {
  it('returns empty object when no skill formula is set', async () => {
    const sheet = makeSheet()
    const result = await computeSkills(sheet, {}, {}, {}, noopEvaluate)
    expect(result).toEqual({})
  })

  describe('raw formula mode', () => {
    it('evaluates skill formula with all variables', async () => {
      // The engine re-evaluates the modifier formula internally for modifierVars:
      //   evaluate('value', {str: 14, value: 14}) → returns 14 → str_mod = 14
      // Then for the skill formula:
      //   evaluate('str_mod + value_mod', {str_mod: 14, value_mod: 14, ...}) → returns 28
      const evaluate = vi.fn(async (_f: string, vars: Record<string, number>) => {
        if (_f === 'value') return vars.value
        // skill formula: str_mod + value_mod
        return (vars.str_mod ?? 0) + (vars.value_mod ?? 0)
      })
      const sheet = makeSheet({
        template: {
          ...makeSheet().template,
          attributeModifierFormula: 'value',
          skillFormula: 'str_mod + value_mod',
          attributes: [
            { id: 'attr-1', key: 'str', name: 'Strength' },
          ],
          templateSkills: [
            {
              id: 'skill-1', name: 'Athletics', description: null,
              attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            },
          ],
          skillModifierProfiles: [],
        },
        values: [
          { id: 'v-1', attributeId: 'attr-1', value: '14', attribute: { id: 'attr-1', key: 'str', name: 'Strength' } },
        ],
        skillValues: [
          {
            id: 'sv-1', skillId: 'skill-1', value: '1|0',
            selectedAttributeId: 'attr-1',
            selectedAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            skill: {
              id: 'skill-1', name: 'Athletics', description: null,
              attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            },
          },
        ],
      })
      const result = await computeSkills(sheet, {}, {}, {}, evaluate)
      // str_mod = 14, value_mod = 14, total = 28
      expect(result).toEqual({ 'skill-1': 28 })
    })

    it('passes all attribute keys, field keys, and level as variables', async () => {
      const evaluate = vi.fn(async (_f: string, vars: Record<string, number>) => {
        if (_f === 'value') return vars.value
        return vars.level
      })
      const sheet = makeSheet({
        level: 7,
        template: {
          ...makeSheet().template,
          attributeModifierFormula: 'value',
          skillFormula: 'level',
          attributes: [
            { id: 'attr-1', key: 'str', name: 'Strength' },
          ],
          templateSkills: [
            {
              id: 'skill-1', name: 'Test', description: null,
              attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            },
          ],
          skillModifierProfiles: [],
        },
        values: [
          { id: 'v-1', attributeId: 'attr-1', value: '12', attribute: { id: 'attr-1', key: 'str', name: 'Strength' } },
        ],
        skillValues: [
          {
            id: 'sv-1', skillId: 'skill-1', value: '1|0',
            selectedAttributeId: 'attr-1',
            selectedAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            skill: {
              id: 'skill-1', name: 'Test', description: null,
              attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            },
          },
        ],
      })
      const result = await computeSkills(sheet, {}, {}, {}, evaluate)
      expect(result).toEqual({ 'skill-1': 7 })
      // Verify the skill formula call included all expected variables
      const skillCall = evaluate.mock.calls.find(c => c[0] === 'level')
      expect(skillCall).toBeDefined()
      expect(skillCall![1]).toMatchObject({
        str_mod: expect.any(Number),
        value_mod: expect.any(Number),
        str: 12,
        level: 7,
      })
    })

    it('adds others values after formula evaluation', async () => {
      const evaluate = vi.fn(async (_f: string, vars: Record<string, number>) => {
        if (_f === 'value') return vars.value
        return 10
      })
      const sheet = makeSheet({
        template: {
          ...makeSheet().template,
          attributeModifierFormula: 'value',
          skillFormula: '1+1',
          attributes: [
            { id: 'attr-1', key: 'str', name: 'Strength' },
          ],
          templateSkills: [
            {
              id: 'skill-1', name: 'Athletics', description: null,
              attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            },
          ],
          skillModifierProfiles: [],
        },
        values: [
          { id: 'v-1', attributeId: 'attr-1', value: '10', attribute: { id: 'attr-1', key: 'str', name: 'Strength' } },
        ],
        skillValues: [
          {
            id: 'sv-1', skillId: 'skill-1', value: '1|0',
            selectedAttributeId: 'attr-1',
            selectedAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            skill: {
              id: 'skill-1', name: 'Athletics', description: null,
              attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            },
          },
        ],
      })
      const result = await computeSkills(sheet, {}, {}, { 'skill-1': 5 }, evaluate)
      // formula returns 10, +5 others = 15
      expect(result).toEqual({ 'skill-1': 15 })
    })

    it('adds profile values after formula evaluation (selection path)', async () => {
      const evaluate = vi.fn(async (_f: string, vars: Record<string, number>) => {
        if (_f === 'value') return vars.value
        return 8
      })
      const sheet = makeSheet({
        template: {
          ...makeSheet().template,
          attributeModifierFormula: 'value',
          skillFormula: '2*4',
          attributes: [
            { id: 'attr-1', key: 'str', name: 'Strength' },
          ],
          templateSkills: [
            {
              id: 'skill-1', name: 'Athletics', description: null,
              attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            },
          ],
          skillModifierProfiles: [
            {
              id: 'prof-1', name: 'Proficiency',
              options: [
                { id: 'opt-half', label: 'Half', value: 1 },
                { id: 'opt-full', label: 'Full', value: 2 },
              ],
            },
          ],
        },
        values: [
          { id: 'v-1', attributeId: 'attr-1', value: '10', attribute: { id: 'attr-1', key: 'str', name: 'Strength' } },
        ],
        skillValues: [
          {
            id: 'sv-1', skillId: 'skill-1', value: '1|0',
            selectedAttributeId: 'attr-1',
            selectedAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            skill: {
              id: 'skill-1', name: 'Athletics', description: null,
              attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            },
          },
        ],
      })
      const result = await computeSkills(sheet, {}, { 'skill-1': { 'prof-1': 'opt-full' } }, {}, evaluate)
      // formula returns 8, +2 profile = 10
      expect(result).toEqual({ 'skill-1': 10 })
    })

    it('uses stored skillProfileValues as fallback when no selection exists', async () => {
      const evaluate = vi.fn(async (_f: string, vars: Record<string, number>) => {
        if (_f === 'value') return vars.value
        return 5
      })
      const sheet = makeSheet({
        template: {
          ...makeSheet().template,
          attributeModifierFormula: 'value',
          skillFormula: '5',
          attributes: [
            { id: 'attr-1', key: 'str', name: 'Strength' },
          ],
          templateSkills: [
            {
              id: 'skill-1', name: 'Athletics', description: null,
              attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            },
          ],
          skillModifierProfiles: [
            {
              id: 'prof-1', name: 'Proficiency',
              options: [
                { id: 'opt-half', label: 'Half', value: 1 },
                { id: 'opt-full', label: 'Full', value: 2 },
              ],
            },
          ],
        },
        values: [
          { id: 'v-1', attributeId: 'attr-1', value: '10', attribute: { id: 'attr-1', key: 'str', name: 'Strength' } },
        ],
        skillValues: [
          {
            id: 'sv-1', skillId: 'skill-1', value: '1|0',
            selectedAttributeId: 'attr-1',
            selectedAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            skill: {
              id: 'skill-1', name: 'Athletics', description: null,
              attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            },
          },
        ],
        skillProfileValues: [
          { id: 'spv-1', skillId: 'skill-1', profileId: 'prof-1', optionId: 'opt-half',
            profile: { id: 'prof-1', name: 'Proficiency' },
            option: { id: 'opt-half', label: 'Half', value: 1 } },
        ],
      })
      const result = await computeSkills(sheet, {}, {}, {}, evaluate)
      // formula returns 5, +1 (profile fallback) = 6
      expect(result).toEqual({ 'skill-1': 6 })
    })
  })

  describe('JSON config mode', () => {
    it('uses selected attribute modifier when useAttributeModifier is true', async () => {
      const evaluate = vi.fn(async (_f: string, vars: Record<string, number>) => {
        // modifier formula: return value as-is
        if (_f === 'value') return vars.value
        return 0
      })
      const sheet = makeSheet({
        template: {
          ...makeSheet().template,
          attributeModifierFormula: 'value',
          skillFormula: JSON.stringify({ useAttributeModifier: true }),
          attributes: [
            { id: 'attr-1', key: 'str', name: 'Strength' },
          ],
          templateSkills: [
            {
              id: 'skill-1', name: 'Athletics', description: null,
              attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            },
          ],
          skillModifierProfiles: [],
        },
        values: [
          { id: 'v-1', attributeId: 'attr-1', value: '18', attribute: { id: 'attr-1', key: 'str', name: 'Strength' } },
        ],
        skillValues: [
          {
            id: 'sv-1', skillId: 'skill-1', value: '1|0',
            selectedAttributeId: 'attr-1',
            selectedAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            skill: {
              id: 'skill-1', name: 'Athletics', description: null,
              attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            },
          },
        ],
      })
      // modifierVars['str_mod'] = 18. Config uses useAttributeModifier=true → 18
      const result = await computeSkills(sheet, {}, {}, {}, evaluate)
      expect(result).toEqual({ 'skill-1': 18 })
    })

    it('adds customFieldKeys values in config mode', async () => {
      const evaluate = vi.fn(async (_f: string, vars: Record<string, number>) => {
        if (_f === 'value') return vars.value
        return 0
      })
      const sheet = makeSheet({
        template: {
          ...makeSheet().template,
          attributeModifierFormula: 'value',
          skillFormula: JSON.stringify({ useAttributeModifier: false, customFieldKeys: ['bonus', 'extra'] }),
          attributes: [
            { id: 'attr-1', key: 'str', name: 'Strength' },
          ],
          templateSkills: [
            {
              id: 'skill-1', name: 'Test', description: null,
              attributeId: null, allowedAttributeIds: [], defaultAttributeId: null,
              attribute: null, defaultAttribute: null,
            },
          ],
          skillModifierProfiles: [],
        },
        values: [
          { id: 'v-1', attributeId: 'attr-1', value: '10', attribute: { id: 'attr-1', key: 'str', name: 'Strength' } },
        ],
        fieldValues: [
          { id: 'fv-1', templateFieldId: 'f-1', value: '3', templateField: { id: 'f-1', key: 'bonus', label: 'Bonus' } },
          { id: 'fv-2', templateFieldId: 'f-2', value: '5', templateField: { id: 'f-2', key: 'extra', label: 'Extra' } },
        ],
        skillValues: [
          {
            id: 'sv-1', skillId: 'skill-1', value: '1|0',
            selectedAttributeId: null,
            selectedAttribute: null,
            skill: {
              id: 'skill-1', name: 'Test', description: null,
              attributeId: null, allowedAttributeIds: [], defaultAttributeId: null,
              attribute: null, defaultAttribute: null,
            },
          },
        ],
      })
      const result = await computeSkills(sheet, {}, {}, {}, evaluate)
      // useAttributeModifier=false, customFieldKeys: bonus=3, extra=5 => total=8
      expect(result).toEqual({ 'skill-1': 8 })
    })
  })

  describe('profile target mode filtering', () => {
    it('skips SELECTED_SKILLS profiles that do not target the current skill', async () => {
      const evaluate = vi.fn(async (_f: string, vars: Record<string, number>) => {
        if (_f === 'value') return vars.value
        return 10
      })
      const sheet = makeSheet({
        template: {
          ...makeSheet().template,
          attributeModifierFormula: 'value',
          skillFormula: '10',
          attributes: [
            { id: 'attr-1', key: 'str', name: 'Strength' },
          ],
          templateSkills: [
            {
              id: 'skill-1', name: 'Athletics', description: null,
              attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            },
          ],
          skillModifierProfiles: [
            {
              id: 'prof-1', name: 'Weapons Only',
              options: [{ id: 'opt-1', label: 'Bonus', value: 3 }],
              targetMode: 'SELECTED_SKILLS',
              targetSkillIds: ['Sword', 'Axe'],
            },
          ],
        },
        values: [
          { id: 'v-1', attributeId: 'attr-1', value: '10', attribute: { id: 'attr-1', key: 'str', name: 'Strength' } },
        ],
        skillValues: [
          {
            id: 'sv-1', skillId: 'skill-1', value: '1|0',
            selectedAttributeId: 'attr-1',
            selectedAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            skill: {
              id: 'skill-1', name: 'Athletics', description: null,
              attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            },
          },
        ],
      })
      // Profile targets ['Sword', 'Axe'] but skill is 'Athletics' → profile skipped
      const result = await computeSkills(sheet, {}, { 'skill-1': { 'prof-1': 'opt-1' } }, {}, evaluate)
      expect(result).toEqual({ 'skill-1': 10 })
    })

    it('includes SELECTED_SKILLS profiles that target the current skill', async () => {
      const evaluate = vi.fn(async (_f: string, vars: Record<string, number>) => {
        if (_f === 'value') return vars.value
        return 10
      })
      const sheet = makeSheet({
        template: {
          ...makeSheet().template,
          attributeModifierFormula: 'value',
          skillFormula: '10',
          attributes: [
            { id: 'attr-1', key: 'str', name: 'Strength' },
          ],
          templateSkills: [
            {
              id: 'skill-1', name: 'Athletics', description: null,
              attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            },
          ],
          skillModifierProfiles: [
            {
              id: 'prof-1', name: 'Athletics Bonus',
              options: [{ id: 'opt-1', label: 'Bonus', value: 5 }],
              targetMode: 'SELECTED_SKILLS',
              targetSkillIds: ['Athletics'],
            },
          ],
        },
        values: [
          { id: 'v-1', attributeId: 'attr-1', value: '10', attribute: { id: 'attr-1', key: 'str', name: 'Strength' } },
        ],
        skillValues: [
          {
            id: 'sv-1', skillId: 'skill-1', value: '1|0',
            selectedAttributeId: 'attr-1',
            selectedAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            skill: {
              id: 'skill-1', name: 'Athletics', description: null,
              attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            },
          },
        ],
      })
      // Profile targets ['Athletics'] which matches → +5 → total = 15
      const result = await computeSkills(sheet, {}, { 'skill-1': { 'prof-1': 'opt-1' } }, {}, evaluate)
      expect(result).toEqual({ 'skill-1': 15 })
    })
  })
})

// ── computeAC ──

describe('computeAC', () => {
  it('returns empty map when no armor classes are enabled', () => {
    const result = computeAC(makeSheet(), {})
    expect(result).toEqual({})
  })

  it('sums field values', () => {
    const sheet = makeSheet({
      template: {
        ...makeSheet().template,
        armorClasses: [{
          id: 'ac-1', name: 'Armor Class', enabled: true,
          attributeModifiers: [],
          fields: [
            { id: 'ac-f-1', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: null },
            { id: 'ac-f-2', name: 'Shield', key: 'shield', defaultValue: '2', editableByPlayer: true, description: null },
          ],
        }],
      },
      acValues: [
        { id: 'acv-1', fieldId: 'ac-f-1', value: '10', field: { id: 'ac-f-1', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: null } },
        { id: 'acv-2', fieldId: 'ac-f-2', value: '2', field: { id: 'ac-f-2', name: 'Shield', key: 'shield', defaultValue: '2', editableByPlayer: true, description: null } },
      ],
      acAttributeValues: [],
    })
    const result = computeAC(sheet, {})
    expect(result).toEqual({ 'ac-1': { total: 12, name: 'Armor Class' } })
  })

  it('adds attribute modifiers clamped to 0', () => {
    const sheet = makeSheet({
      template: {
        ...makeSheet().template,
        armorClasses: [{
          id: 'ac-1', name: 'AC', enabled: true,
          fields: [{ id: 'ac-f-1', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: null }],
          attributeModifiers: [
            { id: 'ac-mod-1', attributeId: 'attr-1', allowPlayerSelection: false, attribute: { id: 'attr-1', key: 'dex', name: 'Dexterity' }, defaultAttribute: null, defaultAttributeId: null },
          ],
        }],
      },
      acValues: [
        { id: 'acv-1', fieldId: 'ac-f-1', value: '10', field: { id: 'ac-f-1', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: null } },
      ],
      acAttributeValues: [],
    })
    // modifier = -2 → clamped to 0
    const result = computeAC(sheet, { 'attr-1': -2 })
    expect(result).toEqual({ 'ac-1': { total: 10, name: 'AC' } })
  })

  it('includes positive attribute modifiers', () => {
    const sheet = makeSheet({
      template: {
        ...makeSheet().template,
        armorClasses: [{
          id: 'ac-1', name: 'AC', enabled: true,
          fields: [{ id: 'ac-f-1', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: null }],
          attributeModifiers: [
            { id: 'ac-mod-1', attributeId: 'attr-1', allowPlayerSelection: false, attribute: { id: 'attr-1', key: 'dex', name: 'Dexterity' }, defaultAttribute: null, defaultAttributeId: null },
          ],
        }],
      },
      acValues: [
        { id: 'acv-1', fieldId: 'ac-f-1', value: '10', field: { id: 'ac-f-1', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: null } },
      ],
      acAttributeValues: [],
    })
    const result = computeAC(sheet, { 'attr-1': 3 })
    expect(result).toEqual({ 'ac-1': { total: 13, name: 'AC' } })
  })

  it('uses allowPlayerSelection with fallback chain', () => {
    const sheet = makeSheet({
      template: {
        ...makeSheet().template,
        armorClasses: [{
          id: 'ac-1', name: 'AC', enabled: true,
          fields: [{ id: 'ac-f-1', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: null }],
          attributeModifiers: [
            {
              id: 'ac-mod-1', attributeId: 'attr-1', allowPlayerSelection: true,
              defaultAttributeId: 'attr-2',
              attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
              defaultAttribute: null,
            },
          ],
        }],
      },
      acValues: [
        { id: 'acv-1', fieldId: 'ac-f-1', value: '10', field: { id: 'ac-f-1', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: null } },
      ],
      acAttributeValues: [
        { id: 'acav-1', sheetId: 'sheet-1', acAttributeModifierId: 'ac-mod-1', selectedAttributeId: 'attr-2', acAttributeModifier: {} as any, selectedAttribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' } },
      ],
    })
    const result = computeAC(sheet, { 'attr-1': 5, 'attr-2': 2 })
    // Player selected attr-2 (dex) → modifier = 2 → total = 12
    expect(result).toEqual({ 'ac-1': { total: 12, name: 'AC' } })
  })
})

// ── computeSummonModifiers ──

describe('computeSummonModifiers', () => {
  it('returns empty object when no modifier formula is set', async () => {
    const ability: Ability = {
      id: 'ab-1', name: 'Wolf', type: 'SUMMON',
      description: null, notes: null,
      order: 0,
      levels: [], childAbilities: [],
      summonAttributes: [{ id: 'sa-1', abilityId: 'ab-1', attributeId: 'attr-1', value: '14' }],
      summonAcValues: [], summonSkills: [], summonHealth: null,
    }
    const result = await computeSummonModifiers(ability, makeSheet(), noopEvaluate)
    expect(result).toEqual({})
  })

  it('returns empty object when summon has no attributes', async () => {
    const ability: Ability = {
      id: 'ab-1', name: 'Wolf', type: 'SUMMON',
      description: null, notes: null,
      order: 0,
      levels: [], childAbilities: [],
      summonAttributes: [], summonAcValues: [], summonSkills: [], summonHealth: null,
    }
    const sheet = makeSheet({
      template: { ...makeSheet().template, attributeModifierFormula: 'value' },
    })
    const result = await computeSummonModifiers(ability, sheet, noopEvaluate)
    expect(result).toEqual({})
  })

  it('evaluates formula with summon attribute values', async () => {
    const evaluate = vi.fn(async (_f: string, vars: Record<string, number>) => Math.floor((vars.str - 10) / 2))
    const ability: Ability = {
      id: 'ab-1', name: 'Wolf', type: 'SUMMON',
      description: null, notes: null,
      order: 0,
      levels: [], childAbilities: [],
      summonAttributes: [{ id: 'sa-1', abilityId: 'ab-1', attributeId: 'attr-1', value: '18' }],
      summonAcValues: [], summonSkills: [], summonHealth: null,
    }
    const sheet = makeSheet({
      template: {
        ...makeSheet().template,
        attributeModifierFormula: 'floor((str-10)/2)',
        attributes: [
          { id: 'attr-1', key: 'str', name: 'Strength' },
        ],
      },
    })
    const result = await computeSummonModifiers(ability, sheet, evaluate)
    expect(result).toEqual({ 'attr-1': 4 })
    expect(evaluate).toHaveBeenCalledWith(
      'floor((str-10)/2)',
      expect.objectContaining({ str: 18, value: 18 }),
    )
  })

  it('returns null for attributes that fail evaluation', async () => {
    const evaluate = vi.fn(async () => { throw new Error('fail') })
    const ability: Ability = {
      id: 'ab-1', name: 'Wolf', type: 'SUMMON',
      description: null, notes: null,
      order: 0,
      levels: [], childAbilities: [],
      summonAttributes: [{ id: 'sa-1', abilityId: 'ab-1', attributeId: 'attr-1', value: '10' }],
      summonAcValues: [], summonSkills: [], summonHealth: null,
    }
    const sheet = makeSheet({
      template: {
        ...makeSheet().template,
        attributeModifierFormula: 'value',
        attributes: [
          { id: 'attr-1', key: 'str', name: 'Strength' },
        ],
      },
    })
    const result = await computeSummonModifiers(ability, sheet, evaluate)
    expect(result).toEqual({ 'attr-1': null })
  })
})

// ── computeSummonAC ──

describe('computeSummonAC', () => {
  it('returns parsed value from first summonAcValues entry', () => {
    const ability: Ability = {
      id: 'ab-1', name: 'Wolf', type: 'SUMMON',
      description: null, notes: null,
      order: 0,
      levels: [], childAbilities: [],
      summonAttributes: [], summonAcValues: [{ id: 'sac-1', abilityId: 'ab-1', value: '14' }],
      summonSkills: [], summonHealth: null,
    }
    expect(computeSummonAC(ability)).toBe(14)
  })

  it('returns null when there are no summonAcValues', () => {
    const ability: Ability = {
      id: 'ab-1', name: 'Wolf', type: 'SUMMON',
      description: null, notes: null,
      order: 0,
      levels: [], childAbilities: [],
      summonAttributes: [], summonAcValues: [], summonSkills: [], summonHealth: null,
    }
    expect(computeSummonAC(ability)).toBeNull()
  })

  it('returns null when value is non-numeric', () => {
    const ability: Ability = {
      id: 'ab-1', name: 'Wolf', type: 'SUMMON',
      description: null, notes: null,
      order: 0,
      levels: [], childAbilities: [],
      summonAttributes: [], summonAcValues: [{ id: 'sac-1', abilityId: 'ab-1', value: 'abc' }],
      summonSkills: [], summonHealth: null,
    }
    expect(computeSummonAC(ability)).toBeNull()
  })
})
