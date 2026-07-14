'use client'

export function CollapsibleAttrCard({ index, attr, isExpanded, onToggle, onUpdateAttr, onRemove }: {
  index: number
  attr: { key: string; name: string }
  isExpanded: boolean
  onToggle: () => void
  onUpdateAttr: (i: number, f: 'key' | 'name', v: string) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-background/30 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-background/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">{attr.name || 'New Attribute'}</span>
          {attr.key && <span className="text-[0.6rem] text-muted font-mono shrink-0">({attr.key})</span>}
        </div>
        <svg className={`w-4 h-4 text-muted transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="px-3 py-3 space-y-2 border-t border-border">
          <div className="flex items-center gap-1.5">
            <input className="input-field flex-1" value={attr.key} onChange={e => onUpdateAttr(index, 'key', e.target.value)} placeholder="Key (e.g. strength)" />
            <input className="input-field flex-1" value={attr.name} onChange={e => onUpdateAttr(index, 'name', e.target.value)} placeholder="Name (e.g. Strength)" />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={onRemove} className="text-xs text-danger hover:text-danger/80 transition-colors">Remove Attribute</button>
          </div>
        </div>
      )}
    </div>
  )
}
