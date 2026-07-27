import { Test, TestingModule } from '@nestjs/testing'
import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { JwtAuthGuard } from './jwt-auth.guard.js'

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard
  let mockJwtService: Record<string, jest.Mock>

  beforeEach(async () => {
    mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile()

    guard = module.get<JwtAuthGuard>(JwtAuthGuard)
  })

  describe('canActivate', () => {
    it('should extract Bearer token, verify it, set req.user, and return true', () => {
      const payload = { sub: 'user-1', email: 'test@test.com' }
      mockJwtService.verify.mockReturnValue(payload)

      const request: any = {
        headers: { authorization: 'Bearer valid-token' },
        user: undefined,
      }

      const context: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext

      const result = guard.canActivate(context)

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token')
      expect(request.user).toEqual(payload)
      expect(result).toBe(true)
    })

    it('should throw UnauthorizedException on missing token', () => {
      const request: any = {
        headers: {},
        user: undefined,
      }

      const context: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException)
      expect(mockJwtService.verify).not.toHaveBeenCalled()
    })

    it('should throw UnauthorizedException on invalid Authorization header format', () => {
      const request: any = {
        headers: { authorization: 'Invalid-format' },
        user: undefined,
      }

      const context: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException)
    })

    it('should extract token from req.cookies.auth_token (parsed by cookieParser)', () => {
      const payload = { sub: 'user-1', email: 'test@test.com' }
      mockJwtService.verify.mockReturnValue(payload)

      const request: any = {
        headers: {},
        cookies: { auth_token: 'cookie-jwt-token' },
        user: undefined,
      }

      const context: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext

      const result = guard.canActivate(context)

      expect(mockJwtService.verify).toHaveBeenCalledWith('cookie-jwt-token')
      expect(request.user).toEqual(payload)
      expect(result).toBe(true)
    })

    it('should extract token from raw req.headers.cookie when cookieParser did not parse', () => {
      const payload = { sub: 'user-1', email: 'test@test.com' }
      mockJwtService.verify.mockReturnValue(payload)

      const request: any = {
        headers: { cookie: 'auth_token=raw-cookie-token; other=val' },
        cookies: {},
        user: undefined,
      }

      const context: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext

      const result = guard.canActivate(context)

      expect(mockJwtService.verify).toHaveBeenCalledWith('raw-cookie-token')
      expect(request.user).toEqual(payload)
      expect(result).toBe(true)
    })

    it('should prefer Authorization header over auth_token cookie', () => {
      const payload = { sub: 'user-1', email: 'test@test.com' }
      mockJwtService.verify.mockReturnValue(payload)

      const request: any = {
        headers: { authorization: 'Bearer header-token', cookie: 'auth_token=cookie-token' },
        cookies: { auth_token: 'cookie-token' },
        user: undefined,
      }

      const context: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext

      guard.canActivate(context)

      expect(mockJwtService.verify).toHaveBeenCalledWith('header-token')
    })

    it('should extract token from req.query.token (cross-origin iframe fallback)', () => {
      const payload = { sub: 'user-1', email: 'test@test.com' }
      mockJwtService.verify.mockReturnValue(payload)

      const request: any = {
        headers: {},
        cookies: {},
        query: { token: 'query-param-token' },
        user: undefined,
      }

      const context: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext

      const result = guard.canActivate(context)

      expect(mockJwtService.verify).toHaveBeenCalledWith('query-param-token')
      expect(request.user).toEqual(payload)
      expect(result).toBe(true)
    })

    it('should prefer cookie over query param', () => {
      const payload = { sub: 'user-1', email: 'test@test.com' }
      mockJwtService.verify.mockReturnValue(payload)

      const request: any = {
        headers: {},
        cookies: { auth_token: 'cookie-token' },
        query: { token: 'query-token' },
        user: undefined,
      }

      const context: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext

      guard.canActivate(context)

      expect(mockJwtService.verify).toHaveBeenCalledWith('cookie-token')
    })

    it('should throw UnauthorizedException on invalid or expired token', () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired')
      })

      const request: any = {
        headers: { authorization: 'Bearer expired-token' },
        user: undefined,
      }

      const context: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException)
      expect(mockJwtService.verify).toHaveBeenCalledWith('expired-token')
      expect(request.user).toBeUndefined()
    })
  })
})
