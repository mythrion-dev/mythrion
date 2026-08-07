import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { FormulaService } from '../formula/formula.service.js'

@Injectable()
export class AcCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formulaService: FormulaService,
  ) {}

  /**
   * Calculate the Armor Class for a specific armor class config on a character sheet.
   * Returns total AC with breakdown of components and attribute modifiers.
   */
  async calculateArmorClass(sheetId: string, armorClassId?: string) {
    const sheet = await this.prisma.characterSheet.findUnique({
      where: { id: sheetId },
      select: {
        id: true,
        templateId: true,
        values: { include: { attribute: true } },
      },
    })
    if (!sheet) return null

    // Fetch all enabled AC configs
    const allArmorClasses = await this.prisma.templateArmorClass.findMany({
      where: { templateId: sheet.templateId, enabled: true },
      include: {
        fields: { orderBy: { order: 'asc' } },
        attributeModifiers: {
          include: {
            attribute: { select: { id: true, key: true, name: true } },
            defaultAttribute: { select: { id: true, key: true, name: true } },
          },
        },
      },
    })

    if (allArmorClasses.length === 0) return null

    // Fetch sheet AC field values (all, they carry fieldId which links to AC via ArmorClassField)
    const sheetFieldValues = await this.prisma.characterSheetArmorClassValue.findMany({
      where: { sheetId },
    })

    // Fetch sheet AC attribute values
    const sheetAttributeValues = await this.prisma.characterSheetArmorClassAttributeValue.findMany({
      where: { sheetId },
      include: {
        selectedAttribute: { select: { id: true, key: true, name: true } },
      },
    })

    // Build attribute value map
    const attrValues = new Map<string, number>()
    for (const v of sheet.values) {
      const num = Number.parseFloat(v.value)
      attrValues.set(v.attributeId, Number.isNaN(num) ? 0 : num)
    }

    // Fetch template's attribute modifier settings
    const template = await this.prisma.template.findUnique({
      where: { id: sheet.templateId },
      select: {
        attributeModifierFormula: true,
        attributeModifiersEnabled: true,
      },
    })

    const formula = template?.attributeModifierFormula ?? null
    const modifiersEnabled = template?.attributeModifiersEnabled ?? true

    // Calculate attribute modifiers
    const attributeModifiers = this.buildAttributeModifiers(formula, modifiersEnabled, sheet.values, attrValues)

    // Filter to requested AC or calculate all
    const armorClasses = armorClassId
      ? allArmorClasses.filter(ac => ac.id === armorClassId)
      : allArmorClasses

    // If requesting specific AC and not found, return null
    if (armorClassId && armorClasses.length === 0) return null

    // If requesting all, return a map
    if (!armorClassId) {
      const results: Record<string, AcResult> = {}
      for (const ac of armorClasses) {
        results[ac.id] = this.calculateSingleAc(
          ac,
          sheetFieldValues,
          sheetAttributeValues,
          attributeModifiers,
          modifiersEnabled,
        )
      }
      return results
    }

    // Single AC result
    return this.calculateSingleAc(
      armorClasses[0],
      sheetFieldValues,
      sheetAttributeValues,
      attributeModifiers,
      modifiersEnabled,
    )
  }

  /**
   * Build the attribute modifier map (attributeId -> modifier) using the template formula.
   */
  private buildAttributeModifiers(
    formula: string | null,
    modifiersEnabled: boolean,
    values: Array<{ attributeId: string; value: string; attribute: { key: string } }>,
    attrValues: Map<string, number>,
  ): Map<string, number> {
    const attributeModifiers = new Map<string, number>()
    if (formula && modifiersEnabled) {
      for (const v of values) {
        const attrValue = attrValues.get(v.attributeId) ?? 0
        try {
          const variables: Record<string, number> = {}
          for (const sv of values) {
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
    return attributeModifiers
  }

  private calculateSingleAc(
    armorClass: AcConfigForCalc,
    sheetFieldValues: Array<{ fieldId: string; value: string }>,
    sheetAttributeValues: Array<{
      acAttributeModifierId: string
      selectedAttribute: { id: string; key: string; name: string } | null
    }>,
    attributeModifiers: Map<string, number>,
    modifiersEnabled: boolean,
  ): AcResult {
    const { fieldBreakdown, total: fieldTotal } = this.calculateFieldBreakdown(armorClass, sheetFieldValues)
    const { attributeModifierBreakdown, total: modifierTotal } = this.calculateAttributeModifierBreakdown(
      armorClass,
      sheetAttributeValues,
      attributeModifiers,
      modifiersEnabled,
    )

    return {
      total: fieldTotal + modifierTotal,
      armorClassName: armorClass.name,
      fieldBreakdown,
      attributeModifierBreakdown,
    }
  }

  private calculateFieldBreakdown(
    armorClass: AcConfigForCalc,
    sheetFieldValues: Array<{ fieldId: string; value: string }>,
  ): { fieldBreakdown: AcResult['fieldBreakdown']; total: number } {
    let total = 0
    const fieldBreakdown: AcResult['fieldBreakdown'] = []

    for (const field of armorClass.fields) {
      if (field.editableByPlayer) {
        const sheetVal = sheetFieldValues.find(sv => sv.fieldId === field.id)
        const val = Number.parseFloat(sheetVal?.value ?? field.defaultValue)
        fieldBreakdown.push({
          fieldId: field.id,
          fieldName: field.name,
          value: Number.isNaN(val) ? 0 : val,
          editableByPlayer: true,
        })
        total += Number.isNaN(val) ? 0 : val
      } else {
        const defaultVal = Number.parseFloat(field.defaultValue)
        fieldBreakdown.push({
          fieldId: field.id,
          fieldName: field.name,
          value: Number.isNaN(defaultVal) ? 0 : defaultVal,
          editableByPlayer: false,
        })
        total += Number.isNaN(defaultVal) ? 0 : defaultVal
      }
    }

    return { fieldBreakdown, total }
  }

  private calculateAttributeModifierBreakdown(
    armorClass: AcConfigForCalc,
    sheetAttributeValues: Array<{
      acAttributeModifierId: string
      selectedAttribute: { id: string; key: string; name: string } | null
    }>,
    attributeModifiers: Map<string, number>,
    modifiersEnabled: boolean,
  ): { attributeModifierBreakdown: AcResult['attributeModifierBreakdown']; total: number } {
    let total = 0
    const attributeModifierBreakdown: AcResult['attributeModifierBreakdown'] = []

    if (modifiersEnabled) {
      for (const am of armorClass.attributeModifiers) {
        let effectiveAttrId = am.attributeId

        if (am.allowPlayerSelection) {
          const sheetAv = sheetAttributeValues.find(sav => sav.acAttributeModifierId === am.id)
          if (sheetAv?.selectedAttribute?.id) {
            effectiveAttrId = sheetAv.selectedAttribute.id
          } else if (am.defaultAttribute?.id) {
            effectiveAttrId = am.defaultAttribute.id
          }
        }

        const rawMod = attributeModifiers.get(effectiveAttrId) ?? 0
        total += rawMod

        const selectedAttr = am.allowPlayerSelection
          ? sheetAttributeValues.find(sav => sav.acAttributeModifierId === am.id)?.selectedAttribute
          : null

        attributeModifierBreakdown.push({
          acModifierId: am.id,
          attributeId: effectiveAttrId,
          attributeKey: am.attribute.key,
          attributeName: am.attribute.name,
          allowPlayerSelection: am.allowPlayerSelection,
          selectedAttributeKey: selectedAttr?.key ?? null,
          selectedAttributeName: selectedAttr?.name ?? null,
          rawModifier: rawMod,
          effectiveModifier: rawMod,
        })
      }
    }

    return { attributeModifierBreakdown, total }
  }
}

type AcConfigForCalc = {
  id: string
  name: string
  fields: Array<{
    id: string
    name: string
    defaultValue: string
    editableByPlayer: boolean
  }>
  attributeModifiers: Array<{
    id: string
    attributeId: string
    attribute: { id: string; key: string; name: string }
    defaultAttribute: { id: string; key: string; name: string } | null
    allowPlayerSelection: boolean
  }>
}

type AcResult = {
  total: number
  armorClassName: string
  fieldBreakdown: Array<{
    fieldId: string
    fieldName: string
    value: number
    editableByPlayer: boolean
  }>
  attributeModifierBreakdown: Array<{
    acModifierId: string
    attributeId: string
    attributeKey: string
    attributeName: string
    allowPlayerSelection: boolean
    selectedAttributeKey: string | null
    selectedAttributeName: string | null
    rawModifier: number
    effectiveModifier: number
  }>
}