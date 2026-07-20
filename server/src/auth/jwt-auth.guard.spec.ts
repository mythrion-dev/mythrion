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
