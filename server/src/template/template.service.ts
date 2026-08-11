import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger } from '@nestjs/common'
import { I18nService } from 'nestjs-i18n'
import { PrismaService } from '../prisma.service.js'
import { Prisma } from '../generated/prisma/client.js'
import { splitSearchTokens, escapeLike } from '../community/search.util.js'
import { DbNull } from '@prisma/client/runtime/client'
import { MembershipService } from '../membership/membership.service.js'
import { CreateTemplateDto } from './dto/create-template.dto.js'
import {
  UpdateTemplateDto,
  UpdateTemplateSkillDefDto,
  UpdateSkillModifierProfileDefDto,
  UpdateProfileOptionDefDto,
  UpdateArmorClassDefDto,
  UpdateArmorClassAttributeModifierDefDto,
  UpdateArmorClassFieldDefDto,
  UpdateResistanceDefDto,
  UpdateResistanceComponentDefDto,
  UpdateResistanceAttributeModifierDefDto,
} from './dto/update-template.dto.js'
import { RedisService } from '../redis/redis.service.js'

export const templateInclude = {
  attributes: { orderBy: { order: 'asc' as const } },
  templateFields: { orderBy: { order: 'asc' as const } },
  templateSkills: { orderBy: { order: 'asc' as const }, include: { attribute: { select: { id: true, key: true, name: true } }, defaultAttribute: { select: { id: true, key: true, name: true } } } },
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
}

// ── Structural types used by the extracted update helpers ──
type ExistingSkillModifierProfile = {
  id: string
  name: string
  options: Array<{ id: string; label: string }>
}

type ExistingArmorClass = {
  id: string
  name: string
  fields: Array<{ id: string; key: string }>
}

type ExistingResistanceComponent = {
  id: string
  name: string
  editableByPlayer: boolean
  defaultValue: string
}

type ExistingResistance = {
  id: string
  name: string
  components: ExistingResistanceComponent[]
}

// ── Snapshot type definition ──
// Matches the full template structure stored as JSON in Adventure.templateSnapshot.
// Preserves original entity IDs for CharacterSheet FK backward compatibility.
export interface TemplateSnapshotAttribute {
  id: string; templateId: string; key: string; name: string; order: number
}

export interface TemplateSnapshotField {
  id: string; templateId: string; key: string; label: string; order: number
}

export interface TemplateSnapshotSkill {
  id: string; templateId: string; name: string; description: string | null;
  attributeId: string | null; allowedAttributeIds: string[];
  defaultAttributeId: string | null; order: number
}

export interface TemplateSnapshotProfileOption {
  id: string; profileId: string; label: string; value: number; order: number
}

export interface TemplateSnapshotModifierProfile {
  id: string; templateId: string; name: string; order: number;
  targetMode: string; targetSkillIds: string[];
  options: TemplateSnapshotProfileOption[]
}

export interface TemplateSnapshotCoreResource {
  id: string; templateId: string; slug: string; displayName: string;
  enabled: boolean; editableByPlayer: boolean; showNotes: boolean;
  color: string | null; order: number
}

export interface TemplateSnapshotAcAttributeModifier {
  id: string; armorClassId: string; attributeId: string;
  allowPlayerSelection: boolean; defaultAttributeId: string | null
}

export interface TemplateSnapshotAcField {
  id: string; armorClassId: string; name: string; key: string;
  defaultValue: string; editableByPlayer: boolean; description: string | null; order: number
}

export interface TemplateSnapshotArmorClass {
  id: string; templateId: string; name: string; enabled: boolean;
  attributeModifiers: TemplateSnapshotAcAttributeModifier[];
  fields: TemplateSnapshotAcField[]
}

export interface TemplateSnapshotCharacterSection {
  id: string; templateId: string; name: string; order: number
}

export interface TemplateSnapshotResistanceAttributeModifier {
  id: string; resistanceId: string; attributeId: string; enabled: boolean
}

export interface TemplateSnapshotResistanceComponent {
  id: string; resistanceId: string; name: string;
  editableByPlayer: boolean; defaultValue: string; order: number
}

export interface TemplateSnapshotResistance {
  id: string; templateId: string; name: string;
  calculationType: string; order: number;
  components: TemplateSnapshotResistanceComponent[];
  attributeModifiers: TemplateSnapshotResistanceAttributeModifier[]
}

export interface TemplateSnapshot {
  id: string; name: string; description: string | null;
  attributeModifierFormula: string | null;
  attributeModifiersEnabled: boolean; skillFormula: string | null;
  attributes: TemplateSnapshotAttribute[];
  templateFields: TemplateSnapshotField[];
  templateSkills: TemplateSnapshotSkill[];
  skillModifierProfiles: TemplateSnapshotModifierProfile[];
  coreResources: TemplateSnapshotCoreResource[];
  armorClasses: TemplateSnapshotArmorClass[];
  characterSections: TemplateSnapshotCharacterSection[];
  resistances: TemplateSnapshotResistance[];
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name)
  private readonly CACHE_TTL = 30 // seconds
  private readonly LIST_CACHE_TTL = 15 // seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly redis: RedisService,
    private readonly i18n: I18nService,
  ) {}

  private cacheKey(id: string): string {
    return `template:${id}`
  }

  private listCacheKey(adventureId: string): string {
    return `templates:adventure:${adventureId}`
  }

  private userListCacheKey(userId: string): string {
    return `templates:user:${userId}`
  }

  /** Invalidate cached templates for an adventure, user list, and optionally a specific template */
  private async invalidateCache(
    adventureId: string | null,
    templateId?: string,
    userId?: string,
  ): Promise<void> {
    try {
      if (templateId) {
        await this.redis.del(this.cacheKey(templateId))
      }
      if (adventureId) {
        await this.redis.del(this.listCacheKey(adventureId))
      }
      if (userId) {
        await this.redis.del(this.userListCacheKey(userId))
      }
    } catch (err) {
      this.logger.warn('Failed to invalidate template cache', err)
    }
  }

  /**
   * Invalidate all character-sheet caches that embed this template's data.
   * When a template is updated (e.g. new profile options added), each sheet's
   * Redis cache stores a stale snapshot of the template. Clearing those keys
   * forces the next sheet load to re-read from the database with fresh data.
   */
  private async invalidateSheetCaches(templateId: string): Promise<void> {
    try {
      const sheets = await this.prisma.characterSheet.findMany({
        where: { templateId },
        select: { id: true },
      })
      if (sheets.length > 0) {
        await this.redis.del(...sheets.map(s => `character-sheet:${s.id}`))
      }
    } catch (err) {
      this.logger.warn('Failed to invalidate character sheet caches', err)
    }
  }

  async create(adventureId: string, userId: string, dto: CreateTemplateDto) {
    await this.membership.requireWriteRole(adventureId, userId, 'GM')

    // Look up the adventure to check if it's public and set ownerId
    const adventure = await this.prisma.adventure.findUnique({ where: { id: adventureId } })
    if (!adventure) throw new NotFoundException(this.i18n.t('template.adventureNotFound'))

    // Enforce single template per campaign: reject if any template already exists
    // Check both templateSource (new field) and legacy indicators for backward compatibility
    if (adventure.templateSource || adventure.originalTemplateId || adventure.templateSnapshot) {
      throw new ConflictException(this.i18n.t('template.campaignHasTemplateDetachFirst'))
    }

    // Create the template with attributes and skills (initially without attribute links)
    const armorClasses = dto.armorClasses ?? []
    const created = await this.createTemplateRecord(adventureId, userId, dto, armorClasses)

    // ── Diagnostic: log core resources created ──
    this.logCreateDiagnostics(created)

    // Resolve attribute links (same pattern as createStandalone())
    const createdAttrs = await this.prisma.templateAttribute.findMany({ where: { templateId: created.id } })
    const attrKeyToId = new Map(createdAttrs.map(a => [a.key, a.id]))

    // Post-create: resolve and create AC attribute modifiers for each armor class
    await this.resolveCreatedAcAttributeModifiers(created.id, armorClasses, attrKeyToId)

    // Post-create: link skills to their attributes by resolving keys to IDs
    await this.linkCreatedSkillsToAttributes(created, dto.skills, attrKeyToId)

    // Set template source to 'campaign' since a campaign-owned template was created
    await this.prisma.adventure.update({
      where: { id: adventureId },
      data: { templateSource: 'campaign' },
    })

    // Invalidate list cache for this adventure
    await this.invalidateCache(adventureId, created.id)

    return this.prisma.template.findUnique({ where: { id: created.id }, include: templateInclude })
  }

  private async createTemplateRecord(adventureId: string, userId: string, dto: CreateTemplateDto, armorClasses: NonNullable<CreateTemplateDto['armorClasses']>) {
    return this.prisma.template.create({
      data: {
        adventureId, name: dto.name, description: dto.description ?? null,
        ownerId: userId,
        attributeModifiersEnabled: dto.attributeModifiersEnabled ?? true,
        attributeModifierFormula: dto.attributeModifierFormula ?? null,
        skillFormula: dto.skillFormula ?? null,
        attributes: {
          create: dto.attributes.map((attr, idx) => ({
            key: attr.key, name: attr.name, order: idx,
          })),
        },
        templateFields: {
          create: (dto.templateFields || []).map((f, idx) => ({
            key: f.key, label: f.label, order: idx,
          })),
        },
        templateSkills: {
          create: (dto.skills || []).map((s, idx) => ({
            name: s.name, description: s.description ?? null, order: idx,
            allowedAttributeIds: s.allowedAttributeIds ?? [],
            defaultAttributeId: null, // Set after attributes are created
          })),
        },
        skillModifierProfiles: {
          create: (dto.skillModifierProfiles || []).map((p, pIdx) => ({
            name: p.name,
            order: pIdx,
            targetMode: p.targetMode ?? 'ALL_SKILLS',
            targetSkillIds: p.targetSkillIds ?? [],
            options: {
              create: p.options.map((o, oIdx) => ({
                label: o.label,
                value: o.value,
                order: oIdx,
              })),
            },
          })),
        },
        coreResources: {
          create: (dto.coreResources || []).map((cr, crIdx) => ({
            slug: cr.slug.trim(),
            displayName: cr.displayName?.trim() ?? cr.slug.trim(),
            enabled: cr.enabled ?? true,
            editableByPlayer: cr.editableByPlayer ?? true,
            showNotes: cr.showNotes ?? true,
            color: cr.color ?? null,
            order: crIdx,
          })),
        },
        armorClasses: armorClasses.length > 0
          ? {
              create: armorClasses.filter(ac => ac.enabled).map(ac => ({
                name: ac.name ?? 'Armor Class',
                enabled: true,
                fields: {
                  create: (ac.fields || [])
                    .filter(f => (f.key?.trim() ?? '') !== '')
                    .map((f, fIdx) => ({
                    name: f.name,
                    key: f.key,
                    defaultValue: f.defaultValue ?? '0',
                    editableByPlayer: f.editableByPlayer ?? false,
                    description: f.description ?? null,
                    order: fIdx,
                  })),
                },
              })),
            }
          : undefined,
        characterSections: {
          create: (dto.characterSections || []).map((s, idx) => ({
            name: s.name.trim(),
            order: idx,
          })),
        },
        resistances: {
          create: (dto.resistances || []).map((r, rIdx) => ({
            name: r.name.trim(),
            calculationType: r.calculationType ?? 'MANUAL',
            order: rIdx,
            components: {
              create: (r.components || []).map((c, cIdx) => ({
                name: c.name.trim(),
                editableByPlayer: c.editableByPlayer ?? false,
                defaultValue: c.defaultValue ?? '0',
                order: cIdx,
              })),
            },
          })),
        },
      },
      include: templateInclude,
    })
  }

  private async createStandaloneRecord(userId: string, dto: CreateTemplateDto, createdFromTemplateId?: string) {
    return this.prisma.template.create({
      data: {
        adventureId: null,
        ownerId: userId,
        isPublic: dto.isPublic ?? false,
        useCount: 0,
        createdFromTemplateId: createdFromTemplateId ?? null,
        name: dto.name,
        description: dto.description ?? null,
        attributeModifiersEnabled: dto.attributeModifiersEnabled ?? true,
        attributeModifierFormula: dto.attributeModifierFormula ?? null,
        skillFormula: dto.skillFormula ?? null,
        attributes: {
          create: dto.attributes.map((attr, idx) => ({
            key: attr.key, name: attr.name, order: idx,
          })),
        },
        templateFields: {
          create: (dto.templateFields || []).map((f, idx) => ({
            key: f.key, label: f.label, order: idx,
          })),
        },
        templateSkills: {
          create: (dto.skills || []).map((s, idx) => ({
            name: s.name, description: s.description ?? null, order: idx,
            allowedAttributeIds: s.allowedAttributeIds ?? [],
            defaultAttributeId: null,
          })),
        },
        skillModifierProfiles: {
          create: (dto.skillModifierProfiles || []).map((p, pIdx) => ({
            name: p.name,
            order: pIdx,
            targetMode: p.targetMode ?? 'ALL_SKILLS',
            targetSkillIds: p.targetSkillIds ?? [],
            options: {
              create: p.options.map((o, oIdx) => ({
                label: o.label,
                value: o.value,
                order: oIdx,
              })),
            },
          })),
        },
        coreResources: {
          create: (dto.coreResources || []).map((cr, crIdx) => ({
            slug: cr.slug.trim(),
            displayName: cr.displayName?.trim() ?? cr.slug.trim(),
            enabled: cr.enabled ?? true,
            editableByPlayer: cr.editableByPlayer ?? true,
            showNotes: cr.showNotes ?? true,
            color: cr.color ?? null,
            order: crIdx,
          })),
        },
        armorClasses: (dto.armorClasses ?? []).length > 0
          ? {
              create: (dto.armorClasses ?? []).filter(ac => ac.enabled).map(ac => ({
                name: ac.name ?? 'Armor Class',
                enabled: true,
                fields: {
                  create: (ac.fields || [])
                    .filter(f => (f.key?.trim() ?? '') !== '')
                    .map((f, fIdx) => ({
                    name: f.name,
                    key: f.key,
                    defaultValue: f.defaultValue ?? '0',
                    editableByPlayer: f.editableByPlayer ?? false,
                    description: f.description ?? null,
                    order: fIdx,
                  })),
                },
              })),
            }
          : undefined,
        characterSections: {
          create: (dto.characterSections || []).map((s, idx) => ({
            name: s.name.trim(), order: idx,
          })),
        },
        resistances: {
          create: (dto.resistances || []).map((r, rIdx) => ({
            name: r.name.trim(),
            calculationType: r.calculationType ?? 'MANUAL',
            order: rIdx,
            components: {
              create: (r.components || []).map((c, cIdx) => ({
                name: c.name.trim(),
                editableByPlayer: c.editableByPlayer ?? false,
                defaultValue: c.defaultValue ?? '0',
                order: cIdx,
              })),
            },
          })),
        },
      },
      include: templateInclude,
    })
  }

  private logCreateDiagnostics(created: any) {
    const createdCrSlugs = created.coreResources?.map((cr: any) => ({
      slug: cr.slug,
      enabled: cr.enabled,
    })) ?? []
    const hasHpCoreResource = created.coreResources?.some(
      (cr: any) => cr.slug === 'hp' && cr.enabled,
    )
    this.logger.debug(
      `[DIAGNOSTIC] template.create: "${created.name}" | coreResources=${JSON.stringify(createdCrSlugs)} | hasHp=${hasHpCoreResource}`,
    )
    if (!hasHpCoreResource) {
      this.logger.warn(
        `[DIAGNOSTIC] template.create: "${created.name}" is MISSING enabled 'hp' core resource — NPC sheets will show 0/0! ` +
        `Add a core resource with slug='hp' and enabled=true via TemplateForm`,
      )
    }
  }

  private async resolveCreatedAcAttributeModifiers(createdId: string, armorClasses: NonNullable<CreateTemplateDto['armorClasses']>, attrKeyToId: Map<string, string>) {
    const createdAcs = await this.prisma.templateArmorClass.findMany({ where: { templateId: createdId }, orderBy: { createdAt: 'asc' } })
    for (const ac of armorClasses) {
      if (!ac.enabled || !ac.attributeModifiers?.length) continue
      const createdAc = createdAcs.find(c => c.name === (ac.name ?? 'Armor Class'))
      if (!createdAc) continue
      const resolvedModifiers = ac.attributeModifiers
        .map(am => {
          const resolvedAttrId = attrKeyToId.get(am.attributeId) ?? am.attributeId
          const resolvedDefaultId = am.defaultAttributeId ? (attrKeyToId.get(am.defaultAttributeId) ?? am.defaultAttributeId) : null
          return { attributeId: resolvedAttrId, allowPlayerSelection: am.allowPlayerSelection ?? false, defaultAttributeId: resolvedDefaultId }
        })
        .filter(am => am.attributeId)

      if (resolvedModifiers.length > 0) {
        await this.prisma.templateArmorClass.update({
          where: { id: createdAc.id },
          data: {
            attributeModifiers: {
              create: resolvedModifiers.map(am => ({
                attributeId: am.attributeId,
                allowPlayerSelection: am.allowPlayerSelection,
                defaultAttributeId: am.defaultAttributeId,
              })),
            },
          },
        })
      }
    }
  }

  private async linkCreatedSkillsToAttributes(created: any, skills: CreateTemplateDto['skills'], attrKeyToId: Map<string, string>) {
    if (!skills?.length) return
    for (const s of skills) {
      const skill = (created.templateSkills || []).find(sk => sk.name === s.name)
      if (!skill) continue

      const legacyAttrId = s.attributeId ? attrKeyToId.get(s.attributeId) ?? null : null
      const allowedIds = (s.allowedAttributeIds || []).map(k => attrKeyToId.get(k)).filter(Boolean) as string[]
      let effectiveAllowed: string[]
      if (allowedIds.length > 0) {
        effectiveAllowed = allowedIds
      } else if (legacyAttrId) {
        effectiveAllowed = [legacyAttrId]
      } else {
        effectiveAllowed = []
      }
      let defaultAttrId: string | null = null
      if (s.defaultAttributeId) {
        defaultAttrId = attrKeyToId.get(s.defaultAttributeId) ?? null
      } else if (effectiveAllowed.length > 0) {
        defaultAttrId = effectiveAllowed[0]
      }

      await this.prisma.templateSkill.update({
        where: { id: skill.id },
        data: {
          attributeId: legacyAttrId,
          allowedAttributeIds: effectiveAllowed,
          defaultAttributeId: defaultAttrId,
        },
      })
    }
  }

  async findAllByAdventure(adventureId: string, userId: string) {
    // Try cache first
    const cached = await this.redis.cacheGet<any[]>(this.listCacheKey(adventureId))
    if (cached) {
      const isMember = await this.membership.isMember(adventureId, userId)
      if (!isMember) throw new ForbiddenException(this.i18n.t('template.notMemberAdventure'))
      return cached
    }

    const templates = await this.prisma.template.findMany({
      where: { adventureId }, include: templateInclude, orderBy: { createdAt: 'desc' },
    })

    const isMember = await this.membership.isMember(adventureId, userId)
    if (!isMember) throw new ForbiddenException(this.i18n.t('template.notMemberAdventure'))

    // Cache the list
    await this.redis.cacheSet(this.listCacheKey(adventureId), templates, this.LIST_CACHE_TTL).catch(() => {})

    return templates
  }

  async findOne(id: string, userId: string) {
    // Try cache first
    const cached = await this.redis.cacheGet<any>(this.cacheKey(id))
    if (cached) {
      await this.ensureTemplateAccess(cached, userId)
      return cached
    }

    const template = await this.prisma.template.findUnique({ where: { id }, include: templateInclude })
    if (!template) throw new NotFoundException(this.i18n.t('template.notFound'))
    await this.ensureTemplateAccess(template, userId)

    // Cache the result (skip if Redis unavailable — cacheGet returns null gracefully)
    await this.redis.cacheSet(this.cacheKey(id), template, this.CACHE_TTL).catch(() => {})

    return template
  }

  /**
   * Auth check for template access: owner can always view; adventure members can view
   * if adventureId is set; public templates are visible to anyone.
   */
  private async ensureTemplateAccess(template: { ownerId: string | null; adventureId: string | null; isPublic: boolean }, userId: string): Promise<void> {
    // Owner always has access
    if (template.ownerId === userId) return
    // Public templates visible to anyone
    if (template.isPublic) return
    // Adventure members can view
    if (template.adventureId) {
      const isMember = await this.membership.isMember(template.adventureId, userId)
      if (isMember) return
    }
    throw new ForbiddenException(this.i18n.t('template.noAccess'))
  }

  async update(id: string, userId: string, dto: UpdateTemplateDto) {
    const template = await this.prisma.template.findUnique({ where: { id } })
    if (!template) throw new NotFoundException(this.i18n.t('template.notFound'))

    await this.assertCanUpdate(template, userId)
    this.assertCanChangeVisibility(dto.isPublic, template, userId)
    await this.applyNestedUpdates(id, dto)

    const result = await this.prisma.template.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.attributeModifiersEnabled !== undefined && { attributeModifiersEnabled: dto.attributeModifiersEnabled }),
        ...(dto.attributeModifierFormula !== undefined && { attributeModifierFormula: dto.attributeModifierFormula || null }),
        ...(dto.skillFormula !== undefined && { skillFormula: dto.skillFormula || null }),
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
      },
      include: templateInclude,
    })

    // Invalidate template caches and all character-sheet caches using this template
    await this.invalidateCache(template.adventureId, id, userId)
    await this.invalidateSheetCaches(id)

    return result
  }

  private async assertCanUpdate(template: { ownerId: string | null; adventureId: string | null }, userId: string): Promise<void> {
    // Owner OR GM of associated adventure can update
    if (template.ownerId !== userId) {
      if (template.adventureId) {
        await this.membership.requireWriteRole(template.adventureId, userId, 'GM')
      } else {
        throw new ForbiddenException(this.i18n.t('template.ownerOnlyUpdate'))
      }
    }
  }

  private assertCanChangeVisibility(isPublic: boolean | undefined, template: { ownerId: string | null }, userId: string): void {
    // Only the owner can change visibility (isPublic)
    if (isPublic !== undefined && template.ownerId !== userId) {
      throw new ForbiddenException(this.i18n.t('template.ownerOnlyVisibility'))
    }
  }

  private async applyNestedUpdates(id: string, dto: UpdateTemplateDto): Promise<void> {
    if (dto.attributes) {
      await this.updateAttributes(id, dto.attributes)
    }

    if (dto.templateFields) {
      await this.updateTemplateFields(id, dto.templateFields)
    }

    // Pre-fetch all attributes for key->id resolution (used by both skills and AC)
    const attrKeyToId = await this.resolveAttrKeyToId(id, dto)

    // Handle skills
    if (dto.skills) {
      await this.updateSkills(id, dto.skills, attrKeyToId)
    }

    // Handle skill modifier profiles
    if (dto.skillModifierProfiles) {
      await this.updateSkillModifierProfiles(id, dto.skillModifierProfiles)
    }

    // Handle Armor Classes (multi-AC)
    if (dto.armorClasses) {
      await this.updateArmorClasses(id, dto.armorClasses, attrKeyToId)
    }

    // Handle character sections
    if (dto.characterSections) {
      await this.updateCharacterSections(id, dto.characterSections)
    }

    // Handle core resources
    if (dto.coreResources) {
      await this.updateCoreResources(id, dto.coreResources)
    }

    // Handle resistances
    if (dto.resistances) {
      await this.updateResistances(id, dto.resistances)
    }
  }

  private async resolveAttrKeyToId(id: string, dto: UpdateTemplateDto): Promise<Map<string, string>> {
    const hasAcUpdates = dto.armorClasses?.some(ac => ac.attributeModifiers?.length)
    const allAttrs = dto.skills || hasAcUpdates
      ? await this.prisma.templateAttribute.findMany({ where: { templateId: id } })
      : []
    return new Map(allAttrs.map(a => [a.key, a.id]))
  }

  private async updateAttributes(id: string, attributes: NonNullable<UpdateTemplateDto['attributes']>) {
    const existingAttrs = await this.prisma.templateAttribute.findMany({ where: { templateId: id } })
    const newKeys = attributes.map(a => a.key.trim())
    const existingKeys = existingAttrs.map(a => a.key)
    const keysToDelete = existingKeys.filter(k => !newKeys.includes(k))
    if (keysToDelete.length) await this.prisma.templateAttribute.deleteMany({ where: { templateId: id, key: { in: keysToDelete } } })
    for (let idx = 0; idx < attributes.length; idx++) {
      const a = attributes[idx]; const key = a.key.trim()
      const existing = existingAttrs.find(e => e.key === key)
      if (existing) { await this.prisma.templateAttribute.update({ where: { id: existing.id }, data: { name: a.name.trim(), order: idx } }) }
      else { await this.prisma.templateAttribute.create({ data: { templateId: id, key, name: a.name.trim(), order: idx } }) }
    }
    const newAttrKeys = newKeys.filter(k => !existingKeys.includes(k))
    if (newAttrKeys.length > 0) {
      const newAttrs = await this.prisma.templateAttribute.findMany({ where: { templateId: id, key: { in: newAttrKeys } } })
      const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
      for (const sheet of sheets) for (const attr of newAttrs)
        await this.prisma.characterSheetValue.upsert({ where: { sheetId_attributeId: { sheetId: sheet.id, attributeId: attr.id } }, create: { sheetId: sheet.id, attributeId: attr.id, value: '' }, update: {} })
    }
  }

  private async updateTemplateFields(id: string, templateFields: NonNullable<UpdateTemplateDto['templateFields']>) {
    const existingFields = await this.prisma.templateField.findMany({ where: { templateId: id } })
    const newFieldKeys = templateFields.map(f => f.key.trim())
    const existingFieldKeys = existingFields.map(f => f.key)
    const fieldKeysToDelete = existingFieldKeys.filter(k => !newFieldKeys.includes(k))
    if (fieldKeysToDelete.length) await this.prisma.templateField.deleteMany({ where: { templateId: id, key: { in: fieldKeysToDelete } } })
    for (let idx = 0; idx < templateFields.length; idx++) {
      const f = templateFields[idx]; const key = f.key.trim()
      const existing = existingFields.find(e => e.key === key)
      if (existing) { await this.prisma.templateField.update({ where: { id: existing.id }, data: { label: f.label.trim(), order: idx } }) }
      else { await this.prisma.templateField.create({ data: { templateId: id, key, label: f.label.trim(), order: idx } }) }
    }
    const addedFieldKeys = newFieldKeys.filter(k => !existingFieldKeys.includes(k))
    if (addedFieldKeys.length > 0) {
      const newFields = await this.prisma.templateField.findMany({ where: { templateId: id, key: { in: addedFieldKeys } } })
      const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
      for (const sheet of sheets) for (const field of newFields)
        await this.prisma.characterSheetFieldValue.upsert({ where: { sheetId_templateFieldId: { sheetId: sheet.id, templateFieldId: field.id } }, create: { sheetId: sheet.id, templateFieldId: field.id, value: '' }, update: {} })
    }
  }

  private async updateSkills(id: string, skills: NonNullable<UpdateTemplateDto['skills']>, attrKeyToId: Map<string, string>) {
    const existingSkills = await this.prisma.templateSkill.findMany({ where: { templateId: id } })
    const newSkillNames = skills.map(s => s.name.trim())
    const existingSkillNames = existingSkills.map(s => s.name)
    const skillNamesToDelete = existingSkillNames.filter(n => !newSkillNames.includes(n))
    if (skillNamesToDelete.length) await this.prisma.templateSkill.deleteMany({ where: { templateId: id, name: { in: skillNamesToDelete } } })

    for (let idx = 0; idx < skills.length; idx++) {
      const s = skills[idx]; const name = s.name.trim()
      const existing = existingSkills.find(e => e.name === name)
      const { legacyAttrId, effectiveAllowed, defaultAttrId } = this.resolveSkillAttributeRefs(s, attrKeyToId)

      const data = {
        description: s.description ?? null,
        attributeId: legacyAttrId,
        allowedAttributeIds: effectiveAllowed,
        defaultAttributeId: defaultAttrId,
        order: idx,
      }

      if (existing) { await this.prisma.templateSkill.update({ where: { id: existing.id }, data }) }
      else { await this.prisma.templateSkill.create({ data: { templateId: id, name, ...data } }) }
    }
    const addedSkillNames = newSkillNames.filter(n => !existingSkillNames.includes(n))
    await this.syncAddedSkillValues(id, addedSkillNames)
  }

  private resolveSkillAttributeRefs(s: UpdateTemplateSkillDefDto, attrKeyToId: Map<string, string>) {
    const legacyAttrId = s.attributeId ? (attrKeyToId.get(s.attributeId) ?? null) : null
    const allowedIds = (s.allowedAttributeIds || []).map(k => attrKeyToId.get(k)).filter(Boolean) as string[]
    let effectiveAllowed: string[]
    if (allowedIds.length > 0) {
      effectiveAllowed = allowedIds
    } else if (legacyAttrId) {
      effectiveAllowed = [legacyAttrId]
    } else {
      effectiveAllowed = []
    }
    let defaultAttrId: string | null = null
    if (s.defaultAttributeId) {
      defaultAttrId = attrKeyToId.get(s.defaultAttributeId) ?? null
    } else if (effectiveAllowed.length > 0) {
      defaultAttrId = effectiveAllowed[0]
    }
    return { legacyAttrId, effectiveAllowed, defaultAttrId }
  }

  private async syncAddedSkillValues(id: string, addedSkillNames: string[]): Promise<void> {
    if (addedSkillNames.length > 0) {
      const newSkills = await this.prisma.templateSkill.findMany({ where: { templateId: id, name: { in: addedSkillNames } } })
      const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
      for (const sheet of sheets) for (const skill of newSkills)
        await this.prisma.characterSheetSkillValue.upsert({ where: { sheetId_skillId: { sheetId: sheet.id, skillId: skill.id } }, create: { sheetId: sheet.id, skillId: skill.id, value: '', selectedAttributeId: skill.defaultAttributeId }, update: {} })
    }
  }

  private async updateSkillModifierProfiles(id: string, profiles: NonNullable<UpdateTemplateDto['skillModifierProfiles']>) {
    const existingProfiles = await this.prisma.skillModifierProfile.findMany({
      where: { templateId: id },
      include: { options: true },
    })
    const newProfileNames = profiles.map(p => p.name.trim())
    const existingProfileNames = existingProfiles.map(p => p.name)
    const profileNamesToDelete = existingProfileNames.filter(n => !newProfileNames.includes(n))
    if (profileNamesToDelete.length) await this.prisma.skillModifierProfile.deleteMany({ where: { templateId: id, name: { in: profileNamesToDelete } } })
    for (let pIdx = 0; pIdx < profiles.length; pIdx++) {
      await this.upsertSkillModifierProfile(id, profiles[pIdx], pIdx, existingProfiles)
    }
    const addedProfileNames = newProfileNames.filter(n => !existingProfileNames.includes(n))
    await this.syncAddedSkillProfileValues(id, addedProfileNames)
  }

  private async upsertSkillModifierProfile(id: string, p: UpdateSkillModifierProfileDefDto, pIdx: number, existingProfiles: ExistingSkillModifierProfile[]): Promise<void> {
    const name = p.name.trim()
    const existing = existingProfiles.find(e => e.name === name)
    if (existing) {
      await this.prisma.skillModifierProfile.update({ where: { id: existing.id }, data: { name, order: pIdx, targetMode: p.targetMode ?? 'ALL_SKILLS', targetSkillIds: p.targetSkillIds ?? [] } })
      await this.syncProfileOptions(existing.id, existing.options, p.options)
    } else {
      await this.prisma.skillModifierProfile.create({ data: { templateId: id, name, order: pIdx, targetMode: p.targetMode ?? 'ALL_SKILLS', targetSkillIds: p.targetSkillIds ?? [], options: { create: p.options.map((o, oIdx) => ({ label: o.label.trim(), value: o.value, order: oIdx })) } } })
    }
  }

  private async syncProfileOptions(profileId: string, existingOptions: Array<{ id: string; label: string }>, options: UpdateProfileOptionDefDto[]): Promise<void> {
    const newOptionLabels = new Set(options.map(o => o.label.trim()))
    const existingOptionLabels = existingOptions.map(o => o.label)
    const labelsToDelete = existingOptionLabels.filter(l => !newOptionLabels.has(l))
    if (labelsToDelete.length) await this.prisma.profileOption.deleteMany({ where: { profileId, label: { in: labelsToDelete } } })
    for (let oIdx = 0; oIdx < options.length; oIdx++) {
      const o = options[oIdx]; const label = o.label.trim()
      const existingOpt = existingOptions.find(eo => eo.label === label)
      if (existingOpt) { await this.prisma.profileOption.update({ where: { id: existingOpt.id }, data: { value: o.value, order: oIdx } }) }
      else { await this.prisma.profileOption.create({ data: { profileId, label, value: o.value, order: oIdx } }) }
    }
  }

  private async syncAddedSkillProfileValues(id: string, addedProfileNames: string[]): Promise<void> {
    if (addedProfileNames.length === 0) return
    const newProfiles = await this.prisma.skillModifierProfile.findMany({ where: { templateId: id, name: { in: addedProfileNames } } })
    const skills = await this.prisma.templateSkill.findMany({ where: { templateId: id } })
    const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
    for (const sheet of sheets) for (const skill of skills) {
      const globalSkillFormula = (await this.prisma.template.findUnique({ where: { id }, select: { skillFormula: true } }))?.skillFormula
      if (!globalSkillFormula) continue
      await this.upsertSkillProfileValuesForSkill(sheet.id, skill, newProfiles, this.extractVariableNames(globalSkillFormula))
    }
  }

  private async upsertSkillProfileValuesForSkill(sheetId: string, skill: { id: string; name: string }, newProfiles: Array<{ id: string; name: string }>, formulaVars: string[]): Promise<void> {
    for (const profile of newProfiles) {
      if (!formulaVars.includes(profile.name)) continue
      const targetMode = (profile as any).targetMode ?? 'ALL_SKILLS'
      const targetSkillIds: string[] = (profile as any).targetSkillIds ?? []
      if (targetMode === 'SELECTED_SKILLS' && targetSkillIds.length > 0 && !targetSkillIds.includes(skill.name)) {
        continue
      }
      const firstOption = await this.prisma.profileOption.findFirst({ where: { profileId: profile.id }, orderBy: { order: 'asc' } })
      await this.prisma.characterSheetSkillProfileValue.upsert({ where: { sheetId_skillId_profileId: { sheetId: sheetId, skillId: skill.id, profileId: profile.id } }, create: { sheetId: sheetId, skillId: skill.id, profileId: profile.id, optionId: firstOption?.id ?? null }, update: {} })
    }
  }

  private async updateArmorClasses(id: string, armorClasses: NonNullable<UpdateTemplateDto['armorClasses']>, attrKeyToId: Map<string, string>) {
    const existingAcs = await this.prisma.templateArmorClass.findMany({
      where: { templateId: id },
      include: { fields: true },
    })

    // Delete ACs that are no longer in the list (match by name)
    const newAcNames = new Set(armorClasses.map(ac => ac.name?.trim() ?? 'Armor Class'))
    const acsToDelete = existingAcs.filter(ac => !newAcNames.has(ac.name))
    if (acsToDelete.length > 0) {
      await this.prisma.templateArmorClass.deleteMany({
        where: { id: { in: acsToDelete.map(ac => ac.id) } },
      })
    }

    for (const acDef of armorClasses) {
      await this.upsertArmorClass(id, acDef, existingAcs, attrKeyToId)
    }
  }

  private async upsertArmorClass(id: string, acDef: UpdateArmorClassDefDto, existingAcs: ExistingArmorClass[], attrKeyToId: Map<string, string>): Promise<void> {
    const acName = acDef.name?.trim() ?? 'Armor Class'
    const existingAC = existingAcs.find(ac => ac.name === acName)

    if (acDef.enabled === false) {
      if (existingAC) {
        await this.prisma.templateArmorClass.delete({ where: { id: existingAC.id } })
      }
      return
    }

    if (existingAC) {
      await this.updateExistingArmorClass(id, acDef, existingAC, attrKeyToId)
    } else {
      await this.createNewArmorClass(id, acDef, attrKeyToId)
    }
  }

  private async updateExistingArmorClass(id: string, acDef: UpdateArmorClassDefDto, existingAC: ExistingArmorClass, attrKeyToId: Map<string, string>): Promise<void> {
    // Update existing AC
    await this.prisma.templateArmorClass.update({
      where: { id: existingAC.id },
      data: {
        name: acDef.name?.trim() ?? 'Armor Class',
        ...(acDef.enabled !== undefined && { enabled: acDef.enabled }),
      },
    })

    // Handle attribute modifiers
    if (acDef.attributeModifiers) {
      await this.syncExistingArmorClassAttributeModifiers(id, existingAC.id, acDef.attributeModifiers, attrKeyToId)
    }

    // Handle fields
    if (acDef.fields) {
      await this.syncExistingArmorClassFields(id, acDef.fields, existingAC)
    }
  }

  private async syncExistingArmorClassAttributeModifiers(id: string, armorClassId: string, attributeModifiers: UpdateArmorClassAttributeModifierDefDto[], attrKeyToId: Map<string, string>): Promise<void> {
    await this.prisma.armorClassAttributeModifier.deleteMany({ where: { armorClassId } })
    const createdModifiers: string[] = []
    for (const am of attributeModifiers) {
      const resolvedAttrId = attrKeyToId.get(am.attributeId) ?? am.attributeId
      const resolvedDefaultId = am.defaultAttributeId ? (attrKeyToId.get(am.defaultAttributeId) ?? am.defaultAttributeId) : null
      if (!resolvedAttrId) continue
      const created = await this.prisma.armorClassAttributeModifier.create({
        data: {
          armorClassId,
          attributeId: resolvedAttrId,
          allowPlayerSelection: am.allowPlayerSelection ?? false,
          defaultAttributeId: resolvedDefaultId,
        },
      })
      createdModifiers.push(created.id)
    }
    // Auto-create acAttributeValues for existing sheets
    if (createdModifiers.length > 0) {
      const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
      for (const sheet of sheets) {
        for (const modId of createdModifiers) {
          await this.prisma.characterSheetArmorClassAttributeValue.upsert({
            where: { sheetId_acAttributeModifierId: { sheetId: sheet.id, acAttributeModifierId: modId } },
            create: { sheetId: sheet.id, acAttributeModifierId: modId, selectedAttributeId: null },
            update: {},
          })
        }
      }
    }
  }

  private async syncExistingArmorClassFields(id: string, fields: UpdateArmorClassFieldDefDto[], existingAC: ExistingArmorClass): Promise<void> {
    const existingFields = existingAC.fields
    const newFieldKeys = fields.map(f => f.key?.trim() ?? '')
    const existingFieldKeys = existingFields.map(f => f.key)
    const fieldKeysToDelete = existingFieldKeys.filter(k => !newFieldKeys.includes(k))
    if (fieldKeysToDelete.length) {
      await this.prisma.armorClassField.deleteMany({ where: { armorClassId: existingAC.id, key: { in: fieldKeysToDelete } } })
    }
    for (let fIdx = 0; fIdx < fields.length; fIdx++) {
      await this.upsertExistingArmorClassField(existingFields, existingAC.id, fields[fIdx], fIdx)
    }
    // Auto-create values for newly added AC fields on existing sheets
    await this.syncAddedArmorClassFieldValues(id, existingAC.id, existingFieldKeys, newFieldKeys)
  }

  private async upsertExistingArmorClassField(existingFields: Array<{ id: string; key: string }>, armorClassId: string, f: UpdateArmorClassFieldDefDto, fIdx: number): Promise<void> {
    const key = f.key?.trim() ?? ''
    if (!key) return
    const existingF = existingFields.find(ef => ef.key === key)
    if (existingF) {
      await this.prisma.armorClassField.update({
        where: { id: existingF.id },
        data: {
          ...(f.name !== undefined && { name: f.name }),
          ...(f.defaultValue !== undefined && { defaultValue: f.defaultValue }),
          ...(f.editableByPlayer !== undefined && { editableByPlayer: f.editableByPlayer }),
          ...(f.description !== undefined && { description: f.description || null }),
          order: fIdx,
        },
      })
    } else {
      await this.prisma.armorClassField.create({
        data: {
          armorClassId, key, name: f.name ?? key,
          defaultValue: f.defaultValue ?? '0',
          editableByPlayer: f.editableByPlayer ?? false,
          description: f.description ?? null,
          order: fIdx,
        },
      })
    }
  }

  private async syncAddedArmorClassFieldValues(id: string, armorClassId: string, existingFieldKeys: string[], newFieldKeys: string[]): Promise<void> {
    const addedFieldKeys = newFieldKeys.filter(k => !existingFieldKeys.includes(k) && k.length > 0)
    if (addedFieldKeys.length > 0) {
      const newFields = await this.prisma.armorClassField.findMany({ where: { armorClassId, key: { in: addedFieldKeys } } })
      const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
      for (const sheet of sheets) for (const field of newFields)
        await this.prisma.characterSheetArmorClassValue.upsert({
          where: { sheetId_fieldId: { sheetId: sheet.id, fieldId: field.id } },
          create: { sheetId: sheet.id, fieldId: field.id, value: field.defaultValue },
          update: {},
        })
    }
  }

  private resolveArmorClassAttributeModifiers(attributeModifiers: UpdateArmorClassAttributeModifierDefDto[] | undefined, attrKeyToId: Map<string, string>): Array<{ attributeId: string; allowPlayerSelection: boolean; defaultAttributeId: string | null }> {
    return (attributeModifiers || [])
      .map(am => {
        const resolvedAttrId = attrKeyToId.get(am.attributeId) ?? am.attributeId
        const resolvedDefaultId = am.defaultAttributeId ? (attrKeyToId.get(am.defaultAttributeId) ?? am.defaultAttributeId) : null
        return { attributeId: resolvedAttrId, allowPlayerSelection: am.allowPlayerSelection ?? false, defaultAttributeId: resolvedDefaultId }
      })
      .filter(am => am.attributeId)
  }

  private mapNewArmorClassFields(fields: UpdateArmorClassFieldDefDto[] | undefined): Array<{ name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string | null; order: number }> {
    return (fields || [])
      .filter(f => (f.key?.trim() ?? '') !== '')
      .map((f, fIdx) => ({
        name: f.name ?? f.key?.trim() ?? '',
        key: f.key?.trim() ?? '',
        defaultValue: f.defaultValue ?? '0',
        editableByPlayer: f.editableByPlayer ?? false,
        description: f.description ?? null,
        order: fIdx,
      }))
  }

  private async createNewArmorClass(id: string, acDef: UpdateArmorClassDefDto, attrKeyToId: Map<string, string>): Promise<void> {
    const acName = acDef.name?.trim() ?? 'Armor Class'
    const resolvedModifiers = this.resolveArmorClassAttributeModifiers(acDef.attributeModifiers, attrKeyToId)

    const newAC = await this.prisma.templateArmorClass.create({
      data: {
        templateId: id,
        name: acName,
        enabled: acDef.enabled ?? true,
        attributeModifiers: resolvedModifiers.length > 0
          ? {
              create: resolvedModifiers.map(am => ({
                attributeId: am.attributeId,
                allowPlayerSelection: am.allowPlayerSelection,
                defaultAttributeId: am.defaultAttributeId,
              })),
            }
          : undefined,
        fields: {
          create: this.mapNewArmorClassFields(acDef.fields),
        },
      },
    })

    // Auto-create values for new AC on existing sheets
    await this.syncNewArmorClassFieldValues(id, newAC.id, acDef.fields)
    await this.syncNewArmorClassModifierValues(id, newAC.id, resolvedModifiers)
  }

  private async syncNewArmorClassFieldValues(id: string, newAcId: string, fields: UpdateArmorClassFieldDefDto[] | undefined): Promise<void> {
    if (!fields || fields.length === 0) return
    const newFields = await this.prisma.armorClassField.findMany({ where: { armorClassId: newAcId } })
    const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
    for (const sheet of sheets) {
      for (const field of newFields) {
        await this.prisma.characterSheetArmorClassValue.upsert({
          where: { sheetId_fieldId: { sheetId: sheet.id, fieldId: field.id } },
          create: { sheetId: sheet.id, fieldId: field.id, value: field.defaultValue },
          update: {},
        })
      }
    }
  }

  private async syncNewArmorClassModifierValues(id: string, newAcId: string, resolvedModifiers: Array<{ attributeId: string; allowPlayerSelection: boolean; defaultAttributeId: string | null }>): Promise<void> {
    if (resolvedModifiers.length === 0) return
    const newModifiers = await this.prisma.armorClassAttributeModifier.findMany({ where: { armorClassId: newAcId } })
    const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
    for (const sheet of sheets) {
      for (const mod of newModifiers) {
        await this.prisma.characterSheetArmorClassAttributeValue.upsert({
          where: { sheetId_acAttributeModifierId: { sheetId: sheet.id, acAttributeModifierId: mod.id } },
          create: { sheetId: sheet.id, acAttributeModifierId: mod.id, selectedAttributeId: null },
          update: {},
        })
      }
    }
  }

  private async updateCharacterSections(id: string, characterSections: NonNullable<UpdateTemplateDto['characterSections']>) {
    const existingSections = await this.prisma.templateCharacterSection.findMany({
      where: { templateId: id },
    })
    const existingIds = existingSections.map(e => e.id)
    const keptIds = new Set<string>()
    for (let idx = 0; idx < characterSections.length; idx++) {
      const s = characterSections[idx]; const name = s.name.trim()
      if (!name) continue
      let existing: typeof existingSections[number] | undefined
      if (s.id) {
        existing = existingSections.find(e => e.id === s.id)
      }
      existing ??= existingSections.find(e => e.name === name)
      if (existing) {
        keptIds.add(existing.id)
        await this.prisma.templateCharacterSection.update({
          where: { id: existing.id },
          data: { name, order: idx },
        })
      } else {
        const created = await this.prisma.templateCharacterSection.create({
          data: { templateId: id, name, order: idx },
        })
        keptIds.add(created.id)
      }
    }
    const idsToDelete = existingIds.filter(eid => !keptIds.has(eid))
    if (idsToDelete.length) {
      await this.prisma.templateCharacterSection.deleteMany({ where: { id: { in: idsToDelete } } })
    }
  }

  private async updateCoreResources(id: string, coreResources: NonNullable<UpdateTemplateDto['coreResources']>) {
    const existingResources = await this.prisma.templateCoreResource.findMany({
      where: { templateId: id },
    })
    const newSlugs = new Set(coreResources.map(cr => cr.slug?.trim() ?? '').filter(Boolean))
    const existingSlugs = existingResources.map(cr => cr.slug)
    const slugsToDelete = existingSlugs.filter(s => !newSlugs.has(s))
    if (slugsToDelete.length) {
      await this.prisma.templateCoreResource.deleteMany({ where: { templateId: id, slug: { in: slugsToDelete } } })
    }

    for (let crIdx = 0; crIdx < coreResources.length; crIdx++) {
      const cr = coreResources[crIdx]
      const slug = (cr.slug ?? '').trim()
      if (!slug) continue
      const existing = existingResources.find(e => e.slug === slug)

      if (existing) {
        await this.prisma.templateCoreResource.update({
          where: { id: existing.id },
          data: {
            ...(cr.displayName !== undefined && { displayName: cr.displayName.trim() }),
            ...(cr.enabled !== undefined && { enabled: cr.enabled }),
            ...(cr.editableByPlayer !== undefined && { editableByPlayer: cr.editableByPlayer }),
            ...(cr.showNotes !== undefined && { showNotes: cr.showNotes }),
            ...(cr.color !== undefined && { color: cr.color }),
            order: crIdx,
          },
        })
      } else {
        const newResource = await this.prisma.templateCoreResource.create({
          data: {
            templateId: id,
            slug,
            displayName: cr.displayName?.trim() ?? slug,
            enabled: cr.enabled ?? true,
            editableByPlayer: cr.editableByPlayer ?? true,
            showNotes: cr.showNotes ?? true,
            color: cr.color ?? null,
            order: crIdx,
          },
        })
        const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
        for (const sheet of sheets) {
          await this.prisma.characterSheetCoreResourceValue.upsert({
            where: { sheetId_coreResourceId: { sheetId: sheet.id, coreResourceId: newResource.id } },
            create: { sheetId: sheet.id, coreResourceId: newResource.id },
            update: {},
          })
        }
      }
    }
  }

  private async updateResistances(id: string, resistances: NonNullable<UpdateTemplateDto['resistances']>) {
    const existingResistances = await this.prisma.templateResistance.findMany({
      where: { templateId: id },
      include: { components: true, attributeModifiers: true },
    })
    const existingResistanceIds = existingResistances.map(r => r.id)
    const keptResistanceIds = new Set<string>()

    for (let rIdx = 0; rIdx < resistances.length; rIdx++) {
      const r = resistances[rIdx]
      const name = r.name?.trim()
      if (!name) continue

      const existing = this.findExistingResistance(existingResistances, keptResistanceIds, r)
      if (existing) {
        keptResistanceIds.add(existing.id)
        await this.upsertResistance(id, existing, r, rIdx, name)
      } else {
        const newResistance = await this.createResistance(id, r, rIdx, name)
        keptResistanceIds.add(newResistance.id)
      }
    }

    const resistanceIdsToDelete = existingResistanceIds.filter(id => !keptResistanceIds.has(id))
    if (resistanceIdsToDelete.length) {
      await this.prisma.templateResistance.deleteMany({ where: { id: { in: resistanceIdsToDelete } } })
    }
  }

  private findExistingResistance(existingResistances: ExistingResistance[], keptResistanceIds: Set<string>, r: UpdateResistanceDefDto): ExistingResistance | undefined {
    if (r.id) {
      const byId = existingResistances.find(e => e.id === r.id)
      if (byId) return byId
    }
    return existingResistances.find(e => !keptResistanceIds.has(e.id))
  }

  private async upsertResistance(id: string, existing: ExistingResistance, r: UpdateResistanceDefDto, rIdx: number, name: string): Promise<void> {
    await this.prisma.templateResistance.update({
      where: { id: existing.id },
      data: {
        ...(r.name !== undefined && { name }),
        ...(r.calculationType !== undefined && { calculationType: r.calculationType }),
        order: rIdx,
      },
    })

    if (r.components) {
      await this.syncResistanceComponents(id, existing.id, existing.components, r.components)
    }

    if (r.attributeModifiers) {
      await this.syncResistanceAttributeModifiers(existing.id, r.attributeModifiers)
    }
  }

  private async syncResistanceComponents(id: string, resistanceId: string, existingComps: ExistingResistanceComponent[], components: UpdateResistanceComponentDefDto[]): Promise<void> {
    const keptCompIds = new Set<string>()
    for (let cIdx = 0; cIdx < components.length; cIdx++) {
      const c = components[cIdx]
      const compName = c.name?.trim()
      if (!compName) continue
      const existingComp = this.findFreeResistanceComponent(existingComps, keptCompIds, c)
      if (existingComp) {
        keptCompIds.add(existingComp.id)
        await this.updateExistingResistanceComponent(existingComp.id, c, compName, cIdx)
      } else {
        const newComp = await this.createResistanceComponent(resistanceId, c, compName, cIdx)
        keptCompIds.add(newComp.id)
        await this.syncNewComponentSheetValues(id, newComp.id, newComp.defaultValue)
      }
    }
    const compIdsToDelete = existingComps.filter(ec => !keptCompIds.has(ec.id)).map(ec => ec.id)
    if (compIdsToDelete.length) {
      await this.prisma.resistanceComponent.deleteMany({ where: { id: { in: compIdsToDelete } } })
    }
  }

  private findFreeResistanceComponent(existingComps: ExistingResistanceComponent[], keptCompIds: Set<string>, c: UpdateResistanceComponentDefDto): ExistingResistanceComponent | undefined {
    if (c.id) {
      const byId = existingComps.find(ec => ec.id === c.id)
      if (byId) return byId
    }
    return existingComps.find(ec => !keptCompIds.has(ec.id))
  }

  private async updateExistingResistanceComponent(id: string, c: UpdateResistanceComponentDefDto, compName: string, cIdx: number): Promise<void> {
    await this.prisma.resistanceComponent.update({
      where: { id },
      data: {
        ...(c.name !== undefined && { name: compName }),
        ...(c.editableByPlayer !== undefined && { editableByPlayer: c.editableByPlayer }),
        ...(c.defaultValue !== undefined && { defaultValue: c.defaultValue }),
        order: cIdx,
      },
    })
  }

  private async createResistanceComponent(resistanceId: string, c: UpdateResistanceComponentDefDto, compName: string, cIdx: number): Promise<{ id: string; defaultValue: string }> {
    return this.prisma.resistanceComponent.create({
      data: {
        resistanceId,
        name: compName,
        editableByPlayer: c.editableByPlayer ?? false,
        defaultValue: c.defaultValue ?? '0',
        order: cIdx,
      },
    })
  }

  private async syncNewComponentSheetValues(id: string, componentId: string, defaultValue: string): Promise<void> {
    const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
    for (const sheet of sheets) {
      await this.prisma.characterSheetResistanceComponentValue.upsert({
        where: { sheetId_componentId: { sheetId: sheet.id, componentId } },
        create: { sheetId: sheet.id, componentId, value: defaultValue },
        update: {},
      })
    }
  }

  private async syncResistanceAttributeModifiers(resistanceId: string, attributeModifiers: UpdateResistanceAttributeModifierDefDto[]): Promise<void> {
    await this.prisma.resistanceAttributeModifier.deleteMany({ where: { resistanceId } })
    for (const am of attributeModifiers) {
      await this.prisma.resistanceAttributeModifier.create({
        data: {
          resistanceId,
          attributeId: am.attributeId,
          enabled: am.enabled ?? true,
        },
      })
    }
  }

  private async createResistance(id: string, r: UpdateResistanceDefDto, rIdx: number, name: string): Promise<{ id: string }> {
    const newResistance = await this.prisma.templateResistance.create({
      data: {
        templateId: id,
        name,
        calculationType: r.calculationType ?? 'MANUAL',
        order: rIdx,
        components: {
          create: (r.components || []).map((c, cIdx) => ({
            name: c.name?.trim() ?? '',
            editableByPlayer: c.editableByPlayer ?? false,
            defaultValue: c.defaultValue ?? '0',
            order: cIdx,
          })),
        },
      },
    })

    if (r.attributeModifiers) {
      await this.syncResistanceAttributeModifiers(newResistance.id, r.attributeModifiers)
    }

    const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
    for (const sheet of sheets) {
      await this.prisma.characterSheetResistanceValue.upsert({
        where: { sheetId_resistanceId: { sheetId: sheet.id, resistanceId: newResistance.id } },
        create: { sheetId: sheet.id, resistanceId: newResistance.id },
        update: {},
      })
      const newComps = await this.prisma.resistanceComponent.findMany({ where: { resistanceId: newResistance.id } })
      for (const comp of newComps) {
        await this.prisma.characterSheetResistanceComponentValue.upsert({
          where: { sheetId_componentId: { sheetId: sheet.id, componentId: comp.id } },
          create: { sheetId: sheet.id, componentId: comp.id, value: comp.defaultValue },
          update: {},
        })
      }
    }
    return newResistance
  }

  async remove(id: string, userId: string) {
    const template = await this.prisma.template.findUnique({ where: { id } })
    if (!template) throw new NotFoundException(this.i18n.t('template.notFound'))

    // Owner OR GM of associated adventure can delete
    if (template.ownerId !== userId) {
      if (template.adventureId) {
        await this.membership.requireWriteRole(template.adventureId, userId, 'GM')
      } else {
        throw new ForbiddenException(this.i18n.t('template.ownerOnlyDelete'))
      }
    }

    // Block deletion if character sheets reference this template
    const sheetCount = await this.prisma.characterSheet.count({ where: { templateId: id } })
    if (sheetCount > 0) {
      throw new ForbiddenException(
        this.i18n.t('template.deleteInUse', { args: { sheetCount } }),
      )
    }

    // Invalidate sheet caches before cascade delete clears the DB records
    await this.invalidateSheetCaches(id)

    const result = await this.prisma.template.delete({ where: { id } })

    // If this was a campaign-owned template, update templateSource if no more remain
    if (template.adventureId) {
      const remaining = await this.prisma.template.count({
        where: { adventureId: template.adventureId },
      })
      if (remaining === 0) {
        await this.prisma.adventure.update({
          where: { id: template.adventureId },
          data: { templateSource: null },
        })
      }
    }

    // Invalidate template caches
    await this.invalidateCache(template.adventureId, id, userId)

    return result
  }

  /**
   * Clone a template as a standalone copy into the user's template library.
   * Copies all relations: attributes, fields, skills, profiles, core resources,
   * armor classes, character sections, and resistances.
   *
   * Auth: public templates can be cloned by any authenticated user;
   * otherwise owner can always clone, and adventure GM can clone.
   */
  async clone(id: string, userId: string, newName?: string) {
    const original = await this.prisma.template.findUnique({
      where: { id },
      include: templateInclude,
    })
    if (!original) throw new NotFoundException(this.i18n.t('template.notFound'))

    // Auth: owner can always clone; anyone can clone public; GM of adventure can clone
    if (original.ownerId !== userId && !original.isPublic) {
      if (original.adventureId) {
        await this.membership.requireWriteRole(original.adventureId, userId, 'GM')
      } else {
        throw new ForbiddenException(this.i18n.t('template.noClonePermission'))
      }
    }

    // Reconstruct the DTO from the existing template data for deep copy
    const dto: CreateTemplateDto = {
      name: newName ?? `${original.name} (copy)`,
      description: original.description ?? undefined,
      attributeModifiersEnabled: original.attributeModifiersEnabled,
      attributeModifierFormula: original.attributeModifierFormula ?? undefined,
      skillFormula: original.skillFormula ?? undefined,
      attributes: (original.attributes ?? []).map(a => ({ key: a.key, name: a.name })),
      templateFields: (original.templateFields ?? []).map(f => ({ key: f.key, label: f.label })),
      skills: (original.templateSkills ?? []).map(s => ({
        name: s.name,
        description: s.description ?? undefined,
        attributeId: s.attributeId ?? undefined,
        allowedAttributeIds: (s.allowedAttributeIds ?? []) as string[],
        defaultAttributeId: s.defaultAttributeId ?? undefined,
      })),
      skillModifierProfiles: (original.skillModifierProfiles ?? []).map(p => ({
        name: p.name,
        targetMode: p.targetMode,
        targetSkillIds: p.targetSkillIds as string[],
        options: (p.options ?? []).map(o => ({ label: o.label, value: o.value })),
      })),
      coreResources: (original.coreResources ?? []).map(cr => ({
        slug: cr.slug,
        displayName: cr.displayName,
        enabled: cr.enabled,
        editableByPlayer: cr.editableByPlayer,
        showNotes: cr.showNotes,
        color: cr.color ?? undefined,
      })),
      armorClasses: (original.armorClasses ?? []).map(ac => ({
        name: ac.name,
        enabled: ac.enabled,
        attributeModifiers: (ac.attributeModifiers ?? []).map(am => ({
          attributeId: am.attributeId,
          allowPlayerSelection: am.allowPlayerSelection,
          defaultAttributeId: am.defaultAttributeId ?? undefined,
        })),
        fields: (ac.fields ?? []).map((f: any) => ({
          name: f.name,
          key: f.key,
          defaultValue: f.defaultValue,
          editableByPlayer: f.editableByPlayer,
          description: f.description ?? undefined,
        })),
      })),
      characterSections: (original.characterSections ?? []).map(s => ({ name: s.name })),
      resistances: (original.resistances ?? []).map(r => ({
        name: r.name,
        calculationType: r.calculationType,
        components: (r.components ?? []).map(c => ({
          name: c.name,
          editableByPlayer: c.editableByPlayer,
          defaultValue: c.defaultValue,
        })),
      })),
    }

    // Create the clone — track which template it was created from
    const result = await this.createStandalone(userId, dto, original.id)

    // If cloning a public template, increment useCount on the original for analytics
    if (original.isPublic) {
      await this.prisma.template.update({
        where: { id: original.id },
        data: { useCount: { increment: 1 } },
      }).catch(() => {
        // Non-critical analytics — don't fail the clone if this errors
      })
    }

    return result
  }

  /**
   * Find all public templates (using the standalone isPublic flag).
   * No auth required.
   */
  async findPublicAll(params: {
    page?: number
    limit?: number
    adventureId?: string
    campaign?: string
    search?: string
  }) {
    const page = params.page ?? 1
    const limit = params.limit ?? 10
    const skip = (page - 1) * limit

    // Route to the ranked (raw-SQL) path only when there is at least one real
    // search token; whitespace-only queries fall back to the plain listing.
    const search = params.search
    const hasSearch = search
      ? splitSearchTokens(search).length > 0
      : false

    const { rows, total } = hasSearch && search
      ? await this.findPublicAllRanked({ ...params, search, page, limit, skip })
      : await this.findPublicAllPlain({ ...params, page, limit, skip })

    const data = rows.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      useCount: t.useCount,
      adventure: t.adventure,
      owner: t.owner,
      _count: t._count,
      // Top-level convenience fields (nested `adventure` kept for compat).
      campaign: t.adventure?.campaign ?? null,
      adventureName: t.adventure?.name ?? null,
      adventureId: t.adventure?.id ?? null,
    }))

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Plain listing path — no meaningful search term. Same filters and select as
   * the ranked path, but lets Prisma do the ordering and pagination.
   */
  private async findPublicAllPlain(params: {
    page: number
    limit: number
    skip: number
    adventureId?: string
    campaign?: string
  }) {
    const where: any = {
      isPublic: true,
    }

    if (params.adventureId) {
      where.adventureId = params.adventureId
    }

    if (params.campaign) {
      where.adventure = { is: { campaign: params.campaign } }
    }

    const [templates, total] = await this.prisma.$transaction([
      this.prisma.template.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          useCount: true,
          adventure: { select: { id: true, name: true, campaign: true } },
          owner: { select: { id: true, displayName: true } },
          _count: { select: { attributes: true, templateSkills: true } },
        },
      }),
      this.prisma.template.count({ where }),
    ])

    return { rows: templates, total }
  }

  /**
   * Ranked search path. Finds and orders matching IDs entirely in SQL —
   * accent- and case-insensitive, tokenized, ranked by name-match quality —
   * then hydrates full rows with a normal Prisma findMany and reorders them
   * to the SQL order so relevance ranking survives pagination.
   */
  private async findPublicAllRanked(params: {
    page: number
    limit: number
    skip: number
    adventureId?: string
    campaign?: string
    search: string
  }) {
    const { limit, skip } = params
    const tokens = splitSearchTokens(params.search).map((t) => escapeLike(t))

    // Per-token score: exact name > name prefix > name substring > other fields.
    const scoreParts = tokens.map((tok) =>
      Prisma.sql`CASE WHEN search_norm(t."name") = search_norm(${tok}) THEN 0 WHEN search_norm(t."name") LIKE (search_norm(${tok}) || '%') THEN 1 WHEN search_norm(t."name") LIKE ('%' || search_norm(${tok}) || '%') THEN 2 ELSE 3 END`,
    )

    // Per-token filter: the token must appear in at least one searchable field.
    const tokenClauses = tokens.map((tok) =>
      Prisma.sql`(
        search_norm(t."name") = search_norm(${tok})
        OR search_norm(t."name") LIKE (search_norm(${tok}) || '%')
        OR search_norm(t."name") LIKE ('%' || search_norm(${tok}) || '%')
        OR search_norm(COALESCE(t."description", '')) LIKE ('%' || search_norm(${tok}) || '%')
        OR search_norm(COALESCE(owner."displayName", '')) LIKE ('%' || search_norm(${tok}) || '%')
        OR search_norm(COALESCE(adv."campaign", '')) LIKE ('%' || search_norm(${tok}) || '%')
      )`,
    )

    const ands: Prisma.Sql[] = [Prisma.sql`t."isPublic" = true`]

    if (params.adventureId) {
      ands.push(Prisma.sql`t."adventureId" = ${params.adventureId}`)
    }
    if (params.campaign) {
      ands.push(Prisma.sql`adv."campaign" = ${params.campaign}`)
    }

    const query = Prisma.sql`
      WITH matched AS (
        SELECT t."id" AS id, t."createdAt" AS created_at,
          (${Prisma.join(scoreParts, ' + ')}) AS score
        FROM "Template" t
        LEFT JOIN "Adventure" adv ON adv."id" = t."adventureId"
        LEFT JOIN "User" owner ON owner."id" = t."ownerId"
        WHERE ${Prisma.join(ands, ' AND ')}
          AND (${Prisma.join(tokenClauses, ' AND ')})
      ),
      ordered AS (
        SELECT id, created_at, score,
          ROW_NUMBER() OVER (ORDER BY score ASC, created_at DESC) AS rn
        FROM matched
      )
      SELECT
        (SELECT COUNT(*)::int FROM matched) AS total,
        COALESCE(
          (SELECT jsonb_agg(id ORDER BY rn) FROM ordered WHERE rn > ${skip} AND rn <= ${skip + limit}),
          '[]'::jsonb
        ) AS ids
    `

    const [result] = await this.prisma.$queryRaw<
      { total: number; ids: string[] | null }[]
    >(query)

    const total = result?.total ?? 0
    const ids = result?.ids ?? []

    if (ids.length === 0) {
      return { rows: [], total }
    }

    const templates = await this.prisma.template.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        useCount: true,
        adventure: { select: { id: true, name: true, campaign: true } },
        owner: { select: { id: true, displayName: true } },
        _count: { select: { attributes: true, templateSkills: true } },
      },
    })

    const byId = new Map(templates.map((t) => [t.id, t] as const))
    const rows = ids
      .map((id) => byId.get(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))

    return { rows, total }
  }

  /**
   * Find a single public template by ID (using standalone isPublic flag).
   * No auth required.
   */
  async findOnePublic(id: string) {
    const template = await this.prisma.template.findFirst({
      where: {
        id,
        isPublic: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        attributeModifiersEnabled: true,
        attributeModifierFormula: true,
        skillFormula: true,
        createdAt: true,
        adventure: { select: { id: true, name: true, campaign: true } },
        owner: { select: { id: true, displayName: true } },
        _count: { select: { characterSheets: true } },
        attributes: { orderBy: { order: 'asc' as const }, select: { id: true, key: true, name: true } },
        templateFields: { orderBy: { order: 'asc' as const }, select: { id: true, key: true, label: true } },
        templateSkills: {
          orderBy: { order: 'asc' as const },
          select: {
            id: true, name: true, description: true,
            attributeId: true,
            allowedAttributeIds: true,
            defaultAttributeId: true,
            attribute: { select: { id: true, key: true, name: true } },
            defaultAttribute: { select: { id: true, key: true, name: true } },
          },
        },
        skillModifierProfiles: {
          orderBy: { order: 'asc' as const },
          select: {
            id: true, name: true, targetMode: true, targetSkillIds: true,
            options: { orderBy: { order: 'asc' as const }, select: { id: true, label: true, value: true } },
          },
        },
        coreResources: { orderBy: { order: 'asc' as const }, select: { id: true, slug: true, displayName: true, enabled: true, editableByPlayer: true, showNotes: true, color: true } },
        armorClasses: {
          orderBy: { createdAt: 'asc' as const },
          select: {
            id: true, name: true, enabled: true,
            attributeModifiers: {
              orderBy: { createdAt: 'asc' as const },
              select: {
                id: true, attributeId: true, allowPlayerSelection: true, defaultAttributeId: true,
                attribute: { select: { id: true, key: true, name: true } },
                defaultAttribute: { select: { id: true, key: true, name: true } },
              },
            },
            fields: { orderBy: { order: 'asc' as const }, select: { id: true, name: true, key: true, defaultValue: true, editableByPlayer: true, description: true } },
          },
        },
        characterSections: { orderBy: { order: 'asc' as const }, select: { id: true, name: true } },
        resistances: {
          orderBy: { order: 'asc' as const },
          select: {
            id: true, name: true, calculationType: true,
            components: { orderBy: { order: 'asc' as const }, select: { id: true, name: true, editableByPlayer: true, defaultValue: true } },
            attributeModifiers: { select: { id: true, attributeId: true, enabled: true } },
          },
        },
      },
    })

    if (!template) {
      throw new NotFoundException(this.i18n.t('template.notFoundOrNotPublic'))
    }

    return template
  }

  // ── New methods for standalone template decoupling ──

  /**
   * Create a standalone template (no adventure context).
   * The template is owned by the creating user and is not public by default.
   */
  async createStandalone(userId: string, dto: CreateTemplateDto, createdFromTemplateId?: string) {
    const created = await this.createStandaloneRecord(userId, dto, createdFromTemplateId)

    // Resolve attribute links (same pattern as create())
    const createdAttrs = await this.prisma.templateAttribute.findMany({ where: { templateId: created.id } })
    const attrKeyToId = new Map(createdAttrs.map(a => [a.key, a.id]))

    // Resolve AC attribute modifiers
    await this.resolveCreatedAcAttributeModifiers(created.id, dto.armorClasses ?? [], attrKeyToId)

    // Post-create: link skills to their attributes
    await this.linkCreatedSkillsToAttributes(created, dto.skills, attrKeyToId)

    // Invalidate user list cache
    await this.invalidateCache(null, created.id, userId)

    return this.prisma.template.findUnique({ where: { id: created.id }, include: templateInclude })
  }

  /**
   * Find all templates owned by a user.
   * Results are cached with a 15-second TTL per user.
   */
  async findAllByUser(userId: string) {
    // Try cache first
    const cached = await this.redis.cacheGet<any[]>(this.userListCacheKey(userId))
    if (cached) {
      return cached
    }

    const templates = await this.prisma.template.findMany({
      where: { ownerId: userId },
      include: {
        ...templateInclude,
        // Summary counts for the picker rows / library cards.
        _count: { select: { attributes: true, templateSkills: true } },
        // Campaign info for the picker's system tag.
        adventure: { select: { id: true, name: true, campaign: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Top-level convenience fields (nested `adventure` kept for compat), same
    // shape the public listing exposes. Cache the mapped result so cache hits
    // return the same fields as cache misses.
    const mapped = templates.map((t: any) => ({
      ...t,
      campaign: t.adventure?.campaign ?? null,
      adventureName: t.adventure?.name ?? null,
      adventureId: t.adventure?.id ?? null,
    }))

    // Cache the list
    await this.redis.cacheSet(this.userListCacheKey(userId), mapped, this.LIST_CACHE_TTL).catch(() => {})

    return mapped
  }

  /**
   * Build an immutable snapshot (deep clone) from a fully-included template.
   * The snapshot preserves original entity IDs for CharacterSheet FK backward compat.
   * Used when attaching a template to an adventure.
   */
  async buildSnapshot(template: any): Promise<TemplateSnapshot> {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      attributeModifierFormula: template.attributeModifierFormula,
      attributeModifiersEnabled: template.attributeModifiersEnabled,
      skillFormula: template.skillFormula,
      attributes: (template.attributes ?? []).map((a: any) => ({
        id: a.id, templateId: a.templateId, key: a.key, name: a.name, order: a.order,
      })),
      templateFields: (template.templateFields ?? []).map((f: any) => ({
        id: f.id, templateId: f.templateId, key: f.key, label: f.label, order: f.order,
      })),
      templateSkills: (template.templateSkills ?? []).map((s: any) => ({
        id: s.id, templateId: s.templateId, name: s.name, description: s.description,
        attributeId: s.attributeId, allowedAttributeIds: s.allowedAttributeIds ?? [],
        defaultAttributeId: s.defaultAttributeId, order: s.order,
      })),
      skillModifierProfiles: (template.skillModifierProfiles ?? []).map((p: any) => ({
        id: p.id, templateId: p.templateId, name: p.name, order: p.order,
        targetMode: p.targetMode, targetSkillIds: p.targetSkillIds ?? [],
        options: (p.options ?? []).map((o: any) => ({
          id: o.id, profileId: o.profileId, label: o.label, value: o.value, order: o.order,
        })),
      })),
      coreResources: (template.coreResources ?? []).map((cr: any) => ({
        id: cr.id, templateId: cr.templateId, slug: cr.slug,
        displayName: cr.displayName, enabled: cr.enabled,
        editableByPlayer: cr.editableByPlayer, showNotes: cr.showNotes,
        color: cr.color, order: cr.order,
      })),
      armorClasses: (template.armorClasses ?? []).map((ac: any) => ({
        id: ac.id, templateId: ac.templateId, name: ac.name, enabled: ac.enabled,
        attributeModifiers: (ac.attributeModifiers ?? []).map((am: any) => ({
          id: am.id, armorClassId: am.armorClassId, attributeId: am.attributeId,
          allowPlayerSelection: am.allowPlayerSelection, defaultAttributeId: am.defaultAttributeId,
        })),
        fields: (ac.fields ?? []).map((f: any) => ({
          id: f.id, armorClassId: f.armorClassId, name: f.name, key: f.key,
          defaultValue: f.defaultValue, editableByPlayer: f.editableByPlayer,
          description: f.description, order: f.order,
        })),
      })),
      characterSections: (template.characterSections ?? []).map((cs: any) => ({
        id: cs.id, templateId: cs.templateId, name: cs.name, order: cs.order,
      })),
      resistances: (template.resistances ?? []).map((r: any) => ({
        id: r.id, templateId: r.templateId, name: r.name,
        calculationType: r.calculationType, order: r.order,
        components: (r.components ?? []).map((c: any) => ({
          id: c.id, resistanceId: c.resistanceId, name: c.name,
          editableByPlayer: c.editableByPlayer, defaultValue: c.defaultValue, order: c.order,
        })),
        attributeModifiers: (r.attributeModifiers ?? []).map((am: any) => ({
          id: am.id, resistanceId: am.resistanceId,
          attributeId: am.attributeId, enabled: am.enabled,
        })),
      })),
    }
  }

  /**
   * Attach a template to an adventure (GM only).
   * Creates an immutable snapshot from the template, stores it on the adventure,
   * increments the template's useCount, and clears the adventure's template list cache.
   */
  async attachToAdventure(templateId: string, adventureId: string, userId: string) {
    // GM only
    await this.membership.requireWriteRole(adventureId, userId, 'GM')

    // Enforce single template per campaign: reject if one is already attached
    const existing = await this.prisma.adventure.findUnique({
      where: { id: adventureId },
      select: { originalTemplateId: true, templateSnapshot: true },
    })
    if (existing?.originalTemplateId || existing?.templateSnapshot) {
      throw new ConflictException(this.i18n.t('template.campaignAlreadyHasTemplate'))
    }

    // Reject if campaign-owned templates exist
    const campaignCount = await this.prisma.template.count({
      where: { adventureId },
    })
    if (campaignCount > 0) {
      throw new ConflictException(this.i18n.t('template.campaignOwnedTemplates'))
    }

    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: templateInclude,
    })
    if (!template) throw new NotFoundException(this.i18n.t('template.notFound'))

    // Build and store the snapshot
    const snapshot = await this.buildSnapshot(template)

    const adventure = await this.prisma.adventure.update({
      where: { id: adventureId },
      data: {
        templateSnapshot: snapshot as any,
        originalTemplateId: templateId,
        templateSource: 'attached',
      },
    })

    // Increment useCount
    await this.prisma.template.update({
      where: { id: templateId },
      data: { useCount: { increment: 1 } },
    })

    // Invalidate adventure template list cache
    await this.invalidateCache(adventureId, templateId)

    return adventure
  }

  /**
   * Replace the attached template on an adventure (GM only).
   * Atomically swaps the template snapshot and originalTemplateId.
   * No pre-check for existing attachment — works like attach when none exists.
   * Invalidates cache for both old and new templates.
   */
  async replaceAdventureTemplate(templateId: string, adventureId: string, userId: string) {
    // GM only
    await this.membership.requireWriteRole(adventureId, userId, 'GM')

    // Read existing attachment for old template ID cache invalidation
    const current = await this.prisma.adventure.findUnique({
      where: { id: adventureId },
      select: { originalTemplateId: true },
    })

    // Reject if campaign-owned templates exist
    const campaignCount = await this.prisma.template.count({
      where: { adventureId },
    })
    if (campaignCount > 0) {
      throw new ConflictException(this.i18n.t('template.campaignOwnedTemplates'))
    }

    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: templateInclude,
    })
    if (!template) throw new NotFoundException(this.i18n.t('template.notFound'))

    // Build and store the new snapshot
    const snapshot = await this.buildSnapshot(template)

    const adventure = await this.prisma.adventure.update({
      where: { id: adventureId },
      data: {
        templateSnapshot: snapshot as any,
        originalTemplateId: templateId,
        templateSource: 'attached',
      },
    })

    // Increment new template useCount
    await this.prisma.template.update({
      where: { id: templateId },
      data: { useCount: { increment: 1 } },
    })

    // Invalidate cache for both old and new template
    await this.invalidateCache(adventureId, templateId)
    await this.invalidateCache(adventureId, current?.originalTemplateId ?? undefined)

    return adventure
  }

  /**
   * Detach the template link from an adventure (GM only).
   * Clears originalTemplateId but keeps the snapshot for historical reference.
   */
  async detachFromAdventure(adventureId: string, userId: string) {
    // GM only
    await this.membership.requireWriteRole(adventureId, userId, 'GM')

    // Read the current adventure to get the originalTemplateId for cache invalidation
    const current = await this.prisma.adventure.findUnique({
      where: { id: adventureId },
      select: { originalTemplateId: true },
    })

    const adventure = await this.prisma.adventure.update({
      where: { id: adventureId },
      data: {
        originalTemplateId: null,
        templateSnapshot: DbNull,
        templateSource: null,
      },
    })

    // Invalidate adventure template list cache
    await this.invalidateCache(adventureId, current?.originalTemplateId ?? undefined)

    return adventure
  }

  /**
   * Get the snapshot JSON for an adventure's attached template.
   * Membership access required.
   */
  async getTemplateSnapshot(adventureId: string, userId: string) {
    const isMember = await this.membership.isMember(adventureId, userId)
    if (!isMember) throw new ForbiddenException(this.i18n.t('template.notMemberAdventure'))

    const adventure = await this.prisma.adventure.findUnique({
      where: { id: adventureId },
      select: { templateSnapshot: true, originalTemplateId: true },
    })

    if (!adventure) throw new NotFoundException(this.i18n.t('template.adventureNotFound'))
    if (!adventure.templateSnapshot) {
      return {
        snapshot: null,
        originalTemplateId: null,
      }
    }

    return {
      snapshot: adventure.templateSnapshot as any as TemplateSnapshot,
      originalTemplateId: adventure.originalTemplateId,
    }
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
}