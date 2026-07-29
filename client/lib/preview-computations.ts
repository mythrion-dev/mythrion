/**
 * Async computation functions for the Template Preview feature.
 * Calls the public formula endpoint for async evaluations.
 * AC and resistance calculations are pure client-side.
 */

import type {
  PreviewSheetState,
  SkillResult,
  AcResultMap,
  PreviewProfileOption,
} from './preview-types'
import { API_URL } from './api'

// ── Formula evaluation helper ──

interface EvaluateResponse {
  result: number
}

async function evaluateFormula(
  formula: string,
  variables: Record<string, number>,
): Promise<number> {
  if (!formula || formula.trim().length === 0) return 0
  try {
    const res = await fetch(`${API_URL}/public/formula/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formula, variables }),
    })
    if (!res.ok) return 0
    const data: EvaluateResponse = await res.json()
    return data.result
  } catch {
    return 0
  }
}

// ── Modifier computation ──

/**
 * Computes attribute modifier values by evaluating the template's
 * attributeModifierFormula for each attribute. Returns a map of
 * attributeId → numeric modifier.
 */
export async function computeModifiers(
  state: PreviewSheetState,
): Promise<Record<string, number>> {
  const formula = state.template.attributeModifierFormula
  if (!formula) {
    // Default: modifier = floor((value - 10) / 2)
    const result: Record<string, number> = {}
    for (const attr of state.template.attributes) {
      const val = parseFloat(state.attributeValues[attr.id]) || 0
      result[attr.id] = Math.floor((val - 10) / 2)
    }
    return result
  }

  // Build variables from all attribute values
  const variables: Record<string, number> = {}
  for (const attr of state.template.attributes) {
    variables[attr.key] = parseFloat(state.attributeValues[attr.id]) || 0
  }

  // Evaluate in parallel
  const entries = state.template.attributes.map(async (attr) => {
    const result = await evaluateFormula(formula, variables)
    return [attr.id, result] as const
  })

  const results = await Promise.all(entries)
  return Object.fromEntries(results)
}

// ── Skill computation ──

/**
 * Computes skill total values. For each active skill, evaluates the
 * skillFormula (or default) using the attribute modifier as the base,
 * plus the selected profile option value and others bonus.
 */
export async function computeSkills(
  state: PreviewSheetState,
  modifierResults: Record<string, number>,
): Promise<Record<string, SkillResult>> {
  const formula = state.template.skillFormula
  const result: Record<string, SkillResult> = {}

  const entries = (state.template.templateSkills ?? []).map(async (skill) => {
    const selectedAttributeId = state.skillAttributes[skill.id]
    const attributeMod = selectedAttributeId
      ? modifierResults[selectedAttributeId] ?? 0
      : 0

    // Get selected profile option values
    const selections = state.profileSelections[skill.id] ?? {}
    const allProfiles = state.template.skillModifierProfiles.filter(
      (p) =>
        !p.targetMode ||
        p.targetMode === 'all' ||
        (p.targetSkillIds && p.targetSkillIds.includes(skill.id)),
    )

    let selectedProfileValue: number | null = null
    for (const profile of allProfiles) {
      const optionId = selections[profile.id]
      if (optionId) {
        const option = profile.options.find(
          (o: PreviewProfileOption) => o.id === optionId,
        )
        if (option) {
          selectedProfileValue = (selectedProfileValue ?? 0) + option.value
        }
      }
    }

    // Compute total
    let total = 0
    if (formula) {
      const variables: Record<string, number> = {
        base: attributeMod,
        profile: selectedProfileValue ?? 0,
        others: state.othersValues[skill.id] ?? 0,
      }
      total = await evaluateFormula(formula, variables)
    } else {
      total = attributeMod + (selectedProfileValue ?? 0) + (state.othersValues[skill.id] ?? 0)
    }

    const selectedAttribute = state.template.attributes.find(
      (a) => a.id === selectedAttributeId,
    )

    const skillName = skill.name

    return [
      skill.id,
      {
        total,
        name: skillName,
        selectedAttribute: selectedAttributeId ?? null,
        selectedAttributeName: selectedAttribute?.name ?? null,
        attributeValue: attributeMod !== 0 ? attributeMod : null,
        selectedProfileValue,
      },
    ] as const
  })

  const results = await Promise.all(entries)
  for (const [id, r] of results) {
    result[id] = r
  }
  return result
}

// ── Armor Class computation (client-side) ──

export function computeAC(
  state: PreviewSheetState,
  modifierResults: Record<string, number>,
): AcResultMap {
  const result: AcResultMap = {}

  for (const ac of state.template.armorClasses ?? []) {
    if (!ac.enabled) continue

    let total = 0
    // Sum field values
    for (const field of ac.fields ?? []) {
      const val = parseFloat(state.acFieldValues[field.id]) || 0
      total += val
    }
    // Sum attribute modifiers
    for (const mod of ac.attributeModifiers ?? []) {
      const selectedAttrId = state.acAttributeModifiers[mod.id]
      if (selectedAttrId) {
        const modVal = modifierResults[selectedAttrId] ?? 0
        total += modVal
      }
    }

    result[ac.id] = { total, name: ac.name ?? 'Armor Class' }
  }

  return result
}

// ── Resistance computation (client-side) ──

export interface CalculatedResistance {
  id: string
  name: string
  calculationType: string
  total: number
  components: { id: string; name: string; value: number; editableByPlayer: boolean }[]
  manualValue: string | null
}

export function computeResistances(
  state: PreviewSheetState,
  modifierResults: Record<string, number>,
): CalculatedResistance[] {
  const result: CalculatedResistance[] = []

  for (const res of state.template.resistances ?? []) {
    if (res.calculationType === 'MANUAL') {
      const manualVal = state.resistanceManualValues[res.id]
      result.push({
        id: res.id,
        name: res.name,
        calculationType: 'MANUAL',
        total: parseFloat(manualVal ?? '') || 0,
        components: res.components.map((c) => ({
          id: c.id,
          name: c.name,
          value: parseFloat(state.resistanceComponents[c.id]) || 0,
          editableByPlayer: c.editableByPlayer,
        })),
        manualValue: manualVal ?? null,
      })
      continue
    }

    // CALCULATED type
    const components = res.components.map((c) => ({
      id: c.id,
      name: c.name,
      value: parseFloat(state.resistanceComponents[c.id]) || 0,
      editableByPlayer: c.editableByPlayer,
    }))

    let total = components.reduce((sum, c) => sum + c.value, 0)

    // Add attribute modifier values
    for (const attrMod of res.attributeModifiers ?? []) {
      if (attrMod.enabled) {
        total += modifierResults[attrMod.attributeId] ?? 0
      }
    }

    result.push({
      id: res.id,
      name: res.name,
      calculationType: 'CALCULATED',
      total,
      components,
      manualValue: null,
    })
  }

  return result
}
