import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CampaignCreatureSidebar } from '@/components/adventure/CampaignCreatureSidebar'

/* ── Mocks ── */

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))

const mockAuthFetch = vi.hoisted(() => vi.fn())

const mockRouter = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}))

vi.mock('@/lib/api', () => {
  const API_URL = 'https://mythrion-dev.up.railway.app/api'
  return { api: mockApi, API_URL, authFetch: mockAuthFetch }
})

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// NpcEditDrawer does its own heavy API fetching; stub it so opening the
// edit drawer doesn't trigger real drawer behavior.
vi.mock('@/components/adventure/NpcEditDrawer', () => ({
  NpcEditDrawer: ({ npcId }: { npcId: string }) => (
    <div data-testid="npc-edit-drawer">editing {npcId}</div>
  ),
}))

/* ── Fixtures ── */

function makeNpc(overrides: Record<string, any> = {}) {
  return {
    id: 'npc-1',
    characterName: 'Goblin King',
    isNpc: true,
    npcType: 'NPC',
    level: 5,
    hpActual: 40,
    hpMax: 40,
    createdAt: '2026-01-01T00:00:00.000Z',
    template: null,
    ...overrides,
  }
}

function makeMob(overrides: Record<string, any> = {}) {
  return {
    id: 'mob-1',
    characterName: 'Dire Wolf',
    isNpc: false,
    npcType: 'MOB',
    level: 1,
    hpActual: 8,
    hpMax: 8,
    createdAt: '2026-01-01T00:00:00.000Z',
    template: null,
    ...overrides,
  }
}

/* ── Helpers ── */

async function openSidebar() {
  await userEvent.click(screen.getByRole('button', { name: 'Open NPC sidebar' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthFetch.mockReset()
  mockRouter.push.mockReset()
})

describe('CampaignCreatureSidebar', () => {
  it('renders nothing when the user is not the GM', () => {
    const { container } = render(
      <CampaignCreatureSidebar adventureId="adv-1" isGM={false} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('opens the sidebar, fetches NPCs and renders the list', async () => {
    mockApi.get.mockResolvedValue([makeNpc(), makeMob()])
    render(<CampaignCreatureSidebar adventureId="adv-1" isGM />)

    // Fetch only happens after the sidebar is opened
    expect(mockApi.get).not.toHaveBeenCalled()
    await openSidebar()

    await waitFor(() =>
      expect(mockApi.get).toHaveBeenCalledWith('/adventures/adv-1/npcs'),
    )
    expect(await screen.findByText('Goblin King')).toBeInTheDocument()
    expect(screen.getByText('Dire Wolf')).toBeInTheDocument()
    expect(screen.getByText('NPC')).toBeInTheDocument()
    expect(screen.getByText('MOB')).toBeInTheDocument()
    // Footer with pluralized count
    expect(
      screen.getByText('2 creatures · click name to open full sheet'),
    ).toBeInTheDocument()
  })

  it('shows a loading skeleton while fetching', async () => {
    let resolveFetch: (v: unknown) => void
    mockApi.get.mockReturnValue(
      new Promise(r => {
        resolveFetch = r
      }),
    )
    const { container } = render(
      <CampaignCreatureSidebar adventureId="adv-1" isGM />,
    )
    await openSidebar()

    expect(container.querySelector('.skeleton')).not.toBeNull()

    resolveFetch!([makeNpc()])
    await waitFor(() =>
      expect(screen.getByText('Goblin King')).toBeInTheDocument(),
    )
    expect(container.querySelector('.skeleton')).toBeNull()
  })

  it('renders the empty state when there are no creatures', async () => {
    mockApi.get.mockResolvedValue([])
    render(<CampaignCreatureSidebar adventureId="adv-1" isGM />)
    await openSidebar()

    expect(
      await screen.findByText('No NPCs or Mobs yet. Create one above!'),
    ).toBeInTheDocument()
  })

  it('filters the list by NPC/MOB pills with counts', async () => {
    mockApi.get.mockResolvedValue([makeNpc(), makeMob()])
    render(<CampaignCreatureSidebar adventureId="adv-1" isGM />)
    await openSidebar()
    await screen.findByText('Goblin King')

    const npcPill = screen.getByRole('button', { name: /NPCs\s*\(1\)/ })
    const mobPill = screen.getByRole('button', { name: /Mobs\s*\(1\)/ })
    const allPill = screen.getByRole('button', { name: 'All' })
    expect(allPill).toHaveClass('tab-pill-active')
    expect(npcPill).not.toHaveClass('tab-pill-active')

    // Filter to NPCs only
    await userEvent.click(npcPill)
    expect(screen.getByText('Goblin King')).toBeInTheDocument()
    expect(screen.queryByText('Dire Wolf')).not.toBeInTheDocument()
    expect(npcPill).toHaveClass('tab-pill-active')

    // Filter to MOBs only
    await userEvent.click(mobPill)
    expect(screen.queryByText('Goblin King')).not.toBeInTheDocument()
    expect(screen.getByText('Dire Wolf')).toBeInTheDocument()
    expect(mobPill).toHaveClass('tab-pill-active')

    // Back to all
    await userEvent.click(allPill)
    expect(screen.getByText('Goblin King')).toBeInTheDocument()
    expect(screen.getByText('Dire Wolf')).toBeInTheDocument()
  })

  it('filters the list by search text', async () => {
    mockApi.get.mockResolvedValue([makeNpc(), makeMob()])
    render(<CampaignCreatureSidebar adventureId="adv-1" isGM />)
    await openSidebar()
    await screen.findByText('Goblin King')

    const search = screen.getByPlaceholderText('Search creatures...')
    await userEvent.type(search, 'wolf')

    expect(screen.queryByText('Goblin King')).not.toBeInTheDocument()
    expect(screen.getByText('Dire Wolf')).toBeInTheDocument()
  })

  it('creates an NPC and opens it in the edit drawer', async () => {
    mockApi.get.mockResolvedValue([])
    mockApi.post.mockResolvedValue(makeNpc({ id: 'npc-created' }))
    const onChange = vi.fn()
    render(
      <CampaignCreatureSidebar
        adventureId="adv-1"
        isGM
        onCreaturesChange={onChange}
      />,
    )
    await openSidebar()
    await screen.findByText('No NPCs or Mobs yet. Create one above!')

    await userEvent.click(screen.getByRole('button', { name: '+ New NPC' }))

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith('/adventures/adv-1/npcs', {
        name: 'New NPC',
        type: 'NPC',
      }),
    )
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    // The newly created creature opens in the edit drawer
    expect(screen.getByTestId('npc-edit-drawer')).toBeInTheDocument()
  })

  it('creates a Mob', async () => {
    mockApi.get.mockResolvedValue([])
    mockApi.post.mockResolvedValue(makeMob({ id: 'mob-created' }))
    const onChange = vi.fn()
    render(
      <CampaignCreatureSidebar
        adventureId="adv-1"
        isGM
        onCreaturesChange={onChange}
      />,
    )
    await openSidebar()
    await screen.findByText('No NPCs or Mobs yet. Create one above!')

    await userEvent.click(screen.getByRole('button', { name: '+ New Mob' }))

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith('/adventures/adv-1/npcs', {
        name: 'New Mob',
        type: 'MOB',
      }),
    )
    await waitFor(() => expect(onChange).toHaveBeenCalled())
  })

  it('deletes a creature only after confirming, then notifies the parent', async () => {
    mockApi.get.mockResolvedValue([makeNpc()])
    mockApi.delete.mockResolvedValue({})
    const onChange = vi.fn()
    render(
      <CampaignCreatureSidebar
        adventureId="adv-1"
        isGM
        onCreaturesChange={onChange}
      />,
    )
    await openSidebar()
    await screen.findByText('Goblin King')

    // Clicking the trash icon opens a confirmation modal instead of deleting immediately
    await userEvent.click(
      screen.getByRole('button', { name: 'Delete Goblin King' }),
    )
    const confirmButton = screen.getByRole('button', { name: 'Delete forever' })
    expect(mockApi.delete).not.toHaveBeenCalled()

    await userEvent.click(confirmButton)

    await waitFor(() =>
      expect(mockApi.delete).toHaveBeenCalledWith('/adventures/adv-1/npcs/npc-1'),
    )
    await waitFor(() => expect(onChange).toHaveBeenCalled())
  })

  it('opens the edit drawer for an existing creature', async () => {
    mockApi.get.mockResolvedValue([makeNpc()])
    render(<CampaignCreatureSidebar adventureId="adv-1" isGM />)
    await openSidebar()
    await screen.findByText('Goblin King')

    await userEvent.click(
      screen.getByRole('button', { name: 'Edit Goblin King' }),
    )

    expect(screen.getByTestId('npc-edit-drawer')).toBeInTheDocument()
  })

  it('navigates to the full character sheet when selecting a creature', async () => {
    mockApi.get.mockResolvedValue([makeNpc()])
    render(<CampaignCreatureSidebar adventureId="adv-1" isGM />)
    await openSidebar()
    await screen.findByText('Goblin King')

    await userEvent.click(screen.getByRole('button', { name: 'View Goblin King' }))

    expect(mockRouter.push).toHaveBeenCalledWith(
      '/dashboard/character-sheets/npc-1',
    )
  })

  it('disables create buttons in read-only mode', async () => {
    mockApi.get.mockResolvedValue([makeNpc()])
    render(<CampaignCreatureSidebar adventureId="adv-1" isGM readOnly />)
    await openSidebar()
    await screen.findByText('Goblin King')

    expect(screen.getByRole('button', { name: '+ New NPC' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '+ New Mob' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Edit Goblin King' }),
    ).toBeDisabled()
  })

  it('uploads an avatar for a creature', async () => {
    mockApi.get.mockResolvedValue([makeNpc()])
    mockAuthFetch.mockResolvedValue({ ok: true })
    const { container } = render(
      <CampaignCreatureSidebar adventureId="adv-1" isGM />,
    )
    await openSidebar()
    await screen.findByText('Goblin King')

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(mockAuthFetch).toHaveBeenCalledWith(
        'https://mythrion-dev.up.railway.app/api/images/character-sheets/npc-1/avatar',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('closes the sidebar via the toggle button', async () => {
    mockApi.get.mockResolvedValue([makeNpc()])
    render(<CampaignCreatureSidebar adventureId="adv-1" isGM />)
    await openSidebar()
    await screen.findByText('Goblin King')

    await userEvent.click(
      screen.getByRole('button', { name: 'Close NPC sidebar' }),
    )

    // Sidebar panel slides off-screen (stays mounted for the animation),
    // and the toggle button flips back to its closed label.
    expect(
      screen.getByRole('button', { name: 'Open NPC sidebar' }),
    ).toBeInTheDocument()
    const aside = screen.getByRole('complementary')
    expect(aside.className).toContain('translate-x-full')
  })
})
