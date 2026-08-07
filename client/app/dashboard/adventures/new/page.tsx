'use client'

import { useState, type SubmitEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import Link from 'next/link'
import { PageNav } from '@/lib/breadcrumb'
import { TemplatePickerModal } from '@/components/adventure/TemplatePickerModal'
import { TimePicker } from '@/components/shared/TimePicker'
import { useSubscription } from '@/lib/subscription-context'

export default function NewAdventurePage() {
  const { hasActiveSubscription } = useSubscription()
  const { t } = useTranslation()
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

  if (!hasActiveSubscription) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 2.25h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">{t('campaign:subscriptionRequired')}</h2>
        <p className="text-sm text-muted-foreground max-w-sm mb-8">
          {t('campaign:premiumFeature')}
        </p>
        <Link href="/pricing" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {t('common:viewPlans')}
        </Link>
      </div>
    )
  }

  const weekdays = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  ]

  async function handleSubmit(e: SubmitEvent) {
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
      setError(err instanceof Error ? err.message : t('campaign:failedToCreateAdventure'))
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
          { label: t('common:dashboard'), href: '/dashboard' },
          { label: t('campaign:newAdventure') },
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
              {t('campaign:createAdventure')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('campaign:yourNewAdventureAwaits')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card !p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="label">
                {t('campaign:adventureName')}
              </label>
              <input
                id="name"
                type="text"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder={t('campaign:adventureNamePlaceholder')}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="campaign" className="label">
                {t('campaign:campaign')} <span className="text-muted font-normal">{t('campaign:rpgSystem')}</span>
              </label>
              <input
                id="campaign"
                type="text"
                required
                maxLength={50}
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                className="input-field"
                placeholder={t('campaign:campaignPlaceholder')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="synopsis" className="label">
              {t('campaign:synopsis')}{' '}
              <span className="text-muted font-normal">{t('campaign:optionalLower')}</span>
            </label>
            <textarea
              id="synopsis"
              maxLength={2000}
              rows={4}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              className="input-field resize-none"
              placeholder={t('campaign:synopsisPlaceholder')}
            />
            <div className="flex justify-between items-center mt-1.5">
              <p className="text-xs text-muted">{t('campaign:synopsisHelp')}</p>
              <span className="text-xs text-muted">{synopsis.length}/2000</span>
            </div>
          </div>

          <div>
            <label htmlFor="maxPlayers" className="label">
              {t('campaign:maxPlayers')}
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
            <div className="label">
              {t('campaign:sessionSchedule')} <span className="text-muted font-normal">{t('campaign:optionalLower')}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-1.5">
              <div>
                <label htmlFor="sessionWeekday" className="text-xs text-muted mb-1 block">{t('campaign:day')}</label>
                <select
                  id="sessionWeekday"
                  value={sessionWeekday}
                  onChange={(e) => setSessionWeekday(e.target.value)}
                  className="input-field"
                >
                  <option value="">{t('campaign:selectDay')}</option>
                  {weekdays.map((day) => (
                    <option key={day} value={day}>{t(`campaign:${day.toLowerCase()}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sessionTime" className="text-xs text-muted mb-1 block">{t('campaign:time')}</label>
                <TimePicker
                  id="sessionTime"
                  value={sessionTime}
                  onChange={setSessionTime}
                />
              </div>
              <div>
                <div className="text-xs text-muted mb-1 block">{t('campaign:format')}</div>
                <div className="flex gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setSessionType('ONLINE')}
                    className={`tab-pill flex-1 ${sessionType === 'ONLINE' ? 'tab-pill-active' : ''}`}
                  >
                    {t('campaign:online')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionType('IN_PERSON')}
                    className={`tab-pill flex-1 ${sessionType === 'IN_PERSON' ? 'tab-pill-active' : ''}`}
                  >
                    {t('campaign:inPerson')}
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
              <span className="text-sm font-medium text-foreground">{t('campaign:publicCampaign')}</span>
              <span className="text-xs text-muted">{t('campaign:publicCampaignHelp')}</span>
            </div>
          </div>

          {/* Template selection */}
          <div className="pt-2">
            <label className="label">
              {t('campaign:characterSheetTemplate')}{' '}
              <span className="text-muted font-normal">{t('campaign:optionalLower')}</span>
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
                    {t('common:remove')}
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
                  {t('campaign:selectTemplate')}
                </button>
              )}
            </div>
            <p className="text-xs text-muted mt-1">
              {t('campaign:attachTemplateHint')}
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
              {t('common:cancel')}
            </Link>
            <button
              type="submit"
              disabled={submitting || name.trim().length === 0 || campaign.trim().length === 0}
              className="btn-primary text-sm"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  {t('campaign:creating')}
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
                  {t('campaign:createAdventure')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <TemplatePickerModal
        isOpen={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelect={(selectedId, selectedName) => {
          setTemplateId(selectedId)
          setTemplateName(selectedName)
          setShowTemplatePicker(false)
        }}
      />
    </div>
  )
}