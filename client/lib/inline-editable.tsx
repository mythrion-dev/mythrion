'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

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
  title,
}: {
  readonly value: string
  readonly onSave: (value: string) => Promise<void>
  readonly placeholder?: string
  readonly maxLength?: number
  readonly disabled?: boolean
  readonly className?: string
  readonly inputClassName?: string
  readonly emptyDisplay?: string
  readonly title?: string
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
        title={title}
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
        onKeyDown={e => {
          if (e.key === 'Enter') { commit() }
          if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
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
  title,
}: {
  readonly value: number | string | null | undefined
  readonly onSave: (value: number) => Promise<void>
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly disabled?: boolean
  readonly className?: string
  readonly inputClassName?: string
  readonly emptyDisplay?: string
  readonly title?: string
}) {
  const display = value != null && value !== '' ? String(value) : ''
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(display)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(display) }, [display])

  const commit = useCallback(async () => {
    const num = draft.trim() === '' ? 0 : Number.parseFloat(draft)
    if (Number.isNaN(num)) { setDraft(display); setEditing(false); return }
    if (num === (Number.parseFloat(display) || 0) && draft.trim() !== '' && !(display === '' && num === 0)) { setEditing(false); return }
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
        title={title}
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
        onKeyDown={e => {
          if (e.key === 'Enter') { commit() }
          if (e.key === 'Escape') { setDraft(display); setEditing(false) }
        }}
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
  readonly value: string
  readonly onSave: (value: string) => Promise<void>
  readonly placeholder?: string
  readonly rows?: number
  readonly disabled?: boolean
  readonly className?: string
  readonly label?: string
  readonly emptyDisplay?: string
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
  placeholder,
  className = '',
}: {
  readonly value: T | null
  readonly options: { value: T; label: string }[]
  readonly onSave: (value: T | null) => Promise<void>
  readonly disabled?: boolean
  readonly placeholder?: string
  readonly className?: string
}) {
  const { t } = useTranslation()
  const resolvedPlaceholder = placeholder ?? t('templates:selectPlaceholder')
  const [saving, setSaving] = useState(false)
  const selectRef = useRef<HTMLSelectElement>(null)

  async function handleChange(newValue: string | null = null) {
    setSaving(true)
    try { await onSave(newValue as T | null) }
    catch { if (selectRef.current) selectRef.current.value = value ?? '' }
    finally { setSaving(false) }
  }

  return (
    <div className={`relative inline-flex items-center gap-1 ${className}`}>
      <select
        ref={selectRef}
        value={value ?? ''}
        onChange={e => handleChange(e.target.value === '' ? null : e.target.value)}
        disabled={disabled || saving}
        className="input-field py-0.5 px-1 text-xs"
      >
        <option value="">{resolvedPlaceholder}</option>
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
  readonly checked: boolean
  readonly onToggle: () => Promise<void>
  readonly disabled?: boolean
  readonly label?: string
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