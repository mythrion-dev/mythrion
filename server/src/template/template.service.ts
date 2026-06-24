import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { MembershipService } from '../membership/membership.service.js'
import { CreateTemplateDto } from './dto/create-template.dto.js'
import { UpdateTemplateDto } from './dto/update-template.dto.js'

const templateInclude = {
  attributes: {
    orderBy: { order: 'asc' as const },
  },
}

@Injectable()
export class TemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  /** Only GMs can create templates */
  async create(adventureId: string, userId: string, dto: CreateTemplateDto) {
    await this.membership.requireRole(adventureId, userId, 'GM')

    const template = await this.prisma.template.create({
      data: {
        adventureId,
        name: dto.name,
        description: dto.description ?? null,
        attributes: {
          create: dto.attributes.map((attr, idx) => ({
            key: attr.key,
            name: attr.name,
            modifier: attr.modifier ?? null,
            order: idx,
          })),
        },
      },
      include: templateInclude,
    })

    return template
  }

  /** Both GMs and players can view templates for a given adventure */
  async findAllByAdventure(adventureId: string, userId: string) {
    const isMember = await this.membership.isMember(adventureId, userId)
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this adventure')
    }

    return this.prisma.template.findMany({
      where: { adventureId },
      include: templateInclude,
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string, userId: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
      include: templateInclude,
    })
    if (!template) {
      throw new NotFoundException('Template not found')
    }

    const isMember = await this.membership.isMember(template.adventureId, userId)
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this adventure')
    }

    return template
  }

  /** Only GMs can update. Attributes are merged non-destructively to preserve existing character values. */
  async update(id: string, userId: string, dto: UpdateTemplateDto) {
    const template = await this.prisma.template.findUnique({ where: { id } })
    if (!template) {
      throw new NotFoundException('Template not found')
    }
    await this.membership.requireRole(template.adventureId, userId, 'GM')

    if (dto.attributes) {
      const existingAttrs = await this.prisma.templateAttribute.findMany({
        where: { templateId: id },
      })

      const newKeys = dto.attributes.map((a) => a.key.trim())
      const existingKeys = existingAttrs.map((a) => a.key)

      // Delete attributes no longer in the new list
      const keysToDelete = existingKeys.filter((k) => !newKeys.includes(k))
      if (keysToDelete.length > 0) {
        await this.prisma.templateAttribute.deleteMany({
          where: { templateId: id, key: { in: keysToDelete } },
        })
      }

      // Upsert: update existing (preserving ID), create new ones
      for (let idx = 0; idx < dto.attributes.length; idx++) {
        const attr = dto.attributes[idx]
        const key = attr.key.trim()
        const existing = existingAttrs.find((a) => a.key === key)

        if (existing) {
          await this.prisma.templateAttribute.update({
            where: { id: existing.id },
            data: {
              name: attr.name.trim(),
              modifier: attr.modifier ?? null,
              order: idx,
            },
          })
        } else {
          await this.prisma.templateAttribute.create({
            data: {
              templateId: id,
              key,
              name: attr.name.trim(),
              modifier: attr.modifier ?? null,
              order: idx,
            },
          })
        }
      }

      // Auto-add new attributes to all existing character sheets based on this template
      const newAttrKeys = newKeys.filter((k) => !existingKeys.includes(k))
      if (newAttrKeys.length > 0) {
        const newAttrs = await this.prisma.templateAttribute.findMany({
          where: { templateId: id, key: { in: newAttrKeys } },
        })

        const sheets = await this.prisma.characterSheet.findMany({
          where: { templateId: id },
          select: { id: true },
        })

        for (const sheet of sheets) {
          for (const attr of newAttrs) {
            await this.prisma.characterSheetValue.upsert({
              where: {
                sheetId_attributeId: { sheetId: sheet.id, attributeId: attr.id },
              },
              create: {
                sheetId: sheet.id,
                attributeId: attr.id,
                value: '',
              },
              update: {},
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

    return this.prisma.template.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: templateInclude,
    })
  }

  /** Only GMs can delete */
  async remove(id: string, userId: string) {
    const template = await this.prisma.template.findUnique({ where: { id } })
    if (!template) {
      throw new NotFoundException('Template not found')
    }
    await this.membership.requireRole(template.adventureId, userId, 'GM')

    return this.prisma.template.delete({ where: { id } })
  }
}