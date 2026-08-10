import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ── Next/Navigation mocks ──
// redirect() is asserted directly on the redirect-only pages; useRouter.replace
// is asserted on the layout (via VerifiedGate) and the useEffect redirect pages.
// vi.hoisted guarantees the fns exist before the (hoisted) vi.mock factories run.

const { mockRedirect, mockUseParams, mockRouterReplace, mockUseAuth } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockUseParams: vi.fn(),
  mockRouterReplace: vi.fn(),
  mockUseAuth: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  useRouter: () => ({
    push: vi.fn(),
    replace: mockRouterReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  useParams: () => mockUseParams(),
}))

// ── Auth mock ──

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

// ── Page imports ──

import CommunityLayout from '@/app/community/layout'
import CommunityPage from '@/app/community/page'
import CommunityTemplatesRedirect from '@/app/community/templates/page'
import CommunityAdventuresRedirect from '@/app/community/adventures/page'
import TemplatePreviewRedirect from '@/app/community/templates/[id]/preview/page'
import AdventureDetailRedirect from '@/app/community/adventures/[id]/page'

const baseUser = {
  id: 'user-1',
  email: 'alice@example.com',
  displayName: 'Alice',
  emailVerified: true,
}

function setAuth(overrides: { user?: typeof baseUser | null; loading?: boolean } = {}) {
  mockUseAuth.mockReturnValue({
    user: overrides.user !== undefined ? overrides.user : baseUser,
    loading: overrides.loading !== undefined ? overrides.loading : false,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setAuth()
  mockUseParams.mockReturnValue({ id: 'abc123' })
})

// ════════════════════════════════════════════════════════════
// CommunityLayout (app/community/layout.tsx)
// ════════════════════════════════════════════════════════════

describe('CommunityLayout', () => {
  it('shows the VerifiedGate loading spinner while auth is loading', () => {
    setAuth({ loading: true })
    const { container } = render(
      <CommunityLayout>
        <span>layout-child</span>
      </CommunityLayout>,
    )
    expect(container.querySelector('.animate-spin')).not.toBeNull()
    expect(screen.queryByText('layout-child')).not.toBeInTheDocument()
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })

  it('redirects to /login when there is no signed-in user', async () => {
    setAuth({ user: null })
    render(
      <CommunityLayout>
        <span>layout-child</span>
      </CommunityLayout>,
    )
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/login'))
    expect(screen.queryByText('layout-child')).not.toBeInTheDocument()
  })

  it('redirects to /verify-email when the user is not verified', async () => {
    setAuth({ user: { ...baseUser, emailVerified: false } })
    render(
      <CommunityLayout>
        <span>layout-child</span>
      </CommunityLayout>,
    )
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/verify-email'))
    expect(screen.queryByText('layout-child')).not.toBeInTheDocument()
  })

  it('renders children through VerifiedGate for a verified user', () => {
    render(
      <CommunityLayout>
        <span>layout-child</span>
      </CommunityLayout>,
    )
    expect(screen.getByText('layout-child')).toBeInTheDocument()
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════
// CommunityPage (app/community/page.tsx)
// ════════════════════════════════════════════════════════════

describe('CommunityPage', () => {
  it('redirects to /dashboard/explore-campaigns', () => {
    CommunityPage()
    expect(mockRedirect).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard/explore-campaigns')
  })
})

// ════════════════════════════════════════════════════════════
// CommunityTemplatesRedirect (app/community/templates/page.tsx)
// ════════════════════════════════════════════════════════════

describe('CommunityTemplatesRedirect', () => {
  it('redirects to /dashboard/public-templates', () => {
    CommunityTemplatesRedirect()
    expect(mockRedirect).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard/public-templates')
  })
})

// ════════════════════════════════════════════════════════════
// CommunityAdventuresRedirect (app/community/adventures/page.tsx)
// ════════════════════════════════════════════════════════════

describe('CommunityAdventuresRedirect', () => {
  it('redirects to /dashboard/explore-campaigns', () => {
    CommunityAdventuresRedirect()
    expect(mockRedirect).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard/explore-campaigns')
  })
})

// ════════════════════════════════════════════════════════════
// TemplatePreviewRedirect (app/community/templates/[id]/preview/page.tsx)
// ════════════════════════════════════════════════════════════

describe('TemplatePreviewRedirect', () => {
  it('redirects to the dashboard template preview for the current id', async () => {
    mockUseParams.mockReturnValue({ id: 'tpl-42' })
    render(<TemplatePreviewRedirect />)
    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith(
        '/dashboard/public-templates/tpl-42/preview',
      ),
    )
  })
})

// ════════════════════════════════════════════════════════════
// AdventureDetailRedirect (app/community/adventures/[id]/page.tsx)
// ════════════════════════════════════════════════════════════

describe('AdventureDetailRedirect', () => {
  it('redirects to the dashboard adventure detail for the current id', async () => {
    mockUseParams.mockReturnValue({ id: 'adv-7' })
    render(<AdventureDetailRedirect />)
    await waitFor(() =>
      expect(mockRouterReplace).toHaveBeenCalledWith(
        '/dashboard/explore-campaigns/adv-7',
      ),
    )
  })
})
