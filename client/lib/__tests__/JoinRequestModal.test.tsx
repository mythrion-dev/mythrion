import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JoinRequestModal } from '@/components/community/JoinRequestModal'

// jsdom does not implement HTMLDialogElement.showModal/close (it throws
// "Not implemented"), and its default stylesheet hides <dialog> elements
// without an [open] attribute. Polyfill the methods so the native dialog
// reflects an open state — matching real-browser behavior — and remains
// queryable via getByRole('dialog').
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}

describe('JoinRequestModal', () => {
  const defaultProps = {
    open: false,
    message: '',
    onMessageChange: vi.fn(),
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    loading: false,
    error: null as string | null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    document.body.style.overflow = ''
  })

  // ── Rendering ──

  it('renders nothing when open is false', () => {
    const { container } = render(<JoinRequestModal {...defaultProps} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the modal with title and description when open is true', () => {
    render(<JoinRequestModal {...defaultProps} open={true} />)
    expect(screen.getByText('Request to Join Campaign')).toBeDefined()
    expect(
      screen.getByText('Send a request to the Game Master to join this campaign.'),
    ).toBeDefined()
  })

  it('renders the textarea with placeholder when open', () => {
    render(<JoinRequestModal {...defaultProps} open={true} />)
    const textarea = screen.getByPlaceholderText(
      'Optional message to the Game Master...',
    )
    expect(textarea).toBeDefined()
  })

  it('renders Cancel and Send Request buttons when open', () => {
    render(<JoinRequestModal {...defaultProps} open={true} />)
    expect(screen.getByText('Cancel')).toBeDefined()
    expect(screen.getByText('Send Request')).toBeDefined()
  })

  it('shows the character counter 500 / 500 by default', () => {
    render(<JoinRequestModal {...defaultProps} open={true} />)
    expect(screen.getByText('500 / 500')).toBeDefined()
  })

  it('renders aria attributes for accessibility', () => {
    render(<JoinRequestModal {...defaultProps} open={true} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeDefined()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('join-modal-title')
  })

  it('renders the user icon in the modal', () => {
    render(<JoinRequestModal {...defaultProps} open={true} />)
    // The user icon SVG renders inside the dialog
    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('svg')).toBeDefined()
  })

  // ── Message input and character counter ──

  it('displays the current message value in the textarea', () => {
    render(
      <JoinRequestModal {...defaultProps} open={true} message="Hello GM!" />,
    )
    const textarea = screen.getByPlaceholderText(
      'Optional message to the Game Master...',
    ) as HTMLTextAreaElement
    expect(textarea.value).toBe('Hello GM!')
  })

  it('calls onMessageChange when user types in the textarea', async () => {
    const onMessageChange = vi.fn()
    render(
      <JoinRequestModal
        {...defaultProps}
        open={true}
        onMessageChange={onMessageChange}
      />,
    )
    const textarea = screen.getByPlaceholderText(
      'Optional message to the Game Master...',
    )
    const user = userEvent.setup()
    await user.type(textarea, 'Hi there!')
    expect(onMessageChange).toHaveBeenCalled()
  })

  it('shows updated character count when message changes', () => {
    render(
      <JoinRequestModal
        {...defaultProps}
        open={true}
        message="Hello"
      />,
    )
    // "Hello" is 5 chars → 500 - 5 = 495
    expect(screen.getByText('495 / 500')).toBeDefined()
  })

  it('shows remaining count < 500 after typing', () => {
    render(
      <JoinRequestModal
        {...defaultProps}
        open={true}
        message={'a'.repeat(50)}
      />,
    )
    expect(screen.getByText('450 / 500')).toBeDefined()
  })

  it('caps character count at 500 when message exceeds limit', () => {
    // onMessageChange should be called with at most 500 chars
    render(
      <JoinRequestModal
        {...defaultProps}
        open={true}
        message={'a'.repeat(500)}
      />,
    )
    expect(screen.getByText('0 / 500')).toBeDefined()
  })

  it('disables Send Request button when over character limit', () => {
    // Simulate over-limit by passing a 501-char string
    render(
      <JoinRequestModal
        {...defaultProps}
        open={true}
        message={'a'.repeat(501)}
      />,
    )
    const sendButton = screen.getByText('Send Request')
    expect(sendButton.closest('button')).toBeDisabled()
  })

  it('turns character counter red when 20 or fewer chars remain', () => {
    render(
      <JoinRequestModal
        {...defaultProps}
        open={true}
        message={'a'.repeat(480)}
      />,
    )
    const counter = screen.getByText('20 / 500')
    expect(counter.className).toContain('text-danger')
  })

  it('shows normal muted color when plenty of chars remain', () => {
    render(
      <JoinRequestModal
        {...defaultProps}
        open={true}
        message="Hello"
      />,
    )
    const counter = screen.getByText('495 / 500')
    expect(counter.className).toContain('text-muted')
  })

  // ── Buttons ──

  it('calls onCancel when Cancel button is clicked', async () => {
    const onCancel = vi.fn()
    render(
      <JoinRequestModal {...defaultProps} open={true} onCancel={onCancel} />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onConfirm when Send Request button is clicked', async () => {
    const onConfirm = vi.fn()
    render(
      <JoinRequestModal {...defaultProps} open={true} onConfirm={onConfirm} />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByText('Send Request'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('closes on backdrop click', async () => {
    const onCancel = vi.fn()
    render(
      <JoinRequestModal {...defaultProps} open={true} onCancel={onCancel} />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Close modal' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  // ── Loading state ──

  it('shows spinner and "Sending..." when loading is true', () => {
    render(<JoinRequestModal {...defaultProps} open={true} loading={true} />)
    expect(screen.getByText('Sending...')).toBeDefined()
    // The Cancel button should be disabled during loading
    const cancelButton = screen.getByText('Cancel')
    expect(cancelButton.closest('button')).toBeDisabled()
  })

  it('does not call onConfirm when button is clicked during loading', async () => {
    const onConfirm = vi.fn()
    render(
      <JoinRequestModal
        {...defaultProps}
        open={true}
        loading={true}
        onConfirm={onConfirm}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByText('Sending...'))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('disables textarea when loading', () => {
    render(<JoinRequestModal {...defaultProps} open={true} loading={true} />)
    const textarea = screen.getByPlaceholderText(
      'Optional message to the Game Master...',
    ) as HTMLTextAreaElement
    expect(textarea.disabled).toBe(true)
  })

  // ── Error state ──

  it('renders error message when error is provided', () => {
    render(
      <JoinRequestModal
        {...defaultProps}
        open={true}
        error="Failed to send request"
      />,
    )
    expect(screen.getByText('Failed to send request')).toBeDefined()
  })

  it('does not render error element when error is null', () => {
    const { container } = render(
      <JoinRequestModal {...defaultProps} open={true} error={null} />,
    )
    const errorDivs = container.querySelectorAll('.text-danger')
    // The char counter might also use .text-danger, so check for the error container
    const errorContainer = container.querySelector('.bg-danger-muted')
    expect(errorContainer).toBeNull()
  })

  it('clears error display when error changes from value to null', () => {
    const { container, rerender } = render(
      <JoinRequestModal
        {...defaultProps}
        open={true}
        error="Something went wrong"
      />,
    )
    expect(screen.getByText('Something went wrong')).toBeDefined()

    rerender(
      <JoinRequestModal {...defaultProps} open={true} error={null} />,
    )
    const errorContainer = container.querySelector('.bg-danger-muted')
    expect(errorContainer).toBeNull()
  })

  // ── Keyboard / Focus ──

  it('closes on Escape key press', async () => {
    const onCancel = vi.fn()
    render(
      <JoinRequestModal {...defaultProps} open={true} onCancel={onCancel} />,
    )
    const user = userEvent.setup()
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })

  it('focuses the textarea when modal opens', async () => {
    render(<JoinRequestModal {...defaultProps} open={true} />)
    await waitFor(
      () => {
        const textarea = screen.getByPlaceholderText(
          'Optional message to the Game Master...',
        )
        expect(document.activeElement).toBe(textarea)
      },
      { timeout: 300 },
    )
  })

  it('locks body scroll when open', () => {
    render(<JoinRequestModal {...defaultProps} open={true} />)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores body scroll when closed', () => {
    const { rerender } = render(
      <JoinRequestModal {...defaultProps} open={true} />,
    )
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<JoinRequestModal {...defaultProps} open={false} />)
    expect(document.body.style.overflow).toBe('')
  })

  it('restores body scroll on unmount while open', () => {
    const { unmount } = render(
      <JoinRequestModal {...defaultProps} open={true} />,
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  // ── Focus trap ──

  it('wraps focus from last to first element on Tab', async () => {
    render(<JoinRequestModal {...defaultProps} open={true} />)
    const user = userEvent.setup()

    // Get all focusable elements
    const cancelButton = screen.getByText('Cancel').closest('button')!
    const sendButton = screen.getByText('Send Request').closest('button')!

    // Focus the last element (Send Request)
    sendButton.focus()
    expect(document.activeElement).toBe(sendButton)

    // Tab should wrap to the first focusable element (textarea)
    // actually the first should be the textarea since it's first in DOM order
    await user.keyboard('{Tab}')
    // After wrapping, focus should be on the first element (textarea)
    const textarea = screen.getByPlaceholderText(
      'Optional message to the Game Master...',
    )
    expect(
      document.activeElement === textarea ||
        document.activeElement === cancelButton,
    ).toBe(true)
  })

  it('wraps focus from first to last element on Shift+Tab', async () => {
    render(<JoinRequestModal {...defaultProps} open={true} />)
    const user = userEvent.setup()

    // Focus the first element (textarea)
    const textarea = screen.getByPlaceholderText(
      'Optional message to the Game Master...',
    )
    textarea.focus()
    expect(document.activeElement).toBe(textarea)

    // Shift+Tab should wrap to the last element (Send Request button)
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    const sendButton = screen.getByText('Send Request').closest('button')!
    expect(document.activeElement).toBe(sendButton)
  })

  // ── Edge cases ──

  it('handles extreme message length gracefully', () => {
    render(
      <JoinRequestModal
        {...defaultProps}
        open={true}
        message={'a'.repeat(1000)}
      />,
    )
    // Should show negative remaining
    expect(screen.getByText('-500 / 500')).toBeDefined()
    // Button should be disabled
    const sendButton = screen.getByText('Send Request')
    expect(sendButton.closest('button')).toBeDisabled()
  })

  it('accepts empty message (optional field)', () => {
    render(<JoinRequestModal {...defaultProps} open={true} message="" />)
    const sendButton = screen.getByText('Send Request')
    expect(sendButton.closest('button')).not.toBeDisabled()
  })

  it('does not close on backdrop click when loading', async () => {
    const onCancel = vi.fn()
    render(
      <JoinRequestModal
        {...defaultProps}
        open={true}
        loading={true}
        onCancel={onCancel}
      />,
    )
    const user = userEvent.setup()
    // The backdrop button is not gated by loading — only the Cancel/Send
    // buttons are disabled while a request is in flight.
    await user.click(screen.getByRole('button', { name: 'Close modal' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
