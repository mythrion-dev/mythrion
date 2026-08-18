'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { normalizeLanguage } from '@/i18n'
import { formatTimeForLocale } from '@/lib/time'

interface CampaignCardProps {
  readonly id: string
  readonly name: string
  readonly campaign: string
  readonly synopsis: string | null
  readonly maxPlayers: number
  readonly ownerDisplayName: string | null
  readonly playerCount?: number
  readonly index?: number
  readonly sessionWeekday?: string | null
  readonly sessionTime?: string | null
  readonly sessionType?: string | null
}

export function CampaignCard({
  id,
  name,
  campaign,
  synopsis,
  maxPlayers,
  ownerDisplayName,
  playerCount = 0,
  index = 0,
  sessionWeekday,
  sessionTime,
  sessionType,
}: Readonly<CampaignCardProps>) {
  const { t, i18n } = useTranslation()
  const truncatedSynopsis = synopsis && synopsis.length > 120
    ? synopsis.slice(0, 120).trimEnd() + '...'
    : synopsis

  const hasSessionInfo = sessionWeekday || sessionTime || sessionType
  const formattedTime = sessionTime
    ? formatTimeForLocale(sessionTime, normalizeLanguage(i18n.resolvedLanguage ?? i18n.language), t('community:am'), t('community:pm'))
    : ''

  return (
    <Link
      href={`/dashboard/explore-campaigns/${id}`}
      className="card-interactive group flex flex-col"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Card ornament */}
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between mb-2 gap-2">
        <h3 className="font-semibold text-foreground truncate flex-1">
          {name}
        </h3>
        <span className="shrink-0 badge badge-gold text-[0.6rem]">
          {campaign}
        </span>
      </div>

      {truncatedSynopsis ? (
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
          {truncatedSynopsis}
        </p>
      ) : (
        <p className="text-sm text-muted italic mb-4 flex-1">
          {t('community:noSynopsis')}
        </p>
      )}

      {/* Session info row */}
      {hasSessionInfo && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-400">
          {sessionWeekday && sessionTime && (
            <span>{sessionWeekday} &bull; {formattedTime}</span>
          )}
          {sessionWeekday && !sessionTime && (
            <span>{sessionWeekday}</span>
          )}
          {sessionTime && !sessionWeekday && (
            <span>{formattedTime}</span>
          )}
          {sessionType === 'ONLINE' && <span>&#x1F310; {t('community:online')}</span>}
          {sessionType === 'IN_PERSON' && <span>&#x1F4CD; {t('community:inPerson')}</span>}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            <svg
              className="w-3.5 h-3.5 inline mr-1 -mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {t('community:playersCount', { playerCount, maxPlayers })}
          </span>
        </div>
        {ownerDisplayName && (
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
            {ownerDisplayName}
          </span>
        )}
      </div>
    </Link>
  )
}
