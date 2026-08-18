import { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  getAccessToken: vi.fn(),
  setAccessToken: vi.fn(),
  removeAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  setRefreshToken: vi.fn(),
  removeRefreshToken: vi.fn(),
  getInvitationToken: vi.fn(),
  removeInvitationToken: vi.fn(),
  refreshAccessToken: vi.fn(),
  isAccessTokenExpiringSoon: vi.fn(() => false),
  onAuthFailure: vi.fn(() => () => {}),
}))

// Re-import after mocking so the mock is picked up
const {
  api,
  getAccessToken,
  setAccessToken,
  removeAccessToken,
  getRefreshToken,
  setRefreshToken,
  removeRefreshToken,
  removeInvitationToken,
  refreshAccessToken,
  isAccessTokenExpiringSoon,
  onAuthFailure,
} = await import('@/lib/api')

const { AuthProvider, useAuth } = await import('@/lib/auth-context')

// --------------- Helpers ---------------

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

function TestConsumer() {
  const auth = useAuth()
  return (
    <div>
      <div data-testid="loading">{String(auth.loading)}</div>
      <div data-testid="user">{auth.user?.email ?? 'no-user'}</div>
      <div data-testid="twofactor">{auth.user ? String(auth.user.twoFactorEnabled) : 'no-user'}</div>
      <div data-testid="isAdmin">{auth.user ? String(auth.user.isAdmin) : 'no-user'}</div>
      <div data-testid="isEarlyAccess">{auth.user ? String(auth.user.isEarlyAccess) : 'no-user'}</div>
      <button onClick={() => auth.login('test@test.com', 'pass')}>Login</button>
      <button onClick={() => auth.register('test@test.com', 'pass', 'Test')}>Register</button>
      <button onClick={auth.logout}>Logout</button>
      <button onClick={() => auth.completeOnboarding('Test User')}>Onboard</button>
      <button onClick={() => auth.verifyTwoFactor('ch-1', '123456')}>Verify2FA</button>
      <button onClick={auth.refreshProfile}>RefreshProfile</button>
    </div>
  )
}

function TwoFactorLoginConsumer() {
  const auth = useAuth()
  const [outcome, setOutcome] = useState('')
  return (
    <div>
      <div data-testid="login-outcome">{outcome}</div>
      <button
        onClick={async () => {
          const res = await auth.login('test@test.com', 'pass')
          setOutcome(res.requiresTwoFactor ? `2fa:${res.twoFactorId}:${res.emailMasked}` : 'direct')
        }}
      >
        Login2FA
      </button>
    </div>
  )
}

const mockPermissions = {
  role: 'user',
  earlyAccess: false,
  subscription: { plan: null, status: null, expiresAt: null },
  entitlements: { hasActiveSubscription: false, canUseSubscriptionFeatures: false },
  limits: { maxCampaigns: null, maxTemplates: null },
}

const mockProfile = {
  id: 'user-1',
  email: 'test@test.com',
  displayName: null,
  onboardingComplete: false,
  twoFactorEnabled: false,
  emailVerified: false,
  hasPassword: true,
  language: 'en',
  permissions: mockPermissions,
}

beforeEach(() => {
  vi.clearAllMocks()
})

// --------------- AuthProvider + useAuth ---------------

describe('AuthProvider + useAuth', () => {
  it('provides initial state with user: null, loading: true when token exists', () => {
    vi.mocked(getAccessToken).mockReturnValue('mock-token')
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    // Loading starts true because fetch is async
    expect(screen.getByTestId('loading')).toHaveTextContent('true')
    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
  })

  it('calls api.get(/auth/me) when access token exists', async () => {
    vi.mocked(getAccessToken).mockReturnValue('mock-token')
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/me')
    })
  })

  it('sets user from profile response', async () => {
    vi.mocked(getAccessToken).mockReturnValue('mock-token')
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@test.com')
    })
  })

  it('sets loading to false after fetch', async () => {
    vi.mocked(getAccessToken).mockReturnValue('mock-token')
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })
  })

  it('does not clear tokens on profile fetch error (transient)', async () => {
    vi.mocked(getAccessToken).mockReturnValue('mock-token')
    vi.mocked(api.get).mockRejectedValue(new Error('Network error'))

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    // A network blip is NOT a logout — tokens must survive so the focus
    // listener can retry the restore later.
    await waitFor(() => {
      expect(removeAccessToken).not.toHaveBeenCalled()
      expect(removeRefreshToken).not.toHaveBeenCalled()
    })
  })

  it('restores session via refresh token when only a refresh token exists', async () => {
    vi.mocked(getAccessToken).mockReturnValue(null)
    vi.mocked(getRefreshToken).mockReturnValue('rt-existing')
    vi.mocked(refreshAccessToken).mockResolvedValue('new-at')
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(refreshAccessToken).toHaveBeenCalledTimes(1)
      expect(api.get).toHaveBeenCalledWith('/auth/me')
      expect(screen.getByTestId('user')).toHaveTextContent('test@test.com')
    })
  })

  it('keeps loading true on transient refresh failure (no redirect)', async () => {
    vi.mocked(getAccessToken).mockReturnValue(null)
    vi.mocked(getRefreshToken).mockReturnValue('rt-existing')
    // Transient refresh failure — tokens remain, so the session is not dead.
    vi.mocked(refreshAccessToken).mockResolvedValue(null)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(refreshAccessToken).toHaveBeenCalledTimes(1)
    })

    // Guard-safe: loading stays true and the user stays null so the layout
    // renders the loading state instead of redirecting to /login.
    expect(screen.getByTestId('loading')).toHaveTextContent('true')
    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    expect(removeAccessToken).not.toHaveBeenCalled()
    expect(removeRefreshToken).not.toHaveBeenCalled()
  })

  it('clears the session when onAuthFailure fires (definitive rejection)', async () => {
    vi.mocked(getAccessToken).mockReturnValue('mock-token')
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@test.com')
    })

    // The server definitively rejected the refresh token — the auth layer
    // notifies the provider, which must wipe the session from one place.
    const handler = vi.mocked(onAuthFailure).mock.calls[0][0]
    act(() => {
      handler()
    })

    expect(removeAccessToken).toHaveBeenCalled()
    expect(removeRefreshToken).toHaveBeenCalled()
    expect(removeInvitationToken).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })
  })

  it('proactively refreshes an expiring access token on focus', async () => {
    vi.mocked(getAccessToken).mockReturnValue('mock-token')
    vi.mocked(isAccessTokenExpiringSoon).mockReturnValue(true)
    vi.mocked(refreshAccessToken).mockResolvedValue('new-at')
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/me')
    })

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => {
      expect(refreshAccessToken).toHaveBeenCalledTimes(1)
    })
  })
})

// --------------- useAuth ---------------

describe('useAuth', () => {
  it('throws error when used outside AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function BadComponent() {
      useAuth()
      return null
    }

    expect(() => render(<BadComponent />)).toThrow(
      'useAuth must be used within an AuthProvider',
    )

    consoleSpy.mockRestore()
  })
})

// --------------- login ---------------

describe('login', () => {
  it('calls api.post with /auth/login', async () => {
    vi.mocked(getAccessToken).mockReturnValue(null)
    vi.mocked(api.post).mockResolvedValue({
      accessToken: 'at-login',
      refreshToken: 'rt-login',
    })
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@test.com',
        password: 'pass',
      })
    })
  })

  it('stores access and refresh tokens', async () => {
    vi.mocked(getAccessToken).mockReturnValue(null)
    // Return null from refresh check so loading goes to false quickly
    vi.mocked(getRefreshToken).mockReturnValue(null)
    vi.mocked(api.post).mockResolvedValue({
      accessToken: 'at-login',
      refreshToken: 'rt-login',
    })
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    // Suppress error on invalid state (no token on mount -> loading false, but that's fine)
    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(setAccessToken).toHaveBeenCalledWith('at-login')
      expect(setRefreshToken).toHaveBeenCalledWith('rt-login')
    })
  })

  it('fetches user profile after login', async () => {
    vi.mocked(getAccessToken).mockReturnValue(null)
    vi.mocked(getRefreshToken).mockReturnValue(null)
    vi.mocked(api.post).mockResolvedValue({
      accessToken: 'at-login',
      refreshToken: 'rt-login',
    })
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/me')
    })
  })

  it('sets user state after login', async () => {
    vi.mocked(getAccessToken).mockReturnValue(null)
    vi.mocked(getRefreshToken).mockReturnValue(null)
    vi.mocked(api.post).mockResolvedValue({
      accessToken: 'at-login',
      refreshToken: 'rt-login',
    })
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Login'))

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@test.com')
    })
  })
})

// --------------- register ---------------

describe('register', () => {
  beforeEach(() => {
    vi.mocked(getAccessToken).mockReturnValue(null)
    vi.mocked(getRefreshToken).mockReturnValue(null)
  })

  it('calls api.post with /auth/register', async () => {
    vi.mocked(api.post).mockResolvedValue({
      accessToken: 'at-reg',
      refreshToken: 'rt-reg',
    })
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Register'))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/register', {
        email: 'test@test.com',
        password: 'pass',
        displayName: 'Test',
        acceptTerms: false,
      })
    })
  })

  it('stores tokens after registration', async () => {
    vi.mocked(api.post).mockResolvedValue({
      accessToken: 'at-reg',
      refreshToken: 'rt-reg',
    })
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Register'))

    await waitFor(() => {
      expect(setAccessToken).toHaveBeenCalledWith('at-reg')
      expect(setRefreshToken).toHaveBeenCalledWith('rt-reg')
    })
  })

  it('fetches profile after registration', async () => {
    vi.mocked(api.post).mockResolvedValue({
      accessToken: 'at-reg',
      refreshToken: 'rt-reg',
    })
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Register'))

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/me')
    })
  })
})

// --------------- logout ---------------

describe('logout', () => {
  beforeEach(() => {
    vi.mocked(getAccessToken).mockReturnValue(null)
    vi.mocked(getRefreshToken).mockReturnValue(null)
  })

  it('calls api.post(/auth/logout)', async () => {
    vi.mocked(api.post).mockResolvedValue({})
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Logout'))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/logout')
    })
  })

  it('removes all tokens', async () => {
    vi.mocked(api.post).mockResolvedValue({})
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Logout'))

    await waitFor(() => {
      expect(removeAccessToken).toHaveBeenCalled()
      expect(removeInvitationToken).toHaveBeenCalled()
    })
  })

  it('sets user to null after logout', async () => {
    vi.mocked(api.post).mockResolvedValue({})
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Logout'))

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    })
  })

  it('does not throw on API error', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Logout failed'))
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    // Should not throw
    await userEvent.click(screen.getByText('Logout'))

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    })
  })
})

// --------------- completeOnboarding ---------------

describe('completeOnboarding', () => {
  beforeEach(() => {
    vi.mocked(getAccessToken).mockReturnValue(null)
    vi.mocked(getRefreshToken).mockReturnValue(null)
  })

  it('calls api.post(/auth/onboarding)', async () => {
    vi.mocked(api.post).mockResolvedValue({
      ...mockProfile,
      displayName: 'Test User',
      onboardingComplete: true,
    })
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Onboard'))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/onboarding', {
        displayName: 'Test User',
      })
    })
  })

  it('updates user state', async () => {
    const updatedProfile = {
      ...mockProfile,
      displayName: 'Test User',
      onboardingComplete: true,
    }
    vi.mocked(api.post).mockResolvedValue(updatedProfile)
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Onboard'))

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@test.com')
    })
  })
})

// --------------- login (two-factor) ---------------

describe('login with 2FA', () => {
  beforeEach(() => {
    vi.mocked(getAccessToken).mockReturnValue(null)
    vi.mocked(getRefreshToken).mockReturnValue(null)
  })

  it('returns requiresTwoFactor outcome without storing tokens', async () => {
    vi.mocked(api.post).mockResolvedValue({
      requiresTwoFactor: true,
      twoFactorId: 'ch-1',
      emailMasked: 't***@test.com',
    })

    render(
      <TestWrapper>
        <TwoFactorLoginConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Login2FA'))

    await waitFor(() => {
      expect(screen.getByTestId('login-outcome')).toHaveTextContent('2fa:ch-1:t***@test.com')
    })
    // No tokens were issued by the server, so none may be stored.
    expect(setAccessToken).not.toHaveBeenCalled()
    expect(setRefreshToken).not.toHaveBeenCalled()
    expect(api.get).not.toHaveBeenCalledWith('/auth/me')
  })

  it('stores tokens when 2FA is not required', async () => {
    vi.mocked(api.post).mockResolvedValue({
      accessToken: 'at-login',
      refreshToken: 'rt-login',
    })
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TwoFactorLoginConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Login2FA'))

    await waitFor(() => {
      expect(screen.getByTestId('login-outcome')).toHaveTextContent('direct')
      expect(setAccessToken).toHaveBeenCalledWith('at-login')
      expect(setRefreshToken).toHaveBeenCalledWith('rt-login')
    })
  })
})

// --------------- verifyTwoFactor ---------------

describe('verifyTwoFactor', () => {
  beforeEach(() => {
    vi.mocked(getAccessToken).mockReturnValue(null)
    vi.mocked(getRefreshToken).mockReturnValue(null)
  })

  it('calls api.post with /auth/verify-2fa and the challenge + code', async () => {
    vi.mocked(api.post).mockResolvedValue({ accessToken: 'at-2fa', refreshToken: 'rt-2fa' })
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Verify2FA'))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/verify-2fa', {
        twoFactorId: 'ch-1',
        code: '123456',
      })
    })
  })

  it('stores the tokens issued by the 2FA verification', async () => {
    vi.mocked(api.post).mockResolvedValue({ accessToken: 'at-2fa', refreshToken: 'rt-2fa' })
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Verify2FA'))

    await waitFor(() => {
      expect(setAccessToken).toHaveBeenCalledWith('at-2fa')
      expect(setRefreshToken).toHaveBeenCalledWith('rt-2fa')
    })
  })

  it('fetches the profile after verification', async () => {
    vi.mocked(api.post).mockResolvedValue({ accessToken: 'at-2fa', refreshToken: 'rt-2fa' })
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Verify2FA'))

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/me')
      expect(screen.getByTestId('user')).toHaveTextContent('test@test.com')
    })
  })

  it('propagates the twoFactorEnabled flag into user state', async () => {
    vi.mocked(api.post).mockResolvedValue({ accessToken: 'at-2fa', refreshToken: 'rt-2fa' })
    vi.mocked(api.get).mockResolvedValue({ ...mockProfile, twoFactorEnabled: true })

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('Verify2FA'))

    await waitFor(() => {
      expect(screen.getByTestId('twofactor')).toHaveTextContent('true')
    })
  })
})

// --------------- refreshProfile ---------------

describe('refreshProfile', () => {
  beforeEach(() => {
    vi.mocked(getAccessToken).mockReturnValue(null)
    vi.mocked(getRefreshToken).mockReturnValue(null)
  })

  it('re-fetches the profile from /auth/me', async () => {
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByText('RefreshProfile'))

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/me')
    })
  })

  it('updates the user with the fresh profile', async () => {
    vi.mocked(getAccessToken).mockReturnValue('mock-token')
    vi.mocked(api.get)
      .mockResolvedValueOnce(mockProfile) // mount restore
      .mockResolvedValueOnce({ ...mockProfile, twoFactorEnabled: true }) // refresh

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('twofactor')).toHaveTextContent('false')
    })

    await userEvent.click(screen.getByText('RefreshProfile'))

    await waitFor(() => {
      expect(screen.getByTestId('twofactor')).toHaveTextContent('true')
    })
  })
})

// --------------- permission derivation from /auth/me ---------------

describe('permission derivation (F1)', () => {
  beforeEach(() => {
    vi.mocked(getAccessToken).mockReturnValue('mock-token')
  })

  it('derives isAdmin from permissions.role === admin', async () => {
    vi.mocked(api.get).mockResolvedValue({
      ...mockProfile,
      permissions: { ...mockPermissions, role: 'admin' },
    })

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('isAdmin')).toHaveTextContent('true')
      expect(screen.getByTestId('isEarlyAccess')).toHaveTextContent('false')
    })
  })

  it('derives isEarlyAccess from permissions.earlyAccess', async () => {
    vi.mocked(api.get).mockResolvedValue({
      ...mockProfile,
      permissions: { ...mockPermissions, earlyAccess: true },
    })

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('isEarlyAccess')).toHaveTextContent('true')
      expect(screen.getByTestId('isAdmin')).toHaveTextContent('false')
    })
  })

  it('a plain user defaults both flags to false', async () => {
    vi.mocked(api.get).mockResolvedValue(mockProfile)

    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('isAdmin')).toHaveTextContent('false')
      expect(screen.getByTestId('isEarlyAccess')).toHaveTextContent('false')
    })
  })
})
