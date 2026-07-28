'use client'

import { useState } from 'react'
import { NumericInput } from '@/components/shared/NumericInput'
import type { SheetPermissions } from './types'

interface HealthBarProps {
  current: number | null
  maximum: number | null
  onChange: (field: 'current' | 'maximum', value: number | null) => void
  permissions: SheetPermissions
}

export function HealthBar({ current, maximum, onChange, permissions }: HealthBarProps) {
  const canEdit = permissions.canEditAbilities
  const max = maximum ?? 0
  const cur = current ?? 0
  const pct = max > 0 ? Math.min(100, Math.max(0, (cur / max) * 100)) : 0
  const [hpAmount, setHpAmount] = useState('')

  const barColor =
    pct > 60 ? 'bg-green-600' :
    pct > 30 ? 'bg-yellow-500' :
    pct > 0  ? 'bg-red-600' :
    'bg-gray-600'

  const showBar = max > 0

  // Quick heal / damage
  function handleDamage(amt: number) {
    if (isNaN(amt) || amt <= 0) return
    onChange('current', Math.max(0, (current ?? 0) - amt))
  }

  function handleHeal(amt: number) {
    if (isNaN(amt) || amt <= 0) return
    onChange('current', (current ?? 0) + amt)
  }

  return (
    <div className="health-bar">
      {/* Values display */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">HP</span>
          {(current !== null || maximum !== null) && (
            <span className="text-sm font-bold text-foreground">
              {current ?? '—'} / {maximum ?? '—'}
            </span>
          )}
        </div>
        <span className="text-xs font-semibold text-muted">
          {showBar ? `${Math.round(pct)}%` : '—'}
        </span>
      </div>

      {/* Animated bar */}
      <div className="w-full h-3 rounded-full bg-background/50 border border-border/50 overflow-hidden">
        {showBar ? (
          <div
            className={`h-full rounded-full transition-all duration-300 ease-in-out ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="h-full rounded-full bg-gray-700/30 w-full flex items-center justify-center">
            <span className="text-[0.55rem] text-muted">— / —</span>
          </div>
        )}
      </div>

      {/* Editable fields + quick buttons */}
      {canEdit && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-3">
            <label className="text-[0.65rem] text-muted w-12 shrink-0">Current:</label>
            <NumericInput
              value={current !== null ? String(current) : ''}
              onChange={e => onChange('current', e.target.value.trim() ? parseInt(e.target.value, 10) : null)}
              placeholder="—"
              className="flex-1 py-1 text-xs text-center bg-background/50 border border-border rounded-md px-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
              wrapperClassName="flex-1"
              inputClassName="!text-center !text-xs"
              min={0}
            />
            <label className="text-[0.65rem] text-muted w-8 shrink-0">Max:</label>
            <NumericInput
              value={maximum !== null ? String(maximum) : ''}
              onChange={e => onChange('maximum', e.target.value.trim() ? parseInt(e.target.value, 10) : null)}
              placeholder="—"
              className="flex-1 py-1 text-xs text-center bg-background/50 border border-border rounded-md px-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
              wrapperClassName="flex-1"
              inputClassName="!text-center !text-xs"
              min={0}
            />
          </div>
          <div className="flex items-center gap-2">
            <NumericInput
              min={1}
              value={hpAmount}
              onChange={e => setHpAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 py-1.5 text-xs text-center bg-background/60 border border-border rounded-md px-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
              wrapperClassName="flex-[2]"
              inputClassName="!text-center !text-xs"
            />
            <button
              onClick={() => {
                const amt = parseInt(hpAmount, 10)
                if (!isNaN(amt) && amt > 0) {
                  handleDamage(amt)
                  setHpAmount('')
                }
              }}
              className="flex-1 px-3 py-1.5 text-xs font-bold rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
            >
              Damage
            </button>
            <button
              onClick={() => {
                const amt = parseInt(hpAmount, 10)
                if (!isNaN(amt) && amt > 0) {
                  handleHeal(amt)
                  setHpAmount('')
                }
              }}
              className="flex-1 px-3 py-1.5 text-xs font-bold rounded-md bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-colors"
            >
              Heal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
