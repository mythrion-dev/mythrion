'use client'

import { useState } from 'react'
import { NotebookPageItem } from './NotebookPageItem'

interface FolderPage {
  id: string
  title: string
}

interface NotebookFolderProps {
  id: string
  name: string
  pages: FolderPage[]
  activePageId: string | null
  isExpanded: boolean
  onToggle: () => void
  onPageClick: (pageId: string) => void
  onDeletePage: (pageId: string) => void
  onRename: (folderId: string, newName: string) => void
  onDelete: (folderId: string) => void
}

export function NotebookFolder({
  id,
  name,
  pages,
  activePageId,
  isExpanded,
  onToggle,
  onPageClick,
  onDeletePage,
  onRename,
  onDelete,
}: NotebookFolderProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(name)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== name) {
      onRename(id, trimmed)
    }
    setIsRenaming(false)
  }

  const handleDelete = () => {
    onDelete(id)
    setShowConfirmDelete(false)
  }

  return (
    <div className="mb-1">
      {/* Folder header */}
      <div className="group flex items-center gap-1 px-1 py-1 rounded-md hover:bg-hover cursor-pointer">
        {/* Expand/collapse chevron */}
        <button
          type="button"
          onClick={onToggle}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Folder icon */}
        <svg className="w-4 h-4 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>

        {/* Folder name (rename or display) */}
        {isRenaming ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit()
              if (e.key === 'Escape') setIsRenaming(false)
            }}
            className="flex-1 px-1 py-0 text-sm bg-input border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-sm text-secondary-foreground truncate"
            onDoubleClick={() => {
              setRenameValue(name)
              setIsRenaming(true)
            }}
          >
            {name}
          </span>
        )}

        {/* Page count */}
        <span className="text-xs text-muted-foreground mr-1">{pages.length}</span>

        {/* Actions (visible on hover) */}
        {!isRenaming && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => {
                setRenameValue(name)
                setIsRenaming(true)
              }}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground"
              aria-label="Rename folder"
              title="Rename"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>

            {showConfirmDelete ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-destructive whitespace-nowrap">Delete folder & move pages?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="p-0.5 rounded text-destructive hover:bg-destructive/10"
                  aria-label="Confirm delete"
                  title="Confirm delete"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  className="p-0.5 rounded text-muted-foreground hover:text-foreground"
                  aria-label="Cancel delete"
                  title="Cancel"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="p-0.5 rounded text-muted-foreground hover:text-destructive"
                aria-label="Delete folder"
                title="Delete folder"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pages inside folder */}
      {isExpanded && (
        <div className="ml-3 mt-0.5 space-y-0.5">
          {pages.length === 0 ? (
            <p className="px-3 py-1 text-xs text-muted-foreground italic">Empty folder</p>
          ) : (
            pages.map((page) => (
              <NotebookPageItem
                key={page.id}
                id={page.id}
                title={page.title}
                isActive={activePageId === page.id}
                onClick={onPageClick}
                onDelete={onDeletePage}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
