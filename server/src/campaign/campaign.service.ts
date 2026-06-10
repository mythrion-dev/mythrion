import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { CreateCampaignDto } from './dto/create-campaign.dto.js'
import { UpdateCampaignDto } from './dto/update-campaign.dto.js'

@Injectable()
export class CampaignService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        ownerId: userId,
      },
    })
  }

  async findAllByUser(userId: string) {
    return this.prisma.campaign.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } })
    if (!campaign) {
      throw new NotFoundException('Campaign not found')
    }
    if (campaign.ownerId !== userId) {
      throw new ForbiddenException('You do not own this campaign')
    }
    return campaign
  }

  async update(id: string, userId: string, dto: UpdateCampaignDto) {
    await this.findOne(id, userId)
    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    })
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId)
    return this.prisma.campaign.delete({ where: { id } })
  }
}