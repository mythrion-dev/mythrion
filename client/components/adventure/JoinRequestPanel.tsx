'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'

interface JoinRequest {
  id: string
  userId: string
  userDisplayName: string | null
  message: string | null
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
}

interface JoinRequestPanelProps {
  requests: JoinRequest[]
  loading: boolean
  onAccept: (requestId: string) => void
  onReject: (requestId: string) => void
  processingIds: string[]
}

export function JoinRequestPanel({
  requests,
  loading,
  onAccept,
  onReject,
  processingIds,
}: JoinRequestPanelProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredRequests = searchTerm.trim()
    ? requests.filter(r =>
        (r.userDisplayName ?? '')
          .toLowerCase()
          .includes(searchTerm.trim().toLowerCase()),
      )
    : requests

  const pendingCount = requests.length

  return (
    <div className="card !p-5 space-y-4">
      {/* Header / toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
            />
          </svg>
          <h3 className="font-semibold text-sm">{t('campaign:joinRequests')}</h3>
          {pendingCount > 0 && (
            <span className="badge text-[0.6rem]">
              {t('campaign:pendingCount', { count: pendingCount })}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-muted transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-4">
          {/* Search bar */}
          {!loading && requests.length > 0 && (
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
                />
              </svg>
              <input
                type="text"
                placeholder={t('campaign:searchBy')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-background border border-border/60 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {loading ? (
            <LoadingSkeleton count={2} />
          ) : requests.length === 0 ? (
            <EmptyState
              icon="📋"
              title={t('campaign:noPendingRequests')}
              description={t('campaign:noPendingRequestsDescription')}
            />
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              icon="🔍"
              title={t('campaign:noResults')}
              description={t('campaign:noResultsDescription')}
            />
          ) : (
            <div className="space-y-3">
              {filteredRequests.map(req => {
                const isProcessing = processingIds.includes(req.id)

                return (
                  <div
                    key={req.id}
                    className="data-row flex-col items-start gap-2"
                  >
                    <div className="flex items-center gap-2 w-full min-w-0">
                      {/* Avatar initial */}
                      <span className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                        {(req.userDisplayName ?? 'U').charAt(0).toUpperCase()}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {req.userDisplayName ?? t('campaign:unknownUser')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(req.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Message */}
                    {req.message && (
                      <p className="text-xs text-muted-foreground pl-10 leading-relaxed">
                        {req.message}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pl-10">
                      <button
                        onClick={() => onAccept(req.id)}
                        disabled={isProcessing}
                        className={`btn-primary text-xs px-3 py-1 ${
                          isProcessing ? '!opacity-50 !cursor-not-allowed' : ''
                        }`}
                      >
                        {isProcessing ? (
                          <>
                            <div className="w-3 h-3 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                            {t('campaign:accepting')}
                          </>
                        ) : (
                          t('campaign:accept')
                        )}
                      </button>
                      <button
                        onClick={() => onReject(req.id)}
                        disabled={isProcessing}
                        className="btn-ghost text-xs px-3 py-1"
                      >
                        {t('campaign:reject')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
