import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { FormulaService } from '../formula/formula.service.js'

@Injectable()
export class ResistanceCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formulaService: FormulaService,
  ) {}

  /**
   * Calculate all resistances for a given character sheet.
   * Returns an array of { resistanceId, name, total, calculationType, components, attributeModifiers }.
   */
  async calculateResistances(sheetId: string) {
    // Fetch the sheet with its template resistances
    const sheet = await this.prisma.characterSheet.findUnique({
      where: { id: sheetId },
      select: {
        id: true,
        templateId: true,
        values: { include: { attribute: true } },
      },
    })
    if (!sheet) return []

    // Fetch all resistances for this template
    const resistances = await this.prisma.templateResistance.findMany({
      where: { templateId: sheet.templateId },
      orderBy: { order: 'asc' },
      include: {
        components: { orderBy: { order: 'asc' } },
        attributeModifiers: {
          include: { attribute: true },
        },
      },
    })

    // Fetch sheet resistance values
    const sheetResistanceValues = await this.prisma.characterSheetResistanceValue.findMany({
      where: { sheetId },
    })

    // Fetch sheet resistance component values
    const sheetComponentValues = await this.prisma.characterSheetResistanceComponentValue.findMany({
      where: { sheetId },
    })

    // Build attribute value map from sheet attributes
    const attrValues = new Map<string, number>()
    for (const v of sheet.values) {
      const num = parseFloat(v.value)
      attrValues.set(v.attributeId, isNaN(num) ? 0 : num)
    }

    // Fetch the template's attribute modifier formula
    const template = await this.prisma.template.findUnique({
      where: { id: sheet.templateId },
      select: {
        attributeModifierFormula: true,
        attributeModifiersEnabled: true,
      },
    })

    const formula = template?.attributeModifierFormula ?? null
    const modifiersEnabled = template?.attributeModifiersEnabled ?? true

    // Calculate attribute modifiers using the existing formula
    const attributeModifiers = new Map<string, number>()
    if (formula && modifiersEnabled) {
      for (const v of sheet.values) {
        const attrValue = attrValues.get(v.attributeId) ?? 0
        try {
          // Build variable map with all attribute keys plus 'value'
          const variables: Record<string, number> = {}
          for (const sv of sheet.values) {
            const val = attrValues.get(sv.attributeId) ?? 0
            variables[sv.attribute.key] = val
          }
          variables['value'] = attrValue
          const mod = this.formulaService.evaluate(formula, variables)
          attributeModifiers.set(v.attributeId, mod)
        } catch {
          attributeModifiers.set(v.attributeId, 0)
        }
      }
    }

    const results: Array<{
      resistanceId: string
      name: string
      calculationType: string
      total: number
      componentValues: Array<{ componentId: string; componentName: string; value: number; editableByPlayer: boolean }>
      attributeModifierValues: Array<{ attributeId: string; attributeKey: string; attributeName: string; enabled: boolean; rawModifier: number; effectiveModifier: number }>
    }> = []

    for (const resistance of resistances) {
      if (resistance.calculationType === 'MANUAL') {
        const sheetValue = sheetResistanceValues.find(sv => sv.resistanceId === resistance.id)
        const manualVal = parseFloat(sheetValue?.manualValue ?? '0')
        results.push({
          resistanceId: resistance.id,
          name: resistance.name,
          calculationType: 'MANUAL',
          total: isNaN(manualVal) ? 0 : manualVal,
          componentValues: [],
          attributeModifierValues: [],
        })
        continue
      }

      // CALCULATED resistance
      let total = 0

      // Sum component values
      const componentValues: Array<{ componentId: string; componentName: string; value: number; editableByPlayer: boolean }> = []
      for (const component of resistance.components) {
        if (component.editableByPlayer) {
          // Use player's value if available, otherwise default
          const sheetVal = sheetComponentValues.find(scv => scv.componentId === component.id)
          const val = parseFloat(sheetVal?.value ?? component.defaultValue)
          componentValues.push({
            componentId: component.id,
            componentName: component.name,
            value: isNaN(val) ? 0 : val,
            editableByPlayer: true,
          })
          total += isNaN(val) ? 0 : val
        } else {
          // Use configured default
          const defaultVal = parseFloat(component.defaultValue)
          componentValues.push({
            componentId: component.id,
            componentName: component.name,
            value: isNaN(defaultVal) ? 0 : defaultVal,
            editableByPlayer: false,
          })
          total += isNaN(defaultVal) ? 0 : defaultVal
        }
      }

      // Sum attribute modifiers (ignore negative)
      const attributeModifierValues: Array<{ attributeId: string; attributeKey: string; attributeName: string; enabled: boolean; rawModifier: number; effectiveModifier: number }> = []
      for (const am of resistance.attributeModifiers) {
        if (!am.enabled) continue
        const rawMod = attributeModifiers.get(am.attributeId) ?? 0
        const effectiveMod = Math.max(rawMod, 0) // Ignore negative
        total += effectiveMod
        attributeModifierValues.push({
          attributeId: am.attributeId,
          attributeKey: am.attribute.key,
          attributeName: am.attribute.name,
          enabled: am.enabled,
          rawModifier: rawMod,
          effectiveModifier: effectiveMod,
        })
      }

      results.push({
        resistanceId: resistance.id,
        name: resistance.name,
        calculationType: 'CALCULATED',
        total,
        componentValues,
        attributeModifierValues,
      })
    }

    return results
  }

  /**
   * Calculate a single resistance for a character sheet.
   */
  async calculateSingleResistance(sheetId: string, resistanceId: string) {
    const allResistances = await this.calculateResistances(sheetId)
    return allResistances.find(r => r.resistanceId === resistanceId) ?? null
  }
}