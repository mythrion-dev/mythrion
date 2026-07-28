import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { MembershipService } from '../membership/membership.service.js'

@Injectable()
export class JoinRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  /**
   * Create a join request for a public adventure.
   * - Adventure must exist and be public
   * - User must not already be a member
   * - User must not have a pending request
   */
  async create(adventureId: string, userId: string, message?: string) {
    const adventure = await this.prisma.adventure.findUnique({ where: { id: adventureId } })
    if (!adventure) throw new NotFoundException('Adventure not found')
    if (!adventure.isPublic) throw new ForbiddenException('Adventure is not public')

    const isMember = await this.membership.isMember(adventureId, userId)
    if (isMember) throw new ConflictException('You are already a member of this adventure')

    const existing = await this.prisma.joinRequest.findUnique({
      where: { adventureId_userId: { adventureId, userId } },
    })
    if (existing && existing.status === 'PENDING') {
      throw new ConflictException('You already have a pending request for this adventure')
    }
    if (existing && existing.status === 'ACCEPTED') {
      throw new ConflictException('You have already been accepted to this adventure')
    }

    // If previously rejected, allow re-requesting: update the existing record
    if (existing && existing.status === 'REJECTED') {
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
      where: { adventureId },
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
    await this.membership.requireRole(adventureId, userId, 'GM')

    const request = await this.prisma.joinRequest.findUnique({ where: { id: requestId } })
    if (!request) throw new NotFoundException('Join request not found')
    if (request.adventureId !== adventureId) throw new ForbiddenException('Request does not belong to this adventure')
    if (request.status !== 'PENDING') throw new ConflictException('Request is not pending')

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
    await this.membership.requireRole(adventureId, userId, 'GM')

    const request = await this.prisma.joinRequest.findUnique({ where: { id: requestId } })
    if (!request) throw new NotFoundException('Join request not found')
    if (request.adventureId !== adventureId) throw new ForbiddenException('Request does not belong to this adventure')
    if (request.status !== 'PENDING') throw new ConflictException('Request is not pending')

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
