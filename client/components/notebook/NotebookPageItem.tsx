'use client'

interface NotebookPageItemProps {
  id: string
  title: string
  isActive: boolean
  onClick: (id: string) => void
  onDelete: (id: string) => void
}

export function NotebookPageItem({
  id,
  title,
  isActive,
  onClick,
  onDelete,
}: NotebookPageItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-sm transition-colors group ${
        isActive
          ? 'bg-accent/10 text-accent font-medium'
          : 'text-secondary-foreground hover:bg-hover hover:text-foreground'
      }`}
    >
      {/* Document icon */}
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>

      {/* Title */}
      <span className="truncate flex-1">{title || 'Untitled'}</span>

      {/* Delete button (visible on hover) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(id)
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-all"
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
