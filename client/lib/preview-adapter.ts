/**
 * Adapter layer that transforms PreviewSheetState + computed results into the
 * exact prop shapes each tab component expects. Generates synthetic IDs
 * (preview-{type}-{id}) so the components render normally without needing
 * real database IDs.
 */

import type {
  PreviewSheetState,
  SkillResult,
  AcResultMap,
} from './preview-types'
import type { CalculatedResistance } from './preview-computations'
import type {
  CharacterSheet,
  SheetAttribute,
  FieldValue,
  SkillValue,
  SkillProfileValue,
  CoreResourceValue,
  CoreResourceDef,
  ArmorClassValue,
  ArmorClassAttributeValue,
  SheetPermissions,
  SkillModifierProfile,
  Story,
  ProfessionalSkill,
} from '@/components/character-sheet/types'
import type { Ability, InventoryItem, SectionEntry } from '@/components/character-sheet/types'

// ── PID counter for stable synthetic IDs ──
let _pid = 0
function pid(prefix: string): string {
  _pid++
  return `preview-${prefix}-${_pid}`
}

// ── Permissions: all true in sandbox mode ──

const ALL_PERMISSIONS: SheetPermissions = {
  canEditCharacter: true,
  canEditSkills: true,
  canEditResources: true,
  canEditInventory: true,
  canEditStory: true,
  canEditProfessionalSkills: true,
  canEditPersonalAbilities: true,
  canEditResistances: true,
  canEditAbilities: true,
}

// ── Helpers ──

function findAttribute(
  state: PreviewSheetState,
  attributeId: string | null,
): { id: string; key: string; name: string } | null {
  if (!attributeId) return null
  return state.template.attributes.find(a => a.id === attributeId) ?? null
}

// ── Adapter result shape ──

export interface PreviewAdapterResult {
  /** Props for the CharacterTab component */
  characterTabProps: {
    sheet: CharacterSheet
    permissions: SheetPermissions
    enabledCoreResources: CoreResourceDef[]
    handleCoreResourceChange: (coreResourceId: string, field: 'current' | 'maximum' | 'notes', value: string) => Promise<void>
    handleCoreResourceModify: (coreResourceId: string, delta: number) => void
    saveFieldValue: (fieldId: string, value: string) => Promise<void>
    modifierResults: Record<string, number | null>
    saveAttributeValue: (attributeId: string, value: string) => Promise<void>
    modifiersEnabled: boolean | undefined
    armorClasses: CharacterSheet['template']['armorClasses']
    acResults: AcResultMap
    handleAcFieldChange: (fieldId: string, value: string) => void
    handleAcAttributeModifierChange: (acModifierId: string, attributeId: string | null) => Promise<void>
    allProfiles: SkillModifierProfile[]
    profileSelections: Record<string, Record<string, string | null>>
    activeSkills: Record<string, boolean>
    othersValues: Record<string, number>
    handleSkillToggle: (skillId: string) => void
    handleOthersChange: (skillId: string, value: number) => void
    handleProfileChange: (skillId: string, profileId: string, optionId: string | null) => void
    handleSkillAttributeChange: (skillId: string, attributeId: string | null) => void
    expandedSkillId: string | null
    setExpandedSkillId: React.Dispatch<React.SetStateAction<string | null>>
    skillResults: Record<string, number | null>
    sheetId: string
  }

  /** Abilities list for the AbilitiesTab */
  abilities: Ability[]
  /** Inventory items for the InventoryTab */
  inventoryItems: InventoryItem[]
  /** Story for the StoryTab */
  story: Story | null
  /** Section entries for the PersonalAbilitiesTab */
  sectionEntries: SectionEntry[]
  /** Professional skills for ProfessionalSkillsSection */
  professionalSkills: ProfessionalSkill[]

  /** Resistance data mapped for ResistanceTab (matches the local CalculatedResistance type in ResistanceTab.tsx) */
  resistanceData: {
    resistanceId: string
    name: string
    calculationType: string
    total: number
    componentValues: { componentId: string; componentName: string; value: number; editableByPlayer: boolean }[]
    attributeModifierValues: {
      attributeId: string
      attributeKey: string
      attributeName: string
      enabled: boolean
      rawModifier: number
      effectiveModifier: number
    }[]
  }[]
}

// ── Build CharacterSheet from PreviewSheetState ──

/**
 * Builds a synthetic CharacterSheet from the preview state.
 * Extracted as a standalone function so both the adapter layer
 * and the computation engine can share one source of truth.
 */
export function buildPreviewSheetAsCharacterSheet(state: PreviewSheetState): CharacterSheet {
  const values: SheetAttribute[] = state.template.attributes.map(attr => ({
    id: pid('val'),
    attributeId: attr.id,
    value: state.attributeValues[attr.id] ?? '',
    attribute: attr,
  }))

  const fieldValues: FieldValue[] = (state.template.templateFields ?? []).map(field => ({
    id: pid('fv'),
    templateFieldId: field.id,
    value: state.fieldValues[field.id] ?? '',
    templateField: field,
  }))

  const skillValues: SkillValue[] = (state.template.templateSkills ?? []).map(skill => {
    const selectedAttributeId = state.skillAttributes[skill.id] ?? null
    const selectedAttribute = findAttribute(state, selectedAttributeId)
    return {
      id: pid('sv'),
      skillId: skill.id,
      value: state.skillValues[skill.id] ?? '0|0',
      selectedAttributeId,
      selectedAttribute,
      skill: {
        ...skill,
        attribute: skill.attribute ?? null,
        defaultAttribute: skill.defaultAttribute ?? null,
      },
    }
  })

  const skillProfileValues: SkillProfileValue[] = []
  for (const skill of state.template.templateSkills ?? []) {
    const selections = state.profileSelections[skill.id] ?? {}
    for (const [profileId, optionId] of Object.entries(selections)) {
      const profile = state.template.skillModifierProfiles.find(p => p.id === profileId)
      const option = profile?.options.find(o => o.id === optionId) ?? null
      skillProfileValues.push({
        id: pid('spv'),
        skillId: skill.id,
        profileId,
        optionId: optionId ?? null,
        profile: { id: profileId, name: profile?.name ?? '' },
        option: option ? { id: option.id, label: option.label, value: option.value } : null,
      })
    }
  }

  const coreResourceValues: CoreResourceValue[] = (state.template.coreResources ?? [])
    .filter(cr => cr.enabled)
    .map(cr => {
      const res = state.coreResources[cr.id] ?? { current: null, maximum: null, notes: null }
      return {
        id: pid('crv'),
        coreResourceId: cr.id,
        current: res.current,
        maximum: res.maximum,
        notes: res.notes,
        coreResource: cr as CoreResourceDef,
      }
    })

  const acValues: ArmorClassValue[] = []
  const acAttributeValues: ArmorClassAttributeValue[] = []
  for (const ac of state.template.armorClasses ?? []) {
    if (!ac.enabled) continue
    for (const field of ac.fields ?? []) {
      acValues.push({
        id: pid('acv'),
        fieldId: field.id,
        value: state.acFieldValues[field.id] ?? field.defaultValue ?? '',
        field,
      })
    }
    for (const mod of ac.attributeModifiers ?? []) {
      const selectedAttributeId = state.acAttributeModifiers[mod.id] ?? mod.defaultAttributeId ?? mod.attributeId
      acAttributeValues.push({
        id: pid('acav'),
        sheetId: 'preview',
        acAttributeModifierId: mod.id,
        selectedAttributeId,
        acAttributeModifier: mod,
        selectedAttribute: findAttribute(state, selectedAttributeId),
      })
    }
  }

  // Build the template object the CharacterTab expects (merged with our snapshot)
  const templateForSheet: CharacterSheet['template'] = {
    id: state.template.id,
    name: state.template.name,
    attributeModifierFormula: state.template.attributeModifierFormula,
    attributeModifiersEnabled: state.template.attributeModifiersEnabled ?? undefined,
    skillFormula: state.template.skillFormula,
    attributes: state.template.attributes,
    templateSkills: state.template.templateSkills as CharacterSheet['template']['templateSkills'],
    skillModifierProfiles: state.template.skillModifierProfiles,
    coreResources: state.template.coreResources as CoreResourceDef[],
    armorClasses: state.template.armorClasses as CharacterSheet['template']['armorClasses'],
    characterSections: state.template.characterSections,
    resistances: state.template.resistances as CharacterSheet['template']['resistances'],
  }

  return {
    id: 'preview',
    characterName: state.characterName,
    playerName: state.playerName || null,
    level: state.level,
    hpActual: null,
    hpMax: null,
    hpNotes: null,
    adventure: null,
    template: templateForSheet,
    values,
    fieldValues,
    skillValues,
    skillProfileValues,
    coreResourceValues,
    acValues,
    acAttributeValues,
    abilities: state.abilities,
    inventoryItems: state.inventoryItems,
    story: state.story,
    sectionEntries: state.sectionEntries,
    ownerId: null,
    isNpc: false,
    npcType: null,
    adventureId: null,
    createdAt: new Date().toISOString(),
  }
}

// ── Main adapter function ──

export function buildAdapter(
  state: PreviewSheetState,
  modifierResults: Record<string, number>,
  skillResults: Record<string, SkillResult>,
  acResults: AcResultMap,
  resistances: CalculatedResistance[],
  dispatch: React.Dispatch<any>,
): PreviewAdapterResult {
  // Reset synthetic ID counter for each full rebuild
  _pid = 0

  // ── Build synthetic CharacterSheet via standalone function ──

  const sheet = buildPreviewSheetAsCharacterSheet(state)

  // ── Skill results as flat number | null map ──

  const flatSkillResults: Record<string, number | null> = {}
  for (const skill of state.template.templateSkills ?? []) {
    flatSkillResults[skill.id] = skillResults[skill.id]?.total ?? null
  }

  // ── Character tab props ──

  const characterTabProps = {
    sheet,
    permissions: ALL_PERMISSIONS,
    enabledCoreResources: state.template.coreResources.filter(cr => cr.enabled) as CoreResourceDef[],
    handleCoreResourceChange: async (coreResourceId: string, field: 'current' | 'maximum' | 'notes', value: string) => {
      const parsed = field === 'notes' ? value : Number.parseFloat(value) || null
      dispatch({
        type: 'SET_RESOURCE',
        resourceId: coreResourceId,
        resource: { [field]: parsed },
      })
    },
    handleCoreResourceModify: (coreResourceId: string, delta: number) => {
      const current = state.coreResources[coreResourceId]?.current ?? 0
      dispatch({
        type: 'SET_RESOURCE',
        resourceId: coreResourceId,
        resource: { current: Math.max(0, current + delta) },
      })
    },
    saveFieldValue: async (fieldId: string, value: string) => {
      dispatch({ type: 'SET_FIELD_VALUE', fieldId, value })
    },
    modifierResults: Object.fromEntries(
      Object.entries(modifierResults).map(([k, v]) => [k, v ?? null]),
    ) as Record<string, number | null>,
    saveAttributeValue: async (attributeId: string, value: string) => {
      dispatch({ type: 'SET_ATTRIBUTE_VALUE', attributeId, value })
    },
    modifiersEnabled: state.template.attributeModifiersEnabled ?? undefined,
    armorClasses: sheet.template.armorClasses,
    acResults,
    handleAcFieldChange: (fieldId: string, value: string) => {
      dispatch({ type: 'SET_AC_FIELD', fieldId, value })
    },
    handleAcAttributeModifierChange: async (acModifierId: string, attributeId: string | null) => {
      dispatch({ type: 'SET_AC_ATTRIBUTE_MODIFIER', modifierId: acModifierId, attributeId })
    },
    allProfiles: state.template.skillModifierProfiles as SkillModifierProfile[],
    profileSelections: state.profileSelections,
    activeSkills: state.activeSkills,
    othersValues: state.othersValues,
    handleSkillToggle: (skillId: string) => {
      dispatch({
        type: 'SET_ACTIVE_SKILLS',
        payload: { ...state.activeSkills, [skillId]: !state.activeSkills[skillId] },
      })
    },
    handleOthersChange: (skillId: string, value: number) => {
      dispatch({
        type: 'SET_OTHERS_VALUES',
        payload: { ...state.othersValues, [skillId]: value },
      })
    },
    handleProfileChange: (skillId: string, profileId: string, optionId: string | null) => {
      dispatch({ type: 'SET_PROFILE_SELECTION', skillId, profileId, optionId })
    },
    handleSkillAttributeChange: (skillId: string, attributeId: string | null) => {
      dispatch({ type: 'SET_SKILL_ATTRIBUTE', skillId, attributeId })
    },
    expandedSkillId: null,
    setExpandedSkillId: () => {}, // handled locally in the page if needed
    skillResults: flatSkillResults,
    sheetId: 'preview',
    localMode: true,
    localSkills: state.professionalSkills,
    onLocalSkillsChange: (skills: ProfessionalSkill[]) => {
      dispatch({ type: 'SET_PROFESSIONAL_SKILLS', payload: skills })
    },
  }

  // ── Map resistances for ResistanceTab ──

  const resistanceData = resistances.map(r => {
    const def = state.template.resistances?.find(d => d.id === r.id)

    // attributeModifierValues: iterate the template's attribute modifier defs
    const attributeModifierValues: {
      attributeId: string
      attributeKey: string
      attributeName: string
      enabled: boolean
      rawModifier: number
      effectiveModifier: number
    }[] = (def?.attributeModifiers ?? []).map(attrMod => {
      const attr = attrMod.attribute ?? findAttribute(state, attrMod.attributeId)
      const rawMod = modifierResults[attrMod.attributeId] ?? 0
      return {
        attributeId: attrMod.attributeId,
        attributeKey: attr?.key ?? '',
        attributeName: attr?.name ?? '',
        enabled: attrMod.enabled,
        rawModifier: rawMod,
        effectiveModifier: attrMod.enabled ? rawMod : 0,
      }
    })

    return {
      resistanceId: r.id,
      name: r.name,
      calculationType: r.calculationType,
      total: r.total,
      componentValues: r.components.map(c => ({
        componentId: c.id,
        componentName: c.name,
        value: c.value,
        editableByPlayer: c.editableByPlayer,
      })),
      attributeModifierValues,
    }
  })

  return {
    characterTabProps,
    abilities: state.abilities,
    inventoryItems: state.inventoryItems,
    story: state.story,
    sectionEntries: state.sectionEntries,
    professionalSkills: state.professionalSkills,
    resistanceData,
  }
}
