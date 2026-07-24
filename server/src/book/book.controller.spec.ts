import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { Test, type TestingModule } from '@nestjs/testing'
import { INestApplication, ForbiddenException, NotFoundException } from '@nestjs/common'
import request from 'supertest'
import { BookController } from './book.controller'
import { BookService } from './book.service'
import { BookVisibility } from '../generated/prisma/client'
import type { Response } from 'express'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockBookService = {
  list: jest.fn<() => Promise<any>>(),
  create: jest.fn<() => Promise<any>>(),
  getStream: jest.fn<() => Promise<any>>(),
  getStreamRange: jest.fn<() => Promise<any>>(),
  update: jest.fn<() => Promise<any>>(),
  replaceFile: jest.fn<() => Promise<any>>(),
  delete: jest.fn<() => Promise<void>>(),
}

function createMockResponse(): Response {
  return {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    end: jest.fn(),
  } as unknown as Response
}

function createMockStream() {
  return { pipe: jest.fn() }
}

jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
  BookVisibility: { GM_BOOK: 'GM_BOOK', PLAYER_BOOK: 'PLAYER_BOOK' },
}))

// Minimal JwtAuthGuard that just passes through
jest.mock('../auth/jwt-auth.guard', () => ({
  JwtAuthGuard: jest.fn().mockImplementation(() => ({
    canActivate: jest.fn().mockReturnValue(true),
  })),
}))

describe('BookController', () => {
  let app: INestApplication
  let moduleRef: TestingModule

  const BASE = '/adventures/adventure-1/books'
  const mockBook = {
    id: 'book-1',
    name: 'Test Book',
    visibility: 'PLAYER_BOOK',
    fileLength: 1000,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    // Re-create a new TestingModule for each test
    moduleRef = await Test.createTestingModule({
      controllers: [BookController],
      providers: [
        { provide: BookService, useValue: mockBookService },
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    if (app) await app.close()
  })

  // -----------------------------------------------------------------------
  // GET /adventures/:adventureId/books
  // -----------------------------------------------------------------------
  describe('GET /', () => {
    it('returns a list of books', async () => {
      mockBookService.list.mockResolvedValueOnce([mockBook])

      const res = await request(app.getHttpServer())
        .get(BASE)
        .expect(200)

      expect(res.body).toEqual([mockBook])
      expect(mockBookService.list).toHaveBeenCalledWith('adventure-1', undefined)
    })

    it('returns empty array when no books exist', async () => {
      mockBookService.list.mockResolvedValueOnce([])

      const res = await request(app.getHttpServer())
        .get(BASE)
        .expect(200)

      expect(res.body).toEqual([])
    })
  })

  // -----------------------------------------------------------------------
  // POST /adventures/:adventureId/books
  // -----------------------------------------------------------------------
  describe('POST /', () => {
    it('creates a book with file upload', async () => {
      mockBookService.create.mockResolvedValueOnce(mockBook)

      const res = await request(app.getHttpServer())
        .post(BASE)
        .attach('file', Buffer.from('%PDF-1.4 test'), 'test.pdf')
        .field('name', 'Test Book')
        .field('visibility', 'PLAYER_BOOK')
        .expect(201)

      expect(res.body).toEqual(mockBook)
      expect(mockBookService.create).toHaveBeenCalled()
    })

    it('returns 404 when no file is provided', async () => {
      const res = await request(app.getHttpServer())
        .post(BASE)
        .field('name', 'Test Book')
        .expect(404)

      expect(res.body.message).toBe('No file provided')
    })
  })

  // -----------------------------------------------------------------------
  // GET /adventures/:adventureId/books/:bookId/file
  // -----------------------------------------------------------------------
  describe('GET /:bookId/file', () => {
    const FULL_STREAM_RESULT = {
      stream: createMockStream(),
      contentType: 'application/pdf',
      contentLength: 10000,
      fileSize: 10000,
      isPartial: false,
    }

    const RANGE_STREAM_RESULT = {
      stream: createMockStream(),
      contentType: 'application/pdf',
      contentLength: 1024,
      fileSize: 10000,
      isPartial: true,
    }

    it('streams a full PDF with 200 when no Range header', async () => {
      const controller = moduleRef.get<BookController>(BookController)
      const mockRes = createMockResponse()
      mockBookService.getStreamRange.mockResolvedValue(FULL_STREAM_RESULT)

      await controller.getFile(
        'adventure-1',
        'book-1',
        { user: { sub: 'user-1' }, headers: {} } as any,
        mockRes,
      )

      expect(mockBookService.getStreamRange).toHaveBeenCalledWith('adventure-1', 'book-1', 'user-1')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Accept-Ranges', 'bytes')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=86400')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Disposition', 'inline')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Length', 10000)
      expect(mockRes.status).not.toHaveBeenCalledWith(206)
    })

    it('returns 206 Partial Content with Content-Range when valid range requested', async () => {
      const controller = moduleRef.get<BookController>(BookController)
      const mockRes = createMockResponse()

      // First call returns full stream (for fileSize info)
      mockBookService.getStreamRange.mockResolvedValueOnce(FULL_STREAM_RESULT)
      // Second call returns range stream
      mockBookService.getStreamRange.mockResolvedValueOnce(RANGE_STREAM_RESULT)

      await controller.getFile(
        'adventure-1',
        'book-1',
        {
          user: { sub: 'user-1' },
          headers: { range: 'bytes=0-1023' },
        } as any,
        mockRes,
      )

      expect(mockRes.status).toHaveBeenCalledWith(206)
      expect(mockRes.setHeader).toHaveBeenCalledWith('Accept-Ranges', 'bytes')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Range', 'bytes 0-1023/10000')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Length', 1024)
      // Second call should request just the range bytes
      expect(mockBookService.getStreamRange).toHaveBeenLastCalledWith(
        'adventure-1', 'book-1', 'user-1', 0, 1023,
      )
    })

    it('returns 206 for open-ended range (bytes=N-)', async () => {
      const controller = moduleRef.get<BookController>(BookController)
      const mockRes = createMockResponse()

      mockBookService.getStreamRange.mockResolvedValueOnce(FULL_STREAM_RESULT)
      mockBookService.getStreamRange.mockResolvedValueOnce({
        ...RANGE_STREAM_RESULT,
        contentLength: 1000,
      })

      await controller.getFile(
        'adventure-1',
        'book-1',
        {
          user: { sub: 'user-1' },
          headers: { range: 'bytes=9000-' },
        } as any,
        mockRes,
      )

      expect(mockRes.status).toHaveBeenCalledWith(206)
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Range', 'bytes 9000-9999/10000')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Length', 1000)
    })

    it('returns 206 for suffix range (bytes=-N)', async () => {
      const controller = moduleRef.get<BookController>(BookController)
      const mockRes = createMockResponse()

      mockBookService.getStreamRange.mockResolvedValueOnce(FULL_STREAM_RESULT)
      mockBookService.getStreamRange.mockResolvedValueOnce({
        ...RANGE_STREAM_RESULT,
        contentLength: 2048,
      })

      await controller.getFile(
        'adventure-1',
        'book-1',
        {
          user: { sub: 'user-1' },
          headers: { range: 'bytes=-2048' },
        } as any,
        mockRes,
      )

      expect(mockRes.status).toHaveBeenCalledWith(206)
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Range', 'bytes 7952-9999/10000')
    })

    it('returns 416 Range Not Satisfiable for invalid range', async () => {
      const controller = moduleRef.get<BookController>(BookController)
      const mockRes = createMockResponse()

      mockBookService.getStreamRange.mockResolvedValueOnce(FULL_STREAM_RESULT)

      await controller.getFile(
        'adventure-1',
        'book-1',
        {
          user: { sub: 'user-1' },
          headers: { range: 'not-a-valid-range' },
        } as any,
        mockRes,
      )

      expect(mockRes.status).toHaveBeenCalledWith(416)
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Range', 'bytes */10000')
      expect(mockRes.end).toHaveBeenCalled()
      // Should NOT call getStreamRange a second time
      expect(mockBookService.getStreamRange).toHaveBeenCalledTimes(1)
    })

    it('returns 416 for unsatisfiable range (start beyond file)', async () => {
      const controller = moduleRef.get<BookController>(BookController)
      const mockRes = createMockResponse()

      mockBookService.getStreamRange.mockResolvedValueOnce(FULL_STREAM_RESULT)

      await controller.getFile(
        'adventure-1',
        'book-1',
        {
          user: { sub: 'user-1' },
          headers: { range: 'bytes=20000-30000' },
        } as any,
        mockRes,
      )

      expect(mockRes.status).toHaveBeenCalledWith(416)
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Range', 'bytes */10000')
      expect(mockRes.end).toHaveBeenCalled()
    })

    it('always sets Accept-Ranges header', async () => {
      const controller = moduleRef.get<BookController>(BookController)
      const mockRes = createMockResponse()
      mockBookService.getStreamRange.mockResolvedValue(FULL_STREAM_RESULT)

      await controller.getFile(
        'adventure-1',
        'book-1',
        { user: { sub: 'user-1' }, headers: {} } as any,
        mockRes,
      )

      expect(mockRes.setHeader).toHaveBeenCalledWith('Accept-Ranges', 'bytes')
    })

    it('returns 404 when book not found', async () => {
      const controller = moduleRef.get<BookController>(BookController)
      const mockRes = createMockResponse()
      mockBookService.getStreamRange.mockRejectedValue(new NotFoundException('Book not found'))

      await controller.getFile(
        'adventure-1',
        'nonexistent',
        { user: { sub: 'user-1' }, headers: {} } as any,
        mockRes,
      )

      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Book not found' })
    })
  })

  // -----------------------------------------------------------------------
  // PATCH /adventures/:adventureId/books/:bookId
  // -----------------------------------------------------------------------
  describe('PATCH /:bookId', () => {
    it('updates book metadata', async () => {
      mockBookService.update.mockResolvedValueOnce({ ...mockBook, name: 'Updated' })

      const res = await request(app.getHttpServer())
        .patch(`${BASE}/book-1`)
        .send({ name: 'Updated' })
        .expect(200)

      expect(res.body.name).toBe('Updated')
    })
  })

  // -----------------------------------------------------------------------
  // POST /adventures/:adventureId/books/:bookId/replace
  // -----------------------------------------------------------------------
  describe('POST /:bookId/replace', () => {
    it('replaces the file', async () => {
      mockBookService.replaceFile.mockResolvedValueOnce(mockBook)

      const res = await request(app.getHttpServer())
        .post(`${BASE}/book-1/replace`)
        .attach('file', Buffer.from('%PDF-1.4 new'), 'new.pdf')
        .expect(201)

      expect(res.body).toEqual(mockBook)
    })

    it('returns 404 when no file is provided', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/book-1/replace`)
        .expect(404)
    })
  })

  // -----------------------------------------------------------------------
  // DELETE /adventures/:adventureId/books/:bookId
  // -----------------------------------------------------------------------
  describe('DELETE /:bookId', () => {
    it('deletes a book', async () => {
      mockBookService.delete.mockResolvedValueOnce(undefined)

      const res = await request(app.getHttpServer())
        .delete(`${BASE}/book-1`)
        .expect(200)

      expect(res.body).toEqual({ deleted: true })
    })
  })
})
