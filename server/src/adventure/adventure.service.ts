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
   * Get or create the hidden NPC sheet for an adventure.
   * Uses the adventure's first template, or creates a minimal one.
   * Only GMs can access NPC management.
   */
  private async getOrCreateNpcSheet(adventureId: string, userId: string) {
    const adventure = await this.prisma.adventure.findUnique({
      where: { id: adventureId },
      include: { templates: { take: 1 } },
    })
    if (!adventure) throw new NotFoundException('Adventure not found')

    if (adventure.npcSheetId) {
      const sheet = await this.prisma.characterSheet.findUnique({
        where: { id: adventure.npcSheetId },
      })
      if (sheet) return sheet
    }

    // No NPC sheet yet — create one
    const templateId = adventure.templates[0]?.id
    if (!templateId) {
      throw new NotFoundException('No template exists for this adventure — create one first')
    }

    const sheet = await this.prisma.characterSheet.create({
      data: {
        characterName: '[NPC Sheet]',
        playerName: null,
        level: 1,
        hpActual: 0,
        hpMax: 0,
        templateId,
        adventureId,
        ownerId: userId,
      },
    })

    await this.prisma.adventure.update({
      where: { id: adventureId },
      data: { npcSheetId: sheet.id },
    })

    return sheet
  }

  /**
   * Fetch all NPCs (summon abilities) on the campaign's hidden NPC sheet.
   * GM-only.
   */
  async listNpcs(adventureId: string, userId: string) {
    await this.membership.requireRole(adventureId, userId, 'GM')

    const sheet = await this.getOrCreateNpcSheet(adventureId, userId)

    const abilities = await this.prisma.characterAbility.findMany({
      where: { sheetId: sheet.id, summonId: null, type: 'SUMMON' },
      orderBy: { order: 'asc' },
    })

    return { sheetId: sheet.id, npcs: abilities }
  }

  /**
   * Create a new NPC (summon ability) on the campaign's hidden NPC sheet.
   * GM-only. Initialises template attributes, AC fields, health, resistances, and skills
   * on the summon from the template defaults.
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

    const sheet = await this.getOrCreateNpcSheet(adventureId, userId)

    // Use the existing createAbility method from CharacterSheetService
    // which handles creating all sub-records (attributes, AC, health, etc.)
    const ability = await this.sheetService.createAbility(
      sheet.id,
      userId,
      {
        name: dto.name,
        type: 'SUMMON',
        description: dto.description ?? null,
        notes: dto.notes ?? null,
        // Store the NPC type (NPC/MOB) in the notes field since there's no dedicated field
      },
    )

    // If type is MOB, append it to notes so we can distinguish
    if (dto.type === 'MOB' && ability.notes) {
      const updated = await this.prisma.characterAbility.update({
        where: { id: ability.id },
        data: { notes: `[MOB] ${ability.notes}` },
      })
      return updated
    }

    return ability
  }

  /**
   * Update an NPC's basic metadata (name, description, notes).
   * GM-only.
   */
  async updateNpc(
    adventureId: string,
    abilityId: string,
    userId: string,
    dto: { name?: string; description?: string; notes?: string },
  ) {
    await this.membership.requireRole(adventureId, userId, 'GM')

    const ability = await this.prisma.characterAbility.findUnique({
      where: { id: abilityId },
      include: { sheet: true },
    })
    if (!ability) throw new NotFoundException('NPC not found')
    if (ability.sheet.adventureId !== adventureId) {
      throw new ForbiddenException('NPC does not belong to this adventure')
    }
    if (ability.type !== 'SUMMON') {
      throw new ForbiddenException('Not a valid NPC ability')
    }

    return this.sheetService.updateAbility(abilityId, userId, dto)
  }

  /**
   * Delete an NPC (summon ability) from the campaign's hidden NPC sheet.
   * GM-only.
   */
  async deleteNpc(adventureId: string, abilityId: string, userId: string) {
    await this.membership.requireRole(adventureId, userId, 'GM')

    const ability = await this.prisma.characterAbility.findUnique({
      where: { id: abilityId },
      include: { sheet: true },
    })
    if (!ability) throw new NotFoundException('NPC not found')
    if (ability.sheet.adventureId !== adventureId) {
      throw new ForbiddenException('NPC does not belong to this adventure')
    }
    if (ability.type !== 'SUMMON') {
      throw new ForbiddenException('Not a valid NPC ability')
    }

    return this.sheetService.removeAbility(abilityId, userId)
  }
}