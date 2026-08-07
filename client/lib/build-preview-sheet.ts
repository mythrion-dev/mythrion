/**
 * Builds the initial PreviewSheetState from a template snapshot.
 * Mirrors CharacterSheetService.create() logic locally — no API calls.
 */

import type {
  PreviewTemplateSnapshot,
  PreviewSheetState,
  PreviewResourceState,
} from './preview-types'

export function buildPreviewSheet(template: PreviewTemplateSnapshot): PreviewSheetState {
  const attributeValues: Record<string, string> = {}
  for (const attr of template.attributes) {
    attributeValues[attr.id] = ''
  }

  const fieldValues: Record<string, string> = {}
  for (const field of template.templateFields ?? []) {
    fieldValues[field.id] = ''
  }

  const skillValues: Record<string, string> = {}
  const skillAttributes: Record<string, string | null> = {}
  const activeSkills: Record<string, boolean> = {}
  const profileSelections: Record<string, Record<string, string | null>> = {}
  const othersValues: Record<string, number> = {}

  for (const skill of template.templateSkills ?? []) {
    skillValues[skill.id] = '0|0'
    // Default attribute: use skill.defaultAttributeId, then skill.attributeId
    skillAttributes[skill.id] = skill.defaultAttributeId ?? skill.attributeId ?? null
    activeSkills[skill.id] = false
    othersValues[skill.id] = 0

    // Set initial profile selections — pick first option for each profile
    const skillProfiles = template.skillModifierProfiles.filter(
      (p) => !p.targetMode || p.targetMode === 'all' || (p.targetSkillIds && p.targetSkillIds.includes(skill.id)),
    )
    profileSelections[skill.id] = {}
    for (const profile of skillProfiles) {
      profileSelections[skill.id][profile.id] = profile.options.length > 0 ? profile.options[0].id : null
    }
  }

  const coreResources: Record<string, PreviewResourceState> = {}
  for (const res of template.coreResources ?? []) {
    coreResources[res.id] = { current: null, maximum: null, notes: null }
  }

  const acFieldValues: Record<string, string> = {}
  const acAttributeModifiers: Record<string, string | null> = {}
  for (const ac of template.armorClasses ?? []) {
    if (!ac.enabled) continue
    for (const field of ac.fields ?? []) {
      acFieldValues[field.id] = field.defaultValue ?? ''
    }
    for (const mod of ac.attributeModifiers ?? []) {
      acAttributeModifiers[mod.id] = mod.defaultAttributeId ?? mod.attributeId
    }
  }

  const resistanceComponents: Record<string, string> = {}
  const resistanceManualValues: Record<string, string | null> = {}
  for (const res of template.resistances ?? []) {
    for (const comp of res.components ?? []) {
      resistanceComponents[comp.id] = comp.defaultValue ?? '0'
    }
    if (res.calculationType === 'MANUAL') {
      resistanceManualValues[res.id] = ''
    }
  }

  return {
    template,
    characterName: '',
    playerName: '',
    level: 1,
    attributeValues,
    fieldValues,
    skillValues,
    skillAttributes,
    profileSelections,
    activeSkills,
    othersValues,
    coreResources,
    acFieldValues,
    acAttributeModifiers,
    resistanceComponents,
    resistanceManualValues,
    abilities: [],
    inventoryItems: [],
    story: null,
    sectionEntries: [],
    professionalSkills: [],
  }
}
