import { Test, TestingModule } from '@nestjs/testing'
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { RateLimitGuard, RATE_LIMIT_KEY } from './rate-limit.guard.js'
import { RedisService } from '../redis/redis.service.js'

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard
  let mockRedis: Record<string, jest.Mock>
  let mockReflector: Record<string, jest.Mock>

  beforeEach(async () => {
    mockRedis = {
      incr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      ready: true,
    }
    mockReflector = {
      get: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        { provide: RedisService, useValue: mockRedis },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile()

    guard = module.get<RateLimitGuard>(RateLimitGuard)
  })

  function buildContext(options?: { ip?: string; path?: string; url?: string }): ExecutionContext {
    const ip = options?.ip ?? '127.0.0.1'
    const path = options?.path ?? '/test'
    const url = options?.url ?? '/test'

    return {
      switchToHttp: () => ({
        getRequest: () => ({
          ip,
          route: { path },
          url,
        }),
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext
  }

  describe('canActivate', () => {
    it('should return true when no rate limit options are set', async () => {
      mockReflector.get.mockReturnValue(undefined)

      const result = await guard.canActivate(buildContext())

      expect(result).toBe(true)
      expect(mockRedis.incr).not.toHaveBeenCalled()
    })

    it('should return true when Redis is not ready (fail open)', async () => {
      mockRedis.ready = false
      mockReflector.get.mockReturnValue({ windowSeconds: 60, maxRequests: 5 })

      const result = await guard.canActivate(buildContext())

      expect(result).toBe(true)
      expect(mockRedis.incr).not.toHaveBeenCalled()
    })

    it('should return true when under the rate limit', async () => {
      mockReflector.get.mockReturnValue({ windowSeconds: 60, maxRequests: 5 })
      mockRedis.incr.mockResolvedValue(3)

      const result = await guard.canActivate(buildContext())

      expect(result).toBe(true)
      expect(mockRedis.incr).toHaveBeenCalledTimes(1)
      expect(mockRedis.expire).not.toHaveBeenCalled() // not the first request
    })

    it('should set TTL on first request (current === 1)', async () => {
      mockReflector.get.mockReturnValue({ windowSeconds: 60, maxRequests: 5 })
      mockRedis.incr.mockResolvedValue(1)

      const result = await guard.canActivate(buildContext())

      expect(result).toBe(true)
      expect(mockRedis.expire).toHaveBeenCalledWith(expect.any(String), 60)
    })

    it('should throw HttpException 429 when over the limit', async () => {
      mockReflector.get.mockReturnValue({ windowSeconds: 60, maxRequests: 5 })
      mockRedis.incr.mockResolvedValue(6)
      mockRedis.ttl.mockResolvedValue(30)

      await expect(guard.canActivate(buildContext())).rejects.toThrow(HttpException)

      try {
        await guard.canActivate(buildContext())
      } catch (err) {
        if (err instanceof HttpException) {
          expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS)
          const response = err.getResponse() as any
          expect(response.retryAfterSeconds).toBe(30)
        }
      }
    })

    it('should handle non-HttpException errors gracefully (Logger.warn + return true)', async () => {
      mockReflector.get.mockReturnValue({ windowSeconds: 60, maxRequests: 5 })
      mockRedis.incr.mockRejectedValue(new Error('Redis connection lost'))

      const result = await guard.canActivate(buildContext())

      expect(result).toBe(true)
    })
  })
})
