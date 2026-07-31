import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TemplateCard } from '@/components/community/TemplateCard'

// ── Next/Link mock ──

const mockPush = vi.fn()

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

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// ════════════════════════════════════════════════════════════
// TemplateCard
// ════════════════════════════════════════════════════════════

describe('TemplateCard', () => {
  const defaultProps = {
    id: 'tpl-1',
    name: 'Fighter Sheet',
    description: 'A basic fighter character sheet.',
    campaign: 'D&D 5e',
    creatorDisplayName: 'Alice Johnson',
    copyCount: 5,
    index: 0,
    onClone: vi.fn(),
    isCloning: false,
    isAuthenticated: true,
    isOwn: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders name and campaign badge', () => {
    render(<TemplateCard {...defaultProps} />)
    expect(screen.getByText('Fighter Sheet')).toBeDefined()
    expect(screen.getByText('D&D 5e')).toBeDefined()
  })

  it('renders description text', () => {
    render(<TemplateCard {...defaultProps} />)
    expect(screen.getByText('A basic fighter character sheet.')).toBeDefined()
  })

  it('renders creator name', () => {
    render(<TemplateCard {...defaultProps} />)
    expect(screen.getByText('Alice Johnson')).toBeDefined()
  })

  it('renders copy count', () => {
    render(<TemplateCard {...defaultProps} />)
    expect(screen.getByText('5')).toBeDefined()
  })

  it('renders "No description." when description is null', () => {
    render(<TemplateCard {...defaultProps} description={null} />)
    expect(screen.getByText('No description.')).toBeDefined()
  })

  it('does not render campaign when null', () => {
    render(<TemplateCard {...defaultProps} campaign={null} />)
    expect(screen.queryByText('D&D 5e')).toBeNull()
  })

  it('does not render creator when null', () => {
    render(<TemplateCard {...defaultProps} creatorDisplayName={null} />)
    expect(screen.queryByText('Alice Johnson')).toBeNull()
  })

  it('shows "Owned" badge when isOwn is true', () => {
    render(<TemplateCard {...defaultProps} isOwn={true} />)
    expect(screen.getByText('Owned')).toBeDefined()
  })

  it('shows clone button when authenticated and not own', () => {
    render(<TemplateCard {...defaultProps} isAuthenticated={true} isOwn={false} />)
    expect(screen.getByText('Clone')).toBeDefined()
  })

  it('calls onClone when clone button is clicked', () => {
    const onClone = vi.fn()
    render(<TemplateCard {...defaultProps} onClone={onClone} />)
    fireEvent.click(screen.getByText('Clone'))
    expect(onClone).toHaveBeenCalledWith('tpl-1')
  })

  it('shows "Cloning..." when isCloning is true', () => {
    render(<TemplateCard {...defaultProps} isCloning={true} />)
    expect(screen.getByText('Cloning...')).toBeDefined()
  })

  it('shows "Sign in to clone" link when not authenticated', () => {
    render(<TemplateCard {...defaultProps} isAuthenticated={false} />)
    expect(screen.getByText('Sign in to clone')).toBeDefined()
  })

  it('does not show copy count when copyCount is 0', () => {
    render(<TemplateCard {...defaultProps} copyCount={0} />)
    // The count text '0' should not appear (only rendered when > 0)
    expect(screen.queryByText(/^0$/)).toBeNull()
  })

  // ── Preview link ──

  it('shows Preview link for authenticated users', () => {
    render(<TemplateCard {...defaultProps} />)
    expect(screen.getByText('Preview')).toBeDefined()
  })

  it('shows Preview link for unauthenticated users', () => {
    render(<TemplateCard {...defaultProps} isAuthenticated={false} />)
    expect(screen.getByText('Preview')).toBeDefined()
  })

  it('Preview link points to /community/templates/{id}/preview', () => {
    render(<TemplateCard {...defaultProps} id="tpl-42" />)
    const previewLink = screen.getByText('Preview')
    expect(previewLink.getAttribute('href')).toBe('/dashboard/public-templates/tpl-42/preview')
  })
})
