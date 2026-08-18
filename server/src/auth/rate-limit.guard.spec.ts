import { Test, TestingModule } from '@nestjs/testing'
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { RateLimitGuard, RATE_LIMIT_KEY } from './rate-limit.guard.js'
import { RedisService } from '../redis/redis.service.js'
import { I18nService } from 'nestjs-i18n'
import { createI18nServiceMock } from '../i18n/i18n-testing.js'

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard
  let mockRedis: Record<string, any>
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
        { provide: I18nService, useValue: createI18nServiceMock() },
      ],
    }).compile()

    guard = module.get<RateLimitGuard>(RateLimitGuard)
  })

  function buildContext(options?: {
    ip?: string
    path?: string
    url?: string
    socketRemoteAddress?: string
  }): ExecutionContext {
    const ip = options?.ip
    const path = options?.path
    const url = options?.url
    const socketRemoteAddress = options?.socketRemoteAddress

    const request: Record<string, any> = {}
    if (ip !== undefined) request.ip = ip
    if (path !== undefined) request.route = { path }
    if (url !== undefined) request.url = url
    if (socketRemoteAddress !== undefined) {
      request.socket = { remoteAddress: socketRemoteAddress }
    }

    return {
      switchToHttp: () => ({
        getRequest: () => request,
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
      expect(mockRedis.expire).toHaveBeenCalledWith(expect.stringMatching(/^ratelimit:/), 60)
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

    it('should strip IPv6 prefix from IP', async () => {
      mockReflector.get.mockReturnValue({ windowSeconds: 60, maxRequests: 5 })
      mockRedis.incr.mockResolvedValue(2)

      await guard.canActivate(buildContext({ ip: '::ffff:192.168.1.1' }))

      expect(mockRedis.incr).toHaveBeenCalledWith(
        expect.stringContaining('192.168.1.1'),
      )
    })

    it('should fallback to socket.remoteAddress when ip is undefined', async () => {
      mockReflector.get.mockReturnValue({ windowSeconds: 60, maxRequests: 5 })
      mockRedis.incr.mockResolvedValue(2)

      await guard.canActivate(buildContext({
        ip: undefined,
        socketRemoteAddress: '10.0.0.1',
      }))

      expect(mockRedis.incr).toHaveBeenCalledWith(
        expect.stringContaining('10.0.0.1'),
      )
    })

    it('should fallback to "unknown" when ip and socket are undefined', async () => {
      mockReflector.get.mockReturnValue({ windowSeconds: 60, maxRequests: 5 })
      mockRedis.incr.mockResolvedValue(2)

      await guard.canActivate(buildContext({ ip: undefined, url: '/test' }))

      expect(mockRedis.incr).toHaveBeenCalledWith(
        expect.stringContaining('unknown'),
      )
    })

    it('should fallback to url when route.path is undefined', async () => {
      mockReflector.get.mockReturnValue({ windowSeconds: 60, maxRequests: 5 })
      mockRedis.incr.mockResolvedValue(2)

      await guard.canActivate(buildContext({
        path: undefined,
        url: '/some-path',
      }))

      expect(mockRedis.incr).toHaveBeenCalledWith(
        expect.stringMatching(/^ratelimit:\/some-path:/),
      )
    })

    it('should fallback to "unknown" when both route.path and url are undefined', async () => {
      mockReflector.get.mockReturnValue({ windowSeconds: 60, maxRequests: 5 })
      mockRedis.incr.mockResolvedValue(2)

      await guard.canActivate(buildContext({
        ip: '1.2.3.4',
        path: undefined,
        url: undefined,
      }))

      expect(mockRedis.incr).toHaveBeenCalledWith(
        expect.stringMatching(/^ratelimit:unknown:/),
      )
    })

    it('should use redis.expire fallback TTL when ttl returns non-positive value', async () => {
      mockReflector.get.mockReturnValue({ windowSeconds: 60, maxRequests: 5 })
      mockRedis.incr.mockResolvedValue(6)
      mockRedis.ttl.mockResolvedValue(-1) // no TTL set

      try {
        await guard.canActivate(buildContext())
      } catch (err) {
        if (err instanceof HttpException) {
          const response = err.getResponse() as any
          expect(response.retryAfterSeconds).toBe(60) // falls back to windowSeconds
        }
      }
    })

    it('should handle request with no ip, no socket, no route.path, no url', async () => {
      mockReflector.get.mockReturnValue({ windowSeconds: 60, maxRequests: 5 })
      mockRedis.incr.mockResolvedValue(2)

      const request = {}
      const context = {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as ExecutionContext

      const result = await guard.canActivate(context)

      expect(result).toBe(true)
      expect(mockRedis.incr).toHaveBeenCalledWith(
        'ratelimit:unknown:unknown',
      )
    })
  })
})
