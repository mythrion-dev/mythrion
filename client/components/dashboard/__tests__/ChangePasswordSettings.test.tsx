import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChangePasswordSettings } from '../ChangePasswordSettings'

const mockUseAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/lib/auth-api', () => ({
  changePassword: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  getRefreshToken: vi.fn(),
}))

const { changePassword } = await import('@/lib/auth-api')
const { getRefreshToken } = await import('@/lib/api')

const mockRefreshProfile = vi.fn()

function mockAuth(hasPassword: boolean | null = true) {
  mockUseAuth.mockReturnValue({
    user: { id: 'u1', email: 'a@b.com', hasPassword },
    loading: false,
    refreshProfile: mockRefreshProfile,
  })
}

async function fillForm() {
  await userEvent.type(screen.getByLabelText('Current password'), 'OldPass123!')
  await userEvent.type(screen.getByLabelText('New password'), 'NewPass123!')
  await userEvent.type(screen.getByLabelText('Confirm password'), 'NewPass123!')
}

describe('ChangePasswordSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
    vi.mocked(getRefreshToken).mockReturnValue('refresh-token-1')
  })

  it('renders nothing for a Google-only account with no password', () => {
    mockAuth(false)
    const { container } = render(<ChangePasswordSettings />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the form for an account with a password', () => {
    render(<ChangePasswordSettings />)
    expect(screen.getByRole('heading', { name: 'Change password' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update password' })).toBeInTheDocument()
  })

  it('rejects a password that fails the strength rules', async () => {
    vi.mocked(changePassword).mockResolvedValue({ success: true })
    render(<ChangePasswordSettings />)

    await userEvent.type(screen.getByLabelText('Current password'), 'OldPass123!')
    await userEvent.type(screen.getByLabelText('New password'), 'abcdefgh')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'abcdefgh')
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(
      screen.getByText("This password doesn't meet the security requirements."),
    ).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('rejects mismatched confirmation before calling the API', async () => {
    render(<ChangePasswordSettings />)

    await userEvent.type(screen.getByLabelText('Current password'), 'OldPass123!')
    await userEvent.type(screen.getByLabelText('New password'), 'NewPass123!')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'OtherPass123!')
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('changes the password, refreshes the profile, and clears the fields on success', async () => {
    vi.mocked(changePassword).mockResolvedValue({ success: true })
    render(<ChangePasswordSettings />)

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
        logoutOtherDevices: false,
      })
    })
    expect(mockRefreshProfile).toHaveBeenCalled()
    expect(screen.getByText('Password updated successfully')).toBeInTheDocument()
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(screen.getByLabelText('New password')).toHaveValue('')
    expect(screen.getByLabelText('Confirm password')).toHaveValue('')
  })

  it('surfaces a server-side error', async () => {
    vi.mocked(changePassword).mockRejectedValue(new Error('Current password is incorrect'))
    render(<ChangePasswordSettings />)

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument()
  })

  it('includes the refresh token when revoking other sessions', async () => {
    vi.mocked(changePassword).mockResolvedValue({ success: true })
    render(<ChangePasswordSettings />)

    await userEvent.click(screen.getByRole('checkbox'))
    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
        logoutOtherDevices: true,
        currentRefreshToken: 'refresh-token-1',
      })
    })
  })
})
