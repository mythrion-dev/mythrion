import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma.service.js'
import { TokenService } from './token.service.js'
import { LoginDto } from './dto/login.dto.js'
import { RegisterDto } from './dto/register.dto.js'
import { OnboardingDto } from './dto/onboarding.dto.js'
import { Request } from 'express'
import geoip from 'geoip-lite'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    })
    if (existing) {
      throw new ConflictException('Email already registered')
    }

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName ?? null,
      },
    })

    return this.tokenService.generateTokens(user.id, user.email)
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    })
    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account uses a social login provider. Please sign in with Google.',
      )
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    return this.tokenService.generateTokens(user.id, user.email)
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
      select: { id: true, email: true, displayName: true, onboardingComplete: true },
    })
    if (!user) {
      throw new UnauthorizedException('User not found')
    }
    return user
  }

  getRequestIp(req: Request) {
    const forwarded = req.headers ['x-forwarded-for']
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim()
    }
    return req.socket.remoteAddress ?? 'unknown'
  }

  async getLocationFromIp(ip: string) {
    const geo = geoip.lookup(ip)
    if (!geo) return { country: null, region: null, city: null }

    return {
      country: geo.country,
      region: geo.region,
      city: geo.city,
    }
  }
}