import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { MembershipService } from '../membership/membership.service.js'
import { CharacterSheetService } from '../character-sheet/character-sheet.service.js'
import { TemplateService } from '../template/template.service.js'
import { CreateAdventureDto } from './dto/create-adventure.dto.js'
import { UpdateAdventureDto } from './dto/update-adventure.dto.js'

@Injectable()
export class AdventureService {
  private readonly logger = new Logger(AdventureService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly sheetService: CharacterSheetService,
    private readonly templateService: TemplateService,
  ) {}

  async create(userId: string, dto: CreateAdventureDto) {
    const adventure = await this.prisma.adventure.create({
      data: {
        name: dto.name,
        campaign: dto.campaign,
        synopsis: dto.synopsis ?? null,
        maxPlayers: dto.maxPlayers,
        ownerId: userId,
        isPublic: dto.isPublic ?? false,
        sessionWeekday: dto.sessionWeekday ?? null,
        sessionTime: dto.sessionTime ?? null,
        sessionType: dto.sessionType ?? null,
      },
    })

    // Auto-create GM membership for the creator
    await this.membership.createMembership(adventure.id, userId, 'GM')

    // If a templateId was provided, attach it to the adventure
    if (dto.templateId) {
      try {
        await this.templateService.attachToAdventure(dto.templateId, adventure.id, userId)
      } catch (err: any) {
        this.logger.warn(
          `Failed to attach template ${dto.templateId} to adventure ${adventure.id}: ${err.message}`,
        )
        // Don't fail adventure creation — template attachment is optional
      }
    }

    return adventure
  }

  async findAllByUser(userId: string) {
    // Return adventures where user is a member (not just owner)
    return this.membership.getUserAdventures(userId)
  }

  async findOne(id: string, userId: string) {
    const adventure = await this.prisma.adventure.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, displayName: true } },
        _count: { select: { members: { where: { role: 'PLAYER' } } } },
      },
    })
    if (!adventure) {
      throw new NotFoundException('Adventure not found')
    }

    // Check membership
    const isMember = await this.membership.isMember(id, userId)

    // If adventure is public and user is not a member, return limited data
    if (adventure.isPublic && !isMember) {
      const { _count, owner, ...rest } = adventure
      return {
        ...rest,
        owner,
        memberCount: _count.members,
        isPublic: true,
      }
    }

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
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
        ...(dto.sessionWeekday !== undefined && { sessionWeekday: dto.sessionWeekday }),
        ...(dto.sessionTime !== undefined && { sessionTime: dto.sessionTime }),
        ...(dto.sessionType !== undefined && { sessionType: dto.sessionType }),
      },
    })
  }

  /**
   * Toggle adventure visibility (make public or private).
   * GM only.
   */
  async updateVisibility(adventureId: string, userId: string, isPublic: boolean) {
    await this.membership.requireRole(adventureId, userId, 'GM')

    return this.prisma.adventure.update({
      where: { id: adventureId },
      data: { isPublic },
    })
  }

  /**
   * Find public adventures with pagination and optional filters.
   * No auth required.
   */
  async findPublic(params: {
    page?: number
    limit?: number
    campaign?: string
    search?: string
    sessionWeekday?: string
    sessionType?: string
    timePeriod?: 'morning' | 'afternoon' | 'night'
  }) {
    const page = params.page ?? 1
    const limit = params.limit ?? 10
    const skip = (page - 1) * limit

    const where: any = { isPublic: true }

    if (params.campaign) {
      where.campaign = params.campaign
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { synopsis: { contains: params.search, mode: 'insensitive' } },
      ]
    }

    if (params.sessionWeekday) {
      where.sessionWeekday = params.sessionWeekday
    }

    if (params.sessionType) {
      where.sessionType = params.sessionType
    }

    if (params.timePeriod) {
      const timeFilters: Record<string, { gte: string; lt: string }> = {
        morning: { gte: '06:00', lt: '12:00' },
        afternoon: { gte: '12:00', lt: '18:00' },
        night: { gte: '18:00', lt: '24:00' },
      }
      const filter = timeFilters[params.timePeriod]
      where.sessionTime = { gte: filter.gte, lt: filter.lt }
    }

    const [adventures, total] = await this.prisma.$transaction([
      this.prisma.adventure.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          campaign: true,
          synopsis: true,
          maxPlayers: true,
          isPublic: true,
          sessionWeekday: true,
          sessionTime: true,
          sessionType: true,
          createdAt: true,
          owner: { select: { id: true, displayName: true } },
          _count: { select: { members: { where: { role: 'PLAYER' } } } },
        },
      }),
      this.prisma.adventure.count({ where }),
    ])

    const data = adventures.map((a) => ({
      id: a.id,
      name: a.name,
      campaign: a.campaign,
      synopsis: a.synopsis,
      maxPlayers: a.maxPlayers,
      isPublic: a.isPublic,
      sessionWeekday: a.sessionWeekday,
      sessionTime: a.sessionTime,
      sessionType: a.sessionType,
      createdAt: a.createdAt,
      ownerId: a.owner.id,
      gmDisplayName: a.owner.displayName,
      playerCount: a._count.members,
    }))

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Find a single public adventure by ID. Only returns if isPublic=true.
   * No auth required.
   */
  async findPublicById(id: string) {
    const adventure = await this.prisma.adventure.findFirst({
      where: { id, isPublic: true },
      select: {
        id: true,
        name: true,
        campaign: true,
        synopsis: true,
        maxPlayers: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
        sessionWeekday: true,
        sessionTime: true,
        sessionType: true,
        owner: { select: { id: true, displayName: true } },
        _count: { select: { members: { where: { role: 'PLAYER' } } } },
      },
    })

    if (!adventure) {
      throw new NotFoundException('Adventure not found or is not public')
    }

    const { owner, _count, ...rest } = adventure
    return {
      ...rest,
      ownerId: owner.id,
      gmDisplayName: owner.displayName,
      playerCount: _count.members,
    }
  }

  /**
   * Return public adventure with limited fields — suitable for non-members viewing a public adventure.
   * No auth required.
   */
  async findOnePublic(id: string) {
    const adventure = await this.prisma.adventure.findFirst({
      where: { id, isPublic: true },
      select: {
        id: true,
        name: true,
        campaign: true,
        synopsis: true,
        maxPlayers: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
        sessionWeekday: true,
        sessionTime: true,
        sessionType: true,
        owner: { select: { id: true, displayName: true } },
        _count: { select: { members: { where: { role: 'PLAYER' } } } },
      },
    })

    if (!adventure) {
      throw new NotFoundException('Adventure not found or is not public')
    }

    const { owner, _count, ...rest } = adventure
    return {
      ...rest,
      ownerId: owner.id,
      gmDisplayName: owner.displayName,
      playerCount: _count.members,
    }
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
        coreResourceValues: {
          select: {
            current: true,
            maximum: true,
            coreResource: {
              select: { slug: true },
            },
          },
        },
      },
    })

    this.logger.debug(`[DIAGNOSTIC] listNpcs: found ${npcs.length} NPCs`)
    for (const npc of npcs) {
      const hpCrv = npc.coreResourceValues?.find(
        (crv) => crv.coreResource.slug === 'hp',
      )
      this.logger.debug(
        `[DIAGNOSTIC] listNpcs raw: "${npc.characterName}" | ` +
        `hpCrv: ${hpCrv ? `current=${hpCrv.current}, maximum=${hpCrv.maximum}` : 'NOT FOUND'} | ` +
        `legacy hpActual=${npc.hpActual}, hpMax=${npc.hpMax}`,
      )
    }

    return npcs.map(({ coreResourceValues, ...npc }) => {
      const hpResource = coreResourceValues?.find(
        (crv) => crv.coreResource.slug === 'hp',
      )
      // If the HP resource record exists but values are null, it means values
      // were never initialized. Don't fall through to the stale legacy column
      // (which defaults to 0) — return null so the frontend shows "?".
      const hasHpResource = hpResource !== undefined
      const mappedHpActual =
        hpResource?.current ?? (hasHpResource ? null : npc.hpActual)
      const mappedHpMax =
        hpResource?.maximum ?? (hasHpResource ? null : npc.hpMax)
      this.logger.debug(
        `[DIAGNOSTIC] listNpcs mapped: "${npc.characterName}" → hpActual=${mappedHpActual}, hpMax=${mappedHpMax}`,
      )
      return {
        ...npc,
        hpActual: mappedHpActual,
        hpMax: mappedHpMax,
      }
    })
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
      include: { templates: { take: 1, orderBy: { createdAt: 'asc' } } },
    })
    if (!adventure) throw new NotFoundException('Adventure not found')

    // Prefer originalTemplateId (snapshot-based) over legacy templates[0]
    const templateId = adventure.originalTemplateId ?? adventure.templates[0]?.id
    if (!templateId) {
      throw new NotFoundException(
        'No template is attached to this adventure. ' +
        'Attach a template via the adventure settings first, then create NPCs.',
      )
    }

    // Create a full CharacterSheet using the shared service (handles attribute init, skills, etc.)
    // Then flip it to NPC mode
    const sheet = await this.sheetService.create(userId, {
      characterName: dto.name,
      templateId,
      adventureId,
    })

    // ── Initialize HP core resource value ──
    // characterSheetService.create() creates CRV records with null
    // current/maximum.  Initialize HP here so NPC list and sidebar show
    // real values instead of 0/0.
    const sheetCrvs = (sheet as any).coreResourceValues ?? []
    this.logger.debug(
      `[DIAGNOSTIC] createNpc: sheet created "${dto.name}" | templateId=${templateId} | ` +
      `CRVs=${JSON.stringify(sheetCrvs.map((crv: any) => ({ id: crv.id, slug: crv.coreResource?.slug, current: crv.current, maximum: crv.maximum })))}`,
    )
    const hpCrv = sheetCrvs.find(
      (crv: any) => crv.coreResource?.slug === 'hp',
    )
    if (hpCrv && (hpCrv.current === null || hpCrv.maximum === null)) {
      const defaultHp = 10
      this.logger.debug(
        `[DIAGNOSTIC] createNpc: initializing HP for "${dto.name}" | crvId=${hpCrv.id} | setting to ${defaultHp}/${defaultHp}`,
      )
      await this.prisma.characterSheetCoreResourceValue.update({
        where: { id: hpCrv.id },
        data: { current: defaultHp, maximum: defaultHp },
      })
    } else if (!hpCrv) {
      this.logger.warn(
        `[DIAGNOSTIC] createNpc: no HP core resource found for "${dto.name}" | ` +
        `templateId=${templateId} | adventureId=${adventureId} | ` +
        `Available slugs: ${sheetCrvs.map((crv: any) => crv.coreResource?.slug).join(', ')}`,
      )
    }

    // Convert to NPC — set isNpc, npcType, and clear ownerId so only GMs can edit
    const { coreResourceValues: crvValues, ...npcData } =
      await this.prisma.characterSheet.update({
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
          coreResourceValues: {
            select: {
              current: true,
              maximum: true,
              coreResource: {
                select: { slug: true },
              },
            },
          },
        },
      })

    const hpResource = crvValues?.find(
      (crv) => crv.coreResource.slug === 'hp',
    )
    return {
      ...npcData,
      hpActual: hpResource?.current ?? npcData.hpActual,
      hpMax: hpResource?.maximum ?? npcData.hpMax,
    }
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