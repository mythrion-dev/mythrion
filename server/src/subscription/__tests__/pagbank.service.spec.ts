import { UnprocessableEntityException, Logger } from '@nestjs/common'
import { PagBankService } from '../pagbank.service'

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  timingSafeEqual: jest.fn((a: Buffer, b: Buffer) => {
    const real = jest.requireActual('crypto')
    return real.timingSafeEqual(a, b)
  }),
}))
import * as crypto from 'crypto'

const TEST_TOKEN = 'test-token-123'
const TEST_SECRET = 'test-secret-456'
const TEST_API_URL = 'https://sandbox.api.assinaturas.pagseguro.com'

function createService(overrides?: {
  token?: string
  apiUrl?: string
  secret?: string
}): PagBankService {
  const env = { ...process.env }
  process.env.PAGBANK_TOKEN = overrides?.token ?? TEST_TOKEN
  process.env.PAGBANK_API_URL = overrides?.apiUrl ?? TEST_API_URL
  process.env.PAGBANK_WEBHOOK_SECRET = overrides?.secret ?? TEST_SECRET

  const service = new PagBankService()

  process.env = env
  return service
}

const mockFetch = jest.fn()
global.fetch = mockFetch

describe('PagBankService', () => {
  let service: PagBankService

  beforeEach(() => {
    jest.clearAllMocks()
    const env = { ...process.env }
    process.env.PAGBANK_TOKEN = TEST_TOKEN
    process.env.PAGBANK_API_URL = TEST_API_URL
    process.env.PAGBANK_WEBHOOK_SECRET = TEST_SECRET
    service = new PagBankService()
    process.env = env
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  describe('constructor', () => {
    it('warns when token is not set', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn')
      process.env.PAGBANK_TOKEN = ''
      const svc = new PagBankService()
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('PAGBANK_TOKEN is not set'),
      )
    })
  })

  // ─── createSubscription ─────────────────────────────────────────────

  describe('createSubscription', () => {
    const params = {
      planId: 'pg-plan-monthly',
      planPrice: 12000,
      planSlug: 'monthly',
      planName: 'Mensal',
      payerEmail: 'user@example.com',
      backUrl: '',
    }

    const validResponse = {
      id: 'SUB-12345',
      status: 'ACTIVE',
      customer: { id: 'CUST-67890' },
    }

    it('creates a subscription with card token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(validResponse),
      })

      const result = await service.createSubscription({
        ...params,
        cardToken: 'encrypted-card-data',
        securityCode: '123',
        payerName: 'João Silva',
        payerDocument: '12345678909',
      })

      expect(result.id).toBe('SUB-12345')
      expect(result.status).toBe('ACTIVE')
      expect(result.customerId).toBe('CUST-67890')
      expect(result.initPoint).toBe('')

      const fetchCall = mockFetch.mock.calls[0]
      expect(fetchCall[0]).toBe(
        'https://sandbox.api.assinaturas.pagseguro.com/subscriptions',
      )
      expect(fetchCall[1]?.method).toBe('POST')

      const reqBody = JSON.parse(fetchCall[1]?.body as string)
      expect(reqBody.plan.id).toBe('pg-plan-monthly')
      expect(reqBody.customer.email).toBe('user@example.com')
      expect(reqBody.customer.name).toBe('João Silva')
      expect(reqBody.customer.tax_id).toBe('12345678909')
      expect(reqBody.customer.billing_info[0].card.encrypted).toBe('encrypted-card-data')
      expect(reqBody.payment_method[0].type).toBe('CREDIT_CARD')
      expect(reqBody.payment_method[0].card.security_code).toBe(123)
      expect(reqBody.amount).toEqual({ value: 12000, currency: 'BRL' })
    })

    it('creates a subscription without card token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(validResponse),
      })

      const result = await service.createSubscription(params)

      expect(result.id).toBe('SUB-12345')
      expect(result.status).toBe('ACTIVE')

      const reqBody = JSON.parse(
        mockFetch.mock.calls[0][1]?.body as string,
      )
      expect(reqBody.customer.billing_info).toBeUndefined()
      expect(reqBody.reference_id).toBeUndefined()
      expect(reqBody.amount).toEqual({ value: 12000, currency: 'BRL' })
    })

    it('uses externalReference when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(validResponse),
      })

      await service.createSubscription({
        ...params,
        externalReference: 'ref-abc-123',
      })

      const reqBody = JSON.parse(
        mockFetch.mock.calls[0][1]?.body as string,
      )
      expect(reqBody.reference_id).toBe('ref-abc-123')
    })

    it('derives payer name from email when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(validResponse),
      })

      await service.createSubscription(params)

      const reqBody = JSON.parse(
        mockFetch.mock.calls[0][1]?.body as string,
      )
      expect(reqBody.customer.name).toBe('user')
    })

    it('cleans document to digits only', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(validResponse),
      })

      await service.createSubscription({
        ...params,
        payerDocument: '123.456.789-09',
      })

      const reqBody = JSON.parse(
        mockFetch.mock.calls[0][1]?.body as string,
      )
      expect(reqBody.customer.tax_id).toBe('12345678909')
    })

    it('handles response without customer field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          id: 'SUB-no-cust',
          status: 'PENDING',
        }),
      })

      const result = await service.createSubscription(params)

      expect(result.id).toBe('SUB-no-cust')
      expect(result.status).toBe('PENDING')
      expect(result.customerId).toBeUndefined()
    })

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValueOnce({ error: 'invalid_plan' }),
      })

      await expect(
        service.createSubscription(params),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

      await expect(
        service.createSubscription(params),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws on non-JSON API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValueOnce(new Error('Invalid JSON')),
      })

      await expect(
        service.createSubscription(params),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('handles non-Error rejection in createSubscription', async () => {
      mockFetch.mockRejectedValueOnce('string rejection')

      await expect(
        service.createSubscription(params),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })

  // ─── cancelSubscription ─────────────────────────────────────────────

  describe('cancelSubscription', () => {
    it('cancels a subscription successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      })

      await expect(
        service.cancelSubscription('SUB-12345'),
      ).resolves.toBeUndefined()

      expect(mockFetch).toHaveBeenCalledWith(
        `${TEST_API_URL}/subscriptions/SUB-12345/cancel`,
        expect.objectContaining({ method: 'PUT' }),
      )
    })

    it('handles 404 as success (already cancelled)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValueOnce({}),
      })

      await expect(
        service.cancelSubscription('SUB-already-cancelled'),
      ).resolves.toBeUndefined()
    })

    it('handles 409 as success (conflicting state)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: jest.fn().mockResolvedValueOnce({}),
      })

      await expect(
        service.cancelSubscription('SUB-conflict'),
      ).resolves.toBeUndefined()
    })

    it('throws on non-404/409 API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce({ error: 'internal_error' }),
      })

      await expect(
        service.cancelSubscription('SUB-error'),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNRESET'))

      await expect(
        service.cancelSubscription('SUB-net-error'),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('handles non-Error rejection in cancelSubscription', async () => {
      mockFetch.mockRejectedValueOnce('string error')

      await expect(
        service.cancelSubscription('SUB-string-err'),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('uses empty object fallback when json() rejects on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValueOnce(new Error('bad json')),
      })

      await expect(
        service.cancelSubscription('SUB-bad-json'),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })

  // ─── updatePaymentMethod ────────────────────────────────────────────

  describe('updatePaymentMethod', () => {
    it('updates payment method successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({}),
      })

      await expect(
        service.updatePaymentMethod('SUB-1', 'CUST-12345', 'encrypted-card'),
      ).resolves.toBeUndefined()

      const fetchCall = mockFetch.mock.calls[0]
      expect(fetchCall[0]).toBe(
        `${TEST_API_URL}/customers/CUST-12345/billing_info`,
      )
      expect(fetchCall[1]?.method).toBe('PUT')

      const reqBody = JSON.parse(fetchCall[1]?.body as string)
      expect(reqBody.RAW_BODY).toBeDefined()
      const rawBody = JSON.parse(reqBody.RAW_BODY)
      expect(rawBody.billing_info[0].card.encrypted).toBe('encrypted-card')
    })

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValueOnce({ error: 'invalid_card' }),
      })

      await expect(
        service.updatePaymentMethod('SUB-1', 'CUST-12345', 'bad-card'),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNRESET'))

      await expect(
        service.updatePaymentMethod('SUB-1', 'CUST-12345', 'card'),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('handles non-Error rejection in updatePaymentMethod', async () => {
      mockFetch.mockRejectedValueOnce('string error')

      await expect(
        service.updatePaymentMethod('SUB-1', 'CUST-12345', 'card'),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('uses empty object fallback when json() rejects on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValueOnce(new Error('bad json')),
      })

      await expect(
        service.updatePaymentMethod('SUB-1', 'CUST-12345', 'bad-card'),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })

  // ─── getSubscription ────────────────────────────────────────────────

  describe('getSubscription', () => {
    it('returns subscription data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          id: 'SUB-12345',
          status: 'ACTIVE',
          next_billing_date: '2025-03-01T00:00:00Z',
          customer: { id: 'CUST-67890' },
        }),
      })

      const result = await service.getSubscription('SUB-12345')

      expect(result.id).toBe('SUB-12345')
      expect(result.status).toBe('ACTIVE')
      expect(result.nextPaymentDate).toBe('2025-03-01T00:00:00Z')
      expect(result.customerId).toBe('CUST-67890')
    })

    it('returns null for missing next_billing_date', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          id: 'SUB-12345',
          status: 'PENDING',
          customer: { id: 'CUST-67890' },
        }),
      })

      const result = await service.getSubscription('SUB-12345')

      expect(result.nextPaymentDate).toBeNull()
    })

    it('handles response without customer field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          id: 'SUB-12345',
          status: 'ACTIVE',
        }),
      })

      const result = await service.getSubscription('SUB-12345')

      expect(result.id).toBe('SUB-12345')
      expect(result.customerId).toBeUndefined()
    })

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValueOnce({}),
      })

      await expect(
        service.getSubscription('SUB-nonexistent'),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNRESET'))

      await expect(
        service.getSubscription('SUB-net-error'),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('handles non-Error rejection in getSubscription', async () => {
      mockFetch.mockRejectedValueOnce('string error')

      await expect(
        service.getSubscription('SUB-string-err'),
      ).rejects.toThrow(UnprocessableEntityException)
    })

    it('uses empty object fallback when json() rejects on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValueOnce(new Error('bad json')),
      })

      await expect(
        service.getSubscription('SUB-bad-json'),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })

  // ─── getPaymentCharge ───────────────────────────────────────────────

  describe('getPaymentCharge', () => {
    it('returns payment charge data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          id: 'CHARGE-12345',
          status: 'paid',
          subscription_id: 'SUB-67890',
          amount: { value: 12000, currency: 'BRL' },
          payment_date: '2025-01-15T12:00:00Z',
        }),
      })

      const result = await service.getPaymentCharge('CHARGE-12345')

      expect(result.id).toBe('CHARGE-12345')
      expect(result.status).toBe('paid')
      expect(result.subscriptionId).toBe('SUB-67890')
      expect(result.transactionAmount).toBe(12000)
      expect(result.currencyId).toBe('BRL')
      expect(result.dateApproved).toBe('2025-01-15T12:00:00Z')
    })

    it('handles missing amount and payment_date fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          id: 'CHARGE-minimal',
          status: 'pending',
          subscription_id: 'SUB-1',
        }),
      })

      const result = await service.getPaymentCharge('CHARGE-minimal')

      expect(result.transactionAmount).toBe(0)
      expect(result.currencyId).toBe('BRL')
      expect(result.dateApproved).toBeNull()
      expect(result.nextPaymentDate).toBeNull()
    })

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValueOnce({}),
      })

      await expect(
        service.getPaymentCharge('CHARGE-nonexistent'),
      ).rejects.toThrow('Failed to fetch payment charge: 404')
    })

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNRESET'))

      await expect(
        service.getPaymentCharge('CHARGE-net-error'),
      ).rejects.toThrow('ECONNRESET')
    })

    it('handles non-Error rejection gracefully', async () => {
      mockFetch.mockRejectedValueOnce('string error message')

      await expect(
        service.getPaymentCharge('CHARGE-string-err'),
      ).rejects.toThrow('Failed to fetch payment charge')
    })

    it('uses empty object fallback when json() rejects on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValueOnce(new Error('bad json')),
      })

      await expect(
        service.getPaymentCharge('CHARGE-bad-json'),
      ).rejects.toThrow('Failed to fetch payment charge: 500')
    })
  })

  // ─── validateWebhook ────────────────────────────────────────────────

  describe('validateWebhook', () => {
    const rawBody = JSON.stringify({
      type: 'subscription.activated',
      data: { id: 'SUB-1' },
    })

    it('returns true for a valid signature', () => {
      const expected = crypto.createHash('sha256')
        .update(`${TEST_SECRET}-${rawBody}`)
        .digest('hex')

      const result = service.validateWebhook(rawBody, expected)

      expect(result).toBe(true)
    })

    it('returns false for an invalid signature', () => {
      const result = service.validateWebhook(rawBody, 'invalid-hash-value')

      expect(result).toBe(false)
    })

    it('returns false when authenticityToken is undefined', () => {
      const result = service.validateWebhook(rawBody, undefined)

      expect(result).toBe(false)
    })

    it('returns false when authenticityToken is empty string', () => {
      const result = service.validateWebhook(rawBody, '')

      expect(result).toBe(false)
    })

    it('returns false when webhook secret is empty', () => {
      const env = { ...process.env }
      process.env.PAGBANK_WEBHOOK_SECRET = ''
      const serviceNoSecret = new PagBankService()
      process.env = env

      const result = serviceNoSecret.validateWebhook(
        rawBody,
        'some-token',
      )

      expect(result).toBe(false)
    })

    it('returns false when token length differs (timingSafeEqual guard)', () => {
      const expected = crypto.createHash('sha256')
        .update(`${TEST_SECRET}-${rawBody}`)
        .digest('hex')

      const result = service.validateWebhook(
        rawBody,
        expected + 'extra',
      )

      // Length mismatch → false
      expect(result).toBe(false)
    })

    it('returns false for empty rawBody with valid-looking token', () => {
      const result = service.validateWebhook('', 'some-hex-token-that-is-not-empty')

      expect(result).toBe(false)
    })

    it('returns false when timingSafeEqual throws', () => {
      (crypto.timingSafeEqual as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Bad buffer')
      })

      const rawBody = JSON.stringify({ type: 'subscription.activated' })
      const expected = crypto.createHash('sha256')
        .update(`${TEST_SECRET}-${rawBody}`)
        .digest('hex')
      const result = service.validateWebhook(rawBody, expected)

      expect(result).toBe(false)
    })
  })
})
