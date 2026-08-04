import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma.service.js'
import { I18nService } from 'nestjs-i18n'
import { TokenService } from './token.service.js'
import { LanguageService } from './language.service.js'
import { TwoFactorService } from './two-factor.service.js'
import { LoginDto } from './dto/login.dto.js'
import { RegisterDto } from './dto/register.dto.js'
import { OnboardingDto } from './dto/onboarding.dto.js'
import { Language } from './dto/language.dto.js'
import { VerifyTwoFactorDto } from './dto/two-factor.dto.js'
import { ResendTwoFactorDto } from './dto/two-factor.dto.js'
import { TwoFactorConfirmDto } from './dto/two-factor.dto.js'
import { Request } from 'express'
@Injectable()
export class AuthService {
  private _geoip: typeof import('geoip-lite') | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly languageService: LanguageService,
    private readonly i18n: I18nService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  /** Lazily load geoip-lite only when first requested to avoid loading
   *  the ~150MB MaxMind database into memory at startup. */
  private async loadGeoip(): Promise<typeof import('geoip-lite')> {
    if (!this._geoip) {
      // Dynamic import ensures the database file is only read when actually needed
      this._geoip = await import('geoip-lite')
    }
    return this._geoip
  }

  async register(dto: RegisterDto, language?: Language) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    })
    if (existing) {
      throw new ConflictException(this.i18n.t('auth.emailRegistered'))
    }

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName ?? null,
        language: language ?? 'en',
      },
    })

    return this.tokenService.generateTokens(user.id, user.email)
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    })
    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.invalidCredentials'))
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        this.i18n.t('auth.socialLoginProvider'),
      )
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) {
      throw new UnauthorizedException(this.i18n.t('auth.invalidCredentials'))
    }

    if (user.twoFactorEnabled) {
      const { twoFactorId } = await this.twoFactor.issueChallenge(user.id, 'LOGIN')
      return {
        requiresTwoFactor: true,
        twoFactorId,
        emailMasked: this.twoFactor.maskEmail(user.email),
      }
    }

    return this.tokenService.generateTokens(user.id, user.email)
  }

  async verifyTwoFactor(dto: VerifyTwoFactorDto) {
    const { userId, email } = await this.twoFactor.verifyChallenge(
      dto.twoFactorId,
      dto.code,
      'LOGIN',
    )
    return this.tokenService.generateTokens(userId, email)
  }

  async resendTwoFactorCode(dto: ResendTwoFactorDto) {
    return this.twoFactor.resendLoginCode(dto.twoFactorId)
  }

  async sendTwoFactorCode(userId: string, purpose: 'ENABLE' | 'DISABLE') {
    return this.twoFactor.issueChallenge(userId, purpose)
  }

  async confirmTwoFactor(
    userId: string,
    purpose: 'ENABLE' | 'DISABLE',
    dto: TwoFactorConfirmDto,
  ) {
    return purpose === 'ENABLE'
      ? this.twoFactor.enable(userId, dto.twoFactorId, dto.code)
      : this.twoFactor.disable(userId, dto.twoFactorId, dto.code)
  }

  async refreshTokens(encodedRefreshToken: string) {
    return this.tokenService.rotateRefreshToken(encodedRefreshToken)
  }

  async logout(userId: string) {
    await this.tokenService.revokeAllTokens(userId)
    return { success: true }
  }

  async completeOnboarding(userId: string, dto: OnboardingDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        onboardingComplete: true,
      },
    })
    return { id: user.id, email: user.email, displayName: user.displayName, onboardingComplete: user.onboardingComplete }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, onboardingComplete: true, twoFactorEnabled: true },
    })
    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.userNotFound'))
    }
    const language = await this.languageService.getLanguage(userId)
    return { ...user, language }
  }

  getRequestIp(req: Request) {
    const forwarded = req.headers ['x-forwarded-for']
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim()
    }
    return req.socket.remoteAddress ?? 'unknown'
  }

  async getLocationFromIp(ip: string) {
    try {
      const geoip = await this.loadGeoip()
      const geo = geoip.lookup(ip)
      if (!geo) return { country: null, region: null, city: null }

      return {
        country: geo.country,
        region: geo.region,
        city: geo.city,
      }
    } catch {
      // If geoip fails to load for any reason, gracefully degrade
      return { country: null, region: null, city: null }
    }
  }
}
