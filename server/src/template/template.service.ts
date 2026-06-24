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

  /** Only GMs can update */
  async update(id: string, userId: string, dto: UpdateTemplateDto) {
    const template = await this.prisma.template.findUnique({ where: { id } })
    if (!template) {
      throw new NotFoundException('Template not found')
    }
    await this.membership.requireRole(template.adventureId, userId, 'GM')

    // If attributes are provided, replace them entirely
    if (dto.attributes) {
      // Delete old attributes and recreate
      await this.prisma.templateAttribute.deleteMany({
        where: { templateId: id },
      })

      return this.prisma.template.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          attributes: {
            create: dto.attributes.map((attr, idx) => ({
              key: attr.key,
              name: attr.name,
              order: idx,
            })),
          },
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