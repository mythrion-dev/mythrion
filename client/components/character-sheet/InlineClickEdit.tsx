'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export function InlineClickEdit({ value, onSave, as = 'input', className = '', inputClassName = '', emptyDisplay = '—', rows = 2 }: {
  value: string
  onSave: (value: string) => Promise<void>
  as?: 'input' | 'textarea'
  className?: string
  inputClassName?: string
  emptyDisplay?: string
  rows?: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  useEffect(() => { setDraft(value) }, [value])

  const commit = useCallback(async () => {
    const trimmed = draft.trim()
    if (trimmed === value.trim()) { setEditing(false); return }
    setSaving(true)
    try { await onSave(trimmed); setEditing(false) }
    catch { setDraft(value) }
    finally { setSaving(false) }
  }, [draft, value, onSave])

  if (!editing) {
    const display = value?.trim()
    return (
      <button
        type="button"
        onClick={() => { setEditing(true); setTimeout(() => { if (inputRef.current) (inputRef.current as HTMLInputElement).focus() }, 0) }}
        className={`text-left hover:bg-foreground/5 rounded px-1 -mx-1 transition-colors cursor-pointer ${display ? '' : 'text-muted italic'} ${className}`}
      >
        {display || emptyDisplay}
      </button>
    )
  }

  if (as === 'textarea') return (
    <div className="relative">
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={draft}
        rows={rows}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        className={`input-field resize-none text-sm w-full ${inputClassName}`}
        autoFocus
        disabled={saving}
      />
      {saving && <div className="absolute top-2 right-2 w-3 h-3 border border-primary/30 border-t-primary rounded-full animate-spin" />}
    </div>
  )

  return (
    <div className="relative inline-block">
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        className={`input-field py-0.5 px-1 text-sm ${inputClassName}`}
        autoFocus
        disabled={saving}
      />
      {saving && <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 border border-primary/30 border-t-primary rounded-full animate-spin" />}
    </div>
  )
}
