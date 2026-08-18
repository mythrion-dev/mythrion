import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ── RootLayout is a server component using next/font/google ──
vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: '--font-geist-sans', style: { fontFamily: 'Inter' } }),
  Geist_Mono: () => ({ variable: '--font-geist-mono', style: { fontFamily: 'monospace' } }),
}))

const mockRouterReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockRouterReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockAuth(),
}))

vi.mock('@/lib/subscription-api', () => ({
  fetchPlans: vi.fn(),
  fetchMySubscription: vi.fn(),
}))

import { fetchPlans, fetchMySubscription } from '@/lib/subscription-api'
import { SubscriptionProvider } from '@/lib/subscription-context'
import RootLayout, { metadata } from '@/app/layout'
import HomePage from '@/app/page'
import TermsPage from '@/app/terms/page'
import PrivacyPage from '@/app/privacy/page'
import CancelTermsPage from '@/app/cancel-terms/page'
import PricingPage from '@/app/pricing/page'

const mockFetchPlans = vi.mocked(fetchPlans)
const mockFetchMySubscription = vi.mocked(fetchMySubscription)

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

const apiPlans = [
  {
    id: 'monthly',
    slug: 'monthly',
    name: 'Plano Mensal (API)',
    description: 'API monthly',
    price: 12000,
    pgPlanId: '',
  },
  {
    id: 'annual',
    slug: 'annual',
    name: 'Plano Anual (API)',
    description: 'API annual',
    price: 120000,
    pgPlanId: '',
  },
]

const subscriptionFixture = {
  id: 'sub-1',
  plan: { slug: 'monthly', name: 'Plano Mensal (API)', price: 12000 },
  status: 'ACTIVE',
  hasActiveSubscription: true,
  pgSubscriptionId: null,
  graceEndsAt: null,
  currentPeriodStart: '2026-01-01T00:00:00Z',
  currentPeriodEnd: '2026-02-01T00:00:00Z',
  cancelledAt: null,
  cancelAtPeriodEnd: false,
  createdAt: '2026-01-01T00:00:00Z',
  invoices: [],
}

function setAuth(overrides: {
  user?: typeof baseUser | null
  loading?: boolean
} = {}) {
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

beforeEach(() => {
  vi.clearAllMocks()
  mockRouterReplace.mockReset()
  mockFetchPlans.mockResolvedValue(apiPlans)
  mockFetchMySubscription.mockResolvedValue(null)
  setAuth()
})

// ════════════════════════════════════════════════════════════
// RootLayout (app/layout.tsx)
// ════════════════════════════════════════════════════════════

describe('RootLayout', () => {
  it('exposes page metadata', () => {
    expect(metadata.title).toBe('Mythrion — Forge Your Legend')
    expect(metadata.icons).toEqual({ icon: '/favicon.ico' })
  })

  it('renders children through the provider stack', () => {
    const { container } = render(
      <RootLayout>
        <div>child-content</div>
      </RootLayout>,
    )
    expect(screen.getByText('child-content')).toBeInTheDocument()
    // React refuses to nest <html>/<body> inside jsdom's <div> container, so
    // the layout's head/tail content (script, ornament) is what actually mounts.
    expect(container.querySelector('script')).toBeTruthy()
  })

  it('wires the language-preference script', () => {
    const { container } = render(
      <RootLayout>
        <div>child-content</div>
      </RootLayout>,
    )
    const script = container.querySelector('script')
    expect(script).toBeTruthy()
    expect(script?.textContent).toContain("localStorage.getItem('mythrion_language')")
    expect(script?.textContent).toContain("document.documentElement.lang='pt-BR'")
  })
})

// ════════════════════════════════════════════════════════════
// HomePage (app/page.tsx)
// ════════════════════════════════════════════════════════════

describe('HomePage', () => {
  it('shows the loading state while auth is loading', () => {
    setAuth({ loading: true })
    render(<HomePage />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('redirects an authenticated user to /dashboard', async () => {
    setAuth({ user: baseUser, loading: false })
    render(<HomePage />)
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/dashboard'))
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders the full marketing page for signed-out visitors', () => {
    render(<HomePage />)
    // Hero
    expect(screen.getByText('Build a world that feels')).toBeInTheDocument()
    expect(screen.getByText('truly yours')).toBeInTheDocument()
    expect(screen.getByText('Custom RPGs, crafted with wonder')).toBeInTheDocument()
    // Feature highlights
    expect(screen.getByText('Create your world')).toBeInTheDocument()
    expect(screen.getByText('Bring stories to life')).toBeInTheDocument()
    expect(screen.getByText('Play with elegance')).toBeInTheDocument()
    // Footer
    expect(screen.getByText('Mythrion — Forge your legend.')).toBeInTheDocument()
  })

  it('renders header navigation links with the right hrefs', () => {
    render(<HomePage />)
    expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute('href', '#features')
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing')
    const signInLinks = screen.getAllByRole('link', { name: 'Sign in' })
    expect(signInLinks.length).toBeGreaterThanOrEqual(1)
    for (const link of signInLinks) {
      expect(link).toHaveAttribute('href', '/login?redirect=/dashboard')
    }
    const privacyLinks = screen.getAllByRole('link', { name: 'Privacy Policy' })
    expect(privacyLinks.length).toBeGreaterThanOrEqual(1)
    for (const link of privacyLinks) {
      expect(link).toHaveAttribute('href', '/privacy')
    }
    const termsLinks = screen.getAllByRole('link', { name: 'Terms of Service' })
    expect(termsLinks.length).toBeGreaterThanOrEqual(1)
    for (const link of termsLinks) {
      expect(link).toHaveAttribute('href', '/terms')
    }
    const cancelTermsLinks = screen.getAllByRole('link', { name: 'Cancellation Terms' })
    expect(cancelTermsLinks.length).toBeGreaterThanOrEqual(1)
    for (const link of cancelTermsLinks) {
      expect(link).toHaveAttribute('href', '/cancel-terms')
    }
  })

  it('renders the language switcher', () => {
    render(<HomePage />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════════════
// TermsPage (app/terms/page.tsx)
// ════════════════════════════════════════════════════════════

describe('TermsPage', () => {
  it('renders the terms content and a home link', () => {
    render(<TermsPage />)
    expect(screen.getAllByText('Terms of Service').length).toBeGreaterThanOrEqual(2)
    expect(
      screen.getByText(
        'By using Mythrion, you agree to these terms, which govern access, subscriptions, and acceptable behavior.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/')
  })
})

// ════════════════════════════════════════════════════════════
// PrivacyPage (app/privacy/page.tsx)
// ════════════════════════════════════════════════════════════

describe('PrivacyPage', () => {
  it('renders the privacy content and a home link', () => {
    render(<PrivacyPage />)
    expect(screen.getAllByText('Privacy Policy').length).toBeGreaterThanOrEqual(2)
    expect(
      screen.getByText(
        'At Mythrion, we respect your privacy and are committed to protecting your personal data.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/')
  })
})

// ════════════════════════════════════════════════════════════
// CancelTermsPage (app/cancel-terms/page.tsx)
// ════════════════════════════════════════════════════════════

describe('CancelTermsPage', () => {
  it('renders the cancellation terms content and a home link', () => {
    render(<CancelTermsPage />)
    expect(screen.getAllByText('Subscription Cancellation Terms').length).toBeGreaterThanOrEqual(2)
    expect(
      screen.getByText(
        'These terms govern the cancellation of your Mythrion Premium subscription. By cancelling, you agree to the conditions below.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Cancellation takes effect at the end of the current billing period. Once your request is processed, no further renewals will be scheduled.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'You will retain full access to Mythrion Premium until the end of your paid billing period, even after requesting cancellation.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'You will not be charged again after cancelling. As you keep access for the remainder of an already-paid period, no refund is issued for that period.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'You can cancel at any time from the Subscription page in your dashboard. To submit the cancellation, you must read these terms and check the acceptance box.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'When your subscription ends, your account returns to the free tier. Your campaigns and character sheets remain available, and features that require a paid plan become limited.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'For questions about these terms, please contact support at portal@mythrion.com.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/')
  })
})

// ════════════════════════════════════════════════════════════
// PricingPage (app/pricing/page.tsx)
// ════════════════════════════════════════════════════════════

const renderPricing = () =>
  render(
    <SubscriptionProvider>
      <PricingPage />
    </SubscriptionProvider>,
  )

describe('PricingPage', () => {
  it('shows the loading state while auth is loading', () => {
    setAuth({ loading: true })
    renderPricing()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders plans fetched from the API', async () => {
    renderPricing()
    expect(await screen.findByText('Plano Mensal (API)')).toBeInTheDocument()
    expect(screen.getByText('Plano Anual (API)')).toBeInTheDocument()
    expect(screen.getByText('Best value')).toBeInTheDocument()
    expect(screen.getByText('Choose your plan')).toBeInTheDocument()
  })

  it('falls back to hardcoded plans when the API fails', async () => {
    mockFetchPlans.mockRejectedValueOnce(new Error('boom'))
    renderPricing()
    expect(await screen.findByText('Plano Mensal')).toBeInTheDocument()
    expect(screen.getByText('Plano Anual')).toBeInTheDocument()
    // Fallback plans are named without the "(API)" marker
    expect(screen.queryByText('Plano Mensal (API)')).not.toBeInTheDocument()
  })

  it('shows the sign-up CTA for signed-out visitors', async () => {
    renderPricing()
    expect(await screen.findByText('Plano Mensal (API)')).toBeInTheDocument()
    const signup = screen.getByRole('link', { name: 'Get Started — Sign up' })
    expect(signup).toHaveAttribute('href', '/login?redirect=/pricing')
    // Header sign-in link
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?redirect=/pricing',
    )
    // Every plan subscribes via the login flow for guests
    const subscribeLinks = screen.getAllByRole('link', { name: 'Subscribe' })
    expect(subscribeLinks).toHaveLength(2)
    for (const link of subscribeLinks) {
      expect(link).toHaveAttribute('href', '/login?redirect=/pricing')
    }
  })

  it('shows the disabled current-plan CTA for a signed-in user without a subscription', async () => {
    setAuth({ user: baseUser, loading: false })
    renderPricing()
    expect(await screen.findByText('Plano Mensal (API)')).toBeInTheDocument()
    // Free tier CTA
    expect(screen.getByRole('button', { name: 'Current Plan' })).toBeDisabled()
    // Paid plan CTAs point to checkout
    const subscribeHrefs = screen
      .getAllByRole('link', { name: 'Subscribe' })
      .map((l) => l.getAttribute('href'))
    expect(subscribeHrefs).toEqual([
      '/subscription/checkout?planId=monthly',
      '/subscription/checkout?planId=annual',
    ])
  })

  it('shows the dashboard CTA and redirects when the user has an active subscription', async () => {
    setAuth({ user: baseUser, loading: false })
    mockFetchMySubscription.mockResolvedValue({ ...subscriptionFixture })
    renderPricing()
    expect(await screen.findByText('Plano Mensal (API)')).toBeInTheDocument()
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/dashboard'))
    // Header + free tier CTA both link to dashboard
    const dashboardLinks = screen.getAllByRole('link', { name: 'Dashboard' })
    expect(dashboardLinks.length).toBeGreaterThanOrEqual(2)
    for (const link of dashboardLinks) {
      expect(link).toHaveAttribute('href', '/dashboard')
    }
    // Subscribed plan shows a disabled current-plan button, the other subscribes
    expect(screen.getByRole('button', { name: 'Current Plan' })).toBeDisabled()
    expect(
      screen.getByRole('link', { name: 'Subscribe' }),
    ).toHaveAttribute('href', '/subscription/checkout?planId=annual')
  })

  it('shows a renew CTA for a cancelled subscription on the subscribed plan', async () => {
    setAuth({ user: baseUser, loading: false })
    mockFetchMySubscription.mockResolvedValue({
      ...subscriptionFixture,
      status: 'CANCELLED',
      hasActiveSubscription: false,
    })
    renderPricing()
    expect(await screen.findByText('Plano Mensal (API)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Renew' })).toHaveAttribute(
      'href',
      '/subscription/checkout?planId=monthly',
    )
    // No redirect to /dashboard for a cancelled subscription
    expect(mockRouterReplace).not.toHaveBeenCalledWith('/dashboard')
  })

  it('redirects unverified users to /verify-email', async () => {
    setAuth({ user: { ...baseUser, emailVerified: false }, loading: false })
    renderPricing()
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/verify-email'))
  })

  it('links the header to the dashboard for signed-in users', async () => {
    setAuth({ user: baseUser, loading: false })
    renderPricing()
    expect(await screen.findByText('Plano Mensal (API)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
  })
})
