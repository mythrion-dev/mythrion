/**
 * Resistance computation for the Template Preview feature.
 * These functions are client-side only (no async formula evaluation).
 *
 * Modifier, skill, AC, and summon computations now live in
 * @/lib/character-sheet-engine (shared engine used by both
 * the real sheet and the preview).
 */

import type { PreviewSheetState } from './preview-types'

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
