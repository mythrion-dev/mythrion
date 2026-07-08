'use client'

import { useState, useRef, useEffect } from 'react'

interface ResistanceComponent {
  id?: string
  name: string
  editableByPlayer: boolean
  defaultValue: string
}

interface ResistanceDefinition {
  id?: string
  name: string
  calculationType: 'MANUAL' | 'CALCULATED'
  components: ResistanceComponent[]
  attributeModifiers: { attributeId: string; attributeKey: string; attributeName: string; enabled: boolean }[]
}

interface Props {
  resistances: ResistanceDefinition[]
  attributes: { id: string; key: string; name: string }[]
  onChange: (resistances: ResistanceDefinition[]) => void
}

function newResistance(): ResistanceDefinition {
  return { name: '', calculationType: 'MANUAL', components: [], attributeModifiers: [] }
}

export default function ResistanceSystemConfig({ resistances, attributes, onChange }: Props) {
  const [expandedResistances, setExpandedResistances] = useState<Record<number, boolean>>({})
  const prevCount = useRef(0)

  useEffect(() => {
    if (resistances.length > prevCount.current) {
      // Auto-expand newly created
      setExpandedResistances(p => ({ ...p, [resistances.length - 1]: true }))
    }
    prevCount.current = resistances.length
  }, [resistances.length])

  function addResistance() {
    onChange([...resistances, newResistance()])
  }

  function removeResistance(index: number) {
    const next = resistances.filter((_, i) => i !== index)
    onChange(next)
    // Rebuild expanded state
    const newExpanded: Record<number, boolean> = {}
    Object.entries(expandedResistances).forEach(([k, v]) => {
      const ki = parseInt(k)
      if (ki < index) newExpanded[ki] = v
      else if (ki > index) newExpanded[ki - 1] = v
    })
    setExpandedResistances(newExpanded)
  }

  function updateResistance(index: number, patch: Partial<ResistanceDefinition>) {
    onChange(resistances.map((r, i) => i === index ? { ...r, ...patch } : r))
  }

  function addComponent(resistanceIndex: number) {
    const r = resistances[resistanceIndex]
    const components = [...r.components, { name: '', editableByPlayer: false, defaultValue: '0' }]
    updateResistance(resistanceIndex, { components })
  }

  function removeComponent(resistanceIndex: number, componentIndex: number) {
    const r = resistances[resistanceIndex]
    const components = r.components.filter((_, i) => i !== componentIndex)
    updateResistance(resistanceIndex, { components })
  }

  function updateComponent(resistanceIndex: number, componentIndex: number, patch: Partial<ResistanceComponent>) {
    const r = resistances[resistanceIndex]
    const components = r.components.map((c, i) => i === componentIndex ? { ...c, ...patch } : c)
    updateResistance(resistanceIndex, { components })
  }

  function addAttributeModifier(resistanceIndex: number, attributeId: string, attributeKey: string, attributeName: string) {
    const r = resistances[resistanceIndex]
    // Don't add duplicates
    if (r.attributeModifiers.some(am => am.attributeId === attributeId)) return
    const attributeModifiers = [
      ...r.attributeModifiers,
      { attributeId, attributeKey, attributeName, enabled: true },
    ]
    updateResistance(resistanceIndex, { attributeModifiers })
  }

  function removeAttributeModifier(resistanceIndex: number, attributeId: string) {
    const r = resistances[resistanceIndex]
    const attributeModifiers = r.attributeModifiers.filter(am => am.attributeId !== attributeId)
    updateResistance(resistanceIndex, { attributeModifiers })
  }

  if (resistances.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-center py-6 text-muted-foreground text-sm italic">
          No resistances configured.
        </div>
        <button type="button" onClick={addResistance} className="btn-primary text-sm">
          + New Resistance
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {resistances.map((r, rIdx) => {
        const isExpanded = !!expandedResistances[rIdx]
        return (
          <div key={rIdx} className="rounded-lg border border-border bg-background/30 overflow-hidden">
            {/* Collapsible Header */}
            <button
              type="button"
              onClick={() => setExpandedResistances(p => ({ ...p, [rIdx]: !p[rIdx] }))}
              className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-background/50 transition-colors"
            >
              <span className="text-sm font-medium text-foreground truncate">
                {r.name || 'New Resistance'}
              </span>
              <svg className={`w-4 h-4 text-muted transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            {isExpanded && (
              <div className="px-3 py-3 space-y-3 border-t border-border">
                {/* Resistance Name */}
                <div>
                  <label className="label">Resistance Name</label>
                  <input
                    className="input-field"
                    value={r.name}
                    onChange={e => updateResistance(rIdx, { name: e.target.value })}
                    placeholder="e.g. Fire Resistance"
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
                          updateResistance(rIdx, {
                            calculationType: mode,
                            ...(mode === 'MANUAL' ? { components: [], attributeModifiers: [] } : {}),
                          })
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          r.calculationType === mode
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
                {r.calculationType === 'CALCULATED' && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-foreground">Components</label>
                        <button type="button" onClick={() => addComponent(rIdx)} className="btn-ghost text-xs">
                          + Add Component
                        </button>
                      </div>
                      <div className="space-y-2">
                        {r.components.length === 0 && (
                          <p className="text-xs text-muted italic text-center py-2">No components added yet.</p>
                        )}
                        {r.components.map((c, cIdx) => (
                          <div key={cIdx} className="rounded-lg border border-border/50 bg-background/20 p-2 space-y-2">
                            <div className="flex items-center gap-1.5">
                              <input
                                className="input-field flex-1"
                                value={c.name}
                                onChange={e => updateComponent(rIdx, cIdx, { name: e.target.value })}
                                placeholder="Component Name (e.g. Natural)"
                              />
                              <input
                                className="input-field w-20 text-sm text-center"
                                type="number"
                                value={c.defaultValue}
                                onChange={e => updateComponent(rIdx, cIdx, { defaultValue: e.target.value })}
                                placeholder="0"
                                step={1}
                              />
                              <button
                                type="button"
                                onClick={() => removeComponent(rIdx, cIdx)}
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
                                onChange={e => updateComponent(rIdx, cIdx, { editableByPlayer: e.target.checked })}
                              />
                              Editable by Player
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Attribute Modifiers */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-foreground">Attribute Modifiers</label>
                      </div>
                      <div className="space-y-2">
                        {/* Selected attribute modifiers as chips */}
                        {r.attributeModifiers.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {r.attributeModifiers.map(am => (
                              <span
                                key={am.attributeId}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20"
                              >
                                {am.attributeName}
                                <button
                                  type="button"
                                  onClick={() => removeAttributeModifier(rIdx, am.attributeId)}
                                  className="ml-0.5 text-primary/60 hover:text-primary transition-colors"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Add modifier dropdown */}
                        <div className="relative">
                          <select
                            className="input-field text-sm"
                            value=""
                            onChange={e => {
                              const val = e.target.value
                              if (!val) return
                              const parts = val.split('::')
                              if (parts.length === 3) {
                                addAttributeModifier(rIdx, parts[0], parts[1], parts[2])
                              }
                              e.target.value = ''
                            }}
                          >
                            <option value="">+ Add Attribute Modifier</option>
                            {attributes
                              .filter(a => !r.attributeModifiers.some(am => am.attributeId === a.id))
                              .map(a => (
                                <option key={a.id} value={`${a.id}::${a.key}::${a.name}`}>
                                  {a.name}
                                </option>
                              ))
                            }
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Manual mode - nothing additional to show */}

                {/* Delete button */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => removeResistance(rIdx)}
                    className="text-xs text-danger hover:text-danger/80 transition-colors"
                  >
                    Remove Resistance
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      <button type="button" onClick={addResistance} className="btn-primary text-sm">
        + New Resistance
      </button>
    </div>
  )
}