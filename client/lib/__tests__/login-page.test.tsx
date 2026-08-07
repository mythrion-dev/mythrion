import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/app/login/page'

const mockLogin = vi.fn()
const mockRegister = vi.fn()
const mockVerifyTwoFactor = vi.fn()

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

  it('renders the sign-in form', () => {
    render(<LoginPage />)
    expect(screen.getByPlaceholderText('adventurer@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('At least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('Enter the realm')).toBeInTheDocument()
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
    await userEvent.click(screen.getByText('Create account'))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('test@test.com', 'password123')
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
})
