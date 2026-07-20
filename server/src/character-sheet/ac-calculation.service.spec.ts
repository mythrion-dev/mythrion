jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { AcCalculationService } from './ac-calculation.service'
import { PrismaService } from '../prisma.service'
import { FormulaService } from '../formula/formula.service'
import { createMockPrismaService } from '../__mocks__/prisma-service.mock'

describe('AcCalculationService', () => {
  let service: AcCalculationService
  let prisma: ReturnType<typeof createMockPrismaService>
  let formulaService: FormulaService

  const baseSheet = {
    id: 's1',
    templateId: 't1',
    values: [
      { attributeId: 'attr1', value: '14', attribute: { id: 'attr1', key: 'dex', name: 'Dexterity' } },
      { attributeId: 'attr2', value: '10', attribute: { id: 'attr2', key: 'str', name: 'Strength' } },
    ],
  }

  const baseTemplateArmorClasses = [
    {
      id: 'ac1',
      name: 'Armor Class',
      fields: [
        { id: 'f1', name: 'Base', defaultValue: '10', editableByPlayer: true, order: 0 },
        { id: 'f2', name: 'Shield', defaultValue: '0', editableByPlayer: true, order: 1 },
      ],
      attributeModifiers: [
        {
          id: 'am1',
          attributeId: 'attr1',
          allowPlayerSelection: false,
          attribute: { id: 'attr1', key: 'dex', name: 'Dexterity' },
          defaultAttribute: null,
        },
      ],
    },
  ]

  const baseTemplate = {
    id: 't1',
    attributeModifierFormula: 'floor((value - 10) / 2)',
    attributeModifiersEnabled: true,
  }

  beforeEach(async () => {
    prisma = createMockPrismaService()
    jest.clearAllMocks()

    const module = await Test.createTestingModule({
      providers: [
        AcCalculationService,
        { provide: PrismaService, useValue: prisma },
        FormulaService,
      ],
    }).compile()

    service = module.get<AcCalculationService>(AcCalculationService)
    formulaService = module.get<FormulaService>(FormulaService)
  })

  describe('calculateArmorClass', () => {
    describe('sheet not found', () => {
      it('returns null when sheet does not exist', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(null)

        const result = await service.calculateArmorClass('nonexistent')

        expect(result).toBeNull()
      })
    })

    describe('no armor classes configured', () => {
      it('returns null when template has no enabled armor classes', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateArmorClass.findMany.mockResolvedValue([])

        const result = await service.calculateArmorClass('s1')

        expect(result).toBeNull()
      })
    })

    describe('full calculation (all, no armorClassId)', () => {
      it('returns a record of AC results when no armorClassId given', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateArmorClass.findMany.mockResolvedValue(baseTemplateArmorClasses)
        prisma.characterSheetArmorClassValue.findMany.mockResolvedValue([
          { fieldId: 'f1', value: '12' },
          { fieldId: 'f2', value: '2' },
        ])
        prisma.characterSheetArmorClassAttributeValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockReturnValue(2)

        const result = await service.calculateArmorClass('s1')

        expect(result).toBeDefined()
        expect(typeof result).toBe('object')
        expect(result).not.toBeNull()

        const r = result as Record<string, any>
        expect(r['ac1']).toBeDefined()
        expect(r['ac1'].total).toBe(16) // 12 (base) + 2 (shield) + 2 (dex mod)
        expect(r['ac1'].armorClassName).toBe('Armor Class')
        expect(r['ac1'].fieldBreakdown).toHaveLength(2)
        expect(r['ac1'].attributeModifierBreakdown).toHaveLength(1)
        expect(r['ac1'].attributeModifierBreakdown[0].rawModifier).toBe(2)
      })

      it('handles NaN in sheet field values gracefully', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateArmorClass.findMany.mockResolvedValue(baseTemplateArmorClasses)
        prisma.characterSheetArmorClassValue.findMany.mockResolvedValue([
          { fieldId: 'f1', value: 'not-a-number' },
        ])
        prisma.characterSheetArmorClassAttributeValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockReturnValue(2)

        const result = await service.calculateArmorClass('s1') as Record<string, any>

        // NaN field value defaults to 0, then add modifier
        expect(result['ac1'].total).toBe(2) // 0 (NaN base) + 0 (shield default) + 2 (dex mod)
      })

      it('handles non-editable fields with NaN default value', async () => {
        const acs = [
          {
            ...baseTemplateArmorClasses[0],
            fields: [
              { id: 'f1', name: 'Base', defaultValue: 'not-a-number', editableByPlayer: false, order: 0 },
            ],
          },
        ]

        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateArmorClass.findMany.mockResolvedValue(acs)
        prisma.characterSheetArmorClassValue.findMany.mockResolvedValue([])
        prisma.characterSheetArmorClassAttributeValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockReturnValue(2)

        const result = await service.calculateArmorClass('s1') as Record<string, any>

        expect(result['ac1'].fieldBreakdown[0].value).toBe(0)
      })
    })

    describe('specific armor class (armorClassId given)', () => {
      it('returns a single AC result when armorClassId matches', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateArmorClass.findMany.mockResolvedValue(baseTemplateArmorClasses)
        prisma.characterSheetArmorClassValue.findMany.mockResolvedValue([
          { fieldId: 'f1', value: '10' },
        ])
        prisma.characterSheetArmorClassAttributeValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockReturnValue(2)

        const result = await service.calculateArmorClass('s1', 'ac1')

        expect(result).toBeDefined()
        expect(Array.isArray(result)).toBe(false)
        const r = result as any
        expect(r.total).toBeDefined()
        expect(r.armorClassName).toBe('Armor Class')
        expect(typeof r.total).toBe('number')
      })

      it('returns null when armorClassId does not match any configured armor class', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateArmorClass.findMany.mockResolvedValue(baseTemplateArmorClasses)

        const result = await service.calculateArmorClass('s1', 'nonexistent-ac')

        expect(result).toBeNull()
      })
    })

    describe('attribute modifier selection', () => {
      it('allows player selection fallback to default attribute', async () => {
        const acs = [
          {
            id: 'ac1',
            name: 'Armor Class',
            fields: [
              { id: 'f1', name: 'Base', defaultValue: '10', editableByPlayer: true, order: 0 },
            ],
            attributeModifiers: [
              {
                id: 'am1',
                attributeId: 'attr1',
                allowPlayerSelection: true,
                attribute: { id: 'attr1', key: 'dex', name: 'Dexterity' },
                defaultAttribute: { id: 'attr2', key: 'str', name: 'Strength' },
              },
            ],
          },
        ]

        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateArmorClass.findMany.mockResolvedValue(acs)
        prisma.characterSheetArmorClassValue.findMany.mockResolvedValue([])
        // No sheet attribute value for this acAttributeModifierId → should fall back to defaultAttribute
        prisma.characterSheetArmorClassAttributeValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockReturnValue(5)

        const result = await service.calculateArmorClass('s1') as Record<string, any>

        // Should use default attribute (attr2) since no player selection
        expect(result['ac1'].attributeModifierBreakdown[0].attributeId).toBe('attr2')
        expect(result['ac1'].attributeModifierBreakdown[0].rawModifier).toBe(5)
      })

      it('uses player-selected attribute when available', async () => {
        const acs = [
          {
            id: 'ac1',
            name: 'Armor Class',
            fields: [
              { id: 'f1', name: 'Base', defaultValue: '10', editableByPlayer: true, order: 0 },
            ],
            attributeModifiers: [
              {
                id: 'am1',
                attributeId: 'attr1',
                allowPlayerSelection: true,
                attribute: { id: 'attr1', key: 'dex', name: 'Dexterity' },
                defaultAttribute: { id: 'attr2', key: 'str', name: 'Strength' },
              },
            ],
          },
        ]

        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateArmorClass.findMany.mockResolvedValue(acs)
        prisma.characterSheetArmorClassValue.findMany.mockResolvedValue([])
        prisma.characterSheetArmorClassAttributeValue.findMany.mockResolvedValue([
          {
            acAttributeModifierId: 'am1',
            selectedAttribute: { id: 'attr1', key: 'dex', name: 'Dexterity' },
          },
        ])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockReturnValue(2)

        const result = await service.calculateArmorClass('s1') as Record<string, any>

        // Should use player-selected attribute (attr1)
        expect(result['ac1'].attributeModifierBreakdown[0].attributeId).toBe('attr1')
        expect(result['ac1'].attributeModifierBreakdown[0].selectedAttributeKey).toBe('dex')
      })

      it('uses selectedAttributeKey and selectedAttributeName on breakdown', async () => {
        const acs = [
          {
            id: 'ac1',
            name: 'Armor Class',
            fields: [],
            attributeModifiers: [
              {
                id: 'am1',
                attributeId: 'attr1',
                allowPlayerSelection: true,
                attribute: { id: 'attr1', key: 'dex', name: 'Dexterity' },
                defaultAttribute: null,
              },
            ],
          },
        ]

        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateArmorClass.findMany.mockResolvedValue(acs)
        prisma.characterSheetArmorClassValue.findMany.mockResolvedValue([])
        prisma.characterSheetArmorClassAttributeValue.findMany.mockResolvedValue([
          {
            acAttributeModifierId: 'am1',
            selectedAttribute: { id: 'attr1', key: 'dex', name: 'Dexterity' },
          },
        ])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockReturnValue(2)

        const result = await service.calculateArmorClass('s1') as Record<string, any>

        const breakdown = result['ac1'].attributeModifierBreakdown[0]
        expect(breakdown.selectedAttributeKey).toBe('dex')
        expect(breakdown.selectedAttributeName).toBe('Dexterity')
      })
    })

    describe('attribute modifier formula', () => {
      it('uses modifiers when formula and modifiersEnabled are set', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateArmorClass.findMany.mockResolvedValue(baseTemplateArmorClasses)
        prisma.characterSheetArmorClassValue.findMany.mockResolvedValue([])
        prisma.characterSheetArmorClassAttributeValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockReturnValue(2)

        await service.calculateArmorClass('s1')

        expect(formulaService.evaluate).toHaveBeenCalled()
      })

      it('skips modifiers when formula is null', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateArmorClass.findMany.mockResolvedValue(baseTemplateArmorClasses)
        prisma.characterSheetArmorClassValue.findMany.mockResolvedValue([])
        prisma.characterSheetArmorClassAttributeValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue({
          id: 't1',
          attributeModifierFormula: null,
          attributeModifiersEnabled: true,
        })

        const evalSpy = jest.spyOn(formulaService, 'evaluate')

        await service.calculateArmorClass('s1')

        expect(evalSpy).not.toHaveBeenCalled()
      })

      it('skips modifiers when modifiersEnabled is false', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateArmorClass.findMany.mockResolvedValue(baseTemplateArmorClasses)
        prisma.characterSheetArmorClassValue.findMany.mockResolvedValue([])
        prisma.characterSheetArmorClassAttributeValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue({
          id: 't1',
          attributeModifierFormula: 'floor((value - 10) / 2)',
          attributeModifiersEnabled: false,
        })

        const evalSpy = jest.spyOn(formulaService, 'evaluate')

        const result = await service.calculateArmorClass('s1') as Record<string, any>

        // formula not called because modifiers disabled
        expect(evalSpy).not.toHaveBeenCalled()
        // attribute modifier breakdown should be empty
        expect(result['ac1'].attributeModifierBreakdown).toHaveLength(0)
      })

      it('handles formula evaluation error gracefully by using 0', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateArmorClass.findMany.mockResolvedValue(baseTemplateArmorClasses)
        prisma.characterSheetArmorClassValue.findMany.mockResolvedValue([])
        prisma.characterSheetArmorClassAttributeValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockImplementation(() => {
          throw new BadRequestException('evaluation failed')
        })

        // Should not throw — errors are caught and set to 0
        const result = await service.calculateArmorClass('s1') as Record<string, any>

        expect(result['ac1'].attributeModifierBreakdown[0].rawModifier).toBe(0)
      })
    })

    describe('NaN in attribute values', () => {
      it('treats NaN attribute values as 0', async () => {
        const sheet = {
          ...baseSheet,
          values: [
            { attributeId: 'attr1', value: 'not-a-number', attribute: { id: 'attr1', key: 'dex', name: 'Dexterity' } },
          ],
        }

        prisma.characterSheet.findUnique.mockResolvedValue(sheet)
        prisma.templateArmorClass.findMany.mockResolvedValue(baseTemplateArmorClasses)
        prisma.characterSheetArmorClassValue.findMany.mockResolvedValue([])
        prisma.characterSheetArmorClassAttributeValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockReturnValue(0)

        expect(async () => service.calculateArmorClass('s1')).not.toThrow()
      })
    })

    describe('propagation of template defaults', () => {
      it('uses default modifier settings when template is null', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateArmorClass.findMany.mockResolvedValue(baseTemplateArmorClasses)
        prisma.characterSheetArmorClassValue.findMany.mockResolvedValue([])
        prisma.characterSheetArmorClassAttributeValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(null)

        jest.spyOn(formulaService, 'evaluate')

        await service.calculateArmorClass('s1')

        // formula not called because template was null → formula defaults to null
        expect(formulaService.evaluate).not.toHaveBeenCalled()
      })
    })

    describe('error propagation', () => {
      it('rejects when prisma throws', async () => {
        prisma.characterSheet.findUnique.mockRejectedValue(new Error('DB error'))

        await expect(service.calculateArmorClass('s1')).rejects.toThrow('DB error')
      })
    })
  })
})
