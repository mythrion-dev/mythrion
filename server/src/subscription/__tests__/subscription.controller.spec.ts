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
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { PrismaService } from '../../prisma.service'
import { createMockPrismaService } from '../../__mocks__/prisma-service.mock'
import { PAYMENT_GATEWAY } from '../payment-gateway.interface'
import type { PaymentGateway } from '../payment-gateway.interface'
import type { Request } from 'express'

const mockGateway: jest.Mocked<PaymentGateway> = {
  createSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  updatePaymentMethod: jest.fn(),
  getSubscription: jest.fn(),
  getPaymentCharge: jest.fn(),
  validateWebhook: jest.fn(),
}

describe('SubscriptionController', () => {
  let controller: SubscriptionController
  let subscriptionService: jest.Mocked<SubscriptionService>
  let prisma: ReturnType<typeof createMockPrismaService>

  const mockUser = { sub: 'user-1', email: 'user@test.com', role: 'user' }

  function createRequest(overrides?: Partial<Request>): any {
    return {
      user: mockUser,
      ...overrides,
    }
  }

  beforeEach(async () => {
    prisma = createMockPrismaService()
    jest.clearAllMocks()

    subscriptionService = {
      listPlans: jest.fn(),
      createSubscription: jest.fn(),
      getMySubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      updatePaymentMethod: jest.fn(),
      processWebhook: jest.fn(),
      expireGraceSubscriptions: jest.fn(),
      expireCancelledSubscriptions: jest.fn(),
      hasActiveSubscription: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionService>

    const module = await Test.createTestingModule({
      controllers: [SubscriptionController],
      providers: [
        { provide: SubscriptionService, useValue: subscriptionService },
        { provide: PrismaService, useValue: prisma },
        { provide: PAYMENT_GATEWAY, useValue: mockGateway },
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
        initPoint: '',
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
        undefined, // cardToken
        undefined, // securityCode
        undefined, // payerName
        undefined, // payerDocument
        undefined, // deviceId
        undefined, // cardTokenId
        undefined, // installments
      )
    })

    it('passes installments when provided (annual plan)', async () => {
      subscriptionService.createSubscription.mockResolvedValue({
        initPoint: '',
        subscriptionId: 'sub-annual-install',
      })

      await controller.createSubscription(
        { planId: 'annual', cardToken: 'encrypted-card', installments: 12 },
        createRequest(),
      )

      expect(subscriptionService.createSubscription).toHaveBeenCalledWith(
        'user-1',
        'annual',
        'user@test.com',
        'encrypted-card',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        12,
      )
    })

    it('omits installments for monthly plan', async () => {
      subscriptionService.createSubscription.mockResolvedValue({
        initPoint: '',
        subscriptionId: 'sub-monthly',
      })

      await controller.createSubscription(
        { planId: 'monthly', cardToken: 'encrypted-card' },
        createRequest(),
      )

      expect(subscriptionService.createSubscription).toHaveBeenCalledWith(
        'user-1',
        'monthly',
        'user@test.com',
        'encrypted-card',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined, // installments
      )
    })

    it('passes cardToken when provided', async () => {
      subscriptionService.createSubscription.mockResolvedValue({
        initPoint: '',
        subscriptionId: 'sub-1',
      })

      await controller.createSubscription(
        { planId: 'monthly', cardToken: 'encrypted-card-abc' },
        createRequest(),
      )

      expect(subscriptionService.createSubscription).toHaveBeenCalledWith(
        'user-1',
        'monthly',
        'user@test.com',
        'encrypted-card-abc',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined, // cardTokenId
        undefined, // installments
      )
    })

    it('throws UnprocessableEntityException when planId is missing', async () => {
      await expect(
        controller.createSubscription({ planId: '' }, createRequest()),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws UnprocessableEntityException when planId is undefined', async () => {
      await expect(
        controller.createSubscription({}, createRequest()),
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

  // ─── updatePaymentMethod ───────────────────────────────────────────

  describe('POST /api/subscriptions/update-payment-method', () => {
    it('updates payment method and returns success message', async () => {
      subscriptionService.updatePaymentMethod.mockResolvedValue(undefined)

      const result = await controller.updatePaymentMethod(
        { cardToken: 'encrypted-card-new' },
        createRequest(),
      )

      expect(result).toEqual({ message: 'Payment method updated successfully' })
      expect(subscriptionService.updatePaymentMethod).toHaveBeenCalledWith(
        'user-1',
        'encrypted-card-new',
        undefined,
        undefined,
      )
    })

    it('passes payer info when provided', async () => {
      subscriptionService.updatePaymentMethod.mockResolvedValue(undefined)

      await controller.updatePaymentMethod(
        {
          cardToken: 'encrypted-card-new',
          payerName: 'João Silva',
          payerDocument: '12345678909',
        },
        createRequest(),
      )

      expect(subscriptionService.updatePaymentMethod).toHaveBeenCalledWith(
        'user-1',
        'encrypted-card-new',
        'João Silva',
        '12345678909',
      )
    })

    it('throws UnprocessableEntityException when cardToken is missing', async () => {
      await expect(
        controller.updatePaymentMethod({ cardToken: '' }, createRequest()),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })

  // ─── handleWebhook ─────────────────────────────────────────────────

  describe('POST /api/subscriptions/webhook', () => {
    const webhookBody = {
      event: 'subscription.activated',
      resource: { id: 'SUBS_001' },
    }

    it('processes a valid webhook and returns received:true with action', async () => {
      subscriptionService.processWebhook.mockResolvedValue('activated')
      subscriptionService.expireGraceSubscriptions.mockResolvedValue(0)
      subscriptionService.expireCancelledSubscriptions.mockResolvedValue(0)

      const result = await controller.handleWebhook(
        webhookBody,
        'valid-sha256-hex',
        'req-123',
        {} as any,
      )

      expect(result).toEqual({
        received: true,
        action: 'activated',
      })
      expect(subscriptionService.processWebhook).toHaveBeenCalledWith(
        JSON.stringify(webhookBody),
        'valid-sha256-hex',
        { type: 'subscription.activated', action: undefined, data: { id: 'SUBS_001' } },
      )
      expect(subscriptionService.expireGraceSubscriptions).toHaveBeenCalled()
      expect(subscriptionService.expireCancelledSubscriptions).toHaveBeenCalled()
    })

    it('passes undefined authenticityToken when header is missing', async () => {
      subscriptionService.processWebhook.mockResolvedValue('invalid_signature')
      subscriptionService.expireGraceSubscriptions.mockResolvedValue(0)
      subscriptionService.expireCancelledSubscriptions.mockResolvedValue(0)

      const result = await controller.handleWebhook(
        webhookBody,
        undefined,
        undefined,
        {} as any,
      )

      expect(result).toEqual({ received: true, action: 'invalid_signature' })
      expect(subscriptionService.processWebhook).toHaveBeenCalledWith(
        JSON.stringify(webhookBody),
        undefined,
        { type: 'subscription.activated', action: undefined, data: { id: 'SUBS_001' } },
      )
    })

    it('processes subscription.canceled webhook event', async () => {
      const cancelBody = {
        event: 'subscription.canceled',
        resource: { id: 'SUBS_002', status: 'CANCELED' },
      }
      subscriptionService.processWebhook.mockResolvedValue('cancelled')
      subscriptionService.expireGraceSubscriptions.mockResolvedValue(0)
      subscriptionService.expireCancelledSubscriptions.mockResolvedValue(0)

      const result = await controller.handleWebhook(
        cancelBody,
        'valid-token',
        'req-789',
        {} as any,
      )

      expect(result).toEqual({ received: true, action: 'cancelled' })
      expect(subscriptionService.processWebhook).toHaveBeenCalledWith(
        JSON.stringify(cancelBody),
        'valid-token',
        { type: 'subscription.canceled', action: undefined, data: { id: 'SUBS_002', status: 'CANCELED' } },
      )
    })
  })
})
