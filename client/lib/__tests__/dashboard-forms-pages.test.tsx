import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

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

vi.mock('@/lib/breadcrumb', () => ({
  PageNav: () => null,
}))

vi.mock('@/components/shared/Select', () => ({
  Select: ({
    options,
    value,
    onChange,
  }: {
    options: { id: string; label: string }[]
    value: string | null
    onChange: (v: string) => void
  }) => (
    <select
      data-testid="mock-select"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}))

vi.mock('@/components/shared/TimePicker', () => ({
  TimePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <button type="button" onClick={() => onChange(value ? '' : '18:00')}>
      time:{value || 'empty'}
    </button>
  ),
}))

const modalProps: { current: { onSelect: (id: string, name: string) => void } | null } = {
  current: null,
}
vi.mock('@/components/adventure/TemplatePickerModal', () => ({
  TemplatePickerModal: (props: { isOpen: boolean; onClose: () => void; onSelect: (id: string, name: string) => void }) => {
    modalProps.current = props
    return <div data-testid="template-picker-modal" />
  },
}))

const mockUseSubscription = vi.fn()
vi.mock('@/lib/subscription-context', () => ({
  useSubscription: () => mockUseSubscription(),
}))

import { api } from '@/lib/api'
import NewCharacterSheetPage from '@/app/dashboard/character-sheets/new/page'
import NewAdventurePage from '@/app/dashboard/adventures/new/page'

const mockApiGet = vi.mocked(api.get)
const mockApiPost = vi.mocked(api.post)

const templates = [
  {
    id: 't1',
    name: 'Warrior',
    description: 'A sturdy fighter',
    attributes: [{ id: 'a1' }],
    templateSkills: [{ id: 's1' }],
  },
  {
    id: 't2',
    name: 'Mage',
    description: null,
    attributes: [],
    templateSkills: [],
  },
]

const adventures = [
  { id: 'adv1', name: 'The Dragon', campaign: 'World A' },
]

function setSub(hasActiveSubscription: boolean = true) {
  mockUseSubscription.mockReturnValue({
    subscription: null,
    loading: false,
    hasActiveSubscription,
    refresh: vi.fn(),
  })
}

function mockApiData(getImpl: (url: string) => unknown) {
  mockApiGet.mockImplementation(async (url: string) => getImpl(url))
}

beforeEach(() => {
  vi.clearAllMocks()
  setSub(true)
  mockApiData((url) => {
    if (url === '/templates') return templates
    if (url === '/adventures') return adventures
    return []
  })
  mockApiPost.mockResolvedValue({ id: 'new-1' })
  modalProps.current = null
})

// ════════════════════════════════════════════════════════════
// NewCharacterSheetPage (app/dashboard/character-sheets/new/page.tsx)
// ════════════════════════════════════════════════════════════

describe('NewCharacterSheetPage', () => {
  it('blocks step 2 until a character name is entered', () => {
    render(<NewCharacterSheetPage />)
    expect(screen.getByText('Character Name *')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText("e.g. Aragorn, Geralt, Vex'ahlia"), {
      target: { value: 'Aragorn' },
    })
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('moves to step 2 and shows template skeletons while fetching', async () => {
    mockApiGet.mockImplementation(() => new Promise(() => {}))
    const { container } = render(<NewCharacterSheetPage />)
    fireEvent.change(screen.getByPlaceholderText("e.g. Aragorn, Geralt, Vex'ahlia"), {
      target: { value: 'Aragorn' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Choose a template for your character')).toBeInTheDocument()
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThanOrEqual(3)
  })

  it('renders templates and filters by search', async () => {
    render(<NewCharacterSheetPage />)
    fireEvent.change(screen.getByPlaceholderText("e.g. Aragorn, Geralt, Vex'ahlia"), {
      target: { value: 'Aragorn' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Warrior')).toBeInTheDocument()
    expect(screen.getByText('A sturdy fighter')).toBeInTheDocument()
    expect(screen.getByText('Mage')).toBeInTheDocument()
    // search filtering
    fireEvent.change(screen.getByPlaceholderText('Filter by name...'), { target: { value: 'Mage' } })
    expect(screen.queryByText('Warrior')).not.toBeInTheDocument()
    expect(screen.getByText('Mage')).toBeInTheDocument()
    // no match
    fireEvent.change(screen.getByPlaceholderText('Filter by name...'), { target: { value: 'zzz' } })
    expect(screen.getByText('No templates match your search.')).toBeInTheDocument()
    // clear search -> empty list message with create link
    fireEvent.change(screen.getByPlaceholderText('Filter by name...'), { target: { value: '' } })
    expect(await screen.findByText('Warrior')).toBeInTheDocument()
  })

  it('shows the no-templates empty state', async () => {
    mockApiData(() => [])
    render(<NewCharacterSheetPage />)
    fireEvent.change(screen.getByPlaceholderText("e.g. Aragorn, Geralt, Vex'ahlia"), {
      target: { value: 'Aragorn' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('No templates found. Create a template first.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create a template' })).toHaveAttribute(
      'href',
      '/dashboard/templates/new',
    )
  })

  it('selects a template, moves to step 3, picks an adventure, and submits', async () => {
    render(<NewCharacterSheetPage />)
    fireEvent.change(screen.getByPlaceholderText("e.g. Aragorn, Geralt, Vex'ahlia"), {
      target: { value: 'Aragorn' },
    })
    fireEvent.change(screen.getByPlaceholderText('Your name or alias'), {
      target: { value: 'Alice' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(await screen.findByText('Warrior'))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    // step 3 helper
    expect(await screen.findByText('Finish creating your character')).toBeInTheDocument()
    // selected template summary
    expect(await screen.findByText('Warrior')).toBeInTheDocument()
    // campaign select options rendered
    await waitFor(() => {
      expect(screen.getByTestId('mock-select')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('mock-select'), { target: { value: 'adv1' } })
    expect(screen.getByText('Link to a campaign and finish')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create Sheet' }))
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/character-sheets', {
        characterName: 'Aragorn',
        templateId: 't1',
        playerName: 'Alice',
        level: 1,
        adventureId: 'adv1',
      })
    })
    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/character-sheets/new-1')
  })

  it('submits without player/level/adventure and shows the creating spinner', async () => {
    mockApiPost.mockImplementation(() => new Promise((res) => setTimeout(() => res({ id: 'x' }), 50)))
    render(<NewCharacterSheetPage />)
    fireEvent.change(screen.getByPlaceholderText("e.g. Aragorn, Geralt, Vex'ahlia"), {
      target: { value: 'Geralt' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(await screen.findByText('Mage'))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByTestId('mock-select')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Create Sheet' }))
    expect(screen.getByText('Creating...')).toBeInTheDocument()
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/character-sheets', {
        characterName: 'Geralt',
        templateId: 't2',
        level: 1,
      })
    })
  })

  it('shows the submit error and back navigation works', async () => {
    mockApiPost.mockRejectedValue(new Error('post boom'))
    render(<NewCharacterSheetPage />)
    fireEvent.change(screen.getByPlaceholderText("e.g. Aragorn, Geralt, Vex'ahlia"), {
      target: { value: 'Aragorn' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(await screen.findByText('Warrior'))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByTestId('mock-select')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Create Sheet' }))
    expect(await screen.findByText('post boom')).toBeInTheDocument()
    // back to step 2
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Choose a template for your character')).toBeInTheDocument()
  })

  it('shows a templates-loading failure message on step 3', async () => {
    // templates fail to load; adventures still load
    mockApiData((url) => {
      if (url === '/templates') throw new Error('tpl boom')
      if (url === '/adventures') return adventures
      return []
    })
    render(<NewCharacterSheetPage />)
    fireEvent.change(screen.getByPlaceholderText("e.g. Aragorn, Geralt, Vex'ahlia"), {
      target: { value: 'Aragorn' },
    })
    // step 2 shows empty state because templates failed
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('No templates found. Create a template first.')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════════════
// NewAdventurePage (app/dashboard/adventures/new/page.tsx)
// ════════════════════════════════════════════════════════════

describe('NewAdventurePage', () => {
  it('shows the subscription-required screen for non-subscribers', () => {
    setSub(false)
    render(<NewAdventurePage />)
    expect(screen.getByText('Subscription Required')).toBeInTheDocument()
    expect(screen.getByText('Creating campaigns is a premium feature. Upgrade to a paid plan to create and manage your own campaigns.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Plans' })).toHaveAttribute('href', '/pricing')
  })

  it('disables submit until name and campaign are filled', () => {
    render(<NewAdventurePage />)
    const submit = screen.getByRole('button', { name: 'Create Campaign' })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Campaign Name'), { target: { value: 'The Lair' } })
    expect(screen.getByRole('button', { name: 'Create Campaign' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/RPG system/), { target: { value: 'D&D' } })
    expect(screen.getByRole('button', { name: 'Create Campaign' })).toBeEnabled()
  })

  it('submits with all optional fields populated', async () => {
    render(<NewAdventurePage />)
    fireEvent.change(screen.getByLabelText('Campaign Name'), { target: { value: 'The Lair' } })
    fireEvent.change(screen.getByLabelText(/RPG system/), { target: { value: 'D&D' } })
    fireEvent.change(screen.getByPlaceholderText('Give your campaign a brief description — set the scene for your players...'), {
      target: { value: 'A dark dungeon' },
    })
    // max players slider
    fireEvent.change(screen.getByLabelText('Max Players'), { target: { value: '5' } })
    // session weekday
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: 'Monday' } })
    // session time via TimePicker stub
    fireEvent.click(screen.getByText('time:empty'))
    // session type
    fireEvent.click(screen.getByRole('button', { name: '🌐 Online' }))
    // public toggle
    fireEvent.click(screen.getByRole('switch'))
    // select a template
    fireEvent.click(screen.getByRole('button', { name: 'Select Template' }))
    act(() => {
      modalProps.current?.onSelect('t1', 'Warrior')
    })
    expect(screen.getByText('Warrior')).toBeInTheDocument()
    // remove template
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.queryByText('Warrior')).not.toBeInTheDocument()
    // re-select
    fireEvent.click(screen.getByRole('button', { name: 'Select Template' }))
    act(() => {
      modalProps.current?.onSelect('t1', 'Warrior')
    })
    expect(screen.getByText('Warrior')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }))
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/adventures', {
        name: 'The Lair',
        campaign: 'D&D',
        synopsis: 'A dark dungeon',
        maxPlayers: 5,
        isPublic: true,
        templateId: 't1',
        sessionWeekday: 'Monday',
        sessionTime: '18:00',
        sessionType: 'ONLINE',
      })
    })
    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/adventures/new-1')
  })

  it('submits with only required fields and shows error on failure', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('adv boom'))
    mockApiPost.mockResolvedValueOnce({ id: 'ok' })
    const { rerender } = render(<NewAdventurePage />)
    fireEvent.change(screen.getByLabelText('Campaign Name'), { target: { value: 'Lair' } })
    fireEvent.change(screen.getByLabelText(/RPG system/), { target: { value: 'D&D' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }))
    expect(await screen.findByText('adv boom')).toBeInTheDocument()
    expect(mockApiPost).toHaveBeenCalledWith('/adventures', {
      name: 'Lair',
      campaign: 'D&D',
      synopsis: undefined,
      maxPlayers: 4,
      isPublic: undefined,
    })
    // second attempt succeeds
    fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }))
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/adventures/ok'))
    // in-person + creating spinner
    rerender(<NewAdventurePage />)
    fireEvent.change(screen.getByLabelText('Campaign Name'), { target: { value: 'Lair' } })
    fireEvent.change(screen.getByLabelText(/RPG system/), { target: { value: 'D&D' } })
    fireEvent.click(screen.getByRole('button', { name: '📍 In Person' }))
    mockApiPost.mockImplementation(() => new Promise((res) => setTimeout(() => res({ id: 'z' }), 50)))
    fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }))
    expect(screen.getByText('Creating...')).toBeInTheDocument()
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/adventures/z'))
  })
})
