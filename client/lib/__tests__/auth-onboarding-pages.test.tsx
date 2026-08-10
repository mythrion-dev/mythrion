import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// ════════════════════════════════════════════════════════════
// Next/Navigation mocks (override the global setup so search
// params, params and router can be driven per-test)
// ════════════════════════════════════════════════════════════

const mockUsePathname = vi.fn()
const mockUseSearchParams = vi.fn()
const mockUseParams = vi.fn()
const mockRouterPush = vi.fn()
const mockRouterReplace = vi.fn()
const mockRouterBack = vi.fn()
const mockRouterForward = vi.fn()
const mockRouterRefresh = vi.fn()
const mockRouterPrefetch = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: mockRouterBack,
    forward: mockRouterForward,
    refresh: mockRouterRefresh,
    prefetch: mockRouterPrefetch,
  }),
  useSearchParams: () => mockUseSearchParams(),
  useParams: () => mockUseParams(),
  usePathname: () => mockUsePathname(),
}))

// ── Next/Link mock ──

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    onClick,
    ...rest
  }: {
    children: React.ReactNode
    href: string
    onClick?: React.MouseEventHandler
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}))

// ── Auth mock ──

const mockAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuth(),
}))

// ── API mock ──

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  setAccessToken: vi.fn(),
  setRefreshToken: vi.fn(),
  getInvitationToken: vi.fn(),
  setInvitationToken: vi.fn(),
  removeInvitationToken: vi.fn(),
}))

// ── Auth-API mock ──

vi.mock('@/lib/auth-api', () => ({
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
  resetPassword: vi.fn(),
  changeEmail: vi.fn(),
  forgotPassword: vi.fn(),
  changePassword: vi.fn(),
}))

import {
  api,
  setAccessToken,
  setRefreshToken,
  getInvitationToken,
  setInvitationToken,
  removeInvitationToken,
} from '@/lib/api'
import { verifyEmail, resendVerification, resetPassword } from '@/lib/auth-api'

const mockApiGet = vi.mocked(api.get)
const mockApiPost = vi.mocked(api.post)
const mockSetAccessToken = vi.mocked(setAccessToken)
const mockSetRefreshToken = vi.mocked(setRefreshToken)
const mockGetInvitationToken = vi.mocked(getInvitationToken)
const mockSetInvitationToken = vi.mocked(setInvitationToken)
const mockRemoveInvitationToken = vi.mocked(removeInvitationToken)

const mockVerifyEmail = vi.mocked(verifyEmail)
const mockResendVerification = vi.mocked(resendVerification)
const mockResetPassword = vi.mocked(resetPassword)

// ── Target pages ──

import OnboardingPage from '@/app/onboarding/page'
import VerifyEmailPage from '@/app/auth/verify-email/page'
import ResetPasswordPage from '@/app/auth/reset-password/page'
import GoogleCallbackPage from '@/app/auth/google/callback/page'
import InvitePage from '@/app/invite/[token]/page'

// ════════════════════════════════════════════════════════════
// Browser globals
// ════════════════════════════════════════════════════════════

// Note: google/callback calls window.location.replace(...) to navigate. jsdom
// does not implement navigation — the real call emits a "not implemented"
// virtual-console error but does not throw, so tests still pass. The property
// is non-configurable, so it cannot be stubbed; assertions rely on the mocked
// API side effects instead.

// verify-email posts to a BroadcastChannel; jsdom may not implement it.
class BroadcastChannelStub {
  name: string
  onmessage: unknown = null
  onmessageerror: unknown = null
  constructor(name: string) {
    this.name = name
  }
  postMessage() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return false
  }
}

// ════════════════════════════════════════════════════════════
// Auth helper
// ════════════════════════════════════════════════════════════

const baseUser = {
  id: 'user-1',
  email: 'alice@example.com',
  displayName: 'Alice Johnson',
  onboardingComplete: false,
  isAdmin: false,
  isEarlyAccess: false,
  language: 'en',
  twoFactorEnabled: false,
  emailVerified: true,
  hasPassword: true,
}

function setAuth(overrides: { user?: typeof baseUser | null; loading?: boolean } = {}) {
  const auth = {
    user: overrides.user !== undefined ? overrides.user : null,
    loading: overrides.loading !== undefined ? overrides.loading : false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    completeOnboarding: vi.fn().mockResolvedValue(undefined),
    verifyTwoFactor: vi.fn(),
    refreshProfile: vi.fn(),
  }
  mockAuth.mockReturnValue(auth)
  return auth
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('BroadcastChannel', BroadcastChannelStub)
  mockUsePathname.mockReturnValue('/')
  mockUseSearchParams.mockReturnValue(new URLSearchParams())
  mockUseParams.mockReturnValue({ token: 'tok123' })
  mockApiGet.mockResolvedValue({})
  mockApiPost.mockResolvedValue({})
  mockVerifyEmail.mockResolvedValue({ success: true })
  mockResendVerification.mockResolvedValue({ success: true })
  mockResetPassword.mockResolvedValue({ success: true })
  mockGetInvitationToken.mockReturnValue(null)
  setAuth()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ════════════════════════════════════════════════════════════
// OnboardingPage (app/onboarding/page.tsx)
// ════════════════════════════════════════════════════════════

describe('OnboardingPage', () => {
  it('shows the loading state while auth is loading', () => {
    setAuth({ user: baseUser, loading: true })
    render(<OnboardingPage />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('redirects an unverified user to /verify-email', () => {
    setAuth({ user: { ...baseUser, emailVerified: false }, loading: false })
    render(<OnboardingPage />)
    expect(mockRouterReplace).toHaveBeenCalledWith('/verify-email')
  })

  it('redirects a user with completed onboarding to /dashboard', () => {
    setAuth({ user: { ...baseUser, onboardingComplete: true }, loading: false })
    render(<OnboardingPage />)
    expect(mockRouterReplace).toHaveBeenCalledWith('/dashboard')
  })

  it('redirects a signed-out user to /login', () => {
    setAuth({ user: null, loading: false })
    render(<OnboardingPage />)
    expect(mockRouterReplace).toHaveBeenCalledWith('/login')
  })

  it('renders the onboarding form for an eligible user', () => {
    setAuth({ user: baseUser, loading: false })
    render(<OnboardingPage />)
    expect(screen.getByText('Welcome to Mythrion')).toBeInTheDocument()
    expect(
      screen.getByText('Before we begin, what should we call you in the realm?'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Display Name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Arin the Bold')).toBeInTheDocument()
    expect(screen.getByText('This name will be visible to other adventurers.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Begin your journey' })).toBeDisabled()
  })

  it('enables the submit button once a display name is typed', () => {
    setAuth({ user: baseUser, loading: false })
    render(<OnboardingPage />)
    const input = screen.getByLabelText('Display Name')
    fireEvent.change(input, { target: { value: '   Arin   ' } })
    expect(screen.getByRole('button', { name: 'Begin your journey' })).not.toBeDisabled()
  })

  it('submits the trimmed display name and navigates to the dashboard', async () => {
    const auth = setAuth({ user: baseUser, loading: false })
    render(<OnboardingPage />)
    fireEvent.change(screen.getByLabelText('Display Name'), {
      target: { value: '  Arin the Bold  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Begin your journey' }))
    await waitFor(() => expect(auth.completeOnboarding).toHaveBeenCalledWith('Arin the Bold'))
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard'))
  })

  it('shows the enrolling state while submitting', async () => {
    const auth = setAuth({ user: baseUser, loading: false })
    let resolveFn: () => void = () => {}
    auth.completeOnboarding.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveFn = resolve
      }),
    )
    render(<OnboardingPage />)
    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Arin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Begin your journey' }))
    expect(await screen.findByText('Enrolling...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enrolling...' })).toBeDisabled()
    await act(async () => {
      resolveFn()
    })
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard'))
  })

  it('shows an error message when onboarding fails', async () => {
    const auth = setAuth({ user: baseUser, loading: false })
    auth.completeOnboarding.mockRejectedValueOnce(new Error('Boom'))
    render(<OnboardingPage />)
    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Arin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Begin your journey' }))
    expect(await screen.findByText('Boom')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Begin your journey' })).not.toBeDisabled()
  })

  it('falls back to a generic message for non-Error failures', async () => {
    const auth = setAuth({ user: baseUser, loading: false })
    auth.completeOnboarding.mockRejectedValueOnce('oops')
    render(<OnboardingPage />)
    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Arin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Begin your journey' }))
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════════════
// VerifyEmailPage (app/auth/verify-email/page.tsx)
// ════════════════════════════════════════════════════════════

describe('VerifyEmailPage', () => {
  it('shows the verifying state while verification is pending', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('token=abc123'))
    mockVerifyEmail.mockReturnValue(new Promise(() => {}))
    render(<VerifyEmailPage />)
    expect(await screen.findByText('Verifying your email...')).toBeInTheDocument()
  })

  it('marks the email verified when verification succeeds', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('token=abc123'))
    setAuth({ user: baseUser, loading: false })
    render(<VerifyEmailPage />)
    expect(await screen.findByText('Email verified')).toBeInTheDocument()
    expect(
      screen.getByText('Your email has been verified successfully.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue to Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    )
    await waitFor(() => expect(mockVerifyEmail).toHaveBeenCalledWith('abc123'))
  })

  it('links to sign-in when verification succeeds for a signed-out user', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('token=abc123'))
    setAuth({ user: null, loading: false })
    render(<VerifyEmailPage />)
    expect(await screen.findByText('Email verified')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue to sign in' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('handles a BroadcastChannel that is unavailable', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('token=abc123'))
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        constructor() {
          throw new Error('unavailable')
        }
      },
    )
    render(<VerifyEmailPage />)
    expect(await screen.findByText('Email verified')).toBeInTheDocument()
  })

  it('marks the link invalid when there is no token', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
    render(<VerifyEmailPage />)
    expect(await screen.findByText('Invalid or expired verification link')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This verification link is invalid or has expired. Resend the verification email to continue.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('marks the link invalid when verification fails', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('token=bad'))
    mockVerifyEmail.mockRejectedValueOnce(new Error('invalid'))
    render(<VerifyEmailPage />)
    expect(await screen.findByText('Invalid or expired verification link')).toBeInTheDocument()
  })

  it('resends a verification email', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
    render(<VerifyEmailPage />)
    await screen.findByText('Invalid or expired verification link')
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'alice@example.com' },
    })
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
    await waitFor(() =>
      expect(mockResendVerification).toHaveBeenCalledWith('alice@example.com'),
    )
    expect(screen.getByText("We've sent a new verification email.")).toBeInTheDocument()
  })

  it('shows an error when resending fails', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
    mockResendVerification.mockRejectedValueOnce(new Error('Resend boom'))
    render(<VerifyEmailPage />)
    await screen.findByText('Invalid or expired verification link')
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'alice@example.com' },
    })
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
    expect(await screen.findByText('Resend boom')).toBeInTheDocument()
  })

  it('falls back to a generic message for non-Error resend failures', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
    mockResendVerification.mockRejectedValueOnce('oops')
    render(<VerifyEmailPage />)
    await screen.findByText('Invalid or expired verification link')
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'alice@example.com' },
    })
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════════════
// ResetPasswordPage (app/auth/reset-password/page.tsx)
// ════════════════════════════════════════════════════════════

describe('ResetPasswordPage', () => {
  it('shows the invalid link state when no token is present', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
    render(<ResetPasswordPage />)
    expect(screen.getByText('Invalid or expired link')).toBeInTheDocument()
    expect(
      screen.getByText('This link is invalid or has expired. Request a new reset link.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('renders the reset form when a token is present', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('token=reset123'))
    render(<ResetPasswordPage />)
    expect(screen.getByText('Reset your password')).toBeInTheDocument()
    expect(screen.getByText('Choose a new password for your account.')).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update password' })).toBeInTheDocument()
  })

  it('rejects a weak password', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('token=reset123'))
    render(<ResetPasswordPage />)
    const newPw = screen.getByLabelText('New password')
    const confirmPw = screen.getByLabelText('Confirm password')
    fireEvent.change(newPw, { target: { value: 'abcdefgh' } })
    fireEvent.change(confirmPw, { target: { value: 'abcdefgh' } })
    fireEvent.submit(newPw.closest('form')!)
    expect(
      await screen.findByText("This password doesn't meet the security requirements."),
    ).toBeInTheDocument()
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('rejects mismatched passwords', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('token=reset123'))
    render(<ResetPasswordPage />)
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'StrongPass1!' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'Different1!' },
    })
    fireEvent.submit(screen.getByLabelText('New password').closest('form')!)
    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument()
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('submits a strong password and shows success', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('token=reset123'))
    render(<ResetPasswordPage />)
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'StrongPass1!' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'StrongPass1!' },
    })
    fireEvent.submit(screen.getByLabelText('New password').closest('form')!)
    await waitFor(() =>
      expect(mockResetPassword).toHaveBeenCalledWith('reset123', 'StrongPass1!'),
    )
    expect(await screen.findByText('Password reset')).toBeInTheDocument()
    expect(
      screen.getByText('Your password has been reset. You can now sign in with your new password.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue to sign in' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('shows the invalid state when the reset request fails', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('token=reset123'))
    mockResetPassword.mockRejectedValueOnce(new Error('boom'))
    render(<ResetPasswordPage />)
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'StrongPass1!' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'StrongPass1!' },
    })
    fireEvent.submit(screen.getByLabelText('New password').closest('form')!)
    expect(await screen.findByText('Invalid or expired link')).toBeInTheDocument()
  })

  it('shows the submitting state while the reset is in flight', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('token=reset123'))
    mockResetPassword.mockReturnValue(new Promise(() => {}))
    render(<ResetPasswordPage />)
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'StrongPass1!' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'StrongPass1!' },
    })
    fireEvent.submit(screen.getByLabelText('New password').closest('form')!)
    expect(await screen.findByText('Please wait...')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════════════
// GoogleCallbackPage (app/auth/google/callback/page.tsx)
// ════════════════════════════════════════════════════════════

describe('GoogleCallbackPage', () => {
  it('stores tokens and attempts the dashboard redirect', async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams({ token: 'at', refreshToken: 'rt' }),
    )
    render(<GoogleCallbackPage />)
    await waitFor(() => expect(mockSetAccessToken).toHaveBeenCalledWith('at'))
    expect(mockSetRefreshToken).toHaveBeenCalledWith('rt')
    // No pending invite → the code path falls through to the /dashboard
    // window.location.replace (real jsdom navigation is not implemented, so we
    // assert that the invite branch was skipped and no router fallback ran).
    expect(mockGetInvitationToken).toHaveBeenCalled()
    expect(mockRouterReplace).not.toHaveBeenCalled()
    expect(screen.getByText('Signing in with Google...')).toBeInTheDocument()
  })

  it('reads the pending invite and skips the dashboard redirect', async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams({ token: 'at', refreshToken: 'rt' }),
    )
    mockGetInvitationToken.mockReturnValue('inv-token')
    render(<GoogleCallbackPage />)
    await waitFor(() => expect(mockGetInvitationToken).toHaveBeenCalled())
    // With a pending invite the component navigates to /invite/inv-token and
    // returns early — the router fallback must not fire.
    expect(mockSetAccessToken).toHaveBeenCalledWith('at')
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })

  it('redirects to login when tokens are missing', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
    render(<GoogleCallbackPage />)
    expect(mockRouterReplace).toHaveBeenCalledWith('/login?error=google_auth_failed')
    expect(mockSetAccessToken).not.toHaveBeenCalled()
    expect(screen.getByText('Signing in with Google...')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════════════
// InvitePage (app/invite/[token]/page.tsx)
// ════════════════════════════════════════════════════════════

const pendingInvitation = {
  campaignName: 'The Lost Mine',
  campaign: 'Phandelver',
  synopsis: 'A classic adventure.',
  role: 'Player',
  status: 'PENDING',
  invitedBy: 'Alice',
  expiresAt: '2026-12-31',
  isValid: true,
}

describe('InvitePage', () => {
  it('shows the loading state while the invitation is being fetched', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    setAuth({ user: baseUser, loading: false })
    render(<InvitePage />)
    expect(screen.getByText('Loading invitation...')).toBeInTheDocument()
  })

  it('shows the loading state while auth is loading', () => {
    // Never-resolving fetch: authLoading short-circuits the fetch branch, but
    // leaving the promise pending avoids an out-of-act state update after the
    // test ends (the resolved invitation would trigger setLoading(false)).
    mockApiGet.mockReturnValue(new Promise(() => {}))
    setAuth({ user: baseUser, loading: true })
    render(<InvitePage />)
    expect(screen.getByText('Loading invitation...')).toBeInTheDocument()
  })

  it('shows an invalid invitation when the fetch fails', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Fetch boom'))
    setAuth({ user: baseUser, loading: false })
    render(<InvitePage />)
    expect(await screen.findByText('Invalid Invitation')).toBeInTheDocument()
    expect(screen.getByText('Fetch boom')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/')
  })

  it('falls back to a generic message when the fetch fails with a non-Error', async () => {
    mockApiGet.mockRejectedValueOnce('oops')
    setAuth({ user: baseUser, loading: false })
    render(<InvitePage />)
    expect(await screen.findByText('Failed to load invitation')).toBeInTheDocument()
  })

  it('shows the generic invalid message when no invitation is returned', async () => {
    mockApiGet.mockResolvedValueOnce(null as never)
    setAuth({ user: baseUser, loading: false })
    render(<InvitePage />)
    expect(await screen.findByText('Invalid Invitation')).toBeInTheDocument()
    expect(
      screen.getByText('This invitation link is invalid or has expired.'),
    ).toBeInTheDocument()
  })

  it('renders a pending invitation with an accept button', async () => {
    mockApiGet.mockResolvedValue(pendingInvitation)
    setAuth({ user: baseUser, loading: false })
    render(<InvitePage />)
    expect(await screen.findByText('The Lost Mine')).toBeInTheDocument()
    expect(screen.getByText('Invitation')).toBeInTheDocument()
    expect(screen.getByText('Phandelver')).toBeInTheDocument()
    expect(screen.getByText('A classic adventure.')).toBeInTheDocument()
    expect(screen.getByText('Invited by')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Role')).toBeInTheDocument()
    expect(screen.getByText('Expires')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept Invitation' })).toBeInTheDocument()
  })

  it('renders without optional campaign/synopsis/expiresAt', async () => {
    mockApiGet.mockResolvedValue({
      campaignName: 'Solo',
      role: 'Player',
      status: 'PENDING',
      invitedBy: 'GM',
      isValid: true,
    })
    setAuth({ user: baseUser, loading: false })
    render(<InvitePage />)
    expect(await screen.findByText('Solo')).toBeInTheDocument()
    expect(screen.queryByText('Expires')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept Invitation' })).toBeInTheDocument()
  })

  it('renders expired/revoked/accepted statuses without an accept button', async () => {
    const badges: Record<string, string> = {
      EXPIRED: 'Expired',
      REVOKED: 'Revoked',
      ACCEPTED: 'Accepted',
    }
    for (const status of ['EXPIRED', 'REVOKED', 'ACCEPTED']) {
      mockApiGet.mockResolvedValue({ ...pendingInvitation, status })
      setAuth({ user: baseUser, loading: false })
      const { unmount } = render(<InvitePage />)
      expect(await screen.findByText(badges[status])).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Accept Invitation' })).not.toBeInTheDocument()
      expect(screen.getByText('This invitation is no longer valid.')).toBeInTheDocument()
      unmount()
    }
  })

  it('stores the token and sends a signed-out user to login', async () => {
    mockApiGet.mockResolvedValue(pendingInvitation)
    setAuth({ user: null, loading: false })
    render(<InvitePage />)
    await screen.findByText('The Lost Mine')
    fireEvent.click(screen.getByRole('button', { name: 'Accept Invitation' }))
    expect(mockSetInvitationToken).toHaveBeenCalledWith('tok123')
    expect(mockRouterPush).toHaveBeenCalledWith('/login?redirect=/invite/tok123')
  })

  it('shows the accepting state while the request is in flight', async () => {
    mockApiGet.mockResolvedValue(pendingInvitation)
    mockApiPost.mockReturnValue(new Promise(() => {}))
    setAuth({ user: baseUser, loading: false })
    render(<InvitePage />)
    await screen.findByText('The Lost Mine')
    fireEvent.click(screen.getByRole('button', { name: 'Accept Invitation' }))
    expect(await screen.findByText('Accepting...')).toBeInTheDocument()
  })

  it('accepts an invitation as a signed-in user and redirects', async () => {
    mockApiGet.mockResolvedValue(pendingInvitation)
    mockApiPost.mockResolvedValue({
      alreadyMember: false,
      adventureId: 'adv-9',
      adventureName: 'A',
      role: 'Player',
    })
    setAuth({ user: baseUser, loading: false })
    render(<InvitePage />)
    await screen.findByText('The Lost Mine')
    fireEvent.click(screen.getByRole('button', { name: 'Accept Invitation' }))
    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/invitations/tok123/accept'),
    )
    expect(mockRemoveInvitationToken).toHaveBeenCalled()
    expect(
      await screen.findByText('Welcome aboard! Redirecting to the campaign...'),
    ).toBeInTheDocument()
    await waitFor(
      () => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/adventures/adv-9'),
      { timeout: 3000 },
    )
  })

  it('shows already-member state when acceptance reports alreadyMember', async () => {
    mockApiGet.mockResolvedValue(pendingInvitation)
    mockApiPost.mockResolvedValue({
      alreadyMember: true,
      adventureId: 'adv-9',
      adventureName: 'A',
      role: 'Player',
    })
    setAuth({ user: baseUser, loading: false })
    render(<InvitePage />)
    await screen.findByText('The Lost Mine')
    fireEvent.click(screen.getByRole('button', { name: 'Accept Invitation' }))
    expect(
      await screen.findByText('You are already a member of this campaign. Redirecting...'),
    ).toBeInTheDocument()
  })

  it('shows an error when accepting fails', async () => {
    mockApiGet.mockResolvedValue(pendingInvitation)
    mockApiPost.mockRejectedValueOnce(new Error('Accept boom'))
    setAuth({ user: baseUser, loading: false })
    render(<InvitePage />)
    await screen.findByText('The Lost Mine')
    fireEvent.click(screen.getByRole('button', { name: 'Accept Invitation' }))
    // The error state replaces the pending view with the invalid screen.
    expect(await screen.findByText('Accept boom')).toBeInTheDocument()
    expect(screen.getByText('Invalid Invitation')).toBeInTheDocument()
  })

  it('falls back to a generic message when accepting fails with a non-Error', async () => {
    mockApiGet.mockResolvedValue(pendingInvitation)
    mockApiPost.mockRejectedValueOnce('oops')
    setAuth({ user: baseUser, loading: false })
    render(<InvitePage />)
    await screen.findByText('The Lost Mine')
    fireEvent.click(screen.getByRole('button', { name: 'Accept Invitation' }))
    expect(await screen.findByText('Failed to accept invitation')).toBeInTheDocument()
  })

  it('shows the joining state during auto-accept', async () => {
    mockApiGet.mockResolvedValue(pendingInvitation)
    mockApiPost.mockReturnValue(new Promise(() => {}))
    mockGetInvitationToken.mockReturnValue('tok123')
    setAuth({ user: baseUser, loading: false })
    render(<InvitePage />)
    expect(await screen.findByText('Joining the campaign...')).toBeInTheDocument()
  })

  it('auto-accepts a pending invitation after OAuth login', async () => {
    mockApiGet.mockResolvedValue(pendingInvitation)
    mockApiPost.mockResolvedValue({
      alreadyMember: false,
      adventureId: 'adv-9',
      adventureName: 'A',
      role: 'Player',
    })
    mockGetInvitationToken.mockReturnValue('tok123')
    setAuth({ user: baseUser, loading: false })
    render(<InvitePage />)
    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/invitations/tok123/accept'),
    )
    expect(mockRemoveInvitationToken).toHaveBeenCalled()
    expect(
      await screen.findByText('Welcome aboard! Redirecting to the campaign...'),
    ).toBeInTheDocument()
    await waitFor(
      () => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/adventures/adv-9'),
      { timeout: 3000 },
    )
  })

  it('auto-accept reports an already-member result', async () => {
    mockApiGet.mockResolvedValue(pendingInvitation)
    mockApiPost.mockResolvedValue({
      alreadyMember: true,
      adventureId: 'adv-9',
      adventureName: 'A',
      role: 'Player',
    })
    mockGetInvitationToken.mockReturnValue('tok123')
    setAuth({ user: baseUser, loading: false })
    render(<InvitePage />)
    expect(
      await screen.findByText('You are already a member of this campaign. Redirecting...'),
    ).toBeInTheDocument()
  })

  it('shows an error when auto-accept fails', async () => {
    mockApiGet.mockResolvedValue(pendingInvitation)
    // Reject the accept call AND flip the stored token to null so the
    // auto-accept effect (which re-runs after `autoAccepted` resets to
    // false) stops retrying instead of looping forever.
    mockApiPost.mockImplementation(() => {
      mockGetInvitationToken.mockReturnValue(null)
      return Promise.reject(new Error('Auto boom'))
    })
    mockGetInvitationToken.mockReturnValue('tok123')
    setAuth({ user: baseUser, loading: false })
    render(<InvitePage />)
    expect(await screen.findByText('Auto boom')).toBeInTheDocument()
    expect(screen.getByText('Invalid Invitation')).toBeInTheDocument()
  })
})
