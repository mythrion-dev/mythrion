'use client'

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface NotebookPageItemProps {
  readonly id: string
  readonly title: string
  readonly isActive: boolean
  /** Visually indent the page (e.g. when inside a folder) */
  readonly indented?: boolean
  /** Show a folder label next to the page (search results) */
  readonly folderName?: string | null
  readonly onClick: (id: string) => void
  readonly onDelete: (id: string) => void
  /** Request a custom confirmation flow instead of the native browser dialog */
  readonly onRequestDelete?: (id: string) => void
  /** Fired when drag starts on this page — dataTransfer gets pageId */
  readonly onDragStart?: (pageId: string, e: React.DragEvent) => void
  /** Fired on right-click / long press for context menu */
  readonly onContextMenu?: (pageId: string, e: React.MouseEvent) => void
  /** Disable edit/drag/context actions (campaign read-only) */
  readonly readOnly?: boolean
}

export function NotebookPageItem({
  id,
  title,
  isActive,
  indented = false,
  folderName,
  onClick,
  onDelete,
  onRequestDelete,
  onDragStart,
  onContextMenu,
  readOnly = false,
}: Readonly<NotebookPageItemProps>) {
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', id)
      e.dataTransfer.effectAllowed = 'move'
      onDragStart?.(id, e)
    },
    [id, onDragStart],
  )

  const { t } = useTranslation()

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
      draggable={!readOnly && !!onDragStart}
      onDragStart={readOnly ? undefined : handleDragStart}
      onContextMenu={readOnly ? undefined : handleContextMenu}
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
      <span className="truncate flex-1">{title || t('notebook:untitled')}</span>

      {/* Folder name badge (search results) */}
      {folderName && (
        <span className="text-[10px] text-muted-foreground bg-hover px-1 py-0.5 rounded shrink-0">
          {folderName}
        </span>
      )}

      {/* Delete button (visible on hover) */}
      {!readOnly && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (onRequestDelete) {
              onRequestDelete(id)
              return
            }
            onDelete(id)
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-all shrink-0"
          aria-label={t('notebook:deletePage')}
          title={t('notebook:deletePage')}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </button>
  )
}
