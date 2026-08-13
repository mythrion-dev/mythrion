'use client'

import { useTranslation } from 'react-i18next'

interface AssignPlayer {
  id: string
  role: string
  user: { id: string; email: string; displayName: string | null }
}

export function AssignCharacterModal({ characterName, players, currentAssigneeId, value, error, loading, onValueChange, onCancel, onConfirm }: {
  readonly characterName: string
  readonly players: ReadonlyArray<AssignPlayer>
  readonly currentAssigneeId: string
  readonly value: string
  readonly error: string | null
  readonly loading: boolean
  readonly onValueChange: (memberId: string) => void
  readonly onCancel: () => void
  readonly onConfirm: () => void
}) {
  const { t } = useTranslation()
  // Only PLAYER members can be assigned a character. The current assignee stays
  // in the list so the GM can keep them or switch to someone else.
  const available = players.filter(p => p.role !== 'GM')
  const isChange = currentAssigneeId !== ''
  const confirmDisabled = !value || value === currentAssigneeId || available.length === 0 || loading
  const confirmLabel = isChange ? t('campaign:changeAssignment') : t('campaign:assign')
  const buttonLabel = loading ? t('campaign:assigning') : confirmLabel
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/50" />
      <div className="card !p-6 max-w-sm w-full space-y-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-muted flex items-center justify-center">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold">{isChange ? t('campaign:changeAssignment') : t('campaign:assignCharacter')}</h2>
            <p className="text-sm text-muted-foreground">{isChange ? t('campaign:changeAssignmentHelp') : t('campaign:assignHelp')}</p>
          </div>
        </div>
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('campaign:noPlayersToAssign')}</p>
        ) : (
          <>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">{t('campaign:selectPlayer')}</span>
              <select
                value={value}
                onChange={e => onValueChange(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">{t('campaign:selectPlayerPlaceholder')}</option>
                {available.map(p => (
                  <option key={p.id} value={p.id}>{p.user.displayName ?? p.user.email}</option>
                ))}
              </select>
            </label>
            <p className="text-xs text-muted-foreground">{t('campaign:assignConfirmBody', { name: characterName })}</p>
          </>
        )}
        {error && (
          <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{error}</div>
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading} className="btn-ghost">{t('common:cancel')}</button>
          <button onClick={onConfirm} disabled={confirmDisabled} className="btn-primary">
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
