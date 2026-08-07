jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test } from '@nestjs/testing'
import { I18nService } from 'nestjs-i18n'
import { ResistanceCalculationService, CalculatedResult } from './resistance-calculation.service'
import { PrismaService } from '../prisma.service'
import { FormulaService } from '../formula/formula.service'
import { createMockPrismaService } from '../__mocks__/prisma-service.mock'
import { createI18nServiceMock } from '../i18n/i18n-testing.js'

describe('ResistanceCalculationService', () => {
  let service: ResistanceCalculationService
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

  const baseTemplate = {
    id: 't1',
    attributeModifierFormula: 'floor((value - 10) / 2)',
    attributeModifiersEnabled: true,
  }

  const templateResistance = {
    id: 'tr1',
    name: 'Physical Resistance',
    calculationType: 'CALCULATED',
    order: 0,
    templateId: 't1',
    components: [
      {
        id: 'trc1',
        name: 'Base',
        defaultValue: '5',
        editableByPlayer: false,
        order: 0,
        resistanceId: 'tr1',
      },
      {
        id: 'trc2',
        name: 'Bonus',
        defaultValue: '0',
        editableByPlayer: true,
        order: 1,
        resistanceId: 'tr1',
      },
    ],
    attributeModifiers: [
      {
        id: 'tram1',
        attributeId: 'attr1',
        enabled: true,
        resistanceId: 'tr1',
        attribute: { id: 'attr1', key: 'dex', name: 'Dexterity' },
      },
      {
        id: 'tram2',
        attributeId: 'attr2',
        enabled: false,
        resistanceId: 'tr1',
        attribute: { id: 'attr2', key: 'str', name: 'Strength' },
      },
    ],
  }

  beforeEach(async () => {
    prisma = createMockPrismaService()
    jest.clearAllMocks()

    const module = await Test.createTestingModule({
      providers: [
        ResistanceCalculationService,
        { provide: PrismaService, useValue: prisma },
        FormulaService,
        { provide: I18nService, useValue: createI18nServiceMock() },
      ],
    }).compile()

    service = module.get<ResistanceCalculationService>(ResistanceCalculationService)
    formulaService = module.get<FormulaService>(FormulaService)
  })

  describe('calculateResistances', () => {
    describe('sheet not found', () => {
      it('returns empty array when sheet does not exist', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(null)

        const result = await service.calculateResistances('nonexistent')

        expect(result).toEqual([])
      })
    })

    describe('template resistances (CALCULATED)', () => {
      it('calculates template resistances with components and attribute modifiers', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateResistance.findMany.mockResolvedValue([templateResistance])
        prisma.sheetResistance.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceValue.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceComponentValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockReturnValue(2)

        const results = await service.calculateResistances('s1')

        expect(results).toHaveLength(1)
        const r = results[0]
        expect(r.resistanceId).toBe('tr1')
        expect(r.name).toBe('Physical Resistance')
        expect(r.calculationType).toBe('CALCULATED')
        // total = 5 (base) + 0 (bonus default) + 2 (dex mod from enabled attr)
        expect(r.total).toBe(7)
        expect(r.componentValues).toHaveLength(2)
        expect(r.attributeModifierValues).toHaveLength(1) // only enabled attr
        expect(r.attributeModifierValues[0].attributeId).toBe('attr1')
        expect(r.attributeModifierValues[0].effectiveModifier).toBe(2)
      })

      it('overrides editable components with player values from junction table', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateResistance.findMany.mockResolvedValue([templateResistance])
        prisma.sheetResistance.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceValue.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceComponentValue.findMany.mockResolvedValue([
          { componentId: 'trc2', value: '3' }, // bonus overridden by player
        ])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockReturnValue(2)

        const results = await service.calculateResistances('s1')

        // total = 5 (base) + 3 (player bonus) + 2 (dex mod)
        expect(results[0].total).toBe(10)
        expect(results[0].componentValues[1].value).toBe(3)
      })

      it('handles NaN in component values gracefully', async () => {
        const badResistance = {
          ...templateResistance,
          components: [
            {
              ...templateResistance.components[0],
              defaultValue: 'not-a-number',
            },
          ],
        }

        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateResistance.findMany.mockResolvedValue([badResistance])
        prisma.sheetResistance.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceValue.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceComponentValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockReturnValue(2)

        const results = await service.calculateResistances('s1')

        // NaN defaults to 0
        expect(results[0].componentValues[0].value).toBe(0)
      })

      it('sets effectiveModifier to max(rawMod, 0) for resistances', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateResistance.findMany.mockResolvedValue([templateResistance])
        prisma.sheetResistance.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceValue.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceComponentValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        // Negative modifier
        jest.spyOn(formulaService, 'evaluate').mockReturnValue(-3)

        const results = await service.calculateResistances('s1')

        // effectiveModifier should be 0 (max(-3, 0))
        expect(results[0].attributeModifierValues[0].rawModifier).toBe(-3)
        expect(results[0].attributeModifierValues[0].effectiveModifier).toBe(0)
      })

      it('includes only enabled attribute modifiers', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateResistance.findMany.mockResolvedValue([templateResistance])
        prisma.sheetResistance.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceValue.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceComponentValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockReturnValue(2)

        const results = await service.calculateResistances('s1')

        // Second attr modifier has enabled=false → should be skipped
        expect(results[0].attributeModifierValues).toHaveLength(1)
      })
    })

    describe('template resistances (MANUAL)', () => {
      it('reads manual value from junction table for template MANUAL resistances', async () => {
        const manualResistance = {
          ...templateResistance,
          calculationType: 'MANUAL',
          components: [],
          attributeModifiers: [],
        }

        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateResistance.findMany.mockResolvedValue([manualResistance])
        prisma.sheetResistance.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceValue.findMany.mockResolvedValue([
          { resistanceId: 'tr1', manualValue: '15' },
        ])
        prisma.characterSheetResistanceComponentValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        const results = await service.calculateResistances('s1')

        expect(results[0].total).toBe(15)
        expect(results[0].componentValues).toHaveLength(0)
        expect(results[0].attributeModifierValues).toHaveLength(0)
      })

      it('defaults to 0 when no manual value is set', async () => {
        const manualResistance = {
          ...templateResistance,
          calculationType: 'MANUAL',
          components: [],
          attributeModifiers: [],
        }

        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateResistance.findMany.mockResolvedValue([manualResistance])
        prisma.sheetResistance.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceValue.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceComponentValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        const results = await service.calculateResistances('s1')

        expect(results[0].total).toBe(0)
      })

      it('defaults to 0 when manualValue is null', async () => {
        const manualResistance = {
          ...templateResistance,
          calculationType: 'MANUAL',
          components: [],
          attributeModifiers: [],
        }

        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateResistance.findMany.mockResolvedValue([manualResistance])
        prisma.sheetResistance.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceValue.findMany.mockResolvedValue([
          { resistanceId: 'tr1', manualValue: null },
        ])
        prisma.characterSheetResistanceComponentValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        const results = await service.calculateResistances('s1')

        expect(results[0].total).toBe(0)
      })
    })

    describe('sheet-specific resistances', () => {
      it('calculates sheet-specific MANUAL resistances by summing components', async () => {
        const sheetRes = {
          id: 'sr1',
          name: 'Custom Resistance',
          calculationType: 'MANUAL',
          order: 0,
          sheetId: 's1',
          components: [
            {
              id: 'src1',
              name: 'Value',
              value: '8',
              editableByPlayer: false,
              order: 0,
              resistanceId: 'sr1',
              sheetResistanceId: 'sr1',
            },
          ],
          attributeModifiers: [],
        }

        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateResistance.findMany.mockResolvedValue([])
        prisma.sheetResistance.findMany.mockResolvedValue([sheetRes])
        prisma.characterSheetResistanceValue.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceComponentValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        const results = await service.calculateResistances('s1')

        expect(results).toHaveLength(1)
        expect(results[0].resistanceId).toBe('sr1')
        expect(results[0].total).toBe(8)
      })

      it('calculates sheet-specific CALCULATED resistances with components', async () => {
        const sheetRes = {
          id: 'sr1',
          name: 'Custom Calculated',
          calculationType: 'CALCULATED',
          order: 0,
          sheetId: 's1',
          components: [
            {
              id: 'src1',
              name: 'Base',
              value: '5',
              editableByPlayer: false,
              order: 0,
              resistanceId: 'sr1',
              sheetResistanceId: 'sr1',
            },
          ],
          attributeModifiers: [],
        }

        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateResistance.findMany.mockResolvedValue([])
        prisma.sheetResistance.findMany.mockResolvedValue([sheetRes])
        prisma.characterSheetResistanceValue.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceComponentValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        const results = await service.calculateResistances('s1')

        expect(results).toHaveLength(1)
        expect(results[0].total).toBe(5)
        expect(results[0].componentValues).toHaveLength(1)
        expect(results[0].componentValues[0].value).toBe(5)
      })

      it('calculates sheet-specific CALCULATED resistances with attribute modifiers', async () => {
        const sheetRes = {
          id: 'sr2',
          name: 'Custom With Mods',
          calculationType: 'CALCULATED',
          order: 0,
          sheetId: 's1',
          components: [
            {
              id: 'src2',
              name: 'Base',
              value: '5',
              editableByPlayer: false,
              order: 0,
              resistanceId: 'sr2',
              sheetResistanceId: 'sr2',
            },
          ],
          attributeModifiers: [
            {
              id: 'sram1',
              attributeId: 'attr1',
              enabled: true,
              attribute: { id: 'attr1', key: 'dex', name: 'Dexterity' },
            },
          ],
        }

        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateResistance.findMany.mockResolvedValue([])
        prisma.sheetResistance.findMany.mockResolvedValue([sheetRes])
        prisma.characterSheetResistanceValue.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceComponentValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockReturnValue(2)

        const results = await service.calculateResistances('s1')

        expect(results).toHaveLength(1)
        expect(results[0].total).toBe(7) // 5 (base) + 2 (dex mod)
        expect(results[0].attributeModifierValues).toHaveLength(1)
        expect(results[0].attributeModifierValues[0].attributeId).toBe('attr1')
        expect(results[0].attributeModifierValues[0].effectiveModifier).toBe(2)
      })
    })

    describe('attribute modifier formula', () => {
      it('skips modifiers when formula is null', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateResistance.findMany.mockResolvedValue([templateResistance])
        prisma.sheetResistance.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceValue.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceComponentValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue({
          id: 't1',
          attributeModifierFormula: null,
          attributeModifiersEnabled: true,
        })

        jest.spyOn(formulaService, 'evaluate')

        const results = await service.calculateResistances('s1')

        expect(formulaService.evaluate).not.toHaveBeenCalled()
        expect(results[0].attributeModifierValues).toHaveLength(1) // attr still listed, modifier is 0
        expect(results[0].attributeModifierValues[0].rawModifier).toBe(0)
      })

      it('skips attribute modifiers entirely when modifiersEnabled is false', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateResistance.findMany.mockResolvedValue([templateResistance])
        prisma.sheetResistance.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceValue.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceComponentValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue({
          id: 't1',
          attributeModifierFormula: 'floor((value - 10) / 2)',
          attributeModifiersEnabled: false,
        })

        jest.spyOn(formulaService, 'evaluate')

        const results = await service.calculateResistances('s1')

        expect(formulaService.evaluate).not.toHaveBeenCalled()
        expect(results[0].attributeModifierValues).toHaveLength(0)
        // total should be just component values without modifiers
        expect(results[0].total).toBe(5)
      })

      it('handles formula evaluation error gracefully', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateResistance.findMany.mockResolvedValue([templateResistance])
        prisma.sheetResistance.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceValue.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceComponentValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockImplementation(() => {
          throw new Error('formula error')
        })

        // Should not throw — errors caught and set to 0
        const results = await service.calculateResistances('s1')

        expect(results[0].attributeModifierValues[0].rawModifier).toBe(0)
      })

      it('handles NaN attribute values as 0', async () => {
        const sheet = {
          ...baseSheet,
          values: [
            { attributeId: 'attr1', value: 'not-a-number', attribute: { id: 'attr1', key: 'dex', name: 'Dexterity' } },
          ],
        }

        prisma.characterSheet.findUnique.mockResolvedValue(sheet)
        prisma.templateResistance.findMany.mockResolvedValue([templateResistance])
        prisma.sheetResistance.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceValue.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceComponentValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(baseTemplate)

        jest.spyOn(formulaService, 'evaluate').mockReturnValue(0)

        const results = await service.calculateResistances('s1')

        expect(results).toHaveLength(1)
      })
    })

    describe('template defaults', () => {
      it('uses defaults when template is null', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(baseSheet)
        prisma.templateResistance.findMany.mockResolvedValue([templateResistance])
        prisma.sheetResistance.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceValue.findMany.mockResolvedValue([])
        prisma.characterSheetResistanceComponentValue.findMany.mockResolvedValue([])
        prisma.template.findUnique.mockResolvedValue(null)

        jest.spyOn(formulaService, 'evaluate')

        const results = await service.calculateResistances('s1')

        // formula not called = formula null → modifier stays 0
        expect(formulaService.evaluate).not.toHaveBeenCalled()
        expect(results[0].total).toBe(5) // just base component value
      })
    })

    describe('error propagation', () => {
      it('rejects when prisma throws', async () => {
        prisma.characterSheet.findUnique.mockRejectedValue(new Error('DB error'))

        await expect(service.calculateResistances('s1')).rejects.toThrow('DB error')
      })
    })
  })

  describe('calculateSingleResistance', () => {
    it('returns the matching resistance result', async () => {
      const singleRes = {
        resistanceId: 'tr1',
        name: 'Physical Resistance',
        calculationType: 'CALCULATED',
        total: 10,
        componentValues: [],
        attributeModifierValues: [],
      }

      // Mock calculateResistances to return an array with our result
      jest.spyOn(service as any, 'calculateResistances').mockResolvedValue([
        { ...singleRes, resistanceId: 'other' },
        singleRes,
      ])

      const result = await service.calculateSingleResistance('s1', 'tr1')

      expect(result).not.toBeNull()
      expect(result!.resistanceId).toBe('tr1')
    })

    it('returns null when resistance not found', async () => {
      jest.spyOn(service as any, 'calculateResistances').mockResolvedValue([])

      const result = await service.calculateSingleResistance('s1', 'nonexistent')

      expect(result).toBeNull()
    })
  })
})
