'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'

interface TemplateSummary {
  id: string
  name: string
  description: string | null
  campaign: string | null
  useCount: number
  _count?: {
    attributes: number
    templateSkills: number
  }
}

interface CommunityTemplate {
  id: string
  name: string
  description: string | null
  campaign: string | null
  creator?: { displayName: string | null }
  copyCount?: number
}

interface TemplatePickerModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onSelect: (templateId: string, templateName: string) => void
  readonly adventureId?: string
}

export function TemplatePickerModal({
  isOpen,
  onClose,
  onSelect,
  adventureId,
}: Readonly<TemplatePickerModalProps>) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'my-templates' | 'community'>('my-templates')
  const [search, setSearch] = useState('')

  // My templates
  const [myTemplates, setMyTemplates] = useState<TemplateSummary[]>([])
  const [fetchingMine, setFetchingMine] = useState(false)
  const [mineError, setMineError] = useState<string | null>(null)

  // Community templates
  const [community, setCommunity] = useState<CommunityTemplate[]>([])
  const [fetchingCommunity, setFetchingCommunity] = useState(false)
  const [communityError, setCommunityError] = useState<string | null>(null)

  // Selection
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)

  const fetchMyTemplates = useCallback(async () => {
    setFetchingMine(true)
    setMineError(null)
    try {
      const data = await api.get<TemplateSummary[]>('/templates')
      setMyTemplates(data)
    } catch (err) {
      setMineError(err instanceof Error ? err.message : t('campaign:failedToLoadTemplates'))
    } finally {
      setFetchingMine(false)
    }
  }, [])

  const fetchCommunityTemplates = useCallback(async () => {
    setFetchingCommunity(true)
    setCommunityError(null)
    try {
      const data = await api.get<{ data: CommunityTemplate[] }>('/public/templates')
      setCommunity(data.data ?? data)
    } catch (err) {
      setCommunityError(err instanceof Error ? err.message : t('campaign:failedToLoadCommunityTemplates'))
    } finally {
      setFetchingCommunity(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setSelectedId(null)
    setConfirming(false)
    setSearch('')
    setTab('my-templates')
    fetchMyTemplates()
    // Focus search input after modal mounts
    setTimeout(() => searchInputRef.current?.focus(), 100)
  }, [isOpen, fetchMyTemplates])

  const handleTabChange = (newTab: 'my-templates' | 'community') => {
    setTab(newTab)
    setSearch('')
    setSelectedId(null)
    if (newTab === 'community' && community.length === 0) {
      fetchCommunityTemplates()
    }
  }

  const handleConfirm = () => {
    if (!selectedId) return
    const selectedName =
      tab === 'my-templates'
        ? myTemplates.find(t => t.id === selectedId)?.name ?? ''
        : community.find(t => t.id === selectedId)?.name ?? ''
    setConfirming(true)
    onSelect(selectedId, selectedName)
  }

  // ── Filtered lists ──

  const filteredMine = myTemplates.filter(t =>
    !search ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.campaign ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  const filteredCommunity = community.filter(t =>
    !search ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.campaign ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="card !p-0 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-foreground">
              {t('campaign:selectTemplate')}
            </h3>
            <button onClick={onClose} className="btn-ghost text-xs !px-2 !py-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field !pl-9"
              placeholder={t('campaign:searchTemplatesPlaceholder')}
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            <button
              onClick={() => handleTabChange('my-templates')}
              className={`tab-pill text-xs ${tab === 'my-templates' ? 'tab-pill-active' : ''}`}
            >
              {t('campaign:myTemplates')}
              {!fetchingMine && myTemplates.length > 0 && (
                <span className="badge badge-gold ml-1 text-[0.5rem]">{myTemplates.length}</span>
              )}
            </button>
            <button
              onClick={() => handleTabChange('community')}
              className={`tab-pill text-xs ${tab === 'community' ? 'tab-pill-active' : ''}`}
            >
              {t('campaign:community')}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {tab === 'my-templates' && (
            <>
              {fetchingMine && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              )}
              {mineError && !fetchingMine && (
                <div className="flex flex-col items-center py-6 space-y-2">
                  <p className="text-xs text-red-400">{mineError}</p>
                  <button onClick={fetchMyTemplates} className="btn-ghost text-xs">
                    {t('campaign:retry')}
                  </button>
                </div>
              )}
              {!fetchingMine && !mineError && filteredMine.length === 0 && (
                <div className="flex flex-col items-center py-8 text-center">
                  <span className="text-2xl mb-2">📄</span>
                  <p className="text-sm text-muted-foreground">
                    {search ? t('campaign:noTemplatesMatchSearch') : t('campaign:noTemplatesYet')}
                  </p>
                  {!search && (
                    <p className="text-xs text-muted mt-1">
                      {t('campaign:createTemplatesInLibraryFirst')}
                    </p>
                  )}
                </div>
              )}
              {!fetchingMine && !mineError && filteredMine.map(t => (
                <TemplatePickerRow
                  key={t.id}
                  name={t.name}
                  description={t.description}
                  campaign={t.campaign}
                  useCount={t.useCount}
                  attrCount={t._count?.attributes ?? 0}
                  skillCount={t._count?.templateSkills ?? 0}
                  selected={selectedId === t.id}
                  onSelect={() => setSelectedId(t.id)}
                />
              ))}
            </>
          )}

          {tab === 'community' && (
            <>
              {fetchingCommunity && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              )}
              {communityError && !fetchingCommunity && (
                <div className="flex flex-col items-center py-6 space-y-2">
                  <p className="text-xs text-red-400">{communityError}</p>
                  <button onClick={fetchCommunityTemplates} className="btn-ghost text-xs">
                    {t('campaign:retry')}
                  </button>
                </div>
              )}
              {!fetchingCommunity && !communityError && filteredCommunity.length === 0 && (
                <div className="flex flex-col items-center py-8 text-center">
                  <span className="text-2xl mb-2">🌐</span>
                  <p className="text-sm text-muted-foreground">
                    {search ? t('campaign:noCommunityTemplatesMatchSearch') : t('campaign:noCommunityTemplatesAvailable')}
                  </p>
                </div>
              )}
              {!fetchingCommunity && !communityError && filteredCommunity.map(t => (
                <TemplatePickerRow
                  key={t.id}
                  name={t.name}
                  description={t.description}
                  campaign={t.campaign}
                  useCount={t.copyCount ?? 0}
                  creatorName={t.creator?.displayName ?? undefined}
                  selected={selectedId === t.id}
                  onSelect={() => setSelectedId(t.id)}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <button onClick={onClose} className="btn-ghost text-sm">
            {t('common:cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId || confirming}
            className="btn-primary text-sm"
          >
            {confirming ? (
              <>
                <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                {t('campaign:attaching')}
              </>
            ) : (
              t('campaign:attachTemplate')
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Picker row ── */

interface TemplatePickerRowProps {
  readonly name: string
  readonly description: string | null
  readonly campaign: string | null
  readonly useCount?: number
  readonly attrCount?: number
  readonly skillCount?: number
  readonly creatorName?: string
  readonly selected: boolean
  readonly onSelect: () => void
}

function TemplatePickerRow(props: Readonly<TemplatePickerRowProps>) {
  const { t } = useTranslation()
  return (
    <button
      onClick={props.onSelect}
      className={`w-full text-left p-3 rounded-lg transition-colors border mb-1 ${
        props.selected
          ? 'border-accent bg-accent/5'
          : 'border-transparent hover:bg-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className={`text-sm font-medium truncate ${props.selected ? 'text-accent' : 'text-foreground'}`}>
          {props.name}
        </span>
        {props.campaign && (
          <span className="shrink-0 badge badge-gold text-[0.5rem]">
            {props.campaign}
          </span>
        )}
      </div>

      {props.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
          {props.description}
        </p>
      )}

      <div className="flex items-center gap-2 text-[0.6rem] text-muted">
        {props.attrCount !== undefined && props.attrCount > 0 && (
          <span>{t('campaign:attrCount', { count: props.attrCount })}</span>
        )}
        {props.skillCount !== undefined && props.skillCount > 0 && (
          <span>{t('campaign:skillCount', { count: props.skillCount })}</span>
        )}
        {props.useCount !== undefined && props.useCount > 0 && (
          <span>{t('campaign:usedX', { count: props.useCount })}</span>
        )}
        {props.creatorName && (
          <span className="truncate max-w-[100px]">{t('campaign:byCreator', { name: props.creatorName })}</span>
        )}
      </div>
    </button>
  )
}
