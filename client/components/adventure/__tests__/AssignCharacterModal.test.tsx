import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssignCharacterModal } from '@/components/adventure/AssignCharacterModal'

interface AssignPlayer {
  id: string
  role: string
  user: { id: string; email: string; displayName: string | null }
}

const players: AssignPlayer[] = [
  { id: 'cm-p1', role: 'PLAYER', user: { id: 'u1', email: 'alice@example.com', displayName: 'Alice' } },
  { id: 'cm-p2', role: 'PLAYER', user: { id: 'u2', email: 'bob@example.com', displayName: null } },
  { id: 'cm-gm', role: 'GM', user: { id: 'u-gm', email: 'gm@example.com', displayName: 'GM' } },
]

describe('AssignCharacterModal', () => {
  const baseProps = {
    characterName: 'Hero',
    players,
    currentAssigneeId: '',
    value: '',
    error: null as string | null,
    loading: false,
    onValueChange: vi.fn(),
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
  }

  it('renders assign mode when there is no current assignee', () => {
    render(<AssignCharacterModal {...baseProps} />)

    expect(screen.getByRole('heading', { name: 'Assign Character' })).toBeInTheDocument()
    expect(screen.getByText('Choose a player to control this character.')).toBeInTheDocument()
    expect(screen.getByText('Select Player')).toBeInTheDocument()
    expect(screen.getByText('Hero will be viewable and usable by the assigned player.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Assign' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('only lists non-GM players and shows email fallback for nameless players', () => {
    render(<AssignCharacterModal {...baseProps} />)

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3) // placeholder + Alice + Bob
    expect(screen.getByRole('option', { name: 'Select a player...' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Alice' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'bob@example.com' })).toBeInTheDocument()
    // The GM member must never be offered as an assignable player.
    expect(screen.queryByRole('option', { name: 'GM' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'gm@example.com' })).not.toBeInTheDocument()
  })

  it('renders change mode when a player is already assigned', () => {
    render(<AssignCharacterModal {...baseProps} currentAssigneeId="cm-p1" value="cm-p1" />)

    expect(screen.getByRole('heading', { name: 'Change Player' })).toBeInTheDocument()
    expect(
      screen.getByText('Choose the new player for this character. The current player will lose access.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change Player' })).toBeInTheDocument()
  })

  it('keeps the current assignee selectable so the GM can keep or switch them', () => {
    render(<AssignCharacterModal {...baseProps} currentAssigneeId="cm-p1" value="cm-p1" />)

    expect(screen.getByRole('option', { name: 'Alice' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'bob@example.com' })).toBeInTheDocument()
  })

  it('disables confirm until a player is selected', () => {
    render(<AssignCharacterModal {...baseProps} value="" />)
    expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled()
  })

  it('disables confirm when the current assignee is reselected (no change)', () => {
    render(<AssignCharacterModal {...baseProps} currentAssigneeId="cm-p1" value="cm-p1" />)
    expect(screen.getByRole('button', { name: 'Change Player' })).toBeDisabled()
  })

  it('shows the empty state and disables confirm when no players are available', () => {
    render(<AssignCharacterModal {...baseProps} players={players.filter(p => p.role === 'GM')} />)

    expect(
      screen.getByText('No players are available. Add players to this campaign first.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled()
  })

  it('shows a spinner and disables both buttons while assigning', () => {
    render(<AssignCharacterModal {...baseProps} value="cm-p1" loading={true} />)

    expect(screen.getByText('Assigning...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /assigning/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('reports the selected player via onValueChange', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(<AssignCharacterModal {...baseProps} onValueChange={onValueChange} />)

    await user.selectOptions(screen.getByRole('combobox'), 'cm-p2')
    expect(onValueChange).toHaveBeenCalledWith('cm-p2')
  })

  it('calls onConfirm with a valid selection', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<AssignCharacterModal {...baseProps} value="cm-p1" onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Assign' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not call onConfirm when the confirm button is disabled', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<AssignCharacterModal {...baseProps} value="" onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Assign' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<AssignCharacterModal {...baseProps} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('does not call onCancel while loading', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<AssignCharacterModal {...baseProps} loading={true} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('displays the error message when set', () => {
    render(<AssignCharacterModal {...baseProps} error="Player is no longer in this campaign" />)
    expect(screen.getByText('Player is no longer in this campaign')).toBeInTheDocument()
  })
})
