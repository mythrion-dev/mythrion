jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test } from '@nestjs/testing'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { MembershipService } from './membership.service'
import { PrismaService } from '../prisma.service'
import { SubscriptionService } from '../subscription/subscription.service'
import { createMockPrismaService } from '../__mocks__/prisma-service.mock'
import { createMockSubscriptionService } from '../__mocks__/subscription-service.mock'
import { I18nService } from 'nestjs-i18n'
import { createI18nServiceMock } from '../i18n/i18n-testing.js'

describe('MembershipService', () => {
  let service: MembershipService
  let prisma: ReturnType<typeof createMockPrismaService>
  let subscription: ReturnType<typeof createMockSubscriptionService>

  beforeEach(async () => {
    prisma = createMockPrismaService()
    subscription = createMockSubscriptionService()

    const module = await Test.createTestingModule({
      providers: [
        MembershipService,
        { provide: PrismaService, useValue: prisma },
        { provide: SubscriptionService, useValue: subscription },
        { provide: I18nService, useValue: createI18nServiceMock() },
      ],
    }).compile()

    service = module.get<MembershipService>(MembershipService)

    jest.clearAllMocks()
  })

  describe('requireRole', () => {
    it('finds the campaignMember and returns it when both adventureId and userId match', async () => {
      const member = { id: 'm1', adventureId: 'a1', userId: 'u1', role: 'GM' }
      prisma.campaignMember.findUnique.mockResolvedValue(member)

      const result = await service.requireRole('a1', 'u1', 'GM')

      expect(result).toEqual(member)
      expect(prisma.campaignMember.findUnique).toHaveBeenCalledWith({
        where: { adventureId_userId: { adventureId: 'a1', userId: 'u1' } },
      })
    })

    it('throws ForbiddenException("You are not a member") when no campaignMember is found', async () => {
      prisma.campaignMember.findUnique.mockResolvedValue(null)

      await expect(service.requireRole('a1', 'u1', 'GM')).rejects.toThrow(
        ForbiddenException,
      )
      await expect(service.requireRole('a1', 'u1', 'GM')).rejects.toThrow(
        'You are not a member of this campaign',
      )
    })

    it('throws ForbiddenException("Only the GM...") when member role is PLAYER and requiredRole is GM', async () => {
      const member = { id: 'm1', adventureId: 'a1', userId: 'u1', role: 'PLAYER' }
      prisma.campaignMember.findUnique.mockResolvedValue(member)

      await expect(service.requireRole('a1', 'u1', 'GM')).rejects.toThrow(
        ForbiddenException,
      )
      await expect(service.requireRole('a1', 'u1', 'GM')).rejects.toThrow(
        'Only the Game Master can perform this action',
      )
    })
  })

  describe('createMembership', () => {
    it('calls prisma.campaignMember.create with correct data', async () => {
      const expected = { id: 'm1', adventureId: 'a1', userId: 'u1', role: 'PLAYER' }
      prisma.campaignMember.create.mockResolvedValue(expected)

      const result = await service.createMembership('a1', 'u1', 'PLAYER')

      expect(result).toEqual(expected)
      expect(prisma.campaignMember.create).toHaveBeenCalledWith({
        data: { adventureId: 'a1', userId: 'u1', role: 'PLAYER' },
      })
    })
  })

  describe('isMember', () => {
    it('returns true when a member exists', async () => {
      prisma.campaignMember.findUnique.mockResolvedValue({ id: 'm1' })

      const result = await service.isMember('a1', 'u1')

      expect(result).toBe(true)
    })

    it('returns false when not found', async () => {
      prisma.campaignMember.findUnique.mockResolvedValue(null)

      const result = await service.isMember('a1', 'u1')

      expect(result).toBe(false)
    })
  })

  describe('getMembers', () => {
    it('returns members with user include (id, email, displayName)', async () => {
      const members = [
        { id: 'm1', role: 'PLAYER', user: { id: 'u1', email: 'a@b.com', displayName: 'Alice' } },
        { id: 'm2', role: 'GM', user: { id: 'u2', email: 'c@d.com', displayName: 'Bob' } },
      ]
      prisma.campaignMember.findMany.mockResolvedValue(members)

      const result = await service.getMembers('a1')

      expect(result).toEqual(members)
      expect(prisma.campaignMember.findMany).toHaveBeenCalledWith({
        where: { adventureId: 'a1' },
        include: {
          user: {
            select: { id: true, email: true, displayName: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      })
    })
  })

  describe('getUserAdventures', () => {
    it('returns adventures the user is a member of', async () => {
      const memberships = [
        { adventure: { id: 'a1', name: 'Test Adv', ownerId: 'gm1' }, role: 'PLAYER', joinedAt: new Date('2024-01-01') },
        { adventure: { id: 'a2', name: 'My Adv', ownerId: 'u1' }, role: 'GM', joinedAt: new Date('2024-02-01') },
      ]
      prisma.campaignMember.findMany.mockResolvedValue(memberships)

      const result = await service.getUserAdventures('u1')

      expect(result).toEqual([
        { id: 'a1', name: 'Test Adv', ownerId: 'gm1', role: 'PLAYER', joinedAt: memberships[0].joinedAt, accessState: 'ACTIVE' },
        { id: 'a2', name: 'My Adv', ownerId: 'u1', role: 'GM', joinedAt: memberships[1].joinedAt, accessState: 'ACTIVE' },
      ])
      expect(subscription.hasActiveSubscription).toHaveBeenCalledWith('gm1')
      expect(subscription.hasActiveSubscription).toHaveBeenCalledWith('u1')
    })

    it('derives READ_ONLY accessState when the GM subscription is inactive', async () => {
      const memberships = [
        { adventure: { id: 'a1', name: 'Test Adv', ownerId: 'gm1' }, role: 'PLAYER', joinedAt: new Date('2024-01-01') },
      ]
      prisma.campaignMember.findMany.mockResolvedValue(memberships)
      subscription.mockHasActiveSubscription.mockResolvedValue(false)

      const result = await service.getUserAdventures('u1')

      expect(result[0].accessState).toBe('READ_ONLY')
    })
  })

  describe('countPlayers', () => {
    it('returns count of PLAYER members', async () => {
      prisma.campaignMember.count.mockResolvedValue(3)

      const result = await service.countPlayers('a1')

      expect(result).toBe(3)
      expect(prisma.campaignMember.count).toHaveBeenCalledWith({
        where: { adventureId: 'a1', role: 'PLAYER' },
      })
    })
  })

  describe('countPendingPlayerInvitations', () => {
    it('returns count of PENDING PLAYER invitations', async () => {
      prisma.campaignInvitation.count.mockResolvedValue(2)

      const result = await service.countPendingPlayerInvitations('a1')

      expect(result).toBe(2)
      expect(prisma.campaignInvitation.count).toHaveBeenCalledWith({
        where: { adventureId: 'a1', role: 'PLAYER', status: 'PENDING' },
      })
    })
  })

  describe('assertPlayerCapacity', () => {
    it('throws NotFoundException when adventure not found', async () => {
      prisma.adventure.findUnique.mockResolvedValue(null)

      await expect(service.assertPlayerCapacity('a1')).rejects.toThrow(
        NotFoundException,
      )
      await expect(service.assertPlayerCapacity('a1')).rejects.toThrow(
        'Campaign not found',
      )
    })

    it('throws ForbiddenException when current + pending + count >= maxPlayers', async () => {
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', maxPlayers: 4 })
      prisma.campaignMember.count.mockResolvedValue(3)
      prisma.campaignInvitation.count.mockResolvedValue(1)

      await expect(service.assertPlayerCapacity('a1')).rejects.toThrow(
        ForbiddenException,
      )
      await expect(service.assertPlayerCapacity('a1')).rejects.toThrow(
        'Campaign is at maximum player capacity',
      )
    })

    it('returns void when under limit', async () => {
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', maxPlayers: 10 })
      prisma.campaignMember.count.mockResolvedValue(3)
      prisma.campaignInvitation.count.mockResolvedValue(1)

      await expect(service.assertPlayerCapacity('a1')).resolves.toBeUndefined()
    })
  })

  describe('removeMember', () => {
    it('calls prisma.campaignMember.delete with composite key', async () => {
      const expected = { id: 'm1', adventureId: 'a1', userId: 'u2', role: 'PLAYER' }
      prisma.campaignMember.delete.mockResolvedValue(expected)

      const result = await service.removeMember('a1', 'u2')

      expect(result).toEqual(expected)
      expect(prisma.campaignMember.delete).toHaveBeenCalledWith({
        where: {
          adventureId_userId: { adventureId: 'a1', userId: 'u2' },
        },
      })
    })
  })

  describe('updateRole', () => {
    it('throws ForbiddenException when trying to promote to GM', async () => {
      await expect(service.updateRole('a1', 'u2', 'GM')).rejects.toThrow(
        'Cannot promote a member to Game Master',
      )
    })

    it('calls prisma.campaignMember.update with non-GM role', async () => {
      const expected = { id: 'm1', adventureId: 'a1', userId: 'u2', role: 'PLAYER' }
      prisma.campaignMember.update.mockResolvedValue(expected)

      const result = await service.updateRole('a1', 'u2', 'PLAYER')

      expect(result).toEqual(expected)
      expect(prisma.campaignMember.update).toHaveBeenCalledWith({
        where: {
          adventureId_userId: { adventureId: 'a1', userId: 'u2' },
        },
        data: { role: 'PLAYER' },
      })
    })
  })

  describe('requireWriteRole', () => {
    it('returns the member when role matches and the GM subscription is active', async () => {
      const member = { id: 'm1', adventureId: 'a1', userId: 'u1', role: 'GM' }
      prisma.campaignMember.findUnique.mockResolvedValue(member)
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', ownerId: 'gm1' })
      subscription.mockHasActiveSubscription.mockResolvedValue(true)

      const result = await service.requireWriteRole('a1', 'u1', 'GM')

      expect(result).toEqual(member)
      expect(subscription.hasActiveSubscription).toHaveBeenCalledWith('gm1')
    })

    it('throws ForbiddenException when the GM subscription is inactive', async () => {
      const member = { id: 'm1', adventureId: 'a1', userId: 'u1', role: 'GM' }
      prisma.campaignMember.findUnique.mockResolvedValue(member)
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', ownerId: 'gm1' })
      subscription.mockHasActiveSubscription.mockResolvedValue(false)

      await expect(service.requireWriteRole('a1', 'u1', 'GM')).rejects.toThrow(
        ForbiddenException,
      )
      await expect(service.requireWriteRole('a1', 'u1', 'GM')).rejects.toThrow(
        "This campaign is currently read-only because the GM's subscription is inactive.",
      )
    })

    it('throws NotFoundException when the adventure does not exist', async () => {
      const member = { id: 'm1', adventureId: 'a1', userId: 'u1', role: 'GM' }
      prisma.campaignMember.findUnique.mockResolvedValue(member)
      prisma.adventure.findUnique.mockResolvedValue(null)

      await expect(service.requireWriteRole('a1', 'u1', 'GM')).rejects.toThrow(
        NotFoundException,
      )
      expect(subscription.hasActiveSubscription).not.toHaveBeenCalled()
    })

    it('still enforces role checks before the write gate', async () => {
      const member = { id: 'm1', adventureId: 'a1', userId: 'u1', role: 'PLAYER' }
      prisma.campaignMember.findUnique.mockResolvedValue(member)

      await expect(service.requireWriteRole('a1', 'u1', 'GM')).rejects.toThrow(
        'Only the Game Master can perform this action',
      )
      expect(prisma.adventure.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('requireWriteAccess', () => {
    it('allows a member when the GM subscription is active', async () => {
      const member = { id: 'm1', adventureId: 'a1', userId: 'u1', role: 'PLAYER' }
      prisma.campaignMember.findUnique.mockResolvedValue(member)
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', ownerId: 'gm1' })
      subscription.mockHasActiveSubscription.mockResolvedValue(true)

      const result = await service.requireWriteAccess('a1', 'u1')

      expect(result).toEqual(member)
    })

    it('throws ForbiddenException for a non-member', async () => {
      prisma.campaignMember.findUnique.mockResolvedValue(null)

      await expect(service.requireWriteAccess('a1', 'u1')).rejects.toThrow(
        'You are not a member of this campaign',
      )
      expect(prisma.adventure.findUnique).not.toHaveBeenCalled()
    })

    it('throws ForbiddenException when the campaign is read-only', async () => {
      const member = { id: 'm1', adventureId: 'a1', userId: 'u1', role: 'PLAYER' }
      prisma.campaignMember.findUnique.mockResolvedValue(member)
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', ownerId: 'gm1' })
      subscription.mockHasActiveSubscription.mockResolvedValue(false)

      await expect(service.requireWriteAccess('a1', 'u1')).rejects.toThrow(
        "This campaign is currently read-only because the GM's subscription is inactive.",
      )
    })
  })

  describe('getAccessState', () => {
    it('returns ACTIVE when the GM subscription is active', async () => {
      prisma.campaignMember.findUnique.mockResolvedValue({
        id: 'm1', adventureId: 'a1', userId: 'u1', role: 'PLAYER',
      })
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', ownerId: 'gm1' })
      subscription.mockHasActiveSubscription.mockResolvedValue(true)

      await expect(service.getAccessState('a1', 'u1')).resolves.toBe('ACTIVE')
    })

    it('returns READ_ONLY when the GM subscription is inactive', async () => {
      prisma.campaignMember.findUnique.mockResolvedValue({
        id: 'm1', adventureId: 'a1', userId: 'u1', role: 'PLAYER',
      })
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', ownerId: 'gm1' })
      subscription.mockHasActiveSubscription.mockResolvedValue(false)

      await expect(service.getAccessState('a1', 'u1')).resolves.toBe('READ_ONLY')
    })

    it('throws ForbiddenException for a non-member', async () => {
      prisma.campaignMember.findUnique.mockResolvedValue(null)

      await expect(service.getAccessState('a1', 'u1')).rejects.toThrow(
        'You are not a member of this campaign',
      )
    })
  })
})
