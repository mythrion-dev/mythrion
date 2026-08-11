import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common'
import { I18nService } from 'nestjs-i18n'
import { PrismaService } from '../prisma.service.js'
import { MembershipService } from '../membership/membership.service.js'
import { RedisService } from '../redis/redis.service.js'
import { CreateCharacterSheetDto } from './dto/create-character-sheet.dto.js'
import { CreateCharacterFromCampaignDto } from './dto/create-character-from-campaign.dto.js'
import { templateInclude } from '../template/template.service.js'
import {
  UpdateCharacterSheetDto,
  AttributeValueDto,
  FieldValueDto,
  SkillValueDto,
  SkillProfileValueDto,
  CoreResourceValueDto,
  ArmorClassValueDto,
  ArmorClassAttributeValueDto,
  ResistanceValueDto,
  ResistanceComponentValueDto,
} from './dto/update-character-sheet.dto.js'

const sheetInclude = {
  adventure: { select: { id: true, name: true, campaign: true, originalTemplateId: true, templateSnapshot: true } },
  template: {
    select: {
      id: true,
      name: true,
      attributeModifierFormula: true,
      attributeModifiersEnabled: true,
      skillFormula: true,
      attributes: { orderBy: { order: 'asc' as const } },
      templateSkills: { select: { id: true, name: true, description: true, attributeId: true, allowedAttributeIds: true, defaultAttributeId: true, attribute: { select: { id: true, key: true, name: true } }, defaultAttribute: { select: { id: true, key: true, name: true } } }, orderBy: { order: 'asc' as const } },
      skillModifierProfiles: {
        orderBy: { order: 'asc' as const },
        include: { options: { orderBy: { order: 'asc' as const } } },
      },
      coreResources: { orderBy: { order: 'asc' as const } },
      armorClasses: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          attributeModifiers: {
            orderBy: { createdAt: 'asc' as const },
            include: {
              attribute: { select: { id: true, key: true, name: true } },
              defaultAttribute: { select: { id: true, key: true, name: true } },
            },
          },
          fields: { orderBy: { order: 'asc' as const } },
        },
      },
      characterSections: { orderBy: { order: 'asc' as const } },
      resistances: {
        orderBy: { order: 'asc' as const },
        include: {
          components: { orderBy: { order: 'asc' as const } },
          attributeModifiers: { include: { attribute: { select: { id: true, key: true, name: true } } } },
        },
      },
    },
  },
  sectionEntries: {
    orderBy: { order: 'asc' as const },
    include: {
      section: { select: { id: true, name: true } },
    },
  },
  values: {
    include: {
      attribute: { select: { id: true, key: true, name: true } },
    },
  },
  fieldValues: {
    include: {
      templateField: { select: { id: true, key: true, label: true } },
    },
  },
  skillValues: {
    include: {
      skill: { select: { id: true, name: true, description: true, attributeId: true, allowedAttributeIds: true, defaultAttributeId: true, attribute: { select: { id: true, key: true, name: true } }, defaultAttribute: { select: { id: true, key: true, name: true } } } },
      selectedAttribute: { select: { id: true, key: true, name: true } },
    },
  },
  skillProfileValues: {
    include: {
      profile: { select: { id: true, name: true } },
      option: { select: { id: true, label: true, value: true } },
    },
  },
  acValues: {
    include: {
      field: { select: { id: true, name: true, key: true, defaultValue: true, editableByPlayer: true, description: true } },
    },
  },
  acAttributeValues: {
    include: {
      acAttributeModifier: {
        include: {
          attribute: { select: { id: true, key: true, name: true } },
          defaultAttribute: { select: { id: true, key: true, name: true } },
        },
      },
      selectedAttribute: { select: { id: true, key: true, name: true } },
    },
  },
  coreResourceValues: {
    include: {
      coreResource: {
        select: {
          id: true,
          displayName: true,
          slug: true,
          enabled: true,
          editableByPlayer: true,
          showNotes: true,
        },
      },
    },
  },
  abilities: {
    where: { summonId: null },
    orderBy: { order: 'asc' as const },
    include: {
      levels: { orderBy: { level: 'asc' as const } },
      summonAttributes: { orderBy: { createdAt: 'asc' as const } },
      summonAcValues: true,
      summonHealth: true,
      summonSkills: {
        orderBy: { createdAt: 'asc' as const },
      },
      summonResistances: {
        orderBy: { createdAt: 'asc' as const },
      },
      childAbilities: {
        orderBy: { order: 'asc' as const },
        include: {
          levels: { orderBy: { level: 'asc' as const } },
        },
      },
    },
  },
  resistanceValues: {
    include: {
      resistance: { select: { id: true, name: true, calculationType: true, order: true } },
    },
  },
  resistanceComponentValues: {
    include: {
      component: { select: { id: true, name: true, editableByPlayer: true, defaultValue: true, resistance: { select: { id: true, name: true, calculationType: true } } } },
    },
  },
  inventoryItems: { orderBy: { order: 'asc' as const } },
  story: true,
}

@Injectable()
export class CharacterSheetService {
  private readonly logger = new Logger(CharacterSheetService.name)
  private readonly CACHE_TTL = 30 // seconds
  private readonly LIST_CACHE_TTL = 15 // seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly redis: RedisService,
    private readonly i18n: I18nService,
  ) {}

  private cacheKey(id: string): string {
    return `character-sheet:${id}`
  }

  private userListCacheKey(userId: string): string {
    return `character-sheets:user:${userId}`
  }

  /** Adventure list cache is scoped by role so a GM never reads a player's cached view and vice versa. */
  private adventureListCacheKey(adventureId: string, role: 'GM' | 'PLAYER', userId: string): string {
    return role === 'GM'
      ? `character-sheets:adventure:${adventureId}:gm`
      : `character-sheets:adventure:${adventureId}:player:${userId}`
  }

  private adventureListCachePattern(adventureId: string): string {
    return `character-sheets:adventure:${adventureId}:*`
  }

  /** Invalidate cached sheet(s). sheetId always invalidated; userId/adventureId also invalidate list caches. */
  private async invalidateCache(sheetId: string, userId?: string, adventureId?: string): Promise<void> {
    try {
      await this.redis.del(this.cacheKey(sheetId))
      if (userId) await this.redis.del(this.userListCacheKey(userId))
      if (adventureId) await this.redis.invalidatePattern(this.adventureListCachePattern(adventureId))
    } catch (err) {
      this.logger.warn('Failed to invalidate character sheet cache', err)
    }
  }

  /** Create a character sheet from a template. */
  async create(userId: string, dto: CreateCharacterSheetDto) {
    const template = await this.prisma.template.findUnique({
      where: { id: dto.templateId },
      select: {
        id: true,
        adventureId: true,
        skillFormula: true,
        attributes: true,
        templateFields: true,
      templateSkills: { select: { id: true, name: true, description: true, templateId: true, order: true, attributeId: true, defaultAttributeId: true, allowedAttributeIds: true } },
        skillModifierProfiles: { include: { options: { orderBy: { order: 'asc' } } } },
        coreResources: true,
      },
    })
    if (!template) throw new NotFoundException(this.i18n.t('character-sheet.templateNotFound'))

    const adventureId = dto.adventureId !== undefined
      ? (dto.adventureId || null)
      : template.adventureId

    if (adventureId) {
      await this.membership.requireWriteAccess(adventureId, userId)
    }

    const skillProfileValues = this.buildSkillProfileValues(
      template.templateSkills as any[],
      template.skillModifierProfiles as any[],
      template.skillFormula,
    )

    // Fetch AC configs for this template (all enabled)
    const armorClasses = await this.prisma.templateArmorClass.findMany({
      where: { templateId: template.id, enabled: true },
      include: { fields: { orderBy: { order: 'asc' } }, attributeModifiers: true },
    })

    // Fetch resistance config for this template
    const resistances = await this.prisma.templateResistance.findMany({
      where: { templateId: template.id },
      include: { components: true },
    })

    const sheet = await this.prisma.characterSheet.create({
      data: {
        characterName: dto.characterName,
        playerName: dto.playerName ?? null,
        level: dto.level ?? 1,
        adventureId: adventureId || null,
        templateId: template.id,
        ownerId: userId,
        values: {
          create: template.attributes.map(a => ({ attributeId: a.id, value: '' })),
        },
        fieldValues: {
          create: (template.templateFields || []).map(f => ({ templateFieldId: f.id, value: '' })),
        },
        skillValues: {
          create: (template.templateSkills || []).map(s => ({ skillId: s.id, value: '', selectedAttributeId: (s as any).defaultAttributeId ?? s.attributeId ?? null })),
        },
        skillProfileValues: {
          create: skillProfileValues.map(spv => ({ skillId: spv.skillId, profileId: spv.profileId, optionId: spv.optionId })),
        },
        coreResourceValues: {
          create: (template.coreResources || []).filter(cr => cr.enabled).map(cr => ({
            coreResourceId: cr.id,
          })),
        },
        acValues: armorClasses.some(ac => ac.fields.length > 0)
          ? {
              create: armorClasses.flatMap(ac =>
                ac.fields.map(f => ({
                  fieldId: f.id,
                  value: f.defaultValue,
                }))
              ),
            }
          : undefined,
        acAttributeValues: armorClasses.some(ac => ac.attributeModifiers.length > 0)
          ? {
              create: armorClasses.flatMap(ac =>
                ac.attributeModifiers.map(am => ({
                  acAttributeModifierId: am.id,
                  selectedAttributeId: am.allowPlayerSelection ? (am.defaultAttributeId ?? null) : null,
                }))
              ),
            }
          : undefined,
        resistanceValues: {
          create: resistances.map(r => ({
            resistanceId: r.id,
          })),
        },
        resistanceComponentValues: {
          create: resistances.flatMap(r =>
            r.components.map(c => ({
              componentId: c.id,
              value: c.defaultValue,
            })),
          ),
        },
      },
      include: sheetInclude,
    })

    // ── Diagnostic: log core resource values created ──
    const crvsDebug = (sheet as any).coreResourceValues?.map((crv: any) => ({
      id: crv.id,
      slug: crv.coreResource?.slug,
      enabled: crv.coreResource?.enabled,
      current: crv.current,
      maximum: crv.maximum,
    }))
    this.logger.debug(
      `[DIAGNOSTIC] characterSheetService.create: sheet "${sheet.characterName}" | ` +
      `templateId=${dto.templateId} | CRVs=${JSON.stringify(crvsDebug ?? [])}`,
    )
    const hpCrvDebug = (sheet as any).coreResourceValues?.find(
      (crv: any) => crv.coreResource?.slug === 'hp',
    )
    if (!hpCrvDebug) {
      this.logger.warn(
        `[DIAGNOSTIC] characterSheetService.create: NO HP core resource for "${sheet.characterName}" | ` +
        `templateId=${dto.templateId} | Template likely missing slug='hp' core resource`,
      )
    }

    // Invalidate user's list cache for the new sheet
    await this.invalidateCache(sheet.id, userId, adventureId ?? undefined).catch(() => {})

    return sheet
  }

  /** Create a character sheet from a campaign's template snapshot. */
  async createFromCampaignSnapshot(userId: string, dto: CreateCharacterFromCampaignDto) {
    // 1. Query Adventure for snapshot + originalTemplateId
    const adventure = await this.prisma.adventure.findUnique({
      where: { id: dto.adventureId },
      select: { templateSnapshot: true, originalTemplateId: true },
    })
    if (!adventure) throw new NotFoundException(this.i18n.t('character-sheet.campaignNotFound'))

    // 2. Resolve the template source. A snapshot attached via the attach system
    //    takes precedence; otherwise fall back to a template created directly on
    //    the campaign (templateSource: 'campaign'). Its fully-included shape
    //    mirrors the stored snapshot, so it can drive sheet creation the same way.
    let snapshot: any
    let templateId: string
    if (adventure.templateSnapshot && adventure.originalTemplateId) {
      snapshot = adventure.templateSnapshot
      templateId = adventure.originalTemplateId
    } else {
      const campaignTemplate = await this.prisma.template.findFirst({
        where: { adventureId: dto.adventureId },
        include: templateInclude,
        orderBy: { createdAt: 'desc' },
      })
      if (!campaignTemplate) {
        throw new BadRequestException(
          this.i18n.t('character-sheet.noTemplateAttached'),
        )
      }
      snapshot = campaignTemplate
      templateId = campaignTemplate.id
    }

    // 3. Validate membership + campaign writability
    await this.membership.requireWriteAccess(dto.adventureId, userId)

    // 5. Build skill profile values from snapshot data
    const skillProfileValues = this.buildSkillProfileValues(
      snapshot.templateSkills ?? [],
      snapshot.skillModifierProfiles ?? [],
      snapshot.skillFormula as string | undefined,
    )

    // 6. Build armor class and resistance data from snapshot
    const armorClasses: any[] = (snapshot.armorClasses ?? []).filter((ac: any) => ac.enabled !== false)
    const resistances: any[] = snapshot.resistances ?? []

    // 7. Create the sheet using snapshot data for all sub-resources
    const sheet = await this.prisma.characterSheet.create({
      data: {
        characterName: dto.characterName,
        playerName: dto.playerName ?? null,
        level: dto.level ?? 1,
        adventureId: dto.adventureId,
        templateId,
        ownerId: userId,
        values: {
          create: (snapshot.attributes ?? []).map((a: any) => ({ attributeId: a.id, value: '' })),
        },
        fieldValues: {
          create: (snapshot.templateFields ?? []).map((f: any) => ({ templateFieldId: f.id, value: '' })),
        },
        skillValues: {
          create: (snapshot.templateSkills ?? []).map((s: any) => ({
            skillId: s.id,
            value: '',
            selectedAttributeId: (s as any).defaultAttributeId ?? s.attributeId ?? null,
          })),
        },
        skillProfileValues: {
          create: skillProfileValues.map(spv => ({
            skillId: spv.skillId,
            profileId: spv.profileId,
            optionId: spv.optionId,
          })),
        },
        coreResourceValues: {
          create: (snapshot.coreResources ?? []).filter((cr: any) => cr.enabled).map((cr: any) => ({
            coreResourceId: cr.id,
          })),
        },
        acValues: armorClasses.some((ac: any) => (ac.fields ?? []).length > 0)
          ? {
              create: armorClasses.flatMap((ac: any) =>
                (ac.fields ?? []).map((f: any) => ({
                  fieldId: f.id,
                  value: f.defaultValue,
                }))
              ),
            }
          : undefined,
        acAttributeValues: armorClasses.some((ac: any) => (ac.attributeModifiers ?? []).length > 0)
          ? {
              create: armorClasses.flatMap((ac: any) =>
                (ac.attributeModifiers ?? []).map((am: any) => ({
                  acAttributeModifierId: am.id,
                  selectedAttributeId: am.allowPlayerSelection ? (am.defaultAttributeId ?? null) : null,
                }))
              ),
            }
          : undefined,
        resistanceValues: {
          create: resistances.map((r: any) => ({
            resistanceId: r.id,
          })),
        },
        resistanceComponentValues: {
          create: resistances.flatMap((r: any) =>
            (r.components ?? []).map((c: any) => ({
              componentId: c.id,
              value: c.defaultValue,
            })),
          ),
        },
      },
      include: sheetInclude,
    })

    // 8. Invalidate cache
    await this.invalidateCache(sheet.id, userId, dto.adventureId).catch(() => {})

    return sheet
  }

  async findAllByUser(userId: string) {
    // Try cache first
    const cached = await this.redis.cacheGet<any[]>(this.userListCacheKey(userId))
    if (cached) return cached

    const sheets = await this.prisma.characterSheet.findMany({
      where: { ownerId: userId },
      include: {
        adventure: { select: { id: true, name: true, campaign: true } },
        template: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Cache the list
    await this.redis.cacheSet(this.userListCacheKey(userId), sheets, this.LIST_CACHE_TTL).catch(() => {})

    return sheets
  }

  async findAllByAdventure(adventureId: string, userId: string) {
    // Membership is authoritative: fetch first so a non-member can never hit the cache.
    const member = await this.prisma.campaignMember.findUnique({
      where: { adventureId_userId: { adventureId, userId } },
    })
    if (!member) throw new ForbiddenException(this.i18n.t('character-sheet.notMemberAdventure'))

    const role: 'GM' | 'PLAYER' = member.role === 'GM' ? 'GM' : 'PLAYER'
    const cacheKey = this.adventureListCacheKey(adventureId, role, userId)

    // Try cache first
    const cached = await this.redis.cacheGet<any[]>(cacheKey)
    if (cached) return cached

    const where = member.role === 'GM'
      ? { adventureId, isNpc: false }
      : { adventureId, ownerId: userId, isNpc: false }

    const sheets = await this.prisma.characterSheet.findMany({
      where,
      include: {
        adventure: { select: { id: true, name: true, campaign: true } },
        template: { select: { id: true, name: true } },
        owner: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Cache the list under the role-scoped key
    await this.redis.cacheSet(cacheKey, sheets, this.LIST_CACHE_TTL).catch(() => {})

    return sheets
  }

  async findOne(id: string, userId: string) {
    // Try cache first
    const cached = await this.redis.cacheGet<any>(this.cacheKey(id))
    if (cached) {
      await this.assertSheetAccess(cached, userId)
      return cached
    }

    const sheet = await this.prisma.characterSheet.findUnique({ where: { id }, include: sheetInclude })
    if (!sheet) throw new NotFoundException(this.i18n.t('character-sheet.notFound'))
    await this.assertSheetAccess(sheet, userId)

    // If the original template was deleted, reconstruct template data from the snapshot
    if (!sheet.template && (sheet.adventure as any)?.templateSnapshot) {
      ;(sheet as any).template = this.reconstructTemplateFromSnapshot(
        (sheet.adventure as any).templateSnapshot,
      )
    }

    // Cache the result
    await this.redis.cacheSet(this.cacheKey(id), sheet, this.CACHE_TTL).catch(() => {})

    return sheet
  }

  async update(id: string, userId: string, dto: UpdateCharacterSheetDto) {
    const sheet = await this.prisma.characterSheet.findUnique({ where: { id } })
    if (!sheet) throw new NotFoundException(this.i18n.t('character-sheet.notFound'))
    await this.assertCanModify(sheet, userId)

    if (dto.values) await this.updateValues(id, dto.values)
    if (dto.fieldValues) await this.updateFieldValues(id, dto.fieldValues)
    if (dto.skillValues) await this.updateSkillValues(id, dto.skillValues)
    if (dto.skillProfileValues) await this.updateSkillProfileValues(id, dto.skillProfileValues)
    if (dto.coreResourceValues) await this.updateCoreResourceValues(id, dto.coreResourceValues)
    if (dto.acValues) await this.updateAcValues(id, dto.acValues)
    if (dto.acAttributeValues) await this.updateAcAttributeValues(id, dto.acAttributeValues)
    if (dto.resistanceValues) await this.updateResistanceValues(id, dto.resistanceValues)
    if (dto.resistanceComponentValues) await this.updateResistanceComponentValues(id, dto.resistanceComponentValues)

    const updated = await this.prisma.characterSheet.update({
      where: { id },
      data: this.buildUpdateData(dto),
      include: sheetInclude,
    })

    // Invalidate cache for this sheet and the owner's list
    await this.invalidateCache(sheet.id, sheet.ownerId ?? undefined, sheet.adventureId ?? undefined).catch(() => {})

    return updated
  }

  private async assertCanModify(
    sheet: { ownerId: string | null; isNpc: boolean; adventureId: string | null },
    userId: string,
  ): Promise<void> {
    if (sheet.ownerId === userId) {
      // Owner editing their own sheet: respect campaign read-only state when linked
      if (sheet.adventureId) {
        await this.membership.requireWriteAccess(sheet.adventureId, userId)
      }
      return
    }
    // Only allow GM bypass for NPC sheets; player sheets are owner-only
    if (sheet.isNpc && sheet.adventureId) {
      try {
        await this.membership.requireWriteRole(sheet.adventureId, userId, 'GM')
        return
      } catch {
        throw new ForbiddenException(this.i18n.t('character-sheet.noModifyPermission'))
      }
    }
    throw new ForbiddenException(this.i18n.t('character-sheet.noModifyPermission'))
  }

  private async updateValues(id: string, values: AttributeValueDto[]): Promise<void> {
    for (const v of values)
      await this.prisma.characterSheetValue.upsert({
        where: { sheetId_attributeId: { sheetId: id, attributeId: v.attributeId } },
        create: { sheetId: id, attributeId: v.attributeId, value: v.value },
        update: { value: v.value },
      })
  }

  private async updateFieldValues(id: string, fieldValues: FieldValueDto[]): Promise<void> {
    for (const fv of fieldValues)
      await this.prisma.characterSheetFieldValue.upsert({
        where: { sheetId_templateFieldId: { sheetId: id, templateFieldId: fv.templateFieldId } },
        create: { sheetId: id, templateFieldId: fv.templateFieldId, value: fv.value },
        update: { value: fv.value },
      })
  }

  private async updateSkillValues(id: string, skillValues: SkillValueDto[]): Promise<void> {
    for (const sv of skillValues)
      await this.prisma.characterSheetSkillValue.upsert({
        where: { sheetId_skillId: { sheetId: id, skillId: sv.skillId } },
        create: { sheetId: id, skillId: sv.skillId, value: sv.value, selectedAttributeId: sv.selectedAttributeId ?? null },
        update: { value: sv.value, ...(sv.selectedAttributeId !== undefined ? { selectedAttributeId: sv.selectedAttributeId } : {}) },
      })
  }

  private async updateSkillProfileValues(id: string, skillProfileValues: SkillProfileValueDto[]): Promise<void> {
    for (const spv of skillProfileValues)
      await this.prisma.characterSheetSkillProfileValue.upsert({
        where: { sheetId_skillId_profileId: { sheetId: id, skillId: spv.skillId, profileId: spv.profileId } },
        create: { sheetId: id, skillId: spv.skillId, profileId: spv.profileId, optionId: spv.optionId },
        update: { optionId: spv.optionId },
      })
  }

  private async updateCoreResourceValues(id: string, coreResourceValues: CoreResourceValueDto[]): Promise<void> {
    for (const crv of coreResourceValues) {
      await this.prisma.characterSheetCoreResourceValue.upsert({
        where: { sheetId_coreResourceId: { sheetId: id, coreResourceId: crv.coreResourceId } },
        create: { sheetId: id, coreResourceId: crv.coreResourceId, current: crv.current ?? null, maximum: crv.maximum ?? null, notes: crv.notes ?? null },
        update: { current: crv.current, maximum: crv.maximum, notes: crv.notes },
      })
    }
  }

  private async updateAcValues(id: string, acValues: ArmorClassValueDto[]): Promise<void> {
    for (const acv of acValues)
      await this.prisma.characterSheetArmorClassValue.upsert({
        where: { sheetId_fieldId: { sheetId: id, fieldId: acv.fieldId } },
        create: { sheetId: id, fieldId: acv.fieldId, value: acv.value },
        update: { value: acv.value },
      })
  }

  private async updateAcAttributeValues(id: string, acAttributeValues: ArmorClassAttributeValueDto[]): Promise<void> {
    for (const acav of acAttributeValues)
      await this.prisma.characterSheetArmorClassAttributeValue.upsert({
        where: { sheetId_acAttributeModifierId: { sheetId: id, acAttributeModifierId: acav.acAttributeModifierId } },
        create: { sheetId: id, acAttributeModifierId: acav.acAttributeModifierId, selectedAttributeId: acav.selectedAttributeId ?? null },
        update: { selectedAttributeId: acav.selectedAttributeId ?? null },
      })
  }

  private async updateResistanceValues(id: string, resistanceValues: ResistanceValueDto[]): Promise<void> {
    for (const rv of resistanceValues) {
      // Check if this resistanceId belongs to a sheet-specific resistance
      const sheetRes = await this.prisma.sheetResistance.findUnique({
        where: { id: rv.resistanceId },
        select: { id: true, calculationType: true },
      })
      if (sheetRes) {
        // Sheet resistance: upsert a "Value" component with the manual value
        const existingComp = await this.prisma.sheetResistanceComponent.findFirst({
          where: { sheetResistanceId: sheetRes.id },
          orderBy: { order: 'asc' },
        })
        if (existingComp) {
          await this.prisma.sheetResistanceComponent.update({
            where: { id: existingComp.id },
            data: { value: rv.manualValue ?? '0' },
          })
        } else {
          await this.prisma.sheetResistanceComponent.create({
            data: {
              sheetResistanceId: sheetRes.id,
              name: 'Value',
              value: rv.manualValue ?? '0',
              order: 0,
            },
          })
        }
      } else {
        // Template resistance: use existing junction table
        await this.prisma.characterSheetResistanceValue.upsert({
          where: { sheetId_resistanceId: { sheetId: id, resistanceId: rv.resistanceId } },
          create: { sheetId: id, resistanceId: rv.resistanceId, manualValue: rv.manualValue ?? null },
          update: { manualValue: rv.manualValue ?? null },
        })
      }
    }
  }

  private async updateResistanceComponentValues(id: string, resistanceComponentValues: ResistanceComponentValueDto[]): Promise<void> {
    for (const rcv of resistanceComponentValues) {
      // Check if this componentId belongs to a sheet resistance component
      const sheetComp = await this.prisma.sheetResistanceComponent.findUnique({
        where: { id: rcv.componentId },
        select: { id: true },
      })
      if (sheetComp) {
        await this.prisma.sheetResistanceComponent.update({
          where: { id: rcv.componentId },
          data: { value: rcv.value },
        })
      } else {
        // Template resistance component: use existing junction table
        await this.prisma.characterSheetResistanceComponentValue.upsert({
          where: { sheetId_componentId: { sheetId: id, componentId: rcv.componentId } },
          create: { sheetId: id, componentId: rcv.componentId, value: rcv.value },
          update: { value: rcv.value },
        })
      }
    }
  }

  private buildUpdateData(dto: UpdateCharacterSheetDto) {
    return {
      ...(dto.characterName !== undefined && { characterName: dto.characterName }),
      ...(dto.playerName !== undefined && { playerName: dto.playerName }),
      ...(dto.level !== undefined && { level: dto.level }),
      ...(dto.hpActual !== undefined && { hpActual: dto.hpActual }),
      ...(dto.hpMax !== undefined && { hpMax: dto.hpMax }),
      ...(dto.hpNotes !== undefined && { hpNotes: dto.hpNotes }),
    }
  }

  async remove(id: string, userId: string) {
    const sheet = await this.prisma.characterSheet.findUnique({ where: { id } })
    if (!sheet) throw new NotFoundException(this.i18n.t('character-sheet.notFound'))
    if (sheet.ownerId === userId) {
      // Owner editing their own sheet: respect campaign read-only state when linked
      if (sheet.adventureId) {
        await this.membership.requireWriteAccess(sheet.adventureId, userId)
      }
    } else {
      if (sheet.isNpc && sheet.adventureId) {
        try { await this.membership.requireWriteRole(sheet.adventureId, userId, 'GM') }
        catch { throw new ForbiddenException(this.i18n.t('character-sheet.noModifyPermission')) }
      } else {
        throw new ForbiddenException(this.i18n.t('character-sheet.noModifyPermission'))
      }
    }
    const deleted = await this.prisma.characterSheet.delete({ where: { id } })

    // Invalidate cache for this sheet and the owner's list
    await this.invalidateCache(id, sheet.ownerId ?? undefined, sheet.adventureId ?? undefined).catch(() => {})

    return deleted
  }

  async linkToAdventure(sheetId: string, adventureId: string, userId: string) {
    const sheet = await this.prisma.characterSheet.findUnique({ where: { id: sheetId } })
    if (!sheet) throw new NotFoundException(this.i18n.t('character-sheet.notFound'))
    if (sheet.ownerId !== userId) throw new ForbiddenException(this.i18n.t('character-sheet.ownerOnlyLink'))
    await this.membership.requireWriteAccess(adventureId, userId)
    const linked = await this.prisma.characterSheet.update({ where: { id: sheetId }, data: { adventureId }, include: sheetInclude })

    // Invalidate cache — both old adventure (none) and new adventure lists, plus sheet + user
    await this.invalidateCache(sheetId, sheet.ownerId, adventureId).catch(() => {})

    return linked
  }

  async unlinkFromAdventure(sheetId: string, userId: string) {
    const sheet = await this.prisma.characterSheet.findUnique({ where: { id: sheetId } })
    if (!sheet) throw new NotFoundException(this.i18n.t('character-sheet.notFound'))
    if (sheet.ownerId === userId) {
      // Owner editing their own sheet: respect campaign read-only state when linked
      if (sheet.adventureId) {
        await this.membership.requireWriteAccess(sheet.adventureId, userId)
      }
    } else {
      if (sheet.isNpc && sheet.adventureId) {
        try { await this.membership.requireWriteRole(sheet.adventureId, userId, 'GM') }
        catch { throw new ForbiddenException(this.i18n.t('character-sheet.noModifyPermission')) }
      } else {
        throw new ForbiddenException(this.i18n.t('character-sheet.noModifyPermission'))
      }
    }
    const unlinked = await this.prisma.characterSheet.update({ where: { id: sheetId }, data: { adventureId: null }, include: sheetInclude })

    // Invalidate cache for old adventure list, sheet + user
    await this.invalidateCache(sheetId, sheet.ownerId ?? undefined, sheet.adventureId ?? undefined).catch(() => {})

    return unlinked
  }

  async updateSkillProfileValue(sheetId: string, skillId: string, profileId: string, optionId: string | null, userId: string) {
    await this.requireOwnership(sheetId, userId)
    const result = await this.prisma.characterSheetSkillProfileValue.upsert({
      where: { sheetId_skillId_profileId: { sheetId, skillId, profileId } },
      create: { sheetId, skillId, profileId, optionId },
      update: { optionId },
    })
    await this.invalidateCache(sheetId).catch(() => {})
    return result
  }

  async updateSkillAttribute(sheetId: string, skillId: string, attributeId: string | null, userId: string) {
    await this.requireOwnership(sheetId, userId)

    // Fetch the template skill to validate allowedAttributeIds
    const templateSkill = await this.prisma.templateSkill.findUnique({
      where: { id: skillId },
      select: { allowedAttributeIds: true },
    })
    if (!templateSkill) throw new NotFoundException(this.i18n.t('character-sheet.skillNotFound'))

    // Fixed skills (allowedAttributeIds is empty) reject any attribute change
    if (templateSkill.allowedAttributeIds.length === 0) {
      throw new BadRequestException(this.i18n.t('character-sheet.fixedAttribute'))
    }

    // Player-selectable skills must validate the chosen attribute is in the allowed list
    if (attributeId !== null && !templateSkill.allowedAttributeIds.includes(attributeId)) {
      throw new BadRequestException(this.i18n.t('character-sheet.attributeNotAllowed'))
    }

    const result = await this.prisma.characterSheetSkillValue.upsert({
      where: { sheetId_skillId: { sheetId, skillId } },
      create: { sheetId, skillId, value: '', selectedAttributeId: attributeId },
      update: { selectedAttributeId: attributeId },
    })
    await this.invalidateCache(sheetId).catch(() => {})
    return result
  }

  // ── Abilities & Summons (CRUD) ──

  private readonly abilityInclude = {
    levels: { orderBy: { level: 'asc' as const } },
    summonAttributes: { orderBy: { createdAt: 'asc' as const } },
    summonAcValues: true,
    summonHealth: true,
    summonSkills: {
      orderBy: { createdAt: 'asc' as const },
    },
    summonResistances: {
      orderBy: { createdAt: 'asc' as const },
    },
    childAbilities: {
      orderBy: { order: 'asc' as const },
      include: {
        levels: { orderBy: { level: 'asc' as const } },
      },
    },
  }

  async listAbilities(sheetId: string, userId: string) {
    await this.requireOwnership(sheetId, userId, false)
    return this.prisma.characterAbility.findMany({
      where: { sheetId, summonId: null },
      orderBy: { order: 'asc' },
      include: this.abilityInclude,
    })
  }

  async createAbility(sheetId: string, userId: string, dto: {
    name: string; type?: string; description?: string; notes?: string
    manaCost?: number; range?: string; damage?: string
    // Summon-specific
    summonAttributeValues?: { attributeId: string; value: string }[]
    summonHealthCurrent?: number; summonHealthMax?: number
    // Summon-scoped ability parent
    summonId?: string | null
  }) {
    await this.requireOwnership(sheetId, userId)
    const count = await this.prisma.characterAbility.count({ where: { sheetId, summonId: dto.summonId ?? null } })
    const abilityType = dto.type ?? 'ABILITY'

    if (abilityType === 'SUMMON') {
      // Fetch template attributes to create summon attribute data
      const sheet = await this.prisma.characterSheet.findUnique({
        where: { id: sheetId },
        select: {
          template: {
            select: {
              attributes: true,
            },
          },
        },
      })
      const templateAttrs = sheet?.template?.attributes ?? []

      const summonAttrData = dto.summonAttributeValues ?? templateAttrs.map(a => ({ attributeId: a.id, value: '' }))

      const result = await this.prisma.characterAbility.create({
        data: {
          sheetId,
          name: dto.name,
          type: abilityType,
          description: dto.description ?? null,
          notes: dto.notes ?? null,
          order: count,
          summonAttributes: summonAttrData.length > 0
            ? { create: summonAttrData.map(sa => ({ attributeId: sa.attributeId, value: sa.value })) }
            : undefined,
          summonAcValues: { create: [{ value: '10' }] },
          summonHealth: (dto.summonHealthCurrent !== undefined || dto.summonHealthMax !== undefined)
            ? { create: { current: dto.summonHealthCurrent ?? null, maximum: dto.summonHealthMax ?? null } }
            : undefined,
        },
        include: this.abilityInclude,
      })
      await this.invalidateCache(sheetId).catch(() => {})
      return result
    }

    // Regular ABILITY (possibly summon-scoped if summonId provided)
    const result = await this.prisma.characterAbility.create({
      data: {
        sheetId,
        summonId: dto.summonId ?? null,
        name: dto.name,
        type: abilityType,
        description: dto.description ?? null,
        notes: dto.notes ?? null,
        order: count,
        levels: {
          create: {
            level: '1',
            description: dto.description ?? null,
            manaCost: dto.manaCost ?? null,
            range: dto.range ?? null,
            notes: dto.notes ?? null,
            damage: dto.damage ?? null,
          },
        },
      },
      include: this.abilityInclude,
    })
    await this.invalidateCache(sheetId).catch(() => {})
    return result
  }

  async updateAbility(abilityId: string, userId: string, dto: { name?: string; description?: string; notes?: string }) {
    const ability = await this.prisma.characterAbility.findUnique({ where: { id: abilityId } })
    if (!ability) throw new NotFoundException(this.i18n.t('character-sheet.abilityNotFound'))
    await this.requireOwnership(ability.sheetId, userId)
    const result = await this.prisma.characterAbility.update({ where: { id: abilityId }, data: { ...dto }, include: this.abilityInclude })
    await this.invalidateCache(ability.sheetId).catch(() => {})
    return result
  }

  async removeAbility(abilityId: string, userId: string) {
    const ability = await this.prisma.characterAbility.findUnique({ where: { id: abilityId } })
    if (!ability) throw new NotFoundException(this.i18n.t('character-sheet.abilityNotFound'))
    await this.requireOwnership(ability.sheetId, userId)
    const result = await this.prisma.characterAbility.delete({ where: { id: abilityId } })
    await this.invalidateCache(ability.sheetId).catch(() => {})
    return result
  }

  // ── Summon-scoped ability CRUD ──

  async listSummonAbilities(summonId: string, userId: string) {
    const summon = await this.prisma.characterAbility.findUnique({ where: { id: summonId } })
    if (!summon) throw new NotFoundException(this.i18n.t('character-sheet.summonNotFound'))
    await this.requireOwnership(summon.sheetId, userId, false)
    return this.prisma.characterAbility.findMany({
      where: { summonId },
      orderBy: { order: 'asc' },
      include: this.abilityInclude,
    })
  }

  async createSummonAbility(summonId: string, userId: string, dto: {
    name: string; description?: string; notes?: string
    manaCost?: number; range?: string; damage?: string
  }) {
    const summon = await this.prisma.characterAbility.findUnique({ where: { id: summonId } })
    if (!summon) throw new NotFoundException(this.i18n.t('character-sheet.summonNotFound'))
    if (summon.type !== 'SUMMON') throw new ForbiddenException(this.i18n.t('character-sheet.onlySummonsChildren'))

    const count = await this.prisma.characterAbility.count({ where: { summonId } })
    const result = await this.prisma.characterAbility.create({
      data: {
        sheetId: summon.sheetId,
        summonId,
        name: dto.name,
        type: 'ABILITY',
        description: dto.description ?? null,
        notes: dto.notes ?? null,
        order: count,
        levels: {
          create: {
            level: '1',
            description: dto.description ?? null,
            manaCost: dto.manaCost ?? null,
            range: dto.range ?? null,
            notes: dto.notes ?? null,
            damage: dto.damage ?? null,
          },
        },
      },
      include: this.abilityInclude,
    })
    await this.invalidateCache(summon.sheetId).catch(() => {})
    return result
  }

  // ── Ability Levels (CRUD — for ABILITY type only) ──

  async listAbilityLevels(abilityId: string, userId: string) {
    const ability = await this.prisma.characterAbility.findUnique({ where: { id: abilityId } })
    if (!ability) throw new NotFoundException(this.i18n.t('character-sheet.abilityNotFound'))
    await this.requireOwnership(ability.sheetId, userId, false)
    return this.prisma.characterAbilityLevel.findMany({ where: { abilityId }, orderBy: { level: 'asc' } })
  }

  async createAbilityLevel(
    abilityId: string,
    userId: string,
    dto: { level: string; description?: string; manaCost?: number; range?: string; notes?: string; damage?: string; copyFromPrevious?: boolean },
  ) {
    const ability = await this.prisma.characterAbility.findUnique({
      where: { id: abilityId },
      include: { levels: { orderBy: { level: 'desc' }, take: 1 } },
    })
    if (!ability) throw new NotFoundException(this.i18n.t('character-sheet.abilityNotFound'))
    await this.requireOwnership(ability.sheetId, userId)

    let data = {
      level: String(dto.level),
      description: dto.description ?? null,
      manaCost: dto.manaCost ?? null,
      range: dto.range ?? null,
      notes: dto.notes ?? null,
      damage: dto.damage ?? null,
    }

    if (dto.copyFromPrevious && ability.levels.length > 0) {
      const prev = ability.levels[0]
      data = {
        level: String(dto.level),
        description: dto.description ?? prev.description,
        manaCost: dto.manaCost ?? prev.manaCost,
        range: dto.range ?? prev.range,
        notes: dto.notes ?? prev.notes,
        damage: dto.damage ?? prev.damage,
      }
    }

    // Check that the (abilityId, level) pair doesn't already exist
    const existing = await this.prisma.characterAbilityLevel.findFirst({
      where: { abilityId, level: String(dto.level) },
    })
    if (existing) {
      throw new ConflictException(
        this.i18n.t('character-sheet.levelExists', { args: { level: dto.level } }),
      )
    }

    const result = await this.prisma.characterAbilityLevel.create({
      data: { abilityId, ...data },
    })
    await this.invalidateCache(ability.sheetId).catch(() => {})
    return result
  }

  async updateAbilityLevel(levelId: string, userId: string, dto: { level?: string; description?: string; manaCost?: number; range?: string; notes?: string; damage?: string }) {
    const abilityLevel = await this.prisma.characterAbilityLevel.findUnique({ where: { id: levelId } })
    if (!abilityLevel) throw new NotFoundException(this.i18n.t('character-sheet.abilityLevelNotFound'))
    const ability = await this.prisma.characterAbility.findUnique({ where: { id: abilityLevel.abilityId } })
    if (!ability) throw new NotFoundException(this.i18n.t('character-sheet.abilityNotFound'))
    await this.requireOwnership(ability.sheetId, userId)
    const result = await this.prisma.characterAbilityLevel.update({
      where: { id: levelId },
      data: {
        ...dto,
        ...(dto.level !== undefined ? { level: String(dto.level) } : {}),
      },
    })
    await this.invalidateCache(ability.sheetId).catch(() => {})
    return result
  }

  async deleteAbilityLevel(levelId: string, userId: string) {
    const abilityLevel = await this.prisma.characterAbilityLevel.findUnique({ where: { id: levelId } })
    if (!abilityLevel) throw new NotFoundException(this.i18n.t('character-sheet.abilityLevelNotFound'))
    const ability = await this.prisma.characterAbility.findUnique({ where: { id: abilityLevel.abilityId } })
    if (!ability) throw new NotFoundException(this.i18n.t('character-sheet.abilityNotFound'))
    await this.requireOwnership(ability.sheetId, userId)
    const result = await this.prisma.characterAbilityLevel.delete({ where: { id: levelId } })
    await this.invalidateCache(ability.sheetId).catch(() => {})
    return result
  }

  // ── Summon Skills ──

  async addSummonSkill(abilityId: string, name: string, manualValue: number, userId: string) {
    const ability = await this.prisma.characterAbility.findUnique({ where: { id: abilityId } })
    if (!ability) throw new NotFoundException(this.i18n.t('character-sheet.summonNotFound'))
    if (ability.type !== 'SUMMON') throw new ForbiddenException(this.i18n.t('character-sheet.onlySummonsSkills'))
    await this.requireOwnership(ability.sheetId, userId)

    const result = await this.prisma.summonSkill.create({
      data: {
        abilityId,
        name,
        manualValue,
      },
    })
    await this.invalidateCache(ability.sheetId).catch(() => {})
    return result
  }

  async updateSummonSkill(summonSkillId: string, userId: string, dto: { name?: string; manualValue?: number }) {
    const ss = await this.prisma.summonSkill.findUnique({
      where: { id: summonSkillId },
      include: { ability: true },
    })
    if (!ss) throw new NotFoundException(this.i18n.t('character-sheet.summonSkillNotFound'))
    await this.requireOwnership(ss.ability.sheetId, userId)
    const result = await this.prisma.summonSkill.update({
      where: { id: summonSkillId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.manualValue !== undefined ? { manualValue: dto.manualValue } : {}),
      },
    })
    await this.invalidateCache(ss.ability.sheetId).catch(() => {})
    return result
  }

  async removeSummonSkill(summonSkillId: string, userId: string) {
    const ss = await this.prisma.summonSkill.findUnique({
      where: { id: summonSkillId },
      include: { ability: true },
    })
    if (!ss) throw new NotFoundException(this.i18n.t('character-sheet.summonSkillNotFound'))
    await this.requireOwnership(ss.ability.sheetId, userId)
    const result = await this.prisma.summonSkill.delete({ where: { id: summonSkillId } })
    await this.invalidateCache(ss.ability.sheetId).catch(() => {})
    return result
  }

  // ── Summon Resistances (completely manual) ──

  async addSummonResistance(abilityId: string, name: string, value: string, userId: string) {
    const ability = await this.prisma.characterAbility.findUnique({ where: { id: abilityId } })
    if (!ability) throw new NotFoundException(this.i18n.t('character-sheet.summonNotFound'))
    if (ability.type !== 'SUMMON') throw new ForbiddenException(this.i18n.t('character-sheet.onlySummonsResistances'))
    await this.requireOwnership(ability.sheetId, userId)

    const result = await this.prisma.summonResistance.create({
      data: {
        abilityId,
        name,
        value,
      },
    })
    await this.invalidateCache(ability.sheetId).catch(() => {})
    return result
  }

  async updateSummonResistance(summonResistanceId: string, userId: string, dto: { name?: string; value?: string }) {
    const sr = await this.prisma.summonResistance.findUnique({
      where: { id: summonResistanceId },
      include: { ability: true },
    })
    if (!sr) throw new NotFoundException(this.i18n.t('character-sheet.summonResistanceNotFound'))
    await this.requireOwnership(sr.ability.sheetId, userId)
    const result = await this.prisma.summonResistance.update({
      where: { id: summonResistanceId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.value !== undefined ? { value: dto.value } : {}),
      },
    })
    await this.invalidateCache(sr.ability.sheetId).catch(() => {})
    return result
  }

  async removeSummonResistance(summonResistanceId: string, userId: string) {
    const sr = await this.prisma.summonResistance.findUnique({
      where: { id: summonResistanceId },
      include: { ability: true },
    })
    if (!sr) throw new NotFoundException(this.i18n.t('character-sheet.summonResistanceNotFound'))
    await this.requireOwnership(sr.ability.sheetId, userId)
    const result = await this.prisma.summonResistance.delete({ where: { id: summonResistanceId } })
    await this.invalidateCache(sr.ability.sheetId).catch(() => {})
    return result
  }

  // ── Summon Attribute Values ──

  async updateSummonAttribute(abilityId: string, attributeId: string, value: string, userId: string) {
    const ability = await this.prisma.characterAbility.findUnique({ where: { id: abilityId } })
    if (!ability) throw new NotFoundException(this.i18n.t('character-sheet.abilityNotFound'))
    await this.requireOwnership(ability.sheetId, userId)
    const result = await this.prisma.summonAttribute.upsert({
      where: { abilityId_attributeId: { abilityId, attributeId } },
      create: { abilityId, attributeId, value },
      update: { value },
    })
    await this.invalidateCache(ability.sheetId).catch(() => {})
    return result
  }

  // ── Summon AC Values ──

  async updateSummonAcValue(abilityId: string, value: string, userId: string) {
    const ability = await this.prisma.characterAbility.findUnique({ where: { id: abilityId } })
    if (!ability) throw new NotFoundException(this.i18n.t('character-sheet.abilityNotFound'))
    await this.requireOwnership(ability.sheetId, userId)
    const result = await this.prisma.summonArmorClassValue.upsert({
      where: { abilityId },
      create: { abilityId, value },
      update: { value },
    })
    await this.invalidateCache(ability.sheetId).catch(() => {})
    return result
  }

  // ── Summon Health ──

  async updateSummonHealth(abilityId: string, userId: string, dto: { current?: number | null; maximum?: number | null; notes?: string | null }) {
    const ability = await this.prisma.characterAbility.findUnique({ where: { id: abilityId } })
    if (!ability) throw new NotFoundException(this.i18n.t('character-sheet.abilityNotFound'))
    await this.requireOwnership(ability.sheetId, userId)
    const result = await this.prisma.summonHealth.upsert({
      where: { abilityId },
      create: { abilityId, current: dto.current ?? null, maximum: dto.maximum ?? null, notes: dto.notes ?? null },
      update: { current: dto.current, maximum: dto.maximum, notes: dto.notes },
    })
    await this.invalidateCache(ability.sheetId).catch(() => {})
    return result
  }

  // ── Inventory (CRUD) ──

  async listInventory(sheetId: string, userId: string) {
    await this.requireOwnership(sheetId, userId, false)
    return this.prisma.characterInventoryItem.findMany({ where: { sheetId }, orderBy: { order: 'asc' } })
  }

  async createInventoryItem(sheetId: string, userId: string, dto: { name: string; weight?: number; cost?: string; description?: string }) {
    await this.requireOwnership(sheetId, userId)
    const count = await this.prisma.characterInventoryItem.count({ where: { sheetId } })
    const result = await this.prisma.characterInventoryItem.create({ data: { sheetId, name: dto.name, weight: dto.weight ?? null, cost: dto.cost ?? null, description: dto.description ?? null, order: count } })
    await this.invalidateCache(sheetId).catch(() => {})
    return result
  }

  async updateInventoryItem(itemId: string, userId: string, dto: { name?: string; weight?: number; cost?: string; description?: string }) {
    const item = await this.prisma.characterInventoryItem.findUnique({ where: { id: itemId } })
    if (!item) throw new NotFoundException(this.i18n.t('character-sheet.inventoryItemNotFound'))
    await this.requireOwnership(item.sheetId, userId)
    const result = await this.prisma.characterInventoryItem.update({ where: { id: itemId }, data: { ...dto } })
    await this.invalidateCache(item.sheetId).catch(() => {})
    return result
  }

  async removeInventoryItem(itemId: string, userId: string) {
    const item = await this.prisma.characterInventoryItem.findUnique({ where: { id: itemId } })
    if (!item) throw new NotFoundException(this.i18n.t('character-sheet.inventoryItemNotFound'))
    await this.requireOwnership(item.sheetId, userId)
    const result = await this.prisma.characterInventoryItem.delete({ where: { id: itemId } })
    await this.invalidateCache(item.sheetId).catch(() => {})
    return result
  }

  // ── Story (CRUD — one-to-one) ──

  async getStory(sheetId: string, userId: string) {
    await this.requireOwnership(sheetId, userId, false)
    const story = await this.prisma.characterStory.findUnique({ where: { sheetId } })
    if (!story) {
      return this.prisma.characterStory.create({ data: { sheetId } })
    }
    return story
  }

  async updateStory(sheetId: string, userId: string, dto: { appearance?: string; backstory?: string; personality?: string; goals?: string; notes?: string }) {
    await this.requireOwnership(sheetId, userId)
    const result = await this.prisma.characterStory.upsert({ where: { sheetId }, create: { sheetId, ...dto }, update: { ...dto } })
    await this.invalidateCache(sheetId).catch(() => {})
    return result
  }

  // ── Character Section Entries (CRUD) ──

  async listSectionEntries(sheetId: string, userId: string) {
    await this.requireOwnership(sheetId, userId, false)
    return this.prisma.characterSectionEntry.findMany({
      where: { sheetId },
      orderBy: { order: 'asc' },
      include: { section: { select: { id: true, name: true } } },
    })
  }

  async createSectionEntry(sheetId: string, userId: string, dto: { sectionId: string; name: string; description?: string; notes?: string }) {
    await this.requireOwnership(sheetId, userId)
    const count = await this.prisma.characterSectionEntry.count({ where: { sheetId, sectionId: dto.sectionId } })
    const result = await this.prisma.characterSectionEntry.create({
      data: {
        sheetId,
        sectionId: dto.sectionId,
        name: dto.name,
        description: dto.description ?? '',
        notes: dto.notes ?? null,
        order: count,
      },
      include: { section: { select: { id: true, name: true } } },
    })
    await this.invalidateCache(sheetId).catch(() => {})
    return result
  }

  async updateSectionEntry(entryId: string, userId: string, dto: { name?: string; description?: string; notes?: string }) {
    const entry = await this.prisma.characterSectionEntry.findUnique({ where: { id: entryId } })
    if (!entry) throw new NotFoundException(this.i18n.t('character-sheet.sectionEntryNotFound'))
    await this.requireOwnership(entry.sheetId, userId)
    const result = await this.prisma.characterSectionEntry.update({
      where: { id: entryId },
      data: { ...dto },
      include: { section: { select: { id: true, name: true } } },
    })
    await this.invalidateCache(entry.sheetId).catch(() => {})
    return result
  }

  async removeSectionEntry(entryId: string, userId: string) {
    const entry = await this.prisma.characterSectionEntry.findUnique({ where: { id: entryId } })
    if (!entry) throw new NotFoundException(this.i18n.t('character-sheet.sectionEntryNotFound'))
    await this.requireOwnership(entry.sheetId, userId)
    const result = await this.prisma.characterSectionEntry.delete({ where: { id: entryId } })
    await this.invalidateCache(entry.sheetId).catch(() => {})
    return result
  }

  async createResistance(
    sheetId: string,
    userId: string,
    dto: { name: string; calculationType: 'MANUAL' | 'CALCULATED'; components?: { name: string; editableByPlayer?: boolean; defaultValue?: string }[]; attributeModifiers?: { attributeId: string; enabled?: boolean }[] },
  ) {
    const sheet = await this.prisma.characterSheet.findUnique({ where: { id: sheetId } })
    if (!sheet) throw new NotFoundException(this.i18n.t('character-sheet.notFound'))
    if (sheet.ownerId === userId) {
      if (sheet.adventureId) {
        await this.membership.requireWriteAccess(sheet.adventureId, userId)
      }
    } else {
      if (!sheet.adventureId) throw new ForbiddenException(this.i18n.t('character-sheet.ownerOnlyManage'))
      try { await this.membership.requireWriteRole(sheet.adventureId, userId, 'GM') }
      catch { throw new ForbiddenException(this.i18n.t('character-sheet.ownerOrGmManage')) }
    }

    // Get current max order to append (scoped to this sheet)
    const maxOrder = await this.prisma.sheetResistance.aggregate({
      where: { sheetId },
      _max: { order: true },
    })
    const nextOrder = (maxOrder._max.order ?? -1) + 1

    const resistance = await this.prisma.sheetResistance.create({
      data: {
        sheetId,
        name: dto.name.trim(),
        calculationType: dto.calculationType ?? 'MANUAL',
        order: nextOrder,
        components: {
          create: (dto.components || []).map((c, idx) => ({
            name: c.name.trim(),
            editableByPlayer: c.editableByPlayer ?? false,
            value: c.defaultValue ?? '0',
            order: idx,
          })),
        },
        attributeModifiers: {
          create: (dto.attributeModifiers || []).map(am => ({
            attributeId: am.attributeId,
            enabled: am.enabled ?? true,
          })),
        },
      },
      include: {
        components: { orderBy: { order: 'asc' } },
        attributeModifiers: { include: { attribute: true } },
      },
    })

    await this.invalidateCache(sheetId).catch(() => {})
    return resistance
  }

  async removeResistance(sheetId: string, resistanceId: string, userId: string) {
    const sheet = await this.prisma.characterSheet.findUnique({ where: { id: sheetId } })
    if (!sheet) throw new NotFoundException(this.i18n.t('character-sheet.notFound'))
    if (sheet.ownerId === userId) {
      if (sheet.adventureId) {
        await this.membership.requireWriteAccess(sheet.adventureId, userId)
      }
    } else {
      if (!sheet.adventureId) throw new ForbiddenException(this.i18n.t('character-sheet.ownerOnlyManage'))
      try { await this.membership.requireWriteRole(sheet.adventureId, userId, 'GM') }
      catch { throw new ForbiddenException(this.i18n.t('character-sheet.ownerOrGmManage')) }
    }

    // Try sheet-specific resistance first, fall back to template resistance
    const sheetRes = await this.prisma.sheetResistance.findUnique({
      where: { id: resistanceId },
      select: { id: true, sheetId: true },
    })
    if (sheetRes?.sheetId === sheetId) {
      const result = await this.prisma.sheetResistance.delete({ where: { id: resistanceId } })
      await this.invalidateCache(sheetId).catch(() => {})
      return result
    }

    // Fall back to template resistance (global, defined by GM in the template)
    const result = await this.prisma.templateResistance.delete({ where: { id: resistanceId } })
    await this.invalidateCache(sheetId).catch(() => {})
    return result
  }

  // ── Professional Skills (CRUD + Profiles) ──

  private readonly professionalSkillInclude = {
    attribute: { select: { id: true, key: true, name: true } },
    profileValues: {
      include: {
        profile: { select: { id: true, name: true } },
        option: { select: { id: true, label: true, value: true } },
      },
    },
  } as const

  async listProfessionalSkills(sheetId: string, userId: string) {
    await this.requireOwnership(sheetId, userId, false)
    return this.prisma.sheetProfessionalSkill.findMany({
      where: { sheetId },
      orderBy: { order: 'asc' },
      include: this.professionalSkillInclude,
    })
  }

  async createProfessionalSkill(sheetId: string, userId: string, dto: { name: string; attributeId?: string | null }) {
    await this.requireOwnership(sheetId, userId)
    const count = await this.prisma.sheetProfessionalSkill.count({ where: { sheetId } })
    try {
      const result = await this.prisma.sheetProfessionalSkill.create({
        data: { sheetId, name: dto.name, attributeId: dto.attributeId ?? null, order: count },
        include: this.professionalSkillInclude,
      })
      await this.invalidateCache(sheetId).catch(() => {})
      return result
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
        throw new ConflictException(
          this.i18n.t('character-sheet.profSkillExists', { args: { name: dto.name } }),
        )
      }
      throw err
    }
  }

  async updateProfessionalSkill(skillId: string, userId: string, dto: { name?: string; attributeId?: string | null }) {
    const skill = await this.prisma.sheetProfessionalSkill.findUnique({ where: { id: skillId } })
    if (!skill) throw new NotFoundException(this.i18n.t('character-sheet.profSkillNotFound'))
    await this.requireOwnership(skill.sheetId, userId)
    const result = await this.prisma.sheetProfessionalSkill.update({
      where: { id: skillId },
      data: { ...dto },
      include: this.professionalSkillInclude,
    })
    await this.invalidateCache(skill.sheetId).catch(() => {})
    return result
  }

  async removeProfessionalSkill(skillId: string, userId: string) {
    const skill = await this.prisma.sheetProfessionalSkill.findUnique({ where: { id: skillId } })
    if (!skill) throw new NotFoundException(this.i18n.t('character-sheet.profSkillNotFound'))
    await this.requireOwnership(skill.sheetId, userId)
    const result = await this.prisma.sheetProfessionalSkill.delete({ where: { id: skillId } })
    await this.invalidateCache(skill.sheetId).catch(() => {})
    return result
  }

  async updateProfessionalSkillProfileValue(
    sheetId: string,
    skillId: string,
    profileId: string,
    optionId: string | null,
    userId: string,
  ) {
    await this.requireOwnership(sheetId, userId)
    const result = await this.prisma.sheetProfessionalSkillProfileValue.upsert({
      where: { sheetProfessionalSkillId_profileId: { sheetProfessionalSkillId: skillId, profileId } },
      create: { sheetProfessionalSkillId: skillId, profileId, optionId },
      update: { optionId },
    })
    await this.invalidateCache(sheetId).catch(() => {})
    return result
  }

  private buildSkillProfileValues(
    skills: any[],
    profiles: any[],
    formula: string | null | undefined,
  ): Array<{ skillId: string; profileId: string; optionId?: string | null }> {
    const skillProfileValues: Array<{ skillId: string; profileId: string; optionId?: string | null }> = []
    if (!formula) return skillProfileValues
    const formulaVars = this.extractVariableNames(formula)
    for (const skill of skills) {
      for (const profile of profiles) {
        if (!formulaVars.includes(profile.name)) continue
        const targetMode = (profile as any).targetMode ?? 'ALL_SKILLS'
        const targetSkillIds: string[] = (profile as any).targetSkillIds ?? []
        if (targetMode === 'SELECTED_SKILLS' && targetSkillIds.length > 0 && !targetSkillIds.includes(skill.name)) continue
        const firstOption: any = (profile.options ?? [])[0]
        skillProfileValues.push({ skillId: skill.id, profileId: profile.id, optionId: firstOption?.id ?? null })
      }
    }
    return skillProfileValues
  }

  private async assertSheetAccess(
    sheet: { ownerId: string | null; adventureId: string | null },
    userId: string,
  ): Promise<void> {
    if (sheet.ownerId === userId) return
    if (!sheet.adventureId) throw new ForbiddenException(this.i18n.t('character-sheet.noAccess'))
    try {
      await this.membership.requireRole(sheet.adventureId, userId, 'GM')
    } catch {
      throw new ForbiddenException(this.i18n.t('character-sheet.noAccess'))
    }
  }

  private async requireOwnership(sheetId: string, userId: string, write = true) {
    const sheet = await this.prisma.characterSheet.findUnique({ where: { id: sheetId } })
    if (!sheet) throw new NotFoundException(this.i18n.t('character-sheet.notFound'))
    if (sheet.ownerId === userId) {
      // Owner always retains read access; writes respect campaign read-only state when linked
      if (write && sheet.adventureId) {
        await this.membership.requireWriteAccess(sheet.adventureId, userId)
      }
      return
    }
    // Only allow GM bypass for NPC sheets; player sheets are owner-only
    if (sheet.isNpc && sheet.adventureId) {
      try {
        if (write) {
          await this.membership.requireWriteRole(sheet.adventureId, userId, 'GM')
        } else {
          await this.membership.requireRole(sheet.adventureId, userId, 'GM')
        }
        return
      } catch {
        throw new ForbiddenException(this.i18n.t('character-sheet.noModifyPermission'))
      }
    }
    throw new ForbiddenException(this.i18n.t('character-sheet.noModifyPermission'))
  }

  // Public write-gates reused by the image module for avatar upload/delete.
  async assertCanModifySheet(sheetId: string, userId: string): Promise<void> {
    await this.requireOwnership(sheetId, userId)
  }

  /** Read-access gate for computed endpoints (resistances, AC): owner or campaign GM. */
  async assertReadAccess(sheetId: string, userId: string): Promise<void> {
    const sheet = await this.prisma.characterSheet.findUnique({
      where: { id: sheetId },
      select: { ownerId: true, adventureId: true },
    })
    if (!sheet) throw new NotFoundException(this.i18n.t('character-sheet.notFound'))
    await this.assertSheetAccess(sheet, userId)
  }

  async assertCanModifyAbility(abilityId: string, userId: string): Promise<void> {
    const ability = await this.prisma.characterAbility.findUnique({ where: { id: abilityId } })
    if (!ability) throw new NotFoundException(this.i18n.t('character-sheet.abilityNotFound'))
    await this.requireOwnership(ability.sheetId, userId)
  }

  private extractVariableNames(formula: string): string[] {
    if (!formula) return []
    const tokens = formula.match(/[a-zA-Z_]\w*/g) || []
    const functions = new Set(['mod', 'floor', 'ceil', 'round', 'max', 'min', 'abs'])
    const seen = new Set<string>()
    const vars: string[] = []
    for (const t of tokens) {
      if (!functions.has(t) && !seen.has(t)) { seen.add(t); vars.push(t) }
    }
    return vars
  }

  /**
   * Reconstruct a template-like object from the adventure's templateSnapshot JSON.
   * This is used as a fallback when the original template has been deleted
   * (sheet.template is null) but the snapshot still exists on the adventure.
   * Preserves the same shape that sheetInclude.template would return so the
   * frontend receives a consistent data structure.
   */
  public reconstructTemplateFromSnapshot(snapshot: any): any {
    if (!snapshot) return null

    // Build a map of attribute ID -> { id, key, name } for resolving references
    const attrMap = new Map<string, { id: string; key: string; name: string }>()
    if (snapshot.attributes) {
      for (const a of snapshot.attributes) {
        attrMap.set(a.id, { id: a.id, key: a.key, name: a.name })
      }
    }

    return {
      id: snapshot.id,
      name: snapshot.name,
      attributeModifierFormula: snapshot.attributeModifierFormula ?? null,
      attributeModifiersEnabled: snapshot.attributeModifiersEnabled ?? true,
      skillFormula: snapshot.skillFormula ?? null,
      attributes: (snapshot.attributes ?? []).map((a: any) => ({
        ...a,
        id: a.id, key: a.key, name: a.name, order: a.order,
      })),
      templateFields: (snapshot.templateFields ?? []).map((f: any) => ({
        ...f,
        id: f.id, key: f.key, label: f.label, order: f.order,
      })),
      templateSkills: (snapshot.templateSkills ?? []).map((s: any) => ({
        ...s,
        attribute: s.attributeId ? (attrMap.get(s.attributeId) ?? null) : null,
        defaultAttribute: s.defaultAttributeId ? (attrMap.get(s.defaultAttributeId) ?? null) : null,
      })),
      skillModifierProfiles: (snapshot.skillModifierProfiles ?? []).map((p: any) => ({
        ...p,
        options: (p.options ?? []).map((o: any) => ({
          ...o,
          id: o.id, label: o.label, value: o.value, order: o.order,
        })),
      })),
      coreResources: (snapshot.coreResources ?? []).map((cr: any) => ({
        ...cr,
        id: cr.id, slug: cr.slug, displayName: cr.displayName, enabled: cr.enabled,
        editableByPlayer: cr.editableByPlayer, showNotes: cr.showNotes,
      })),
      armorClasses: (snapshot.armorClasses ?? []).map((ac: any) => ({
        ...ac,
        id: ac.id, name: ac.name, enabled: ac.enabled,
        attributeModifiers: (ac.attributeModifiers ?? []).map((am: any) => ({
          ...am,
          attribute: am.attributeId ? (attrMap.get(am.attributeId) ?? null) : null,
          defaultAttribute: am.defaultAttributeId ? (attrMap.get(am.defaultAttributeId) ?? null) : null,
        })),
        fields: (ac.fields ?? []).map((f: any) => ({
          ...f,
          id: f.id, name: f.name, key: f.key, defaultValue: f.defaultValue,
          editableByPlayer: f.editableByPlayer, description: f.description, order: f.order,
        })),
      })),
      characterSections: (snapshot.characterSections ?? []).map((cs: any) => ({
        ...cs,
        id: cs.id, name: cs.name, order: cs.order,
      })),
      resistances: (snapshot.resistances ?? []).map((r: any) => ({
        ...r,
        components: (r.components ?? []).map((c: any) => ({
          ...c,
          id: c.id, name: c.name, editableByPlayer: c.editableByPlayer, defaultValue: c.defaultValue, order: c.order,
        })),
        attributeModifiers: (r.attributeModifiers ?? []).map((am: any) => ({
          ...am,
          attribute: am.attributeId ? (attrMap.get(am.attributeId) ?? null) : null,
        })),
      })),
    }
  }
}