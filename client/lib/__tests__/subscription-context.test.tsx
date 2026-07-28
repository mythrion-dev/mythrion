import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SubscriptionProvider, useSubscription } from '@/lib/subscription-context'
import type { ReactNode } from 'react'

/* ── Mock auth-context ── */
const mockUseAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

/* ── Mock subscription-api ── */
const mockFetchMySubscription = vi.fn()
vi.mock('@/lib/subscription-api', () => ({
  fetchMySubscription: (...args: unknown[]) => mockFetchMySubscription(...args),
}))

// ─── Test consumer component ──────────────────────────────────────────

function TestConsumer() {
  const { subscription, loading, hasActiveSubscription, refresh } = useSubscription()
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="has-active">{String(hasActiveSubscription)}</div>
      <div data-testid="subscription-status">{subscription?.status ?? 'null'}</div>
      <button data-testid="refresh" onClick={refresh}>Refresh</button>
    </div>
  )
}

function renderProvider(children: ReactNode) {
  return render(<SubscriptionProvider>{children}</SubscriptionProvider>)
}

/* ── Helpers ── */

function activeSub(status: string) {
  return {
    id: 'sub-1',
    userId: 'user-1',
    planId: 'monthly',
    mpSubscriptionId: 'mp-1',
    status,
    graceEndsAt: null,
    currentPeriodStart: '2025-01-01',
    currentPeriodEnd: '2025-02-01',
    cancelledAt: null,
    createdAt: '2025-01-01',
    plan: { slug: 'monthly', name: 'Monthly', price: 12000 },
    invoices: [],
  }
}

/* ── Tests ── */

describe('SubscriptionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Loading state ────────────────────────────────────────────────

  it('shows loading while auth is loading', () => {
    // Auth is loading → no user yet
    mockUseAuth.mockReturnValue({ user: null, loading: true })
    // Don't resolve fetch yet
    mockFetchMySubscription.mockReturnValue(new Promise(() => {}))

    renderProvider(<TestConsumer />)

    // loading should be true (the provider waits for auth)
    expect(screen.getByTestId('loading')).toHaveTextContent('true')
  })

  // ─── No user ───────────────────────────────────────────────────────

  it('sets subscription to null when user is not logged in', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    renderProvider(<TestConsumer />)

    await waitFor(() => {
      expect(screen.getByTestId('has-active')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('subscription-status')).toHaveTextContent('null')
    // Should NOT call fetchMySubscription when there's no user
    expect(mockFetchMySubscription).not.toHaveBeenCalled()
  })

  // ─── Fetches subscription for logged-in user ───────────────────────

  it('fetches subscription when user is logged in', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1', email: 'test@test.com' }, loading: false })
    mockFetchMySubscription.mockResolvedValue(activeSub('ACTIVE'))

    renderProvider(<TestConsumer />)

    await waitFor(() => {
      expect(mockFetchMySubscription).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByTestId('subscription-status')).toHaveTextContent('ACTIVE')
  })

  // ─── hasActiveSubscription: active statuses ────────────────────────

  it.each([
    ['AUTHORIZED', true],
    ['ACTIVE', true],
    ['GRACE', true],
    ['PENDING', false],
    ['EXPIRED', false],
    ['CANCELLED', false],
  ])('hasActiveSubscription is %s for status %s', async (status, expected) => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false })
    mockFetchMySubscription.mockResolvedValue(activeSub(status))

    renderProvider(<TestConsumer />)

    await waitFor(() => {
      expect(screen.getByTestId('has-active')).toHaveTextContent(String(expected))
    })
  })

  // ─── Null subscription (no subscription exists) ────────────────────

  it('hasActiveSubscription is false when fetchMySubscription returns null', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false })
    mockFetchMySubscription.mockResolvedValue(null)

    renderProvider(<TestConsumer />)

    await waitFor(() => {
      expect(screen.getByTestId('subscription-status')).toHaveTextContent('null')
    })
    expect(screen.getByTestId('has-active')).toHaveTextContent('false')
  })

  // ─── API error ─────────────────────────────────────────────────────

  it('handles fetch error gracefully and sets subscription to null', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false })
    mockFetchMySubscription.mockRejectedValue(new Error('Network error'))

    renderProvider(<TestConsumer />)

    await waitFor(() => {
      expect(screen.getByTestId('subscription-status')).toHaveTextContent('null')
    })
    expect(screen.getByTestId('has-active')).toHaveTextContent('false')
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
  })

  // ─── refresh function ──────────────────────────────────────────────

  it('refresh() re-fetches subscription', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false })
    mockFetchMySubscription
      .mockResolvedValueOnce(activeSub('ACTIVE'))
      .mockResolvedValueOnce(activeSub('CANCELLED'))

    renderProvider(<TestConsumer />)

    await waitFor(() => {
      expect(screen.getByTestId('subscription-status')).toHaveTextContent('ACTIVE')
    })

    // Click refresh
    screen.getByTestId('refresh').click()

    await waitFor(() => {
      expect(screen.getByTestId('subscription-status')).toHaveTextContent('CANCELLED')
    })
    expect(mockFetchMySubscription).toHaveBeenCalledTimes(2)
  })
})
