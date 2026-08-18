import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RemoveAssignmentModal } from '@/components/adventure/RemoveAssignmentModal'

describe('RemoveAssignmentModal', () => {
  const baseProps = {
    characterName: 'Hero',
    playerName: 'Alice',
    error: null as string | null,
    loading: false,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
  }

  it('renders the title, help, and confirmation body', () => {
    render(<RemoveAssignmentModal {...baseProps} />)

    expect(screen.getByRole('heading', { name: 'Remove Assignment' })).toBeInTheDocument()
    expect(
      screen.getByText('The player will lose access to this character, but the character will not be deleted.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Remove the assignment of "Hero" to Alice\? The character will not be deleted\./),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Assignment' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('renders the danger border on the card', () => {
    const { container } = render(<RemoveAssignmentModal {...baseProps} />)
    expect(container.querySelector('.card')).toHaveClass('border-danger/20')
  })

  it('falls back to the player email in the confirmation body when displayName is null', () => {
    render(<RemoveAssignmentModal {...baseProps} playerName="bob@example.com" />)
    expect(
      screen.getByText(/Remove the assignment of "Hero" to bob@example\.com/),
    ).toBeInTheDocument()
  })

  it('shows a spinner and disables both buttons while removing', () => {
    render(<RemoveAssignmentModal {...baseProps} loading={true} />)

    expect(screen.getByText('Removing...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /removing/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('displays the error message when set', () => {
    render(<RemoveAssignmentModal {...baseProps} error="Failed to remove assignment" />)
    expect(screen.getByText('Failed to remove assignment')).toBeInTheDocument()
  })

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<RemoveAssignmentModal {...baseProps} onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Remove Assignment' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not call onConfirm while loading', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<RemoveAssignmentModal {...baseProps} loading={true} onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: /removing/i }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<RemoveAssignmentModal {...baseProps} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does not call onCancel while loading', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<RemoveAssignmentModal {...baseProps} loading={true} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).not.toHaveBeenCalled()
  })
})
