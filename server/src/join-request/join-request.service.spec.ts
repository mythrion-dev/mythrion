jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test } from '@nestjs/testing'
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common'
import { JoinRequestService } from './join-request.service'
import { PrismaService } from '../prisma.service'
import { MembershipService } from '../membership/membership.service'
import { createMockPrismaService } from '../__mocks__/prisma-service.mock'
import { I18nService } from 'nestjs-i18n'
import { createI18nServiceMock } from '../i18n/i18n-testing.js'

const mockMembershipService = {
  requireRole: jest.fn(),
  requireWriteRole: jest.fn(),
  isMember: jest.fn(),
  assertPlayerCapacity: jest.fn(),
}

describe('JoinRequestService', () => {
  let service: JoinRequestService
  let prisma: ReturnType<typeof createMockPrismaService>

  beforeEach(async () => {
    prisma = createMockPrismaService()
    jest.clearAllMocks()

    mockMembershipService.requireRole.mockResolvedValue(undefined)
    mockMembershipService.requireWriteRole.mockResolvedValue(undefined)
    mockMembershipService.isMember.mockResolvedValue(false)
    mockMembershipService.assertPlayerCapacity.mockResolvedValue(undefined)

    const module = await Test.createTestingModule({
      providers: [
        JoinRequestService,
        { provide: PrismaService, useValue: prisma },
        { provide: MembershipService, useValue: mockMembershipService },
        { provide: I18nService, useValue: createI18nServiceMock() },
      ],
    }).compile()

    service = module.get<JoinRequestService>(JoinRequestService)
  })

  describe('create', () => {
    const baseAdventure = {
      id: 'adv-1',
      name: 'Test Adventure',
      isPublic: true,
    } as any

    it('creates a join request for a public adventure', async () => {
      prisma.adventure.findUnique.mockResolvedValue(baseAdventure)
      prisma.joinRequest.findUnique.mockResolvedValue(null)
      prisma.joinRequest.create.mockResolvedValue({
        id: 'jr-1',
        adventureId: 'adv-1',
        userId: 'u1',
        status: 'PENDING',
        message: 'Please let me join!',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: 'u1', email: 'test@test.com', displayName: 'Test User' },
        adventure: { id: 'adv-1', name: 'Test Adventure', campaign: 'Camp' },
      })

      const result = await service.create('adv-1', 'u1', 'Please let me join!')

      expect(result.status).toBe('PENDING')
      expect(prisma.joinRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adventureId: 'adv-1',
            userId: 'u1',
            message: 'Please let me join!',
          }),
        }),
      )
    })

    it('throws NotFoundException when adventure does not exist', async () => {
      prisma.adventure.findUnique.mockResolvedValue(null)

      await expect(service.create('nonexistent', 'u1')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws ForbiddenException when adventure is not public', async () => {
      prisma.adventure.findUnique.mockResolvedValue({
        ...baseAdventure,
        isPublic: false,
      })

      await expect(service.create('adv-1', 'u1')).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('throws ConflictException when user is already a member', async () => {
      prisma.adventure.findUnique.mockResolvedValue(baseAdventure)
      mockMembershipService.isMember.mockResolvedValue(true)

      await expect(service.create('adv-1', 'u1')).rejects.toThrow(
        ConflictException,
      )
    })

    it('throws ConflictException when user already has a pending request', async () => {
      prisma.adventure.findUnique.mockResolvedValue(baseAdventure)
      prisma.joinRequest.findUnique.mockResolvedValue({
        id: 'jr-1',
        adventureId: 'adv-1',
        userId: 'u1',
        status: 'PENDING',
      })

      await expect(service.create('adv-1', 'u1')).rejects.toThrow(
        ConflictException,
      )
    })

    it('re-activates a previously accepted request when the player is no longer a member', async () => {
      prisma.adventure.findUnique.mockResolvedValue(baseAdventure)
      mockMembershipService.isMember.mockResolvedValue(false)
      prisma.joinRequest.findUnique.mockResolvedValue({
        id: 'jr-1',
        adventureId: 'adv-1',
        userId: 'u1',
        status: 'ACCEPTED',
        message: null,
      })
      prisma.joinRequest.update.mockResolvedValue({
        id: 'jr-1',
        adventureId: 'adv-1',
        userId: 'u1',
        status: 'PENDING',
        message: 'Let me in again!',
      })

      const result = await service.create('adv-1', 'u1', 'Let me in again!')

      expect(result.status).toBe('PENDING')
      expect(prisma.joinRequest.update).toHaveBeenCalledWith({
        where: { id: 'jr-1' },
        data: { status: 'PENDING', message: 'Let me in again!' },
      })
    })

    it('re-activates a previously rejected request', async () => {
      prisma.adventure.findUnique.mockResolvedValue(baseAdventure)
      prisma.joinRequest.findUnique.mockResolvedValue({
        id: 'jr-1',
        adventureId: 'adv-1',
        userId: 'u1',
        status: 'REJECTED',
        message: null,
      })
      prisma.joinRequest.update.mockResolvedValue({
        id: 'jr-1',
        adventureId: 'adv-1',
        userId: 'u1',
        status: 'PENDING',
        message: 'Let me try again!',
      })

      const result = await service.create('adv-1', 'u1', 'Let me try again!')

      expect(result.status).toBe('PENDING')
      expect(prisma.joinRequest.update).toHaveBeenCalledWith({
        where: { id: 'jr-1' },
        data: { status: 'PENDING', message: 'Let me try again!' },
      })
    })
  })

  describe('findByAdventure', () => {
    it('requires GM role and returns join requests', async () => {
      const requests = [
        {
          id: 'jr-1',
          adventureId: 'adv-1',
          userId: 'u2',
          status: 'PENDING',
          createdAt: new Date(),
          user: { id: 'u2', email: 'player@test.com', displayName: 'Player' },
        },
      ]
      prisma.joinRequest.findMany.mockResolvedValue(requests)

      const result = await service.findByAdventure('adv-1', 'u1')

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith(
        'adv-1',
        'u1',
        'GM',
      )
      expect(result).toEqual(requests)
      expect(prisma.joinRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { adventureId: 'adv-1', status: 'PENDING' },
        }),
      )
    })
  })

  describe('accept', () => {
    it('accepts a pending join request, creates membership', async () => {
      const request = {
        id: 'jr-1',
        adventureId: 'adv-1',
        userId: 'u2',
        status: 'PENDING',
      }
      prisma.joinRequest.findUnique.mockResolvedValue(request)
      prisma.$transaction.mockResolvedValue([
        { id: 'cm-1', adventureId: 'adv-1', userId: 'u2', role: 'PLAYER' },
        { ...request, status: 'ACCEPTED' },
      ])

      const result = await service.accept('adv-1', 'jr-1', 'u1')

      expect(mockMembershipService.requireWriteRole).toHaveBeenCalledWith(
        'adv-1',
        'u1',
        'GM',
      )
      expect(mockMembershipService.assertPlayerCapacity).toHaveBeenCalledWith(
        'adv-1',
        1,
      )
      expect(result.membership).toBeDefined()
      expect(result.request.status).toBe('ACCEPTED')
    })

    it('throws NotFoundException when request not found', async () => {
      prisma.joinRequest.findUnique.mockResolvedValue(null)

      await expect(
        service.accept('adv-1', 'nonexistent', 'u1'),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws ForbiddenException when request belongs to different adventure', async () => {
      prisma.joinRequest.findUnique.mockResolvedValue({
        id: 'jr-1',
        adventureId: 'other-adv',
        status: 'PENDING',
      })

      await expect(
        service.accept('adv-1', 'jr-1', 'u1'),
      ).rejects.toThrow(ForbiddenException)
    })

    it('throws ConflictException when request is not pending', async () => {
      prisma.joinRequest.findUnique.mockResolvedValue({
        id: 'jr-1',
        adventureId: 'adv-1',
        status: 'ACCEPTED',
      })

      await expect(
        service.accept('adv-1', 'jr-1', 'u1'),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('reject', () => {
    it('rejects a pending join request', async () => {
      const request = {
        id: 'jr-1',
        adventureId: 'adv-1',
        userId: 'u2',
        status: 'PENDING',
      }
      prisma.joinRequest.findUnique.mockResolvedValue(request)
      prisma.joinRequest.update.mockResolvedValue({
        ...request,
        status: 'REJECTED',
      })

      const result = await service.reject('adv-1', 'jr-1', 'u1')

      expect(mockMembershipService.requireWriteRole).toHaveBeenCalledWith(
        'adv-1',
        'u1',
        'GM',
      )
      expect(result.status).toBe('REJECTED')
    })

    it('throws NotFoundException when request not found', async () => {
      prisma.joinRequest.findUnique.mockResolvedValue(null)

      await expect(
        service.reject('adv-1', 'nonexistent', 'u1'),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('findMyRequests', () => {
    it('returns join requests for the user', async () => {
      const requests = [
        {
          id: 'jr-1',
          adventureId: 'adv-1',
          userId: 'u1',
          status: 'PENDING',
          createdAt: new Date(),
          adventure: {
            id: 'adv-1',
            name: 'Test Adventure',
            campaign: 'Camp',
            synopsis: 'Fun!',
            isPublic: true,
          },
        },
      ]
      prisma.joinRequest.findMany.mockResolvedValue(requests)

      const result = await service.findMyRequests('u1')

      expect(prisma.joinRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1' },
        }),
      )
      expect(result).toEqual(requests)
    })
  })
})
