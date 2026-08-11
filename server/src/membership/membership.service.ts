import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common'
import { I18nService } from 'nestjs-i18n'
import { PrismaService } from '../prisma.service.js'
import { SubscriptionService } from '../subscription/subscription.service.js'
import { MemberRole } from '../generated/prisma/client.js'

@Injectable()
export class MembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  /** Check that the user has at least the required role on the adventure. */
  async requireRole(
    adventureId: string,
    userId: string,
    requiredRole: MemberRole,
  ) {
    const member = await this.prisma.campaignMember.findUnique({
      where: {
        adventureId_userId: { adventureId, userId },
      },
    })
    if (!member) {
      throw new ForbiddenException(this.i18n.t('community.notMember'))
    }

    if (requiredRole === 'GM' && member.role !== 'GM') {
      throw new ForbiddenException(this.i18n.t('community.gmOnly'))
    }

    return member
  }

  /**
   * Require the given role AND that the campaign is writable.
   * A campaign is read-only when the GM's subscription is no longer active;
   * this cascades to every member regardless of their own subscription.
   */
  async requireWriteRole(
    adventureId: string,
    userId: string,
    requiredRole: MemberRole,
  ) {
    const member = await this.requireRole(adventureId, userId, requiredRole)
    await this.assertCampaignWritable(adventureId)
    return member
  }

  /**
   * Require campaign membership AND that the campaign is writable.
   * Used by write endpoints that authorize by ownership rather than role.
   */
  async requireWriteAccess(adventureId: string, userId: string) {
    const member = await this.prisma.campaignMember.findUnique({
      where: { adventureId_userId: { adventureId, userId } },
    })
    if (!member) {
      throw new ForbiddenException(this.i18n.t('community.notMember'))
    }
    await this.assertCampaignWritable(adventureId)
    return member
  }

  /**
   * Derive the campaign's current access state for a member.
   * Returns 'ACTIVE' | 'READ_ONLY' (throws for non-members).
   */
  async getAccessState(
    adventureId: string,
    userId: string,
  ): Promise<'ACTIVE' | 'READ_ONLY'> {
    await this.requireRole(adventureId, userId, 'PLAYER')
    const adventure = await this.prisma.adventure.findUnique({
      where: { id: adventureId },
      select: { ownerId: true },
    })
    if (!adventure) {
      throw new NotFoundException(this.i18n.t('community.adventureNotFound'))
    }
    const active = await this.subscriptionService.hasActiveSubscription(
      adventure.ownerId,
    )
    return active ? 'ACTIVE' : 'READ_ONLY'
  }

  /**
   * Throws Forbidden when the GM's subscription is no longer active.
   * The campaign becomes read-only for everyone, not just the GM.
   */
  private async assertCampaignWritable(adventureId: string): Promise<void> {
    const adventure = await this.prisma.adventure.findUnique({
      where: { id: adventureId },
      select: { ownerId: true },
    })
    if (!adventure) {
      throw new NotFoundException(this.i18n.t('community.adventureNotFound'))
    }
    const active = await this.subscriptionService.hasActiveSubscription(
      adventure.ownerId,
    )
    if (!active) {
      throw new ForbiddenException(this.i18n.t('community.campaignReadOnly'))
    }
  }

  /** Create a membership (sets GM automatically if it's the owner). */
  async createMembership(
    adventureId: string,
    userId: string,
    role: MemberRole,
  ) {
    return this.prisma.campaignMember.create({
      data: { adventureId, userId, role },
    })
  }

  async getMembers(adventureId: string) {
    return this.prisma.campaignMember.findMany({
      where: { adventureId },
      include: {
        user: {
          select: { id: true, email: true, displayName: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    })
  }

  async getUserAdventures(userId: string) {
    const memberships = await this.prisma.campaignMember.findMany({
      where: { userId },
      include: { adventure: true },
      orderBy: { joinedAt: 'desc' },
    })
    return Promise.all(
      memberships.map(async (m) => ({
        ...m.adventure,
        role: m.role,
        joinedAt: m.joinedAt,
        // Access state is derived from the GM's entitlement and cascades to every
        // member, so a player's own subscription does not affect it.
        accessState: (await this.subscriptionService.hasActiveSubscription(
          m.adventure.ownerId,
        ))
          ? 'ACTIVE'
          : 'READ_ONLY',
      })),
    )
  }

  async removeMember(adventureId: string, targetUserId: string) {
    return this.prisma.campaignMember.delete({
      where: {
        adventureId_userId: { adventureId, userId: targetUserId },
      },
    })
  }

  async updateRole(
    adventureId: string,
    userId: string,
    role: MemberRole,
  ) {
    // Prevent promoting any member to GM — a campaign can only have one GM
    if (role === 'GM') {
      throw new ForbiddenException(this.i18n.t('community.cannotPromoteToGm'))
    }
    return this.prisma.campaignMember.update({
      where: {
        adventureId_userId: { adventureId, userId },
      },
      data: { role },
    })
  }

  async isMember(adventureId: string, userId: string) {
    const member = await this.prisma.campaignMember.findUnique({
      where: { adventureId_userId: { adventureId, userId } },
    })
    return !!member
  }

  /** Count current PLAYER members in the adventure (excluding GMs). */
  async countPlayers(adventureId: string): Promise<number> {
    return this.prisma.campaignMember.count({
      where: { adventureId, role: 'PLAYER' },
    })
  }

  /** Count pending PLAYER invitations for the adventure. */
  async countPendingPlayerInvitations(adventureId: string): Promise<number> {
    return this.prisma.campaignInvitation.count({
      where: { adventureId, role: 'PLAYER', status: 'PENDING' },
    })
  }

  /** Check if adding `count` PLAYERs would exceed adventure maxPlayers. */
  async assertPlayerCapacity(adventureId: string, count: number = 1) {
    const adventure = await this.prisma.adventure.findUnique({ where: { id: adventureId } })
    if (!adventure) throw new NotFoundException(this.i18n.t('community.adventureNotFound'))

    const currentPlayers = await this.countPlayers(adventureId)
    const pendingInvites = await this.countPendingPlayerInvitations(adventureId)
    if (currentPlayers + pendingInvites + count > adventure.maxPlayers) {
      throw new ForbiddenException(this.i18n.t('community.maxPlayerCapacity'))
    }
  }
}
