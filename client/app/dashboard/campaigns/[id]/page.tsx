'use client'

import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import Link from 'next/link'

interface Campaign {
  id: string
  name: string
  description: string | null
  ownerId: string
  createdAt: string
  updatedAt: string
}

export default function CampaignDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { user, loading } = useAuth()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [fetching, setFetching] = useState(true)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fetchCampaign = useCallback(async () => {
    try {
      const data = await api.get<Campaign>(`/campaigns/${id}`)
      setCampaign(data)
      setEditName(data.name)
      setEditDescription(data.description ?? '')
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
      fetchCampaign()
    }
  }, [loading, user, fetchCampaign])

  async function handleUpdate(e: FormEvent) {
    e.preventDefault()
    setEditError(null)
    setSaving(true)

    try {
      const updated = await api.patch<Campaign>(`/campaigns/${id}`, {
        name: editName.trim() || undefined,
        description: editDescription.trim() || undefined,
      })
      setCampaign(updated)
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
      await api.delete(`/campaigns/${id}`)
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
        <div className="text-sm text-gray-400">Loading...</div>
      </main>
    )
  }

  if (!campaign) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-sm text-gray-400">Campaign not found.</div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col p-4 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          &larr; Back to Dashboard
        </Link>
      </div>

      {!editing ? (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">{campaign.name}</h1>
              <p className="text-sm text-gray-500 mt-1">
                Created{' '}
                {new Date(campaign.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-red-800 px-4 py-2 text-sm text-red-400 hover:bg-red-900/30 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>

          {campaign.description ? (
            <p className="mt-6 text-gray-300 leading-relaxed whitespace-pre-wrap">
              {campaign.description}
            </p>
          ) : (
            <p className="mt-6 text-gray-500 italic">No description.</p>
          )}

          {/* Delete confirmation modal */}
          {confirmDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-sm w-full space-y-4">
                <h2 className="text-lg font-semibold">Delete Campaign</h2>
                <p className="text-sm text-gray-400">
                  Are you sure you want to delete "{campaign.name}"?
                  This action cannot be undone.
                </p>

                {deleteError && (
                  <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2 text-sm text-red-300">
                    {deleteError}
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="rounded-lg border border-gray-700 px-4 py-2 text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <form onSubmit={handleUpdate} className="space-y-4">
          <h1 className="text-2xl font-bold">Edit Campaign</h1>

          <div>
            <label htmlFor="editName" className="block text-sm font-medium">
              Name
            </label>
            <input
              id="editName"
              type="text"
              required
              maxLength={100}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor="editDescription"
              className="block text-sm font-medium"
            >
              Description <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              id="editDescription"
              maxLength={1000}
              rows={4}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {editError && (
            <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2.5 text-sm text-red-300">
              {editError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setEditError(null)
                setEditName(campaign.name)
                setEditDescription(campaign.description ?? '')
              }}
              disabled={saving}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || editName.trim().length === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </main>
  )
}