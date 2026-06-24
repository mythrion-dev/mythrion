'use client'

import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import Link from 'next/link'

interface Adventure {
  id: string
  name: string
  campaign: string
}

interface Template {
  id: string
  name: string
  description: string | null
  attributes: { id: string; key: string; name: string }[]
}

export default function NewCharacterSheetPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [adventures, setAdventures] = useState<Adventure[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedAdventureId, setSelectedAdventureId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [characterName, setCharacterName] = useState('')
  const [fetchingAdv, setFetchingAdv] = useState(true)
  const [fetchingTemplates, setFetchingTemplates] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAdventures = useCallback(async () => {
    try {
      const data = await api.get<Adventure[]>('/adventures')
      setAdventures(data)
    } catch {
      setError('Failed to load adventures')
    } finally {
      setFetchingAdv(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
      return
    }
    if (user) {
      fetchAdventures()
    }
  }, [authLoading, user, router, fetchAdventures])

  const fetchTemplates = useCallback(async (adventureId: string) => {
    setFetchingTemplates(true)
    setSelectedTemplateId('')
    try {
      const data = await api.get<Template[]>(
        `/adventures/${adventureId}/templates`,
      )
      setTemplates(data)
    } catch {
      setTemplates([])
    } finally {
      setFetchingTemplates(false)
    }
  }, [])

  useEffect(() => {
    if (selectedAdventureId) {
      fetchTemplates(selectedAdventureId)
    } else {
      setTemplates([])
    }
  }, [selectedAdventureId, fetchTemplates])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!selectedTemplateId || !characterName.trim()) return
    setCreating(true)
    try {
      const sheet = await api.post<{ id: string }>('/character-sheets', {
        characterName: characterName.trim(),
        templateId: selectedTemplateId,
      })
      router.push(`/dashboard/character-sheets/${sheet.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sheet')
      setCreating(false)
    }
  }

  if (authLoading) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </main>
    )
  }

  return (
    <main className="flex-1 max-w-xl mx-auto w-full px-4 py-6 animate-fade-in">
      <div className="mb-6">
        <Link
          href="/dashboard?tab=character-sheets"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
        >
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Character Sheets
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="card !p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">📜</span>
          <h2 className="text-xl font-semibold text-gradient">
            New Character Sheet
          </h2>
        </div>

        <div>
          <label className="label">Character Name</label>
          <input
            className="input-field"
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            placeholder="e.g. Aragorn, Geralt, Vex'ahlia"
            maxLength={100}
            required
          />
        </div>

        <div>
          <label className="label">Campaign <span className="text-muted font-normal">(optional)</span></label>
          {fetchingAdv ? (
            <div className="text-sm text-muted">Loading adventures...</div>
          ) : (
            <select
              className="input-field"
              value={selectedAdventureId}
              onChange={(e) => setSelectedAdventureId(e.target.value)}
            >
              <option value="">No campaign (standalone)</option>
              {adventures.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.campaign} — {a.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="label">Template</label>
          {!selectedAdventureId && adventures.length === 0 ? (
            <p className="text-sm text-muted italic">
              Join a campaign first to use its templates, or create a standalone character.
            </p>
          ) : fetchingTemplates ? (
            <div className="text-sm text-muted">Loading templates...</div>
          ) : templates.length === 0 && selectedAdventureId ? (
            <p className="text-sm text-muted italic">
              No templates available for this campaign. Ask your GM to create
              one.
            </p>
          ) : (
            <select
              className="input-field"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              required
            >
              <option value="">Select a template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{' '}
                  {t.description ? `— ${t.description}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedTemplateId && (
          <TemplatePreview
            template={templates.find((t) => t.id === selectedTemplateId)}
          />
        )}

        {error && (
          <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Link
            href="/dashboard?tab=character-sheets"
            className="btn-ghost"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={
              creating ||
              !characterName.trim() ||
              !selectedTemplateId
            }
            className="btn-primary"
          >
            {creating ? (
              <>
                <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              'Create Sheet'
            )}
          </button>
        </div>
      </form>
    </main>
  )
}

function TemplatePreview({ template }: { template?: Template }) {
  if (!template) return null

  return (
    <div className="rounded-lg bg-background/50 border border-border p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {template.name}
        </h3>
        {template.description && (
          <p className="text-xs text-muted mt-1">{template.description}</p>
        )}
      </div>
      <div>
        <h4 className="text-xs font-medium text-muted mb-2">Attributes</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {template.attributes.map((attr) => (
            <div
              key={attr.id}
              className="flex items-center justify-between text-xs py-1 px-2 rounded bg-background/60"
            >
              <span className="text-foreground">{attr.name}</span>

            </div>
          ))}
        </div>
      </div>
    </div>
  )
}