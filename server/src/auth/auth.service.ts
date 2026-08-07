import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { randomBytes } from 'node:crypto'
import { PrismaService } from '../prisma.service.js'
import { I18nService } from 'nestjs-i18n'
import { TokenService } from './token.service.js'
import { LanguageService } from './language.service.js'
import { TwoFactorService } from './two-factor.service.js'
import { EmailService } from '../email/email.service.js'
import { LoginDto } from './dto/login.dto.js'
import { RegisterDto } from './dto/register.dto.js'
import { OnboardingDto } from './dto/onboarding.dto.js'
import { Language } from './dto/language.dto.js'
import { VerifyTwoFactorDto } from './dto/two-factor.dto.js'
import { ResendTwoFactorDto } from './dto/two-factor.dto.js'
import { TwoFactorConfirmDto } from './dto/two-factor.dto.js'
import { VerifyEmailDto } from './dto/verify-email.dto.js'
import { ResendVerificationDto } from './dto/resend-verification.dto.js'
import { ForgotPasswordDto } from './dto/forgot-password.dto.js'
import { ResetPasswordDto } from './dto/reset-password.dto.js'
import { ChangePasswordDto } from './dto/change-password.dto.js'
import { Request } from 'express'

const FRONTEND_URL = (
  process.env.FRONTEND_URL ?? 'https://mythrion.com.br'
).replace(/\/+$/, '')

// Token hashes use cost 10 (matching the refresh-token / 2FA challenge
// pattern) — the secrets are high-entropy hex strings, so a lower cost is
// still secure and keeps latency down under CPU contention.
const TOKEN_HASH_COST = 10
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24
const RESET_TOKEN_EXPIRY_MINUTES = 30

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private _geoip: typeof import('geoip-lite') | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly languageService: LanguageService,
    private readonly i18n: I18nService,
    private readonly twoFactor: TwoFactorService,
    private readonly emailService: EmailService,
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

  /**
   * Build a self-describing one-time token: base64({ userId, token }) where
   * `token` is a high-entropy hex secret. Only the secret is bcrypt-hashed for
   * storage (64 chars < bcrypt's 72-byte input cap); the userId rides along so
   * verification can look the user up directly instead of scanning all rows.
   */
  private buildSignedToken(userId: string, secret: string): string {
    return Buffer.from(JSON.stringify({ userId, token: secret })).toString('base64')
  }

  private parseSignedToken(
    rawToken: string,
  ): { userId: string; token: string } | null {
    try {
      const payload = JSON.parse(
        Buffer.from(rawToken, 'base64').toString('utf-8'),
      ) as { userId?: string; token?: string }
      if (typeof payload.userId === 'string' && typeof payload.token === 'string') {
        return { userId: payload.userId, token: payload.token }
      }
      return null
    } catch {
      return null
    }
  }

  /** Email language = the user's stored preference, falling back to English. */
  private resolveEmailLanguage(user: { language: string | null }): string {
    return user.language ?? 'en'
  }

  /**
   * Persist a login/security event. Audit writes must never break the primary
   * flow — failures are swallowed and logged.
   */
  private async recordAudit(
    userId: string,
    event: string,
    req?: Request,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          event,
          ip: req ? this.getRequestIp(req) : null,
          userAgent: req?.headers['user-agent']
            ? String(req.headers['user-agent'])
            : null,
        },
      })
    } catch (err) {
      this.logger.warn(
        `Failed to record audit event "${event}" for user ${userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }
  }

  /**
   * Generate a fresh verification token, store only its hash, and email the
   * verification link. Returns the signed raw token (used by tests); the email
   * is sent fire-and-forget — registration/resend must not fail on delivery.
   */
  private async issueVerificationToken(user: {
    id: string
    email: string
    language: string | null
  }): Promise<string> {
    const secret = randomBytes(32).toString('hex')
    const tokenHash = await bcrypt.hash(secret, TOKEN_HASH_COST)
    const expiresAt = new Date(
      Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    )
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationTokenHash: tokenHash,
        verificationTokenExpiresAt: expiresAt,
      },
    })
    const signed = this.buildSignedToken(user.id, secret)
    try {
      await this.emailService.sendEmailVerification({
        to: user.email,
        verificationUrl: `${FRONTEND_URL}/auth/verify-email?token=${encodeURIComponent(signed)}`,
        language: this.resolveEmailLanguage(user),
      })
    } catch (err) {
      // The token is already stored, so a later resend still works. Log the
      // failure and continue — the caller decides whether to surface it.
      this.logger.warn(
        `Failed to send verification email to ${user.email}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }
    return signed
  }

  /**
   * Generate a fresh password-reset token (stored as a hash) and email the
   * reset link. Same shape as issueVerificationToken but with a shorter TTL.
   */
  private async issuePasswordResetToken(user: {
    id: string
    email: string
    language: string | null
  }): Promise<string> {
    const secret = randomBytes(32).toString('hex')
    const tokenHash = await bcrypt.hash(secret, TOKEN_HASH_COST)
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000)
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetTokenExpiresAt: expiresAt,
      },
    })
    const signed = this.buildSignedToken(user.id, secret)
    try {
      await this.emailService.sendPasswordReset({
        to: user.email,
        resetUrl: `${FRONTEND_URL}/auth/reset-password?token=${encodeURIComponent(signed)}`,
        language: this.resolveEmailLanguage(user),
      })
    } catch (err) {
      this.logger.warn(
        `Failed to send password-reset email to ${user.email}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }
    return signed
  }

  async register(dto: RegisterDto, language?: Language, req?: Request) {
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
        emailVerified: false,
      },
    })

    await this.issueVerificationToken(user)
    await this.recordAudit(user.id, 'register', req)

    return this.tokenService.generateTokens(user.id, user.email)
  }

  async login(dto: LoginDto, req?: Request) {
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

    await this.recordAudit(user.id, 'login', req)
    return this.tokenService.generateTokens(user.id, user.email)
  }

  async verifyTwoFactor(dto: VerifyTwoFactorDto, req?: Request) {
    const { userId, email } = await this.twoFactor.verifyChallenge(
      dto.twoFactorId,
      dto.code,
      'LOGIN',
    )
    await this.recordAudit(userId, 'login', req)
    return this.tokenService.generateTokens(userId, email)
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const payload = this.parseSignedToken(dto.token)
    if (!payload) {
      throw new BadRequestException(this.i18n.t('auth.invalidOrExpiredToken'))
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    })
    if (
      !user ||
      !user.verificationTokenHash ||
      !user.verificationTokenExpiresAt
    ) {
      throw new BadRequestException(this.i18n.t('auth.invalidOrExpiredToken'))
    }
    if (new Date(user.verificationTokenExpiresAt) < new Date()) {
      throw new BadRequestException(this.i18n.t('auth.invalidOrExpiredToken'))
    }

    let valid = false
    try {
      valid = await bcrypt.compare(payload.token, user.verificationTokenHash)
    } catch {
      // Corrupt stored hash — treated as invalid below.
    }
    if (!valid) {
      throw new BadRequestException(this.i18n.t('auth.invalidOrExpiredToken'))
    }

    if (!user.emailVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          verificationTokenHash: null,
          verificationTokenExpiresAt: null,
        },
      })
      await this.recordAudit(user.id, 'email_verified')
    } else {
      // Idempotent: a re-clicked link on an already-verified account just
      // clears any stale token instead of erroring.
      await this.prisma.user.update({
        where: { id: user.id },
        data: { verificationTokenHash: null, verificationTokenExpiresAt: null },
      })
    }

    return { success: true }
  }

  /** Always answers `{ success: true }` — never reveals whether the email exists. */
  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    })
    if (user && !user.emailVerified) {
      await this.issueVerificationToken(user)
    }
    return { success: true }
  }

  /** Always answers `{ success: true }` — never reveals whether the email exists. */
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    })
    // Only accounts with a password can reset it; social-only accounts silently
    // get the same generic response (no enumeration).
    if (user && user.passwordHash) {
      await this.issuePasswordResetToken(user)
    }
    return { success: true }
  }

  async resetPassword(dto: ResetPasswordDto) {
    const payload = this.parseSignedToken(dto.token)
    if (!payload) {
      throw new BadRequestException(this.i18n.t('auth.invalidOrExpiredToken'))
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    })
    if (
      !user ||
      !user.passwordResetTokenHash ||
      !user.passwordResetTokenExpiresAt
    ) {
      throw new BadRequestException(this.i18n.t('auth.invalidOrExpiredToken'))
    }
    if (new Date(user.passwordResetTokenExpiresAt) < new Date()) {
      throw new BadRequestException(this.i18n.t('auth.invalidOrExpiredToken'))
    }

    let valid = false
    try {
      valid = await bcrypt.compare(payload.token, user.passwordResetTokenHash)
    } catch {
      // Corrupt stored hash — treated as invalid below.
    }
    if (!valid) {
      throw new BadRequestException(this.i18n.t('auth.invalidOrExpiredToken'))
    }

    const passwordHash = await bcrypt.hash(dto.password, 12)
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
      },
    })

    // A password reset invalidates every existing session — including any the
    // attacker held — forcing a fresh sign-in everywhere.
    await this.tokenService.revokeAllTokens(user.id)
    await this.recordAudit(user.id, 'password_reset')

    return { success: true }
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    req?: Request,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.userNotFound'))
    }
    if (!user.passwordHash) {
      throw new BadRequestException(this.i18n.t('auth.noPasswordSet'))
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash)
    if (!valid) {
      throw new BadRequestException(this.i18n.t('auth.invalidCredentials'))
    }

    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException(this.i18n.t('auth.passwordSameAsCurrent'))
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12)
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    })

    if (dto.logoutOtherDevices) {
      await this.tokenService.revokeAllTokensExcept(
        userId,
        dto.currentRefreshToken,
      )
    }

    await this.recordAudit(userId, 'password_changed', req)
    return { success: true }
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
      select: { id: true, email: true, displayName: true, onboardingComplete: true, twoFactorEnabled: true, emailVerified: true, passwordHash: true },
    })
    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.userNotFound'))
    }
    const language = await this.languageService.getLanguage(userId)
    // Expose whether a password exists (to gate change-password UI) without
    // ever returning the hash itself.
    const { passwordHash, ...profile } = user
    return { ...profile, hasPassword: !!passwordHash, language }
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
