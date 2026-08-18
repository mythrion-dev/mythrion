jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
import { Test, TestingModule } from '@nestjs/testing'
import {
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { I18nService } from 'nestjs-i18n'
import { JwtAuthGuard } from './jwt-auth.guard.js'
import { AuthService } from './auth.service.js'
import { createI18nServiceMock } from '../i18n/i18n-testing.js'

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard
  let mockJwtService: Record<string, jest.Mock>
  let mockReflector: Record<string, jest.Mock>
  let mockAuthService: Record<string, jest.Mock>

  const makeContext = (request: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as ExecutionContext

  beforeEach(async () => {
    mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    }
    mockReflector = {
      getAllAndOverride: jest.fn(),
    }
    mockAuthService = {
      assertEmailVerified: jest.fn().mockResolvedValue({
        found: true,
        emailVerified: true,
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: JwtService, useValue: mockJwtService },
        { provide: I18nService, useValue: createI18nServiceMock() },
        { provide: Reflector, useValue: mockReflector },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile()

    guard = module.get<JwtAuthGuard>(JwtAuthGuard)
  })

  describe('canActivate', () => {
    it('should extract Bearer token, verify it, set req.user, and return true', async () => {
      const payload = { sub: 'user-1', email: 'test@test.com' }
      mockJwtService.verify.mockReturnValue(payload)

      const request: any = {
        headers: { authorization: 'Bearer valid-token' },
        user: undefined,
      }

      await expect(guard.canActivate(makeContext(request))).resolves.toBe(true)

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token')
      expect(request.user).toEqual(payload)
      expect(mockAuthService.assertEmailVerified).toHaveBeenCalledWith('user-1')
    })

    it('should throw UnauthorizedException on missing token', async () => {
      const request: any = {
        headers: {},
        user: undefined,
      }

      await expect(guard.canActivate(makeContext(request))).rejects.toThrow(
        UnauthorizedException,
      )
      expect(mockJwtService.verify).not.toHaveBeenCalled()
    })

    it('should throw UnauthorizedException on invalid Authorization header format', async () => {
      const request: any = {
        headers: { authorization: 'Invalid-format' },
        user: undefined,
      }

      await expect(guard.canActivate(makeContext(request))).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it('should extract token from req.cookies.auth_token (parsed by cookieParser)', async () => {
      const payload = { sub: 'user-1', email: 'test@test.com' }
      mockJwtService.verify.mockReturnValue(payload)

      const request: any = {
        headers: {},
        cookies: { auth_token: 'cookie-jwt-token' },
        user: undefined,
      }

      await expect(guard.canActivate(makeContext(request))).resolves.toBe(true)

      expect(mockJwtService.verify).toHaveBeenCalledWith('cookie-jwt-token')
      expect(request.user).toEqual(payload)
    })

    it('should extract token from raw req.headers.cookie when cookieParser did not parse', async () => {
      const payload = { sub: 'user-1', email: 'test@test.com' }
      mockJwtService.verify.mockReturnValue(payload)

      const request: any = {
        headers: { cookie: 'auth_token=raw-cookie-token; other=val' },
        cookies: {},
        user: undefined,
      }

      await expect(guard.canActivate(makeContext(request))).resolves.toBe(true)

      expect(mockJwtService.verify).toHaveBeenCalledWith('raw-cookie-token')
      expect(request.user).toEqual(payload)
    })

    it('should prefer Authorization header over auth_token cookie', async () => {
      const payload = { sub: 'user-1', email: 'test@test.com' }
      mockJwtService.verify.mockReturnValue(payload)

      const request: any = {
        headers: {
          authorization: 'Bearer header-token',
          cookie: 'auth_token=cookie-token',
        },
        cookies: { auth_token: 'cookie-token' },
        user: undefined,
      }

      await expect(guard.canActivate(makeContext(request))).resolves.toBe(true)

      expect(mockJwtService.verify).toHaveBeenCalledWith('header-token')
    })

    it('should extract token from req.query.token (cross-origin iframe fallback)', async () => {
      const payload = { sub: 'user-1', email: 'test@test.com' }
      mockJwtService.verify.mockReturnValue(payload)

      const request: any = {
        headers: {},
        cookies: {},
        query: { token: 'query-param-token' },
        user: undefined,
      }

      await expect(guard.canActivate(makeContext(request))).resolves.toBe(true)

      expect(mockJwtService.verify).toHaveBeenCalledWith('query-param-token')
      expect(request.user).toEqual(payload)
    })

    it('should prefer cookie over query param', async () => {
      const payload = { sub: 'user-1', email: 'test@test.com' }
      mockJwtService.verify.mockReturnValue(payload)

      const request: any = {
        headers: {},
        cookies: { auth_token: 'cookie-token' },
        query: { token: 'query-token' },
        user: undefined,
      }

      await expect(guard.canActivate(makeContext(request))).resolves.toBe(true)

      expect(mockJwtService.verify).toHaveBeenCalledWith('cookie-token')
    })

    it('should throw UnauthorizedException on invalid or expired token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired')
      })

      const request: any = {
        headers: { authorization: 'Bearer expired-token' },
        user: undefined,
      }

      await expect(guard.canActivate(makeContext(request))).rejects.toThrow(
        UnauthorizedException,
      )
      expect(mockJwtService.verify).toHaveBeenCalledWith('expired-token')
      expect(request.user).toBeUndefined()
    })

    it('should throw ForbiddenException for an unverified email', async () => {
      const payload = { sub: 'user-1', email: 'test@test.com' }
      mockJwtService.verify.mockReturnValue(payload)
      mockAuthService.assertEmailVerified.mockResolvedValue({
        found: true,
        emailVerified: false,
      })

      const request: any = {
        headers: { authorization: 'Bearer valid-token' },
        user: undefined,
      }

      await expect(guard.canActivate(makeContext(request))).rejects.toThrow(
        ForbiddenException,
      )
      expect(request.user).toEqual(payload)
      expect(mockAuthService.assertEmailVerified).toHaveBeenCalledWith('user-1')
    })

    it('should throw UnauthorizedException when the account no longer exists', async () => {
      const payload = { sub: 'user-1', email: 'test@test.com' }
      mockJwtService.verify.mockReturnValue(payload)
      mockAuthService.assertEmailVerified.mockResolvedValue({
        found: false,
        emailVerified: false,
      })

      const request: any = {
        headers: { authorization: 'Bearer valid-token' },
        user: undefined,
      }

      await expect(guard.canActivate(makeContext(request))).rejects.toThrow(
        UnauthorizedException,
      )
      expect(mockAuthService.assertEmailVerified).toHaveBeenCalledWith('user-1')
    })

    it('should skip the email verification check when @SkipEmailVerificationCheck is set', async () => {
      const payload = { sub: 'user-1', email: 'test@test.com' }
      mockJwtService.verify.mockReturnValue(payload)
      mockReflector.getAllAndOverride.mockReturnValue(true)

      const request: any = {
        headers: { authorization: 'Bearer valid-token' },
        user: undefined,
      }

      await expect(guard.canActivate(makeContext(request))).resolves.toBe(true)
      expect(mockAuthService.assertEmailVerified).not.toHaveBeenCalled()
    })
  })
})
