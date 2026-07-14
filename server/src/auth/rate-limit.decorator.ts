import { SetMetadata } from '@nestjs/common'
import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.guard.js'

/**
 * Apply rate limiting to an endpoint.
 *
 * @example @RateLimit({ windowSeconds: 60, maxRequests: 10 })
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options)
