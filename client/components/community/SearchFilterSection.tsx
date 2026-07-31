'use client'

import { useState, type ReactNode } from 'react'

export interface ActiveFilter {
  id: string
  label: string
}

export interface SortOption {
  id: string
  label: string
}

interface SearchFilterSectionProps {
  /** Placeholder text for the search input */
  placeholder: string
  /** Current search value */
  search: string
  /** Called when the search input changes */
  onSearchChange: (value: string) => void
  /** Filter controls rendered inside the collapsible filter area */
  children: ReactNode
  /** Active filters displayed as removable chips */
  activeFilters: ActiveFilter[]
  /** Called when a single filter chip is clicked (removed) */
  onRemoveFilter: (id: string) => void
  /** Called when "Remove All" is clicked */
  onRemoveAll: () => void
  /** Available sort options */
  sortOptions: SortOption[]
  /** Currently selected sort value */
  sortValue: string
  /** Called when sort selection changes */
  onSortChange: (value: string) => void
}

export function SearchFilterSection({
  placeholder,
  search,
  onSearchChange,
  children,
  activeFilters,
  onRemoveFilter,
  onRemoveAll,
  sortOptions,
  sortValue,
  onSortChange,
}: SearchFilterSectionProps) {
  const [showFilters, setShowFilters] = useState(false)

  return (
    <div className="space-y-4 mb-8">
      {/* ── Full-width Search Bar ── */}
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="input-field pl-12 pr-4 py-3 w-full text-base"
        />
      </div>

      {/* ── Filter Controls Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter toggle button */}
        <button
          type="button"
          onClick={() => setShowFilters((prev) => !prev)}
          className={`btn-ghost text-sm self-start sm:self-auto transition-all duration-200 ${
            showFilters
              ? '!border-primary/30 !text-primary !bg-primary/8'
              : ''
          }`}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${
              showFilters ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span>Filters</span>
          {activeFilters.length > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[0.625rem] font-semibold leading-none"
              style={{
                background: 'rgba(201,164,75,0.15)',
                color: '#d4b35e',
                border: '1px solid rgba(201,164,75,0.2)',
              }}
            >
              {activeFilters.length}
            </span>
          )}
        </button>

        {/* Sort */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-muted hidden sm:inline">Sort by</span>
          <select
            value={sortValue}
            onChange={(e) => onSortChange(e.target.value)}
            className="input-field py-2 pr-8 pl-3 text-sm w-auto min-w-[140px]"
          >
            {sortOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Advanced Filters (collapsible) ── */}
      {showFilters && (
        <div className="flex flex-wrap items-end gap-3 pt-1 pb-2 animate-fade-in">
          {children}
        </div>
      )}

      {/* ── Active Filter Chips ── */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {activeFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => onRemoveFilter(filter.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 hover:brightness-110"
              style={{
                background: 'rgba(201,164,75,0.12)',
                color: '#d4b35e',
                border: '1px solid rgba(201,164,75,0.2)',
              }}
            >
              {filter.label}
              <svg
                className="w-3 h-3 hover:scale-110 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          ))}
          <button
            type="button"
            onClick={onRemoveAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1 underline underline-offset-2 decoration-border hover:decoration-muted-foreground"
          >
            Remove All
          </button>
        </div>
      )}
    </div>
  )
}
