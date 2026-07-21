jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test, TestingModule } from '@nestjs/testing'
import { AdventureController } from './adventure.controller.js'
import { AdventureService } from './adventure.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { CreateAdventureDto } from './dto/create-adventure.dto.js'
import { UpdateAdventureDto } from './dto/update-adventure.dto.js'
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js'

describe('AdventureController', () => {
  let controller: AdventureController
  let mockAdventureService: Record<string, jest.Mock>

  const mockReq = {
    user: { sub: 'user-1', email: 'test@test.com' },
  } as unknown as AuthenticatedRequest

  beforeEach(async () => {
    jest.clearAllMocks()

    mockAdventureService = {
      create: jest.fn().mockResolvedValue({ id: 'adv-1', name: 'Test Adventure', ownerId: 'user-1' }),
      findAllByUser: jest.fn().mockResolvedValue([
        { id: 'adv-1', name: 'Test Adventure', role: 'GM', joinedAt: new Date() },
      ]),
      findOne: jest.fn().mockResolvedValue({ id: 'adv-1', name: 'Test Adventure', campaign: 'My Campaign' }),
      update: jest.fn().mockResolvedValue({ id: 'adv-1', name: 'Updated Adventure', campaign: 'My Campaign' }),
      remove: jest.fn().mockResolvedValue({ id: 'adv-1', name: 'Test Adventure' }),
      listNpcs: jest.fn().mockResolvedValue([
        { id: 'npc-1', characterName: 'Goblin', isNpc: true },
      ]),
      createNpc: jest.fn().mockResolvedValue({ id: 'npc-2', characterName: 'Orc', isNpc: true }),
      updateNpc: jest.fn().mockResolvedValue({ id: 'npc-1', characterName: 'Goblin King', isNpc: true }),
      deleteNpc: jest.fn().mockResolvedValue({ id: 'npc-1' }),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdventureController],
      providers: [
        { provide: AdventureService, useValue: mockAdventureService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile()

    controller = module.get<AdventureController>(AdventureController)
  })

  describe('create', () => {
    it('should delegate to adventureService.create with userId and dto', async () => {
      const dto: CreateAdventureDto = { name: 'Test Adventure', campaign: 'My Campaign', maxPlayers: 4 }
      const result = await controller.create(mockReq, dto)
      expect(mockAdventureService.create).toHaveBeenCalledWith('user-1', dto)
      expect(result).toEqual({ id: 'adv-1', name: 'Test Adventure', ownerId: 'user-1' })
    })
  })

  describe('findAll', () => {
    it('should delegate to adventureService.findAllByUser', async () => {
      const result = await controller.findAll(mockReq)
      expect(mockAdventureService.findAllByUser).toHaveBeenCalledWith('user-1')
      expect(result).toEqual([
        { id: 'adv-1', name: 'Test Adventure', role: 'GM', joinedAt: expect.any(Date) },
      ])
    })
  })

  describe('findOne', () => {
    it('should delegate to adventureService.findOne', async () => {
      const result = await controller.findOne(mockReq, 'adv-1')
      expect(mockAdventureService.findOne).toHaveBeenCalledWith('adv-1', 'user-1')
      expect(result).toEqual({ id: 'adv-1', name: 'Test Adventure', campaign: 'My Campaign' })
    })
  })

  describe('update', () => {
    it('should delegate to adventureService.update', async () => {
      const dto: UpdateAdventureDto = { name: 'Updated Adventure' }
      const result = await controller.update(mockReq, 'adv-1', dto)
      expect(mockAdventureService.update).toHaveBeenCalledWith('adv-1', 'user-1', dto)
      expect(result).toEqual({ id: 'adv-1', name: 'Updated Adventure', campaign: 'My Campaign' })
    })
  })

  describe('remove', () => {
    it('should delegate to adventureService.remove', async () => {
      const result = await controller.remove(mockReq, 'adv-1')
      expect(mockAdventureService.remove).toHaveBeenCalledWith('adv-1', 'user-1')
      expect(result).toEqual({ id: 'adv-1', name: 'Test Adventure' })
    })
  })

  // ── NPC / Mob Endpoints ──
  describe('listNpcs', () => {
    it('should delegate to adventureService.listNpcs', async () => {
      const result = await controller.listNpcs(mockReq, 'adv-1')
      expect(mockAdventureService.listNpcs).toHaveBeenCalledWith('adv-1', 'user-1')
      expect(result).toEqual([{ id: 'npc-1', characterName: 'Goblin', isNpc: true }])
    })
  })

  describe('createNpc', () => {
    it('should delegate to adventureService.createNpc with adventureId, userId, and dto', async () => {
      const dto = { name: 'Orc', type: 'NPC' }
      const result = await controller.createNpc(mockReq, 'adv-1', dto)
      expect(mockAdventureService.createNpc).toHaveBeenCalledWith('adv-1', 'user-1', dto)
      expect(result).toEqual({ id: 'npc-2', characterName: 'Orc', isNpc: true })
    })
  })

  describe('updateNpc', () => {
    it('should delegate to adventureService.updateNpc', async () => {
      const dto = { name: 'Goblin King' }
      const result = await controller.updateNpc(mockReq, 'adv-1', 'npc-1', dto)
      expect(mockAdventureService.updateNpc).toHaveBeenCalledWith('adv-1', 'npc-1', 'user-1', dto)
      expect(result).toEqual({ id: 'npc-1', characterName: 'Goblin King', isNpc: true })
    })
  })

  describe('removeNpc', () => {
    it('should delegate to adventureService.deleteNpc', async () => {
      const result = await controller.removeNpc(mockReq, 'adv-1', 'npc-1')
      expect(mockAdventureService.deleteNpc).toHaveBeenCalledWith('adv-1', 'npc-1', 'user-1')
      expect(result).toEqual({ id: 'npc-1' })
    })
  })
})
