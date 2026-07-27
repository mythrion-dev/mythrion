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
