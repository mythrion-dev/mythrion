jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test, TestingModule } from '@nestjs/testing'
import { CommunityAdventureController } from './community-adventure.controller.js'
import { AdventureService } from '../adventure/adventure.service.js'

describe('CommunityAdventureController', () => {
  let controller: CommunityAdventureController
  let mockAdventureService: Record<string, jest.Mock>

  beforeEach(async () => {
    jest.clearAllMocks()

    mockAdventureService = {
      findPublic: jest.fn().mockResolvedValue({
        data: [
          { id: 'adv-1', name: 'Public Adventure', campaign: 'Camp', synopsis: 'Fun!' },
        ],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      }),
      findOnePublic: jest.fn().mockResolvedValue({
        id: 'adv-1',
        name: 'Public Adventure',
        campaign: 'Camp',
        synopsis: 'Fun!',
        maxPlayers: 4,
        owner: { id: 'u1', displayName: 'Owner' },
        memberCount: 2,
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityAdventureController],
      providers: [
        { provide: AdventureService, useValue: mockAdventureService },
      ],
    }).compile()

    controller = module.get<CommunityAdventureController>(
      CommunityAdventureController,
    )
  })

  describe('findAll (GET /public/adventures)', () => {
    it('delegates to adventureService.findPublic with default pagination', async () => {
      const result = await controller.findAll(1, 10)

      expect(mockAdventureService.findPublic).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        campaign: undefined,
        search: undefined,
        sessionWeekday: undefined,
        sessionType: undefined,
        timePeriod: undefined,
      })
      expect(result.data).toHaveLength(1)
      expect(result.meta.total).toBe(1)
    })

    it('passes query parameters when provided', async () => {
      const result = await controller.findAll(2, 5, 'D&D 5e', 'dragon')

      expect(mockAdventureService.findPublic).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        campaign: 'D&D 5e',
        search: 'dragon',
        sessionWeekday: undefined,
        sessionType: undefined,
        timePeriod: undefined,
      })
      expect(result).toBeDefined()
    })

    it('passes sessionWeekday filter', async () => {
      const result = await controller.findAll(1, 10, undefined, undefined, 'Friday')

      expect(mockAdventureService.findPublic).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        campaign: undefined,
        search: undefined,
        sessionWeekday: 'Friday',
        sessionType: undefined,
        timePeriod: undefined,
      })
      expect(result).toBeDefined()
    })

    it('passes sessionType filter', async () => {
      const result = await controller.findAll(1, 10, undefined, undefined, undefined, 'ONLINE')

      expect(mockAdventureService.findPublic).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        campaign: undefined,
        search: undefined,
        sessionWeekday: undefined,
        sessionType: 'ONLINE',
        timePeriod: undefined,
      })
      expect(result).toBeDefined()
    })

    it('passes timePeriod filter', async () => {
      const result = await controller.findAll(1, 10, undefined, undefined, undefined, undefined, 'night')

      expect(mockAdventureService.findPublic).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        campaign: undefined,
        search: undefined,
        sessionWeekday: undefined,
        sessionType: undefined,
        timePeriod: 'night',
      })
      expect(result).toBeDefined()
    })
  })

  describe('findOne (GET /public/adventures/:id)', () => {
    it('delegates to adventureService.findOnePublic', async () => {
      const result = await controller.findOne('adv-1')

      expect(mockAdventureService.findOnePublic).toHaveBeenCalledWith('adv-1')
      expect(result.name).toBe('Public Adventure')
      expect(result.memberCount).toBe(2)
    })
  })
})
