jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test } from '@nestjs/testing'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { AdventureService } from './adventure.service'
import { PrismaService } from '../prisma.service'
import { MembershipService } from '../membership/membership.service'
import { CharacterSheetService } from '../character-sheet/character-sheet.service'
import { createMockPrismaService } from '../__mocks__/prisma-service.mock'

const mockMembershipService = {
  requireRole: jest.fn(),
  createMembership: jest.fn().mockResolvedValue({}),
  isMember: jest.fn(),
  getUserAdventures: jest.fn().mockResolvedValue([]),
}

const mockCharacterSheetService = {
  create: jest.fn().mockResolvedValue({ id: 'sheet-1', characterName: 'Goblin' }),
  update: jest.fn().mockResolvedValue({ id: 'sheet-1' }),
  remove: jest.fn().mockResolvedValue(undefined),
  findOne: jest.fn(),
}

describe('AdventureService', () => {
  let service: AdventureService
  let prisma: ReturnType<typeof createMockPrismaService>

  beforeEach(async () => {
    prisma = createMockPrismaService()
    jest.clearAllMocks()

    mockMembershipService.requireRole.mockResolvedValue({ role: 'GM' })
    mockMembershipService.isMember.mockReturnValue(true)

    const module = await Test.createTestingModule({
      providers: [
        AdventureService,
        { provide: PrismaService, useValue: prisma },
        { provide: MembershipService, useValue: mockMembershipService },
        { provide: CharacterSheetService, useValue: mockCharacterSheetService },
      ],
    }).compile()

    service = module.get<AdventureService>(AdventureService)
  })

  describe('create', () => {
    it('creates adventure and membership, returns the created adventure', async () => {
      const dto = { name: 'Test Adv', campaign: 'My Campaign', synopsis: 'Fun!', maxPlayers: 4 }
      const createdAdventure = { id: 'a1', ...dto, ownerId: 'u1' }
      prisma.adventure.create.mockResolvedValue(createdAdventure)

      const result = await service.create('u1', dto)

      expect(result).toEqual(createdAdventure)
      expect(prisma.adventure.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Adv',
          campaign: 'My Campaign',
          synopsis: 'Fun!',
          maxPlayers: 4,
          ownerId: 'u1',
        },
      })
      expect(mockMembershipService.createMembership).toHaveBeenCalledWith('a1', 'u1', 'GM')
    })
  })

  describe('findAllByUser', () => {
    it('delegates to membershipService.getUserAdventures', async () => {
      const adventures = [{ id: 'a1', name: 'Test', role: 'GM', joinedAt: new Date() }]
      mockMembershipService.getUserAdventures.mockResolvedValue(adventures)

      const result = await service.findAllByUser('u1')

      expect(result).toEqual(adventures)
      expect(mockMembershipService.getUserAdventures).toHaveBeenCalledWith('u1')
    })
  })

  describe('findOne', () => {
    it('returns adventure when user is a member', async () => {
      const adventure = { id: 'a1', name: 'Test', campaign: 'Camp' }
      prisma.adventure.findUnique.mockResolvedValue(adventure)
      mockMembershipService.isMember.mockResolvedValue(true)

      const result = await service.findOne('a1', 'u1')

      expect(result).toEqual(adventure)
    })

    it('throws ForbiddenException when user is not a member', async () => {
      prisma.adventure.findUnique.mockResolvedValue({ id: 'a1', name: 'Test' })
      mockMembershipService.isMember.mockResolvedValue(false)

      await expect(service.findOne('a1', 'u1')).rejects.toThrow(ForbiddenException)
      await expect(service.findOne('a1', 'u1')).rejects.toThrow(
        'You are not a member of this adventure',
      )
    })

    it('throws NotFoundException when adventure does not exist', async () => {
      prisma.adventure.findUnique.mockResolvedValue(null)

      await expect(service.findOne('nonexistent', 'u1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('update', () => {
    it('requires GM role and updates adventure', async () => {
      const dto = { name: 'Updated Adv', synopsis: 'Updated!' }
      const updated = { id: 'a1', name: 'Updated Adv', synopsis: 'Updated!', campaign: 'Camp', maxPlayers: 4 }
      prisma.adventure.update.mockResolvedValue(updated)

      const result = await service.update('a1', 'u1', dto)

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith('a1', 'u1', 'GM')
      expect(prisma.adventure.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: {
          name: 'Updated Adv',
          synopsis: 'Updated!',
        },
      })
      expect(result).toEqual(updated)
    })
  })

  describe('remove', () => {
    it('requires GM role and deletes adventure', async () => {
      const deleted = { id: 'a1', name: 'Test' }
      prisma.adventure.delete.mockResolvedValue(deleted)

      const result = await service.remove('a1', 'u1')

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith('a1', 'u1', 'GM')
      expect(prisma.adventure.delete).toHaveBeenCalledWith({ where: { id: 'a1' } })
      expect(result).toEqual(deleted)
    })
  })

  describe('NPC methods', () => {
    describe('listNpcs', () => {
      it('requires GM role and queries characterSheet where isNpc=true', async () => {
        const npcs = [
          { id: 'n1', characterName: 'Goblin', isNpc: true, npcType: 'NPC', level: 1, hpActual: 10, hpMax: 10 },
        ]
        prisma.characterSheet.findMany.mockResolvedValue(npcs)

        const result = await service.listNpcs('a1', 'u1')

        expect(mockMembershipService.requireRole).toHaveBeenCalledWith('a1', 'u1', 'GM')
        expect(prisma.characterSheet.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { adventureId: 'a1', isNpc: true },
            select: expect.objectContaining({
              coreResourceValues: expect.anything(),
            }),
          }),
        )
        expect(result).toEqual(npcs)
      })

      it('maps HP from coreResourceValues when slug=hp is present', async () => {
        const createdAt = new Date('2025-01-01')
        prisma.characterSheet.findMany.mockResolvedValue([
          {
            id: 'n1',
            characterName: 'Goblin',
            isNpc: true,
            npcType: 'NPC',
            level: 1,
            hpActual: 0,
            hpMax: 0,
            createdAt,
            template: { id: 't1', name: 'Goblin Template' },
            coreResourceValues: [
              { current: 25, maximum: 50, coreResource: { slug: 'hp' } },
            ],
          },
        ])

        const result = await service.listNpcs('a1', 'u1')

        expect(result).toHaveLength(1)
        expect(result[0].hpActual).toBe(25)
        expect(result[0].hpMax).toBe(50)
        expect(result[0].characterName).toBe('Goblin')
      })

      it('falls back to DB hpActual/hpMax when coreResourceValues is empty', async () => {
        const createdAt = new Date('2025-01-01')
        prisma.characterSheet.findMany.mockResolvedValue([
          {
            id: 'n2',
            characterName: 'Orc',
            isNpc: true,
            npcType: 'MOB',
            level: 2,
            hpActual: 15,
            hpMax: 20,
            createdAt,
            template: { id: 't1', name: 'Orc Template' },
            coreResourceValues: [],
          },
        ])

        const result = await service.listNpcs('a1', 'u1')

        expect(result[0].hpActual).toBe(15)
        expect(result[0].hpMax).toBe(20)
      })

      it('identifies HP resource among multiple core resources', async () => {
        const createdAt = new Date('2025-01-01')
        prisma.characterSheet.findMany.mockResolvedValue([
          {
            id: 'n3',
            characterName: 'Mage',
            isNpc: true,
            npcType: 'NPC',
            level: 3,
            hpActual: 0,
            hpMax: 0,
            createdAt,
            template: { id: 't1', name: 'Mage Template' },
            coreResourceValues: [
              { current: 10, maximum: 10, coreResource: { slug: 'mp' } },
              { current: 18, maximum: 24, coreResource: { slug: 'hp' } },
              { current: 5, maximum: 5, coreResource: { slug: 'sp' } },
            ],
          },
        ])

        const result = await service.listNpcs('a1', 'u1')

        expect(result[0].hpActual).toBe(18)
        expect(result[0].hpMax).toBe(24)
      })

      it('falls back to DB values when HP resource has null current/maximum', async () => {
        const createdAt = new Date('2025-01-01')
        prisma.characterSheet.findMany.mockResolvedValue([
          {
            id: 'n4',
            characterName: 'Undead',
            isNpc: true,
            npcType: 'NPC',
            level: 1,
            hpActual: 8,
            hpMax: 12,
            createdAt,
            template: { id: 't1', name: 'Undead Template' },
            coreResourceValues: [
              { current: null, maximum: null, coreResource: { slug: 'hp' } },
            ],
          },
        ])

        const result = await service.listNpcs('a1', 'u1')

        // nullish coalescing — null ?? value gives value (legacy fallback)
        expect(result[0].hpActual).toBe(8)
        expect(result[0].hpMax).toBe(12)
      })

      it('handles multiple NPCs each mapped independently', async () => {
        const createdAt = new Date('2025-01-01')
        prisma.characterSheet.findMany.mockResolvedValue([
          {
            id: 'n5',
            characterName: 'Dragon',
            isNpc: true,
            npcType: 'NPC',
            level: 10,
            hpActual: 0,
            hpMax: 0,
            createdAt,
            template: { id: 't1', name: 'Dragon Template' },
            coreResourceValues: [
              { current: 120, maximum: 200, coreResource: { slug: 'hp' } },
            ],
          },
          {
            id: 'n6',
            characterName: 'Rat',
            isNpc: true,
            npcType: 'MOB',
            level: 1,
            hpActual: 5,
            hpMax: 5,
            createdAt,
            template: { id: 't1', name: 'Rat Template' },
            coreResourceValues: [],
          },
        ])

        const result = await service.listNpcs('a1', 'u1')

        expect(result).toHaveLength(2)
        expect(result[0].hpActual).toBe(120)
        expect(result[0].hpMax).toBe(200)
        expect(result[1].hpActual).toBe(5)
        expect(result[1].hpMax).toBe(5)
      })
    })

    describe('createNpc', () => {
      it('requires GM role, creates sheet, updates to NPC', async () => {
        prisma.adventure.findUnique.mockResolvedValue({
          id: 'a1',
          templates: [{ id: 't1' }],
        })
        mockCharacterSheetService.create.mockResolvedValue({ id: 'sheet-1' })
        prisma.characterSheet.update.mockResolvedValue({
          id: 'sheet-1',
          characterName: 'Goblin King',
          isNpc: true,
          npcType: 'NPC',
          level: 1,
          hpActual: 0,
          hpMax: 0,
          template: { id: 't1', name: 'Template' },
          coreResourceValues: [],
        })

        const result = await service.createNpc('a1', 'u1', { name: 'Goblin King', type: 'NPC' })

        expect(mockMembershipService.requireRole).toHaveBeenCalledWith('a1', 'u1', 'GM')
        expect(mockCharacterSheetService.create).toHaveBeenCalled()
        expect(prisma.characterSheet.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'sheet-1' },
            data: expect.objectContaining({
              isNpc: true,
              npcType: 'NPC',
              ownerId: null,
            }),
          }),
        )
        expect(result).toBeDefined()
        expect(result.hpActual).toBe(0)
        expect(result.hpMax).toBe(0)
      })

      it('throws NotFoundException when adventure has no template', async () => {
        prisma.adventure.findUnique.mockResolvedValue({
          id: 'a1',
          templates: [],
        })

        await expect(
          service.createNpc('a1', 'u1', { name: 'Ghost' }),
        ).rejects.toThrow(NotFoundException)
      })

      it('maps HP from coreResourceValues on create', async () => {
        prisma.adventure.findUnique.mockResolvedValue({
          id: 'a1',
          templates: [{ id: 't1' }],
        })
        mockCharacterSheetService.create.mockResolvedValue({ id: 'sheet-1' })
        prisma.characterSheet.update.mockResolvedValue({
          id: 'sheet-1',
          characterName: 'Goblin King',
          isNpc: true,
          npcType: 'NPC',
          level: 1,
          hpActual: 0,
          hpMax: 0,
          template: { id: 't1', name: 'Template' },
          coreResourceValues: [
            { current: 30, maximum: 60, coreResource: { slug: 'hp' } },
          ],
        })

        const result = await service.createNpc('a1', 'u1', { name: 'Goblin King', type: 'NPC' })

        expect(result.hpActual).toBe(30)
        expect(result.hpMax).toBe(60)
      })

      it('falls back to DB values when no HP coreResource on create', async () => {
        prisma.adventure.findUnique.mockResolvedValue({
          id: 'a1',
          templates: [{ id: 't1' }],
        })
        mockCharacterSheetService.create.mockResolvedValue({ id: 'sheet-1' })
        prisma.characterSheet.update.mockResolvedValue({
          id: 'sheet-1',
          characterName: 'Orc',
          isNpc: true,
          npcType: 'MOB',
          level: 2,
          hpActual: 15,
          hpMax: 20,
          template: { id: 't1', name: 'Template' },
          coreResourceValues: [],
        })

        const result = await service.createNpc('a1', 'u1', { name: 'Orc', type: 'MOB' })

        expect(result.hpActual).toBe(15)
        expect(result.hpMax).toBe(20)
      })
    })

    describe('updateNpc', () => {
      it('requires GM role and verifies NPC belongs to adventure', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: 'n1',
          adventureId: 'a1',
          isNpc: true,
        })

        await service.updateNpc('a1', 'n1', 'u1', { name: 'Updated Goblin' })

        expect(mockMembershipService.requireRole).toHaveBeenCalledWith('a1', 'u1', 'GM')
        expect(mockCharacterSheetService.update).toHaveBeenCalledWith(
          'n1',
          'u1',
          expect.objectContaining({ characterName: 'Updated Goblin' }),
        )
      })

      it('throws ForbiddenException when NPC does not belong to adventure', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: 'n1',
          adventureId: 'other-adventure',
          isNpc: true,
        })

        await expect(
          service.updateNpc('a1', 'n1', 'u1', { name: 'Evil' }),
        ).rejects.toThrow(ForbiddenException)
      })
    })

    describe('deleteNpc', () => {
      it('requires GM role and verifies NPC belongs to adventure', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: 'n1',
          adventureId: 'a1',
          isNpc: true,
        })

        await service.deleteNpc('a1', 'n1', 'u1')

        expect(mockMembershipService.requireRole).toHaveBeenCalledWith('a1', 'u1', 'GM')
        expect(mockCharacterSheetService.remove).toHaveBeenCalledWith('n1', 'u1')
      })

      it('throws NotFoundException when NPC not found', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(null)

        await expect(service.deleteNpc('a1', 'nonexistent', 'u1')).rejects.toThrow(
          NotFoundException,
        )
      })

      it('throws ForbiddenException when NPC does not belong to the adventure', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: 'n1',
          adventureId: 'other-adventure',
          isNpc: true,
        })

        await expect(service.deleteNpc('a1', 'n1', 'u1')).rejects.toThrow(
          ForbiddenException,
        )
      })
    })
  })
})
