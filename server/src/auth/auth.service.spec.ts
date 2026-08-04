jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
import { Test, TestingModule } from '@nestjs/testing'
import { ConflictException, UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { PrismaService } from '../prisma.service.js'
import { TokenService } from './token.service.js'
import { LanguageService } from './language.service.js'
import { createMockPrismaService } from '../__mocks__/prisma-service.mock'
import { I18nService } from 'nestjs-i18n'
import { createI18nServiceMock } from '../i18n/i18n-testing.js'
import * as bcrypt from 'bcrypt'

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))
jest.mock('geoip-lite', () => ({
  lookup: jest.fn(),
}))

describe('AuthService', () => {
  let service: AuthService
  let mockPrisma: ReturnType<typeof createMockPrismaService>
  let mockTokenService: Record<string, jest.Mock>
  let mockLanguageService: Record<string, jest.Mock>

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    passwordHash: 'hashed-password',
    displayName: 'Test User',
    onboardingComplete: false,
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    mockPrisma = createMockPrismaService()
    mockTokenService = {
      generateTokens: jest.fn().mockResolvedValue({
        accessToken: 'mock-access',
        refreshToken: 'mock-refresh',
      }),
      rotateRefreshToken: jest.fn().mockResolvedValue({
        accessToken: 'mock-access',
        refreshToken: 'mock-refresh',
      }),
      revokeAllTokens: jest.fn().mockResolvedValue({ success: true }),
    }
    mockLanguageService = {
      normalize: jest.fn().mockReturnValue('en'),
      updateLanguage: jest.fn().mockResolvedValue('en'),
      getLanguage: jest.fn().mockResolvedValue('en'),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TokenService, useValue: mockTokenService },
        { provide: LanguageService, useValue: mockLanguageService },
        { provide: I18nService, useValue: createI18nServiceMock() },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
  })

  describe('register', () => {
    it('should create a user and return tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password')
      mockPrisma.user.create.mockResolvedValue(mockUser)

      const dto = { email: 'test@test.com', password: 'password123', displayName: 'Test User' }
      const result = await service.register(dto)

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: dto.email },
      })
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 12)
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: dto.email,
          passwordHash: 'hashed-password',
          displayName: dto.displayName,
          language: 'en',
        },
      })
      expect(mockTokenService.generateTokens).toHaveBeenCalledWith(mockUser.id, mockUser.email)
      expect(result).toEqual({ accessToken: 'mock-access', refreshToken: 'mock-refresh' })
    })

    it('should persist the provided language', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password')
      mockPrisma.user.create.mockResolvedValue(mockUser)

      const dto = { email: 'test@test.com', password: 'password123' }
      await service.register(dto, 'pt-BR')

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: dto.email,
          passwordHash: 'hashed-password',
          displayName: null,
          language: 'pt-BR',
        },
      })
    })

    it('should throw ConflictException on duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const dto = { email: 'test@test.com', password: 'password123' }
      await expect(service.register(dto)).rejects.toThrow(ConflictException)
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it('should call bcrypt.hash with cost 12', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password')
      mockPrisma.user.create.mockResolvedValue(mockUser)

      await service.register({ email: 'a@b.com', password: 'password123' })

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12)
    })
  })

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      const dto = { email: 'test@test.com', password: 'password123' }
      const result = await service.login(dto)

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: dto.email },
      })
      expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, mockUser.passwordHash)
      expect(mockTokenService.generateTokens).toHaveBeenCalledWith(mockUser.id, mockUser.email)
      expect(result).toEqual({ accessToken: 'mock-access', refreshToken: 'mock-refresh' })
    })

    it('should throw UnauthorizedException on wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

      await expect(
        service.login({ email: 'test@test.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('should throw UnauthorizedException on missing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(
        service.login({ email: 'unknown@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('should throw UnauthorizedException for social login accounts without passwordHash', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      })

      await expect(
        service.login({ email: 'social@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('refreshTokens', () => {
    it('should delegate to tokenService.rotateRefreshToken', async () => {
      mockTokenService.rotateRefreshToken.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      })

      const result = await service.refreshTokens('encoded-refresh-token')

      expect(mockTokenService.rotateRefreshToken).toHaveBeenCalledWith('encoded-refresh-token')
      expect(result).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' })
    })
  })

  describe('logout', () => {
    it('should delegate to tokenService.revokeAllTokens and return success', async () => {
      const result = await service.logout('user-1')

      expect(mockTokenService.revokeAllTokens).toHaveBeenCalledWith('user-1')
      expect(result).toEqual({ success: true })
    })
  })

  describe('completeOnboarding', () => {
    it('should update user displayName and onboardingComplete', async () => {
      const updatedUser = {
        id: 'user-1',
        email: 'test@test.com',
        displayName: 'New Display Name',
        onboardingComplete: true,
      }
      mockPrisma.user.update.mockResolvedValue(updatedUser)

      const dto = { displayName: 'New Display Name' }
      const result = await service.completeOnboarding('user-1', dto)

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          displayName: dto.displayName,
          onboardingComplete: true,
        },
      })
      expect(result).toEqual(updatedUser)
    })
  })

  describe('getProfile', () => {
    it('should return user with language on valid userId', async () => {
      const profileData = {
        id: 'user-1',
        email: 'test@test.com',
        displayName: 'Test User',
        onboardingComplete: true,
      }
      mockPrisma.user.findUnique.mockResolvedValue(profileData)
      mockLanguageService.getLanguage.mockResolvedValue('pt-BR')

      const result = await service.getProfile('user-1')

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { id: true, email: true, displayName: true, onboardingComplete: true },
      })
      expect(mockLanguageService.getLanguage).toHaveBeenCalledWith('user-1')
      expect(result).toEqual({ ...profileData, language: 'pt-BR' })
    })

    it('should throw UnauthorizedException on missing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(service.getProfile('nonexistent-id')).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('getRequestIp', () => {
    it('should read x-forwarded-for header', () => {
      const req = {
        headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.2' },
        socket: { remoteAddress: '192.168.1.1' },
      } as any

      const result = service.getRequestIp(req)

      expect(result).toBe('203.0.113.1')
    })

    it('should fall back to socket.remoteAddress when x-forwarded-for is not present', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.1' },
      } as any

      const result = service.getRequestIp(req)

      expect(result).toBe('192.168.1.1')
    })

    it('should return "unknown" when neither header nor socket is available', () => {
      const req = {
        headers: {},
        socket: {},
      } as any

      const result = service.getRequestIp(req)

      expect(result).toBe('unknown')
    })
  })

  describe('getLocationFromIp', () => {
    const mockGeoip = { lookup: jest.fn() }

    beforeEach(() => {
      // Pre-set _geoip so loadGeoip() doesn't use dynamic import()
      ;(service as any)._geoip = mockGeoip
    })

    it('should return location data when geoip lookup succeeds', async () => {
      mockGeoip.lookup.mockReturnValue({ country: 'US', region: 'CA', city: 'San Francisco' })

      const result = await service.getLocationFromIp('8.8.8.8')

      expect(result).toEqual({ country: 'US', region: 'CA', city: 'San Francisco' })
    })

    it('should return all-null when geoip lookup returns null', async () => {
      mockGeoip.lookup.mockReturnValue(null)

      const result = await service.getLocationFromIp('127.0.0.1')

      expect(result).toEqual({ country: null, region: null, city: null })
    })

    it('should gracefully degrade when geoip-lite throws', async () => {
      mockGeoip.lookup.mockImplementation(() => { throw new Error('corrupt db') })

      const result = await service.getLocationFromIp('8.8.8.8')

      expect(result).toEqual({ country: null, region: null, city: null })
    })
  })
})
