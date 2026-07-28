'use client'

import { useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { TemplatePickerModal } from '@/components/adventure/TemplatePickerModal'

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
  adventureId: string
  originalTemplateId: string | null
  templateSnapshot: SnapshotSummary | null
  isGM: boolean
  onAttached?: () => void
  onDetached?: () => void
}

export function TemplateAttachmentPanel({
  adventureId,
  originalTemplateId,
  templateSnapshot,
  isGM,
  onAttached,
  onDetached,
}: TemplateAttachmentPanelProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [attaching, setAttaching] = useState(false)
  const [detaching, setDetaching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = useCallback(async (templateId: string, _templateName: string) => {
    setAttaching(true)
    setError(null)
    try {
      await api.post(`/adventures/${adventureId}/template/attach`, { templateId })
      setShowPicker(false)
      onAttached?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach template')
    } finally {
      setAttaching(false)
    }
  }, [adventureId, onAttached])

  const handleDetach = useCallback(async () => {
    if (!confirm('Detach the template link? The snapshot will be preserved for existing character sheets, but you won\'t be able to track the original template from this adventure.')) return

    setDetaching(true)
    setError(null)
    try {
      await api.delete(`/adventures/${adventureId}/template/detach`)
      onDetached?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detach template')
    } finally {
      setDetaching(false)
    }
  }, [adventureId, onDetached])

  const hasAttachment = originalTemplateId !== null || templateSnapshot !== null

  return (
    <div className="card !p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          <svg className="w-4 h-4 inline mr-1.5 -mt-0.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
          </svg>
          Template Attachment
        </h3>

        {isGM && (
          <div className="flex gap-2">
            {!hasAttachment ? (
              <button
                onClick={() => setShowPicker(true)}
                className="btn-primary text-xs !px-3 !py-1"
                disabled={attaching}
              >
                {attaching ? (
                  <div className="w-3 h-3 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                ) : (
                  'Attach Template'
                )}
              </button>
            ) : (
              <button
                onClick={handleDetach}
                disabled={detaching}
                className="btn-ghost text-xs !px-3 !py-1"
              >
                {detaching ? (
                  <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                ) : (
                  'Detach'
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {/* Snapshot Info */}
      {templateSnapshot ? (
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {templateSnapshot.name}
              </p>
              {templateSnapshot.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {templateSnapshot.description}
                </p>
              )}
            </div>
          </div>

          {/* Feature chips */}
          <div className="flex flex-wrap gap-1.5">
            {templateSnapshot.attributeCount > 0 && (
              <span className="badge text-[0.55rem]" style={{ background: 'rgba(124,92,231,0.12)', color: '#9070f0', border: '1px solid rgba(124,92,231,0.18)' }}>
                {templateSnapshot.attributeCount} attr
              </span>
            )}
            {templateSnapshot.skillCount > 0 && (
              <span className="badge text-[0.55rem]" style={{ background: 'rgba(201,164,75,0.12)', color: '#c9a44b', border: '1px solid rgba(201,164,75,0.18)' }}>
                {templateSnapshot.skillCount} skills
              </span>
            )}
            {templateSnapshot.fieldCount > 0 && (
              <span className="badge text-[0.55rem]" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.18)' }}>
                {templateSnapshot.fieldCount} fields
              </span>
            )}
            {templateSnapshot.profileCount > 0 && (
              <span className="badge text-[0.55rem]" style={{ background: 'rgba(236,72,153,0.12)', color: '#f472b6', border: '1px solid rgba(236,72,153,0.18)' }}>
                {templateSnapshot.profileCount} profiles
              </span>
            )}
            {templateSnapshot.resourceCount > 0 && (
              <span className="badge text-[0.55rem]" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.18)' }}>
                {templateSnapshot.resourceCount} resources
              </span>
            )}
            {templateSnapshot.acCount > 0 && (
              <span className="badge text-[0.55rem]" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.18)' }}>
                {templateSnapshot.acCount} AC
              </span>
            )}
            {templateSnapshot.sectionCount > 0 && (
              <span className="badge text-[0.55rem]" style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.18)' }}>
                {templateSnapshot.sectionCount} sections
              </span>
            )}
            {templateSnapshot.resistCount > 0 && (
              <span className="badge text-[0.55rem]" style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.18)' }}>
                {templateSnapshot.resistCount} resists
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <span className="text-[0.6rem] text-muted">
              Snapshot created {new Date(templateSnapshot.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            {originalTemplateId && (
              <span className="text-[0.6rem] text-muted">Linked to original template</span>
            )}
            {!originalTemplateId && templateSnapshot && (
              <span className="text-[0.6rem] text-muted italic">Detached (snapshot preserved)</span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-6 text-center">
          <span className="text-2xl mb-2">📋</span>
          <p className="text-sm text-muted-foreground">
            No template attached to this adventure yet.
          </p>
          {isGM && (
            <p className="text-xs text-muted mt-1">
              Attach a template to allow players to create character sheets.
            </p>
          )}
        </div>
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
    </div>
  )
}
