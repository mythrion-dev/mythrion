import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDetachModal } from '@/components/adventure/ConfirmDetachModal'

describe('ConfirmDetachModal', () => {
  const defaultProps = {
    loading: false,
    error: null as string | null,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
  }

  it('renders with default state', () => {
    render(<ConfirmDetachModal {...defaultProps} />)

    expect(screen.getByText('Detach Sheet Template')).toBeInTheDocument()
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
    expect(
      screen.getByText(/the snapshot will be preserved/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Detach Template' })).toBeInTheDocument()
  })

  it('renders the warning icon', () => {
    const { container } = render(<ConfirmDetachModal {...defaultProps} />)
    // The warning icon is an SVG inside the danger-muted circle
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('shows a spinner and "Detaching..." when loading is true', () => {
    render(<ConfirmDetachModal {...defaultProps} loading={true} />)

    expect(screen.getByText('Detaching...')).toBeInTheDocument()
    // Buttons should be disabled while loading
    expect(screen.getByRole('button', { name: /detaching/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('displays the error message when error is set', () => {
    render(<ConfirmDetachModal {...defaultProps} error="Something went wrong" />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('calls onCancel when Cancel button is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()

    render(<ConfirmDetachModal {...defaultProps} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm when Detach Template button is clicked', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    render(<ConfirmDetachModal {...defaultProps} onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Detach Template' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not call onConfirm when buttons are disabled during loading', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    render(
      <ConfirmDetachModal
        {...defaultProps}
        loading={true}
        onConfirm={onConfirm}
      />,
    )

    await user.click(screen.getByRole('button', { name: /detaching/i }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('renders with the danger border on the card', () => {
    const { container } = render(<ConfirmDetachModal {...defaultProps} />)
    const card = container.querySelector('.card')
    expect(card).toHaveClass('border-danger/20')
  })
})
