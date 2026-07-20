jest.mock("./generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test, TestingModule } from '@nestjs/testing'
import { HealthController } from './health.controller.js'
import { PrismaService } from './prisma.service.js'

describe('HealthController', () => {
  let controller: HealthController
  let mockPrisma: Record<string, jest.Mock>

  beforeEach(async () => {
    mockPrisma = {
      $queryRawUnsafe: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    }).compile()

    controller = module.get<HealthController>(HealthController)
  })

  describe('check', () => {
    it('should return status ok when SELECT 1 succeeds', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ 1: 1 }])

      const result = await controller.check()

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1')
      expect(result).toEqual({ status: 'ok', database: 'connected' })
    })

    it('should return status error when query fails', async () => {
      mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error('Connection lost'))

      const result = await controller.check()

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1')
      expect(result).toEqual({ status: 'error', database: 'disconnected' })
    })
  })
})
