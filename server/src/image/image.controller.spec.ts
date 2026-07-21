jest.mock("../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
jest.mock('geoip-lite', () => ({ lookup: jest.fn() }))
jest.mock('@nestjs/platform-express', () => ({
  FileInterceptor: jest.fn(() => ({
    intercept: jest.fn((_ctx, next) => next.handle()),
  })),
}))

import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { ImageController } from './image.controller.js'
import { ImageService } from './image.service.js'
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js'
import type { Response } from 'express'

describe('ImageController', () => {
  let controller: ImageController
  let mockImageService: Record<string, jest.Mock>

  const mockFile = {
    buffer: Buffer.from('fake-image-bytes'),
    originalname: 'avatar.png',
    mimetype: 'image/png',
  } as Express.Multer.File

  function createMockResponse(): Response {
    return {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
    } as unknown as Response
  }

  function createMockStream() {
    return { pipe: jest.fn() }
  }

  beforeEach(async () => {
    jest.clearAllMocks()

    mockImageService = {
      upload: jest.fn().mockResolvedValue({ fileId: 'mock-file-id' }),
      getStream: jest.fn().mockResolvedValue({
        stream: createMockStream(),
        contentType: 'image/png',
        contentLength: 100,
      }),
      delete: jest.fn().mockResolvedValue(undefined),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImageController],
      providers: [
        { provide: ImageService, useValue: mockImageService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile()

    controller = module.get<ImageController>(ImageController)
  })

  // ──────────────────────────────────────────────
  //  POST /images/character-sheets/:sheetId/avatar
  // ──────────────────────────────────────────────

  describe('uploadAvatar', () => {
    it('should upload a file and return fileId', async () => {
      const result = await controller.uploadAvatar('sheet-1', mockFile)

      expect(mockImageService.upload).toHaveBeenCalledWith('sheet-1', {
        buffer: mockFile.buffer,
        originalname: mockFile.originalname,
        mimetype: mockFile.mimetype,
      })
      expect(result).toEqual({ fileId: 'mock-file-id' })
    })

    it('should throw NotFoundException when no file is provided', async () => {
      await expect(controller.uploadAvatar('sheet-1', undefined))
        .rejects.toThrow(NotFoundException)
      expect(mockImageService.upload).not.toHaveBeenCalled()
    })

    it('should pass an empty sheetId string to the service', async () => {
      const result = await controller.uploadAvatar('', mockFile)

      expect(mockImageService.upload).toHaveBeenCalledWith('', {
        buffer: mockFile.buffer,
        originalname: mockFile.originalname,
        mimetype: mockFile.mimetype,
      })
      expect(result).toEqual({ fileId: 'mock-file-id' })
    })

    it('should propagate a service upload error', async () => {
      mockImageService.upload.mockRejectedValue(new Error('Upload failure'))

      await expect(controller.uploadAvatar('sheet-1', mockFile))
        .rejects.toThrow('Upload failure')
    })
  })

  // ──────────────────────────────────────────────
  //  GET /images/character-sheets/:sheetId/avatar
  // ──────────────────────────────────────────────

  describe('getAvatar', () => {
    it('should stream the avatar image with correct headers', async () => {
      const mockRes = createMockResponse()
      const mockStream = createMockStream()
      mockImageService.getStream.mockResolvedValue({
        stream: mockStream,
        contentType: 'image/png',
        contentLength: 100,
      })

      await controller.getAvatar('sheet-1', mockRes)

      expect(mockImageService.getStream).toHaveBeenCalledWith('sheet-1')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Length', 100)
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=86400')
      expect(mockStream.pipe).toHaveBeenCalledWith(mockRes)
    })

    it('should return 204 when NotFoundException is thrown by the service', async () => {
      const mockRes = createMockResponse()
      mockImageService.getStream.mockRejectedValue(new NotFoundException('Avatar not found'))

      await controller.getAvatar('sheet-1', mockRes)

      expect(mockImageService.getStream).toHaveBeenCalledWith('sheet-1')
      expect(mockRes.status).toHaveBeenCalledWith(204)
      expect(mockRes.end).toHaveBeenCalled()
    })

    it('should call the service with an empty sheetId string', async () => {
      const mockRes = createMockResponse()
      const mockStream = createMockStream()
      mockImageService.getStream.mockResolvedValue({
        stream: mockStream,
        contentType: 'image/png',
        contentLength: 0,
      })

      await controller.getAvatar('', mockRes)

      expect(mockImageService.getStream).toHaveBeenCalledWith('')
    })

    it('should propagate a non-NotFoundException service error', async () => {
      const mockRes = createMockResponse()
      mockImageService.getStream.mockRejectedValue(new Error('DB connection failed'))

      await expect(controller.getAvatar('sheet-1', mockRes))
        .rejects.toThrow('DB connection failed')
    })
  })

  // ──────────────────────────────────────────────
  //  DELETE /images/character-sheets/:sheetId/avatar
  // ──────────────────────────────────────────────

  describe('deleteAvatar', () => {
    it('should delete the avatar and return { deleted: true }', async () => {
      const result = await controller.deleteAvatar('sheet-1')

      expect(mockImageService.delete).toHaveBeenCalledWith('sheet-1')
      expect(result).toEqual({ deleted: true })
    })

    it('should call the service with an empty sheetId string', async () => {
      const result = await controller.deleteAvatar('')

      expect(mockImageService.delete).toHaveBeenCalledWith('')
      expect(result).toEqual({ deleted: true })
    })

    it('should propagate a service delete error', async () => {
      mockImageService.delete.mockRejectedValue(new Error('Delete failure'))

      await expect(controller.deleteAvatar('sheet-1'))
        .rejects.toThrow('Delete failure')
    })
  })

  // ──────────────────────────────────────────────
  //  POST /images/abilities/:abilityId/avatar
  // ──────────────────────────────────────────────

  describe('uploadAbilityAvatar', () => {
    it('should upload a file with abilityId field name and return fileId', async () => {
      const result = await controller.uploadAbilityAvatar('ability-1', mockFile)

      expect(mockImageService.upload).toHaveBeenCalledWith('ability-1', {
        buffer: mockFile.buffer,
        originalname: mockFile.originalname,
        mimetype: mockFile.mimetype,
      }, 'abilityId')
      expect(result).toEqual({ fileId: 'mock-file-id' })
    })

    it('should throw NotFoundException when no file is provided', async () => {
      await expect(controller.uploadAbilityAvatar('ability-1', undefined))
        .rejects.toThrow(NotFoundException)
      expect(mockImageService.upload).not.toHaveBeenCalled()
    })

    it('should pass an empty abilityId string to the service', async () => {
      const result = await controller.uploadAbilityAvatar('', mockFile)

      expect(mockImageService.upload).toHaveBeenCalledWith('', {
        buffer: mockFile.buffer,
        originalname: mockFile.originalname,
        mimetype: mockFile.mimetype,
      }, 'abilityId')
      expect(result).toEqual({ fileId: 'mock-file-id' })
    })

    it('should propagate a service upload error', async () => {
      mockImageService.upload.mockRejectedValue(new Error('Ability upload failure'))

      await expect(controller.uploadAbilityAvatar('ability-1', mockFile))
        .rejects.toThrow('Ability upload failure')
    })
  })

  // ──────────────────────────────────────────────
  //  GET /images/abilities/:abilityId/avatar
  // ──────────────────────────────────────────────

  describe('getAbilityAvatar', () => {
    it('should stream the ability avatar with correct headers', async () => {
      const mockRes = createMockResponse()
      const mockStream = createMockStream()
      mockImageService.getStream.mockResolvedValue({
        stream: mockStream,
        contentType: 'image/png',
        contentLength: 100,
      })

      await controller.getAbilityAvatar('ability-1', mockRes)

      expect(mockImageService.getStream).toHaveBeenCalledWith('ability-1', 'abilityId')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Length', 100)
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=86400')
      expect(mockStream.pipe).toHaveBeenCalledWith(mockRes)
    })

    it('should return 204 when NotFoundException is thrown by the service', async () => {
      const mockRes = createMockResponse()
      mockImageService.getStream.mockRejectedValue(new NotFoundException('Avatar not found'))

      await controller.getAbilityAvatar('ability-1', mockRes)

      expect(mockImageService.getStream).toHaveBeenCalledWith('ability-1', 'abilityId')
      expect(mockRes.status).toHaveBeenCalledWith(204)
      expect(mockRes.end).toHaveBeenCalled()
    })

    it('should call the service with an empty abilityId string', async () => {
      const mockRes = createMockResponse()
      const mockStream = createMockStream()
      mockImageService.getStream.mockResolvedValue({
        stream: mockStream,
        contentType: 'image/png',
        contentLength: 0,
      })

      await controller.getAbilityAvatar('', mockRes)

      expect(mockImageService.getStream).toHaveBeenCalledWith('', 'abilityId')
    })

    it('should propagate a non-NotFoundException service error', async () => {
      const mockRes = createMockResponse()
      mockImageService.getStream.mockRejectedValue(new Error('DB connection failed'))

      await expect(controller.getAbilityAvatar('ability-1', mockRes))
        .rejects.toThrow('DB connection failed')
    })
  })

  // ──────────────────────────────────────────────
  //  DELETE /images/abilities/:abilityId/avatar
  // ──────────────────────────────────────────────

  describe('deleteAbilityAvatar', () => {
    it('should delete the ability avatar and return { deleted: true }', async () => {
      const result = await controller.deleteAbilityAvatar('ability-1')

      expect(mockImageService.delete).toHaveBeenCalledWith('ability-1', 'abilityId')
      expect(result).toEqual({ deleted: true })
    })

    it('should call the service with an empty abilityId string', async () => {
      const result = await controller.deleteAbilityAvatar('')

      expect(mockImageService.delete).toHaveBeenCalledWith('', 'abilityId')
      expect(result).toEqual({ deleted: true })
    })

    it('should propagate a service delete error', async () => {
      mockImageService.delete.mockRejectedValue(new Error('Delete failure'))

      await expect(controller.deleteAbilityAvatar('ability-1'))
        .rejects.toThrow('Delete failure')
    })
  })

  // ──────────────────────────────────────────────
  //  Property-based: uploadAvatar with jest-each
  // ──────────────────────────────────────────────

  describe.each([
    ['a standard sheet ID', 'sheet-abc'],
    ['a UUID sheet ID', '550e8400-e29b-41d4-a716-446655440000'],
    ['a short sheet ID', 's'],
    ['a sheet ID with special characters', 'sheet-123_abc'],
  ])('uploadAvatar with %s', (_label, sheetId) => {
    it('should delegate to imageService.upload with the correct entityId', async () => {
      const result = await controller.uploadAvatar(sheetId, mockFile)

      expect(mockImageService.upload).toHaveBeenCalledWith(sheetId, {
        buffer: mockFile.buffer,
        originalname: mockFile.originalname,
        mimetype: mockFile.mimetype,
      })
      expect(result).toEqual({ fileId: 'mock-file-id' })
    })
  })
})
