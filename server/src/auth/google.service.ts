import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { TokenService } from './token.service.js'

@Injectable()
export class GoogleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async validateOAuthLogin(profile: {
    id: string
    emails?: Array<{ value: string }>
    photos?: Array<{ value: string }>
    displayName?: string
    name?: { givenName?: string; familyName?: string }
    _json?: { locale?: string }
  }) {
    const email = profile.emails?.[0]?.value
    const googleId = profile.id
    const avatarUrl = profile.photos?.[0]?.value ?? null
    const displayName =
      profile.displayName ?? profile.name?.givenName ?? null
    const locale = profile._json?.locale ?? null

    if (!email || !googleId) {
      throw new Error('Google profile missing email or id')
    }

    // 1. Check if GoogleAccount already exists by googleId
    let googleAccount = await this.prisma.googleAccount.findUnique({
      where: { googleId },
      include: { user: true },
    })

    if (googleAccount) {
      return this.tokenService.generateTokens(googleAccount.user.id, googleAccount.user.email)
    }

    // 2. Check if a User already exists with this email (email/password signup)
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      // Link GoogleAccount to existing user
      await this.prisma.googleAccount.create({
        data: {
          googleId,
          email,
          displayName,
          avatarUrl,
          locale,
          userId: existingUser.id,
        },
      })

      // Google OAuth is proof-of-identity: mark the email verified. Also
      // auto-complete onboarding if not done.
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          emailVerified: true,
          ...(existingUser.emailVerified
            ? {}
            : { emailVerifiedAt: new Date() }),
          ...(!existingUser.onboardingComplete
            ? {
                displayName: existingUser.displayName ?? displayName,
                onboardingComplete: true,
              }
            : {}),
        },
      })

      return this.tokenService.generateTokens(existingUser.id, existingUser.email)
    }

    // 3. Create new User + GoogleAccount (Google accounts are verified by
    //    default — no verification email needed)
    const newUser = await this.prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash: undefined,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        googleAccount: {
          create: {
            googleId,
            email,
            displayName,
            avatarUrl,
            locale,
          },
        },
      },
    })

    return this.tokenService.generateTokens(newUser.id, newUser.email)
  }
}
