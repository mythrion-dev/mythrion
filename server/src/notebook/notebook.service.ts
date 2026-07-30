import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { RedisService } from '../redis/redis.service.js'
import { MembershipService } from '../membership/membership.service.js'
import { MemberRole } from '../generated/prisma/client.js'
import { CreateFolderDto } from './dto/create-folder.dto.js'
import { CreatePageDto } from './dto/create-page.dto.js'
import { UpdateFolderDto } from './dto/update-folder.dto.js'
import { UpdatePageDto } from './dto/update-page.dto.js'

const CACHE_PREFIX = 'campaign:'
const CACHE_TTL = 300 // 5 minutes

export interface NotebookWithRelations {
  id: string
  adventureId: string
  userId: string
  folders: Array<{
    id: string
    name: string
    sortOrder: number
    pages: Array<{
      id: string
      folderId: string | null
      title: string
      content: string
      sortOrder: number
      createdAt: Date
      updatedAt: Date
    }>
  }>
  pages: Array<{
    id: string
    folderId: string | null
    title: string
    content: string
    sortOrder: number
    createdAt: Date
    updatedAt: Date
  }>
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class NotebookService {
  private readonly logger = new Logger(NotebookService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly membership: MembershipService,
  ) {}

  // ──────────────────────────────────────────────
  //  Cache helpers
  // ──────────────────────────────────────────────

  private cacheKey(adventureId: string, userId: string): string {
    return `${CACHE_PREFIX}${adventureId}:user:${userId}:notebook`
  }

  private async invalidateCache(adventureId: string, userId: string): Promise<void> {
    await this.redis.invalidatePattern(`campaign:${adventureId}:user:${userId}:notebook*`)
  }

  // ──────────────────────────────────────────────
  //  Core: get or create notebook
  // ──────────────────────────────────────────────

  async getOrCreateNotebook(adventureId: string, userId: string): Promise<NotebookWithRelations> {
    const isMember = await this.membership.isMember(adventureId, userId)
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this adventure')
    }

    // Try cache
    const cached = await this.redis.cacheGet<NotebookWithRelations>(this.cacheKey(adventureId, userId))
    if (cached) {
      return cached
    }

    // Find or create the Notebook record
    let notebook = await this.prisma.notebook.findUnique({
      where: { adventureId_userId: { adventureId, userId } },
      include: {
        folders: { orderBy: { sortOrder: 'asc' } },
        pages: { orderBy: { sortOrder: 'asc' } },
      },
    })

    if (!notebook) {
      notebook = await this.prisma.notebook.create({
        data: { adventureId, userId },
        include: {
          folders: { orderBy: { sortOrder: 'asc' } },
          pages: { orderBy: { sortOrder: 'asc' } },
        },
      })
      this.logger.log(`Created notebook for user ${userId} in adventure ${adventureId}`)
    }

    const result: NotebookWithRelations = {
      id: notebook.id,
      adventureId: notebook.adventureId,
      userId: notebook.userId,
      folders: notebook.folders.map((f) => ({
        id: f.id,
        name: f.name,
        sortOrder: f.sortOrder,
        pages: notebook.pages.filter((p) => p.folderId === f.id).map((p) => ({
          id: p.id,
          folderId: p.folderId,
          title: p.title,
          content: p.content,
          sortOrder: p.sortOrder,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
      })),
      pages: notebook.pages.filter((p) => !p.folderId).map((p) => ({
        id: p.id,
        folderId: p.folderId,
        title: p.title,
        content: p.content,
        sortOrder: p.sortOrder,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      createdAt: notebook.createdAt,
      updatedAt: notebook.updatedAt,
    }

    await this.redis.cacheSet(this.cacheKey(adventureId, userId), result, CACHE_TTL)
    return result
  }

  // ──────────────────────────────────────────────
  //  Folders
  // ──────────────────────────────────────────────

  async createFolder(
    adventureId: string,
    userId: string,
    dto: CreateFolderDto,
  ): Promise<NotebookWithRelations['folders'][number]> {
    const notebook = await this.getOrCreateNotebook(adventureId, userId)

    // Determine next sort order
    const maxOrder = notebook.folders.length > 0
      ? Math.max(...notebook.folders.map((f) => f.sortOrder))
      : 0

    const folder = await this.prisma.notebookFolder.create({
      data: {
        notebookId: notebook.id,
        name: dto.name,
        sortOrder: maxOrder + 1,
      },
    })

    await this.invalidateCache(adventureId, userId)

    return {
      id: folder.id,
      name: folder.name,
      sortOrder: folder.sortOrder,
      pages: [],
    }
  }

  async updateFolder(
    adventureId: string,
    userId: string,
    folderId: string,
    dto: UpdateFolderDto,
  ): Promise<NotebookWithRelations['folders'][number]> {
    await this.getOrCreateNotebook(adventureId, userId)

    const folder = await this.prisma.notebookFolder.findUnique({
      where: { id: folderId },
      include: { notebook: true },
    })
    if (!folder || folder.notebook.adventureId !== adventureId || folder.notebook.userId !== userId) {
      throw new NotFoundException('Folder not found')
    }

    const updated = await this.prisma.notebookFolder.update({
      where: { id: folderId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    })

    await this.invalidateCache(adventureId, userId)

    return {
      id: updated.id,
      name: updated.name,
      sortOrder: updated.sortOrder,
      pages: [],
    }
  }

  async deleteFolder(
    adventureId: string,
    userId: string,
    folderId: string,
  ): Promise<void> {
    await this.getOrCreateNotebook(adventureId, userId)

    const folder = await this.prisma.notebookFolder.findUnique({
      where: { id: folderId },
      include: { notebook: true },
    })
    if (!folder || folder.notebook.adventureId !== adventureId || folder.notebook.userId !== userId) {
      throw new NotFoundException('Folder not found')
    }

    // Move orphaned pages to root before deleting the folder
    await this.prisma.notebookPage.updateMany({
      where: { folderId },
      data: { folderId: null },
    })

    await this.prisma.notebookFolder.delete({ where: { id: folderId } })
    await this.invalidateCache(adventureId, userId)
  }

  // ──────────────────────────────────────────────
  //  Pages
  // ──────────────────────────────────────────────

  async createPage(
    adventureId: string,
    userId: string,
    dto: CreatePageDto,
  ): Promise<NotebookWithRelations['pages'][number]> {
    const notebook = await this.getOrCreateNotebook(adventureId, userId)

    // Determine next sort order
    const pages = notebook.pages.concat(
      notebook.folders.flatMap((f) => f.pages),
    )
    const maxOrder = pages.length > 0 ? Math.max(...pages.map((p) => p.sortOrder)) : 0

    const page = await this.prisma.notebookPage.create({
      data: {
        notebookId: notebook.id,
        folderId: dto.folderId ?? null,
        title: dto.title,
        sortOrder: maxOrder + 1,
      },
    })

    await this.invalidateCache(adventureId, userId)

    return {
      id: page.id,
      folderId: page.folderId,
      title: page.title,
      content: page.content,
      sortOrder: page.sortOrder,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    }
  }

  async updatePage(
    adventureId: string,
    userId: string,
    pageId: string,
    dto: UpdatePageDto,
  ): Promise<NotebookWithRelations['pages'][number]> {
    await this.getOrCreateNotebook(adventureId, userId)

    const page = await this.prisma.notebookPage.findUnique({
      where: { id: pageId },
      include: { notebook: true },
    })
    if (!page || page.notebook.adventureId !== adventureId || page.notebook.userId !== userId) {
      throw new NotFoundException('Page not found')
    }

    const updated = await this.prisma.notebookPage.update({
      where: { id: pageId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.folderId !== undefined && { folderId: dto.folderId }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    })

    await this.invalidateCache(adventureId, userId)

    return {
      id: updated.id,
      folderId: updated.folderId,
      title: updated.title,
      content: updated.content,
      sortOrder: updated.sortOrder,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    }
  }

  async deletePage(
    adventureId: string,
    userId: string,
    pageId: string,
  ): Promise<void> {
    await this.getOrCreateNotebook(adventureId, userId)

    const page = await this.prisma.notebookPage.findUnique({
      where: { id: pageId },
      include: { notebook: true },
    })
    if (!page || page.notebook.adventureId !== adventureId || page.notebook.userId !== userId) {
      throw new NotFoundException('Page not found')
    }

    await this.prisma.notebookPage.delete({ where: { id: pageId } })
    await this.invalidateCache(adventureId, userId)
  }

  // ──────────────────────────────────────────────
  //  Reorder (batch)
  // ──────────────────────────────────────────────

  async reorder(
    adventureId: string,
    userId: string,
    items: Array<{
      folderId?: string
      pageId?: string
      sortOrder: number
    }>,
  ): Promise<void> {
    await this.getOrCreateNotebook(adventureId, userId)

    for (const item of items) {
      if (item.folderId) {
        await this.prisma.notebookFolder.update({
          where: { id: item.folderId },
          data: { sortOrder: item.sortOrder },
        })
      } else if (item.pageId) {
        await this.prisma.notebookPage.update({
          where: { id: item.pageId },
          data: { sortOrder: item.sortOrder },
        })
      }
    }

    await this.invalidateCache(adventureId, userId)
  }

  // ──────────────────────────────────────────────
  //  Search
  // ──────────────────────────────────────────────

  async search(
    adventureId: string,
    userId: string,
    query: string,
  ): Promise<Array<{
    id: string
    title: string
    folderName: string | null
    content: string
    updatedAt: Date
  }>> {
    const notebook = await this.getOrCreateNotebook(adventureId, userId)

    const q = query.toLowerCase()

    // Page-level search
    const allPageIds = new Set<string>()
    const allPages = notebook.pages.concat(
      notebook.folders.flatMap((f) => f.pages),
    )

    const results = allPages.filter((page) => {
      // Dedup by id
      if (allPageIds.has(page.id)) return false
      allPageIds.add(page.id)

      const titleMatch = page.title.toLowerCase().includes(q)
      const folder = notebook.folders.find((f) => f.id === page.folderId)
      const folderName = folder?.name ?? null
      const folderMatch = folderName?.toLowerCase().includes(q) ?? false

      // Strip HTML tags for content matching
      const strippedContent = page.content.replace(/<[^>]*>/g, '')
      const contentMatch = strippedContent.toLowerCase().includes(q)

      return titleMatch || folderMatch || contentMatch
    }).map((page) => {
      const folder = notebook.folders.find((f) => f.id === page.folderId)
      return {
        id: page.id,
        title: page.title,
        folderName: folder?.name ?? null,
        content: page.content,
        updatedAt: page.updatedAt,
      }
    })

    return results
  }
}
