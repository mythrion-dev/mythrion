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

export default function FormulaBuilder({
  value,
  onChange,
  attributes,
  skillModifierProfiles,
  runtimeModifiers,
  acFields,
  placeholder = 'Type formula manually...',
}: FormulaBuilderProps) {
  const [preview, setPreview] = useState<{ result: number | null; error?: string }>({ result: null })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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

  return (
    <div className="space-y-3">
      <textarea className="input-field resize-none font-mono text-sm" rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false} />

      {value.trim() && (
        <div className="rounded-lg bg-background/60 border border-border px-3 py-2 text-xs space-y-1">
          <div><span className="text-muted">Preview: </span><span className="font-mono text-foreground">{value}</span></div>
          {preview.error ? (<div className="text-danger">{preview.error}</div>) : preview.result !== null ? (
            <div><span className="text-muted">Result (with 0 values): </span><span className="font-mono font-semibold text-primary">{preview.result}</span></div>
          ) : null}
        </div>
      )}

      {attributes.length === 0 && (
        <p className="text-xs text-muted italic">Add attributes to the template first, then come back to build formulas.</p>
      )}
    </div>
  )
}
