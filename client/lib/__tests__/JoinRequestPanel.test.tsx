import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { JoinRequestPanel } from '@/components/adventure/JoinRequestPanel'

// ════════════════════════════════════════════════════════════
// JoinRequestPanel
// ════════════════════════════════════════════════════════════

describe('JoinRequestPanel', () => {
  const defaultRequests = [
    {
      id: 'req-1',
      userId: 'user-1',
      userDisplayName: 'Bob Smith',
      message: 'I would love to join!',
      status: 'pending' as const,
      createdAt: '2025-06-15T10:00:00Z',
    },
  ]

  const defaultProps = {
    requests: defaultRequests,
    loading: false,
    onAccept: vi.fn(),
    onReject: vi.fn(),
    processingIds: [] as string[],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the header with pending count', () => {
    render(<JoinRequestPanel {...defaultProps} />)
    expect(screen.getByText('Join Requests')).toBeDefined()
    expect(screen.getByText('1 pending')).toBeDefined()
  })

  it('renders user name and message', () => {
    render(<JoinRequestPanel {...defaultProps} />)
    expect(screen.getByText('Bob Smith')).toBeDefined()
    expect(screen.getByText('I would love to join!')).toBeDefined()
  })

  it('shows Accept and Reject buttons for pending requests', () => {
    render(<JoinRequestPanel {...defaultProps} />)
    expect(screen.getByText('Accept')).toBeDefined()
    expect(screen.getByText('Reject')).toBeDefined()
  })

  it('calls onAccept when Accept is clicked', () => {
    const onAccept = vi.fn()
    render(<JoinRequestPanel {...defaultProps} onAccept={onAccept} />)
    fireEvent.click(screen.getByText('Accept'))
    expect(onAccept).toHaveBeenCalledWith('req-1')
  })

  it('calls onReject when Reject is clicked', () => {
    const onReject = vi.fn()
    render(<JoinRequestPanel {...defaultProps} onReject={onReject} />)
    fireEvent.click(screen.getByText('Reject'))
    expect(onReject).toHaveBeenCalledWith('req-1')
  })

  it('disables buttons when request is processing', () => {
    render(
      <JoinRequestPanel {...defaultProps} processingIds={['req-1']} />,
    )
    const acceptBtn = screen.getByText('Accepting...')
    expect(acceptBtn.closest('button')).toHaveProperty('disabled', true)
  })

  it('shows "Accepting..." on the accept button when processing', () => {
    render(
      <JoinRequestPanel {...defaultProps} processingIds={['req-1']} />,
    )
    expect(screen.getByText('Accepting...')).toBeDefined()
    expect(screen.queryByText('Accept')).toBeNull()
  })

  it('shows Accepted badge for accepted requests', () => {
    render(
      <JoinRequestPanel
        {...defaultProps}
        requests={[
          {
            ...defaultRequests[0],
            status: 'accepted' as const,
          },
        ]}
      />,
    )
    expect(screen.getByText('Accepted')).toBeDefined()
    expect(screen.queryByText('Accept')).toBeNull()
  })

  it('shows Rejected badge for rejected requests', () => {
    render(
      <JoinRequestPanel
        {...defaultProps}
        requests={[
          {
            ...defaultRequests[0],
            status: 'rejected' as const,
          },
        ]}
      />,
    )
    expect(screen.getByText('Rejected')).toBeDefined()
  })

  it('shows loading skeleton when loading', () => {
    const { container } = render(
      <JoinRequestPanel {...defaultProps} loading={true} />,
    )
    // LoadingSkeleton renders skeleton class divs
    const skeletons = container.querySelectorAll('.skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty state when no requests', () => {
    render(<JoinRequestPanel {...defaultProps} requests={[]} />)
    expect(screen.getByText('No Requests')).toBeDefined()
    expect(
      screen.getByText(
        'No one has requested to join this campaign yet.',
      ),
    ).toBeDefined()
  })

  it('collapses and expands when header is clicked', () => {
    render(<JoinRequestPanel {...defaultProps} />)
    // Start expanded
    expect(screen.getByText('Bob Smith')).toBeDefined()

    // Click header to collapse
    fireEvent.click(screen.getByText('Join Requests'))
    expect(screen.queryByText('Bob Smith')).toBeNull()

    // Click header again to expand
    fireEvent.click(screen.getByText('Join Requests'))
    expect(screen.getByText('Bob Smith')).toBeDefined()
  })

  it('handles null userDisplayName gracefully', () => {
    render(
      <JoinRequestPanel
        {...defaultProps}
        requests={[
          {
            ...defaultRequests[0],
            userDisplayName: null,
          },
        ]}
      />,
    )
    expect(screen.getByText('Unknown User')).toBeDefined()
  })

  it('handles null message gracefully', () => {
    render(
      <JoinRequestPanel
        {...defaultProps}
        requests={[
          {
            ...defaultRequests[0],
            message: null,
          },
        ]}
      />,
    )
    expect(screen.queryByText('I would love to join!')).toBeNull()
  })

  it('shows correct pending count with mixed statuses', () => {
    render(
      <JoinRequestPanel
        {...defaultProps}
        requests={[
          { ...defaultRequests[0], status: 'pending' },
          {
            id: 'req-2',
            userId: 'user-2',
            userDisplayName: 'Carol',
            message: null,
            status: 'accepted',
            createdAt: '2025-06-15T11:00:00Z',
          },
          {
            id: 'req-3',
            userId: 'user-3',
            userDisplayName: 'Dave',
            message: null,
            status: 'rejected',
            createdAt: '2025-06-15T12:00:00Z',
          },
        ]}
      />,
    )
    expect(screen.getByText('1 pending')).toBeDefined()
  })
})
