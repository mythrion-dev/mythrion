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
        role: 'PLAYER',
      }),
      requireRole: jest.fn().mockResolvedValue(undefined),
      requireWriteRole: jest.fn().mockResolvedValue(undefined),
      removeMember: jest.fn().mockResolvedValue({
        id: 'm2',
        adventureId: 'adv-1',
        userId: 'user-2',
      }),
      getUserAdventures: jest.fn().mockResolvedValue(mockAdventures),
      getAccessState: jest.fn().mockResolvedValue('ACTIVE'),
      leaveCampaign: jest.fn().mockResolvedValue({
        id: 'm2',
        adventureId: 'adv-1',
        userId: 'user-2',
        role: 'PLAYER',
      }),
      transferGm: jest.fn().mockResolvedValue([
        { id: 'm1', adventureId: 'adv-1', userId: 'user-1', role: 'PLAYER' },
        { id: 'm2', adventureId: 'adv-1', userId: 'user-2', role: 'GM' },
      ]),
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
      const result = await controller.getMembers(mockUserReq, 'adv-1')

      expect(mockMembershipService.getMembers).toHaveBeenCalledWith('adv-1')
      expect(result).toEqual(mockMembers)
    })

    it('should pass through an empty adventureId parameter', async () => {
      mockMembershipService.getMembers.mockResolvedValue([])
      const result = await controller.getMembers(mockUserReq, '')

      expect(mockMembershipService.getMembers).toHaveBeenCalledWith('')
      expect(result).toEqual([])
    })

    it('should propagate a service rejection', async () => {
      mockMembershipService.getMembers.mockRejectedValue(
        new Error('Database connection failed'),
      )

      await expect(controller.getMembers(mockUserReq, 'adv-1')).rejects.toThrow(
        'Database connection failed',
      )
    })

    it('should require membership (PLAYER) before listing members', async () => {
      await controller.getMembers(mockUserReq, 'adv-1')

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith(
        'adv-1',
        'user-1',
        'PLAYER',
      )
    })

    it('should reject with 403 and not list members when the user is not a member', async () => {
      mockMembershipService.requireRole.mockRejectedValueOnce(
        new ForbiddenException('You are not a member of this campaign'),
      )

      await expect(controller.getMembers(mockUserReq, 'adv-1'))
        .rejects.toThrow(ForbiddenException)

      expect(mockMembershipService.getMembers).not.toHaveBeenCalled()
    })
  })

  describe('updateRole', () => {
    it('should call requireWriteRole then updateRole with correct args', async () => {
      mockMembershipService.requireWriteRole.mockResolvedValueOnce(undefined)
      mockMembershipService.updateRole.mockResolvedValueOnce({
        id: 'm2',
        adventureId: 'adv-1',
        userId: 'user-2',
        role: 'PLAYER',
      })

      const dto = { role: 'PLAYER' as const }
      const result = await controller.updateRole(
        mockUserReq,
        'adv-1',
        'user-2',
        dto,
      )

      expect(mockMembershipService.requireWriteRole).toHaveBeenCalledWith(
        'adv-1',
        'user-1',
        'GM',
      )
      expect(mockMembershipService.updateRole).toHaveBeenCalledWith(
        'adv-1',
        'user-2',
        'PLAYER',
      )
      expect(result).toEqual({
        id: 'm2',
        adventureId: 'adv-1',
        userId: 'user-2',
        role: 'PLAYER',
      })
    })

    it('should throw ForbiddenException when requireWriteRole rejects (user not GM)', async () => {
      mockMembershipService.requireWriteRole.mockRejectedValueOnce(
        new ForbiddenException(
          'Only the Game Master can perform this action',
        ),
      )

      const dto = { role: 'PLAYER' as const }
      await expect(
        controller.updateRole(mockUserReq, 'adv-1', 'user-2', dto),
      ).rejects.toThrow(ForbiddenException)

      expect(mockMembershipService.updateRole).not.toHaveBeenCalled()
    })

    it('should handle empty userId parameter', async () => {
      mockMembershipService.requireWriteRole.mockResolvedValueOnce(undefined)
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
    it('should call requireWriteRole then removeMember with correct args', async () => {
      mockMembershipService.requireWriteRole.mockResolvedValueOnce(undefined)
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

      expect(mockMembershipService.requireWriteRole).toHaveBeenCalledWith(
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

    it('should throw ForbiddenException when requireWriteRole rejects (user not GM)', async () => {
      mockMembershipService.requireWriteRole.mockRejectedValueOnce(
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
      mockMembershipService.requireWriteRole.mockResolvedValueOnce(undefined)
      mockMembershipService.removeMember.mockRejectedValueOnce(
        new Error('Record to delete does not exist'),
      )

      await expect(
        controller.removeMember(mockUserReq, 'adv-1', 'nonexistent'),
      ).rejects.toThrow('Record to delete does not exist')
    })
  })

  describe('leaveCampaign', () => {
    it('should delegate to membershipService.leaveCampaign with the current user', async () => {
      const result = await controller.leaveCampaign(mockUserReq, 'adv-1')

      expect(mockMembershipService.leaveCampaign).toHaveBeenCalledWith(
        'adv-1',
        'user-1',
      )
      expect(result).toEqual({
        id: 'm2',
        adventureId: 'adv-1',
        userId: 'user-2',
        role: 'PLAYER',
      })
    })

    it('should propagate a service rejection', async () => {
      mockMembershipService.leaveCampaign.mockRejectedValue(
        new ForbiddenException('You are not a member of this campaign'),
      )

      await expect(controller.leaveCampaign(mockUserReq, 'adv-1')).rejects.toThrow(
        ForbiddenException,
      )
    })
  })

  describe('transferGm', () => {
    it('should require GM role then delegate to membershipService.transferGm', async () => {
      mockMembershipService.requireRole.mockResolvedValueOnce({
        id: 'm1',
        adventureId: 'adv-1',
        userId: 'user-1',
        role: 'GM',
      })
      mockMembershipService.transferGm.mockResolvedValueOnce([
        { id: 'm1', adventureId: 'adv-1', userId: 'user-1', role: 'PLAYER' },
        { id: 'm2', adventureId: 'adv-1', userId: 'user-2', role: 'GM' },
      ])

      const dto = { newGmId: 'user-2' }
      const result = await controller.transferGm(mockUserReq, 'adv-1', dto)

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith(
        'adv-1',
        'user-1',
        'GM',
      )
      expect(mockMembershipService.transferGm).toHaveBeenCalledWith(
        'adv-1',
        'user-1',
        'user-2',
      )
      expect(result).toEqual([
        { id: 'm1', adventureId: 'adv-1', userId: 'user-1', role: 'PLAYER' },
        { id: 'm2', adventureId: 'adv-1', userId: 'user-2', role: 'GM' },
      ])
    })

    it('should throw ForbiddenException when requireRole rejects (user not GM)', async () => {
      mockMembershipService.requireRole.mockRejectedValueOnce(
        new ForbiddenException('Only the Game Master can perform this action'),
      )

      const dto = { newGmId: 'user-2' }
      await expect(controller.transferGm(mockUserReq, 'adv-1', dto)).rejects.toThrow(
        ForbiddenException,
      )

      expect(mockMembershipService.transferGm).not.toHaveBeenCalled()
    })

    it('should propagate a service rejection when the transfer fails', async () => {
      mockMembershipService.requireRole.mockResolvedValueOnce(undefined)
      mockMembershipService.transferGm.mockRejectedValueOnce(
        new ForbiddenException('The new Game Master needs an active subscription'),
      )

      const dto = { newGmId: 'user-2' }
      await expect(controller.transferGm(mockUserReq, 'adv-1', dto)).rejects.toThrow(
        ForbiddenException,
      )
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

  describe('getAccessState', () => {
    it('should return the access state for the current user', async () => {
      mockMembershipService.getAccessState.mockResolvedValue('READ_ONLY')

      const result = await controller.getAccessState(mockUserReq, 'adv-1')

      expect(mockMembershipService.getAccessState).toHaveBeenCalledWith(
        'adv-1',
        'user-1',
      )
      expect(result).toEqual({ accessState: 'READ_ONLY' })
    })

    it('should propagate a ForbiddenException for non-members', async () => {
      mockMembershipService.getAccessState.mockRejectedValue(
        new ForbiddenException('You are not a member of this campaign'),
      )

      await expect(
        controller.getAccessState(mockUserReq, 'adv-1'),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('generated decorator metadata fallback', () => {
    it('covers the design:paramtypes fallback branch emitted for the injected type', () => {
      // With emitDecoratorMetadata, TS emits a `typeof Service === "function"
      // ? Service : Object` ternary in the class-level __decorate call. Loading
      // the controller in an isolated registry with the service as a
      // non-function exercises the `: Object` fallback, which is otherwise
      // unreachable while the real class is imported.
      jest.isolateModules(() => {
        jest.doMock('./membership.service.js', () => ({
          MembershipService: undefined,
        }))
        const { MembershipController } = jest.requireMock(
          './membership.controller.js',
        )
        expect(MembershipController).toBeDefined()
      })
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

        const result = await controller.getMembers(mockUserReq, adventureId)

        expect(mockMembershipService.getMembers).toHaveBeenCalledWith(
          adventureId,
        )
        expect(result).toEqual(expected)
      },
    )
  })
})
