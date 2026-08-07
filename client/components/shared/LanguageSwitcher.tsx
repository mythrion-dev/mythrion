'use client'

import { useEffect, useRef, useState, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import { applyLanguage, normalizeLanguage, type Language } from '@/i18n'
import { useFloating, autoUpdate, offset, flip, shift } from '@floating-ui/react'

const OPTIONS: ReadonlyArray<{ code: Language; flag: string; labelKey: 'common:english' | 'common:portuguese' }> = [
  { code: 'en', flag: '🇺🇸', labelKey: 'common:english' },
  { code: 'pt-BR', flag: '🇧🇷', labelKey: 'common:portuguese' },
]

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const current = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language)
  const currentIndex = OPTIONS.findIndex((o) => o.code === current)

  // Floating overlay menu, portaled to <body>. strategy "fixed" keeps it out of
  // any ancestor's overflow/stacking context (the sidebar clips with
  // overflow-hidden); flip() opens upward near the viewport bottom and shift()
  // keeps it fully on-screen. Portaling means opening never affects layout.
  const { refs, floatingStyles } = useFloating({
    strategy: 'fixed',
    placement: 'bottom-end',
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })

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

  // Outside click — portal-aware: clicks inside the portaled dropdown itself
  // (in the floating element) must not close it.
  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node
      const inContainer = containerRef.current?.contains(target)
      const inFloating = listRef.current?.contains(target)
      if (!inContainer && !inFloating) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [open])

  // Escape closes from anywhere and returns focus to the trigger.
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Keep the highlighted option visible in the (small) dropdown.
  useEffect(() => {
    if (!open || highlightIndex < 0 || !listRef.current) return
    const items = listRef.current.querySelectorAll<HTMLButtonElement>('[role="option"]')
    const item = items[highlightIndex]
    if (item && typeof item.scrollIntoView === 'function') {
      item.scrollIntoView({ block: 'nearest' })
    }
  }, [open, highlightIndex])

  async function handleSelect(code: Language) {
    setOpen(false)
    triggerRef.current?.focus()
    await applyLanguage(code)
    // Persist to the backend for authenticated users (DB is authoritative).
    if (user) {
      void api.patch('/auth/language', { language: code }).catch(() => {})
    }
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (open && highlightIndex >= 0 && highlightIndex < OPTIONS.length) {
          void handleSelect(OPTIONS[highlightIndex].code)
        } else if (!open) {
          setOpen(true)
          setHighlightIndex(currentIndex >= 0 ? currentIndex : 0)
        }
        break
      case 'ArrowDown':
        e.preventDefault()
        if (!open) {
          setOpen(true)
          setHighlightIndex(0)
        } else {
          setHighlightIndex((prev) => (prev < OPTIONS.length - 1 ? prev + 1 : 0))
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!open) {
          setOpen(true)
          setHighlightIndex(OPTIONS.length - 1)
        } else {
          setHighlightIndex((prev) => (prev > 0 ? prev - 1 : OPTIONS.length - 1))
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
        break
    }
  }

  const currentOption = OPTIONS.find((o) => o.code === current) ?? OPTIONS[0]

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={setReference}
        type="button"
        role="combobox"
        aria-label={t('common:language')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="language-menu"
        aria-activedescendant={
          open && highlightIndex >= 0 ? `language-opt-${OPTIONS[highlightIndex]?.code}` : undefined
        }
        onClick={() => {
          const nextOpen = !open
          setOpen(nextOpen)
          if (nextOpen) setHighlightIndex(currentIndex >= 0 ? currentIndex : 0)
        }}
        onKeyDown={handleKeyDown}
        className={`flex items-center rounded-lg text-sm text-muted hover:text-foreground hover:bg-background/40 transition-colors ${
          compact ? 'w-8 h-8 justify-center px-0 py-0' : 'gap-2 px-2 py-1.5'
        }`}
      >
        <span aria-hidden="true">{currentOption.flag}</span>
        {!compact && (
          <>
            <span className="hidden sm:inline">{t(currentOption.labelKey)}</span>
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={setFloating}
            id="language-menu"
            role="listbox"
            aria-label={t('common:language')}
            tabIndex={-1}
            style={{ ...floatingStyles, zIndex: 10000, minWidth: '11rem' }}
            className="overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
          >
            {OPTIONS.map(({ code, flag, labelKey }, idx) => {
              const isSelected = current === code
              const isHighlighted = idx === highlightIndex
              return (
                <button
                  key={code}
                  id={`language-opt-${code}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(code)}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  className={`
                    flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground
                    transition-colors duration-75
                    ${isSelected ? 'bg-background/60' : ''}
                    ${isHighlighted && !isSelected ? 'bg-background/40' : ''}
                    ${!isSelected && !isHighlighted ? 'hover:bg-background/40' : ''}
                  `}
                >
                  <span aria-hidden="true">{flag}</span>
                  <span className="flex-1 text-left">{t(labelKey)}</span>
                  {isSelected && (
                    <svg
                      className="w-3.5 h-3.5 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}
