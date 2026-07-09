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
   * Calculate the Armor Class for a given character sheet.
   * Returns total AC with breakdown of components and attribute modifiers.
   */
  async calculateArmorClass(sheetId: string) {
    const sheet = await this.prisma.characterSheet.findUnique({
      where: { id: sheetId },
      select: {
        id: true,
        templateId: true,
        values: { include: { attribute: true } },
      },
    })
    if (!sheet) return null

    // Fetch AC config
    const armorClass = await this.prisma.templateArmorClass.findUnique({
      where: { templateId: sheet.templateId },
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

    if (!armorClass?.enabled) return null

    // Fetch sheet AC field values
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
      const num = parseFloat(v.value)
      attrValues.set(v.attributeId, isNaN(num) ? 0 : num)
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

    let total = 0

    // Sum AC field values
    const fieldBreakdown: Array<{
      fieldId: string
      fieldName: string
      value: number
      editableByPlayer: boolean
    }> = []

    for (const field of armorClass.fields) {
      if (field.editableByPlayer) {
        const sheetVal = sheetFieldValues.find(sv => sv.fieldId === field.id)
        const val = parseFloat(sheetVal?.value ?? field.defaultValue)
        fieldBreakdown.push({
          fieldId: field.id,
          fieldName: field.name,
          value: isNaN(val) ? 0 : val,
          editableByPlayer: true,
        })
        total += isNaN(val) ? 0 : val
      } else {
        const defaultVal = parseFloat(field.defaultValue)
        fieldBreakdown.push({
          fieldId: field.id,
          fieldName: field.name,
          value: isNaN(defaultVal) ? 0 : defaultVal,
          editableByPlayer: false,
        })
        total += isNaN(defaultVal) ? 0 : defaultVal
      }
    }

    // Sum attribute modifiers
    const attributeModifierBreakdown: Array<{
      acModifierId: string
      attributeId: string
      attributeKey: string
      attributeName: string
      allowPlayerSelection: boolean
      selectedAttributeKey: string | null
      selectedAttributeName: string | null
      rawModifier: number
      effectiveModifier: number
    }> = []

    if (modifiersEnabled) {
      for (const am of armorClass.attributeModifiers) {
        // Determine which attribute to use
        let effectiveAttrId = am.attributeId // Default to the configured attribute

        if (am.allowPlayerSelection) {
          const sheetAv = sheetAttributeValues.find(sav => sav.acAttributeModifierId === am.id)
          if (sheetAv?.selectedAttributeId) {
            effectiveAttrId = sheetAv.selectedAttributeId
          } else if (am.defaultAttributeId) {
            effectiveAttrId = am.defaultAttributeId
          }
        }

        const rawMod = attributeModifiers.get(effectiveAttrId) ?? 0
        total += rawMod

        // Get attribute info
        const attr = sheet.values.find(v => v.attributeId === effectiveAttrId)
        const selectedAttr = am.allowPlayerSelection
          ? sheetAttributeValues.find(sav => sav.acAttributeModifierId === am.id)?.selectedAttribute
          : null

        attributeModifierBreakdown.push({
          acModifierId: am.id,
          attributeId: effectiveAttrId,
          attributeKey: attr?.attribute?.key ?? '',
          attributeName: attr?.attribute?.name ?? '',
          allowPlayerSelection: am.allowPlayerSelection,
          selectedAttributeKey: selectedAttr?.key ?? null,
          selectedAttributeName: selectedAttr?.name ?? null,
          rawModifier: rawMod,
          effectiveModifier: rawMod,
        })
      }
    }

    return {
      total,
      fieldBreakdown,
      attributeModifierBreakdown,
    }
  }
}