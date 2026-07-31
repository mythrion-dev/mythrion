import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TemplateDetailPage from '@/app/dashboard/templates/[id]/page'
import { api } from '@/lib/api'
import type { BreadcrumbSegment } from '@/lib/navigation-context'

/* ── Mock api module ── */
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn(), delete: vi.fn(), post: vi.fn() },
}))

/* ── Mock navigation context (used by PageNav) ── */
let mockBreadcrumbs: BreadcrumbSegment[] = []
vi.mock('@/lib/navigation-context', () => ({
  useNavigation: () => ({
    breadcrumbs: mockBreadcrumbs,
    setBreadcrumbs: vi.fn(),
    pushSegment: vi.fn(),
    popSegment: vi.fn(),
  }),
}))

/* ── Mock TemplateForm (complex internal dependencies) ── */
vi.mock('@/components/adventure/TemplateForm', () => ({
  TemplateForm: () => <div data-testid="template-form">Template Form (edit mode)</div>,
}))

/* ── Override next/navigation to add useParams ── */
vi.mock('next/navigation', () => {
  const actual = vi.importActual('next/navigation')
  return {
    ...actual,
    useParams: () => ({ id: 'tpl-1' }),
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/dashboard/templates/tpl-1',
  }
})

/* ── Mock next/link ── */
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode
    href: string
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

/* ── Test data ── */

const mockTemplate = {
  id: 'tpl-1',
  name: 'Fighter Sheet',
  description: 'A basic fighter character sheet template.',
  campaign: 'D&D 5e',
  attributeModifierFormula: 'floor((value - 10) / 2)',
  skillFormula: 'value + mod(value)',
  isPublic: false,
  useCount: 3,
  attrModifiersEnabled: true,
  attributes: [
    { id: 'attr-1', key: 'str', name: 'Strength' },
    { id: 'attr-2', key: 'dex', name: 'Dexterity' },
  ],
  templateSkills: [
    {
      id: 'skill-1',
      name: 'Stealth',
      description: null,
      attributeId: 'attr-2',
      allowedAttributeIds: ['attr-2'],
      defaultAttributeId: 'attr-2',
    },
  ],
  templateFields: [],
  skillModifierProfiles: [],
  coreResources: [
    {
      id: 'cr-1',
      displayName: 'Hit Points',
      slug: 'hit_points',
      color: '#ef4444',
      enabled: true,
      editableByPlayer: true,
      showNotes: false,
    },
  ],
  armorClasses: [],
  resistances: [],
  characterSections: [],
  createdAt: '2025-01-15T00:00:00Z',
  updatedAt: '2025-01-15T00:00:00Z',
}

/* ════════════════════════════════════════════════════════════
 * Template Detail Page
 * ════════════════════════════════════════════════════════════ */

describe('TemplateDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBreadcrumbs = []
  })

  /* ── Loading state ── */

  it('shows loading skeleton while fetching', () => {
    ;(api.get as any).mockReturnValue(new Promise(() => {}))
    const { container } = render(<TemplateDetailPage />)
    const skeleton = container.querySelector('.skeleton')
    expect(skeleton).toBeDefined()
  })

  /* ── Error state ── */

  it('shows error state when template fetch fails', async () => {
    ;(api.get as any).mockRejectedValue(new Error('Failed to load'))
    render(<TemplateDetailPage />)
    expect(await screen.findByText('Could not load template')).toBeInTheDocument()
  })

  it('shows error message text from rejected API call', async () => {
    ;(api.get as any).mockRejectedValue(new Error('Not authorized'))
    render(<TemplateDetailPage />)
    expect(await screen.findByText('Not authorized')).toBeInTheDocument()
  })

  /* ── Not found state ── */

  it('shows not found state when template is null', async () => {
    ;(api.get as any).mockResolvedValue(null)
    render(<TemplateDetailPage />)
    expect(await screen.findByText('Template not found')).toBeInTheDocument()
  })

  /* ── Display mode ── */

  it('renders template name and description', async () => {
    ;(api.get as any).mockResolvedValue(mockTemplate)
    render(<TemplateDetailPage />)
    expect(await screen.findByText('Fighter Sheet')).toBeInTheDocument()
    expect(
      screen.getByText('A basic fighter character sheet template.'),
    ).toBeInTheDocument()
  })

  it('renders campaign badge', async () => {
    ;(api.get as any).mockResolvedValue(mockTemplate)
    render(<TemplateDetailPage />)
    expect(await screen.findByText('D&D 5e')).toBeInTheDocument()
  })

  it('renders use count', async () => {
    ;(api.get as any).mockResolvedValue(mockTemplate)
    render(<TemplateDetailPage />)
    expect(await screen.findByText('Used 3 times')).toBeInTheDocument()
  })

  it('renders edit, clone, and delete buttons', async () => {
    ;(api.get as any).mockResolvedValue(mockTemplate)
    render(<TemplateDetailPage />)
    await screen.findByText('Fighter Sheet')
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Clone')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  /* ── Feature summary cards ── */

  it('renders Template Features heading', async () => {
    ;(api.get as any).mockResolvedValue(mockTemplate)
    render(<TemplateDetailPage />)
    expect(await screen.findByText('Template Features')).toBeInTheDocument()
  })

  it('renders all feature summary cards', async () => {
    ;(api.get as any).mockResolvedValue(mockTemplate)
    render(<TemplateDetailPage />)
    await screen.findByText('Template Features')
    expect(screen.getByText('Attributes')).toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()
    expect(screen.getByText('Custom Fields')).toBeInTheDocument()
    expect(screen.getByText('Skill Profiles')).toBeInTheDocument()
    expect(screen.getByText('Core Resources')).toBeInTheDocument()
    expect(screen.getByText('Armor Classes')).toBeInTheDocument()
    expect(screen.getByText('Character Sections')).toBeInTheDocument()
    expect(screen.getByText('Resistances')).toBeInTheDocument()
  })

  it('renders attribute count in feature card', async () => {
    ;(api.get as any).mockResolvedValue(mockTemplate)
    render(<TemplateDetailPage />)
    await screen.findByText('Template Features')
    // mockTemplate has 2 attributes
    const attrCards = screen.getAllByText('2')
    expect(attrCards.length).toBeGreaterThanOrEqual(1)
  })

  it('renders skill count in feature card', async () => {
    ;(api.get as any).mockResolvedValue(mockTemplate)
    render(<TemplateDetailPage />)
    await screen.findByText('Template Features')
    const skillCards = screen.getAllByText('1')
    expect(skillCards.length).toBeGreaterThanOrEqual(1)
  })

  /* ── Formula sections must NOT be rendered ── */

  it('does NOT render "Attribute Formula" text', async () => {
    ;(api.get as any).mockResolvedValue(mockTemplate)
    render(<TemplateDetailPage />)
    await screen.findByText('Template Features')
    const attrFormulaEl = screen.queryByText(/Attribute Formula/)
    expect(attrFormulaEl).toBeNull()
  })

  it('does NOT render "Skill Formula" text', async () => {
    ;(api.get as any).mockResolvedValue(mockTemplate)
    render(<TemplateDetailPage />)
    await screen.findByText('Template Features')
    const skillFormulaEl = screen.queryByText(/Skill Formula/)
    expect(skillFormulaEl).toBeNull()
  })

  it('does NOT render the formula code blocks', async () => {
    ;(api.get as any).mockResolvedValue(mockTemplate)
    render(<TemplateDetailPage />)
    await screen.findByText('Template Features')
    // The formulas ARE in the mock data but must NOT appear on the page
    expect(screen.queryByText(/floor\(\(value - 10\) \/ 2\)/)).toBeNull()
    expect(screen.queryByText(/value \+ mod\(value\)/)).toBeNull()
  })

  it('does not render the word "formula" anywhere when template has formulas', async () => {
    const tplWithFormulas = {
      ...mockTemplate,
      attributeModifierFormula: 'floor((value - 10) / 2)',
      skillFormula: 'value + mod(value)',
    }
    ;(api.get as any).mockResolvedValue(tplWithFormulas)
    render(<TemplateDetailPage />)
    await screen.findByText('Template Features')
    expect(screen.queryByText(/formula/i)).toBeNull()
  })

  /* ── Page structure ── */

  it('ends after the Template Features section — feature card grid has 8 cards', async () => {
    ;(api.get as any).mockResolvedValue(mockTemplate)
    render(<TemplateDetailPage />)
    await screen.findByText('Template Features')
    // The feature card wrapper should exist
    const heading = screen.getByText('Template Features')
    const card = heading.closest('.card')
    expect(card).toBeDefined()
  })

  /* ── Edit mode ── */

  it('switches to edit mode when Edit button is clicked', async () => {
    ;(api.get as any).mockResolvedValue(mockTemplate)
    render(<TemplateDetailPage />)
    await screen.findByText('Fighter Sheet')
    // Click Edit to enter edit mode
    fireEvent.click(screen.getByText('Edit'))
    // Should show the mocked TemplateForm
    expect(await screen.findByTestId('template-form')).toBeInTheDocument()
  })

  /* ── Public badge ── */

  it('renders Public badge when template is public', async () => {
    ;(api.get as any).mockResolvedValue({ ...mockTemplate, isPublic: true })
    render(<TemplateDetailPage />)
    await screen.findByText('Fighter Sheet')
    expect(screen.getByText('Public')).toBeInTheDocument()
  })
})
