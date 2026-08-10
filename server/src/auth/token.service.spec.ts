jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test, TestingModule } from '@nestjs/testing'
import { UnauthorizedException, InternalServerErrorException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { I18nService } from 'nestjs-i18n'
import { TokenService } from './token.service.js'
import { PrismaService } from '../prisma.service.js'
import { RedisService } from '../redis/redis.service.js'
import { AdminService } from './admin.service.js'
import { createMockPrismaService } from '../__mocks__/prisma-service.mock'
import { createI18nServiceMock } from '../i18n/i18n-testing.js'
import * as bcrypt from 'bcrypt'

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
}))

function buildEncodedToken(userId: string, rawToken: string): string {
  return Buffer.from(JSON.stringify({ userId, token: rawToken })).toString('base64')
}

describe('TokenService', () => {
  let service: TokenService
  let mockPrisma: ReturnType<typeof createMockPrismaService>
  let mockJwtService: Record<string, jest.Mock>
  let mockRedis: Record<string, any>
  let mockAdminService: { isAdmin: jest.Mock; isEarlyAccess: jest.Mock }

  beforeEach(async () => {
    jest.clearAllMocks()

    mockPrisma = createMockPrismaService()
    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-access-token'),
      verify: jest.fn(),
    }
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
      ready: false,
      client: null,
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(undefined),
      ttl: jest.fn().mockResolvedValue(300),
    }
    mockAdminService = {
      isAdmin: jest.fn().mockReturnValue(false),
      isEarlyAccess: jest.fn().mockReturnValue(false),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RedisService, useValue: mockRedis },
        { provide: AdminService, useValue: mockAdminService },
        { provide: I18nService, useValue: createI18nServiceMock() },
      ],
    }).compile()

    service = module.get<TokenService>(TokenService)
  })

  describe('generateTokens', () => {
    it('should call jwtService.sign with correct payload', async () => {
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token')
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' })

      const result = await service.generateTokens('user-1', 'test@test.com')

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-1', email: 'test@test.com', role: 'user' },
        { expiresIn: '15m' },
      )
      expect(result.accessToken).toBe('mock-access-token')
      expect(result.refreshToken).toBeTruthy()
    })

    it('should resolve role to early_access for early-access emails', async () => {
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token')
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' })
      mockAdminService.isEarlyAccess.mockReturnValue(true)

      const result = await service.generateTokens('user-1', 'early@test.com')

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-1', email: 'early@test.com', role: 'early_access' },
        { expiresIn: '15m' },
      )
      expect(result.accessToken).toBe('mock-access-token')
    })

    it('should give admin precedence when email is in both lists', async () => {
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token')
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' })
      mockAdminService.isAdmin.mockReturnValue(true)
      mockAdminService.isEarlyAccess.mockReturnValue(true)

      await service.generateTokens('user-1', 'both@test.com')

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-1', email: 'both@test.com', role: 'admin' },
        { expiresIn: '15m' },
      )
    })

    it('should create a refresh token in the database', async () => {
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token')
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' })

      await service.generateTokens('user-1', 'test@test.com')

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          token: 'hashed-refresh-token',
          expiresAt: expect.any(Date),
        },
      })
    })

    it('should clear any Redis logout blacklist for the user', async () => {
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token')
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' })
      // A prior logout left a blacklist marker; re-authentication must clear it
      // so the first refresh after access-token expiry is not rejected.
      mockRedis.del.mockResolvedValue(undefined)

      await service.generateTokens('user-1', 'test@test.com')

      expect(mockRedis.del).toHaveBeenCalledWith('token_blacklist:user-1')
    })

    it('should NOT revoke sibling refresh tokens on issue', async () => {
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token')
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' })
      mockPrisma.refreshToken.findMany.mockResolvedValue([])

      await service.generateTokens('user-1', 'test@test.com')

      // Logging in / refreshing must not log the user out of other devices.
      expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false },
        data: { revoked: true },
      })
    })

    it('should cap the number of live refresh tokens per user (drop oldest)', async () => {
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token')
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-new' })
      // 5 live tokens already exist (the cap) — the newest 5 are kept.
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        { id: 'rt-new' },
        { id: 'rt-5' },
        { id: 'rt-4' },
        { id: 'rt-3' },
        { id: 'rt-2' },
      ])

      await service.generateTokens('user-1', 'test@test.com')

      expect(mockPrisma.refreshToken.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
        take: 5,
      })
      // Any live token outside the newest 5 is deleted, not revoked.
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          revoked: false,
          id: { notIn: ['rt-new', 'rt-5', 'rt-4', 'rt-3', 'rt-2'] },
        },
      })
    })

    it('should use bcrypt hash with cost 10 for refresh token', async () => {
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token')
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' })

      await service.generateTokens('user-1', 'test@test.com')

      expect(bcrypt.hash).toHaveBeenCalledWith('mock-uuid', 10)
    })
  })

  describe('rotateRefreshToken', () => {
    beforeEach(() => {
      // Spy on generateTokens to verify it's called at the end
      jest.spyOn(service, 'generateTokens')
    })

    it('should decode base64 token, compare bcrypt hashes, and generate new tokens', async () => {
      const rawToken = 'valid-raw-token'
      const encodedToken = buildEncodedToken('user-1', rawToken)

      mockRedis.get.mockResolvedValue(null)
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        { id: 'rt-1', token: 'stored-hash', userId: 'user-1', revoked: false, expiresAt: new Date(Date.now() + 86400000) },
      ])
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
      mockPrisma.refreshToken.update.mockResolvedValue({ id: 'rt-1', revoked: true })
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@test.com' })

      const result = await service.rotateRefreshToken(encodedToken)

      expect(mockRedis.get).toHaveBeenCalledWith('token_blacklist:user-1')
      expect(mockPrisma.refreshToken.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false, expiresAt: { gt: expect.any(Date) } },
      })
      expect(bcrypt.compare).toHaveBeenCalledWith(rawToken, 'stored-hash')
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revoked: true },
      })
      expect(service.generateTokens).toHaveBeenCalledWith('user-1', 'test@test.com')
      expect(result.accessToken).toBe('mock-access-token')
      expect(result.refreshToken).toBeTruthy()
    })

    it('should throw UnauthorizedException when token is blacklisted in Redis', async () => {
      mockRedis.get.mockResolvedValue('1700000000')

      await expect(
        service.rotateRefreshToken(buildEncodedToken('user-1', 'some-token')),
      ).rejects.toThrow(UnauthorizedException)

      expect(mockPrisma.refreshToken.findMany).not.toHaveBeenCalled()
    })

    it('should reject a non-matching token WITHOUT revoking other sessions', async () => {
      const encodedToken = buildEncodedToken('user-1', 'bad-token')

      mockRedis.get.mockResolvedValue(null)
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        { id: 'rt-1', token: 'hash-1', userId: 'user-1', revoked: false, expiresAt: new Date(Date.now() + 86400000) },
        { id: 'rt-2', token: 'hash-2', userId: 'user-1', revoked: false, expiresAt: new Date(Date.now() + 86400000) },
      ])
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

      await expect(
        service.rotateRefreshToken(encodedToken),
      ).rejects.toThrow(UnauthorizedException)

      // A stale/expired token must not cascade-log-out the user's other devices.
      expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false },
        data: { revoked: true },
      })
    })

    it('should throw InternalServerErrorException when bcrypt.compare throws', async () => {
      const encodedToken = buildEncodedToken('user-1', 'some-token')

      mockRedis.get.mockResolvedValue(null)
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        { id: 'rt-1', token: 'hash-1', userId: 'user-1', revoked: false, expiresAt: new Date(Date.now() + 86400000) },
      ])
      ;(bcrypt.compare as jest.Mock).mockRejectedValue(new Error('bcrypt error'))

      await expect(
        service.rotateRefreshToken(encodedToken),
      ).rejects.toThrow(InternalServerErrorException)
    })

    it('should throw UnauthorizedException when user is not found after token match', async () => {
      const rawToken = 'valid-raw-token'
      const encodedToken = buildEncodedToken('user-1', rawToken)

      mockRedis.get.mockResolvedValue(null)
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        { id: 'rt-1', token: 'stored-hash', userId: 'user-1', revoked: false, expiresAt: new Date(Date.now() + 86400000) },
      ])
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
      mockPrisma.refreshToken.update.mockResolvedValue({ id: 'rt-1', revoked: true })
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(
        service.rotateRefreshToken(encodedToken),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('should throw an Error when the token envelope is not valid JSON', async () => {
      // Base64 that decodes to a non-JSON string ("not-json")
      const badToken = Buffer.from('not-json').toString('base64')

      await expect(service.rotateRefreshToken(badToken)).rejects.toThrow(
        'Invalid refresh token format',
      )

      expect(mockRedis.get).not.toHaveBeenCalled()
    })
  })

  describe('revokeAllTokens', () => {
    it('should revoke all tokens via updateMany', async () => {
      await service.revokeAllTokens('user-1')

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false },
        data: { revoked: true },
      })
    })

    it('should set a Redis blacklist entry', async () => {
      await service.revokeAllTokens('user-1')

      expect(mockRedis.set).toHaveBeenCalledWith(
        'token_blacklist:user-1',
        expect.any(String),
        30 * 24 * 60 * 60,
      )
    })
  })

  describe('revokeAllTokensExcept', () => {
    it('should revoke all tokens when no refresh token is provided', async () => {
      await service.revokeAllTokensExcept('user-1')

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false },
        data: { revoked: true },
      })
      // Falls back to revokeAllTokens, which also sets the Redis blacklist marker.
      expect(mockRedis.set).toHaveBeenCalledWith(
        'token_blacklist:user-1',
        expect.any(String),
        30 * 24 * 60 * 60,
      )
    })

    it('should revoke all tokens except the one presented', async () => {
      const encodedToken = buildEncodedToken('user-1', 'raw-token')
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        { id: 'rt-keep', token: 'hash-keep', userId: 'user-1', revoked: false },
      ])
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      await service.revokeAllTokensExcept('user-1', encodedToken)

      expect(mockPrisma.refreshToken.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false },
        select: { id: true, token: true },
      })
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false, id: { not: 'rt-keep' } },
        data: { revoked: true },
      })
    })

    it('should revoke all tokens when the presented token matches no stored hash', async () => {
      const encodedToken = buildEncodedToken('user-1', 'raw-token')
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        { id: 'rt-1', token: 'hash-1', userId: 'user-1', revoked: false },
      ])
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

      await service.revokeAllTokensExcept('user-1', encodedToken)

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false, id: undefined },
        data: { revoked: true },
      })
    })

    it('should ignore a token envelope that belongs to a different user', async () => {
      const encodedToken = buildEncodedToken('other-user', 'raw-token')

      await service.revokeAllTokensExcept('user-1', encodedToken)

      // findMatchingRefreshTokenId is never consulted for another user's token.
      expect(mockPrisma.refreshToken.findMany).not.toHaveBeenCalled()
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false, id: undefined },
        data: { revoked: true },
      })
    })

    it('should revoke everything when the token envelope is corrupt', async () => {
      // Base64 that decodes to "{{{" — not valid JSON.
      const badToken = Buffer.from('{{{').toString('base64')

      await service.revokeAllTokensExcept('user-1', badToken)

      expect(mockPrisma.refreshToken.findMany).not.toHaveBeenCalled()
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false, id: undefined },
        data: { revoked: true },
      })
    })

    it('should keep scanning when a stored hash fails to compare', async () => {
      const encodedToken = buildEncodedToken('user-1', 'raw-token')
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        { id: 'rt-corrupt', token: 'hash-bad', userId: 'user-1', revoked: false },
        { id: 'rt-keep', token: 'hash-good', userId: 'user-1', revoked: false },
      ])
      // First stored hash is corrupt (bcrypt.compare rejects); the scan continues
      // and matches the second token.
      ;(bcrypt.compare as jest.Mock)
        .mockRejectedValueOnce(new Error('corrupt hash'))
        .mockResolvedValueOnce(true)

      await service.revokeAllTokensExcept('user-1', encodedToken)

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false, id: { not: 'rt-keep' } },
        data: { revoked: true },
      })
    })
  })
})
