import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const mockUseSubscription = vi.fn()
vi.mock('@/lib/subscription-context', () => ({
  useSubscription: () => mockUseSubscription(),
}))

vi.mock('@/components/templates/TemplateCard', () => ({
  TemplateCard: (props: Record<string, unknown>) => (
    <div data-testid="template-card">
      <span>{props.name as string}</span>
      <span>{String(props.attributeCount)}</span>
      <span>{String(props.skillCount)}</span>
      <span>{String(props.useCount)}</span>
      <span>{String(props.isPublic)}</span>
    </div>
  ),
}))

import { api } from '@/lib/api'
import TemplatesPage from '@/app/dashboard/templates/page'

const mockApiGet = vi.mocked(api.get)

const baseTemplate = {
  id: 't1',
  name: 'My Template',
  description: 'A description',
  campaign: 'My Campaign',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  useCount: 3,
  isPublic: true,
  _count: { attributes: 2, templateSkills: 4 },
}

function setSub(hasActiveSubscription: boolean = true) {
  mockUseSubscription.mockReturnValue({
    subscription: null,
    loading: false,
    hasActiveSubscription,
    refresh: vi.fn(),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setSub(true)
  mockApiGet.mockResolvedValue([])
})

describe('DashboardTemplatesPage', () => {
  it('shows skeletons while fetching', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {}))
    const { container } = render(<TemplatesPage />)
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThanOrEqual(6)
    expect(screen.getByText('My Templates')).toBeInTheDocument()
  })

  it('shows the subscribed header action and empty state', async () => {
    render(<TemplatesPage />)
    expect(await screen.findByText('No templates yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New Template' })).toHaveAttribute(
      'href',
      '/dashboard/templates/new',
    )
    expect(screen.getByRole('link', { name: 'Create your first template' })).toHaveAttribute(
      'href',
      '/dashboard/templates/new',
    )
  })

  it('shows the free header action and empty state', async () => {
    setSub(false)
    render(<TemplatesPage />)
    expect(await screen.findByText('No templates yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Upgrade to Create' })).toHaveAttribute('href', '/pricing')
    expect(screen.getByRole('link', { name: 'View Plans →' })).toHaveAttribute('href', '/pricing')
  })

  it('renders template cards with counts (and 0 fallback when _count missing)', async () => {
    const withoutCount = {
      ...baseTemplate,
      id: 't2',
      name: 'No Count',
      isPublic: false,
      // intentionally missing _count to exercise ?? 0 fallback
      _count: undefined,
    }
    mockApiGet.mockResolvedValue([baseTemplate, withoutCount])
    render(<TemplatesPage />)
    expect(await screen.findByText('My Template')).toBeInTheDocument()
    expect(screen.getByText('No Count')).toBeInTheDocument()
    expect(screen.getAllByTestId('template-card')).toHaveLength(2)
    // t1 counts
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    // t2 falls back to 0
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1)
    // Header action still present in grid state
    expect(screen.getByRole('link', { name: 'New Template' })).toHaveAttribute(
      'href',
      '/dashboard/templates/new',
    )
  })

  it('shows the error state and retries', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('boom'))
    mockApiGet.mockResolvedValueOnce([baseTemplate])
    render(<TemplatesPage />)
    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))
    expect(await screen.findByText('My Template')).toBeInTheDocument()
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
  })
})
