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
  attribute: { id: string; key: string; name: string; modifier: string | null }
}

interface FieldValue {
  id: string
  templateFieldId: string
  value: string
  templateField: { id: string; key: string; label: string }
}

interface SkillValue {
  id: string
  skillId: string
  value: string
  skill: { id: string; name: string; description: string | null; formula: string | null }
}

interface ProfileOption {
  id: string
  label: string
  value: number
}

interface SkillModifierProfile {
  id: string
  name: string
  options: ProfileOption[]
}

interface SkillProfileValue {
  id: string
  skillId: string
  profileId: string
  optionId: string | null
  profile: { id: string; name: string }
  option: { id: string; label: string; value: number } | null
}

interface CharacterSheet {
  id: string
  characterName: string
  playerName: string | null
  level: number | null
  adventure: { id: string; name: string; campaign: string } | null
  template: {
    id: string
    name: string
    attributes: { id: string; key: string; name: string; modifier: string | null }[]
    skillModifierProfiles: SkillModifierProfile[]
  }
  values: SheetAttribute[]
  fieldValues: FieldValue[]
  skillValues: SkillValue[]
  skillProfileValues: SkillProfileValue[]
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
  const [skillResults, setSkillResults] = useState<Record<string, number | null>>({})
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPlayerName, setEditPlayerName] = useState('')
  const [editLevel, setEditLevel] = useState(1)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [editFieldValues, setEditFieldValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Local profile selections (optimistic UI)
  const [profileSelections, setProfileSelections] = useState<Record<string, Record<string, string | null>>>({})

  const isOwner = sheet?.ownerId === user?.id

  const fetchSheet = useCallback(async () => {
    try {
      const data = await api.get<CharacterSheet>(`/character-sheets/${id}`)
      setSheet(data)
      setEditName(data.characterName)
      setEditPlayerName(data.playerName ?? '')
      setEditLevel(data.level ?? 1)
      const vals: Record<string, string> = {}
      data.values.forEach((v) => { vals[v.attributeId] = v.value })
      setEditValues(vals)
      const fvals: Record<string, string> = {}
      data.fieldValues.forEach((fv) => { fvals[fv.templateFieldId] = fv.value })
      setEditFieldValues(fvals)

      // Build profile selections map: { [skillId]: { [profileId]: optionId | null } }
      const selMap: Record<string, Record<string, string | null>> = {}
      data.skillProfileValues.forEach((spv) => {
        if (!selMap[spv.skillId]) selMap[spv.skillId] = {}
        selMap[spv.skillId][spv.profileId] = spv.optionId
      })
      setProfileSelections(selMap)

      computeModifiers(data)
      computeSkills(data, selMap)
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 401 || statusCode === 403) router.replace('/login')
    } finally { setFetching(false) }
  }, [id, router])

  const computeSkills = useCallback(async (sheetData: CharacterSheet, selections?: Record<string, Record<string, string | null>>) => {
    const results: Record<string, number | null> = {}
    const selMap = selections || profileSelections

    // First, compute all modifier values (e.g. dex_mod = 4)
    const modifierVars: Record<string, number> = {}
    for (const attr of sheetData.template.attributes) {
      if (attr.modifier && attr.modifier.trim()) {
        try {
          const modVars: Record<string, number> = {}
          sheetData.template.attributes.forEach((a) => {
            const v = parseFloat(sheetData.values.find((sv) => sv.attributeId === a.id)?.value || '0')
            modVars[a.key] = isNaN(v) ? 0 : v
          })
          const modResult = await api.post<{ result: number }>('/formula/evaluate', { formula: attr.modifier, variables: modVars })
          modifierVars[`${attr.key}_mod`] = modResult.result
        } catch { modifierVars[`${attr.key}_mod`] = 0 }
      }
    }

    for (const sv of sheetData.skillValues) {
      if (sv.skill.formula && sv.skill.formula.trim()) {
        try {
          const variables: Record<string, number> = { ...modifierVars }
          sheetData.template.attributes.forEach((a) => {
            const val = parseFloat(sheetData.values.find((v) => v.attributeId === a.id)?.value || '0')
            variables[a.key] = isNaN(val) ? 0 : val
          })
          sheetData.fieldValues.forEach((fv) => {
            const val = parseFloat(fv.value)
            variables[fv.templateField.key] = isNaN(val) ? 0 : val
          })
          variables['level'] = sheetData.level ?? 1

          const res = await api.post<{ result: number }>('/formula/evaluate', { formula: sv.skill.formula, variables })
          let finalResult = res.result

          // Add selected profile option values ON TOP of formula result
          const skillSelections = selMap[sv.skillId] || {}
          for (const profile of sheetData.template.skillModifierProfiles) {
            const selectedOptionId = skillSelections[profile.id]
            if (selectedOptionId) {
              const option = profile.options.find(o => o.id === selectedOptionId)
              if (option) {
                finalResult += option.value
              }
            } else {
              // No selection; check stored data
              const stored = sheetData.skillProfileValues.find(
                spv => spv.skillId === sv.skillId && spv.profileId === profile.id
              )
              if (stored?.option?.value !== undefined) {
                finalResult += stored.option.value
              }
            }
          }

          results[sv.skillId] = finalResult
        } catch { results[sv.skillId] = null }
      }
    }
    setSkillResults(results)
  }, [profileSelections])

  const computeModifiers = useCallback(async (sheetData: CharacterSheet) => {
    const results: Record<string, number | null> = {}
    for (const attr of sheetData.template.attributes) {
      if (attr.modifier && attr.modifier.trim()) {
        try {
          const variables: Record<string, number> = {}
          sheetData.template.attributes.forEach((a) => {
            const val = parseFloat(sheetData.values.find((v) => v.attributeId === a.id)?.value || '0')
            variables[a.key] = isNaN(val) ? 0 : val
          })
          const res = await api.post<{ result: number }>('/formula/evaluate', { formula: attr.modifier, variables })
          results[attr.id] = res.result
        } catch { results[attr.id] = null }
      }
    }
    setModifierResults(results)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) { router.replace('/login'); return }
    if (user) fetchSheet()
  }, [authLoading, user, fetchSheet])

  // Handle profile selection change
  async function handleProfileChange(skillId: string, profileId: string, optionId: string | null) {
    if (!sheet) return

    // Optimistic UI update
    setProfileSelections((prev) => {
      const next = { ...prev }
      if (!next[skillId]) next[skillId] = {}
      next[skillId] = { ...next[skillId], [profileId]: optionId }
      return next
    })

    // Persist to backend
    try {
      await api.patch(`/character-sheets/${sheet.id}/skills/${skillId}/profiles/${profileId}`, { optionId })
    } catch {
      // Revert on failure
      const stored = sheet.skillProfileValues.find(spv => spv.skillId === skillId && spv.profileId === profileId)
      setProfileSelections((prev) => {
        const next = { ...prev }
        if (!next[skillId]) next[skillId] = {}
        next[skillId] = { ...next[skillId], [profileId]: stored?.optionId ?? null }
        return next
      })
      return
    }

    // Recalculate skills with new selection
    if (sheet) {
      const updatedSelections = { ...profileSelections }
      if (!updatedSelections[skillId]) updatedSelections[skillId] = {}
      updatedSelections[skillId] = { ...updatedSelections[skillId], [profileId]: optionId }
      computeSkills(sheet, updatedSelections)
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setEditError(null)
    setSaving(true)
    try {
      const values = Object.entries(editValues).map(([attributeId, value]) => ({ attributeId, value }))
      const fieldValues = Object.entries(editFieldValues).map(([templateFieldId, value]) => ({ templateFieldId, value }))
      const updated = await api.patch<CharacterSheet>(`/character-sheets/${id}`, {
        characterName: editName.trim() || undefined,
        playerName: editPlayerName.trim() || undefined,
        level: editLevel,
        values,
        fieldValues,
      })
      setSheet(updated)
      setEditing(false)
      computeModifiers(updated)
      computeSkills(updated, profileSelections)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update')
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    setDeleteError(null); setDeleting(true)
    try { await api.delete(`/character-sheets/${id}`); router.push('/dashboard?tab=character-sheets') }
    catch (err) { setDeleteError(err instanceof Error ? err.message : 'Failed to delete'); setDeleting(false); setConfirmDelete(false) }
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

  // All profiles from the template — every skill shows every profile as a dropdown
  const allProfiles: SkillModifierProfile[] = sheet?.template.skillModifierProfiles ?? []

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 animate-fade-in">
      <div className="mb-6">
        <Link href="/dashboard?tab=character-sheets" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Character Sheets
        </Link>
      </div>

      {!editing ? (
        <div className="space-y-6">
          <div className="card !p-6 space-y-4">
            <div className="flex gap-4">
              <div className="shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-lg object-cover border border-border" />
                ) : isOwner ? (
                  <label className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/30 transition-colors">
                    <span className="text-2xl text-muted">+</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setAvatarUrl(URL.createObjectURL(file)) }} />
                  </label>
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gradient truncate">{sheet.characterName}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {sheet.playerName && <span className="badge badge-gold">Player: {sheet.playerName}</span>}
                  {sheet.level && <span className="badge badge-gold">Level: {sheet.level}</span>}
                  {sheet.adventure && <span className="badge badge-gold">{sheet.adventure.campaign}</span>}
                  <span className="badge badge-gold">{sheet.template.name}</span>
                  <span className="text-xs text-muted">Created {new Date(sheet.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>
              {isOwner && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditing(true)} className="btn-ghost"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>Edit</button>
                  <button onClick={() => setConfirmDelete(true)} className="btn-danger"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Delete</button>
                </div>
              )}
            </div>
            {sheet.adventure && <><hr className="divider" /><div><h3 className="text-sm font-medium text-muted mb-1">Adventure</h3><p className="text-foreground/80 text-sm">{sheet.adventure.name}</p></div></>}
          </div>

          {sheet.fieldValues.length > 0 && (
            <div className="card !p-6">
              <h3 className="font-semibold mb-3">Character Info</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {sheet.fieldValues.map((fv) => (
                  <div key={fv.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border">
                    <span className="text-sm text-muted">{fv.templateField.label}</span>
                    <span className="text-sm font-medium text-foreground">{fv.value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card !p-6">
            <h3 className="font-semibold mb-4">Attributes</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {sheet.template.attributes.map((attr) => {
                const val = sheet.values.find((v) => v.attributeId === attr.id)
                const modResult = modifierResults[attr.id]
                return (
                  <div key={attr.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border">
                    <span className="text-sm text-foreground">{attr.name}{attr.modifier && <span className="text-[0.6rem] text-primary ml-1">mod</span>}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-foreground">{val?.value || '—'}</span>
                      {modResult !== undefined && modResult !== null && (<span className="text-sm font-semibold text-primary">({modResult >= 0 ? '+' : ''}{modResult})</span>)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Skills — collapsible cards */}
          {sheet.skillValues.length > 0 && (
            <div className="space-y-2">
              {sheet.skillValues.map((sv) => (
                <CollapsibleSkillRow
                  key={sv.id}
                  skill={sv}
                  result={skillResults[sv.skillId]}
                  profiles={allProfiles}
                  selections={profileSelections[sv.skillId] || {}}
                  onProfileChange={(profileId, optionId) => handleProfileChange(sv.skillId, profileId, optionId)}
                />
              ))}
            </div>
          )}

          <div className="text-center"><p className="text-xs text-muted">{isOwner ? 'You own this character sheet.' : 'This character sheet belongs to another player.'}</p></div>
          {confirmDelete && <DeleteModal name={sheet.characterName} error={deleteError} loading={deleting} onCancel={() => setConfirmDelete(false)} onConfirm={handleDelete} />}
        </div>
      ) : (
        <EditForm
          name={editName} playerName={editPlayerName} level={editLevel}
          attributes={sheet.template.attributes} values={editValues}
          fieldValues={sheet.fieldValues} editFieldValues={editFieldValues}
          error={editError} saving={saving}
          onNameChange={setEditName} onPlayerNameChange={setEditPlayerName} onLevelChange={setEditLevel}
          onValueChange={(attrId, val) => setEditValues((prev) => ({ ...prev, [attrId]: val }))}
          onFieldValueChange={(tfId, val) => setEditFieldValues((prev) => ({ ...prev, [tfId]: val }))}
          onCancel={() => {
            setEditing(false); setEditError(null)
            setEditName(sheet.characterName); setEditPlayerName(sheet.playerName ?? ''); setEditLevel(sheet.level ?? 1)
            const vals: Record<string, string> = {}; sheet.values.forEach((v) => { vals[v.attributeId] = v.value }); setEditValues(vals)
            const fvals: Record<string, string> = {}; sheet.fieldValues.forEach((fv) => { fvals[fv.templateFieldId] = fv.value }); setEditFieldValues(fvals)
          }}
          onSubmit={handleSave}
        />
      )}
    </main>
  )
}

function CollapsibleSkillRow({ skill, result, profiles, selections, onProfileChange }: {
  skill: SkillValue
  result: number | null
  profiles: SkillModifierProfile[]
  selections: Record<string, string | null>
  onProfileChange: (profileId: string, optionId: string | null) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-background/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-background/50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{skill.skill.name}</span>
            {skill.skill.description && (
              <span className="text-xs text-muted truncate hidden sm:inline">— {skill.skill.description}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-base font-bold text-primary">{result != null ? result : '—'}</span>
          {profiles.length > 0 && (
            <svg className={`w-4 h-4 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {expanded && profiles.length > 0 && (
        <div className="px-4 py-3 space-y-2 border-t border-border">
          {profiles.map((profile) => {
            const selectedOptionId = selections[profile.id]
            const selectedOption = selectedOptionId
              ? profile.options.find((o: ProfileOption) => o.id === selectedOptionId)
              : null

            return (
              <div key={profile.id} className="flex items-center gap-2">
                <span className="text-xs text-muted shrink-0 min-w-[80px]">{profile.name}:</span>
                <select
                  className="input-field py-1 text-xs flex-1"
                  value={selectedOptionId ?? ''}
                  onChange={(e) => {
                    const val = e.target.value || null
                    onProfileChange(profile.id, val)
                  }}
                >
                  <option value="">— Select —</option>
                  {profile.options.map((opt: ProfileOption) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label} ({opt.value >= 0 ? '+' : ''}{opt.value})
                    </option>
                  ))}
                </select>
                {selectedOption && (
                  <span className="text-xs font-mono text-primary shrink-0">
                    {selectedOption.value >= 0 ? '+' : ''}{selectedOption.value}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EditForm(props: {
  name: string; playerName: string; level: number
  attributes: { id: string; key: string; name: string }[]
  values: Record<string, string>
  fieldValues: FieldValue[]; editFieldValues: Record<string, string>
  error: string | null; saving: boolean
  onNameChange: (v: string) => void; onPlayerNameChange: (v: string) => void; onLevelChange: (v: number) => void
  onValueChange: (attrId: string, v: string) => void
  onFieldValueChange: (tfId: string, v: string) => void
  onCancel: () => void; onSubmit: (e: FormEvent) => void
}) {
  return (
    <form onSubmit={props.onSubmit} className="card !p-6 space-y-4 animate-slide-up">
      <div className="flex items-center gap-3 mb-2">
        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        <h2 className="text-xl font-semibold text-gradient">Edit Character Sheet</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className="label">Character Name</label><input className="input-field" value={props.name} onChange={(e) => props.onNameChange(e.target.value)} maxLength={100} /></div>
        <div><label className="label">Player Name</label><input className="input-field" value={props.playerName} onChange={(e) => props.onPlayerNameChange(e.target.value)} maxLength={100} placeholder="Player name" /></div>
        <div><label className="label">Level</label><input type="number" className="input-field" value={props.level} onChange={(e) => props.onLevelChange(Number(e.target.value))} min={1} /></div>
      </div>
      {props.fieldValues.length > 0 && (
        <div>
          <label className="label">Character Info (Template)</label>
          <div className="space-y-3 mt-1">
            {props.fieldValues.map((fv) => (
              <div key={fv.id}>
                <label className="text-xs text-muted mb-1 block">{fv.templateField.label}</label>
                <input className="input-field" value={props.editFieldValues[fv.templateFieldId] ?? ''} onChange={(e) => props.onFieldValueChange(fv.templateFieldId, e.target.value)} placeholder={`Enter ${fv.templateField.label}...`} />
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <label className="label">Attributes</label>
        <div className="space-y-3 mt-1">
          {props.attributes.map((attr) => (
            <div key={attr.id}>
              <label className="text-xs text-muted flex items-center gap-1 mb-1">{attr.name}</label>
              <input className="input-field" value={props.values[attr.id] ?? ''} onChange={(e) => props.onValueChange(attr.id, e.target.value)} placeholder={`Enter ${attr.name}...`} />
            </div>
          ))}
        </div>
      </div>
      {props.error && <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{props.error}</div>}
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={props.onCancel} disabled={props.saving} className="btn-ghost">Cancel</button>
        <button type="submit" disabled={props.saving || props.name.trim().length === 0} className="btn-primary">
          {props.saving ? <><div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />Saving...</> : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

function DeleteModal({ name, error, loading, onCancel, onConfirm }: { name: string; error: string | null; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center">
            <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </div>
          <div><h2 className="font-semibold">Delete Character Sheet</h2><p className="text-sm text-muted-foreground">This action cannot be undone.</p></div>
        </div>
        <p className="text-sm text-muted-foreground">Are you sure you want to delete "{name}"?</p>
        {error && <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{error}</div>}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading} className="btn-ghost">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="btn-danger-solid">{loading ? 'Deleting...' : 'Delete forever'}</button>
        </div>
      </div>
    </div>
  )
}