jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { FormulaService } from './formula.service.js'

describe('FormulaService', () => {
  let service: FormulaService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FormulaService],
    }).compile()

    service = module.get<FormulaService>(FormulaService)
  })

  describe('evaluate', () => {
    it('should evaluate simple arithmetic: "2+2" returns 4', () => {
      const result = service.evaluate('2+2', {})
      expect(result).toBe(4)
    })

    it('should evaluate with mod syntax: mod(str) + 5', () => {
      // mod(str) is transformed to str_mod
      const result = service.evaluate('mod(str) + 5', { str_mod: 10 })
      expect(result).toBe(15)
    })

    it('should round to 2 decimal places', () => {
      const result = service.evaluate('10/3', {})
      expect(result).toBe(3.33)
    })

    it('should throw BadRequestException on non-number result', () => {
      // A string result should throw
      expect(() => service.evaluate('"hello"', {})).toThrow(BadRequestException)
    })

    it('should throw BadRequestException on NaN/Infinity', () => {
      expect(() => service.evaluate('1/0', {})).toThrow(BadRequestException)
    })

    it('should return 0 for empty formula', () => {
      expect(service.evaluate('', {})).toBe(0)
    })

    it('should return 0 for whitespace-only formula', () => {
      expect(service.evaluate('   ', {})).toBe(0)
    })

    it('should wrap non-BadRequestException errors', () => {
      expect(() => service.evaluate('unknownVar', {})).toThrow(BadRequestException)
    })
  })

  describe('validate', () => {
    it('should return void for a valid formula', () => {
      expect(() => service.validate('2+2', [])).not.toThrow()
    })

    it('should throw BadRequestException for invalid syntax', () => {
      expect(() => service.validate('2++', [])).toThrow(BadRequestException)
    })

    it('should throw BadRequestException for blocked functions like sin', () => {
      expect(() => service.validate('sin(5)', [])).toThrow(BadRequestException)
    })

    it('should validate a formula with known variables', () => {
      expect(() => service.validate('str_mod + dex_mod', ['str_mod', 'dex_mod'])).not.toThrow()
    })

    it('should throw BadRequestException for unknown variables', () => {
      expect(() => service.validate('unknown_var', ['str_mod'])).toThrow(BadRequestException)
    })

    it('should not throw for empty formula (no-op branch)', () => {
      expect(() => service.validate('', ['str'])).not.toThrow()
    })

    it('should not throw for whitespace-only formula', () => {
      expect(() => service.validate('   ', ['str'])).not.toThrow()
    })

    it('should throw BadRequestException for disallowed operator', () => {
      // % is parsed as an operator by mathjs and is NOT in the allowed list
      expect(() => service.validate('5 % 2', [])).toThrow(BadRequestException)
    })

    it('should validate content node (parenthesized expressions)', () => {
      expect(() => service.validate('(str + dex)', ['str', 'dex'])).not.toThrow()
    })
  })

  describe('preview', () => {
    it('should return result for a valid formula', () => {
      const result = service.preview('2+2', {})
      expect(result).toEqual({ expression: '2+2', result: 4 })
    })

    it('should return error message for an invalid formula', () => {
      const result = service.preview('2++', {})
      expect(result.expression).toBe('2++')
      expect(result.result).toBeNull()
      expect(result.error).toBeTruthy()
    })

    it('should return expression: "" for empty formula', () => {
      const result = service.preview('', {})
      expect(result).toEqual({ expression: '', result: null })
    })

    it('should return expression: "" for whitespace-only formula', () => {
      const result = service.preview('   ', {})
      expect(result).toEqual({ expression: '', result: null })
    })
  })

  describe('extractVariables', () => {
    it('should extract str_mod from mod(str) expression', () => {
      const vars = service.extractVariables('mod(str)')
      expect(vars).toEqual(['str_mod'])
    })

    it('should extract str_mod and dex_mod from combined expression', () => {
      const vars = service.extractVariables('str_mod + dex_mod')
      expect(vars).toEqual(['str_mod', 'dex_mod'])
    })

    it('should return empty array for empty string', () => {
      const vars = service.extractVariables('')
      expect(vars).toEqual([])
    })

    it('should return empty array for whitespace', () => {
      const vars = service.extractVariables('   ')
      expect(vars).toEqual([])
    })

    it('should deduplicate repeated variables', () => {
      const vars = service.extractVariables('str + str + dex')
      expect(vars).toEqual(['str', 'dex'])
    })
  })
})
