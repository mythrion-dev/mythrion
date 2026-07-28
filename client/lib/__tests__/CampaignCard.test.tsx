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
    expect(link.getAttribute('href')).toBe('/community/adventures/adv-1')
  })

  it('does not render owner name when null', () => {
    render(<CampaignCard {...defaultProps} ownerDisplayName={null} />)
    expect(screen.queryByText('Alice Johnson')).toBeNull()
  })

  it('defaults playerCount to 0 when not provided', () => {
    render(<CampaignCard {...defaultProps} playerCount={undefined} />)
    expect(screen.getByText('0 / 4 players')).toBeDefined()
  })
})
