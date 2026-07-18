'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { api } from '@/lib/api'
import type { ProfessionalSkill } from './types'

// ── Props ──

interface Props {
  sheetId: string
  isOwner: boolean
  modifierResults: Record<string, number | null>
  templateAttributes: { id: string; key: string; name: string }[]
}

// ── Component ──

export function ProfessionalSkillsSection({
  sheetId,
  isOwner,
  modifierResults,
  templateAttributes,
}: Props) {
  const [skills, setSkills] = useState<ProfessionalSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createAttributeId, setCreateAttributeId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAttributeId, setEditAttributeId] = useState('')

  // ── Fetch skills on mount ──

  useEffect(() => {
    fetchSkills()
  }, [sheetId])

  async function fetchSkills() {
    setLoading(true)
    try {
      const data = await api.get<ProfessionalSkill[]>(`/character-sheets/${sheetId}/professional-skills`)
      setSkills(data)
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }

  // ── Create ──

  function openCreate() {
    setCreateName('')
    setCreateAttributeId('')
    setError(null)
    setShowCreateModal(true)
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!createName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const skill = await api.post<ProfessionalSkill>(`/character-sheets/${sheetId}/professional-skills`, {
        name: createName.trim(),
        attributeId: createAttributeId || null,
      })
      setSkills(p => [...p, skill])
      setShowCreateModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setSaving(false)
    }
  }

  // ── Update ──

  function startEdit(skill: ProfessionalSkill) {
    setEditingId(skill.id)
    setEditName(skill.name)
    setEditAttributeId(skill.attributeId ?? '')
    setError(null)
  }

  async function handleUpdate(skillId: string) {
    if (!editName.trim()) return
    setError(null)
    try {
      const updated = await api.patch<ProfessionalSkill>(`/character-sheets/${sheetId}/professional-skills/${skillId}`, {
        name: editName.trim(),
        attributeId: editAttributeId || null,
      })
      setSkills(p => p.map(s => s.id === skillId ? updated : s))
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  function cancelEdit() {
    setEditingId(null)
    setError(null)
  }

  // ── Delete ──

  async function handleDelete(skillId: string) {
    try {
      await api.delete(`/character-sheets/${sheetId}/professional-skills/${skillId}`)
      setSkills(p => p.filter(s => s.id !== skillId))
    } catch {
      // silent fail
    }
  }

  // ── Derive total from modifierResults ──

  function getTotal(skill: ProfessionalSkill): number | null {
    if (!skill.attributeId) return null
    // Try attribute key first, then fallback to attributeId
    return modifierResults[skill.attribute?.key ?? ''] ?? modifierResults[skill.attributeId] ?? null
  }

  // ── Render ──

  return (
    <div className="card !p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Professional Skills</h3>
          <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary/10 border border-primary/20 text-[0.65rem] font-medium text-primary">
            {skills.length}
          </span>
        </div>
        {isOwner && (
          <button onClick={openCreate} className="btn-primary text-sm">
            + Add Professional Skill
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted italic">Loading...</p>
      ) : skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
          <svg className="w-10 h-10 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <div>
            <p className="text-sm text-muted font-medium">No Professional Skills added yet.</p>
            <p className="text-xs text-muted/60 mt-0.5">Click &apos;+ Add Professional Skill&apos; to create one.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted uppercase tracking-wider">
                <th className="py-2 pr-2 font-medium">Profession</th>
                <th className="py-2 pr-2 font-medium">Attribute</th>
                <th className="py-2 pr-2 font-medium text-right">Total</th>
                <th className="py-2 pr-2 font-medium text-right">Modifier</th>
                {isOwner && <th className="py-2 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {skills.map(skill => {
                const total = getTotal(skill)
                const isEditing = editingId === skill.id
                return (
                  <tr key={skill.id} className="border-b border-border/50">
                    {isEditing ? (
                      <>
                        <td className="py-2 pr-2">
                          <input
                            className="input-field text-sm w-full"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            maxLength={100}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            className="input-field text-sm w-full"
                            value={editAttributeId}
                            onChange={e => setEditAttributeId(e.target.value)}
                          >
                            <option value="">None</option>
                            {templateAttributes.map(attr => (
                              <option key={attr.id} value={attr.id}>{attr.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2 text-right">{total !== null ? total : '—'}</td>
                        <td className="py-2 pr-2 text-right text-muted">
                          {(skill.attributeId && total !== null)
                            ? (total >= 0 ? `+${total}` : total)
                            : '—'}
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => handleUpdate(skill.id)}
                              className="text-xs text-primary hover:text-primary/80 px-2 py-1 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-xs text-muted hover:text-foreground px-2 py-1 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 pr-2 font-medium">{skill.name}</td>
                        <td className="py-2 pr-2 text-muted">{skill.attribute?.name ?? '—'}</td>
                        <td className="py-2 pr-2 text-right font-semibold">
                          {total !== null ? total : '—'}
                        </td>
                        <td className="py-2 pr-2 text-right text-muted">
                          {(skill.attributeId && total !== null)
                            ? (total >= 0 ? `+${total}` : total)
                            : '—'}
                        </td>
                        {isOwner && (
                          <td className="py-2 text-right">
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => startEdit(skill)}
                                className="text-xs text-primary hover:text-primary/80 px-2 py-1 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(skill.id)}
                                className="text-xs text-danger hover:text-danger/80 px-2 py-1 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form
            onSubmit={handleCreate}
            className="bg-card border border-border rounded-xl shadow-xl p-6 w-full max-w-md space-y-4"
          >
            <h4 className="text-sm font-semibold">Add Professional Skill</h4>

            <div>
              <label className="label">Profession Name</label>
              <input
                className="input-field"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="e.g. Blacksmith"
                maxLength={100}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="label">Attribute</label>
              <select
                className="input-field"
                value={createAttributeId}
                onChange={e => setCreateAttributeId(e.target.value)}
              >
                <option value="">None</option>
                {templateAttributes.map(attr => (
                  <option key={attr.id} value={attr.id}>{attr.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={saving}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !createName.trim()}
                className="btn-primary text-sm"
              >
                {saving ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Helper text ── */}
      {skills.length > 0 && (
        <p className="text-xs text-muted mt-3">
          Modifiers are computed from the selected attribute using the template&apos;s formula engine. Add your profession skills. Choose which attribute will be used for each one. All calculations follow the rules defined by the GM.
        </p>
      )}
    </div>
  )
}
