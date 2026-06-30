import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { MembershipService } from '../membership/membership.service.js'
import { CreateCharacterSheetDto } from './dto/create-character-sheet.dto.js'
import { UpdateCharacterSheetDto } from './dto/update-character-sheet.dto.js'

const sheetInclude = {
  adventure: { select: { id: true, name: true, campaign: true } },
  template: {
    select: {
      id: true,
      name: true,
      attributes: { orderBy: { order: 'asc' as const } },
      skillModifierProfiles: {
        orderBy: { order: 'asc' as const },
        include: { options: { orderBy: { order: 'asc' as const } } },
      },
      runtimeModifiers: {
        orderBy: { order: 'asc' as const },
        include: { components: { orderBy: { order: 'asc' as const } } },
      },
    },
  },
  values: {
    include: {
      attribute: { select: { id: true, key: true, name: true, modifier: true } },
    },
  },
  fieldValues: {
    include: {
      templateField: { select: { id: true, key: true, label: true } },
    },
  },
  skillValues: {
    include: {
      skill: { select: { id: true, name: true, description: true, formula: true } },
    },
  },
  skillProfileValues: {
    include: {
      profile: { select: { id: true, name: true } },
      option: { select: { id: true, label: true, value: true } },
    },
  },
  runtimeModifierComponentValues: {
    include: {
      component: {
        select: {
          id: true,
          name: true,
          defaultValue: true,
          locked: true,
          formula: true,
          modifier: {
            select: {
              id: true,
              key: true,
              name: true,
              description: true,
            },
          },
        },
      },
    },
  },
}

@Injectable()
export class CharacterSheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  /** Create a character sheet from a template. */
  async create(userId: string, dto: CreateCharacterSheetDto) {
    const template = await this.prisma.template.findUnique({
      where: { id: dto.templateId },
      include: {
        attributes: true,
        templateFields: true,
        templateSkills: true,
        skillModifierProfiles: { include: { options: { orderBy: { order: 'asc' } } } },
        runtimeModifiers: { include: { components: { orderBy: { order: 'asc' } } } },
      },
    })
    if (!template) throw new NotFoundException('Template not found')

    const adventureId = dto.adventureId !== undefined
      ? (dto.adventureId || null)
      : template.adventureId

    if (adventureId) {
      const isMember = await this.membership.isMember(adventureId, userId)
      if (!isMember) throw new ForbiddenException('You are not a member of this adventure')
    }

    const skillProfileValues: Array<{
      skillId: string; profileId: string; optionId?: string | null
    }> = []
    for (const skill of template.templateSkills) {
      if (!skill.formula) continue
      const formulaVars = this.extractVariableNames(skill.formula)
      for (const profile of template.skillModifierProfiles) {
        if (formulaVars.includes(profile.name)) {
          skillProfileValues.push({ skillId: skill.id, profileId: profile.id, optionId: profile.options[0]?.id ?? null })
        }
      }
    }

    return this.prisma.characterSheet.create({
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
          create: (template.templateSkills || []).map(s => ({ skillId: s.id, value: '' })),
        },
        skillProfileValues: {
          create: skillProfileValues.map(spv => ({ skillId: spv.skillId, profileId: spv.profileId, optionId: spv.optionId })),
        },
        runtimeModifierComponentValues: {
          create: template.runtimeModifiers.flatMap(mod =>
            mod.components.map(c => ({
              componentId: c.id,
              value: c.defaultValue ?? '0',
            })),
          ),
        },
      },
      include: sheetInclude,
    })
  }

  async findAllByUser(userId: string) {
    return this.prisma.characterSheet.findMany({
      where: { ownerId: userId },
      include: {
        adventure: { select: { id: true, name: true, campaign: true } },
        template: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findAllByAdventure(adventureId: string, userId: string) {
    const isMember = await this.membership.isMember(adventureId, userId)
    if (!isMember) throw new ForbiddenException('You are not a member of this adventure')
    return this.prisma.characterSheet.findMany({
      where: { adventureId },
      include: {
        adventure: { select: { id: true, name: true, campaign: true } },
        template: { select: { id: true, name: true } },
        owner: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string, userId: string) {
    const sheet = await this.prisma.characterSheet.findUnique({ where: { id }, include: sheetInclude })
    if (!sheet) throw new NotFoundException('Character sheet not found')
    if (sheet.ownerId !== userId) {
      if (!sheet.adventureId) throw new ForbiddenException('You do not have access to this character sheet')
      const isMember = await this.membership.isMember(sheet.adventureId, userId)
      if (!isMember) throw new ForbiddenException('You do not have access to this character sheet')
    }
    return sheet
  }

  async update(id: string, userId: string, dto: UpdateCharacterSheetDto) {
    const sheet = await this.prisma.characterSheet.findUnique({ where: { id } })
    if (!sheet) throw new NotFoundException('Character sheet not found')
    if (sheet.ownerId !== userId) throw new ForbiddenException('Only the owner can edit this character sheet')

    if (dto.values) {
      for (const v of dto.values)
        await this.prisma.characterSheetValue.upsert({
          where: { sheetId_attributeId: { sheetId: id, attributeId: v.attributeId } },
          create: { sheetId: id, attributeId: v.attributeId, value: v.value },
          update: { value: v.value },
        })
    }
    if (dto.fieldValues) {
      for (const fv of dto.fieldValues)
        await this.prisma.characterSheetFieldValue.upsert({
          where: { sheetId_templateFieldId: { sheetId: id, templateFieldId: fv.templateFieldId } },
          create: { sheetId: id, templateFieldId: fv.templateFieldId, value: fv.value },
          update: { value: fv.value },
        })
    }
    if (dto.skillValues) {
      for (const sv of dto.skillValues)
        await this.prisma.characterSheetSkillValue.upsert({
          where: { sheetId_skillId: { sheetId: id, skillId: sv.skillId } },
          create: { sheetId: id, skillId: sv.skillId, value: sv.value },
          update: { value: sv.value },
        })
    }
    if (dto.skillProfileValues) {
      for (const spv of dto.skillProfileValues)
        await this.prisma.characterSheetSkillProfileValue.upsert({
          where: { sheetId_skillId_profileId: { sheetId: id, skillId: spv.skillId, profileId: spv.profileId } },
          create: { sheetId: id, skillId: spv.skillId, profileId: spv.profileId, optionId: spv.optionId },
          update: { optionId: spv.optionId },
        })
    }
    if (dto.runtimeModifierComponentValues) {
      for (const rmc of dto.runtimeModifierComponentValues)
        await this.prisma.characterSheetRuntimeModifierComponentValue.upsert({
          where: { sheetId_componentId: { sheetId: id, componentId: rmc.componentId } },
          create: { sheetId: id, componentId: rmc.componentId, value: rmc.value },
          update: { value: rmc.value },
        })
    }

    return this.prisma.characterSheet.update({
      where: { id },
      data: {
        ...(dto.characterName !== undefined && { characterName: dto.characterName }),
        ...(dto.playerName !== undefined && { playerName: dto.playerName }),
        ...(dto.level !== undefined && { level: dto.level }),
        ...(dto.hpActual !== undefined && { hpActual: dto.hpActual }),
        ...(dto.hpMax !== undefined && { hpMax: dto.hpMax }),
        ...(dto.hpNotes !== undefined && { hpNotes: dto.hpNotes }),
      },
      include: sheetInclude,
    })
  }

  async remove(id: string, userId: string) {
    const sheet = await this.prisma.characterSheet.findUnique({ where: { id } })
    if (!sheet) throw new NotFoundException('Character sheet not found')
    if (sheet.ownerId !== userId) throw new ForbiddenException('Only the owner can delete this character sheet')
    return this.prisma.characterSheet.delete({ where: { id } })
  }

  async linkToAdventure(sheetId: string, adventureId: string, userId: string) {
    const sheet = await this.prisma.characterSheet.findUnique({ where: { id: sheetId } })
    if (!sheet) throw new NotFoundException('Character sheet not found')
    if (sheet.ownerId !== userId) throw new ForbiddenException('Only the owner can link this character sheet')
    const isMember = await this.membership.isMember(adventureId, userId)
    if (!isMember) throw new ForbiddenException('You are not a member of this adventure')
    return this.prisma.characterSheet.update({ where: { id: sheetId }, data: { adventureId }, include: sheetInclude })
  }

  async unlinkFromAdventure(sheetId: string, userId: string) {
    const sheet = await this.prisma.characterSheet.findUnique({ where: { id: sheetId } })
    if (!sheet) throw new NotFoundException('Character sheet not found')
    if (sheet.ownerId !== userId) {
      if (!sheet.adventureId) throw new ForbiddenException('Only the owner can unlink this character sheet')
      try { await this.membership.requireRole(sheet.adventureId, userId, 'GM') }
      catch { throw new ForbiddenException('Only the owner or a GM can unlink this character sheet') }
    }
    return this.prisma.characterSheet.update({ where: { id: sheetId }, data: { adventureId: null }, include: sheetInclude })
  }

  async updateSkillProfileValue(sheetId: string, skillId: string, profileId: string, optionId: string | null, userId: string) {
    const sheet = await this.prisma.characterSheet.findUnique({ where: { id: sheetId } })
    if (!sheet) throw new NotFoundException('Character sheet not found')
    if (sheet.ownerId !== userId) throw new ForbiddenException('Only the owner can edit this character sheet')
    return this.prisma.characterSheetSkillProfileValue.upsert({
      where: { sheetId_skillId_profileId: { sheetId, skillId, profileId } },
      create: { sheetId, skillId, profileId, optionId },
      update: { optionId },
    })
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