import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { MembershipService } from '../membership/membership.service.js'
import { CreateTemplateDto } from './dto/create-template.dto.js'
import { UpdateTemplateDto } from './dto/update-template.dto.js'

const templateInclude = {
  attributes: { orderBy: { order: 'asc' as const } },
  templateFields: { orderBy: { order: 'asc' as const } },
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

    // Handle attributes
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

    // Handle templateFields
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
}