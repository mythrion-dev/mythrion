jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test, TestingModule } from '@nestjs/testing'
import { PreviewFormulaController } from './preview-formula.controller.js'
import { FormulaService } from './formula.service.js'

describe('PreviewFormulaController', () => {
  let controller: PreviewFormulaController
  let mockFormulaService: Record<string, jest.Mock>

  beforeEach(async () => {
    jest.clearAllMocks()

    mockFormulaService = {
      evaluate: jest.fn().mockReturnValue(42),
      preview: jest.fn().mockReturnValue({ expression: 'str + dex', result: 15 }),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreviewFormulaController],
      providers: [
        { provide: FormulaService, useValue: mockFormulaService },
      ],
    }).compile()

    controller = module.get<PreviewFormulaController>(PreviewFormulaController)
  })

  describe('evaluate', () => {
    it('should call formulaService.evaluate and return the result wrapped in an object', () => {
      const dto = { formula: 'str + dex', variables: { str: 10, dex: 5 } }
      const result = controller.evaluate(dto)
      expect(mockFormulaService.evaluate).toHaveBeenCalledWith('str + dex', { str: 10, dex: 5 })
      expect(result).toEqual({ result: 42 })
    })

    it('should pass through the formula without modification', () => {
      const dto = { formula: 'floor((str - 10) / 2)', variables: { str: 14 } }
      controller.evaluate(dto)
      expect(mockFormulaService.evaluate).toHaveBeenCalledWith('floor((str - 10) / 2)', { str: 14 })
    })

    it('should pass through complex variable maps', () => {
      const dto = { formula: 'str + dex + con', variables: { str: 10, dex: 14, con: 12 } }
      controller.evaluate(dto)
      expect(mockFormulaService.evaluate).toHaveBeenCalledWith('str + dex + con', { str: 10, dex: 14, con: 12 })
    })
  })

  describe('preview', () => {
    it('should call formulaService.preview and return its result directly', () => {
      const dto = { formula: 'str + dex', variables: { str: 10, dex: 5 } }
      const result = controller.preview(dto)
      expect(mockFormulaService.preview).toHaveBeenCalledWith('str + dex', { str: 10, dex: 5 })
      expect(result).toEqual({ expression: 'str + dex', result: 15 })
    })

    it('should pass through the formula and variables to the service', () => {
      const dto = { formula: 'level + prof', variables: { level: 5, prof: 2 } }
      controller.preview(dto)
      expect(mockFormulaService.preview).toHaveBeenCalledWith('level + prof', { level: 5, prof: 2 })
    })
  })

  describe('auth', () => {
    it('should NOT have a @UseGuards(JwtAuthGuard) decorator on the controller class', () => {
      // Reflect metadata to verify no auth guard is present
      const guards = Reflect.getMetadata('__guards__', PreviewFormulaController)
      expect(guards).toBeUndefined()
    })

    it('should NOT have a @UseGuards(JwtAuthGuard) decorator on the evaluate method', () => {
      const guards = Reflect.getMetadata('__guards__', PreviewFormulaController.prototype.evaluate)
      expect(guards).toBeUndefined()
    })

    it('should NOT have a @UseGuards(JwtAuthGuard) decorator on the preview method', () => {
      const guards = Reflect.getMetadata('__guards__', PreviewFormulaController.prototype.preview)
      expect(guards).toBeUndefined()
    })
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
