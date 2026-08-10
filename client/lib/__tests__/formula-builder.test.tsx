import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import FormulaBuilder from '@/lib/formula-builder'
import MythrionPopover from '@/lib/mythrion-popover'

// ──────────────────────────────────────────────
// FormulaBuilder
// ──────────────────────────────────────────────

describe('FormulaBuilder', () => {
  it('renders a textarea with the provided value', () => {
    render(
      <FormulaBuilder
        value="5 + @str"
        onChange={() => {}}
        attributes={[{ key: 'str', name: 'Strength' }]}
      />,
    )
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveValue('5 + @str')
  })

  it('calls onChange when the textarea value changes', () => {
    const onChange = vi.fn()
    render(
      <FormulaBuilder
        value=""
        onChange={onChange}
        attributes={[{ key: 'str', name: 'Strength' }]}
      />,
    )
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '@dex + 3' },
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('@dex + 3')
  })

  it('shows the hint when attributes is an empty array', () => {
    render(<FormulaBuilder value="" onChange={() => {}} attributes={[]} />)
    expect(
      screen.getByText(
        'Add attributes to the template first, then come back to build formulas.',
      ),
    ).toBeInTheDocument()
  })

  it('does NOT show the hint when attributes has items', () => {
    render(
      <FormulaBuilder
        value=""
        onChange={() => {}}
        attributes={[{ key: 'str', name: 'Strength' }]}
      />,
    )
    expect(
      screen.queryByText(
        'Add attributes to the template first, then come back to build formulas.',
      ),
    ).not.toBeInTheDocument()
  })

  it('uses the default placeholder when none is provided', () => {
    render(
      <FormulaBuilder
        value=""
        onChange={() => {}}
        attributes={[{ key: 'str', name: 'Strength' }]}
      />,
    )
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'placeholder',
      'Type formula manually...',
    )
  })

  it('uses a custom placeholder when provided', () => {
    render(
      <FormulaBuilder
        value=""
        onChange={() => {}}
        attributes={[{ key: 'str', name: 'Strength' }]}
        placeholder="Enter custom formula..."
      />,
    )
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'placeholder',
      'Enter custom formula...',
    )
  })
})

// ──────────────────────────────────────────────
// MythrionPopover
// ──────────────────────────────────────────────

/**
 * Create a mock DOMRect for getBoundingClientRect.
 */
function mockRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON() {
      return {}
    },
    ...overrides,
  } as DOMRect
}

/**
 * Replace requestAnimationFrame so it fires the callback synchronously.
 * This avoids the double-rAF delay in position calculations.
 */
function useSyncRAF() {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(performance.now())
    return 0
  })
}

/**
 * Restore the real requestAnimationFrame.
 */
function restoreRAF() {
  vi.restoreAllMocks()
}

/**
 * Helper: open a MythrionPopover by dispatching mouseOver on the trigger.
 * React 18 implements onMouseEnter by listening to native mouseover events,
 * so fireEvent.mouseEnter is NOT sufficient — we must fire mouseOver.
 * Uses act() so React flushes state updates synchronously.
 */
function openViaMouseEnter(triggerText: string) {
  const trigger = screen.getByText(triggerText).closest('button')!
  act(() => {
    fireEvent.mouseOver(trigger)
  })
}

/**
 * Helper: dispatch mouseOut on the trigger element.
 * React 18 implements onMouseLeave by listening to native mouseout events,
 * so fireEvent.mouseLeave is NOT sufficient — we must fire mouseOut.
 */
function leaveTrigger(triggerText: string) {
  const trigger = screen.getByText(triggerText).closest('button')!
  act(() => {
    fireEvent.mouseOut(trigger)
  })
}

describe('MythrionPopover', () => {
  afterEach(() => {
    restoreRAF()
  })

  // ── Basic render / open-close ──

  it('renders the trigger children', () => {
    render(
      <MythrionPopover content="tooltip content">
        <button>Hover me</button>
      </MythrionPopover>,
    )
    expect(screen.getByText('Hover me')).toBeInTheDocument()
  })

  it('does NOT render content when closed (uncontrolled)', () => {
    render(
      <MythrionPopover content="secret content">
        <button>Hover me</button>
      </MythrionPopover>,
    )
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()
  })

  it('renders content when controlled open={true}', () => {
    useSyncRAF()
    render(
      <MythrionPopover open={true} content="visible content">
        <button>Trigger</button>
      </MythrionPopover>,
    )
    expect(screen.getByText('visible content')).toBeInTheDocument()
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('hides content when controlled open={false}', () => {
    render(
      <MythrionPopover open={false} content="hidden content">
        <button>Trigger</button>
      </MythrionPopover>,
    )
    expect(screen.queryByText('hidden content')).not.toBeInTheDocument()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('has role="tooltip" on the popover element', () => {
    useSyncRAF()
    render(
      <MythrionPopover open={true} content="tooltip content">
        <button>Trigger</button>
      </MythrionPopover>,
    )
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toBeInTheDocument()
    expect(tooltip.textContent).toContain('tooltip content')
  })

  // ── Mouse enter / leave (desktop / non-touch) ──

  it('opens on mouseEnter and closes on mouseLeave after timeout', () => {
    useSyncRAF()
    vi.useFakeTimers({ toFake: ['setTimeout'] })

    render(
      <MythrionPopover content="popover content">
        <span>trigger</span>
      </MythrionPopover>,
    )

    expect(screen.queryByText('popover content')).not.toBeInTheDocument()

    openViaMouseEnter('trigger')
    expect(screen.getByText('popover content')).toBeInTheDocument()

    leaveTrigger('trigger')
    // Still visible before timeout
    expect(screen.getByText('popover content')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(screen.queryByText('popover content')).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('keeps the popover open for 150ms after mouseLeave then closes', () => {
    useSyncRAF()
    vi.useFakeTimers({ toFake: ['setTimeout'] })

    render(
      <MythrionPopover content="hover content">
        <span>trigger</span>
      </MythrionPopover>,
    )

    // Open popover via hover
    openViaMouseEnter('trigger')
    expect(screen.getByText('hover content')).toBeInTheDocument()

    const triggerEl = screen.getByText('trigger').closest('button')!

    // Leave the trigger — starts the 150ms close timeout
    act(() => {
      fireEvent.mouseOut(triggerEl)
    })
    // Popover stays open immediately after mouseOut
    expect(screen.getByText('hover content')).toBeInTheDocument()

    // Before 150ms, popover is still open
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(screen.getByText('hover content')).toBeInTheDocument()

    // After 150ms total, popover closes
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(screen.queryByText('hover content')).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  // ── Touch device ──

  describe('touch device behavior', () => {
    const originalMaxTouchDesc = Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints')

    beforeEach(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 1,
        configurable: true,
        writable: true,
      })
      useSyncRAF()
    })

    afterEach(() => {
      if (originalMaxTouchDesc) {
        Object.defineProperty(navigator, 'maxTouchPoints', originalMaxTouchDesc)
      } else {
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true })
      }
    })

    it('opens on click when touch device and closes on second click (toggle)', () => {
      render(
        <MythrionPopover content="touch content">
          <span>trigger</span>
        </MythrionPopover>,
      )

      expect(screen.queryByText('touch content')).not.toBeInTheDocument()

      const triggerContainer = screen.getByText('trigger').closest('button')!
      act(() => {
        fireEvent.click(triggerContainer)
      })

      expect(screen.getByText('touch content')).toBeInTheDocument()

      // Click again to close
      act(() => {
        fireEvent.click(triggerContainer)
      })

      expect(screen.queryByText('touch content')).not.toBeInTheDocument()
    })

    it('does NOT open on mouseEnter on touch device', () => {
      render(
        <MythrionPopover content="no hover">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const triggerContainer = screen.getByText('trigger').closest('button')!
      // React 18 implements onMouseEnter via native mouseover, not mouseenter
      fireEvent.mouseOver(triggerContainer)

      expect(screen.queryByText('no hover')).not.toBeInTheDocument()
    })

    it('does NOT close on mouseLeave on touch device', () => {
      render(
        <MythrionPopover open={true} content="persistent">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const triggerContainer = screen.getByText('trigger').closest('button')!
      // React 18 implements onMouseLeave via native mouseout, not mouseleave
      fireEvent.mouseOut(triggerContainer)

      expect(screen.getByText('persistent')).toBeInTheDocument()
    })
  })

  // ── Keyboard / click-outside (uncontrolled) ──

  describe('close behaviors (uncontrolled)', () => {
    beforeEach(() => {
      useSyncRAF()
    })

    it('closes on Escape key', () => {
      render(
        <MythrionPopover content="escape content">
          <span>trigger</span>
        </MythrionPopover>,
      )

      openViaMouseEnter('trigger')
      expect(screen.getByText('escape content')).toBeInTheDocument()

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' })
      })

      expect(screen.queryByText('escape content')).not.toBeInTheDocument()
    })

    it('closes on mousedown outside the popover', () => {
      render(
        <MythrionPopover content="outside content">
          <span>trigger</span>
        </MythrionPopover>,
      )

      openViaMouseEnter('trigger')
      expect(screen.getByText('outside content')).toBeInTheDocument()

      act(() => {
        fireEvent.mouseDown(document.body)
      })

      expect(screen.queryByText('outside content')).not.toBeInTheDocument()
    })

    it('does NOT close on mousedown on the trigger element', () => {
      render(
        <MythrionPopover content="stay content">
          <span>trigger</span>
        </MythrionPopover>,
      )

      openViaMouseEnter('trigger')
      expect(screen.getByText('stay content')).toBeInTheDocument()

      const triggerContainer = screen.getByText('trigger').closest('button')!
      act(() => {
        fireEvent.mouseDown(triggerContainer)
      })

      expect(screen.getByText('stay content')).toBeInTheDocument()
    })

    it('does NOT close on mousedown on the popover itself', () => {
      render(
        <MythrionPopover content="inside content">
          <span>trigger</span>
        </MythrionPopover>,
      )

      openViaMouseEnter('trigger')
      expect(screen.getByText('inside content')).toBeInTheDocument()

      const popover = screen.getByRole('tooltip')
      act(() => {
        fireEvent.mouseDown(popover)
      })

      expect(screen.getByText('inside content')).toBeInTheDocument()
    })
  })

  // ── Positioning ──

  describe('positioning', () => {
    beforeEach(() => {
      useSyncRAF()
    })

    it('positions with default side="bottom" align="center"', () => {
      const rect = mockRect({
        top: 100,
        bottom: 130,
        left: 200,
        right: 400,
        width: 200,
        height: 30,
      })
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect)

      render(
        <MythrionPopover open={true} content="positioned content">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.style.position).toBe('fixed')
      expect(tooltip.style.top).toBe('138px')
      expect(tooltip.style.left).toBe('200px')
      expect(tooltip.style.zIndex).toBe('100')
    })

    it('positions with side="top"', () => {
      const rect = mockRect({
        top: 100, bottom: 130, left: 200, right: 400, width: 200, height: 30,
      })
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect)

      render(
        <MythrionPopover side="top" open={true} content="top content">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.style.top).toBe('62px')
    })

    it('positions with side="left"', () => {
      const rect = mockRect({
        top: 100, bottom: 130, left: 300, right: 500, width: 200, height: 30,
      })
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect)

      render(
        <MythrionPopover side="left" open={true} content="left content">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.style.left).toBe('92px')
    })

    it('positions with side="right"', () => {
      const rect = mockRect({
        top: 100, bottom: 130, left: 200, right: 400, width: 200, height: 30,
      })
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect)

      render(
        <MythrionPopover side="right" open={true} content="right content">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.style.left).toBe('408px')
    })

    it('aligns start (top/bottom)', () => {
      const rect = mockRect({
        top: 100, bottom: 130, left: 200, right: 400, width: 200, height: 30,
      })
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect)

      render(
        <MythrionPopover align="start" open={true} content="start content">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.style.left).toBe('200px')
    })

    it('aligns end (top/bottom)', () => {
      const rect = mockRect({
        top: 100, bottom: 130, left: 200, right: 400, width: 200, height: 30,
      })
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect)

      render(
        <MythrionPopover align="end" open={true} content="end content">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.style.left).toBe('200px')
    })

    it('positions with side="left" and vertical align="start"', () => {
      const rect = mockRect({
        top: 100, bottom: 130, left: 300, right: 500, width: 200, height: 30,
      })
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect)

      render(
        <MythrionPopover side="left" align="start" open={true} content="left start">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.style.top).toBe('100px')
    })

    it('positions with side="right" and vertical align="end"', () => {
      const rect = mockRect({
        top: 100, bottom: 130, left: 200, right: 400, width: 200, height: 30,
      })
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect)

      render(
        <MythrionPopover side="right" align="end" open={true} content="right end">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.style.top).toBe('100px')
    })

    it('applies sideOffset and alignOffset', () => {
      const rect = mockRect({
        top: 100, bottom: 130, left: 200, right: 400, width: 200, height: 30,
      })
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect)

      render(
        <MythrionPopover
          side="bottom"
          align="start"
          sideOffset={20}
          alignOffset={15}
          open={true}
          content="offset content"
        >
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.style.top).toBe('150px')
      expect(tooltip.style.left).toBe('215px')
    })
  })

  // ── Position clamping / flipping ──

  describe('position clamping and flipping', () => {
    beforeEach(() => {
      useSyncRAF()
    })

    it('clamps left when popover overflows the right viewport edge', () => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
        mockRect({
          top: 100, bottom: 130, left: 900, right: 1100, width: 200, height: 30,
        }),
      )

      render(
        <MythrionPopover side="bottom" open={true} content="right overflow">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      // 900 + 200 = 1100 > 1024 - 8 = 1016 → clamp left = 1024 - 200 - 8 = 816
      expect(tooltip.style.left).toBe('816px')
    })

    it('clamps left when popover overflows the left viewport edge', () => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
        mockRect({
          top: 100, bottom: 130, left: -50, right: 150, width: 200, height: 30,
        }),
      )

      render(
        <MythrionPopover side="bottom" open={true} content="left overflow">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.style.left).toBe('8px')
    })

    it('flips right-side popover to left when it overflows horizontally', () => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
        mockRect({
          top: 100, bottom: 130, left: 900, right: 1100, width: 200, height: 30,
        }),
      )

      render(
        <MythrionPopover side="right" open={true} content="flip right">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      // right: 1100 + 8 = 1108 > 1016 → flip left: 900 - 200 - 8 = 692
      expect(tooltip.style.left).toBe('692px')
      expect(tooltip.style.top).toBe('100px')
    })

    it('flips left-side popover to right when it overflows horizontally', () => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
        mockRect({
          top: 100, bottom: 130, left: 10, right: 210, width: 200, height: 30,
        }),
      )

      render(
        <MythrionPopover side="left" open={true} content="flip left">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      // left: 10 - 200 - 8 = -198 < 8 → flip right: 210 + 8 = 218
      expect(tooltip.style.left).toBe('218px')
      expect(tooltip.style.top).toBe('100px')
    })

    it('flips bottom-side popover up when it overflows vertically', () => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
        mockRect({
          top: 740, bottom: 770, left: 200, right: 400, width: 200, height: 30,
        }),
      )

      render(
        <MythrionPopover side="bottom" open={true} content="bottom overflow">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      // 770 + 8 = 778 > 760 → flip top: 740 - 30 - 8 = 702
      expect(tooltip.style.top).toBe('702px')
    })

    it('flips top-side popover down when it overflows the top', () => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
        mockRect({
          top: 10, bottom: 40, left: 200, right: 400, width: 200, height: 30,
        }),
      )

      render(
        <MythrionPopover side="top" open={true} content="top overflow">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      // 10 - 30 - 8 = -28 < 8 → flip bottom: 40 + 8 = 48
      expect(tooltip.style.top).toBe('48px')
    })

    it('clamps left/right side popover vertically when it overflows bottom', () => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
        mockRect({
          top: 740, bottom: 770, left: 200, right: 400, width: 200, height: 30,
        }),
      )

      render(
        <MythrionPopover side="right" open={true} content="right vertical overflow">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      // 740 + 15 - 15 = 740. 740 + 30 = 770 > 760 → clamp: 768 - 30 - 8 = 730
      expect(tooltip.style.top).toBe('730px')
    })

    it('clamps left/right side popover up when it overflows the top', () => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
        mockRect({
          top: 5, bottom: 35, left: 200, right: 400, width: 200, height: 30,
        }),
      )

      render(
        <MythrionPopover side="right" open={true} content="right top overflow">
          <span>trigger</span>
        </MythrionPopover>,
      )

      const tooltip = screen.getByRole('tooltip')
      // 5 + 15 - 15 = 5 < 8 → clamp: 8
      expect(tooltip.style.top).toBe('8px')
    })
  })

  // ── className ──

  it('applies the className prop to the popover container', () => {
    useSyncRAF()
    render(
      <MythrionPopover open={true} className="custom-popover-class" content="classy">
        <span>trigger</span>
      </MythrionPopover>,
    )

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.className).toContain('custom-popover-class')
  })

  // ── Scroll / resize ──

  it('attaches scroll and resize listeners when open and cleans up on unmount', () => {
    useSyncRAF()
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = render(
      <MythrionPopover open={true} content="scroll test">
        <span>trigger</span>
      </MythrionPopover>,
    )

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      true,
    )
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    )

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      true,
    )
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    )

    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })

  it('does not attach scroll/resize when closed', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

    render(
      <MythrionPopover open={false} content="no scroll">
        <span>trigger</span>
      </MythrionPopover>,
    )

    expect(addEventListenerSpy).not.toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      true,
    )

    addEventListenerSpy.mockRestore()
  })

  // ── Hover timeout cleanup on unmount ──

  it('does not close after unmount when a hover timeout was scheduled', () => {
    useSyncRAF()
    vi.useFakeTimers({ toFake: ['setTimeout'] })

    const { unmount } = render(
      <MythrionPopover content="cleanup content">
        <span>trigger</span>
      </MythrionPopover>,
    )

    openViaMouseEnter('trigger')
    expect(screen.getByText('cleanup content')).toBeInTheDocument()

    // Leave trigger — schedules 150ms close timeout
    leaveTrigger('trigger')

    // Unmount before the timeout fires
    unmount()

    // Advance past the 150ms — cleanup effects already cleared the timeout
    expect(() => vi.advanceTimersByTime(200)).not.toThrow()

    vi.useRealTimers()
  })

  // ── Controlled: onOpenChange notifications ──

  describe('controlled mode notifications', () => {
    beforeEach(() => {
      useSyncRAF()
    })

    it('calls onOpenChange(false) when popover is closed via Escape in controlled mode', () => {
      const onOpenChange = vi.fn()

      render(
        <MythrionPopover open={true} onOpenChange={onOpenChange} content="esc controlled">
          <span>trigger</span>
        </MythrionPopover>,
      )

      expect(screen.getByText('esc controlled')).toBeInTheDocument()

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' })
      })

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('calls onOpenChange(false) when popover is closed via click outside in controlled mode', () => {
      const onOpenChange = vi.fn()

      render(
        <MythrionPopover open={true} onOpenChange={onOpenChange} content="outside controlled">
          <span>trigger</span>
        </MythrionPopover>,
      )

      expect(screen.getByText('outside controlled')).toBeInTheDocument()

      act(() => {
        fireEvent.mouseDown(document.body)
      })

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('calls onOpenChange(false) when popover closes via mouseLeave in controlled mode', () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] })
      const onOpenChange = vi.fn()

      render(
        <MythrionPopover open={true} onOpenChange={onOpenChange} content="leave popover">
          <span>trigger</span>
        </MythrionPopover>,
      )

      expect(screen.getByText('leave popover')).toBeInTheDocument()

      leaveTrigger('trigger')
      vi.advanceTimersByTime(150)

      expect(onOpenChange).toHaveBeenCalledWith(false)

      vi.useRealTimers()
    })
  })

  // ── Touch device detection (maxTouchPoints path) ──

  it('detects touch device via maxTouchPoints', () => {
    const originalMaxTouchDesc = Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints')

    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 1,
      configurable: true,
      writable: true,
    })

    useSyncRAF()

    render(
      <MythrionPopover open={true} content="touch max points">
        <span>trigger</span>
      </MythrionPopover>,
    )

    expect(screen.getByText('touch max points')).toBeInTheDocument()

    if (originalMaxTouchDesc) {
      Object.defineProperty(navigator, 'maxTouchPoints', originalMaxTouchDesc)
    } else {
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true })
    }
  })

  // ── Recalculate position when isOpen becomes true ──

  it('recalculates position when isOpen transitions from false to true', () => {
    useSyncRAF()

    const rect = mockRect({
      top: 50, bottom: 80, left: 100, right: 300, width: 200, height: 30,
    })
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect)

    const { rerender } = render(
      <MythrionPopover open={false} content="recalc">
        <span>trigger</span>
      </MythrionPopover>,
    )

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    rerender(
      <MythrionPopover open={true} content="recalc">
        <span>trigger</span>
      </MythrionPopover>,
    )

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.style.position).toBe('fixed')
    expect(tooltip.style.top).toBe('88px')
  })

  // ── Popover element mouse enter/leave ──

  describe('popover element mouse handlers', () => {
    beforeEach(() => {
      useSyncRAF()
    })

    it('keeps popover open when mouse enters the popover from the trigger (handlePopoverMouseEnter)', () => {
      render(
        <MythrionPopover content="popover mouse enter">
          <span>trigger</span>
        </MythrionPopover>,
      )

      // Open popover via hover
      openViaMouseEnter('trigger')
      expect(screen.getByText('popover mouse enter')).toBeInTheDocument()

      // Leave trigger — queued 150ms close timeout (hasn't fired yet in sync test)
      leaveTrigger('trigger')
      // Popover still open immediately after mouseLeave
      expect(screen.getByText('popover mouse enter')).toBeInTheDocument()

      // Mouse enters popover — handlePopoverMouseEnter clears the pending close timeout
      const popover = screen.getByRole('tooltip')
      act(() => {
        fireEvent.mouseOver(popover)
      })

      // Popover should remain open (timeout cleared)
      expect(screen.getByText('popover mouse enter')).toBeInTheDocument()
    })

    it('closes after mouse leaves the popover (handlePopoverMouseLeave)', () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] })

      render(
        <MythrionPopover content="popover mouse leave">
          <span>trigger</span>
        </MythrionPopover>,
      )

      // Open popover via hover
      openViaMouseEnter('trigger')
      expect(screen.getByText('popover mouse leave')).toBeInTheDocument()

      // Leave trigger — starts 150ms close timeout
      leaveTrigger('trigger')

      // Mouse enters popover — handlePopoverMouseEnter clears the close timeout
      const popover = screen.getByRole('tooltip')
      act(() => {
        fireEvent.mouseOver(popover)
      })

      // Mouse leaves popover — handlePopoverMouseLeave starts a new 150ms timeout
      act(() => {
        fireEvent.mouseOut(popover)
      })

      // Before 150ms, popover is still open
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(screen.getByText('popover mouse leave')).toBeInTheDocument()

      // After 150ms from popover's mouseLeave, popover closes
      act(() => {
        vi.advanceTimersByTime(50)
      })
      expect(screen.queryByText('popover mouse leave')).not.toBeInTheDocument()

      vi.useRealTimers()
    })
  })

  // ── Uncontrolled internal toggle with touch click ──

  it('toggles internal state when trigger is clicked on touch device (uncontrolled)', () => {
    const originalMaxTouchDesc = Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints')
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 1, configurable: true, writable: true })
    useSyncRAF()

    render(
      <MythrionPopover content="toggle internal">
        <span>trigger</span>
      </MythrionPopover>,
    )

    const triggerContainer = screen.getByText('trigger').closest('button')!

    // Click to open
    act(() => {
      fireEvent.click(triggerContainer)
    })
    expect(screen.getByText('toggle internal')).toBeInTheDocument()

    // Click to close
    act(() => {
      fireEvent.click(triggerContainer)
    })
    expect(screen.queryByText('toggle internal')).not.toBeInTheDocument()

    if (originalMaxTouchDesc) {
      Object.defineProperty(navigator, 'maxTouchPoints', originalMaxTouchDesc)
    } else {
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true })
    }
  })
})
