'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { NotebookPageItem } from './NotebookPageItem'

interface FolderPage {
  id: string
  title: string
}

interface NotebookFolderProps {
  readonly id: string
  readonly name: string
  readonly pages: FolderPage[]
  readonly activePageId: string | null
  readonly isExpanded: boolean
  /** Called when this folder is a drop target for a page */
  readonly onDragOverFolder?: (folderId: string | null) => void
  readonly onToggle: () => void
  readonly onPageClick: (pageId: string) => void
  readonly onDeletePage: (pageId: string) => void
  readonly onRename: (folderId: string, newName: string) => void
  /** Called to request folder deletion dialog (sidebar manages it) */
  readonly onDeleteFolderRequest?: (folderId: string) => void
  /** Called to create a new page inside this folder */
  readonly onCreatePage?: (folderId: string) => void
  /** Called when a page is dropped onto this folder */
  readonly onDropOnFolder?: (folderId: string, pageId: string) => void
  /** Called when right-click on a page inside this folder */
  readonly onPageContextMenu?: (pageId: string, e: React.MouseEvent) => void
}

export function NotebookFolder({
  id,
  name,
  pages,
  activePageId,
  isExpanded,
  onDragOverFolder,
  onToggle,
  onPageClick,
  onDeletePage,
  onRename,
  onDeleteFolderRequest,
  onCreatePage,
  onDropOnFolder,
  onPageContextMenu,
}: Readonly<NotebookFolderProps>) {
  const { t } = useTranslation()
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(name)
  const [showMenu, setShowMenu] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on click outside
  useEffect(() => {
    if (!showMenu) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMenu])

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== name) {
      onRename(id, trimmed)
    }
    setIsRenaming(false)
  }

  const handleHeaderClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on menu or rename input
    if ((e.target as HTMLElement).closest('[data-folder-menu]')) return
    if ((e.target as HTMLElement).closest('input')) return
    onToggle()
  }

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (!isDragOver) {
        setIsDragOver(true)
        onDragOverFolder?.(id)
      }
    },
    [id, isDragOver, onDragOverFolder],
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      // Only fire when leaving the container, not entering a child
      if (e.currentTarget.contains(e.relatedTarget as Node)) return
      setIsDragOver(false)
      onDragOverFolder?.(null)
    },
    [onDragOverFolder],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      onDragOverFolder?.(null)
      const pageId = e.dataTransfer.getData('text/plain')
      if (pageId) {
        onDropOnFolder?.(id, pageId)
      }
    },
    [id, onDropOnFolder, onDragOverFolder],
  )

  return (
    <div
      className={`mb-1 rounded-md transition-colors ${
        isDragOver ? 'bg-accent/5 ring-1 ring-accent/30' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Folder header */}
      <button
        type="button"
        className="group flex items-center gap-1 px-1 py-1 rounded-md hover:bg-hover cursor-pointer select-none w-full border-0 bg-transparent text-left"
        onClick={handleHeaderClick}
      >
        {/* Expand/collapse chevron */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          aria-label={isExpanded ? t('notebook:collapseFolder') : t('notebook:expandFolder')}
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
          <span className="flex-1 text-sm text-secondary-foreground truncate">{name}</span>
        )}

        {/* Page count */}
        <span className="text-xs text-muted-foreground mr-1">{pages.length}</span>

        {/* Action menu (visible on hover) */}
        {!isRenaming && (
          <div className="relative" data-folder-menu>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu((prev) => !prev)
              }}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={t('notebook:folderActions')}
              title={t('notebook:folderActions')}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                <circle cx="12" cy="19" r="1.5" fill="currentColor" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {showMenu && (
              <div
                ref={menuRef}
                className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-surface border border-border rounded-lg shadow-xl py-1"
                role="menu"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowMenu(false)
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    onCreatePage?.(id)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-secondary-foreground hover:bg-hover hover:text-foreground text-left"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {t('notebook:newPageInFolder')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    setRenameValue(name)
                    setIsRenaming(true)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-secondary-foreground hover:bg-hover hover:text-foreground text-left"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {t('notebook:renameFolder')}
                </button>

                <div className="h-px bg-border my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    onDeleteFolderRequest?.(id)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 text-left"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t('notebook:deleteFolder')}
                </button>
              </div>
            )}
          </div>
        )}
      </button>

      {/* Pages inside folder */}
      {isExpanded && (
        <div className="ml-2 mt-0.5 space-y-0.5 border-l border-border/50 pl-1">
          {pages.length === 0 ? (
            <div className="px-3 py-2">
              <p className="text-xs text-muted-foreground mb-1.5 italic">{t('notebook:noPagesYet')}</p>
              <button
                type="button"
                onClick={() => onCreatePage?.(id)}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {t('notebook:createPage')}
              </button>
            </div>
          ) : (
            pages.map((page) => (
              <NotebookPageItem
                key={page.id}
                id={page.id}
                title={page.title}
                isActive={activePageId === page.id}
                indented
                onClick={onPageClick}
                onDelete={onDeletePage}
                onContextMenu={onPageContextMenu}
                onDragStart={() => {}}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
