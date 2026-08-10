'use client'

import { useState, useEffect, useCallback, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import Link from 'next/link'
import { PageNav } from '@/lib/breadcrumb'
import { Select } from '@/components/shared/Select'

// ── Types ──

interface TemplateSummary {
  id: string
  name: string
  description: string | null
  attributes: { id: string }[]
  templateSkills: { id: string }[]
}

interface Adventure {
  id: string
  name: string
  campaign: string
}

type Step = 1 | 2 | 3

export default function NewCharacterSheetPage() {
  const router = useRouter()
  const { t } = useTranslation()

  // Navigation
  const [step, setStep] = useState<Step>(1)

  // Step 1 — Character Info
  const [characterName, setCharacterName] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [level, setLevel] = useState('1')

  // Step 2 — Template Selection
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [fetchingTemplates, setFetchingTemplates] = useState(true)
  const [templateSearch, setTemplateSearch] = useState('')

  // Step 3 — Optional Campaign
  const [adventures, setAdventures] = useState<Adventure[]>([])
  const [selectedAdventureId, setSelectedAdventureId] = useState('')
  const [fetchingAdv, setFetchingAdv] = useState(true)

  // Submission
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Data fetching ──

  const fetchTemplates = useCallback(async () => {
    setFetchingTemplates(true)
    try {
      const data = await api.get<TemplateSummary[]>('/templates')
      setTemplates(data)
    } catch {
      setError(t('character:failedToLoadTemplates'))
    } finally {
      setFetchingTemplates(false)
    }
  }, [])

  const fetchAdventures = useCallback(async () => {
    setFetchingAdv(true)
    try {
      const data = await api.get<Adventure[]>('/adventures')
      setAdventures(data)
    } catch {
      // Non-critical — campaign step is optional
    } finally {
      setFetchingAdv(false)
    }
  }, [])

  // Pre-fetch templates on mount so they're ready for step 2
  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Fetch adventures when entering step 3
  useEffect(() => {
    if (step === 3) {
      fetchAdventures()
    }
  }, [step, fetchAdventures])

  // ── Template search filtering ──

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(templateSearch.toLowerCase()),
  )

  // ── Step validation ──

  const canProceedFromStep1 = characterName.trim().length > 0
  const canProceedFromStep2 = selectedTemplateId !== null

  // ── Step navigation ──

  function goToStep(target: Step) {
    setError(null)
    setStep(target)
  }

  // ── Submission ──

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (!selectedTemplateId) return

    setCreating(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {
        characterName: characterName.trim(),
        templateId: selectedTemplateId,
      }

      if (playerName.trim()) body.playerName = playerName.trim()
      if (level.trim()) body.level = Number.parseInt(level, 10)
      if (selectedAdventureId) body.adventureId = selectedAdventureId

      const sheet = await api.post<{ id: string }>('/character-sheets', body)
      router.push(`/dashboard/character-sheets/${sheet.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('character:failedToCreateSheet'))
      setCreating(false)
    }
  }

  // ── Step indicator ──

  function renderStepIndicator() {
    const steps: { num: Step; label: string }[] = [
      { num: 1, label: t('character:stepCharacter') },
      { num: 2, label: t('character:stepTemplate') },
      { num: 3, label: t('character:stepCampaign') },
    ]

    return (
      <div className="flex items-center justify-center gap-0 flex-wrap">
        {steps.map((s, i) => {
          const isActive = step === s.num
          const isPast = step > s.num
          return (
            <div key={s.num} className="flex items-center">
              <div
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-default
                  ${isActive ? 'bg-primary/15 text-primary' : ''}
                  ${isPast ? 'text-muted-foreground/60' : ''}
                  ${!isActive && !isPast ? 'text-muted-foreground/40' : ''}
                `}
              >
                <span
                  className={`
                    inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold
                    ${isActive ? 'bg-primary text-white' : ''}
                    ${isPast ? 'bg-primary/30 text-muted-foreground' : ''}
                    ${!isActive && !isPast ? 'bg-muted/20 text-muted-foreground/40' : ''}
                  `}
                >
                  {isPast ? '✓' : s.num}
                </span>
                {s.label}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`
                    w-6 h-px mx-1
                    ${isPast || (isActive && step < steps[i + 1].num) ? 'bg-primary/30' : 'bg-muted/20'}
                  `}
                />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Step 1: Character Info ──

  function renderStep1() {
    return (
      <div className="space-y-4">
        <div>
          <div className="label">{t('character:characterNameRequired')}</div>
          <input
            className="input-field"
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            placeholder={t('character:characterNamePlaceholder')}
            maxLength={100}
            required
            autoFocus
          />
        </div>

        <div>
          <div className="label">{t('character:playerNameLabel')}</div>
          <input
            className="input-field"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder={t('character:playerNamePlaceholder')}
            maxLength={100}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {t('character:playerNameHelper')}
          </p>
        </div>

        <div>
          <div className="label">{t('character:levelLabel')}</div>
          <input
            type="number"
            className="input-field w-24"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            min={1}
            max={99}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {t('character:levelHelper')}
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Link href="/dashboard?tab=character-sheets" className="btn-ghost">
            {t('common:cancel')}
          </Link>
          <button
            type="button"
            disabled={!canProceedFromStep1}
            onClick={() => goToStep(2)}
            className="btn-primary"
          >
            {t('common:next')}
          </button>
        </div>
      </div>
    )
  }

  // ── Step 2: Template Selection ──

  function renderStep2() {
    return (
      <div className="space-y-4">
        <div>
          <div className="label">{t('character:searchTemplates')}</div>
          <input
            className="input-field"
            value={templateSearch}
            onChange={(e) => setTemplateSearch(e.target.value)}
            placeholder={t('character:filterByNamePlaceholder')}
            autoFocus
          />
        </div>

        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {fetchingTemplates && (
            <div className="grid grid-cols-1 gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-20 w-full rounded-lg" />
              ))}
            </div>
          )}
          {!fetchingTemplates && filteredTemplates.length === 0 && (
            <div className="flex flex-col items-center py-8 text-center space-y-2">
              <svg
                className="w-10 h-10 text-muted/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-sm text-muted-foreground">
                {templateSearch
                  ? t('character:noTemplatesMatchSearch')
                  : t('character:noTemplatesFound')}
              </p>
              {!templateSearch && (
                <Link
                  href="/dashboard/templates/new"
                  className="text-sm text-primary hover:underline"
                >
                  {t('character:createATemplate')}
                </Link>
              )}
            </div>
          )}
          {!fetchingTemplates && filteredTemplates.length > 0 && filteredTemplates.map((tmpl) => {
              const isSelected = selectedTemplateId === tmpl.id
              const attrCount = tmpl.attributes?.length ?? 0
              const skillCount = tmpl.templateSkills?.length ?? 0
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(tmpl.id)}
                  className={`
                    w-full text-left p-3 rounded-lg border transition-colors
                    ${
                      isSelected
                        ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border/40 bg-surface hover:border-border/80 hover:bg-surface/80'
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {tmpl.name}
                        </span>
                        {isSelected && (
                          <svg
                            className="w-4 h-4 text-primary shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      {tmpl.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {tmpl.description}
                        </p>
                      )}
                    </div>
                    {(attrCount > 0 || skillCount > 0) && (
                      <div className="flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
                        {attrCount > 0 && <span>{t('character:attrCount', { count: attrCount })}</span>}
                        {skillCount > 0 && <span>{t('character:skillCount', { count: skillCount })}</span>}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={() => goToStep(1)} className="btn-ghost">
            {t('common:back')}
          </button>
          <button
            type="button"
            disabled={!canProceedFromStep2}
            onClick={() => goToStep(3)}
            className="btn-primary"
          >
            {t('common:next')}
          </button>
        </div>
      </div>
    )
  }

  // ── Step 3: Campaign Selection + Submit ──

  function renderStep3() {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="label">{t('character:campaignOptional')}</div>
          {fetchingAdv ? (
            <div className="skeleton h-10 w-full rounded-lg" />
          ) : (
            <Select
              options={[
                { id: '', label: t('character:standaloneCharacter') },
                ...adventures.map((a) => ({
                  id: a.id,
                  label: `${a.campaign} — ${a.name}`,
                })),
              ]}
              value={selectedAdventureId}
              onChange={(val) => setSelectedAdventureId(val)}
              className="text-sm"
            />
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {t('character:campaignHelper')}
          </p>
        </div>

        {/* Selected template summary */}
        {selectedTemplateId &&
          (() => {
            const t = templates.find((t) => t.id === selectedTemplateId)
            return t ? (
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-secondary/40 border border-border/40 text-sm text-foreground">
                <svg
                  className="w-4 h-4 text-primary shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="font-medium">{t.name}</span>
              </div>
            ) : null
          })()}

        {error && (
          <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={() => goToStep(2)} className="btn-ghost">
            {t('common:back')}
          </button>
          <button
            type="submit"
            disabled={creating || !selectedTemplateId}
            className="btn-primary"
          >
            {creating ? (
              <>
                <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                {t('character:creating')}
              </>
            ) : (
              t('character:createSheet')
            )}
          </button>
        </div>
      </form>
    )
  }

  // ── Main render ──

  return (
    <div className="flex items-center justify-center relative">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-b from-accent/5 via-primary/3 to-transparent blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl space-y-6 animate-slide-up relative z-10">
        <PageNav
          crumbs={[
            { label: t('common:dashboard'), href: '/dashboard' },
            { label: t('character:newCharacterSheet') },
          ]}
        />

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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gradient">
              {t('character:newCharacterSheet')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {step === 1 && t('character:step1Helper')}
              {step === 2 && t('character:step2Helper')}
              {step === 3 &&
                (selectedAdventureId
                  ? t('character:step3HelperLinked')
                  : t('character:step3Helper'))}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="card !p-3">{renderStepIndicator()}</div>

        {/* Step content */}
        <div className="card !p-6">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>
      </div>
    </div>
  )
}
