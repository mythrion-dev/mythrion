jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
jest.mock('geoip-lite', () => ({ lookup: jest.fn() }))
import { Test, TestingModule } from '@nestjs/testing'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { LanguageService } from './language.service.js'
import { JwtAuthGuard } from './jwt-auth.guard.js'
import { RateLimitGuard } from './rate-limit.guard.js'
import { AuthGuard } from '@nestjs/passport'
import { RegisterDto } from './dto/register.dto.js'
import { LoginDto } from './dto/login.dto.js'
import { OnboardingDto } from './dto/onboarding.dto.js'
import type { AuthenticatedRequest } from './AuthenticatedRequest.js'
import type { Response } from 'express'

describe('AuthController', () => {
  let controller: AuthController
  let mockAuthService: Record<string, jest.Mock>
  let mockLanguageService: Record<string, jest.Mock>

  const mockUserReq = {
    user: { sub: 'user-1', email: 'test@test.com' },
    headers: { 'x-forwarded-for': '203.0.113.1' },
    socket: { remoteAddress: '192.168.1.1' },
  } as unknown as AuthenticatedRequest

  beforeEach(async () => {
    jest.clearAllMocks()

    mockAuthService = {
      register: jest.fn().mockResolvedValue({ accessToken: 'mock-access', refreshToken: 'mock-refresh' }),
      login: jest.fn().mockResolvedValue({ accessToken: 'mock-access', refreshToken: 'mock-refresh' }),
      refreshTokens: jest.fn().mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
      logout: jest.fn().mockResolvedValue({ success: true }),
      getProfile: jest.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com', displayName: 'Test User' }),
      completeOnboarding: jest.fn().mockResolvedValue({ id: 'user-1', onboardingComplete: true }),
      getRequestIp: jest.fn().mockReturnValue('203.0.113.1'),
      getLocationFromIp: jest.fn().mockResolvedValue({ country: 'US', region: 'CA', city: 'San Francisco' }),
      verifyTwoFactor: jest.fn().mockResolvedValue({ accessToken: 'mock-access', refreshToken: 'mock-refresh' }),
      resendTwoFactorCode: jest.fn().mockResolvedValue({ twoFactorId: 'challenge-2' }),
      sendTwoFactorCode: jest.fn().mockResolvedValue({ twoFactorId: 'challenge-1' }),
      confirmTwoFactor: jest.fn().mockResolvedValue({ recoveryCodes: ['AAAA'] }),
    }
    mockLanguageService = {
      normalize: jest.fn().mockReturnValue('en'),
      updateLanguage: jest.fn().mockResolvedValue('en'),
      getLanguage: jest.fn().mockResolvedValue('en'),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: LanguageService, useValue: mockLanguageService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile()

    controller = module.get<AuthController>(AuthController)
  })

  describe('register', () => {
    it('should delegate to authService.register with the dto and default language', async () => {
      const dto: RegisterDto = {
        email: 'test@test.com',
        password: 'password123',
        displayName: 'Test User',
      }
      const result = await controller.register(dto, mockUserReq)
      expect(mockLanguageService.normalize).toHaveBeenCalledWith(undefined)
      expect(mockAuthService.register).toHaveBeenCalledWith(dto, 'en')
      expect(result).toEqual({ accessToken: 'mock-access', refreshToken: 'mock-refresh' })
    })

    it('should adopt the Accept-Language header for the new user', async () => {
      const dto: RegisterDto = {
        email: 'test@test.com',
        password: 'password123',
      }
      const req = {
        headers: { 'accept-language': 'pt-BR,pt;q=0.9' },
      } as any
      mockLanguageService.normalize.mockReturnValue('pt-BR')

      await controller.register(dto, req)

      expect(mockLanguageService.normalize).toHaveBeenCalledWith('pt-BR,pt;q=0.9')
      expect(mockAuthService.register).toHaveBeenCalledWith(dto, 'pt-BR')
    })
  })

  describe('login', () => {
    it('should delegate to authService.login with the dto', async () => {
      const dto: LoginDto = { email: 'test@test.com', password: 'password123' }
      const result = await controller.login(dto)
      expect(mockAuthService.login).toHaveBeenCalledWith(dto)
      expect(result).toEqual({ accessToken: 'mock-access', refreshToken: 'mock-refresh' })
    })
  })

  describe('refresh', () => {
    it('should delegate to authService.refreshTokens with the refresh token', async () => {
      const body = { refreshToken: 'encoded-refresh-token' }
      const result = await controller.refresh(body)
      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('encoded-refresh-token')
      expect(result).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' })
    })
  })

  describe('logout', () => {
    it('should delegate to authService.logout with the user id', async () => {
      const result = await controller.logout(mockUserReq)
      expect(mockAuthService.logout).toHaveBeenCalledWith('user-1')
      expect(result).toEqual({ success: true })
    })
  })

  describe('getProfile', () => {
    it('should delegate to authService.getProfile with the user id', async () => {
      const result = await controller.getProfile(mockUserReq)
      expect(mockAuthService.getProfile).toHaveBeenCalledWith('user-1')
      expect(result).toEqual({ id: 'user-1', email: 'test@test.com', displayName: 'Test User' })
    })
  })

  describe('updateLanguage', () => {
    it('should delegate to languageService.updateLanguage with userId and language', async () => {
      mockLanguageService.updateLanguage.mockResolvedValue('pt-BR')

      const result = await controller.updateLanguage(mockUserReq, {
        language: 'pt-BR',
      })

      expect(mockLanguageService.updateLanguage).toHaveBeenCalledWith('user-1', 'pt-BR')
      expect(result).toBe('pt-BR')
    })
  })

  describe('completeOnboarding', () => {
    it('should delegate to authService.completeOnboarding with userId and dto', async () => {
      const dto: OnboardingDto = { displayName: 'New Name' }
      const result = await controller.completeOnboarding(mockUserReq, dto)
      expect(mockAuthService.completeOnboarding).toHaveBeenCalledWith('user-1', dto)
      expect(result).toEqual({ id: 'user-1', onboardingComplete: true })
    })
  })

  describe('verifyTwoFactor', () => {
    it('should delegate to authService.verifyTwoFactor with the dto', async () => {
      const dto = { twoFactorId: 'challenge-1', code: '123456' }
      const result = await controller.verifyTwoFactor(dto)
      expect(mockAuthService.verifyTwoFactor).toHaveBeenCalledWith(dto)
      expect(result).toEqual({ accessToken: 'mock-access', refreshToken: 'mock-refresh' })
    })
  })

  describe('resendTwoFactorCode', () => {
    it('should delegate to authService.resendTwoFactorCode with the dto', async () => {
      const dto = { twoFactorId: 'challenge-1' }
      const result = await controller.resendTwoFactorCode(dto)
      expect(mockAuthService.resendTwoFactorCode).toHaveBeenCalledWith(dto)
      expect(result).toEqual({ twoFactorId: 'challenge-2' })
    })
  })

  describe('sendTwoFactorCode', () => {
    it('should delegate to authService.sendTwoFactorCode with userId and purpose', async () => {
      const dto = { purpose: 'ENABLE' }
      const result = await controller.sendTwoFactorCode(mockUserReq, dto)
      expect(mockAuthService.sendTwoFactorCode).toHaveBeenCalledWith('user-1', 'ENABLE')
      expect(result).toEqual({ twoFactorId: 'challenge-1' })
    })
  })

  describe('confirmTwoFactor', () => {
    it('should delegate to authService.confirmTwoFactor with userId, purpose and dto', async () => {
      const dto = { purpose: 'ENABLE', twoFactorId: 'challenge-1', code: '123456' }
      const result = await controller.confirmTwoFactor(mockUserReq, dto)
      expect(mockAuthService.confirmTwoFactor).toHaveBeenCalledWith('user-1', 'ENABLE', dto)
      expect(result).toEqual({ recoveryCodes: ['AAAA'] })
    })
  })

  describe('currentUser', () => {
    it('should return profile with ip and location', async () => {
      const result = await controller.currentUser(mockUserReq)
      expect(mockAuthService.getProfile).toHaveBeenCalledWith('user-1')
      expect(mockAuthService.getRequestIp).toHaveBeenCalledWith(mockUserReq)
      expect(mockAuthService.getLocationFromIp).toHaveBeenCalledWith('203.0.113.1')
      expect(result).toEqual({
        id: 'user-1',
        email: 'test@test.com',
        displayName: 'Test User',
        ip: '203.0.113.1',
        location: { country: 'US', region: 'CA', city: 'San Francisco' },
      })
    })
  })

  describe('googleAuth', () => {
    it('should return undefined (guard handles redirect)', () => {
      const result = controller.googleAuth()
      expect(result).toBeUndefined()
    })
  })

  describe('googleCallback', () => {
    it('should redirect with tokens and no state', async () => {
      const mockReq = { user: { accessToken: 'google-access', refreshToken: 'google-refresh' } }
      const mockRes = { redirect: jest.fn() } as unknown as Response

      await controller.googleCallback(mockReq as any, mockRes)

      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('token=google-access'),
      )
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('refreshToken=google-refresh'),
      )
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.not.stringContaining('state='),
      )
    })

    it('should redirect to the state origin when a valid origin is provided', async () => {
      const mockReq = { user: { accessToken: 'google-access', refreshToken: 'google-refresh' } }
      const mockRes = { redirect: jest.fn() } as unknown as Response

      // localhost:3001 is always allow-listed, so `state` resolves as the
      // origin to redirect back to (multi-domain OAuth).
      await controller.googleCallback(mockReq as any, mockRes, 'http://localhost:3001')

      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:3001/auth/google/callback?token=google-access&refreshToken=google-refresh',
      )
    })

    it('should fall back to FRONTEND_URL when state is not a valid origin', async () => {
      const mockReq = { user: { accessToken: 'google-access', refreshToken: 'google-refresh' } }
      const mockRes = { redirect: jest.fn() } as unknown as Response

      // `state` carries an origin, not an echoed nonce — non-origin values are
      // rejected so an attacker cannot set the redirect target.
      await controller.googleCallback(mockReq as any, mockRes, 'some-state')

      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/auth/google/callback?token=google-access'),
      )
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.not.stringContaining('state='),
      )
    })
  })
})
