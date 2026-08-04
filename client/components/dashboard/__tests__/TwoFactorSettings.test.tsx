import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TwoFactorSettings } from '../TwoFactorSettings'

const mockUseAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/lib/two-factor-api', () => ({
  sendTwoFactorCode: vi.fn(),
  confirmTwoFactor: vi.fn(),
}))

const { sendTwoFactorCode, confirmTwoFactor } = await import('@/lib/two-factor-api')

const mockRefreshProfile = vi.fn()

function mockAuth(twoFactorEnabled: boolean) {
  mockUseAuth.mockReturnValue({
    user: { id: 'u1', email: 'a@b.com', twoFactorEnabled },
    loading: false,
    refreshProfile: mockRefreshProfile,
  })
}

describe('TwoFactorSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the enable button when 2FA is off', () => {
    mockAuth(false)
    render(<TwoFactorSettings />)
    expect(
      screen.getByRole('button', { name: 'Enable two-factor authentication' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Two-factor authentication is disabled').length).toBeGreaterThan(0)
  })

  it('shows the enabled state and disable button when 2FA is on', () => {
    mockAuth(true)
    render(<TwoFactorSettings />)
    expect(
      screen.getByRole('button', { name: 'Disable two-factor authentication' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Two-factor authentication is enabled').length).toBeGreaterThan(0)
  })

  it('enable flow: send code → confirm → show recovery codes → saved acknowledgment', async () => {
    mockAuth(false)
    vi.mocked(sendTwoFactorCode).mockResolvedValue({ twoFactorId: 'ch-1' })
    vi.mocked(confirmTwoFactor).mockResolvedValue({ recoveryCodes: ['ABCDE12345', 'FGHIJ67890'] })

    render(<TwoFactorSettings />)

    await userEvent.click(screen.getByText('Enable two-factor authentication'))
    await waitFor(() => {
      expect(sendTwoFactorCode).toHaveBeenCalledWith('ENABLE')
    })

    await userEvent.type(await screen.findByPlaceholderText('6-digit code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(confirmTwoFactor).toHaveBeenCalledWith('ENABLE', 'ch-1', '123456')
    })

    expect(screen.getByText('Recovery codes')).toBeInTheDocument()
    expect(screen.getByText('ABCDE12345')).toBeInTheDocument()
    expect(screen.getByText('FGHIJ67890')).toBeInTheDocument()

    await userEvent.click(screen.getByText("I've saved my codes"))

    await waitFor(() => {
      expect(mockRefreshProfile).toHaveBeenCalled()
      expect(screen.getByText('Two-factor authentication is now enabled')).toBeInTheDocument()
    })
  })

  it('copies the recovery codes to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    mockAuth(false)
    vi.mocked(sendTwoFactorCode).mockResolvedValue({ twoFactorId: 'ch-1' })
    vi.mocked(confirmTwoFactor).mockResolvedValue({ recoveryCodes: ['AAAA11111', 'BBBB22222'] })

    render(<TwoFactorSettings />)
    await userEvent.click(screen.getByText('Enable two-factor authentication'))
    await userEvent.type(await screen.findByPlaceholderText('6-digit code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(screen.getByText('AAAA11111')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Copy'))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('AAAA11111\nBBBB22222')
      expect(screen.getByText('Recovery codes copied to clipboard')).toBeInTheDocument()
    })
  })

  it('disable flow: send DISABLE code → confirm → success banner and profile refresh', async () => {
    mockAuth(true)
    vi.mocked(sendTwoFactorCode).mockResolvedValue({ twoFactorId: 'ch-2' })
    vi.mocked(confirmTwoFactor).mockResolvedValue({ success: true })

    render(<TwoFactorSettings />)

    await userEvent.click(screen.getByText('Disable two-factor authentication'))
    await waitFor(() => {
      expect(sendTwoFactorCode).toHaveBeenCalledWith('DISABLE')
    })

    await userEvent.type(await screen.findByPlaceholderText('6-digit code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(confirmTwoFactor).toHaveBeenCalledWith('DISABLE', 'ch-2', '123456')
      expect(mockRefreshProfile).toHaveBeenCalled()
      expect(screen.getByText('Two-factor authentication is disabled')).toBeInTheDocument()
    })
  })

  it('shows an error when sending the code fails', async () => {
    mockAuth(false)
    vi.mocked(sendTwoFactorCode).mockRejectedValue(new Error('Failed to send the code'))

    render(<TwoFactorSettings />)
    await userEvent.click(screen.getByText('Enable two-factor authentication'))

    expect(await screen.findByText('Failed to send the code')).toBeInTheDocument()
  })

  it('shows an error when the confirmation code is rejected', async () => {
    mockAuth(false)
    vi.mocked(sendTwoFactorCode).mockResolvedValue({ twoFactorId: 'ch-1' })
    vi.mocked(confirmTwoFactor).mockRejectedValue(
      new Error('That code is invalid or has expired. Please try again.'),
    )

    render(<TwoFactorSettings />)
    await userEvent.click(screen.getByText('Enable two-factor authentication'))
    await userEvent.type(await screen.findByPlaceholderText('6-digit code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(
      await screen.findByText('That code is invalid or has expired. Please try again.'),
    ).toBeInTheDocument()
  })

  it('cancels back to idle from the code step', async () => {
    mockAuth(false)
    vi.mocked(sendTwoFactorCode).mockResolvedValue({ twoFactorId: 'ch-1' })

    render(<TwoFactorSettings />)
    await userEvent.click(screen.getByText('Enable two-factor authentication'))
    await screen.findByPlaceholderText('6-digit code')

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Enable two-factor authentication')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('6-digit code')).not.toBeInTheDocument()
  })
})
