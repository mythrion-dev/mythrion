import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

// ── next/link mock ──────────────────────────────────────────────────
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// ── Auth mock ───────────────────────────────────────────────────────
const mockAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuth(),
}))

// ── Subscription context mock ───────────────────────────────────────
const mockUseSubscription = vi.fn()
const mockRefresh = vi.fn()
vi.mock('@/lib/subscription-context', () => ({
  useSubscription: () => mockUseSubscription(),
}))

// ── Subscription API mocks ──────────────────────────────────────────
const mockCancelSubscription = vi.fn()
const mockUpdatePaymentMethod = vi.fn()
vi.mock('@/lib/subscription-api', () => ({
  cancelSubscription: (...args: unknown[]) => mockCancelSubscription(...args),
  updatePaymentMethod: (...args: unknown[]) => mockUpdatePaymentMethod(...args),
}))

import DashboardSubscriptionPage from '@/app/dashboard/subscription/page'

// ── Fixtures ─────────────────────────────────────────────────────────
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

// ── Helpers ─────────────────────────────────────────────────────────
function setAuth(overrides: { user?: typeof baseUser | null } = {}) {
  mockAuth.mockReturnValue({
    user: overrides.user !== undefined ? overrides.user : baseUser,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    completeOnboarding: vi.fn(),
    verifyTwoFactor: vi.fn(),
    refreshProfile: vi.fn(),
  })
}

function setSub(sub: ReturnType<typeof subscription> | null, loading = false) {
  mockUseSubscription.mockReturnValue({
    subscription: sub,
    loading,
    hasActiveSubscription: sub !== null,
    refresh: mockRefresh,
  })
}

function openCardForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Change credit card' }))
}

function fillValidCard() {
  fireEvent.change(screen.getByLabelText('Name on card *'), { target: { value: 'Alice Souza' } })
  fireEvent.change(screen.getByLabelText('CPF *'), { target: { value: '12345678901' } })
  fireEvent.change(screen.getByLabelText('Card number *'), { target: { value: '4111111111111111' } })
  fireEvent.change(screen.getByLabelText('Expiry *'), { target: { value: '1230' } })
  fireEvent.change(screen.getByLabelText('CVV *'), { target: { value: '123' } })
}

function ptDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function ptDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setAuth()
})

afterEach(() => {
  vi.unstubAllEnvs()
  delete (window as unknown as Record<string, unknown>).PagSeguro
  // The SDK loader appends the script to <head> and never removes it, so
  // strip any leftovers to avoid cross-test pollution.
  document.head.querySelectorAll('script[src*="pagseguro"]').forEach((s) => s.remove())
})

describe('DashboardSubscriptionPage', () => {
  it('shows the loading spinner while the subscription loads', () => {
    setSub(null, true)
    const { container } = render(<DashboardSubscriptionPage />)
    expect(container.querySelector('.animate-spin')).toBeTruthy()
    expect(screen.queryByText('Subscription')).not.toBeInTheDocument()
  })

  it('shows the no-subscription empty state with a pricing link', () => {
    setSub(null, false)
    render(<DashboardSubscriptionPage />)
    expect(screen.getByText('No subscription found')).toBeInTheDocument()
    expect(screen.getByText("You don't have an active subscription yet.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Plans' })).toHaveAttribute('href', '/pricing')
  })

  it('renders an active subscription with plan details, actions and empty invoices', () => {
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    expect(screen.getByText('Monthly')).toBeInTheDocument()
    expect(screen.getByText(/120,00/)).toBeInTheDocument()
    expect(screen.getByText(/\/month/)).toBeInTheDocument()
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(2) // badge + details status
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Current period start')).toBeInTheDocument()
    expect(screen.getByText(ptDate('2025-01-01'))).toBeInTheDocument()
    expect(screen.getByText('Current period end')).toBeInTheDocument()
    expect(screen.getByText(ptDate('2025-02-01'))).toBeInTheDocument()
    expect(screen.getByText('Created at')).toBeInTheDocument()
    expect(screen.getByText('No invoices yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change credit card' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel subscription' })).toBeInTheDocument()
  })

  it('falls back to the user email for the subscriber label', () => {
    setAuth({ user: { ...baseUser, displayName: null as unknown as string } })
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
  })

  it('shows an em dash when no subscriber identity is available', () => {
    setAuth({ user: null })
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('updates the payment method without encryption when no public key is configured', async () => {
    mockUpdatePaymentMethod.mockResolvedValue(undefined)
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    openCardForm()
    expect(screen.getByText('New card')).toBeInTheDocument()
    fillValidCard()
    fireEvent.click(screen.getByRole('button', { name: 'Update card' }))
    await waitFor(() => {
      expect(mockUpdatePaymentMethod).toHaveBeenCalledWith(
        'unencrypted_4111111111111111_1230_123',
        'Alice Souza',
        '12345678901',
      )
    })
    expect(await screen.findByText('Card updated successfully!')).toBeInTheDocument()
    expect(screen.queryByText('New card')).not.toBeInTheDocument()
  })

  it('shows validation errors and does not submit invalid card data', async () => {
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    openCardForm()
    fireEvent.click(screen.getByRole('button', { name: 'Update card' }))
    expect(await screen.findByText('Enter the full name of the cardholder.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid CPF (11 digits).')).toBeInTheDocument()
    expect(mockUpdatePaymentMethod).not.toHaveBeenCalled()
    // short name still invalid
    fireEvent.change(screen.getByLabelText('Name on card *'), { target: { value: 'Al' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update card' }))
    expect(await screen.findByText('Enter the full name of the cardholder.')).toBeInTheDocument()
    expect(mockUpdatePaymentMethod).not.toHaveBeenCalled()
  })

  it('validates card fields when encryption is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_PAGBANK_PUBLIC_KEY', 'pk_test_123')
    ;(window as unknown as Record<string, unknown>).PagSeguro = { encryptCard: vi.fn() }
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    openCardForm()
    fireEvent.change(screen.getByLabelText('Name on card *'), { target: { value: 'Alice Souza' } })
    fireEvent.change(screen.getByLabelText('CPF *'), { target: { value: '12345678901' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update card' }))
    expect(await screen.findByText('Invalid CVV.')).toBeInTheDocument()
    expect(mockUpdatePaymentMethod).not.toHaveBeenCalled()
  })

  it('shows an error when updating the payment method fails', async () => {
    mockUpdatePaymentMethod.mockRejectedValue(new Error('card boom'))
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    openCardForm()
    fillValidCard()
    fireEvent.click(screen.getByRole('button', { name: 'Update card' }))
    const errors = await screen.findAllByText('card boom')
    expect(errors.length).toBeGreaterThan(0) // updateError + toast
    expect(screen.getByRole('button', { name: 'Update card' })).toBeInTheDocument()
  })

  it('falls back to the generic message when the update failure is not an Error', async () => {
    mockUpdatePaymentMethod.mockRejectedValue('oops')
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    openCardForm()
    fillValidCard()
    fireEvent.click(screen.getByRole('button', { name: 'Update card' }))
    const errors = await screen.findAllByText('Failed to update card. Please try again.')
    expect(errors.length).toBeGreaterThan(0)
  })

  it('uses the end-of-billing-period fallback in the cancel dialog when period end is missing', () => {
    setSub(subscription('ACTIVE', { currentPeriodEnd: null }))
    render(<DashboardSubscriptionPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    expect(
      screen.getByText(/Your access to Mythrion Premium will remain active until the end of the current billing period/),
    ).toBeInTheDocument()
  })

  it('shows the cancellation terms link and keeps the confirm button disabled until the acceptance box is checked', () => {
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    expect(screen.getByRole('link', { name: 'Read the cancellation terms' })).toHaveAttribute(
      'href',
      '/cancel-terms',
    )
    const confirm = screen.getByRole('button', { name: 'Confirm cancellation' })
    expect(confirm).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('button', { name: 'Confirm cancellation' })).toBeEnabled()
  })

  it('cancels the subscription after confirmation', async () => {
    mockCancelSubscription.mockResolvedValue(undefined)
    mockRefresh.mockResolvedValue(undefined)
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    expect(screen.getByText(/Are you sure you want to cancel/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    await waitFor(() => expect(mockCancelSubscription).toHaveBeenCalled())
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
    expect(screen.queryByText(/Are you sure you want to cancel/)).not.toBeInTheDocument()
  })

  it('shows an error when cancellation fails and keeps the dialog open', async () => {
    mockCancelSubscription.mockRejectedValue(new Error('cancel boom'))
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    expect(await screen.findByText('cancel boom')).toBeInTheDocument()
    expect(screen.getByText(/Are you sure you want to cancel/)).toBeInTheDocument()
  })

  it('closes the card form and keeps the subscription when dismissing', () => {
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    openCardForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('New card')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep subscription' }))
    expect(screen.queryByText(/Are you sure you want to cancel/)).not.toBeInTheDocument()
  })

  it('renders a grace-period subscription with scheduled cancellation details', () => {
    const sub = subscription('GRACE', {
      graceEndsAt: '2025-01-10',
      currentPeriodEnd: '2025-01-20',
      cancelAtPeriodEnd: true,
    })
    setSub(sub)
    render(<DashboardSubscriptionPage />)
    expect(screen.getAllByText('Grace Period').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Grace period ends')).toBeInTheDocument()
    expect(screen.getByText(ptDate('2025-01-10'))).toBeInTheDocument()
    expect(screen.getByText('Cancellation scheduled')).toBeInTheDocument()
    expect(screen.getByText(/Your subscription will expire on/)).toBeInTheDocument()
    expect(screen.getAllByText(ptDate('2025-01-20')).length).toBeGreaterThanOrEqual(1)
    // updatable but not cancellable
    expect(screen.getByRole('button', { name: 'Change credit card' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel subscription' })).not.toBeInTheDocument()
  })

  it('renders a cancelled subscription with cancellation timestamp and no actions', () => {
    setSub(subscription('CANCELLED', { cancelledAt: '2025-01-05' }))
    render(<DashboardSubscriptionPage />)
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Cancelled at')).toBeInTheDocument()
    expect(screen.getByText(ptDateTime('2025-01-05'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change credit card' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel subscription' })).not.toBeInTheDocument()
  })

  it('renders an unknown status with fallback labels', () => {
    setSub(subscription('REFUNDED'))
    render(<DashboardSubscriptionPage />)
    expect(screen.getByText('REFUNDED')).toBeInTheDocument() // badge fallback
    expect(screen.getByText('refunded')).toBeInTheDocument() // details fallback
    expect(screen.queryByRole('button', { name: 'Change credit card' })).not.toBeInTheDocument()
  })

  it('renders paid and pending invoices', () => {
    const sub = subscription('PENDING', {
      invoices: [
        { id: 'inv1', amount: 5000, currency: 'BRL', status: 'paid', paidAt: null, dueDate: null, createdAt: '2025-01-01' },
        { id: 'inv2', amount: 3000, currency: 'BRL', status: 'pending', paidAt: null, dueDate: null, createdAt: '2025-01-02' },
      ],
    })
    setSub(sub)
    render(<DashboardSubscriptionPage />)
    expect(screen.getByText('Recent invoices')).toBeInTheDocument()
    expect(screen.getByText(/50,00/)).toBeInTheDocument()
    expect(screen.getByText(/30,00/)).toBeInTheDocument()
    expect(screen.getByText('Paid')).toBeInTheDocument()
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByRole('button', { name: 'Change credit card' })).not.toBeInTheDocument()
  })

  it('encrypts the card with PagSeguro when a public key is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_PAGBANK_PUBLIC_KEY', 'pk_test_123')
    const mockEncryptCard = vi.fn().mockReturnValue({ hasErrors: false, encryptedCard: 'tok_abc' })
    ;(window as unknown as Record<string, unknown>).PagSeguro = { encryptCard: mockEncryptCard }
    mockUpdatePaymentMethod.mockResolvedValue(undefined)
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    openCardForm()
    fillValidCard()
    fireEvent.click(screen.getByRole('button', { name: 'Update card' }))
    await waitFor(() => {
      expect(mockEncryptCard).toHaveBeenCalledWith({
        publicKey: 'pk_test_123',
        holder: 'Alice Souza',
        number: '4111111111111111',
        expMonth: '12',
        expYear: '2030',
        securityCode: '123',
      })
      expect(mockUpdatePaymentMethod).toHaveBeenCalledWith('tok_abc', 'Alice Souza', '12345678901')
    })
  })

  it('shows an encryption error when the SDK reports invalid data', async () => {
    vi.stubEnv('NEXT_PUBLIC_PAGBANK_PUBLIC_KEY', 'pk_test_123')
    ;(window as unknown as Record<string, unknown>).PagSeguro = {
      encryptCard: vi.fn().mockReturnValue({ hasErrors: true, errors: [{ message: 'Card invalid' }] }),
    }
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    openCardForm()
    fillValidCard()
    fireEvent.click(screen.getByRole('button', { name: 'Update card' }))
    const errors = await screen.findAllByText('Encryption error: Card invalid')
    expect(errors.length).toBeGreaterThan(0)
  })

  it('fails with a not-loaded SDK message when PagSeguro disappears before submit', async () => {
    vi.stubEnv('NEXT_PUBLIC_PAGBANK_PUBLIC_KEY', 'pk_test_123')
    ;(window as unknown as Record<string, unknown>).PagSeguro = { encryptCard: vi.fn() }
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    openCardForm()
    fillValidCard()
    ;(window as unknown as Record<string, unknown>).PagSeguro = undefined
    fireEvent.click(screen.getByRole('button', { name: 'Update card' }))
    const errors = await screen.findAllByText(
      'PagBank encryption SDK not loaded. Please try again.',
    )
    expect(errors.length).toBeGreaterThan(0)
  })

  it('loads the PagSeguro SDK script and enables the card form on load', () => {
    vi.stubEnv('NEXT_PUBLIC_PAGBANK_PUBLIC_KEY', 'pk_test_123')
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    openCardForm()
    const preparing = screen.getByRole('button', { name: 'Preparing...' })
    expect(preparing).toBeDisabled()
    const script = document.head.querySelector('script[src*="pagseguro"]')
    expect(script).toBeTruthy()
    act(() => {
      ;(script as HTMLScriptElement & { onload: (() => void) | null }).onload?.()
    })
    expect(screen.getByRole('button', { name: 'Update card' })).toBeEnabled()
  })

  it('proceeds when the PagSeguro SDK fails to load', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('NEXT_PUBLIC_PAGBANK_PUBLIC_KEY', 'pk_test_123')
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    openCardForm()
    const script = document.head.querySelector('script[src*="pagseguro"]')!
    act(() => {
      ;(script as HTMLScriptElement & { onerror: ((ev: Event) => void) | null }).onerror?.(
        new Event('error'),
      )
    })
    expect(screen.getByRole('button', { name: 'Update card' })).toBeEnabled()
    expect(consoleSpy).toHaveBeenCalledWith('[dashboard] Failed to load PagSeguro encryption SDK')
    consoleSpy.mockRestore()
  })

  it('formats CPF, card number and expiry as the user types', () => {
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    openCardForm()
    const cpf = screen.getByLabelText('CPF *') as HTMLInputElement
    fireEvent.change(cpf, { target: { value: '1' } })
    expect(cpf.value).toBe('1')
    fireEvent.change(cpf, { target: { value: '1234' } })
    expect(cpf.value).toBe('123.4')
    fireEvent.change(cpf, { target: { value: '12345678' } })
    expect(cpf.value).toBe('123.456.78')
    fireEvent.change(cpf, { target: { value: '12345678901' } })
    expect(cpf.value).toBe('123.456.789-01')

    const card = screen.getByLabelText('Card number *') as HTMLInputElement
    fireEvent.change(card, { target: { value: '4111111111111111' } })
    expect(card.value).toBe('4111 1111 1111 1111')

    const expiry = screen.getByLabelText('Expiry *') as HTMLInputElement
    fireEvent.change(expiry, { target: { value: '1' } })
    expect(expiry.value).toBe('1')
    fireEvent.change(expiry, { target: { value: '123' } })
    expect(expiry.value).toBe('12/3')
  })

  it('dismisses the success toast via the close button', async () => {
    mockUpdatePaymentMethod.mockResolvedValue(undefined)
    setSub(subscription('ACTIVE'))
    render(<DashboardSubscriptionPage />)
    openCardForm()
    fillValidCard()
    fireEvent.click(screen.getByRole('button', { name: 'Update card' }))
    expect(await screen.findByText('Card updated successfully!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close notification' }))
    expect(screen.queryByText('Card updated successfully!')).not.toBeInTheDocument()
  })
})
