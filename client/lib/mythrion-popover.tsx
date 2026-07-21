'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'

interface MythrionPopoverProps {
  children: ReactNode
  content: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  alignOffset?: number
  className?: string
  /** When true, the popover is controlled externally */
  open?: boolean
  onOpenChange?: (open: boolean) => void
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

    let top = 0
    let left = 0

    // Calculate base position
    switch (side) {
      case 'bottom':
        top = trigger.bottom + sideOffset
        break
      case 'top':
        top = trigger.top - popover.height - sideOffset
        break
      case 'left':
        left = trigger.left - popover.width - sideOffset
        break
      case 'right':
        left = trigger.right + sideOffset
        break
    }

    // Horizontal alignment
    switch (align) {
      case 'start':
        if (side === 'top' || side === 'bottom') left = trigger.left + alignOffset
        break
      case 'center':
        if (side === 'top' || side === 'bottom')
          left = trigger.left + trigger.width / 2 - popover.width / 2 + alignOffset
        break
      case 'end':
        if (side === 'top' || side === 'bottom') left = trigger.right - popover.width + alignOffset
        break
    }

    // Vertical alignment for left/right
    if (side === 'left' || side === 'right') {
      switch (align) {
        case 'start':
          top = trigger.top + alignOffset
          break
        case 'center':
          top = trigger.top + trigger.height / 2 - popover.height / 2 + alignOffset
          break
        case 'end':
          top = trigger.bottom - popover.height + alignOffset
          break
      }
    }

    // Clamp to viewport
    const margin = 8

    // Flip horizontally if needed
    if (left + popover.width > viewportWidth - margin) {
      if (side === 'bottom' || side === 'top') {
        left = viewportWidth - popover.width - margin
      } else if (side === 'right') {
        // Flip to left
        left = trigger.left - popover.width - sideOffset

        switch (align) {
          case 'center':
            top = trigger.top + trigger.height / 2 - popover.height / 2 + alignOffset
            break
        }
      }
    }
    if (left < margin) {
      if (side === 'bottom' || side === 'top') {
        left = margin
      } else if (side === 'left') {
        // Flip to right
        left = trigger.right + sideOffset

        switch (align) {
          case 'center':
            top = trigger.top + trigger.height / 2 - popover.height / 2 + alignOffset
            break
        }
      }
    }

    // Flip vertically if needed
    if (top + popover.height > viewportHeight - margin) {
      if (side === 'left' || side === 'right') {
        top = viewportHeight - popover.height - margin
      } else if (side === 'bottom') {
        // Flip to top
        top = trigger.top - popover.height - sideOffset
      }
    }
    if (top < margin) {
      if (side === 'left' || side === 'right') {
        top = margin
      } else if (side === 'top') {
        // Flip to bottom
        top = trigger.bottom + sideOffset
      }
    }

    setPopoverStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
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
        className="inline-flex items-center cursor-help"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleTriggerClick}
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