import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VerifyEmailPage from '@/app/verify-email/page'
import { resendVerification, changeEmail } from '@/lib/auth-api'

const mockUseAuth = vi.fn()
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

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/lib/auth-api', () => ({
  resendVerification: vi.fn(),
  changeEmail: vi.fn(),
}))

function unverifiedUser() {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    onboardingComplete: true,
    emailVerified: false,
    isAdmin: false,
  }
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the waiting UI with the user email', () => {
    mockUseAuth.mockReturnValue({
      user: unverifiedUser(),
      loading: false,
      logout: vi.fn(),
      refreshProfile: vi.fn(),
    })

    render(<VerifyEmailPage />)

    expect(screen.getByText('Check your inbox')).toBeInTheDocument()
    expect(screen.getByText(/We've sent a verification email to:/)).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Resend verification email' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Refresh verification status' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change email' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('resends the verification email', async () => {
    vi.mocked(resendVerification).mockResolvedValue({ success: true })
    mockUseAuth.mockReturnValue({
      user: unverifiedUser(),
      loading: false,
      logout: vi.fn(),
      refreshProfile: vi.fn(),
    })

    render(<VerifyEmailPage />)
    await userEvent.click(
      screen.getByRole('button', { name: 'Resend verification email' }),
    )

    await waitFor(() => {
      expect(resendVerification).toHaveBeenCalledWith('alice@example.com')
    })
    expect(
      screen.getByText("We've sent a new verification email."),
    ).toBeInTheDocument()
  })

  it('changes email and refreshes the profile', async () => {
    vi.mocked(changeEmail).mockResolvedValue({ success: true })
    const mockRefreshProfile = vi.fn()
    mockUseAuth.mockReturnValue({
      user: unverifiedUser(),
      loading: false,
      logout: vi.fn(),
      refreshProfile: mockRefreshProfile,
    })

    render(<VerifyEmailPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Change email' }))
    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com')
    await userEvent.click(
      screen.getByRole('button', { name: 'Change email address' }),
    )

    await waitFor(() => {
      expect(changeEmail).toHaveBeenCalledWith('new@example.com')
      expect(mockRefreshProfile).toHaveBeenCalled()
    })
  })

  it('logs out and redirects to /login', async () => {
    const mockLogout = vi.fn()
    mockUseAuth.mockReturnValue({
      user: unverifiedUser(),
      loading: false,
      logout: mockLogout,
      refreshProfile: vi.fn(),
    })

    render(<VerifyEmailPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled()
      expect(mockRouterReplace).toHaveBeenCalledWith('/login')
    })
  })

  it('redirects to /dashboard when already verified', async () => {
    mockUseAuth.mockReturnValue({
      user: { ...unverifiedUser(), emailVerified: true },
      loading: false,
      logout: vi.fn(),
      refreshProfile: vi.fn(),
    })

    render(<VerifyEmailPage />)

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('redirects to /login when unauthenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      logout: vi.fn(),
      refreshProfile: vi.fn(),
    })

    render(<VerifyEmailPage />)

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/login')
    })
  })

  it('redirects to /dashboard when refresh confirms verification', async () => {
    let emailVerified = false
    const mockRefreshProfile = vi.fn(() => {
      emailVerified = true
    })
    mockUseAuth.mockImplementation(() => ({
      user: { ...unverifiedUser(), emailVerified },
      loading: false,
      logout: vi.fn(),
      refreshProfile: mockRefreshProfile,
    }))

    render(<VerifyEmailPage />)
    await userEvent.click(
      screen.getByRole('button', { name: 'Refresh verification status' }),
    )

    await waitFor(() => {
      expect(mockRefreshProfile).toHaveBeenCalled()
      expect(mockRouterReplace).toHaveBeenCalledWith('/dashboard')
    })
  })
})
