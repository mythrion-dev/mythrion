import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { MembershipService } from '../membership/membership.service.js'
import { CreateTemplateDto } from './dto/create-template.dto.js'
import { UpdateTemplateDto } from './dto/update-template.dto.js'
import { RedisService } from '../redis/redis.service.js'

const templateInclude = {
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

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name)
  private readonly CACHE_TTL = 30 // seconds
  private readonly LIST_CACHE_TTL = 15 // seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly redis: RedisService,
  ) {}

  private cacheKey(id: string): string {
    return `template:${id}`
  }

  private listCacheKey(adventureId: string): string {
    return `templates:adventure:${adventureId}`
  }

  /** Invalidate cached templates for an adventure (and optionally a specific template) */
  private async invalidateCache(adventureId: string, templateId?: string): Promise<void> {
    try {
      if (templateId) {
        await this.redis.del(this.cacheKey(templateId))
      }
      await this.redis.del(this.listCacheKey(adventureId))
    } catch (err) {
      this.logger.warn('Failed to invalidate template cache', err)
    }
  }

  async create(adventureId: string, userId: string, dto: CreateTemplateDto) {
    await this.membership.requireRole(adventureId, userId, 'GM')

    // Create the template with attributes and skills (initially without attribute links)
    const armorClasses = dto.armorClasses ?? []
    const created = await this.prisma.template.create({
      data: {
        adventureId, name: dto.name, description: dto.description ?? null,
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

    // Fetch created attributes for key->id resolution
    const createdAttrs = await this.prisma.templateAttribute.findMany({ where: { templateId: created.id } })
    const attrKeyToId = new Map(createdAttrs.map(a => [a.key, a.id]))

    // Post-create: resolve and create AC attribute modifiers for each armor class
    const createdAcs = await this.prisma.templateArmorClass.findMany({ where: { templateId: created.id }, orderBy: { createdAt: 'asc' } })
    for (let i = 0; i < armorClasses.length; i++) {
      const ac = armorClasses[i]
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

    // Post-create: link skills to their attributes by resolving keys to IDs
    if (dto.skills?.length) {
      for (const s of dto.skills) {
        const skill = (created.templateSkills || []).find(sk => sk.name === s.name)
        if (!skill) continue

        const legacyAttrId = s.attributeId ? attrKeyToId.get(s.attributeId) ?? null : null

        const allowedIds = (s.allowedAttributeIds || []).map(k => attrKeyToId.get(k)).filter(Boolean) as string[]
        const effectiveAllowed = allowedIds.length > 0 ? allowedIds : (legacyAttrId ? [legacyAttrId] : [])

        const defaultAttrId = s.defaultAttributeId
          ? (attrKeyToId.get(s.defaultAttributeId) ?? null)
          : (effectiveAllowed.length > 0 ? effectiveAllowed[0] : null)

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

    // Invalidate list cache for this adventure
    await this.invalidateCache(adventureId, created.id)

    return this.prisma.template.findUnique({ where: { id: created.id }, include: templateInclude })
  }

  async findAllByAdventure(adventureId: string, userId: string) {
    // Try cache first
    const cached = await this.redis.cacheGet<any[]>(this.listCacheKey(adventureId))
    if (cached) {
      const isMember = await this.membership.isMember(adventureId, userId)
      if (!isMember) throw new ForbiddenException('You are not a member of this adventure')
      return cached
    }

    const templates = await this.prisma.template.findMany({
      where: { adventureId }, include: templateInclude, orderBy: { createdAt: 'desc' },
    })

    const isMember = await this.membership.isMember(adventureId, userId)
    if (!isMember) throw new ForbiddenException('You are not a member of this adventure')

    // Cache the list
    await this.redis.cacheSet(this.listCacheKey(adventureId), templates, this.LIST_CACHE_TTL).catch(() => {})

    return templates
  }

  async findOne(id: string, userId: string) {
    // Try cache first
    const cached = await this.redis.cacheGet<any>(this.cacheKey(id))
    if (cached) {
      // Verify membership still valid (fast check — user is cached, but verify fresh)
      const isMember = await this.membership.isMember(cached.adventureId, userId)
      if (!isMember) throw new ForbiddenException('You are not a member of this adventure')
      return cached
    }

    const template = await this.prisma.template.findUnique({ where: { id }, include: templateInclude })
    if (!template) throw new NotFoundException('Template not found')
    const isMember = await this.membership.isMember(template.adventureId, userId)
    if (!isMember) throw new ForbiddenException('You are not a member of this adventure')

    // Cache the result (skip if Redis unavailable — cacheGet returns null gracefully)
    await this.redis.cacheSet(this.cacheKey(id), template, this.CACHE_TTL).catch(() => {})

    return template
  }

  async update(id: string, userId: string, dto: UpdateTemplateDto) {
    const template = await this.prisma.template.findUnique({ where: { id } })
    if (!template) throw new NotFoundException('Template not found')
    await this.membership.requireRole(template.adventureId, userId, 'GM')

    if (dto.attributes) {
      const existingAttrs = await this.prisma.templateAttribute.findMany({ where: { templateId: id } })
      const newKeys = dto.attributes.map(a => a.key.trim())
      const existingKeys = existingAttrs.map(a => a.key)
      const keysToDelete = existingKeys.filter(k => !newKeys.includes(k))
      if (keysToDelete.length) await this.prisma.templateAttribute.deleteMany({ where: { templateId: id, key: { in: keysToDelete } } })
      for (let idx = 0; idx < dto.attributes.length; idx++) {
        const a = dto.attributes[idx]; const key = a.key.trim()
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

    if (dto.templateFields) {
      const existingFields = await this.prisma.templateField.findMany({ where: { templateId: id } })
      const newFieldKeys = dto.templateFields.map(f => f.key.trim())
      const existingFieldKeys = existingFields.map(f => f.key)
      const fieldKeysToDelete = existingFieldKeys.filter(k => !newFieldKeys.includes(k))
      if (fieldKeysToDelete.length) await this.prisma.templateField.deleteMany({ where: { templateId: id, key: { in: fieldKeysToDelete } } })
      for (let idx = 0; idx < dto.templateFields.length; idx++) {
        const f = dto.templateFields[idx]; const key = f.key.trim()
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

    // Pre-fetch all attributes for key->id resolution (used by both skills and AC)
    const hasAcUpdates = dto.armorClasses && dto.armorClasses.some(ac => ac.attributeModifiers?.length)
    const allAttrs = dto.skills || hasAcUpdates
      ? await this.prisma.templateAttribute.findMany({ where: { templateId: id } })
      : []
    const attrKeyToId = new Map(allAttrs.map(a => [a.key, a.id]))

    // Handle skills
    if (dto.skills) {
      const existingSkills = await this.prisma.templateSkill.findMany({ where: { templateId: id } })
      const newSkillNames = dto.skills.map(s => s.name.trim())
      const existingSkillNames = existingSkills.map(s => s.name)
      const skillNamesToDelete = existingSkillNames.filter(n => !newSkillNames.includes(n))
      if (skillNamesToDelete.length) await this.prisma.templateSkill.deleteMany({ where: { templateId: id, name: { in: skillNamesToDelete } } })

      for (let idx = 0; idx < dto.skills.length; idx++) {
        const s = dto.skills[idx]; const name = s.name.trim()
        const existing = existingSkills.find(e => e.name === name)

        const legacyAttrId = s.attributeId ? (attrKeyToId.get(s.attributeId) ?? null) : null
        const allowedIds = (s.allowedAttributeIds || []).map(k => attrKeyToId.get(k)).filter(Boolean) as string[]
        const effectiveAllowed = allowedIds.length > 0 ? allowedIds : (legacyAttrId ? [legacyAttrId] : [])
        const defaultAttrId = s.defaultAttributeId
          ? (attrKeyToId.get(s.defaultAttributeId) ?? null)
          : (effectiveAllowed.length > 0 ? effectiveAllowed[0] : null)

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
      if (addedSkillNames.length > 0) {
        const newSkills = await this.prisma.templateSkill.findMany({ where: { templateId: id, name: { in: addedSkillNames } } })
        const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
        for (const sheet of sheets) for (const skill of newSkills)
          await this.prisma.characterSheetSkillValue.upsert({ where: { sheetId_skillId: { sheetId: sheet.id, skillId: skill.id } }, create: { sheetId: sheet.id, skillId: skill.id, value: '', selectedAttributeId: skill.defaultAttributeId }, update: {} })
      }
    }

    // Handle skill modifier profiles
    if (dto.skillModifierProfiles) {
      const existingProfiles = await this.prisma.skillModifierProfile.findMany({
        where: { templateId: id },
        include: { options: true },
      })
      const newProfileNames = dto.skillModifierProfiles.map(p => p.name.trim())
      const existingProfileNames = existingProfiles.map(p => p.name)
      const profileNamesToDelete = existingProfileNames.filter(n => !newProfileNames.includes(n))
      if (profileNamesToDelete.length) await this.prisma.skillModifierProfile.deleteMany({ where: { templateId: id, name: { in: profileNamesToDelete } } })
      for (let pIdx = 0; pIdx < dto.skillModifierProfiles.length; pIdx++) {
        const p = dto.skillModifierProfiles[pIdx]; const name = p.name.trim()
        const existing = existingProfiles.find(e => e.name === name)
        if (existing) {
          await this.prisma.skillModifierProfile.update({ where: { id: existing.id }, data: { name, order: pIdx, targetMode: p.targetMode ?? 'ALL_SKILLS', targetSkillIds: p.targetSkillIds ?? [] } })
          const existingOptions = existing.options
          const newOptionLabels = p.options.map(o => o.label.trim())
          const existingOptionLabels = existingOptions.map(o => o.label)
          const labelsToDelete = existingOptionLabels.filter(l => !newOptionLabels.includes(l))
          if (labelsToDelete.length) await this.prisma.profileOption.deleteMany({ where: { profileId: existing.id, label: { in: labelsToDelete } } })
          for (let oIdx = 0; oIdx < p.options.length; oIdx++) {
            const o = p.options[oIdx]; const label = o.label.trim()
            const existingOpt = existingOptions.find(eo => eo.label === label)
            if (existingOpt) { await this.prisma.profileOption.update({ where: { id: existingOpt.id }, data: { value: o.value, order: oIdx } }) }
            else { await this.prisma.profileOption.create({ data: { profileId: existing.id, label, value: o.value, order: oIdx } }) }
          }
        } else {
          await this.prisma.skillModifierProfile.create({ data: { templateId: id, name, order: pIdx, targetMode: p.targetMode ?? 'ALL_SKILLS', targetSkillIds: p.targetSkillIds ?? [], options: { create: p.options.map((o, oIdx) => ({ label: o.label.trim(), value: o.value, order: oIdx })) } } })
        }
      }
      const addedProfileNames = newProfileNames.filter(n => !existingProfileNames.includes(n))
      if (addedProfileNames.length > 0) {
        const newProfiles = await this.prisma.skillModifierProfile.findMany({ where: { templateId: id, name: { in: addedProfileNames } } })
        const skills = await this.prisma.templateSkill.findMany({ where: { templateId: id } })
        const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
        for (const sheet of sheets) for (const skill of skills) {
          const globalSkillFormula = (await this.prisma.template.findUnique({ where: { id }, select: { skillFormula: true } }))?.skillFormula
          if (!globalSkillFormula) continue
          const formulaVars = this.extractVariableNames(globalSkillFormula)
          for (const profile of newProfiles) {
            if (!formulaVars.includes(profile.name)) continue
            const targetMode = (profile as any).targetMode ?? 'ALL_SKILLS'
            const targetSkillIds: string[] = (profile as any).targetSkillIds ?? []
            if (targetMode === 'SELECTED_SKILLS' && targetSkillIds.length > 0 && !targetSkillIds.includes(skill.name)) {
              continue
            }
            const firstOption = await this.prisma.profileOption.findFirst({ where: { profileId: profile.id }, orderBy: { order: 'asc' } })
            await this.prisma.characterSheetSkillProfileValue.upsert({ where: { sheetId_skillId_profileId: { sheetId: sheet.id, skillId: skill.id, profileId: profile.id } }, create: { sheetId: sheet.id, skillId: skill.id, profileId: profile.id, optionId: firstOption?.id ?? null }, update: {} })
          }
        }
      }
    }

    // Handle Armor Classes (multi-AC)
    if (dto.armorClasses) {
      const existingAcs = await this.prisma.templateArmorClass.findMany({
        where: { templateId: id },
        include: { fields: true },
      })

      // Delete ACs that are no longer in the list (match by name)
      const newAcNames = dto.armorClasses.map(ac => ac.name?.trim() ?? 'Armor Class')
      const acsToDelete = existingAcs.filter(ac => !newAcNames.includes(ac.name))
      if (acsToDelete.length > 0) {
        await this.prisma.templateArmorClass.deleteMany({
          where: { id: { in: acsToDelete.map(ac => ac.id) } },
        })
      }

      for (const acDef of dto.armorClasses) {
        const acName = acDef.name?.trim() ?? 'Armor Class'
        const existingAC = existingAcs.find(ac => ac.name === acName)

        if (acDef.enabled === false) {
          if (existingAC) {
            await this.prisma.templateArmorClass.delete({ where: { id: existingAC.id } })
          }
          continue
        }

        if (existingAC) {
          // Update existing AC
          await this.prisma.templateArmorClass.update({
            where: { id: existingAC.id },
            data: {
              name: acName,
              ...(acDef.enabled !== undefined && { enabled: acDef.enabled }),
            },
          })

          // Handle attribute modifiers
          if (acDef.attributeModifiers) {
            await this.prisma.armorClassAttributeModifier.deleteMany({ where: { armorClassId: existingAC.id } })
            const createdModifiers: string[] = []
            for (const am of acDef.attributeModifiers) {
              const resolvedAttrId = attrKeyToId.get(am.attributeId) ?? am.attributeId
              const resolvedDefaultId = am.defaultAttributeId ? (attrKeyToId.get(am.defaultAttributeId) ?? am.defaultAttributeId) : null
              if (!resolvedAttrId) continue
              const created = await this.prisma.armorClassAttributeModifier.create({
                data: {
                  armorClassId: existingAC.id,
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

          // Handle fields
          if (acDef.fields) {
            const existingFields = existingAC.fields
            const newFieldKeys = acDef.fields.map(f => f.key?.trim() ?? '')
            const existingFieldKeys = existingFields.map(f => f.key)
            const fieldKeysToDelete = existingFieldKeys.filter(k => !newFieldKeys.includes(k))
            if (fieldKeysToDelete.length) {
              await this.prisma.armorClassField.deleteMany({ where: { armorClassId: existingAC.id, key: { in: fieldKeysToDelete } } })
            }
            for (let fIdx = 0; fIdx < acDef.fields.length; fIdx++) {
              const f = acDef.fields[fIdx]; const key = f.key?.trim() ?? ''
              if (!key) continue
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
                    armorClassId: existingAC.id, key, name: f.name ?? key,
                    defaultValue: f.defaultValue ?? '0',
                    editableByPlayer: f.editableByPlayer ?? false,
                    description: f.description ?? null,
                    order: fIdx,
                  },
                })
              }
            }
            // Auto-create values for newly added AC fields on existing sheets
            const addedFieldKeys = newFieldKeys.filter(k => !existingFieldKeys.includes(k) && k.length > 0)
            if (addedFieldKeys.length > 0) {
              const newFields = await this.prisma.armorClassField.findMany({ where: { armorClassId: existingAC.id, key: { in: addedFieldKeys } } })
              const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
              for (const sheet of sheets) for (const field of newFields)
                await this.prisma.characterSheetArmorClassValue.upsert({
                  where: { sheetId_fieldId: { sheetId: sheet.id, fieldId: field.id } },
                  create: { sheetId: sheet.id, fieldId: field.id, value: field.defaultValue },
                  update: {},
                })
            }
          }
        } else {
          // Create new AC for existing template
          const resolvedModifiers = (acDef.attributeModifiers || [])
            .map(am => {
              const resolvedAttrId = attrKeyToId.get(am.attributeId) ?? am.attributeId
              const resolvedDefaultId = am.defaultAttributeId ? (attrKeyToId.get(am.defaultAttributeId) ?? am.defaultAttributeId) : null
              return { attributeId: resolvedAttrId, allowPlayerSelection: am.allowPlayerSelection ?? false, defaultAttributeId: resolvedDefaultId }
            })
            .filter(am => am.attributeId)

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
                create: (acDef.fields || [])
                  .filter(f => (f.key?.trim() ?? '') !== '')
                  .map((f, fIdx) => ({
                    name: f.name ?? f.key?.trim() ?? '',
                    key: f.key?.trim() ?? '',
                    defaultValue: f.defaultValue ?? '0',
                    editableByPlayer: f.editableByPlayer ?? false,
                    description: f.description ?? null,
                    order: fIdx,
                  })),
              },
            },
          })

          // Auto-create values for new AC on existing sheets
          const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
          if (acDef.fields && acDef.fields.length > 0) {
            const newFields = await this.prisma.armorClassField.findMany({ where: { armorClassId: newAC.id } })
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
          // Auto-create acAttributeValues for existing sheets
          if (resolvedModifiers.length > 0) {
            const newModifiers = await this.prisma.armorClassAttributeModifier.findMany({ where: { armorClassId: newAC.id } })
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
        }
      }
    }

    // Handle character sections
    if (dto.characterSections) {
      const existingSections = await this.prisma.templateCharacterSection.findMany({
        where: { templateId: id },
      })
      const existingIds = existingSections.map(e => e.id)
      const keptIds = new Set<string>()
      for (let idx = 0; idx < dto.characterSections.length; idx++) {
        const s = dto.characterSections[idx]; const name = s.name.trim()
        if (!name) continue
        let existing: typeof existingSections[number] | undefined
        if (s.id) {
          existing = existingSections.find(e => e.id === s.id)
        }
        if (!existing) {
          existing = existingSections.find(e => e.name === name)
        }
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

    // Handle core resources
    if (dto.coreResources) {
      const existingResources = await this.prisma.templateCoreResource.findMany({
        where: { templateId: id },
      })
      const newSlugs = dto.coreResources.map(cr => cr.slug?.trim() ?? '').filter(Boolean)
      const existingSlugs = existingResources.map(cr => cr.slug)
      const slugsToDelete = existingSlugs.filter(s => !newSlugs.includes(s))
      if (slugsToDelete.length) {
        await this.prisma.templateCoreResource.deleteMany({ where: { templateId: id, slug: { in: slugsToDelete } } })
      }

      for (let crIdx = 0; crIdx < dto.coreResources.length; crIdx++) {
        const cr = dto.coreResources[crIdx]
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

    // Handle resistances
    if (dto.resistances) {
      const existingResistances = await this.prisma.templateResistance.findMany({
        where: { templateId: id },
        include: { components: true, attributeModifiers: true },
      })
      const existingResistanceIds = existingResistances.map(r => r.id)
      const keptResistanceIds = new Set<string>()

      for (let rIdx = 0; rIdx < dto.resistances.length; rIdx++) {
        const r = dto.resistances[rIdx]
        const name = r.name?.trim()
        if (!name) continue

        let existing: typeof existingResistances[number] | undefined
        if (r.id) {
          existing = existingResistances.find(e => e.id === r.id)
        }
        if (!existing) {
          existing = existingResistances.find(e => !keptResistanceIds.has(e.id))
        }

        if (existing) {
          keptResistanceIds.add(existing.id)
          await this.prisma.templateResistance.update({
            where: { id: existing.id },
            data: {
              ...(r.name !== undefined && { name }),
              ...(r.calculationType !== undefined && { calculationType: r.calculationType }),
              order: rIdx,
            },
          })

          if (r.components) {
            const existingComps = existing.components
            const keptCompIds = new Set<string>()
            for (let cIdx = 0; cIdx < r.components.length; cIdx++) {
              const c = r.components[cIdx]
              const compName = c.name?.trim()
              if (!compName) continue
              let existingComp: typeof existingComps[number] | undefined
              if (c.id) {
                existingComp = existingComps.find(ec => ec.id === c.id)
              }
              if (!existingComp) {
                existingComp = existingComps.find(ec => !keptCompIds.has(ec.id))
              }
              if (existingComp) {
                keptCompIds.add(existingComp.id)
                await this.prisma.resistanceComponent.update({
                  where: { id: existingComp.id },
                  data: {
                    ...(c.name !== undefined && { name: compName }),
                    ...(c.editableByPlayer !== undefined && { editableByPlayer: c.editableByPlayer }),
                    ...(c.defaultValue !== undefined && { defaultValue: c.defaultValue }),
                    order: cIdx,
                  },
                })
              } else {
                const newComp = await this.prisma.resistanceComponent.create({
                  data: {
                    resistanceId: existing.id,
                    name: compName,
                    editableByPlayer: c.editableByPlayer ?? false,
                    defaultValue: c.defaultValue ?? '0',
                    order: cIdx,
                  },
                })
                keptCompIds.add(newComp.id)
                const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
                for (const sheet of sheets) {
                  await this.prisma.characterSheetResistanceComponentValue.upsert({
                    where: { sheetId_componentId: { sheetId: sheet.id, componentId: newComp.id } },
                    create: { sheetId: sheet.id, componentId: newComp.id, value: newComp.defaultValue },
                    update: {},
                  })
                }
              }
            }
            const compIdsToDelete = existingComps.filter(ec => !keptCompIds.has(ec.id)).map(ec => ec.id)
            if (compIdsToDelete.length) {
              await this.prisma.resistanceComponent.deleteMany({ where: { id: { in: compIdsToDelete } } })
            }
          }

          if (r.attributeModifiers) {
            await this.prisma.resistanceAttributeModifier.deleteMany({ where: { resistanceId: existing.id } })
            for (const am of r.attributeModifiers) {
              await this.prisma.resistanceAttributeModifier.create({
                data: {
                  resistanceId: existing.id,
                  attributeId: am.attributeId,
                  enabled: am.enabled ?? true,
                },
              })
            }
          }
        } else {
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
          keptResistanceIds.add(newResistance.id)

          if (r.attributeModifiers) {
            for (const am of r.attributeModifiers) {
              await this.prisma.resistanceAttributeModifier.create({
                data: {
                  resistanceId: newResistance.id,
                  attributeId: am.attributeId,
                  enabled: am.enabled ?? true,
                },
              })
            }
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
        }
      }

      const resistanceIdsToDelete = existingResistanceIds.filter(id => !keptResistanceIds.has(id))
      if (resistanceIdsToDelete.length) {
        await this.prisma.templateResistance.deleteMany({ where: { id: { in: resistanceIdsToDelete } } })
      }
    }

    const result = await this.prisma.template.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.attributeModifiersEnabled !== undefined && { attributeModifiersEnabled: dto.attributeModifiersEnabled }),
        ...(dto.attributeModifierFormula !== undefined && { attributeModifierFormula: dto.attributeModifierFormula || null }),
        ...(dto.skillFormula !== undefined && { skillFormula: dto.skillFormula || null }),
      },
      include: templateInclude,
    })

    // Invalidate caches
    await this.invalidateCache(template.adventureId, id)

    return result
  }

  async remove(id: string, userId: string) {
    const template = await this.prisma.template.findUnique({ where: { id } })
    if (!template) throw new NotFoundException('Template not found')
    await this.membership.requireRole(template.adventureId, userId, 'GM')
    const result = await this.prisma.template.delete({ where: { id } })

    // Invalidate caches
    await this.invalidateCache(template.adventureId, id)

    return result
  }

  private extractVariableNames(formula: string): string[] {
    if (!formula) return []
    const tokens = formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []
    const functions = new Set(['mod', 'floor', 'ceil', 'round', 'max', 'min', 'abs'])
    const seen = new Set<string>()
    const vars: string[] = []
    for (const t of tokens) {
      if (!functions.has(t) && !seen.has(t)) { seen.add(t); vars.push(t) }
    }
    return vars
  }
}