import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CampaignCard } from '@/components/community/CampaignCard'

// ── Next/Link mock ──

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode
    href: string
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// ════════════════════════════════════════════════════════════
// CampaignCard
// ════════════════════════════════════════════════════════════

describe('CampaignCard', () => {
  const defaultProps = {
    id: 'adv-1',
    name: 'The Dragon\'s Lair',
    campaign: 'D&D 5e',
    synopsis: 'A thrilling adventure through the dragon mountain.',
    maxPlayers: 4,
    ownerDisplayName: 'Alice Johnson',
    playerCount: 2,
    index: 0,
  }

  it('renders name and campaign badge', () => {
    render(<CampaignCard {...defaultProps} />)
    expect(screen.getByText("The Dragon's Lair")).toBeDefined()
    expect(screen.getByText('D&D 5e')).toBeDefined()
  })

  it('renders synopsis text', () => {
    render(<CampaignCard {...defaultProps} />)
    expect(
      screen.getByText('A thrilling adventure through the dragon mountain.'),
    ).toBeDefined()
  })

  it('renders player count and max players', () => {
    render(<CampaignCard {...defaultProps} />)
    expect(screen.getByText('2 / 4 players')).toBeDefined()
  })

  it('renders owner display name', () => {
    render(<CampaignCard {...defaultProps} />)
    expect(screen.getByText('Alice Johnson')).toBeDefined()
  })

  it('renders "No synopsis yet." when synopsis is null', () => {
    render(<CampaignCard {...defaultProps} synopsis={null} />)
    expect(screen.getByText('No synopsis yet.')).toBeDefined()
  })

  it('truncates synopsis longer than 120 characters', () => {
    const longSynopsis = 'A'.repeat(150)
    render(<CampaignCard {...defaultProps} synopsis={longSynopsis} />)
    // Should truncate to 120 chars + '...'
    const text = screen.getByText(/\.\.\.$/)
    expect(text).toBeDefined()
    expect(text.textContent!.length).toBeLessThanOrEqual(124) // 120 + '...'
  })

  it('renders link to adventure detail page', () => {
    render(<CampaignCard {...defaultProps} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/dashboard/explore-campaigns/adv-1')
  })

  it('does not render owner name when null', () => {
    render(<CampaignCard {...defaultProps} ownerDisplayName={null} />)
    expect(screen.queryByText('Alice Johnson')).toBeNull()
  })

  it('defaults playerCount to 0 when not provided', () => {
    render(<CampaignCard {...defaultProps} playerCount={undefined} />)
    expect(screen.getByText('0 / 4 players')).toBeDefined()
  })

  // ── Session info tests ──

  it('shows weekday, time, and type when all session fields are provided', () => {
    render(
      <CampaignCard
        {...defaultProps}
        sessionWeekday="Friday"
        sessionTime="20:00"
        sessionType="ONLINE"
      />,
    )
    expect(screen.getByText(/Friday/i)).toBeDefined()
    expect(screen.getByText(/20:00/)).toBeDefined()
    expect(screen.getByText(/Online/)).toBeDefined()
  })

  it('shows type only when weekday and time are not provided', () => {
    render(
      <CampaignCard
        {...defaultProps}
        sessionWeekday={null}
        sessionTime={null}
        sessionType="IN_PERSON"
      />,
    )
    expect(screen.getByText(/In Person/)).toBeDefined()
    // Should not show a bullet separator without both weekday and time
    expect(screen.queryByText(/•/)).toBeNull()
  })

  it('shows weekday only when type and time are not provided', () => {
    render(
      <CampaignCard
        {...defaultProps}
        sessionWeekday="Wednesday"
        sessionTime={null}
        sessionType={null}
      />,
    )
    expect(screen.getByText(/Wednesday/)).toBeDefined()
  })

  it('renders nothing for session info when all session fields are null', () => {
    render(
      <CampaignCard
        {...defaultProps}
        sessionWeekday={null}
        sessionTime={null}
        sessionType={null}
      />,
    )
    // The session info row should not exist
    expect(screen.queryByText(/Online/)).toBeNull()
    expect(screen.queryByText(/In Person/)).toBeNull()
    // Still renders the card content
    expect(screen.getByText("The Dragon's Lair")).toBeDefined()
  })

  it('shows weekday and time with bullet separator when both are provided', () => {
    render(
      <CampaignCard
        {...defaultProps}
        sessionWeekday="Saturday"
        sessionTime="14:30"
        sessionType={null}
      />,
    )
    // The bullet should appear between weekday and time
    const card = document.querySelector('.card-interactive')
    expect(card?.textContent).toMatch(/Saturday/)
    expect(card?.textContent).toMatch(/14:30/)
  })
})
