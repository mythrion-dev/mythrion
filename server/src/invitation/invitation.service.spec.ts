jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
import { Test } from '@nestjs/testing'
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { InvitationService } from './invitation.service'
import { PrismaService } from '../prisma.service'
import { MembershipService } from '../membership/membership.service'
import { EmailService } from '../email/email.service'
import { createMockPrismaService } from '../__mocks__/prisma-service.mock'

const mockMembershipService = {
  requireRole: jest.fn(),
  assertPlayerCapacity: jest.fn(),
  isMember: jest.fn(),
  createMembership: jest.fn().mockResolvedValue({}),
  countPlayers: jest.fn(),
}

const mockEmailService = {
  sendInvitation: jest.fn().mockResolvedValue(undefined),
}

describe('InvitationService', () => {
  let service: InvitationService
  let prisma: ReturnType<typeof createMockPrismaService>

  beforeEach(async () => {
    prisma = createMockPrismaService()
    jest.clearAllMocks()

    // Default: requireRole resolves successfully
    mockMembershipService.requireRole.mockResolvedValue({ role: 'GM' })

    const module = await Test.createTestingModule({
      providers: [
        InvitationService,
        { provide: PrismaService, useValue: prisma },
        { provide: MembershipService, useValue: mockMembershipService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile()

    service = module.get<InvitationService>(InvitationService)
  })

  describe('inviteByEmail', () => {
    const params = {
      adventureId: 'a1',
      invitedEmail: 'player@test.com',
      role: 'PLAYER' as const,
      createdById: 'gm1',
    }

    it('requires GM role', async () => {
      mockMembershipService.requireRole.mockResolvedValue({ role: 'GM' })

      // Stub remaining calls for a clean run
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', name: 'Test Adventure' })
      prisma.campaignInvitation.create.mockResolvedValue({ id: 'inv1' })
      prisma.user.findUnique.mockResolvedValue({ id: 'gm1', displayName: 'GM', email: 'gm@test.com' })

      await service.inviteByEmail(params)

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith('a1', 'gm1', 'GM')
    })

    it('throws NotFoundException when adventure does not exist', async () => {
      prisma.adventure.findUnique.mockResolvedValue(null)

      await expect(service.inviteByEmail(params)).rejects.toThrow(NotFoundException)
      await expect(service.inviteByEmail(params)).rejects.toThrow('Adventure not found')
    })

    it('calls emailService.sendInvitation with correct data', async () => {
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', name: 'Test Adventure' })
      const createdInvitation = {
        id: 'inv1',
        token: 'abc-123',
        expiresAt: new Date('2025-01-01'),
      }
      prisma.campaignInvitation.create.mockResolvedValue(createdInvitation)
      prisma.user.findUnique.mockResolvedValue({
        id: 'gm1',
        displayName: 'Mighty GM',
        email: 'gm@test.com',
      })

      await service.inviteByEmail(params)

      expect(mockEmailService.sendInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'player@test.com',
          campaignName: 'Test Adventure',
          inviterName: 'Mighty GM',
          role: 'PLAYER',
          inviteUrl: expect.stringContaining('/invite/mock-uuid'),
          expiresAt: createdInvitation.expiresAt,
        }),
      )
    })

    it('checks player capacity for PLAYER invites', async () => {
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', name: 'Test' })
      prisma.campaignInvitation.create.mockResolvedValue({ id: 'inv1', token: 't' })
      prisma.user.findUnique.mockResolvedValue({ id: 'gm1', displayName: 'GM', email: 'gm@test.com' })

      await service.inviteByEmail(params)

      expect(mockMembershipService.assertPlayerCapacity).toHaveBeenCalledWith('a1')
    })
  })

  describe('inviteByLink', () => {
    const params = { adventureId: 'a1', role: 'PLAYER' as const, createdById: 'gm1' }

    it('requires GM role', async () => {
      prisma.campaignInvitation.create.mockResolvedValue({ token: 'some-token' })

      await service.inviteByLink(params)

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith('a1', 'gm1', 'GM')
    })

    it('returns { inviteUrl }', async () => {
      prisma.campaignInvitation.create.mockResolvedValue({ token: 'link-token-123' })

      const result = await service.inviteByLink(params)

      expect(result).toHaveProperty('inviteUrl')
      expect(result.inviteUrl).toContain('/invite/mock-uuid')
    })

    it('checks player capacity for PLAYER invites', async () => {
      prisma.campaignInvitation.create.mockResolvedValue({ token: 't' })

      await service.inviteByLink(params)

      expect(mockMembershipService.assertPlayerCapacity).toHaveBeenCalledWith('a1')
    })
  })

  describe('validate', () => {
    const baseInvitation = {
      id: 'inv1',
      token: 'tok1',
      role: 'PLAYER',
      expiresAt: new Date(Date.now() + 86400000), // tomorrow
      adventure: { name: 'Test Adv', campaign: 'Camp', synopsis: 'Fun' },
      createdBy: { id: 'gm1', displayName: 'GM', email: 'gm@test.com' },
    }

    it('returns full invitation details when PENDING', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue({
        ...baseInvitation,
        status: 'PENDING',
      })

      const result = await service.validate('tok1')

      expect(result.isValid).toBe(true)
      expect(result.status).toBe('PENDING')
      expect(result).toHaveProperty('campaignName', 'Test Adv')
      expect(result).toHaveProperty('campaign', 'Camp')
      expect(result).toHaveProperty('synopsis', 'Fun')
      expect(result).toHaveProperty('invitedBy', 'GM')
    })

    it('returns auto-expired message and updates status when past expiresAt', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue({
        ...baseInvitation,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 86400000), // yesterday
      })
      prisma.campaignInvitation.update.mockResolvedValue({
        ...baseInvitation,
        status: 'EXPIRED',
      })

      const result = await service.validate('tok1')

      expect(result.status).toBe('EXPIRED')
      expect(result.isValid).toBe(false)
      expect(result).toHaveProperty('campaignName', 'Test Adv')
      expect(prisma.campaignInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: { status: 'EXPIRED' },
      })
    })

    it('returns already used message when ACCEPTED', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue({
        ...baseInvitation,
        status: 'ACCEPTED',
      })

      const result = await service.validate('tok1')

      expect(result.status).toBe('ACCEPTED')
      expect(result.isValid).toBe(false)
    })

    it('returns revoked message when REVOKED', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue({
        ...baseInvitation,
        status: 'REVOKED',
      })

      const result = await service.validate('tok1')

      expect(result.status).toBe('REVOKED')
      expect(result.isValid).toBe(false)
    })

    it('throws NotFoundException when invitation not found', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue(null)

      await expect(service.validate('bad-token')).rejects.toThrow(NotFoundException)
      await expect(service.validate('bad-token')).rejects.toThrow('Invitation not found')
    })
  })

  describe('accept', () => {
    const pendingInvitation = {
      id: 'inv1',
      token: 'tok1',
      adventureId: 'a1',
      role: 'PLAYER',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86400000),
    }

    it('creates membership with PLAYER role', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue(pendingInvitation)
      prisma.campaignInvitation.update.mockResolvedValue({ ...pendingInvitation, status: 'ACCEPTED' })
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', name: 'Test Adv' })
      mockMembershipService.isMember.mockResolvedValue(false)
      mockMembershipService.createMembership.mockResolvedValue({})

      const result = await service.accept('tok1', 'u1')

      expect(mockMembershipService.createMembership).toHaveBeenCalledWith('a1', 'u1', 'PLAYER')
      expect(result.success).toBe(true)
      expect(result.role).toBe('PLAYER')
    })

    it('marks invitation as ACCEPTED', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue(pendingInvitation)
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', name: 'Test Adv' })
      mockMembershipService.isMember.mockResolvedValue(false)
      mockMembershipService.createMembership.mockResolvedValue({})
      prisma.campaignInvitation.update.mockResolvedValue({ ...pendingInvitation, status: 'ACCEPTED' })

      await service.accept('tok1', 'u1')

      expect(prisma.campaignInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: { status: 'ACCEPTED', acceptedAt: expect.any(Date) },
      })
    })

    it('returns already accepted message when already member', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue(pendingInvitation)
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', name: 'Test Adv' })
      mockMembershipService.isMember.mockResolvedValue(true)

      const result = await service.accept('tok1', 'u1')

      expect(result).toEqual({
        success: true,
        alreadyMember: true,
        adventureId: 'a1',
        adventureName: 'Test Adv',
        role: 'PLAYER',
      })
    })

    it('throws BadRequestException for ACCEPTED status', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue({
        ...pendingInvitation,
        status: 'ACCEPTED',
      })

      await expect(service.accept('tok1', 'u1')).rejects.toThrow(BadRequestException)
      await expect(service.accept('tok1', 'u1')).rejects.toThrow('Invitation already accepted')
    })

    it('throws BadRequestException for REVOKED status', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue({
        ...pendingInvitation,
        status: 'REVOKED',
      })

      await expect(service.accept('tok1', 'u1')).rejects.toThrow(BadRequestException)
      await expect(service.accept('tok1', 'u1')).rejects.toThrow('Invitation has been revoked')
    })

    it('throws BadRequestException for EXPIRED status (past expiresAt)', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue({
        ...pendingInvitation,
        expiresAt: new Date(Date.now() - 86400000),
      })

      await expect(service.accept('tok1', 'u1')).rejects.toThrow(BadRequestException)
      await expect(service.accept('tok1', 'u1')).rejects.toThrow('Invitation has expired')
    })

    it('calls assertPlayerCapacity for PLAYER invitations', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue(pendingInvitation)
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', name: 'Test Adv', maxPlayers: 10 })
      mockMembershipService.isMember.mockResolvedValue(false)
      mockMembershipService.createMembership.mockResolvedValue({})
      mockMembershipService.countPlayers.mockResolvedValue(2)

      await service.accept('tok1', 'u1')

      expect(mockMembershipService.countPlayers).toHaveBeenCalledWith('a1')
    })
  })

  describe('revoke', () => {
    it('requires GM role', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue({
        id: 'inv1',
        adventureId: 'a1',
      })

      await service.revoke('inv1', 'gm1')

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith('a1', 'gm1', 'GM')
    })

    it('calls update with status=REVOKED', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue({
        id: 'inv1',
        adventureId: 'a1',
      })
      prisma.campaignInvitation.update.mockResolvedValue({
        id: 'inv1',
        status: 'REVOKED',
      })

      const result = await service.revoke('inv1', 'gm1')

      expect(prisma.campaignInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: { status: 'REVOKED' },
      })
      expect(result.status).toBe('REVOKED')
    })
  })

  describe('listForAdventure', () => {
    it('requires GM role', async () => {
      prisma.campaignInvitation.findMany.mockResolvedValue([])

      await service.listForAdventure('a1', 'gm1')

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith('a1', 'gm1', 'GM')
    })

    it('returns PENDING invitations with createdBy include', async () => {
      const invitations = [
        {
          id: 'inv1',
          token: 't1',
          status: 'PENDING',
          createdBy: { id: 'gm1', displayName: 'GM', email: 'gm@test.com' },
        },
      ]
      prisma.campaignInvitation.findMany.mockResolvedValue(invitations)

      const result = await service.listForAdventure('a1', 'gm1')

      expect(result).toEqual(invitations)
      expect(prisma.campaignInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { adventureId: 'a1', status: 'PENDING' },
          include: {
            createdBy: { select: { id: true, displayName: true, email: true } },
          },
        }),
      )
    })
  })
})
