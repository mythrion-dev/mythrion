import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common'
import { I18nService } from 'nestjs-i18n'
import { PrismaService } from '../prisma.service.js'
import { MembershipService } from '../membership/membership.service.js'

@Injectable()
export class JoinRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Create a join request for a public adventure.
   * - Adventure must exist and be public
   * - User must not already be a member
   * - User must not have a pending request
   * - A REJECTED request, or an ACCEPTED one whose membership has since been
   *   removed (the player left the campaign or was removed), can be re-requested
   *   by moving it back to PENDING.
   */
  async create(adventureId: string, userId: string, message?: string) {
    const adventure = await this.prisma.adventure.findUnique({ where: { id: adventureId } })
    if (!adventure) throw new NotFoundException(this.i18n.t('community.adventureNotFound'))
    if (!adventure.isPublic) throw new ForbiddenException(this.i18n.t('community.adventureNotPublic'))

    const isMember = await this.membership.isMember(adventureId, userId)
    if (isMember) throw new ConflictException(this.i18n.t('community.alreadyMember'))

    const existing = await this.prisma.joinRequest.findUnique({
      where: { adventureId_userId: { adventureId, userId } },
    })
    if (existing?.status === 'PENDING') {
      throw new ConflictException(this.i18n.t('community.alreadyPending'))
    }

    // If previously rejected, or previously accepted but the user is no longer
    // a member (the player left or was removed), allow re-requesting: update
    // the existing record back to PENDING.
    if (existing?.status === 'REJECTED' || existing?.status === 'ACCEPTED') {
      return this.prisma.joinRequest.update({
        where: { id: existing.id },
        data: { status: 'PENDING', message: message ?? null },
      })
    }

    return this.prisma.joinRequest.create({
      data: { adventureId, userId, message: message ?? null },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        adventure: { select: { id: true, name: true, campaign: true } },
      },
    })
  }

  /**
   * List all join requests for an adventure (GM only).
   */
  async findByAdventure(adventureId: string, userId: string) {
    await this.membership.requireRole(adventureId, userId, 'GM')

    return this.prisma.joinRequest.findMany({
      where: { adventureId, status: 'PENDING' },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Accept a join request: create a CampaignMember with PLAYER role and mark request as ACCEPTED.
   * GM only. Checks capacity before accepting.
   */
  async accept(adventureId: string, requestId: string, userId: string) {
    await this.membership.requireWriteRole(adventureId, userId, 'GM')

    const request = await this.prisma.joinRequest.findUnique({ where: { id: requestId } })
    if (!request) throw new NotFoundException(this.i18n.t('community.joinRequestNotFound'))
    if (request.adventureId !== adventureId) throw new ForbiddenException(this.i18n.t('community.requestNotBelong'))
    if (request.status !== 'PENDING') throw new ConflictException(this.i18n.t('community.requestNotPending'))

    // Check capacity
    await this.membership.assertPlayerCapacity(adventureId, 1)

    // Create membership and update request in a transaction
    const [membership] = await this.prisma.$transaction([
      this.prisma.campaignMember.create({
        data: { adventureId, userId: request.userId, role: 'PLAYER' },
      }),
      this.prisma.joinRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      }),
    ])
    const updatedRequest = { ...request, status: 'ACCEPTED' as const }

    return { membership, request: updatedRequest }
  }

  /**
   * Reject a join request.
   * GM only.
   */
  async reject(adventureId: string, requestId: string, userId: string) {
    await this.membership.requireWriteRole(adventureId, userId, 'GM')

    const request = await this.prisma.joinRequest.findUnique({ where: { id: requestId } })
    if (!request) throw new NotFoundException(this.i18n.t('community.joinRequestNotFound'))
    if (request.adventureId !== adventureId) throw new ForbiddenException(this.i18n.t('community.requestNotBelong'))
    if (request.status !== 'PENDING') throw new ConflictException(this.i18n.t('community.requestNotPending'))

    return this.prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' },
    })
  }

  /**
   * Get all join requests made by a specific user.
   */
  async findMyRequests(userId: string) {
    return this.prisma.joinRequest.findMany({
      where: { userId },
      include: {
        adventure: {
          select: { id: true, name: true, campaign: true, synopsis: true, isPublic: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }
}
