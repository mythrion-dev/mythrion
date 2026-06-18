import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma.service.js'
import { LoginDto } from './dto/login.dto.js'
import { RegisterDto } from './dto/register.dto.js'
import { OnboardingDto } from './dto/onboarding.dto.js'
import { Request } from 'express'
import geoip from 'geoip-lite'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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

    return this.signTokens(user.id, user.email)
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
        'This account uses a social login provider. Please sign in with Google or Discord.',
      )
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    return this.signTokens(user.id, user.email)
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

  private signTokens(userId: string, email: string) {
    const payload = { sub: userId, email }
    return {
      accessToken: this.jwtService.sign(payload),
    }
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

  async getDiscordAccount(userId: string) {
    const discordAccount = await this.prisma.discordAccount.findUnique({
      where: { userId },
    })
    return discordAccount
  }
}