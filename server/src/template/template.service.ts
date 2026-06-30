import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { MembershipService } from '../membership/membership.service.js'
import { CreateTemplateDto } from './dto/create-template.dto.js'
import { UpdateTemplateDto } from './dto/update-template.dto.js'

const templateInclude = {
  attributes: { orderBy: { order: 'asc' as const } },
  templateFields: { orderBy: { order: 'asc' as const } },
  templateSkills: { orderBy: { order: 'asc' as const } },
  skillModifierProfiles: {
    orderBy: { order: 'asc' as const },
    include: { options: { orderBy: { order: 'asc' as const } } },
  },
  runtimeModifiers: {
    orderBy: { order: 'asc' as const },
    include: { components: { orderBy: { order: 'asc' as const } } },
  },
}

@Injectable()
export class TemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  async create(adventureId: string, userId: string, dto: CreateTemplateDto) {
    await this.membership.requireRole(adventureId, userId, 'GM')
    return this.prisma.template.create({
      data: {
        adventureId, name: dto.name, description: dto.description ?? null,
        attributes: {
          create: dto.attributes.map((attr, idx) => ({
            key: attr.key, name: attr.name, modifier: attr.modifier ?? null, order: idx,
          })),
        },
        templateFields: {
          create: (dto.templateFields || []).map((f, idx) => ({
            key: f.key, label: f.label, order: idx,
          })),
        },
        templateSkills: {
          create: (dto.skills || []).map((s, idx) => ({
            name: s.name, description: s.description ?? null, formula: s.formula ?? null, order: idx,
          })),
        },
        skillModifierProfiles: {
          create: (dto.skillModifierProfiles || []).map((p, pIdx) => ({
            name: p.name,
            order: pIdx,
            options: {
              create: p.options.map((o, oIdx) => ({
                label: o.label,
                value: o.value,
                order: oIdx,
              })),
            },
          })),
        },
        runtimeModifiers: {
          create: (dto.runtimeModifiers || []).map((mod, modIdx) => ({
            key: mod.key,
            name: mod.name,
            description: mod.description ?? null,
            order: modIdx,
            components: {
              create: (mod.components || []).map((c, cIdx) => ({
                name: c.name,
                defaultValue: c.defaultValue ?? null,
                locked: c.locked ?? false,
                formula: c.formula ?? null,
                order: cIdx,
              })),
            },
          })),
        },
      },
      include: templateInclude,
    })
  }

  async findAllByAdventure(adventureId: string, userId: string) {
    const isMember = await this.membership.isMember(adventureId, userId)
    if (!isMember) throw new ForbiddenException('You are not a member of this adventure')
    return this.prisma.template.findMany({
      where: { adventureId }, include: templateInclude, orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string, userId: string) {
    const template = await this.prisma.template.findUnique({ where: { id }, include: templateInclude })
    if (!template) throw new NotFoundException('Template not found')
    const isMember = await this.membership.isMember(template.adventureId, userId)
    if (!isMember) throw new ForbiddenException('You are not a member of this adventure')
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
        if (existing) { await this.prisma.templateAttribute.update({ where: { id: existing.id }, data: { name: a.name.trim(), modifier: a.modifier ?? null, order: idx } }) }
        else { await this.prisma.templateAttribute.create({ data: { templateId: id, key, name: a.name.trim(), modifier: a.modifier ?? null, order: idx } }) }
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
        if (existing) { await this.prisma.templateSkill.update({ where: { id: existing.id }, data: { description: s.description ?? null, formula: s.formula ?? null, order: idx } }) }
        else { await this.prisma.templateSkill.create({ data: { templateId: id, name, description: s.description ?? null, formula: s.formula ?? null, order: idx } }) }
      }
      const addedSkillNames = newSkillNames.filter(n => !existingSkillNames.includes(n))
      if (addedSkillNames.length > 0) {
        const newSkills = await this.prisma.templateSkill.findMany({ where: { templateId: id, name: { in: addedSkillNames } } })
        const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
        for (const sheet of sheets) for (const skill of newSkills)
          await this.prisma.characterSheetSkillValue.upsert({ where: { sheetId_skillId: { sheetId: sheet.id, skillId: skill.id } }, create: { sheetId: sheet.id, skillId: skill.id, value: '' }, update: {} })
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
          await this.prisma.skillModifierProfile.update({ where: { id: existing.id }, data: { name, order: pIdx } })
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
          await this.prisma.skillModifierProfile.create({ data: { templateId: id, name, order: pIdx, options: { create: p.options.map((o, oIdx) => ({ label: o.label.trim(), value: o.value, order: oIdx })) } } })
        }
      }
      const addedProfileNames = newProfileNames.filter(n => !existingProfileNames.includes(n))
      if (addedProfileNames.length > 0) {
        const newProfiles = await this.prisma.skillModifierProfile.findMany({ where: { templateId: id, name: { in: addedProfileNames } } })
        const skills = await this.prisma.templateSkill.findMany({ where: { templateId: id } })
        const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
        for (const sheet of sheets) for (const skill of skills) {
          if (!skill.formula) continue
          const formulaVars = this.extractVariableNames(skill.formula)
          for (const profile of newProfiles) {
            if (formulaVars.includes(profile.name)) {
              const firstOption = await this.prisma.profileOption.findFirst({ where: { profileId: profile.id }, orderBy: { order: 'asc' } })
              await this.prisma.characterSheetSkillProfileValue.upsert({ where: { sheetId_skillId_profileId: { sheetId: sheet.id, skillId: skill.id, profileId: profile.id } }, create: { sheetId: sheet.id, skillId: skill.id, profileId: profile.id, optionId: firstOption?.id ?? null }, update: {} })
            }
          }
        }
      }
    }

    // Handle runtime modifiers (component-based)
    if (dto.runtimeModifiers) {
      const existingModifiers = await this.prisma.templateRuntimeModifier.findMany({
        where: { templateId: id },
        include: { components: true },
      })
      const newModifierKeys = dto.runtimeModifiers.map(m => m.key.trim())
      const existingModifierKeys = existingModifiers.map(m => m.key)
      const modifierKeysToDelete = existingModifierKeys.filter(k => !newModifierKeys.includes(k))
      if (modifierKeysToDelete.length) {
        await this.prisma.templateRuntimeModifier.deleteMany({ where: { templateId: id, key: { in: modifierKeysToDelete } } })
      }

      for (let mIdx = 0; mIdx < dto.runtimeModifiers.length; mIdx++) {
        const mod = dto.runtimeModifiers[mIdx]
        const key = mod.key.trim()
        const existing = existingModifiers.find(e => e.key === key)

        if (existing) {
          await this.prisma.templateRuntimeModifier.update({
            where: { id: existing.id },
            data: { name: mod.name.trim(), description: mod.description ?? null, order: mIdx },
          })
          // Handle components for existing modifier
          const existingComponents = existing.components
          const newCompNames = (mod.components || []).map(c => c.name.trim())
          const existingCompNames = existingComponents.map(c => c.name)
          const compNamesToDelete = existingCompNames.filter(n => !newCompNames.includes(n))
          if (compNamesToDelete.length) {
            await this.prisma.runtimeModifierComponent.deleteMany({ where: { modifierId: existing.id, name: { in: compNamesToDelete } } })
          }
          for (let cIdx = 0; cIdx < (mod.components || []).length; cIdx++) {
            const c = mod.components![cIdx]; const cName = c.name.trim()
            const existingComp = existingComponents.find(ec => ec.name === cName)
            if (existingComp) {
              await this.prisma.runtimeModifierComponent.update({ where: { id: existingComp.id }, data: { defaultValue: c.defaultValue ?? null, locked: c.locked ?? false, formula: c.formula ?? null, order: cIdx } })
            } else {
              await this.prisma.runtimeModifierComponent.create({ data: { modifierId: existing.id, name: cName, defaultValue: c.defaultValue ?? null, locked: c.locked ?? false, formula: c.formula ?? null, order: cIdx } })
            }
          }
          // For newly added components, auto-create values on existing sheets
          const addedCompNames = newCompNames.filter(n => !existingCompNames.includes(n))
          if (addedCompNames.length > 0) {
            const newComps = await this.prisma.runtimeModifierComponent.findMany({ where: { modifierId: existing.id, name: { in: addedCompNames } } })
            const sheets = await this.prisma.characterSheet.findMany({ where: { templateId: id }, select: { id: true } })
            for (const sheet of sheets) for (const comp of newComps)
              await this.prisma.characterSheetRuntimeModifierComponentValue.upsert({
                where: { sheetId_componentId: { sheetId: sheet.id, componentId: comp.id } },
                create: { sheetId: sheet.id, componentId: comp.id, value: comp.defaultValue ?? '0' },
                update: {},
              })
          }
        } else {
          await this.prisma.templateRuntimeModifier.create({
            data: {
              templateId: id, key, name: mod.name.trim(), description: mod.description ?? null, order: mIdx,
              components: {
                create: (mod.components || []).map((c, cIdx) => ({
                  name: c.name, defaultValue: c.defaultValue ?? null, locked: c.locked ?? false, formula: c.formula ?? null, order: cIdx,
                })),
              },
            },
          })
        }
      }
    }

    return this.prisma.template.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: templateInclude,
    })
  }

  async remove(id: string, userId: string) {
    const template = await this.prisma.template.findUnique({ where: { id } })
    if (!template) throw new NotFoundException('Template not found')
    await this.membership.requireRole(template.adventureId, userId, 'GM')
    return this.prisma.template.delete({ where: { id } })
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