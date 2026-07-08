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
      <div className="card !p-6">
        <div className="text-center py-6 text-muted-foreground text-sm italic">
          No resistances configured.
        </div>
      </div>
    )
  }

  function formatMod(n: number): string {
    if (n > 0) return `+${n}`
    return `${n}`
  }

  return (
    <div className="space-y-4">
      {resistances.map(r => {
        const isExp = !!expanded[r.resistanceId]
        const isManual = r.calculationType === 'MANUAL'
        const manualVal = sheetResistanceValues[r.resistanceId] ?? '0'

        return (
          <div key={r.resistanceId} className="card !p-4 overflow-hidden">
            {/* Header */}
            <button
              type="button"
              onClick={() => setExpanded(p => ({ ...p, [r.resistanceId]: !p[r.resistanceId] }))}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="text-sm font-semibold text-foreground">{r.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-primary">{r.total}</span>
                <svg className={`w-4 h-4 text-muted transition-transform shrink-0 ${isExp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </div>
            </button>

            {isExp && (
              <div className="mt-4 pt-4 border-t border-border space-y-3">
                {/* Total */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-lg font-bold text-primary">{r.total}</span>
                </div>

                {isManual ? (
                  /* Manual Mode */
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
                        <div className="space-y-1">
                          {r.componentValues.map(cv => {
                            const canEdit = isOwner && cv.editableByPlayer
                            return (
                              <div key={cv.componentId} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-background/50 border border-border">
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
                        <div className="space-y-1 opacity-80">
                          {r.attributeModifierValues.map(am => (
                            <div key={am.attributeId} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-background/50 border border-border">
                              <span className="text-sm text-foreground truncate">{am.attributeName} Mod</span>
                              <span className="text-sm font-semibold text-muted">
                                {am.effectiveModifier > 0 ? `+${am.effectiveModifier}` : `+0`}
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