'use client'

import { useTranslation } from 'react-i18next'

export function LeaveModal({
  error,
  loading,
  onCancel,
  onConfirm,
}: {
  readonly error: string | null
  readonly loading: boolean
  readonly onCancel: () => void
  readonly onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/50" />
      <div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center">
            <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold">{t('campaign:leaveCampaign')}</h2>
            <p className="text-sm text-muted-foreground">{t('campaign:leaveHint')}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('campaign:leaveConfirm')}
        </p>
        {error && (
          <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading} className="btn-ghost">
            {t('common:cancel')}
          </button>
          <button onClick={onConfirm} disabled={loading} className="btn-danger-solid">
            {loading ? t('campaign:leaving') : t('campaign:leaveCampaign')}
          </button>
        </div>
      </div>
    </div>
  )
}
