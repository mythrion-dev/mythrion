import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PreviewBanner } from '../PreviewBanner'

// ── Next/Link mock (same pattern as other component tests) ──

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

// ════════════════════════════════════════════════════════════════
// PreviewBanner
// ════════════════════════════════════════════════════════════════

describe('PreviewBanner', () => {
  const defaultProps = {
    templateName: 'Fighter Sheet',
    templateId: 'tpl-1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the template name', () => {
    render(<PreviewBanner {...defaultProps} />)
    expect(screen.getByText('Fighter Sheet')).toBeDefined()
  })

  it('renders "Sandbox Mode" badge', () => {
    render(<PreviewBanner {...defaultProps} />)
    expect(screen.getByText('Sandbox Mode')).toBeDefined()
  })

  it('renders "Clone this Template" link with correct href', () => {
    render(<PreviewBanner {...defaultProps} />)
    const cloneLink = screen.getByText('Clone this Template')
    expect(cloneLink).toBeDefined()
    expect(cloneLink.getAttribute('href')).toBe('/community/templates/tpl-1')
  })

  it('renders "Exit Preview" link with correct href', () => {
    render(<PreviewBanner {...defaultProps} />)
    const exitLink = screen.getByText('Exit Preview')
    expect(exitLink).toBeDefined()
    expect(exitLink.getAttribute('href')).toBe('/community/templates')
  })

  it('renders "Previewing:" label for screen reader / visual context', () => {
    render(<PreviewBanner {...defaultProps} />)
    expect(screen.getByText(/Previewing:/)).toBeDefined()
  })

  it('renders with different template name and id', () => {
    render(<PreviewBanner templateName="Mage Sheet" templateId="tpl-42" />)
    expect(screen.getByText('Mage Sheet')).toBeDefined()
    const cloneLink = screen.getByText('Clone this Template')
    expect(cloneLink.getAttribute('href')).toBe('/community/templates/tpl-42')
  })
})
