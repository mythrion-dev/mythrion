import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TemplateCard } from '@/components/templates/TemplateCard'

// ── Next/Link mock ──

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    onClick,
    ...rest
  }: {
    children: React.ReactNode
    href: string
    onClick?: React.MouseEventHandler
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}))

// ════════════════════════════════════════════════════════════
// TemplateCard (components/templates/TemplateCard.tsx)
// ════════════════════════════════════════════════════════════

describe('TemplateCard', () => {
  const defaultProps = {
    id: 'tpl-1',
    name: 'Fighter Sheet',
    description: 'A basic fighter character sheet.',
    campaign: 'D&D 5e',
    createdAt: '2025-03-15',
    attributeCount: 3,
    skillCount: 5,
    useCount: 2,
    isPublic: false,
    index: 0,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Basic rendering ──

  it('renders the template name', () => {
    render(<TemplateCard {...defaultProps} />)
    expect(screen.getByText('Fighter Sheet')).toBeInTheDocument()
  })

  it('wraps the card in a link to the template detail page', () => {
    render(<TemplateCard {...defaultProps} id="tpl-42" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/dashboard/templates/tpl-42')
  })

  it('applies animation delay from index', () => {
    render(<TemplateCard {...defaultProps} index={3} />)
    const link = screen.getByRole('link')
    expect(link).toHaveStyle({ animationDelay: '240ms' })
  })

  it('uses default index 0 when not provided', () => {
    const { container } = render(<TemplateCard {...defaultProps} index={undefined} />)
    const link = container.querySelector('a')
    expect(link).toHaveStyle({ animationDelay: '0ms' })
  })

  // ── Description ──

  it('renders the description text', () => {
    render(<TemplateCard {...defaultProps} />)
    expect(screen.getByText('A basic fighter character sheet.')).toBeInTheDocument()
  })

  it('renders "No description." when description is null', () => {
    render(<TemplateCard {...defaultProps} description={null} />)
    expect(screen.getByText('No description.')).toBeInTheDocument()
  })

  it('renders "No description." when description is empty string', () => {
    render(<TemplateCard {...defaultProps} description="" />)
    expect(screen.getByText('No description.')).toBeInTheDocument()
  })

  it('truncates descriptions longer than 120 characters', () => {
    const long = 'x'.repeat(150)
    render(<TemplateCard {...defaultProps} description={long} />)
    expect(screen.getByText('x'.repeat(120) + '...')).toBeInTheDocument()
  })

  it('trims trailing whitespace before truncation ellipsis', () => {
    const long = 'word '.repeat(30) // length 150, with trailing spaces
    render(<TemplateCard {...defaultProps} description={long} />)
    const trimmed = 'word '.repeat(24) // 120 chars
    expect(screen.getByText(trimmed.trimEnd() + '...')).toBeInTheDocument()
  })

  it('does not truncate descriptions of exactly 120 characters', () => {
    const exact = 'y'.repeat(120)
    render(<TemplateCard {...defaultProps} description={exact} />)
    expect(screen.getByText(exact)).toBeInTheDocument()
  })

  // ── Campaign & public badges ──

  it('renders the campaign badge', () => {
    render(<TemplateCard {...defaultProps} />)
    expect(screen.getByText('D&D 5e')).toBeInTheDocument()
  })

  it('does not render campaign badge when null', () => {
    render(<TemplateCard {...defaultProps} campaign={null} />)
    expect(screen.queryByText('D&D 5e')).not.toBeInTheDocument()
  })

  it('renders "Public" badge when isPublic is true', () => {
    render(<TemplateCard {...defaultProps} isPublic={true} />)
    expect(screen.getByText('Public')).toBeInTheDocument()
  })

  it('does not render "Public" badge when isPublic is false', () => {
    render(<TemplateCard {...defaultProps} isPublic={false} />)
    expect(screen.queryByText('Public')).not.toBeInTheDocument()
  })

  it('renders "Public" badge when isPublic is not provided (defaults false)', () => {
    const { container } = render(<TemplateCard {...defaultProps} isPublic={undefined} />)
    expect(container.querySelectorAll('.badge').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Public')).not.toBeInTheDocument()
  })

  // ── Feature count chips ──

  it('renders attribute count chip', () => {
    render(<TemplateCard {...defaultProps} attributeCount={3} />)
    expect(screen.getByText('3 attr')).toBeInTheDocument()
  })

  it('does not render attribute chip when count is 0', () => {
    render(<TemplateCard {...defaultProps} attributeCount={0} />)
    expect(screen.queryByText(/attr$/)).not.toBeInTheDocument()
  })

  it('renders skill count chip', () => {
    render(<TemplateCard {...defaultProps} skillCount={5} />)
    expect(screen.getByText('5 skills')).toBeInTheDocument()
  })

  it('does not render skill chip when count is 0', () => {
    render(<TemplateCard {...defaultProps} skillCount={0} />)
    expect(screen.queryByText(/skills$/)).not.toBeInTheDocument()
  })

  it('renders use count chip', () => {
    render(<TemplateCard {...defaultProps} useCount={2} />)
    expect(screen.getByText('Used 2x')).toBeInTheDocument()
  })

  it('does not render use count chip when count is 0', () => {
    render(<TemplateCard {...defaultProps} useCount={0} />)
    expect(screen.queryByText(/Used/)).not.toBeInTheDocument()
  })

  it('renders no chips when all counts are 0', () => {
    const { container } = render(
      <TemplateCard {...defaultProps} attributeCount={0} skillCount={0} useCount={0} />,
    )
    // Only the campaign badge remains (D&D 5e)
    expect(screen.getByText('D&D 5e')).toBeInTheDocument()
    expect(screen.queryByText(/attr$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/skills$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Used/)).not.toBeInTheDocument()
  })

  // ── Footer date & view details ──

  it('renders the created date formatted for en-US', () => {
    render(<TemplateCard {...defaultProps} createdAt="2025-03-15" />)
    const expected = new Date('2025-03-15').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('renders "View details" CTA', () => {
    render(<TemplateCard {...defaultProps} />)
    expect(screen.getByText('View details →')).toBeInTheDocument()
  })
})
