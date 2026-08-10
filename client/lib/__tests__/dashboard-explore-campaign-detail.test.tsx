import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// ── next/navigation (adds useParams; overrides setup.ts) ────────────────────
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'adv-1' }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// ── next/link ───────────────────────────────────────────────────────────────
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// ── Auth mock ───────────────────────────────────────────────────────────────
const mockAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuth(),
}))

// ── API mock ────────────────────────────────────────────────────────────────
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

// ── PageNav uses navigation-context; keep it inert ─────────────────────────
vi.mock('@/lib/breadcrumb', () => ({
  PageNav: () => <nav>PageNav</nav>,
}))

// ── JoinRequestModal mock (real <dialog> content is a11y-hidden in jsdom) ──
const modalProps: {
  current: {
    open: boolean
    message: string
    onMessageChange: (v: string) => void
    onCancel: () => void
    onConfirm: () => void
    loading: boolean
    error: string | null
  } | null
} = { current: null }
vi.mock('@/components/community/JoinRequestModal', () => ({
  JoinRequestModal: (props: {
    open: boolean
    message: string
    onMessageChange: (v: string) => void
    onCancel: () => void
    onConfirm: () => void
    loading: boolean
    error: string | null
  }) => {
    modalProps.current = props
    if (!props.open) return null
    return (
      <div data-testid="join-modal">
        <textarea
          aria-label="modal-message"
          value={props.message}
          onChange={(e) => props.onMessageChange(e.target.value)}
        />
        {props.loading && <span>Sending...</span>}
        {props.error && <span>{props.error}</span>}
        <button type="button" onClick={props.onCancel}>
          Cancel
        </button>
        <button type="button" onClick={props.onConfirm}>
          Send Request
        </button>
      </div>
    )
  },
}))

import { api } from '@/lib/api'
import AdventureDetailPage from '@/app/dashboard/explore-campaigns/[id]/page'

const mockApiGet = vi.mocked(api.get)
const mockApiPost = vi.mocked(api.post)

// ── Fixtures ────────────────────────────────────────────────────────────────
const baseUser = {
  id: 'user-1',
  email: 'alice@example.com',
  displayName: 'Alice',
}

const baseAdventure = {
  id: 'adv-1',
  name: 'The Dragon',
  campaign: 'World A',
  synopsis: 'A thrilling synopsis',
  maxPlayers: 4,
  ownerId: 'u1',
  gmDisplayName: 'Gandalf',
  playerCount: 2,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  sessionWeekday: 'Monday',
  sessionTime: '18:00',
  sessionType: 'ONLINE',
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function setAuth(user: typeof baseUser | null = baseUser) {
  mockAuth.mockReturnValue({
    user,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    completeOnboarding: vi.fn(),
    verifyTwoFactor: vi.fn(),
    refreshProfile: vi.fn(),
  })
}

function mockApiData(opts: {
  adventure?: unknown
  members?: unknown[]
  joinRequests?: unknown[]
} = {}) {
  const { adventure = baseAdventure, members = [], joinRequests = [] } = opts
  mockApiGet.mockImplementation(async (url: string) => {
    if (url === '/public/adventures/adv-1') return adventure
    if (url === '/adventures/adv-1/members') return members
    if (url === '/adventures/adv-1/join-requests') return joinRequests
    return []
  })
}

function createdDateLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

async function openJoinModal() {
  fireEvent.click(await screen.findByRole('button', { name: 'Request to Join' }))
  expect(modalProps.current?.open).toBe(true)
}

beforeEach(() => {
  vi.clearAllMocks()
  setAuth()
  modalProps.current = null
})

describe('AdventureDetailPage (explore-campaigns/[id])', () => {
  it('shows the loading skeleton while fetching', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {}))
    const { container } = render(<AdventureDetailPage />)
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0)
  })

  it('shows the not-found empty state when the fetch fails', async () => {
    mockApiGet.mockRejectedValue(new Error('boom'))
    render(<AdventureDetailPage />)
    expect(await screen.findByText('Campaign not found')).toBeInTheDocument()
    expect(
      screen.getByText("The campaign you're looking for doesn't exist or has been removed."),
    ).toBeInTheDocument()
  })

  it('falls back to the generic message when the fetch rejection is not an Error', async () => {
    mockApiGet.mockRejectedValue('oops')
    render(<AdventureDetailPage />)
    expect(await screen.findByText('Campaign not found')).toBeInTheDocument()
  })

  it('shows the empty state when the adventure payload is null', async () => {
    mockApiData({ adventure: null })
    render(<AdventureDetailPage />)
    expect(await screen.findByText('Campaign not found')).toBeInTheDocument()
  })

  it('renders the full detail with session info and the details grid', async () => {
    mockApiData()
    render(<AdventureDetailPage />)
    expect(await screen.findByText('The Dragon')).toBeInTheDocument()
    expect(screen.getAllByText('World A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('A thrilling synopsis')).toBeInTheDocument()
    expect(screen.getByText('Session Information')).toBeInTheDocument()
    expect(screen.getByText('Day:')).toBeInTheDocument()
    expect(screen.getByText('Monday')).toBeInTheDocument()
    expect(screen.getByText('Time:')).toBeInTheDocument()
    expect(screen.getByText('6:00 PM')).toBeInTheDocument()
    expect(screen.getByText('Format:')).toBeInTheDocument()
    expect(screen.getByText('🌐 Online')).toBeInTheDocument()
    expect(screen.getByText('2 / 4')).toBeInTheDocument()
    expect(screen.getByText('Gandalf')).toBeInTheDocument()
    expect(screen.getByText('Campaign')).toBeInTheDocument()
    expect(screen.getByText(createdDateLabel('2025-01-01T00:00:00Z'))).toBeInTheDocument()
  })

  it('renders an in-person session type', async () => {
    mockApiData({
      adventure: { ...baseAdventure, sessionWeekday: null, sessionTime: null, sessionType: 'IN_PERSON' },
    })
    render(<AdventureDetailPage />)
    expect(await screen.findByText('📍 In Person')).toBeInTheDocument()
    expect(screen.queryByText('Session schedule not defined')).not.toBeInTheDocument()
  })

  it('renders the time when only sessionTime is present', async () => {
    mockApiData({ adventure: { ...baseAdventure, sessionWeekday: null, sessionType: null } })
    render(<AdventureDetailPage />)
    expect(await screen.findByText('Time:')).toBeInTheDocument()
    expect(screen.getByText('6:00 PM')).toBeInTheDocument()
  })

  it('shows the no-session-schedule message when session info is missing', async () => {
    setAuth(null)
    mockApiData({
      adventure: { ...baseAdventure, sessionWeekday: null, sessionTime: null, sessionType: null },
    })
    render(<AdventureDetailPage />)
    expect(await screen.findByText('Session schedule not defined')).toBeInTheDocument()
  })

  it('falls back to Unknown GM, ? players and no-synopsis text', async () => {
    setAuth(null)
    mockApiData({
      adventure: {
        ...baseAdventure,
        gmDisplayName: null,
        playerCount: null,
        synopsis: null,
        sessionWeekday: null,
        sessionTime: null,
        sessionType: null,
      },
    })
    render(<AdventureDetailPage />)
    expect(await screen.findByText('Unknown')).toBeInTheDocument()
    expect(screen.getByText('? / 4')).toBeInTheDocument()
    expect(screen.getByText('No synopsis provided.')).toBeInTheDocument()
  })

  it('shows the Go to Dashboard link for a member', async () => {
    mockApiData({ members: [{ id: 'm1', userId: 'user-1', role: 'GM' }], joinRequests: [] })
    render(<AdventureDetailPage />)
    const link = await screen.findByRole('link', { name: 'Go to Dashboard' })
    expect(link).toHaveAttribute('href', '/dashboard/adventures/adv-1')
    expect(screen.queryByRole('button', { name: 'Request to Join' })).not.toBeInTheDocument()
  })

  it('shows the Request Pending badge when a join request is pending', async () => {
    mockApiData({ members: [], joinRequests: [{ id: 'j1', status: 'pending' }] })
    render(<AdventureDetailPage />)
    expect(await screen.findByText('Request Pending')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Request to Join' })).not.toBeInTheDocument()
  })

  it('shows the sign-in link for signed-out users', async () => {
    setAuth(null)
    mockApiData()
    render(<AdventureDetailPage />)
    const link = await screen.findByRole('link', { name: 'Sign in to join' })
    expect(link).toHaveAttribute('href', '/login')
  })

  it('sends a join request and shows the success state', async () => {
    mockApiPost.mockResolvedValue({ id: 'j1' })
    mockApiData()
    render(<AdventureDetailPage />)
    await openJoinModal()
    fireEvent.change(screen.getByLabelText('modal-message'), { target: { value: 'Hi GM!' } })
    expect(modalProps.current?.message).toBe('Hi GM!')
    fireEvent.click(screen.getByRole('button', { name: 'Send Request' }))
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/adventures/adv-1/join-requests', {
        message: 'Hi GM!',
      })
    })
    expect(await screen.findByText('Join request sent successfully!')).toBeInTheDocument()
    expect(screen.getByText('Request Pending')).toBeInTheDocument()
    expect(modalProps.current?.open).toBe(false)
  })

  it('shows the sending state while the join request is in flight', async () => {
    mockApiPost.mockImplementation(
      () => new Promise((res) => setTimeout(() => res({ id: 'j1' }), 50)),
    )
    mockApiData()
    render(<AdventureDetailPage />)
    await openJoinModal()
    fireEvent.click(screen.getByRole('button', { name: 'Send Request' }))
    expect(screen.getByText('Sending...')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Sending...')).not.toBeInTheDocument())
  })

  it('shows an error and keeps the dialog open when the join request fails', async () => {
    mockApiPost.mockRejectedValue(new Error('join boom'))
    mockApiData()
    render(<AdventureDetailPage />)
    await openJoinModal()
    fireEvent.click(screen.getByRole('button', { name: 'Send Request' }))
    expect(await screen.findByText('join boom')).toBeInTheDocument()
    expect(modalProps.current?.open).toBe(true)
  })

  it('falls back to the generic message when the join failure is not an Error', async () => {
    mockApiPost.mockRejectedValue('oops')
    mockApiData()
    render(<AdventureDetailPage />)
    await openJoinModal()
    fireEvent.click(screen.getByRole('button', { name: 'Send Request' }))
    expect(await screen.findByText('Failed to send join request')).toBeInTheDocument()
    expect(modalProps.current?.open).toBe(true)
  })

  it('closes the join form via cancel and clears the message', async () => {
    mockApiData()
    render(<AdventureDetailPage />)
    await openJoinModal()
    fireEvent.change(screen.getByLabelText('modal-message'), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(modalProps.current?.open).toBe(false)
    await openJoinModal()
    expect(modalProps.current?.message).toBe('')
  })

  it('ignores member fetch errors and still offers the join button', async () => {
    mockApiGet.mockImplementation(async (url: string) => {
      if (url === '/public/adventures/adv-1') return baseAdventure
      if (url === '/adventures/adv-1/members') throw new Error('no access')
      if (url === '/adventures/adv-1/join-requests') return []
      return []
    })
    render(<AdventureDetailPage />)
    expect(await screen.findByRole('button', { name: 'Request to Join' })).toBeInTheDocument()
  })

  it('ignores join-request fetch errors', async () => {
    mockApiGet.mockImplementation(async (url: string) => {
      if (url === '/public/adventures/adv-1') return baseAdventure
      if (url === '/adventures/adv-1/members') return []
      if (url === '/adventures/adv-1/join-requests') throw new Error('boom')
      return []
    })
    render(<AdventureDetailPage />)
    expect(await screen.findByRole('button', { name: 'Request to Join' })).toBeInTheDocument()
  })
})
