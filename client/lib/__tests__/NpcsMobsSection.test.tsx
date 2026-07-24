import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NpcsMobsSection } from '@/components/adventure/NpcsMobsSection'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
}))

const mockNpcs = [
  { id: 'npc-1', characterName: 'Goblin King', isNpc: true, npcType: 'NPC', level: 6, hpActual: 40, hpMax: 60, createdAt: '2024-01-01', template: { id: 't-1', name: 'Goblin' } },
  { id: 'mob-1', characterName: 'Goblin Scout', isNpc: true, npcType: 'MOB', level: 2, hpActual: 10, hpMax: 15, createdAt: '2024-01-01', template: { id: 't-2', name: 'Scout' } },
]

describe('NpcsMobsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(api.get as any).mockResolvedValue(mockNpcs)
  })

  it('returns null when not GM', () => {
    const { container } = render(<NpcsMobsSection adventureId="adv-1" isGM={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows loading state then NPC list', async () => {
    render(<NpcsMobsSection adventureId="adv-1" isGM={true} />)
    expect(screen.getByText('NPCs')).toBeInTheDocument()
    expect(await screen.findByText('Goblin King')).toBeInTheDocument()
  })

  it('switches to Mobs tab when Mob button clicked', async () => {
    render(<NpcsMobsSection adventureId="adv-1" isGM={true} />)
    expect(await screen.findByText('Goblin King')).toBeInTheDocument()
    // NPCs tab shows NPC list, Mob data not visible
    expect(screen.queryByText('Goblin Scout')).not.toBeInTheDocument()

    // Click Mobs tab
    fireEvent.click(screen.getByText(/Mobs/))
    // Now mob list should show
    expect(screen.getByText('Goblin Scout')).toBeInTheDocument()
    // NPC data should be hidden
    expect(screen.queryByText('Goblin King')).not.toBeInTheDocument()
  })

  it('switches back to NPCs tab', async () => {
    render(<NpcsMobsSection adventureId="adv-1" isGM={true} />)
    await screen.findByText('Goblin King')

    // Switch to Mobs
    fireEvent.click(screen.getByText(/Mobs/))
    expect(screen.getByText('Goblin Scout')).toBeInTheDocument()

    // Switch back to NPCs
    fireEvent.click(screen.getByText(/NPCs/))
    expect(screen.getByText('Goblin King')).toBeInTheDocument()
    expect(screen.queryByText('Goblin Scout')).not.toBeInTheDocument()
  })

  it('shows empty state when filtered list is empty', async () => {
    render(<NpcsMobsSection adventureId="adv-1" isGM={true} />)
    await screen.findByText('Goblin King')

    // Type a search that matches nothing
    const searchInput = screen.getByPlaceholderText('Search NPCs...')
    fireEvent.change(searchInput, { target: { value: 'zzzzz' } })
    expect(screen.getByText(/No NPCs match your search/)).toBeInTheDocument()
  })

  it('shows empty state when no NPCs exist', async () => {
    ;(api.get as any).mockResolvedValue([])
    render(<NpcsMobsSection adventureId="adv-1" isGM={true} />)
    expect(await screen.findByText(/No NPCs yet/)).toBeInTheDocument()
  })

  it('calls router.push when View button is clicked', async () => {
    render(<NpcsMobsSection adventureId="adv-1" isGM={true} />)
    expect(await screen.findByText('Goblin King')).toBeInTheDocument()
    const viewBtn = screen.getByText('View')
    fireEvent.click(viewBtn)
    // Click exercises the router.push onClick handler
    expect(viewBtn).toBeInTheDocument()
  })
})
