'use client'

import { useState, useRef, useCallback, useEffect, type ChangeEvent, type KeyboardEvent } from 'react'

/* ── Types ── */

export interface SearchState {
  current: number
  total: number
}

interface SearchToolbarProps {
  onSearch: (query: string) => void
  onNextMatch: () => void
  onPrevMatch: () => void
  searchState: SearchState | null
}

const DEBOUNCE_MS = 300

/* ── Component ── */

export function SearchToolbar({ onSearch, onNextMatch, onPrevMatch, searchState }: SearchToolbarProps) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasMatch = searchState !== null && searchState.total > 0
  const hasQuery = query.trim().length > 0

  /* ── Debounced search dispatch ── */
  const scheduleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSearch(value)
      }, DEBOUNCE_MS)
    },
    [onSearch],
  )

  /* ── Change handler ── */
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setQuery(value)

      if (value.trim().length > 0) {
        scheduleSearch(value)
      } else {
        // Clear immediately when input is emptied
        if (debounceRef.current) clearTimeout(debounceRef.current)
        onSearch('')
      }
    },
    [onSearch, scheduleSearch],
  )

  /* ── Clear ── */
  const handleClear = useCallback(() => {
    setQuery('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    onSearch('')
    inputRef.current?.focus()
  }, [onSearch])

  /* ── Keyboard: Enter triggers immediate search, Escape clears ── */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        onSearch(query.trim())
        return
      }
      if (e.key === 'Escape') {
        handleClear()
        inputRef.current?.blur()
      }
    },
    [query, onSearch, handleClear],
  )

  /* ── Focus / blur ── */
  const handleFocus = useCallback(() => setFocused(true), [])
  const handleBlur = useCallback(() => setFocused(false), [])

  /* ── Ctrl+F opens search ── */
  useEffect(() => {
    function handleGlobalKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  /* ── Cleanup debounce on unmount ── */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  /* ── Render ── */
  return (
    <div
      className={`flex items-center gap-1 px-2 py-1.5 border-b transition-colors ${
        focused ? 'border-accent bg-accent/5' : 'border-border'
      }`}
    >
      {/* Search icon */}
      <svg
        className="w-3.5 h-3.5 shrink-0 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
      </svg>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Find in PDF…"
        className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none border-none"
        aria-label="Search PDF"
      />

      {/* Match counter */}
      {hasQuery && (
        <span
          className={`text-[10px] tabular-nums shrink-0 min-w-[3ch] text-center ${
            hasMatch ? 'text-muted-foreground' : 'text-danger'
          }`}
        >
          {hasMatch ? `${searchState!.current}/${searchState!.total}` : '0/0'}
        </span>
      )}

      {/* Prev / Next arrows (visible when there are matches) */}
      {hasMatch && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onPrevMatch}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
            aria-label="Previous match"
            title="Previous match (Shift+Enter)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={onNextMatch}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
            aria-label="Next match"
            title="Next match (Enter)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      {/* Clear button (visible when there's text) */}
      {hasQuery && (
        <button
          onClick={handleClear}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-hover transition-colors shrink-0"
          aria-label="Clear search"
          title="Clear (Escape)"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
