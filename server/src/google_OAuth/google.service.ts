import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma.service.js'

@Injectable()
export class GoogleService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
  ) {}

  async validateOAuthLogin(profile: any) {
        const email = profile.emails?.[0]?.value
        const googleId = profile.id
        const avatar = profile.photos?.[0]?.value
        const displayName = profile.displayName ?? profile.name?.givenName ?? null
        const locale = profile._json?.locale ?? null

    let user: any = null

    if (googleId) {
      user = await this.prisma.googleAccount.findUnique({ where: { googleId } })
    }

    if (!user && email) {
      user = await this.prisma.googleAccount.findFirst({ where: { email } })
      if (user) {
        user = await this.prisma.googleAccount.update({
          where: { id: user.id },
          data: { googleId, avatarUrl: avatar, locale, displayName: user.displayName ?? displayName },
        })
      }
    }

    if (!user) {
      user = await this.prisma.googleAccount.create({
        data: {
          email,
          googleId,
          avatarUrl: avatar,
          locale,
          displayName,
          user: { create: {} as any },
        },
      })
    }

    return { id: user.id, email: user.email }
  }

  signTokens(userId: string, email: string) {
    const payload = { sub: userId, email }
    return {
      accessToken: this.jwtService.sign(payload),
        }
    }
}