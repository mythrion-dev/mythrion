import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ForgotPasswordModal } from '../ForgotPasswordModal'

vi.mock('@/lib/auth-api', () => ({
  forgotPassword: vi.fn(),
}))

const { forgotPassword } = await import('@/lib/auth-api')

function renderModal(props: Partial<Parameters<typeof ForgotPasswordModal>[0]> = {}) {
  const base = { open: true, initialEmail: '', onClose: vi.fn(), ...props }
  return {
    onClose: base.onClose,
    ...render(<ForgotPasswordModal {...base} />),
  }
}

describe('ForgotPasswordModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when closed', () => {
    const { container } = renderModal({ open: false })
    expect(container.firstChild).toBeNull()
  })

  it('pre-fills the email field with the provided initial email', () => {
    renderModal({ initialEmail: 'adventurer@example.com' })
    expect(screen.getByLabelText('Email')).toHaveValue('adventurer@example.com')
  })

  it('sends the reset link and lands on the confirmation state on success', async () => {
    vi.mocked(forgotPassword).mockResolvedValue({ success: true })
    const { onClose } = renderModal({ initialEmail: 'adventurer@example.com' })

    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    await waitFor(() => {
      expect(forgotPassword).toHaveBeenCalledWith('adventurer@example.com')
    })
    // Always the same confirmation copy — no signal about whether the account exists.
    expect(
      screen.getByText("If an account exists for that email, we've sent a password reset link."),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows an error when the request fails instead of claiming success', async () => {
    vi.mocked(forgotPassword).mockRejectedValue(new Error('Something went wrong'))
    renderModal({ initialEmail: 'adventurer@example.com' })

    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.queryByText("If an account exists for that email, we've sent a password reset link."),
    ).not.toBeInTheDocument()
  })

  it('resets its state each time it reopens', async () => {
    vi.mocked(forgotPassword).mockResolvedValue({ success: true })
    const { onClose } = renderModal({ initialEmail: 'a@b.com' })

    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
    await waitFor(() => {
      expect(
        screen.getByText("If an account exists for that email, we've sent a password reset link."),
      ).toBeInTheDocument()
    })

    // Reopening with a new email returns to the form and resets the field.
    renderModal({ open: false })
    renderModal({ open: true, initialEmail: 'other@b.com', onClose })
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('other@b.com')
  })
})
