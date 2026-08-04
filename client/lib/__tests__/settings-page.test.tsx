import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import SettingsPage from '@/app/dashboard/settings/page'

const mockUseAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/lib/two-factor-api', () => ({
  sendTwoFactorCode: vi.fn(),
  confirmTwoFactor: vi.fn(),
}))

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the settings header and the security card', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'u1',
        email: 'a@b.com',
        displayName: null,
        onboardingComplete: true,
        twoFactorEnabled: false,
      },
      loading: false,
      refreshProfile: vi.fn(),
    })

    render(<SettingsPage />)

    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Enable two-factor authentication' }),
    ).toBeInTheDocument()
  })
})
