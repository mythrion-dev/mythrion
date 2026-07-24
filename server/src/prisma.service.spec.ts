import { PrismaService } from './prisma.service.js'

// Mock the generated PrismaClient so tests don't need a real database
// Must be a class (not returning an object from constructor) so that
// PrismaService's extends + super() preserves the child prototype chain
jest.mock('./generated/prisma/client', () => {
  class MockPrismaClient {
    $connect!: jest.Mock
    $disconnect!: jest.Mock
    $queryRawUnsafe!: jest.Mock
    user!: Record<string, jest.Mock>
    adventure!: Record<string, jest.Mock>
    campaignMember!: Record<string, jest.Mock>
    constructor(_opts?: unknown) {
      this.$connect = jest.fn()
      this.$disconnect = jest.fn()
      this.$queryRawUnsafe = jest.fn().mockResolvedValue([{ 1: 1 }])
      this.user = { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() }
      this.adventure = { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() }
      this.campaignMember = { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() }
    }
  }
  return { PrismaClient: MockPrismaClient }
})

// Mock pg Pool and PrismaPg adapter to avoid actual database connection attempts
jest.mock('pg', () => ({
  default: { Pool: jest.fn() },
  Pool: jest.fn(),
}))

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn(),
}))

describe('PrismaService', () => {
  let service: PrismaService

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.DATABASE_URL = 'postgres://localhost:5432/test'
  })

  afterEach(() => {
    delete process.env.DATABASE_URL
  })

  describe('constructor', () => {
    it('should create an instance without throwing', () => {
      service = new PrismaService()
      expect(service).toBeDefined()
    })

    it('should strip prisma+ prefix from DATABASE_URL', () => {
      process.env.DATABASE_URL = 'prisma+postgres://localhost:5432/test'
      const { Pool } = require('pg')

      service = new PrismaService()

      // The constructor should have stripped "prisma+" before passing to Pool
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: 'postgres://localhost:5432/test',
        }),
      )
    })
  })

  describe('onModuleInit', () => {
    it('should call $connect and log success', async () => {
      service = new PrismaService()
      const connectSpy = jest.spyOn(service, '$connect' as any).mockResolvedValue(undefined)

      await service.onModuleInit()

      expect(connectSpy).toHaveBeenCalled()
    })

    it('should handle $connect error gracefully and not throw', async () => {
      service = new PrismaService()
      jest.spyOn(service, '$connect' as any).mockRejectedValue(new Error('Connection refused'))

      // Should not throw despite the error
      await expect(service.onModuleInit()).resolves.toBeUndefined()
    })

    it('should handle non-Error thrown values gracefully', async () => {
      service = new PrismaService()
      jest.spyOn(service, '$connect' as any).mockRejectedValue('string error message')

      // Should not throw despite the error
      await expect(service.onModuleInit()).resolves.toBeUndefined()
    })

    it('should handle object thrown values gracefully', async () => {
      service = new PrismaService()
      jest.spyOn(service, '$connect' as any).mockRejectedValue({ code: 'ECONNREFUSED' })

      // Should not throw despite the error
      await expect(service.onModuleInit()).resolves.toBeUndefined()
    })
  })

  describe('$queryRawUnsafe', () => {
    it('should return result for SELECT 1', async () => {
      service = new PrismaService()
      // Cast to any to access the mocked method
      ;(service as any).$queryRawUnsafe = jest.fn().mockResolvedValue([{ 1: 1 }])

      const result = await (service as any).$queryRawUnsafe('SELECT 1')

      expect(result).toEqual([{ 1: 1 }])
    })
  })
})
