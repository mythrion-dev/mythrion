'use client'

import { useState, useEffect, useMemo, type SubmitEvent } from 'react'
import { api } from '@/lib/api'
import { Select } from '@/components/shared/Select'
import type { ProfessionalSkill, SkillModifierProfile, SheetPermissions } from './types'

// ── Props ──

interface Props {
  sheetId: string
  permissions: SheetPermissions
  modifierResults: Record<string, number | null>
  templateAttributes: { id: string; key: string; name: string }[]
  allProfiles: SkillModifierProfile[]
  /** When true, all CRUD operations operate on localSkills state instead of API calls. */
  localMode?: boolean
  /** Skills state used in localMode (required when localMode is true). */
  localSkills?: ProfessionalSkill[]
  /** Called when skills change in localMode. */
  onLocalSkillsChange?: (skills: ProfessionalSkill[]) => void
}

// ── Helpers ──

interface SkillResult {
  total: number | null
  modSum: number
}

/**
 * Compute professional skill totals and MOD (profile) contribution.
 * Mirrors the profile iteration logic from page.tsx computeSkills() (lines 406-414):
 * iterate all template profiles, look up option values via profileValues[],
 * then total = attributeModifier + sum(profileOptionValues).
 */
function computeSkillResults(
  skills: ProfessionalSkill[],
  modifierResults: Record<string, number | null>,
): Record<string, SkillResult> {
  const r: Record<string, SkillResult> = {}
  for (const skill of skills) {
    let total: number | null = null
    let modSum = 0

    // Attribute modifier contribution
    // Use attribute ID to look up modifierResults (which is keyed by template attribute ID)
    const attributeId = skill.attribute?.id ?? skill.attributeId
    if (attributeId) {
      const mod = modifierResults[attributeId] ?? null
      if (mod !== null) total = (total ?? 0) + mod
    }

    // Profile option values contribution
    for (const pv of skill.profileValues ?? []) {
      if (pv.option?.value) {
        total = (total ?? 0) + pv.option.value
        modSum += pv.option.value
      }
    }

    r[skill.id] = { total, modSum }
  }
  return r
}

// ── Component ──

export function ProfessionalSkillsSection({
  sheetId,
  permissions,
  modifierResults,
  templateAttributes,
  allProfiles,
  localMode = false,
  localSkills,
  onLocalSkillsChange,
}: Props) {
  const canEdit = permissions.canEditProfessionalSkills
  const [skills, setSkills] = useState<ProfessionalSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createAttributeId, setCreateAttributeId] = useState('')
  const [createProfileSelections, setCreateProfileSelections] = useState<Record<string, string | null>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAttributeId, setEditAttributeId] = useState('')

  // ── Fetch skills on mount ──

  useEffect(() => {
    if (localMode) {
      setSkills(localSkills ?? [])
      setLoading(false)
      return
    }
    fetchSkills()
  }, [sheetId, localMode, localSkills])

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

  // ── Computed results ──
  // Recalculate whenever skills or modifierResults change (mirrors computeSkills pattern)

  const results = useMemo(
    () => computeSkillResults(skills, modifierResults),
    [skills, modifierResults],
  )

  // ── Profile change handler ──
  // Optimistic update matching handleProfileChange() pattern from page.tsx (lines 556-565).
  // Immediately updates local skill data, then persists to the server.
  // On failure, refetches skills to restore server state.

  async function handleProfileChange(skillId: string, profileId: string, optionId: string | null) {
    if (localMode) {
      const updated = skills.map(s => {
        if (s.id !== skillId) return s
        const existing = s.profileValues ?? []
        const idx = existing.findIndex(pv => pv.profileId === profileId)
        const profile = allProfiles.find(p => p.id === profileId)
        const option = profile?.options.find(o => o.id === optionId) ?? null
        const newPv = idx >= 0
          ? { ...existing[idx], optionId, option: option ? { id: option.id, label: option.label, value: option.value } : null }
          : {
              id: `local_${profileId}`,
              profileId,
              optionId,
              profile: { id: profileId, name: profile?.name ?? '' },
              option: option ? { id: option.id, label: option.label, value: option.value } : null,
            }
        return {
          ...s,
          profileValues: idx >= 0
            ? existing.map((pv, i) => i === idx ? newPv : pv)
            : [...existing, newPv],
        }
      })
      setSkills(updated)
      onLocalSkillsChange?.(updated)
      return
    }

    // Optimistic update: update profileValues in local state
    const prevSkills = skills
    setSkills(prev =>
      prev.map(s => {
        if (s.id !== skillId) return s
        const existing = s.profileValues ?? []
        const idx = existing.findIndex(pv => pv.profileId === profileId)
        const profile = allProfiles.find(p => p.id === profileId)
        const option = profile?.options.find(o => o.id === optionId) ?? null
        const newPv: ProfessionalSkill['profileValues'][number] = idx >= 0
          ? { ...existing[idx], optionId, option: option ? { id: option.id, label: option.label, value: option.value } : null }
          : {
              id: `__optimistic_${profileId}`,
              profileId,
              optionId,
              profile: { id: profileId, name: profile?.name ?? '' },
              option: option ? { id: option.id, label: option.label, value: option.value } : null,
            }
        return {
          ...s,
          profileValues: idx >= 0
            ? existing.map((pv, i) => i === idx ? newPv : pv)
            : [...existing, newPv],
        }
      }),
    )

    try {
      await api.patch(
        `/character-sheets/${sheetId}/professional-skills/${skillId}/profiles/${profileId}`,
        { optionId },
      )
    } catch {
      // Rollback on failure
      setSkills(prevSkills)
    }
  }

  // ── Create ──

  function openCreate() {
    setCreateName('')
    setCreateAttributeId('')
    // Auto-select the lowest-value option for each profile
    const initialSelections: Record<string, string | null> = {}
    for (const profile of allProfiles) {
      if (profile.options.length > 0) {
        const lowest = profile.options.reduce((a, b) => a.value <= b.value ? a : b)
        initialSelections[profile.id] = lowest.id
      }
    }
    setCreateProfileSelections(initialSelections)
    setError(null)
    setShowCreateModal(true)
  }

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault()
    if (!createName.trim()) return
    setSaving(true)
    setError(null)

    if (localMode) {
      const profileValues = Object.entries(createProfileSelections)
        .filter(([, optionId]) => optionId !== null && optionId !== '')
        .map(([profileId, optionId]) => {
          const profile = allProfiles.find(p => p.id === profileId)
          const option = profile?.options.find(o => o.id === optionId) ?? null
          return {
            id: `local_pv_${Date.now()}_${profileId}`,
            profileId,
            optionId,
            profile: { id: profileId, name: profile?.name ?? '' },
            option: option ? { id: option.id, label: option.label, value: option.value } : null,
          }
        })
      const newSkill: ProfessionalSkill = {
        id: `local_skill_${Date.now()}`,
        name: createName.trim(),
        attributeId: createAttributeId || null,
        attribute: templateAttributes.find(a => a.id === createAttributeId) ?? null,
        order: skills.length,
        profileValues,
      }
      const updated = [...skills, newSkill]
      setSkills(updated)
      onLocalSkillsChange?.(updated)
      setShowCreateModal(false)
      setSaving(false)
      return
    }

    try {
      const skill = await api.post<ProfessionalSkill>(`/character-sheets/${sheetId}/professional-skills`, {
        name: createName.trim(),
        attributeId: createAttributeId || null,
      })

      // Apply any profile selections from the create modal
      const patchPromises = Object.entries(createProfileSelections)
        .filter(([, optionId]) => optionId !== null && optionId !== '')
        .map(([profileId, optionId]) =>
          api.patch(
            `/character-sheets/${sheetId}/professional-skills/${skill.id}/profiles/${profileId}`,
            { optionId },
          ),
        )

      if (patchPromises.length > 0) {
        await Promise.all(patchPromises)
      }

      await fetchSkills()
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

    if (localMode) {
      const updated = skills.map(s => {
        if (s.id !== skillId) return s
        return {
          ...s,
          name: editName.trim(),
          attributeId: editAttributeId || null,
          attribute: templateAttributes.find(a => a.id === editAttributeId) ?? null,
        }
      })
      setSkills(updated)
      onLocalSkillsChange?.(updated)
      setEditingId(null)
      return
    }

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
    if (localMode) {
      const updated = skills.filter(s => s.id !== skillId)
      setSkills(updated)
      onLocalSkillsChange?.(updated)
      return
    }
    try {
      await api.delete(`/character-sheets/${sheetId}/professional-skills/${skillId}`)
      setSkills(p => p.filter(s => s.id !== skillId))
    } catch {
      // silent fail
    }
  }

  // ── Render: Profile selectors (shared between view and edit mode) ──

  function renderProfileSelectors(skillId: string, disableAll = false) {
    if (allProfiles.length === 0) {
      return <span className="text-[0.6rem] text-muted">—</span>
    }

    const skill = skills.find(s => s.id === skillId)
    if (!skill) return null

    return (
      <div className="space-y-1">
        {allProfiles.map(profile => {
          const currentValue = skill.profileValues?.find(pv => pv.profileId === profile.id)
          const selectedOptionId = currentValue?.optionId ?? ''

          return (
            <div key={profile.id} className="flex items-center gap-1">
              <label className="text-[0.55rem] text-muted whitespace-nowrap shrink-0 leading-none">
                {profile.name}
              </label>
              <Select
                options={profile.options}
                value={selectedOptionId || null}
                onChange={(id) => handleProfileChange(skillId, profile.id, id)}
                disabled={disableAll}
                showBadge
                size="sm"
                className="flex-1 min-w-0"
              />
            </div>
          )
        })}
      </div>
    )
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
        {canEdit && (
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
                <th className="py-2 pr-2 font-medium text-right">MOD</th>
                <th className="py-2 pr-2 font-medium">Profile(s)</th>
                {canEdit && <th className="py-2 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {skills.map(skill => {
                const skillResult = results[skill.id]
                const total = skillResult?.total ?? null
                const modSum = skillResult?.modSum ?? 0
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
                          <Select
                            options={[{ id: '', label: 'None' }, ...templateAttributes.map(attr => ({ id: attr.id, label: attr.name }))]}
                            value={editAttributeId ?? ''}
                            onChange={val => setEditAttributeId(val)}
                            size="sm"
                            className="w-full text-sm"
                          />
                        </td>
                        <td className="py-2 pr-2 text-right">{total !== null ? total : '—'}</td>
                        <td className="py-2 pr-2 text-right text-muted whitespace-nowrap">
                          {modSum !== 0
                            ? (modSum > 0 ? `+${modSum}` : `${modSum}`)
                            : '—'}
                        </td>
                        <td className="py-2 pr-2">
                          {renderProfileSelectors(skill.id)}
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
                        <td className="py-2 pr-2 text-right text-muted whitespace-nowrap">
                          {modSum !== 0
                            ? (modSum > 0 ? `+${modSum}` : `${modSum}`)
                            : '—'}
                        </td>
                        <td className="py-2 pr-2">
                          {renderProfileSelectors(skill.id, !canEdit)}
                        </td>
                        {canEdit && (
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
            className="bg-surface border border-border rounded-xl shadow-xl p-6 w-full max-w-md space-y-4"
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
              <Select
                options={[{ id: '', label: 'None' }, ...templateAttributes.map(attr => ({ id: attr.id, label: attr.name }))]}
                value={createAttributeId ?? ''}
                onChange={val => setCreateAttributeId(val)}
                size="md"
                className="w-full"
              />
            </div>

            {/* Profile selections in create modal */}
            {allProfiles.length > 0 && (
              <div>
                <label className="label mb-1 block">Modifier Profiles (optional)</label>
                <div className="space-y-2">
                  {allProfiles.map(profile => (
                    <div key={profile.id} className="flex items-center gap-2">
                      <label className="text-xs text-muted min-w-[4rem]">{profile.name}:</label>
                      <Select
                        options={profile.options}
                        value={createProfileSelections[profile.id] ?? null}
                        onChange={(id) =>
                          setCreateProfileSelections(p => ({
                            ...p,
                            [profile.id]: id,
                          }))
                        }
                        showBadge
                        size="sm"
                        className="flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

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
          Professional Skills use the selected attribute&apos;s modifier plus any Modifier Profile bonuses.
          Choose which attribute to use for each skill and select matching profiles. All calculations
          follow the rules defined by the GM.
        </p>
      )}
    </div>
  )
}
