import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { I18nService } from 'nestjs-i18n'
import * as bcrypt from 'bcrypt'
import * as crypto from 'crypto'
import { PrismaService } from '../prisma.service.js'
import { EmailService } from '../email/email.service.js'
import { TwoFactorPurpose } from '../generated/prisma/client.js'

const CODE_TTL_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5
const RECOVERY_CODE_COUNT = 10
const RECOVERY_CODE_LENGTH = 10
// No 0/O/1/I so codes survive a confused human reading them aloud.
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const BCRYPT_COST = 10

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly i18n: I18nService,
  ) {}

  generateOtp(): string {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
  }

  /** Email the user a fresh OTP and persist the challenge it belongs to. */
  async issueChallenge(userId: string, purpose: TwoFactorPurpose) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    })
    if (!user) {
      throw new NotFoundException(this.i18n.t('auth.userNotFound'))
    }

    const code = this.generateOtp()
    const challenge = await this.prisma.twoFactorChallenge.create({
      data: {
        userId,
        purpose,
        codeHash: await bcrypt.hash(code, BCRYPT_COST),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    })

    try {
      await this.email.sendTwoFactorCode({
        to: user.email,
        code,
        expiresInMinutes: CODE_TTL_MS / (60 * 1000),
      })
    } catch {
      // Never leave an un-deliverable challenge lying around.
      await this.prisma.twoFactorChallenge
        .delete({ where: { id: challenge.id } })
        .catch(() => undefined)
      throw new BadRequestException(this.i18n.t('auth.twoFactorSendFailed'))
    }

    return { twoFactorId: challenge.id }
  }

  /** Resend the login code — invalidates the old challenge so at most one live code exists. */
  async resendLoginCode(twoFactorId: string) {
    const challenge = await this.prisma.twoFactorChallenge.findUnique({
      where: { id: twoFactorId },
    })
    if (!challenge || challenge.purpose !== 'LOGIN' || challenge.usedAt) {
      throw new BadRequestException(this.i18n.t('auth.invalidTwoFactorChallenge'))
    }
    if (new Date() >= challenge.expiresAt) {
      throw new BadRequestException(this.i18n.t('auth.twoFactorExpired'))
    }

    await this.prisma.twoFactorChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    })
    return this.issueChallenge(challenge.userId, 'LOGIN')
  }

  /**
   * Verify an OTP (or, for LOGIN challenges only, a recovery code). Guards run
   * in a fixed order so the client can rely on a stable error per condition.
   */
  async verifyChallenge(
    twoFactorId: string,
    inputCode: string,
    expectedPurpose?: TwoFactorPurpose,
    expectedUserId?: string,
  ) {
    const challenge = await this.prisma.twoFactorChallenge.findUnique({
      where: { id: twoFactorId },
      include: { user: { select: { id: true, email: true } } },
    })
    if (!challenge) {
      throw new BadRequestException(this.i18n.t('auth.invalidTwoFactorChallenge'))
    }
    if (expectedPurpose && challenge.purpose !== expectedPurpose) {
      throw new BadRequestException(this.i18n.t('auth.invalidTwoFactorChallenge'))
    }
    if (expectedUserId && challenge.user.id !== expectedUserId) {
      throw new BadRequestException(this.i18n.t('auth.invalidTwoFactorChallenge'))
    }
    if (new Date() >= challenge.expiresAt) {
      throw new BadRequestException(this.i18n.t('auth.twoFactorExpired'))
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException(this.i18n.t('auth.twoFactorTooManyAttempts'))
    }
    if (challenge.usedAt) {
      throw new BadRequestException(this.i18n.t('auth.invalidTwoFactorCode'))
    }

    const matchesOtp = await bcrypt.compare(inputCode, challenge.codeHash)
    if (matchesOtp) {
      await this.markChallengeUsed(challenge.id)
      return { userId: challenge.user.id, email: challenge.user.email }
    }

    // Recovery codes only back up password login, never enable/disable flows.
    if (challenge.purpose === 'LOGIN') {
      const recovered = await this.consumeRecoveryCode(challenge.user.id, inputCode)
      if (recovered) {
        await this.markChallengeUsed(challenge.id)
        return { userId: challenge.user.id, email: challenge.user.email }
      }
    }

    const attempts = challenge.attempts + 1
    await this.prisma.twoFactorChallenge.update({
      where: { id: challenge.id },
      data: attempts >= MAX_ATTEMPTS ? { attempts, usedAt: new Date() } : { attempts },
    })
    throw new BadRequestException(this.i18n.t('auth.invalidTwoFactorCode'))
  }

  /** Claim a single unused recovery code; returns false if none matches or a
   *  concurrent request already used it (never reveals which code was wrong). */
  private async consumeRecoveryCode(userId: string, input: string): Promise<boolean> {
    const normalized = input.trim().toUpperCase()
    const codes = await this.prisma.recoveryCode.findMany({
      where: { userId, usedAt: null },
    })
    for (const code of codes) {
      const match = await bcrypt.compare(normalized, code.codeHash)
      if (match) {
        const res = await this.prisma.recoveryCode.updateMany({
          where: { id: code.id, usedAt: null },
          data: { usedAt: new Date() },
        })
        return res.count === 1
      }
    }
    return false
  }

  /** Generate recovery codes, store their hashes, and return the plaintext once. */
  async issueRecoveryCodes(userId: string) {
    const codes: string[] = []
    const rows: { userId: string; codeHash: string }[] = []
    for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
      const code = this.generateRecoveryCode()
      codes.push(code)
      rows.push({ userId, codeHash: await bcrypt.hash(code, BCRYPT_COST) })
    }
    await this.prisma.recoveryCode.createMany({ data: rows })
    return codes
  }

  private generateRecoveryCode(): string {
    const bytes = crypto.randomBytes(RECOVERY_CODE_LENGTH)
    let code = ''
    for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) {
      code += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length]
    }
    return code
  }

  async enable(userId: string, twoFactorId: string, code: string) {
    await this.verifyChallenge(twoFactorId, code, 'ENABLE', userId)
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    })
    const recoveryCodes = await this.issueRecoveryCodes(userId)
    return { recoveryCodes }
  }

  async disable(userId: string, twoFactorId: string, code: string) {
    await this.verifyChallenge(twoFactorId, code, 'DISABLE', userId)
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false },
    })
    await this.prisma.recoveryCode.deleteMany({ where: { userId } })
    return { success: true }
  }

  maskEmail(email: string): string {
    const [local, ...domainParts] = email.split('@')
    const domain = domainParts.join('@')
    return `${local.slice(0, 3)}***@${domain}`
  }

  private markChallengeUsed(twoFactorId: string) {
    return this.prisma.twoFactorChallenge.update({
      where: { id: twoFactorId },
      data: { usedAt: new Date() },
    })
  }
}
