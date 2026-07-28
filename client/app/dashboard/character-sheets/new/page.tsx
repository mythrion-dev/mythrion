'use client'

import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import Link from 'next/link'
import { PageNav } from '@/lib/breadcrumb'
import { Select } from '@/components/shared/Select'

interface Adventure {
  id: string
  name: string
  campaign: string
}

export default function NewCharacterSheetPage() {
  const router = useRouter()

  const [adventures, setAdventures] = useState<Adventure[]>([])
  const [selectedAdventureId, setSelectedAdventureId] = useState('')
  const [snapshotName, setSnapshotName] = useState<string | null>(null)
  const [snapshotFetching, setSnapshotFetching] = useState(false)
  const [characterName, setCharacterName] = useState('')
  const [fetchingAdv, setFetchingAdv] = useState(true)
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
    fetchAdventures()
  }, [fetchAdventures])

  const fetchSnapshot = useCallback(async (adventureId: string) => {
    setSnapshotFetching(true)
    setSnapshotName(null)
    try {
      const data = await api.get<{ snapshot: { name: string } | null }>(
        `/adventures/${adventureId}/template/snapshot`,
      )
      setSnapshotName(data.snapshot?.name ?? null)
    } catch {
      setSnapshotName(null)
    } finally {
      setSnapshotFetching(false)
    }
  }, [])

  useEffect(() => {
    if (selectedAdventureId) {
      fetchSnapshot(selectedAdventureId)
    } else {
      setSnapshotName(null)
    }
  }, [selectedAdventureId, fetchSnapshot])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!selectedAdventureId || !characterName.trim()) return
    setCreating(true)
    try {
      const sheet = await api.post<{ id: string }>('/character-sheets/from-campaign', {
        characterName: characterName.trim(),
        adventureId: selectedAdventureId,
      })
      router.push(`/dashboard/character-sheets/${sheet.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sheet')
      setCreating(false)
    }
  }

  return (
    <div className="flex items-center justify-center relative">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-b from-accent/5 via-primary/3 to-transparent blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl space-y-6 animate-slide-up relative z-10">
        <PageNav crumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'New Character Sheet' },
        ]} />

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-surface border border-border">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gradient">
              New Character Sheet
            </h1>
            <p className="text-sm text-muted-foreground">
              Create a character for a campaign
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card !p-6 space-y-4">
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
            <label className="label">Campaign</label>
            {fetchingAdv ? (
              <div className="skeleton h-10 w-full rounded-lg" />
            ) : (
              <Select
                options={[
                  { id: '', label: 'Select a campaign...' },
                  ...adventures.map(a => ({ id: a.id, label: `${a.campaign} — ${a.name}` })),
                ]}
                value={selectedAdventureId}
                onChange={(val) => setSelectedAdventureId(val)}
                className="text-sm"
              />
            )}
          </div>

          <div>
            <label className="label">Template</label>
            {!selectedAdventureId ? (
              <div className="flex flex-col items-center py-6 text-center space-y-2">
                <svg className="w-8 h-8 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-muted-foreground">Select a campaign first.</p>
              </div>
            ) : snapshotFetching ? (
              <div className="skeleton h-10 w-full rounded-lg" />
            ) : snapshotName ? (
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-secondary/40 border border-border/40 text-sm text-foreground">
                <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{snapshotName}</span>
              </div>
            ) : (
              <p className="text-sm text-muted italic">
                No template is attached to this campaign. Ask the GM to attach one before creating a character.
              </p>
            )}
          </div>

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
                !selectedAdventureId ||
                !snapshotName
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
      </div>
    </div>
  )
}
