import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Request } from 'express'

export interface AuthenticatedRequest extends Request {
  user: { sub: string; email: string }
}

function extractBearerToken(header?: string): string | null {
  if (!header || !header.startsWith('Bearer ')) return null
  return header.slice(7)
}

function extractCookieToken(cookies?: string): string | null {
  if (!cookies) return null
  const match = cookies.match(/(?:^|;\s*)auth_token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>()

    // 1. Try Authorization header first
    let token = extractBearerToken(req.headers.authorization)

    // 2. Fall back to auth_token cookie for iframe requests
    if (!token) {
      // cookieParser makes req.cookies available; fall back to raw header
      const rawCookies =
        req.cookies?.auth_token ?? req.headers.cookie
      if (rawCookies) {
        token =
          typeof rawCookies === 'string'
            ? extractCookieToken(rawCookies)
            : rawCookies
      }
    }

    if (!token) {
      throw new UnauthorizedException('Missing token')
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; email: string }>(token)
      req.user = payload
      return true
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
  }
}
