import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { FormulaService } from '../formula/formula.service.js'

/** Common shape used for both template and sheet resistances in the calculation loop. */
interface ResistanceInput {
  id: string
  name: string
  calculationType: string
  /** For template resistances: component's defaultValue; for sheet resistances: component's value */
  components: Array<{
    id: string
    name: string
    editableByPlayer: boolean
    /** Template: defaultValue from schema; Sheet: value from schema */
    baseValue: string
  }>
  attributeModifiers: Array<{
    id: string
    attributeId: string
    attributeKey: string
    attributeName: string
    enabled: boolean
  }>
}

/** Shape returned for each calculated resistance. */
export interface CalculatedResult {
  resistanceId: string
  name: string
  calculationType: string
  total: number
  componentValues: Array<{ componentId: string; componentName: string; value: number; editableByPlayer: boolean }>
  attributeModifierValues: Array<{ attributeId: string; attributeKey: string; attributeName: string; enabled: boolean; rawModifier: number; effectiveModifier: number }>
}

@Injectable()
export class ResistanceCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formulaService: FormulaService,
  ) {}

  /**
   * Calculate all resistances for a given character sheet.
   * Returns an array of { resistanceId, name, total, calculationType, components, attributeModifiers }.
   * Merges template-level (global) and sheet-specific resistances.
   */
  async calculateResistances(sheetId: string) {
    // Fetch the sheet with its template
    const sheet = await this.prisma.characterSheet.findUnique({
      where: { id: sheetId },
      select: {
        id: true,
        templateId: true,
        values: { include: { attribute: true } },
      },
    })
    if (!sheet) return []

    // ── 1. Fetch template resistances (global, shared across sheets) ──
    const templateResistances = await this.prisma.templateResistance.findMany({
      where: { templateId: sheet.templateId },
      orderBy: { order: 'asc' },
      include: {
        components: { orderBy: { order: 'asc' } },
        attributeModifiers: { include: { attribute: true } },
      },
    })

    // ── 2. Fetch sheet-specific resistances (owned by this sheet only) ──
    const sheetResistances = await this.prisma.sheetResistance.findMany({
      where: { sheetId },
      orderBy: { order: 'asc' },
      include: {
        components: { orderBy: { order: 'asc' } },
        attributeModifiers: { include: { attribute: true } },
      },
    })

    // ── 3. Fetch sheet-level value overrides (for template resistances only) ──
    const sheetResistanceValues = await this.prisma.characterSheetResistanceValue.findMany({
      where: { sheetId },
    })
    const sheetComponentValues = await this.prisma.characterSheetResistanceComponentValue.findMany({
      where: { sheetId },
    })

    // ── 4. Build attribute value & modifier maps ──
    const attrValues = new Map<string, number>()
    for (const v of sheet.values) {
      const num = Number.parseFloat(v.value)
      attrValues.set(v.attributeId, Number.isNaN(num) ? 0 : num)
    }

    const template = await this.prisma.template.findUnique({
      where: { id: sheet.templateId },
      select: { attributeModifierFormula: true, attributeModifiersEnabled: true },
    })
    const formula = template?.attributeModifierFormula ?? null
    const modifiersEnabled = template?.attributeModifiersEnabled ?? true

    const attributeModifiers = new Map<string, number>()
    if (formula && modifiersEnabled) {
      for (const v of sheet.values) {
        const attrValue = attrValues.get(v.attributeId) ?? 0
        try {
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

    // ── 5. Build results from all resistance sources ──
    const results: CalculatedResult[] = []

    // Process template resistances (with junction-table overrides)
    for (const tr of templateResistances) {
      results.push(
        this.calculateOneResistance({
          resistance: {
            id: tr.id,
            name: tr.name,
            calculationType: tr.calculationType,
            components: tr.components.map(c => ({
              id: c.id,
              name: c.name,
              editableByPlayer: c.editableByPlayer,
              baseValue: c.defaultValue,
            })),
            attributeModifiers: tr.attributeModifiers.map(am => ({
              id: am.id,
              attributeId: am.attributeId,
              attributeKey: am.attribute.key,
              attributeName: am.attribute.name,
              enabled: am.enabled,
            })),
          },
          isTemplate: true,
          sheetResistanceValues,
          sheetComponentValues,
          attrValues,
          attributeModifiers,
          modifiersEnabled,
        }),
      )
    }

    // Process sheet-specific resistances (values stored directly on components)
    for (const sr of sheetResistances) {
      results.push(
        this.calculateOneResistance({
          resistance: {
            id: sr.id,
            name: sr.name,
            calculationType: sr.calculationType,
            components: sr.components.map(c => ({
              id: c.id,
              name: c.name,
              editableByPlayer: c.editableByPlayer,
              baseValue: c.value, // Sheet components store value directly
            })),
            attributeModifiers: sr.attributeModifiers.map(am => ({
              id: am.id,
              attributeId: am.attributeId,
              attributeKey: am.attribute.key,
              attributeName: am.attribute.name,
              enabled: am.enabled,
            })),
          },
          isTemplate: false,
          sheetResistanceValues: [],
          sheetComponentValues: [], // No junction table for sheet resistances
          attrValues,
          attributeModifiers,
          modifiersEnabled,
        }),
      )
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

  /**
   * Calculate the total for one resistance (template or sheet-specific).
   */
  private calculateOneResistance(opts: {
    resistance: ResistanceInput
    isTemplate: boolean
    sheetResistanceValues: Array<{ resistanceId: string; manualValue: string | null }>
    sheetComponentValues: Array<{ componentId: string; value: string }>
    attrValues: Map<string, number>
    attributeModifiers: Map<string, number>
    modifiersEnabled: boolean
  }): CalculatedResult {
    const {
      resistance,
      isTemplate,
      sheetResistanceValues,
      sheetComponentValues,
      attributeModifiers,
      modifiersEnabled,
    } = opts

    if (resistance.calculationType === 'MANUAL') {
      let manualVal = 0
      if (isTemplate) {
        // Template: read from junction table
        const sv = sheetResistanceValues.find(r => r.resistanceId === resistance.id)
        manualVal = Number.parseFloat(sv?.manualValue ?? '0')
      } else {
        // Sheet: sum component values (typically one component storing the value)
        manualVal = resistance.components.reduce(
          (sum, c) => sum + Number.parseFloat(c.baseValue || '0'),
          0,
        )
      }
      return {
        resistanceId: resistance.id,
        name: resistance.name,
        calculationType: 'MANUAL',
        total: Number.isNaN(manualVal) ? 0 : manualVal,
        componentValues: [],
        attributeModifierValues: [],
      }
    }

    // CALCULATED resistance
    let total = 0

    const componentValues: CalculatedResult['componentValues'] = []
    for (const component of resistance.components) {
      let val: number
      if (component.editableByPlayer && isTemplate) {
        // Template: use player override from junction table, else defaultValue (stored as baseValue)
        const sheetVal = sheetComponentValues.find(scv => scv.componentId === component.id)
        val = Number.parseFloat(sheetVal?.value ?? component.baseValue)
      } else {
        // Template non-editable or sheet: use baseValue directly
        val = Number.parseFloat(component.baseValue)
      }
      componentValues.push({
        componentId: component.id,
        componentName: component.name,
        value: Number.isNaN(val) ? 0 : val,
        editableByPlayer: component.editableByPlayer,
      })
      total += Number.isNaN(val) ? 0 : val
    }

    const attributeModifierValues: CalculatedResult['attributeModifierValues'] = []
    if (modifiersEnabled) {
      for (const am of resistance.attributeModifiers) {
        if (!am.enabled) continue
        const rawMod = attributeModifiers.get(am.attributeId) ?? 0
        const effectiveMod = Math.max(rawMod, 0)
        total += effectiveMod
        attributeModifierValues.push({
          attributeId: am.attributeId,
          attributeKey: am.attributeKey,
          attributeName: am.attributeName,
          enabled: am.enabled,
          rawModifier: rawMod,
          effectiveModifier: effectiveMod,
        })
      }
    }

    return {
      resistanceId: resistance.id,
      name: resistance.name,
      calculationType: 'CALCULATED',
      total,
      componentValues,
      attributeModifierValues,
    }
  }
}