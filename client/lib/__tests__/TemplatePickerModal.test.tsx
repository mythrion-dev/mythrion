import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { TemplatePickerModal } from '@/components/adventure/TemplatePickerModal'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  API_URL: 'http://localhost:3001/api',
}))

vi.mock('next/link', () => ({
  default: ({ children, href, onClick, ...rest }: any) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}))

const myTemplateA = {
  id: 't1',
  name: 'D&D 5e Sheet',
  description: 'Classic fantasy sheet',
  campaign: 'D&D',
  useCount: 10,
  createdAt: '2025-01-15T00:00:00Z',
  _count: { attributes: 6, templateSkills: 3 },
}

const myTemplateB = {
  id: 't2',
  name: 'Tormenta Sheet',
  description: null,
  campaign: 'Tormenta',
  useCount: 0,
  createdAt: undefined,
  _count: { attributes: 0, templateSkills: 0 },
}

const communityTemplateA = {
  id: 'c1',
  name: 'Community Sheet',
  description: 'Shared by GM',
  campaign: 'D&D',
  creator: { displayName: 'Alice' },
  copyCount: 5,
}

const communityTemplateB = {
  id: 'c2',
  name: 'Bare Sheet',
  description: null,
  campaign: null,
  creator: null,
  copyCount: 0,
}

function mockMyTemplates(templates: unknown[]) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/templates') return Promise.resolve(templates)
    return Promise.resolve({ data: [] })
  })
}

describe('TemplatePickerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  beforeAll(() => {
    // jsdom doesn't implement HTMLDialogElement.showModal, so the component's
    // try/catch swallows it and the <dialog> never gets the `open` attribute.
    // A closed dialog is inert — its contents are hidden from role queries.
    // Polyfill it so role/name queries can see inside the modal.
    if (typeof HTMLDialogElement !== 'undefined') {
      HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
        this.setAttribute('open', '')
      }
      HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
        this.removeAttribute('open')
      }
    }
  })

  it('renders nothing when closed and does not fetch', () => {
    const { container } = render(
      <TemplatePickerModal isOpen={false} onClose={vi.fn()} onSelect={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('renders my templates and confirms a selection', async () => {
    mockMyTemplates([myTemplateA, myTemplateB])
    const onClose = vi.fn()
    const onSelect = vi.fn()
    render(
      <TemplatePickerModal isOpen onClose={onClose} onSelect={onSelect} adventureId="adv1" />,
    )

    expect(await screen.findByText('D&D 5e Sheet')).toBeInTheDocument()
    expect(screen.getByText('Tormenta Sheet')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/templates')

    // Row metadata (scope the campaign badge to the row; 'D&D' also appears
    // as a system <option> in the filter dropdown)
    const row = screen.getByText('D&D 5e Sheet').closest('button') as HTMLElement
    expect(within(row).getByText('D&D')).toBeInTheDocument() // campaign badge
    expect(screen.getByText('Classic fantasy sheet')).toBeInTheDocument()
    expect(screen.getByText('6 attr')).toBeInTheDocument()
    expect(screen.getByText('3 skills')).toBeInTheDocument()
    expect(screen.getByText('Used 10x')).toBeInTheDocument()

    const confirmBtn = screen.getByRole('button', { name: 'Attach Template' })
    expect(confirmBtn).toBeDisabled()

    fireEvent.click(screen.getByText('D&D 5e Sheet'))
    expect(confirmBtn).not.toBeDisabled()

    fireEvent.click(confirmBtn)
    expect(onSelect).toHaveBeenCalledWith('t1', 'D&D 5e Sheet')
    expect(screen.getByText('Attaching...')).toBeInTheDocument()
  })

  it('filters my templates by name and by campaign via search', async () => {
    mockMyTemplates([myTemplateA, myTemplateB])
    render(<TemplatePickerModal isOpen onClose={vi.fn()} onSelect={vi.fn()} />)

    const input = await screen.findByPlaceholderText('Search templates...')
    expect(input).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'tormenta' } })
    expect(screen.queryByText('D&D 5e Sheet')).not.toBeInTheDocument()
    expect(screen.getByText('Tormenta Sheet')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'd&d' } })
    expect(screen.getByText('D&D 5e Sheet')).toBeInTheDocument()
    expect(screen.queryByText('Tormenta Sheet')).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: '' } })
    expect(screen.getByText('D&D 5e Sheet')).toBeInTheDocument()
    expect(screen.getByText('Tormenta Sheet')).toBeInTheDocument()
  })

  it('filters my templates by system via the system select', async () => {
    mockMyTemplates([myTemplateA, myTemplateB])
    render(<TemplatePickerModal isOpen onClose={vi.fn()} onSelect={vi.fn()} />)

    await screen.findByText('D&D 5e Sheet')
    const select = screen.getByRole('combobox', { name: 'Filter by system' })
    fireEvent.change(select, { target: { value: 'D&D' } })
    expect(screen.getByText('D&D 5e Sheet')).toBeInTheDocument()
    expect(screen.queryByText('Tormenta Sheet')).not.toBeInTheDocument()

    fireEvent.change(select, { target: { value: '' } })
    expect(screen.getByText('Tormenta Sheet')).toBeInTheDocument()
  })

  it('shows empty state with a link to create a template', async () => {
    mockMyTemplates([])
    render(<TemplatePickerModal isOpen onClose={vi.fn()} onSelect={vi.fn()} />)

    expect(await screen.findByText('No Templates Yet')).toBeInTheDocument()
    expect(screen.getByText('Create templates in your library first.')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'New Template' })
    expect(link).toHaveAttribute('href', '/dashboard/templates/new')

    // Searching hides the create-template call to action
    fireEvent.change(screen.getByPlaceholderText('Search templates...'), {
      target: { value: 'nope' },
    })
    expect(screen.getByText('No templates match your search.')).toBeInTheDocument()
    expect(screen.queryByText('Create templates in your library first.')).not.toBeInTheDocument()
  })

  it('shows an error and retries fetching my templates', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/templates') return Promise.reject(new Error('My boom'))
      return Promise.resolve({ data: [] })
    })
    render(<TemplatePickerModal isOpen onClose={vi.fn()} onSelect={vi.fn()} />)

    expect(await screen.findByText('My boom')).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Retry' })

    mockMyTemplates([myTemplateA])
    fireEvent.click(retry)
    expect(await screen.findByText('D&D 5e Sheet')).toBeInTheDocument()
  })

  it('loads community templates on tab switch and confirms a selection', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/templates') return Promise.resolve([myTemplateA])
      return Promise.resolve({ data: [communityTemplateA, communityTemplateB] })
    })
    const onSelect = vi.fn()
    render(<TemplatePickerModal isOpen onClose={vi.fn()} onSelect={onSelect} />)

    await screen.findByText('D&D 5e Sheet')
    fireEvent.click(screen.getByRole('button', { name: 'Community' }))

    expect(await screen.findByText('Community Sheet')).toBeInTheDocument()
    expect(screen.getByText('Bare Sheet')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/public/templates')

    // Community row metadata
    expect(screen.getByText('by Alice')).toBeInTheDocument()
    expect(screen.getByText('Used 5x')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Community Sheet'))
    fireEvent.click(screen.getByRole('button', { name: 'Attach Template' }))
    expect(onSelect).toHaveBeenCalledWith('c1', 'Community Sheet')
  })

  it('shows the community empty state and a search-specific message', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/templates') return Promise.resolve([])
      return Promise.resolve({ data: [] })
    })
    render(<TemplatePickerModal isOpen onClose={vi.fn()} onSelect={vi.fn()} />)

    await screen.findByText('No Templates Yet')
    fireEvent.click(screen.getByRole('button', { name: 'Community' }))

    expect(await screen.findByText('No community templates available.')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Search templates...'), {
      target: { value: 'zzz' },
    })
    expect(screen.getByText('No community templates match your search.')).toBeInTheDocument()
  })

  it('shows an error and retries fetching community templates', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/templates') return Promise.resolve([])
      return Promise.reject(new Error('Community boom'))
    })
    render(<TemplatePickerModal isOpen onClose={vi.fn()} onSelect={vi.fn()} />)

    await screen.findByText('No Templates Yet')
    fireEvent.click(screen.getByRole('button', { name: 'Community' }))

    expect(await screen.findByText('Community boom')).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Retry' })

    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/templates') return Promise.resolve([])
      return Promise.resolve({ data: [communityTemplateA] })
    })
    fireEvent.click(retry)
    expect(await screen.findByText('Community Sheet')).toBeInTheDocument()
  })

  it('closes via the backdrop, the Cancel button, and the dialog cancel event', async () => {
    mockMyTemplates([myTemplateA])
    const onClose = vi.fn()
    const { container } = render(
      <TemplatePickerModal isOpen onClose={onClose} onSelect={vi.fn()} />,
    )
    await screen.findByText('D&D 5e Sheet')

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(2)

    const dialog = container.querySelector('dialog') as HTMLDialogElement
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('resets the selection and refetches when reopened', async () => {
    mockMyTemplates([myTemplateA])
    const { rerender } = render(
      <TemplatePickerModal isOpen onClose={vi.fn()} onSelect={vi.fn()} />,
    )
    await screen.findByText('D&D 5e Sheet')
    fireEvent.click(screen.getByText('D&D 5e Sheet'))
    expect(screen.getByRole('button', { name: 'Attach Template' })).not.toBeDisabled()

    rerender(<TemplatePickerModal isOpen={false} onClose={vi.fn()} onSelect={vi.fn()} />)
    expect(screen.queryByText('D&D 5e Sheet')).not.toBeInTheDocument()

    const fetchCallsBefore = vi.mocked(api.get).mock.calls.length
    rerender(<TemplatePickerModal isOpen onClose={vi.fn()} onSelect={vi.fn()} />)
    await screen.findByText('D&D 5e Sheet')
    expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(fetchCallsBefore)
    // Selection was reset, so the confirm button is disabled again
    expect(screen.getByRole('button', { name: 'Attach Template' })).toBeDisabled()
  })
})
