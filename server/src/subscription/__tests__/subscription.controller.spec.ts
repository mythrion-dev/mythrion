jest.mock("../../generated/prisma/client", () => ({ PrismaClient: class {} }))
jest.mock("pg", () => ({ default: { Pool: jest.fn() }, Pool: jest.fn() }))
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }))
import { Test } from '@nestjs/testing'
import {
  UnprocessableEntityException,
  HttpStatus,
} from '@nestjs/common'
import { SubscriptionController } from '../subscription.controller'
import { SubscriptionService } from '../subscription.service'
import { MercadoPagoService } from '../mercado-pago.service'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import type { Request } from 'express'

describe('SubscriptionController', () => {
  let controller: SubscriptionController
  let subscriptionService: jest.Mocked<SubscriptionService>
  let mpService: jest.Mocked<MercadoPagoService>

  const mockUser = { sub: 'user-1', email: 'user@test.com', role: 'user' }

  function createRequest(overrides?: Partial<Request>): any {
    return {
      user: mockUser,
      ...overrides,
    }
  }

  beforeEach(async () => {
    subscriptionService = {
      listPlans: jest.fn(),
      createSubscription: jest.fn(),
      getMySubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      processWebhook: jest.fn(),
      expireGraceSubscriptions: jest.fn(),
      expireCancelledSubscriptions: jest.fn(),
      hasActiveSubscription: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionService>

    mpService = {
      validateWebhook: jest.fn(),
      createSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      getSubscription: jest.fn(),
    } as unknown as jest.Mocked<MercadoPagoService>

    jest.clearAllMocks()

    const module = await Test.createTestingModule({
      controllers: [SubscriptionController],
      providers: [
        { provide: SubscriptionService, useValue: subscriptionService },
        { provide: MercadoPagoService, useValue: mpService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile()

    controller = module.get<SubscriptionController>(SubscriptionController)
  })

  // ─── listPlans ───────────────────────────────────────────────────────

  describe('GET /api/subscriptions/plans', () => {
    it('returns all plans from the subscription service', async () => {
      const plans = [
        { id: 'monthly', slug: 'monthly', name: 'Monthly', price: 12000 },
        { id: 'annual', slug: 'annual', name: 'Annual', price: 120000 },
      ]
      subscriptionService.listPlans.mockResolvedValue(plans)

      const result = await controller.listPlans()

      expect(result).toEqual(plans)
      expect(subscriptionService.listPlans).toHaveBeenCalled()
    })

    it('returns empty array when no plans exist', async () => {
      subscriptionService.listPlans.mockResolvedValue([])

      const result = await controller.listPlans()

      expect(result).toEqual([])
    })
  })

  // ─── createSubscription ─────────────────────────────────────────────

  describe('POST /api/subscriptions', () => {
    it('creates a subscription and returns initPoint and subscriptionId', async () => {
      const planId = 'monthly'
      const expectedResult = {
        initPoint: 'https://mercadopago.com/checkout/123',
        subscriptionId: 'sub-1',
      }
      subscriptionService.createSubscription.mockResolvedValue(expectedResult)

      const result = await controller.createSubscription(
        { planId },
        createRequest(),
      )

      expect(result).toEqual(expectedResult)
      expect(subscriptionService.createSubscription).toHaveBeenCalledWith(
        'user-1',
        planId,
        'user@test.com',
        undefined, // cardTokenId
        undefined, // payerName
        undefined, // payerDocument
      )
    })

    it('throws UnprocessableEntityException when planId is missing', async () => {
      await expect(
        controller.createSubscription({ planId: '' }, createRequest()),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('re-throws when subscription service throws', async () => {
      subscriptionService.createSubscription.mockRejectedValue(
        new UnprocessableEntityException('User already has an active subscription'),
      )

      await expect(
        controller.createSubscription({ planId: 'monthly' }, createRequest()),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })

  // ─── getMySubscription ─────────────────────────────────────────────

  describe('GET /api/subscriptions/mine', () => {
    it('returns the user subscription with plan and invoices', async () => {
      const subData = {
        id: 'sub-1',
        status: 'ACTIVE',
        plan: { slug: 'monthly', name: 'Monthly', price: 12000 },
        invoices: [],
      }
      subscriptionService.getMySubscription.mockResolvedValue(subData)

      const result = await controller.getMySubscription(createRequest())

      expect(result).toEqual(subData)
      expect(subscriptionService.getMySubscription).toHaveBeenCalledWith('user-1')
    })

    it('returns null when user has no subscription', async () => {
      subscriptionService.getMySubscription.mockResolvedValue(null)

      const result = await controller.getMySubscription(createRequest())

      expect(result).toBeNull()
    })
  })

  // ─── cancelSubscription ────────────────────────────────────────────

  describe('POST /api/subscriptions/cancel', () => {
    it('cancels the subscription and returns a success message', async () => {
      subscriptionService.cancelSubscription.mockResolvedValue(undefined)

      const result = await controller.cancelSubscription(createRequest())

      expect(result).toEqual({ message: 'Subscription cancelled successfully' })
      expect(subscriptionService.cancelSubscription).toHaveBeenCalledWith('user-1')
    })

    it('re-throws when subscription not found', async () => {
      subscriptionService.cancelSubscription.mockRejectedValue(
        new (require('@nestjs/common').NotFoundException)('Subscription not found'),
      )

      await expect(
        controller.cancelSubscription(createRequest()),
      ).rejects.toThrow()
    })
  })

  // ─── handleWebhook ─────────────────────────────────────────────────

  describe('POST /api/subscriptions/webhook', () => {
    const validWebhookBody = {
      type: 'subscription_activated',
      data: { id: 'mp-sub-1' },
    }

    it('processes a valid webhook and returns received:true', async () => {
      mpService.validateWebhook.mockReturnValue(true)
      subscriptionService.processWebhook.mockResolvedValue('activated')
      subscriptionService.expireGraceSubscriptions.mockResolvedValue(0)
	      subscriptionService.expireCancelledSubscriptions.mockResolvedValue(0)

      const result = await controller.handleWebhook(
        validWebhookBody,
        'ts=123456,v1=validhmac',
        'req-123',
      )

      expect(result).toEqual({
        received: true,
        validated: true,
        action: 'activated',
      })
      expect(mpService.validateWebhook).toHaveBeenCalledWith(
        'ts=123456,v1=validhmac',
        'mp-sub-1',
        'req-123',
      )
      expect(subscriptionService.processWebhook).toHaveBeenCalledWith({
        type: 'subscription_activated',
        action: undefined,
        data: { id: 'mp-sub-1' },
      })
      expect(subscriptionService.expireGraceSubscriptions).toHaveBeenCalled()
	      expect(subscriptionService.expireCancelledSubscriptions).toHaveBeenCalled()
    })

    it('returns validated:false when HMAC signature is invalid', async () => {
      mpService.validateWebhook.mockReturnValue(false)

      const result = await controller.handleWebhook(
        validWebhookBody,
        'ts=123456,v1=invalid',
        'req-123',
      )

      expect(result).toEqual({ received: true, validated: false })
      expect(subscriptionService.processWebhook).not.toHaveBeenCalled()
    })

    it('handles missing signature gracefully', async () => {
      mpService.validateWebhook.mockReturnValue(false)

      const result = await controller.handleWebhook(
        validWebhookBody,
        undefined,
        undefined,
      )

      expect(result).toEqual({ received: true, validated: false })
    })

    it('processes different webhook event types', async () => {
      const events = [
        { type: 'subscription_authorized', action: 'authorized' },
        { type: 'subscription_cancelled', action: 'cancelled' },
        { type: 'payment', action: 'invoice_paid' },
      ]

      for (const event of events) {
        mpService.validateWebhook.mockReturnValue(true)
        subscriptionService.processWebhook.mockResolvedValue(event.action)
        subscriptionService.expireGraceSubscriptions.mockResolvedValue(0)
	        subscriptionService.expireCancelledSubscriptions.mockResolvedValue(0)

        const result = await controller.handleWebhook(
          { type: event.type, data: { id: 'mp-sub-1' } },
          'ts=123456,v1=valid',
          'req-123',
        )

        expect(result).toEqual({
          received: true,
          validated: true,
          action: event.action,
        })
      }
    })
  })
})
