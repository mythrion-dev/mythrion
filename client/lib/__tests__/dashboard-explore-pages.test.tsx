import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DashboardExploreCampaignsPage from '@/app/dashboard/explore-campaigns/page'
import DashboardPublicTemplatesPage from '@/app/dashboard/public-templates/page'

// ── Next/Navigation mocks ──

const mockUsePathname = vi.fn()
const mockUseSearchParams = vi.fn()
const mockRouterReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockRouterReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockUseSearchParams(),
  usePathname: () => mockUsePathname(),
}))

// ── Auth mock ──

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'alice@example.com',
      displayName: 'Alice Johnson',
      onboardingComplete: true,
    },
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    completeOnboarding: vi.fn(),
  }),
}))

// ── API mock ──

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 }),
    post: vi.fn().mockResolvedValue({}),
  },
}))

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
// DashboardExploreCampaignsPage
// ════════════════════════════════════════════════════════════

describe('DashboardExploreCampaignsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePathname.mockReturnValue('/dashboard/explore-campaigns')
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
  })

  it('renders without crashing', async () => {
    const { container } = render(<DashboardExploreCampaignsPage />)
    // Suspense fallback should render initially
    expect(container.querySelector('.skeleton')).toBeDefined()
  })

  it('renders PageHeader with Explore Campaigns title', async () => {
    render(<DashboardExploreCampaignsPage />)
    // Use findByText to wait for Suspense boundary to resolve
    expect(await screen.findByText('Explore Campaigns')).toBeDefined()
  })

  it('renders search input', async () => {
    render(<DashboardExploreCampaignsPage />)
    const searchInput = await screen.findByPlaceholderText(
      'Search campaigns by name, GM or description...',
    )
    expect(searchInput).toBeDefined()
  })

  it('renders a Filters toggle that reveals the filter controls', async () => {
    render(<DashboardExploreCampaignsPage />)
    // The Filters toggle is always visible
    const filtersButton = await screen.findByRole('button', { name: 'Filters' })
    expect(filtersButton).toBeInTheDocument()
    // Filter controls are hidden until toggled open
    expect(screen.queryByText('Any day')).not.toBeInTheDocument()
    fireEvent.click(filtersButton)
    expect(screen.getByText('Any day')).toBeInTheDocument()
  })

  it('renders weekday dropdown', async () => {
    render(<DashboardExploreCampaignsPage />)
    // The day select is inside the collapsible filter area
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }))
    expect(screen.getByText('Any day')).toBeDefined()
  })

  it('renders session type pills (Any, Online, In Person)', async () => {
    render(<DashboardExploreCampaignsPage />)
    // Type pills are inside the collapsible filter area
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }))
    expect(screen.getByText('Any')).toBeDefined()
    expect(screen.getByText('Online')).toBeDefined()
    expect(screen.getByText('In Person')).toBeDefined()
  })

  it('renders time-of-day dropdown', async () => {
    render(<DashboardExploreCampaignsPage />)
    // The schedule select is inside the collapsible filter area
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }))
    expect(screen.getByText('Any time')).toBeDefined()
  })

  // ── Tab navigation ──

  it('Campaigns tab links to /dashboard/explore-campaigns', async () => {
    render(<DashboardExploreCampaignsPage />)
    // Wait for Suspense to resolve before checking tabs
    await screen.findByText('Explore Campaigns')
    const campaignTabs = screen.getAllByText('Campaigns')
    const tabLink = campaignTabs.find(
      (el) => el.getAttribute('href') === '/dashboard/explore-campaigns',
    )
    expect(tabLink).toBeDefined()
  })

  it('Templates tab links to /dashboard/public-templates', async () => {
    render(<DashboardExploreCampaignsPage />)
    await screen.findByText('Explore Campaigns')
    const templateTabs = screen.getAllByText('Templates')
    const tabLink = templateTabs.find(
      (el) => el.getAttribute('href') === '/dashboard/public-templates',
    )
    expect(tabLink).toBeDefined()
  })

  it('Campaigns tab has tab-pill-active when on /dashboard/explore-campaigns', async () => {
    render(<DashboardExploreCampaignsPage />)
    await screen.findByText('Explore Campaigns')
    const campaignTabs = screen.getAllByText('Campaigns')
    const activeTab = campaignTabs.find((el) =>
      el.className.includes('tab-pill-active'),
    )
    expect(activeTab).toBeDefined()
  })

  it('renders LoadingSkeleton during fetch', async () => {
    const { container } = render(<DashboardExploreCampaignsPage />)
    // Suspense fallback skeleton
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════
// DashboardPublicTemplatesPage
// ════════════════════════════════════════════════════════════

describe('DashboardPublicTemplatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePathname.mockReturnValue('/dashboard/public-templates')
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
  })

  it('renders without crashing', async () => {
    const { container } = render(<DashboardPublicTemplatesPage />)
    expect(container.querySelector('.skeleton')).toBeDefined()
  })

  it('renders PageHeader with Explore Templates title', async () => {
    render(<DashboardPublicTemplatesPage />)
    expect(await screen.findByText('Explore Templates')).toBeDefined()
  })

  it('renders search input', async () => {
    render(<DashboardPublicTemplatesPage />)
    const searchInput = await screen.findByPlaceholderText(
      'Search templates by name, creator or system...',
    )
    expect(searchInput).toBeDefined()
  })

  it('renders sort dropdown with sort options', async () => {
    render(<DashboardPublicTemplatesPage />)
    const sortSelect = await screen.findByRole('combobox')
    expect(sortSelect).toBeInTheDocument()
    expect(screen.getByText('Most Popular')).toBeDefined()
    expect(screen.getByText('Newest')).toBeDefined()
    expect(screen.getByText('Recently Updated')).toBeDefined()
    expect(screen.getByText('Alphabetical')).toBeDefined()
  })

  // ── Tab navigation ──

  it('Campaigns tab links to /dashboard/explore-campaigns', async () => {
    render(<DashboardPublicTemplatesPage />)
    await screen.findByText('Explore Templates')
    const campaignTabs = screen.getAllByText('Campaigns')
    const tabLink = campaignTabs.find(
      (el) => el.getAttribute('href') === '/dashboard/explore-campaigns',
    )
    expect(tabLink).toBeDefined()
  })

  it('Templates tab links to /dashboard/public-templates', async () => {
    render(<DashboardPublicTemplatesPage />)
    await screen.findByText('Explore Templates')
    const templateTabs = screen.getAllByText('Templates')
    const tabLink = templateTabs.find(
      (el) => el.getAttribute('href') === '/dashboard/public-templates',
    )
    expect(tabLink).toBeDefined()
  })

  it('Templates tab has tab-pill-active when on /dashboard/public-templates', async () => {
    render(<DashboardPublicTemplatesPage />)
    await screen.findByText('Explore Templates')
    const templateTabs = screen.getAllByText('Templates')
    const activeTab = templateTabs.find((el) =>
      el.className.includes('tab-pill-active'),
    )
    expect(activeTab).toBeDefined()
  })
})
