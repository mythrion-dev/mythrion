import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Redis } from 'ioredis'

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  public client: Redis | null = null
  private isReady = false

  async onModuleInit() {
    const url = process.env.REDIS_URL
    if (!url) {
      this.logger.warn('REDIS_URL not set — Redis features disabled')
      return
    }

    try {
      this.client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 5) {
            this.logger.error('Redis connection failed after 5 retries — disabling')
            return null // stop retrying
          }
          return Math.min(times * 200, 2000)
        },
      })

      await this.client.connect()
      this.isReady = true
      this.logger.log('Connected to Redis')

      // Health-check ping
      await this.client.ping()
    } catch (err) {
      this.logger.error('Failed to connect to Redis', err)
      this.client = null
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => {})
      this.client = null
      this.isReady = false
    }
  }

  /** Guard: throw if Redis is unavailable */
  private ensureReady() {
    if (!this.client || !this.isReady) {
      throw new Error('Redis is not available')
    }
    return this.client
  }

  // ──────────────────────────────────────────────
  //  Generic helpers
  // ──────────────────────────────────────────────

  /** Get a value (returns null if missing) */
  async get(key: string): Promise<string | null> {
    if (!this.client || !this.isReady) return null
    return this.client.get(key)
  }

  /** Set a value with optional TTL in seconds */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client || !this.isReady) return
    if (ttlSeconds != null) {
      await this.client.setex(key, ttlSeconds, value)
    } else {
      await this.client.set(key, value)
    }
  }

  /** Delete one or more keys */
  async del(...keys: string[]): Promise<void> {
    if (!this.client || !this.isReady) return
    if (keys.length > 0) {
      await this.client.del(...keys)
    }
  }

  /** Check if a key exists */
  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.isReady) return false
    const result = await this.client.exists(key)
    return result === 1
  }

  /** Set a TTL on a key (seconds) */
  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client || !this.isReady) return
    await this.client.expire(key, seconds)
  }

  /** Increment an integer value (used for rate limiting), returns new count */
  async incr(key: string): Promise<number> {
    if (!this.client || !this.isReady) return 0
    return this.client.incr(key)
  }

  /** Get time-to-live for a key in seconds (-1 = no TTL, -2 = doesn't exist) */
  async ttl(key: string): Promise<number> {
    if (!this.client || !this.isReady) return -2
    return this.client.ttl(key)
  }

  // ──────────────────────────────────────────────
  //  Cache helpers (JSON-serialized)
  // ──────────────────────────────────────────────

  /** Get a JSON-parsed cache entry. Returns null if missing. */
  async cacheGet<T>(key: string): Promise<T | null> {
    const raw = await this.get(key)
    if (raw == null) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  /** Store a JSON-serialized cache entry with TTL in seconds */
  async cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds)
  }

  /** Delete cache keys matching a pattern using SCAN (non-blocking) */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.client || !this.isReady) return
    const stream = this.client.scanStream({ match: pattern, count: 100 })
    for await (const keys of stream) {
      if (keys.length > 0) {
        await this.client.del(...keys)
      }
    }
  }

  /** Check if Redis is connected and ready */
  get ready(): boolean {
    return this.isReady
  }
}
