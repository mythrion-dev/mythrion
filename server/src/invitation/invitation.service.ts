import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { I18nService } from 'nestjs-i18n'
import { PrismaService } from '../prisma.service.js'
import { MembershipService } from '../membership/membership.service.js'
import { EmailService } from '../email/email.service.js'
import { v4 as uuid } from 'uuid'
import { MemberRole, InvitationStatus } from '../generated/prisma/client.js'

const INVITATION_EXPIRY_DAYS = 7
const APP_URL = process.env.FRONTEND_URL ?? 'http://localhost:3001'

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly email: EmailService,
    private readonly i18n: I18nService,
  ) {}

  private generateToken(): string {
    return uuid()
  }

  private buildExpiryDate(): Date {
    const date = new Date()
    date.setDate(date.getDate() + INVITATION_EXPIRY_DAYS)
    return date
  }

  /** Create an email-based invitation */
  async inviteByEmail(params: {
    adventureId: string
    invitedEmail: string
    createdById: string
  }) {
    // Verify creator is GM
    await this.membership.requireRole(
      params.adventureId,
      params.createdById,
      'GM',
    )

    const adventure = await this.prisma.adventure.findUnique({
      where: { id: params.adventureId },
    })
    if (!adventure) throw new NotFoundException(this.i18n.t('community.adventureNotFound'))

    // Always check player capacity — all invitations create PLAYER members
    await this.membership.assertPlayerCapacity(params.adventureId)

    const token = this.generateToken()

    const invitation = await this.prisma.campaignInvitation.create({
      data: {
        adventureId: params.adventureId,
        invitedEmail: params.invitedEmail,
        token,
        role: 'PLAYER',
        status: 'PENDING',
        expiresAt: this.buildExpiryDate(),
        createdById: params.createdById,
      },
    })

    // Get inviter name for email
    const inviter = await this.prisma.user.findUnique({
      where: { id: params.createdById },
    })

    try {
      await this.email.sendInvitation({
        to: params.invitedEmail,
        campaignName: adventure.name,
        inviterName: inviter?.displayName ?? inviter?.email ?? 'Someone',
        role: 'PLAYER',
        inviteUrl: `${APP_URL}/invite/${token}`,
        expiresAt: invitation.expiresAt,
      })
    } catch (err) {
      // The invitation is useless if the email can't be delivered — roll it back
      // and surface the failure so the GM sees exactly what went wrong.
      await this.prisma.campaignInvitation
        .delete({ where: { id: invitation.id } })
        .catch(() => undefined)
      const message = err instanceof Error ? err.message : String(err)
      throw new BadRequestException(
        this.i18n.t('community.emailFailed', { args: { message } }),
      )
    }

    return { success: true, invitationId: invitation.id }
  }

  /** Create a shareable-link invitation */
  async inviteByLink(params: {
    adventureId: string
    createdById: string
  }) {
    await this.membership.requireRole(
      params.adventureId,
      params.createdById,
      'GM',
    )

    // Always check player capacity — all invitations create PLAYER members
    await this.membership.assertPlayerCapacity(params.adventureId)

    const token = this.generateToken()

    await this.prisma.campaignInvitation.create({
      data: {
        adventureId: params.adventureId,
        token,
        role: 'PLAYER',
        status: 'PENDING',
        expiresAt: this.buildExpiryDate(),
        createdById: params.createdById,
      },
    })

    return { inviteUrl: `${APP_URL}/invite/${token}` }
  }

  /** Validate an invitation token (for the frontend preview page) */
  async validate(token: string) {
    const invitation = await this.prisma.campaignInvitation.findUnique({
      where: { token },
      include: {
        adventure: { select: { name: true, campaign: true, synopsis: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
      },
    })

    if (!invitation) {
      throw new NotFoundException(this.i18n.t('community.invitationNotFound'))
    }

    if (invitation.status === 'REVOKED') {
      return {
        campaignName: invitation.adventure.name,
        role: invitation.role,
        status: 'REVOKED' as const,
        invitedBy: invitation.createdBy.displayName ?? invitation.createdBy.email,
        isValid: false,
      }
    }

    if (invitation.status === 'ACCEPTED') {
      return {
        campaignName: invitation.adventure.name,
        role: invitation.role,
        status: 'ACCEPTED' as const,
        invitedBy: invitation.createdBy.displayName ?? invitation.createdBy.email,
        isValid: false,
      }
    }

    if (new Date() > invitation.expiresAt) {
      // Auto-expire
      await this.prisma.campaignInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      })
      return {
        campaignName: invitation.adventure.name,
        role: invitation.role,
        status: 'EXPIRED' as const,
        invitedBy: invitation.createdBy.displayName ?? invitation.createdBy.email,
        isValid: false,
      }
    }

    return {
      campaignName: invitation.adventure.name,
      campaign: invitation.adventure.campaign,
      synopsis: invitation.adventure.synopsis,
      role: invitation.role,
      status: 'PENDING' as const,
      invitedBy: invitation.createdBy.displayName ?? invitation.createdBy.email,
      expiresAt: invitation.expiresAt.toISOString(),
      isValid: true,
    }
  }

  /** Accept an invitation */
  async accept(token: string, userId: string) {
    const invitation = await this.prisma.campaignInvitation.findUnique({
      where: { token },
    })

    if (!invitation) {
      throw new NotFoundException(this.i18n.t('community.invitationNotFound'))
    }

    if (invitation.status === 'ACCEPTED') {
      throw new BadRequestException(this.i18n.t('community.alreadyAcceptedInvitation'))
    }
    if (invitation.status === 'REVOKED') {
      throw new BadRequestException(this.i18n.t('community.revoked'))
    }
    if (new Date() > invitation.expiresAt) {
      await this.prisma.campaignInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      })
      throw new BadRequestException(this.i18n.t('community.expired'))
    }

    // Check if user is already a member of this adventure
    const alreadyMember = await this.membership.isMember(invitation.adventureId, userId)
    if (alreadyMember) {
      // Already a member — just return the adventure info so the client can redirect
      const adventure = await this.prisma.adventure.findUnique({
        where: { id: invitation.adventureId },
        select: { id: true, name: true },
      })
      return {
        success: true,
        alreadyMember: true,
        adventureId: invitation.adventureId,
        adventureName: adventure?.name ?? 'Unknown',
        role: invitation.role,
      }
    }

    // Check player capacity — all invitations create PLAYER members
    const adventure = await this.prisma.adventure.findUnique({ where: { id: invitation.adventureId } })
    if (adventure) {
      const currentPlayers = await this.membership.countPlayers(invitation.adventureId)
      if (currentPlayers + 1 > adventure.maxPlayers) {
        throw new BadRequestException(this.i18n.t('community.maxPlayerCapacity'))
      }
    }

    // Create membership
    await this.membership.createMembership(
      invitation.adventureId,
      userId,
      invitation.role,
    )

    // Mark accepted
    await this.prisma.campaignInvitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    })

    return {
      success: true,
      adventureId: invitation.adventureId,
      adventureName: adventure?.name ?? 'Unknown',
      role: invitation.role,
    }
  }

  /** Revoke an invitation */
  async revoke(invitationId: string, userId: string) {
    const invitation = await this.prisma.campaignInvitation.findUnique({
      where: { id: invitationId },
    })
    if (!invitation) throw new NotFoundException(this.i18n.t('community.invitationNotFound'))

    // Must be GM of the adventure
    await this.membership.requireRole(invitation.adventureId, userId, 'GM')

    return this.prisma.campaignInvitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    })
  }

  /** List pending invitations for an adventure */
  async listForAdventure(adventureId: string, userId: string) {
    await this.membership.requireRole(adventureId, userId, 'GM')

    return this.prisma.campaignInvitation.findMany({
      where: { adventureId, status: 'PENDING' },
      include: {
        createdBy: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }
}