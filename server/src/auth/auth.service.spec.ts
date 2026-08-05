jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
import { Test, TestingModule } from '@nestjs/testing'
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { PrismaService } from '../prisma.service.js'
import { TokenService } from './token.service.js'
import { LanguageService } from './language.service.js'
import { TwoFactorService } from './two-factor.service.js'
import { EmailService } from '../email/email.service.js'
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
  let mockTwoFactor: Record<string, jest.Mock>
  let mockEmailService: Record<string, jest.Mock>

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    passwordHash: 'hashed-password',
    displayName: 'Test User',
    onboardingComplete: false,
    twoFactorEnabled: false,
    emailVerified: false,
    language: 'en',
    verificationTokenHash: null,
    verificationTokenExpiresAt: null,
    passwordResetTokenHash: null,
    passwordResetTokenExpiresAt: null,
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
      revokeAllTokensExcept: jest.fn().mockResolvedValue({ success: true }),
    }
    mockLanguageService = {
      normalize: jest.fn().mockReturnValue('en'),
      updateLanguage: jest.fn().mockResolvedValue('en'),
      getLanguage: jest.fn().mockResolvedValue('en'),
    }
    mockTwoFactor = {
      issueChallenge: jest.fn().mockResolvedValue({ twoFactorId: 'challenge-1' }),
      maskEmail: jest.fn().mockReturnValue('tes***@test.com'),
      verifyChallenge: jest.fn().mockResolvedValue({ userId: 'user-1', email: 'test@test.com' }),
      resendLoginCode: jest.fn().mockResolvedValue({ twoFactorId: 'challenge-2' }),
      enable: jest.fn().mockResolvedValue({ recoveryCodes: ['AAAA', 'BBBB'] }),
      disable: jest.fn().mockResolvedValue({ success: true }),
    }
    mockEmailService = {
      sendEmailVerification: jest.fn().mockResolvedValue(undefined),
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TokenService, useValue: mockTokenService },
        { provide: LanguageService, useValue: mockLanguageService },
        { provide: TwoFactorService, useValue: mockTwoFactor },
        { provide: I18nService, useValue: createI18nServiceMock() },
        { provide: EmailService, useValue: mockEmailService },
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
          emailVerified: false,
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
          emailVerified: false,
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

    it('should issue a LOGIN challenge and return requiresTwoFactor for 2FA users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        twoFactorEnabled: true,
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
      mockTwoFactor.issueChallenge.mockResolvedValue({ twoFactorId: 'challenge-1' })
      mockTwoFactor.maskEmail.mockReturnValue('tes***@test.com')

      const result = await service.login({
        email: 'test@test.com',
        password: 'password123',
      })

      expect(mockTwoFactor.issueChallenge).toHaveBeenCalledWith('user-1', 'LOGIN')
      expect(mockTwoFactor.maskEmail).toHaveBeenCalledWith('test@test.com')
      expect(mockTokenService.generateTokens).not.toHaveBeenCalled()
      expect(result).toEqual({
        requiresTwoFactor: true,
        twoFactorId: 'challenge-1',
        emailMasked: 'tes***@test.com',
      })
    })
  })

  describe('two factor', () => {
    it('should verify a challenge and return tokens', async () => {
      mockTwoFactor.verifyChallenge.mockResolvedValue({
        userId: 'user-1',
        email: 'test@test.com',
      })

      const result = await service.verifyTwoFactor({
        twoFactorId: 'challenge-1',
        code: '123456',
      })

      expect(mockTwoFactor.verifyChallenge).toHaveBeenCalledWith(
        'challenge-1',
        '123456',
        'LOGIN',
      )
      expect(mockTokenService.generateTokens).toHaveBeenCalledWith(
        'user-1',
        'test@test.com',
      )
      expect(result).toEqual({
        accessToken: 'mock-access',
        refreshToken: 'mock-refresh',
      })
    })

    it('should resend a login code', async () => {
      const result = await service.resendTwoFactorCode({
        twoFactorId: 'challenge-1',
      })

      expect(mockTwoFactor.resendLoginCode).toHaveBeenCalledWith('challenge-1')
      expect(result).toEqual({ twoFactorId: 'challenge-2' })
    })

    it('should send a two-factor code for ENABLE', async () => {
      await service.sendTwoFactorCode('user-1', 'ENABLE')

      expect(mockTwoFactor.issueChallenge).toHaveBeenCalledWith('user-1', 'ENABLE')
    })

    it('should send a two-factor code for DISABLE', async () => {
      await service.sendTwoFactorCode('user-1', 'DISABLE')

      expect(mockTwoFactor.issueChallenge).toHaveBeenCalledWith('user-1', 'DISABLE')
    })

    it('should confirm ENABLE and return recovery codes', async () => {
      mockTwoFactor.enable.mockResolvedValue({ recoveryCodes: ['AAAA', 'BBBB'] })

      const result = await service.confirmTwoFactor('user-1', 'ENABLE', {
        purpose: 'ENABLE',
        twoFactorId: 'challenge-1',
        code: '123456',
      })

      expect(mockTwoFactor.enable).toHaveBeenCalledWith(
        'user-1',
        'challenge-1',
        '123456',
      )
      expect(result).toEqual({ recoveryCodes: ['AAAA', 'BBBB'] })
    })

    it('should confirm DISABLE', async () => {
      const result = await service.confirmTwoFactor('user-1', 'DISABLE', {
        purpose: 'DISABLE',
        twoFactorId: 'challenge-1',
        code: '123456',
      })

      expect(mockTwoFactor.disable).toHaveBeenCalledWith(
        'user-1',
        'challenge-1',
        '123456',
      )
      expect(result).toEqual({ success: true })
    })
  })

  describe('verifyEmail', () => {
    it('should mark the email verified and clear the token on a valid token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        verificationTokenHash: 'token-hash',
        verificationTokenExpiresAt: new Date(Date.now() + 60_000),
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      const token = Buffer.from(
        JSON.stringify({ userId: 'user-1', token: 'secret' }),
      ).toString('base64')
      const result = await service.verifyEmail({ token })

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          emailVerified: true,
          emailVerifiedAt: expect.any(Date),
          verificationTokenHash: null,
          verificationTokenExpiresAt: null,
        },
      })
      expect(result).toEqual({ success: true })
    })

    it('should be idempotent when the email is already verified', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        emailVerified: true,
        verificationTokenHash: 'token-hash',
        verificationTokenExpiresAt: new Date(Date.now() + 60_000),
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      const token = Buffer.from(
        JSON.stringify({ userId: 'user-1', token: 'secret' }),
      ).toString('base64')
      const result = await service.verifyEmail({ token })

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { verificationTokenHash: null, verificationTokenExpiresAt: null },
      })
      expect(result).toEqual({ success: true })
    })

    it('should throw for a malformed token', async () => {
      await expect(
        service.verifyEmail({ token: 'not-a-valid-envelope' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw for an expired token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        verificationTokenHash: 'token-hash',
        verificationTokenExpiresAt: new Date(Date.now() - 60_000),
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      const token = Buffer.from(
        JSON.stringify({ userId: 'user-1', token: 'secret' }),
      ).toString('base64')
      await expect(service.verifyEmail({ token })).rejects.toThrow(BadRequestException)
    })

    it('should throw when the token secret does not match the stored hash', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        verificationTokenHash: 'token-hash',
        verificationTokenExpiresAt: new Date(Date.now() + 60_000),
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

      const token = Buffer.from(
        JSON.stringify({ userId: 'user-1', token: 'wrong-secret' }),
      ).toString('base64')
      await expect(service.verifyEmail({ token })).rejects.toThrow(BadRequestException)
    })
  })

  describe('resendVerification', () => {
    it('should issue a new token for an unverified account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const result = await service.resendVerification({ email: 'test@test.com' })

      expect(mockPrisma.user.update).toHaveBeenCalled()
      expect(mockEmailService.sendEmailVerification).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'test@test.com' }),
      )
      expect(result).toEqual({ success: true })
    })

    it('should not issue a token for an unknown email and still return success', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await service.resendVerification({ email: 'unknown@test.com' })

      expect(mockPrisma.user.update).not.toHaveBeenCalled()
      expect(mockEmailService.sendEmailVerification).not.toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })

    it('should not issue a token for an already-verified account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        emailVerified: true,
      })

      const result = await service.resendVerification({ email: 'test@test.com' })

      expect(mockPrisma.user.update).not.toHaveBeenCalled()
      expect(mockEmailService.sendEmailVerification).not.toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })
  })

  describe('forgotPassword', () => {
    it('should issue a reset token for an account with a password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const result = await service.forgotPassword({ email: 'test@test.com' })

      expect(mockPrisma.user.update).toHaveBeenCalled()
      expect(mockEmailService.sendPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'test@test.com' }),
      )
      expect(result).toEqual({ success: true })
    })

    it('should not issue a token for an unknown email and still return success', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await service.forgotPassword({ email: 'unknown@test.com' })

      expect(mockPrisma.user.update).not.toHaveBeenCalled()
      expect(mockEmailService.sendPasswordReset).not.toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })

    it('should not issue a token for a social-only account (no password)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      })

      const result = await service.forgotPassword({ email: 'social@test.com' })

      expect(mockPrisma.user.update).not.toHaveBeenCalled()
      expect(mockEmailService.sendPasswordReset).not.toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })
  })

  describe('resetPassword', () => {
    it('should reset the password and revoke all sessions on a valid token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordResetTokenHash: 'reset-hash',
        passwordResetTokenExpiresAt: new Date(Date.now() + 60_000),
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password')

      const token = Buffer.from(
        JSON.stringify({ userId: 'user-1', token: 'secret' }),
      ).toString('base64')
      const result = await service.resetPassword({
        token,
        password: 'NewPassword1!',
      })

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword1!', 12)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          passwordHash: 'new-hashed-password',
          passwordResetTokenHash: null,
          passwordResetTokenExpiresAt: null,
        },
      })
      expect(mockTokenService.revokeAllTokens).toHaveBeenCalledWith('user-1')
      expect(result).toEqual({ success: true })
    })

    it('should throw for an expired reset token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordResetTokenHash: 'reset-hash',
        passwordResetTokenExpiresAt: new Date(Date.now() - 60_000),
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      const token = Buffer.from(
        JSON.stringify({ userId: 'user-1', token: 'secret' }),
      ).toString('base64')
      await expect(
        service.resetPassword({ token, password: 'NewPassword1!' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw for a token secret that does not match', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordResetTokenHash: 'reset-hash',
        passwordResetTokenExpiresAt: new Date(Date.now() + 60_000),
      })
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

      const token = Buffer.from(
        JSON.stringify({ userId: 'user-1', token: 'wrong-secret' }),
      ).toString('base64')
      await expect(
        service.resetPassword({ token, password: 'NewPassword1!' }),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('changePassword', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password')
    })

    it('should update the password when the current password matches', async () => {
      ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)

      const result = await service.changePassword('user-1', {
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword1!',
      })

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'OldPassword1!',
        mockUser.passwordHash,
      )
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'new-hashed-password' },
      })
      expect(mockTokenService.revokeAllTokensExcept).not.toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })

    it('should throw when the current password is wrong', async () => {
      await expect(
        service.changePassword('user-1', {
          currentPassword: 'WrongPassword1!',
          newPassword: 'NewPassword1!',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw when the new password equals the current password', async () => {
      ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)
      ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'OldPassword1!',
          newPassword: 'OldPassword1!',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw for a social-only account with no password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      })

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'OldPassword1!',
          newPassword: 'NewPassword1!',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('should revoke other devices when logoutOtherDevices is set', async () => {
      ;(bcrypt.compare as jest.Mock).mockResolvedValueOnce(true)

      await service.changePassword('user-1', {
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword1!',
        logoutOtherDevices: true,
        currentRefreshToken: 'encoded-current-refresh',
      })

      expect(mockTokenService.revokeAllTokensExcept).toHaveBeenCalledWith(
        'user-1',
        'encoded-current-refresh',
      )
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
    it('should return user with language and hasPassword on valid userId', async () => {
      const profileData = {
        id: 'user-1',
        email: 'test@test.com',
        displayName: 'Test User',
        onboardingComplete: true,
        twoFactorEnabled: false,
        emailVerified: false,
        passwordHash: 'hashed-password',
      }
      mockPrisma.user.findUnique.mockResolvedValue(profileData)
      mockLanguageService.getLanguage.mockResolvedValue('pt-BR')

      const result = await service.getProfile('user-1')

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: {
          id: true,
          email: true,
          displayName: true,
          onboardingComplete: true,
          twoFactorEnabled: true,
          emailVerified: true,
          passwordHash: true,
        },
      })
      expect(mockLanguageService.getLanguage).toHaveBeenCalledWith('user-1')
      expect(result).toEqual({
        id: 'user-1',
        email: 'test@test.com',
        displayName: 'Test User',
        onboardingComplete: true,
        twoFactorEnabled: false,
        emailVerified: false,
        hasPassword: true,
        language: 'pt-BR',
      })
    })

    it('should report hasPassword false when the account has no password', async () => {
      const profileData = {
        id: 'user-1',
        email: 'social@test.com',
        displayName: null,
        onboardingComplete: true,
        twoFactorEnabled: false,
        emailVerified: true,
        passwordHash: null,
      }
      mockPrisma.user.findUnique.mockResolvedValue(profileData)
      mockLanguageService.getLanguage.mockResolvedValue('pt-BR')

      const result = await service.getProfile('user-1')

      expect(result.hasPassword).toBe(false)
      expect(result).not.toHaveProperty('passwordHash')
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
