jest.mock("../../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
jest.mock("uuid", () => ({ v4: jest.fn(() => "mock-uuid") }))
import { Test } from '@nestjs/testing'
import { UnprocessableEntityException, NotFoundException } from '@nestjs/common'
import { AdminPlansController } from '../admin-plans.controller'
import { PrismaService } from '../../prisma.service'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { AdminGuard } from '../../auth/admin.guard'
import { I18nService } from 'nestjs-i18n'
import { createI18nServiceMock } from '../../i18n/i18n-testing.js'
import { createMockPrismaService } from '../../__mocks__/prisma-service.mock'

describe('AdminPlansController', () => {
  let controller: AdminPlansController
  let prisma: ReturnType<typeof createMockPrismaService>

  const mockPlan = {
    id: 'monthly',
    slug: 'monthly',
    name: 'Plano Mensal',
    description: 'Acesso mensal',
    price: 12000,
    pgPlanId: 'pg-plan-monthly',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  }

  const mockPlan2 = {
    id: 'annual',
    slug: 'annual',
    name: 'Plano Anual',
    description: 'Acesso anual',
    price: 120000,
    pgPlanId: 'pg-plan-annual',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  }

  beforeEach(async () => {
    prisma = createMockPrismaService()

    jest.clearAllMocks()

    const module = await Test.createTestingModule({
      controllers: [AdminPlansController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: I18nService, useValue: createI18nServiceMock() },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile()

    controller = module.get<AdminPlansController>(AdminPlansController)
  })

  // ─── list ────────────────────────────────────────────────

  describe('list', () => {
    it('returns all plans ordered by price ascending', async () => {
      prisma.subscriptionPlan.findMany.mockResolvedValue([mockPlan, mockPlan2])

      const result = await controller.list()

      expect(result).toEqual([mockPlan, mockPlan2])
      expect(prisma.subscriptionPlan.findMany).toHaveBeenCalledWith({
        orderBy: { price: 'asc' },
      })
    })

    it('returns empty array when no plans exist', async () => {
      prisma.subscriptionPlan.findMany.mockResolvedValue([])

      const result = await controller.list()

      expect(result).toEqual([])
    })
  })

  // ─── create ──────────────────────────────────────────────

  describe('create', () => {
    const createPayload = {
      id: 'premium',
      slug: 'premium',
      name: 'Plano Premium',
      description: 'Acesso premium',
      price: 24000,
      pgPlanId: 'pg-plan-premium',
    }

    it('creates a new plan successfully', async () => {
      prisma.subscriptionPlan.findFirst.mockResolvedValue(null)
      const created = { ...mockPlan, id: 'premium', slug: 'premium', name: 'Plano Premium', price: 24000, pgPlanId: 'pg-plan-premium' }
      prisma.subscriptionPlan.create.mockResolvedValue(created)

      const result = await controller.create(createPayload)

      expect(result).toEqual(created)
      expect(prisma.subscriptionPlan.create).toHaveBeenCalledWith({
        data: {
          id: 'premium',
          slug: 'premium',
          name: 'Plano Premium',
          description: 'Acesso premium',
          price: 24000,
          pgPlanId: 'pg-plan-premium',
        },
      })
    })

    it('throws on missing required fields', async () => {
      await expect(
        controller.create({ id: '', slug: '', name: '', price: 0, pgPlanId: '' }),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws on non-positive price', async () => {
      await expect(
        controller.create({ ...createPayload, price: 0 }),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws on non-integer price', async () => {
      await expect(
        controller.create({ ...createPayload, price: 99.5 }),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws on conflicting slug', async () => {
      prisma.subscriptionPlan.findFirst.mockResolvedValue(mockPlan)

      await expect(
        controller.create(createPayload),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws on conflicting pgPlanId', async () => {
      prisma.subscriptionPlan.findFirst.mockResolvedValue({
        ...mockPlan,
        slug: 'different-slug',
        pgPlanId: createPayload.pgPlanId,
      })

      await expect(
        controller.create(createPayload),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })

  // ─── update ──────────────────────────────────────────────

  describe('update', () => {
    it('updates plan fields successfully', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan)
      prisma.subscriptionPlan.update.mockResolvedValue({
        ...mockPlan,
        name: 'Plano Mensal Premium',
        price: 15000,
      })

      const result = await controller.update('monthly', {
        name: 'Plano Mensal Premium',
        price: 15000,
      })

      expect(result.name).toBe('Plano Mensal Premium')
      expect(result.price).toBe(15000)
      expect(prisma.subscriptionPlan.update).toHaveBeenCalledWith({
        where: { id: 'monthly' },
        data: expect.objectContaining({ name: 'Plano Mensal Premium', price: 15000 }),
      })
    })

    it('throws NotFoundException when plan does not exist', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue(null)

      await expect(
        controller.update('nonexistent', { name: 'Nope' }),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws on slug conflict', async () => {
      prisma.subscriptionPlan.findUnique
        .mockResolvedValueOnce(mockPlan)   // first call: find the plan
        .mockResolvedValueOnce(mockPlan2)  // second call: check slug conflict

      await expect(
        controller.update('monthly', { slug: 'annual' }),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws on pgPlanId conflict', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan)
      prisma.subscriptionPlan.findFirst.mockResolvedValue(mockPlan2)

      await expect(
        controller.update('monthly', { pgPlanId: 'pg-plan-annual' }),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws on invalid price', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan)

      await expect(
        controller.update('monthly', { price: 0 }),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })

  // ─── delete ──────────────────────────────────────────────

  describe('delete', () => {
    it('deletes a plan with no active subscriptions', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan)
      prisma.userSubscription.count.mockResolvedValue(0)

      const result = await controller.delete('monthly')

      expect(result).toEqual({ message: 'Plan deleted successfully' })
      expect(prisma.subscriptionPlan.delete).toHaveBeenCalledWith({
        where: { id: 'monthly' },
      })
    })

    it('throws NotFoundException when plan does not exist', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue(null)

      await expect(
        controller.delete('nonexistent'),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws UnprocessableEntityException when plan has active subscriptions', async () => {
      prisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan)
      prisma.userSubscription.count.mockResolvedValue(5)

      await expect(
        controller.delete('monthly'),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })
})
