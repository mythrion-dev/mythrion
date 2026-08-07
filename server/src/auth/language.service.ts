import { Injectable, UnauthorizedException } from '@nestjs/common'
import { I18nService } from 'nestjs-i18n'
import { PrismaService } from '../prisma.service.js'
import { RedisService } from '../redis/redis.service.js'
import { Language } from './dto/language.dto.js'

const LANGUAGE_CACHE_TTL_SECONDS = 24 * 60 * 60 // 24 hours

/**
 * Resolves and caches a user's UI language. The DB is the source of truth;
 * Redis is a read-through cache (`language:{userId}`, 24h TTL) that is warmed
 * on cache miss and refreshed on every update. RedisService degrades
 * gracefully (no-ops) when Redis is unavailable, so this service needs no
 * error handling around cache access.
 */
@Injectable()
export class LanguageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly i18n: I18nService,
  ) {}

  private cacheKey(userId: string): string {
    return `language:${userId}`
  }

  /** Map an Accept-Language header to a supported language (defaults to 'en'). */
  normalize(header?: string | null): Language {
    const first = (header ?? '').split(',')[0].toLowerCase().trim()
    if (first.startsWith('pt')) return 'pt-BR'
    if (first.startsWith('en')) return 'en'
    return 'en'
  }

  /** Persist a language preference to the DB and refresh the Redis cache. */
  async updateLanguage(userId: string, language: Language): Promise<Language> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { language },
      select: { language: true },
    })
    await this.redis.set(this.cacheKey(userId), language, LANGUAGE_CACHE_TTL_SECONDS)
    return user.language === 'pt-BR' ? 'pt-BR' : 'en'
  }

  /** Read a user's language — Redis cache first, DB fallback with cache warm. */
  async getLanguage(userId: string): Promise<Language> {
    const cached = await this.redis.get(this.cacheKey(userId))
    if (cached === 'en' || cached === 'pt-BR') return cached

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    })
    if (!user) throw new UnauthorizedException(this.i18n.t('auth.userNotFound'))

    const language = user.language === 'pt-BR' ? 'pt-BR' : 'en'
    await this.redis.set(this.cacheKey(userId), language, LANGUAGE_CACHE_TTL_SECONDS)
    return language
  }
}
