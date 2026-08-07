'use client'

import { useTranslation } from 'react-i18next'
import type { SubmitEvent } from 'react'

const weekdays = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
]

export function EditForm({
  name,
  campaign,
  synopsis,
  maxPlayers,
  sessionWeekday,
  sessionTime,
  sessionType,
  error,
  saving,
  onNameChange,
  onCampaignChange,
  onSynopsisChange,
  onMaxPlayersChange,
  onSessionWeekdayChange,
  onSessionTimeChange,
  onSessionTypeChange,
  onCancel,
  onSubmit,
}: {
  readonly name: string
  readonly campaign: string
  readonly synopsis: string
  readonly maxPlayers: number
  readonly sessionWeekday: string
  readonly sessionTime: string
  readonly sessionType: string
  readonly error: string | null
  readonly saving: boolean
  readonly onNameChange: (v: string) => void
  readonly onCampaignChange: (v: string) => void
  readonly onSynopsisChange: (v: string) => void
  readonly onMaxPlayersChange: (v: number) => void
  readonly onSessionWeekdayChange: (v: string) => void
  readonly onSessionTimeChange: (v: string) => void
  readonly onSessionTypeChange: (v: string) => void
  readonly onCancel: () => void
  readonly onSubmit: (e: SubmitEvent) => void
}) {
  const { t } = useTranslation()
  return (
    <form onSubmit={onSubmit} className="card !p-6 space-y-4 animate-slide-up">
      <div className="flex items-center gap-3 mb-2">
        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <h2 className="text-xl font-semibold text-gradient">{t('campaign:editAdventure')}</h2>
      </div>

      <div>
        <label className="label">{t('campaign:adventureName')}</label>
        <input className="input-field" value={name} onChange={e => onNameChange(e.target.value)} maxLength={100} />
      </div>

      <div>
        <label className="label">{t('campaign:campaign')}</label>
        <input className="input-field" value={campaign} onChange={e => onCampaignChange(e.target.value)} maxLength={50} />
      </div>

      <div>
        <label className="label">
          {t('campaign:synopsis')} <span className="text-muted font-normal">{t('campaign:optionalLower')}</span>
        </label>
        <textarea
          className="input-field resize-none"
          rows={5}
          value={synopsis}
          onChange={e => onSynopsisChange(e.target.value)}
          maxLength={2000}
        />
        <p className="text-xs text-muted mt-1.5 text-right">{synopsis.length}/2000</p>
      </div>

      <div>
        <label className="label">{t('campaign:maxPlayers')}</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={5}
            value={maxPlayers}
            onChange={e => onMaxPlayersChange(Number(e.target.value))}
            className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #c9a44b 0%, #c9a44b ${((maxPlayers - 1) / 4) * 100}%, #2a2240 ${((maxPlayers - 1) / 4) * 100}%, #2a2240 100%)`,
            }}
          />
          <span className="badge badge-gold min-w-[2rem] text-center">{maxPlayers}</span>
        </div>
      </div>

      {/* Session Schedule */}
      <div>
        <label className="label">{t('campaign:sessionSchedule')}</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-1.5">
          <div>
            <label className="text-xs text-muted mb-1 block">{t('campaign:day')}</label>
            <select
              value={sessionWeekday}
              onChange={e => onSessionWeekdayChange(e.target.value)}
              className="input-field"
            >
              <option value="">{t('campaign:selectDay')}</option>
              {weekdays.map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">{t('campaign:time')}</label>
            <input
              type="time"
              value={sessionTime}
              onChange={e => onSessionTimeChange(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">{t('campaign:format')}</label>
            <div className="flex gap-1 pt-0.5">
              <button
                type="button"
                onClick={() => onSessionTypeChange('ONLINE')}
                className={`tab-pill flex-1 ${sessionType === 'ONLINE' ? 'tab-pill-active' : ''}`}
              >
                {t('campaign:online')}
              </button>
              <button
                type="button"
                onClick={() => onSessionTypeChange('IN_PERSON')}
                className={`tab-pill flex-1 ${sessionType === 'IN_PERSON' ? 'tab-pill-active' : ''}`}
              >
                {t('campaign:inPerson')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} disabled={saving} className="btn-ghost">
          {t('common:cancel')}
        </button>
        <button type="submit" disabled={saving || name.trim().length === 0} className="btn-primary">
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              {t('campaign:saving')}
            </>
          ) : (
            t('campaign:saveChanges')
          )}
        </button>
      </div>
    </form>
  )
}
