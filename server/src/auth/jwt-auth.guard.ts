import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Request } from 'express'

interface AuthenticatedRequest extends Request {
  user: { sub: string; email: string }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const header = req.headers.authorization

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing token')
    }

    const token = header.slice(7)

    try {
      const payload = this.jwtService.verify<{ sub: string; email: string }>(token)
      req.user = payload
      return true
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
  }
}