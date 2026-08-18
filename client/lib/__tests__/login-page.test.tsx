import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/app/login/page'

const mockLogin = vi.fn()
const mockRegister = vi.fn()
const mockVerifyTwoFactor = vi.fn()
const { mockResendTwoFactorCode } = vi.hoisted(() => ({ mockResendTwoFactorCode: vi.fn() }))

vi.mock('@/lib/two-factor-api', () => ({
  resendTwoFactorCode: mockResendTwoFactorCode,
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: mockLogin,
    register: mockRegister,
    verifyTwoFactor: mockVerifyTwoFactor,
    logout: vi.fn(),
    completeOnboarding: vi.fn(),
    refreshProfile: vi.fn(),
  }),
}))

const mockRouterPush = vi.fn()
const mockRouterReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the sign-in form', () => {
    render(<LoginPage />)
    expect(screen.getByPlaceholderText('adventurer@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('At least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('Enter the realm')).toBeInTheDocument()
  })

  it('renders a go-home link back to the landing page', () => {
    render(<LoginPage />)
    expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/')
  })

  it('switches to the registration form', async () => {
    render(<LoginPage />)
    await userEvent.click(screen.getByText('Create an account'))
    expect(screen.getByText('Create your account')).toBeInTheDocument()
    expect(screen.getByText('Create account')).toBeInTheDocument()
  })

  it('shows the 2FA code step when login requires two-factor', async () => {
    mockLogin.mockResolvedValue({
      requiresTwoFactor: true,
      twoFactorId: 'ch-1',
      emailMasked: 't***@test.com',
    })

    render(<LoginPage />)
    await userEvent.type(screen.getByPlaceholderText('adventurer@example.com'), 'test@test.com')
    await userEvent.type(screen.getByPlaceholderText('At least 8 characters'), 'password123')
    await userEvent.click(screen.getByText('Enter the realm'))

    expect(await screen.findByText('Two-factor authentication')).toBeInTheDocument()
    expect(screen.getByText(/We sent a code to t\*\*\*@test\.com/)).toBeInTheDocument()
  })

  it('completes login through the 2FA code step', async () => {
    mockLogin.mockResolvedValue({
      requiresTwoFactor: true,
      twoFactorId: 'ch-1',
      emailMasked: 't***@test.com',
    })
    mockVerifyTwoFactor.mockResolvedValue(undefined)

    render(<LoginPage />)
    await userEvent.type(screen.getByPlaceholderText('adventurer@example.com'), 'test@test.com')
    await userEvent.type(screen.getByPlaceholderText('At least 8 characters'), 'password123')
    await userEvent.click(screen.getByText('Enter the realm'))

    const input = await screen.findByPlaceholderText('6-digit code')
    await userEvent.type(input, '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() => {
      expect(mockVerifyTwoFactor).toHaveBeenCalledWith('ch-1', '123456')
    })
  })

  it('redirects to /verify-email after registration', async () => {
    mockRegister.mockResolvedValue(undefined)

    render(<LoginPage />)
    await userEvent.click(screen.getByText('Create an account'))
    await userEvent.type(screen.getByPlaceholderText('adventurer@example.com'), 'test@test.com')
    await userEvent.type(screen.getByPlaceholderText('At least 8 characters'), 'password123')
    // Registration is gated on accepting the terms — check the box first.
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByText('Create account'))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('test@test.com', 'password123', undefined, true)
      expect(mockRouterPush).toHaveBeenCalledWith('/verify-email')
    })
  })

  it('redirects straight to the dashboard when 2FA is not required', async () => {
    mockLogin.mockResolvedValue({ requiresTwoFactor: false })

    render(<LoginPage />)
    await userEvent.type(screen.getByPlaceholderText('adventurer@example.com'), 'test@test.com')
    await userEvent.type(screen.getByPlaceholderText('At least 8 characters'), 'password123')
    await userEvent.click(screen.getByText('Enter the realm'))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password123')
    })
  })

  it('redirects to Google OAuth with the current origin as state', async () => {
    vi.stubGlobal('location', { origin: 'http://localhost:3000', href: '' })

    render(<LoginPage />)
    await userEvent.click(screen.getByRole('link', { name: 'Google' }))

    expect(window.location.href).toContain('/auth/google')
    expect(window.location.href).toContain('http%3A%2F%2Flocalhost%3A3000')
  })

  it('resends the two-factor code from the code step', async () => {
    mockResendTwoFactorCode.mockResolvedValue({ twoFactorId: 'ch-2' })
    mockLogin.mockResolvedValue({
      requiresTwoFactor: true,
      twoFactorId: 'ch-1',
      emailMasked: 't***@test.com',
    })

    render(<LoginPage />)
    await userEvent.type(screen.getByPlaceholderText('adventurer@example.com'), 'test@test.com')
    await userEvent.type(screen.getByPlaceholderText('At least 8 characters'), 'password123')
    await userEvent.click(screen.getByText('Enter the realm'))
    await userEvent.click(await screen.findByText('Resend code'))

    await waitFor(() => {
      expect(mockResendTwoFactorCode).toHaveBeenCalledWith('ch-1')
    })
  })

  it('returns to the credentials form from the code step', async () => {
    mockLogin.mockResolvedValue({
      requiresTwoFactor: true,
      twoFactorId: 'ch-1',
      emailMasked: 't***@test.com',
    })

    render(<LoginPage />)
    await userEvent.type(screen.getByPlaceholderText('adventurer@example.com'), 'test@test.com')
    await userEvent.type(screen.getByPlaceholderText('At least 8 characters'), 'password123')
    await userEvent.click(screen.getByText('Enter the realm'))
    await userEvent.click(await screen.findByText('Back to sign in'))

    expect(screen.getByPlaceholderText('adventurer@example.com')).toBeInTheDocument()
  })

  it('opens and closes the forgot-password modal', async () => {
    render(<LoginPage />)
    await userEvent.click(screen.getByText('Forgot password?'))

    expect(screen.getByText('Reset your password')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Reset your password')).not.toBeInTheDocument()
  })

  it('switches back from the registration form to the sign-in form', async () => {
    render(<LoginPage />)
    await userEvent.click(screen.getByText('Create an account'))
    await userEvent.click(screen.getByText('Sign in'))

    expect(screen.getByRole('button', { name: 'Enter the realm' })).toBeInTheDocument()
  })

  it('requires accepting the terms before registering', async () => {
    render(<LoginPage />)
    await userEvent.click(screen.getByText('Create an account'))
    await userEvent.type(screen.getByPlaceholderText('adventurer@example.com'), 'test@test.com')
    await userEvent.type(screen.getByPlaceholderText('At least 8 characters'), 'password123')
    await userEvent.click(screen.getByText('Create account'))

    expect(
      await screen.findByText('You must accept the Privacy Policy and Terms of Service to continue.'),
    ).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('shows an error banner when login fails', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'))

    render(<LoginPage />)
    await userEvent.type(screen.getByPlaceholderText('adventurer@example.com'), 'test@test.com')
    await userEvent.type(screen.getByPlaceholderText('At least 8 characters'), 'password123')
    await userEvent.click(screen.getByText('Enter the realm'))

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
  })
})
