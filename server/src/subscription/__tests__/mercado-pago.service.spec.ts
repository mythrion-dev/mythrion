import { UnprocessableEntityException, Logger } from '@nestjs/common'

// Mock mercadopago module
const mockSubscriptionInstance = {
  create: jest.fn(),
  update: jest.fn(),
  get: jest.fn(),
}
jest.mock('mercadopago', () => {
  const MockConfig = jest.fn().mockImplementation(() => ({
    accessToken: 'test-token',
    options: {},
  }))
  return {
    __esModule: true,
    default: MockConfig,
    MercadoPagoConfig: MockConfig,
    PreApproval: jest.fn().mockImplementation(() => mockSubscriptionInstance),
  }
})

import { MercadoPagoService } from '../mercado-pago.service'

describe('MercadoPagoService', () => {
  let service: MercadoPagoService
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      MERCADO_PAGO_ACCESS_TOKEN: 'test-access-token',
      MERCADO_PAGO_WEBHOOK_SECRET: 'test-webhook-secret',
    }
    service = new MercadoPagoService()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // ─── constructor ─────────────────────────────────────────────────────

  describe('constructor', () => {
    it('logs a warning when MERCADO_PAGO_ACCESS_TOKEN is not set', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn')
      delete process.env.MERCADO_PAGO_ACCESS_TOKEN
      new MercadoPagoService()
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('MERCADO_PAGO_ACCESS_TOKEN is not set'),
      )
      warnSpy.mockRestore()
    })
  })

  // ─── createSubscription ─────────────────────────────────────────────

  describe('createSubscription', () => {
    const planId = 'mp-plan-123'
    const payerEmail = 'user@example.com'
    const backUrl = 'http://localhost:3000/subscription/success'

    it('creates a subscription and returns the response with init_point', async () => {
      const mpResponse = {
        id: 'mp-sub-1',
        init_point: 'https://mercadopago.com/checkout/abc',
        status: 'pending',
        preapproval_plan_id: planId,
        payer_email: payerEmail,
      }
      mockSubscriptionInstance.create.mockResolvedValue(mpResponse)

      const result = await service.createSubscription(planId, payerEmail, backUrl)

      expect(result).toEqual(mpResponse)
      expect(mockSubscriptionInstance.create).toHaveBeenCalledWith({
        body: {
          preapproval_plan_id: planId,
          payer_email: payerEmail,
          back_url: backUrl,
          status: 'pending',
          reason: 'Mythrion Premium',
          auto_recurring: true,
        },
      })
    })

    it('throws UnprocessableEntityException on MP API error', async () => {
      mockSubscriptionInstance.create.mockRejectedValue(
        new Error('MP API error'),
      )

      await expect(
        service.createSubscription(planId, payerEmail, backUrl),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })

  // ─── cancelSubscription ─────────────────────────────────────────────

  describe('cancelSubscription', () => {
    it('cancels a subscription via MP API', async () => {
      mockSubscriptionInstance.update.mockResolvedValue({ id: 'mp-sub-1' })

      await service.cancelSubscription('mp-sub-1')

      expect(mockSubscriptionInstance.update).toHaveBeenCalledWith({
        id: 'mp-sub-1',
        body: { status: 'cancelled' },
      })
    })

    it('throws UnprocessableEntityException on MP API error', async () => {
      mockSubscriptionInstance.update.mockRejectedValue(
        new Error('MP API error'),
      )

      await expect(
        service.cancelSubscription('mp-sub-1'),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })

  // ─── getSubscription ────────────────────────────────────────────────

  describe('getSubscription', () => {
    it('fetches a subscription by MP ID', async () => {
      const mpResponse = {
        id: 'mp-sub-1',
        status: 'authorized',
        next_payment_date: '2025-02-01T00:00:00Z',
      }
      mockSubscriptionInstance.get.mockResolvedValue(mpResponse)

      const result = await service.getSubscription('mp-sub-1')

      expect(result).toEqual(mpResponse)
      expect(mockSubscriptionInstance.get).toHaveBeenCalledWith({
        id: 'mp-sub-1',
      })
    })

    it('throws UnprocessableEntityException on MP API error', async () => {
      mockSubscriptionInstance.get.mockRejectedValue(
        new Error('MP API error'),
      )

      await expect(
        service.getSubscription('mp-sub-1'),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })

  // ─── validateWebhook ────────────────────────────────────────────────

  describe('validateWebhook', () => {
    it('returns true for a valid HMAC signature', () => {
      // Build a valid signature manually
      const ts = Math.floor(Date.now() / 1000)
      const dataId = 'data-123'
      const requestId = 'req-456'
      const message = `id:${dataId};request-id:${requestId};ts:${ts};`

      // Import createHash here for test computation
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createHash } = require('crypto')
      const expectedHmac = createHash('sha256')
        .update(message + 'test-webhook-secret')
        .digest('hex')

      const signatureHeader = `ts=${ts},v1=${expectedHmac}`

      const result = service.validateWebhook(signatureHeader, dataId, requestId)

      expect(result).toBe(true)
    })

    it('returns false for an invalid HMAC signature', () => {
      const ts = Math.floor(Date.now() / 1000)
      const signatureHeader = `ts=${ts},v1=invalidhmac`

      const result = service.validateWebhook(
        signatureHeader,
        'data-123',
        'req-456',
      )

      expect(result).toBe(false)
    })

    it('returns false when signature header is missing', () => {
      const result = service.validateWebhook(undefined, 'data-123', 'req-456')

      expect(result).toBe(false)
    })

    it('returns false when webhook secret is empty', () => {
      process.env.MERCADO_PAGO_WEBHOOK_SECRET = ''
      service = new MercadoPagoService()

      const result = service.validateWebhook(
        'ts=123,v1=abc',
        'data-123',
        'req-456',
      )

      expect(result).toBe(false)
    })

    it('returns false when signature is too old (anti-replay)', () => {
      const oldTs = Math.floor(Date.now() / 1000) - 10 * 60 // 10 minutes ago
      const signatureHeader = `ts=${oldTs},v1=anything`

      const result = service.validateWebhook(
        signatureHeader,
        'data-123',
        'req-456',
      )

      expect(result).toBe(false)
    })

    it('returns false when signature timestamp is in the future', () => {
      const futureTs = Math.floor(Date.now() / 1000) + 60 // 1 minute in future
      const signatureHeader = `ts=${futureTs},v1=anything`

      const result = service.validateWebhook(
        signatureHeader,
        'data-123',
        'req-456',
      )

      expect(result).toBe(false)
    })

    it('returns false when ts or v1 parts are missing', () => {
      const result = service.validateWebhook(
        'ts=123',
        'data-123',
        'req-456',
      )

      expect(result).toBe(false)
    })

    it('returns false when timestamp is not a number', () => {
      const signatureHeader = 'ts=notanumber,v1=abc'

      const result = service.validateWebhook(
        signatureHeader,
        'data-123',
        'req-456',
      )

      expect(result).toBe(false)
    })

    it('handles exceptions gracefully and returns false', () => {
      // Pass a header that will cause a parse error
      const result = service.validateWebhook(
        null as unknown as string,
        'data-123',
        'req-456',
      )

      expect(result).toBe(false)
    })

    it('returns false when crypto computation throws (catch block)', () => {
      // Force createHash to throw inside the try block so the catch is hit
      const crypto = require('crypto')
      const spy = jest.spyOn(crypto, 'createHash').mockImplementationOnce(() => {
        throw new Error('crypto failure')
      })

      const result = service.validateWebhook(
        'ts=1234567,v1=somesig',
        'data-123',
        'req-456',
      )

      expect(result).toBe(false)
      spy.mockRestore()
    })
  })
})
