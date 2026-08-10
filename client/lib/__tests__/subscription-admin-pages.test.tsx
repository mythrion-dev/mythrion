import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

// ── Stable router mock ────────────────────────────────────────────────
// The success page's 1500ms redirect effect depends on `router`; a fresh
// object per render would clear/re-arm the timeout on every 1s elapsed
// re-render, so we hand back one stable object.
const mockRouterPush = vi.fn()
const mockRouterReplace = vi.fn()
const mockRouterBack = vi.fn()
const mockRouterForward = vi.fn()
const mockRouterRefresh = vi.fn()
const mockRouterPrefetch = vi.fn()
const mockRouter = {
  push: mockRouterPush,
  replace: mockRouterReplace,
  back: mockRouterBack,
  forward: mockRouterForward,
  refresh: mockRouterRefresh,
  prefetch: mockRouterPrefetch,
}

const mockUseSearchParams = vi.fn()
const mockUsePathname = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockUseSearchParams(),
  usePathname: () => mockUsePathname(),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// ── Auth mock ─────────────────────────────────────────────────────────
const mockAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => mockAuth(),
}))

// ── Subscription API mocks ────────────────────────────────────────────
const mockFetchPlans = vi.fn()
const mockCreateSubscription = vi.fn()
const mockFetchMySubscription = vi.fn()
const mockCancelSubscription = vi.fn()
vi.mock('@/lib/subscription-api', () => ({
  fetchPlans: (...args: unknown[]) => mockFetchPlans(...args),
  createSubscription: (...args: unknown[]) => mockCreateSubscription(...args),
  fetchMySubscription: (...args: unknown[]) => mockFetchMySubscription(...args),
  cancelSubscription: (...args: unknown[]) => mockCancelSubscription(...args),
}))

// ── Admin subscription API mocks ──────────────────────────────────────
const mockAdminFetchPlans = vi.fn()
const mockAdminCreatePlan = vi.fn()
const mockAdminUpdatePlan = vi.fn()
const mockAdminDeletePlan = vi.fn()
vi.mock('@/lib/subscription-admin-api', () => ({
  adminFetchPlans: (...args: unknown[]) => mockAdminFetchPlans(...args),
  adminCreatePlan: (...args: unknown[]) => mockAdminCreatePlan(...args),
  adminUpdatePlan: (...args: unknown[]) => mockAdminUpdatePlan(...args),
  adminDeletePlan: (...args: unknown[]) => mockAdminDeletePlan(...args),
}))

// ── Dashboard Sidebar stub (used by admin layout) ─────────────────────
vi.mock('@/components/dashboard', () => ({
  Sidebar: () => <div>Mock Sidebar</div>,
}))

// ── Imports under test ────────────────────────────────────────────────
import { SubscriptionProvider } from '@/lib/subscription-context'
import CheckoutPage from '@/app/subscription/checkout/page'
import SuccessPage from '@/app/subscription/success/page'
import ManageSubscriptionPage from '@/app/subscription/manage/page'
import AdminLayout from '@/app/admin/layout'
import AdminPlansPage from '@/app/admin/plans/page'

const mockEncryptCard = vi.fn()

// ── Fixtures ───────────────────────────────────────────────────────────
const baseUser = {
  id: 'user-1',
  email: 'alice@example.com',
  displayName: 'Alice',
  onboardingComplete: true,
  isAdmin: false,
  isEarlyAccess: false,
  language: 'en',
  twoFactorEnabled: false,
  emailVerified: true,
  hasPassword: true,
}

const adminUser = { ...baseUser, isAdmin: true }

const monthlyPlan = {
  id: 'monthly',
  slug: 'monthly',
  name: 'Monthly',
  description: null,
  price: 12000,
  pgPlanId: 'PG-MONTHLY',
}

const annualPlan = {
  id: 'annual',
  slug: 'annual',
  name: 'Annual',
  description: null,
  price: 120000,
  pgPlanId: 'PG-ANNUAL',
}

const apiPlans = [monthlyPlan, annualPlan]

function subscription(status: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    plan: { slug: 'monthly', name: 'Monthly', price: 12000 },
    status,
    pgSubscriptionId: 'SUB-1',
    graceEndsAt: null,
    currentPeriodStart: '2025-01-01',
    currentPeriodEnd: '2025-02-01',
    cancelledAt: null,
    cancelAtPeriodEnd: false,
    createdAt: '2025-01-01',
    invoices: [],
    ...overrides,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────
function setAuth(overrides: { user?: typeof baseUser | null; loading?: boolean } = {}) {
  mockAuth.mockReturnValue({
    user: overrides.user !== undefined ? overrides.user : null,
    loading: overrides.loading !== undefined ? overrides.loading : false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    completeOnboarding: vi.fn(),
    verifyTwoFactor: vi.fn(),
    refreshProfile: vi.fn(),
  })
}

function renderWithSub(ui: ReactNode) {
  return render(<SubscriptionProvider>{ui}</SubscriptionProvider>)
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockEncryptCard.mockReset()
  mockEncryptCard.mockReturnValue({ encryptedCard: 'ENC', hasErrors: false })
  mockFetchPlans.mockResolvedValue(apiPlans)
  mockFetchMySubscription.mockResolvedValue(null)
  mockAdminFetchPlans.mockResolvedValue([monthlyPlan, annualPlan])
  mockUseSearchParams.mockReturnValue(new URLSearchParams())
  mockUsePathname.mockReturnValue('/admin/plans')
  setAuth()
  process.env.NEXT_PUBLIC_PAGBANK_PUBLIC_KEY = ''
  delete (window as any).PagSeguro
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: mockClipboardWrite },
    configurable: true,
  })
})

afterEach(() => {
  vi.useRealTimers()
  delete (window as any).PagSeguro
  process.env.NEXT_PUBLIC_PAGBANK_PUBLIC_KEY = ''
  vi.restoreAllMocks()
})

const mockClipboardWrite = vi.fn()

// ══════════════════════════════════════════════════════════════════════
// CheckoutPage (app/subscription/checkout/page.tsx)
// ══════════════════════════════════════════════════════════════════════

describe('CheckoutPage', () => {
  it('redirects unauthenticated users to login with the current plan', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    setAuth({ user: null, loading: false })
    renderWithSub(<CheckoutPage />)
    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith(
        '/login?redirect=/subscription/checkout?planId=monthly',
      ),
    )
  })

  it('redirects unverified users to verify-email', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    setAuth({ user: { ...baseUser, emailVerified: false }, loading: false })
    renderWithSub(<CheckoutPage />)
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/verify-email'))
  })

  it('shows an error when no plan is selected and lets the user go back to the form', async () => {
    setAuth({ user: baseUser, loading: false })
    renderWithSub(<CheckoutPage />)
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.getByText('No plan selected. Go back and choose a plan.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('Finish subscription')).toBeInTheDocument()
    // planId is still missing, so the plan never loads → button stays "Loading..."
    expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled()
  })

  it('shows an error when the requested plan is not found', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'nope' }))
    renderWithSub(<CheckoutPage />)
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Plan not found.')).toBeInTheDocument()
  })

  it('shows an error when loading plans fails', async () => {
    mockFetchPlans.mockRejectedValueOnce(new Error('boom'))
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    renderWithSub(<CheckoutPage />)
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Error loading plan data.')).toBeInTheDocument()
  })

  it('renders the checkout form with plan summary and no card payment (no public key)', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    renderWithSub(<CheckoutPage />)
    expect(await screen.findByText('Finish subscription')).toBeInTheDocument()
    expect(screen.getByText('Monthly')).toBeInTheDocument()
    expect(screen.getByText('R$ 120,00')).toBeInTheDocument()
    expect(screen.getByText('Buyer details')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name *')).toBeInTheDocument()
    expect(screen.getByLabelText('CPF *')).toBeInTheDocument()
    expect(screen.getByText('Card payment is currently unavailable.')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Subscribe R$ 120,00/month' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Payments are securely processed by/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Back to plans/ }).length).toBeGreaterThan(0)
  })

  it('uses the /year period label for the annual plan', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'annual' }))
    renderWithSub(<CheckoutPage />)
    expect(await screen.findByText('Annual')).toBeInTheDocument()
    expect(screen.getByText('/year')).toBeInTheDocument()
  })

  it('shows validation errors for name and CPF', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    renderWithSub(<CheckoutPage />)
    await screen.findByRole('button', { name: /Subscribe/ })
    fireEvent.change(screen.getByLabelText('Full name *'), { target: { value: 'Al' } })
    fireEvent.change(screen.getByLabelText('CPF *'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe R$ 120,00/month' }))
    expect(screen.getByText('Enter your full name.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid CPF (11 digits).')).toBeInTheDocument()
    expect(mockCreateSubscription).not.toHaveBeenCalled()
  })

  it('subscribes without card encryption when no public key is configured', async () => {
    mockCreateSubscription.mockResolvedValue({ initPoint: '', subscriptionId: 'sub-1' })
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    renderWithSub(<CheckoutPage />)
    await screen.findByRole('button', { name: /Subscribe/ })
    fireEvent.change(screen.getByLabelText('Full name *'), { target: { value: 'Alice Johnson' } })
    fireEvent.change(screen.getByLabelText('CPF *'), { target: { value: '12345678901' } })
    expect(screen.getByLabelText('CPF *')).toHaveValue('123.456.789-01')
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe R$ 120,00/month' }))
    await waitFor(() =>
      expect(mockCreateSubscription).toHaveBeenCalledWith(
        'monthly',
        undefined,
        '',
        'Alice Johnson',
        '12345678901',
        undefined,
        undefined,
      ),
    )
    expect(await screen.findByText('Subscription created!')).toBeInTheDocument()
    expect(screen.getByText('Redirecting to the dashboard...')).toBeInTheDocument()
    expect(mockRouterPush).toHaveBeenCalledWith('/subscription/success')
  })

  it('shows the creating state while the subscription is being created', async () => {
    let resolveSub!: (v: unknown) => void
    mockCreateSubscription.mockImplementation(
      () => new Promise((res) => { resolveSub = res }),
    )
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    renderWithSub(<CheckoutPage />)
    await screen.findByRole('button', { name: /Subscribe/ })
    fireEvent.change(screen.getByLabelText('Full name *'), { target: { value: 'Alice Johnson' } })
    fireEvent.change(screen.getByLabelText('CPF *'), { target: { value: '12345678901' } })
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe R$ 120,00/month' }))
    expect(screen.getByText('Preparing subscription...')).toBeInTheDocument()
    expect(
      screen.getByText('Please wait while we set up your subscription.'),
    ).toBeInTheDocument()
    await act(async () => {
      resolveSub({ initPoint: '', subscriptionId: 'sub-1' })
    })
    expect(await screen.findByText('Subscription created!')).toBeInTheDocument()
  })

  it('subscribes with a pre-defined sandbox token for a test card', async () => {
    process.env.NEXT_PUBLIC_PAGBANK_PUBLIC_KEY = 'pk_test'
    ;(window as any).PagSeguro = { encryptCard: mockEncryptCard }
    mockCreateSubscription.mockResolvedValue({ initPoint: '', subscriptionId: 'sub-1' })
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    renderWithSub(<CheckoutPage />)
    await screen.findByRole('button', { name: /Subscribe/ })
    fireEvent.change(screen.getByLabelText('Full name *'), { target: { value: 'Alice Johnson' } })
    fireEvent.change(screen.getByLabelText('CPF *'), { target: { value: '12345678901' } })
    expect(screen.getByText('Card details')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Card number *'), {
      target: { value: '5555666677778884' },
    })
    expect(screen.getByLabelText('Card number *')).toHaveValue('5555 6666 7777 8884')
    fireEvent.change(screen.getByLabelText('Expiry *'), { target: { value: '1226' } })
    expect(screen.getByLabelText('Expiry *')).toHaveValue('12/26')
    fireEvent.change(screen.getByLabelText('CVV *'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe R$ 120,00/month' }))
    await waitFor(() =>
      expect(mockCreateSubscription).toHaveBeenCalledWith(
        'monthly',
        undefined,
        '123',
        'Alice Johnson',
        '12345678901',
        undefined,
        'CARD_8286F604-2D44-4B30-A80D-0E749A555566',
      ),
    )
    // Sandbox token path never touches the encryption SDK
    expect(mockEncryptCard).not.toHaveBeenCalled()
    expect(await screen.findByText('Subscription created!')).toBeInTheDocument()
  })

  it('encrypts a production card before subscribing', async () => {
    process.env.NEXT_PUBLIC_PAGBANK_PUBLIC_KEY = 'pk_test'
    ;(window as any).PagSeguro = { encryptCard: mockEncryptCard }
    mockCreateSubscription.mockResolvedValue({ initPoint: '', subscriptionId: 'sub-1' })
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    renderWithSub(<CheckoutPage />)
    await screen.findByRole('button', { name: /Subscribe/ })
    fireEvent.change(screen.getByLabelText('Full name *'), { target: { value: 'Alice Johnson' } })
    fireEvent.change(screen.getByLabelText('CPF *'), { target: { value: '12345678901' } })
    fireEvent.change(screen.getByLabelText('Card number *'), {
      target: { value: '4111111111111111' },
    })
    fireEvent.change(screen.getByLabelText('Expiry *'), { target: { value: '12/30' } })
    fireEvent.change(screen.getByLabelText('CVV *'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe R$ 120,00/month' }))
    await waitFor(() =>
      expect(mockEncryptCard).toHaveBeenCalledWith({
        publicKey: 'pk_test',
        holder: 'Alice Johnson',
        number: '4111111111111111',
        expMonth: '12',
        expYear: '2030',
        securityCode: '123',
      }),
    )
    await waitFor(() =>
      expect(mockCreateSubscription).toHaveBeenCalledWith(
        'monthly',
        'ENC',
        '123',
        'Alice Johnson',
        '12345678901',
        undefined,
        undefined,
      ),
    )
    expect(await screen.findByText('Subscription created!')).toBeInTheDocument()
  })

  it('shows an encryption error when the SDK reports card errors', async () => {
    process.env.NEXT_PUBLIC_PAGBANK_PUBLIC_KEY = 'pk_test'
    mockEncryptCard.mockReturnValue({
      hasErrors: true,
      errors: [{ message: 'Card expired' }],
    })
    ;(window as any).PagSeguro = { encryptCard: mockEncryptCard }
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    renderWithSub(<CheckoutPage />)
    await screen.findByRole('button', { name: /Subscribe/ })
    fireEvent.change(screen.getByLabelText('Full name *'), { target: { value: 'Alice Johnson' } })
    fireEvent.change(screen.getByLabelText('CPF *'), { target: { value: '12345678901' } })
    fireEvent.change(screen.getByLabelText('Card number *'), {
      target: { value: '4111111111111111' },
    })
    fireEvent.change(screen.getByLabelText('Expiry *'), { target: { value: '12/30' } })
    fireEvent.change(screen.getByLabelText('CVV *'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe R$ 120,00/month' }))
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Encryption error: Card expired')).toBeInTheDocument()
  })

  it('shows validation errors for card fields when a public key is configured', async () => {
    process.env.NEXT_PUBLIC_PAGBANK_PUBLIC_KEY = 'pk_test'
    ;(window as any).PagSeguro = { encryptCard: mockEncryptCard }
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    renderWithSub(<CheckoutPage />)
    await screen.findByRole('button', { name: /Subscribe/ })
    fireEvent.change(screen.getByLabelText('Full name *'), { target: { value: 'Alice Johnson' } })
    fireEvent.change(screen.getByLabelText('CPF *'), { target: { value: '12345678901' } })
    // Leave all card fields empty → every card branch errors; last writer wins
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe R$ 120,00/month' }))
    expect(screen.getByText('Invalid CVV.')).toBeInTheDocument()
    expect(mockCreateSubscription).not.toHaveBeenCalled()
  })

  it('shows the SDK-not-loaded error for a production card when the SDK is missing', async () => {
    process.env.NEXT_PUBLIC_PAGBANK_PUBLIC_KEY = 'pk_test'
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    renderWithSub(<CheckoutPage />)
    await screen.findByText('Monthly')
    const script = document.head.querySelector('script[src*="pagseguro"]') as HTMLScriptElement
    act(() => {
      ;(script as any).onload()
    })
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Subscribe R$ 120,00/month' }),
      ).not.toBeDisabled(),
    )
    fireEvent.change(screen.getByLabelText('Full name *'), { target: { value: 'Alice Johnson' } })
    fireEvent.change(screen.getByLabelText('CPF *'), { target: { value: '12345678901' } })
    fireEvent.change(screen.getByLabelText('Card number *'), {
      target: { value: '4111111111111111' },
    })
    fireEvent.change(screen.getByLabelText('Expiry *'), { target: { value: '12/30' } })
    fireEvent.change(screen.getByLabelText('CVV *'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe R$ 120,00/month' }))
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.getByText('PagBank encryption SDK not loaded. Please try again.'),
    ).toBeInTheDocument()
  })

  it('handles the PagSeguro script onerror and still shows the card form', async () => {
    process.env.NEXT_PUBLIC_PAGBANK_PUBLIC_KEY = 'pk_test'
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    renderWithSub(<CheckoutPage />)
    await screen.findByText('Monthly')
    const script = document.head.querySelector('script[src*="pagseguro"]') as HTMLScriptElement
    act(() => {
      ;(script as any).onerror()
    })
    expect(console.error).toHaveBeenCalledWith(
      '[checkout] Failed to load PagSeguro encryption SDK',
    )
    expect(screen.getByText('Card details')).toBeInTheDocument()
  })

  it('shows the Preparing label while the encryption SDK is still loading', async () => {
    process.env.NEXT_PUBLIC_PAGBANK_PUBLIC_KEY = 'pk_test'
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    renderWithSub(<CheckoutPage />)
    // Plan loads but we never fire the script onload → pgReady stays false
    await screen.findByText('Monthly')
    expect(screen.getByRole('button', { name: 'Preparing...' })).toBeDisabled()
  })

  it('shows a raw error message when subscription creation rejects with an Error', async () => {
    mockCreateSubscription.mockRejectedValue(new Error('boom'))
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    renderWithSub(<CheckoutPage />)
    await screen.findByRole('button', { name: /Subscribe/ })
    fireEvent.change(screen.getByLabelText('Full name *'), { target: { value: 'Alice Johnson' } })
    fireEvent.change(screen.getByLabelText('CPF *'), { target: { value: '12345678901' } })
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe R$ 120,00/month' }))
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
  })

  it('shows a string error when subscription creation rejects with a string', async () => {
    mockCreateSubscription.mockRejectedValue('string failure')
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    renderWithSub(<CheckoutPage />)
    await screen.findByRole('button', { name: /Subscribe/ })
    fireEvent.change(screen.getByLabelText('Full name *'), { target: { value: 'Alice Johnson' } })
    fireEvent.change(screen.getByLabelText('CPF *'), { target: { value: '12345678901' } })
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe R$ 120,00/month' }))
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('string failure')).toBeInTheDocument()
  })

  it('shows a fallback message when subscription creation rejects with an unknown value', async () => {
    mockCreateSubscription.mockRejectedValue({ code: 500 })
    mockUseSearchParams.mockReturnValue(new URLSearchParams({ planId: 'monthly' }))
    renderWithSub(<CheckoutPage />)
    await screen.findByRole('button', { name: /Subscribe/ })
    fireEvent.change(screen.getByLabelText('Full name *'), { target: { value: 'Alice Johnson' } })
    fireEvent.change(screen.getByLabelText('CPF *'), { target: { value: '12345678901' } })
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe R$ 120,00/month' }))
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.getByText('Failed to create subscription. Please try again.'),
    ).toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════
// SuccessPage (app/subscription/success/page.tsx)
// ══════════════════════════════════════════════════════════════════════

describe('SuccessPage', () => {
  it('redirects unauthenticated users to login', async () => {
    setAuth({ user: null, loading: false })
    renderWithSub(<SuccessPage />)
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/login'))
  })

  it('redirects unverified users to verify-email', async () => {
    setAuth({ user: { ...baseUser, emailVerified: false }, loading: false })
    renderWithSub(<SuccessPage />)
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/verify-email'))
  })

  it('shows the success state and redirects to the dashboard for an active subscription', async () => {
    vi.useFakeTimers()
    setAuth({ user: baseUser, loading: false })
    mockFetchMySubscription.mockResolvedValue(subscription('ACTIVE'))
    renderWithSub(<SuccessPage />)
    await flushMicrotasks()
    expect(screen.getByText('Subscription confirmed!')).toBeInTheDocument()
    expect(
      screen.getByText(
        "Welcome to Mythrion Premium. You're being redirected to the dashboard.",
      ),
    ).toBeInTheDocument()
    await advance(1500)
    expect(mockRouterReplace).toHaveBeenCalledWith('/dashboard')
  })

  it('times out after 30 seconds and offers Check again', async () => {
    vi.useFakeTimers()
    setAuth({ user: baseUser, loading: false })
    mockFetchMySubscription.mockResolvedValue(null)
    renderWithSub(<SuccessPage />)
    await flushMicrotasks()
    expect(screen.getByText('Processing your payment...')).toBeInTheDocument()
    await advance(30000)
    expect(screen.getByText('Still waiting for confirmation')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Your payment is being processed by PagBank. This may take a few minutes.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    )
  })

  it('resets the loading state when Check again is clicked after a timeout', async () => {
    vi.useFakeTimers()
    setAuth({ user: baseUser, loading: false })
    mockFetchMySubscription.mockResolvedValue(null)
    renderWithSub(<SuccessPage />)
    await flushMicrotasks()
    await advance(30000)
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    await flushMicrotasks()
    expect(screen.getByText('Processing your payment...')).toBeInTheDocument()
    expect(screen.queryByText('Still waiting for confirmation')).not.toBeInTheDocument()
  })

  it('updates the status message as time elapses', async () => {
    vi.useFakeTimers()
    setAuth({ user: baseUser, loading: false })
    mockFetchMySubscription.mockResolvedValue(null)
    renderWithSub(<SuccessPage />)
    await flushMicrotasks()
    expect(screen.getByText('Processing your payment...')).toBeInTheDocument()
    await advance(5000)
    expect(screen.getByText('Waiting for payment confirmation...')).toBeInTheDocument()
    await advance(10000)
    expect(screen.getByText('Still confirming your subscription...')).toBeInTheDocument()
    await advance(10000)
    expect(screen.getByText('Taking longer than expected...')).toBeInTheDocument()
  })

  it('polls the subscription status while it is pending', async () => {
    vi.useFakeTimers()
    setAuth({ user: baseUser, loading: false })
    mockFetchMySubscription.mockResolvedValue(subscription('PENDING'))
    renderWithSub(<SuccessPage />)
    await flushMicrotasks()
    const callsAfterMount = mockFetchMySubscription.mock.calls.length
    await advance(3000)
    expect(mockFetchMySubscription.mock.calls.length).toBeGreaterThan(callsAfterMount)
  })
})

// ══════════════════════════════════════════════════════════════════════
// ManageSubscriptionPage (app/subscription/manage/page.tsx)
// ══════════════════════════════════════════════════════════════════════

describe('ManageSubscriptionPage', () => {
  it('shows a spinner while auth is loading', () => {
    setAuth({ user: null, loading: true })
    const { container } = renderWithSub(<ManageSubscriptionPage />)
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })

  it('redirects unauthenticated users to login', async () => {
    setAuth({ user: null, loading: false })
    renderWithSub(<ManageSubscriptionPage />)
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/login'))
  })

  it('redirects unverified users to verify-email', async () => {
    setAuth({ user: { ...baseUser, emailVerified: false }, loading: false })
    renderWithSub(<ManageSubscriptionPage />)
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/verify-email'))
  })

  it('shows the no-subscription view', async () => {
    setAuth({ user: baseUser, loading: false })
    mockFetchMySubscription.mockResolvedValue(null)
    renderWithSub(<ManageSubscriptionPage />)
    expect(await screen.findByText('No subscription found')).toBeInTheDocument()
    expect(screen.getByText("You don't have an active subscription yet.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Plans' })).toHaveAttribute(
      'href',
      '/pricing',
    )
  })

  it('renders an active subscription with invoices', async () => {
    setAuth({ user: baseUser, loading: false })
    mockFetchMySubscription.mockResolvedValue(
      subscription('ACTIVE', {
        invoices: [
          {
            id: 'inv-1',
            amount: 12000,
            currency: 'BRL',
            status: 'paid',
            paidAt: '2025-01-01',
            dueDate: null,
            createdAt: '2025-01-01',
          },
          {
            id: 'inv-2',
            amount: 12000,
            currency: 'BRL',
            status: 'pending',
            paidAt: null,
            dueDate: null,
            createdAt: '2025-02-01',
          },
        ],
      }),
    )
    renderWithSub(<ManageSubscriptionPage />)
    expect(await screen.findByText('Monthly')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Details')).toBeInTheDocument()
    expect(screen.getByText('Current period start')).toBeInTheDocument()
    expect(screen.getByText('Current period end')).toBeInTheDocument()
    expect(screen.getByText('Created at')).toBeInTheDocument()
    expect(screen.getByText('Recent invoices')).toBeInTheDocument()
    expect(screen.getAllByText(/120,00/).length).toBeGreaterThan(0)
    expect(screen.getByText('paid')).toBeInTheDocument()
    expect(screen.getByText('pending')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel subscription' })).toBeInTheDocument()
  })

  it('keeps the subscription when cancel is dismissed', async () => {
    setAuth({ user: baseUser, loading: false })
    mockFetchMySubscription.mockResolvedValue(subscription('ACTIVE'))
    renderWithSub(<ManageSubscriptionPage />)
    await screen.findByText('Monthly')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    expect(screen.getByText(/Are you sure you want to cancel your subscription/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Keep subscription' }))
    expect(
      screen.queryByText(/Are you sure you want to cancel your subscription/),
    ).not.toBeInTheDocument()
    expect(mockCancelSubscription).not.toHaveBeenCalled()
  })

  it('confirms the cancellation and refreshes the subscription', async () => {
    setAuth({ user: baseUser, loading: false })
    mockFetchMySubscription.mockResolvedValue(subscription('ACTIVE'))
    mockCancelSubscription.mockResolvedValue(undefined)
    renderWithSub(<ManageSubscriptionPage />)
    await screen.findByText('Monthly')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    await waitFor(() => expect(mockCancelSubscription).toHaveBeenCalledTimes(1))
    expect(mockFetchMySubscription.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(
      screen.queryByText(/Are you sure you want to cancel your subscription/),
    ).not.toBeInTheDocument()
  })

  it('shows an error when cancellation fails', async () => {
    setAuth({ user: baseUser, loading: false })
    mockFetchMySubscription.mockResolvedValue(subscription('ACTIVE'))
    mockCancelSubscription.mockRejectedValue(new Error('cancel failed'))
    renderWithSub(<ManageSubscriptionPage />)
    await screen.findByText('Monthly')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    expect(await screen.findByText('cancel failed')).toBeInTheDocument()
  })

  it('shows a cancelled subscription that is not cancellable', async () => {
    setAuth({ user: baseUser, loading: false })
    mockFetchMySubscription.mockResolvedValue(
      subscription('CANCELLED', { cancelledAt: '2025-03-01' }),
    )
    renderWithSub(<ManageSubscriptionPage />)
    expect(await screen.findByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByText('Cancelled at')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel subscription' })).not.toBeInTheDocument()
  })

  it('shows a grace-period subscription with an update-payment-method link', async () => {
    setAuth({ user: baseUser, loading: false })
    mockFetchMySubscription.mockResolvedValue(
      subscription('GRACE', {
        graceEndsAt: '2025-01-15T12:00:00',
        currentPeriodEnd: null,
      }),
    )
    renderWithSub(<ManageSubscriptionPage />)
    expect(await screen.findByText('Grace Period')).toBeInTheDocument()
    expect(screen.getByText('Grace period ends')).toBeInTheDocument()
    expect(screen.getByText(/15\/01\/2025/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Update payment method' })).toHaveAttribute(
      'href',
      '/subscription/manage',
    )
    // isActive includes GRACE → cancellation is offered with the end-of-period fallback
    expect(screen.getByText(/the end of the current billing period/)).toBeInTheDocument()
  })

  it('shows a scheduled cancellation for an active subscription at period end', async () => {
    setAuth({ user: baseUser, loading: false })
    mockFetchMySubscription.mockResolvedValue(
      subscription('ACTIVE', { cancelAtPeriodEnd: true }),
    )
    renderWithSub(<ManageSubscriptionPage />)
    expect(await screen.findByText('Cancellation scheduled')).toBeInTheDocument()
    expect(screen.getByText(/Your subscription will expire on/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel subscription' })).not.toBeInTheDocument()
  })

  it('falls back to rendering the raw status for unknown statuses', async () => {
    setAuth({ user: baseUser, loading: false })
    mockFetchMySubscription.mockResolvedValue(
      subscription('UNKNOWN', { currentPeriodEnd: null }),
    )
    renderWithSub(<ManageSubscriptionPage />)
    expect(await screen.findByText('UNKNOWN')).toBeInTheDocument()
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════
// AdminLayout (app/admin/layout.tsx)
// ══════════════════════════════════════════════════════════════════════

describe('AdminLayout', () => {
  it('shows a spinner while auth is loading', () => {
    setAuth({ user: null, loading: true })
    const { container } = render(<AdminLayout><div /></AdminLayout>)
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })

  it('redirects non-admin users to the dashboard', async () => {
    setAuth({ user: baseUser, loading: false })
    const { container } = render(<AdminLayout><div /></AdminLayout>)
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/dashboard'))
    expect(container).toBeEmptyDOMElement()
  })

  it('redirects an unverified admin to verify-email', async () => {
    setAuth({ user: { ...adminUser, emailVerified: false }, loading: false })
    render(<AdminLayout><div /></AdminLayout>)
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/verify-email'))
  })

  it('renders breadcrumbs, admin nav, sidebar and children for an admin', () => {
    setAuth({ user: adminUser, loading: false })
    render(
      <AdminLayout>
        <div>admin content</div>
      </AdminLayout>,
    )
    expect(screen.getByText('Mock Sidebar')).toBeInTheDocument()
    expect(screen.getByText('admin content')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute(
      'href',
      '/admin/plans',
    )
    expect(screen.getByRole('link', { name: 'Plans' })).toHaveAttribute('href', '/admin/plans')
    expect(screen.getAllByText('Plans').length).toBeGreaterThanOrEqual(2)
  })

  it('builds fallback breadcrumbs from path segments for unknown paths', () => {
    setAuth({ user: adminUser, loading: false })
    mockUsePathname.mockReturnValue('/admin/settings/general')
    render(
      <AdminLayout>
        <div>admin content</div>
      </AdminLayout>,
    )
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/admin/settings',
    )
    expect(screen.getByText('General')).toBeInTheDocument()
  })
})

// ══════════════════════════════════════════════════════════════════════
// AdminPlansPage (app/admin/plans/page.tsx)
// ══════════════════════════════════════════════════════════════════════

describe('AdminPlansPage', () => {
  it('shows a spinner while plans are loading', () => {
    mockAdminFetchPlans.mockReturnValue(new Promise(() => {}))
    const { container } = render(<AdminPlansPage />)
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows an error and retries loading', async () => {
    mockAdminFetchPlans
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce([monthlyPlan])
    render(<AdminPlansPage />)
    expect(await screen.findByText('fetch failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Monthly')).toBeInTheDocument()
  })

  it('shows a fallback error message for non-Error failures', async () => {
    mockAdminFetchPlans.mockRejectedValueOnce('oops')
    render(<AdminPlansPage />)
    expect(await screen.findByText('Failed to load plans')).toBeInTheDocument()
  })

  it('shows the empty state and opens the create form', async () => {
    mockAdminFetchPlans.mockResolvedValueOnce([])
    render(<AdminPlansPage />)
    expect(await screen.findByText('No plans registered.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create first plan' }))
    expect(
      screen.getByPlaceholderText('Ex: monthly, annual, premium...'),
    ).toBeInTheDocument()
  })

  it('renders the plans table with truncated PagBank plan IDs', async () => {
    const longPlan = {
      id: 'yearly',
      slug: 'yearly',
      name: 'Yearly',
      description: 'A yearly plan',
      price: 240000,
      pgPlanId: 'PAGBANK_PLAN_ID_VERY_LONG_123456',
    }
    mockAdminFetchPlans.mockResolvedValueOnce([monthlyPlan, longPlan])
    render(<AdminPlansPage />)
    expect(await screen.findByText('Manage the platform\'s subscription plans.')).toBeInTheDocument()
    expect(screen.getByText('Monthly')).toBeInTheDocument()
    expect(screen.getByText('Yearly')).toBeInTheDocument()
    expect(screen.getByText('PAGBANK_PLAN_ID_...')).toBeInTheDocument()
    expect(screen.getAllByTitle('Copy PagBank Plan ID').length).toBe(2)
    expect(screen.getAllByRole('button', { name: 'Edit' }).length).toBe(2)
  })

  it('validates the create form field by field', async () => {
    mockAdminFetchPlans.mockResolvedValueOnce([])
    render(<AdminPlansPage />)
    await screen.findByText('No plans registered.')
    fireEvent.click(screen.getByRole('button', { name: 'Create first plan' }))
    const save = () => screen.getByRole('button', { name: 'Save' })

    fireEvent.click(save())
    expect(screen.getByText('ID is required')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Ex: monthly, annual, premium...'), {
      target: { value: 'monthly' },
    })
    fireEvent.click(save())
    expect(screen.getByText('Slug is required')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Ex: monthly, annual'), {
      target: { value: 'monthly' },
    })
    fireEvent.click(save())
    expect(screen.getByText('Name is required')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Ex: Monthly, Annual'), {
      target: { value: 'Monthly' },
    })
    fireEvent.click(save())
    expect(screen.getByText('Price is required')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Ex: 120.00'), {
      target: { value: '0' },
    })
    fireEvent.click(save())
    expect(screen.getByText('PagBank plan ID is required')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('PagBank plan ID'), {
      target: { value: 'PG-1' },
    })
    fireEvent.click(save())
    expect(screen.getByText('Price must be greater than zero')).toBeInTheDocument()
    expect(mockAdminCreatePlan).not.toHaveBeenCalled()
  })

  it('creates a new plan and shows it in the table', async () => {
    mockAdminFetchPlans.mockResolvedValueOnce([annualPlan])
    mockAdminCreatePlan.mockResolvedValue({
      ...monthlyPlan,
      id: 'monthly',
      name: 'Monthly',
    })
    render(<AdminPlansPage />)
    await screen.findByText('Annual')
    fireEvent.click(screen.getByRole('button', { name: 'New plan' }))
    fireEvent.change(screen.getByPlaceholderText('Ex: monthly, annual, premium...'), {
      target: { value: 'monthly' },
    })
    fireEvent.change(screen.getByPlaceholderText('Ex: monthly, annual'), {
      target: { value: 'monthly' },
    })
    fireEvent.change(screen.getByPlaceholderText('Ex: Monthly, Annual'), {
      target: { value: 'Monthly' },
    })
    fireEvent.change(screen.getByPlaceholderText('Ex: 120.00'), {
      target: { value: '120' },
    })
    fireEvent.change(screen.getByPlaceholderText('PagBank plan ID'), {
      target: { value: 'PG-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(mockAdminCreatePlan).toHaveBeenCalledWith({
        id: 'monthly',
        slug: 'monthly',
        name: 'Monthly',
        description: undefined,
        price: 12000,
        pgPlanId: 'PG-1',
      }),
    )
    expect(await screen.findByText('Monthly')).toBeInTheDocument()
    // form closes after saving
    expect(screen.queryByPlaceholderText('Ex: monthly, annual, premium...')).not.toBeInTheDocument()
  })

  it('edits an existing plan and sends an update payload', async () => {
    mockAdminFetchPlans.mockResolvedValueOnce([monthlyPlan, annualPlan])
    mockAdminUpdatePlan.mockResolvedValue({ ...monthlyPlan, name: 'Monthly Premium' })
    render(<AdminPlansPage />)
    await screen.findByText('Monthly')
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    expect(screen.getByText('Edit plan')).toBeInTheDocument()
    const nameInput = screen.getByPlaceholderText('Ex: Monthly, Annual')
    expect(nameInput).toHaveValue('Monthly')
    fireEvent.change(nameInput, { target: { value: 'Monthly Premium' } })
    fireEvent.change(screen.getByPlaceholderText('Optional plan description...'), {
      target: { value: 'The best plan' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(mockAdminUpdatePlan).toHaveBeenCalledWith(
        'monthly',
        expect.objectContaining({
          slug: 'monthly',
          name: 'Monthly Premium',
          description: 'The best plan',
          price: 12000,
          pgPlanId: 'PG-MONTHLY',
        }),
      ),
    )
    expect(await screen.findByText('Monthly Premium')).toBeInTheDocument()
  })

  it('cancels the create form without saving', async () => {
    mockAdminFetchPlans.mockResolvedValueOnce([])
    render(<AdminPlansPage />)
    await screen.findByText('No plans registered.')
    fireEvent.click(screen.getByRole('button', { name: 'Create first plan' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(
      screen.queryByPlaceholderText('Ex: monthly, annual, premium...'),
    ).not.toBeInTheDocument()
  })

  it('deletes a plan after confirmation', async () => {
    mockAdminFetchPlans.mockResolvedValueOnce([monthlyPlan])
    mockAdminDeletePlan.mockResolvedValue(undefined)
    render(<AdminPlansPage />)
    await screen.findByText('Monthly')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete plan')).toBeInTheDocument()
    expect(
      screen.getByText('Are you sure you want to delete this plan? This action cannot be undone.'),
    ).toBeInTheDocument()
    // Two "Delete" buttons now: the row one and the modal confirm one
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    fireEvent.click(deleteButtons[deleteButtons.length - 1])
    await waitFor(() => expect(mockAdminDeletePlan).toHaveBeenCalledWith('monthly'))
    expect(await screen.findByText('No plans registered.')).toBeInTheDocument()
  })

  it('cancels the delete confirmation without deleting', async () => {
    mockAdminFetchPlans.mockResolvedValueOnce([monthlyPlan])
    render(<AdminPlansPage />)
    await screen.findByText('Monthly')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Delete plan')).not.toBeInTheDocument()
    expect(mockAdminDeletePlan).not.toHaveBeenCalled()
  })

  it('shows a delete error inside the confirmation modal', async () => {
    mockAdminFetchPlans.mockResolvedValueOnce([monthlyPlan])
    mockAdminDeletePlan.mockRejectedValue(new Error('delete failed'))
    render(<AdminPlansPage />)
    await screen.findByText('Monthly')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    fireEvent.click(deleteButtons[deleteButtons.length - 1])
    expect(await screen.findByText('delete failed')).toBeInTheDocument()
    expect(screen.getByText('Delete plan')).toBeInTheDocument()
  })

  it('copies the PagBank plan ID and shows feedback for 2 seconds', async () => {
    vi.useFakeTimers()
    mockAdminFetchPlans.mockResolvedValueOnce([monthlyPlan])
    mockClipboardWrite.mockResolvedValue(undefined)
    render(<AdminPlansPage />)
    await flushMicrotasks()
    expect(screen.getByText('PG-MONTHLY')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Copy PagBank Plan ID'))
    expect(mockClipboardWrite).toHaveBeenCalledWith('PG-MONTHLY')
    await flushMicrotasks()
    expect(screen.getByTitle('Copy PagBank Plan ID').querySelector('svg.text-emerald-500')).toBeTruthy()
    await advance(2000)
    expect(screen.getByTitle('Copy PagBank Plan ID').querySelector('svg.text-emerald-500')).toBeNull()
  })

  it('silently swallows clipboard failures', async () => {
    mockAdminFetchPlans.mockResolvedValueOnce([monthlyPlan])
    mockClipboardWrite.mockRejectedValue(new Error('denied'))
    render(<AdminPlansPage />)
    await screen.findByText('Monthly')
    fireEvent.click(screen.getByTitle('Copy PagBank Plan ID'))
    await waitFor(() => expect(mockClipboardWrite).toHaveBeenCalledWith('PG-MONTHLY'))
    expect(screen.getByTitle('Copy PagBank Plan ID').querySelector('svg.text-emerald-500')).toBeNull()
  })
})
