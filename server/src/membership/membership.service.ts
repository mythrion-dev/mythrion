import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common'
import { I18nService } from 'nestjs-i18n'
import { PrismaService } from '../prisma.service.js'
import { MemberRole } from '../generated/prisma/client.js'

@Injectable()
export class MembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
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
    return memberships.map((m) => ({
      ...m.adventure,
      role: m.role,
      joinedAt: m.joinedAt,
    }))
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
