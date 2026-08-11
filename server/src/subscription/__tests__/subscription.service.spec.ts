jest.mock("../../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test } from '@nestjs/testing'
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { SubscriptionService } from '../subscription.service'
import { PrismaService } from '../../prisma.service'
import { RedisService } from '../../redis/redis.service'
import { createMockPrismaService } from '../../__mocks__/prisma-service.mock'
import { PAYMENT_GATEWAY } from '../payment-gateway.interface'
import type { PaymentGateway } from '../payment-gateway.interface'
import { I18nService } from 'nestjs-i18n'
import { createI18nServiceMock } from '../../i18n/i18n-testing.js'

const mockGateway: jest.Mocked<PaymentGateway> = {
  createSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  updatePaymentMethod: jest.fn(),
  getSubscription: jest.fn(),
  getPaymentCharge: jest.fn(),
  validateWebhook: jest.fn(),
}

const mockRedis = {
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  invalidatePattern: jest.fn().mockResolvedValue(undefined),
}

describe('SubscriptionService', () => {
  let service: SubscriptionService
  let prisma: ReturnType<typeof createMockPrismaService>

  beforeEach(async () => {
    prisma = createMockPrismaService()
    jest.clearAllMocks()

    const module = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: PAYMENT_GATEWAY, useValue: mockGateway },
        { provide: I18nService, useValue: createI18nServiceMock() },
      ],
    }).compile()

    service = module.get<SubscriptionService>(SubscriptionService)
  })

  // ─── listPlans ──────────────────────────────────────────────────────

  describe('listPlans', () => {
    it('returns all plans ordered by price ascending', async () => {
      const plans = [
        { id: 'monthly', slug: 'monthly', price: 12000 },
        { id: 'annual', slug: 'annual', price: 120000 },
      ]
      prisma.subscriptionPlan.findMany.mockResolvedValue(plans)

      const result = await service.listPlans()

      expect(result).toEqual(plans)
      expect(prisma.subscriptionPlan.findMany).toHaveBeenCalledWith({
        orderBy: { price: 'asc' },
      })
    })

    it('returns empty array when no plans exist', async () => {
      prisma.subscriptionPlan.findMany.mockResolvedValue([])

      const result = await service.listPlans()

      expect(result).toEqual([])
    })
  })

  // ─── createSubscription ─────────────────────────────────────────────

  describe('createSubscription', () => {
    const userId = 'user-1'
    const planId = 'monthly'
    const email = 'user@example.com'
    const plan = {
      id: 'monthly',
      pgPlanId: 'pg-plan-123',
      slug: 'monthly',
      name: 'Monthly Plan',
      price: 12000,
    }

    it('creates a subscription and returns initPoint and subscriptionId', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue(null)
      prisma.subscriptionPlan.findUnique.mockResolvedValue(plan)
      mockGateway.createSubscription.mockResolvedValue({
        id: 'SUB-1',
        initPoint: '',
        status: 'PENDING',
      })
      prisma.userSubscription.upsert.mockResolvedValue({
        id: 'local-sub-1',
        userId,
        planId,
        pgSubscriptionId: 'SUB-1',
        status: 'PENDING',
      })

      const result = await service.createSubscription({ userId, planId, email })

      expect(result).toEqual({
        initPoint: '',
        subscriptionId: 'local-sub-1',
      })
      expect(mockGateway.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: plan.pgPlanId,
          payerEmail: email,
        }),
      )
      expect(prisma.userSubscription.upsert).toHaveBeenCalled()
    })

    it('saves AUTHORIZED status when gateway returns ACTIVE (card token flow)', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue(null)
      prisma.subscriptionPlan.findUnique.mockResolvedValue(plan)
      mockGateway.createSubscription.mockResolvedValue({
        id: 'SUB-auth',
        initPoint: '',
        status: 'ACTIVE',
        customerId: 'CUST-123',
      })
      prisma.userSubscription.upsert.mockResolvedValue({
        id: 'local-sub-auth',
        userId,
        planId,
        pgSubscriptionId: 'SUB-auth',
        pgCustomerId: 'CUST-123',
        status: 'ACTIVE',
      })

      await service.createSubscription({
        userId,
        planId,
        email,
        cardToken: 'encrypted-card-123',
        payerName: 'João Silva',
        payerDocument: '12345678909',
      })

      const upsertCall = prisma.userSubscription.upsert.mock.calls[0][0]
      expect(upsertCall.create.status).toBe('ACTIVE')
      expect(upsertCall.update.status).toBe('ACTIVE')
      expect(upsertCall.create.currentPeriodStart).toBeInstanceOf(Date)
      expect(upsertCall.create.pgCustomerId).toBe('CUST-123')
    })

    it('persists currentPeriodEnd from gateway next_invoice_at', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue(null)
      prisma.subscriptionPlan.findUnique.mockResolvedValue(plan)
      mockGateway.createSubscription.mockResolvedValue({
        id: 'SUB-period',
        initPoint: '',
        status: 'ACTIVE',
        customerId: 'CUST-123',
        nextPaymentDate: '2026-08-31T10:00:00Z',
      })
      prisma.userSubscription.upsert.mockResolvedValue({
        id: 'local-sub-period',
        userId,
        planId,
        pgSubscriptionId: 'SUB-period',
        status: 'ACTIVE',
      })

      await service.createSubscription({ userId, planId, email })

      const upsertCall = prisma.userSubscription.upsert.mock.calls[0][0]
      expect(upsertCall.create.currentPeriodEnd).toBeInstanceOf(Date)
      expect(upsertCall.create.currentPeriodEnd.toISOString()).toBe(
        '2026-08-31T10:00:00.000Z',
      )
      expect(upsertCall.update.currentPeriodEnd).toBeInstanceOf(Date)
    })

    it('stores null currentPeriodEnd when gateway returns no nextPaymentDate', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue(null)
      prisma.subscriptionPlan.findUnique.mockResolvedValue(plan)
      mockGateway.createSubscription.mockResolvedValue({
        id: 'SUB-no-date',
        initPoint: '',
        status: 'PENDING',
      })
      prisma.userSubscription.upsert.mockResolvedValue({
        id: 'local-sub-no-date',
        userId,
        planId,
        pgSubscriptionId: 'SUB-no-date',
        status: 'PENDING',
      })

      await service.createSubscription({ userId, planId, email })

      const upsertCall = prisma.userSubscription.upsert.mock.calls[0][0]
      expect(upsertCall.create.currentPeriodEnd).toBeNull()
      expect(upsertCall.update.currentPeriodEnd).toBeNull()
    })

    it('throws UnprocessableEntityException when user has an active subscription', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        id: 'existing',
        userId,
        status: 'ACTIVE',
      })

      await expect(
        service.createSubscription({ userId, planId, email }),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws NotFoundException when plan is not found', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue(null)
      prisma.subscriptionPlan.findUnique.mockResolvedValue(null)

      await expect(
        service.createSubscription({ userId, planId, email }),
      ).rejects.toThrow(NotFoundException)
    })

    it('allows creating a new subscription when existing is CANCELLED (upserts)', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        id: 'existing',
        userId,
        status: 'CANCELLED',
      })
      prisma.subscriptionPlan.findUnique.mockResolvedValue(plan)
      mockGateway.createSubscription.mockResolvedValue({
        id: 'SUB-2',
        initPoint: '',
        status: 'PENDING',
      })
      prisma.userSubscription.upsert.mockResolvedValue({
        id: 'local-sub-2',
        userId,
        planId,
        pgSubscriptionId: 'SUB-2',
        status: 'PENDING',
      })

      const result = await service.createSubscription({ userId, planId, email })

      expect(result.initPoint).toBe('')
      expect(prisma.userSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          update: expect.objectContaining({
            planId: plan.id,
            status: 'PENDING',
            cancelledAt: null,
          }),
          create: expect.objectContaining({
            userId,
            planId: plan.id,
            status: 'PENDING',
          }),
        }),
      )
    })
  })

  // ─── getMySubscription ──────────────────────────────────────────────

  describe('getMySubscription', () => {
    it('returns subscription with plan and invoices', async () => {
      const subData = {
        id: 'sub-1',
        status: 'ACTIVE',
        pgSubscriptionId: 'SUB-1',
        pgCustomerId: 'CUST-1',
        graceEndsAt: null,
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: new Date('2025-02-01'),
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        createdAt: new Date('2025-01-01'),
        plan: { slug: 'monthly', name: 'Monthly Plan', price: 12000 },
        invoices: [
          {
            id: 'inv-1',
            amount: 12000,
            currency: 'BRL',
            status: 'paid',
            paidAt: new Date('2025-01-01'),
            dueDate: null,
            createdAt: new Date('2025-01-01'),
          },
        ],
      }
      prisma.userSubscription.findUnique.mockResolvedValue(subData)

      const result = await service.getMySubscription('user-1')

      expect(result).toEqual({
        id: 'sub-1',
        plan: { slug: 'monthly', name: 'Monthly Plan', price: 12000 },
        status: 'ACTIVE',
        pgSubscriptionId: 'SUB-1',
        graceEndsAt: null,
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: new Date('2025-02-01'),
        cancelledAt: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date('2025-01-01'),
        invoices: [
          {
            id: 'inv-1',
            amount: 12000,
            currency: 'BRL',
            status: 'paid',
            paidAt: new Date('2025-01-01'),
            dueDate: null,
            createdAt: new Date('2025-01-01'),
          },
        ],
      })
      expect(prisma.userSubscription.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: {
          plan: { select: { slug: true, name: true, price: true } },
          invoices: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              paidAt: true,
              dueDate: true,
              createdAt: true,
            },
          },
        },
      })
    })

    it('returns null when no subscription exists', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue(null)

      const result = await service.getMySubscription('user-1')

      expect(result).toBeNull()
    })

    it('auto-repairs PENDING subscription when gateway reports ACTIVE', async () => {
      const pendingSub = {
        id: 'sub-stuck',
        status: 'PENDING',
        pgSubscriptionId: 'SUB-stuck',
        pgCustomerId: null,
        graceEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        createdAt: new Date(),
        plan: { slug: 'monthly', name: 'Monthly Plan', price: 12000 },
        invoices: [],
      }
      const repairedSub = {
        ...pendingSub,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date('2026-08-29'),
      }

      prisma.userSubscription.findUnique.mockResolvedValueOnce(pendingSub)
      mockGateway.getSubscription.mockResolvedValue({
        id: 'SUB-stuck',
        status: 'ACTIVE',
        nextPaymentDate: '2026-08-29T00:00:00Z',
      })
      prisma.userSubscription.update.mockResolvedValue(repairedSub)

      const result = await service.getMySubscription('user-1')

      expect(result?.status).toBe('ACTIVE')
      expect(result?.currentPeriodStart).toBeInstanceOf(Date)
      expect(result?.currentPeriodEnd).toBeInstanceOf(Date)
      expect(mockGateway.getSubscription).toHaveBeenCalledWith('SUB-stuck')
    })

    it('does not auto-repair when gateway also reports pending', async () => {
      const pendingSub = {
        id: 'sub-pending',
        status: 'PENDING',
        pgSubscriptionId: 'SUB-pending',
        pgCustomerId: null,
        graceEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        createdAt: new Date(),
        plan: { slug: 'monthly', name: 'Monthly Plan', price: 12000 },
        invoices: [],
      }

      prisma.userSubscription.findUnique.mockResolvedValueOnce(pendingSub)
      mockGateway.getSubscription.mockResolvedValue({
        id: 'SUB-pending',
        status: 'PENDING',
      })

      const result = await service.getMySubscription('user-1')

      expect(result?.status).toBe('PENDING')
      expect(prisma.userSubscription.update).not.toHaveBeenCalled()
    })

    it('does not call gateway when local status is not PENDING', async () => {
      const activeSub = {
        id: 'sub-active',
        status: 'ACTIVE',
        pgSubscriptionId: 'SUB-active',
        pgCustomerId: null,
        graceEndsAt: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        createdAt: new Date(),
        plan: { slug: 'monthly', name: 'Monthly Plan', price: 12000 },
        invoices: [],
      }

      prisma.userSubscription.findUnique.mockResolvedValueOnce(activeSub)

      const result = await service.getMySubscription('user-1')

      expect(result?.status).toBe('ACTIVE')
      expect(mockGateway.getSubscription).not.toHaveBeenCalled()
    })

    it('does not auto-repair when pgSubscriptionId is missing', async () => {
      const pendingNoPg = {
        id: 'sub-no-pg',
        status: 'PENDING',
        pgSubscriptionId: null,
        pgCustomerId: null,
        graceEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        createdAt: new Date(),
        plan: { slug: 'monthly', name: 'Monthly Plan', price: 12000 },
        invoices: [],
      }

      prisma.userSubscription.findUnique.mockResolvedValueOnce(pendingNoPg)

      const result = await service.getMySubscription('user-1')

      expect(result?.status).toBe('PENDING')
      expect(mockGateway.getSubscription).not.toHaveBeenCalled()
    })

    it('falls back to stale data when gateway API call fails during auto-repair', async () => {
      const pendingSub = {
        id: 'sub-stuck',
        status: 'PENDING',
        pgSubscriptionId: 'SUB-stuck',
        pgCustomerId: null,
        graceEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        createdAt: new Date(),
        plan: { slug: 'monthly', name: 'Monthly Plan', price: 12000 },
        invoices: [],
      }

      prisma.userSubscription.findUnique.mockResolvedValueOnce(pendingSub)
      mockGateway.getSubscription.mockRejectedValue(new Error('Network error'))

      const result = await service.getMySubscription('user-1')

      expect(result?.status).toBe('PENDING')
      expect(prisma.userSubscription.update).not.toHaveBeenCalled()
    })

    it('backfills currentPeriodEnd for ACTIVE subscription with missing period end', async () => {
      const activeSub = {
        id: 'sub-active',
        status: 'ACTIVE',
        pgSubscriptionId: 'SUB-active',
        pgCustomerId: null,
        graceEndsAt: null,
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        createdAt: new Date(),
        plan: { slug: 'monthly', name: 'Monthly Plan', price: 12000 },
        invoices: [],
      }
      const repairedSub = {
        ...activeSub,
        currentPeriodEnd: new Date('2026-08-29T00:00:00Z'),
        pgCustomerId: 'CUST-9',
      }

      prisma.userSubscription.findUnique.mockResolvedValueOnce(activeSub)
      mockGateway.getSubscription.mockResolvedValue({
        id: 'SUB-active',
        status: 'ACTIVE',
        nextPaymentDate: '2026-08-29T00:00:00Z',
        customerId: 'CUST-9',
      })
      prisma.userSubscription.update.mockResolvedValue(repairedSub)

      const result = await service.getMySubscription('user-1')

      expect(result?.status).toBe('ACTIVE')
      expect(result?.currentPeriodEnd).toEqual(new Date('2026-08-29T00:00:00Z'))
      expect(mockGateway.getSubscription).toHaveBeenCalledWith('SUB-active')
      expect(prisma.userSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          data: expect.objectContaining({
            status: 'ACTIVE',
            // currentPeriodStart is preserved for already-ACTIVE subs
            currentPeriodStart: activeSub.currentPeriodStart,
            currentPeriodEnd: new Date('2026-08-29T00:00:00Z'),
            pgCustomerId: 'CUST-9',
          }),
        }),
      )
    })

    it('does not auto-repair when ACTIVE subscription already has currentPeriodEnd', async () => {
      const activeSub = {
        id: 'sub-active',
        status: 'ACTIVE',
        pgSubscriptionId: 'SUB-active',
        pgCustomerId: 'CUST-1',
        graceEndsAt: null,
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: new Date('2025-02-01'),
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        createdAt: new Date(),
        plan: { slug: 'monthly', name: 'Monthly Plan', price: 12000 },
        invoices: [],
      }

      prisma.userSubscription.findUnique.mockResolvedValueOnce(activeSub)

      const result = await service.getMySubscription('user-1')

      expect(result?.currentPeriodEnd).toEqual(new Date('2025-02-01'))
      expect(mockGateway.getSubscription).not.toHaveBeenCalled()
    })

    it('does not auto-repair CANCELLED subscription even with missing period end', async () => {
      const cancelledSub = {
        id: 'sub-cancelled',
        status: 'CANCELLED',
        pgSubscriptionId: 'SUB-cancelled',
        pgCustomerId: 'CUST-1',
        graceEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        cancelledAt: new Date(),
        createdAt: new Date(),
        plan: { slug: 'monthly', name: 'Monthly Plan', price: 12000 },
        invoices: [],
      }

      prisma.userSubscription.findUnique.mockResolvedValueOnce(cancelledSub)

      const result = await service.getMySubscription('user-1')

      expect(result?.status).toBe('CANCELLED')
      expect(mockGateway.getSubscription).not.toHaveBeenCalled()
    })
  })

  // ─── cancelSubscription ─────────────────────────────────────────────

  describe('cancelSubscription', () => {
    it('schedules cancellation at period end via gateway and sets cancelAtPeriodEnd', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        status: 'ACTIVE',
        pgSubscriptionId: 'SUB-1',
        cancelAtPeriodEnd: false,
      })
      mockGateway.cancelSubscription.mockResolvedValue(undefined)
      prisma.userSubscription.update.mockResolvedValue({
        id: 'sub-1',
        cancelAtPeriodEnd: true,
      })

      await service.cancelSubscription('user-1')

      expect(mockGateway.cancelSubscription).toHaveBeenCalledWith('SUB-1')
      expect(prisma.userSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          data: {
            cancelAtPeriodEnd: true,
            cancelledAt: expect.any(Date),
          },
        }),
      )
    })

    it('throws NotFoundException when no subscription exists', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue(null)

      await expect(service.cancelSubscription('user-1')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws UnprocessableEntityException when subscription is already CANCELLED', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: 'CANCELLED',
      })

      await expect(service.cancelSubscription('user-1')).rejects.toThrow(
        UnprocessableEntityException,
      )
    })

    it('throws UnprocessableEntityException when subscription is already EXPIRED', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: 'EXPIRED',
      })

      await expect(service.cancelSubscription('user-1')).rejects.toThrow(
        UnprocessableEntityException,
      )
    })

    it('handles cancellation without pgSubscriptionId (skips gateway call)', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        status: 'ACTIVE',
        pgSubscriptionId: null,
      })

      await service.cancelSubscription('user-1')

      expect(mockGateway.cancelSubscription).not.toHaveBeenCalled()
      expect(prisma.userSubscription.update).toHaveBeenCalled()
    })
  })

  // ─── hasActiveSubscription ──────────────────────────────────────────

  describe('hasActiveSubscription', () => {
    it.each([
      [true, 'AUTHORIZED'],
      [true, 'ACTIVE'],
      [true, 'GRACE'],
      [false, 'PENDING'],
      [false, 'EXPIRED'],
      [false, 'CANCELLED'],
    ])('returns %s for %s status', async (expected, status) => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        status,
      })

      const result = await service.hasActiveSubscription('user-1')

      expect(result).toBe(expected)
    })

    it('returns false when no subscription exists', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue(null)

      const result = await service.hasActiveSubscription('user-1')

      expect(result).toBe(false)
    })

    it('returns false for ACTIVE with a past currentPeriodEnd', async () => {
      const past = new Date(Date.now() - 1000 * 60 * 60 * 24)
      prisma.userSubscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        currentPeriodEnd: past,
        graceEndsAt: null,
      })

      const result = await service.hasActiveSubscription('user-1')

      expect(result).toBe(false)
    })

    it('returns true for ACTIVE with a future currentPeriodEnd', async () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24)
      prisma.userSubscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        currentPeriodEnd: future,
        graceEndsAt: null,
      })

      const result = await service.hasActiveSubscription('user-1')

      expect(result).toBe(true)
    })

    it('returns false for GRACE with a past graceEndsAt', async () => {
      const past = new Date(Date.now() - 1000 * 60 * 60 * 24)
      prisma.userSubscription.findUnique.mockResolvedValue({
        status: 'GRACE',
        currentPeriodEnd: null,
        graceEndsAt: past,
      })

      const result = await service.hasActiveSubscription('user-1')

      expect(result).toBe(false)
    })

    it('returns true for GRACE with a future graceEndsAt', async () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24)
      prisma.userSubscription.findUnique.mockResolvedValue({
        status: 'GRACE',
        currentPeriodEnd: null,
        graceEndsAt: future,
      })

      const result = await service.hasActiveSubscription('user-1')

      expect(result).toBe(true)
    })

    it('reads from cache when a cached entitlement exists and skips the DB', async () => {
      mockRedis.cacheGet.mockResolvedValueOnce({
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60),
        graceEndsAt: null,
      })

      const result = await service.hasActiveSubscription('user-1')

      expect(result).toBe(true)
      expect(prisma.userSubscription.findUnique).not.toHaveBeenCalled()
    })

    it('caches the entitlement data on a cache miss', async () => {
      const future = new Date(Date.now() + 1000 * 60 * 60)
      prisma.userSubscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        currentPeriodEnd: future,
        graceEndsAt: null,
      })

      await service.hasActiveSubscription('user-1')

      expect(mockRedis.cacheSet).toHaveBeenCalledWith(
        'subscription:entitlement:user-1',
        { status: 'ACTIVE', currentPeriodEnd: future, graceEndsAt: null },
        60,
      )
    })

    it('falls back to the DB when Redis is unavailable (cacheGet returns null)', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue(null)

      const result = await service.hasActiveSubscription('user-1')

      expect(result).toBe(false)
      expect(prisma.userSubscription.findUnique).toHaveBeenCalled()
    })
  })

  describe('entitlement cache invalidation', () => {
    it('deletes the cached entitlement after cancelSubscription', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        status: 'ACTIVE',
        planId: 'plan-1',
        pgSubscriptionId: 'pg-1',
        currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24),
      })
      mockGateway.cancelSubscription.mockResolvedValue(undefined)
      prisma.userSubscription.update.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        status: 'CANCELLED',
      })

      await service.cancelSubscription('user-1')

      expect(mockRedis.del).toHaveBeenCalledWith('subscription:entitlement:user-1')
    })

    it('deletes the cached entitlement after createSubscription', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue(null)
      prisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-1',
        pgPlanId: 'pg-plan-123',
        slug: 'monthly',
        name: 'Monthly Plan',
        price: 12000,
      })
      mockGateway.createSubscription.mockResolvedValue({
        id: 'SUB-1',
        initPoint: '',
        status: 'PENDING',
      })
      prisma.userSubscription.upsert.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
      })

      await service.createSubscription({
        userId: 'user-1',
        planId: 'plan-1',
        email: 'user@example.com',
      })

      expect(mockRedis.del).toHaveBeenCalledWith('subscription:entitlement:user-1')
    })
  })

  // ─── processWebhook ─────────────────────────────────────────────────

  describe('processWebhook', () => {
    const pgSubId = 'SUB-1'
    const rawBody = JSON.stringify({ type: 'subscription.activated', data: { id: pgSubId } })

    beforeEach(() => {
      mockGateway.validateWebhook.mockReturnValue(true)
    })

    describe('subscription.activated', () => {
      it('transitions to ACTIVE and clears grace period', async () => {
        mockGateway.getSubscription.mockResolvedValue({
          id: pgSubId,
          status: 'ACTIVE',
          nextPaymentDate: '2025-03-01T00:00:00Z',
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 's1' })

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'subscription.activated',
          data: { id: pgSubId },
        })

        expect(result).toBe('activated')
        expect(prisma.userSubscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { pgSubscriptionId: pgSubId },
            data: expect.objectContaining({
              status: 'ACTIVE',
              graceEndsAt: null,
              currentPeriodEnd: expect.any(Date),
            }),
          }),
        )
      })

      it('handles missing nextPaymentDate', async () => {
        mockGateway.getSubscription.mockResolvedValue({
          id: pgSubId,
          status: 'ACTIVE',
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 's1' })

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'subscription.activated',
          data: { id: pgSubId },
        })

        expect(result).toBe('activated')
        expect(prisma.userSubscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: 'ACTIVE',
              graceEndsAt: null,
              currentPeriodEnd: null,
            }),
          }),
        )
      })

      it('returns noop when data.id is missing', async () => {
        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'subscription.activated',
          data: { id: '' },
        })
        expect(result).toBe('noop')
      })

      it('returns error when gateway API call fails', async () => {
        mockGateway.getSubscription.mockRejectedValue(
          new Error('PagBank API error'),
        )

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'subscription.activated',
          data: { id: pgSubId },
        })

        expect(result).toBe('error')
      })
    })

    describe('subscription.canceled', () => {
      it('marks subscription as CANCELLED when not user-initiated', async () => {
        prisma.userSubscription.findUnique.mockResolvedValue({
          cancelAtPeriodEnd: false,
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 's1' })

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'subscription.canceled',
          data: { id: pgSubId },
        })

        expect(result).toBe('cancelled')
        expect(prisma.userSubscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { pgSubscriptionId: pgSubId },
            data: expect.objectContaining({
              status: 'CANCELLED',
              cancelledAt: expect.any(Date),
            }),
          }),
        )
      })

      it('returns cancelled_at_period_end when user initiated', async () => {
        prisma.userSubscription.findUnique.mockResolvedValue({
          cancelAtPeriodEnd: true,
          currentPeriodEnd: new Date('2025-03-01'),
        })

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'subscription.canceled',
          data: { id: pgSubId },
        })

        expect(result).toBe('cancelled_at_period_end')
        expect(prisma.userSubscription.update).not.toHaveBeenCalled()
      })

      it('returns error when prisma update fails', async () => {
        prisma.userSubscription.findUnique.mockResolvedValue({
          cancelAtPeriodEnd: false,
        })
        prisma.userSubscription.update.mockRejectedValue(
          new Error('DB error'),
        )

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'subscription.canceled',
          data: { id: pgSubId },
        })

        expect(result).toBe('error')
      })
    })

    describe('subscription.recurrence', () => {
      it('reactivates from GRACE and extends period', async () => {
        mockGateway.getSubscription.mockResolvedValue({
          id: pgSubId,
          status: 'ACTIVE',
          nextPaymentDate: '2025-04-01T00:00:00Z',
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 's1' })

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'subscription.recurrence',
          data: { id: pgSubId },
        })

        expect(result).toBe('recurrence_processed')
        expect(prisma.userSubscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { pgSubscriptionId: pgSubId },
            data: {
              status: 'ACTIVE',
              graceEndsAt: null,
              currentPeriodEnd: new Date('2025-04-01T00:00:00Z'),
            },
          }),
        )
      })

      it('returns error when gateway API fails', async () => {
        mockGateway.getSubscription.mockRejectedValue(new Error('API error'))

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'subscription.recurrence',
          data: { id: pgSubId },
        })

        expect(result).toBe('error')
      })
    })

    describe('subscription.updated', () => {
      it('mirrors cancelled status from gateway', async () => {
        mockGateway.getSubscription.mockResolvedValue({
          id: pgSubId,
          status: 'CANCELED',
        })
        prisma.userSubscription.findUnique.mockResolvedValue({
          cancelAtPeriodEnd: false,
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 's1' })

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'subscription.updated',
          data: { id: pgSubId },
        })

        expect(result).toBe('cancelled')
      })

      it('catches missed activated webhook when local is PENDING and gateway is ACTIVE', async () => {
        mockGateway.getSubscription.mockResolvedValue({
          id: pgSubId,
          status: 'ACTIVE',
          nextPaymentDate: '2025-02-01T00:00:00Z',
        })
        prisma.userSubscription.findUnique.mockResolvedValue({
          status: 'PENDING',
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 's1' })

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'subscription.updated',
          data: { id: pgSubId },
        })

        expect(result).toBe('advanced')
      })

      it('updates currentPeriodEnd when next_billing_date changes', async () => {
        mockGateway.getSubscription.mockResolvedValue({
          id: pgSubId,
          status: 'ACTIVE',
          nextPaymentDate: '2025-04-01T00:00:00Z',
        })
        prisma.userSubscription.findUnique.mockResolvedValue({
          status: 'ACTIVE',
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 's1' })

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'subscription.updated',
          data: { id: pgSubId },
        })

        expect(result).toBe('updated')
      })

      it('returns error when gateway API call fails', async () => {
        mockGateway.getSubscription.mockRejectedValue(
          new Error('PagBank API error'),
        )

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'subscription.updated',
          data: { id: pgSubId },
        })

        expect(result).toBe('error')
      })
    })

    describe('charge.paid / charge.failed', () => {
      it('handles paid charge for GRACE→ACTIVE reactivation', async () => {
        mockGateway.getPaymentCharge.mockResolvedValue({
          id: 'CHARGE-1',
          status: 'paid',
          subscriptionId: 'SUB-1',
          transactionAmount: 12000,
          currencyId: 'BRL',
          nextPaymentDate: '2025-02-15T12:00:00Z',
          dateApproved: '2025-01-15T12:00:00Z',
        })
        prisma.userSubscription.findUnique.mockResolvedValue({
          id: 'sub-1',
          status: 'GRACE',
          planId: 'monthly',
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 'sub-1' })
        prisma.subscriptionInvoice.upsert.mockResolvedValue({ id: 'inv-1' })

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'charge.paid',
          data: { id: 'CHARGE-1' },
        })

        expect(result).toBe('payment_approved')
        expect(mockGateway.getPaymentCharge).toHaveBeenCalledWith('CHARGE-1')
        expect(prisma.userSubscription.findUnique).toHaveBeenCalledWith({
          where: { pgSubscriptionId: 'SUB-1' },
          select: { id: true, status: true, planId: true, userId: true },
        })
        // Reactivates from GRACE
        expect(prisma.userSubscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'sub-1' },
            data: { status: 'ACTIVE', graceEndsAt: null },
          }),
        )
        // Also extends period end via next_payment_date
        expect(prisma.userSubscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'sub-1' },
            data: { currentPeriodEnd: new Date('2025-02-15T12:00:00Z') },
          }),
        )
        // Upserts invoice with charge data
        expect(prisma.subscriptionInvoice.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { pgInvoiceId: 'CHARGE-1' },
            create: expect.objectContaining({
              subscriptionId: 'sub-1',
              amount: 12000,
              status: 'paid',
            }),
          }),
        )
      })

      it('returns noop when charge has no subscriptionId', async () => {
        mockGateway.getPaymentCharge.mockResolvedValue({
          id: 'CHARGE-unknown',
          status: 'paid',
          subscriptionId: '',
          transactionAmount: 12000,
          currencyId: 'BRL',
          nextPaymentDate: null,
          dateApproved: null,
        })

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'charge.paid',
          data: { id: 'CHARGE-unknown' },
        })

        expect(result).toBe('noop')
      })

      it('handles paid charge for non-GRACE subscription', async () => {
        mockGateway.getPaymentCharge.mockResolvedValue({
          id: 'CHARGE-2',
          status: 'paid',
          subscriptionId: 'SUB-2',
          transactionAmount: 12000,
          currencyId: 'BRL',
          nextPaymentDate: '2025-02-15T12:00:00Z',
          dateApproved: '2025-01-15T12:00:00Z',
        })
        prisma.userSubscription.findUnique.mockResolvedValue({
          id: 'sub-2',
          status: 'ACTIVE',
          planId: 'monthly',
        })
        prisma.subscriptionInvoice.upsert.mockResolvedValue({ id: 'inv-2' })

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'charge.paid',
          data: { id: 'CHARGE-2' },
        })

        expect(result).toBe('payment_approved')
        // Should NOT reactivate (not in GRACE), only upsert invoice and extend period
        expect(prisma.subscriptionInvoice.upsert).toHaveBeenCalled()
        expect(prisma.userSubscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'sub-2' },
            data: { currentPeriodEnd: new Date('2025-02-15T12:00:00Z') },
          }),
        )
      })

      it('handles rejected charge moving to GRACE', async () => {
        mockGateway.getPaymentCharge.mockResolvedValue({
          id: 'CHARGE-rejected',
          status: 'failed',
          subscriptionId: 'SUB-3',
          transactionAmount: 12000,
          currencyId: 'BRL',
          nextPaymentDate: null,
          dateApproved: null,
        })
        prisma.userSubscription.findUnique.mockResolvedValue({
          id: 'sub-3',
          status: 'ACTIVE',
          planId: 'monthly',
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 'sub-3' })
        prisma.subscriptionInvoice.upsert.mockResolvedValue({ id: 'inv-3' })

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'charge.failed',
          data: { id: 'CHARGE-rejected' },
        })

        expect(result).toBe('payment_rejected')
        expect(prisma.userSubscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'sub-3' },
            data: expect.objectContaining({
              status: 'GRACE',
              graceEndsAt: expect.any(Date),
            }),
          }),
        )
      })

      it('returns error when getPaymentCharge fails', async () => {
        mockGateway.getPaymentCharge.mockRejectedValue(
          new Error('PagBank API error'),
        )

        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'charge.paid',
          data: { id: 'CHARGE-err' },
        })

        expect(result).toBe('error')
      })
    })

    describe('charge.created', () => {
      it('returns noop for charge.created events', async () => {
        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'charge.created',
          data: { id: 'CHARGE-1' },
        })

        expect(result).toBe('noop')
      })
    })

    describe('charge.refunded', () => {
      it('returns payment_refunded for charge.refunded events', async () => {
        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'charge.refunded',
          data: { id: 'CHARGE-1' },
        })

        expect(result).toBe('payment_refunded')
      })
    })

    describe('unhandled types', () => {
      it('returns noop for unknown event types', async () => {
        const result = await service.processWebhook(rawBody, 'valid-token', {
          type: 'unknown_event_type',
          data: { id: 'whatever' },
        })

        expect(result).toBe('noop')
      })
    })

    describe('validation', () => {
      it('returns invalid_signature when authenticity token is invalid', async () => {
        mockGateway.validateWebhook.mockReturnValue(false)

        const result = await service.processWebhook(rawBody, 'bad-token', {
          type: 'subscription.activated',
          data: { id: pgSubId },
        })

        expect(result).toBe('invalid_signature')
        expect(prisma.userSubscription.update).not.toHaveBeenCalled()
      })
    })
  })

  // ─── updatePaymentMethod ───────────────────────────────────────────

  describe('updatePaymentMethod', () => {
    it('updates payment method successfully', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: 'ACTIVE',
        pgSubscriptionId: 'SUB-1',
        pgCustomerId: 'CUST-1',
      })
      mockGateway.updatePaymentMethod.mockResolvedValue(undefined)

      await service.updatePaymentMethod('user-1', 'encrypted-card-new')

      expect(mockGateway.updatePaymentMethod).toHaveBeenCalledWith(
        'SUB-1',
        'CUST-1',
        'encrypted-card-new',
      )
    })

    it('throws NotFoundException when no subscription exists', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue(null)

      await expect(
        service.updatePaymentMethod('user-1', 'card-token'),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws when subscription is CANCELLED', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: 'CANCELLED',
      })

      await expect(
        service.updatePaymentMethod('user-1', 'card-token'),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws when subscription has no pgSubscriptionId', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: 'ACTIVE',
        pgSubscriptionId: null,
      })

      await expect(
        service.updatePaymentMethod('user-1', 'card-token'),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws when subscription has no pgCustomerId', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        status: 'ACTIVE',
        pgSubscriptionId: 'SUB-1',
        pgCustomerId: null,
      })

      await expect(
        service.updatePaymentMethod('user-1', 'card-token'),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })

  // ─── expireGraceSubscriptions ───────────────────────────────────────

  describe('expireGraceSubscriptions', () => {
    it('expires grace subscriptions past their graceEndsAt date', async () => {
      prisma.userSubscription.updateMany.mockResolvedValue({ count: 3 })

      const result = await service.expireGraceSubscriptions()

      expect(result).toBe(3)
      expect(prisma.userSubscription.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'GRACE',
          graceEndsAt: { lte: expect.any(Date) },
        },
        data: { status: 'EXPIRED' },
      })
    })

    it('returns 0 when no subscriptions are expired', async () => {
      prisma.userSubscription.updateMany.mockResolvedValue({ count: 0 })

      const result = await service.expireGraceSubscriptions()

      expect(result).toBe(0)
    })
  })

  // ─── expireCancelledSubscriptions ───────────────────────────────────

  describe('expireCancelledSubscriptions', () => {
    it('expires cancel-at-period-end subscriptions past their currentPeriodEnd', async () => {
      prisma.userSubscription.updateMany.mockResolvedValue({ count: 2 })

      const result = await service.expireCancelledSubscriptions()

      expect(result).toBe(2)
      expect(prisma.userSubscription.updateMany).toHaveBeenCalledWith({
        where: {
          cancelAtPeriodEnd: true,
          currentPeriodEnd: { lte: expect.any(Date) },
          status: { notIn: ['EXPIRED', 'CANCELLED'] },
        },
        data: { status: 'EXPIRED' },
      })
    })

    it('returns 0 when no subscriptions to expire', async () => {
      prisma.userSubscription.updateMany.mockResolvedValue({ count: 0 })

      const result = await service.expireCancelledSubscriptions()

      expect(result).toBe(0)
    })
  })
})
