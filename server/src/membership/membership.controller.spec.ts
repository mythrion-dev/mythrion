jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
jest.mock('geoip-lite', () => ({ lookup: jest.fn() }))

import { Test, TestingModule } from '@nestjs/testing'
import { ForbiddenException } from '@nestjs/common'
import { MembershipController } from './membership.controller.js'
import { MembershipService } from './membership.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import type { AuthenticatedRequest } from '../auth/AuthenticatedRequest.js'

describe('MembershipController', () => {
  let controller: MembershipController
  let mockMembershipService: Record<string, jest.Mock>

  const mockUserReq = {
    user: { sub: 'user-1', email: 'test@test.com' },
  } as unknown as AuthenticatedRequest

  const mockMembers = [
    {
      id: 'm1',
      adventureId: 'adv-1',
      userId: 'user-1',
      role: 'GM',
      user: { id: 'user-1', email: 'gm@test.com', displayName: 'GM User' },
    },
    {
      id: 'm2',
      adventureId: 'adv-1',
      userId: 'user-2',
      role: 'PLAYER',
      user: { id: 'user-2', email: 'player@test.com', displayName: 'Player User' },
    },
  ]

  const mockAdventures = [
    { id: 'adv-1', name: 'Test Adventure', role: 'GM', joinedAt: new Date('2025-01-01') },
    { id: 'adv-2', name: 'Another Adventure', role: 'PLAYER', joinedAt: new Date('2025-02-01') },
  ]

  beforeEach(async () => {
    jest.clearAllMocks()

    mockMembershipService = {
      getMembers: jest.fn().mockResolvedValue(mockMembers),
      updateRole: jest.fn().mockResolvedValue({
        id: 'm2',
        adventureId: 'adv-1',
        userId: 'user-2',
        role: 'GM',
      }),
      requireRole: jest.fn().mockResolvedValue(undefined),
      removeMember: jest.fn().mockResolvedValue({
        id: 'm2',
        adventureId: 'adv-1',
        userId: 'user-2',
      }),
      getUserAdventures: jest.fn().mockResolvedValue(mockAdventures),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MembershipController],
      providers: [
        { provide: MembershipService, useValue: mockMembershipService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile()

    controller = module.get<MembershipController>(MembershipController)
  })

  describe('getMembers', () => {
    it('should delegate to membershipService.getMembers with the adventureId', async () => {
      const result = await controller.getMembers('adv-1')

      expect(mockMembershipService.getMembers).toHaveBeenCalledWith('adv-1')
      expect(result).toEqual(mockMembers)
    })

    it('should pass through an empty adventureId parameter', async () => {
      mockMembershipService.getMembers.mockResolvedValue([])
      const result = await controller.getMembers('')

      expect(mockMembershipService.getMembers).toHaveBeenCalledWith('')
      expect(result).toEqual([])
    })

    it('should propagate a service rejection', async () => {
      mockMembershipService.getMembers.mockRejectedValue(
        new Error('Database connection failed'),
      )

      await expect(controller.getMembers('adv-1')).rejects.toThrow(
        'Database connection failed',
      )
    })
  })

  describe('updateRole', () => {
    it('should call requireRole then updateRole with correct args', async () => {
      mockMembershipService.requireRole.mockResolvedValueOnce(undefined)
      mockMembershipService.updateRole.mockResolvedValueOnce({
        id: 'm2',
        adventureId: 'adv-1',
        userId: 'user-2',
        role: 'GM',
      })

      const dto = { role: 'GM' as const }
      const result = await controller.updateRole(
        mockUserReq,
        'adv-1',
        'user-2',
        dto,
      )

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith(
        'adv-1',
        'user-1',
        'GM',
      )
      expect(mockMembershipService.updateRole).toHaveBeenCalledWith(
        'adv-1',
        'user-2',
        'GM',
      )
      expect(result).toEqual({
        id: 'm2',
        adventureId: 'adv-1',
        userId: 'user-2',
        role: 'GM',
      })
    })

    it('should throw ForbiddenException when requireRole rejects (user not GM)', async () => {
      mockMembershipService.requireRole.mockRejectedValueOnce(
        new ForbiddenException(
          'Only the Game Master can perform this action',
        ),
      )

      const dto = { role: 'GM' as const }
      await expect(
        controller.updateRole(mockUserReq, 'adv-1', 'user-2', dto),
      ).rejects.toThrow(ForbiddenException)

      expect(mockMembershipService.updateRole).not.toHaveBeenCalled()
    })

    it('should handle empty userId parameter', async () => {
      mockMembershipService.requireRole.mockResolvedValueOnce(undefined)
      mockMembershipService.updateRole.mockResolvedValueOnce(undefined)

      const dto = { role: 'PLAYER' as const }
      await controller.updateRole(mockUserReq, 'adv-1', '', dto)

      expect(mockMembershipService.updateRole).toHaveBeenCalledWith(
        'adv-1',
        '',
        'PLAYER',
      )
    })
  })

  describe('removeMember', () => {
    it('should call requireRole then removeMember with correct args', async () => {
      mockMembershipService.requireRole.mockResolvedValueOnce(undefined)
      mockMembershipService.removeMember.mockResolvedValueOnce({
        id: 'm2',
        adventureId: 'adv-1',
        userId: 'user-2',
      })

      const result = await controller.removeMember(
        mockUserReq,
        'adv-1',
        'user-2',
      )

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith(
        'adv-1',
        'user-1',
        'GM',
      )
      expect(mockMembershipService.removeMember).toHaveBeenCalledWith(
        'adv-1',
        'user-2',
      )
      expect(result).toEqual({
        id: 'm2',
        adventureId: 'adv-1',
        userId: 'user-2',
      })
    })

    it('should throw ForbiddenException when requireRole rejects (user not GM)', async () => {
      mockMembershipService.requireRole.mockRejectedValueOnce(
        new ForbiddenException(
          'Only the Game Master can perform this action',
        ),
      )

      await expect(
        controller.removeMember(mockUserReq, 'adv-1', 'user-2'),
      ).rejects.toThrow(ForbiddenException)

      expect(mockMembershipService.removeMember).not.toHaveBeenCalled()
    })

    it('should propagate a service rejection when removing a non-existent member', async () => {
      mockMembershipService.requireRole.mockResolvedValueOnce(undefined)
      mockMembershipService.removeMember.mockRejectedValueOnce(
        new Error('Record to delete does not exist'),
      )

      await expect(
        controller.removeMember(mockUserReq, 'adv-1', 'nonexistent'),
      ).rejects.toThrow('Record to delete does not exist')
    })
  })

  describe('getMyAdventures', () => {
    it('should delegate to membershipService.getUserAdventures with the user id', async () => {
      const result = await controller.getMyAdventures(mockUserReq)

      expect(mockMembershipService.getUserAdventures).toHaveBeenCalledWith(
        'user-1',
      )
      expect(result).toEqual(mockAdventures)
    })

    it('should return empty array when user has no adventures', async () => {
      mockMembershipService.getUserAdventures.mockResolvedValue([])

      const result = await controller.getMyAdventures(mockUserReq)

      expect(mockMembershipService.getUserAdventures).toHaveBeenCalledWith(
        'user-1',
      )
      expect(result).toEqual([])
    })

    it('should propagate a service rejection', async () => {
      mockMembershipService.getUserAdventures.mockRejectedValue(
        new Error('Service unavailable'),
      )

      await expect(
        controller.getMyAdventures(mockUserReq),
      ).rejects.toThrow('Service unavailable')
    })
  })

  describe('property-based tests with jest-each', () => {
    it.each([
      ['adv-1', 'adv-1', mockMembers],
      ['adv-2', 'adv-2', [] as typeof mockMembers],
      ['empty-adventure-id', '', [] as typeof mockMembers],
      ['non-existent-id', 'does-not-exist', [] as typeof mockMembers],
    ])(
      'getMembers with adventureId "%s" delegates to service and returns %#',
      async (_label: string, adventureId: string, expected: typeof mockMembers) => {
        mockMembershipService.getMembers.mockResolvedValue(expected)

        const result = await controller.getMembers(adventureId)

        expect(mockMembershipService.getMembers).toHaveBeenCalledWith(
          adventureId,
        )
        expect(result).toEqual(expected)
      },
    )
  })
})
