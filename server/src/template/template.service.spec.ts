jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))

import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { Test } from '@nestjs/testing'
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common'
import { DbNull } from '@prisma/client/runtime/client'
import { TemplateService } from './template.service'
import { PrismaService } from '../prisma.service'
import { MembershipService } from '../membership/membership.service'
import { RedisService } from '../redis/redis.service'
import { createMockPrismaService } from '../__mocks__/prisma-service.mock'
import type { CreateTemplateDto } from './dto/create-template.dto'
import type { UpdateTemplateDto } from './dto/update-template.dto'

const mockMembershipService = {
  requireRole: jest.fn<any>(),
  isMember: jest.fn<any>(),
}

const mockRedisService = {
  cacheGet: jest.fn<any>(),
  cacheSet: jest.fn<any>().mockResolvedValue(undefined),
  del: jest.fn<any>(),
}

/** Helper -- creates a mock template with the include shape the service expects.
 *  Supply overrides to customize attributes, templateSkills, armorClasses, etc. */
function mockTemplateWithInclude(overrides: Record<string, any> = {}) {
  return {
    id: 'template-1',
    name: 'Test Template',
    adventureId: 'adv-1',
    description: null,
    attributeModifiersEnabled: true,
    attributeModifierFormula: null,
    skillFormula: null,
    attributes: [],
    templateFields: [],
    templateSkills: [],
    skillModifierProfiles: [],
    coreResources: [],
    armorClasses: [],
    characterSections: [],
    resistances: [],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  }
}

describe('TemplateService', () => {
  let service: TemplateService
  let prisma: ReturnType<typeof createMockPrismaService>

  beforeEach(async () => {
    prisma = createMockPrismaService()
    jest.clearAllMocks()

    // Default: requireRole resolves, isMember returns true
    mockMembershipService.requireRole.mockResolvedValue({ role: 'GM' })
    mockMembershipService.isMember.mockResolvedValue(true)

    const module = await Test.createTestingModule({
      providers: [
        TemplateService,
        { provide: PrismaService, useValue: prisma },
        { provide: MembershipService, useValue: mockMembershipService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile()

    service = module.get<TemplateService>(TemplateService)
  })

  // ──────────────────────────────────────────────
  //  create()
  // ──────────────────────────────────────────────

  describe('create', () => {
    const adventureId = 'adv-1'
    const userId = 'user-1'

    it('creates a template with minimal DTO (name + attributes)', async () => {
      const dto: CreateTemplateDto = {
        name: 'My Template',
        attributes: [{ key: 'str', name: 'Strength' }],
      }
      const created = mockTemplateWithInclude({
        name: 'My Template',
        attributes: [{ id: 'attr-1', key: 'str', name: 'Strength', templateId: 'template-1', order: 0 }],
        templateSkills: [],
        armorClasses: [],
      })
      prisma.adventure.findUnique.mockResolvedValue({ id: adventureId, isPublic: false })
      prisma.template.create.mockResolvedValue(created)
      prisma.templateAttribute.findMany.mockResolvedValue(created.attributes)
      prisma.templateArmorClass.findMany.mockResolvedValue([])
      prisma.template.findUnique.mockResolvedValue(created)
      prisma.adventure.update.mockResolvedValue({ id: adventureId, templateSource: 'campaign' })

      const result = await service.create(adventureId, userId, dto)

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith(adventureId, userId, 'GM')
      expect(prisma.template.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adventureId,
            name: 'My Template',
          }),
        }),
      )
      expect(mockRedisService.del).toHaveBeenCalledWith(`templates:adventure:${adventureId}`)
      expect(result).toEqual(created)
    })

    it('creates a template with full DTO (skills, ACs, resources, resistances, sections)', async () => {
      const dto: CreateTemplateDto = {
        name: 'Full Template',
        description: 'A full template',
        attributeModifiersEnabled: true,
        attributeModifierFormula: 'mod(str)',
        skillFormula: 'proficiency + mod',
        attributes: [
          { key: 'str', name: 'Strength' },
          { key: 'dex', name: 'Dexterity' },
        ],
        templateFields: [{ key: 'background', label: 'Background' }],
        skills: [
          { name: 'Athletics', description: 'Climbing, jumping', attributeId: 'str', allowedAttributeIds: ['str'], defaultAttributeId: 'str' },
        ],
        skillModifierProfiles: [
          {
            name: 'Proficiency',
            targetMode: 'ALL_SKILLS',
            targetSkillIds: [],
            options: [{ label: 'None', value: 0 }, { label: 'Proficient', value: 2 }],
          },
        ],
        coreResources: [
          { slug: 'hp', displayName: 'Hit Points', enabled: true, editableByPlayer: true, showNotes: false, color: '#ff0000' },
        ],
        armorClasses: [
          { enabled: true, name: 'Armor Class', fields: [{ name: 'Total', key: 'total', defaultValue: '10', editableByPlayer: false }] },
        ],
        characterSections: [{ name: 'Equipment' }],
        resistances: [
          {
            name: 'Damage Resistances',
            calculationType: 'MANUAL',
            components: [{ name: 'Slashing', editableByPlayer: true, defaultValue: '0' }],
          },
        ],
      }

      const createdAttrs = [
        { id: 'attr-1', key: 'str', name: 'Strength', templateId: 'template-1', order: 0 },
        { id: 'attr-2', key: 'dex', name: 'Dexterity', templateId: 'template-1', order: 1 },
      ]

      const created = mockTemplateWithInclude({
        name: 'Full Template',
        description: 'A full template',
        attributeModifiersEnabled: true,
        attributeModifierFormula: 'mod(str)',
        skillFormula: 'proficiency + mod',
        attributes: createdAttrs,
        templateFields: [{ id: 'tf-1', key: 'background', label: 'Background', templateId: 'template-1', order: 0 }],
        templateSkills: [{ id: 'skill-1', name: 'Athletics', templateId: 'template-1', order: 0, attributeId: null, allowedAttributeIds: [], defaultAttributeId: null }],
        skillModifierProfiles: [{
          id: 'prof-1', name: 'Proficiency', templateId: 'template-1', order: 0,
          targetMode: 'ALL_SKILLS', targetSkillIds: [],
          options: [
            { id: 'opt-1', label: 'None', value: 0, order: 0, profileId: 'prof-1' },
            { id: 'opt-2', label: 'Proficient', value: 2, order: 1, profileId: 'prof-1' },
          ],
        }],
        coreResources: [{ id: 'cr-1', slug: 'hp', displayName: 'Hit Points', templateId: 'template-1', enabled: true, editableByPlayer: true, showNotes: false, color: '#ff0000', order: 0 }],
        armorClasses: [{ id: 'ac-1', name: 'Armor Class', templateId: 'template-1', enabled: true, fields: [{ id: 'acf-1', name: 'Total', key: 'total', defaultValue: '10', editableByPlayer: false, description: null, order: 0, armorClassId: 'ac-1' }], attributeModifiers: [] }],
        characterSections: [{ id: 'cs-1', name: 'Equipment', templateId: 'template-1', order: 0 }],
        resistances: [{
          id: 'res-1', name: 'Damage Resistances', templateId: 'template-1', calculationType: 'MANUAL', order: 0,
          components: [{ id: 'rc-1', name: 'Slashing', resistanceId: 'res-1', editableByPlayer: true, defaultValue: '0', order: 0 }],
          attributeModifiers: [],
        }],
      })

      prisma.adventure.findUnique.mockResolvedValue({ id: adventureId, isPublic: false })
      prisma.template.create.mockResolvedValue(created)
      prisma.templateAttribute.findMany.mockResolvedValue(createdAttrs)
      prisma.templateArmorClass.findMany.mockResolvedValue(created.armorClasses)
      prisma.template.findUnique.mockResolvedValue(created)
      prisma.adventure.update.mockResolvedValue({ id: adventureId, templateSource: 'campaign' })

      await service.create(adventureId, userId, dto as any)

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith(adventureId, userId, 'GM')
      expect(prisma.template.create).toHaveBeenCalled()
      // Skills post-create should have been updated with attribute links
      expect(prisma.templateSkill.update).toHaveBeenCalled()
      // Should set templateSource to 'campaign'
      expect(prisma.adventure.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: adventureId },
          data: { templateSource: 'campaign' },
        }),
      )
      // Invalidate cache
      expect(mockRedisService.del).toHaveBeenCalledWith(`templates:adventure:${adventureId}`)
    })

    it('resolves attribute keys to IDs for armor class attribute modifiers', async () => {
      const dto: CreateTemplateDto = {
        name: 'AC Test',
        attributes: [{ key: 'str', name: 'Strength' }],
        armorClasses: [
          {
            enabled: true,
            name: 'Armor Class',
            attributeModifiers: [
              { attributeId: 'str', allowPlayerSelection: false },
            ],
          },
        ],
      }

      const createdAttrs = [{ id: 'attr-1', key: 'str', name: 'Strength', templateId: 'template-1', order: 0 }]
      const created = mockTemplateWithInclude({
        name: 'AC Test',
        attributes: createdAttrs,
        templateSkills: [],
        armorClasses: [{ id: 'ac-1', name: 'Armor Class', templateId: 'template-1', enabled: true, createdAt: new Date('2025-01-01'), fields: [], attributeModifiers: [] }],
      })

      const createdAcs = [{ id: 'ac-1', name: 'Armor Class', templateId: 'template-1', enabled: true, createdAt: new Date('2025-01-01') }]

      prisma.adventure.findUnique.mockResolvedValue({ id: adventureId, isPublic: false })
      prisma.template.create.mockResolvedValue(created)
      prisma.templateAttribute.findMany.mockResolvedValue(createdAttrs)
      prisma.templateArmorClass.findMany.mockResolvedValue(createdAcs as any)
      prisma.template.findUnique.mockResolvedValue(created)
      prisma.adventure.update.mockResolvedValue({ id: adventureId, templateSource: 'campaign' })

      await service.create(adventureId, userId, dto as any)

      // Verify key-to-id resolution: the armor class update should use the attribute ID, not the key
      expect(prisma.templateArmorClass.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ac-1' },
          data: expect.objectContaining({
            attributeModifiers: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ attributeId: 'attr-1' }),
              ]),
            }),
          }),
        }),
      )
    })

    it('throws ConflictException when an attached template already exists', async () => {
      const dto: CreateTemplateDto = {
        name: 'My Template',
        attributes: [{ key: 'str', name: 'Strength' }],
      }
      prisma.adventure.findUnique.mockResolvedValue({
        id: adventureId,
        isPublic: false,
        originalTemplateId: 'existing-tpl',
        templateSnapshot: { name: 'Existing Snapshot' },
      })

      await expect(
        service.create(adventureId, userId, dto),
      ).rejects.toThrow(ConflictException)

      expect(prisma.template.create).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────
  //  findAllByAdventure()
  // ──────────────────────────────────────────────

  describe('findAllByAdventure', () => {
    const adventureId = 'adv-1'
    const userId = 'user-1'

    it('returns cached templates when cache hit', async () => {
      const cached = [mockTemplateWithInclude({ name: 'Cached' })]
      mockRedisService.cacheGet.mockResolvedValue(cached)

      const result = await service.findAllByAdventure(adventureId, userId)

      expect(mockRedisService.cacheGet).toHaveBeenCalledWith(`templates:adventure:${adventureId}`)
      expect(prisma.template.findMany).not.toHaveBeenCalled()
      expect(mockMembershipService.isMember).toHaveBeenCalledWith(adventureId, userId)
      expect(result).toEqual(cached)
    })

    it('queries DB and caches result when cache miss', async () => {
      mockRedisService.cacheGet.mockResolvedValue(null)
      const templates = [mockTemplateWithInclude({ name: 'From DB' })]
      prisma.template.findMany.mockResolvedValue(templates)

      const result = await service.findAllByAdventure(adventureId, userId)

      expect(prisma.template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { adventureId } }),
      )
      expect(mockRedisService.cacheSet).toHaveBeenCalledWith(
        `templates:adventure:${adventureId}`,
        templates,
        expect.any(Number),
      )
      expect(result).toEqual(templates)
    })

    it('throws ForbiddenException when user is not a member (cache miss)', async () => {
      mockRedisService.cacheGet.mockResolvedValue(null)
      prisma.template.findMany.mockResolvedValue([mockTemplateWithInclude()])
      mockMembershipService.isMember.mockResolvedValue(false)

      await expect(service.findAllByAdventure(adventureId, userId)).rejects.toThrow(ForbiddenException)
    })

    it('throws ForbiddenException when user is not a member (cache hit)', async () => {
      mockRedisService.cacheGet.mockResolvedValue([mockTemplateWithInclude()])
      mockMembershipService.isMember.mockResolvedValue(false)

      await expect(service.findAllByAdventure(adventureId, userId)).rejects.toThrow(ForbiddenException)
    })
  })

  // ──────────────────────────────────────────────
  //  findOne()
  // ──────────────────────────────────────────────

  describe('findOne', () => {
    const id = 'template-1'
    const userId = 'user-1'

    it('returns cached template when cache hit', async () => {
      const cached = mockTemplateWithInclude({ name: 'Cached' })
      mockRedisService.cacheGet.mockResolvedValue(cached)

      const result = await service.findOne(id, userId)

      expect(mockRedisService.cacheGet).toHaveBeenCalledWith(`template:${id}`)
      expect(prisma.template.findUnique).not.toHaveBeenCalled()
      expect(result).toEqual(cached)
    })

    it('queries DB and caches result when cache miss', async () => {
      mockRedisService.cacheGet.mockResolvedValue(null)
      const template = mockTemplateWithInclude({ name: 'From DB' })
      prisma.template.findUnique.mockResolvedValue(template)

      const result = await service.findOne(id, userId)

      expect(prisma.template.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id } }),
      )
      expect(mockRedisService.cacheSet).toHaveBeenCalledWith(
        `template:${id}`,
        template,
        expect.any(Number),
      )
      expect(result).toEqual(template)
    })

    it('throws NotFoundException when template does not exist', async () => {
      mockRedisService.cacheGet.mockResolvedValue(null)
      prisma.template.findUnique.mockResolvedValue(null)

      await expect(service.findOne(id, userId)).rejects.toThrow(NotFoundException)
      await expect(service.findOne(id, userId)).rejects.toThrow('Template not found')
    })

    it('throws ForbiddenException when user is not a member (cache miss)', async () => {
      mockRedisService.cacheGet.mockResolvedValue(null)
      prisma.template.findUnique.mockResolvedValue(mockTemplateWithInclude())
      mockMembershipService.isMember.mockResolvedValue(false)

      await expect(service.findOne(id, userId)).rejects.toThrow(ForbiddenException)
    })

    it('throws ForbiddenException when user is not a member (cache hit)', async () => {
      mockRedisService.cacheGet.mockResolvedValue(mockTemplateWithInclude())
      mockMembershipService.isMember.mockResolvedValue(false)

      await expect(service.findOne(id, userId)).rejects.toThrow(ForbiddenException)
    })
  })

  // ──────────────────────────────────────────────
  //  update()
  // ──────────────────────────────────────────────

  describe('update', () => {
    const id = 'template-1'
    const userId = 'user-1'

    it('updates name only (simplest path)', async () => {
      const existing = mockTemplateWithInclude({ name: 'Old Name' })
      prisma.template.findUnique.mockResolvedValue(existing)
      const updated = { ...existing, name: 'New Name' }
      prisma.template.update.mockResolvedValue(updated)

      const dto: UpdateTemplateDto = { name: 'New Name' }
      const result = await service.update(id, userId, dto)

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith('adv-1', userId, 'GM')
      expect(prisma.template.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id },
          data: expect.objectContaining({ name: 'New Name' }),
        }),
      )
      expect(mockRedisService.del).toHaveBeenCalledWith(`templates:adventure:adv-1`)
      expect(result).toEqual(updated)
    })

    it('creates new attributes, updates existing, deletes removed, and upserts sheet values', async () => {
      const existing = mockTemplateWithInclude()
      prisma.template.findUnique.mockResolvedValue(existing)

      const existingAttrs = [
        { id: 'attr-1', key: 'str', name: 'Strength', templateId: id, order: 0 },
        { id: 'attr-2', key: 'dex', name: 'Dexterity', templateId: id, order: 1 },
      ]
      const dto: UpdateTemplateDto = {
        attributes: [
          { key: 'dex', name: 'Dexterity Updated' }, // update existing
          { key: 'con', name: 'Constitution' },        // create new
          // 'str' removed
        ],
      }

      // After create, fetch new attrs (including the newly created one)
      const newAttr = { id: 'attr-3', key: 'con', name: 'Constitution', templateId: id, order: 1 }
      // First findMany call (line 287) returns existing attrs only
      // Second findMany call (line 300, after create) returns all attrs
      prisma.templateAttribute.findMany
        .mockResolvedValueOnce(existingAttrs)
        .mockResolvedValueOnce([existingAttrs[0], existingAttrs[1], newAttr])

      // Return some sheets so upsert logic executes
      prisma.characterSheet.findMany.mockResolvedValue([{ id: 'sheet-1' }])

      await service.update(id, userId, dto as any)

      // Deleted removed key
      expect(prisma.templateAttribute.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ key: { in: ['str'] } }) }),
      )
      // Updated existing
      expect(prisma.templateAttribute.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'attr-2' }, data: expect.objectContaining({ name: 'Dexterity Updated' }) }),
      )
      // Created new
      expect(prisma.templateAttribute.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ key: 'con', name: 'Constitution' }) }),
      )
      // Upsert for sheet value on new attribute
      expect(prisma.characterSheetValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sheetId_attributeId: { sheetId: 'sheet-1', attributeId: 'attr-3' } },
          create: expect.objectContaining({ sheetId: 'sheet-1', attributeId: 'attr-3' }),
        }),
      )
    })

    it('updates skills with attribute key resolution', async () => {
      const existing = mockTemplateWithInclude()
      prisma.template.findUnique.mockResolvedValue(existing)

      const existingAttrs = [
        { id: 'attr-1', key: 'str', name: 'Strength', templateId: id, order: 0 },
        { id: 'attr-2', key: 'dex', name: 'Dexterity', templateId: id, order: 1 },
      ]
      prisma.templateAttribute.findMany.mockResolvedValue(existingAttrs)

      const existingSkills = [
        { id: 'skill-1', name: 'Athletics', templateId: id, order: 0, attributeId: null, allowedAttributeIds: [], defaultAttributeId: null },
      ]
      prisma.templateSkill.findMany.mockResolvedValue(existingSkills)

      const dto: UpdateTemplateDto = {
        skills: [
          { name: 'Athletics', description: 'Updated', attributeId: 'str', allowedAttributeIds: ['str'], defaultAttributeId: 'str' },
          { name: 'Stealth', description: null, attributeId: 'dex', allowedAttributeIds: ['dex'] },
        ],
      }

      await service.update(id, userId, dto as any)

      // Existing skill updated with resolved attribute IDs
      expect(prisma.templateSkill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'skill-1' },
          data: expect.objectContaining({
            attributeId: 'attr-1',
            allowedAttributeIds: ['attr-1'],
            defaultAttributeId: 'attr-1',
          }),
        }),
      )
      // New skill created
      expect(prisma.templateSkill.create).toHaveBeenCalled()
    })

    it('updates armor classes: update existing, create new, handle disabled', async () => {
      const existing = mockTemplateWithInclude()
      prisma.template.findUnique.mockResolvedValue(existing)

      const existingAttrs = [{ id: 'attr-1', key: 'str', name: 'Strength', templateId: id, order: 0 }]
      prisma.templateAttribute.findMany.mockResolvedValue(existingAttrs)

      const existingAcs: any[] = [
        {
          id: 'ac-1', name: 'Armor Class', templateId: id, enabled: true, createdAt: new Date('2025-01-01'),
          fields: [{ id: 'acf-1', name: 'Total', key: 'total', defaultValue: '10', editableByPlayer: false, description: null, order: 0, armorClassId: 'ac-1' }],
        },
      ]
      prisma.templateArmorClass.findMany.mockResolvedValue(existingAcs)

      const dto: UpdateTemplateDto = {
        armorClasses: [
          {
            name: 'Armor Class', // existing -- update with field changes
            enabled: true,
            fields: [
              { name: 'Total', key: 'total', defaultValue: '12', editableByPlayer: true },
              { name: 'Shield', key: 'shield', defaultValue: '0', editableByPlayer: false },
            ],
            attributeModifiers: [{ attributeId: 'str', allowPlayerSelection: false }],
          },
          {
            name: 'Flat-Footed', // new -- create
            enabled: true,
            fields: [{ name: 'Total', key: 'total', defaultValue: '10' }],
          },
          {
            name: 'Touch', // disabled -- does not exist, should continue
            enabled: false,
          },
        ],
      }

      prisma.armorClassField.findMany.mockResolvedValue([])
      prisma.armorClassAttributeModifier.findMany.mockResolvedValue([])
      prisma.templateArmorClass.create.mockResolvedValue({ id: 'ac-2', name: 'Flat-Footed', templateId: id })
      prisma.characterSheet.findMany.mockResolvedValue([])

      await service.update(id, userId, dto as any)

      // Update existing AC
      expect(prisma.templateArmorClass.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ac-1' },
          data: expect.objectContaining({ name: 'Armor Class' }),
        }),
      )
      // Delete existing old modifiers then recreate
      expect(prisma.armorClassAttributeModifier.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { armorClassId: 'ac-1' } }),
      )
      // Existing field updated
      expect(prisma.armorClassField.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acf-1' },
          data: expect.objectContaining({ defaultValue: '12', editableByPlayer: true }),
        }),
      )
      // Create new AC
      expect(prisma.templateArmorClass.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Flat-Footed' }),
        }),
      )
    })

    it('handles core resources: updates existing, creates new, upserts for existing sheets', async () => {
      const existing = mockTemplateWithInclude()
      prisma.template.findUnique.mockResolvedValue(existing)

      const existingResources = [
        { id: 'cr-1', slug: 'hp', displayName: 'Hit Points', templateId: id, enabled: true, editableByPlayer: true, showNotes: true, color: null, order: 0 },
      ]
      prisma.templateCoreResource.findMany.mockResolvedValue(existingResources)
      prisma.characterSheet.findMany.mockResolvedValue([{ id: 'sheet-1' }])
      prisma.templateCoreResource.create.mockResolvedValue({ id: 'cr-2', slug: 'mp', templateId: id })

      const dto: UpdateTemplateDto = {
        coreResources: [
          { slug: 'hp', displayName: 'Hit Points (Updated)', enabled: true, editableByPlayer: true, showNotes: true },
          { slug: 'mp', displayName: 'Mana Points', enabled: true, editableByPlayer: true, showNotes: true },
        ],
      }

      await service.update(id, userId, dto as any)

      // Update existing
      expect(prisma.templateCoreResource.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cr-1' },
          data: expect.objectContaining({ displayName: 'Hit Points (Updated)' }),
        }),
      )
      // Create new
      expect(prisma.templateCoreResource.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'mp', displayName: 'Mana Points' }),
        }),
      )
      // Upsert value for existing sheet on new resource
      expect(prisma.characterSheetCoreResourceValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sheetId_coreResourceId: { sheetId: 'sheet-1', coreResourceId: 'cr-2' } },
        }),
      )
    })

    it('handles resistances: update existing and create new', async () => {
      const existing = mockTemplateWithInclude()
      prisma.template.findUnique.mockResolvedValue(existing)

      const existingResistances: any[] = [
        {
          id: 'res-1', name: 'Damage Resistances', templateId: id, calculationType: 'MANUAL', order: 0,
          components: [
            { id: 'rc-1', name: 'Slashing', resistanceId: 'res-1', editableByPlayer: true, defaultValue: '0', order: 0 },
            { id: 'rc-2', name: 'Piercing', resistanceId: 'res-1', editableByPlayer: true, defaultValue: '0', order: 1 },
          ],
          attributeModifiers: [],
        },
      ]
      prisma.templateResistance.findMany.mockResolvedValue(existingResistances)
      prisma.characterSheet.findMany.mockResolvedValue([])

      const dto: UpdateTemplateDto = {
        resistances: [
          {
            id: 'res-1', // existing
            name: 'Damage Resistances',
            calculationType: 'HALF',
            components: [
              { id: 'rc-1', name: 'Slashing', editableByPlayer: true, defaultValue: '0' }, // keep
              // rc-2 removed
            ],
          },
          {
            name: 'Condition Immunities', // new
            components: [
              { name: 'Charmed', editableByPlayer: false, defaultValue: '0' },
            ],
          },
        ],
      }

      await service.update(id, userId, dto as any)

      // Update existing resistance
      expect(prisma.templateResistance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: expect.objectContaining({ calculationType: 'HALF' }),
        }),
      )
      // Create new resistance
      expect(prisma.templateResistance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Condition Immunities' }),
        }),
      )
    })

    it('handles character sections: update existing, create new, remove deleted', async () => {
      const existing = mockTemplateWithInclude()
      prisma.template.findUnique.mockResolvedValue(existing)

      const existingSections = [
        { id: 'cs-1', name: 'Equipment', templateId: id, order: 0 },
      ]
      prisma.templateCharacterSection.findMany.mockResolvedValue(existingSections)

      const dto: UpdateTemplateDto = {
        characterSections: [
          { id: 'cs-1', name: 'Equipment (Updated)' }, // update by id
          { name: 'Notes' }, // new
        ],
      }

      await service.update(id, userId, dto as any)

      // Update existing
      expect(prisma.templateCharacterSection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cs-1' },
          data: expect.objectContaining({ name: 'Equipment (Updated)' }),
        }),
      )
      // Create new
      expect(prisma.templateCharacterSection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Notes' }),
        }),
      )
    })
  })

  // ──────────────────────────────────────────────
  //  remove()
  // ──────────────────────────────────────────────

  describe('remove', () => {
    const id = 'template-1'
    const userId = 'user-1'

    it('deletes the template and sets templateSource to null when no more campaign templates remain', async () => {
      const existing = mockTemplateWithInclude()
      prisma.template.findUnique.mockResolvedValue(existing)
      prisma.template.count.mockResolvedValue(0) // no remaining campaign templates
      prisma.template.delete.mockResolvedValue(existing)
      prisma.adventure.update.mockResolvedValue({ id: 'adv-1', templateSource: null })

      const result = await service.remove(id, userId)

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith('adv-1', userId, 'GM')
      expect(prisma.template.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id } }),
      )
      expect(prisma.adventure.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'adv-1' },
          data: { templateSource: null },
        }),
      )
      expect(mockRedisService.del).toHaveBeenCalledWith(`template:${id}`)
      expect(mockRedisService.del).toHaveBeenCalledWith(`templates:adventure:adv-1`)
      expect(result).toEqual(existing)
    })

    it('does not update templateSource when other campaign templates remain', async () => {
      const existing = mockTemplateWithInclude()
      prisma.template.findUnique.mockResolvedValue(existing)
      prisma.template.count.mockResolvedValue(2) // other templates remain
      prisma.template.delete.mockResolvedValue(existing)

      await service.remove(id, userId)

      expect(prisma.adventure.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { templateSource: null } }),
      )
    })

    it('throws NotFoundException when template does not exist', async () => {
      prisma.template.findUnique.mockResolvedValue(null)

      await expect(service.remove(id, userId)).rejects.toThrow(NotFoundException)
      await expect(service.remove(id, userId)).rejects.toThrow('Template not found')
      expect(prisma.template.delete).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────
  //  clone()
  // ──────────────────────────────────────────────

  describe('clone', () => {
    const id = 'template-1'
    const userId = 'user-1'

    it('deep copies a template with all relations', async () => {
      const original = mockTemplateWithInclude({
        name: 'Original',
        description: 'A test template',
        attributes: [
          { id: 'attr-1', key: 'str', name: 'Strength', templateId: id, order: 0 },
        ],
        templateSkills: [
          { id: 'skill-1', name: 'Athletics', templateId: id, order: 0, attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1', description: null },
        ],
        armorClasses: [
          {
            id: 'ac-1', name: 'Armor Class', templateId: id, enabled: true,
            attributeModifiers: [
              { id: 'am-1', attributeId: 'attr-1', allowPlayerSelection: false, defaultAttributeId: null },
            ],
            fields: [
              { id: 'acf-1', name: 'Total', key: 'total', defaultValue: '10', editableByPlayer: false, description: null, order: 0, armorClassId: 'ac-1' },
            ],
          },
        ],
        coreResources: [
          { id: 'cr-1', slug: 'hp', displayName: 'Hit Points', enabled: true, editableByPlayer: true, showNotes: true, color: null, order: 0 },
        ],
        characterSections: [{ id: 'cs-1', name: 'Equipment', templateId: id, order: 0 }],
        resistances: [
          {
            id: 'res-1', name: 'Damage Resistances', templateId: id, calculationType: 'MANUAL', order: 0,
            components: [{ id: 'rc-1', name: 'Slashing', resistanceId: 'res-1', editableByPlayer: true, defaultValue: '0', order: 0 }],
            attributeModifiers: [],
          },
        ],
        skillModifierProfiles: [],
        templateFields: [],
      })

      prisma.template.findUnique.mockResolvedValue(original)
      prisma.adventure.findUnique.mockResolvedValue({ id: 'adv-1', isPublic: false })
      // The create will be called internally by clone()
      const cloned = mockTemplateWithInclude({
        name: 'Original (copy)',
      })
      prisma.template.create.mockResolvedValue(cloned)
      prisma.templateAttribute.findMany.mockResolvedValue([])
      prisma.templateArmorClass.findMany.mockResolvedValue([])
      prisma.template.findUnique.mockResolvedValue(cloned)

      const result = await service.clone(id, userId)

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith('adv-1', userId, 'GM')
      expect(prisma.template.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id } }),
      )
      expect(result).toBeDefined()
    })

    it('uses custom name when provided', async () => {
      const original = mockTemplateWithInclude({ name: 'Original' })
      prisma.template.findUnique.mockResolvedValue(original)
      prisma.adventure.findUnique.mockResolvedValue({ id: 'adv-1', isPublic: false })
      const cloned = mockTemplateWithInclude({ name: 'Custom Clone' })
      prisma.template.create.mockResolvedValue(cloned)
      prisma.templateAttribute.findMany.mockResolvedValue([])
      prisma.templateArmorClass.findMany.mockResolvedValue([])
      prisma.template.findUnique.mockResolvedValue(cloned)

      const result = await service.clone(id, userId, 'Custom Clone')

      expect(result.name).toBe('Custom Clone')
    })

    it('throws NotFoundException when template not found', async () => {
      prisma.template.findUnique.mockResolvedValue(null)

      await expect(service.clone('nonexistent', userId)).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  // ──────────────────────────────────────────────
  //  findPublicAll()
  // ──────────────────────────────────────────────

  describe('findPublicAll', () => {
    it('returns paginated public templates', async () => {
      const templates = [
        {
          id: 't1',
          name: 'Public Template',
          description: 'A public template',
          createdAt: new Date(),
          adventure: { id: 'adv-1', name: 'Adventure', campaign: 'Camp' },
          owner: { id: 'u1', displayName: 'Owner' },
          _count: { characterSheets: 3 },
        },
      ]
      prisma.$transaction.mockResolvedValue([templates, 1])

      const result = await service.findPublicAll({ page: 1, limit: 10 })

      expect(result.data).toEqual(templates)
      expect(result.meta.total).toBe(1)
    })

    it('filters by adventureId', async () => {
      prisma.$transaction.mockResolvedValue([[], 0])

      await service.findPublicAll({ adventureId: 'adv-1' })

      expect(prisma.template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            adventureId: 'adv-1',
          }),
        }),
      )
    })

    it('filters by search', async () => {
      prisma.$transaction.mockResolvedValue([[], 0])

      await service.findPublicAll({ search: 'warrior' })

      expect(prisma.template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { name: { contains: 'warrior', mode: 'insensitive' } },
                  { description: { contains: 'warrior', mode: 'insensitive' } },
                ]),
              }),
            ]),
          }),
        }),
      )
    })
  })

  // ──────────────────────────────────────────────
  //  findOnePublic()
  // ──────────────────────────────────────────────

  describe('findOnePublic', () => {
    it('returns a public template with its full structure', async () => {
      const template = {
        id: 't1',
        name: 'Public Template',
        description: 'A public template',
        attributeModifiersEnabled: true,
        attributeModifierFormula: null,
        skillFormula: null,
        createdAt: new Date(),
        adventure: { id: 'adv-1', name: 'Adventure', campaign: 'Camp' },
        owner: { id: 'u1', displayName: 'Owner' },
        _count: { characterSheets: 3 },
        attributes: [],
        templateFields: [],
        templateSkills: [],
        skillModifierProfiles: [],
        coreResources: [],
        armorClasses: [],
        characterSections: [],
        resistances: [],
      }
      prisma.template.findFirst.mockResolvedValue(template)

      const result = await service.findOnePublic('t1')

      expect(prisma.template.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 't1',
            isPublic: true,
          },
        }),
      )
      expect(result).toEqual(template)
    })

    it('throws NotFoundException when template not found or not public', async () => {
      prisma.template.findFirst.mockResolvedValue(null)

      await expect(service.findOnePublic('nonexistent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  // ──────────────────────────────────────────────
  //  Edge cases
  // ──────────────────────────────────────────────

  describe('edge cases', () => {
    const id = 'template-1'

    it('throws NotFoundException in update when template not found', async () => {
      prisma.template.findUnique.mockResolvedValue(null)

      await expect(service.update('nonexistent', 'user-1', { name: 'Nope' })).rejects.toThrow(NotFoundException)
      await expect(service.update('nonexistent', 'user-1', { name: 'Nope' })).rejects.toThrow('Template not found')
      expect(prisma.template.update).not.toHaveBeenCalled()
    })

    it('throws ForbiddenException when requireRole rejects', async () => {
      const existing = mockTemplateWithInclude()
      prisma.template.findUnique.mockResolvedValue(existing)
      mockMembershipService.requireRole.mockRejectedValue(new ForbiddenException('Only the Game Master can perform this action'))

      await expect(service.update(id, 'user-1', { name: 'Try' })).rejects.toThrow(ForbiddenException)
      await expect(service.update(id, 'user-1', { name: 'Try' })).rejects.toThrow('Only the Game Master can perform this action')
    })
  })

  // ──────────────────────────────────────────────
  //  Auth expansion for standalone templates
  // ──────────────────────────────────────────────

  describe('findOne auth (standalone)', () => {
    const id = 'template-1'
    const ownerId = 'user-owner'

    it('allows owner to access their standalone template', async () => {
      const tpl = mockTemplateWithInclude({ adventureId: null, ownerId, isPublic: false })
      mockRedisService.cacheGet.mockResolvedValue(null)
      prisma.template.findUnique.mockResolvedValue(tpl)

      const result = await service.findOne(id, ownerId)

      expect(result).toEqual(tpl)
      expect(mockMembershipService.isMember).not.toHaveBeenCalled()
    })

    it('allows a member to access an adventure-scoped template', async () => {
      const tpl = mockTemplateWithInclude({ adventureId: 'adv-1', ownerId: 'other-user', isPublic: false })
      mockRedisService.cacheGet.mockResolvedValue(null)
      prisma.template.findUnique.mockResolvedValue(tpl)
      // isMember called via ensureTemplateAccess because ownerId !== userId and user IS a member
      mockMembershipService.isMember.mockResolvedValue(true)

      const result = await service.findOne(id, 'user-member')

      expect(result).toEqual(tpl)
    })

    it('allows anyone to access a public template', async () => {
      const tpl = mockTemplateWithInclude({ adventureId: null, ownerId: 'other-user', isPublic: true })
      mockRedisService.cacheGet.mockResolvedValue(null)
      prisma.template.findUnique.mockResolvedValue(tpl)

      const result = await service.findOne(id, 'stranger')

      expect(result).toEqual(tpl)
      expect(mockMembershipService.isMember).not.toHaveBeenCalled()
    })

    it('throws ForbiddenException for standalone template by non-owner', async () => {
      const tpl = mockTemplateWithInclude({ adventureId: null, ownerId: 'other-user', isPublic: false })
      mockRedisService.cacheGet.mockResolvedValue(null)
      prisma.template.findUnique.mockResolvedValue(tpl)

      await expect(service.findOne(id, 'stranger')).rejects.toThrow(ForbiddenException)
      await expect(service.findOne(id, 'stranger')).rejects.toThrow('You do not have access to this template')
    })
  })

  // ──────────────────────────────────────────────
  //  update auth (standalone)
  // ──────────────────────────────────────────────

  describe('update auth (standalone)', () => {
    const id = 'template-1'
    const ownerId = 'user-owner'

    it('allows owner to update their standalone template', async () => {
      const existing = mockTemplateWithInclude({ adventureId: null, ownerId, isPublic: false })
      prisma.template.findUnique.mockResolvedValue(existing)
      const updated = { ...existing, name: 'Updated' }
      prisma.template.update.mockResolvedValue(updated)

      const result = await service.update(id, ownerId, { name: 'Updated' })

      expect(result.name).toBe('Updated')
      expect(mockMembershipService.requireRole).not.toHaveBeenCalled()
    })

    it('throws ForbiddenException when non-owner tries to update a standalone template', async () => {
      const existing = mockTemplateWithInclude({ adventureId: null, ownerId, isPublic: false })
      prisma.template.findUnique.mockResolvedValue(existing)

      await expect(service.update(id, 'stranger', { name: 'Hacked' })).rejects.toThrow(ForbiddenException)
      await expect(service.update(id, 'stranger', { name: 'Hacked' })).rejects.toThrow('Only the template owner can update this template')
      expect(prisma.template.update).not.toHaveBeenCalled()
    })

    it('allows GM to update adventure-scoped template owned by someone else', async () => {
      const existing = mockTemplateWithInclude({ adventureId: 'adv-1', ownerId: 'other-user', isPublic: false })
      prisma.template.findUnique.mockResolvedValue(existing)
      const updated = { ...existing, name: 'GM Update' }
      prisma.template.update.mockResolvedValue(updated)

      const result = await service.update(id, 'gm-user', { name: 'GM Update' })

      expect(result.name).toBe('GM Update')
      expect(mockMembershipService.requireRole).toHaveBeenCalledWith('adv-1', 'gm-user', 'GM')
    })
  })

  // ──────────────────────────────────────────────
  //  remove auth (standalone)
  // ──────────────────────────────────────────────

  describe('remove auth (standalone)', () => {
    const id = 'template-1'
    const ownerId = 'user-owner'

    it('allows owner to delete their standalone template', async () => {
      const existing = mockTemplateWithInclude({ adventureId: null, ownerId, isPublic: false })
      prisma.template.findUnique.mockResolvedValue(existing)
      prisma.characterSheet.count.mockResolvedValue(0)
      prisma.template.delete.mockResolvedValue(existing)

      const result = await service.remove(id, ownerId)

      expect(result).toEqual(existing)
      expect(mockMembershipService.requireRole).not.toHaveBeenCalled()
      expect(mockRedisService.del).toHaveBeenCalledWith(`template:${id}`)
    })

    it('throws ForbiddenException when non-owner tries to delete a standalone template', async () => {
      const existing = mockTemplateWithInclude({ adventureId: null, ownerId, isPublic: false })
      prisma.template.findUnique.mockResolvedValue(existing)

      await expect(service.remove(id, 'stranger')).rejects.toThrow(ForbiddenException)
      await expect(service.remove(id, 'stranger')).rejects.toThrow('Only the template owner can delete this template')
      expect(prisma.template.delete).not.toHaveBeenCalled()
    })

    it('blocks deletion when character sheets reference the template', async () => {
      const existing = mockTemplateWithInclude({ adventureId: null, ownerId, isPublic: false })
      prisma.template.findUnique.mockResolvedValue(existing)
      prisma.characterSheet.count.mockResolvedValue(3)

      await expect(service.remove(id, ownerId)).rejects.toThrow(ForbiddenException)
      await expect(service.remove(id, ownerId)).rejects.toThrow(/3 character sheet/)
      expect(prisma.template.delete).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────
  //  clone auth (standalone)
  // ──────────────────────────────────────────────

  describe('clone auth (standalone)', () => {
    const id = 'template-1'
    const ownerId = 'user-owner'

    it('allows owner to clone their own template', async () => {
      const original = mockTemplateWithInclude({ adventureId: null, ownerId, isPublic: false })
      const copy = mockTemplateWithInclude({ name: 'Original (copy)', ownerId })
      prisma.template.findUnique
        .mockResolvedValueOnce(original)
        .mockResolvedValueOnce(copy)
      prisma.template.create.mockResolvedValue(copy)
      prisma.templateAttribute.findMany.mockResolvedValue([])
      prisma.templateArmorClass.findMany.mockResolvedValue([])

      const result = await service.clone(id, ownerId)

      expect(result).toBeDefined()
      expect(prisma.template.findUnique).toHaveBeenCalledTimes(2)
    })

    it('allows anyone to clone a public template', async () => {
      const original = mockTemplateWithInclude({ adventureId: null, ownerId: 'other-user', isPublic: true })
      const copy = mockTemplateWithInclude({ name: 'Public (copy)', ownerId: 'stranger' })
      prisma.template.findUnique
        .mockResolvedValueOnce(original)
        .mockResolvedValueOnce(copy)
      prisma.template.create.mockResolvedValue(copy)
      prisma.templateAttribute.findMany.mockResolvedValue([])
      prisma.templateArmorClass.findMany.mockResolvedValue([])

      const result = await service.clone(id, 'stranger')

      expect(result).toBeDefined()
      expect(mockMembershipService.requireRole).not.toHaveBeenCalled()
    })

    it('throws ForbiddenException when cloning a non-public, non-owned standalone template', async () => {
      const original = mockTemplateWithInclude({ adventureId: null, ownerId: 'other-user', isPublic: false })
      prisma.template.findUnique.mockResolvedValue(original)

      await expect(service.clone(id, 'stranger')).rejects.toThrow(ForbiddenException)
      await expect(service.clone(id, 'stranger')).rejects.toThrow('You do not have permission to clone this template')
    })

    it('allows GM to clone adventure-scoped template', async () => {
      const original = mockTemplateWithInclude({ adventureId: 'adv-1', ownerId: 'other-user', isPublic: false })
      prisma.template.findUnique
        .mockResolvedValueOnce(original)
        .mockResolvedValueOnce(mockTemplateWithInclude({ name: 'Adventure (copy)', ownerId: 'gm-user' }))
      prisma.template.create.mockResolvedValue(mockTemplateWithInclude({ name: 'Adventure (copy)', ownerId: 'gm-user' }))
      prisma.templateAttribute.findMany.mockResolvedValue([])
      prisma.templateArmorClass.findMany.mockResolvedValue([])

      const result = await service.clone(id, 'gm-user')

      expect(result).toBeDefined()
      expect(mockMembershipService.requireRole).toHaveBeenCalledWith('adv-1', 'gm-user', 'GM')
    })
  })

  // ──────────────────────────────────────────────
  //  createStandalone()
  // ──────────────────────────────────────────────

  describe('createStandalone', () => {
    const userId = 'user-1'

    it('creates a standalone template with minimal DTO', async () => {
      const dto: CreateTemplateDto = {
        name: 'My Standalone',
        attributes: [{ key: 'str', name: 'Strength' }],
      }
      const created = mockTemplateWithInclude({
        adventureId: null,
        ownerId: userId,
        isPublic: false,
        useCount: 0,
        name: 'My Standalone',
        attributes: [{ id: 'attr-1', key: 'str', name: 'Strength', templateId: 'template-1', order: 0 }],
      })
      prisma.template.create.mockResolvedValue(created)
      prisma.templateAttribute.findMany.mockResolvedValue(created.attributes)
      prisma.templateArmorClass.findMany.mockResolvedValue([])
      prisma.template.findUnique.mockResolvedValue(created)

      const result = await service.createStandalone(userId, dto)

      expect(prisma.template.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adventureId: null,
            ownerId: userId,
            isPublic: false,
            useCount: 0,
            name: 'My Standalone',
          }),
        }),
      )
      expect(mockRedisService.del).toHaveBeenCalledWith(`templates:user:${userId}`)
      expect(result).toEqual(created)
    })

    it('creates a standalone template with full DTO (all sub-entities)', async () => {
      const dto: CreateTemplateDto = {
        name: 'Full Standalone',
        description: 'A full-featured template',
        attributeModifierFormula: 'floor(str/2) - 5',
        skillFormula: 'floor(str/2) + prof',
        attributes: [{ key: 'str', name: 'Strength' }, { key: 'dex', name: 'Dexterity' }],
        templateFields: [{ key: 'bio', label: 'Biography' }],
        skills: [{ name: 'Athletics', attributeId: 'str', allowedAttributeIds: ['str'], description: null }],
        armorClasses: [{
          name: 'Armor Class', enabled: true,
          fields: [{ name: 'Total', key: 'total', defaultValue: '10', editableByPlayer: false, description: null }],
          attributeModifiers: [{ attributeId: 'str', allowPlayerSelection: false }],
        }],
      }
      const created = mockTemplateWithInclude({
        adventureId: null,
        ownerId: userId,
        name: 'Full Standalone',
        attributes: [
          { id: 'attr-1', key: 'str', name: 'Strength', templateId: 'template-1', order: 0 },
          { id: 'attr-2', key: 'dex', name: 'Dexterity', templateId: 'template-1', order: 1 },
        ],
        templateSkills: [],
        armorClasses: [],
      })
      prisma.template.create.mockResolvedValue(created)
      prisma.templateAttribute.findMany.mockResolvedValue(created.attributes)
      prisma.templateArmorClass.findMany.mockResolvedValue([])
      prisma.template.findUnique.mockResolvedValue(created)

      const result = await service.createStandalone(userId, dto)

      expect(prisma.template.create).toHaveBeenCalled()
      expect(mockRedisService.del).toHaveBeenCalledWith(`templates:user:${userId}`)
      expect(result).toEqual(created)
    })

    it('invalidates user list cache on creation', async () => {
      const dto: CreateTemplateDto = {
        name: 'Cached Template',
        attributes: [{ key: 'str', name: 'Strength' }],
      }
      const created = mockTemplateWithInclude({ adventureId: null, ownerId: userId, name: 'Cached Template' })
      prisma.template.create.mockResolvedValue(created)
      prisma.templateAttribute.findMany.mockResolvedValue([])
      prisma.templateArmorClass.findMany.mockResolvedValue([])
      prisma.template.findUnique.mockResolvedValue(created)

      await service.createStandalone(userId, dto)

      expect(mockRedisService.del).toHaveBeenCalledWith(`templates:user:${userId}`)
    })
  })

  // ──────────────────────────────────────────────
  //  findAllByUser()
  // ──────────────────────────────────────────────

  describe('findAllByUser', () => {
    const userId = 'user-1'

    it('returns cached templates when cache hit', async () => {
      const cached = [mockTemplateWithInclude({ adventureId: null, ownerId: userId })]
      mockRedisService.cacheGet.mockResolvedValue(cached)

      const result = await service.findAllByUser(userId)

      expect(result).toEqual(cached)
      expect(mockRedisService.cacheGet).toHaveBeenCalledWith(`templates:user:${userId}`)
      expect(prisma.template.findMany).not.toHaveBeenCalled()
    })

    it('queries DB and caches on cache miss', async () => {
      mockRedisService.cacheGet.mockResolvedValue(null)
      const templates = [mockTemplateWithInclude({ adventureId: null, ownerId: userId })]
      prisma.template.findMany.mockResolvedValue(templates)

      const result = await service.findAllByUser(userId)

      expect(prisma.template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerId: userId },
        }),
      )
      expect(mockRedisService.cacheSet).toHaveBeenCalledWith(
        `templates:user:${userId}`,
        templates,
        15,
      )
      expect(result).toEqual(templates)
    })

    it('returns empty array when user has no templates', async () => {
      mockRedisService.cacheGet.mockResolvedValue(null)
      prisma.template.findMany.mockResolvedValue([])

      const result = await service.findAllByUser(userId)

      expect(result).toEqual([])
    })
  })

  // ──────────────────────────────────────────────
  //  buildSnapshot()
  // ──────────────────────────────────────────────

  describe('buildSnapshot', () => {
    it('builds a snapshot from a full template preserving all entity IDs', async () => {
      const template = mockTemplateWithInclude({
        id: 'tpl-1',
        name: 'Snapshot Template',
        attributeModifiersEnabled: true,
        attributeModifierFormula: 'floor(str/2)-5',
        skillFormula: null,
        attributes: [
          { id: 'attr-1', key: 'str', name: 'Strength', templateId: 'tpl-1', order: 0 },
          { id: 'attr-2', key: 'dex', name: 'Dexterity', templateId: 'tpl-1', order: 1 },
        ],
        templateFields: [
          { id: 'fld-1', key: 'bio', label: 'Biography', templateId: 'tpl-1', order: 0 },
        ],
        templateSkills: [
          { id: 'skill-1', name: 'Athletics', description: null, templateId: 'tpl-1', order: 0, attributeId: 'attr-1', allowedAttributeIds: ['attr-1'], defaultAttributeId: 'attr-1' },
        ],
        skillModifierProfiles: [
          {
            id: 'prof-1', templateId: 'tpl-1', name: 'Expert', order: 0, targetMode: 'ALL_SKILLS', targetSkillIds: [],
            options: [{ id: 'opt-1', profileId: 'prof-1', label: 'x2', value: 2, order: 0 }],
          },
        ],
        coreResources: [
          { id: 'cr-1', templateId: 'tpl-1', slug: 'hp', displayName: 'Hit Points', enabled: true, editableByPlayer: true, showNotes: true, color: null, order: 0 },
        ],
        armorClasses: [{
          id: 'ac-1', templateId: 'tpl-1', name: 'Armor Class', enabled: true,
          attributeModifiers: [{ id: 'am-1', armorClassId: 'ac-1', attributeId: 'attr-1', allowPlayerSelection: false, defaultAttributeId: null }],
          fields: [{ id: 'acf-1', armorClassId: 'ac-1', name: 'Total', key: 'total', defaultValue: '10', editableByPlayer: false, description: null, order: 0 }],
        }],
        characterSections: [{ id: 'cs-1', templateId: 'tpl-1', name: 'Equipment', order: 0 }],
        resistances: [{
          id: 'res-1', templateId: 'tpl-1', name: 'Damage Resistances', calculationType: 'MANUAL', order: 0,
          components: [{ id: 'rc-1', resistanceId: 'res-1', name: 'Slashing', editableByPlayer: true, defaultValue: '0', order: 0 }],
          attributeModifiers: [{ id: 'ram-1', resistanceId: 'res-1', attributeId: 'attr-1', enabled: true }],
        }],
      })

      const snapshot = await (service as any).buildSnapshot(template)

      expect(snapshot.id).toBe('tpl-1')
      expect(snapshot.name).toBe('Snapshot Template')
      expect(snapshot.attributeModifierFormula).toBe('floor(str/2)-5')

      // Verify IDs are preserved
      expect(snapshot.attributes[0].id).toBe('attr-1')
      expect(snapshot.templateFields[0].id).toBe('fld-1')
      expect(snapshot.templateSkills[0].id).toBe('skill-1')
      expect(snapshot.skillModifierProfiles[0].id).toBe('prof-1')
      expect(snapshot.skillModifierProfiles[0].options[0].id).toBe('opt-1')
      expect(snapshot.coreResources[0].id).toBe('cr-1')
      expect(snapshot.armorClasses[0].id).toBe('ac-1')
      expect(snapshot.armorClasses[0].attributeModifiers[0].id).toBe('am-1')
      expect(snapshot.armorClasses[0].fields[0].id).toBe('acf-1')
      expect(snapshot.characterSections[0].id).toBe('cs-1')
      expect(snapshot.resistances[0].id).toBe('res-1')
      expect(snapshot.resistances[0].components[0].id).toBe('rc-1')
      expect(snapshot.resistances[0].attributeModifiers[0].id).toBe('ram-1')

      // Verify counts
      expect(snapshot.attributes).toHaveLength(2)
      expect(snapshot.armorClasses).toHaveLength(1)
    })

    it('handles empty sub-arrays', async () => {
      const template = mockTemplateWithInclude({
        attributes: [],
        templateFields: [],
        templateSkills: [],
        skillModifierProfiles: [],
        coreResources: [],
        armorClasses: [],
        characterSections: [],
        resistances: [],
      })

      const snapshot = await (service as any).buildSnapshot(template)

      expect(snapshot.attributes).toEqual([])
      expect(snapshot.templateFields).toEqual([])
      expect(snapshot.templateSkills).toEqual([])
      expect(snapshot.skillModifierProfiles).toEqual([])
      expect(snapshot.coreResources).toEqual([])
      expect(snapshot.armorClasses).toEqual([])
      expect(snapshot.characterSections).toEqual([])
      expect(snapshot.resistances).toEqual([])
    })
  })

  // ──────────────────────────────────────────────
  //  attachToAdventure()
  // ──────────────────────────────────────────────

  describe('attachToAdventure', () => {
    const templateId = 'template-1'
    const adventureId = 'adv-1'
    const userId = 'user-1'
    const fullTemplate = mockTemplateWithInclude({
      name: 'Attached Template',
      attributes: [{ id: 'attr-1', key: 'str', name: 'Strength', templateId, order: 0 }],
    })

    it('attaches a template, creates snapshot, and sets templateSource to attached', async () => {
      prisma.adventure.findUnique.mockResolvedValueOnce(null) // no existing attachment
      prisma.template.count.mockResolvedValue(0) // no campaign-owned templates
      prisma.template.findUnique.mockResolvedValue(fullTemplate)
      const updatedAdventure = { id: adventureId, templateSnapshot: {}, originalTemplateId: templateId, templateSource: 'attached' }
      prisma.adventure.update.mockResolvedValue(updatedAdventure)

      const result = await service.attachToAdventure(templateId, adventureId, userId)

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith(adventureId, userId, 'GM')
      expect(prisma.template.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: templateId } }),
      )
      expect(prisma.adventure.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: adventureId },
          data: expect.objectContaining({
            originalTemplateId: templateId,
            templateSource: 'attached',
          }),
        }),
      )
      expect(prisma.template.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: templateId },
          data: { useCount: { increment: 1 } },
        }),
      )
      expect(mockRedisService.del).toHaveBeenCalledWith(`templates:adventure:${adventureId}`)
      expect(result).toEqual(updatedAdventure)
    })

    it('throws NotFoundException when template not found', async () => {
      prisma.template.findUnique.mockResolvedValue(null)

      await expect(service.attachToAdventure('nonexistent', adventureId, userId)).rejects.toThrow(NotFoundException)
      expect(prisma.adventure.update).not.toHaveBeenCalled()
    })

    it('throws ForbiddenException when user is not GM', async () => {
      mockMembershipService.requireRole.mockRejectedValue(new ForbiddenException('Not GM'))

      await expect(service.attachToAdventure(templateId, adventureId, 'not-gm')).rejects.toThrow(ForbiddenException)
      expect(prisma.template.findUnique).not.toHaveBeenCalled()
    })

    it('throws ConflictException when a template is already attached', async () => {
      prisma.adventure.findUnique.mockResolvedValue({
        originalTemplateId: 'existing-tpl',
        templateSnapshot: { name: 'Existing Snapshot' },
      })

      await expect(
        service.attachToAdventure('new-tpl', adventureId, userId),
      ).rejects.toThrow(ConflictException)
      expect(prisma.template.findUnique).not.toHaveBeenCalled()
      expect(prisma.adventure.update).not.toHaveBeenCalled()
    })

    it('throws ConflictException when campaign-owned templates exist', async () => {
      prisma.adventure.findUnique.mockResolvedValue(null) // no existing attachment
      prisma.template.count.mockResolvedValue(2) // campaign has campaign-owned templates

      await expect(
        service.attachToAdventure(templateId, adventureId, userId),
      ).rejects.toThrow(ConflictException)
      expect(prisma.template.findUnique).not.toHaveBeenCalled()
      expect(prisma.adventure.update).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────
  //  replaceAdventureTemplate()
  // ──────────────────────────────────────────────

  describe('replaceAdventureTemplate', () => {
    const templateId = 'template-2'
    const adventureId = 'adv-1'
    const userId = 'user-1'
    const fullTemplate = mockTemplateWithInclude({
      name: 'Replacement Template',
      attributes: [{ id: 'attr-2', key: 'dex', name: 'Dexterity', templateId, order: 0 }],
    })

    it('replaces the attached template and sets templateSource to attached', async () => {
      prisma.adventure.findUnique.mockResolvedValue({ originalTemplateId: 'template-1' })
      prisma.template.count.mockResolvedValue(0) // no campaign-owned templates
      prisma.template.findUnique.mockResolvedValue(fullTemplate)
      const updatedAdventure = { id: adventureId, templateSnapshot: {}, originalTemplateId: templateId, templateSource: 'attached' }
      prisma.adventure.update.mockResolvedValue(updatedAdventure)

      const result = await service.replaceAdventureTemplate(templateId, adventureId, userId)

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith(adventureId, userId, 'GM')
      expect(prisma.template.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: templateId } }),
      )
      expect(prisma.adventure.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: adventureId },
          data: expect.objectContaining({
            originalTemplateId: templateId,
            templateSource: 'attached',
          }),
        }),
      )
      // Cache invalidated for current adventure
      expect(mockRedisService.del).toHaveBeenCalledWith(`templates:adventure:${adventureId}`)
      // Cache invalidated for both old template ('template-1') and new template ('template-2')
      expect(mockRedisService.del).toHaveBeenCalledWith(expect.stringContaining('template-1'))
      expect(result).toEqual(updatedAdventure)
    })

    it('throws NotFoundException when template not found', async () => {
      prisma.adventure.findUnique.mockResolvedValue({ originalTemplateId: 'template-1' })
      prisma.template.findUnique.mockResolvedValue(null)

      await expect(
        service.replaceAdventureTemplate('nonexistent', adventureId, userId),
      ).rejects.toThrow(NotFoundException)
      expect(prisma.adventure.update).not.toHaveBeenCalled()
    })

    it('throws ForbiddenException when user is not GM', async () => {
      mockMembershipService.requireRole.mockRejectedValue(new ForbiddenException('Not GM'))

      await expect(
        service.replaceAdventureTemplate(templateId, adventureId, 'not-gm'),
      ).rejects.toThrow(ForbiddenException)
      expect(prisma.template.findUnique).not.toHaveBeenCalled()
    })

    it('works when no template was previously attached', async () => {
      prisma.adventure.findUnique.mockResolvedValue({ originalTemplateId: null })
      prisma.template.count.mockResolvedValue(0)
      prisma.template.findUnique.mockResolvedValue(fullTemplate)
      const updatedAdventure = { id: adventureId, templateSnapshot: {}, originalTemplateId: templateId, templateSource: 'attached' }
      prisma.adventure.update.mockResolvedValue(updatedAdventure)

      const result = await service.replaceAdventureTemplate(templateId, adventureId, userId)

      expect(prisma.adventure.update).toHaveBeenCalled()
      expect(result.originalTemplateId).toBe(templateId)
    })

    it('throws ConflictException when campaign-owned templates exist', async () => {
      prisma.adventure.findUnique.mockResolvedValue({ originalTemplateId: 'template-1' })
      prisma.template.count.mockResolvedValue(2) // campaign has campaign-owned templates

      await expect(
        service.replaceAdventureTemplate(templateId, adventureId, userId),
      ).rejects.toThrow(ConflictException)
      expect(prisma.template.findUnique).not.toHaveBeenCalled()
      expect(prisma.adventure.update).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────
  //  detachFromAdventure()
  // ──────────────────────────────────────────────

  describe('detachFromAdventure', () => {
    const adventureId = 'adv-1'
    const userId = 'user-1'

    it('detaches template link, clears snapshot, and sets templateSource to null', async () => {
      prisma.adventure.findUnique.mockResolvedValue({ originalTemplateId: 'template-1' })
      const updatedAdventure = { id: adventureId, originalTemplateId: null, templateSnapshot: null, templateSource: null }
      prisma.adventure.update.mockResolvedValue(updatedAdventure)

      const result = await service.detachFromAdventure(adventureId, userId)

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith(adventureId, userId, 'GM')
      expect(prisma.adventure.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: adventureId },
          data: { originalTemplateId: null, templateSnapshot: DbNull, templateSource: null },
        }),
      )
      expect(mockRedisService.del).toHaveBeenCalledWith(`templates:adventure:${adventureId}`)
      expect(result).toEqual(updatedAdventure)
    })

    it('handles already-detached template', async () => {
      prisma.adventure.findUnique.mockResolvedValue({ originalTemplateId: null })
      const updatedAdventure = { id: adventureId, originalTemplateId: null, templateSnapshot: null, templateSource: null }
      prisma.adventure.update.mockResolvedValue(updatedAdventure)

      const result = await service.detachFromAdventure(adventureId, userId)

      expect(prisma.adventure.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            originalTemplateId: null,
            templateSnapshot: DbNull,
            templateSource: null,
          }),
        }),
      )
      expect(result.originalTemplateId).toBeNull()
      expect(result.templateSnapshot).toBeNull()
    })

    it('throws ForbiddenException when user is not GM', async () => {
      mockMembershipService.requireRole.mockRejectedValue(new ForbiddenException('Not GM'))

      await expect(service.detachFromAdventure(adventureId, 'not-gm')).rejects.toThrow(ForbiddenException)
      expect(prisma.adventure.update).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────
  //  getTemplateSnapshot()
  // ──────────────────────────────────────────────

  describe('getTemplateSnapshot', () => {
    const adventureId = 'adv-1'
    const userId = 'user-1'

    it('returns snapshot and originalTemplateId when they exist', async () => {
      mockMembershipService.isMember.mockResolvedValue(true)
      prisma.adventure.findUnique.mockResolvedValue({
        templateSnapshot: { id: 'tpl-1', name: 'Snapshot', attributes: [] },
        originalTemplateId: 'tpl-1',
      })

      const result = await service.getTemplateSnapshot(adventureId, userId)

      expect(mockMembershipService.isMember).toHaveBeenCalledWith(adventureId, userId)
      expect(result.snapshot).toBeDefined()
      expect(result.snapshot.name).toBe('Snapshot')
      expect(result.originalTemplateId).toBe('tpl-1')
    })

    it('throws NotFoundException when adventure not found', async () => {
      mockMembershipService.isMember.mockResolvedValue(true)
      prisma.adventure.findUnique.mockResolvedValue(null)

      await expect(service.getTemplateSnapshot(adventureId, userId)).rejects.toThrow(NotFoundException)
      await expect(service.getTemplateSnapshot(adventureId, userId)).rejects.toThrow('Adventure not found')
    })

    it('returns null snapshot when no snapshot exists', async () => {
      mockMembershipService.isMember.mockResolvedValue(true)
      prisma.adventure.findUnique.mockResolvedValue({
        templateSnapshot: null,
        originalTemplateId: null,
      })

      const result = await service.getTemplateSnapshot(adventureId, userId)

      expect(result.snapshot).toBeNull()
      expect(result.originalTemplateId).toBeNull()
    })

    it('throws ForbiddenException when user is not a member', async () => {
      mockMembershipService.isMember.mockResolvedValue(false)

      await expect(service.getTemplateSnapshot(adventureId, userId)).rejects.toThrow(ForbiddenException)
      await expect(service.getTemplateSnapshot(adventureId, userId)).rejects.toThrow('You are not a member of this adventure')
      expect(prisma.adventure.findUnique).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────
  //  extractVariableNames()
  // ──────────────────────────────────────────────

  describe('extractVariableNames', () => {
    it('returns empty array for null/empty formula', async () => {
      const result1 = await (service as any).extractVariableNames(null)
      const result2 = await (service as any).extractVariableNames('')

      expect(result1).toEqual([])
      expect(result2).toEqual([])
    })

    it('extracts attribute names from a formula', async () => {
      const result = await (service as any).extractVariableNames('str + dex + con')

      expect(result).toEqual(['str', 'dex', 'con'])
    })

    it('filters out known function names (mod, floor, ceil, round, max, min, abs)', async () => {
      const result = await (service as any).extractVariableNames('floor(str/2) + max(dex, con) + abs(prof)')

      expect(result).toEqual(['str', 'dex', 'con', 'prof'])
      expect(result).not.toContain('floor')
      expect(result).not.toContain('max')
      expect(result).not.toContain('abs')
    })

    it('deduplicates repeated variable names', async () => {
      const result = await (service as any).extractVariableNames('str + str + dex + str')

      expect(result).toEqual(['str', 'dex'])
    })
  })
})
