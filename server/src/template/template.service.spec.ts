jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))

import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { Test } from '@nestjs/testing'
import { NotFoundException, ForbiddenException } from '@nestjs/common'
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
      prisma.template.create.mockResolvedValue(created)
      prisma.templateAttribute.findMany.mockResolvedValue(created.attributes)
      prisma.templateArmorClass.findMany.mockResolvedValue([])
      prisma.template.findUnique.mockResolvedValue(created)

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

      prisma.template.create.mockResolvedValue(created)
      prisma.templateAttribute.findMany.mockResolvedValue(createdAttrs)
      prisma.templateArmorClass.findMany.mockResolvedValue(created.armorClasses)
      prisma.template.findUnique.mockResolvedValue(created)

      await service.create(adventureId, userId, dto as any)

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith(adventureId, userId, 'GM')
      expect(prisma.template.create).toHaveBeenCalled()
      // Skills post-create should have been updated with attribute links
      expect(prisma.templateSkill.update).toHaveBeenCalled()
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

      prisma.template.create.mockResolvedValue(created)
      prisma.templateAttribute.findMany.mockResolvedValue(createdAttrs)
      prisma.templateArmorClass.findMany.mockResolvedValue(createdAcs as any)
      prisma.template.findUnique.mockResolvedValue(created)

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

    it('deletes the template and invalidates cache', async () => {
      const existing = mockTemplateWithInclude()
      prisma.template.findUnique.mockResolvedValue(existing)
      prisma.template.delete.mockResolvedValue(existing)

      const result = await service.remove(id, userId)

      expect(mockMembershipService.requireRole).toHaveBeenCalledWith('adv-1', userId, 'GM')
      expect(prisma.template.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id } }),
      )
      expect(mockRedisService.del).toHaveBeenCalledWith(`template:${id}`)
      expect(mockRedisService.del).toHaveBeenCalledWith(`templates:adventure:adv-1`)
      expect(result).toEqual(existing)
    })

    it('throws NotFoundException when template does not exist', async () => {
      prisma.template.findUnique.mockResolvedValue(null)

      await expect(service.remove(id, userId)).rejects.toThrow(NotFoundException)
      await expect(service.remove(id, userId)).rejects.toThrow('Template not found')
      expect(prisma.template.delete).not.toHaveBeenCalled()
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
})
