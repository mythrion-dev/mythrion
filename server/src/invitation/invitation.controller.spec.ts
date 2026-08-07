jest.mock('../generated/prisma/client', () => ({ PrismaClient: class {} }))
jest.mock('pg', () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }))
jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid') }))
jest.mock('geoip-lite', () => ({ lookup: jest.fn() }))

import { Test, TestingModule } from '@nestjs/testing'
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common'
import { InvitationController } from './invitation.controller.js'
import { InvitationService } from './invitation.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import type { AuthenticatedRequest } from '../auth/AuthenticatedRequest.js'
import { createI18nServiceMock } from '../i18n/i18n-testing.js'

describe('InvitationController', () => {
  let controller: InvitationController
  let mockInvitationService: Record<string, jest.Mock>

  const mockUserReq = {
    user: { sub: 'user-1', email: 'gm@test.com' },
    headers: { origin: 'http://localhost:3001' },
  } as unknown as AuthenticatedRequest

  const pendingValidateResponse = {
    campaignName: 'Test Adventure',
    campaign: {},
    synopsis: 'A test adventure',
    role: 'PLAYER',
    status: 'PENDING',
    invitedBy: 'GM User',
    expiresAt: '2026-07-28T00:00:00.000Z',
    isValid: true,
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    mockInvitationService = {
      inviteByEmail: jest
        .fn()
        .mockResolvedValue({ success: true, invitationId: 'inv-123' }),
      inviteByLink: jest
        .fn()
        .mockResolvedValue({ inviteUrl: 'http://localhost:3001/invite/token-abc' }),
      validate: jest.fn().mockResolvedValue(pendingValidateResponse),
      accept: jest
        .fn()
        .mockResolvedValue({
          success: true,
          adventureId: 'adv-1',
          adventureName: 'Test Adventure',
          role: 'PLAYER',
        }),
      listForAdventure: jest.fn().mockResolvedValue([
        {
          id: 'inv-1',
          invitedEmail: 'player@test.com',
          status: 'PENDING',
          createdBy: { id: 'user-1', displayName: 'GM User', email: 'gm@test.com' },
        },
      ]),
      revoke: jest
        .fn()
        .mockResolvedValue({ id: 'inv-1', status: 'REVOKED', adventureId: 'adv-1' }),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationController],
      providers: [
        { provide: InvitationService, useValue: mockInvitationService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile()

    controller = module.get<InvitationController>(InvitationController)
  })

  /* ------------------------------------------------------------------ */
  /*  inviteByEmail — POST /adventures/:adventureId/invitations/email    */
  /* ------------------------------------------------------------------ */

  describe('inviteByEmail', () => {
    it('should delegate to invitationService.inviteByEmail with correct args', async () => {
      const result = await controller.inviteByEmail(mockUserReq, 'adv-1', {
        email: 'player@test.com',
      })

      expect(mockInvitationService.inviteByEmail).toHaveBeenCalledWith({
        adventureId: 'adv-1',
        invitedEmail: 'player@test.com',
        createdById: 'user-1',
        origin: 'http://localhost:3001',
      })
      expect(result).toEqual({ success: true, invitationId: 'inv-123' })
    })

    it('should propagate BadRequestException when email is empty', async () => {
      mockInvitationService.inviteByEmail.mockRejectedValue(
        new BadRequestException('Email is required'),
      )

      await expect(
        controller.inviteByEmail(mockUserReq, 'adv-1', {
          email: '',
        }),
      ).rejects.toThrow(BadRequestException)

      expect(mockInvitationService.inviteByEmail).toHaveBeenCalledWith({
        adventureId: 'adv-1',
        invitedEmail: '',
        createdById: 'user-1',
        origin: 'http://localhost:3001',
      })
    })

    it('should propagate ForbiddenException when requester is not GM', async () => {
      mockInvitationService.inviteByEmail.mockRejectedValue(
        new ForbiddenException('Only GMs can send invitations'),
      )

      await expect(
        controller.inviteByEmail(mockUserReq, 'adv-1', {
          email: 'player@test.com',
        }),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  /* ------------------------------------------------------------------ */
  /*  inviteByLink — POST /adventures/:adventureId/invitations/link      */
  /* ------------------------------------------------------------------ */

  describe('inviteByLink', () => {
    it('should delegate to invitationService.inviteByLink with correct args', async () => {
      const result = await controller.inviteByLink(mockUserReq, 'adv-1', {})

      expect(mockInvitationService.inviteByLink).toHaveBeenCalledWith({
        adventureId: 'adv-1',
        createdById: 'user-1',
        origin: 'http://localhost:3001',
      })
      expect(result).toEqual({
        inviteUrl: 'http://localhost:3001/invite/token-abc',
      })
    })

    it('should propagate NotFoundException when adventure does not exist', async () => {
      mockInvitationService.inviteByLink.mockRejectedValue(
        new NotFoundException('Adventure not found'),
      )

      await expect(
        controller.inviteByLink(mockUserReq, 'nonexistent-adv', {}),
      ).rejects.toThrow(NotFoundException)
    })

    it('should propagate BadRequestException when adventure is at max player capacity', async () => {
      mockInvitationService.inviteByLink.mockRejectedValue(
        new BadRequestException('Adventure is at maximum player capacity'),
      )

      await expect(
        controller.inviteByLink(mockUserReq, 'adv-1', {}),
      ).rejects.toThrow(BadRequestException)
    })
  })

  /* ------------------------------------------------------------------ */
  /*  validate — GET /invitations/:token  (public, no auth)              */
  /* ------------------------------------------------------------------ */

  describe('validate', () => {
    it('should delegate to invitationService.validate with the token', async () => {
      const result = await controller.validate('valid-token')

      expect(mockInvitationService.validate).toHaveBeenCalledWith('valid-token')
      expect(result).toEqual(pendingValidateResponse)
    })

    it('should propagate NotFoundException when token is invalid', async () => {
      mockInvitationService.validate.mockRejectedValue(
        new NotFoundException('Invitation not found'),
      )

      await expect(controller.validate('bogus-token')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('should return REVOKED status when invitation has been revoked', async () => {
      mockInvitationService.validate.mockResolvedValue({
        campaignName: 'Test Adventure',
        role: 'PLAYER',
        status: 'REVOKED',
        invitedBy: 'GM User',
        isValid: false,
      })

      const result = await controller.validate('revoked-token')
      expect(result).toMatchObject({ status: 'REVOKED', isValid: false })
    })
  })

  /* ------------------------------------------------------------------ */
  /*  accept — POST /invitations/:token/accept                           */
  /* ------------------------------------------------------------------ */

  describe('accept', () => {
    it('should delegate to invitationService.accept with token and userId', async () => {
      const result = await controller.accept(mockUserReq, 'valid-token')

      expect(mockInvitationService.accept).toHaveBeenCalledWith(
        'valid-token',
        'user-1',
      )
      expect(result).toEqual({
        success: true,
        adventureId: 'adv-1',
        adventureName: 'Test Adventure',
        role: 'PLAYER',
      })
    })

    it('should propagate BadRequestException when invitation already accepted', async () => {
      mockInvitationService.accept.mockRejectedValue(
        new BadRequestException('Invitation already accepted'),
      )

      await expect(
        controller.accept(mockUserReq, 'accepted-token'),
      ).rejects.toThrow(BadRequestException)
    })

    it('should propagate BadRequestException when invitation is expired', async () => {
      mockInvitationService.accept.mockRejectedValue(
        new BadRequestException('Invitation has expired'),
      )

      await expect(
        controller.accept(mockUserReq, 'expired-token'),
      ).rejects.toThrow(BadRequestException)
    })
  })

  /* ------------------------------------------------------------------ */
  /*  listForAdventure — GET /adventures/:adventureId/invitations        */
  /* ------------------------------------------------------------------ */

  describe('listForAdventure', () => {
    it('should delegate to invitationService.listForAdventure with adventureId and userId', async () => {
      const result = await controller.listForAdventure(mockUserReq, 'adv-1')

      expect(mockInvitationService.listForAdventure).toHaveBeenCalledWith(
        'adv-1',
        'user-1',
      )
      expect(result).toEqual([
        {
          id: 'inv-1',
          invitedEmail: 'player@test.com',
          status: 'PENDING',
          createdBy: {
            id: 'user-1',
            displayName: 'GM User',
            email: 'gm@test.com',
          },
        },
      ])
    })

    it('should return empty array when there are no pending invitations', async () => {
      mockInvitationService.listForAdventure.mockResolvedValue([])

      const result = await controller.listForAdventure(mockUserReq, 'adv-1')
      expect(result).toEqual([])
    })

    it('should propagate ForbiddenException when requester is not GM', async () => {
      mockInvitationService.listForAdventure.mockRejectedValue(
        new ForbiddenException('Only GMs can view invitations'),
      )

      await expect(
        controller.listForAdventure(mockUserReq, 'adv-1'),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  /* ------------------------------------------------------------------ */
  /*  revoke — POST /invitations/:invitationId/revoke                    */
  /* ------------------------------------------------------------------ */

  describe('revoke', () => {
    it('should delegate to invitationService.revoke with invitationId and userId', async () => {
      const result = await controller.revoke(mockUserReq, 'inv-1')

      expect(mockInvitationService.revoke).toHaveBeenCalledWith('inv-1', 'user-1')
      expect(result).toEqual({ id: 'inv-1', status: 'REVOKED', adventureId: 'adv-1' })
    })

    it('should propagate NotFoundException when invitation does not exist', async () => {
      mockInvitationService.revoke.mockRejectedValue(
        new NotFoundException('Invitation not found'),
      )

      await expect(controller.revoke(mockUserReq, 'bogus-id')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('should propagate ForbiddenException when requester is not GM', async () => {
      mockInvitationService.revoke.mockRejectedValue(
        new ForbiddenException('Only GMs can revoke invitations'),
      )

      await expect(controller.revoke(mockUserReq, 'inv-1')).rejects.toThrow(
        ForbiddenException,
      )
    })
  })

  /* ------------------------------------------------------------------ */
  /*  JwtAuthGuard rejection (snapshot)                                  */
  /* ------------------------------------------------------------------ */

  describe('JwtAuthGuard rejection', () => {
    const reflectorMock = { getAllAndOverride: jest.fn(() => false) }
    const authServiceMock = { assertEmailVerified: jest.fn() }

    it('should throw UnauthorizedException and match snapshot when no token is provided', async () => {
      const mockJwtService = { verify: jest.fn() }
      const guard = new JwtAuthGuard(
        mockJwtService as any,
        createI18nServiceMock(),
        reflectorMock as any,
        authServiceMock as any,
      )

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
      } as any

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException)
      await expect(guard.canActivate(mockContext)).rejects.toThrowErrorMatchingSnapshot()
    })

    it('should throw UnauthorizedException when token is expired', async () => {
      const mockJwtService = {
        verify: jest.fn(() => {
          throw new Error('jwt expired')
        }),
      }
      const guard = new JwtAuthGuard(
        mockJwtService as any,
        createI18nServiceMock(),
        reflectorMock as any,
        authServiceMock as any,
      )

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.expired' } }),
        }),
      } as any

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException)
    })
  })

})
