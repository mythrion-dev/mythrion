import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TwoFactorCodeForm } from '../TwoFactorCodeForm'

function renderForm(overrides: Partial<Parameters<typeof TwoFactorCodeForm>[0]> = {}) {
  const props = {
    emailMasked: 't***@test.com',
    onVerify: vi.fn().mockResolvedValue(undefined),
    onResend: vi.fn().mockResolvedValue(undefined),
    onBack: vi.fn(),
    ...overrides,
  }
  return { props, render: render(<TwoFactorCodeForm {...props} />) }
}

describe('TwoFactorCodeForm', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the title and the masked email hint', () => {
    renderForm()
    expect(screen.getByText('Two-factor authentication')).toBeInTheDocument()
    expect(screen.getByText(/We sent a code to t\*\*\*@test\.com/)).toBeInTheDocument()
  })

  it('renders the code input, verify, resend and back controls', () => {
    renderForm()
    expect(screen.getByPlaceholderText('6-digit code')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeInTheDocument()
  })

  it('submits the entered code to onVerify', async () => {
    const { props } = renderForm()
    await userEvent.type(screen.getByPlaceholderText('6-digit code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() => {
      expect(props.onVerify).toHaveBeenCalledWith('123456')
    })
  })

  it('shows the error message when verification fails', async () => {
    const onVerify = vi
      .fn()
      .mockRejectedValue(new Error('That code is invalid or has expired. Please try again.'))
    renderForm({ onVerify })

    await userEvent.type(screen.getByPlaceholderText('6-digit code'), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }))

    expect(
      await screen.findByText('That code is invalid or has expired. Please try again.'),
    ).toBeInTheDocument()
  })

  it('calls onBack when the back link is clicked', () => {
    const { props } = renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }))
    expect(props.onBack).toHaveBeenCalledTimes(1)
  })

  it('starts a resend cooldown that disables the resend link until it elapses', async () => {
    vi.useFakeTimers()
    const onResend = vi.fn().mockResolvedValue(undefined)
    renderForm({ onResend })

    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }))

    // Flush the awaited onResend continuation that starts the cooldown.
    await act(async () => {})

    expect(onResend).toHaveBeenCalledTimes(1)
    const resendBtn = screen.getByRole('button', { name: /Resend code in 30s/ })
    expect(resendBtn).toBeDisabled()

    // The countdown re-schedules one setTimeout per tick, and React 19 defers
    // renders to a macrotask that the async timer-advance loop starves — so a
    // single (or chained) advance only fires the first tick. Sync act flushes
    // React after each 1s step, letting the effect re-schedule the next tick.
    for (let i = 0; i < 30; i += 1) {
      act(() => {
        vi.advanceTimersByTime(1000)
      })
    }

    expect(screen.getByRole('button', { name: 'Resend code' })).toBeEnabled()
  })

  it('shows an error when resending fails', async () => {
    const onResend = vi.fn().mockRejectedValue(new Error('Something went wrong'))
    renderForm({ onResend })

    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }))

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
  })
})
