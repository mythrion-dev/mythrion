import { RedisService } from './redis.service.js'

const mockRedisInstance = {
  on: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue('PONG'),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  incr: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(300),
  scanStream: jest.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      yield []
    },
  }),
}

jest.mock('ioredis', () => {
  const Redis = jest.fn().mockImplementation(() => mockRedisInstance)
  return {
    __esModule: true,
    default: Redis,
    Redis,
  }
})

// Access the mocked constructor to inspect constructor call args
function getRedisConstructorOptions(): Record<string, unknown> | null {
  const RedisMock = (jest.requireMock('ioredis') as any).Redis as jest.Mock
  const call = RedisMock.mock.calls[0]
  if (!call || call.length < 2) return null
  return call[1] as Record<string, unknown>
}

function resetMockRedisInstance() {
  mockRedisInstance.on = jest.fn()
  mockRedisInstance.connect = jest.fn().mockResolvedValue(undefined)
  mockRedisInstance.quit = jest.fn().mockResolvedValue(undefined)
  mockRedisInstance.ping = jest.fn().mockResolvedValue('PONG')
  mockRedisInstance.get = jest.fn().mockResolvedValue(null)
  mockRedisInstance.set = jest.fn().mockResolvedValue('OK')
  mockRedisInstance.setex = jest.fn().mockResolvedValue('OK')
  mockRedisInstance.del = jest.fn().mockResolvedValue(1)
  mockRedisInstance.exists = jest.fn().mockResolvedValue(1)
  mockRedisInstance.expire = jest.fn().mockResolvedValue(1)
  mockRedisInstance.incr = jest.fn().mockResolvedValue(1)
  mockRedisInstance.ttl = jest.fn().mockResolvedValue(300)
  mockRedisInstance.scanStream = jest.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      yield []
    },
  })
}

describe('RedisService', () => {
  let service: RedisService
  const OLD_URL = process.env.REDIS_URL

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    process.env.REDIS_URL = OLD_URL
  })

  describe('initialization', () => {
    it('should log warning and keep client null when REDIS_URL is not set', async () => {
      delete process.env.REDIS_URL

      service = new RedisService()
      await service.onModuleInit()

      expect(service.client).toBeNull()
      expect(service.ready).toBe(false)
    })

    it('should create Redis client and connect when REDIS_URL is set', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379'

      service = new RedisService()
      await service.onModuleInit()

      expect(service.client).toBe(mockRedisInstance)
      expect(mockRedisInstance.connect).toHaveBeenCalled()
      expect(mockRedisInstance.ping).toHaveBeenCalled()
      expect(service.ready).toBe(true)
    })

    it('should handle connection failure and set client to null', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379'
      mockRedisInstance.connect.mockRejectedValue(new Error('Connection refused'))

      service = new RedisService()
      await service.onModuleInit()

      expect(service.client).toBeNull()
      expect(service.ready).toBe(false)
    })
  })

  describe('retryStrategy', () => {
    beforeEach(async () => {
      jest.clearAllMocks()
      process.env.REDIS_URL = 'redis://localhost:6379'
      service = new RedisService()
      await service.onModuleInit()
    })

    it('should return delay when retries <= 5', () => {
      const opts = getRedisConstructorOptions()
      expect(opts).not.toBeNull()
      const retryStrategy = opts!.retryStrategy as (t: number) => number | null
      expect(retryStrategy).toBeDefined()

      const result = retryStrategy(3)
      expect(result).toBe(600) // Math.min(3 * 200, 2000)
    })

    it('should return null and log error when retries > 5', () => {
      const opts = getRedisConstructorOptions()
      expect(opts).not.toBeNull()
      const retryStrategy = opts!.retryStrategy as (t: number) => number | null
      expect(retryStrategy).toBeDefined()

      const result = retryStrategy(6)
      expect(result).toBeNull()
    })
  })

  describe('with connected client', () => {
    beforeEach(async () => {
      jest.clearAllMocks()
      resetMockRedisInstance()
      process.env.REDIS_URL = 'redis://localhost:6379'
      service = new RedisService()
      await service.onModuleInit()
    })

    describe('get', () => {
      it('should delegate to client.get', async () => {
        mockRedisInstance.get.mockResolvedValue('some-value')

        const result = await service.get('my-key')

        expect(mockRedisInstance.get).toHaveBeenCalledWith('my-key')
        expect(result).toBe('some-value')
      })
    })

    describe('set', () => {
      it('should call client.set when no ttl', async () => {
        await service.set('k', 'v')

        expect(mockRedisInstance.set).toHaveBeenCalledWith('k', 'v')
      })

      it('should call client.setex when ttl provided', async () => {
        await service.set('k', 'v', 60)

        expect(mockRedisInstance.setex).toHaveBeenCalledWith('k', 60, 'v')
      })
    })

    describe('del', () => {
      it('should call client.del with keys', async () => {
        await service.del('k1', 'k2')

        expect(mockRedisInstance.del).toHaveBeenCalledWith('k1', 'k2')
      })

      it('should not call client.del with no keys', async () => {
        await service.del()

        expect(mockRedisInstance.del).not.toHaveBeenCalled()
      })
    })

    describe('exists', () => {
      it('should return true when key exists', async () => {
        mockRedisInstance.exists.mockResolvedValue(1)

        const result = await service.exists('k')

        expect(result).toBe(true)
      })

      it('should return false when key does not exist', async () => {
        mockRedisInstance.exists.mockResolvedValue(0)

        const result = await service.exists('k')

        expect(result).toBe(false)
      })
    })

    describe('expire', () => {
      it('should call client.expire', async () => {
        await service.expire('k', 300)

        expect(mockRedisInstance.expire).toHaveBeenCalledWith('k', 300)
      })
    })

    describe('incr', () => {
      it('should delegate to client.incr', async () => {
        mockRedisInstance.incr.mockResolvedValue(5)

        const result = await service.incr('rate-key')

        expect(mockRedisInstance.incr).toHaveBeenCalledWith('rate-key')
        expect(result).toBe(5)
      })
    })

    describe('ttl', () => {
      it('should delegate to client.ttl', async () => {
        mockRedisInstance.ttl.mockResolvedValue(120)

        const result = await service.ttl('k')

        expect(mockRedisInstance.ttl).toHaveBeenCalledWith('k')
        expect(result).toBe(120)
      })
    })

    describe('cacheGet', () => {
      it('should parse stored JSON', async () => {
        mockRedisInstance.get.mockResolvedValue('{"data":42}')

        const result = await service.cacheGet<{ data: number }>('ck')

        expect(result).toEqual({ data: 42 })
      })

      it('should return null when key missing', async () => {
        mockRedisInstance.get.mockResolvedValue(null)

        const result = await service.cacheGet('ck')

        expect(result).toBeNull()
      })

      it('should return null when JSON is invalid', async () => {
        mockRedisInstance.get.mockResolvedValue('not-json')

        const result = await service.cacheGet('ck')

        expect(result).toBeNull()
      })
    })

    describe('cacheSet', () => {
      it('should JSON-stringify and set with TTL', async () => {
        await service.cacheSet('ck', { hello: 'world' }, 120)

        expect(mockRedisInstance.setex).toHaveBeenCalledWith('ck', 120, '{"hello":"world"}')
      })
    })

    describe('invalidatePattern', () => {
      it('should do nothing when no keys match', async () => {
        mockRedisInstance.scanStream.mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield []
          },
        })

        await service.invalidatePattern('tmp:*')

        expect(mockRedisInstance.del).not.toHaveBeenCalled()
      })

      it('should delete matching keys', async () => {
        mockRedisInstance.scanStream.mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield ['tmp:1', 'tmp:2']
          },
        })

        await service.invalidatePattern('tmp:*')

        expect(mockRedisInstance.del).toHaveBeenCalledWith('tmp:1', 'tmp:2')
      })
    })

    describe('ready getter', () => {
      it('should return true when connected', () => {
        expect(service.ready).toBe(true)
      })
    })
  })

  describe('without client (REDIS_URL not set)', () => {
    beforeEach(() => {
      delete process.env.REDIS_URL
      service = new RedisService()
    })

    describe('get', () => {
      it('should return null when client is null', async () => {
        const result = await service.get('some-key')
        expect(result).toBeNull()
      })
    })

    describe('set', () => {
      it('should no-op when client is null', async () => {
        await service.set('key', 'value')
        expect(mockRedisInstance.set).not.toHaveBeenCalled()
      })
    })

    describe('del', () => {
      it('should no-op when client is null', async () => {
        await service.del('key')
        expect(mockRedisInstance.del).not.toHaveBeenCalled()
      })
    })

    describe('exists', () => {
      it('should return false when client is null', async () => {
        const result = await service.exists('some-key')
        expect(result).toBe(false)
      })
    })

    describe('expire', () => {
      it('should no-op when client is null', async () => {
        await service.expire('k', 60)
        expect(mockRedisInstance.expire).not.toHaveBeenCalled()
      })
    })

    describe('incr', () => {
      it('should return 0 when client is null', async () => {
        const result = await service.incr('rate-key')
        expect(result).toBe(0)
      })
    })

    describe('ttl', () => {
      it('should return -2 when client is null', async () => {
        const result = await service.ttl('some-key')
        expect(result).toBe(-2)
      })
    })

    describe('cacheGet', () => {
      it('should return null when client is null', async () => {
        const result = await service.cacheGet('cache-key')
        expect(result).toBeNull()
      })
    })

    describe('cacheSet', () => {
      it('should no-op when client is null', async () => {
        await service.cacheSet('key', { data: 123 }, 60)
        expect(mockRedisInstance.setex).not.toHaveBeenCalled()
      })
    })

    describe('invalidatePattern', () => {
      it('should no-op when client is null', async () => {
        await service.invalidatePattern('tmp:*')
        expect(mockRedisInstance.del).not.toHaveBeenCalled()
      })
    })

    describe('ready getter', () => {
      it('should return false when client is null', async () => {
        const result = service.ready
        expect(result).toBe(false)
      })
    })

    describe('onModuleDestroy', () => {
      it('should no-op when client is null', async () => {
        await service.onModuleDestroy()
        expect(mockRedisInstance.quit).not.toHaveBeenCalled()
      })
    })
  })

  describe('onModuleDestroy with client', () => {
    beforeEach(async () => {
      jest.clearAllMocks()
      resetMockRedisInstance()
      process.env.REDIS_URL = 'redis://localhost:6379'
      service = new RedisService()
      await service.onModuleInit()
    })

    it('should call client.quit() when client exists', async () => {
      await service.onModuleDestroy()

      expect(mockRedisInstance.quit).toHaveBeenCalled()
      expect(service.client).toBeNull()
      expect(service.ready).toBe(false)
    })

    it('should handle quit() rejection gracefully', async () => {
      mockRedisInstance.quit.mockRejectedValue(new Error('Quit failed'))

      await service.onModuleDestroy()

      // Should not throw despite quit rejecting
      expect(service.client).toBeNull()
      expect(service.ready).toBe(false)
    })
  })
})
