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
import { I18nService } from 'nestjs-i18n'
import { createI18nServiceMock } from '../i18n/i18n-testing.js'

const mockMembershipService = {
  requireRole: jest.fn(),
  requireWriteRole: jest.fn(),
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

    // Default: requireRole / requireWriteRole resolve successfully
    mockMembershipService.requireRole.mockResolvedValue({ role: 'GM' })
    mockMembershipService.requireWriteRole.mockResolvedValue({ role: 'GM' })

    const module = await Test.createTestingModule({
      providers: [
        InvitationService,
        { provide: PrismaService, useValue: prisma },
        { provide: MembershipService, useValue: mockMembershipService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: I18nService, useValue: createI18nServiceMock() },
      ],
    }).compile()

    service = module.get<InvitationService>(InvitationService)
  })

  describe('inviteByEmail', () => {
    const params = {
      adventureId: 'a1',
      invitedEmail: 'player@test.com',
      createdById: 'gm1',
    }

    it('requires GM role', async () => {
      mockMembershipService.requireRole.mockResolvedValue({ role: 'GM' })

      // Stub remaining calls for a clean run
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', name: 'Test Adventure' })
      prisma.campaignInvitation.create.mockResolvedValue({ id: 'inv1' })
      prisma.user.findUnique.mockResolvedValue({ id: 'gm1', displayName: 'GM', email: 'gm@test.com' })

      await service.inviteByEmail(params)

      expect(mockMembershipService.requireWriteRole).toHaveBeenCalledWith('a1', 'gm1', 'GM')
    })

    it('throws NotFoundException when adventure does not exist', async () => {
      prisma.adventure.findUnique.mockResolvedValue(null)

      await expect(service.inviteByEmail(params)).rejects.toThrow(NotFoundException)
      await expect(service.inviteByEmail(params)).rejects.toThrow('Campaign not found')
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

    it('falls back to email when inviter has no displayName', async () => {
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', name: 'Test Adventure' })
      prisma.campaignInvitation.create.mockResolvedValue({ id: 'inv1', token: 't' })
      prisma.user.findUnique.mockResolvedValue({
        id: 'gm1',
        displayName: null,
        email: 'gm@test.com',
      })

      await service.inviteByEmail(params)

      expect(mockEmailService.sendInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ inviterName: 'gm@test.com' }),
      )
    })

    it('falls back to "Someone" when inviter user is not found', async () => {
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', name: 'Test Adventure' })
      prisma.campaignInvitation.create.mockResolvedValue({ id: 'inv1', token: 't' })
      prisma.user.findUnique.mockResolvedValue(null)

      await service.inviteByEmail(params)

      expect(mockEmailService.sendInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ inviterName: 'Someone' }),
      )
    })

    it('rolls back the invitation and throws BadRequestException when email fails', async () => {
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', name: 'Test Adventure' })
      prisma.campaignInvitation.create.mockResolvedValue({ id: 'inv1', token: 't' })
      prisma.user.findUnique.mockResolvedValue({
        id: 'gm1',
        displayName: 'Mighty GM',
        email: 'gm@test.com',
      })
      mockEmailService.sendInvitation.mockRejectedValue(
        new Error('Hostinger Mail API error (HTTP 422)'),
      )

      await expect(service.inviteByEmail(params)).rejects.toThrow(BadRequestException)
      await expect(service.inviteByEmail(params)).rejects.toThrow(
        'Failed to send invitation email: Hostinger Mail API error (HTTP 422)',
      )

      expect(prisma.campaignInvitation.delete).toHaveBeenCalledWith({
        where: { id: 'inv1' },
      })
    })
  })

  describe('inviteByLink', () => {
    const params = { adventureId: 'a1', createdById: 'gm1' }

    it('requires GM role', async () => {
      prisma.campaignInvitation.create.mockResolvedValue({ token: 'some-token' })

      await service.inviteByLink(params)

      expect(mockMembershipService.requireWriteRole).toHaveBeenCalledWith('a1', 'gm1', 'GM')
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

  describe('origin handling', () => {
    const emailParams = {
      adventureId: 'a1',
      invitedEmail: 'player@test.com',
      createdById: 'gm1',
    }
    const linkParams = { adventureId: 'a1', createdById: 'gm1' }
    const originalAllowedOrigins = process.env.ALLOWED_ORIGINS

    // An earlier test leaves sendInvitation mocked to reject; restore the
    // success default so these tests reach the URL assertion.
    beforeEach(() => {
      mockEmailService.sendInvitation.mockResolvedValue(undefined)
    })

    afterEach(() => {
      if (originalAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS
      else process.env.ALLOWED_ORIGINS = originalAllowedOrigins
    })

    it('inviteByEmail uses an allowed origin for the invite URL', async () => {
      process.env.ALLOWED_ORIGINS = 'https://mythrion.com.br,https://mythrion.online'
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', name: 'Test Adventure' })
      prisma.campaignInvitation.create.mockResolvedValue({ id: 'inv1', token: 't' })
      prisma.user.findUnique.mockResolvedValue({
        id: 'gm1',
        displayName: 'GM',
        email: 'gm@test.com',
      })

      await service.inviteByEmail({ ...emailParams, origin: 'https://mythrion.com.br' })

      expect(mockEmailService.sendInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          inviteUrl: 'https://mythrion.com.br/invite/mock-uuid',
        }),
      )
    })

    it('inviteByEmail falls back to the default URL for a disallowed origin', async () => {
      process.env.ALLOWED_ORIGINS = 'https://mythrion.com.br'
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', name: 'Test Adventure' })
      prisma.campaignInvitation.create.mockResolvedValue({ id: 'inv1', token: 't' })
      prisma.user.findUnique.mockResolvedValue({
        id: 'gm1',
        displayName: 'GM',
        email: 'gm@test.com',
      })

      await service.inviteByEmail({ ...emailParams, origin: 'https://evil.example.com' })

      // FRONTEND_URL is unset in the test env, so the fallback is the local default.
      expect(mockEmailService.sendInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          inviteUrl: 'http://localhost:3001/invite/mock-uuid',
        }),
      )
    })

    it('inviteByLink uses an allowed origin for the invite URL', async () => {
      process.env.ALLOWED_ORIGINS = 'https://mythrion.online'
      prisma.campaignInvitation.create.mockResolvedValue({ token: 't' })

      const result = await service.inviteByLink({
        ...linkParams,
        origin: 'https://mythrion.online',
      })

      expect(result.inviteUrl).toBe('https://mythrion.online/invite/mock-uuid')
    })

    it('inviteByLink falls back to the default URL when no origin is present', async () => {
      prisma.campaignInvitation.create.mockResolvedValue({ token: 't' })

      const result = await service.inviteByLink(linkParams)

      // FRONTEND_URL is unset in the test env, so the fallback is the local default.
      expect(result.inviteUrl).toBe('http://localhost:3001/invite/mock-uuid')
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

      // invitedBy should use displayName
      expect(result).toHaveProperty('invitedBy', 'GM')
    })

    it('falls back to email when createdBy has no displayName', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue({
        ...baseInvitation,
        status: 'REVOKED',
        createdBy: { id: 'gm1', displayName: null, email: 'gm@test.com' },
      })

      const result = await service.validate('tok1')

      expect(result).toHaveProperty('invitedBy', 'gm@test.com')
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

    it('returns Unknown adventure name when already member but adventure lookup returns null', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue(pendingInvitation)
      prisma.adventure.findUnique.mockResolvedValue(null)
      mockMembershipService.isMember.mockResolvedValue(true)

      const result = await service.accept('tok1', 'u1')

      expect(result).toEqual({
        success: true,
        alreadyMember: true,
        adventureId: 'a1',
        adventureName: 'Unknown',
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

    it('throws BadRequestException when player capacity is exceeded', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue(pendingInvitation)
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', name: 'Test Adv', maxPlayers: 3 })
      mockMembershipService.isMember.mockResolvedValue(false)
      mockMembershipService.countPlayers.mockResolvedValue(3) // already at max

      await expect(service.accept('tok1', 'u1')).rejects.toThrow(BadRequestException)
      await expect(service.accept('tok1', 'u1')).rejects.toThrow(
        'Campaign is at maximum player capacity',
      )
    })

    it('throws NotFoundException when invitation not found', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue(null)

      await expect(service.accept('bad-token', 'u1')).rejects.toThrow(NotFoundException)
      await expect(service.accept('bad-token', 'u1')).rejects.toThrow('Invitation not found')
    })
  })

  describe('revoke', () => {
    it('requires GM role', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue({
        id: 'inv1',
        adventureId: 'a1',
      })

      await service.revoke('inv1', 'gm1')

      expect(mockMembershipService.requireWriteRole).toHaveBeenCalledWith('a1', 'gm1', 'GM')
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

    it('throws NotFoundException when invitation does not exist', async () => {
      prisma.campaignInvitation.findUnique.mockResolvedValue(null)

      await expect(service.revoke('nonexistent', 'gm1')).rejects.toThrow(NotFoundException)
      await expect(service.revoke('nonexistent', 'gm1')).rejects.toThrow('Invitation not found')
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
