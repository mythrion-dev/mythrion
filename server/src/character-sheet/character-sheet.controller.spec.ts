jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test, TestingModule } from '@nestjs/testing'
import { CharacterSheetController } from './character-sheet.controller.js'
import { CharacterSheetService } from './character-sheet.service.js'
import { ResistanceCalculationService } from './resistance-calculation.service.js'
import { AcCalculationService } from './ac-calculation.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import { CreateCharacterSheetDto } from './dto/create-character-sheet.dto.js'
import { CreateCharacterFromCampaignDto } from './dto/create-character-from-campaign.dto.js'
import { UpdateCharacterSheetDto } from './dto/update-character-sheet.dto.js'
import type { AuthenticatedRequest } from '../auth/AuthenticatedRequest.js'

describe('CharacterSheetController', () => {
  let controller: CharacterSheetController
  let mockSheetService: Record<string, jest.Mock>
  let mockResistanceService: Record<string, jest.Mock>
  let mockAcService: Record<string, jest.Mock>

  const mockReq = {
    user: { sub: 'user-1', email: 'test@test.com' },
  } as unknown as AuthenticatedRequest

  beforeEach(async () => {
    jest.clearAllMocks()

    mockSheetService = {
      create: jest.fn().mockResolvedValue({ id: 'sheet-1', characterName: 'Test Hero' }),
      findAllByUser: jest.fn().mockResolvedValue([{ id: 'sheet-1', characterName: 'Test Hero' }]),
      findAllByAdventure: jest.fn().mockResolvedValue([{ id: 'sheet-1', characterName: 'Test Hero', isNpc: false }]),
      findOne: jest.fn().mockResolvedValue({ id: 'sheet-1', characterName: 'Test Hero' }),
      update: jest.fn().mockResolvedValue({ id: 'sheet-1', characterName: 'Updated Hero' }),
      remove: jest.fn().mockResolvedValue({ id: 'sheet-1' }),
      linkToAdventure: jest.fn().mockResolvedValue({ id: 'sheet-1', adventureId: 'adv-1' }),
      unlinkFromAdventure: jest.fn().mockResolvedValue({ id: 'sheet-1', adventureId: null }),
      updateSkillProfileValue: jest.fn().mockResolvedValue({ success: true }),
      updateSkillAttribute: jest.fn().mockResolvedValue({ success: true }),
      listAbilities: jest.fn().mockResolvedValue([{ id: 'ab-1', name: 'Fireball' }]),
      createAbility: jest.fn().mockResolvedValue({ id: 'ab-2', name: 'Ice Storm' }),
      updateAbility: jest.fn().mockResolvedValue({ id: 'ab-1', name: 'Fireball II' }),
      removeAbility: jest.fn().mockResolvedValue(undefined),
      listSummonAbilities: jest.fn().mockResolvedValue([{ id: 'sa-1', name: 'Pet Attack' }]),
      createSummonAbility: jest.fn().mockResolvedValue({ id: 'sa-2', name: 'Pet Heal' }),
      listAbilityLevels: jest.fn().mockResolvedValue([{ id: 'al-1', level: '1' }]),
      createAbilityLevel: jest.fn().mockResolvedValue({ id: 'al-2', level: '2' }),
      updateAbilityLevel: jest.fn().mockResolvedValue({ id: 'al-1', level: '2' }),
      deleteAbilityLevel: jest.fn().mockResolvedValue(undefined),
      addSummonSkill: jest.fn().mockResolvedValue({ id: 'ss-1', name: 'Bite', manualValue: 5 }),
      removeSummonSkill: jest.fn().mockResolvedValue(undefined),
      updateSummonAttribute: jest.fn().mockResolvedValue({ success: true }),
      updateSummonAcValue: jest.fn().mockResolvedValue({ success: true }),
      updateSummonHealth: jest.fn().mockResolvedValue({ success: true }),
      listInventory: jest.fn().mockResolvedValue([{ id: 'item-1', name: 'Sword' }]),
      createInventoryItem: jest.fn().mockResolvedValue({ id: 'item-2', name: 'Shield' }),
      updateInventoryItem: jest.fn().mockResolvedValue({ id: 'item-1', name: 'Iron Sword' }),
      removeInventoryItem: jest.fn().mockResolvedValue(undefined),
      getStory: jest.fn().mockResolvedValue({ appearance: 'Tall', backstory: 'Hero' }),
      updateStory: jest.fn().mockResolvedValue({ appearance: 'Short', backstory: 'Hero' }),
      listSectionEntries: jest.fn().mockResolvedValue([{ id: 'entry-1', name: 'Notes' }]),
      createSectionEntry: jest.fn().mockResolvedValue({ id: 'entry-2', name: 'More Notes' }),
      updateSectionEntry: jest.fn().mockResolvedValue({ id: 'entry-1', name: 'Updated Notes' }),
      removeSectionEntry: jest.fn().mockResolvedValue(undefined),
      createResistance: jest.fn().mockResolvedValue({ id: 'res-1', name: 'Fire' }),
      removeResistance: jest.fn().mockResolvedValue(undefined),
      listProfessionalSkills: jest.fn().mockResolvedValue([{ id: 'ps-1', name: 'Crafting' }]),
      createProfessionalSkill: jest.fn().mockResolvedValue({ id: 'ps-2', name: 'Alchemy' }),
      updateProfessionalSkill: jest.fn().mockResolvedValue({ id: 'ps-1', name: 'Master Crafting' }),
      removeProfessionalSkill: jest.fn().mockResolvedValue(undefined),
      updateProfessionalSkillProfileValue: jest.fn().mockResolvedValue({ success: true }),
      createFromCampaignSnapshot: jest.fn().mockResolvedValue({ id: 'cs-campaign-1', characterName: 'Campaign Hero' }),
    }

    mockResistanceService = {
      calculateResistances: jest.fn().mockResolvedValue([
        { resistanceId: 'res-1', name: 'Fire', total: 10 },
      ]),
      calculateSingleResistance: jest.fn().mockResolvedValue(
        { resistanceId: 'res-1', name: 'Fire', total: 10 },
      ),
    }

    mockAcService = {
      calculateArmorClass: jest.fn().mockResolvedValue({
        total: 15,
        armorClassName: 'Natural Armor',
        fieldBreakdown: [],
        attributeModifierBreakdown: [],
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CharacterSheetController],
      providers: [
        { provide: CharacterSheetService, useValue: mockSheetService },
        { provide: ResistanceCalculationService, useValue: mockResistanceService },
        { provide: AcCalculationService, useValue: mockAcService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile()

    controller = module.get<CharacterSheetController>(CharacterSheetController)
  })

  // ── CRUD ──
  describe('create', () => {
    it('should delegate to sheetService.create with userId and dto', async () => {
      const dto: CreateCharacterSheetDto = { characterName: 'Test Hero', templateId: 'tmpl-1' }
      const result = await controller.create(mockReq, dto)
      expect(mockSheetService.create).toHaveBeenCalledWith('user-1', dto)
      expect(result).toEqual({ id: 'sheet-1', characterName: 'Test Hero' })
    })
  })

  describe('createFromCampaign', () => {
    it('should delegate to sheetService.createFromCampaignSnapshot with userId and dto', async () => {
      const dto: CreateCharacterFromCampaignDto = { characterName: 'Campaign Hero', adventureId: 'adv-1' }
      const result = await controller.createFromCampaign(mockReq, dto)
      expect(mockSheetService.createFromCampaignSnapshot).toHaveBeenCalledWith('user-1', dto)
      expect(result).toEqual({ id: 'cs-campaign-1', characterName: 'Campaign Hero' })
    })

    it('should propagate service errors', async () => {
      mockSheetService.createFromCampaignSnapshot.mockRejectedValueOnce(new Error('Service error'))
      const dto: CreateCharacterFromCampaignDto = { characterName: 'Hero', adventureId: 'adv-campaign' }
      await expect(controller.createFromCampaign(mockReq, dto)).rejects.toThrow('Service error')
    })
  })

  describe('findAllByUser', () => {
    it('should delegate to sheetService.findAllByUser', async () => {
      const result = await controller.findAllByUser(mockReq)
      expect(mockSheetService.findAllByUser).toHaveBeenCalledWith('user-1')
      expect(result).toEqual([{ id: 'sheet-1', characterName: 'Test Hero' }])
    })
  })

  describe('findAllByAdventure', () => {
    it('should delegate to sheetService.findAllByAdventure', async () => {
      const result = await controller.findAllByAdventure(mockReq, 'adv-1')
      expect(mockSheetService.findAllByAdventure).toHaveBeenCalledWith('adv-1', 'user-1')
      expect(result).toEqual([{ id: 'sheet-1', characterName: 'Test Hero', isNpc: false }])
    })
  })

  describe('findOne', () => {
    it('should delegate to sheetService.findOne', async () => {
      const result = await controller.findOne(mockReq, 'sheet-1')
      expect(mockSheetService.findOne).toHaveBeenCalledWith('sheet-1', 'user-1')
      expect(result).toEqual({ id: 'sheet-1', characterName: 'Test Hero' })
    })
  })

  describe('update', () => {
    it('should delegate to sheetService.update with id, userId, and dto', async () => {
      const dto: UpdateCharacterSheetDto = { characterName: 'Updated Hero' }
      const result = await controller.update(mockReq, 'sheet-1', dto)
      expect(mockSheetService.update).toHaveBeenCalledWith('sheet-1', 'user-1', dto)
      expect(result).toEqual({ id: 'sheet-1', characterName: 'Updated Hero' })
    })
  })

  describe('remove', () => {
    it('should delegate to sheetService.remove', async () => {
      const result = await controller.remove(mockReq, 'sheet-1')
      expect(mockSheetService.remove).toHaveBeenCalledWith('sheet-1', 'user-1')
      expect(result).toEqual({ id: 'sheet-1' })
    })
  })

  // ── Adventure Linking ──
  describe('linkToAdventure', () => {
    it('should delegate to sheetService.linkToAdventure', async () => {
      const result = await controller.linkToAdventure(mockReq, 'sheet-1', 'adv-1')
      expect(mockSheetService.linkToAdventure).toHaveBeenCalledWith('sheet-1', 'adv-1', 'user-1')
      expect(result).toEqual({ id: 'sheet-1', adventureId: 'adv-1' })
    })
  })

  describe('unlinkFromAdventure', () => {
    it('should delegate to sheetService.unlinkFromAdventure', async () => {
      const result = await controller.unlinkFromAdventure(mockReq, 'sheet-1')
      expect(mockSheetService.unlinkFromAdventure).toHaveBeenCalledWith('sheet-1', 'user-1')
      expect(result).toEqual({ id: 'sheet-1', adventureId: null })
    })
  })

  // ── Skills ──
  describe('updateSkillProfileValue', () => {
    it('should delegate to sheetService.updateSkillProfileValue', async () => {
      const result = await controller.updateSkillProfileValue(mockReq, 'sheet-1', 'skill-1', 'profile-1', 'opt-1')
      expect(mockSheetService.updateSkillProfileValue).toHaveBeenCalledWith('sheet-1', 'skill-1', 'profile-1', 'opt-1', 'user-1')
      expect(result).toEqual({ success: true })
    })
  })

  describe('updateSkillAttribute', () => {
    it('should delegate to sheetService.updateSkillAttribute', async () => {
      const result = await controller.updateSkillAttribute(mockReq, 'sheet-1', 'skill-1', 'attr-1')
      expect(mockSheetService.updateSkillAttribute).toHaveBeenCalledWith('sheet-1', 'skill-1', 'attr-1', 'user-1')
      expect(result).toEqual({ success: true })
    })
  })

  // ── Abilities & Summons ──
  describe('listAbilities', () => {
    it('should delegate to sheetService.listAbilities', async () => {
      const result = await controller.listAbilities(mockReq, 'sheet-1')
      expect(mockSheetService.listAbilities).toHaveBeenCalledWith('sheet-1', 'user-1')
      expect(result).toEqual([{ id: 'ab-1', name: 'Fireball' }])
    })
  })

  describe('createAbility', () => {
    it('should delegate to sheetService.createAbility', async () => {
      const dto = { name: 'Ice Storm', type: 'Offensive' }
      const result = await controller.createAbility(mockReq, 'sheet-1', dto)
      expect(mockSheetService.createAbility).toHaveBeenCalledWith('sheet-1', 'user-1', dto)
      expect(result).toEqual({ id: 'ab-2', name: 'Ice Storm' })
    })
  })

  describe('updateAbility', () => {
    it('should delegate to sheetService.updateAbility', async () => {
      const dto = { name: 'Fireball II' }
      const result = await controller.updateAbility(mockReq, 'sheet-1', 'ab-1', dto)
      expect(mockSheetService.updateAbility).toHaveBeenCalledWith('ab-1', 'user-1', dto)
      expect(result).toEqual({ id: 'ab-1', name: 'Fireball II' })
    })
  })

  describe('removeAbility', () => {
    it('should delegate to sheetService.removeAbility', async () => {
      const result = await controller.removeAbility(mockReq, 'sheet-1', 'ab-1')
      expect(mockSheetService.removeAbility).toHaveBeenCalledWith('ab-1', 'user-1')
      expect(result).toBeUndefined()
    })
  })

  // ── Summon-scoped abilities ──
  describe('listSummonAbilities', () => {
    it('should delegate to sheetService.listSummonAbilities', async () => {
      // Method only extracts @Param('abilityId') — no :id param
      const result = await controller.listSummonAbilities(mockReq, 'ab-1')
      expect(mockSheetService.listSummonAbilities).toHaveBeenCalledWith('ab-1', 'user-1')
      expect(result).toEqual([{ id: 'sa-1', name: 'Pet Attack' }])
    })
  })

  describe('createSummonAbility', () => {
    it('should delegate to sheetService.createSummonAbility', async () => {
      const dto = { name: 'Pet Heal' }
      // Method only extracts @Param('abilityId') and @Body()
      const result = await controller.createSummonAbility(mockReq, 'ab-1', dto)
      expect(mockSheetService.createSummonAbility).toHaveBeenCalledWith('ab-1', 'user-1', dto)
      expect(result).toEqual({ id: 'sa-2', name: 'Pet Heal' })
    })
  })

  // ── Ability Levels ──
  describe('listAbilityLevels', () => {
    it('should delegate to sheetService.listAbilityLevels', async () => {
      // Method only extracts @Param('abilityId')
      const result = await controller.listAbilityLevels(mockReq, 'ab-1')
      expect(mockSheetService.listAbilityLevels).toHaveBeenCalledWith('ab-1', 'user-1')
      expect(result).toEqual([{ id: 'al-1', level: '1' }])
    })
  })

  describe('createAbilityLevel', () => {
    it('should delegate to sheetService.createAbilityLevel', async () => {
      const dto = { level: '2' }
      // Method only extracts @Param('abilityId') and @Body()
      const result = await controller.createAbilityLevel(mockReq, 'ab-1', dto)
      expect(mockSheetService.createAbilityLevel).toHaveBeenCalledWith('ab-1', 'user-1', dto)
      expect(result).toEqual({ id: 'al-2', level: '2' })
    })
  })

  describe('updateAbilityLevel', () => {
    it('should delegate to sheetService.updateAbilityLevel', async () => {
      const dto = { level: '2' }
      // Method only extracts @Param('levelId') and @Body()
      const result = await controller.updateAbilityLevel(mockReq, 'al-1', dto)
      expect(mockSheetService.updateAbilityLevel).toHaveBeenCalledWith('al-1', 'user-1', dto)
      expect(result).toEqual({ id: 'al-1', level: '2' })
    })
  })

  describe('removeAbilityLevel', () => {
    it('should delegate to sheetService.deleteAbilityLevel', async () => {
      // Method only extracts @Param('levelId')
      const result = await controller.removeAbilityLevel(mockReq, 'al-1')
      expect(mockSheetService.deleteAbilityLevel).toHaveBeenCalledWith('al-1', 'user-1')
      expect(result).toBeUndefined()
    })
  })

  // ── Summon Skills ──
  describe('addSummonSkill', () => {
    it('should delegate to sheetService.addSummonSkill with name and manualValue', async () => {
      // Method extracts @Param('abilityId'), @Body('name'), and @Body('manualValue')
      const result = await controller.addSummonSkill(mockReq, 'ab-1', 'Bite', 5)
      expect(mockSheetService.addSummonSkill).toHaveBeenCalledWith('ab-1', 'Bite', 5, 'user-1')
      expect(result).toEqual({ id: 'ss-1', name: 'Bite', manualValue: 5 })
    })
  })

  describe('removeSummonSkill', () => {
    it('should delegate to sheetService.removeSummonSkill', async () => {
      // Method only extracts @Param('summonSkillId')
      const result = await controller.removeSummonSkill(mockReq, 'ss-1')
      expect(mockSheetService.removeSummonSkill).toHaveBeenCalledWith('ss-1', 'user-1')
      expect(result).toBeUndefined()
    })
  })

  // ── Summon Attributes ──
  describe('updateSummonAttribute', () => {
    it('should delegate to sheetService.updateSummonAttribute', async () => {
      // Method extracts @Param('abilityId'), @Param('attributeId'), @Body('value')
      const result = await controller.updateSummonAttribute(mockReq, 'ab-1', 'attr-1', '10')
      expect(mockSheetService.updateSummonAttribute).toHaveBeenCalledWith('ab-1', 'attr-1', '10', 'user-1')
      expect(result).toEqual({ success: true })
    })
  })

  // ── Summon AC ──
  describe('updateSummonAcValue', () => {
    it('should delegate to sheetService.updateSummonAcValue without fieldId', async () => {
      // Method extracts @Param('abilityId') and @Body('value') — no fieldId param
      const result = await controller.updateSummonAcValue(mockReq, 'ab-1', '18')
      expect(mockSheetService.updateSummonAcValue).toHaveBeenCalledWith('ab-1', '18', 'user-1')
      expect(result).toEqual({ success: true })
    })
  })

  // ── Summon Health ──
  describe('updateSummonHealth', () => {
    it('should delegate to sheetService.updateSummonHealth', async () => {
      const dto = { current: 20, maximum: 30 }
      // Method extracts @Param('abilityId') and @Body()
      const result = await controller.updateSummonHealth(mockReq, 'ab-1', dto)
      expect(mockSheetService.updateSummonHealth).toHaveBeenCalledWith('ab-1', 'user-1', dto)
      expect(result).toEqual({ success: true })
    })
  })

  // ── Inventory ──
  describe('listInventory', () => {
    it('should delegate to sheetService.listInventory', async () => {
      const result = await controller.listInventory(mockReq, 'sheet-1')
      expect(mockSheetService.listInventory).toHaveBeenCalledWith('sheet-1', 'user-1')
      expect(result).toEqual([{ id: 'item-1', name: 'Sword' }])
    })
  })

  describe('createInventoryItem', () => {
    it('should delegate to sheetService.createInventoryItem', async () => {
      const dto = { name: 'Shield', weight: 5 }
      const result = await controller.createInventoryItem(mockReq, 'sheet-1', dto)
      expect(mockSheetService.createInventoryItem).toHaveBeenCalledWith('sheet-1', 'user-1', dto)
      expect(result).toEqual({ id: 'item-2', name: 'Shield' })
    })
  })

  describe('updateInventoryItem', () => {
    it('should delegate to sheetService.updateInventoryItem', async () => {
      const dto = { name: 'Iron Sword' }
      const result = await controller.updateInventoryItem(mockReq, 'sheet-1', 'item-1', dto)
      expect(mockSheetService.updateInventoryItem).toHaveBeenCalledWith('item-1', 'user-1', dto)
      expect(result).toEqual({ id: 'item-1', name: 'Iron Sword' })
    })
  })

  describe('removeInventoryItem', () => {
    it('should delegate to sheetService.removeInventoryItem', async () => {
      const result = await controller.removeInventoryItem(mockReq, 'sheet-1', 'item-1')
      expect(mockSheetService.removeInventoryItem).toHaveBeenCalledWith('item-1', 'user-1')
      expect(result).toBeUndefined()
    })
  })

  // ── Story ──
  describe('getStory', () => {
    it('should delegate to sheetService.getStory', async () => {
      const result = await controller.getStory(mockReq, 'sheet-1')
      expect(mockSheetService.getStory).toHaveBeenCalledWith('sheet-1', 'user-1')
      expect(result).toEqual({ appearance: 'Tall', backstory: 'Hero' })
    })
  })

  describe('updateStory', () => {
    it('should delegate to sheetService.updateStory', async () => {
      const dto = { appearance: 'Short', backstory: 'Hero' }
      const result = await controller.updateStory(mockReq, 'sheet-1', dto)
      expect(mockSheetService.updateStory).toHaveBeenCalledWith('sheet-1', 'user-1', dto)
      expect(result).toEqual({ appearance: 'Short', backstory: 'Hero' })
    })
  })

  // ── Character Section Entries ──
  describe('listSectionEntries', () => {
    it('should delegate to sheetService.listSectionEntries', async () => {
      const result = await controller.listSectionEntries(mockReq, 'sheet-1')
      expect(mockSheetService.listSectionEntries).toHaveBeenCalledWith('sheet-1', 'user-1')
      expect(result).toEqual([{ id: 'entry-1', name: 'Notes' }])
    })
  })

  describe('createSectionEntry', () => {
    it('should delegate to sheetService.createSectionEntry', async () => {
      const dto = { sectionId: 'sec-1', name: 'More Notes' }
      const result = await controller.createSectionEntry(mockReq, 'sheet-1', dto)
      expect(mockSheetService.createSectionEntry).toHaveBeenCalledWith('sheet-1', 'user-1', dto)
      expect(result).toEqual({ id: 'entry-2', name: 'More Notes' })
    })
  })

  describe('updateSectionEntry', () => {
    it('should delegate to sheetService.updateSectionEntry', async () => {
      const dto = { name: 'Updated Notes' }
      // Method only extracts @Param('entryId') and @Body()
      const result = await controller.updateSectionEntry(mockReq, 'entry-1', dto)
      expect(mockSheetService.updateSectionEntry).toHaveBeenCalledWith('entry-1', 'user-1', dto)
      expect(result).toEqual({ id: 'entry-1', name: 'Updated Notes' })
    })
  })

  describe('removeSectionEntry', () => {
    it('should delegate to sheetService.removeSectionEntry', async () => {
      // Method only extracts @Param('entryId')
      const result = await controller.removeSectionEntry(mockReq, 'entry-1')
      expect(mockSheetService.removeSectionEntry).toHaveBeenCalledWith('entry-1', 'user-1')
      expect(result).toBeUndefined()
    })
  })

  // ── Resistance Calculations ──
  describe('getCalculatedResistances', () => {
    it('should delegate to resistanceService.calculateResistances', async () => {
      const result = await controller.getCalculatedResistances(mockReq, 'sheet-1')
      expect(mockResistanceService.calculateResistances).toHaveBeenCalledWith('sheet-1')
      expect(result).toEqual([{ resistanceId: 'res-1', name: 'Fire', total: 10 }])
    })
  })

  describe('getCalculatedResistance', () => {
    it('should delegate to resistanceService.calculateSingleResistance', async () => {
      const result = await controller.getCalculatedResistance(mockReq, 'sheet-1', 'res-1')
      expect(mockResistanceService.calculateSingleResistance).toHaveBeenCalledWith('sheet-1', 'res-1')
      expect(result).toEqual({ resistanceId: 'res-1', name: 'Fire', total: 10 })
    })
  })

  describe('createResistance', () => {
    it('should delegate to sheetService.createResistance', async () => {
      const dto = { name: 'Fire', calculationType: 'MANUAL' as const }
      const result = await controller.createResistance(mockReq, 'sheet-1', dto)
      expect(mockSheetService.createResistance).toHaveBeenCalledWith('sheet-1', 'user-1', dto)
      expect(result).toEqual({ id: 'res-1', name: 'Fire' })
    })
  })

  describe('removeResistance', () => {
    it('should delegate to sheetService.removeResistance', async () => {
      const result = await controller.removeResistance(mockReq, 'sheet-1', 'res-1')
      expect(mockSheetService.removeResistance).toHaveBeenCalledWith('sheet-1', 'res-1', 'user-1')
      expect(result).toBeUndefined()
    })
  })

  // ── Professional Skills ──
  describe('listProfessionalSkills', () => {
    it('should delegate to sheetService.listProfessionalSkills', async () => {
      const result = await controller.listProfessionalSkills(mockReq, 'sheet-1')
      expect(mockSheetService.listProfessionalSkills).toHaveBeenCalledWith('sheet-1', 'user-1')
      expect(result).toEqual([{ id: 'ps-1', name: 'Crafting' }])
    })
  })

  describe('createProfessionalSkill', () => {
    it('should delegate to sheetService.createProfessionalSkill', async () => {
      const dto = { name: 'Alchemy' }
      const result = await controller.createProfessionalSkill(mockReq, 'sheet-1', dto)
      expect(mockSheetService.createProfessionalSkill).toHaveBeenCalledWith('sheet-1', 'user-1', dto)
      expect(result).toEqual({ id: 'ps-2', name: 'Alchemy' })
    })
  })

  describe('updateProfessionalSkill', () => {
    it('should delegate to sheetService.updateProfessionalSkill', async () => {
      const dto = { name: 'Master Crafting' }
      // Method only extracts @Param('skillId') and @Body()
      const result = await controller.updateProfessionalSkill(mockReq, 'ps-1', dto)
      expect(mockSheetService.updateProfessionalSkill).toHaveBeenCalledWith('ps-1', 'user-1', dto)
      expect(result).toEqual({ id: 'ps-1', name: 'Master Crafting' })
    })
  })

  describe('removeProfessionalSkill', () => {
    it('should delegate to sheetService.removeProfessionalSkill', async () => {
      // Method only extracts @Param('skillId')
      const result = await controller.removeProfessionalSkill(mockReq, 'ps-1')
      expect(mockSheetService.removeProfessionalSkill).toHaveBeenCalledWith('ps-1', 'user-1')
      expect(result).toBeUndefined()
    })
  })

  describe('updateProfessionalSkillProfileValue', () => {
    it('should delegate to sheetService.updateProfessionalSkillProfileValue', async () => {
      const result = await controller.updateProfessionalSkillProfileValue(mockReq, 'sheet-1', 'ps-1', 'profile-1', 'opt-1')
      expect(mockSheetService.updateProfessionalSkillProfileValue).toHaveBeenCalledWith('sheet-1', 'ps-1', 'profile-1', 'opt-1', 'user-1')
      expect(result).toEqual({ success: true })
    })
  })

  // ── Armor Class Calculation ──
  describe('getCalculatedArmorClass', () => {
    it('should delegate to acService.calculateArmorClass without armorClassId', async () => {
      const result = await controller.getCalculatedArmorClass(mockReq, 'sheet-1')
      expect(mockAcService.calculateArmorClass).toHaveBeenCalledWith('sheet-1', undefined)
      expect(result).toEqual({ total: 15, armorClassName: 'Natural Armor', fieldBreakdown: [], attributeModifierBreakdown: [] })
    })

    it('should delegate to acService.calculateArmorClass with armorClassId', async () => {
      const result = await controller.getCalculatedArmorClass(mockReq, 'sheet-1', 'ac-1')
      expect(mockAcService.calculateArmorClass).toHaveBeenCalledWith('sheet-1', 'ac-1')
      expect(result).toEqual({ total: 15, armorClassName: 'Natural Armor', fieldBreakdown: [], attributeModifierBreakdown: [] })
    })
  })
})
