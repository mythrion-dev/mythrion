'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// ── Inline Text ──
export function InlineText({
  value,
  onSave,
  placeholder = '',
  maxLength,
  disabled = false,
  className = '',
  inputClassName = '',
  emptyDisplay = '—',
}: {
  value: string
  onSave: (value: string) => Promise<void>
  placeholder?: string
  maxLength?: number
  disabled?: boolean
  className?: string
  inputClassName?: string
  emptyDisplay?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0) } }}
        className={`text-left min-w-[40px] hover:bg-foreground/5 rounded px-1 -mx-1 transition-colors cursor-pointer ${disabled ? 'cursor-default hover:bg-transparent' : ''} ${className}`}
      >
        <span className={`${value?.trim() ? '' : 'text-muted italic'}`}>
          {value?.trim() || emptyDisplay}
        </span>
      </button>
    )
  }

  return (
    <div className="relative inline-block">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        maxLength={maxLength}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        className={`input-field py-0.5 px-1 text-sm ${inputClassName}`}
        placeholder={placeholder}
        autoFocus
        disabled={saving}
      />
      {saving && <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 border border-primary/30 border-t-primary rounded-full animate-spin" />}
    </div>
  )
}

// ── Inline Number ──
export function InlineNumber({
  value,
  onSave,
  min,
  max,
  step,
  disabled = false,
  className = '',
  inputClassName = '',
  emptyDisplay = '—',
}: {
  value: number | string | null | undefined
  onSave: (value: number) => Promise<void>
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
  inputClassName?: string
  emptyDisplay?: string
}) {
  const display = value != null && value !== '' ? String(value) : ''
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(display)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(display) }, [display])

  const commit = useCallback(async () => {
    const num = draft.trim() === '' ? 0 : parseFloat(draft)
    if (isNaN(num)) { setDraft(display); setEditing(false); return }
    if (num === (parseFloat(display) || 0) && draft.trim() !== '' && !(display === '' && num === 0)) { setEditing(false); return }
    setSaving(true)
    try { await onSave(num); setEditing(false) }
    catch { setDraft(display) }
    finally { setSaving(false) }
  }, [draft, display, onSave])

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0) } }}
        className={`text-left min-w-[30px] hover:bg-foreground/5 rounded px-1 -mx-1 transition-colors cursor-pointer ${disabled ? 'cursor-default hover:bg-transparent' : ''} ${className}`}
      >
        <span className={`${display ? '' : 'text-muted italic'}`}>
          {display || emptyDisplay}
        </span>
      </button>
    )
  }

  return (
    <div className="relative inline-block">
      <input
        ref={inputRef}
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(display); setEditing(false) } }}
        className={`input-field py-0.5 px-1 text-sm w-20 ${inputClassName}`}
        autoFocus
        disabled={saving}
      />
      {saving && <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 border border-primary/30 border-t-primary rounded-full animate-spin" />}
    </div>
  )
}

// ── Inline Textarea ──
export function InlineTextarea({
  value,
  onSave,
  placeholder = '',
  rows = 3,
  disabled = false,
  className = '',
  label,
  emptyDisplay = '—',
}: {
  value: string
  onSave: (value: string) => Promise<void>
  placeholder?: string
  rows?: number
  disabled?: boolean
  className?: string
  label?: string
  emptyDisplay?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    return (
      <div className={className}>
        {label && <h4 className="text-sm font-medium text-muted mb-1">{label}</h4>}
        <button
          type="button"
          disabled={disabled}
          onClick={() => { if (!disabled) { setEditing(true); setTimeout(() => textareaRef.current?.focus(), 0) } }}
          className={`w-full text-left rounded-lg border border-transparent hover:border-border px-3 py-2 transition-colors cursor-pointer ${disabled ? 'cursor-default hover:border-transparent' : 'hover:bg-background/50'} ${className}`}
        >
          {value?.trim() ? (
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{value}</p>
          ) : (
            <span className="text-sm text-muted italic">{emptyDisplay}</span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      {label && <h4 className="text-sm font-medium text-muted mb-1">{label}</h4>}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={draft}
          rows={rows}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
          className="input-field resize-none text-sm w-full"
          placeholder={placeholder}
          autoFocus
          disabled={saving}
        />
        {saving && <div className="absolute top-2 right-2 w-3 h-3 border border-primary/30 border-t-primary rounded-full animate-spin" />}
      </div>
    </div>
  )
}

// ── Inline Select ──
export function InlineSelect<T extends string>({
  value,
  options,
  onSave,
  disabled = false,
  placeholder = '— Select —',
  className = '',
}: {
  value: T | null
  options: { value: T; label: string }[]
  onSave: (value: T | null) => Promise<void>
  disabled?: boolean
  placeholder?: string
  className?: string
}) {
  const [saving, setSaving] = useState(false)
  const selectRef = useRef<HTMLSelectElement>(null)
  const selectedOption = options.find(o => o.value === value)

  async function handleChange(newValue: string) {
    const val = newValue || null
    setSaving(true)
    try { await onSave(val as T | null) }
    catch { if (selectRef.current) selectRef.current.value = value ?? '' }
    finally { setSaving(false) }
  }

  return (
    <div className={`relative inline-flex items-center gap-1 ${className}`}>
      <select
        ref={selectRef}
        value={value ?? ''}
        onChange={e => handleChange(e.target.value)}
        disabled={disabled || saving}
        className="input-field py-0.5 px-1 text-xs"
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {saving && <div className="w-2.5 h-2.5 border border-primary/30 border-t-primary rounded-full animate-spin" />}
    </div>
  )
}

// ── Inline Checkbox ──
export function InlineCheckbox({
  checked,
  onToggle,
  disabled = false,
  label,
}: {
  checked: boolean
  onToggle: () => Promise<void>
  disabled?: boolean
  label?: string
}) {
  const [saving, setSaving] = useState(false)

  async function handleToggle() {
    setSaving(true)
    try { await onToggle() }
    finally { setSaving(false) }
  }

  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={handleToggle}
        disabled={disabled || saving}
        className="w-4 h-4 rounded border-border accent-primary shrink-0"
      />
      {saving && <div className="w-3 h-3 border border-primary/30 border-t-primary rounded-full animate-spin" />}
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
}