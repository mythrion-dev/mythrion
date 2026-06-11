import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { CreateAdventureDto } from './dto/create-adventure.dto.js'
import { UpdateAdventureDto } from './dto/update-adventure.dto.js'

@Injectable()
export class AdventureService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAdventureDto) {
    return this.prisma.adventure.create({
      data: {
        name: dto.name,
        campaign: dto.campaign,
        synopsis: dto.synopsis ?? null,
        maxPlayers: dto.maxPlayers,
        ownerId: userId,
      },
    })
  }

  async findAllByUser(userId: string) {
    return this.prisma.adventure.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string, userId: string) {
    const adventure = await this.prisma.adventure.findUnique({ where: { id } })
    if (!adventure) {
      throw new NotFoundException('Adventure not found')
    }
    if (adventure.ownerId !== userId) {
      throw new ForbiddenException('You do not own this adventure')
    }
    return adventure
  }

  async update(id: string, userId: string, dto: UpdateAdventureDto) {
    await this.findOne(id, userId)
    return this.prisma.adventure.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.campaign !== undefined && { campaign: dto.campaign }),
        ...(dto.synopsis !== undefined && { synopsis: dto.synopsis }),
        ...(dto.maxPlayers !== undefined && { maxPlayers: dto.maxPlayers }),
      },
    })
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId)
    return this.prisma.adventure.delete({ where: { id } })
  }
}