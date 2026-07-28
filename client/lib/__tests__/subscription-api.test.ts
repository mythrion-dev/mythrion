import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '@/lib/api'
import {
  fetchPlans,
  createSubscription,
  fetchMySubscription,
  cancelSubscription,
} from '@/lib/subscription-api'

/* ── Mock api module ── */
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  API_URL: 'http://localhost:3001/api',
}))

describe('subscription-api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchPlans', () => {
    it('calls api.get with /subscriptions/plans and returns plans', async () => {
      const plans = [
        { id: 'monthly', slug: 'monthly', name: 'Monthly', price: 12000 },
        { id: 'annual', slug: 'annual', name: 'Annual', price: 120000 },
      ]
      vi.mocked(api.get).mockResolvedValue(plans)

      const result = await fetchPlans()

      expect(result).toEqual(plans)
      expect(api.get).toHaveBeenCalledWith('/subscriptions/plans')
    })

    it('returns empty array when no plans exist', async () => {
      vi.mocked(api.get).mockResolvedValue([])

      const result = await fetchPlans()

      expect(result).toEqual([])
    })

    it('propagates errors from api.get', async () => {
      const err = new Error('Network error')
      vi.mocked(api.get).mockRejectedValue(err)

      await expect(fetchPlans()).rejects.toThrow('Network error')
    })
  })

  describe('createSubscription', () => {
    it('calls api.post with planId and returns initPoint and subscriptionId', async () => {
      const response = {
        initPoint: 'https://mercadopago.com/checkout/123',
        subscriptionId: 'sub-1',
      }
      vi.mocked(api.post).mockResolvedValue(response)

      const result = await createSubscription('monthly')

      expect(result).toEqual(response)
      expect(api.post).toHaveBeenCalledWith('/subscriptions', { planId: 'monthly' })
    })

    it('propagates errors from api.post', async () => {
      const err = new Error('Plan not found')
      vi.mocked(api.post).mockRejectedValue(err)

      await expect(createSubscription('invalid-plan')).rejects.toThrow('Plan not found')
    })
  })

  describe('fetchMySubscription', () => {
    it('calls api.get and returns subscription with invoices', async () => {
      const subscription = {
        id: 'sub-1',
        status: 'ACTIVE',
        plan: { slug: 'monthly', name: 'Monthly', price: 12000 },
        invoices: [
          { id: 'inv-1', amount: 12000, currency: 'BRL', status: 'paid', paidAt: '2025-01-01', dueDate: null, createdAt: '2025-01-01' },
        ],
        mpSubscriptionId: 'mp-1',
        graceEndsAt: null,
        currentPeriodStart: '2025-01-01',
        currentPeriodEnd: '2025-02-01',
        cancelledAt: null,
        createdAt: '2025-01-01',
      }
      vi.mocked(api.get).mockResolvedValue(subscription)

      const result = await fetchMySubscription()

      expect(result).toEqual(subscription)
      expect(api.get).toHaveBeenCalledWith('/subscriptions/mine')
    })

    it('returns null when user has no subscription', async () => {
      vi.mocked(api.get).mockResolvedValue(null)

      const result = await fetchMySubscription()

      expect(result).toBeNull()
    })

    it('propagates errors from api.get', async () => {
      const err = new Error('Unauthorized')
      vi.mocked(api.get).mockRejectedValue(err)

      await expect(fetchMySubscription()).rejects.toThrow('Unauthorized')
    })
  })

  describe('cancelSubscription', () => {
    it('calls api.post with /subscriptions/cancel', async () => {
      vi.mocked(api.post).mockResolvedValue(undefined)

      await cancelSubscription()

      expect(api.post).toHaveBeenCalledWith('/subscriptions/cancel')
    })

    it('propagates errors from api.post', async () => {
      const err = new Error('Subscription not found')
      vi.mocked(api.post).mockRejectedValue(err)

      await expect(cancelSubscription()).rejects.toThrow('Subscription not found')
    })
  })
})
