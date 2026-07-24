import { Injectable, OnModuleInit, Logger, NotFoundException, ForbiddenException } from '@nestjs/common'
import { MongoClient, GridFSBucket, ObjectId, type Db, type ObjectId as MongoObjectId } from 'mongodb'
import { Readable } from 'stream'
import { PrismaService } from '../prisma.service.js'
import { RedisService } from '../redis/redis.service.js'
import { MembershipService } from '../membership/membership.service.js'
import { BookVisibility, MemberRole } from '../generated/prisma/client.js'
import { CreateBookDto } from './dto/create-book.dto.js'
import { UpdateBookDto } from './dto/update-book.dto.js'

const BUCKET_NAME = 'campaign-books'
const CACHE_PREFIX = 'books:'
const CACHE_TTL = 300 // 5 minutes

interface GridFsFile {
  _id: MongoObjectId
  filename: string
  metadata?: { bookId?: string; adventureId?: string; contentType?: string; originalName?: string }
  length: number
  uploadDate: Date
}

export interface BookListItem {
  id: string
  name: string
  visibility: BookVisibility
  fileLength: number
  createdAt: string
  updatedAt: string
}

@Injectable()
export class BookService implements OnModuleInit {
  private readonly logger = new Logger(BookService.name)
  private client: MongoClient | null = null
  private db: Db | null = null
  private bucket: GridFSBucket | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly membership: MembershipService,
  ) {}

  async onModuleInit() {
    const uri = process.env.MONGO_URL
    if (!uri) {
      this.logger.warn('MONGO_URL not set — book uploads will be unavailable')
      return
    }

    try {
      this.client = new MongoClient(uri)
      await this.client.connect()
      this.db = this.client.db()
      this.bucket = new GridFSBucket(this.db, { bucketName: BUCKET_NAME })
      this.logger.log('Connected to MongoDB for campaign-books storage')
    } catch (err) {
      this.logger.error('Failed to connect to MongoDB', err)
    }
  }

  /** Guard: throw if not connected to GridFS */
  private ensureReady() {
    if (!this.bucket || !this.db) {
      throw new NotFoundException('Book storage is not available')
    }
  }

  private cacheKey(adventureId: string): string {
    return `${CACHE_PREFIX}${adventureId}:list`
  }

  // ──────────────────────────────────────────────
  //  Public API methods
  // ──────────────────────────────────────────────

  /**
   * List books for an adventure.
   * GM sees all books; Player sees only PLAYER_BOOK visibility.
   * Metadata is cached in Redis for 5 minutes.
   */
  async list(adventureId: string, userId: string): Promise<BookListItem[]> {
    // Try cache first (cache always stores the full GM-view list)
    const cached = await this.redis.cacheGet<BookListItem[]>(this.cacheKey(adventureId))
    if (cached) {
      return this.filterByVisibility(cached, adventureId, userId)
    }

    const books = await this.prisma.book.findMany({
      where: { adventureId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        visibility: true,
        fileLength: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const items: BookListItem[] = books.map((b) => ({
      id: b.id,
      name: b.name,
      visibility: b.visibility as BookVisibility,
      fileLength: b.fileLength,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }))

    // Cache the full list (Redis will no-op if unavailable)
    await this.redis.cacheSet(this.cacheKey(adventureId), items, CACHE_TTL)

    return this.filterByVisibility(items, adventureId, userId)
  }

  /**
   * Create a book: upload file to GridFS, store metadata in Prisma.
   * GM only.
   */
  async create(
    adventureId: string,
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    dto: CreateBookDto,
  ): Promise<BookListItem> {
    await this.membership.requireRole(adventureId, userId, MemberRole.GM)

    // Create the Prisma record first (to get an ID for GridFS metadata)
    const book = await this.prisma.book.create({
      data: {
        adventureId,
        name: dto.name,
        visibility: dto.visibility ?? BookVisibility.GM_BOOK,
        fileLength: file.buffer.length,
      },
    })

    // Upload file to GridFS
    this.ensureReady()
    let gridfsFileId: string | null = null

    try {
      gridfsFileId = await this.uploadToGridFS(book.id, adventureId, file)

      // Update the Prisma record with the GridFS file reference and exact length
      await this.prisma.book.update({
        where: { id: book.id },
        data: { gridfsFileId, fileLength: file.buffer.length },
      })

      this.logger.log(`Uploaded book "${dto.name}" (${book.id}) for adventure ${adventureId}`)
    } catch (err) {
      // Cleanup: delete the Prisma record if GridFS upload failed
      await this.prisma.book.delete({ where: { id: book.id } }).catch(() => {})
      this.logger.error(`Failed to upload book "${dto.name}" to GridFS`, err)
      throw new NotFoundException('Failed to upload book file')
    }

    await this.invalidateCache(adventureId)

    return {
      id: book.id,
      name: book.name,
      visibility: book.visibility as BookVisibility,
      fileLength: book.fileLength,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
    }
  }

  /**
   * Resolve a book for access (auth + visibility checks).
   * Returns the Prisma book record or throws.
   */
  private async resolveBookForAccess(
    adventureId: string,
    bookId: string,
    userId: string,
  ) {
    const isMember = await this.membership.isMember(adventureId, userId)
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this adventure')
    }

    const book = await this.prisma.book.findUnique({ where: { id: bookId } })
    if (!book || book.adventureId !== adventureId) {
      throw new NotFoundException('Book not found')
    }

    // Player cannot access GM_BOOK
    if (book.visibility === BookVisibility.GM_BOOK) {
      await this.membership.requireRole(adventureId, userId, MemberRole.GM)
    }

    if (!book.gridfsFileId) {
      throw new NotFoundException('Book file not found (no file uploaded)')
    }

    return book
  }

  /**
   * Look up the GridFS file metadata and return the file document.
   */
  private async getGridFsFile(gridfsFileId: string): Promise<GridFsFile> {
    this.ensureReady()

    const files = await this.db!
      .collection(`${BUCKET_NAME}.files`)
      .find({ _id: new ObjectId(gridfsFileId) })
      .limit(1)
      .toArray()

    if (files.length === 0) {
      throw new NotFoundException('Book file not found in storage')
    }

    return files[0] as unknown as GridFsFile
  }

  /**
   * Stream a book's PDF file.
   * Both GM and Player can access, but Player cannot access GM_BOOK.
   */
  async getStream(
    adventureId: string,
    bookId: string,
    userId: string,
  ): Promise<{ stream: Readable; contentType: string; contentLength: number; fileSize: number }> {
    const { stream, fileSize } = await this.getStreamRange(adventureId, bookId, userId)
    return { stream, contentType: 'application/pdf', contentLength: fileSize, fileSize }
  }

  /**
   * Stream a book's PDF file with optional byte range.
   * When start and end are provided, only that byte range is streamed via
   * GridFS's built-in byte-range support.
   */
  async getStreamRange(
    adventureId: string,
    bookId: string,
    userId: string,
    start?: number,
    end?: number,
  ): Promise<{ stream: Readable; contentType: string; contentLength: number; fileSize: number; isPartial: boolean }> {
    const book = await this.resolveBookForAccess(adventureId, bookId, userId)
    const gridFile = await this.getGridFsFile(book.gridfsFileId!)

    const fileSize = gridFile.length
    const isPartial = start !== undefined && end !== undefined

    const stream = isPartial
      ? this.bucket!.openDownloadStream(gridFile._id, { start, end })
      : this.bucket!.openDownloadStream(gridFile._id)

    const contentLength = isPartial ? end - start + 1 : fileSize

    return {
      stream,
      contentType: 'application/pdf',
      contentLength,
      fileSize,
      isPartial,
    }
  }

  /**
   * Update book metadata (name, visibility). GM only.
   */
  async update(
    adventureId: string,
    bookId: string,
    userId: string,
    dto: UpdateBookDto,
  ): Promise<BookListItem> {
    await this.membership.requireRole(adventureId, userId, MemberRole.GM)

    const book = await this.prisma.book.findUnique({ where: { id: bookId } })
    if (!book || book.adventureId !== adventureId) {
      throw new NotFoundException('Book not found')
    }

    const updated = await this.prisma.book.update({
      where: { id: bookId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.visibility !== undefined && { visibility: dto.visibility }),
      },
    })

    await this.invalidateCache(adventureId)

    return {
      id: updated.id,
      name: updated.name,
      visibility: updated.visibility as BookVisibility,
      fileLength: updated.fileLength,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }
  }

  /**
   * Replace a book's PDF file. GM only.
   */
  async replaceFile(
    adventureId: string,
    bookId: string,
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<BookListItem> {
    await this.membership.requireRole(adventureId, userId, MemberRole.GM)

    const book = await this.prisma.book.findUnique({ where: { id: bookId } })
    if (!book || book.adventureId !== adventureId) {
      throw new NotFoundException('Book not found')
    }

    this.ensureReady()

    // Delete old GridFS file if it exists
    if (book.gridfsFileId) {
      await this.deleteFromGridFS(book.gridfsFileId)
    }

    // Upload new file
    const gridfsFileId = await this.uploadToGridFS(bookId, adventureId, file)

    // Update the Prisma record
    const updated = await this.prisma.book.update({
      where: { id: bookId },
      data: {
        gridfsFileId,
        fileLength: file.buffer.length,
      },
    })

    await this.invalidateCache(adventureId)

    return {
      id: updated.id,
      name: updated.name,
      visibility: updated.visibility as BookVisibility,
      fileLength: updated.fileLength,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }
  }

  /**
   * Delete a book and its GridFS file. GM only.
   */
  async delete(adventureId: string, bookId: string, userId: string): Promise<void> {
    await this.membership.requireRole(adventureId, userId, MemberRole.GM)

    const book = await this.prisma.book.findUnique({ where: { id: bookId } })
    if (!book || book.adventureId !== adventureId) {
      throw new NotFoundException('Book not found')
    }

    // Delete GridFS file if it exists
    if (book.gridfsFileId) {
      this.ensureReady()
      await this.deleteFromGridFS(book.gridfsFileId)
    }

    // Delete Prisma record
    await this.prisma.book.delete({ where: { id: bookId } })

    await this.invalidateCache(adventureId)
  }

  // ──────────────────────────────────────────────
  //  Private helpers
  // ──────────────────────────────────────────────

  /**
   * Filter book list by the requesting user's role.
   * GM sees all books; Player sees only PLAYER_BOOK.
   * This handles the case where the cache stored the full (GM-view) list
   * but the caller is a Player.
   */
  private async filterByVisibility(
    items: BookListItem[],
    adventureId: string,
    userId: string,
  ): Promise<BookListItem[]> {
    try {
      await this.membership.requireRole(adventureId, userId, MemberRole.GM)
      // User is GM — return everything
      return items
    } catch {
      // User is not GM — show only PLAYER_BOOK
      return items.filter((b) => b.visibility === BookVisibility.PLAYER_BOOK)
    }
  }

  /**
   * Upload a buffer to GridFS.
   * Returns the ObjectId as a string.
   */
  private uploadToGridFS(
    bookId: string,
    adventureId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.bucket!.openUploadStream(bookId, {
        metadata: {
          bookId,
          adventureId,
          contentType: file.mimetype,
          originalName: file.originalname,
        },
      })

      const readable = new Readable()
      readable.push(file.buffer)
      readable.push(null)

      readable
        .pipe(uploadStream)
        .on('error', (err) => {
          this.logger.error(`Upload error for book ${bookId}`, err)
          reject(err)
        })
        .on('finish', () => {
          resolve(uploadStream.id.toString())
        })
    })
  }

  /**
   * Delete a file from GridFS by its ObjectId string.
   */
  private async deleteFromGridFS(gridfsFileId: string): Promise<void> {
    try {
      const objectId = new ObjectId(gridfsFileId)
      await this.bucket!.delete(objectId)
    } catch (err) {
      this.logger.warn(`Failed to delete GridFS file ${gridfsFileId}`, err)
    }
  }

  /**
   * Invalidate the Redis cache for a given adventure's book list.
   */
  private async invalidateCache(adventureId: string): Promise<void> {
    await this.redis.invalidatePattern(`${CACHE_PREFIX}${adventureId}:list*`)
  }
}
