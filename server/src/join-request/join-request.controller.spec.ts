jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
import { Test, TestingModule } from '@nestjs/testing'
import { JoinRequestController } from './join-request.controller.js'
import { JoinRequestService } from './join-request.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import type { AuthenticatedRequest } from '../auth/AuthenticatedRequest.js'

describe('JoinRequestController', () => {
  let controller: JoinRequestController
  let mockJoinRequestService: Record<string, jest.Mock>

  const mockReq = {
    user: { sub: 'user-1', email: 'test@test.com' },
  } as unknown as AuthenticatedRequest

  beforeEach(async () => {
    jest.clearAllMocks()

    mockJoinRequestService = {
      create: jest.fn().mockResolvedValue({ id: 'jr-1', status: 'PENDING' }),
      findByAdventure: jest.fn().mockResolvedValue([]),
      accept: jest.fn().mockResolvedValue({
        membership: { id: 'cm-1', role: 'PLAYER' },
        request: { id: 'jr-1', status: 'ACCEPTED' },
      }),
      reject: jest.fn().mockResolvedValue({ id: 'jr-1', status: 'REJECTED' }),
      findMyRequests: jest.fn().mockResolvedValue([]),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JoinRequestController],
      providers: [
        { provide: JoinRequestService, useValue: mockJoinRequestService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile()

    controller = module.get<JoinRequestController>(JoinRequestController)
  })

  describe('create (POST /adventures/:adventureId/join-requests)', () => {
    it('delegates to joinRequestService.create', async () => {
      const result = await controller.create(
        mockReq,
        'adv-1',
        { message: 'Let me join!' },
      )
      expect(mockJoinRequestService.create).toHaveBeenCalledWith(
        'adv-1',
        'user-1',
        'Let me join!',
      )
      expect(result).toEqual({ id: 'jr-1', status: 'PENDING' })
    })

    it('works without a message', async () => {
      await controller.create(mockReq, 'adv-1', {})
      expect(mockJoinRequestService.create).toHaveBeenCalledWith(
        'adv-1',
        'user-1',
        undefined,
      )
    })
  })

  describe('findByAdventure (GET /adventures/:adventureId/join-requests)', () => {
    it('delegates to joinRequestService.findByAdventure', async () => {
      const result = await controller.findByAdventure(mockReq, 'adv-1')
      expect(mockJoinRequestService.findByAdventure).toHaveBeenCalledWith(
        'adv-1',
        'user-1',
      )
      expect(result).toEqual([])
    })
  })

  describe('handleAction (PATCH /adventures/:adventureId/join-requests/:requestId)', () => {
    it('delegates to accept when action is accept', async () => {
      const result = await controller.handleAction(
        mockReq,
        'adv-1',
        'jr-1',
        { action: 'accept' },
      )
      expect(mockJoinRequestService.accept).toHaveBeenCalledWith(
        'adv-1',
        'jr-1',
        'user-1',
      )
      expect(result).toMatchObject({ membership: { role: 'PLAYER' } })
    })

    it('delegates to reject when action is reject', async () => {
      const result = await controller.handleAction(
        mockReq,
        'adv-1',
        'jr-1',
        { action: 'reject' },
      )
      expect(mockJoinRequestService.reject).toHaveBeenCalledWith(
        'adv-1',
        'jr-1',
        'user-1',
      )
      expect(result).toMatchObject({ status: 'REJECTED' })
    })
  })

  describe('findMyRequests (GET /my/join-requests)', () => {
    it('delegates to joinRequestService.findMyRequests', async () => {
      const result = await controller.findMyRequests(mockReq)
      expect(mockJoinRequestService.findMyRequests).toHaveBeenCalledWith('user-1')
      expect(result).toEqual([])
    })
  })
})
