import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../api'

// Mock the api module
vi.mock('../api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import {
  adminFetchPlans,
  adminCreatePlan,
  adminUpdatePlan,
  adminDeletePlan,
  type CreatePlanPayload,
  type UpdatePlanPayload,
} from '../subscription-admin-api'

describe('subscription-admin-api', () => {
  const mockPlan = {
    id: 'monthly',
    slug: 'monthly',
    name: 'Plano Mensal',
    description: 'Acesso mensal',
    price: 12000,
    mpPlanId: 'mp-plan-monthly',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('adminFetchPlans', () => {
    it('calls api.get with correct path', async () => {
      vi.mocked(api.get).mockResolvedValue([mockPlan])

      const result = await adminFetchPlans()

      expect(result).toEqual([mockPlan])
      expect(api.get).toHaveBeenCalledWith('/admin/subscription-plans')
    })

    it('returns empty array when no plans exist', async () => {
      vi.mocked(api.get).mockResolvedValue([])

      const result = await adminFetchPlans()

      expect(result).toEqual([])
    })

    it('propagates errors from the API', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Failed to fetch'))

      await expect(adminFetchPlans()).rejects.toThrow('Failed to fetch')
    })
  })

  describe('adminCreatePlan', () => {
    const createPayload: CreatePlanPayload = {
      id: 'premium',
      slug: 'premium',
      name: 'Plano Premium',
      description: 'Acesso premium',
      price: 24000,
      mpPlanId: 'mp-plan-premium',
    }

    it('calls api.post with correct path and data', async () => {
      vi.mocked(api.post).mockResolvedValue(mockPlan)

      const result = await adminCreatePlan(createPayload)

      expect(result).toEqual(mockPlan)
      expect(api.post).toHaveBeenCalledWith('/admin/subscription-plans', createPayload)
    })

    it('propagates validation errors from the API', async () => {
      vi.mocked(api.post).mockRejectedValue(
        Object.assign(new Error('Slug already exists'), { statusCode: 422 }),
      )

      await expect(adminCreatePlan(createPayload)).rejects.toThrow('Slug already exists')
    })
  })

  describe('adminUpdatePlan', () => {
    const updatePayload: UpdatePlanPayload = {
      name: 'Updated Plan',
      price: 15000,
    }

    it('calls api.put with correct path and data', async () => {
      vi.mocked(api.put).mockResolvedValue({ ...mockPlan, name: 'Updated Plan', price: 15000 })

      const result = await adminUpdatePlan('monthly', updatePayload)

      expect(result.name).toBe('Updated Plan')
      expect(result.price).toBe(15000)
      expect(api.put).toHaveBeenCalledWith(
        '/admin/subscription-plans/monthly',
        updatePayload,
      )
    })

    it('encodes special characters in the plan ID', async () => {
      vi.mocked(api.put).mockResolvedValue(mockPlan)

      await adminUpdatePlan('plan with spaces', { name: 'Test' })

      expect(api.put).toHaveBeenCalledWith(
        '/admin/subscription-plans/plan%20with%20spaces',
        { name: 'Test' },
      )
    })

    it('propagates not found errors', async () => {
      vi.mocked(api.put).mockRejectedValue(
        Object.assign(new Error('Plan not found'), { statusCode: 404 }),
      )

      await expect(adminUpdatePlan('nonexistent', { name: 'Nope' })).rejects.toThrow('Plan not found')
    })
  })

  describe('adminDeletePlan', () => {
    it('calls api.delete with correct path', async () => {
      vi.mocked(api.delete).mockResolvedValue(undefined)

      await adminDeletePlan('monthly')

      expect(api.delete).toHaveBeenCalledWith('/admin/subscription-plans/monthly')
    })

    it('propagates errors when plan has active subscriptions', async () => {
      vi.mocked(api.delete).mockRejectedValue(
        Object.assign(new Error('Cannot delete plan with active subscriptions'), { statusCode: 422 }),
      )

      await expect(adminDeletePlan('monthly')).rejects.toThrow('Cannot delete plan with active subscriptions')
    })

    it('encodes special characters in the plan ID', async () => {
      vi.mocked(api.delete).mockResolvedValue(undefined)

      await adminDeletePlan('my plan')

      expect(api.delete).toHaveBeenCalledWith('/admin/subscription-plans/my%20plan')
    })
  })
})
