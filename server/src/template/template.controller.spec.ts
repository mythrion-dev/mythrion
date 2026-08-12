jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
jest.mock('geoip-lite', () => ({ lookup: jest.fn() }))
import { Test, TestingModule } from '@nestjs/testing'
import { TemplateController } from './template.controller.js'
import { TemplateService } from './template.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { SubscriptionGuard } from '../auth/subscription.guard.js'
import { PlanLimitGuard } from '../auth/plan-limit.guard.js'
import { CreateTemplateDto } from './dto/create-template.dto.js'
import { UpdateTemplateDto } from './dto/update-template.dto.js'
import type { AuthenticatedRequest } from '../auth/AuthenticatedRequest.js'

describe('TemplateController', () => {
  let controller: TemplateController
  let mockTemplateService: Record<string, jest.Mock>

  const mockUserReq = {
    user: { sub: 'user-1', email: 'test@test.com' },
  } as unknown as AuthenticatedRequest

  const mockTemplate = {
    id: 'template-1',
    name: 'Test Template',
    adventureId: 'adventure-1',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  }

  const mockTemplates = [
    mockTemplate,
    {
      id: 'template-2',
      name: 'Another Template',
      adventureId: 'adventure-1',
      createdAt: new Date('2025-01-02'),
      updatedAt: new Date('2025-01-02'),
    },
  ]

  const mockCreateDto: CreateTemplateDto = {
    name: 'New Template',
    attributes: [{ key: 'str', name: 'Strength' }],
  }

  const mockUpdateDto: UpdateTemplateDto = {
    name: 'Updated Template',
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    mockTemplateService = {
      create: jest.fn().mockResolvedValue(mockTemplate),
      findAllByAdventure: jest.fn().mockResolvedValue(mockTemplates),
      findOne: jest.fn().mockResolvedValue(mockTemplate),
      update: jest.fn().mockResolvedValue({ ...mockTemplate, name: 'Updated Template' }),
      remove: jest.fn().mockResolvedValue({ success: true }),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TemplateController],
      providers: [
        { provide: TemplateService, useValue: mockTemplateService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(SubscriptionGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PlanLimitGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile()

    controller = module.get<TemplateController>(TemplateController)
  })

  describe('create', () => {
    it('should delegate to templateService.create with adventureId, userId, and dto', async () => {
      const result = await controller.create(mockUserReq, 'adventure-1', mockCreateDto)
      expect(mockTemplateService.create).toHaveBeenCalledWith('adventure-1', 'user-1', mockCreateDto)
      expect(result).toEqual(mockTemplate)
    })

    it('should handle an empty adventureId parameter', async () => {
      const result = await controller.create(mockUserReq, '', mockCreateDto)
      expect(mockTemplateService.create).toHaveBeenCalledWith('', 'user-1', mockCreateDto)
      expect(result).toEqual(mockTemplate)
    })

    it('should propagate a service rejection', async () => {
      mockTemplateService.create.mockRejectedValue(new Error('Database error'))
      await expect(controller.create(mockUserReq, 'adventure-1', mockCreateDto)).rejects.toThrow('Database error')
    })
  })

  describe('findAll', () => {
    it('should delegate to templateService.findAllByAdventure with adventureId and userId', async () => {
      const result = await controller.findAll(mockUserReq, 'adventure-1')
      expect(mockTemplateService.findAllByAdventure).toHaveBeenCalledWith('adventure-1', 'user-1')
      expect(result).toEqual(mockTemplates)
    })

    it('should handle an empty adventureId parameter', async () => {
      mockTemplateService.findAllByAdventure.mockResolvedValue([])
      const result = await controller.findAll(mockUserReq, '')
      expect(mockTemplateService.findAllByAdventure).toHaveBeenCalledWith('', 'user-1')
      expect(result).toEqual([])
    })

    it('should propagate a service rejection', async () => {
      mockTemplateService.findAllByAdventure.mockRejectedValue(new Error('Not found'))
      await expect(controller.findAll(mockUserReq, 'adventure-1')).rejects.toThrow('Not found')
    })
  })

  describe('findOne', () => {
    it('should delegate to templateService.findOne with templateId and userId', async () => {
      const result = await controller.findOne(mockUserReq, 'template-1')
      expect(mockTemplateService.findOne).toHaveBeenCalledWith('template-1', 'user-1')
      expect(result).toEqual(mockTemplate)
    })

    it('should handle an empty templateId parameter', async () => {
      mockTemplateService.findOne.mockResolvedValue(null)
      const result = await controller.findOne(mockUserReq, '')
      expect(mockTemplateService.findOne).toHaveBeenCalledWith('', 'user-1')
      expect(result).toBeNull()
    })

    it('should propagate a service rejection', async () => {
      mockTemplateService.findOne.mockRejectedValue(new Error('Template not found'))
      await expect(controller.findOne(mockUserReq, 'template-999')).rejects.toThrow('Template not found')
    })
  })

  describe('update', () => {
    it('should delegate to templateService.update with templateId, userId, and dto', async () => {
      const result = await controller.update(mockUserReq, 'template-1', mockUpdateDto)
      expect(mockTemplateService.update).toHaveBeenCalledWith('template-1', 'user-1', mockUpdateDto)
      expect(result).toEqual({ ...mockTemplate, name: 'Updated Template' })
    })

    it('should handle an empty templateId parameter', async () => {
      const result = await controller.update(mockUserReq, '', mockUpdateDto)
      expect(mockTemplateService.update).toHaveBeenCalledWith('', 'user-1', mockUpdateDto)
      expect(result).toEqual({ ...mockTemplate, name: 'Updated Template' })
    })

    it('should propagate a service rejection', async () => {
      mockTemplateService.update.mockRejectedValue(new Error('Forbidden'))
      await expect(controller.update(mockUserReq, 'template-1', mockUpdateDto)).rejects.toThrow('Forbidden')
    })
  })

  describe('remove', () => {
    it('should delegate to templateService.remove with templateId and userId', async () => {
      const result = await controller.remove(mockUserReq, 'template-1')
      expect(mockTemplateService.remove).toHaveBeenCalledWith('template-1', 'user-1')
      expect(result).toEqual({ success: true })
    })

    it('should handle an empty templateId parameter', async () => {
      const result = await controller.remove(mockUserReq, '')
      expect(mockTemplateService.remove).toHaveBeenCalledWith('', 'user-1')
      expect(result).toEqual({ success: true })
    })

    it('should propagate a service rejection', async () => {
      mockTemplateService.remove.mockRejectedValue(new Error('Template not found'))
      await expect(controller.remove(mockUserReq, 'template-999')).rejects.toThrow('Template not found')
    })
  })

  describe('property-based tests with jest-each', () => {
    it.each([
      ['adventure-1', 'template-1', 'user-1', true],
      ['adventure-2', 'template-2', 'user-2', true],
      ['adventure-1', 'template-3', 'user-1', true],
    ])(
      'should route findOne(%s, %s) to templateService.findOne with userId %s',
      async (adventureId, templateId, userId) => {
        mockTemplateService.findOne.mockResolvedValue({
          id: templateId,
          adventureId,
          name: 'Property Test Template',
        })
        const req = { user: { sub: userId } } as unknown as AuthenticatedRequest
        const result = await controller.findOne(req, templateId)
        expect(mockTemplateService.findOne).toHaveBeenCalledWith(templateId, userId)
        expect(result).toEqual({
          id: templateId,
          adventureId,
          name: 'Property Test Template',
        })
      },
    )
  })
})
