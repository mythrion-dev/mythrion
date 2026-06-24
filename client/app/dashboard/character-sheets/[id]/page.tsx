'use client'

import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import Link from 'next/link'

interface SheetAttribute {
  id: string
  attributeId: string
  value: string
  attribute: {
    id: string
    key: string
    name: string
    modifier: string | null
  }
}

interface CharacterSheet {
  id: string
  characterName: string
  adventure: { id: string; name: string; campaign: string }
  template: {
    id: string
    name: string
    attributes: { id: string; key: string; name: string; modifier: string | null }[]
  }
  values: SheetAttribute[]
  ownerId: string
  createdAt: string
}

export default function CharacterSheetDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { user, loading: authLoading } = useAuth()

  const [sheet, setSheet] = useState<CharacterSheet | null>(null)
  const [fetching, setFetching] = useState(true)
  const [modifierResults, setModifierResults] = useState<Record<string, number | null>>({})

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const isOwner = sheet?.ownerId === user?.id

  const fetchSheet = useCallback(async () => {
    try {
      const data = await api.get<CharacterSheet>(`/character-sheets/${id}`)
      setSheet(data)
      setEditName(data.characterName)
      // Build initial values map
      const vals: Record<string, string> = {}
      data.values.forEach((v) => {
        vals[v.attributeId] = v.value
      })
      setEditValues(vals)

      // Evaluate modifiers
      computeModifiers(data)
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 401 || statusCode === 403) {
        router.replace('/login')
      }
    } finally {
      setFetching(false)
    }
  }, [id, router])

  const computeModifiers = useCallback(async (sheetData: CharacterSheet) => {
    const results: Record<string, number | null> = {}
    const attributeValues: Record<string, number> = {}

    // Parse current values as numbers
    sheetData.values.forEach((v) => {
      const num = parseFloat(v.value)
      if (!isNaN(num)) {
        attributeValues[v.attribute.key] = num
      }
    })

    for (const attr of sheetData.template.attributes) {
      if (attr.modifier && attr.modifier.trim()) {
        try {
          const variables: Record<string, number> = {}
          // Pass all currently known numeric values
          sheetData.template.attributes.forEach((a) => {
            const val = parseFloat(
              sheetData.values.find((v) => v.attributeId === a.id)?.value || '0',
            )
            variables[a.key] = isNaN(val) ? 0 : val
          })

          const res = await api.post<{ result: number }>('/formula/evaluate', {
            formula: attr.modifier,
            variables,
          })
          results[attr.id] = res.result
        } catch {
          results[attr.id] = null
        }
      }
    }

    setModifierResults(results)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
      return
    }
    if (user) {
      fetchSheet()
    }
  }, [authLoading, user, fetchSheet])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setEditError(null)
    setSaving(true)
    try {
      const values = Object.entries(editValues).map(([attributeId, value]) => ({
        attributeId,
        value,
      }))

      const updated = await api.patch<CharacterSheet>(
        `/character-sheets/${id}`,
        {
          characterName: editName.trim() || undefined,
          values,
        },
      )
      setSheet(updated)
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
      await api.delete(`/character-sheets/${id}`)
      router.push('/dashboard?tab=character-sheets')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (authLoading || fetching) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </main>
    )
  }

  if (!sheet) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Character sheet not found.</div>
      </main>
    )
  }

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 animate-fade-in">
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

      {!editing ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="card !p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gradient truncate">
                  {sheet.characterName}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="badge badge-gold">{sheet.adventure.campaign}</span>
                  <span className="badge badge-gold">{sheet.template.name}</span>
                  <span className="text-xs text-muted">
                    Created{' '}
                    {new Date(sheet.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              {isOwner && (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setEditing(true)}
                    className="btn-ghost"
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
              )}
            </div>
            <hr className="divider" />
            <div>
              <h3 className="text-sm font-medium text-muted mb-1">Adventure</h3>
              <p className="text-foreground/80 text-sm">
                {sheet.adventure.name}
              </p>
            </div>
          </div>

          {/* Attributes */}
          <div className="card !p-6">
            <h3 className="font-semibold mb-4">Attributes</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {sheet.template.attributes.map((attr) => {
                const val = sheet.values.find(
                  (v) => v.attributeId === attr.id,
                )
                const modResult = modifierResults[attr.id]
                return (
                  <div
                    key={attr.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border"
                  >
                    <span className="text-sm text-foreground">
                      {attr.name}
                      {attr.modifier && (
                        <span className="text-[0.6rem] text-primary ml-1">mod</span>
                      )}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-foreground">
                        {val?.value || '—'}
                      </span>
                      {modResult !== undefined && modResult !== null && (
                        <span className="text-sm font-semibold text-primary">
                          ({modResult >= 0 ? '+' : ''}{modResult})
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick info */}
          <div className="text-center">
            <p className="text-xs text-muted">
              {isOwner
                ? 'You own this character sheet.'
                : 'This character sheet belongs to another player.'}
            </p>
          </div>

          {/* Delete modal */}
          {confirmDelete && (
            <DeleteModal
              name={sheet.characterName}
              error={deleteError}
              loading={deleting}
              onCancel={() => setConfirmDelete(false)}
              onConfirm={handleDelete}
            />
          )}
        </div>
      ) : (
        <EditForm
          name={editName}
          attributes={sheet.template.attributes}
          values={editValues}
          error={editError}
          saving={saving}
          onNameChange={setEditName}
          onValueChange={(attrId, val) =>
            setEditValues((prev) => ({ ...prev, [attrId]: val }))
          }
          onCancel={() => {
            setEditing(false)
            setEditError(null)
            setEditName(sheet.characterName)
            const vals: Record<string, string> = {}
            sheet.values.forEach((v) => {
              vals[v.attributeId] = v.value
            })
            setEditValues(vals)
          }}
          onSubmit={handleSave}
        />
      )}
    </main>
  )
}

/* ── Sub-components ── */

function EditForm(props: {
  name: string
  attributes: { id: string; key: string; name: string }[]
  values: Record<string, string>
  error: string | null
  saving: boolean
  onNameChange: (v: string) => void
  onValueChange: (attrId: string, v: string) => void
  onCancel: () => void
  onSubmit: (e: FormEvent) => void
}) {
  return (
    <form onSubmit={props.onSubmit} className="card !p-6 space-y-4 animate-slide-up">
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
          Edit Character Sheet
        </h2>
      </div>

      <div>
        <label className="label">Character Name</label>
        <input
          className="input-field"
          value={props.name}
          onChange={(e) => props.onNameChange(e.target.value)}
          maxLength={100}
        />
      </div>

      <div>
        <label className="label">Attributes</label>
        <div className="space-y-3 mt-1">
          {props.attributes.map((attr) => (
            <div key={attr.id}>
              <label className="text-xs text-muted flex items-center gap-1 mb-1">
                {attr.name}
              </label>
              <input
                className="input-field"
                value={props.values[attr.id] ?? ''}
                onChange={(e) => props.onValueChange(attr.id, e.target.value)}
                placeholder={`Enter ${attr.name}...`}
              />
            </div>
          ))}
        </div>
      </div>

      {props.error && (
        <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
          {props.error}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={props.onCancel}
          disabled={props.saving}
          className="btn-ghost"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={props.saving || props.name.trim().length === 0}
          className="btn-primary"
        >
          {props.saving ? (
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
  )
}

function DeleteModal({
  name,
  error,
  loading,
  onCancel,
  onConfirm,
}: {
  name: string
  error: string | null
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
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
            <h2 className="font-semibold">Delete Character Sheet</h2>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone.
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete "{name}"?
        </p>
        {error && (
          <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-ghost"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="btn-danger-solid"
          >
            {loading ? 'Deleting...' : 'Delete forever'}
          </button>
        </div>
      </div>
    </div>
  )
}