import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PreviewBanner } from '../PreviewBanner'
import { api } from '@/lib/api'

// ── Next/Link mock (same pattern as other component tests) ──

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    onClick,
    ...rest
  }: {
    children: React.ReactNode
    href: string
    onClick?: React.MouseEventHandler
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}))

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
}))

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}))

// ════════════════════════════════════════════════════════════════
// PreviewBanner
// ════════════════════════════════════════════════════════════════

describe('PreviewBanner', () => {
  const defaultProps = {
    templateName: 'Fighter Sheet',
    templateId: 'tpl-1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the template name', () => {
    render(<PreviewBanner {...defaultProps} />)
    expect(screen.getByText('Fighter Sheet')).toBeDefined()
  })

  it('renders "Sandbox Mode" badge', () => {
    render(<PreviewBanner {...defaultProps} />)
    expect(screen.getByText('Sandbox Mode')).toBeDefined()
  })

  it('renders "Clone this Template" button', () => {
    render(<PreviewBanner {...defaultProps} />)
    const cloneBtn = screen.getByText('Clone this Template')
    expect(cloneBtn).toBeDefined()
    expect(cloneBtn.tagName).toBe('BUTTON')
  })

  it('renders "Exit Preview" link with correct href', () => {
    render(<PreviewBanner {...defaultProps} />)
    const exitLink = screen.getByText('Exit Preview')
    expect(exitLink).toBeDefined()
    expect(exitLink.getAttribute('href')).toBe('/dashboard/public-templates')
  })

  it('renders "Previewing:" label for screen reader / visual context', () => {
    render(<PreviewBanner {...defaultProps} />)
    expect(screen.getByText(/Previewing:/)).toBeDefined()
  })

  it('renders with different template name and id', () => {
    render(<PreviewBanner templateName="Mage Sheet" templateId="tpl-42" />)
    expect(screen.getByText('Mage Sheet')).toBeDefined()
    expect(screen.getByText('Clone this Template')).toBeDefined()
  })
})

// ════════════════════════════════════════════════════════════════
// PreviewBanner — clone flow
// ════════════════════════════════════════════════════════════════

describe('PreviewBanner clone flow', () => {
  const defaultProps = {
    templateName: 'Fighter Sheet',
    templateId: 'tpl-1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clones the template and navigates to the new template on success', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 'new-tpl-9' })
    render(<PreviewBanner {...defaultProps} />)

    fireEvent.click(screen.getByText('Clone this Template'))

    expect(api.post).toHaveBeenCalledWith('/templates/tpl-1/clone', {})

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/templates/new-tpl-9')
    })
  })

  it('shows "Cloning..." and disables the button while the request is pending', async () => {
    let resolvePost!: (value: { id: string }) => void
    vi.mocked(api.post).mockImplementation(
      () => new Promise((resolve) => { resolvePost = resolve }) as Promise<{ id: string }>,
    )
    render(<PreviewBanner {...defaultProps} />)

    fireEvent.click(screen.getByText('Clone this Template'))

    expect(screen.getByText('Cloning...')).toBeDefined()
    const cloneBtn = screen.getByText('Cloning...').closest('button')
    expect(cloneBtn?.getAttribute('disabled')).not.toBeNull()

    resolvePost({ id: 'new-tpl-9' })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/templates/new-tpl-9')
    })
  })

  it('shows the error message when cloning fails with an Error', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('Something went wrong'))
    render(<PreviewBanner {...defaultProps} />)

    fireEvent.click(screen.getByText('Clone this Template'))

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeDefined()
    })
  })

  it('shows "Failed to clone template" when cloning fails with a non-Error value', async () => {
    vi.mocked(api.post).mockRejectedValue('raw-string-error')
    render(<PreviewBanner {...defaultProps} />)

    fireEvent.click(screen.getByText('Clone this Template'))

    await waitFor(() => {
      expect(screen.getByText('Failed to clone template')).toBeDefined()
    })
  })

  it('re-enables the button after a failed clone', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('boom'))
    render(<PreviewBanner {...defaultProps} />)

    fireEvent.click(screen.getByText('Clone this Template'))

    await waitFor(() => {
      expect(screen.getByText('Clone this Template')).toBeDefined()
    })
    const cloneBtn = screen.getByText('Clone this Template').closest('button')
    expect(cloneBtn?.getAttribute('disabled')).toBeNull()
  })
})
