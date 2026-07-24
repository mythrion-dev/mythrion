import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GracePeriodBanner } from '../GracePeriodBanner'

/* ── Mock subscription context ── */
const mockUseSubscription = vi.fn()
vi.mock('@/lib/subscription-context', () => ({
  useSubscription: () => mockUseSubscription(),
}))

/** Create a fake subscription object with a given status and graceEndsAt date. */
function fakeSubscription(
  status: string,
  graceEndsAt: string | null = null,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'sub-1',
    userId: 'user-1',
    planId: 'monthly',
    mpSubscriptionId: 'mp-1',
    status,
    graceEndsAt,
    currentPeriodStart: '2025-01-01',
    currentPeriodEnd: '2025-02-01',
    cancelledAt: null,
    createdAt: '2025-01-01',
    plan: { slug: 'monthly', name: 'Monthly', price: 12000 },
    invoices: [],
    ...overrides,
  }
}

describe('GracePeriodBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2025-01-10T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // ─── Not shown for non-GRACE statuses ───────────────────────────────

  it('returns null when subscription is ACTIVE', () => {
    mockUseSubscription.mockReturnValue({
      subscription: fakeSubscription('ACTIVE'),
    })

    const { container } = render(<GracePeriodBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when subscription is PENDING', () => {
    mockUseSubscription.mockReturnValue({
      subscription: fakeSubscription('PENDING'),
    })

    const { container } = render(<GracePeriodBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when subscription is EXPIRED', () => {
    mockUseSubscription.mockReturnValue({
      subscription: fakeSubscription('EXPIRED'),
    })

    const { container } = render(<GracePeriodBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when subscription is CANCELLED', () => {
    mockUseSubscription.mockReturnValue({
      subscription: fakeSubscription('CANCELLED'),
    })

    const { container } = render(<GracePeriodBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when subscription is null', () => {
    mockUseSubscription.mockReturnValue({ subscription: null })

    const { container } = render(<GracePeriodBanner />)
    expect(container.innerHTML).toBe('')
  })

  // ─── GRACE status banner ────────────────────────────────────────────

  it('shows warning banner when status is GRACE with days left', () => {
    // graceEndsAt is 5 days from now
    const graceEndsAt = '2025-01-15T12:00:00.000Z'
    mockUseSubscription.mockReturnValue({
      subscription: fakeSubscription('GRACE', graceEndsAt),
    })

    render(<GracePeriodBanner />)

    expect(screen.getByText('Payment issue detected')).toBeInTheDocument()
    expect(screen.getByText(/You have 5 days left/)).toBeInTheDocument()
    expect(screen.getByText('Update payment method')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dismiss/ })).toBeInTheDocument()
  })

  it('shows correct day count for 1 day left', () => {
    // graceEndsAt is 1 day from now
    const graceEndsAt = '2025-01-11T12:00:00.000Z'
    mockUseSubscription.mockReturnValue({
      subscription: fakeSubscription('GRACE', graceEndsAt),
    })

    render(<GracePeriodBanner />)

    expect(screen.getByText(/You have 1 day left/)).toBeInTheDocument()
  })

  it('shows "grace period ended" message when 0 days left', () => {
    // graceEndsAt is already past (1 hour ago)
    const graceEndsAt = '2025-01-10T11:00:00.000Z'
    mockUseSubscription.mockReturnValue({
      subscription: fakeSubscription('GRACE', graceEndsAt),
    })

    render(<GracePeriodBanner />)

    expect(screen.getByText(/Your grace period has ended/)).toBeInTheDocument()
  })

  it('shows "grace period ended" when graceEndsAt is current time', () => {
    const graceEndsAt = '2025-01-10T12:00:00.000Z'
    mockUseSubscription.mockReturnValue({
      subscription: fakeSubscription('GRACE', graceEndsAt),
    })

    render(<GracePeriodBanner />)

    expect(screen.getByText(/Your grace period has ended/)).toBeInTheDocument()
  })

  it('renders the update payment method link', () => {
    const graceEndsAt = '2025-01-15T12:00:00.000Z'
    mockUseSubscription.mockReturnValue({
      subscription: fakeSubscription('GRACE', graceEndsAt),
    })

    render(<GracePeriodBanner />)

    const link = screen.getByText('Update payment method')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/subscription/manage')
  })

  // ─── Dismiss behavior ───────────────────────────────────────────────

  it('hides banner when dismiss button is clicked', () => {
    const graceEndsAt = '2025-01-15T12:00:00.000Z'
    mockUseSubscription.mockReturnValue({
      subscription: fakeSubscription('GRACE', graceEndsAt),
    })

    render(<GracePeriodBanner />)
    expect(screen.getByText('Payment issue detected')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Dismiss/ }))

    expect(screen.queryByText('Payment issue detected')).not.toBeInTheDocument()
  })

  // ─── Recalculates days via interval ─────────────────────────────────

  it('updates daysLeft when interval fires', () => {
    // graceEndsAt is 2 days from the initial system time
    const graceEndsAt = '2025-01-12T12:00:00.000Z'
    mockUseSubscription.mockReturnValue({
      subscription: fakeSubscription('GRACE', graceEndsAt),
    })

    render(<GracePeriodBanner />)
    expect(screen.getByText(/You have 2 days left/)).toBeInTheDocument()

    // Advance 1 day — should now show 1 day left
    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60 * 1000) // 1 day
    })

    expect(screen.getByText(/You have 1 day left/)).toBeInTheDocument()
  })

  // ─── GraceEndsAt null ───────────────────────────────────────────────

  it('shows "grace period ended" when graceEndsAt is null', () => {
    mockUseSubscription.mockReturnValue({
      subscription: fakeSubscription('GRACE', null),
    })

    render(<GracePeriodBanner />)

    expect(screen.getByText(/Your grace period has ended/)).toBeInTheDocument()
  })
})
