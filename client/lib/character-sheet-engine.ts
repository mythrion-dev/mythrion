/**
 * Shared character sheet computation engine.
 *
 * Both the real character sheet page and the template preview page import
 * these pure functions, parameterized by a FormulaEvaluator callback that
 * each page wires differently (authenticated vs. public endpoint).
 *
 * The only difference between real and preview is the persistence layer —
 * the engine itself is identical for both.
 */

import type { CharacterSheet, Ability, AcResultMap } from '@/components/character-sheet/types'

// ── Formula Evaluator type ──

/**
 * Function signature for formula evaluation.
 * Real sheet: api.post<{result: number}>('/formula/evaluate', {formula, variables})
 * Preview:    fetch(`${API_URL}/public/formula/evaluate`, {method:'POST', body:{formula, variables}})
 */
export type FormulaEvaluator = (
  formula: string,
  variables: Record<string, number>,
) => Promise<number>

// ── Helpers ──

function parseFloatSafe(v: string | undefined | null, fallback = 0): number {
  if (v === undefined || v === null) return fallback
  const n = Number.parseFloat(v)
  return Number.isNaN(n) ? fallback : n
}

function getModifierFormula(sheet: CharacterSheet): string | null {
  const v = sheet.template.attributeModifierFormula?.trim()
  return v && v.length > 0 ? v : null
}

function getSkillFormula(sheet: CharacterSheet): string | null {
  const v = sheet.template.skillFormula?.trim()
  return v && v.length > 0 ? v : null
}

function getModifiersEnabled(sheet: CharacterSheet): boolean {
  return (sheet.template as any).attributeModifiersEnabled !== false
}

// ── computeModifiers ──

/**
 * Computes attribute modifier values by evaluating the template's
 * attributeModifierFormula for each attribute.
 *
 * Returns Record<attributeId, number | null>.
 * - null when evaluation fails for a specific attribute.
 * - Empty object if modifiers are disabled or no formula is set.
 */
export async function computeModifiers(
  sheet: CharacterSheet,
  evaluate: FormulaEvaluator,
): Promise<Record<string, number | null>> {
  const results: Record<string, number | null> = {}

  if (!getModifiersEnabled(sheet)) return results

  const formula = getModifierFormula(sheet)
  if (!formula) return results

  for (const attr of sheet.template.attributes) {
    try {
      const vars: Record<string, number> = {}
      for (const a of sheet.template.attributes) {
        const sv = sheet.values.find(v => v.attributeId === a.id)
        vars[a.key] = parseFloatSafe(sv?.value, 0)
      }
      const currentValue = sheet.values.find(sv => sv.attributeId === attr.id)
      vars['value'] = parseFloatSafe(currentValue?.value, 0)

      const result = await evaluate(formula, vars)
      results[attr.id] = result
    } catch {
      results[attr.id] = null
    }
  }

  return results
}

// ── computeSkills ──

/**
 * Computes skill total values. For each skill, evaluates the skillFormula
 * (or config-mode modifiers), then adds others values and profile option
 * values AFTER formula evaluation.
 *
 * Supports:
 * - JSON config mode: {useAttributeModifier: boolean, customFieldKeys?: string[]}
 * - Raw formula mode: passes {attr}_mod, value, value_mod, all attribute keys,
 *   all field keys, and level as variables.
 * - Profile selections with fallback to skillProfileValues.
 * - SELECTED_SKILLS targetMode filtering.
 */
export async function computeSkills(
  sheet: CharacterSheet,
  modifierResults: Record<string, number | null>,
  profileSelections: Record<string, Record<string, string | null>>,
  othersValues: Record<string, number>,
  evaluate: FormulaEvaluator,
): Promise<Record<string, number | null>> {
  const results: Record<string, number | null> = {}

  // Build modifierVars: {attr_key}_mod
  const modifierVars: Record<string, number> = {}
  const globalFormula = getModifierFormula(sheet)

  if (globalFormula) {
    for (const attr of sheet.template.attributes) {
      try {
        const modVars: Record<string, number> = {}
        for (const a of sheet.template.attributes) {
          const sv = sheet.values.find(v => v.attributeId === a.id)
          modVars[a.key] = parseFloatSafe(sv?.value, 0)
        }
        const curVal = sheet.values.find(sv => sv.attributeId === attr.id)
        modVars['value'] = parseFloatSafe(curVal?.value, 0)

        const mr = await evaluate(globalFormula, modVars)
        modifierVars[`${attr.key}_mod`] = mr
      } catch {
        modifierVars[`${attr.key}_mod`] = 0
      }
    }
  } else {
    for (const attr of sheet.template.attributes) {
      modifierVars[`${attr.key}_mod`] = modifierResults[attr.id] ?? 0
    }
  }

  const skillFormulaRaw = getSkillFormula(sheet)
  if (!skillFormulaRaw) return results

  // Detect JSON config mode
  let skillConfig: { useAttributeModifier?: boolean; customFieldKeys?: string[] } | null = null
  try {
    const parsed = JSON.parse(skillFormulaRaw)
    if (parsed && typeof parsed === 'object' && typeof parsed.useAttributeModifier === 'boolean') {
      skillConfig = parsed
    }
  } catch {
    // Not JSON — treat as raw formula
  }

  for (const sv of sheet.skillValues) {
    try {
      let finalResult = 0

      if (skillConfig) {
        // Config mode
        if (skillConfig.useAttributeModifier) {
          const selectedAttr = sv.selectedAttribute || sv.skill.defaultAttribute || sv.skill.attribute
          if (selectedAttr) {
            finalResult += modifierVars[`${selectedAttr.key}_mod`] ?? 0
          }
        }
        const customKeys = skillConfig.customFieldKeys || []
        for (const key of customKeys) {
          const fv = sheet.fieldValues.find(f => f.templateField.key === key)
          if (fv) {
            finalResult += parseFloatSafe(fv.value, 0)
          }
        }
      } else {
        // Raw formula mode
        const selectedAttr = sv.selectedAttribute || sv.skill.defaultAttribute || sv.skill.attribute
        const skillAttrValue = selectedAttr
          ? parseFloatSafe(sheet.values.find(v => v.attributeId === selectedAttr.id)?.value, 0)
          : 0

        const variables: Record<string, number> = { ...modifierVars }
        variables['value'] = skillAttrValue
        if (selectedAttr) {
          variables['value_mod'] = modifierVars[`${selectedAttr.key}_mod`] ?? 0
        }

        for (const a of sheet.template.attributes) {
          const v = sheet.values.find(sv2 => sv2.attributeId === a.id)
          variables[a.key] = parseFloatSafe(v?.value, 0)
        }
        for (const fv of sheet.fieldValues) {
          variables[fv.templateField.key] = parseFloatSafe(fv.value, 0)
        }
        variables['level'] = sheet.level ?? 1

        finalResult = await evaluate(skillFormulaRaw, variables)
      }

      // Add others value AFTER formula evaluation
      finalResult += othersValues[sv.skillId] ?? 0

      // Add profile option values AFTER formula evaluation
      const skillSelections = profileSelections[sv.skillId] || {}
      for (const profile of sheet.template.skillModifierProfiles) {
        const targetMode = (profile as any).targetMode ?? 'ALL_SKILLS'
        const targetSkillIds: string[] = (profile as any).targetSkillIds ?? []
        if (targetMode === 'SELECTED_SKILLS' && targetSkillIds.length > 0 && !targetSkillIds.includes(sv.skill.name)) {
          continue
        }

        const selId = skillSelections[profile.id]
        if (selId) {
          const opt = profile.options.find(o => o.id === selId)
          if (opt) finalResult += opt.value
        } else {
          // Fallback to stored skillProfileValues
          const stored = sheet.skillProfileValues.find(
            spv => spv.skillId === sv.skillId && spv.profileId === profile.id,
          )
          if (stored?.option?.value !== undefined) {
            finalResult += stored.option.value
          }
        }
      }

      results[sv.skillId] = finalResult
    } catch {
      results[sv.skillId] = null
    }
  }

  return results
}

// ── computeAC ──

/**
 * Computes Armor Class values. Synchronous — no formula evaluation needed.
 * Clamps negative attribute modifiers to 0 per game rules.
 */
export function computeAC(
  sheet: CharacterSheet,
  modifierResults: Record<string, number | null>,
): AcResultMap {
  const results: AcResultMap = {}

  const acs = sheet.template.armorClasses?.filter(ac => ac.enabled) ?? []
  if (acs.length === 0) return results

  const selectedByModifierId = new Map(
    sheet.acAttributeValues.map(v => [v.acAttributeModifierId, v.selectedAttributeId]),
  )

  for (const ac of acs) {
    let total = 0

    // Sum field values
    const acFields = sheet.acValues.filter(acv => ac.fields.some(f => f.id === acv.fieldId))
    for (const acv of acFields) {
      total += parseFloatSafe(acv.value, 0)
    }

    // Sum attribute modifiers (clamped to 0)
    const acMods = ac.attributeModifiers ?? []
    for (const am of acMods) {
      const effectiveAttributeId = am.allowPlayerSelection
        ? (selectedByModifierId.get(am.id) ?? am.defaultAttributeId ?? am.attributeId)
        : am.attributeId

      const modResult = modifierResults[effectiveAttributeId]
      if (modResult !== null && modResult !== undefined && !Number.isNaN(modResult)) {
        total += Math.max(0, modResult)
      }
    }

    results[ac.id] = { total, name: (ac as any).name ?? 'Armor Class' }
  }

  return results
}

// ── computeSummonModifiers ──

/**
 * Computes attribute modifiers for a summon ability.
 * Uses the template's attributeModifierFormula with summon attribute values.
 */
export async function computeSummonModifiers(
  ability: Ability,
  sheet: CharacterSheet,
  evaluate: FormulaEvaluator,
): Promise<Record<string, number | null>> {
  const results: Record<string, number | null> = {}

  const formula = getModifierFormula(sheet)
  if (!formula || !ability.summonAttributes?.length) return results

  for (const sa of ability.summonAttributes) {
    const attr = sheet.template.attributes.find(a => a.id === sa.attributeId)
    if (!attr) continue

    try {
      const vars: Record<string, number> = {}
      for (const a of ability.summonAttributes) {
        const ta = sheet.template.attributes.find(x => x.id === a.attributeId)
        if (ta) {
          vars[ta.key] = parseFloatSafe(a.value, 0)
        }
      }
      vars['value'] = parseFloatSafe(sa.value, 0)

      const result = await evaluate(formula, vars)
      results[attr.id] = result
    } catch {
      results[attr.id] = null
    }
  }

  return results
}

// ── computeSummonAC ──

/**
 * Computes the AC for a summon ability (single manual value).
 */
export function computeSummonAC(ability: Ability): number | null {
  const acv = ability.summonAcValues?.[0]
  if (!acv) return null
  const v = parseFloat(acv.value)
  return isNaN(v) ? null : v
}
