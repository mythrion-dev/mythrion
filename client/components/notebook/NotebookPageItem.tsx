'use client'

import { useCallback } from 'react'

interface NotebookPageItemProps {
  id: string
  title: string
  isActive: boolean
  /** Visually indent the page (e.g. when inside a folder) */
  indented?: boolean
  /** Show a folder label next to the page (search results) */
  folderName?: string | null
  onClick: (id: string) => void
  onDelete: (id: string) => void
  /** Fired when drag starts on this page — dataTransfer gets pageId */
  onDragStart?: (pageId: string, e: React.DragEvent) => void
  /** Fired on right-click / long press for context menu */
  onContextMenu?: (pageId: string, e: React.MouseEvent) => void
}

export function NotebookPageItem({
  id,
  title,
  isActive,
  indented = false,
  folderName,
  onClick,
  onDelete,
  onDragStart,
  onContextMenu,
}: NotebookPageItemProps) {
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', id)
      e.dataTransfer.effectAllowed = 'move'
      onDragStart?.(id, e)
    },
    [id, onDragStart],
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onContextMenu?.(id, e)
    },
    [id, onContextMenu],
  )

  return (
    <button
      type="button"
      draggable={!!onDragStart}
      onDragStart={handleDragStart}
      onContextMenu={handleContextMenu}
      onClick={() => onClick(id)}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-sm transition-colors group ${
        isActive
          ? 'bg-accent/10 text-accent font-medium'
          : 'text-secondary-foreground hover:bg-hover hover:text-foreground'
      } ${indented ? 'pl-6' : ''}`}
    >
      {/* Document icon */}
      {indented ? (
        <svg className="w-3 h-3 shrink-0 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )}

      {/* Title */}
      <span className="truncate flex-1">{title || 'Untitled'}</span>

      {/* Folder name badge (search results) */}
      {folderName && (
        <span className="text-[10px] text-muted-foreground bg-hover px-1 py-0.5 rounded shrink-0">
          {folderName}
        </span>
      )}

      {/* Delete button (visible on hover) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (window.confirm('Delete this page?')) {
            onDelete(id)
          }
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-all shrink-0"
        aria-label="Delete page"
        title="Delete page"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </button>
  )
}
