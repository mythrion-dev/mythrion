import { EventEmitter } from 'events'

// ---------------------------------------------------------------------------
// Shared mock objects — defined BEFORE jest.mock so they are initialized
// by the time the module-under-test is imported.
// ---------------------------------------------------------------------------

const mockCursor = {
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  toArray: jest.fn<(...args: any[]) => Promise<any[]>>().mockResolvedValue([]),
}

const mockFind = jest.fn<(...args: any[]) => typeof mockCursor>().mockReturnValue(mockCursor)
const mockCollection = jest.fn<(...args: any[]) => { find: typeof mockFind }>().mockReturnValue({
  find: mockFind,
})
const mockDb = { collection: mockCollection }

let mockMongoClientCtor: jest.Mock
let mockGridFSBucketCtor: jest.Mock

const mockBucketInstance = {
  openUploadStream: jest.fn(),
  openDownloadStream: jest.fn(),
  delete: jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined),
}

jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
  BookVisibility: { GM_BOOK: 'GM_BOOK', PLAYER_BOOK: 'PLAYER_BOOK' },
  MemberRole: { GM: 'GM' },
}))

jest.mock('mongodb', () => {
  const MongoClient = jest.fn().mockImplementation(() => ({
    connect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    db: jest.fn().mockReturnValue(mockDb),
  }))
  const GridFSBucket = jest.fn().mockImplementation(() => mockBucketInstance)

  // ObjectId mock: just returns the string it was constructed with
  const ObjectId = jest.fn().mockImplementation((id: string) => id)

  mockMongoClientCtor = MongoClient
  mockGridFSBucketCtor = GridFSBucket

  return { MongoClient, GridFSBucket, ObjectId }
})

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function createMockWritable(id = 'mock-file-id') {
  const ee = new EventEmitter()
  return Object.assign(ee, {
    writable: true,
    write: jest.fn<() => boolean>().mockReturnValue(true),
    end: jest.fn().mockImplementation(function (this: EventEmitter) {
      process.nextTick(() => this.emit('finish'))
    }),
    id,
  })
}

function createMockReadable(data: Buffer = Buffer.from('pdf-content')) {
  const { Readable } = require('stream')
  const stream = new Readable()
  stream.push(data)
  stream.push(null)
  return stream
}

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { jest, describe, it, expect, beforeEach, afterAll } from '@jest/globals'
import { NotFoundException, ForbiddenException } from '@nestjs/common'
import { createI18nServiceMock } from '../i18n/i18n-testing.js'
import { BookService } from './book.service'
import { BookVisibility, MemberRole } from '../generated/prisma/client'

// ---------------------------------------------------------------------------
// Mocks for NestJS dependencies
// ---------------------------------------------------------------------------
const mockPrisma = {
  book: {
    findMany: jest.fn<(...args: any[]) => Promise<any[]>>().mockResolvedValue([]),
    findUnique: jest.fn<(...args: any[]) => Promise<any | null>>().mockResolvedValue(null),
    create: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({}),
    update: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({}),
    delete: jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined),
  },
}

const mockRedis = {
  cacheGet: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(null),
  cacheSet: jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined),
  invalidatePattern: jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined),
}

const mockMembership = {
  requireRole: jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined),
  requireWriteRole: jest.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined),
  isMember: jest.fn<(...args: any[]) => Promise<boolean>>().mockResolvedValue(true),
}

jest.mock('../prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}))

jest.mock('../redis/redis.service', () => ({
  RedisService: jest.fn().mockImplementation(() => mockRedis),
}))

jest.mock('../membership/membership.service', () => ({
  MembershipService: jest.fn().mockImplementation(() => mockMembership),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('BookService', () => {
  let service: BookService
  const OLD_MONGO_URL = process.env.MONGO_URL

  const mockUserId = 'user-1'
  const mockAdventureId = 'adventure-1'
  const mockBookId = 'book-1'

  afterAll(() => {
    process.env.MONGO_URL = OLD_MONGO_URL
  })

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.MONGO_URL = 'mongodb://localhost:27017'
    service = new BookService(mockPrisma as any, mockRedis as any, mockMembership as any, createI18nServiceMock())
  })

  // -----------------------------------------------------------------------
  // onModuleInit
  // -----------------------------------------------------------------------
  describe('onModuleInit', () => {
    it('connects to MongoDB and creates bucket when MONGO_URL is set', async () => {
      await service.onModuleInit()

      expect(mockMongoClientCtor).toHaveBeenCalledWith('mongodb://localhost:27017')
      expect((service as any).client?.connect).toHaveBeenCalled()
      expect((service as any).db).toBe(mockDb)
      expect(mockGridFSBucketCtor).toHaveBeenCalledWith(mockDb, { bucketName: 'campaign-books' })
      expect((service as any).bucket).toBe(mockBucketInstance)
    })

    it('logs warning and does not crash when MONGO_URL is not set', async () => {
      delete process.env.MONGO_URL

      const s = new BookService(mockPrisma as any, mockRedis as any, mockMembership as any, createI18nServiceMock())
      await expect(s.onModuleInit()).resolves.toBeUndefined()

      expect((s as any).client).toBeNull()
      expect((s as any).db).toBeNull()
      expect((s as any).bucket).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // list
  // -----------------------------------------------------------------------
  describe('list', () => {
    beforeEach(() => service.onModuleInit())

    it('returns cached results when Redis has them', async () => {
      const cached = [
        { id: 'b1', name: 'Book 1', visibility: 'GM_BOOK', fileLength: 100, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
      ]
      mockRedis.cacheGet.mockResolvedValueOnce(cached)
      mockMembership.requireRole.mockRejectedValueOnce(new ForbiddenException()) // not GM

      const result = await service.list(mockAdventureId, mockUserId)

      expect(mockRedis.cacheGet).toHaveBeenCalledWith(`books:${mockAdventureId}:list`)
      // Player filtered — GM_BOOK excluded
      expect(result).toHaveLength(0)
      expect(mockPrisma.book.findMany).not.toHaveBeenCalled()
    })

    it('queries Prisma on cache miss and caches result', async () => {
      mockRedis.cacheGet.mockResolvedValueOnce(null)
      mockPrisma.book.findMany.mockResolvedValueOnce([
        { id: 'b1', name: 'Book 1', visibility: 'PLAYER_BOOK', fileLength: 200, createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
      ])

      const result = await service.list(mockAdventureId, mockUserId)

      expect(mockPrisma.book.findMany).toHaveBeenCalledWith({
        where: { adventureId: mockAdventureId },
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      })
      expect(mockRedis.cacheSet).toHaveBeenCalledWith(
        `books:${mockAdventureId}:list`,
        expect.any(Array),
        300,
      )
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Book 1')
    })

    it('filters GM_BOOK for non-GM users', async () => {
      mockRedis.cacheGet.mockResolvedValueOnce(null)
      mockPrisma.book.findMany.mockResolvedValueOnce([
        { id: 'b1', name: 'GM Book', visibility: 'GM_BOOK', fileLength: 100, createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
        { id: 'b2', name: 'Player Book', visibility: 'PLAYER_BOOK', fileLength: 200, createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
      ])
      mockMembership.requireRole.mockRejectedValueOnce(new ForbiddenException())

      const result = await service.list(mockAdventureId, mockUserId)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('b2')
    })

    it('returns all books for GM users', async () => {
      mockRedis.cacheGet.mockResolvedValueOnce(null)
      mockPrisma.book.findMany.mockResolvedValueOnce([
        { id: 'b1', name: 'GM Book', visibility: 'GM_BOOK', fileLength: 100, createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
        { id: 'b2', name: 'Player Book', visibility: 'PLAYER_BOOK', fileLength: 200, createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
      ])

      const result = await service.list(mockAdventureId, mockUserId)

      expect(result).toHaveLength(2)
    })
  })

  // -----------------------------------------------------------------------
  // create
  // -----------------------------------------------------------------------
  describe('create', () => {
    const mockFile = { buffer: Buffer.from('pdf-data'), originalname: 'book.pdf', mimetype: 'application/pdf' }
    const mockDto = { name: 'My Book', visibility: BookVisibility.PLAYER_BOOK }

    beforeEach(() => service.onModuleInit())

    it('uploads a book successfully', async () => {
      mockPrisma.book.create.mockResolvedValueOnce({
        id: mockBookId,
        adventureId: mockAdventureId,
        name: 'My Book',
        visibility: 'PLAYER_BOOK',
        fileLength: 8,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      })
      const writable = createMockWritable('gridfs-id-42')
      mockBucketInstance.openUploadStream.mockReturnValue(writable)
      mockPrisma.book.update.mockResolvedValueOnce({
        id: mockBookId,
        adventureId: mockAdventureId,
        name: 'My Book',
        visibility: 'PLAYER_BOOK',
        fileLength: 8,
        gridfsFileId: 'gridfs-id-42',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      })

      const result = await service.create(mockAdventureId, mockUserId, mockFile, mockDto)

      expect(mockMembership.requireWriteRole).toHaveBeenCalledWith(mockAdventureId, mockUserId, MemberRole.GM)
      expect(mockPrisma.book.create).toHaveBeenCalledWith({
        data: {
          adventureId: mockAdventureId,
          name: 'My Book',
          visibility: 'PLAYER_BOOK',
          fileLength: 8,
        },
      })
      expect(mockBucketInstance.openUploadStream).toHaveBeenCalledWith(mockBookId, {
        metadata: { bookId: mockBookId, adventureId: mockAdventureId, contentType: 'application/pdf', originalName: 'book.pdf' },
      })
      expect(mockPrisma.book.update).toHaveBeenCalled()
      expect(mockRedis.invalidatePattern).toHaveBeenCalledWith(`books:${mockAdventureId}:list*`)
      expect(result.name).toBe('My Book')
    })

    it('deletes Prisma record if GridFS upload fails', async () => {
      mockPrisma.book.create.mockResolvedValueOnce({
        id: mockBookId,
        adventureId: mockAdventureId,
        name: 'My Book',
        visibility: 'GM_BOOK',
        fileLength: 8,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      })
      mockBucketInstance.openUploadStream.mockImplementationOnce(() => {
        const ee = new EventEmitter()
        return Object.assign(ee, {
          writable: true,
          write: jest.fn(),
          end: jest.fn().mockImplementation(function (this: EventEmitter) {
            process.nextTick(() => this.emit('error', new Error('GridFS upload failed')))
          }),
          id: 'fail-id',
        })
      })

      await expect(service.create(mockAdventureId, mockUserId, mockFile, mockDto)).rejects.toThrow(
        NotFoundException,
      )

      expect(mockPrisma.book.delete).toHaveBeenCalledWith({ where: { id: mockBookId } })
    })

    it('throws ForbiddenException if user is not GM', async () => {
      mockMembership.requireWriteRole.mockRejectedValueOnce(new ForbiddenException())

      await expect(service.create(mockAdventureId, mockUserId, mockFile, mockDto)).rejects.toThrow(
        ForbiddenException,
      )
    })
  })

  // -----------------------------------------------------------------------
  // getStream (delegates to getStreamRange)
  // -----------------------------------------------------------------------
  describe('getStream', () => {
    beforeEach(() => service.onModuleInit())

    it('returns stream with contentType and contentLength for a PLAYER_BOOK', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({
        id: mockBookId,
        adventureId: mockAdventureId,
        name: 'Player Book',
        visibility: 'PLAYER_BOOK',
        gridfsFileId: 'gridfs-id-42',
        fileLength: 100,
      })
      mockCursor.toArray.mockResolvedValueOnce([
        { _id: 'gridfs-id-42', length: 100, metadata: { contentType: 'application/pdf' } },
      ])
      const downloadStream = createMockReadable()
      mockBucketInstance.openDownloadStream.mockReturnValue(downloadStream)

      const result = await service.getStream(mockAdventureId, mockBookId, mockUserId)

      expect(mockMembership.isMember).toHaveBeenCalledWith(mockAdventureId, mockUserId)
      expect(result.contentType).toBe('application/pdf')
      expect(result.contentLength).toBe(100)
      expect(result.fileSize).toBe(100)
      expect(mockBucketInstance.openDownloadStream).toHaveBeenCalledWith('gridfs-id-42')
    })

    it('requires GM role for GM_BOOK', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({
        id: mockBookId,
        adventureId: mockAdventureId,
        name: 'GM Book',
        visibility: 'GM_BOOK',
        gridfsFileId: 'gridfs-id-42',
        fileLength: 100,
      })
      mockCursor.toArray.mockResolvedValueOnce([
        { _id: 'gridfs-id-42', length: 100, metadata: { contentType: 'application/pdf' } },
      ])

      await service.getStream(mockAdventureId, mockBookId, mockUserId)

      const requireRoleCalls = (mockMembership.requireRole as jest.Mock).mock.calls
      const gmCall = requireRoleCalls.find(
        (c: any[]) => c[2] === MemberRole.GM,
      )
      expect(gmCall).toBeDefined()
    })

    it('throws ForbiddenException if user is not a member', async () => {
      mockMembership.isMember.mockResolvedValueOnce(false)

      await expect(
        service.getStream(mockAdventureId, mockBookId, mockUserId),
      ).rejects.toThrow(ForbiddenException)
    })

    it('throws NotFoundException when book is not found', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce(null)

      await expect(
        service.getStream(mockAdventureId, mockBookId, mockUserId),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when book has no GridFS file', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({
        id: mockBookId,
        adventureId: mockAdventureId,
        name: 'No File Book',
        visibility: 'PLAYER_BOOK',
        gridfsFileId: null,
        fileLength: 0,
      })

      await expect(
        service.getStream(mockAdventureId, mockBookId, mockUserId),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when GridFS file is missing', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({
        id: mockBookId,
        adventureId: mockAdventureId,
        name: 'Book',
        visibility: 'PLAYER_BOOK',
        gridfsFileId: 'gridfs-id-missing',
        fileLength: 100,
      })
      mockCursor.toArray.mockResolvedValueOnce([])

      await expect(
        service.getStream(mockAdventureId, mockBookId, mockUserId),
      ).rejects.toThrow(NotFoundException)
    })
  })

  // -----------------------------------------------------------------------
  // getStreamRange
  // -----------------------------------------------------------------------
  describe('getStreamRange', () => {
    beforeEach(() => service.onModuleInit())

    const gridFsFile = { _id: 'gridfs-id-42', length: 10000, metadata: { contentType: 'application/pdf' } }

    function mockBookFound(overrides: Partial<any> = {}) {
      mockPrisma.book.findUnique.mockResolvedValueOnce({
        id: mockBookId,
        adventureId: mockAdventureId,
        name: 'Test Book',
        visibility: 'PLAYER_BOOK',
        gridfsFileId: 'gridfs-id-42',
        fileLength: 10000,
        ...overrides,
      })
      mockCursor.toArray.mockResolvedValueOnce([gridFsFile])
    }

    it('returns full stream with isPartial: false when no range params provided', async () => {
      mockBookFound()
      const downloadStream = createMockReadable()
      mockBucketInstance.openDownloadStream.mockReturnValue(downloadStream)

      const result = await service.getStreamRange(mockAdventureId, mockBookId, mockUserId)

      expect(result.isPartial).toBe(false)
      expect(result.contentLength).toBe(10000)
      expect(result.fileSize).toBe(10000)
      expect(result.contentType).toBe('application/pdf')
      expect(mockBucketInstance.openDownloadStream).toHaveBeenCalledWith('gridfs-id-42')
    })

    it('returns partial stream with isPartial: true when range params provided', async () => {
      mockBookFound()
      const downloadStream = createMockReadable(Buffer.alloc(1024))
      mockBucketInstance.openDownloadStream.mockReturnValue(downloadStream)

      const result = await service.getStreamRange(mockAdventureId, mockBookId, mockUserId, 0, 1023)

      expect(result.isPartial).toBe(true)
      expect(result.contentLength).toBe(1024)
      expect(result.fileSize).toBe(10000)
      expect(mockBucketInstance.openDownloadStream).toHaveBeenCalledWith('gridfs-id-42', { start: 0, end: 1023 })
    })

    it('returns partial stream for mid-file range', async () => {
      mockBookFound()
      const downloadStream = createMockReadable(Buffer.alloc(500))
      mockBucketInstance.openDownloadStream.mockReturnValue(downloadStream)

      const result = await service.getStreamRange(mockAdventureId, mockBookId, mockUserId, 5000, 5499)

      expect(result.isPartial).toBe(true)
      expect(result.contentLength).toBe(500)
      expect(mockBucketInstance.openDownloadStream).toHaveBeenCalledWith('gridfs-id-42', { start: 5000, end: 5499 })
    })

    it('requires GM role for GM_BOOK', async () => {
      mockBookFound({ visibility: 'GM_BOOK' })
      const downloadStream = createMockReadable()
      mockBucketInstance.openDownloadStream.mockReturnValue(downloadStream)

      await service.getStreamRange(mockAdventureId, mockBookId, mockUserId, 0, 1023)

      const requireRoleCalls = (mockMembership.requireRole as jest.Mock).mock.calls
      const gmCall = requireRoleCalls.find((c: any[]) => c[2] === MemberRole.GM)
      expect(gmCall).toBeDefined()
    })

    it('throws ForbiddenException if user is not a member', async () => {
      mockMembership.isMember.mockResolvedValueOnce(false)

      await expect(
        service.getStreamRange(mockAdventureId, mockBookId, mockUserId),
      ).rejects.toThrow(ForbiddenException)
    })

    it('throws NotFoundException when book is not found', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce(null)

      await expect(
        service.getStreamRange(mockAdventureId, mockBookId, mockUserId),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when book has no GridFS file', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({
        id: mockBookId,
        adventureId: mockAdventureId,
        name: 'No File Book',
        visibility: 'PLAYER_BOOK',
        gridfsFileId: null,
        fileLength: 0,
      })

      await expect(
        service.getStreamRange(mockAdventureId, mockBookId, mockUserId),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when GridFS file is missing from storage', async () => {
      mockBookFound()
      mockCursor.toArray.mockReset()
      mockCursor.toArray.mockResolvedValueOnce([])
      await expect(
        service.getStreamRange(mockAdventureId, mockBookId, mockUserId, 0, 1023),
      ).rejects.toThrow(NotFoundException)
    })
  })

  // -----------------------------------------------------------------------
  // update
  // -----------------------------------------------------------------------
  describe('update', () => {
    beforeEach(() => service.onModuleInit())

    it('updates book metadata and invalidates cache', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({
        id: mockBookId,
        adventureId: mockAdventureId,
      })
      mockPrisma.book.update.mockResolvedValueOnce({
        id: mockBookId,
        name: 'Updated Book',
        visibility: 'GM_BOOK',
        fileLength: 100,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      })

      const result = await service.update(mockAdventureId, mockBookId, mockUserId, { name: 'Updated Book' })

      expect(mockMembership.requireWriteRole).toHaveBeenCalledWith(mockAdventureId, mockUserId, MemberRole.GM)
      expect(mockPrisma.book.update).toHaveBeenCalledWith({
        where: { id: mockBookId },
        data: { name: 'Updated Book' },
      })
      expect(mockRedis.invalidatePattern).toHaveBeenCalledWith(`books:${mockAdventureId}:list*`)
      expect(result.name).toBe('Updated Book')
    })

    it('throws NotFoundException when book does not exist', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce(null)

      await expect(
        service.update(mockAdventureId, 'nonexistent', mockUserId, { name: 'Nope' }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  // -----------------------------------------------------------------------
  // replaceFile
  // -----------------------------------------------------------------------
  describe('replaceFile', () => {
    const mockFile = { buffer: Buffer.from('new-pdf'), originalname: 'new.pdf', mimetype: 'application/pdf' }

    beforeEach(() => service.onModuleInit())

    it('replaces existing file and updates metadata', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({
        id: mockBookId,
        adventureId: mockAdventureId,
        name: 'Book',
        gridfsFileId: 'old-gridfs-id',
        fileLength: 50,
      })
      mockCursor.toArray.mockResolvedValueOnce([{ _id: 'old-gridfs-id' }]) // for old file lookup
      const writable = createMockWritable('new-gridfs-id')
      mockBucketInstance.openUploadStream.mockReturnValue(writable)
      mockPrisma.book.update.mockResolvedValueOnce({
        id: mockBookId,
        name: 'Book',
        visibility: 'GM_BOOK',
        fileLength: 7,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      })

      const result = await service.replaceFile(mockAdventureId, mockBookId, mockUserId, mockFile)

      expect(mockPrisma.book.findUnique).toHaveBeenCalled()
      expect(mockPrisma.book.update).toHaveBeenCalled()
      expect(mockRedis.invalidatePattern).toHaveBeenCalledWith(`books:${mockAdventureId}:list*`)
      expect(result.name).toBe('Book')
    })

    it('throws NotFoundException when original book does not exist', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce(null)

      await expect(
        service.replaceFile(mockAdventureId, mockBookId, mockUserId, mockFile),
      ).rejects.toThrow(NotFoundException)
    })
  })

  // -----------------------------------------------------------------------
  // delete
  // -----------------------------------------------------------------------
  describe('delete', () => {
    beforeEach(() => service.onModuleInit())

    it('deletes book and GridFS file', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({
        id: mockBookId,
        adventureId: mockAdventureId,
        name: 'Book to delete',
        gridfsFileId: 'gridfs-to-delete',
        fileLength: 100,
      })

      await service.delete(mockAdventureId, mockBookId, mockUserId)

      expect(mockMembership.requireWriteRole).toHaveBeenCalledWith(mockAdventureId, mockUserId, MemberRole.GM)
      expect(mockPrisma.book.delete).toHaveBeenCalledWith({ where: { id: mockBookId } })
      expect(mockRedis.invalidatePattern).toHaveBeenCalledWith(`books:${mockAdventureId}:list*`)
    })

    it('throws NotFoundException when book does not exist', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce(null)

      await expect(
        service.delete(mockAdventureId, mockBookId, mockUserId),
      ).rejects.toThrow(NotFoundException)
    })

    it('handles delete when book has no GridFS file', async () => {
      mockPrisma.book.findUnique.mockResolvedValueOnce({
        id: mockBookId,
        adventureId: mockAdventureId,
        name: 'No file book',
        gridfsFileId: null,
        fileLength: 0,
      })

      await service.delete(mockAdventureId, mockBookId, mockUserId)

      expect(mockPrisma.book.delete).toHaveBeenCalledWith({ where: { id: mockBookId } })
    })
  })
})
