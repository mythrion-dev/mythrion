import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VerificationBanner } from '../VerificationBanner'

const mockUseAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/lib/auth-api', () => ({
  resendVerification: vi.fn(),
}))

const { resendVerification } = await import('@/lib/auth-api')

const mockRefreshProfile = vi.fn()

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = []
  name: string
  onmessage: ((ev: MessageEvent) => void) | null = null

  constructor(name: string) {
    this.name = name
    FakeBroadcastChannel.instances.push(this)
  }
  close() {}
  postMessage() {}
}

function mockAuth(emailVerified: boolean | null) {
  mockUseAuth.mockReturnValue({
    user: { id: 'u1', email: 'a@b.com', emailVerified },
    loading: false,
    refreshProfile: mockRefreshProfile,
  })
}

describe('VerificationBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    FakeBroadcastChannel.instances = []
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing when the email is already verified', () => {
    mockAuth(true)
    const { container } = render(<VerificationBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when there is no user', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, refreshProfile: mockRefreshProfile })
    const { container } = render(<VerificationBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the banner with resend action when the email is unverified', () => {
    mockAuth(false)
    render(<VerificationBanner />)
    expect(screen.getByText('Verify your email')).toBeInTheDocument()
    expect(
      screen.getByText('Verify your email to unlock all features of your account.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Resend verification email' }),
    ).toBeInTheDocument()
  })

  it('resends the verification email and confirms the send', async () => {
    mockAuth(false)
    vi.mocked(resendVerification).mockResolvedValue({ success: true })
    render(<VerificationBanner />)

    await userEvent.click(screen.getByRole('button', { name: 'Resend verification email' }))

    await waitFor(() => {
      expect(resendVerification).toHaveBeenCalledWith('a@b.com')
      expect(screen.getByText("We've sent a new verification email.")).toBeInTheDocument()
    })
  })

  it('refetches the profile when the tab regains focus while unverified', () => {
    mockAuth(false)
    render(<VerificationBanner />)

    window.dispatchEvent(new Event('focus'))

    expect(mockRefreshProfile).toHaveBeenCalled()
  })

  it('does not refetch on focus when the email is already verified', () => {
    mockAuth(true)
    render(<VerificationBanner />)

    window.dispatchEvent(new Event('focus'))

    expect(mockRefreshProfile).not.toHaveBeenCalled()
  })

  it('hides without a refresh when verification completes in another tab', () => {
    mockAuth(false)
    const { rerender } = render(<VerificationBanner />)

    expect(FakeBroadcastChannel.instances).toHaveLength(1)
    const channel = FakeBroadcastChannel.instances[0]
    expect(channel.name).toBe('mythrion:email-verified')
    expect(mockRefreshProfile).not.toHaveBeenCalled()

    channel.onmessage?.(new MessageEvent('message'))

    expect(mockRefreshProfile).toHaveBeenCalled()

    // After the refetched profile reports verified, the banner disappears.
    mockAuth(true)
    rerender(<VerificationBanner />)
    expect(screen.queryByText('Verify your email')).not.toBeInTheDocument()
  })
})
