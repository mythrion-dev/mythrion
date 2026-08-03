import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma.service.js'
import { RedisService } from '../redis/redis.service.js'
import { AdminService } from './admin.service.js'
import { v4 as uuid } from 'uuid'
import * as bcrypt from 'bcrypt'

const REFRESH_TOKEN_EXPIRY_DAYS = 30
const ACCESS_TOKEN_EXPIRY = '15m'
const MAX_ACTIVE_REFRESH_TOKENS = 5

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly adminService: AdminService,
  ) {}

  /** Generate access token (short-lived) and refresh token (long-lived, stored in DB) */
  async generateTokens(userId: string, email: string) {
    const role = this.adminService.isAdmin(email)
      ? 'admin'
      : this.adminService.isEarlyAccess(email)
        ? 'early_access'
        : 'user'
    const accessToken = this.jwtService.sign(
      { sub: userId, email, role },
      { expiresIn: ACCESS_TOKEN_EXPIRY },
    )

    // A prior logout (revokeAllTokens) leaves a Redis `token_blacklist:{userId}`
    // marker with a 30-day TTL. The user is explicitly authenticating again here
    // (login / register / Google / refresh), so clear that marker — otherwise the
    // first refresh after this access token expires would be rejected and the
    // user would be force-logged-out at the ~15 minute mark.
    await this.redis.del(`token_blacklist:${userId}`)

    const refreshToken = await this.createRefreshToken(userId)

    return { accessToken, refreshToken }
  }

  /** Create a refresh token stored in the database */
  private async createRefreshToken(userId: string): Promise<string> {
    const rawToken = uuid()
    // UUIDs already have ~122 bits of entropy; bcrypt cost factor 10 is
    // sufficient and avoids ~300ms delays with cost 12 under CPU contention.
    const tokenHash = await bcrypt.hash(rawToken, 10)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS)

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: tokenHash,
        expiresAt,
      },
    })

    // Cap the number of live refresh tokens per user so a growing pile of
    // rotated rows never accumulates. The newest MAX_ACTIVE_REFRESH_TOKENS are
    // kept (the one just created plus the most recent siblings); any older live
    // tokens are dropped. We deliberately do NOT revoke all siblings on issue —
    // that would log the user out of their other devices on every login/refresh.
    const recent = await this.prisma.refreshToken.findMany({
      where: { userId, revoked: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
      take: MAX_ACTIVE_REFRESH_TOKENS,
    })
    if (recent.length >= MAX_ACTIVE_REFRESH_TOKENS) {
      const keepIds = recent.map((t) => t.id)
      await this.prisma.refreshToken.deleteMany({
        where: { userId, revoked: false, id: { notIn: keepIds } },
      })
    }

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

    // Check Redis blacklist first — fast-fail if user has logged out
    const blacklistedSince = await this.redis.get(`token_blacklist:${userId}`)
    if (blacklistedSince) {
      // User logged out; all their refresh tokens are revoked
      throw new UnauthorizedException('Refresh token has been revoked')
    }

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
      // Wrap bcrypt.compare in try/catch to surface database/connection
      // errors cleanly instead of silently proceeding to the "no match" path.
      let isValid = false
      try {
        isValid = await bcrypt.compare(rawToken, stored.token)
      } catch (err) {
        throw new InternalServerErrorException('Token verification failed, please try again')
      }
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
      // No stored token matched the presented raw token. This is usually a
      // stale/expired token, not theft. Reject this attempt only — revoking
      // every live token here would cascade-log-out the user's other devices
      // for a single bad token. The presented token is simply invalid.
      throw new UnauthorizedException('Invalid refresh token')
    }

    // Get user email for new token generation
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    // Issue new token pair
    return this.generateTokens(user.id, user.email)
  }

  /** Revoke all refresh tokens for a user (DB + Redis blacklist) */
  async revokeAllTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    })

    // Store blacklist marker in Redis with TTL matching token expiry
    // This allows instant rejection of any refresh attempt after logout
    await this.redis.set(
      `token_blacklist:${userId}`,
      String(Math.floor(Date.now() / 1000)),
      REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
    )
  }
}