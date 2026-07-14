import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { RedisService } from '../redis/redis.service.js'

export const RATE_LIMIT_KEY = 'rate-limit'

export interface RateLimitOptions {
  /** Window in seconds (default 900 = 15 min) */
  windowSeconds?: number
  /** Max requests per window (default 5) */
  maxRequests?: number
}

/**
 * Rate limit guard — applied via @RateLimit() decorator.
 * Uses Redis to track request counts per IP + route.
 * Falls through (allows request) if Redis is unavailable.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    )
    if (!options) return true

    const { windowSeconds = 900, maxRequests = 5 } = options

    // If Redis is not connected, skip rate limiting
    if (!this.redis.ready) return true

    const request = context.switchToHttp().getRequest()
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown'
    const route = request.route?.path ?? request.url ?? 'unknown'

    // Clean IP (strip IPv6 prefix)
    const cleanIp = ip.replace(/^::ffff:/, '')
    const rateKey = `ratelimit:${route}:${cleanIp}`
    const now = Math.floor(Date.now() / 1000)

    try {
      // Get current count and TTL
      const current = await this.redis.incr(rateKey)

      // First request — set TTL
      if (current === 1) {
        await this.redis.expire(rateKey, windowSeconds)
      }

      if (current > maxRequests) {
        const ttl = await this.redis.ttl(rateKey)
        const retryAfter = ttl > 0 ? ttl : windowSeconds

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Too many requests. Try again in ${retryAfter} seconds.`,
            error: 'Too Many Requests',
            retryAfterSeconds: retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        )
      }

      return true
    } catch (err) {
      if (err instanceof HttpException) throw err
      Logger.warn('Rate limit check failed, allowing request', 'RateLimitGuard')
      return true // Fail open
    }
  }
}
