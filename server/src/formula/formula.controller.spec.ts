jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
import { Test, TestingModule } from '@nestjs/testing'
import { FormulaController } from './formula.controller.js'
import { FormulaService } from './formula.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'

describe('FormulaController', () => {
  let controller: FormulaController
  let mockFormulaService: Record<string, jest.Mock>

  beforeEach(async () => {
    jest.clearAllMocks()

    mockFormulaService = {
      evaluate: jest.fn().mockReturnValue(42),
      preview: jest.fn().mockReturnValue({ expression: 'str + dex', result: 15 }),
      validate: jest.fn().mockReturnValue(undefined),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FormulaController],
      providers: [
        { provide: FormulaService, useValue: mockFormulaService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile()

    controller = module.get<FormulaController>(FormulaController)
  })

  describe('evaluate', () => {
    it('should call formulaService.evaluate and return the result wrapped in an object', () => {
      const dto = { formula: 'str + dex', variables: { str: 10, dex: 5 } }
      const result = controller.evaluate(dto)
      expect(mockFormulaService.evaluate).toHaveBeenCalledWith('str + dex', { str: 10, dex: 5 })
      expect(result).toEqual({ result: 42 })
    })
  })

  describe('preview', () => {
    it('should call formulaService.preview and return its result directly', () => {
      const dto = { formula: 'str + dex', variables: { str: 10, dex: 5 } }
      const result = controller.preview(dto)
      expect(mockFormulaService.preview).toHaveBeenCalledWith('str + dex', { str: 10, dex: 5 })
      expect(result).toEqual({ expression: 'str + dex', result: 15 })
    })
  })

  describe('validate', () => {
    it('should call formulaService.validate and return { valid: true }', () => {
      const dto = { formula: 'str + dex', variables: ['str', 'dex'] }
      const result = controller.validate(dto)
      expect(mockFormulaService.validate).toHaveBeenCalledWith('str + dex', ['str', 'dex'])
      expect(result).toEqual({ valid: true })
    })
  })
})
