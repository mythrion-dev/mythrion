import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplateAttachmentPanel } from '@/components/adventure/TemplateAttachmentPanel'

// Mock the API
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

// Import the mocked api for assertions
const { api } = await import('@/lib/api')

// Mock the TemplatePickerModal since it's a separate component with its own complexities
vi.mock('@/components/adventure/TemplatePickerModal', () => ({
  TemplatePickerModal: vi.fn(({ isOpen, onClose, onSelect }: {
    isOpen: boolean
    onClose: () => void
    onSelect: (templateId: string, templateName: string) => void
  }) => {
    if (!isOpen) return null
    return (
      <div data-testid="template-picker-modal">
        <button onClick={() => onSelect('tpl-123', 'Test Template')}>
          Mock Select Template
        </button>
        <button onClick={onClose}>Close Picker</button>
      </div>
    )
  }),
}))

const mockSnapshot = {
  name: 'Test Template',
  description: 'A test template description',
  createdAt: '2024-01-15T00:00:00.000Z',
  attributeCount: 3,
  skillCount: 5,
  fieldCount: 2,
  profileCount: 1,
  resourceCount: 0,
  acCount: 1,
  resistCount: 0,
  sectionCount: 2,
}

const defaultProps = {
  adventureId: 'adv-1',
  originalTemplateId: null as string | null,
  templateSnapshot: null as typeof mockSnapshot | null,
  isGM: true,
  onAttached: vi.fn(),
  onDetached: vi.fn(),
}

describe('TemplateAttachmentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─────────────── Empty State ───────────────

  it('renders empty state when no template is attached', () => {
    render(<TemplateAttachmentPanel {...defaultProps} />)

    expect(screen.getByText('No template attached to this adventure yet.')).toBeInTheDocument()
    expect(screen.getByText('Template Attachment')).toBeInTheDocument()
  })

  it('shows "Attach Template" button for GM in empty state', () => {
    render(<TemplateAttachmentPanel {...defaultProps} />)

    expect(screen.getByRole('button', { name: 'Attach Template' })).toBeInTheDocument()
  })

  it('shows helper text for GM in empty state', () => {
    render(<TemplateAttachmentPanel {...defaultProps} />)

    expect(
      screen.getByText(/attach a template to allow players to create character sheets/i),
    ).toBeInTheDocument()
  })

  it('does not show GM action buttons when isGM is false', () => {
    render(<TemplateAttachmentPanel {...defaultProps} isGM={false} />)

    expect(screen.queryByRole('button', { name: 'Attach Template' })).not.toBeInTheDocument()
  })

  it('does not show helper text when isGM is false', () => {
    render(<TemplateAttachmentPanel {...defaultProps} isGM={false} />)

    expect(
      screen.queryByText(/attach a template to allow players/i),
    ).not.toBeInTheDocument()
  })

  // ─────────────── Attached State ───────────────

  it('renders snapshot info when templateSnapshot is provided', () => {
    render(
      <TemplateAttachmentPanel
        {...defaultProps}
        originalTemplateId="tpl-1"
        templateSnapshot={mockSnapshot}
      />,
    )

    expect(screen.getByText('Test Template')).toBeInTheDocument()
    expect(screen.getByText('A test template description')).toBeInTheDocument()
  })

  it('shows feature chips based on snapshot counts', () => {
    render(
      <TemplateAttachmentPanel
        {...defaultProps}
        originalTemplateId="tpl-1"
        templateSnapshot={mockSnapshot}
      />,
    )

    expect(screen.getByText('3 attr')).toBeInTheDocument()
    expect(screen.getByText('5 skills')).toBeInTheDocument()
    expect(screen.getByText('2 fields')).toBeInTheDocument()
    expect(screen.getByText('1 profiles')).toBeInTheDocument()
    expect(screen.getByText('1 AC')).toBeInTheDocument()
    expect(screen.getByText('2 sections')).toBeInTheDocument()
    // 0-count chips should not render
    expect(screen.queryByText('0 resources')).not.toBeInTheDocument()
    expect(screen.queryByText('0 resists')).not.toBeInTheDocument()
  })

  it('shows "Replace" and "Detach" buttons when template is attached and user is GM', () => {
    render(
      <TemplateAttachmentPanel
        {...defaultProps}
        originalTemplateId="tpl-1"
        templateSnapshot={mockSnapshot}
      />,
    )

    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Detach' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Attach Template' })).not.toBeInTheDocument()
  })

  it('shows "Linked to original template" when originalTemplateId exists', () => {
    render(
      <TemplateAttachmentPanel
        {...defaultProps}
        originalTemplateId="tpl-1"
        templateSnapshot={mockSnapshot}
      />,
    )

    expect(screen.getByText('Linked to original template')).toBeInTheDocument()
  })

  it('shows "Detached (snapshot preserved)" when only snapshot exists', () => {
    render(
      <TemplateAttachmentPanel
        {...defaultProps}
        originalTemplateId={null}
        templateSnapshot={mockSnapshot}
      />,
    )

    expect(screen.getByText('Detached (snapshot preserved)')).toBeInTheDocument()
  })

  it('does not show action buttons when not GM and template is attached', () => {
    render(
      <TemplateAttachmentPanel
        {...defaultProps}
        originalTemplateId="tpl-1"
        templateSnapshot={mockSnapshot}
        isGM={false}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Detach' })).not.toBeInTheDocument()
  })

  // ─────────────── Picker Modal ───────────────

  it('opens the picker modal when "Attach Template" is clicked', async () => {
    const user = userEvent.setup()
    render(<TemplateAttachmentPanel {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'Attach Template' }))

    expect(screen.getByTestId('template-picker-modal')).toBeInTheDocument()
  })

  it('calls api.post with attach endpoint on template selection', async () => {
    const onAttached = vi.fn()
    const user = userEvent.setup()

    render(
      <TemplateAttachmentPanel
        {...defaultProps}
        onAttached={onAttached}
      />,
    )

    // Open the picker
    await user.click(screen.getByRole('button', { name: 'Attach Template' }))

    // Select a template from the mocked picker
    await user.click(screen.getByText('Mock Select Template'))

    expect(api.post).toHaveBeenCalledWith('/adventures/adv-1/template/attach', {
      templateId: 'tpl-123',
    })
    expect(onAttached).toHaveBeenCalled()
  })

  it('calls api.post with replace endpoint when template is already attached', async () => {
    const onAttached = vi.fn()
    const user = userEvent.setup()

    render(
      <TemplateAttachmentPanel
        {...defaultProps}
        originalTemplateId="tpl-1"
        templateSnapshot={mockSnapshot}
        onAttached={onAttached}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Replace' }))
    await user.click(screen.getByText('Mock Select Template'))

    expect(api.post).toHaveBeenCalledWith('/adventures/adv-1/template/replace', {
      templateId: 'tpl-123',
    })
    expect(onAttached).toHaveBeenCalled()
  })

  it('shows error when attach API fails', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Failed to attach'))
    const user = userEvent.setup()

    render(<TemplateAttachmentPanel {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'Attach Template' }))
    await user.click(screen.getByText('Mock Select Template'))

    await waitFor(() => {
      expect(screen.getByText('Failed to attach')).toBeInTheDocument()
    })
  })

  // ─────────────── Detach Flow ───────────────

  it('opens the confirm modal when "Detach" is clicked', async () => {
    const user = userEvent.setup()

    render(
      <TemplateAttachmentPanel
        {...defaultProps}
        originalTemplateId="tpl-1"
        templateSnapshot={mockSnapshot}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Detach' }))

    expect(screen.getByText('Detach Sheet Template')).toBeInTheDocument()
  })

  it('calls detach API on confirm and shows success banner', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      id: 'adv-1',
      originalTemplateId: null,
      templateSnapshot: null,
    })
    const onDetached = vi.fn()
    const user = userEvent.setup()

    render(
      <TemplateAttachmentPanel
        {...defaultProps}
        originalTemplateId="tpl-1"
        templateSnapshot={mockSnapshot}
        onDetached={onDetached}
      />,
    )

    // Click Detach button
    await user.click(screen.getByRole('button', { name: 'Detach' }))

    // Confirm in modal
    await user.click(screen.getByRole('button', { name: 'Detach Template' }))

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/adventures/adv-1/template/detach')
    })
    expect(onDetached).toHaveBeenCalled()

    // Success banner should appear
    expect(screen.getByText('Sheet Template detached successfully.')).toBeInTheDocument()
  })

  it('shows error when detach API fails', async () => {
    vi.mocked(api.delete).mockRejectedValue(new Error('Detach failed'))
    const user = userEvent.setup()

    render(
      <TemplateAttachmentPanel
        {...defaultProps}
        originalTemplateId="tpl-1"
        templateSnapshot={mockSnapshot}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Detach' }))
    await user.click(screen.getByRole('button', { name: 'Detach Template' }))

    await waitFor(() => {
      // Error appears in both panel-level and modal-level banners
      const errors = screen.getAllByText('Detach failed')
      expect(errors).toHaveLength(2)
    })
  })

  it('closes confirm modal on successful detach', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      id: 'adv-1',
      originalTemplateId: null,
      templateSnapshot: null,
    })
    const user = userEvent.setup()

    render(
      <TemplateAttachmentPanel
        {...defaultProps}
        originalTemplateId="tpl-1"
        templateSnapshot={mockSnapshot}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Detach' }))
    expect(screen.getByText('Detach Sheet Template')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Detach Template' }))

    await waitFor(() => {
      expect(screen.queryByText('Detach Sheet Template')).not.toBeInTheDocument()
    })
  })

  it('shows success banner on successful detach', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      id: 'adv-1',
      originalTemplateId: null,
      templateSnapshot: null,
    })
    const user = userEvent.setup()

    render(
      <TemplateAttachmentPanel
        {...defaultProps}
        originalTemplateId="tpl-1"
        templateSnapshot={mockSnapshot}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Detach' }))
    await user.click(screen.getByRole('button', { name: 'Detach Template' }))

    await waitFor(() => {
      expect(screen.getByText('Sheet Template detached successfully.')).toBeInTheDocument()
    })
  })

  it('clears error when Detach is clicked again after error', async () => {
    vi.mocked(api.delete).mockRejectedValueOnce(new Error('First failure'))
    const user = userEvent.setup()

    render(
      <TemplateAttachmentPanel
        {...defaultProps}
        originalTemplateId="tpl-1"
        templateSnapshot={mockSnapshot}
      />,
    )

    // Trigger failure — error appears in both panel and modal banners
    await user.click(screen.getByRole('button', { name: 'Detach' }))
    await user.click(screen.getByRole('button', { name: 'Detach Template' }))
    await waitFor(() => {
      expect(screen.getAllByText('First failure').length).toBeGreaterThanOrEqual(1)
    })

    // The modal stays open on error; cancel it
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByText('Detach Sheet Template')).not.toBeInTheDocument()
    })

    // Error should be cleared since both onCancel and handleDetach call setError(null)
    expect(screen.queryByText('First failure')).not.toBeInTheDocument()
  })

  // ─────────────── Error Banner (panel level) ───────────────

  it('shows panel-level error banner on attach failure', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()

    render(<TemplateAttachmentPanel {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'Attach Template' }))

    // Wait for the picker to appear and select a template
    await screen.findByTestId('template-picker-modal')
    await user.click(screen.getByText('Mock Select Template'))

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })
})
