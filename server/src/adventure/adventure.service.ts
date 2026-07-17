import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { MembershipService } from '../membership/membership.service.js'
import { CharacterSheetService } from '../character-sheet/character-sheet.service.js'
import { CreateAdventureDto } from './dto/create-adventure.dto.js'
import { UpdateAdventureDto } from './dto/update-adventure.dto.js'

@Injectable()
export class AdventureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly sheetService: CharacterSheetService,
  ) {}

  async create(userId: string, dto: CreateAdventureDto) {
    const adventure = await this.prisma.adventure.create({
      data: {
        name: dto.name,
        campaign: dto.campaign,
        synopsis: dto.synopsis ?? null,
        maxPlayers: dto.maxPlayers,
        ownerId: userId,
      },
    })

    // Auto-create GM membership for the creator
    await this.membership.createMembership(adventure.id, userId, 'GM')

    return adventure
  }

  async findAllByUser(userId: string) {
    // Return adventures where user is a member (not just owner)
    return this.membership.getUserAdventures(userId)
  }

  async findOne(id: string, userId: string) {
    const adventure = await this.prisma.adventure.findUnique({ where: { id } })
    if (!adventure) {
      throw new NotFoundException('Adventure not found')
    }

    // Check membership (GMs and players can view)
    const isMember = await this.membership.isMember(id, userId)
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this adventure')
    }

    return adventure
  }

  async update(id: string, userId: string, dto: UpdateAdventureDto) {
    // Only GM can update
    await this.membership.requireRole(id, userId, 'GM')

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
    // Only GM can delete
    await this.membership.requireRole(id, userId, 'GM')

    return this.prisma.adventure.delete({ where: { id } })
  }

  // ── NPC / Mob Management ──

  /**
   * Fetch all NPCs for this adventure — standalone CharacterSheets with isNpc=true.
   * GM-only. Returns a lightweight list for the sidebar (full sheet loaded on navigate).
   */
  async listNpcs(adventureId: string, userId: string) {
    await this.membership.requireRole(adventureId, userId, 'GM')

    const npcs = await this.prisma.characterSheet.findMany({
      where: { adventureId, isNpc: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        characterName: true,
        isNpc: true,
        npcType: true,
        level: true,
        hpActual: true,
        hpMax: true,
        createdAt: true,
        template: {
          select: { id: true, name: true },
        },
      },
    })

    return npcs
  }

  /**
   * Create a new NPC as a standalone CharacterSheet.
   * GM-only. Uses the adventure's first template for initialization.
   */
  async createNpc(
    adventureId: string,
    userId: string,
    dto: {
      name: string
      type?: string       // "NPC" | "MOB"
      description?: string
      notes?: string
    },
  ) {
    await this.membership.requireRole(adventureId, userId, 'GM')

    const adventure = await this.prisma.adventure.findUnique({
      where: { id: adventureId },
      include: { templates: { take: 1 } },
    })
    if (!adventure) throw new NotFoundException('Adventure not found')

    const templateId = adventure.templates[0]?.id
    if (!templateId) {
      throw new NotFoundException('No template exists for this adventure — create one first')
    }

    // Create a full CharacterSheet using the shared service (handles attribute init, skills, etc.)
    // Then flip it to NPC mode
    const sheet = await this.sheetService.create(userId, {
      characterName: dto.name,
      templateId,
      adventureId,
    })

    // Convert to NPC — set isNpc, npcType, and clear ownerId so only GMs can edit
    return this.prisma.characterSheet.update({
      where: { id: sheet.id },
      data: {
        isNpc: true,
        npcType: dto.type ?? 'NPC',
        ownerId: null,
        playerName: dto.description ?? null,
      },
      select: {
        id: true,
        characterName: true,
        isNpc: true,
        npcType: true,
        level: true,
        hpActual: true,
        hpMax: true,
        template: { select: { id: true, name: true } },
      },
    })
  }

  /**
   * Update an NPC's basic metadata (name, description).
   * GM-only.
   */
  async updateNpc(
    adventureId: string,
    npcId: string,
    userId: string,
    dto: { name?: string; description?: string; notes?: string },
  ) {
    await this.membership.requireRole(adventureId, userId, 'GM')

    const npc = await this.prisma.characterSheet.findUnique({
      where: { id: npcId },
      select: { id: true, adventureId: true, isNpc: true },
    })
    if (!npc) throw new NotFoundException('NPC not found')
    if (npc.adventureId !== adventureId) {
      throw new ForbiddenException('NPC does not belong to this adventure')
    }
    if (!npc.isNpc) {
      throw new ForbiddenException('Not a valid NPC sheet')
    }

    return this.sheetService.update(npcId, userId, {
      characterName: dto.name,
      playerName: dto.description,
    })
  }

  /**
   * Delete an NPC (standalone CharacterSheet).
   * GM-only.
   */
  async deleteNpc(adventureId: string, npcId: string, userId: string) {
    await this.membership.requireRole(adventureId, userId, 'GM')

    const npc = await this.prisma.characterSheet.findUnique({
      where: { id: npcId },
      select: { id: true, adventureId: true, isNpc: true },
    })
    if (!npc) throw new NotFoundException('NPC not found')
    if (npc.adventureId !== adventureId) {
      throw new ForbiddenException('NPC does not belong to this adventure')
    }
    if (!npc.isNpc) {
      throw new ForbiddenException('Not a valid NPC sheet')
    }

    return this.sheetService.remove(npcId, userId)
  }
}