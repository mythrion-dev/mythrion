'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '@/lib/api'

interface SkillModifierProfile {
  id: string
  name: string
  options: { id: string; label: string; value: number }[]
}

interface FormulaBuilderProps {
  value: string
  onChange: (formula: string) => void
  attributes: { key: string; name: string }[]
  customFields?: { key: string; label: string }[]
  skillModifierProfiles?: SkillModifierProfile[]
  runtimeModifiers?: { key: string; name: string }[]
  acFields?: { key: string; name: string }[]
  placeholder?: string
  useModPrefix?: boolean
}

const OPERATORS = [
  { label: '+', value: '+' },
  { label: '−', value: '-' },
  { label: '×', value: '*' },
  { label: '÷', value: '/' },
  { label: '(', value: '(' },
  { label: ')', value: ')' },
  { label: '^', value: '^' },
]

const FUNCTIONS = [
  { label: 'Round Down', value: 'floor()', display: 'floor()' },
  { label: 'Round Up', value: 'ceil()', display: 'ceil()' },
  { label: 'Round', value: 'round()', display: 'round()' },
  { label: 'Maximum', value: 'max()', display: 'max(,)' },
  { label: 'Minimum', value: 'min()', display: 'min(,)' },
  { label: 'Absolute', value: 'abs()', display: 'abs()' },
]

type ButtonGroup = 'variables' | 'customFields' | 'profiles' | 'runtimeModifiers' | 'acFields' | 'functions'

export default function FormulaBuilder({
  value,
  onChange,
  attributes,
  customFields,
  skillModifierProfiles,
  runtimeModifiers,
  acFields,
  placeholder = 'Build formula...',
  useModPrefix = false,
}: FormulaBuilderProps) {
  const [preview, setPreview] = useState<{ result: number | null; error?: string }>({ result: null })
  const [activeGroup, setActiveGroup] = useState<ButtonGroup | null>('variables')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = value.substring(0, start)
    const after = value.substring(end)
    const newValue = before + text + after
    onChange(newValue)
    setTimeout(() => {
      textarea.focus()
      const pos = start + text.length
      textarea.selectionStart = pos
      textarea.selectionEnd = pos
    }, 0)
  }

  const insertOperator = (op: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    if (start !== end && op === '(') {
      const selected = value.substring(start, end)
      onChange(value.substring(0, start) + '(' + selected + ')' + value.substring(end))
      return
    }
    insertAtCursor(op)
  }

  const handleChange = (newValue: string) => {
    onChange(newValue)
  }

  const updatePreview = useCallback(async (formula: string) => {
    if (!formula.trim()) { setPreview({ result: null }); return }
    if (attributes.length === 0) { setPreview({ result: null }); return }
    const variables: Record<string, number> = {}
    attributes.forEach((a) => { variables[a.key] = 0 })
    if (skillModifierProfiles) {
      skillModifierProfiles.forEach((p) => { variables[p.name] = 0 })
    }
    if (runtimeModifiers) {
      runtimeModifiers.forEach((m) => { variables[m.key] = 0 })
    }
    if (acFields) {
      acFields.forEach((f) => { variables[f.key] = 0 })
    }
    try {
      const data = await api.post<{ result: number }>('/formula/preview', { formula, variables })
      setPreview({ result: data.result })
    } catch (err) {
      setPreview({ result: null, error: err instanceof Error ? err.message : 'Evaluation failed' })
    }
  }, [attributes, skillModifierProfiles, runtimeModifiers, acFields])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { updatePreview(value) }, 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value, updatePreview])

  const toggleGroup = (group: ButtonGroup) => {
    setActiveGroup(p => p === group ? null : group)
  }

  const hasProfiles = skillModifierProfiles && skillModifierProfiles.length > 0
  const hasCustomFields = customFields && customFields.length > 0
  const hasRuntimeModifiers = runtimeModifiers && runtimeModifiers.length > 0
  const hasAcFields = acFields && acFields.length > 0

  const btnClass = (group: ButtonGroup) => `px-2 py-1 rounded text-xs font-medium transition-colors ${activeGroup === group ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted hover:text-foreground'}`

  return (
    <div className="space-y-3">
      <textarea ref={textareaRef} className="input-field resize-none font-mono text-sm" rows={2} value={value} onChange={(e) => handleChange(e.target.value)} placeholder={placeholder} spellCheck={false} />

      {value.trim() && (
        <div className="rounded-lg bg-background/60 border border-border px-3 py-2 text-xs space-y-1">
          <div><span className="text-muted">Preview: </span><span className="font-mono text-foreground">{value}</span></div>
          {preview.error ? (<div className="text-danger">{preview.error}</div>) : preview.result !== null ? (
            <div><span className="text-muted">Result (with 0 values): </span><span className="font-mono font-semibold text-primary">{preview.result}</span></div>
          ) : null}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => toggleGroup('variables')} className={btnClass('variables')}>Attributes</button>
        {hasRuntimeModifiers && (
          <button type="button" onClick={() => toggleGroup('runtimeModifiers')} className={btnClass('runtimeModifiers')}>Runtime Modifiers</button>
        )}
        {hasProfiles && (
          <button type="button" onClick={() => toggleGroup('profiles')} className={btnClass('profiles')}>Skill Profiles</button>
        )}
        {hasCustomFields && (
          <button type="button" onClick={() => toggleGroup('customFields')} className={btnClass('customFields')}>Custom Fields</button>
        )}
        {hasAcFields && (
          <button type="button" onClick={() => toggleGroup('acFields')} className={btnClass('acFields')}>AC Fields</button>
        )}
        <button type="button" onClick={() => toggleGroup('functions')} className={btnClass('functions')}>Functions</button>
      </div>

      {activeGroup === 'variables' && attributes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {attributes.map((attr) => (
            <button key={attr.key} type="button" onClick={() => insertAtCursor(useModPrefix ? `mod(${attr.key})` : attr.key)} className="px-2 py-1 rounded bg-background/60 border border-border text-xs text-foreground hover:border-primary/30 hover:text-primary transition-colors" title={`Insert ${useModPrefix ? 'mod(' + attr.key + ')' : attr.key}`}>
              [{attr.name}]
            </button>
          ))}
        </div>
      )}

      {activeGroup === 'runtimeModifiers' && hasRuntimeModifiers && (
        <div className="space-y-2">
          <p className="text-xs text-muted">Runtime Modifiers — click to insert as variable</p>
          <div className="flex flex-wrap gap-1">
            {runtimeModifiers!.map((mod) => (
              <button
                key={mod.key}
                type="button"
                onClick={() => insertAtCursor(mod.key)}
                className="px-2 py-1 rounded bg-background/60 border border-border text-xs text-foreground hover:border-primary/30 hover:text-primary transition-colors"
                title={`Insert ${mod.key}`}
              >
                [{mod.name}]
              </button>
            ))}
          </div>
        </div>
      )}

      {activeGroup === 'profiles' && hasProfiles && (
        <div className="space-y-2">
          <p className="text-xs text-muted">Skill Modifier Profiles — click to insert as variable</p>
          <div className="flex flex-wrap gap-1">
            {skillModifierProfiles!.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => insertAtCursor(profile.name)}
                className="px-2 py-1 rounded bg-background/60 border border-border text-xs text-foreground hover:border-primary/30 hover:text-primary transition-colors"
                title={`Insert ${profile.name} — ${profile.options.map(o => `${o.label}(${o.value})`).join(', ')}`}
              >
                [{profile.name}]
              </button>
            ))}
          </div>
        </div>
      )}

      {activeGroup === 'customFields' && hasCustomFields && (
        <div className="flex flex-wrap gap-1">
          {customFields!.map((cf) => (
            <button key={cf.key} type="button" onClick={() => insertAtCursor(cf.key)} className="px-2 py-1 rounded bg-background/60 border border-border text-xs text-foreground hover:border-primary/30 hover:text-primary transition-colors" title={`Insert ${cf.key}`}>
              [{cf.label}]
            </button>
          ))}
        </div>
      )}

      {activeGroup === 'acFields' && hasAcFields && (
        <div className="space-y-2">
          <p className="text-xs text-muted">Armor Class Fields — click to insert as variable</p>
          <div className="flex flex-wrap gap-1">
            {acFields!.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => insertAtCursor(f.key)}
                className="px-2 py-1 rounded bg-background/60 border border-border text-xs text-foreground hover:border-primary/30 hover:text-primary transition-colors"
                title={`Insert ${f.key}`}
              >
                [{f.name}]
              </button>
            ))}
          </div>
        </div>
      )}

      {activeGroup === 'functions' && (
        <div className="space-y-2">
          <p className="text-xs text-muted">Functions — click to insert</p>
          <div className="flex flex-wrap gap-1">
            {FUNCTIONS.map((fn) => (
              <button key={fn.label} type="button" onClick={() => insertAtCursor(fn.value)} className="px-2 py-1 rounded bg-background/60 border border-border text-xs text-foreground hover:border-primary/30 hover:text-primary transition-colors" title={`Insert ${fn.display}`}>
                {fn.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {OPERATORS.map((op) => (
          <button key={op.value} type="button" onClick={() => insertOperator(op.value)} className="w-8 h-7 flex items-center justify-center rounded bg-background/60 border border-border text-sm text-foreground hover:border-primary/30 hover:text-primary transition-colors font-mono">
            {op.label}
          </button>
        ))}
      </div>

      {attributes.length === 0 && (
        <p className="text-xs text-muted italic">Add attributes to the template first, then come back to build formulas.</p>
      )}
    </div>
  )
}