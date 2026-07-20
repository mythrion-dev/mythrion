jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
import { Test } from '@nestjs/testing'
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common'
import { CharacterSheetService } from './character-sheet.service.js'
import { PrismaService } from '../prisma.service.js'
import { MembershipService } from '../membership/membership.service.js'
import { RedisService } from '../redis/redis.service.js'
import { createMockPrismaService } from '../__mocks__/prisma-service.mock.js'

const mockMembershipService = {
  requireRole: jest.fn().mockResolvedValue({ role: 'GM' }),
  isMember: jest.fn().mockResolvedValue(true),
  assertPlayerCapacity: jest.fn().mockResolvedValue(undefined),
  createMembership: jest.fn().mockResolvedValue({}),
  countPlayers: jest.fn().mockResolvedValue(0),
}

const mockRedisService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  setex: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  ready: true,
  client: null,
}

describe('CharacterSheetService', () => {
  let service: CharacterSheetService
  let prisma: any

  beforeAll(() => {
    jest.useFakeTimers({ now: new Date('2025-06-15T12:00:00.000Z') })
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    prisma = createMockPrismaService()
    mockRedisService.cacheGet.mockResolvedValue(null)
    mockRedisService.del.mockResolvedValue(undefined)

    const module = await Test.createTestingModule({
      providers: [
        CharacterSheetService,
        { provide: PrismaService, useValue: prisma },
        { provide: MembershipService, useValue: mockMembershipService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile()

    service = module.get<CharacterSheetService>(CharacterSheetService)
  })

  // ── core CRUD ─────────────────────────────────────────────

  describe('core CRUD', () => {
    const userId = 'user-1'
    const sheetId = 'sheet-1'
    const adventureId = 'adventure-1'

    const mockDate = new Date('2025-01-01T00:00:00.000Z')

    const mockTemplate = {
      id: 'template-1',
      adventureId: null,
      skillFormula: null,
      attributes: [
        { id: 'attr-1', key: 'str', name: 'Strength', order: 0 },
        { id: 'attr-2', key: 'dex', name: 'Dexterity', order: 1 },
      ],
      templateFields: [
        { id: 'field-1', key: 'height', label: 'Height' },
      ],
      templateSkills: [
        { id: 'skill-1', name: 'Athletics', description: '', templateId: 'template-1', order: 0, attributeId: 'attr-1', defaultAttributeId: 'attr-1', allowedAttributeIds: ['attr-1'] },
      ],
      skillModifierProfiles: [],
      coreResources: [
        { id: 'cr-1', displayName: 'HP', slug: 'hp', enabled: true, order: 0 },
        { id: 'cr-2', displayName: 'MP', slug: 'mp', enabled: false, order: 1 },
      ],
    }

    const mockArmorClasses = [
      {
        id: 'ac-1', templateId: 'template-1', name: 'Armor Class', enabled: true, order: 0, createdAt: mockDate,
        fields: [
          { id: 'ac-field-1', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: '', order: 0, armorClassId: 'ac-1' },
        ],
        attributeModifiers: [
          { id: 'ac-mod-1', armorClassId: 'ac-1', attributeId: 'attr-2', defaultAttributeId: 'attr-2', allowPlayerSelection: true, enabled: true, createdAt: mockDate },
        ],
      },
    ]

    const mockResistances = [
      {
        id: 'res-1', templateId: 'template-1', name: 'Damage Resistance', order: 0,
        components: [
          { id: 'res-comp-1', resistanceId: 'res-1', name: 'Base', order: 0, editableByPlayer: true, defaultValue: '0' },
        ],
      },
    ]

    const mockSheet = {
      id: sheetId,
      characterName: 'Test Character',
      playerName: 'TestPlayer',
      level: 1,
      hpActual: null,
      hpMax: null,
      hpNotes: null,
      isNpc: false,
      ownerId: userId,
      templateId: 'template-1',
      adventureId: null,
      createdAt: mockDate,
      updatedAt: mockDate,
      adventure: null,
      template: { id: 'template-1', name: 'Test Template' },
      values: [],
      fieldValues: [],
      skillValues: [],
      skillProfileValues: [],
      acValues: [],
      acAttributeValues: [],
      coreResourceValues: [],
      abilities: [],
      resistanceValues: [],
      resistanceComponentValues: [],
      inventoryItems: [],
      sectionEntries: [],
      story: null,
    }

    const defaultSheetInclude = expect.objectContaining({
      adventure: expect.anything(),
      template: expect.anything(),
      values: expect.anything(),
      fieldValues: expect.anything(),
      skillValues: expect.anything(),
      skillProfileValues: expect.anything(),
      acValues: expect.anything(),
      acAttributeValues: expect.anything(),
      coreResourceValues: expect.anything(),
      abilities: expect.anything(),
      resistanceValues: expect.anything(),
      resistanceComponentValues: expect.anything(),
      inventoryItems: expect.anything(),
      sectionEntries: expect.anything(),
      story: expect.anything(),
    })

    beforeEach(() => {
      // Default mock for template lookup
      prisma.template.findUnique.mockResolvedValue(mockTemplate)

      // Default mock for AC config
      prisma.templateArmorClass.findMany.mockResolvedValue(mockArmorClasses)

      // Default mock for resistances
      prisma.templateResistance.findMany.mockResolvedValue(mockResistances)

      // Default mock for sheet creation
      prisma.characterSheet.create.mockResolvedValue(mockSheet)

      // Default mock for sheet lookup
      prisma.characterSheet.findUnique.mockResolvedValue(mockSheet)

      // Default mock for sheet update
      prisma.characterSheet.update.mockResolvedValue(mockSheet)

      // Default mock for findMany
      prisma.characterSheet.findMany.mockResolvedValue([mockSheet])

      // Default mock for delete
      prisma.characterSheet.delete.mockResolvedValue(mockSheet)

      // Default mock for campaignMember
      prisma.campaignMember.findUnique.mockResolvedValue(null)

      // Default mock for membership
      mockMembershipService.isMember.mockResolvedValue(false)
      mockMembershipService.requireRole.mockResolvedValue({ role: 'GM' })

      // Default mock for redis
      mockRedisService.cacheGet.mockResolvedValue(null)
      mockRedisService.cacheSet.mockResolvedValue(undefined)
      mockRedisService.del.mockResolvedValue(1)

      // Default mocks for upsert operations
      prisma.characterSheetValue.upsert.mockResolvedValue({})
      prisma.characterSheetFieldValue.upsert.mockResolvedValue({})
      prisma.characterSheetSkillValue.upsert.mockResolvedValue({})
      prisma.characterSheetSkillProfileValue.upsert.mockResolvedValue({})
      prisma.characterSheetCoreResourceValue.upsert.mockResolvedValue({})
      prisma.characterSheetArmorClassValue.upsert.mockResolvedValue({})
      prisma.characterSheetArmorClassAttributeValue.upsert.mockResolvedValue({})
      prisma.characterSheetResistanceValue.upsert.mockResolvedValue({})
      prisma.characterSheetResistanceComponentValue.upsert.mockResolvedValue({})
    })

    // Restore mocks to original defaults after core CRUD tests
    // (jest.clearAllMocks in the outer beforeEach only clears calls data, not implementations)
    afterEach(() => {
      mockMembershipService.isMember.mockResolvedValue(true)
      mockMembershipService.requireRole.mockResolvedValue({ role: 'GM' })
      mockRedisService.cacheGet.mockResolvedValue(null)
      mockRedisService.del.mockResolvedValue(undefined)
    })

    // ────────── create ──────────

    describe('create', () => {
      const dto = { templateId: 'template-1', characterName: 'Test Character' }

      it('should create a sheet from a template with no adventure', async () => {
        prisma.characterSheet.create.mockResolvedValue(mockSheet)

        const result = await service.create(userId, dto)

        expect(prisma.characterSheet.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              characterName: 'Test Character',
              playerName: null,
              level: 1,
              adventureId: null,
              templateId: 'template-1',
              ownerId: userId,
            }),
          }),
        )
        expect(result).toEqual(mockSheet)
      })

      it('should throw NotFoundException when template is not found', async () => {
        prisma.template.findUnique.mockResolvedValue(null)

        await expect(service.create(userId, dto)).rejects.toThrow(NotFoundException)
      })

      it('should throw ForbiddenException when user is not a member of the adventure (dto.adventureId set)', async () => {
        const dtoWithAdv = { ...dto, adventureId: 'adventure-1' }
        mockMembershipService.isMember.mockResolvedValue(false)

        await expect(service.create(userId, dtoWithAdv)).rejects.toThrow(ForbiddenException)
      })

      it('should create sheet when template belongs to an adventure and user is a member', async () => {
        prisma.template.findUnique.mockResolvedValue({
          ...mockTemplate,
          adventureId: 'adventure-1',
        })
        mockMembershipService.isMember.mockResolvedValue(true)
        prisma.characterSheet.create.mockResolvedValue({ ...mockSheet, adventureId: 'adventure-1' })

        const result = await service.create(userId, dto)

        expect(result.adventureId).toBe('adventure-1')
      })

      it('should validate membership when dto.adventureId is explicitly provided', async () => {
        const dtoWithAdv = { ...dto, adventureId: 'adventure-2' }
        mockMembershipService.isMember.mockResolvedValue(true)
        prisma.characterSheet.create.mockResolvedValue({ ...mockSheet, adventureId: 'adventure-2' })

        const result = await service.create(userId, dtoWithAdv)

        expect(mockMembershipService.isMember).toHaveBeenCalledWith('adventure-2', userId)
        expect(result.adventureId).toBe('adventure-2')
      })

      it('should create skillProfileValues when template has skillFormula', async () => {
        const formulaTemplate = {
          ...mockTemplate,
          skillFormula: 'Athletics + str + mod(dex)',
          templateSkills: [
            { id: 'skill-1', name: 'Athletics', description: '', templateId: 'template-1', order: 0, attributeId: 'attr-1', defaultAttributeId: 'attr-1', allowedAttributeIds: ['attr-1'] },
            { id: 'skill-2', name: 'Stealth', description: '', templateId: 'template-1', order: 1, attributeId: 'attr-2', defaultAttributeId: 'attr-2', allowedAttributeIds: ['attr-2'] },
          ],
          skillModifierProfiles: [
            { id: 'prof-1', name: 'Athletics', order: 0, targetMode: 'ALL_SKILLS', targetSkillIds: [], options: [{ id: 'opt-1', label: '1', value: '1', order: 0 }] },
          ],
        }
        prisma.template.findUnique.mockResolvedValue(formulaTemplate)

        await service.create(userId, dto)

        expect(prisma.characterSheet.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              skillProfileValues: expect.objectContaining({
                create: expect.arrayContaining([
                  expect.objectContaining({ skillId: 'skill-1', profileId: 'prof-1', optionId: 'opt-1' }),
                ]),
              }),
            }),
          }),
        )
      })

      it('should skip skills not in SELECTED_SKILLS targetSkillIds', async () => {
        const selectedSkillsTemplate = {
          ...mockTemplate,
          skillFormula: 'Athletics + Stealth + str',
          templateSkills: [
            { id: 'sk-ath', name: 'Athletics', description: '', order: 0, templateId: 'template-1', attributeId: 'attr-1', defaultAttributeId: 'attr-1', allowedAttributeIds: ['attr-1'] },
            { id: 'sk-stl', name: 'Stealth', description: '', order: 1, templateId: 'template-1', attributeId: 'attr-2', defaultAttributeId: 'attr-2', allowedAttributeIds: ['attr-2'] },
          ],
          skillModifierProfiles: [
            { id: 'prof-ath', name: 'Athletics', order: 0, targetMode: 'SELECTED_SKILLS', targetSkillIds: ['Athletics'], options: [{ id: 'opt-ath', label: '1', value: '1', order: 0 }] },
          ],
        }
        prisma.template.findUnique.mockResolvedValue(selectedSkillsTemplate)

        await service.create(userId, dto)

        // Only Athletics should get a profile value (Stealth is skipped via continue)
        const createCall = prisma.characterSheet.create.mock.calls[0][0]
        expect(createCall.data.skillProfileValues.create).toHaveLength(1)
        expect(createCall.data.skillProfileValues.create[0].skillId).toBe('sk-ath')
      })

      it('should create empty skillProfileValues array when skillFormula is null', async () => {
        prisma.template.findUnique.mockResolvedValue({ ...mockTemplate, skillFormula: null })

        await service.create(userId, dto)

        const createCall = prisma.characterSheet.create.mock.calls[0][0]
        expect(createCall.data.skillProfileValues).toEqual({ create: [] })
      })

      it('should handle armorClasses with no fields', async () => {
        prisma.templateArmorClass.findMany.mockResolvedValue([
          { ...mockArmorClasses[0], fields: [], attributeModifiers: [] },
        ])

        await service.create(userId, dto)

        const createCall = prisma.characterSheet.create.mock.calls[0][0]
        expect(createCall.data.acValues).toBeUndefined()
        expect(createCall.data.acAttributeValues).toBeUndefined()
      })

      it('should create acValues and acAttributeValues from armor classes', async () => {
        await service.create(userId, dto)

        const createCall = prisma.characterSheet.create.mock.calls[0][0]
        expect(createCall.data.acValues).toBeDefined()
        expect(createCall.data.acAttributeValues).toBeDefined()
      })

      it('should create resistance values and component values', async () => {
        await service.create(userId, dto)

        const createCall = prisma.characterSheet.create.mock.calls[0][0]
        expect(createCall.data.resistanceValues).toBeDefined()
        expect(createCall.data.resistanceComponentValues).toBeDefined()
      })

      it('should invalidate cache after creation', async () => {
        prisma.characterSheet.create.mockResolvedValue(mockSheet)

        await service.create(userId, dto)

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

    // ────────── findAllByUser ──────────

    describe('findAllByUser', () => {
      it('should return cached data on cache hit', async () => {
        const cachedSheets = [{ id: sheetId, characterName: 'Cached' }]
        mockRedisService.cacheGet.mockResolvedValue(cachedSheets)

        const result = await service.findAllByUser(userId)

        expect(prisma.characterSheet.findMany).not.toHaveBeenCalled()
        expect(result).toEqual(cachedSheets)
      })

      it('should query DB on cache miss and cache the result', async () => {
        const sheets = [mockSheet]
        prisma.characterSheet.findMany.mockResolvedValue(sheets)

        const result = await service.findAllByUser(userId)

        expect(prisma.characterSheet.findMany).toHaveBeenCalledWith({
          where: { ownerId: userId },
          include: expect.objectContaining({
            adventure: expect.anything(),
            template: expect.anything(),
          }),
          orderBy: { createdAt: 'desc' },
        })
        expect(mockRedisService.cacheSet).toHaveBeenCalledWith(
          `character-sheets:user:${userId}`,
          sheets,
          expect.any(Number),
        )
        expect(result).toEqual(sheets)
      })

      it('should handle cacheSet failure gracefully', async () => {
        mockRedisService.cacheSet.mockRejectedValue(new Error('Redis down'))

        await expect(service.findAllByUser(userId)).resolves.toEqual([mockSheet])
      })
    })

    // ────────── findAllByAdventure ──────────

    describe('findAllByAdventure', () => {
      it('should return cached data when cache hit and user is a member', async () => {
        const cachedSheets = [{ id: sheetId, characterName: 'Cached' }]
        mockRedisService.cacheGet.mockResolvedValue(cachedSheets)
        prisma.campaignMember.findUnique.mockResolvedValue({ userId, adventureId, role: 'PLAYER' })

        const result = await service.findAllByAdventure(adventureId, userId)

        expect(prisma.characterSheet.findMany).not.toHaveBeenCalled()
        expect(result).toEqual(cachedSheets)
      })

      it('should throw ForbiddenException on cache hit when user is not a member', async () => {
        mockRedisService.cacheGet.mockResolvedValue([{ id: sheetId }])

        await expect(service.findAllByAdventure(adventureId, userId)).rejects.toThrow(ForbiddenException)
      })

      it('should throw ForbiddenException on cache miss when user is not a member', async () => {
        prisma.campaignMember.findUnique.mockResolvedValue(null)

        await expect(service.findAllByAdventure(adventureId, userId)).rejects.toThrow(ForbiddenException)

        expect(prisma.characterSheet.findMany).not.toHaveBeenCalled()
      })

      it('should return all non-NPC sheets for GM', async () => {
        prisma.campaignMember.findUnique.mockResolvedValue({ userId, adventureId, role: 'GM' })
        const sheets = [
          { ...mockSheet, ownerId: 'other-user' },
          { ...mockSheet, id: 'sheet-2', ownerId: 'another-user' },
        ]
        prisma.characterSheet.findMany.mockResolvedValue(sheets)

        const result = await service.findAllByAdventure(adventureId, userId)

        expect(prisma.characterSheet.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { adventureId, isNpc: false },
          }),
        )
        expect(result).toEqual(sheets)
        expect(mockRedisService.cacheSet).toHaveBeenCalled()
      })

      it('should return only own non-NPC sheets for non-GM', async () => {
        prisma.campaignMember.findUnique.mockResolvedValue({ userId, adventureId, role: 'PLAYER' })
        const sheets = [mockSheet]
        prisma.characterSheet.findMany.mockResolvedValue(sheets)

        const result = await service.findAllByAdventure(adventureId, userId)

        expect(prisma.characterSheet.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { adventureId, ownerId: userId, isNpc: false },
          }),
        )
        expect(result).toEqual(sheets)
        expect(mockRedisService.cacheSet).toHaveBeenCalled()
      })
    })

    // ────────── findOne ──────────

    describe('findOne', () => {
      it('should return cached sheet on cache hit when owned by user', async () => {
        const cachedSheet = { id: sheetId, ownerId: userId }
        mockRedisService.cacheGet.mockResolvedValue(cachedSheet)

        const result = await service.findOne(sheetId, userId)

        expect(prisma.characterSheet.findUnique).not.toHaveBeenCalled()
        expect(result).toEqual(cachedSheet)
      })

      it('should validate access on cache hit when not owned by user (GM allowed)', async () => {
        const cachedSheet = { id: sheetId, ownerId: 'other-user', adventureId }
        mockRedisService.cacheGet.mockResolvedValue(cachedSheet)
        mockMembershipService.requireRole.mockResolvedValue({ role: 'GM' })

        const result = await service.findOne(sheetId, userId)

        expect(mockMembershipService.requireRole).toHaveBeenCalledWith(adventureId, userId, 'GM')
        expect(result).toEqual(cachedSheet)
      })

      it('should throw ForbiddenException on cache hit when not owned and no adventureId', async () => {
        const cachedSheet = { id: sheetId, ownerId: 'other-user', adventureId: null }
        mockRedisService.cacheGet.mockResolvedValue(cachedSheet)

        await expect(service.findOne(sheetId, userId)).rejects.toThrow(ForbiddenException)
      })

      it('should throw ForbiddenException on cache hit when not owned and not GM', async () => {
        const cachedSheet = { id: sheetId, ownerId: 'other-user', adventureId }
        mockRedisService.cacheGet.mockResolvedValue(cachedSheet)
        mockMembershipService.requireRole.mockRejectedValue(new Error())

        await expect(service.findOne(sheetId, userId)).rejects.toThrow(ForbiddenException)
      })

      it('should query DB on cache miss and cache the result', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(mockSheet)

        const result = await service.findOne(sheetId, userId)

        expect(prisma.characterSheet.findUnique).toHaveBeenCalledWith({ where: { id: sheetId }, include: defaultSheetInclude })
        expect(result).toEqual(mockSheet)
        expect(mockRedisService.cacheSet).toHaveBeenCalledWith(
          `character-sheet:${sheetId}`,
          mockSheet,
          expect.any(Number),
        )
      })

      it('should throw NotFoundException when sheet not found in DB', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(null)

        await expect(service.findOne(sheetId, userId)).rejects.toThrow(NotFoundException)
      })

      it('should allow GM access via requireRole from DB', async () => {
        const otherSheet = { ...mockSheet, ownerId: 'other-user', adventureId }
        prisma.characterSheet.findUnique.mockResolvedValue(otherSheet)
        mockMembershipService.requireRole.mockResolvedValue({ role: 'GM' })

        const result = await service.findOne(sheetId, userId)

        expect(mockMembershipService.requireRole).toHaveBeenCalledWith(adventureId, userId, 'GM')
        expect(result).toEqual(otherSheet)
      })

      it('should throw ForbiddenException from DB when not owned and sheet has no adventure', async () => {
        const otherSheet = { ...mockSheet, ownerId: 'other-user', adventureId: null }
        prisma.characterSheet.findUnique.mockResolvedValue(otherSheet)

        await expect(service.findOne(sheetId, userId)).rejects.toThrow(ForbiddenException)
      })

      it('should throw ForbiddenException from DB when not owned and not GM', async () => {
        const otherSheet = { ...mockSheet, ownerId: 'other-user', adventureId }
        prisma.characterSheet.findUnique.mockResolvedValue(otherSheet)
        mockMembershipService.requireRole.mockRejectedValue(new Error())

        await expect(service.findOne(sheetId, userId)).rejects.toThrow(ForbiddenException)
      })
    })

    // ────────── update ──────────

    describe('update', () => {
      const updateDto = {
        characterName: 'Updated Name',
        level: 5,
        hpActual: 50,
        hpMax: 100,
        hpNotes: 'Full HP',
        playerName: 'UpdatedPlayer',
        values: [{ attributeId: 'attr-1', value: '18' }],
        fieldValues: [{ templateFieldId: 'field-1', value: "6'2\"" }],
        skillValues: [{ skillId: 'skill-1', value: '5', selectedAttributeId: 'attr-1' }],
        skillProfileValues: [{ skillId: 'skill-1', profileId: 'prof-1', optionId: 'opt-1' }],
        coreResourceValues: [{ coreResourceId: 'cr-1', current: 50, maximum: 100, notes: 'Half' }],
        acValues: [{ fieldId: 'ac-field-1', value: '15' }],
        acAttributeValues: [{ acAttributeModifierId: 'ac-mod-1', selectedAttributeId: 'attr-2' }],
        resistanceValues: [{ resistanceId: 'res-1', manualValue: '10' }],
        resistanceComponentValues: [{ componentId: 'res-comp-1', value: '5' }],
      }

      it('should throw NotFoundException when sheet does not exist', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(null)

        await expect(service.update(sheetId, userId, updateDto)).rejects.toThrow(NotFoundException)
      })

      it('should throw ForbiddenException when not owner and sheet has no adventureId', async () => {
        const otherSheet = { ...mockSheet, ownerId: 'other-user', adventureId: null }
        prisma.characterSheet.findUnique.mockResolvedValue(otherSheet)

        await expect(service.update(sheetId, userId, updateDto)).rejects.toThrow(ForbiddenException)
      })

      it('should allow GM to update when not owner but sheet belongs to an adventure', async () => {
        const otherSheet = { ...mockSheet, ownerId: 'other-user', adventureId }
        prisma.characterSheet.findUnique.mockResolvedValue(otherSheet)
        mockMembershipService.requireRole.mockResolvedValue({ role: 'GM' })
        prisma.characterSheet.update.mockResolvedValue({ ...otherSheet, characterName: 'Updated Name' })

        const result = await service.update(sheetId, userId, { characterName: 'Updated Name' })

        expect(mockMembershipService.requireRole).toHaveBeenCalledWith(adventureId, userId, 'GM')
        expect(result.characterName).toBe('Updated Name')
      })

      it('should throw ForbiddenException when not owner and not GM', async () => {
        const otherSheet = { ...mockSheet, ownerId: 'other-user', adventureId }
        prisma.characterSheet.findUnique.mockResolvedValue(otherSheet)
        mockMembershipService.requireRole.mockRejectedValue(new Error())

        await expect(service.update(sheetId, userId, { characterName: 'Hack' })).rejects.toThrow(ForbiddenException)
      })

      it('should upsert attribute values', async () => {
        await service.update(sheetId, userId, { values: [{ attributeId: 'attr-1', value: '18' }] })

        expect(prisma.characterSheetValue.upsert).toHaveBeenCalledWith({
          where: { sheetId_attributeId: { sheetId, attributeId: 'attr-1' } },
          create: { sheetId, attributeId: 'attr-1', value: '18' },
          update: { value: '18' },
        })
      })

      it('should upsert field values', async () => {
        await service.update(sheetId, userId, { fieldValues: [{ templateFieldId: 'field-1', value: "6'2\"" }] })

        expect(prisma.characterSheetFieldValue.upsert).toHaveBeenCalledWith({
          where: { sheetId_templateFieldId: { sheetId, templateFieldId: 'field-1' } },
          create: { sheetId, templateFieldId: 'field-1', value: "6'2\"" },
          update: { value: "6'2\"" },
        })
      })

      it('should upsert skill values', async () => {
        await service.update(sheetId, userId, { skillValues: [{ skillId: 'skill-1', value: '5', selectedAttributeId: 'attr-1' }] })

        expect(prisma.characterSheetSkillValue.upsert).toHaveBeenCalledWith({
          where: { sheetId_skillId: { sheetId, skillId: 'skill-1' } },
          create: { sheetId, skillId: 'skill-1', value: '5', selectedAttributeId: 'attr-1' },
          update: { value: '5', selectedAttributeId: 'attr-1' },
        })
      })

      it('should handle skill values with selectedAttributeId undefined', async () => {
        await service.update(sheetId, userId, { skillValues: [{ skillId: 'skill-1', value: '5' }] })

        const updateCall = prisma.characterSheetSkillValue.upsert.mock.calls[0][0]
        expect(updateCall.update).toEqual({ value: '5' })
        expect(updateCall.update).not.toHaveProperty('selectedAttributeId')
      })

      it('should upsert skill profile values', async () => {
        await service.update(sheetId, userId, { skillProfileValues: [{ skillId: 'skill-1', profileId: 'prof-1', optionId: 'opt-1' }] })

        expect(prisma.characterSheetSkillProfileValue.upsert).toHaveBeenCalledWith({
          where: { sheetId_skillId_profileId: { sheetId, skillId: 'skill-1', profileId: 'prof-1' } },
          create: { sheetId, skillId: 'skill-1', profileId: 'prof-1', optionId: 'opt-1' },
          update: { optionId: 'opt-1' },
        })
      })

      it('should upsert core resource values', async () => {
        await service.update(sheetId, userId, { coreResourceValues: [{ coreResourceId: 'cr-1', current: 50, maximum: 100, notes: 'Half' }] })

        expect(prisma.characterSheetCoreResourceValue.upsert).toHaveBeenCalledWith({
          where: { sheetId_coreResourceId: { sheetId, coreResourceId: 'cr-1' } },
          create: { sheetId, coreResourceId: 'cr-1', current: 50, maximum: 100, notes: 'Half' },
          update: { current: 50, maximum: 100, notes: 'Half' },
        })
      })

      it('should upsert AC values', async () => {
        await service.update(sheetId, userId, { acValues: [{ fieldId: 'ac-field-1', value: '15' }] })

        expect(prisma.characterSheetArmorClassValue.upsert).toHaveBeenCalledWith({
          where: { sheetId_fieldId: { sheetId, fieldId: 'ac-field-1' } },
          create: { sheetId, fieldId: 'ac-field-1', value: '15' },
          update: { value: '15' },
        })
      })

      it('should upsert AC attribute values', async () => {
        await service.update(sheetId, userId, { acAttributeValues: [{ acAttributeModifierId: 'ac-mod-1', selectedAttributeId: 'attr-2' }] })

        expect(prisma.characterSheetArmorClassAttributeValue.upsert).toHaveBeenCalledWith({
          where: { sheetId_acAttributeModifierId: { sheetId, acAttributeModifierId: 'ac-mod-1' } },
          create: { sheetId, acAttributeModifierId: 'ac-mod-1', selectedAttributeId: 'attr-2' },
          update: { selectedAttributeId: 'attr-2' },
        })
      })

      it('should handle sheet-specific resistance values by updating existing component', async () => {
        prisma.sheetResistance.findUnique.mockResolvedValue({ id: 'sheet-res-1', calculationType: 'MANUAL' })
        prisma.sheetResistanceComponent.findFirst.mockResolvedValue({
          id: 'sheet-res-comp-1', sheetResistanceId: 'sheet-res-1', name: 'Value', value: '0', order: 0,
        })

        await service.update(sheetId, userId, { resistanceValues: [{ resistanceId: 'sheet-res-1', manualValue: '15' }] })

        expect(prisma.sheetResistanceComponent.update).toHaveBeenCalledWith({
          where: { id: 'sheet-res-comp-1' },
          data: { value: '15' },
        })
      })

      it('should handle sheet-specific resistance values by creating component when none exists', async () => {
        prisma.sheetResistance.findUnique.mockResolvedValue({ id: 'sheet-res-1', calculationType: 'MANUAL' })
        prisma.sheetResistanceComponent.findFirst.mockResolvedValue(null)

        await service.update(sheetId, userId, { resistanceValues: [{ resistanceId: 'sheet-res-1', manualValue: '15' }] })

        expect(prisma.sheetResistanceComponent.create).toHaveBeenCalledWith({
          data: { sheetResistanceId: 'sheet-res-1', name: 'Value', value: '15', order: 0 },
        })
      })

      it('should handle template resistance values via upsert', async () => {
        prisma.sheetResistance.findUnique.mockResolvedValue(null)

        await service.update(sheetId, userId, { resistanceValues: [{ resistanceId: 'res-1', manualValue: '10' }] })

        expect(prisma.characterSheetResistanceValue.upsert).toHaveBeenCalledWith({
          where: { sheetId_resistanceId: { sheetId, resistanceId: 'res-1' } },
          create: { sheetId, resistanceId: 'res-1', manualValue: '10' },
          update: { manualValue: '10' },
        })
      })

      it('should handle sheet-specific resistance component values by updating directly', async () => {
        prisma.sheetResistanceComponent.findUnique.mockResolvedValue({ id: 'sheet-res-comp-1' })

        await service.update(sheetId, userId, { resistanceComponentValues: [{ componentId: 'sheet-res-comp-1', value: '7' }] })

        expect(prisma.sheetResistanceComponent.update).toHaveBeenCalledWith({
          where: { id: 'sheet-res-comp-1' },
          data: { value: '7' },
        })
      })

      it('should handle template resistance component values via upsert', async () => {
        prisma.sheetResistanceComponent.findUnique.mockResolvedValue(null)

        await service.update(sheetId, userId, { resistanceComponentValues: [{ componentId: 'res-comp-1', value: '5' }] })

        expect(prisma.characterSheetResistanceComponentValue.upsert).toHaveBeenCalledWith({
          where: { sheetId_componentId: { sheetId, componentId: 'res-comp-1' } },
          create: { sheetId, componentId: 'res-comp-1', value: '5' },
          update: { value: '5' },
        })
      })

      it('should update top-level fields without changing others', async () => {
        const minimalDto = {
          characterName: 'New Name',
          playerName: 'NewPlayer',
          level: 10,
          hpActual: 75,
          hpMax: 150,
          hpNotes: 'Feeling strong',
        }
        prisma.characterSheet.update.mockResolvedValue({ ...mockSheet, ...minimalDto })

        await service.update(sheetId, userId, minimalDto)

        expect(prisma.characterSheet.update).toHaveBeenCalledWith({
          where: { id: sheetId },
          data: {
            characterName: 'New Name',
            playerName: 'NewPlayer',
            level: 10,
            hpActual: 75,
            hpMax: 150,
            hpNotes: 'Feeling strong',
          },
          include: defaultSheetInclude,
        })
      })

      it('should only update provided top-level fields', async () => {
        await service.update(sheetId, userId, { characterName: 'Only Name' })

        expect(prisma.characterSheet.update).toHaveBeenCalledWith({
          where: { id: sheetId },
          data: { characterName: 'Only Name' },
          include: defaultSheetInclude,
        })
      })

      it('should invalidate cache after update', async () => {
        await service.update(sheetId, userId, { characterName: 'Updated' })

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheets:user:${userId}`)
      })
    })

    // ────────── remove ──────────

    describe('remove', () => {
      it('should throw NotFoundException when sheet does not exist', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(null)

        await expect(service.remove(sheetId, userId)).rejects.toThrow(NotFoundException)
      })

      it('should throw ForbiddenException when not owner and no adventureId', async () => {
        const otherSheet = { ...mockSheet, ownerId: 'other-user', adventureId: null }
        prisma.characterSheet.findUnique.mockResolvedValue(otherSheet)

        await expect(service.remove(sheetId, 'different-user')).rejects.toThrow(ForbiddenException)
      })

      it('should throw ForbiddenException when not owner and not GM', async () => {
        const otherSheet = { ...mockSheet, ownerId: 'other-user', adventureId }
        prisma.characterSheet.findUnique.mockResolvedValue(otherSheet)
        mockMembershipService.requireRole.mockRejectedValue(new Error())

        await expect(service.remove(sheetId, 'different-user')).rejects.toThrow(ForbiddenException)
      })

      it('should allow GM to delete when sheet is in an adventure', async () => {
        const otherSheet = { ...mockSheet, ownerId: 'other-user', adventureId }
        prisma.characterSheet.findUnique.mockResolvedValue(otherSheet)
        mockMembershipService.requireRole.mockResolvedValue({ role: 'GM' })
        prisma.characterSheet.delete.mockResolvedValue(otherSheet)

        const result = await service.remove(sheetId, 'gm-user')

        expect(prisma.characterSheet.delete).toHaveBeenCalledWith({ where: { id: sheetId } })
        expect(result).toEqual(otherSheet)
      })

      it('should delete sheet owned by the user', async () => {
        prisma.characterSheet.delete.mockResolvedValue(mockSheet)

        const result = await service.remove(sheetId, userId)

        expect(prisma.characterSheet.delete).toHaveBeenCalledWith({ where: { id: sheetId } })
        expect(result).toEqual(mockSheet)
      })

      it('should invalidate cache after deletion', async () => {
        await service.remove(sheetId, userId)

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheets:user:${userId}`)
      })

      it('should invalidate adventure list cache when sheet is linked', async () => {
        const advSheet = { ...mockSheet, adventureId }
        prisma.characterSheet.findUnique.mockResolvedValue(advSheet)
        prisma.characterSheet.delete.mockResolvedValue(advSheet)

        await service.remove(sheetId, userId)

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheets:adventure:${adventureId}`)
      })
    })

    // ────────── linkToAdventure ──────────

    describe('linkToAdventure', () => {
      it('should throw NotFoundException when sheet does not exist', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(null)

        await expect(service.linkToAdventure(sheetId, adventureId, userId)).rejects.toThrow(NotFoundException)
      })

      it('should throw ForbiddenException when not the owner (no GM bypass)', async () => {
        const otherSheet = { ...mockSheet, ownerId: 'other-user' }
        prisma.characterSheet.findUnique.mockResolvedValue(otherSheet)

        await expect(service.linkToAdventure(sheetId, adventureId, 'other-user')).rejects.toThrow(ForbiddenException)
      })

      it('should throw ForbiddenException when user is not a member of the adventure', async () => {
        mockMembershipService.isMember.mockResolvedValue(false)

        await expect(service.linkToAdventure(sheetId, adventureId, userId)).rejects.toThrow(ForbiddenException)
      })

      it('should link sheet to adventure and invalidate cache', async () => {
        mockMembershipService.isMember.mockResolvedValue(true)
        const linkedSheet = { ...mockSheet, adventureId }
        prisma.characterSheet.update.mockResolvedValue(linkedSheet)

        const result = await service.linkToAdventure(sheetId, adventureId, userId)

        expect(prisma.characterSheet.update).toHaveBeenCalledWith({
          where: { id: sheetId },
          data: { adventureId },
          include: defaultSheetInclude,
        })
        expect(result).toEqual(linkedSheet)
        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheets:user:${userId}`)
        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheets:adventure:${adventureId}`)
      })
    })

    // ────────── unlinkFromAdventure ──────────

    describe('unlinkFromAdventure', () => {
      it('should throw NotFoundException when sheet does not exist', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(null)

        await expect(service.unlinkFromAdventure(sheetId, userId)).rejects.toThrow(NotFoundException)
      })

      it('should throw ForbiddenException when not owner and no adventureId', async () => {
        const otherSheet = { ...mockSheet, ownerId: 'different-owner', adventureId: null }
        prisma.characterSheet.findUnique.mockResolvedValue(otherSheet)

        await expect(service.unlinkFromAdventure(sheetId, 'different-user')).rejects.toThrow(ForbiddenException)
      })

      it('should throw ForbiddenException when not owner and not GM', async () => {
        const otherSheet = { ...mockSheet, ownerId: 'different-owner', adventureId }
        prisma.characterSheet.findUnique.mockResolvedValue(otherSheet)
        mockMembershipService.requireRole.mockRejectedValue(new Error())

        await expect(service.unlinkFromAdventure(sheetId, 'different-user')).rejects.toThrow(ForbiddenException)
      })

      it('should allow GM to unlink', async () => {
        const advSheet = { ...mockSheet, ownerId: 'other-user', adventureId }
        prisma.characterSheet.findUnique.mockResolvedValue(advSheet)
        mockMembershipService.requireRole.mockResolvedValue({ role: 'GM' })
        const unlinkedSheet = { ...advSheet, adventureId: null }
        prisma.characterSheet.update.mockResolvedValue(unlinkedSheet)

        const result = await service.unlinkFromAdventure(sheetId, 'gm-user')

        expect(prisma.characterSheet.update).toHaveBeenCalledWith({
          where: { id: sheetId },
          data: { adventureId: null },
          include: defaultSheetInclude,
        })
        expect(result.adventureId).toBeNull()
      })

      it('should unlink sheet owned by the user', async () => {
        const advSheet = { ...mockSheet, adventureId }
        prisma.characterSheet.findUnique.mockResolvedValue(advSheet)
        const unlinkedSheet = { ...advSheet, adventureId: null }
        prisma.characterSheet.update.mockResolvedValue(unlinkedSheet)

        const result = await service.unlinkFromAdventure(sheetId, userId)

        expect(result.adventureId).toBeNull()
      })

      it('should invalidate cache after unlinking', async () => {
        const advSheet = { ...mockSheet, adventureId }
        prisma.characterSheet.findUnique.mockResolvedValue(advSheet)
        prisma.characterSheet.update.mockResolvedValue({ ...advSheet, adventureId: null })

        await service.unlinkFromAdventure(sheetId, userId)

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheets:user:${userId}`)
        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheets:adventure:${adventureId}`)
      })
    })
  })

  // ── Access Control ──────────────────────────────────────────

  describe('create', () => {
    const dto = { characterName: 'Hero', templateId: 't1', adventureId: 'a1' }

    it('creates a sheet with full nested creates, validates template exists', async () => {
      const template = {
        id: 't1',
        adventureId: 'a1',
        skillFormula: null,
        attributes: [{ id: 'attr1' }],
        templateFields: [{ id: 'f1' }],
        templateSkills: [],
        skillModifierProfiles: [],
        coreResources: [],
      }
      prisma.template.findUnique.mockResolvedValue(template)
      prisma.templateArmorClass.findMany.mockResolvedValue([])
      prisma.templateResistance.findMany.mockResolvedValue([])
      prisma.campaignMember.findUnique.mockResolvedValue({ id: 'm1', role: 'PLAYER' })
      const createdSheet = { id: 's1', characterName: 'Hero', templateId: 't1' }
      prisma.characterSheet.create.mockResolvedValue(createdSheet)

      const result = await service.create('u1', dto)

      expect(prisma.template.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 't1' } }),
      )
      expect(prisma.characterSheet.create).toHaveBeenCalled()
      expect(result).toEqual(createdSheet)
    })

    it('throws NotFoundException when template is missing', async () => {
      prisma.template.findUnique.mockResolvedValue(null)

      await expect(service.create('u1', dto)).rejects.toThrow(NotFoundException)
      await expect(service.create('u1', dto)).rejects.toThrow('Template not found')
    })
  })

  describe('findOne', () => {
    it('returns sheet when found and accessible', async () => {
      mockRedisService.cacheGet.mockResolvedValue(null) // cache miss
      const sheet = { id: 's1', ownerId: 'u1', adventureId: null }
      prisma.characterSheet.findUnique.mockResolvedValue(sheet)

      const result = await service.findOne('s1', 'u1')

      expect(result).toEqual(sheet)
    })

    it('checks cache first', async () => {
      const cached = { id: 's1', ownerId: 'u1', adventureId: null }
      mockRedisService.cacheGet.mockResolvedValue(cached)

      const result = await service.findOne('s1', 'u1')

      expect(mockRedisService.cacheGet).toHaveBeenCalled()
      expect(prisma.characterSheet.findUnique).not.toHaveBeenCalled()
      expect(result).toEqual(cached)
    })

    it('throws NotFoundException when sheet does not exist', async () => {
      mockRedisService.cacheGet.mockResolvedValue(null)
      prisma.characterSheet.findUnique.mockResolvedValue(null)

      await expect(service.findOne('nonexistent', 'u1')).rejects.toThrow(
        NotFoundException,
      )
      await expect(service.findOne('nonexistent', 'u1')).rejects.toThrow(
        'Character sheet not found',
      )
    })
  })

  describe('update', () => {
    it('updates sheet fields and calls prisma update', async () => {
      const sheet = { id: 's1', ownerId: 'u1', adventureId: null }
      prisma.characterSheet.findUnique.mockResolvedValue(sheet)
      const updated = { id: 's1', characterName: 'Hero v2', level: 2 }
      prisma.characterSheet.update.mockResolvedValue(updated)

      const result = await service.update('s1', 'u1', {
        characterName: 'Hero v2',
        level: 2,
      })

      expect(prisma.characterSheet.findUnique).toHaveBeenCalledWith({
        where: { id: 's1' },
      })
      expect(prisma.characterSheet.update).toHaveBeenCalled()
      expect(result).toEqual(updated)
    })

    it('invalidates cache after update', async () => {
      const sheet = { id: 's1', ownerId: 'u1', adventureId: 'a1' }
      prisma.characterSheet.findUnique.mockResolvedValue(sheet)
      prisma.characterSheet.update.mockResolvedValue(sheet)

      await service.update('s1', 'u1', { characterName: 'Updated' })

      expect(mockRedisService.del).toHaveBeenCalledWith(
        expect.stringContaining('character-sheet:s1'),
      )
    })
  })

  describe('remove', () => {
    it('deletes sheet and invalidates cache', async () => {
      const sheet = { id: 's1', ownerId: 'u1', adventureId: 'a1' }
      prisma.characterSheet.findUnique.mockResolvedValue(sheet)
      prisma.characterSheet.delete.mockResolvedValue(sheet)

      const result = await service.remove('s1', 'u1')

      expect(result).toEqual(sheet)
      expect(prisma.characterSheet.delete).toHaveBeenCalledWith({
        where: { id: 's1' },
      })
      expect(mockRedisService.del).toHaveBeenCalled()
    })

    it('throws NotFoundException when sheet does not exist', async () => {
      prisma.characterSheet.findUnique.mockResolvedValue(null)

      await expect(service.remove('nonexistent', 'u1')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('requireOwnership (via access control)', () => {
    it('finds sheet, checks ownerId matches', async () => {
      prisma.characterSheet.findUnique.mockResolvedValue({
        id: 's1',
        ownerId: 'u1',
      })

      // The method is private, so we exercise it through any public method that calls it
      prisma.characterAbility.findMany.mockResolvedValue([])

      await service.listAbilities('s1', 'u1')

      expect(prisma.characterSheet.findUnique).toHaveBeenCalledWith({
        where: { id: 's1' },
      })
    })

    it('falls back to GM role check when owner does not match but has adventureId', async () => {
      prisma.characterSheet.findUnique.mockResolvedValue({
        id: 's1',
        ownerId: 'other-user',
        adventureId: 'a1',
      })
      mockMembershipService.requireRole.mockResolvedValue({ role: 'GM' })
      prisma.characterAbility.findMany.mockResolvedValue([])

      await expect(service.listAbilities('s1', 'u1')).resolves.toEqual([])
      expect(mockMembershipService.requireRole).toHaveBeenCalledWith('a1', 'u1', 'GM')
    })

    it('throws ForbiddenException when owner does not match and no adventure', async () => {
      prisma.characterSheet.findUnique.mockResolvedValue({
        id: 's1',
        ownerId: 'other-user',
        adventureId: null,
      })

      await expect(service.listAbilities('s1', 'u1')).rejects.toThrow(
        ForbiddenException,
      )
    })
  })

  // ── Caching ─────────────────────────────────────────────────

  describe('caching behavior', () => {
    it('findOne stores result in cache on cache miss', async () => {
      mockRedisService.cacheGet.mockResolvedValue(null)
      const sheet = { id: 's1', ownerId: 'u1', adventureId: null }
      prisma.characterSheet.findUnique.mockResolvedValue(sheet)

      await service.findOne('s1', 'u1')

      expect(mockRedisService.cacheSet).toHaveBeenCalled()
    })

    it('should not throw when invalidateCache fails', async () => {
      // invalidateCache is called inside update and remove — verify it catches quietly
      mockRedisService.del.mockRejectedValue(new Error('cache down'))
      prisma.characterAbility.findUnique.mockResolvedValue({ id: 'ab1', sheetId: 's1', type: 'CLASS' })
      prisma.characterSheet.findUnique.mockResolvedValue({ id: 's1', ownerId: 'u1' })
      prisma.characterAbility.update.mockResolvedValue({ id: 'ab1' })

      // Should not reject — invalidateCache catches internally
      await expect(service.updateAbility('ab1', 'u1', { name: 'Updated' })).resolves.not.toThrow()
    })
  })

  // ── Abilities & Skills (comprehensive) ──────────────────────────

  describe('abilities and skills', () => {
    const userId = 'u1'
    const sheetId = 'sheet-ab'
    const abilityId = 'ab-1'

    beforeEach(() => {
      prisma.characterSheet.findUnique.mockResolvedValue({ id: sheetId, ownerId: userId, adventureId: null })
    })

    // ── List abilities ──

    describe('listAbilities', () => {
      it('returns abilities for the sheet', async () => {
        const abilities = [{ id: abilityId, name: 'Fireball', type: 'ABILITY' }]
        prisma.characterAbility.findMany.mockResolvedValue(abilities)

        const result = await service.listAbilities(sheetId, userId)

        expect(prisma.characterAbility.findMany).toHaveBeenCalledWith({
          where: { sheetId, summonId: null },
          orderBy: { order: 'asc' },
          include: expect.any(Object),
        })
        expect(result).toEqual(abilities)
      })

      it('returns empty array when no abilities', async () => {
        prisma.characterAbility.findMany.mockResolvedValue([])

        const result = await service.listAbilities(sheetId, userId)

        expect(result).toEqual([])
      })

      it('throws ForbiddenException when not owner and not GM', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId, ownerId: 'other-user', adventureId: null,
        })

        await expect(service.listAbilities(sheetId, userId)).rejects.toThrow(ForbiddenException)
      })
    })

    // ── Create ability ──

    describe('createAbility', () => {
      it('creates a regular ability with a starting level', async () => {
        prisma.characterAbility.count.mockResolvedValue(0)
        prisma.characterAbility.create.mockResolvedValue({ id: abilityId, name: 'Fireball', type: 'ABILITY' })

        const result = await service.createAbility(sheetId, userId, {
          name: 'Fireball', description: 'Big boom',
        })

        expect(prisma.characterAbility.count).toHaveBeenCalledWith({ where: { sheetId, summonId: null } })
        expect(prisma.characterAbility.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              sheetId, name: 'Fireball', type: 'ABILITY', order: 0,
              levels: { create: expect.objectContaining({ level: '1' }) },
            }),
          }),
        )
        expect(result.name).toBe('Fireball')
      })

      it('defaults type to ABILITY when not provided', async () => {
        prisma.characterAbility.count.mockResolvedValue(0)
        prisma.characterAbility.create.mockResolvedValue({ id: abilityId, name: 'Generic' })

        await service.createAbility(sheetId, userId, { name: 'Generic' })

        expect(prisma.characterAbility.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ type: 'ABILITY' }),
          }),
        )
      })

      it('throws NotFoundException when sheet does not exist', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(null)

        await expect(service.createAbility(sheetId, userId, { name: 'Test' })).rejects.toThrow(NotFoundException)
      })

      it('throws ForbiddenException when not owner', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId, ownerId: 'other-user', adventureId: null,
        })

        await expect(service.createAbility(sheetId, userId, { name: 'Test' })).rejects.toThrow(ForbiddenException)
      })

      it('creates a SUMMON ability with attributes and AC from template', async () => {
        prisma.characterAbility.count.mockResolvedValue(0)
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId, ownerId: userId, adventureId: null, templateId: 'tpl-1',
          template: {
            attributes: [{ id: 'ta-1', key: 'str', name: 'Strength', order: 0 }],
            armorClasses: [
            { id: 'ac-1', name: 'Armor Class', order: 0, templateId: 'tpl-1', fields: [{ id: 'ac-f-1', name: 'Base', defaultValue: '10', order: 0 }] }],
          },
        })
        prisma.characterAbility.create.mockResolvedValue({ id: abilityId, name: 'Wolf', type: 'SUMMON' })

        const result = await service.createAbility(sheetId, userId, {
          name: 'Wolf', type: 'SUMMON', description: 'A fierce wolf',
        })

        expect(result.type).toBe('SUMMON')
        expect(prisma.characterAbility.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              summonAttributes: expect.objectContaining({
                create: expect.arrayContaining([
                  expect.objectContaining({ attributeId: 'ta-1' }),
                ]),
              }),
            }),
          }),
        )
      })

      it('creates a SUMMON ability with health when provided in dto', async () => {
        prisma.characterAbility.count.mockResolvedValue(0)
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId, ownerId: userId, adventureId: null, templateId: 'tpl-1',
          template: { attributes: [], armorClasses: [
            { id: 'ac-1', name: 'Armor Class', order: 0, templateId: 'tpl-1', fields: [{ id: 'ac-f-1', name: 'Base', defaultValue: '10', order: 0 }] },
          ] },
        })
        prisma.characterAbility.create.mockResolvedValue({ id: abilityId, name: 'Bear', type: 'SUMMON' })

        await service.createAbility(sheetId, userId, {
          name: 'Bear', type: 'SUMMON',
          summonHealthCurrent: 30, summonHealthMax: 50,
        })

        expect(prisma.characterAbility.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              summonHealth: expect.objectContaining({
                create: expect.objectContaining({ current: 30, maximum: 50 }),
              }),
            }),
          }),
        )
      })

      it('invalidates cache after creation', async () => {
        prisma.characterAbility.count.mockResolvedValue(0)
        prisma.characterAbility.create.mockResolvedValue({ id: abilityId, name: 'Fireball' })

        await service.createAbility(sheetId, userId, { name: 'Fireball' })

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

    // ── Update ability ──

    describe('updateAbility', () => {
      it('updates ability fields', async () => {
        prisma.characterAbility.findUnique.mockResolvedValue({ id: abilityId, sheetId: sheetId })
        prisma.characterAbility.update.mockResolvedValue({ id: abilityId, name: 'Fireball v2' })

        const result = await service.updateAbility(abilityId, userId, { name: 'Fireball v2' })

        expect(prisma.characterAbility.findUnique).toHaveBeenCalledWith({ where: { id: abilityId } })
        expect(prisma.characterAbility.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: abilityId }, data: { name: 'Fireball v2' } }),
        )
        expect(result.name).toBe('Fireball v2')
      })

      it('throws NotFoundException when ability not found', async () => {
        prisma.characterAbility.findUnique.mockResolvedValue(null)

        await expect(service.updateAbility('nonexistent', userId, { name: 'X' })).rejects.toThrow(NotFoundException)
        await expect(service.updateAbility('nonexistent', userId, { name: 'X' })).rejects.toThrow('Ability not found')
      })

      it('throws ForbiddenException when not owner and not GM', async () => {
        prisma.characterAbility.findUnique.mockResolvedValue({ id: abilityId, sheetId: sheetId })
        prisma.characterSheet.findUnique.mockResolvedValue({ id: sheetId, ownerId: 'other-user', adventureId: null })

        await expect(service.updateAbility(abilityId, userId, { name: 'X' })).rejects.toThrow(ForbiddenException)
      })

      it('invalidates cache after update', async () => {
        prisma.characterAbility.findUnique.mockResolvedValue({ id: abilityId, sheetId: sheetId })
        prisma.characterAbility.update.mockResolvedValue({ id: abilityId })

        await service.updateAbility(abilityId, userId, { name: 'Updated' })

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

    // ── Remove ability ──

    describe('removeAbility', () => {
      it('deletes an ability', async () => {
        prisma.characterAbility.findUnique.mockResolvedValue({ id: abilityId, sheetId: sheetId })
        prisma.characterAbility.delete.mockResolvedValue({ id: abilityId })

        const result = await service.removeAbility(abilityId, userId)

        expect(prisma.characterAbility.findUnique).toHaveBeenCalledWith({ where: { id: abilityId } })
        expect(prisma.characterAbility.delete).toHaveBeenCalledWith({ where: { id: abilityId } })
        expect(result).toEqual({ id: abilityId })
      })

      it('throws NotFoundException when ability not found', async () => {
        prisma.characterAbility.findUnique.mockResolvedValue(null)

        await expect(service.removeAbility('nonexistent', userId)).rejects.toThrow(NotFoundException)
        await expect(service.removeAbility('nonexistent', userId)).rejects.toThrow('Ability not found')
      })

      it('throws ForbiddenException when not owner', async () => {
        prisma.characterAbility.findUnique.mockResolvedValue({ id: abilityId, sheetId: sheetId })
        prisma.characterSheet.findUnique.mockResolvedValue({ id: sheetId, ownerId: 'other-user', adventureId: null })

        await expect(service.removeAbility(abilityId, userId)).rejects.toThrow(ForbiddenException)
      })

      it('invalidates cache after deletion', async () => {
        prisma.characterAbility.findUnique.mockResolvedValue({ id: abilityId, sheetId: sheetId })
        prisma.characterAbility.delete.mockResolvedValue({ id: abilityId })

        await service.removeAbility(abilityId, userId)

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

    // ── Ability levels ──

    describe('ability levels', () => {
      beforeEach(() => {
        prisma.characterAbility.findUnique.mockResolvedValue({ id: abilityId, sheetId: sheetId, type: 'ABILITY' })
      })

      describe('listAbilityLevels', () => {
        it('lists all levels for an ability', async () => {
          const levels = [{ id: 'lvl-1', level: '1', abilityId }]
          prisma.characterAbilityLevel.findMany.mockResolvedValue(levels)

          const result = await service.listAbilityLevels(abilityId, userId)

          expect(prisma.characterAbilityLevel.findMany).toHaveBeenCalledWith({
            where: { abilityId }, orderBy: { level: 'asc' },
          })
          expect(result).toEqual(levels)
        })

        it('throws NotFoundException when ability not found', async () => {
          prisma.characterAbility.findUnique.mockResolvedValue(null)

          await expect(service.listAbilityLevels('nonexistent', userId)).rejects.toThrow(NotFoundException)
        })
      })

      describe('createAbilityLevel', () => {
        it('creates a new level', async () => {
          prisma.characterAbility.findUnique.mockResolvedValue({
            id: abilityId, sheetId: sheetId, type: 'ABILITY', levels: [],
          })
          prisma.characterAbilityLevel.findFirst.mockResolvedValue(null)
          prisma.characterAbilityLevel.create.mockResolvedValue({ id: 'lvl-2', level: '2', abilityId })

          const result = await service.createAbilityLevel(abilityId, userId, { level: '2' })

          expect(result.level).toBe('2')
          expect(prisma.characterAbilityLevel.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ abilityId, level: '2' }) }),
          )
        })

        it('copies data from previous level when copyFromPrevious is true', async () => {
          prisma.characterAbility.findUnique.mockResolvedValue({
            id: abilityId, sheetId: sheetId, type: 'ABILITY',
            levels: [{ level: '1', description: 'First level', manaCost: 5 }],
          })
          prisma.characterAbilityLevel.findFirst.mockResolvedValue(null)
          prisma.characterAbilityLevel.create.mockResolvedValue({ id: 'lvl-2', level: '2', description: 'First level', manaCost: 5 })

          const result = await service.createAbilityLevel(abilityId, userId, { level: '2', copyFromPrevious: true })

          expect(result.description).toBe('First level')
        })

        it('throws ConflictException when level already exists', async () => {
          prisma.characterAbility.findUnique.mockResolvedValue({
            id: abilityId, sheetId: sheetId, type: 'ABILITY', levels: [],
          })
          prisma.characterAbilityLevel.findFirst.mockResolvedValue({ id: 'lvl-1', level: '1', abilityId })

          await expect(service.createAbilityLevel(abilityId, userId, { level: '1' })).rejects.toThrow(ConflictException)
        })

        it('throws NotFoundException when ability not found', async () => {
          prisma.characterAbility.findUnique.mockResolvedValue(null)

          await expect(service.createAbilityLevel('nonexistent', userId, { level: '1' })).rejects.toThrow(NotFoundException)
        })
      })

      describe('updateAbilityLevel', () => {
        it('updates a level', async () => {
          prisma.characterAbilityLevel.findUnique.mockResolvedValue({ id: 'lvl-1', abilityId })
          prisma.characterAbilityLevel.update.mockResolvedValue({ id: 'lvl-1', level: '1', description: 'updated' })

          const result = await service.updateAbilityLevel('lvl-1', userId, { description: 'updated' })

          expect(result.description).toBe('updated')
        })

        it('throws NotFoundException for missing level', async () => {
          prisma.characterAbilityLevel.findUnique.mockResolvedValue(null)

          await expect(service.updateAbilityLevel('nonexistent', userId, { description: 'x' })).rejects.toThrow(NotFoundException)
        })

        it('throws ForbiddenException when not owner', async () => {
          prisma.characterAbilityLevel.findUnique.mockResolvedValue({ id: 'lvl-1', abilityId })
          prisma.characterAbility.findUnique.mockResolvedValue({ id: abilityId, sheetId: sheetId })
          prisma.characterSheet.findUnique.mockResolvedValue({ id: sheetId, ownerId: 'other-user', adventureId: null })

          await expect(service.updateAbilityLevel('lvl-1', userId, { description: 'x' })).rejects.toThrow(ForbiddenException)
        })
      })

      describe('deleteAbilityLevel', () => {
        it('deletes a level', async () => {
          prisma.characterAbilityLevel.findUnique.mockResolvedValue({ id: 'lvl-1', abilityId })
          prisma.characterAbilityLevel.delete.mockResolvedValue({ id: 'lvl-1' })

          const result = await service.deleteAbilityLevel('lvl-1', userId)

          expect(prisma.characterAbilityLevel.findUnique).toHaveBeenCalledWith({ where: { id: 'lvl-1' } })
          expect(prisma.characterAbilityLevel.delete).toHaveBeenCalledWith({ where: { id: 'lvl-1' } })
          expect(result).toEqual({ id: 'lvl-1' })
        })

        it('throws NotFoundException for missing level', async () => {
          prisma.characterAbilityLevel.findUnique.mockResolvedValue(null)

          await expect(service.deleteAbilityLevel('nonexistent', userId)).rejects.toThrow(NotFoundException)
        })
      })
    })
  })

  // ── Skill profile & attribute updates ─────────────────────────

  describe('updateSkillProfileValue', () => {
    const sheetId = 'sheet-sk'
    const skillId = 'skill-1'
    const profileId = 'prof-1'
    const userId = 'u1'

    beforeEach(() => {
      prisma.characterSheet.findUnique.mockResolvedValue({ id: sheetId, ownerId: userId, adventureId: null })
    })

    it('upserts skill profile value with an optionId', async () => {
      prisma.characterSheetSkillProfileValue.upsert.mockResolvedValue({ id: 'spv-1', skillId, profileId, optionId: 'opt-1' })

      const result = await service.updateSkillProfileValue(sheetId, skillId, profileId, 'opt-1', userId)

      expect(prisma.characterSheetSkillProfileValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sheetId_skillId_profileId: { sheetId, skillId, profileId } }),
          update: expect.objectContaining({ optionId: 'opt-1' }),
          create: expect.objectContaining({ optionId: 'opt-1' }),
        }),
      )
      expect(result.optionId).toBe('opt-1')
    })

    it('upserts skill profile value with null optionId', async () => {
      prisma.characterSheetSkillProfileValue.upsert.mockResolvedValue({ id: 'spv-2', skillId, profileId, optionId: null })

      const result = await service.updateSkillProfileValue(sheetId, skillId, profileId, null, userId)

      expect(result.optionId).toBeNull()
    })

    it('calls invalidateCache after upsert', async () => {
      prisma.characterSheetSkillProfileValue.upsert.mockResolvedValue({ id: 'spv-3' })

      await service.updateSkillProfileValue(sheetId, skillId, profileId, 'opt-1', userId)

      expect(mockRedisService.del).toHaveBeenCalled()
    })
  })

  describe('updateSkillAttribute', () => {
    const sheetId = 'sheet-sk'
    const skillId = 'skill-1'
    const userId = 'u1'

    beforeEach(() => {
      prisma.characterSheet.findUnique.mockResolvedValue({ id: sheetId, ownerId: userId, adventureId: null })
    })

    it('upserts skill value with the given selectedAttributeId', async () => {
      prisma.characterSheetSkillValue.upsert.mockResolvedValue({ id: 'csv-1', skillId, selectedAttributeId: 'attr-1', value: null })

      const result = await service.updateSkillAttribute(sheetId, skillId, 'attr-1', userId)

      expect(prisma.characterSheetSkillValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sheetId_skillId: { sheetId, skillId } },
          update: expect.objectContaining({ selectedAttributeId: 'attr-1' }),
          create: expect.objectContaining({ selectedAttributeId: 'attr-1' }),
        }),
      )
      expect(result.selectedAttributeId).toBe('attr-1')
    })

    it('upserts skill value with null selectedAttributeId', async () => {
      prisma.characterSheetSkillValue.upsert.mockResolvedValue({ id: 'csv-2', skillId, selectedAttributeId: null, value: null })

      const result = await service.updateSkillAttribute(sheetId, skillId, null, userId)

      expect(result.selectedAttributeId).toBeNull()
    })

    it('calls invalidateCache after upsert', async () => {
      prisma.characterSheetSkillValue.upsert.mockResolvedValue({ id: 'csv-3' })

      await service.updateSkillAttribute(sheetId, skillId, 'attr-1', userId)

      expect(mockRedisService.del).toHaveBeenCalled()
    })
  })

  // ── Summon creation in createAbility ────────────────────────────

  describe('createAbility with SUMMON type', () => {
    const sheetId = 'sheet-summon'
    const userId = 'u1'

    beforeEach(() => {
      prisma.characterSheet.findUnique.mockResolvedValue({
        id: sheetId, ownerId: userId, adventureId: null, templateId: 'tpl-1',
        template: {
          attributes: [
            { id: 'ta-1', key: 'str', name: 'Strength', order: 0, templateId: 'tpl-1' },
          ],
          armorClasses: [
            { id: 'ac-1', name: 'Armor Class', order: 0, templateId: 'tpl-1', fields: [{ id: 'ac-f-1', name: 'Base', defaultValue: '10', order: 0 }] },
          ],
        },
      })
      prisma.characterAbility.count.mockResolvedValue(0)
    })

    it('creates a summon ability with attributes, AC, and health', async () => {
      prisma.characterAbility.create.mockResolvedValue({ id: 'ab-summon', type: 'SUMMON', name: 'Wolf' })

      const result = await service.createAbility(
        sheetId,
        userId,
        { name: 'Wolf', type: 'SUMMON', description: 'A fierce wolf' },
      )

      expect(result.type).toBe('SUMMON')
      expect(result.name).toBe('Wolf')
      expect(prisma.characterAbility.create).toHaveBeenCalled()
      // Should not call old separate queries — template included in sheet fetch
      expect(prisma.templateAttribute.findMany).not.toHaveBeenCalled()
      expect(prisma.templateArmorClass.findMany).not.toHaveBeenCalled()
    })
  })

  // ── Summon abilities ──────────────────────────────────────────

  describe('summon abilities & levels', () => {
    const userId = 'u1'
    const sheetId = 'sheet-sum'
    const abilityId = 'ab-summon'

    beforeEach(() => {
      prisma.characterAbility.findUnique.mockResolvedValue({ id: abilityId, sheetId: sheetId, type: 'SUMMON' })
      prisma.characterSheet.findUnique.mockResolvedValue({ id: sheetId, ownerId: userId, adventureId: null })
      jest.clearAllMocks()
    })

    describe('listSummonAbilities', () => {
      it('lists summon abilities for a parent ability', async () => {
        prisma.characterAbility.findMany.mockResolvedValue([
          { id: 'summon-1', name: 'Wolf', type: 'SUMMON' },
          { id: 'summon-2', name: 'Bear', type: 'SUMMON' },
        ])

        const results = await service.listSummonAbilities(abilityId, userId)

        expect(prisma.characterAbility.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { summonId: abilityId } }),
        )
        expect(results).toHaveLength(2)
      })
    })

    describe('createSummonAbility', () => {
      it('creates a summon ability with a starting level', async () => {
        prisma.characterAbility.count.mockResolvedValue(0)
        prisma.characterAbility.create.mockResolvedValue({ id: 'new-summon', name: 'Wolf', type: 'SUMMON' })
        prisma.characterAbilityLevel.create.mockResolvedValue({ id: 'lvl-1', level: 1 })

        const result = await service.createSummonAbility(abilityId, userId, { name: 'Wolf', description: 'Wolf' })

        expect(result.name).toBe('Wolf')
        expect(prisma.characterAbility.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ summonId: abilityId }) }),
        )
      })

      it('throws ForbiddenException when parent ability is not SUMMON type', async () => {
        prisma.characterAbility.findUnique.mockResolvedValue({ id: abilityId, sheetId: sheetId, type: 'CLASS' })

        await expect(service.createSummonAbility(abilityId, userId, { name: 'Wolf', description: 'Wolf' }))
          .rejects.toThrow('Only summons can have child abilities')
      })
    })

    describe('ability levels', () => {
      beforeEach(() => {
        prisma.characterAbility.findUnique.mockResolvedValue({ id: abilityId, sheetId: sheetId, type: 'SUMMON' })
        prisma.characterAbility.findFirst.mockResolvedValue(null)
      })

      describe('listAbilityLevels', () => {
        it('lists all levels for an ability', async () => {
          prisma.characterAbilityLevel.findMany.mockResolvedValue([
            { id: 'lvl-1', level: 1, abilityId },
            { id: 'lvl-2', level: 2, abilityId },
          ])

          const results = await service.listAbilityLevels(abilityId, userId)

          expect(prisma.characterAbilityLevel.findMany).toHaveBeenCalledWith({
            where: { abilityId }, orderBy: { level: 'asc' },
          })
          expect(results).toHaveLength(2)
        })
      })

      describe('createAbilityLevel', () => {
        it('creates a level without copyFromPrevious', async () => {
          prisma.characterAbilityLevel.create.mockResolvedValue({ id: 'lvl-3', level: 3, abilityId })

          const result = await service.createAbilityLevel(abilityId, userId, { level: 3 })

          expect(result.level).toBe(3)
        })

        it('creates a level with copyFromPrevious', async () => {
          prisma.characterAbility.findUnique.mockResolvedValue({
            id: abilityId, sheetId: sheetId, type: 'SUMMON',
            levels: [{ id: 'prev-lvl', level: '2', description: 'previous' }],
          })
          prisma.characterAbilityLevel.findFirst.mockResolvedValue(null)
          prisma.characterAbilityLevel.create.mockResolvedValue({ id: 'lvl-3', level: '3', abilityId, description: 'previous' })

          const result = await service.createAbilityLevel(abilityId, userId, { level: 3, copyFromPrevious: true })

          // Should have found the previous level and copied its description
          expect(result.level).toBe('3')
        })

        it('throws ConflictException for duplicate level', async () => {
          prisma.characterAbilityLevel.findFirst.mockResolvedValue({ id: 'lvl-2', level: 2, abilityId })

          await expect(service.createAbilityLevel(abilityId, userId, { level: 2 }))
            .rejects.toThrow('already exists')
        })
      })

      describe('updateAbilityLevel', () => {
        it('updates a level', async () => {
          prisma.characterAbilityLevel.findUnique.mockResolvedValue({ id: 'lvl-1', abilityId })
          prisma.characterAbilityLevel.update.mockResolvedValue({ id: 'lvl-1', level: 1, description: 'updated' })

          const result = await service.updateAbilityLevel('lvl-1', userId, { description: 'updated' })

          expect(result.description).toBe('updated')
        })

        it('throws NotFoundException for missing level', async () => {
          prisma.characterAbilityLevel.findUnique.mockResolvedValue(null)

          await expect(service.updateAbilityLevel('nonexistent', userId, { description: 'x' }))
            .rejects.toThrow('not found')
        })
      })

      describe('deleteAbilityLevel', () => {
        it('deletes a level', async () => {
          prisma.characterAbilityLevel.findUnique.mockResolvedValue({ id: 'lvl-1', abilityId })
          prisma.characterAbilityLevel.delete.mockResolvedValue({ id: 'lvl-1' })

          const result = await service.deleteAbilityLevel('lvl-1', userId)

          expect(result).toEqual({ id: 'lvl-1' })
        })

        it('throws NotFoundException for missing level', async () => {
          prisma.characterAbilityLevel.findUnique.mockResolvedValue(null)

          await expect(service.deleteAbilityLevel('nonexistent', userId))
            .rejects.toThrow('not found')
        })
      })
    })
  })

  // ── Summon skills ─────────────────────────────────────────────

  describe('summon skills', () => {
    const userId = 'u1'
    const sheetId = 'sheet-sum'
    const abilityId = 'ab-summon'

    beforeEach(() => {
      prisma.characterAbility.findUnique.mockResolvedValue({ id: abilityId, sheetId: sheetId, type: 'SUMMON' })
      prisma.characterSheet.findUnique.mockResolvedValue({ id: sheetId, ownerId: userId, adventureId: null })
      jest.clearAllMocks()
    })

    describe('addSummonSkill', () => {
      it('adds a skill to a summon', async () => {
        prisma.templateSkill.findUnique.mockResolvedValue({
          id: 'tsk-1', name: 'Bite', templateId: 'tpl-1', defaultAttributeId: 'attr-str',
        })
        prisma.summonSkill.create.mockResolvedValue({
          id: 'ss-1', skillId: 'tsk-1', abilityId, selectedAttributeId: 'attr-str',
        })

        const result = await service.addSummonSkill(abilityId, 'tsk-1', userId)

        expect(result.skillId).toBe('tsk-1')
        expect(prisma.summonSkill.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ selectedAttributeId: 'attr-str' }),
          }),
        )
      })

      it('throws ForbiddenException when parent is not SUMMON type', async () => {
        prisma.characterAbility.findUnique.mockResolvedValue({ id: abilityId, sheetId: sheetId, type: 'CLASS' })

        await expect(service.addSummonSkill(abilityId, 'tsk-1', userId))
          .rejects.toThrow('Skills can only be added to summons')
      })
    })

    describe('removeSummonSkill', () => {
      it('removes a skill from a summon', async () => {
        prisma.summonSkill.findUnique.mockResolvedValue({
          id: 'ss-1', abilityId, ability: { sheetId: sheetId },
        })
        prisma.summonSkill.delete.mockResolvedValue({ id: 'ss-1' })

        const result = await service.removeSummonSkill('ss-1', userId)

        expect(result).toEqual({ id: 'ss-1' })
      })

      it('throws NotFoundException for missing summon skill', async () => {
        prisma.summonSkill.findUnique.mockResolvedValue(null)

        await expect(service.removeSummonSkill('nonexistent', userId))
          .rejects.toThrow('not found')
      })
    })

    describe('updateSummonSkillAttribute', () => {
      it('updates the attribute of a summon skill', async () => {
        prisma.summonSkill.findUnique.mockResolvedValue({
          id: 'ss-1', abilityId, ability: { sheetId: sheetId },
        })
        prisma.summonSkill.update.mockResolvedValue({
          id: 'ss-1', attributeId: 'attr-dex', includes: { attribute: { id: 'attr-dex' } },
        })

        const result = await service.updateSummonSkillAttribute('ss-1', 'attr-dex', userId)

        expect(result.attributeId).toBe('attr-dex')
      })
    })

    describe('updateSummonSkillProfile', () => {
      it('upserts a skill profile value for a summon', async () => {
        prisma.summonSkill.findUnique.mockResolvedValue({
          id: 'ss-1', abilityId, ability: { sheetId: sheetId },
        })
        prisma.summonSkillProfileValue.upsert.mockResolvedValue({
          id: 'sspv-1', skillId: 'ss-1', profileId: 'prof-1', optionId: 'opt-1',
        })

        const result = await service.updateSummonSkillProfile('ss-1', 'prof-1', 'opt-1', userId)

        expect(result.optionId).toBe('opt-1')
      })
    })
  })

  // ── Summon values ─────────────────────────────────────────────

  describe('summon values (attribute, AC, health, resistances)', () => {
    const userId = 'u1'
    const abilityId = 'ab-summon'
    const sheetId = 'sheet-sum'

    beforeEach(() => {
      prisma.characterAbility.findUnique.mockResolvedValue({ id: abilityId, sheetId: sheetId, type: 'SUMMON' })
      prisma.characterSheet.findUnique.mockResolvedValue({ id: sheetId, ownerId: userId, adventureId: null })
      jest.clearAllMocks()
    })

    describe('updateSummonAttribute', () => {
      it('upserts a summon attribute value', async () => {
        prisma.summonAttribute.upsert.mockResolvedValue({ id: 'sa-1', attributeId: 'attr-str', value: '16' })

        const result = await service.updateSummonAttribute(abilityId, 'attr-str', '16', userId)

        expect(result.value).toBe('16')
      })
    })

    describe('updateSummonAcValue', () => {
      it('upserts a summon AC value', async () => {
        prisma.summonArmorClassValue.upsert.mockResolvedValue({ id: 'sac-1', fieldId: 'ac-field-1', value: '12' })

        const result = await service.updateSummonAcValue(abilityId, 'ac-field-1', '12', userId)

        expect(result.value).toBe('12')
      })
    })

    describe('updateSummonAcAttributeValue', () => {
      it('upserts a summon AC attribute value', async () => {
        prisma.summonArmorClassAttributeValue.upsert.mockResolvedValue({
          id: 'sacav-1', acAttributeModifierId: 'am-1', selectedAttributeId: 'attr-dex',
        })

        const result = await service.updateSummonAcAttributeValue(abilityId, 'am-1', 'attr-dex', userId)

        expect(result.selectedAttributeId).toBe('attr-dex')
      })
    })

    describe('updateSummonHealth', () => {
      it('upserts summon health', async () => {
        prisma.summonHealth.upsert.mockResolvedValue({ id: 'sh-1', current: 50, maximum: 50, notes: null })

        const result = await service.updateSummonHealth(abilityId, userId, { current: 50, maximum: 50 })

        expect(result.current).toBe(50)
      })
    })

    describe('updateSummonResistanceValue', () => {
      it('upserts a summon resistance value', async () => {
        prisma.summonResistanceValue.upsert.mockResolvedValue({ id: 'srv-1', resistanceId: 'res-1', manualValue: '12' })

        const result = await service.updateSummonResistanceValue(abilityId, 'res-1', '12', userId)

        expect(result.manualValue).toBe('12')
      })
    })

    describe('updateSummonResistanceComponentValue', () => {
      it('upserts a summon resistance component value', async () => {
        prisma.summonResistanceComponentValue.upsert.mockResolvedValue({ id: 'srcv-1', componentId: 'comp-1', value: '5' })

        const result = await service.updateSummonResistanceComponentValue(abilityId, 'comp-1', '5', userId)

        expect(result.value).toBe('5')
      })
    })
  })

  // ── inventory, story, sections, resistances, professional skills ─────

  describe('inventory, story, sections, resistances, professional skills', () => {
    const userId = 'user-1'
    const sheetId = 'sheet-1'

    beforeEach(() => {
      // All methods in this group call requireOwnership internally via the sheet lookup
      prisma.characterSheet.findUnique.mockResolvedValue({
        id: sheetId,
        ownerId: userId,
        adventureId: null,
      })
    })

    // ────────── Inventory ──────────

    describe('listInventory', () => {
      it('returns items ordered by order', async () => {
        const items = [
          { id: 'i1', name: 'Shield', order: 0 },
          { id: 'i2', name: 'Sword', order: 1 },
        ]
        prisma.characterInventoryItem.findMany.mockResolvedValue(items)

        const result = await service.listInventory(sheetId, userId)

        expect(prisma.characterInventoryItem.findMany).toHaveBeenCalledWith({
          where: { sheetId },
          orderBy: { order: 'asc' },
        })
        expect(result).toEqual(items)
      })

      it('throws ForbiddenException when not the owner and not a GM', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId,
          ownerId: 'owner-user',
          adventureId: null,
        })

        await expect(service.listInventory(sheetId, 'other-user')).rejects.toThrow(ForbiddenException)
      })
    })

    describe('createInventoryItem', () => {
      const dto = { name: 'Potion', weight: 0.5, cost: '50 gp', description: 'Heals 10 HP' }

      it('creates item with auto-order based on count', async () => {
        prisma.characterInventoryItem.count.mockResolvedValue(3)
        const created = { id: 'inv-new', name: 'Potion', weight: 0.5, cost: '50 gp', description: 'Heals 10 HP', order: 3 }
        prisma.characterInventoryItem.create.mockResolvedValue(created)

        const result = await service.createInventoryItem(sheetId, userId, dto)

        expect(prisma.characterInventoryItem.count).toHaveBeenCalledWith({ where: { sheetId } })
        expect(prisma.characterInventoryItem.create).toHaveBeenCalledWith({
          data: {
            sheetId,
            name: 'Potion',
            weight: 0.5,
            cost: '50 gp',
            description: 'Heals 10 HP',
            order: 3,
          },
        })
        expect(result).toEqual(created)
      })

      it('creates item with order 0 when there are no existing items', async () => {
        prisma.characterInventoryItem.count.mockResolvedValue(0)
        const created = { id: 'inv-new', name: 'Sword', order: 0 }
        prisma.characterInventoryItem.create.mockResolvedValue(created)

        const result = await service.createInventoryItem(sheetId, userId, { name: 'Sword' })

        expect(prisma.characterInventoryItem.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ order: 0 }),
          }),
        )
        expect(result).toEqual(created)
      })

      it('uses defaults for optional fields when not provided', async () => {
        prisma.characterInventoryItem.count.mockResolvedValue(0)
        prisma.characterInventoryItem.create.mockResolvedValue({ id: 'inv-new', name: 'Item' })

        await service.createInventoryItem(sheetId, userId, { name: 'Item' })

        expect(prisma.characterInventoryItem.create).toHaveBeenCalledWith({
          data: {
            sheetId,
            name: 'Item',
            weight: null,
            cost: null,
            description: null,
            order: 0,
          },
        })
      })

      it('invalidates cache after creation', async () => {
        prisma.characterInventoryItem.count.mockResolvedValue(0)
        prisma.characterInventoryItem.create.mockResolvedValue({ id: 'inv-new' })

        await service.createInventoryItem(sheetId, userId, { name: 'Item' })

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

    describe('updateInventoryItem', () => {
      const itemId = 'item-1'
      const dto = { name: 'Updated Potion', weight: 1.0, cost: '100 gp', description: 'Better healing' }
      const mockInventoryItem = { id: itemId, sheetId, name: 'Potion', weight: 0.5, order: 0 }

      it('updates item fields', async () => {
        prisma.characterInventoryItem.findUnique.mockResolvedValue(mockInventoryItem)
        const updated = { ...mockInventoryItem, ...dto }
        prisma.characterInventoryItem.update.mockResolvedValue(updated)

        const result = await service.updateInventoryItem(itemId, userId, dto)

        expect(prisma.characterInventoryItem.findUnique).toHaveBeenCalledWith({ where: { id: itemId } })
        expect(prisma.characterSheet.findUnique).toHaveBeenCalledWith({ where: { id: sheetId } })
        expect(prisma.characterInventoryItem.update).toHaveBeenCalledWith({
          where: { id: itemId },
          data: { name: 'Updated Potion', weight: 1.0, cost: '100 gp', description: 'Better healing' },
        })
        expect(result).toEqual(updated)
      })

      it('throws NotFoundException when item does not exist', async () => {
        prisma.characterInventoryItem.findUnique.mockResolvedValue(null)

        await expect(service.updateInventoryItem('nonexistent', userId, dto)).rejects.toThrow(NotFoundException)
        await expect(service.updateInventoryItem('nonexistent', userId, dto)).rejects.toThrow('Inventory item not found')
      })

      it('throws ForbiddenException when not owner and not GM', async () => {
        prisma.characterInventoryItem.findUnique.mockResolvedValue(mockInventoryItem)
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId,
          ownerId: 'owner-user',
          adventureId: null,
        })

        await expect(service.updateInventoryItem(itemId, 'other-user', dto)).rejects.toThrow(ForbiddenException)
      })

      it('invalidates cache after update', async () => {
        prisma.characterInventoryItem.findUnique.mockResolvedValue(mockInventoryItem)
        prisma.characterInventoryItem.update.mockResolvedValue({ ...mockInventoryItem, ...dto })

        await service.updateInventoryItem(itemId, userId, dto)

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

    describe('removeInventoryItem', () => {
      const itemId = 'item-1'
      const mockInventoryItem = { id: itemId, sheetId, name: 'Potion', order: 0 }

      it('deletes the item', async () => {
        prisma.characterInventoryItem.findUnique.mockResolvedValue(mockInventoryItem)
        prisma.characterInventoryItem.delete.mockResolvedValue(mockInventoryItem)

        const result = await service.removeInventoryItem(itemId, userId)

        expect(prisma.characterInventoryItem.findUnique).toHaveBeenCalledWith({ where: { id: itemId } })
        expect(prisma.characterSheet.findUnique).toHaveBeenCalledWith({ where: { id: sheetId } })
        expect(prisma.characterInventoryItem.delete).toHaveBeenCalledWith({ where: { id: itemId } })
        expect(result).toEqual(mockInventoryItem)
      })

      it('throws NotFoundException when item does not exist', async () => {
        prisma.characterInventoryItem.findUnique.mockResolvedValue(null)

        await expect(service.removeInventoryItem('nonexistent', userId)).rejects.toThrow(NotFoundException)
        await expect(service.removeInventoryItem('nonexistent', userId)).rejects.toThrow('Inventory item not found')
      })

      it('throws ForbiddenException when not owner and not GM', async () => {
        prisma.characterInventoryItem.findUnique.mockResolvedValue(mockInventoryItem)
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId,
          ownerId: 'owner-user',
          adventureId: null,
        })

        await expect(service.removeInventoryItem(itemId, 'other-user')).rejects.toThrow(ForbiddenException)
      })

      it('invalidates cache after deletion', async () => {
        prisma.characterInventoryItem.findUnique.mockResolvedValue(mockInventoryItem)
        prisma.characterInventoryItem.delete.mockResolvedValue(mockInventoryItem)

        await service.removeInventoryItem(itemId, userId)

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

    // ────────── Story ──────────

    describe('getStory', () => {
      it('returns existing story when found', async () => {
        const story = { id: 'story-1', sheetId, appearance: 'Tall', backstory: 'Hero origins' }
        prisma.characterStory.findUnique.mockResolvedValue(story)

        const result = await service.getStory(sheetId, userId)

        expect(prisma.characterStory.findUnique).toHaveBeenCalledWith({ where: { sheetId } })
        expect(result).toEqual(story)
      })

      it('creates a new story when not found', async () => {
        prisma.characterStory.findUnique.mockResolvedValue(null)
        const newStory = { id: 'story-new', sheetId }
        prisma.characterStory.create.mockResolvedValue(newStory)

        const result = await service.getStory(sheetId, userId)

        expect(prisma.characterStory.create).toHaveBeenCalledWith({ data: { sheetId } })
        expect(result).toEqual(newStory)
      })

      it('throws ForbiddenException when not the owner and not a GM', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId,
          ownerId: 'owner-user',
          adventureId: null,
        })

        await expect(service.getStory(sheetId, 'other-user')).rejects.toThrow(ForbiddenException)
      })
    })

    describe('updateStory', () => {
      const dto = { appearance: 'Very Tall', backstory: 'Epic tale', personality: 'Brave', goals: 'Save the world', notes: 'None' }

      it('upserts story content', async () => {
        const updated = { id: 'story-1', sheetId, ...dto }
        prisma.characterStory.upsert.mockResolvedValue(updated)

        const result = await service.updateStory(sheetId, userId, dto)

        expect(prisma.characterStory.upsert).toHaveBeenCalledWith({
          where: { sheetId },
          create: { sheetId, ...dto },
          update: { ...dto },
        })
        expect(result).toEqual(updated)
      })

      it('creates a new story when one does not exist via upsert', async () => {
        const newStory = { id: 'story-new', sheetId, appearance: 'Tall' }
        prisma.characterStory.upsert.mockResolvedValue(newStory)

        const result = await service.updateStory(sheetId, userId, { appearance: 'Tall' })

        expect(prisma.characterStory.upsert).toHaveBeenCalledWith({
          where: { sheetId },
          create: { sheetId, appearance: 'Tall' },
          update: { appearance: 'Tall' },
        })
        expect(result).toEqual(newStory)
      })

      it('throws ForbiddenException when not the owner and not a GM', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId,
          ownerId: 'owner-user',
          adventureId: null,
        })

        await expect(service.updateStory(sheetId, 'other-user', { appearance: 'Short' })).rejects.toThrow(ForbiddenException)
      })

      it('invalidates cache after upsert', async () => {
        prisma.characterStory.upsert.mockResolvedValue({ id: 'story-1' })

        await service.updateStory(sheetId, userId, { appearance: 'Tall' })

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

    // ────────── Section Entries ──────────

    describe('listSectionEntries', () => {
      it('returns entries with section include ordered by order', async () => {
        const entries = [
          { id: 'e1', name: 'Entry 1', order: 0, section: { id: 'sec-1', name: 'Background' } },
          { id: 'e2', name: 'Entry 2', order: 1, section: { id: 'sec-1', name: 'Background' } },
        ]
        prisma.characterSectionEntry.findMany.mockResolvedValue(entries)

        const result = await service.listSectionEntries(sheetId, userId)

        expect(prisma.characterSectionEntry.findMany).toHaveBeenCalledWith({
          where: { sheetId },
          orderBy: { order: 'asc' },
          include: { section: { select: { id: true, name: true } } },
        })
        expect(result).toEqual(entries)
      })

      it('throws ForbiddenException when not the owner and not a GM', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId,
          ownerId: 'owner-user',
          adventureId: null,
        })

        await expect(service.listSectionEntries(sheetId, 'other-user')).rejects.toThrow(ForbiddenException)
      })
    })

    describe('createSectionEntry', () => {
      const dto = { sectionId: 'sec-1', name: 'New Entry', description: 'A description', notes: 'Some notes' }

      it('creates entry with auto-order scoped to section', async () => {
        prisma.characterSectionEntry.count.mockResolvedValue(2)
        const created = { id: 'entry-new', sectionId: 'sec-1', name: 'New Entry', description: 'A description', notes: 'Some notes', order: 2, section: { id: 'sec-1', name: 'Background' } }
        prisma.characterSectionEntry.create.mockResolvedValue(created)

        const result = await service.createSectionEntry(sheetId, userId, dto)

        expect(prisma.characterSectionEntry.count).toHaveBeenCalledWith({ where: { sheetId, sectionId: 'sec-1' } })
        expect(prisma.characterSectionEntry.create).toHaveBeenCalledWith({
          data: {
            sheetId,
            sectionId: 'sec-1',
            name: 'New Entry',
            description: 'A description',
            notes: 'Some notes',
            order: 2,
          },
          include: { section: { select: { id: true, name: true } } },
        })
        expect(result).toEqual(created)
      })

      it('uses empty string for description and null for notes when not provided', async () => {
        prisma.characterSectionEntry.count.mockResolvedValue(0)
        prisma.characterSectionEntry.create.mockResolvedValue({ id: 'entry-new', sectionId: 'sec-1', name: 'Minimal' })

        await service.createSectionEntry(sheetId, userId, { sectionId: 'sec-1', name: 'Minimal' })

        const createCall = prisma.characterSectionEntry.create.mock.calls[0][0]
        expect(createCall.data.description).toBe('')
        expect(createCall.data.notes).toBeNull()
      })

      it('invalidates cache after creation', async () => {
        prisma.characterSectionEntry.count.mockResolvedValue(0)
        prisma.characterSectionEntry.create.mockResolvedValue({ id: 'entry-new' })

        await service.createSectionEntry(sheetId, userId, dto)

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

    describe('updateSectionEntry', () => {
      const entryId = 'entry-1'
      const dto = { name: 'Updated Entry', description: 'Updated desc', notes: 'Updated notes' }
      const mockEntry = { id: entryId, sheetId, sectionId: 'sec-1', name: 'Old Entry', order: 0 }

      it('updates the entry', async () => {
        prisma.characterSectionEntry.findUnique.mockResolvedValue(mockEntry)
        const updated = { ...mockEntry, ...dto, section: { id: 'sec-1', name: 'Background' } }
        prisma.characterSectionEntry.update.mockResolvedValue(updated)

        const result = await service.updateSectionEntry(entryId, userId, dto)

        expect(prisma.characterSectionEntry.findUnique).toHaveBeenCalledWith({ where: { id: entryId } })
        expect(prisma.characterSectionEntry.update).toHaveBeenCalledWith({
          where: { id: entryId },
          data: { name: 'Updated Entry', description: 'Updated desc', notes: 'Updated notes' },
          include: { section: { select: { id: true, name: true } } },
        })
        expect(result).toEqual(updated)
      })

      it('throws NotFoundException when entry does not exist', async () => {
        prisma.characterSectionEntry.findUnique.mockResolvedValue(null)

        await expect(service.updateSectionEntry('nonexistent', userId, dto)).rejects.toThrow(NotFoundException)
        await expect(service.updateSectionEntry('nonexistent', userId, dto)).rejects.toThrow('Section entry not found')
      })

      it('throws ForbiddenException when not the owner and not a GM', async () => {
        prisma.characterSectionEntry.findUnique.mockResolvedValue(mockEntry)
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId,
          ownerId: 'owner-user',
          adventureId: null,
        })

        await expect(service.updateSectionEntry(entryId, 'other-user', dto)).rejects.toThrow(ForbiddenException)
      })

      it('invalidates cache after update', async () => {
        prisma.characterSectionEntry.findUnique.mockResolvedValue(mockEntry)
        prisma.characterSectionEntry.update.mockResolvedValue({ ...mockEntry, ...dto })

        await service.updateSectionEntry(entryId, userId, dto)

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

    describe('removeSectionEntry', () => {
      const entryId = 'entry-1'
      const mockEntry = { id: entryId, sheetId, sectionId: 'sec-1', name: 'Entry', order: 0 }

      it('deletes the entry', async () => {
        prisma.characterSectionEntry.findUnique.mockResolvedValue(mockEntry)
        prisma.characterSectionEntry.delete.mockResolvedValue(mockEntry)

        const result = await service.removeSectionEntry(entryId, userId)

        expect(prisma.characterSectionEntry.findUnique).toHaveBeenCalledWith({ where: { id: entryId } })
        expect(prisma.characterSectionEntry.delete).toHaveBeenCalledWith({ where: { id: entryId } })
        expect(result).toEqual(mockEntry)
      })

      it('throws NotFoundException when entry does not exist', async () => {
        prisma.characterSectionEntry.findUnique.mockResolvedValue(null)

        await expect(service.removeSectionEntry('nonexistent', userId)).rejects.toThrow(NotFoundException)
        await expect(service.removeSectionEntry('nonexistent', userId)).rejects.toThrow('Section entry not found')
      })

      it('throws ForbiddenException when not the owner and not a GM', async () => {
        prisma.characterSectionEntry.findUnique.mockResolvedValue(mockEntry)
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId,
          ownerId: 'owner-user',
          adventureId: null,
        })

        await expect(service.removeSectionEntry(entryId, 'other-user')).rejects.toThrow(ForbiddenException)
      })

      it('invalidates cache after deletion', async () => {
        prisma.characterSectionEntry.findUnique.mockResolvedValue(mockEntry)
        prisma.characterSectionEntry.delete.mockResolvedValue(mockEntry)

        await service.removeSectionEntry(entryId, userId)

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

    // ────────── Resistances ──────────

    describe('createResistance', () => {
      it('creates MANUAL resistance with components and enforces ownership-or-GM', async () => {
        prisma.sheetResistance.aggregate.mockResolvedValue({ _max: { order: 2 } })
        const created = {
          id: 'sr-new',
          name: 'Fire Resistance',
          calculationType: 'MANUAL',
          order: 3,
          components: [{ id: 'comp-1', name: 'Base', value: '5', order: 0, editableByPlayer: false }],
          attributeModifiers: [],
        }
        prisma.sheetResistance.create.mockResolvedValue(created)

        const result = await service.createResistance(sheetId, userId, {
          name: 'Fire Resistance',
          calculationType: 'MANUAL',
          components: [{ name: 'Base', defaultValue: '5' }],
        })

        expect(prisma.characterSheet.findUnique).toHaveBeenCalledWith({ where: { id: sheetId } })
        expect(prisma.sheetResistance.aggregate).toHaveBeenCalledWith({
          where: { sheetId },
          _max: { order: true },
        })
        expect(prisma.sheetResistance.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'Fire Resistance',
              calculationType: 'MANUAL',
              order: 3,
              components: {
                create: expect.arrayContaining([
                  expect.objectContaining({ name: 'Base', value: '5', order: 0 }),
                ]),
              },
            }),
          }),
        )
        expect(result).toEqual(created)
      })

      it('creates CALCULATED resistance with components and attributeModifiers', async () => {
        prisma.sheetResistance.aggregate.mockResolvedValue({ _max: { order: -1 } })
        prisma.sheetResistance.create.mockResolvedValue({
          id: 'sr-new',
          name: 'Armor',
          calculationType: 'CALCULATED',
          order: 0,
          components: [],
          attributeModifiers: [{ id: 'am-1', attributeId: 'attr-1', enabled: true }],
        })

        const result = await service.createResistance(sheetId, userId, {
          name: 'Armor',
          calculationType: 'CALCULATED',
          components: [{ name: 'Base', defaultValue: '10' }],
          attributeModifiers: [{ attributeId: 'attr-1', enabled: true }],
        })

        expect(prisma.sheetResistance.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'Armor',
              calculationType: 'CALCULATED',
              order: 0,
              attributeModifiers: {
                create: expect.arrayContaining([
                  expect.objectContaining({ attributeId: 'attr-1', enabled: true }),
                ]),
              },
            }),
          }),
        )
        expect(result.name).toBe('Armor')
      })

      it('sets order to 0 when there are no existing resistances', async () => {
        prisma.sheetResistance.aggregate.mockResolvedValue({ _max: { order: null } })
        prisma.sheetResistance.create.mockResolvedValue({ id: 'sr-new', name: 'New', order: 0 })

        await service.createResistance(sheetId, userId, { name: 'New', calculationType: 'MANUAL' })

        expect(prisma.sheetResistance.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ order: 0 }),
          }),
        )
      })

      it('trims whitespace from name and component names', async () => {
        prisma.sheetResistance.aggregate.mockResolvedValue({ _max: { order: null } })
        prisma.sheetResistance.create.mockResolvedValue({ id: 'sr-new' })

        await service.createResistance(sheetId, userId, {
          name: '  Fire Resistance  ',
          calculationType: 'MANUAL',
          components: [{ name: '  Base  ', defaultValue: '5' }],
        })

        const createData = prisma.sheetResistance.create.mock.calls[0][0].data
        expect(createData.name).toBe('Fire Resistance')
        expect(createData.components.create[0].name).toBe('Base')
      })

      it('threads NotFoundException when sheet does not exist', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(null)

        await expect(service.createResistance(sheetId, userId, { name: 'Test', calculationType: 'MANUAL' })).rejects.toThrow(NotFoundException)
      })

      it('enforces ownership-or-GM: throws ForbiddenException when not owner and not GM', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId,
          ownerId: 'owner-user',
          adventureId: 'adventure-1',
        })
        mockMembershipService.requireRole.mockRejectedValue(new Error())

        await expect(service.createResistance(sheetId, 'other-user', { name: 'Test', calculationType: 'MANUAL' })).rejects.toThrow(ForbiddenException)
      })

      it('allows GM to create resistance', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId,
          ownerId: 'other-user',
          adventureId: 'adventure-1',
        })
        mockMembershipService.requireRole.mockResolvedValue({ role: 'GM' })
        prisma.sheetResistance.aggregate.mockResolvedValue({ _max: { order: null } })
        prisma.sheetResistance.create.mockResolvedValue({ id: 'sr-new', name: 'GM Added' })

        const result = await service.createResistance(sheetId, 'gm-user', { name: 'GM Added', calculationType: 'MANUAL' })

        expect(mockMembershipService.requireRole).toHaveBeenCalledWith('adventure-1', 'gm-user', 'GM')
        expect(result.name).toBe('GM Added')
      })

      it('defaults calculationType to MANUAL when not provided', async () => {
        prisma.sheetResistance.aggregate.mockResolvedValue({ _max: { order: null } })
        prisma.sheetResistance.create.mockResolvedValue({ id: 'sr-new' })

        await service.createResistance(sheetId, userId, { name: 'Test' } as any)

        const createData = prisma.sheetResistance.create.mock.calls[0][0].data
        expect(createData.calculationType).toBe('MANUAL')
      })

      it('invalidates cache after creation', async () => {
        prisma.sheetResistance.aggregate.mockResolvedValue({ _max: { order: null } })
        prisma.sheetResistance.create.mockResolvedValue({ id: 'sr-new' })

        await service.createResistance(sheetId, userId, { name: 'Test', calculationType: 'MANUAL' })

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

    describe('removeResistance', () => {
      it('removes a sheet-specific resistance', async () => {
        prisma.sheetResistance.findUnique.mockResolvedValue({ id: 'sr-1', sheetId })
        prisma.sheetResistance.delete.mockResolvedValue({ id: 'sr-1' })

        const result = await service.removeResistance(sheetId, 'sr-1', userId)

        expect(prisma.characterSheet.findUnique).toHaveBeenCalledWith({ where: { id: sheetId } })
        expect(prisma.sheetResistance.findUnique).toHaveBeenCalledWith({
          where: { id: 'sr-1' },
          select: { id: true, sheetId: true },
        })
        expect(prisma.sheetResistance.delete).toHaveBeenCalledWith({ where: { id: 'sr-1' } })
        expect(result).toEqual({ id: 'sr-1' })
      })

      it('falls back to template resistance when sheet-specific is not found', async () => {
        prisma.sheetResistance.findUnique.mockResolvedValue(null)
        prisma.templateResistance.delete.mockResolvedValue({ id: 'tr-1' })

        const result = await service.removeResistance(sheetId, 'tr-1', userId)

        expect(prisma.sheetResistance.findUnique).toHaveBeenCalledWith({
          where: { id: 'tr-1' },
          select: { id: true, sheetId: true },
        })
        expect(prisma.templateResistance.delete).toHaveBeenCalledWith({ where: { id: 'tr-1' } })
        expect(result).toEqual({ id: 'tr-1' })
      })

      it('does not delete sheet-specific when sheetId does not match', async () => {
        prisma.sheetResistance.findUnique.mockResolvedValue({ id: 'sr-1', sheetId: 'other-sheet' })
        prisma.templateResistance.delete.mockResolvedValue({ id: 'sr-1' })

        await service.removeResistance(sheetId, 'sr-1', userId)

        expect(prisma.sheetResistance.delete).not.toHaveBeenCalled()
        expect(prisma.templateResistance.delete).toHaveBeenCalledWith({ where: { id: 'sr-1' } })
      })

      it('throws NotFoundException when sheet does not exist', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue(null)

        await expect(service.removeResistance(sheetId, 'sr-1', userId)).rejects.toThrow(NotFoundException)
      })

      it('enforces ownership-or-GM: throws ForbiddenException when not owner and not GM', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId,
          ownerId: 'owner-user',
          adventureId: null,
        })

        await expect(service.removeResistance(sheetId, 'sr-1', 'other-user')).rejects.toThrow(ForbiddenException)
      })

      it('allows GM to remove resistance', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId,
          ownerId: 'other-user',
          adventureId: 'adventure-1',
        })
        mockMembershipService.requireRole.mockResolvedValue({ role: 'GM' })
        prisma.sheetResistance.findUnique.mockResolvedValue(null)
        prisma.templateResistance.delete.mockResolvedValue({ id: 'tr-1' })

        const result = await service.removeResistance(sheetId, 'tr-1', 'gm-user')

        expect(mockMembershipService.requireRole).toHaveBeenCalledWith('adventure-1', 'gm-user', 'GM')
        expect(result).toEqual({ id: 'tr-1' })
      })

      it('invalidates cache after deletion', async () => {
        prisma.sheetResistance.findUnique.mockResolvedValue({ id: 'sr-1', sheetId })
        prisma.sheetResistance.delete.mockResolvedValue({ id: 'sr-1' })

        await service.removeResistance(sheetId, 'sr-1', userId)

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

    // ────────── Professional Skills ──────────

    describe('listProfessionalSkills', () => {
      it('returns skills ordered by order with attribute include', async () => {
        const skills = [
          { id: 'ps-1', name: 'Cooking', order: 0, attribute: { id: 'attr-1', key: 'dex', name: 'Dexterity' } },
          { id: 'ps-2', name: 'Brewing', order: 1, attribute: { id: 'attr-2', key: 'int', name: 'Intelligence' } },
        ]
        prisma.sheetProfessionalSkill.findMany.mockResolvedValue(skills)

        const result = await service.listProfessionalSkills(sheetId, userId)

        expect(prisma.sheetProfessionalSkill.findMany).toHaveBeenCalledWith({
          where: { sheetId },
          orderBy: { order: 'asc' },
          include: { attribute: { select: { id: true, key: true, name: true } } },
        })
        expect(result).toEqual(skills)
      })

      it('throws ForbiddenException when not the owner and not a GM', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId,
          ownerId: 'owner-user',
          adventureId: null,
        })

        await expect(service.listProfessionalSkills(sheetId, 'other-user')).rejects.toThrow(ForbiddenException)
      })
    })

    describe('createProfessionalSkill', () => {
      it('creates skill with auto-order and attribute include', async () => {
        prisma.sheetProfessionalSkill.count.mockResolvedValue(2)
        const created = { id: 'ps-new', name: 'Cooking', attributeId: 'attr-1', order: 2, attribute: { id: 'attr-1', key: 'dex', name: 'Dexterity' } }
        prisma.sheetProfessionalSkill.create.mockResolvedValue(created)

        const result = await service.createProfessionalSkill(sheetId, userId, { name: 'Cooking', attributeId: 'attr-1' })

        expect(prisma.sheetProfessionalSkill.count).toHaveBeenCalledWith({ where: { sheetId } })
        expect(prisma.sheetProfessionalSkill.create).toHaveBeenCalledWith({
          data: { sheetId, name: 'Cooking', attributeId: 'attr-1', order: 2 },
          include: { attribute: { select: { id: true, key: true, name: true } } },
        })
        expect(result).toEqual(created)
      })

      it('uses null for attributeId when not provided', async () => {
        prisma.sheetProfessionalSkill.count.mockResolvedValue(0)
        prisma.sheetProfessionalSkill.create.mockResolvedValue({ id: 'ps-new' })

        await service.createProfessionalSkill(sheetId, userId, { name: 'Generic' })

        expect(prisma.sheetProfessionalSkill.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ attributeId: null }),
          }),
        )
      })

      it('invalidates cache after creation', async () => {
        prisma.sheetProfessionalSkill.count.mockResolvedValue(0)
        prisma.sheetProfessionalSkill.create.mockResolvedValue({ id: 'ps-new' })

        await service.createProfessionalSkill(sheetId, userId, { name: 'Skill' })

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

    describe('updateProfessionalSkill', () => {
      const skillId = 'ps-1'
      const dto = { name: 'Expert Cooking', attributeId: 'attr-2' }
      const mockSkill = { id: skillId, sheetId, name: 'Cooking', attributeId: 'attr-1', order: 0 }

      it('updates the skill', async () => {
        prisma.sheetProfessionalSkill.findUnique.mockResolvedValue(mockSkill)
        const updated = { ...mockSkill, ...dto, attribute: { id: 'attr-2', key: 'int', name: 'Intelligence' } }
        prisma.sheetProfessionalSkill.update.mockResolvedValue(updated)

        const result = await service.updateProfessionalSkill(skillId, userId, dto)

        expect(prisma.sheetProfessionalSkill.findUnique).toHaveBeenCalledWith({ where: { id: skillId } })
        expect(prisma.sheetProfessionalSkill.update).toHaveBeenCalledWith({
          where: { id: skillId },
          data: { name: 'Expert Cooking', attributeId: 'attr-2' },
          include: { attribute: { select: { id: true, key: true, name: true } } },
        })
        expect(result).toEqual(updated)
      })

      it('throws NotFoundException when skill does not exist', async () => {
        prisma.sheetProfessionalSkill.findUnique.mockResolvedValue(null)

        await expect(service.updateProfessionalSkill('nonexistent', userId, dto)).rejects.toThrow(NotFoundException)
        await expect(service.updateProfessionalSkill('nonexistent', userId, dto)).rejects.toThrow('Professional skill not found')
      })

      it('throws ForbiddenException when not the owner and not a GM', async () => {
        prisma.sheetProfessionalSkill.findUnique.mockResolvedValue(mockSkill)
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId,
          ownerId: 'owner-user',
          adventureId: null,
        })

        await expect(service.updateProfessionalSkill(skillId, 'other-user', dto)).rejects.toThrow(ForbiddenException)
      })

      it('invalidates cache after update', async () => {
        prisma.sheetProfessionalSkill.findUnique.mockResolvedValue(mockSkill)
        prisma.sheetProfessionalSkill.update.mockResolvedValue({ ...mockSkill, ...dto })

        await service.updateProfessionalSkill(skillId, userId, dto)

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

    describe('removeProfessionalSkill', () => {
      const skillId = 'ps-1'
      const mockSkill = { id: skillId, sheetId, name: 'Cooking', order: 0 }

      it('deletes the skill', async () => {
        prisma.sheetProfessionalSkill.findUnique.mockResolvedValue(mockSkill)
        prisma.sheetProfessionalSkill.delete.mockResolvedValue(mockSkill)

        const result = await service.removeProfessionalSkill(skillId, userId)

        expect(prisma.sheetProfessionalSkill.findUnique).toHaveBeenCalledWith({ where: { id: skillId } })
        expect(prisma.sheetProfessionalSkill.delete).toHaveBeenCalledWith({ where: { id: skillId } })
        expect(result).toEqual(mockSkill)
      })

      it('throws NotFoundException when skill does not exist', async () => {
        prisma.sheetProfessionalSkill.findUnique.mockResolvedValue(null)

        await expect(service.removeProfessionalSkill('nonexistent', userId)).rejects.toThrow(NotFoundException)
        await expect(service.removeProfessionalSkill('nonexistent', userId)).rejects.toThrow('Professional skill not found')
      })

      it('throws ForbiddenException when not the owner and not a GM', async () => {
        prisma.sheetProfessionalSkill.findUnique.mockResolvedValue(mockSkill)
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId,
          ownerId: 'owner-user',
          adventureId: null,
        })

        await expect(service.removeProfessionalSkill(skillId, 'other-user')).rejects.toThrow(ForbiddenException)
      })

      it('invalidates cache after deletion', async () => {
        prisma.sheetProfessionalSkill.findUnique.mockResolvedValue(mockSkill)
        prisma.sheetProfessionalSkill.delete.mockResolvedValue(mockSkill)

        await service.removeProfessionalSkill(skillId, userId)

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

    describe('cache invalidation failure', () => {
      const userId = 'user-1'
      const sheetId = 'sheet-cache'
      const abilityId = 'ab-cache'

      beforeEach(() => {
        mockRedisService.del.mockRejectedValue(new Error('Redis down'))
      })

      it('handles cache delete failure in createAbility', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({
          id: sheetId, ownerId: userId, adventureId: null, templateId: 'tpl-1',
          template: { attributes: [], armorClasses: [] },
        })
        prisma.characterAbility.count.mockResolvedValue(0)
        prisma.characterAbility.create.mockResolvedValue({ id: abilityId, name: 'Test', type: 'ABILITY' })

        await service.createAbility(sheetId, userId, { name: 'Test', type: 'ABILITY' })

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })

      it('handles cache delete failure in updateAbility', async () => {
        prisma.characterAbility.findUnique.mockResolvedValue({ id: abilityId, sheetId })
        prisma.characterSheet.findUnique.mockResolvedValue({ id: sheetId, ownerId: userId })
        prisma.characterAbility.update.mockResolvedValue({ id: abilityId, name: 'Updated', level: 1, type: 'ABILITY' } as any)

        await service.updateAbility(abilityId, userId, { name: 'Updated' })

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })

      it('handles cache delete failure in removeAbility', async () => {
        prisma.characterAbility.findUnique.mockResolvedValue({ id: abilityId, sheetId })
        prisma.characterSheet.findUnique.mockResolvedValue({ id: sheetId, ownerId: userId })
        prisma.characterAbility.delete.mockResolvedValue({ id: abilityId } as any)

        await service.removeAbility(abilityId, userId)

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })

      it('handles cache delete failure in createInventoryItem', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({ id: sheetId, ownerId: userId, adventureId: null })
        prisma.characterInventoryItem.create.mockResolvedValue({ id: 'inv-1', name: 'Sword', sheetId })

        await service.createInventoryItem(sheetId, userId, { name: 'Sword', weight: 1, cost: '10 gp' })

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })

      it('handles cache delete failure in updateStory', async () => {
        prisma.characterSheet.findUnique.mockResolvedValue({ id: sheetId, ownerId: userId, adventureId: null })
        prisma.characterStory.upsert.mockResolvedValue({ id: 'story-1', sheetId, appearance: 'Tall' } as any)

        await service.updateStory(sheetId, userId, { appearance: 'Tall' })

        expect(mockRedisService.del).toHaveBeenCalledWith(`character-sheet:${sheetId}`)
      })
    })

  })
})

