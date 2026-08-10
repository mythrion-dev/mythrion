import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { I18nService } from 'nestjs-i18n'
import { AuthService } from './auth.service.js'
import type { AuthenticatedRequest } from './AuthenticatedRequest.js'

function extractBearerToken(header?: string): string | null {
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7)
}

function extractCookieToken(cookies?: string): string | null {
  if (!cookies) return null
  const match = /(?:^|;\s*)auth_token=([^;]*)/.exec(cookies)
  return match ? decodeURIComponent(match[1]) : null
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly i18n: I18nService,
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>()

    // 1. Try Authorization header first
    let token = extractBearerToken(req.headers.authorization)

    // 2. Fall back to auth_token cookie (same-origin iframe)
    if (!token) {
      // cookieParser makes req.cookies available — use the parsed value directly
      if (req.cookies?.auth_token) {
        token = req.cookies.auth_token
      } else if (req.headers.cookie) {
        // Fall back to raw cookie header if cookieParser didn't parse it
        token = extractCookieToken(req.headers.cookie)
      }
    }

    // 3. Fall back to ?token= query param (cross-origin iframe — Vercel → Railway)
    if (!token && req.query?.token) {
      token = req.query.token as string
    }

    if (!token) {
      throw new UnauthorizedException(this.i18n.t('auth.missingToken'))
    }

    try {
      const payload = this.jwtService.verify<AuthenticatedRequest['user']>(token)
      req.user = payload
    } catch {
      throw new UnauthorizedException(this.i18n.t('auth.invalidOrExpiredToken'))
    }

    // Routes decorated with @SkipEmailVerificationCheck() (verify email, resend,
    // change email, logout, 2FA, profile, language) work while unverified.
    const skipCheck = this.reflector.getAllAndOverride<boolean>(
      'skipEmailVerificationCheck',
      [context.getHandler(), context.getClass()],
    )
    if (skipCheck) return true

    const { found, emailVerified } = await this.authService.assertEmailVerified(
      req.user.sub,
    )
    if (!found) {
      throw new UnauthorizedException(this.i18n.t('auth.invalidOrExpiredToken'))
    }
    if (!emailVerified) {
      throw new ForbiddenException(this.i18n.t('auth.emailVerificationRequired'))
    }

    return true
  }
}
