'use client'

import { useState } from 'react'

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

interface Props {
  resistances: CalculatedResistance[]
  isOwner: boolean
  onSaveComponent: (componentId: string, value: number) => Promise<void>
  onSaveManual: (resistanceId: string, value: number) => Promise<void>
  sheetResistanceValues: Record<string, string | null>
}

export default function ResistanceTab({ resistances, isOwner, onSaveComponent, onSaveManual, sheetResistanceValues }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  if (!resistances || resistances.length === 0) {
    return (
      <div className="card !p-6 animate-slide-up">
        <div className="text-center py-8 text-muted-foreground">
          <svg className="w-10 h-10 mx-auto text-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
          <p className="text-sm italic">No resistances configured.</p>
        </div>
      </div>
    )
  }

  function formatMod(n: number): string {
    if (n > 0) return `+${n}`
    return `${n}`
  }

  return (
    <div className="space-y-4 animate-slide-up">
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
            <button
              type="button"
              onClick={() => setExpanded(p => ({ ...p, [r.resistanceId]: !p[r.resistanceId] }))}
              className="flex items-center justify-between w-full text-left gap-4"
            >
              <span className="text-sm font-semibold text-foreground">{r.name}</span>
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 rounded-full border-2 border-primary/30 flex items-center justify-center bg-background/50">
                  <span className="text-base font-bold text-primary">{r.total}</span>
                </div>
                <svg
                  className={`w-4 h-4 text-muted transition-transform duration-200 shrink-0 ${isExp ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </div>
            </button>

            {/* Expanded details */}
            {isExp && (
              <div className="mt-4 pt-4 border-t border-border space-y-4 animate-fade-in">
                {/* Total display */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/30 border border-border">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-lg font-bold text-primary">{r.total}</span>
                </div>

                {isManual ? (
                  /* Manual mode input */
                  <div>
                    <label className="label">{r.name}</label>
                    {isOwner ? (
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
                    {/* Component Values */}
                    {r.componentValues.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Components</h4>
                        <div className="space-y-1.5">
                          {r.componentValues.map(cv => {
                            const canEdit = isOwner && cv.editableByPlayer
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

                    {/* Attribute Modifier Values */}
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
    </div>
  )
}
