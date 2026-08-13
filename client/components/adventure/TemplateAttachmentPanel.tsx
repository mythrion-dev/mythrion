'use client'

import { useState, useCallback, useEffect, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { TemplatePickerModal } from '@/components/adventure/TemplatePickerModal'
import { ConfirmDetachModal } from '@/components/adventure/ConfirmDetachModal'

interface SnapshotSummary {
  name: string
  description: string | null
  createdAt: string
  attributeCount: number
  skillCount: number
  fieldCount: number
  profileCount: number
  resourceCount: number
  acCount: number
  resistCount: number
  sectionCount: number
}

interface TemplateAttachmentPanelProps {
  readonly adventureId: string
  readonly originalTemplateId: string | null
  readonly templateSnapshot: SnapshotSummary | null
  readonly isGM: boolean
  readonly readOnly?: boolean
  readonly onAttached?: () => void
  readonly onDetached?: () => void
}

type SnapshotCountKey =
  | 'attributeCount'
  | 'skillCount'
  | 'fieldCount'
  | 'profileCount'
  | 'resourceCount'
  | 'acCount'
  | 'sectionCount'
  | 'resistCount'

const SNAPSHOT_CHIPS: ReadonlyArray<{ key: SnapshotCountKey; i18nKey: string; style: CSSProperties }> = [
  { key: 'attributeCount', i18nKey: 'campaign:attrCount', style: { background: 'rgba(124,92,231,0.12)', color: '#9070f0', border: '1px solid rgba(124,92,231,0.18)' } },
  { key: 'skillCount', i18nKey: 'campaign:skillCount', style: { background: 'rgba(201,164,75,0.12)', color: '#c9a44b', border: '1px solid rgba(201,164,75,0.18)' } },
  { key: 'fieldCount', i18nKey: 'campaign:fieldCount', style: { background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.18)' } },
  { key: 'profileCount', i18nKey: 'campaign:profileCount', style: { background: 'rgba(236,72,153,0.12)', color: '#f472b6', border: '1px solid rgba(236,72,153,0.18)' } },
  { key: 'resourceCount', i18nKey: 'campaign:resourceCount', style: { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.18)' } },
  { key: 'acCount', i18nKey: 'campaign:acCount', style: { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.18)' } },
  { key: 'sectionCount', i18nKey: 'campaign:sectionCount', style: { background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.18)' } },
  { key: 'resistCount', i18nKey: 'campaign:resistCount', style: { background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.18)' } },
]

function SnapshotChips({ snapshot }: { readonly snapshot: SnapshotSummary }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-1.5">
      {SNAPSHOT_CHIPS.filter(chip => snapshot[chip.key] > 0).map(chip => (
        <span key={chip.key} className="badge text-[0.55rem]" style={chip.style}>
          {t(chip.i18nKey, { count: snapshot[chip.key] })}
        </span>
      ))}
    </div>
  )
}

function SnapshotInfo({
  snapshot,
  originalTemplateId,
}: {
  readonly snapshot: SnapshotSummary
  readonly originalTemplateId: string | null
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{snapshot.name}</p>
          {snapshot.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{snapshot.description}</p>
          )}
        </div>
      </div>

      <SnapshotChips snapshot={snapshot} />

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <span className="text-[0.6rem] text-muted">
          {t('campaign:snapshotCreated', { date: new Date(snapshot.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }) })}
        </span>
        {originalTemplateId && (
          <span className="text-[0.6rem] text-muted">{t('campaign:linkedToOriginalTemplate')}</span>
        )}
        {!originalTemplateId && (
          <span className="text-[0.6rem] text-muted italic">{t('campaign:detachedSnapshotPreserved')}</span>
        )}
      </div>
    </div>
  )
}

function SnapshotEmptyState({ isGM }: { readonly isGM: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <span className="text-2xl mb-2">📋</span>
      <p className="text-sm text-muted-foreground">
        {t('campaign:noTemplateAttachedYet')}
      </p>
      {isGM && (
        <p className="text-xs text-muted mt-1">
          {t('campaign:attachTemplateToAllowPlayers')}
        </p>
      )}
    </div>
  )
}

function GmActionButton({
  readOnly,
  onClick,
  disabled,
  className,
  children,
}: {
  readonly readOnly?: boolean
  readonly onClick?: () => void
  readonly disabled?: boolean
  readonly className: string
  readonly children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <button
      onClick={readOnly ? undefined : onClick}
      disabled={disabled || readOnly}
      title={readOnly ? t('campaign:readOnlyTooltip') : undefined}
      className={`${className} ${readOnly ? '!opacity-50 !cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  )
}

const attachSpinner = (
  <div className="w-3 h-3 border-2 border-background/30 border-t-background rounded-full animate-spin" />
)
const detachSpinner = (
  <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
)

function AttachmentActions({
  hasAttachment,
  attaching,
  detaching,
  readOnly,
  onAttach,
  onDetach,
}: {
  readonly hasAttachment: boolean
  readonly attaching: boolean
  readonly detaching: boolean
  readonly readOnly?: boolean
  readonly onAttach: () => void
  readonly onDetach: () => void
}) {
  const { t } = useTranslation()
  if (hasAttachment) {
    return (
      <div className="flex gap-2">
        <GmActionButton readOnly={readOnly} onClick={onAttach} className="btn-secondary text-xs !px-3 !py-1">
          {t('campaign:replace')}
        </GmActionButton>
        <GmActionButton readOnly={readOnly} onClick={onDetach} disabled={detaching} className="btn-ghost text-xs !px-3 !py-1">
          {detaching ? detachSpinner : t('campaign:detach')}
        </GmActionButton>
      </div>
    )
  }
  return (
    <div className="flex gap-2">
      <GmActionButton readOnly={readOnly} onClick={onAttach} disabled={attaching} className="btn-primary text-xs !px-3 !py-1">
        {attaching ? attachSpinner : t('campaign:attachTemplate')}
      </GmActionButton>
    </div>
  )
}

export function TemplateAttachmentPanel({
  adventureId,
  originalTemplateId,
  templateSnapshot,
  isGM,
  readOnly,
  onAttached,
  onDetached,
}: TemplateAttachmentPanelProps) {
  const { t } = useTranslation()
  const [showPicker, setShowPicker] = useState(false)
  const [attaching, setAttaching] = useState(false)
  const [showConfirmDetach, setShowConfirmDetach] = useState(false)
  const [detaching, setDetaching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detachSuccess, setDetachSuccess] = useState(false)

  const hasAttachment = originalTemplateId !== null || templateSnapshot !== null

  const handleSelect = useCallback(async (templateId: string, _templateName: string) => {
    setAttaching(true)
    setError(null)
    try {
      if (hasAttachment) {
        await api.post(`/adventures/${adventureId}/template/replace`, { templateId })
      } else {
        await api.post(`/adventures/${adventureId}/template/attach`, { templateId })
      }
      setShowPicker(false)
      onAttached?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('campaign:failedToAttachTemplate'))
    } finally {
      setAttaching(false)
    }
  }, [adventureId, onAttached, hasAttachment])

  const handleDetach = useCallback(() => {
    setError(null)
    setShowConfirmDetach(true)
  }, [])

  const handleConfirmDetach = useCallback(async () => {
    setDetaching(true)
    setError(null)
    try {
      await api.delete(`/adventures/${adventureId}/template/detach`)
      setShowConfirmDetach(false)
      setDetachSuccess(true)
      onDetached?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('campaign:failedToDetachTemplate'))
    } finally {
      setDetaching(false)
    }
  }, [adventureId, onDetached])

  // Auto-clear success message after 4 seconds
  useEffect(() => {
    if (!detachSuccess) return
    const timer = setTimeout(() => setDetachSuccess(false), 4000)
    return () => clearTimeout(timer)
  }, [detachSuccess])

  return (
    <div className="card !p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          <svg className="w-4 h-4 inline mr-1.5 -mt-0.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
          </svg>
          {t('campaign:templateAttachment')}
        </h3>

        {isGM && (
          <AttachmentActions
            hasAttachment={hasAttachment}
            attaching={attaching}
            detaching={detaching}
            readOnly={readOnly}
            onAttach={() => setShowPicker(true)}
            onDetach={handleDetach}
          />
        )}
      </div>

      {detachSuccess && (
        <div className="mb-3 rounded-lg bg-success-muted border border-success/30 px-3 py-2 text-xs text-success">
          {t('campaign:detachedSuccessfully')}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {/* Snapshot Info */}
      {templateSnapshot ? (
        <SnapshotInfo snapshot={templateSnapshot} originalTemplateId={originalTemplateId} />
      ) : (
        <SnapshotEmptyState isGM={isGM} />
      )}

      {/* Picker Modal */}
      {isGM && (
        <TemplatePickerModal
          isOpen={showPicker}
          onClose={() => { setShowPicker(false); setError(null) }}
          onSelect={handleSelect}
          adventureId={adventureId}
        />
      )}

      {/* Confirm Detach Modal */}
      {showConfirmDetach && (
        <ConfirmDetachModal
          loading={detaching}
          error={error}
          onCancel={() => { setShowConfirmDetach(false); setError(null) }}
          onConfirm={handleConfirmDetach}
        />
      )}
    </div>
  )
}
