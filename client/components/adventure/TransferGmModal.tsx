'use client'

import { useTranslation } from 'react-i18next'

export function TransferGmModal({
  members,
  currentUserId,
  value,
  error,
  loading,
  onValueChange,
  onCancel,
  onConfirm,
}: {
  readonly members: ReadonlyArray<{
    readonly id: string
    readonly role: string
    readonly user: {
      readonly id: string
      readonly email: string
      readonly displayName: string | null
    }
  }>
  readonly currentUserId: string
  readonly value: string
  readonly error: string | null
  readonly loading: boolean
  readonly onValueChange: (userId: string) => void
  readonly onCancel: () => void
  readonly onConfirm: () => void
}) {
  const { t } = useTranslation()
  const players = members.filter(
    (m) => m.role !== 'GM' && m.user.id !== currentUserId,
  )
  const confirmDisabled = !value || players.length === 0 || loading
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
            <h2 className="font-semibold">{t('campaign:transferGM')}</h2>
            <p className="text-sm text-muted-foreground">{t('campaign:transferHelp')}</p>
          </div>
        </div>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('campaign:noPlayersToTransfer')}
          </p>
        ) : (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t('campaign:transferTarget')}</span>
            <select
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t('campaign:transferTargetPlaceholder')}</option>
              {players.map((p) => (
                <option key={p.user.id} value={p.user.id}>
                  {p.user.displayName ?? p.user.email}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && (
          <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading} className="btn-ghost">
            {t('common:cancel')}
          </button>
          <button onClick={onConfirm} disabled={confirmDisabled} className="btn-primary">
            {loading ? t('campaign:transferring') : t('campaign:transfer')}
          </button>
        </div>
      </div>
    </div>
  )
}
