/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Mock factory for SubscriptionService.
 *
 * `hasActiveSubscription` resolves `true` by default so existing tests keep
 * passing once a service gains the SubscriptionService dependency. Override
 * per-test with `mockHasActiveSubscription.mockResolvedValue(false)`.
 */
export function createMockSubscriptionService() {
  const mockHasActiveSubscription = jest.fn().mockResolvedValue(true)
  const mockGetMySubscription = jest.fn().mockResolvedValue(null)
  return {
    hasActiveSubscription: mockHasActiveSubscription,
    getSubscription: jest.fn(),
    getActiveSubscription: jest.fn(),
    getMySubscription: mockGetMySubscription,
    getAllPlans: jest.fn(),
    createSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    processWebhook: jest.fn(),
    mockHasActiveSubscription,
    mockGetMySubscription,
  }
}
