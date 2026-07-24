import { EventEmitter } from 'events'

// ---------------------------------------------------------------------------
// Shared mock objects (captured by closure in the jest.mock factory below).
// These are defined BEFORE jest.mock so they are initialized by the time the
// module-under-test is imported and the factory runs.
// ---------------------------------------------------------------------------

const mockCursor = {
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  toArray: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
}

const mockFind = jest.fn<() => typeof mockCursor>().mockReturnValue(mockCursor)
const mockCollection = jest.fn<() => { find: typeof mockFind }>().mockReturnValue({
  find: mockFind,
})
const mockDb = { collection: mockCollection }

// References to the mock constructors so tests can assert call arguments.
// These are assigned by the jest.mock factory (via closure) and remain
// accessible after module initialisation.
let mockMongoClientCtor: jest.Mock
let mockGridFSBucketCtor: jest.Mock

const mockBucketInstance = {
  openUploadStream: jest.fn(),
  openDownloadStream: jest.fn(),
  delete: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}

jest.mock('mongodb', () => {
  const MongoClient = jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    db: jest.fn().mockReturnValue(mockDb),
  }))
  const GridFSBucket = jest.fn().mockImplementation(() => mockBucketInstance)

  // Expose constructors so tests can assert on them
  mockMongoClientCtor = MongoClient
  mockGridFSBucketCtor = GridFSBucket

  return { MongoClient, GridFSBucket }
})

// ---------------------------------------------------------------------------
// Helper: create a mock writable stream that works with Readable.pipe()
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

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { jest, describe, it, expect, beforeEach, afterAll } from '@jest/globals'
import { NotFoundException } from '@nestjs/common'
import { ImageService } from './image.service'
import { Readable } from 'stream'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ImageService', () => {
  let service: ImageService
  const OLD_MONGO_URL = process.env.MONGO_URL

  afterAll(() => {
    process.env.MONGO_URL = OLD_MONGO_URL
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // -----------------------------------------------------------------------
  // onModuleInit
  // -----------------------------------------------------------------------
  describe('onModuleInit', () => {
    it('connects to MongoDB and creates bucket when MONGO_URL is set', async () => {
      process.env.MONGO_URL = 'mongodb://localhost:27017'

      service = new ImageService()
      await service.onModuleInit()

      // Retrieve the mocked constructors to verify call arguments
      expect(mockMongoClientCtor).toHaveBeenCalledWith('mongodb://localhost:27017')
      expect((service as any).client?.connect).toHaveBeenCalled()
      expect((service as any).db).toBe(mockDb)
      expect(mockGridFSBucketCtor).toHaveBeenCalledWith(mockDb, { bucketName: 'avatars' })
      expect((service as any).bucket).toBe(mockBucketInstance)
    })

    it('logs warning and does not crash when MONGO_URL is not set', async () => {
      delete process.env.MONGO_URL

      service = new ImageService()
      await expect(service.onModuleInit()).resolves.toBeUndefined()

      expect((service as any).client).toBeNull()
      expect((service as any).db).toBeNull()
      expect((service as any).bucket).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // upload
  // -----------------------------------------------------------------------
  describe('upload', () => {
    beforeEach(() => {
      process.env.MONGO_URL = 'mongodb://localhost:27017'
      service = new ImageService()
      // Ensure the service is initialised for every upload test
      return service.onModuleInit()
    })

    it('successfully uploads a file', async () => {
      const writable = createMockWritable('upload-file-id-42')
      mockBucketInstance.openUploadStream.mockReturnValue(writable)

      const file = {
        buffer: Buffer.from('fake-image-data'),
        originalname: 'avatar.png',
        mimetype: 'image/png',
      }

      const result = await service.upload('entity-1', file, 'sheetId')

      expect(result).toEqual({ fileId: 'upload-file-id-42' })
      expect(mockBucketInstance.openUploadStream).toHaveBeenCalledWith('entity-1', {
        metadata: { sheetId: 'entity-1', contentType: 'image/png' },
      })
    })

    it('calls delete before uploading', async () => {
      // Make the find inside delete() return an existing file so that
      // bucket.delete() is exercised.
      mockCursor.toArray.mockResolvedValueOnce([
        { _id: 'existing-delete-me', length: 99 },
      ])

      const writable = createMockWritable('upload-file-id-2')
      mockBucketInstance.openUploadStream.mockReturnValue(writable)

      const file = {
        buffer: Buffer.from('data'),
        originalname: 'test.png',
        mimetype: 'image/png',
      }

      await service.upload('entity-2', file, 'sheetId')

      // delete() first queries the db, then calls bucket.delete()
      expect(mockFind).toHaveBeenCalledWith({ 'metadata.sheetId': 'entity-2' })
      expect(mockBucketInstance.delete).toHaveBeenCalledWith('existing-delete-me')
      // Then upload happens
      expect(mockBucketInstance.openUploadStream).toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // getStream
  // -----------------------------------------------------------------------
  describe('getStream', () => {
    beforeEach(() => {
      process.env.MONGO_URL = 'mongodb://localhost:27017'
      service = new ImageService()
      return service.onModuleInit()
    })

    it('returns stream when file exists', async () => {
      const fakeId = 'file-object-id'
      mockCursor.toArray.mockResolvedValueOnce([
        {
          _id: fakeId,
          filename: 'avatar.png',
          length: 12345,
          metadata: { sheetId: 'entity-1', contentType: 'image/webp' },
          uploadDate: new Date(),
        },
      ])

      const downloadStream = new Readable({ read() {} })
      downloadStream.push(Buffer.from('stream-data'))
      downloadStream.push(null)
      mockBucketInstance.openDownloadStream.mockReturnValue(downloadStream)

      const result = await service.getStream('entity-1', 'sheetId')

      expect(result.contentType).toBe('image/webp')
      expect(result.contentLength).toBe(12345)
      expect(result.stream).toBe(downloadStream)
      expect(mockBucketInstance.openDownloadStream).toHaveBeenCalledWith(fakeId)
    })

    it('throws NotFoundException when no file is found', async () => {
      mockCursor.toArray.mockResolvedValueOnce([])

      await expect(service.getStream('missing-entity', 'sheetId')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws NotFoundException when bucket is null (not initialised)', async () => {
      // Start a service that never connected
      delete process.env.MONGO_URL
      const unconnectedService = new ImageService()
      await unconnectedService.onModuleInit()

      expect((unconnectedService as any).bucket).toBeNull()

      await expect(
        unconnectedService.getStream('any', 'sheetId'),
      ).rejects.toThrow(NotFoundException)
    })
  })

  // -----------------------------------------------------------------------
  // delete
  // -----------------------------------------------------------------------
  describe('delete', () => {
    beforeEach(() => {
      process.env.MONGO_URL = 'mongodb://localhost:27017'
      service = new ImageService()
      return service.onModuleInit()
    })

    it('deletes files that exist', async () => {
      const files = [
        { _id: 'id-1', length: 100 },
        { _id: 'id-2', length: 200 },
      ]
      mockCursor.toArray.mockResolvedValueOnce(files)

      await service.delete('entity-1', 'sheetId')

      expect(mockBucketInstance.delete).toHaveBeenCalledTimes(2)
      expect(mockBucketInstance.delete).toHaveBeenCalledWith('id-1')
      expect(mockBucketInstance.delete).toHaveBeenCalledWith('id-2')
    })

    it('handles deletion errors gracefully without throwing', async () => {
      mockCursor.toArray.mockResolvedValueOnce([{ _id: 'id-err', length: 50 }])
      mockBucketInstance.delete.mockRejectedValue(new Error('DB error'))

      await expect(service.delete('entity-err', 'sheetId')).resolves.toBeUndefined()
    })

    it('no-ops when no files are returned from db', async () => {
      mockCursor.toArray.mockResolvedValueOnce([])

      await service.delete('entity-empty', 'sheetId')

      expect(mockBucketInstance.delete).not.toHaveBeenCalled()
    })
  })
})
