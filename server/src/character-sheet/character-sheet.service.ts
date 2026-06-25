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
    select: { id: true, name: true, attributes: { orderBy: { order: 'asc' as const } } },
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
}

@Injectable()
export class CharacterSheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  /** Create a character sheet from a template. The user must be a member of the template's adventure. */
  async create(userId: string, dto: CreateCharacterSheetDto) {
    // Fetch the template to verify access and get adventureId
    const template = await this.prisma.template.findUnique({
      where: { id: dto.templateId },
      include: { attributes: true, templateFields: true },
    })
    if (!template) {
      throw new NotFoundException('Template not found')
    }

    // Determine adventureId: use provided one, or inherit from template
    const adventureId = dto.adventureId !== undefined
      ? (dto.adventureId || null) // empty string = no campaign
      : template.adventureId

    // If linking to a campaign, verify membership
    if (adventureId) {
      const isMember = await this.membership.isMember(adventureId, userId)
      if (!isMember) {
        throw new ForbiddenException('You are not a member of this adventure')
      }
    }

    // Create sheet with values for every template attribute
    const sheet = await this.prisma.characterSheet.create({
      data: {
        characterName: dto.characterName,
        playerName: dto.playerName ?? null,
        level: dto.level ?? 1,
        adventureId: adventureId || null,
        templateId: template.id,
        ownerId: userId,
        values: {
          create: template.attributes.map((attr) => ({
            attributeId: attr.id,
            value: '',
          })),
        },
        fieldValues: {
          create: template.templateFields?.map((f) => ({
            templateFieldId: f.id,
            value: '',
          })) || [],
        },
      },
      include: sheetInclude,
    })

    return sheet
  }

  /** Return all character sheets owned by the current user */
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

  /** Return all character sheets for a given adventure (members only) */
  async findAllByAdventure(adventureId: string, userId: string) {
    const isMember = await this.membership.isMember(adventureId, userId)
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this adventure')
    }

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
    const sheet = await this.prisma.characterSheet.findUnique({
      where: { id },
      include: sheetInclude,
    })
    if (!sheet) {
      throw new NotFoundException('Character sheet not found')
    }

    // Must be either the owner or a member of the adventure
    if (sheet.ownerId !== userId) {
      if (!sheet.adventureId) {
        throw new ForbiddenException('You do not have access to this character sheet')
      }
      const isMember = await this.membership.isMember(sheet.adventureId, userId)
      if (!isMember) {
        throw new ForbiddenException('You do not have access to this character sheet')
      }
    }

    return sheet
  }

  /** Only the owner can update their sheet */
  async update(id: string, userId: string, dto: UpdateCharacterSheetDto) {
    const sheet = await this.prisma.characterSheet.findUnique({ where: { id } })
    if (!sheet) {
      throw new NotFoundException('Character sheet not found')
    }
    if (sheet.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can edit this character sheet')
    }

    // If values are provided, upsert each one
    if (dto.values) {
      for (const v of dto.values) {
        await this.prisma.characterSheetValue.upsert({
          where: {
            sheetId_attributeId: { sheetId: id, attributeId: v.attributeId },
          },
          create: {
            sheetId: id,
            attributeId: v.attributeId,
            value: v.value,
          },
          update: { value: v.value },
        })
      }
    }

    // If fieldValues are provided, upsert each one
    if (dto.fieldValues) {
      for (const fv of dto.fieldValues) {
        await this.prisma.characterSheetFieldValue.upsert({
          where: {
            sheetId_templateFieldId: { sheetId: id, templateFieldId: fv.templateFieldId },
          },
          create: {
            sheetId: id,
            templateFieldId: fv.templateFieldId,
            value: fv.value,
          },
          update: { value: fv.value },
        })
      }
    }

    return this.prisma.characterSheet.update({
      where: { id },
      data: {
        ...(dto.characterName !== undefined && { characterName: dto.characterName }),
        ...(dto.playerName !== undefined && { playerName: dto.playerName }),
        ...(dto.level !== undefined && { level: dto.level }),
      },
      include: sheetInclude,
    })
  }

  /** Only the owner can delete their sheet */
  async remove(id: string, userId: string) {
    const sheet = await this.prisma.characterSheet.findUnique({ where: { id } })
    if (!sheet) {
      throw new NotFoundException('Character sheet not found')
    }
    if (sheet.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete this character sheet')
    }

    return this.prisma.characterSheet.delete({ where: { id } })
  }

  /** Link an existing sheet to a campaign. Only the owner can do this. */
  async linkToAdventure(sheetId: string, adventureId: string, userId: string) {
    const sheet = await this.prisma.characterSheet.findUnique({
      where: { id: sheetId },
    })
    if (!sheet) {
      throw new NotFoundException('Character sheet not found')
    }
    if (sheet.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can link this character sheet')
    }

    // Verify user is a member of the target adventure
    const isMember = await this.membership.isMember(adventureId, userId)
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this adventure')
    }

    return this.prisma.characterSheet.update({
      where: { id: sheetId },
      data: { adventureId },
      include: sheetInclude,
    })
  }

  /** Unlink a sheet from a campaign. Owner or GM of the campaign can do this. */
  async unlinkFromAdventure(sheetId: string, userId: string) {
    const sheet = await this.prisma.characterSheet.findUnique({
      where: { id: sheetId },
    })
    if (!sheet) {
      throw new NotFoundException('Character sheet not found')
    }

    // Only the owner or a GM of the campaign can unlink
    if (sheet.ownerId !== userId) {
      if (!sheet.adventureId) {
        throw new ForbiddenException('Only the owner can unlink this character sheet')
      }
      // Check if user is GM of the campaign
      try {
        await this.membership.requireRole(sheet.adventureId, userId, 'GM')
      } catch {
        throw new ForbiddenException('Only the owner or a GM can unlink this character sheet')
      }
    }

    return this.prisma.characterSheet.update({
      where: { id: sheetId },
      data: { adventureId: null },
      include: sheetInclude,
    })
  }
}