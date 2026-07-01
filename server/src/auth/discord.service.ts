import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { TokenService } from './token.service.js'

@Injectable()
export class DiscordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
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

    // 1. Check if DiscordAccount already exists
    let discordAccount = await this.prisma.discordAccount.findUnique({
      where: { discordId },
      include: { user: true },
    })

    if (discordAccount) {
      return this.tokenService.generateTokens(discordAccount.user.id, discordAccount.user.email!)
    }

    // 2. Check if user already exists with this email
    let existingUser: any | null = null
    if (email) {
      existingUser = await this.prisma.user.findUnique({
        where: { email },
      })
    }

    if (existingUser) {
      // Link Discord to existing user
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

      // Auto-complete onboarding if not done
      if (!existingUser.onboardingComplete) {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            displayName: existingUser.displayName ?? username,
            onboardingComplete: true,
          },
        })
      }

      return this.tokenService.generateTokens(existingUser.id, existingUser.email)
    }

    // 3. Create new User + DiscordAccount
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

    return this.tokenService.generateTokens(newUser.id, newUser.email)
  }
}
