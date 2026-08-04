'use client'

import { useTranslation } from 'react-i18next'

interface Adventure {
  id: string; name: string; campaign: string; synopsis: string | null; maxPlayers: number; ownerId: string; createdAt: string; updatedAt: string
}

export function AdventureHeader({ adventure, isGM, userRole, onEdit, onDelete }: {
  adventure: Adventure; isGM: boolean; userRole: string | null; onEdit: () => void; onDelete: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="card !p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gradient truncate">{adventure.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="badge badge-gold">{adventure.campaign}</span>
            <span className="badge badge-gold">{t('campaign:playerCount', { count: adventure.maxPlayers })}</span>
            {userRole && (
              <span
                className={`badge text-[0.6rem] ${isGM ? 'badge-gold' : ''}`}
                style={!isGM ? { background: 'rgba(124,92,231,0.15)', color: '#9070f0', border: '1px solid rgba(124,92,231,0.2)' } : undefined}
              >
                {userRole}
              </span>
            )}
            <span className="text-xs text-muted">
              {t('campaign:createdOn', { date: new Date(adventure.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) })}
            </span>
          </div>
        </div>
        {isGM && (
          <div className="flex gap-2 shrink-0">
            <button onClick={onEdit} className="btn-ghost">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {t('common:edit')}
            </button>
            <button onClick={onDelete} className="btn-danger">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {t('common:delete')}
            </button>
          </div>
        )}
      </div>
      <hr className="divider" />
      {adventure.synopsis ? (
        <div>
          <h3 className="text-sm font-medium text-muted mb-2">{t('campaign:synopsis')}</h3>
          <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap text-sm">{adventure.synopsis}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center py-8 text-center space-y-2">
          <svg className="w-8 h-8 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <p className="text-sm text-muted-foreground">{t('campaign:noSynopsisYet')}</p>
          {isGM && <p className="text-xs text-muted">{t('campaign:clickEditToAddSynopsis')}</p>}
        </div>
      )}
    </div>
  )
}
