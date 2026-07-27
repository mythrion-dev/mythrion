'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size as floatingSize,
} from '@floating-ui/react'

export interface SelectOption {
  id: string
  label: string
  value?: number
}

interface SelectProps {
  options: SelectOption[]
  value: string | null
  onChange: (val: string) => void
  disabled?: boolean
  showBadge?: boolean
  size?: 'sm' | 'md'
  className?: string
}

const sizeClasses: Record<string, string> = {
  sm: 'py-0.5 text-[0.6rem]',
  md: 'py-1.5 text-sm',
}

export function Select({
  options,
  value,
  onChange,
  disabled = false,
  showBadge = false,
  size = 'md',
  className = '',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(o => o.id === value) ?? null
  const displayLabel = selectedOption?.label ?? ''

  // ── Floating UI positioning (portal-ready) ──

  const { refs, floatingStyles } = useFloating({
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      floatingSize({
        apply({ availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.min(availableHeight || 192, 192)}px`,
          })
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  })

  // Sync refs — triggerRef + listRef for imperative access, refs for Floating UI
  const setReference = useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node
      refs.setReference(node)
    },
    [refs],
  )

  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node
      refs.setFloating(node)
    },
    [refs],
  )

  // ── Outside click (portal-aware: checks both container & floating element) ──

  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node
      const inContainer = containerRef.current?.contains(target)
      const inFloating = listRef.current?.contains(target)
      if (!inContainer && !inFloating) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('touchstart', handleMouseDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('touchstart', handleMouseDown)
    }
  }, [open])

  // ── Scroll highlighted option into view ──

  useEffect(() => {
    if (!open || highlightIndex < 0 || !listRef.current) return
    const items = listRef.current.querySelectorAll<HTMLButtonElement>('[role="option"]')
    const item = items[highlightIndex]
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }, [open, highlightIndex])

  // ── Keyboard navigation ──

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (open && highlightIndex >= 0 && highlightIndex < options.length) {
            onChange(options[highlightIndex].id)
            setOpen(false)
          } else if (!open) {
            setOpen(true)
            const idx = value ? options.findIndex(o => o.id === value) : -1
            setHighlightIndex(idx >= 0 ? idx : 0)
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          if (!open) {
            setOpen(true)
            setHighlightIndex(0)
          } else {
            setHighlightIndex(prev => (prev < options.length - 1 ? prev + 1 : 0))
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (!open) {
            setOpen(true)
            setHighlightIndex(options.length - 1)
          } else {
            setHighlightIndex(prev => (prev > 0 ? prev - 1 : options.length - 1))
          }
          break
        case 'Escape':
          e.preventDefault()
          setOpen(false)
          triggerRef.current?.focus()
          break
      }
    },
    [disabled, open, highlightIndex, options, value, onChange],
  )

  // ── Event handlers ──

  const handleClickTrigger = () => {
    if (disabled) return
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen) {
      const idx = value ? options.findIndex(o => o.id === value) : -1
      setHighlightIndex(idx >= 0 ? idx : 0)
    }
  }

  const handleSelect = (optId: string) => {
    onChange(optId)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const badgeValue =
    showBadge && selectedOption?.value != null
      ? (selectedOption.value >= 0 ? '+' : '') + selectedOption.value
      : null

  // ── Render ──

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={setReference}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={
          open && highlightIndex >= 0
            ? `select-opt-${options[highlightIndex]?.id}`
            : undefined
        }
        onClick={handleClickTrigger}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          input-field w-full text-left flex items-center gap-1.5
          transition-all duration-150
          ${sizeClasses[size]}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${open ? 'border-primary/50 ring-1 ring-primary/50' : ''}
        `}
      >
        <span className="flex-1 truncate leading-none">
          {displayLabel || <span className="text-muted">&mdash;</span>}
        </span>
        {badgeValue && (
          <span className="font-mono text-primary shrink-0 tabular-nums leading-none">
            {badgeValue}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`h-3 w-3 text-muted transition-transform duration-150 shrink-0 ${open ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={setFloating}
            role="listbox"
            tabIndex={-1}
            style={{
              ...floatingStyles,
              zIndex: 10000,
              overflowY: 'auto',
            }}
            className="
              rounded-lg border border-[#2a2240]
              bg-[#0d0a14] shadow-xl
            "
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted">No options</div>
            ) : (
              options.map((opt, idx) => {
                const isSelected = opt.id === value
                const isHighlighted = idx === highlightIndex
                return (
                  <button
                    key={opt.id}
                    id={`select-opt-${opt.id}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.id)}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={`
                      w-full text-left px-3 py-1.5 text-xs leading-none
                      transition-colors duration-75
                      flex items-center gap-1.5
                      ${
                        isSelected
                          ? 'text-[#c9a44b] bg-[rgba(201,164,75,0.15)] border-l-2 border-[#c9a44b]'
                          : 'text-[#e8e2d9] border-l-2 border-transparent'
                      }
                      ${
                        isHighlighted && !isSelected
                          ? 'bg-[rgba(201,164,75,0.08)]'
                          : ''
                      }
                      ${
                        !isSelected && !isHighlighted
                          ? 'hover:bg-[rgba(201,164,75,0.05)]'
                          : ''
                      }
                    `}
                  >
                    <span className="flex-1">{opt.label}</span>
                    {showBadge && opt.value != null && (
                      <span className="font-mono text-[0.55rem] text-muted tabular-nums">
                        {opt.value >= 0 ? '+' : ''}
                        {opt.value}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
