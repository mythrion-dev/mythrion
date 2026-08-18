import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VisibilityToggle } from '@/components/adventure/VisibilityToggle'

describe('VisibilityToggle', () => {
  it('renders public state with label, description and aria-checked', () => {
    render(<VisibilityToggle isPublic loading={false} onToggle={vi.fn()} />)
    expect(screen.getByText('Public Campaign')).toBeInTheDocument()
    expect(
      screen.getByText('Anyone can see this campaign and request to join.'),
    ).toBeInTheDocument()
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(toggle).not.toBeDisabled()
  })

  it('renders private state with label, description and aria-checked false', () => {
    render(<VisibilityToggle isPublic={false} loading={false} onToggle={vi.fn()} />)
    expect(screen.getByText('Private Campaign')).toBeInTheDocument()
    expect(
      screen.getByText('Only invited members can see this campaign.'),
    ).toBeInTheDocument()
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(toggle).not.toBeDisabled()
  })

  it('calls onToggle when the switch is clicked', () => {
    const onToggle = vi.fn()
    render(<VisibilityToggle isPublic loading={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('disables the switch while loading and does not call onToggle', () => {
    const onToggle = vi.fn()
    render(<VisibilityToggle isPublic loading onToggle={onToggle} />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toBeDisabled()
    fireEvent.click(toggle)
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('disables the switch when disabled prop is true', () => {
    render(
      <VisibilityToggle isPublic={false} loading={false} onToggle={vi.fn()} disabled />,
    )
    expect(screen.getByRole('switch')).toBeDisabled()
  })

  it('renders private description when isPublic is false', () => {
    render(<VisibilityToggle isPublic={false} loading={false} onToggle={vi.fn()} />)
    expect(
      screen.getByText('Only invited members can see this campaign.'),
    ).toBeInTheDocument()
  })
})
