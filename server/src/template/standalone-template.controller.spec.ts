jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
import { Test, TestingModule } from '@nestjs/testing'
import { StandaloneTemplateController } from './standalone-template.controller.js'
import { TemplateService } from './template.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { SubscriptionGuard } from '../auth/subscription.guard.js'
import { CreateTemplateDto } from './dto/create-template.dto.js'
import { UpdateTemplateDto } from './dto/update-template.dto.js'
import type { AuthenticatedRequest } from '../auth/AuthenticatedRequest.js'

describe('StandaloneTemplateController', () => {
  let controller: StandaloneTemplateController
  let mockTemplateService: Record<string, jest.Mock>

  const mockUserReq = {
    user: { sub: 'user-1', email: 'test@test.com' },
  } as unknown as AuthenticatedRequest

  const mockTemplate = {
    id: 'template-1',
    name: 'Standalone Template',
    adventureId: null,
    ownerId: 'user-1',
    isPublic: false,
    useCount: 0,
  }

  const mockCreateDto: CreateTemplateDto = {
    name: 'New Standalone',
    attributes: [{ key: 'str', name: 'Strength' }],
  }

  const mockUpdateDto: UpdateTemplateDto = {
    name: 'Updated Standalone',
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    mockTemplateService = {
      createStandalone: jest.fn().mockResolvedValue(mockTemplate),
      findAllByUser: jest.fn().mockResolvedValue([mockTemplate]),
      findOne: jest.fn().mockResolvedValue(mockTemplate),
      update: jest.fn().mockResolvedValue({ ...mockTemplate, name: 'Updated Standalone' }),
      remove: jest.fn().mockResolvedValue({ success: true }),
      clone: jest.fn().mockResolvedValue({ ...mockTemplate, name: 'Standalone Template (copy)' }),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StandaloneTemplateController],
      providers: [
        { provide: TemplateService, useValue: mockTemplateService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(SubscriptionGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile()

    controller = module.get<StandaloneTemplateController>(StandaloneTemplateController)
  })

  // ──────────────────────────────────────────────
  //  POST /templates — createStandalone
  // ──────────────────────────────────────────────

  describe('create (POST /templates)', () => {
    it('delegates to templateService.createStandalone with userId and dto', async () => {
      const result = await controller.create(mockUserReq, mockCreateDto)

      expect(mockTemplateService.createStandalone).toHaveBeenCalledWith('user-1', mockCreateDto)
      expect(result).toEqual(mockTemplate)
    })

    it('propagates a service rejection', async () => {
      mockTemplateService.createStandalone.mockRejectedValue(new Error('Database error'))

      await expect(controller.create(mockUserReq, mockCreateDto)).rejects.toThrow('Database error')
    })
  })

  // ──────────────────────────────────────────────
  //  GET /templates — findAllByUser
  // ──────────────────────────────────────────────

  describe('findAll (GET /templates)', () => {
    it('delegates to templateService.findAllByUser', async () => {
      const result = await controller.findAll(mockUserReq)

      expect(mockTemplateService.findAllByUser).toHaveBeenCalledWith('user-1')
      expect(result).toEqual([mockTemplate])
    })

    it('returns an empty array when the user has no templates', async () => {
      mockTemplateService.findAllByUser.mockResolvedValue([])

      const result = await controller.findAll(mockUserReq)

      expect(result).toEqual([])
    })
  })

  // ──────────────────────────────────────────────
  //  GET /templates/:id — findOne
  // ──────────────────────────────────────────────

  describe('findOne (GET /templates/:id)', () => {
    it('delegates to templateService.findOne with id and userId', async () => {
      const result = await controller.findOne(mockUserReq, 'template-1')

      expect(mockTemplateService.findOne).toHaveBeenCalledWith('template-1', 'user-1')
      expect(result).toEqual(mockTemplate)
    })

    it('propagates a NotFoundException from the service', async () => {
      const { NotFoundException } = require('@nestjs/common')
      mockTemplateService.findOne.mockRejectedValue(new NotFoundException('Template not found'))

      await expect(controller.findOne(mockUserReq, 'nonexistent')).rejects.toThrow('Template not found')
    })

    it('propagates a ForbiddenException from the service', async () => {
      const { ForbiddenException } = require('@nestjs/common')
      mockTemplateService.findOne.mockRejectedValue(new ForbiddenException('You do not have access to this template'))

      await expect(controller.findOne(mockUserReq, 'restricted')).rejects.toThrow('You do not have access to this template')
    })
  })

  // ──────────────────────────────────────────────
  //  PATCH /templates/:id — update
  // ──────────────────────────────────────────────

  describe('update (PATCH /templates/:id)', () => {
    it('delegates to templateService.update with id, userId, and dto', async () => {
      const result = await controller.update(mockUserReq, 'template-1', mockUpdateDto)

      expect(mockTemplateService.update).toHaveBeenCalledWith('template-1', 'user-1', mockUpdateDto)
      expect(result.name).toBe('Updated Standalone')
    })

    it('propagates a service rejection', async () => {
      mockTemplateService.update.mockRejectedValue(new Error('Update failed'))

      await expect(controller.update(mockUserReq, 'template-1', mockUpdateDto)).rejects.toThrow('Update failed')
    })
  })

  // ──────────────────────────────────────────────
  //  DELETE /templates/:id — remove
  // ──────────────────────────────────────────────

  describe('remove (DELETE /templates/:id)', () => {
    it('delegates to templateService.remove with id and userId', async () => {
      const result = await controller.remove(mockUserReq, 'template-1')

      expect(mockTemplateService.remove).toHaveBeenCalledWith('template-1', 'user-1')
      expect(result).toEqual({ success: true })
    })

    it('propagates a ForbiddenException when character sheets reference the template', async () => {
      const { ForbiddenException } = require('@nestjs/common')
      mockTemplateService.remove.mockRejectedValue(
        new ForbiddenException('Cannot delete: 3 character sheet(s) reference this template'),
      )

      await expect(controller.remove(mockUserReq, 'template-1')).rejects.toThrow('Cannot delete: 3 character sheet')
    })
  })

  // ──────────────────────────────────────────────
  //  POST /templates/:id/clone — clone
  // ──────────────────────────────────────────────

  describe('clone (POST /templates/:id/clone)', () => {
    it('delegates to templateService.clone with id and userId (no custom name)', async () => {
      const result = await controller.clone(mockUserReq, 'template-1', undefined)

      expect(mockTemplateService.clone).toHaveBeenCalledWith('template-1', 'user-1', undefined)
      expect(result.name).toContain('(copy)')
    })

    it('delegates to templateService.clone with a custom name', async () => {
      mockTemplateService.clone.mockResolvedValue({ ...mockTemplate, name: 'Custom Clone' })

      const result = await controller.clone(mockUserReq, 'template-1', 'Custom Clone')

      expect(mockTemplateService.clone).toHaveBeenCalledWith('template-1', 'user-1', 'Custom Clone')
      expect(result.name).toBe('Custom Clone')
    })

    it('propagates a ForbiddenException when clone is not permitted', async () => {
      const { ForbiddenException } = require('@nestjs/common')
      mockTemplateService.clone.mockRejectedValue(
        new ForbiddenException('You do not have permission to clone this template'),
      )

      await expect(controller.clone(mockUserReq, 'restricted', undefined)).rejects.toThrow('You do not have permission to clone this template')
    })

    it('propagates a NotFoundException when the template does not exist', async () => {
      const { NotFoundException } = require('@nestjs/common')
      mockTemplateService.clone.mockRejectedValue(new NotFoundException('Template not found'))

      await expect(controller.clone(mockUserReq, 'nonexistent', undefined)).rejects.toThrow('Template not found')
    })
  })
})
