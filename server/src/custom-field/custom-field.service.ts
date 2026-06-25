import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { CreateCustomFieldDto } from './dto/create-custom-field.dto.js'

@Injectable()
export class CustomFieldService {
  constructor(private readonly prisma: PrismaService) {}

  async create(sheetId: string, userId: string, dto: CreateCustomFieldDto) {
    // Verify sheet exists and user is the owner
    const sheet = await this.prisma.characterSheet.findUnique({
      where: { id: sheetId },
    })
    if (!sheet) throw new NotFoundException('Character sheet not found')
    if (sheet.ownerId !== userId) throw new ForbiddenException('Only the owner can add custom fields')

    return this.prisma.customField.create({
      data: {
        characterSheetId: sheetId,
        label: dto.label,
        value: dto.value,
      },
    })
  }

  async findAllBySheet(sheetId: string) {
    return this.prisma.customField.findMany({
      where: { characterSheetId: sheetId },
      orderBy: { createdAt: 'asc' },
    })
  }

  async update(id: string, userId: string, dto: CreateCustomFieldDto) {
    const field = await this.prisma.customField.findUnique({
      where: { id },
      include: { characterSheet: { select: { ownerId: true } } },
    })
    if (!field) throw new NotFoundException('Custom field not found')
    if (field.characterSheet.ownerId !== userId) throw new ForbiddenException('Only the owner can edit custom fields')

    return this.prisma.customField.update({
      where: { id },
      data: { label: dto.label, value: dto.value },
    })
  }

  async remove(id: string, userId: string) {
    const field = await this.prisma.customField.findUnique({
      where: { id },
      include: { characterSheet: { select: { ownerId: true } } },
    })
    if (!field) throw new NotFoundException('Custom field not found')
    if (field.characterSheet.ownerId !== userId) throw new ForbiddenException('Only the owner can delete custom fields')

    return this.prisma.customField.delete({ where: { id } })
  }
}