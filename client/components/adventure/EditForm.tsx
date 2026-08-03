'use client'

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
  name: string
  campaign: string
  synopsis: string
  maxPlayers: number
  sessionWeekday: string
  sessionTime: string
  sessionType: string
  error: string | null
  saving: boolean
  onNameChange: (v: string) => void
  onCampaignChange: (v: string) => void
  onSynopsisChange: (v: string) => void
  onMaxPlayersChange: (v: number) => void
  onSessionWeekdayChange: (v: string) => void
  onSessionTimeChange: (v: string) => void
  onSessionTypeChange: (v: string) => void
  onCancel: () => void
  onSubmit: (e: SubmitEvent) => void
}) {
  return (
    <form onSubmit={onSubmit} className="card !p-6 space-y-4 animate-slide-up">
      <div className="flex items-center gap-3 mb-2">
        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <h2 className="text-xl font-semibold text-gradient">Edit Adventure</h2>
      </div>

      <div>
        <label className="label">Adventure Name</label>
        <input className="input-field" value={name} onChange={e => onNameChange(e.target.value)} maxLength={100} />
      </div>

      <div>
        <label className="label">Campaign</label>
        <input className="input-field" value={campaign} onChange={e => onCampaignChange(e.target.value)} maxLength={50} />
      </div>

      <div>
        <label className="label">
          Synopsis <span className="text-muted font-normal">(optional)</span>
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
        <label className="label">Max Players</label>
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
        <label className="label">Session Schedule</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-1.5">
          <div>
            <label className="text-xs text-muted mb-1 block">Day</label>
            <select
              value={sessionWeekday}
              onChange={e => onSessionWeekdayChange(e.target.value)}
              className="input-field"
            >
              <option value="">Select day...</option>
              {weekdays.map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Time</label>
            <input
              type="time"
              value={sessionTime}
              onChange={e => onSessionTimeChange(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Format</label>
            <div className="flex gap-1 pt-0.5">
              <button
                type="button"
                onClick={() => onSessionTypeChange('ONLINE')}
                className={`tab-pill flex-1 ${sessionType === 'ONLINE' ? 'tab-pill-active' : ''}`}
              >
                🌐 Online
              </button>
              <button
                type="button"
                onClick={() => onSessionTypeChange('IN_PERSON')}
                className={`tab-pill flex-1 ${sessionType === 'IN_PERSON' ? 'tab-pill-active' : ''}`}
              >
                📍 In Person
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
          Cancel
        </button>
        <button type="submit" disabled={saving || name.trim().length === 0} className="btn-primary">
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </form>
  )
}
