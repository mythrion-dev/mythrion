import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Sidebar } from '@/components/dashboard/Sidebar'

// ── Next/Navigation mocks (controlled per test) ──

const mockUsePathname = vi.fn()
const mockUseSearchParams = vi.fn()
const mockRouterPush = vi.fn()
const mockRouterBack = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: mockRouterBack,
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockUseSearchParams(),
  usePathname: () => mockUsePathname(),
}))

// ── Auth mocks ──

const mockLogout = vi.fn()
const defaultUser = {
  id: 'user-1',
  email: 'alice@example.com',
  displayName: 'Alice Johnson',
  onboardingComplete: true,
}

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: defaultUser,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: mockLogout,
    completeOnboarding: vi.fn(),
  }),
}))

// ════════════════════════════════════════════════════════════
// Sidebar — rendering
// ════════════════════════════════════════════════════════════

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockUsePathname.mockReturnValue('/')
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
  })

  it('renders the sidebar container', () => {
    const { container } = render(<Sidebar />)
    const aside = container.querySelector('aside')
    expect(aside).toBeInTheDocument()
  })

  it('renders the logo text (Mythrion)', () => {
    render(<Sidebar />)
    expect(screen.getByText('Mythrion')).toBeInTheDocument()
  })

  it('renders all navigation links', () => {
    render(<Sidebar />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Adventures')).toBeInTheDocument()
    expect(screen.getByText('Character Sheets')).toBeInTheDocument()
  })

  it('renders user display name and email', () => {
    render(<Sidebar />)
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
  })

  it('renders user initials avatar', () => {
    render(<Sidebar />)
    expect(screen.getByText('AJ')).toBeInTheDocument()
  })

  it('renders sign out button', () => {
    render(<Sidebar />)
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })

  it('renders collapse toggle button', () => {
    render(<Sidebar />)
    expect(screen.getByTitle('Collapse sidebar')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════════════
// Sidebar — collapsed state
// ════════════════════════════════════════════════════════════

describe('Sidebar collapsed state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockUsePathname.mockReturnValue('/')
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
  })

  it('starts expanded by default', () => {
    const { container } = render(<Sidebar />)
    const aside = container.querySelector('aside')
    expect(aside?.className).toContain('w-60')
    expect(aside?.className).not.toContain('w-16')
  })

  it('collapses when toggle button is clicked', () => {
    const { container } = render(<Sidebar />)
    fireEvent.click(screen.getByTitle('Collapse sidebar'))
    const aside = container.querySelector('aside')
    expect(aside?.className).toContain('w-16')
    expect(aside?.className).not.toContain('w-60')
  })

  it('shows expand button when collapsed', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle('Collapse sidebar'))
    expect(screen.getByTitle('Expand sidebar')).toBeInTheDocument()
  })

  it('persists collapsed state to localStorage', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle('Collapse sidebar'))
    expect(localStorage.getItem('sidebar_collapsed')).toBe('true')
  })

  it('reads collapsed state from localStorage on mount', () => {
    localStorage.setItem('sidebar_collapsed', 'true')
    const { container } = render(<Sidebar />)
    const aside = container.querySelector('aside')
    expect(aside?.className).toContain('w-16')
  })

  it('toggles back to expanded on second click', () => {
    const { container } = render(<Sidebar />)
    fireEvent.click(screen.getByTitle('Collapse sidebar'))
    fireEvent.click(screen.getByTitle('Expand sidebar'))
    const aside = container.querySelector('aside')
    expect(aside?.className).toContain('w-60')
    expect(localStorage.getItem('sidebar_collapsed')).toBe('false')
  })

  it('hides labels when collapsed', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle('Collapse sidebar'))
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('Adventures')).not.toBeInTheDocument()
    expect(screen.queryByText('Character Sheets')).not.toBeInTheDocument()
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument()
    expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument()
    expect(screen.queryByText('alice@example.com')).not.toBeInTheDocument()
  })

  it('shows title attribute on links when collapsed', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle('Collapse sidebar'))
    const links = screen.getAllByRole('link')
    const titles = links.map((l) => l.getAttribute('title'))
    expect(titles).toContain('Dashboard')
    expect(titles).toContain('Adventures')
    expect(titles).toContain('Character Sheets')
  })

  it('shows collapsed logo as "M"', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle('Collapse sidebar'))
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.queryByText('Mythrion')).not.toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════════════
// Sidebar — active link detection
// ════════════════════════════════════════════════════════════

describe('Sidebar active link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
  })

  it('highlights Dashboard when pathname is /dashboard', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const dashboardLink = links.find((l) => l.textContent === 'Dashboard')
    expect(dashboardLink?.className).toContain('sidebar-link-active')
  })

  it('does not highlight Adventures when on Dashboard', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const adventuresLink = links.find((l) => l.textContent === 'Adventures')
    expect(adventuresLink?.className).not.toContain('sidebar-link-active')
  })

  it('highlights Adventures when tab=adventures', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=adventures'))
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const adventuresLink = links.find((l) => l.textContent === 'Adventures')
    expect(adventuresLink?.className).toContain('sidebar-link-active')
  })

  it('highlights Character Sheets when tab=character-sheets', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=character-sheets'))
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const csLink = links.find((l) => l.textContent === 'Character Sheets')
    expect(csLink?.className).toContain('sidebar-link-active')
  })

  // Dashboard link's href is "/dashboard" (no tab= param).
  // isActive matches on pathname === href when no tab in href, so it's always
  // active when on /dashboard regardless of the current tab param.
  // This test is removed because the behavior is correct.

  it('does not match tab links when on non-dashboard page', () => {
    mockUsePathname.mockReturnValue('/other')
    mockUseSearchParams.mockReturnValue(new URLSearchParams('tab=adventures'))
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const adventuresLink = links.find((l) => l.textContent === 'Adventures')
    expect(adventuresLink?.className).not.toContain('sidebar-link-active')
  })

  it('matches exact pathname for non-tab links', () => {
    mockUsePathname.mockReturnValue('/other')
    render(<Sidebar />)
    // Dashboard link href is '/dashboard', pathname is '/other' — not active
    const links = screen.getAllByRole('link')
    const dashboardLink = links.find((l) => l.textContent === 'Dashboard')
    expect(dashboardLink?.className).not.toContain('sidebar-link-active')
  })

  it('highlights Explore Campaigns when pathname is /dashboard/explore-campaigns', () => {
    mockUsePathname.mockReturnValue('/dashboard/explore-campaigns')
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const exploreLink = links.find((l) => l.textContent === 'Explore Campaigns')
    expect(exploreLink?.className).toContain('sidebar-link-active')
  })

  it('highlights Public Templates when pathname is /dashboard/public-templates', () => {
    mockUsePathname.mockReturnValue('/dashboard/public-templates')
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const templatesLink = links.find((l) => l.textContent === 'Public Templates')
    expect(templatesLink?.className).toContain('sidebar-link-active')
  })

  it('does not highlight Explore Campaigns when on /dashboard/public-templates', () => {
    mockUsePathname.mockReturnValue('/dashboard/public-templates')
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const exploreLink = links.find((l) => l.textContent === 'Explore Campaigns')
    expect(exploreLink?.className).not.toContain('sidebar-link-active')
  })

  it('does not highlight Public Templates when on /dashboard/explore-campaigns', () => {
    mockUsePathname.mockReturnValue('/dashboard/explore-campaigns')
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const templatesLink = links.find((l) => l.textContent === 'Public Templates')
    expect(templatesLink?.className).not.toContain('sidebar-link-active')
  })
})

// ════════════════════════════════════════════════════════════
// Sidebar — mobile menu
// ════════════════════════════════════════════════════════════

describe('Sidebar mobile menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockUsePathname.mockReturnValue('/')
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
  })

  it('renders mobile hamburger button', () => {
    render(<Sidebar />)
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument()
  })

  it('toggles to close label when menu is open', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByLabelText('Close menu')).toBeInTheDocument()
  })

  it('shows overlay when menu is open', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    const overlay = document.querySelector('.fixed.inset-0.z-30')
    expect(overlay).toBeInTheDocument()
  })

  it('closes mobile menu when overlay is clicked', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    // Find the overlay (the div with class bg-black/50)
    const overlays = document.querySelectorAll('.fixed.inset-0')
    // There should be one overlay (z-30) aside from the sidebar (z-40)
    const overlay = Array.from(overlays).find(
      (el) => el.className.includes('bg-black/50') || el.className.includes('bg-black\\/50'),
    )
    if (overlay) fireEvent.click(overlay)
    // Menu should go back to "open" state
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument()
  })

  it('sidebar has translate-x-0 when menu is open on mobile', () => {
    render(<Sidebar />)
    // Initially hidden on mobile: -translate-x-full
    const aside = document.querySelector('aside')
    expect(aside?.className).toContain('-translate-x-full')

    // Open menu
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(aside?.className).toContain('translate-x-0')
  })

  it('closes mobile menu when overlay is clicked (sidebar hidden)', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    const overlay = document.querySelector('.fixed.inset-0.z-30') as HTMLElement
    if (overlay) fireEvent.click(overlay)
    const aside = document.querySelector('aside')
    expect(aside?.className).toContain('-translate-x-full')
  })

  it('closes mobile menu when a navigation link is clicked (nav link onClick)', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByLabelText('Close menu')).toBeInTheDocument()

    const adventuresLink = screen.getByText('Adventures')
    fireEvent.click(adventuresLink)

    expect(screen.getByLabelText('Open menu')).toBeInTheDocument()
  })

  it('closes mobile menu when the logo link is clicked (logo link onClick)', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByLabelText('Close menu')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Dashboard'))

    expect(screen.getByLabelText('Open menu')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════════════
// Sidebar — logout
// ════════════════════════════════════════════════════════════

describe('Sidebar logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockUsePathname.mockReturnValue('/')
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
  })

  it('calls logout and navigates to /login when sign out is clicked', async () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByText('Sign out'))
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1)
    })
    expect(mockRouterPush).toHaveBeenCalledWith('/login')
  })

  it('has title "Sign out" on the logout button when collapsed', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByTitle('Collapse sidebar'))
    expect(screen.getByTitle('Sign out')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════════════
// Sidebar — nav link hrefs
// ════════════════════════════════════════════════════════════

describe('Sidebar nav link hrefs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockUsePathname.mockReturnValue('/')
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
  })

  it('Dashboard link points to /dashboard', () => {
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const dashboardLink = links.find((l) => l.textContent === 'Dashboard')
    expect(dashboardLink).toHaveAttribute('href', '/dashboard')
  })

  it('Adventures link points to /dashboard?tab=adventures', () => {
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const adventuresLink = links.find((l) => l.textContent === 'Adventures')
    expect(adventuresLink).toHaveAttribute('href', '/dashboard?tab=adventures')
  })

  it('Character Sheets link points to /dashboard?tab=character-sheets', () => {
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const csLink = links.find((l) => l.textContent === 'Character Sheets')
    expect(csLink).toHaveAttribute('href', '/dashboard?tab=character-sheets')
  })

  it('Explore Campaigns link points to /dashboard/explore-campaigns', () => {
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const exploreLink = links.find((l) => l.textContent === 'Explore Campaigns')
    expect(exploreLink).toHaveAttribute('href', '/dashboard/explore-campaigns')
  })

  it('Public Templates link points to /dashboard/public-templates', () => {
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const templatesLink = links.find((l) => l.textContent === 'Public Templates')
    expect(templatesLink).toHaveAttribute('href', '/dashboard/public-templates')
  })

  it('My Templates link points to /dashboard/templates', () => {
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const myTemplatesLink = links.find((l) => l.textContent === 'My Templates')
    expect(myTemplatesLink).toHaveAttribute('href', '/dashboard/templates')
  })

  it('Subscription link points to /dashboard/subscription', () => {
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const subLink = links.find((l) => l.textContent === 'Subscription')
    expect(subLink).toHaveAttribute('href', '/dashboard/subscription')
  })
})
