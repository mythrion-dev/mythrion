'use client'

import { useState } from 'react'
import { InlineText, InlineNumber } from '@/lib/inline-editable'
import { NumericInput } from '@/components/shared/NumericInput'

interface CoreResourceDef {
  id: string; slug: string; displayName: string
  enabled: boolean
  editableByPlayer: boolean
  showNotes: boolean
  color?: string
}
interface CoreResourceValue {
  id: string; coreResourceId: string; current: number | null; maximum: number | null; notes: string | null
  coreResource: CoreResourceDef
}

export function CoreResourceCard({ resource, value, isOwner, onSave, onModify }: {
  resource: CoreResourceDef
  value: CoreResourceValue
  isOwner: boolean
  onSave: (coreResourceId: string, field: 'current' | 'maximum' | 'notes', val: string) => Promise<void>
  onModify?: (coreResourceId: string, delta: number) => void
}) {
  const [modifier, setModifier] = useState(0)
  const canEdit = isOwner && resource.editableByPlayer

  return (
    <div className="card !p-4 space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        {resource.displayName}
        {resource.showNotes && (
          isOwner
            ? <InlineText value={value.notes ?? ''} onSave={(v) => onSave(value.coreResourceId, 'notes', v)} placeholder="notes..." emptyDisplay="add notes" className="!text-xs !text-muted !font-normal" />
            : value.notes && <span className="text-xs text-muted font-normal">— {value.notes}</span>
        )}
      </h3>
      <div className="flex items-center justify-between gap-3">
        <div className="text-center">
          <span className="text-muted text-xs block">Current</span>
          {canEdit
            ? <InlineNumber value={value.current ?? 0} onSave={(v) => onSave(value.coreResourceId, 'current', String(v))} min={0} className="text-xl font-bold text-foreground" />
            : <span className="text-xl font-bold text-foreground">{value.current ?? '—'}</span>
          }
        </div>
        <span className="text-muted text-lg">/</span>
        <div className="text-center">
          <span className="text-muted text-xs block">Max</span>
          {canEdit
            ? <InlineNumber value={value.maximum ?? 0} onSave={(v) => onSave(value.coreResourceId, 'maximum', String(v))} min={0} className="text-xl font-bold text-foreground" />
            : <span className="text-xl font-bold text-foreground">{value.maximum ?? '—'}</span>
          }
        </div>
      </div>
      {value.maximum != null && value.maximum > 0 && (
        <div className="w-full h-2 rounded-full bg-background/60 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${Math.min(100, Math.max(0, ((value.current ?? 0) / value.maximum) * 100))}%`,
              backgroundColor: resource.color || 'var(--color-primary)',
              filter: 'brightness(1.15)',
            }}
          />
        </div>
      )}
      {canEdit && onModify && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <NumericInput min={0} className="py-1 text-xs flex-1" inputClassName="!px-2 !py-1" wrapperClassName="flex-1" value={modifier || ''} placeholder="Amount" onChange={e => setModifier(parseInt(e.target.value, 10) || 0)} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { onModify(value.coreResourceId, Math.abs(modifier)); setModifier(0) }} disabled={!modifier} className="btn-primary text-xs flex-1 py-1">+ Heal / Recover</button>
            <button type="button" onClick={() => { onModify(value.coreResourceId, -Math.abs(modifier)); setModifier(0) }} disabled={!modifier} className="btn-danger text-xs flex-1 py-1">− Damage / Lose</button>
          </div>
        </div>
      )}
    </div>
  )
}
