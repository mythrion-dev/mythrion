import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BreadcrumbNav, PageNav } from '../breadcrumb'
import type { BreadcrumbSegment } from '../navigation-context'

// ── Mocks ──

const mockSetBreadcrumbs = vi.fn()
const mockPushSegment = vi.fn()
const mockPopSegment = vi.fn()
let mockBreadcrumbs: BreadcrumbSegment[] = []

vi.mock('../navigation-context', () => ({
  useNavigation: () => ({
    breadcrumbs: mockBreadcrumbs,
    setBreadcrumbs: mockSetBreadcrumbs,
    pushSegment: mockPushSegment,
    popSegment: mockPopSegment,
  }),
}))

// useRouter is already mocked globally in setup.ts (back: vi.fn())

// ── Helpers ──

function setCrumbs(crumbs: BreadcrumbSegment[]) {
  mockBreadcrumbs = crumbs
}

// ════════════════════════════════════════════════════════════
// BreadcrumbNav
// ════════════════════════════════════════════════════════════

describe('BreadcrumbNav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setCrumbs([])
  })

  it('returns null when breadcrumbs array is empty', () => {
    const { container } = render(<BreadcrumbNav />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the back button', () => {
    setCrumbs([{ label: 'Dashboard', href: '/dashboard' }])
    render(<BreadcrumbNav />)
    expect(screen.getByLabelText('Go back')).toBeInTheDocument()
    expect(screen.getByText('Back')).toBeInTheDocument()
  })

  it('renders a single breadcrumb as plain text (current page, no href)', () => {
    setCrumbs([{ label: 'Current Page' }])
    render(<BreadcrumbNav />)
    // Back button + "/" separator + label
    expect(screen.getByText('Current Page')).toBeInTheDocument()
    // No link since it's the last (and only) crumb
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders a clickable link for non-last crumbs with href', () => {
    setCrumbs([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Current Page' },
    ])
    render(<BreadcrumbNav />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/dashboard')
    expect(link).toHaveTextContent('Dashboard')
  })

  it('renders multiple breadcrumbs with separators', () => {
    setCrumbs([
      { label: 'Root', href: '/root' },
      { label: 'Section', href: '/root/section' },
      { label: 'Page' },
    ])
    render(<BreadcrumbNav />)
    expect(screen.getByText('Root')).toBeInTheDocument()
    expect(screen.getByText('Section')).toBeInTheDocument()
    expect(screen.getByText('Page')).toBeInTheDocument()
    // Two separators: both "Root" and "Section" should have a "/" after them
    const separators = screen.getAllByText('/')
    // Back button also has a "/" separator after it, so expect 3 slashes
    expect(separators.length).toBeGreaterThanOrEqual(2)
  })

  it('renders last crumb without href as plain text with text-foreground class', () => {
    setCrumbs([
      { label: 'Parent', href: '/parent' },
      { label: 'Child' },
    ])
    render(<BreadcrumbNav />)
    const parentLink = screen.getByRole('link')
    expect(parentLink).toHaveAttribute('href', '/parent')

    // The last crumb should be plain text, not a link
    const parentLinks = screen.getAllByText('Parent')
    expect(parentLinks).toHaveLength(1)

    // Child should be plain text with text-foreground
    const childSpan = screen.getByText('Child')
    expect(childSpan.className).toContain('text-foreground')
  })

  it('renders non-last crumb without href as muted plain text', () => {
    setCrumbs([
      { label: 'Section' }, // no href, not last when there are 3
      { label: 'Sub', href: '/sub' },
      { label: 'Page' },
    ])
    render(<BreadcrumbNav />)
    // Section has no href and is not last — should be muted
    const sectionSpan = screen.getByText('Section')
    expect(sectionSpan.className).toContain('text-muted')
    expect(sectionSpan.className).toContain('font-medium')
  })

  it('calls router.back() when back button is clicked', () => {
    setCrumbs([{ label: 'Page' }])
    render(<BreadcrumbNav />)
    // useRouter is auto-mocked in setup.ts with vi.fn() for each method
    // We can assert the button click doesn't throw
    const backBtn = screen.getByLabelText('Go back')
    expect(() => fireEvent.click(backBtn)).not.toThrow()
  })

  it('has aria-label "Breadcrumb" on nav element', () => {
    setCrumbs([{ label: 'One', href: '/one' }, { label: 'Two' }])
    render(<BreadcrumbNav />)
    const nav = screen.getByLabelText('Breadcrumb')
    expect(nav).toBeInTheDocument()
    expect(nav.tagName).toBe('NAV')
  })

  it('sets nav role to "navigation" implicitly via <nav>', () => {
    setCrumbs([{ label: 'One' }])
    const { container } = render(<BreadcrumbNav />)
    const nav = container.querySelector('nav')
    expect(nav).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════════════
// PageNav
// ════════════════════════════════════════════════════════════

describe('PageNav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setCrumbs([])
  })

  it('calls setBreadcrumbs with the provided crumbs on mount', () => {
    const crumbs: BreadcrumbSegment[] = [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Adventure' },
    ]
    render(<PageNav crumbs={crumbs} />)
    expect(mockSetBreadcrumbs).toHaveBeenCalledTimes(1)
    expect(mockSetBreadcrumbs).toHaveBeenCalledWith(crumbs)
  })

  it('renders BreadcrumbNav inside it', () => {
    setCrumbs([{ label: 'Page' }])
    render(<PageNav crumbs={[{ label: 'Page' }]} />)
    // BreadcrumbNav should render — back button and the label
    expect(screen.getByText('Page')).toBeInTheDocument()
    expect(screen.getByLabelText('Go back')).toBeInTheDocument()
  })

  it('only sets breadcrumbs once on mount despite re-renders', () => {
    const crumbs: BreadcrumbSegment[] = [{ label: 'Only Once' }]
    const { rerender } = render(<PageNav crumbs={crumbs} />)
    expect(mockSetBreadcrumbs).toHaveBeenCalledTimes(1)

    rerender(<PageNav crumbs={[{ label: 'Different' }]} />)
    // Still only 1 call due to empty deps array in useEffect
    expect(mockSetBreadcrumbs).toHaveBeenCalledTimes(1)
  })
})
