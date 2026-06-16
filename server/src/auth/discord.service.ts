import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma.service.js'

@Injectable()
export class DiscordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateOAuthLogin(profile: {
    id: string
    username: string
    email?: string
    avatar?: string
    discriminator?: string
    locale?: string
    verified?: boolean
  }) {
    const discordId = profile.id
    const username = profile.username
    const email = profile.email
    if (!email) {
      throw new Error ('Discord profile missing email')
    }
    const avatarUrl = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
      : undefined
    const discriminator = profile.discriminator ?? undefined
    const locale = profile.locale ?? undefined
    const verified = profile.verified ?? false

    // 1. Verificar se DiscordAccount já existe
    let discordAccount = await this.prisma.discordAccount.findUnique({
      where: { discordId },
      include: { user: true },
    })

    if (discordAccount) {
      return this.signTokens(discordAccount.user.id, discordAccount.user.email)
    }

    // 2. Se houver email, verificar se User já existe com esse email
    let existingUser: any | null = null
    if (email) {
      existingUser = await this.prisma.user.findUnique({
        where: { email },
      })
    }

    if (existingUser) {
      // Conectar Discord ao usuário existente
      await this.prisma.discordAccount.create({
        data: {
          discordId,
          username,
          email,
          avatarUrl,
          discriminator,
          locale,
          verified,
          userId: existingUser.id,
        },
      })

      // Auto-completar onboarding se não foi feito
      if (!existingUser.onboardingComplete) {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            displayName: existingUser.displayName ?? username,
            onboardingComplete: true,
          },
        })
      }

      return this.signTokens(existingUser.id, existingUser.email)
    }

    // 3. Criar novo User + DiscordAccount
    const newUser = await this.prisma.user.create({
      data: {
        email,
        displayName: username,
        discordAccount: {
          create: {
            discordId,
            username,
            email,
            avatarUrl,
            discriminator,
            locale,
            verified,
          },
        },
      },
    })

    return this.signTokens(newUser.id, newUser.email)
  }

  private signTokens(userId: string, email?: string | null) {
    const payload = { sub: userId, email }
    return {
      accessToken: this.jwtService.sign(payload),
    }
  }
}