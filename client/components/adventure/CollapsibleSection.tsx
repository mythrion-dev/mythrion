'use client'

import type { ReactNode } from 'react'

export function CollapsibleSection({
  title,
  expanded,
  onToggle,
  accent,
  children,
}: {
  title: string
  expanded: boolean
  onToggle: () => void
  accent?: boolean
  children: ReactNode
}) {
  return (
    <div className="card !p-6">
      <button
        onClick={onToggle}
        className={`flex items-center justify-between w-full text-left${accent ? ' header-accent' : ''}`}
      >
        <h3 className="font-semibold">{title}</h3>
        <svg
          className={`w-5 h-5 text-muted transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && <div className="mt-4">{children}</div>}
    </div>
  )
}
