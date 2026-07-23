'use client'

import { useState, useCallback } from 'react'
import type { OutlineItem } from './PdfJsViewer'

/* ── Types ── */

interface OutlinePanelProps {
  items: OutlineItem[]
  onNavigate: (dest: string | unknown[]) => void
  isOpen: boolean
  onToggle: () => void
}

/* ── Recursive node component ── */

function OutlineNode({
  item,
  depth,
  onNavigate,
}: {
  item: OutlineItem
  depth: number
  onNavigate: (dest: string | unknown[]) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = item.items && item.items.length > 0
  const isLeaf = !hasChildren

  const handleClick = useCallback(() => {
    if (hasChildren) {
      setExpanded((prev) => !prev)
    }
    if (item.dest) {
      onNavigate(item.dest)
    }
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer')
    }
  }, [hasChildren, item.dest, item.url, onNavigate])

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-1 text-left px-2 py-1 text-xs rounded-sm transition-colors hover:bg-hover ${
          item.bold ? 'font-semibold' : 'font-normal'
        } ${item.italic ? 'italic' : ''} ${
          isLeaf ? 'text-muted-foreground hover:text-foreground' : 'text-foreground'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        title={item.title}
      >
        {/* Expand/collapse chevron for branch nodes */}
        {hasChildren ? (
          <svg
            className={`w-3 h-3 shrink-0 transition-transform text-muted-foreground ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Color indicator */}
        {item.color && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              backgroundColor: `rgb(${item.color.slice(0, 3).join(',')})`,
            }}
          />
        )}

        {/* Title */}
        <span className="truncate">{item.title}</span>
      </button>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {item.items!.map((child, idx) => (
            <OutlineNode key={idx} item={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Panel component ── */

export function OutlinePanel({ items, onNavigate, isOpen, onToggle }: OutlinePanelProps) {
  const isEmpty = !items || items.length === 0

  return (
    <div
      className={`border-l border-border bg-surface transition-all duration-200 overflow-hidden flex flex-col ${
        isOpen ? 'w-72 min-w-0' : 'w-0 min-w-0 border-l-0'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-medium text-foreground">Table of Contents</span>
        <button
          onClick={onToggle}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
          aria-label="Close outline panel"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-1">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <svg
              className="w-8 h-8 text-muted-foreground/30 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-xs text-muted-foreground">No table of contents</p>
          </div>
        ) : (
          items.map((item, idx) => (
            <OutlineNode key={idx} item={item} depth={0} onNavigate={onNavigate} />
          ))
        )}
      </div>
    </div>
  )
}
