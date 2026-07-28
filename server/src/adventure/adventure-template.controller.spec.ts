jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
import { Test, TestingModule } from '@nestjs/testing'
import { AdventureTemplateController } from './adventure-template.controller.js'
import { TemplateService } from '../template/template.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import type { AuthenticatedRequest } from '../auth/AuthenticatedRequest.js'

describe('AdventureTemplateController', () => {
  let controller: AdventureTemplateController
  let mockTemplateService: Record<string, jest.Mock>

  const mockUserReq = {
    user: { sub: 'user-1', email: 'test@test.com' },
  } as unknown as AuthenticatedRequest

  const mockSnapshot = {
    id: 'tpl-1',
    name: 'Attached Template',
    attributes: [{ id: 'attr-1', key: 'str', name: 'Strength' }],
    templateFields: [],
    templateSkills: [],
    skillModifierProfiles: [],
    coreResources: [],
    armorClasses: [],
    characterSections: [],
    resistances: [],
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    mockTemplateService = {
      attachToAdventure: jest.fn().mockResolvedValue({
        id: 'adv-1',
        templateSnapshot: mockSnapshot,
        originalTemplateId: 'tpl-1',
      }),
      getTemplateSnapshot: jest.fn().mockResolvedValue({
        snapshot: mockSnapshot,
        originalTemplateId: 'tpl-1',
      }),
      detachFromAdventure: jest.fn().mockResolvedValue({
        id: 'adv-1',
        originalTemplateId: null,
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdventureTemplateController],
      providers: [
        { provide: TemplateService, useValue: mockTemplateService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile()

    controller = module.get<AdventureTemplateController>(AdventureTemplateController)
  })

  // ──────────────────────────────────────────────
  //  POST /adventures/:id/template/attach
  // ──────────────────────────────────────────────

  describe('attach (POST /adventures/:id/template/attach)', () => {
    it('delegates to templateService.attachToAdventure with templateId, adventureId, and userId', async () => {
      const result = await controller.attach(mockUserReq, 'adv-1', 'tpl-1')

      expect(mockTemplateService.attachToAdventure).toHaveBeenCalledWith('tpl-1', 'adv-1', 'user-1')
      expect(result.templateSnapshot).toBeDefined()
      expect(result.originalTemplateId).toBe('tpl-1')
    })

    it('propagates a NotFoundException when template or adventure is not found', async () => {
      const { NotFoundException } = require('@nestjs/common')
      mockTemplateService.attachToAdventure.mockRejectedValue(
        new NotFoundException('Template not found'),
      )

      await expect(controller.attach(mockUserReq, 'adv-1', 'nonexistent')).rejects.toThrow('Template not found')
    })

    it('propagates a ForbiddenException when user is not GM', async () => {
      const { ForbiddenException } = require('@nestjs/common')
      mockTemplateService.attachToAdventure.mockRejectedValue(
        new ForbiddenException('Only the Game Master can perform this action'),
      )

      await expect(controller.attach(mockUserReq, 'adv-1', 'tpl-1')).rejects.toThrow('Only the Game Master')
    })
  })

  // ──────────────────────────────────────────────
  //  GET /adventures/:id/template/snapshot
  // ──────────────────────────────────────────────

  describe('getSnapshot (GET /adventures/:id/template/snapshot)', () => {
    it('delegates to templateService.getTemplateSnapshot with adventureId and userId', async () => {
      const result = await controller.getSnapshot(mockUserReq, 'adv-1')

      expect(mockTemplateService.getTemplateSnapshot).toHaveBeenCalledWith('adv-1', 'user-1')
      expect(result.snapshot).toBeDefined()
      expect(result.originalTemplateId).toBe('tpl-1')
    })

    it('propagates a NotFoundException when no snapshot exists', async () => {
      const { NotFoundException } = require('@nestjs/common')
      mockTemplateService.getTemplateSnapshot.mockRejectedValue(
        new NotFoundException('No template snapshot found for this adventure'),
      )

      await expect(controller.getSnapshot(mockUserReq, 'adv-1')).rejects.toThrow('No template snapshot found')
    })

    it('propagates a ForbiddenException when user is not a member', async () => {
      const { ForbiddenException } = require('@nestjs/common')
      mockTemplateService.getTemplateSnapshot.mockRejectedValue(
        new ForbiddenException('You are not a member of this adventure'),
      )

      await expect(controller.getSnapshot(mockUserReq, 'adv-1')).rejects.toThrow('You are not a member')
    })
  })

  // ──────────────────────────────────────────────
  //  DELETE /adventures/:id/template/detach
  // ──────────────────────────────────────────────

  describe('detach (DELETE /adventures/:id/template/detach)', () => {
    it('delegates to templateService.detachFromAdventure with adventureId and userId', async () => {
      const result = await controller.detach(mockUserReq, 'adv-1')

      expect(mockTemplateService.detachFromAdventure).toHaveBeenCalledWith('adv-1', 'user-1')
      expect(result.originalTemplateId).toBeNull()
    })

    it('propagates a ForbiddenException when user is not GM', async () => {
      const { ForbiddenException } = require('@nestjs/common')
      mockTemplateService.detachFromAdventure.mockRejectedValue(
        new ForbiddenException('Only the Game Master can perform this action'),
      )

      await expect(controller.detach(mockUserReq, 'adv-1')).rejects.toThrow('Only the Game Master')
    })

    it('handles already-detached template gracefully', async () => {
      mockTemplateService.detachFromAdventure.mockResolvedValue({
        id: 'adv-1',
        originalTemplateId: null,
      })

      const result = await controller.detach(mockUserReq, 'adv-1')

      expect(result.originalTemplateId).toBeNull()
    })
  })
})
