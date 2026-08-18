import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ── next/navigation override (per-test search params + captured router) ──
const mockRouterReplace = vi.fn()
let searchParamsString = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockRouterReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(searchParamsString),
  usePathname: () => '/',
}))

vi.mock('next/link', () => ({
  default: ({ children, href, onClick, ...rest }: { children: React.ReactNode; href: string; onClick?: (e: unknown) => void }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuth(),
}))

vi.mock('@/components/dashboard', () => ({
  Sidebar: () => <div>Sidebar</div>,
  GracePeriodBanner: () => <div>GracePeriodBanner</div>,
}))

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const mockUseSubscription = vi.fn()
vi.mock('@/lib/subscription-context', () => ({
  useSubscription: () => mockUseSubscription(),
}))

import { api } from '@/lib/api'
import DashboardLayout from '@/app/dashboard/layout'
import DashboardPage from '@/app/dashboard/page'

const mockApiGet = vi.mocked(api.get)

const baseUser = {
  id: 'user-1',
  email: 'alice@example.com',
  displayName: 'Alice',
  onboardingComplete: true,
  isAdmin: false,
  isEarlyAccess: false,
  language: 'en',
  twoFactorEnabled: false,
  emailVerified: true,
  hasPassword: true,
}

function setAuth(overrides: { user?: typeof baseUser | null; loading?: boolean } = {}) {
  mockAuth.mockReturnValue({
    user: overrides.user !== undefined ? overrides.user : baseUser,
    loading: overrides.loading !== undefined ? overrides.loading : false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    completeOnboarding: vi.fn(),
    verifyTwoFactor: vi.fn(),
    refreshProfile: vi.fn(),
  })
}

function setSub(hasActiveSubscription: boolean = true) {
  mockUseSubscription.mockReturnValue({
    subscription: null,
    loading: false,
    hasActiveSubscription,
    refresh: vi.fn(),
  })
}

interface AdventureSummary {
  id: string
  name: string
  campaign: string
  synopsis: string | null
  maxPlayers: number
  ownerId: string
  role?: string
  joinedAt?: string
  createdAt: string
  updatedAt: string
}

interface SheetSummary {
  id: string
  characterName: string
  adventure: { id: string; name: string; campaign: string } | null
  template: { id: string; name: string }
  createdAt: string
  assignedMember?: { id: string; userId: string; user: { id: string; displayName: string | null; email: string } } | null
}

function mockApiData(adventures: AdventureSummary[] = [], sheets: SheetSummary[] = []) {
  mockApiGet.mockImplementation(async (url: string) => {
    if (url === '/adventures') return adventures
    if (url === '/character-sheets') return sheets
    return []
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  searchParamsString = ''
  setAuth()
  setSub(true)
  mockApiData()
})

// ════════════════════════════════════════════════════════════
// DashboardLayout (app/dashboard/layout.tsx)
// ════════════════════════════════════════════════════════════

describe('DashboardLayout', () => {
  it('shows skeletons while auth is loading and does not redirect', () => {
    setAuth({ loading: true })
    const { container } = render(
      <DashboardLayout>
        <div>child-content</div>
      </DashboardLayout>,
    )
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThanOrEqual(4)
    expect(screen.queryByText('child-content')).not.toBeInTheDocument()
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })

  it('redirects signed-out users to /login', () => {
    setAuth({ user: null })
    render(
      <DashboardLayout>
        <div>child-content</div>
      </DashboardLayout>,
    )
    expect(mockRouterReplace).toHaveBeenCalledWith('/login')
    expect(screen.getByText('Checking access...')).toBeInTheDocument()
    expect(screen.queryByText('child-content')).not.toBeInTheDocument()
  })

  it('redirects unverified users to /verify-email', () => {
    setAuth({ user: { ...baseUser, emailVerified: false } })
    render(
      <DashboardLayout>
        <div>child-content</div>
      </DashboardLayout>,
    )
    expect(mockRouterReplace).toHaveBeenCalledWith('/verify-email')
    expect(screen.getByText('Checking access...')).toBeInTheDocument()
  })

  it('redirects users with incomplete onboarding to /onboarding', () => {
    setAuth({ user: { ...baseUser, onboardingComplete: false } })
    render(
      <DashboardLayout>
        <div>child-content</div>
      </DashboardLayout>,
    )
    expect(mockRouterReplace).toHaveBeenCalledWith('/onboarding')
    expect(screen.getByText('Checking access...')).toBeInTheDocument()
  })

  it('renders sidebar, banner, and children for a fully-authorized user', () => {
    render(
      <DashboardLayout>
        <div>child-content</div>
      </DashboardLayout>,
    )
    expect(screen.getByText('child-content')).toBeInTheDocument()
    expect(screen.getByText('Sidebar')).toBeInTheDocument()
    expect(screen.getByText('GracePeriodBanner')).toBeInTheDocument()
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════
// DashboardPage (app/dashboard/page.tsx)
// ════════════════════════════════════════════════════════════

describe('DashboardPage', () => {
  it('shows loading skeletons while the two lists fetch', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {}))
    const { container } = render(<DashboardPage />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThanOrEqual(3)
  })

  it('shows the subscribed empty state for campaigns', async () => {
    mockApiData([], [])
    setSub(true)
    render(<DashboardPage />)
    expect(await screen.findByText('No campaigns yet')).toBeInTheDocument()
    expect(
      screen.getByText('Your journey begins with a single step. Create your first campaign and gather your party.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create your first campaign' })).toHaveAttribute(
      'href',
      '/dashboard/adventures/new',
    )
    // Header action for subscribed users
    expect(screen.getByRole('link', { name: 'New Campaign' })).toHaveAttribute(
      'href',
      '/dashboard/adventures/new',
    )
  })

  it('shows the upgrade empty state for campaigns when not subscribed', async () => {
    mockApiData([], [])
    setSub(false)
    render(<DashboardPage />)
    expect(await screen.findByText('No campaigns yet')).toBeInTheDocument()
    expect(
      screen.getByText('Upgrade to a paid plan to create your own campaigns and invite your party.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Plans →' })).toHaveAttribute('href', '/pricing')
    // Header action for non-subscribed users
    expect(screen.getByRole('link', { name: 'Upgrade to Create' })).toHaveAttribute('href', '/pricing')
  })

  it('renders adventure cards with GM role, synopsis and counts', async () => {
    mockApiData(
      [
        {
          id: 'a1',
          name: 'Alpha',
          campaign: 'World A',
          synopsis: 'A thrilling synopsis',
          maxPlayers: 4,
          ownerId: 'u1',
          role: 'GM',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
      [],
    )
    render(<DashboardPage />)
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('World A')).toBeInTheDocument()
    expect(screen.getByText('A thrilling synopsis')).toBeInTheDocument()
    expect(screen.getByText('4 max')).toBeInTheDocument()
    expect(screen.getByText('GM')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Alpha/ })).toHaveAttribute(
      'href',
      '/dashboard/adventures/a1',
    )
  })

  it('renders adventure cards with non-GM role and no synopsis', async () => {
    mockApiData(
      [
        {
          id: 'a2',
          name: 'Beta',
          campaign: 'World B',
          synopsis: null,
          maxPlayers: 5,
          ownerId: 'u1',
          role: 'Player',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'a3',
          name: 'Gamma',
          campaign: 'World C',
          synopsis: null,
          maxPlayers: 3,
          ownerId: 'u1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
      [],
    )
    render(<DashboardPage />)
    expect(await screen.findByText('Beta')).toBeInTheDocument()
    expect(screen.getAllByText('No synopsis yet.')).toHaveLength(2)
    expect(screen.getByText('Player')).toBeInTheDocument()
    expect(screen.getByText('5 max')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
  })

  it('renders the character-sheets tab with a standalone sheet', async () => {
    searchParamsString = 'tab=character-sheets'
    mockApiData([], [
      {
        id: 's1',
        characterName: 'Hero',
        template: { id: 't1', name: 'Warrior' },
        adventure: null,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ])
    render(<DashboardPage />)
    expect(await screen.findByText('Hero')).toBeInTheDocument()
    expect(screen.getByText('Warrior')).toBeInTheDocument()
    expect(screen.getByText('Standalone')).toBeInTheDocument()
    expect(screen.getByText('No campaign')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New Character Sheet' })).toHaveAttribute(
      'href',
      '/dashboard/character-sheets/new',
    )
    expect(screen.getByRole('link', { name: /Hero/ })).toHaveAttribute(
      'href',
      '/dashboard/character-sheets/s1',
    )
  })

  it('renders a sheet linked to an adventure', async () => {
    searchParamsString = 'tab=character-sheets'
    mockApiData([], [
      {
        id: 's2',
        characterName: 'Mage',
        template: { id: 't2', name: 'Arcanist' },
        adventure: { id: 'a1', name: 'Alpha', campaign: 'World A' },
        createdAt: '2024-01-01T00:00:00Z',
      },
    ])
    render(<DashboardPage />)
    expect(await screen.findByText('Mage')).toBeInTheDocument()
    expect(screen.getByText('Arcanist')).toBeInTheDocument()
    expect(screen.getByText('World A')).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Standalone')).not.toBeInTheDocument()
  })

  it('shows an "Assigned to you" badge when a sheet is assigned to the current user', async () => {
    searchParamsString = 'tab=character-sheets'
    mockApiData([], [
      {
        id: 's3',
        characterName: 'Rogue',
        template: { id: 't3', name: 'Shadow' },
        adventure: { id: 'a1', name: 'Alpha', campaign: 'World A' },
        createdAt: '2024-01-01T00:00:00Z',
        assignedMember: {
          id: 'cm-1',
          userId: 'user-1',
          user: { id: 'user-1', displayName: 'Alice', email: 'alice@example.com' },
        },
      },
    ])
    render(<DashboardPage />)
    expect(await screen.findByText('Rogue')).toBeInTheDocument()
    expect(screen.getByText('Assigned to you')).toBeInTheDocument()
  })

  it('shows an "Assigned to {{name}}" badge when a sheet is assigned to another user', async () => {
    searchParamsString = 'tab=character-sheets'
    mockApiData([], [
      {
        id: 's4',
        characterName: 'Cleric',
        template: { id: 't4', name: 'Healer' },
        adventure: { id: 'a1', name: 'Alpha', campaign: 'World A' },
        createdAt: '2024-01-01T00:00:00Z',
        assignedMember: {
          id: 'cm-2',
          userId: 'user-2',
          user: { id: 'user-2', displayName: 'Bob', email: 'bob@example.com' },
        },
      },
    ])
    render(<DashboardPage />)
    expect(await screen.findByText('Cleric')).toBeInTheDocument()
    expect(screen.getByText('Assigned to Bob')).toBeInTheDocument()
    expect(screen.queryByText('Assigned to you')).not.toBeInTheDocument()
  })

  it('does not show an assignment badge when a sheet is unassigned', async () => {
    searchParamsString = 'tab=character-sheets'
    mockApiData([], [
      {
        id: 's5',
        characterName: 'Fighter',
        template: { id: 't5', name: 'Knight' },
        adventure: { id: 'a1', name: 'Alpha', campaign: 'World A' },
        createdAt: '2024-01-01T00:00:00Z',
        assignedMember: null,
      },
    ])
    render(<DashboardPage />)
    expect(await screen.findByText('Fighter')).toBeInTheDocument()
    expect(screen.queryByText(/Assigned to/)).not.toBeInTheDocument()
  })

  it('shows the empty state for the character-sheets tab', async () => {
    searchParamsString = 'tab=character-sheets'
    mockApiData([], [])
    render(<DashboardPage />)
    expect(await screen.findByText('No character sheets yet')).toBeInTheDocument()
    expect(
      screen.getByText('Create your first character sheet from a template and start your campaign.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create your first sheet' })).toHaveAttribute(
      'href',
      '/dashboard/character-sheets/new',
    )
  })

  it('renders the active tab from the URL search params on re-render', async () => {
    searchParamsString = 'tab=character-sheets'
    mockApiData([], [])
    const { rerender } = render(<DashboardPage />)
    expect(await screen.findByText('No character sheets yet')).toBeInTheDocument()

    searchParamsString = 'tab=adventures'
    rerender(<DashboardPage />)
    expect(await screen.findByText('No campaigns yet')).toBeInTheDocument()
  })

  it('falls back to the empty state when the api calls reject', async () => {
    mockApiGet.mockImplementation(async () => {
      throw new Error('boom')
    })
    render(<DashboardPage />)
    expect(await screen.findByText('No campaigns yet')).toBeInTheDocument()
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
  })
})
