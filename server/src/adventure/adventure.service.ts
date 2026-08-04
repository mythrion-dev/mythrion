import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import { I18nService } from 'nestjs-i18n'
import { PrismaService } from '../prisma.service.js'
import { Prisma } from '../generated/prisma/client.js'
import { splitSearchTokens, escapeLike } from '../community/search.util.js'
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
    private readonly i18n: I18nService,
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
      throw new NotFoundException(this.i18n.t('adventure.notFound'))
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
      throw new ForbiddenException(this.i18n.t('adventure.notMemberAdventure'))
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

    // Route to the ranked (raw-SQL) path only when there is at least one real
    // search token; whitespace-only queries fall back to the plain listing.
    const search = params.search
    const hasSearch = search
      ? splitSearchTokens(search).length > 0
      : false

    const { rows, total } = hasSearch && search
      ? await this.findPublicRanked({ ...params, search, page, limit, skip })
      : await this.findPublicPlain({ ...params, page, limit, skip })

    let data = rows.map((a) => ({
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

    // Exclude campaigns that have reached maximum player capacity
    const filteredCount = data.length
    data = data.filter((a) => a.playerCount < a.maxPlayers)
    const removedCount = filteredCount - data.length

    return {
      data,
      total: Math.max(0, total - removedCount),
      page,
      totalPages: Math.max(1, Math.ceil((total - removedCount) / limit)),
    }
  }

  /**
   * Plain listing path — no meaningful search term. Same filters and select as
   * the ranked path, but lets Prisma do the ordering and pagination.
   */
  private async findPublicPlain(params: {
    page: number
    limit: number
    skip: number
    campaign?: string
    sessionWeekday?: string
    sessionType?: string
    timePeriod?: 'morning' | 'afternoon' | 'night'
  }) {
    const where: any = { isPublic: true }

    if (params.campaign) {
      where.campaign = params.campaign
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
        skip: params.skip,
        take: params.limit,
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

    return { rows: adventures, total }
  }

  /**
   * Ranked search path. Finds and orders matching IDs entirely in SQL —
   * accent- and case-insensitive, tokenized, ranked by name-match quality —
   * then hydrates full rows with a normal Prisma findMany and reorders them
   * to the SQL order so relevance ranking survives pagination.
   */
  private async findPublicRanked(params: {
    page: number
    limit: number
    skip: number
    campaign?: string
    search: string
    sessionWeekday?: string
    sessionType?: string
    timePeriod?: 'morning' | 'afternoon' | 'night'
  }) {
    const { limit, skip } = params
    const tokens = splitSearchTokens(params.search).map((t) => escapeLike(t))

    // Per-token score: exact name > name prefix > name substring > other fields.
    const scoreParts = tokens.map((tok) =>
      Prisma.sql`CASE WHEN search_norm(a."name") = search_norm(${tok}) THEN 0 WHEN search_norm(a."name") LIKE (search_norm(${tok}) || '%') THEN 1 WHEN search_norm(a."name") LIKE ('%' || search_norm(${tok}) || '%') THEN 2 ELSE 3 END`,
    )

    // Per-token filter: the token must appear in at least one searchable field.
    const tokenClauses = tokens.map((tok) =>
      Prisma.sql`(
        search_norm(a."name") = search_norm(${tok})
        OR search_norm(a."name") LIKE (search_norm(${tok}) || '%')
        OR search_norm(a."name") LIKE ('%' || search_norm(${tok}) || '%')
        OR search_norm(COALESCE(a."campaign", '')) LIKE ('%' || search_norm(${tok}) || '%')
        OR search_norm(COALESCE(a."synopsis", '')) LIKE ('%' || search_norm(${tok}) || '%')
        OR search_norm(COALESCE(owner."displayName", '')) LIKE ('%' || search_norm(${tok}) || '%')
      )`,
    )

    const ands: Prisma.Sql[] = [Prisma.sql`a."isPublic" = true`]

    if (params.campaign) {
      ands.push(Prisma.sql`a."campaign" = ${params.campaign}`)
    }
    if (params.sessionWeekday) {
      ands.push(Prisma.sql`a."sessionWeekday" = ${params.sessionWeekday}`)
    }
    if (params.sessionType) {
      ands.push(Prisma.sql`a."sessionType" = ${params.sessionType}`)
    }
    if (params.timePeriod) {
      const timeFilters: Record<string, { gte: string; lt: string }> = {
        morning: { gte: '06:00', lt: '12:00' },
        afternoon: { gte: '12:00', lt: '18:00' },
        night: { gte: '18:00', lt: '24:00' },
      }
      const filter = timeFilters[params.timePeriod]
      ands.push(Prisma.sql`a."sessionTime" >= ${filter.gte}`)
      ands.push(Prisma.sql`a."sessionTime" < ${filter.lt}`)
    }

    const query = Prisma.sql`
      WITH matched AS (
        SELECT a."id" AS id, a."createdAt" AS created_at,
          (${Prisma.join(scoreParts, ' + ')}) AS score
        FROM "Adventure" a
        LEFT JOIN "User" owner ON owner."id" = a."ownerId"
        WHERE ${Prisma.join(ands, ' AND ')}
          AND (${Prisma.join(tokenClauses, ' AND ')})
      ),
      ordered AS (
        SELECT id, created_at, score,
          ROW_NUMBER() OVER (ORDER BY score ASC, created_at DESC) AS rn
        FROM matched
      )
      SELECT
        (SELECT COUNT(*)::int FROM matched) AS total,
        COALESCE(
          (SELECT jsonb_agg(id ORDER BY rn) FROM ordered WHERE rn > ${skip} AND rn <= ${skip + limit}),
          '[]'::jsonb
        ) AS ids
    `

    const [result] = await this.prisma.$queryRaw<
      { total: number; ids: string[] | null }[]
    >(query)

    const total = result?.total ?? 0
    const ids = result?.ids ?? []

    if (ids.length === 0) {
      return { rows: [], total }
    }

    const adventures = await this.prisma.adventure.findMany({
      where: { id: { in: ids } },
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
    })

    const byId = new Map(adventures.map((a) => [a.id, a] as const))
    const rows = ids
      .map((id) => byId.get(id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))

    return { rows, total }
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
      throw new NotFoundException(this.i18n.t('adventure.notFoundOrNotPublic'))
    }

    // Hide campaigns that have reached maximum player capacity
    if (adventure._count.members >= adventure.maxPlayers) {
      throw new NotFoundException(this.i18n.t('adventure.notFoundOrNotPublic'))
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
      throw new NotFoundException(this.i18n.t('adventure.notFoundOrNotPublic'))
    }

    // Hide campaigns that have reached maximum player capacity
    if (adventure._count.members >= adventure.maxPlayers) {
      throw new NotFoundException(this.i18n.t('adventure.notFoundOrNotPublic'))
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
    if (!adventure) throw new NotFoundException(this.i18n.t('adventure.notFound'))

    // Prefer originalTemplateId (snapshot-based) over legacy templates[0]
    const templateId = adventure.originalTemplateId ?? adventure.templates[0]?.id
    if (!templateId) {
      throw new NotFoundException(
        this.i18n.t('adventure.noTemplateAttached'),
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
    if (!npc) throw new NotFoundException(this.i18n.t('adventure.npcNotFound'))
    if (npc.adventureId !== adventureId) {
      throw new ForbiddenException(this.i18n.t('adventure.npcNotBelong'))
    }
    if (!npc.isNpc) {
      throw new ForbiddenException(this.i18n.t('adventure.notValidNpcSheet'))
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
    if (!npc) throw new NotFoundException(this.i18n.t('adventure.npcNotFound'))
    if (npc.adventureId !== adventureId) {
      throw new ForbiddenException(this.i18n.t('adventure.npcNotBelong'))
    }
    if (!npc.isNpc) {
      throw new ForbiddenException(this.i18n.t('adventure.notValidNpcSheet'))
    }

    return this.sheetService.remove(npcId, userId)
  }
}