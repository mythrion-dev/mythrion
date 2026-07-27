'use client'

import { useState, useRef, useEffect } from 'react'
import { Select } from '@/components/shared/Select'
import type { SheetPermissions } from './types'

interface ResistanceComponentValue {
  componentId: string
  componentName: string
  value: number
  editableByPlayer: boolean
}

interface AttributeModifierValue {
  attributeId: string
  attributeKey: string
  attributeName: string
  enabled: boolean
  rawModifier: number
  effectiveModifier: number
}

interface CalculatedResistance {
  resistanceId: string
  name: string
  calculationType: string
  total: number
  componentValues: ResistanceComponentValue[]
  attributeModifierValues: AttributeModifierValue[]
}

interface TemplateAttribute {
  id: string
  key: string
  name: string
}

interface NewResistanceDraft {
  name: string
  calculationType: 'MANUAL' | 'CALCULATED'
  components: { name: string; editableByPlayer: boolean; defaultValue: string }[]
  attributeModifiers: { attributeId: string; attributeKey: string; attributeName: string; enabled: boolean }[]
}

function emptyDraft(): NewResistanceDraft {
  return { name: '', calculationType: 'MANUAL', components: [], attributeModifiers: [] }
}

interface Props {
  resistances: CalculatedResistance[]
  permissions: SheetPermissions
  onSaveComponent: (componentId: string, value: number) => Promise<void>
  onSaveManual: (resistanceId: string, value: number) => Promise<void>
  sheetResistanceValues: Record<string, string | null>
  templateAttributes?: TemplateAttribute[]
  disableAttributeModifiers?: boolean
  onCreateResistance?: (draft: NewResistanceDraft) => Promise<void>
  onDeleteResistance?: (resistanceId: string) => Promise<void>
}

export type { NewResistanceDraft }

export function ResistanceTab({
  resistances, permissions, onSaveComponent, onSaveManual, sheetResistanceValues,
  templateAttributes = [], disableAttributeModifiers = false,
  onCreateResistance, onDeleteResistance,
}: Props) {
  const canEditResistances = permissions.canEditResistances
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showNewForm, setShowNewForm] = useState(false)
  const [draft, setDraft] = useState<NewResistanceDraft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const prevCount = useRef(0)

  // Auto-expand newly added resistances
  useEffect(() => {
    if (resistances.length > prevCount.current && resistances.length > 0) {
      const last = resistances[resistances.length - 1]
      setExpanded(p => ({ ...p, [last.resistanceId]: true }))
    }
    prevCount.current = resistances.length
  }, [resistances.length])

  function formatMod(n: number): string {
    if (n > 0) return `+${n}`
    return `${n}`
  }

  function toggleExpanded(id: string) {
    setExpanded(p => ({ ...p, [id]: !p[id] }))
  }

  function resetForm() {
    setDraft(emptyDraft())
    setShowNewForm(false)
  }

  async function handleCreate() {
    if (!draft.name.trim() || !onCreateResistance) return
    setSaving(true)
    try {
      await onCreateResistance(draft)
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(resistanceId: string) {
    if (!onDeleteResistance) return
    if (!confirm('Delete this resistance? This cannot be undone.')) return
    try {
      await onDeleteResistance(resistanceId)
    } catch {}
  }

  // ── Draft editing helpers ──

  function updateDraft(patch: Partial<NewResistanceDraft>) {
    setDraft(prev => ({ ...prev, ...patch }))
  }

  function addComponent() {
    setDraft(prev => ({
      ...prev,
      components: [...prev.components, { name: '', editableByPlayer: false, defaultValue: '0' }],
    }))
  }

  function removeComponent(idx: number) {
    setDraft(prev => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== idx),
    }))
  }

  function updateComponent(idx: number, patch: Partial<{ name: string; editableByPlayer: boolean; defaultValue: string }>) {
    setDraft(prev => ({
      ...prev,
      components: prev.components.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }))
  }

  function addAttributeModifier(attributeId: string, attributeKey: string, attributeName: string) {
    setDraft(prev => {
      if (prev.attributeModifiers.some(am => am.attributeId === attributeId)) return prev
      return {
        ...prev,
        attributeModifiers: [...prev.attributeModifiers, { attributeId, attributeKey, attributeName, enabled: true }],
      }
    })
  }

  function removeAttributeModifier(attributeId: string) {
    setDraft(prev => ({
      ...prev,
      attributeModifiers: prev.attributeModifiers.filter(am => am.attributeId !== attributeId),
    }))
  }

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Existing Resistances */}
      {resistances.length === 0 && !showNewForm && (
        <div className="card !p-6">
          <div className="text-center py-8 text-muted-foreground">
            <svg className="w-10 h-10 mx-auto text-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            <p className="text-sm italic">No resistances configured.</p>
          </div>
        </div>
      )}

      {resistances.map(r => {
        const isExp = !!expanded[r.resistanceId]
        const isManual = r.calculationType === 'MANUAL'
        const manualVal = sheetResistanceValues[r.resistanceId] ?? '0'

        return (
          <div
            key={r.resistanceId}
            className={`card !p-5 transition-all duration-200 ${isExp ? 'border-primary/20' : ''}`}
          >
            {/* Header row with total */}
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => toggleExpanded(r.resistanceId)}
                className="flex items-center gap-2 text-left flex-1 min-w-0"
              >
                <svg
                  className={`w-3.5 h-3.5 text-muted transition-transform duration-200 shrink-0 ${isExp ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
                <span className="text-sm font-semibold text-foreground truncate">{r.name}</span>
              </button>
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 rounded-full border-2 border-primary/30 flex items-center justify-center bg-background/50">
                  <span className="text-base font-bold text-primary">{r.total}</span>
                </div>
                {canEditResistances && onDeleteResistance && (
                  <button
                    type="button"
                    onClick={() => handleDelete(r.resistanceId)}
                    className="text-muted hover:text-danger p-1 transition-colors shrink-0"
                    title="Delete resistance"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Expanded details */}
            {isExp && (
              <div className="mt-4 pt-4 border-t border-border space-y-4 animate-fade-in">
                {/* Total display */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/30 border border-border">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-lg font-bold text-primary">{r.total}</span>
                </div>

                {isManual ? (
                  <div>
                    <label className="label">{r.name}</label>
                    {canEditResistances ? (
                      <input
                        type="number"
                        className="input-field"
                        value={manualVal}
                        onChange={e => onSaveManual(r.resistanceId, parseInt(e.target.value, 10) || 0)}
                      />
                    ) : (
                      <span className="text-sm font-semibold text-foreground">{manualVal || '0'}</span>
                    )}
                  </div>
                ) : (
                  <>
                    {r.componentValues.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Components</h4>
                        <div className="space-y-1.5">
                          {r.componentValues.map(cv => {
                            const canEdit = canEditResistances && cv.editableByPlayer
                            return (
                              <div key={cv.componentId} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border">
                                <span className="text-sm text-foreground">{cv.componentName}</span>
                                {canEdit ? (
                                  <input
                                    type="number"
                                    className="input-field py-1 text-xs w-20 text-right"
                                    value={cv.value}
                                    onChange={e => onSaveComponent(cv.componentId, parseInt(e.target.value, 10) || 0)}
                                  />
                                ) : (
                                  <span className="text-sm font-semibold text-foreground">{cv.value}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {r.attributeModifierValues.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Attribute Modifiers</h4>
                        <div className="space-y-1.5 opacity-75">
                          {r.attributeModifierValues.map(am => (
                            <div key={am.attributeId} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border">
                              <span className="text-sm text-foreground truncate">{am.attributeName} Mod</span>
                              <span className="text-sm font-semibold text-muted">
                                {formatMod(am.effectiveModifier)}
                                {am.rawModifier !== am.effectiveModifier && (
                                  <span className="text-[0.65rem] text-muted ml-1">(raw: {formatMod(am.rawModifier)})</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* New Resistance Form */}
      {canEditResistances && onCreateResistance && (
        <>
          {!showNewForm ? (
            <button
              type="button"
              onClick={() => setShowNewForm(true)}
              className="btn-primary text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              New Resistance
            </button>
          ) : (
            <div className="card !p-5 space-y-4 border-primary/20">
              <div className="header-accent">
                <h3 className="text-sm font-semibold text-gradient">New Resistance</h3>
              </div>

              {/* Name */}
              <div>
                <label className="label">Resistance Name</label>
                <input
                  className="input-field"
                  value={draft.name}
                  onChange={e => updateDraft({ name: e.target.value })}
                  placeholder="e.g. Fire Resistance"
                  autoFocus
                />
              </div>

              {/* Calculation Type */}
              <div>
                <label className="label">Calculation Type</label>
                <div className="flex gap-2">
                  {(['MANUAL', 'CALCULATED'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        updateDraft({
                          calculationType: mode,
                          ...(mode === 'MANUAL' ? { components: [], attributeModifiers: [] } : {}),
                        })
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        draft.calculationType === mode
                          ? 'bg-primary/15 text-primary border border-primary/20'
                          : 'text-muted hover:text-foreground border border-transparent'
                      }`}
                    >
                      {mode === 'MANUAL' ? 'Manual Value' : 'Calculated'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculated Components */}
              {draft.calculationType === 'CALCULATED' && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-foreground">Components</label>
                      <button type="button" onClick={addComponent} className="btn-ghost text-xs">
                        + Add Component
                      </button>
                    </div>
                    <div className="space-y-2">
                      {draft.components.length === 0 && (
                        <p className="text-xs text-muted italic text-center py-2">No components added yet.</p>
                      )}
                      {draft.components.map((c, cIdx) => (
                        <div key={cIdx} className="rounded-lg border border-border/50 bg-background/20 p-2 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <input
                              className="input-field flex-1"
                              value={c.name}
                              onChange={e => updateComponent(cIdx, { name: e.target.value })}
                              placeholder="Component Name (e.g. Natural)"
                            />
                            <input
                              className="input-field w-20 text-sm text-center"
                              type="number"
                              value={c.defaultValue}
                              onChange={e => updateComponent(cIdx, { defaultValue: e.target.value })}
                              placeholder="0"
                              step={1}
                            />
                            <button
                              type="button"
                              onClick={() => removeComponent(cIdx)}
                              className="text-xs text-danger hover:text-danger/80 shrink-0 px-1"
                            >
                              ✕
                            </button>
                          </div>
                          <label className="flex items-center gap-1 text-xs text-muted cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-3 h-3 rounded accent-primary"
                              checked={c.editableByPlayer}
                              onChange={e => updateComponent(cIdx, { editableByPlayer: e.target.checked })}
                            />
                            Editable by Player
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Attribute Modifiers */}
                  {disableAttributeModifiers ? (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                      <p className="text-xs text-amber-300/80 leading-relaxed">
                        Attribute Modifiers are disabled. Enable the global Attribute Modifier System to use this feature.
                      </p>
                      {draft.attributeModifiers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 opacity-50 pointer-events-none">
                          {draft.attributeModifiers.map(am => (
                            <span
                              key={am.attributeId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20"
                            >
                              {am.attributeName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-foreground">Attribute Modifiers</label>
                      </div>
                      <div className="space-y-2">
                        {draft.attributeModifiers.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {draft.attributeModifiers.map(am => (
                              <span
                                key={am.attributeId}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20"
                              >
                                {am.attributeName}
                                <button
                                  type="button"
                                  onClick={() => removeAttributeModifier(am.attributeId)}
                                  className="ml-0.5 text-primary/60 hover:text-primary transition-colors"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="relative">
                          <Select
                            options={[
                              { id: '', label: '+ Add Attribute Modifier' },
                              ...templateAttributes
                                .filter(a => !draft.attributeModifiers.some(am => am.attributeId === a.id))
                                .map(a => ({ id: `${a.id}::${a.key}::${a.name}`, label: a.name }))
                            ]}
                            value=""
                            onChange={val => {
                              if (!val) return
                              const parts = val.split('::')
                              if (parts.length === 3) {
                                addAttributeModifier(parts[0], parts[1], parts[2])
                              }
                            }}
                            className="text-sm"
                            size="md"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-2 border-t border-border/40">
                <button type="button" onClick={resetForm} disabled={saving} className="btn-ghost text-sm">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={saving || !draft.name.trim()}
                  className="btn-primary text-sm"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                      </svg>
                      Create Resistance
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
