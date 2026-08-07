jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test, TestingModule } from '@nestjs/testing'
import { CommunityTemplateController } from './community-template.controller.js'
import { TemplateService } from '../template/template.service.js'

describe('CommunityTemplateController', () => {
  let controller: CommunityTemplateController
  let mockTemplateService: Record<string, jest.Mock>

  beforeEach(async () => {
    jest.clearAllMocks()

    mockTemplateService = {
      findPublicAll: jest.fn().mockResolvedValue({
        data: [
          { id: 't1', name: 'Public Template', description: 'A public template' },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }),
      findOnePublic: jest.fn().mockResolvedValue({
        id: 't1',
        name: 'Public Template',
        description: 'A public template',
        adventure: { id: 'adv-1', name: 'Adventure', campaign: 'Camp' },
        owner: { id: 'u1', displayName: 'Owner' },
        attributes: [{ id: 'attr-1', key: 'str', name: 'Strength' }],
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityTemplateController],
      providers: [
        { provide: TemplateService, useValue: mockTemplateService },
      ],
    }).compile()

    controller = module.get<CommunityTemplateController>(
      CommunityTemplateController,
    )
  })

  describe('findAll (GET /public/templates)', () => {
    it('delegates to templateService.findPublicAll with default pagination', async () => {
      const result = await controller.findAll(1, 10)

      expect(mockTemplateService.findPublicAll).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        adventureId: undefined,
        campaign: undefined,
        search: undefined,
      })
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('passes query parameters when provided', async () => {
      const result = await controller.findAll(2, 5, 'adv-1', 'Tormenta', 'warrior')

      expect(mockTemplateService.findPublicAll).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        adventureId: 'adv-1',
        campaign: 'Tormenta',
        search: 'warrior',
      })
      expect(result).toBeDefined()
    })
  })

  describe('findOne (GET /public/templates/:id)', () => {
    it('delegates to templateService.findOnePublic', async () => {
      const result = await controller.findOne('t1')

      expect(mockTemplateService.findOnePublic).toHaveBeenCalledWith('t1')
      expect(result.name).toBe('Public Template')
      expect(result.attributes).toHaveLength(1)
    })
  })
})
