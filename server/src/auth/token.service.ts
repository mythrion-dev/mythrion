import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma.service.js'
import { v4 as uuid } from 'uuid'
import * as bcrypt from 'bcrypt'

const REFRESH_TOKEN_EXPIRY_DAYS = 30
const ACCESS_TOKEN_EXPIRY = '15m'

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /** Generate access token (short-lived) and refresh token (long-lived, stored in DB) */
  async generateTokens(userId: string, email: string) {
    const accessToken = this.jwtService.sign(
      { sub: userId, email },
      { expiresIn: ACCESS_TOKEN_EXPIRY },
    )

    const refreshToken = await this.createRefreshToken(userId)

    return { accessToken, refreshToken }
  }

  /** Create a refresh token stored in the database */
  private async createRefreshToken(userId: string): Promise<string> {
    // Revoke all existing refresh tokens for this user
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    })

    const rawToken = uuid()
    const tokenHash = await bcrypt.hash(rawToken, 12)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS)

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: tokenHash,
        expiresAt,
      },
    })

    // Return the raw token (not the hash) so it can be sent to the client
    // We'll also encode the userId in the token for lookup during refresh
    return Buffer.from(JSON.stringify({ userId, token: rawToken })).toString('base64')
  }

  /** Rotate a refresh token - verify old one and issue a new pair */
  async rotateRefreshToken(encodedToken: string) {
    let payload: { userId: string; token: string }
    try {
      payload = JSON.parse(Buffer.from(encodedToken, 'base64').toString('utf-8'))
    } catch {
      throw new Error('Invalid refresh token format')
    }

    const { userId, token: rawToken } = payload

    // Find all non-revoked, non-expired refresh tokens for this user
    const storedTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    })

    // Check if any stored token matches the provided raw token
    let matched = false
    for (const stored of storedTokens) {
      const isValid = await bcrypt.compare(rawToken, stored.token)
      if (isValid) {
        matched = true
        // Revoke the used token
        await this.prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revoked: true },
        })
        break
      }
    }

    if (!matched) {
      // If no match found, revoke ALL tokens for security (potential token theft)
      await this.prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      })
      throw new Error('Invalid refresh token')
    }

    // Get user email for new token generation
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Issue new token pair
    return this.generateTokens(user.id, user.email)
  }

  /** Revoke all refresh tokens for a user */
  async revokeAllTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    })
  }
}