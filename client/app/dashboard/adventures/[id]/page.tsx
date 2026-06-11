'use client'

import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import Link from 'next/link'

interface Adventure {
  id: string
  name: string
  campaign: string
  synopsis: string | null
  maxPlayers: number
  ownerId: string
  createdAt: string
  updatedAt: string
}

export default function AdventureDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { user, loading } = useAuth()

  const [adventure, setAdventure] = useState<Adventure | null>(null)
  const [fetching, setFetching] = useState(true)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editCampaign, setEditCampaign] = useState('')
  const [editSynopsis, setEditSynopsis] = useState('')
  const [editMaxPlayers, setEditMaxPlayers] = useState(4)
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fetchAdventure = useCallback(async () => {
    try {
      const data = await api.get<Adventure>(`/adventures/${id}`)
      setAdventure(data)
      setEditName(data.name)
      setEditCampaign(data.campaign)
      setEditSynopsis(data.synopsis ?? '')
      setEditMaxPlayers(data.maxPlayers)
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 401 || statusCode === 403) {
        router.replace('/login')
      }
    } finally {
      setFetching(false)
    }
  }, [id, router])

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
      return
    }
    if (user) {
      fetchAdventure()
    }
  }, [loading, user, fetchAdventure])

  async function handleUpdate(e: FormEvent) {
    e.preventDefault()
    setEditError(null)
    setSaving(true)

    try {
      const updated = await api.patch<Adventure>(`/adventures/${id}`, {
        name: editName.trim() || undefined,
        campaign: editCampaign.trim() || undefined,
        synopsis: editSynopsis.trim() || undefined,
        maxPlayers: editMaxPlayers,
      })
      setAdventure(updated)
      setEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleteError(null)
    setDeleting(true)

    try {
      await api.delete(`/adventures/${id}`)
      router.push('/dashboard')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (loading || fetching) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </main>
    )
  }

  if (!adventure) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">
          Adventure not found.
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 animate-fade-in">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/dashboard"
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
          Back to Dashboard
        </Link>
      </div>

      {!editing ? (
        <div className="space-y-6">
          {/* Header card */}
          <div className="card !p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gradient truncate">
                  {adventure.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="badge badge-gold">
                    {adventure.campaign}
                  </span>
                  <span className="badge badge-gold">
                    👥 {adventure.maxPlayers}{' '}
                    {adventure.maxPlayers === 1 ? 'player' : 'players'}
                  </span>
                  <span className="text-xs text-muted">
                    Created{' '}
                    {new Date(adventure.createdAt).toLocaleDateString(
                      'en-US',
                      {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      },
                    )}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setEditing(true)} className="btn-ghost">
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
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="btn-danger"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete
                </button>
              </div>
            </div>

            <hr className="divider" />

            {adventure.synopsis ? (
              <div className="prose prose-invert max-w-none">
                <h3 className="text-sm font-medium text-muted mb-2">
                  Synopsis
                </h3>
                <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap text-sm">
                  {adventure.synopsis}
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm italic">
                No synopsis yet. Click edit to add one.
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card !p-4 text-center">
              <div className="text-xl mb-1">📜</div>
              <div className="text-xs text-muted">Quests</div>
              <div className="text-lg font-semibold text-foreground">0</div>
            </div>
            <div className="card !p-4 text-center">
              <div className="text-xl mb-1">⚔️</div>
              <div className="text-xs text-muted">Characters</div>
              <div className="text-lg font-semibold text-foreground">0</div>
            </div>
            <div className="card !p-4 text-center">
              <div className="text-xl mb-1">🗺️</div>
              <div className="text-xs text-muted">Maps</div>
              <div className="text-lg font-semibold text-foreground">0</div>
            </div>
          </div>

          {/* Delete confirmation modal */}
          {confirmDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
              <div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-danger"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-semibold">Delete Adventure</h2>
                    <p className="text-sm text-muted-foreground">
                      This action cannot be undone.
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete "{adventure.name}"?
                  All associated data will be permanently removed.
                </p>

                {deleteError && (
                  <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
                    {deleteError}
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="btn-danger-solid"
                  >
                    {deleting ? 'Deleting...' : 'Delete forever'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <form
          onSubmit={handleUpdate}
          className="card !p-6 space-y-4 animate-slide-up"
        >
          <div className="flex items-center gap-3 mb-2">
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gradient">
              Edit Adventure
            </h2>
          </div>

          <div>
            <label htmlFor="editName" className="label">
              Adventure Name
            </label>
            <input
              id="editName"
              type="text"
              required
              maxLength={100}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="input-field"
              placeholder="The Dragon's Lair"
            />
          </div>

          <div>
            <label htmlFor="editCampaign" className="label">
              Campaign
            </label>
            <input
              id="editCampaign"
              type="text"
              required
              maxLength={50}
              value={editCampaign}
              onChange={(e) => setEditCampaign(e.target.value)}
              className="input-field"
              placeholder="e.g. D&D, Tormenta"
            />
          </div>

          <div>
            <label htmlFor="editSynopsis" className="label">
              Synopsis{' '}
              <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="editSynopsis"
              maxLength={2000}
              rows={5}
              value={editSynopsis}
              onChange={(e) => setEditSynopsis(e.target.value)}
              className="input-field resize-none"
              placeholder="Briefly describe the adventure..."
            />
            <p className="text-xs text-muted mt-1.5 text-right">
              {editSynopsis.length}/2000
            </p>
          </div>

          <div>
            <label htmlFor="editMaxPlayers" className="label">
              Max Players
            </label>
            <div className="flex items-center gap-3">
              <input
                id="editMaxPlayers"
                type="range"
                min={1}
                max={5}
                value={editMaxPlayers}
                onChange={(e) => setEditMaxPlayers(Number(e.target.value))}
                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #c9a44b 0%, #c9a44b ${((editMaxPlayers - 1) / 4) * 100}%, #2a2240 ${((editMaxPlayers - 1) / 4) * 100}%, #2a2240 100%)`,
                }}
              />
              <span className="badge badge-gold min-w-[2rem] text-center">
                {editMaxPlayers}
              </span>
            </div>
          </div>

          {editError && (
            <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
              {editError}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setEditError(null)
                if (adventure) {
                  setEditName(adventure.name)
                  setEditCampaign(adventure.campaign)
                  setEditSynopsis(adventure.synopsis ?? '')
                  setEditMaxPlayers(adventure.maxPlayers)
                }
              }}
              disabled={saving}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                saving ||
                editName.trim().length === 0 ||
                editCampaign.trim().length === 0
              }
              className="btn-primary"
            >
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
      )}
    </main>
  )
}