'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import Link from 'next/link'
import { PageNav } from '@/lib/breadcrumb'
import { TemplatePickerModal } from '@/components/adventure/TemplatePickerModal'

export default function NewAdventurePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [campaign, setCampaign] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [isPublic, setIsPublic] = useState(false)
  const [sessionWeekday, setSessionWeekday] = useState('')
  const [sessionTime, setSessionTime] = useState('')
  const [sessionType, setSessionType] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState<string | null>(null)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

  const weekdays = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  ]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    setSubmitting(true)

    try {
      const created = await api.post<{ id: string }>('/adventures', {
        name: name.trim(),
        campaign: campaign.trim(),
        synopsis: synopsis.trim() || undefined,
        maxPlayers,
        isPublic: isPublic || undefined,
        ...(templateId && { templateId }),
        ...(sessionWeekday && { sessionWeekday }),
        ...(sessionTime && { sessionTime }),
        ...(sessionType && { sessionType }),
      })
      router.push(`/dashboard/adventures/${created.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create adventure')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-center relative">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-b from-accent/5 via-primary/3 to-transparent blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl space-y-6 animate-slide-up relative z-10">
        <PageNav crumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'New Adventure' },
        ]} />

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-surface border border-border">
            <svg
              className="w-5 h-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gradient">
              Create Adventure
            </h1>
            <p className="text-sm text-muted-foreground">
              Your new adventure awaits
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card !p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="label">
                Adventure Name
              </label>
              <input
                id="name"
                type="text"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="e.g. The Dragon's Lair"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="campaign" className="label">
                Campaign <span className="text-muted font-normal">(RPG system)</span>
              </label>
              <input
                id="campaign"
                type="text"
                required
                maxLength={50}
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                className="input-field"
                placeholder="e.g. D&D, Tormenta, Call of Cthulhu"
              />
            </div>
          </div>

          <div>
            <label htmlFor="synopsis" className="label">
              Synopsis{' '}
              <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="synopsis"
              maxLength={2000}
              rows={4}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              className="input-field resize-none"
              placeholder="Give your adventure a brief description — set the scene for your players..."
            />
            <div className="flex justify-between items-center mt-1.5">
              <p className="text-xs text-muted">Describe the tone, setting, and premise of your adventure.</p>
              <span className="text-xs text-muted">{synopsis.length}/2000</span>
            </div>
          </div>

          <div>
            <label htmlFor="maxPlayers" className="label">
              Max Players
            </label>
            <div className="flex items-center gap-3">
              <input
                id="maxPlayers"
                type="range"
                min={1}
                max={5}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #c9a44b 0%, #c9a44b ${((maxPlayers - 1) / 4) * 100}%, #2a2240 ${((maxPlayers - 1) / 4) * 100}%, #2a2240 100%)`,
                }}
              />
              <span className="badge badge-gold min-w-[2rem] text-center">
                {maxPlayers}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted mt-1.5">
              <span>1</span>
              <span>5</span>
            </div>
          </div>

          {/* Session Info */}
          <div>
            <label className="label">
              Session Schedule <span className="text-muted font-normal">(optional)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-1.5">
              <div>
                <label htmlFor="sessionWeekday" className="text-xs text-muted mb-1 block">Day</label>
                <select
                  id="sessionWeekday"
                  value={sessionWeekday}
                  onChange={(e) => setSessionWeekday(e.target.value)}
                  className="input-field"
                >
                  <option value="">Select day...</option>
                  {weekdays.map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sessionTime" className="text-xs text-muted mb-1 block">Time</label>
                <input
                  id="sessionTime"
                  type="time"
                  value={sessionTime}
                  onChange={(e) => setSessionTime(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Format</label>
                <div className="flex gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setSessionType('ONLINE')}
                    className={`tab-pill flex-1 ${sessionType === 'ONLINE' ? 'tab-pill-active' : ''}`}
                  >
                    🌐 Online
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionType('IN_PERSON')}
                    className={`tab-pill flex-1 ${sessionType === 'IN_PERSON' ? 'tab-pill-active' : ''}`}
                  >
                    📍 In Person
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Public toggle */}
          <div className="flex items-start gap-3 pt-1">
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              onClick={() => setIsPublic(!isPublic)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isPublic ? 'bg-accent' : 'bg-border'}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${isPublic ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">Public Campaign</span>
              <span className="text-xs text-muted">Anyone can see this campaign in the community explorer</span>
            </div>
          </div>

          {/* Template selection */}
          <div className="pt-2">
            <label className="label">
              Character Sheet Template{' '}
              <span className="text-muted font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-2 mt-1.5">
              {templateName ? (
                <div className="flex items-center gap-2 flex-1">
                  <span className="badge text-xs" style={{ background: 'rgba(124,92,231,0.12)', color: '#9070f0', border: '1px solid rgba(124,92,231,0.18)' }}>
                    {templateName}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setTemplateId(null); setTemplateName(null) }}
                    className="btn-ghost text-xs !px-2 !py-0.5"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker(true)}
                  className="btn-ghost text-xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
                  </svg>
                  Select Template
                </button>
              )}
            </div>
            <p className="text-xs text-muted mt-1">
              Attach a character sheet template to let players create characters.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2 border-t border-border/40">
            <Link
              href="/dashboard"
              className="btn-ghost text-sm"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || name.trim().length === 0 || campaign.trim().length === 0}
              className="btn-primary text-sm"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Create Adventure
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}