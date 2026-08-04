jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
import { Test } from '@nestjs/testing'
import { UnauthorizedException } from '@nestjs/common'
import { LanguageService } from './language.service.js'
import { PrismaService } from '../prisma.service.js'
import { RedisService } from '../redis/redis.service.js'
import { createMockPrismaService } from '../__mocks__/prisma-service.mock.js'
import { I18nService } from 'nestjs-i18n'
import { createI18nServiceMock } from '../i18n/i18n-testing.js'

const mockRedisService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
}

describe('LanguageService', () => {
  let service: LanguageService
  let prisma: any

  beforeEach(async () => {
    jest.clearAllMocks()
    prisma = createMockPrismaService()

    const module = await Test.createTestingModule({
      providers: [
        LanguageService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: mockRedisService },
        { provide: I18nService, useValue: createI18nServiceMock() },
      ],
    }).compile()

    service = module.get<LanguageService>(LanguageService)
  })

  describe('normalize', () => {
    it('should map pt-BR to pt-BR', () => {
      expect(service.normalize('pt-BR,pt;q=0.9')).toBe('pt-BR')
    })

    it('should map bare pt to pt-BR', () => {
      expect(service.normalize('pt')).toBe('pt-BR')
    })

    it('should map en-US to en', () => {
      expect(service.normalize('en-US,en;q=0.9')).toBe('en')
    })

    it('should default to en when no header is provided', () => {
      expect(service.normalize(undefined)).toBe('en')
      expect(service.normalize(null)).toBe('en')
    })

    it('should default to en for unsupported languages', () => {
      expect(service.normalize('fr-FR,fr;q=0.9')).toBe('en')
    })
  })

  describe('updateLanguage', () => {
    it('should persist to the DB and warm the Redis cache with a 24h TTL', async () => {
      prisma.user.update.mockResolvedValue({ language: 'pt-BR' })

      const result = await service.updateLanguage('user-1', 'pt-BR')

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { language: 'pt-BR' },
        select: { language: true },
      })
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'language:user-1',
        'pt-BR',
        24 * 60 * 60,
      )
      expect(result).toBe('pt-BR')
    })
  })

  describe('getLanguage', () => {
    it('should return the cached language without touching the DB on a Redis hit', async () => {
      mockRedisService.get.mockResolvedValue('pt-BR')

      const result = await service.getLanguage('user-1')

      expect(mockRedisService.get).toHaveBeenCalledWith('language:user-1')
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
      expect(result).toBe('pt-BR')
    })

    it('should return cached en as-is on a Redis hit', async () => {
      mockRedisService.get.mockResolvedValue('en')

      const result = await service.getLanguage('user-1')

      expect(result).toBe('en')
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('should fall back to the DB and warm the cache on a cache miss', async () => {
      mockRedisService.get.mockResolvedValue(null)
      prisma.user.findUnique.mockResolvedValue({ language: 'pt-BR' })

      const result = await service.getLanguage('user-1')

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { language: true },
      })
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'language:user-1',
        'pt-BR',
        24 * 60 * 60,
      )
      expect(result).toBe('pt-BR')
    })

    it('should normalize an unsupported DB value to en when warming the cache', async () => {
      mockRedisService.get.mockResolvedValue(null)
      prisma.user.findUnique.mockResolvedValue({ language: 'fr' })

      const result = await service.getLanguage('user-1')

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'language:user-1',
        'en',
        24 * 60 * 60,
      )
      expect(result).toBe('en')
    })

    it('should ignore a stale non-language Redis value and fall back to the DB', async () => {
      mockRedisService.get.mockResolvedValue('garbage')
      prisma.user.findUnique.mockResolvedValue({ language: 'en' })

      const result = await service.getLanguage('user-1')

      expect(prisma.user.findUnique).toHaveBeenCalled()
      expect(result).toBe('en')
    })

    it('should throw UnauthorizedException when the user does not exist', async () => {
      mockRedisService.get.mockResolvedValue(null)
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(service.getLanguage('missing-user')).rejects.toThrow(UnauthorizedException)
      expect(mockRedisService.set).not.toHaveBeenCalled()
    })
  })
})
