'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'

interface MythrionPopoverProps {
  readonly children: ReactNode
  readonly content: ReactNode
  readonly side?: 'top' | 'bottom' | 'left' | 'right'
  readonly align?: 'start' | 'center' | 'end'
  readonly sideOffset?: number
  readonly alignOffset?: number
  readonly className?: string
  /** When true, the popover is controlled externally */
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
}

type PopoverSide = 'top' | 'bottom' | 'left' | 'right'
type PopoverAlign = 'start' | 'center' | 'end'

interface PopoverRect {
  readonly top: number
  readonly bottom: number
  readonly left: number
  readonly right: number
  readonly width: number
  readonly height: number
}

function getBasePosition(
  side: PopoverSide,
  trigger: PopoverRect,
  popover: PopoverRect,
  sideOffset: number,
): { top: number; left: number } {
  let top = 0
  let left = 0
  if (side === 'bottom') {
    top = trigger.bottom + sideOffset
  } else if (side === 'top') {
    top = trigger.top - popover.height - sideOffset
  } else if (side === 'left') {
    left = trigger.left - popover.width - sideOffset
  } else {
    left = trigger.right + sideOffset
  }
  return { top, left }
}

function applyAlignment(
  side: PopoverSide,
  align: PopoverAlign,
  trigger: PopoverRect,
  popover: PopoverRect,
  alignOffset: number,
  pos: { top: number; left: number },
): { top: number; left: number } {
  let { top, left } = pos
  if (side === 'top' || side === 'bottom') {
    if (align === 'start') {
      left = trigger.left + alignOffset
    } else if (align === 'center') {
      left = trigger.left + trigger.width / 2 - popover.width / 2 + alignOffset
    } else {
      left = trigger.right - popover.width + alignOffset
    }
  } else {
    if (align === 'start') {
      top = trigger.top + alignOffset
    } else if (align === 'center') {
      top = trigger.top + trigger.height / 2 - popover.height / 2 + alignOffset
    } else {
      top = trigger.bottom - popover.height + alignOffset
    }
  }
  return { top, left }
}

function flipHorizontal(
  side: PopoverSide,
  align: PopoverAlign,
  trigger: PopoverRect,
  popover: PopoverRect,
  sideOffset: number,
  alignOffset: number,
  viewportWidth: number,
  margin: number,
  pos: { top: number; left: number },
): { top: number; left: number } {
  let { top, left } = pos
  if (left + popover.width > viewportWidth - margin) {
    if (side === 'bottom' || side === 'top') {
      left = viewportWidth - popover.width - margin
    } else if (side === 'right') {
      // Flip to left
      left = trigger.left - popover.width - sideOffset
      if (align === 'center') {
        top = trigger.top + trigger.height / 2 - popover.height / 2 + alignOffset
      }
    }
  }
  if (left < margin) {
    if (side === 'bottom' || side === 'top') {
      left = margin
    } else if (side === 'left') {
      // Flip to right
      left = trigger.right + sideOffset
      if (align === 'center') {
        top = trigger.top + trigger.height / 2 - popover.height / 2 + alignOffset
      }
    }
  }
  return { top, left }
}

function flipVertical(
  side: PopoverSide,
  trigger: PopoverRect,
  popover: PopoverRect,
  sideOffset: number,
  viewportHeight: number,
  margin: number,
  top: number,
): number {
  let result = top
  if (result + popover.height > viewportHeight - margin) {
    if (side === 'left' || side === 'right') {
      result = viewportHeight - popover.height - margin
    } else if (side === 'bottom') {
      // Flip to top
      result = trigger.top - popover.height - sideOffset
    }
  }
  if (result < margin) {
    if (side === 'left' || side === 'right') {
      result = margin
    } else if (side === 'top') {
      // Flip to bottom
      result = trigger.bottom + sideOffset
    }
  }
  return result
}

export default function MythrionPopover({
  children,
  content,
  side = 'bottom',
  align = 'center',
  sideOffset = 8,
  alignOffset = 0,
  className = '',
  open: controlledOpen,
  onOpenChange,
}: MythrionPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const triggerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mouseInPopoverRef = useRef(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  const setOpen = useCallback(
    (value: boolean) => {
      if (!isControlled) setInternalOpen(value)
      onOpenChange?.(value)
    },
    [isControlled, onOpenChange],
  )

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice(navigator.maxTouchPoints > 0)
  }, [])

  // Position the popover
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !popoverRef.current) return

    const trigger = triggerRef.current.getBoundingClientRect()
    const popover = popoverRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const margin = 8

    let pos = getBasePosition(side, trigger, popover, sideOffset)
    pos = applyAlignment(side, align, trigger, popover, alignOffset, pos)
    pos = flipHorizontal(side, align, trigger, popover, sideOffset, alignOffset, viewportWidth, margin, pos)
    const top = flipVertical(side, trigger, popover, sideOffset, viewportHeight, margin, pos.top)

    setPopoverStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${pos.left}px`,
      zIndex: 100,
    })
  }, [side, align, sideOffset, alignOffset])

  useEffect(() => {
    if (isOpen) {
      // Use requestAnimationFrame to ensure popover DOM is rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(updatePosition)
      })
    }
  }, [isOpen, updatePosition, content])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    // Delay to avoid immediate close on the same click that opened
    document.addEventListener('mousedown', handleClick, true)
    document.addEventListener('keydown', handleKey, true)
    return () => {
      document.removeEventListener('mousedown', handleClick, true)
      document.removeEventListener('keydown', handleKey, true)
    }
  }, [isOpen, setOpen])

  // Recalculate on scroll/resize
  useEffect(() => {
    if (!isOpen) return
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, updatePosition])

  const handleMouseEnter = () => {
    if (isTouchDevice) return
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    setOpen(true)
  }

  const handleMouseLeave = () => {
    if (isTouchDevice) return
    if (mouseInPopoverRef.current) return
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    hoverTimeoutRef.current = setTimeout(() => {
      setOpen(false)
    }, 150)
  }

  const handleTriggerClick = (e: React.MouseEvent) => {
    if (!isTouchDevice) return
    e.preventDefault()
    e.stopPropagation()
    setOpen(!isOpen)
  }

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(!isOpen)
    }
  }

  const handlePopoverMouseEnter = () => {
    mouseInPopoverRef.current = true
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
  }

  const handlePopoverMouseLeave = () => {
    if (isTouchDevice) return
    mouseInPopoverRef.current = false
    hoverTimeoutRef.current = setTimeout(() => {
      setOpen(false)
    }, 150)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    }
  }, [])

  return (
    <>
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        className="inline-flex items-center cursor-help"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
      >
        {children}
      </div>

      {isOpen && (
        <div
          ref={popoverRef}
          role="tooltip"
          className={`animate-fade-in ${className}`}
          style={popoverStyle}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
        >
          <div className="card !p-4 max-w-xs shadow-xl border border-border-bright/30" style={{ background: '#15101f' }}>
            {content}
          </div>
        </div>
      )}
    </>
  )
}