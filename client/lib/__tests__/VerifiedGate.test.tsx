import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VerifiedGate } from '@/components/auth/VerifiedGate'

const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

const mockUseAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

describe('VerifiedGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a loading spinner and does not navigate while loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })
    const { container } = render(
      <VerifiedGate>
        <span>protected content</span>
      </VerifiedGate>,
    )
    expect(container.querySelector('.animate-spin')).not.toBeNull()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })

  it('redirects to /login when there is no user', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    render(
      <VerifiedGate>
        <span>protected content</span>
      </VerifiedGate>,
    )
    expect(mockReplace).toHaveBeenCalledWith('/login')
    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })

  it('redirects to /verify-email when the user is not email verified', () => {
    mockUseAuth.mockReturnValue({
      user: { emailVerified: false },
      loading: false,
    })
    render(
      <VerifiedGate>
        <span>protected content</span>
      </VerifiedGate>,
    )
    expect(mockReplace).toHaveBeenCalledWith('/verify-email')
    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })

  it('renders children when the user is email verified', () => {
    mockUseAuth.mockReturnValue({
      user: { emailVerified: true },
      loading: false,
    })
    render(
      <VerifiedGate>
        <span>protected content</span>
      </VerifiedGate>,
    )
    expect(screen.getByText('protected content')).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
