jest.mock("../../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test } from '@nestjs/testing'
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { SubscriptionService } from '../subscription.service'
import { MercadoPagoService } from '../mercado-pago.service'
import { PrismaService } from '../../prisma.service'
import { createMockPrismaService } from '../../__mocks__/prisma-service.mock'

const mockMpService = {
  createSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  getSubscription: jest.fn(),
  getAuthorizedPayment: jest.fn(),
  validateWebhook: jest.fn(),
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
        { provide: MercadoPagoService, useValue: mockMpService },
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
      mpPlanId: 'mp-plan-123',
      slug: 'monthly',
      name: 'Monthly Plan',
      price: 12000,
    }

    it('creates a subscription and returns initPoint and subscriptionId', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue(null)
      prisma.subscriptionPlan.findUnique.mockResolvedValue(plan)
      mockMpService.createSubscription.mockResolvedValue({
        id: 'mp-sub-1',
        init_point: 'https://mercadopago.com/checkout/123',
        status: 'pending',
      })
      prisma.userSubscription.upsert.mockResolvedValue({
        id: 'local-sub-1',
        userId,
        planId,
        mpSubscriptionId: 'mp-sub-1',
        status: 'PENDING',
      })

      const result = await service.createSubscription(userId, planId, email)

      expect(result).toEqual({
        initPoint: 'https://mercadopago.com/checkout/123',
        subscriptionId: 'local-sub-1',
      })
      expect(mockMpService.createSubscription).toHaveBeenCalledWith(
        plan.mpPlanId,
        email,
        expect.stringContaining('/subscription/success'),
        plan.price,
        plan.slug,
        plan.name,
        undefined, // cardTokenId
        undefined, // payerName
        undefined, // payerDocument
      )
      expect(prisma.userSubscription.upsert).toHaveBeenCalled()
    })

    it('saves AUTHORIZED status when MP returns authorized (card token flow)', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue(null)
      prisma.subscriptionPlan.findUnique.mockResolvedValue(plan)
      mockMpService.createSubscription.mockResolvedValue({
        id: 'mp-sub-auth',
        init_point: null,
        status: 'authorized',
      })
      prisma.userSubscription.upsert.mockResolvedValue({
        id: 'local-sub-auth',
        userId,
        planId,
        mpSubscriptionId: 'mp-sub-auth',
        status: 'AUTHORIZED',
      })

      await service.createSubscription(userId, planId, email, 'card-tok-123', 'João Silva', '12345678909')

      // Verify upsert uses AUTHORIZED status
      const upsertCall = prisma.userSubscription.upsert.mock.calls[0][0]
      expect(upsertCall.create.status).toBe('AUTHORIZED')
      expect(upsertCall.update.status).toBe('AUTHORIZED')
      expect(upsertCall.create.currentPeriodStart).toBeInstanceOf(Date)
    })

    it('throws UnprocessableEntityException when user has an active subscription', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        id: 'existing',
        userId,
        status: 'ACTIVE',
      })

      await expect(
        service.createSubscription(userId, planId, email),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws NotFoundException when plan is not found', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue(null)
      prisma.subscriptionPlan.findUnique.mockResolvedValue(null)

      await expect(
        service.createSubscription(userId, planId, email),
      ).rejects.toThrow(NotFoundException)
    })

    it('allows creating a new subscription when existing is CANCELLED (upserts)', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        id: 'existing',
        userId,
        status: 'CANCELLED',
      })
      prisma.subscriptionPlan.findUnique.mockResolvedValue(plan)
      mockMpService.createSubscription.mockResolvedValue({
        id: 'mp-sub-2',
        init_point: 'https://mercadopago.com/checkout/456',
        status: 'pending',
      })
      prisma.userSubscription.upsert.mockResolvedValue({
        id: 'local-sub-2',
        userId,
        planId,
        mpSubscriptionId: 'mp-sub-2',
        status: 'PENDING',
      })

      const result = await service.createSubscription(userId, planId, email)

      expect(result.initPoint).toBe('https://mercadopago.com/checkout/456')
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
        mpSubscriptionId: 'mp-1',
        graceEndsAt: null,
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: new Date('2025-02-01'),
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

      expect(result).toEqual(subData)
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

    it('auto-repairs PENDING subscription when MP reports authorized', async () => {
      const pendingSub = {
        id: 'sub-stuck',
        status: 'PENDING',
        mpSubscriptionId: 'mp-stuck',
        graceEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelledAt: null,
        createdAt: new Date(),
        plan: { slug: 'monthly', name: 'Monthly Plan', price: 12000 },
        invoices: [],
      }
      const repairedSub = {
        ...pendingSub,
        status: 'AUTHORIZED',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date('2026-08-29'),
      }

      prisma.userSubscription.findUnique.mockResolvedValueOnce(pendingSub)
      mockMpService.getSubscription.mockResolvedValue({
        id: 'mp-stuck',
        status: 'authorized',
        next_payment_date: '2026-08-29T00:00:00Z',
      })
      prisma.userSubscription.update.mockResolvedValue(repairedSub)

      const result = await service.getMySubscription('user-1')

      expect(result?.status).toBe('AUTHORIZED')
      expect(result?.currentPeriodStart).toBeInstanceOf(Date)
      expect(result?.currentPeriodEnd).toBeInstanceOf(Date)
      expect(mockMpService.getSubscription).toHaveBeenCalledWith('mp-stuck')
    })

    it('does not auto-repair when MP also reports pending', async () => {
      const pendingSub = {
        id: 'sub-pending',
        status: 'PENDING',
        mpSubscriptionId: 'mp-pending',
        graceEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelledAt: null,
        createdAt: new Date(),
        plan: { slug: 'monthly', name: 'Monthly Plan', price: 12000 },
        invoices: [],
      }

      prisma.userSubscription.findUnique.mockResolvedValueOnce(pendingSub)
      mockMpService.getSubscription.mockResolvedValue({
        id: 'mp-pending',
        status: 'pending',
      })

      const result = await service.getMySubscription('user-1')

      expect(result?.status).toBe('PENDING')
      expect(prisma.userSubscription.update).not.toHaveBeenCalled()
    })

    it('does not call MP when local status is not PENDING', async () => {
      const activeSub = {
        id: 'sub-active',
        status: 'ACTIVE',
        mpSubscriptionId: 'mp-active',
        graceEndsAt: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelledAt: null,
        createdAt: new Date(),
        plan: { slug: 'monthly', name: 'Monthly Plan', price: 12000 },
        invoices: [],
      }

      prisma.userSubscription.findUnique.mockResolvedValueOnce(activeSub)

      const result = await service.getMySubscription('user-1')

      expect(result?.status).toBe('ACTIVE')
      expect(mockMpService.getSubscription).not.toHaveBeenCalled()
    })

    it('does not auto-repair when mpSubscriptionId is missing', async () => {
      const pendingNoMp = {
        id: 'sub-no-mp',
        status: 'PENDING',
        mpSubscriptionId: null,
        graceEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelledAt: null,
        createdAt: new Date(),
        plan: { slug: 'monthly', name: 'Monthly Plan', price: 12000 },
        invoices: [],
      }

      prisma.userSubscription.findUnique.mockResolvedValueOnce(pendingNoMp)

      const result = await service.getMySubscription('user-1')

      expect(result?.status).toBe('PENDING')
      expect(mockMpService.getSubscription).not.toHaveBeenCalled()
    })

    it('falls back to stale data when MP API call fails during auto-repair', async () => {
      const pendingSub = {
        id: 'sub-stuck',
        status: 'PENDING',
        mpSubscriptionId: 'mp-stuck',
        graceEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelledAt: null,
        createdAt: new Date(),
        plan: { slug: 'monthly', name: 'Monthly Plan', price: 12000 },
        invoices: [],
      }

      prisma.userSubscription.findUnique.mockResolvedValueOnce(pendingSub)
      mockMpService.getSubscription.mockRejectedValue(new Error('Network error'))

      const result = await service.getMySubscription('user-1')

      expect(result?.status).toBe('PENDING')
      expect(prisma.userSubscription.update).not.toHaveBeenCalled()
    })
  })

  // ─── cancelSubscription ─────────────────────────────────────────────

  describe('cancelSubscription', () => {
    it('schedules cancellation at period end via MP and sets cancelAtPeriodEnd', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        status: 'ACTIVE',
        mpSubscriptionId: 'mp-1',
        cancelAtPeriodEnd: false,
      })
      mockMpService.cancelSubscription.mockResolvedValue(undefined)
      prisma.userSubscription.update.mockResolvedValue({
        id: 'sub-1',
        cancelAtPeriodEnd: true,
      })

      await service.cancelSubscription('user-1')

      expect(mockMpService.cancelSubscription).toHaveBeenCalledWith('mp-1')
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

    it('handles cancellation without mpSubscriptionId (skips MP call)', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        status: 'ACTIVE',
        mpSubscriptionId: null,
      })

      await service.cancelSubscription('user-1')

      expect(mockMpService.cancelSubscription).not.toHaveBeenCalled()
      expect(prisma.userSubscription.update).toHaveBeenCalled()
    })
  })

  // ─── hasActiveSubscription ──────────────────────────────────────────

  describe('hasActiveSubscription', () => {
    it('returns true for AUTHORIZED status', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        status: 'AUTHORIZED',
      })

      const result = await service.hasActiveSubscription('user-1')

      expect(result).toBe(true)
    })

    it('returns true for ACTIVE status', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
      })

      const result = await service.hasActiveSubscription('user-1')

      expect(result).toBe(true)
    })

    it('returns true for GRACE status', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        status: 'GRACE',
      })

      const result = await service.hasActiveSubscription('user-1')

      expect(result).toBe(true)
    })

    it('returns false for PENDING status', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        status: 'PENDING',
      })

      const result = await service.hasActiveSubscription('user-1')

      expect(result).toBe(false)
    })

    it('returns false for EXPIRED status', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        status: 'EXPIRED',
      })

      const result = await service.hasActiveSubscription('user-1')

      expect(result).toBe(false)
    })

    it('returns false for CANCELLED status', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue({
        status: 'CANCELLED',
      })

      const result = await service.hasActiveSubscription('user-1')

      expect(result).toBe(false)
    })

    it('returns false when no subscription exists', async () => {
      prisma.userSubscription.findUnique.mockResolvedValue(null)

      const result = await service.hasActiveSubscription('user-1')

      expect(result).toBe(false)
    })
  })

  // ─── processWebhook ─────────────────────────────────────────────────

  describe('processWebhook', () => {
    const mpSubId = 'mp-sub-1'

    describe('subscription_authorized', () => {
      it('transitions PENDING → AUTHORIZED and sets period dates', async () => {
        mockMpService.getSubscription.mockResolvedValue({
          id: mpSubId,
          status: 'authorized',
          next_payment_date: '2025-02-01T00:00:00Z',
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 's1' })

        const result = await service.processWebhook({
          type: 'subscription_authorized',
          data: { id: mpSubId },
        })

        expect(result).toBe('authorized')
        expect(prisma.userSubscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { mpSubscriptionId: mpSubId },
            data: expect.objectContaining({
              status: 'AUTHORIZED',
              currentPeriodStart: expect.any(Date),
              currentPeriodEnd: expect.any(Date),
            }),
          }),
        )
      })

      it('returns noop when data.id is missing', async () => {
        const result = await service.processWebhook({
          type: 'subscription_authorized',
          data: { id: '' },
        })
        expect(result).toBe('noop')
      })

      it('returns error when MP API call fails', async () => {
        mockMpService.getSubscription.mockRejectedValue(
          new Error('MP API error'),
        )

        const result = await service.processWebhook({
          type: 'subscription_authorized',
          data: { id: mpSubId },
        })

        expect(result).toBe('error')
      })
    })

    describe('subscription_activated', () => {
      it('transitions to ACTIVE and clears grace period', async () => {
        mockMpService.getSubscription.mockResolvedValue({
          id: mpSubId,
          status: 'active',
          next_payment_date: '2025-03-01T00:00:00Z',
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 's1' })

        const result = await service.processWebhook({
          type: 'subscription_activated',
          data: { id: mpSubId },
        })

        expect(result).toBe('activated')
        expect(prisma.userSubscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { mpSubscriptionId: mpSubId },
            data: expect.objectContaining({
              status: 'ACTIVE',
              graceEndsAt: null,
              currentPeriodEnd: expect.any(Date),
            }),
          }),
        )
      })

      it('handles missing next_payment_date', async () => {
        mockMpService.getSubscription.mockResolvedValue({
          id: mpSubId,
          status: 'active',
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 's1' })

        const result = await service.processWebhook({
          type: 'subscription_activated',
          data: { id: mpSubId },
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

      it('returns error when MP API call fails for activated event', async () => {
        mockMpService.getSubscription.mockRejectedValue(
          new Error('MP API error'),
        )

        const result = await service.processWebhook({
          type: 'subscription_activated',
          data: { id: mpSubId },
        })

        expect(result).toBe('error')
      })
    })

    describe('subscription_cancelled', () => {
      it('marks subscription as CANCELLED', async () => {
        prisma.userSubscription.update.mockResolvedValue({ id: 's1' })

        const result = await service.processWebhook({
          type: 'subscription_cancelled',
          data: { id: mpSubId },
        })

        expect(result).toBe('cancelled')
        expect(prisma.userSubscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { mpSubscriptionId: mpSubId },
            data: expect.objectContaining({
              status: 'CANCELLED',
              cancelledAt: expect.any(Date),
            }),
          }),
        )
      })

      it('returns error when prisma update fails for cancelled event', async () => {
        prisma.userSubscription.update.mockRejectedValue(
          new Error('DB error'),
        )

        const result = await service.processWebhook({
          type: 'subscription_cancelled',
          data: { id: mpSubId },
        })

        expect(result).toBe('error')
      })
    })

    describe('subscription_updated', () => {
      it('mirrors cancelled status from MP', async () => {
        mockMpService.getSubscription.mockResolvedValue({
          id: mpSubId,
          status: 'cancelled',
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 's1' })

        const result = await service.processWebhook({
          type: 'subscription_updated',
          data: { id: mpSubId },
        })

        expect(result).toBe('cancelled')
      })

      it('catches missed authorized webhook when local is PENDING and MP is authorized', async () => {
        mockMpService.getSubscription.mockResolvedValue({
          id: mpSubId,
          status: 'authorized',
          next_payment_date: '2025-02-01T00:00:00Z',
        })
        prisma.userSubscription.findUnique.mockResolvedValue({
          status: 'PENDING',
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 's1' })

        const result = await service.processWebhook({
          type: 'subscription_updated',
          data: { id: mpSubId },
        })

        expect(result).toBe('authorized')
      })

      it('updates currentPeriodEnd when next_payment_date changes', async () => {
        mockMpService.getSubscription.mockResolvedValue({
          id: mpSubId,
          status: 'active',
          next_payment_date: '2025-04-01T00:00:00Z',
        })
        prisma.userSubscription.findUnique.mockResolvedValue({
          status: 'ACTIVE',
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 's1' })

        const result = await service.processWebhook({
          type: 'subscription_updated',
          data: { id: mpSubId },
        })

        expect(result).toBe('updated')
      })

      it('returns error when MP API call fails for updated event', async () => {
        mockMpService.getSubscription.mockRejectedValue(
          new Error('MP API error'),
        )

        const result = await service.processWebhook({
          type: 'subscription_updated',
          data: { id: mpSubId },
        })

        expect(result).toBe('error')
      })
    })

    describe('authorized_payment / payment', () => {
      it('handles approved payment for GRACE→ACTIVE reactivation', async () => {
        mockMpService.getAuthorizedPayment.mockResolvedValue({
          id: 'mp-charge-1',
          status: 'approved',
          status_detail: 'accredited',
          preapproval_id: 'mp-sub-1',
          transaction_amount: 120,
          currency_id: 'BRL',
          date_approved: '2025-01-15T12:00:00Z',
          next_payment_date: '2025-02-15T12:00:00Z',
          payment_method_id: 'visa',
          date_created: '2025-01-15T11:00:00Z',
        })
        prisma.userSubscription.findUnique.mockResolvedValue({
          id: 'sub-1',
          status: 'GRACE',
          planId: 'monthly',
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 'sub-1' })
        prisma.subscriptionInvoice.upsert.mockResolvedValue({ id: 'inv-1' })

        const result = await service.processWebhook({
          type: 'authorized_payment',
          data: { id: 'mp-charge-1' },
        })

        expect(result).toBe('payment_approved')
        expect(mockMpService.getAuthorizedPayment).toHaveBeenCalledWith('mp-charge-1')
        expect(prisma.userSubscription.findUnique).toHaveBeenCalledWith({
          where: { mpSubscriptionId: 'mp-sub-1' },
          select: { id: true, status: true, planId: true },
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
            where: { mpInvoiceId: 'mp-charge-1' },
            create: expect.objectContaining({
              subscriptionId: 'sub-1',
              amount: 12000, // 120 * 100
              status: 'paid',
            }),
          }),
        )
      })

      it('returns noop when charge has no preapproval_id', async () => {
        mockMpService.getAuthorizedPayment.mockResolvedValue({
          id: 'mp-charge-unknown',
          status: 'approved',
          status_detail: 'accredited',
          preapproval_id: null,
          transaction_amount: 120,
          currency_id: 'BRL',
          date_approved: null,
          next_payment_date: null,
          payment_method_id: null,
          date_created: '2025-01-15T11:00:00Z',
        })

        const result = await service.processWebhook({
          type: 'payment',
          data: { id: 'mp-charge-unknown' },
        })

        expect(result).toBe('noop')
      })

      it('handles approved payment for non-GRACE subscription', async () => {
        mockMpService.getAuthorizedPayment.mockResolvedValue({
          id: 'mp-charge-2',
          status: 'approved',
          status_detail: 'accredited',
          preapproval_id: 'mp-sub-2',
          transaction_amount: 120,
          currency_id: 'BRL',
          date_approved: '2025-01-15T12:00:00Z',
          next_payment_date: '2025-02-15T12:00:00Z',
          payment_method_id: 'visa',
          date_created: '2025-01-15T11:00:00Z',
        })
        prisma.userSubscription.findUnique.mockResolvedValue({
          id: 'sub-2',
          status: 'ACTIVE',
          planId: 'monthly',
        })
        prisma.subscriptionInvoice.upsert.mockResolvedValue({ id: 'inv-2' })

        const result = await service.processWebhook({
          type: 'payment',
          data: { id: 'mp-charge-2' },
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

      it('handles rejected payment moving to GRACE', async () => {
        mockMpService.getAuthorizedPayment.mockResolvedValue({
          id: 'mp-charge-rejected',
          status: 'rejected',
          status_detail: 'cc_rejected',
          preapproval_id: 'mp-sub-3',
          transaction_amount: 120,
          currency_id: 'BRL',
          date_approved: null,
          next_payment_date: null,
          payment_method_id: 'visa',
          date_created: '2025-01-15T11:00:00Z',
        })
        prisma.userSubscription.findUnique.mockResolvedValue({
          id: 'sub-3',
          status: 'ACTIVE',
          planId: 'monthly',
        })
        prisma.userSubscription.update.mockResolvedValue({ id: 'sub-3' })
        prisma.subscriptionInvoice.upsert.mockResolvedValue({ id: 'inv-3' })

        const result = await service.processWebhook({
          type: 'authorized_payment',
          data: { id: 'mp-charge-rejected' },
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

      it('returns error when getAuthorizedPayment fails', async () => {
        mockMpService.getAuthorizedPayment.mockRejectedValue(
          new Error('MP API error'),
        )

        const result = await service.processWebhook({
          type: 'payment',
          data: { id: 'mp-charge-err' },
        })

        expect(result).toBe('error')
      })
    })

    describe('unhandled types', () => {
      it('returns noop for unknown event types', async () => {
        const result = await service.processWebhook({
          type: 'unknown_event_type',
          data: { id: 'whatever' },
        })

        expect(result).toBe('noop')
      })
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
})
