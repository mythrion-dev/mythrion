'use client'

import { useState, useEffect, useCallback, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api, API_URL, authFetch } from '@/lib/api'
import { NumericInput } from '@/components/shared/NumericInput'

/* ── Types (mirroring the backend for type safety) ── */

interface TemplateAttribute {
  id: string; key: string; name: string
}
interface Template {
  id: string; name: string; description: string | null
  attributeModifierFormula: string | null
  attributes: TemplateAttribute[]
  templateFields: { id: string; key: string; label: string }[]
  characterSections: { id: string; name: string }[]
}

interface SummonAttribute {
  id: string; abilityId: string; attributeId: string; value: string
}
interface SummonSkill {
  id: string; name: string; manualValue: number
}

interface CreatureAbility {
  id: string; name: string; type: string; description: string | null; notes: string | null
  sheetId: string
  summonAttributes: SummonAttribute[]
  summonAcValues: { id: string; abilityId: string; value: string }[]
  summonHealth: { id: string; abilityId: string; current: number | null; maximum: number | null; notes: string | null } | null
  summonSkills: SummonSkill[]
  childAbilities: CreatureAbility[]
  levels: { id: string; level: string; description: string | null; manaCost: number | null; range: string | null; notes: string | null; damage: string | null }[]
}

interface AbilityLevel {
  id: string; abilityId: string; level: string; manaCost: number | null; range: string | null; description: string | null; notes: string | null; damage: string | null
}
interface ChildAbility {
  id: string; name: string; description: string | null; notes: string | null
  levels: AbilityLevel[]
}

/* ── Module helpers ── */

const ATTRIBUTE_SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e', 'f']

function updateChildAbilityLevel(
  childAbilities: ChildAbility[],
  abilityId: string,
  levelId: string,
  patch: Record<string, unknown>,
): ChildAbility[] {
  return childAbilities.map(c =>
    c.id === abilityId
      ? { ...c, levels: c.levels.map(l => l.id === levelId ? { ...l, ...patch } : l) }
      : c
  )
}

function removeChildAbilityLevel(
  childAbilities: ChildAbility[],
  childId: string,
  levelId: string,
): ChildAbility[] {
  return childAbilities.map(c =>
    c.id === childId ? { ...c, levels: c.levels.filter(l => l.id !== levelId) } : c
  )
}

/* ── Prop ── */

interface CreatureDrawerProps {
  readonly ability: CreatureAbility | null
  readonly sheetId: string | null
  readonly onClose: () => void
  readonly onUpdate: () => void
}

/* ── Component ── */

export function CreatureDrawer({ ability, sheetId, onClose, onUpdate }: CreatureDrawerProps) {
  const { t } = useTranslation()
  const [template, setTemplate] = useState<Template | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  /* Editable local fields */
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [hpCurrent, setHpCurrent] = useState<number | null>(null)
  const [hpMax, setHpMax] = useState<number | null>(null)
  const [hpNotes, setHpNotes] = useState('')
  const [attrValues, setAttrValues] = useState<Record<string, string>>({})
  const [acValue, setAcValue] = useState('10')

  /* ── Computed / derived state ── */
  const [modifierResults, setModifierResults] = useState<Record<string, number | null>>({})

  /* ── Child ability management ── */
  const [childAbilities, setChildAbilities] = useState<ChildAbility[]>([])
  const [expandedChildren, setExpandedChildren] = useState<Record<string, boolean>>({})
  const [showNewChildAbility, setShowNewChildAbility] = useState(false)
  const [newChildAbilityForm, setNewChildAbilityForm] = useState({
    name: '', description: '', manaCost: '', range: '', damage: '', level: '',
  })
  const [childAbilitySaving, setChildAbilitySaving] = useState(false)
  const [childAbilityError, setChildAbilityError] = useState<string | null>(null)
  const [addingLevel, setAddingLevel] = useState<string | null>(null)

  /* ── Copy ability data into local state when it changes ── */
  useEffect(() => {
    if (!ability) return
    setName(ability.name)
    setDescription(ability.description ?? '')
    setNotes(ability.notes ?? '')
    setHpCurrent(ability.summonHealth?.current ?? null)
    setHpMax(ability.summonHealth?.maximum ?? null)
    setHpNotes(ability.summonHealth?.notes ?? '')
    const av: Record<string, string> = {}
    for (const sa of ability.summonAttributes) av[sa.attributeId] = sa.value
    setAttrValues(av)
    setAcValue(ability.summonAcValues?.[0]?.value ?? '10')
    /* Copy child abilities */
    setChildAbilities(ability.childAbilities?.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      notes: c.notes,
      levels: (c.levels ?? []).map(l => ({ ...l, abilityId: c.id })),
    })) ?? [])
    /* Reset computed state */
    setModifierResults({})
    setShowNewChildAbility(false)
  }, [ability])

  /* ── Fetch template & run initial computations ── */
  useEffect(() => {
    if (!ability || !sheetId) return
    setTemplateLoading(true)
    api.get<any>(`/character-sheets/${sheetId}`)
      .then(sheet => {
        const tplId = sheet.templateId
        if (tplId) {
          return api.get<Template>(`/adventures/${sheet.adventureId}/templates/${tplId}`)
        }
        return null
      })
      .then(tpl => {
        if (tpl) {
          setTemplate(tpl)
          // Kick off initial computations
          computeModifiers(tpl, ability!.summonAttributes)
        }
      })
      .catch(() => {
        /* If we can't fetch the template, attributes etc. still show raw IDs */
      })
      .finally(() => setTemplateLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ability, sheetId])

  /* ── Formula / computation helpers ── */

  const computeModifiers = useCallback(async (tpl: Template, attrs: SummonAttribute[]) => {
    const formula = tpl.attributeModifierFormula
    if (!formula?.trim()) { setModifierResults({}); return }
    const results: Record<string, number | null> = {}
    for (const attr of tpl.attributes) {
      try {
        const vars: Record<string, number> = {}
        tpl.attributes.forEach(a => {
          const v = Number.parseFloat(attrs.find(s => s.attributeId === a.id)?.value ?? '0')
          vars[a.key] = Number.isNaN(v) ? 0 : v
        })
        vars['value'] = Number.parseFloat(attrs.find(s => s.attributeId === attr.id)?.value ?? '0') || 0
        const res = await api.post<{ result: number }>('/formula/evaluate', { formula, variables: vars })
        results[attr.id] = res.result
      } catch { results[attr.id] = null }
    }
    setModifierResults(results)
    return results
  }, [])

  /* Re-compute modifiers when attrValues or template changes */
  useEffect(() => {
    if (!template || !ability) return
    computeModifiers(template, ability!.summonAttributes.map(sa => ({
      ...sa,
      value: attrValues[sa.attributeId] ?? sa.value,
    })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attrValues, template])

  /* ── Save handlers ── */

  const saveAbilityMetadata = useCallback(async () => {
    if (!ability || !sheetId) return
    await api.patch(`/character-sheets/${sheetId}/abilities/${ability.id}`, {
      name: name.trim() || ability.name,
      description: description.trim() || null,
      notes: notes.trim() || null,
    })
  }, [ability, sheetId, name, description, notes])

  const saveHealth = useCallback(async () => {
    if (!ability || !sheetId) return
    await api.patch(`/character-sheets/${sheetId}/abilities/${ability.id}/summon-health`, {
      current: hpCurrent,
      maximum: hpMax,
      notes: hpNotes.trim() || null,
    })
  }, [ability, sheetId, hpCurrent, hpMax, hpNotes])

  const handleSaveAll = useCallback(async () => {
    if (!ability || !sheetId) return
    setSaving(true)
    try {
      await saveAbilityMetadata()
      await saveHealth()
      for (const [attributeId, value] of Object.entries(attrValues)) {
        await api.patch(`/character-sheets/${sheetId}/abilities/${ability.id}/summon-attributes/${attributeId}`, { value })
      }
      await api.patch(`/character-sheets/${sheetId}/abilities/${ability.id}/summon-ac`, { value: acValue })
      onUpdate()
    } catch {
      /* silently fail */
    } finally {
      setSaving(false)
    }
  }, [ability, sheetId, saveAbilityMetadata, saveHealth, attrValues, acValue, onUpdate])

  /* ── Avatar upload ── */
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !ability) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      await authFetch(`${API_URL}/images/abilities/${ability.id}/avatar`, {
        method: 'POST',
        body: formData,
      })
      setAvatarKey(k => k + 1)
    } catch {
      /* silently fail */
    } finally {
      setUploading(false)
    }
  }
  const [avatarKey, setAvatarKey] = useState(0)

  /* ── Child ability CRUD ── */

  async function handleCreateChildAbility(e: SubmitEvent) {
    e.preventDefault()
    if (!ability || !sheetId || !newChildAbilityForm.name.trim()) return
    setChildAbilitySaving(true)
    setChildAbilityError(null)
    try {
      const body: Record<string, unknown> = {
        name: newChildAbilityForm.name.trim(),
        description: newChildAbilityForm.description.trim() || undefined,
        manaCost: newChildAbilityForm.manaCost.trim() ? Number.parseInt(newChildAbilityForm.manaCost, 10) : undefined,
        range: newChildAbilityForm.range.trim() || undefined,
        damage: newChildAbilityForm.damage.trim() || undefined,
      }
      const a = await api.post<ChildAbility>(
        `/character-sheets/${sheetId}/abilities/${ability.id}/summon-abilities`,
        body
      )
      // Create initial level if user specified one
      if (newChildAbilityForm.level.trim()) {
        const nl = await api.post<AbilityLevel>(
          `/character-sheets/${sheetId}/abilities/${a.id}/levels`,
          { level: newChildAbilityForm.level.trim(), copyFromPrevious: false }
        )
        a.levels = [nl]
      }
      setChildAbilities(prev => [...prev, a])
      setExpandedChildren(prev => ({ ...prev, [a.id]: true }))
      setNewChildAbilityForm({ name: '', description: '', manaCost: '', range: '', damage: '', level: '' })
      setShowNewChildAbility(false)
      onUpdate()
    } catch (err) {
      setChildAbilityError(err instanceof Error ? err.message : t('campaign:failedToCreateAbility'))
    } finally {
      setChildAbilitySaving(false)
    }
  }

  async function saveChildAbilityField(childId: string, field: string, value: string) {
    if (!ability || !sheetId) return
    try {
      const body: Record<string, unknown> = {}
      if (field === 'name') body.name = value.trim()
      else if (field === 'description') body.description = value.trim() || null
      else if (field === 'notes') body.notes = value.trim() || null
      await api.patch(`/character-sheets/${sheetId}/abilities/${childId}`, body)
      setChildAbilities(prev => prev.map(c => c.id === childId ? { ...c, [field]: value } : c))
      onUpdate()
    } catch {
      /* silently fail */
    }
  }

  async function handleDeleteChildAbility(childId: string) {
    if (!ability || !sheetId) return
    try {
      await api.delete(`/character-sheets/${sheetId}/abilities/${childId}`)
      setChildAbilities(prev => prev.filter(c => c.id !== childId))
      onUpdate()
    } catch {
      /* silently fail */
    }
  }

  async function handleSaveLevelField(abilityId: string, levelId: string, field: string, value: string) {
    if (!ability || !sheetId) return
    try {
      const body: Record<string, unknown> = {}
      if (field === 'level') body.level = value.trim()
      else if (field === 'description') body.description = value.trim() || null
      else if (field === 'manaCost') body.manaCost = value.trim() ? Number.parseInt(value, 10) : null
      else if (field === 'range') body.range = value.trim() || null
      else if (field === 'notes') body.notes = value.trim() || null
      else if (field === 'damage') body.damage = value.trim() || null
      await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${levelId}`, body)
      setChildAbilities(prev => updateChildAbilityLevel(prev, abilityId, levelId, body))
    } catch {
      /* silently fail */
    }
  }

  async function handleAddLevel(childId: string) {
    if (!ability || !sheetId) return
    setAddingLevel(childId)
    try {
      const existingLevels = childAbilities.find(c => c.id === childId)?.levels ?? []
      const nextLevel = existingLevels.length > 0
        ? String(Math.max(...existingLevels.map(l => Number.parseInt(l.level || '0', 10))) + 1)
        : '1'
      const lvl = await api.post<AbilityLevel>(`/character-sheets/${sheetId}/abilities/${childId}/levels`, {
        level: nextLevel,
        copyFromPrevious: existingLevels.length > 0,
      })
      setChildAbilities(prev => prev.map(c =>
        c.id === childId ? { ...c, levels: [...c.levels, lvl] } : c
      ))
      onUpdate()
    } catch {
      /* silently fail */
    } finally {
      setAddingLevel(null)
    }
  }

  async function handleDeleteLevel(childId: string, levelId: string) {
    if (!ability || !sheetId) return
    try {
      await api.delete(`/character-sheets/${sheetId}/abilities/x/levels/${levelId}`)
      setChildAbilities(prev => removeChildAbilityLevel(prev, childId, levelId))
      onUpdate()
    } catch {
      /* silently fail */
    }
  }

  /* ── Helpers ── */

  function findAttr(id: string): TemplateAttribute | undefined {
    return template?.attributes.find(a => a.id === id)
  }

  /* ── Render ── */
  if (!ability) return null

  const isMob = ability.notes?.startsWith('[MOB]')
  const displayNotes = isMob ? (notes.replace(/^\[MOB\]\s*/, '') ?? '') : notes

  return (
    <>
      {/* Overlay */}
      <button type="button" tabIndex={-1} aria-hidden="true" className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />

      {/* Drawer panel */}
      <div className="fixed top-0 right-0 z-50 h-full w-[70vw] max-w-[900px] min-w-[400px] bg-surface border-l border-border shadow-2xl flex flex-col">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-surface border border-border shrink-0">
              <img
                key={avatarKey}
                src={`${API_URL}/images/abilities/${ability.id}/avatar`}
                alt=""
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <label aria-label={t('campaign:uploadAvatar')} className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 cursor-pointer transition-opacity">
                {uploading ? (
                  <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
            </div>
            <div>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="text-xl font-bold text-foreground bg-transparent border-none focus:outline-none focus:ring-0 w-full"
                placeholder={t('campaign:creatureNamePlaceholder')}
              />
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                isMob
                  ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                  : 'bg-accent/10 text-accent border border-accent/20'
              }`}>
                {isMob ? 'MOB' : 'NPC'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSaveAll} disabled={saving} className="btn-primary !py-2 !px-4">
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('campaign:saving')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {t('common:save')}
                </span>
              )}
            </button>
            <button onClick={onClose} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ─── Scrollable content ─── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* ── Details ── */}
          <section>
            <h3 className="header-accent mb-3">{t('campaign:details')}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('common:description')}</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                  placeholder={t('campaign:briefDescriptionOrAppearance')} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('campaign:notes')}</label>
                <textarea value={displayNotes} onChange={e => setNotes(isMob ? `[MOB] ${e.target.value}` : e.target.value)} rows={2}
                  className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                  placeholder={t('campaign:gmNotesPlaceholder')} />
              </div>
            </div>
          </section>

          {/* ── Health ── */}
          <section>
            <h3 className="header-accent mb-3">{t('campaign:health')}</h3>
            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('campaign:currentHp')}</label>
                <NumericInput value={hpCurrent ?? ''}
                  onChange={e => setHpCurrent(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                  wrapperClassName="w-full rounded-lg bg-input border border-border"
                  inputClassName="!w-full !bg-transparent !border-0 !px-3 !py-2 !text-sm !text-foreground focus:outline-none focus:ring-0"
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('campaign:maxHp')}</label>
                <NumericInput value={hpMax ?? ''}
                  onChange={e => setHpMax(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                  wrapperClassName="w-full rounded-lg bg-input border border-border"
                  inputClassName="!w-full !bg-transparent !border-0 !px-3 !py-2 !text-sm !text-foreground focus:outline-none focus:ring-0"
                />
              </div>
              <div className="flex-[2] min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('campaign:hpNotes')}</label>
                <input type="text" value={hpNotes} onChange={e => setHpNotes(e.target.value)}
                  className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                  placeholder={t('campaign:hpNotesPlaceholder')} />
              </div>
            </div>
          </section>

          {/* ── Attributes (with computed modifiers) ── */}
          {template && (
            <section>
              <h3 className="header-accent mb-3">{t('campaign:attributes')}</h3>
              {templateLoading ? (
                <div className="flex gap-2 flex-wrap">
                  {ATTRIBUTE_SKELETON_KEYS.map(k => (
                    <div key={k} className="skeleton h-24 w-20 rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="flex gap-3 flex-wrap">
                  {template.attributes.map(attr => {
                    const mod = modifierResults[attr.id]
                    let modDisplay: string | null = null
                    if (mod !== null && mod !== undefined) {
                      modDisplay = mod >= 0 ? `+${mod}` : String(mod)
                    }
                    return (
                      <div key={attr.id} className="flex flex-col items-center gap-1 min-w-[80px]">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{attr.name}</span>
                        <input type="text" value={attrValues[attr.id] ?? ''}
                          onChange={e => setAttrValues(p => ({ ...p, [attr.id]: e.target.value }))}
                          className="w-16 text-center rounded-lg bg-input border border-border px-2 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50" />
                        {mod !== null && mod !== undefined && (
                          <span className={`text-xs font-mono font-bold ${mod >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                            {modDisplay}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {/* ── Armor Class (single manual value) ── */}
          <section>
            <h3 className="header-accent mb-3">{t('campaign:armorClass')}</h3>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-muted-foreground">{t('campaign:acShort')}</label>
              <input type="text" value={acValue}
                onChange={e => setAcValue(e.target.value)}
                className="w-20 text-center rounded-lg bg-input border border-border px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50" />
            </div>
          </section>

          {/* ── Skills (manual name + value) ── */}
          {ability.summonSkills.length > 0 && (
            <section>
              <h3 className="header-accent mb-3">{t('campaign:skills')}</h3>
              {ability.summonSkills.map(skill => (
                <div key={skill.id} className="data-row">
                  <span className="text-sm font-medium text-foreground">{skill.name}</span>
                  <span className="text-sm font-mono font-bold text-right text-foreground">
                    {skill.manualValue >= 0 ? `+${skill.manualValue}` : String(skill.manualValue)}
                  </span>
                </div>
              ))}
            </section>
          )}

          {/* ── Abilities (child abilities with CRUD) ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="header-accent mb-0">{t('campaign:abilities')}</h3>
              <button onClick={() => setShowNewChildAbility(!showNewChildAbility)} className="btn-primary !py-1.5 !px-3 !text-xs">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {showNewChildAbility ? t('campaign:cancelSpaced') : t('campaign:addAbilitySpaced')}
              </button>
            </div>

            {/* New ability form */}
            {showNewChildAbility && (
              <form onSubmit={handleCreateChildAbility} className="card !p-4 mb-3 space-y-3 border-accent/30">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('campaign:nameRequired')}</label>
                    <input type="text" value={newChildAbilityForm.name}
                      onChange={e => setNewChildAbilityForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder={t('campaign:abilityNamePlaceholder')} required />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('common:description')}</label>
                    <textarea value={newChildAbilityForm.description}
                      onChange={e => setNewChildAbilityForm(p => ({ ...p, description: e.target.value }))} rows={2}
                      className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                      placeholder={t('campaign:whatDoesAbilityDo')} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('campaign:manaCost')}</label>
                    <NumericInput value={newChildAbilityForm.manaCost}
                      onChange={e => setNewChildAbilityForm(p => ({ ...p, manaCost: e.target.value }))}
                      className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      wrapperClassName="w-full rounded-lg bg-input border border-border"
                      inputClassName="!w-full !bg-transparent !border-0 !px-3 !py-2 !text-sm !text-foreground focus:outline-none focus:ring-0"
                      placeholder={t('campaign:mp')} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('campaign:range')}</label>
                    <input type="text" value={newChildAbilityForm.range}
                      onChange={e => setNewChildAbilityForm(p => ({ ...p, range: e.target.value }))}
                      className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder={t('campaign:rangePlaceholder')} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('campaign:damage')}</label>
                    <input type="text" value={newChildAbilityForm.damage}
                      onChange={e => setNewChildAbilityForm(p => ({ ...p, damage: e.target.value }))}
                      className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder={t('campaign:damagePlaceholder')} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('campaign:initialLevel')}</label>
                    <input type="text" value={newChildAbilityForm.level}
                      onChange={e => setNewChildAbilityForm(p => ({ ...p, level: e.target.value }))}
                      className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder={t('campaign:initialLevelPlaceholder')} />
                  </div>
                </div>
                {childAbilityError && (
                  <div className="rounded bg-danger/10 border border-danger/30 px-3 py-2 text-xs text-danger">{childAbilityError}</div>
                )}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowNewChildAbility(false)} className="btn-ghost !py-1.5 !text-xs">{t('common:cancel')}</button>
                  <button type="submit" disabled={childAbilitySaving} className="btn-primary !py-1.5 !text-xs">
                    {childAbilitySaving ? t('campaign:creating') : t('campaign:createAbility')}
                  </button>
                </div>
              </form>
            )}

            {/* Child ability list */}
            {childAbilities.length === 0 && !showNewChildAbility && (
              <p className="text-sm text-muted-foreground italic">{t('campaign:noAbilitiesDefinedYet')}</p>
            )}
            <div className="space-y-2">
              {childAbilities.map(child => {
                const isExpanded = expandedChildren[child.id] ?? false
                const hasLevels = child.levels && child.levels.length > 0
                return (
                  <div key={child.id} className="card !p-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setExpandedChildren(p => ({ ...p, [child.id]: !isExpanded }))}
                        className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors">
                        <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <input type="text" value={child.name}
                        onChange={e => saveChildAbilityField(child.id, 'name', e.target.value)}
                        className="flex-1 text-sm font-semibold text-foreground bg-transparent border-none focus:outline-none focus:ring-0"
                        placeholder={t('campaign:abilityNamePlaceholder')} />
                      <button onClick={() => handleDeleteChildAbility(child.id)}
                        className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        aria-label={t('campaign:deleteNamed', { name: child.name })}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 space-y-3 pl-5">
                        <textarea value={child.description ?? ''}
                          onChange={e => saveChildAbilityField(child.id, 'description', e.target.value)}
                          rows={2}
                          className="w-full rounded-lg bg-input border border-border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                          placeholder={t('campaign:abilityDescriptionPlaceholder')} />

                        {/* Levels */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">{t('campaign:levels')}</span>
                            <button onClick={() => handleAddLevel(child.id)} disabled={addingLevel === child.id}
                              className="btn-ghost !py-0.5 !px-2 !text-[10px]">
                              {addingLevel === child.id ? '...' : t('campaign:addLevel')}
                            </button>
                          </div>
                          {!hasLevels && <p className="text-xs text-muted-foreground italic">{t('campaign:noLevelsYet')}</p>}
                          {hasLevels && (
                            <div className="space-y-2">
                              {child.levels.map(level => (
                                <div key={level.id} className="rounded bg-surface border border-border p-2 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <input type="text" value={level.level}
                                      onChange={e => handleSaveLevelField(child.id, level.id, 'level', e.target.value)}
                                      className="w-12 text-center text-xs font-bold text-foreground bg-input border border-border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent/50"
                                      placeholder={t('campaign:levelShort')} />
                                    <button onClick={() => handleDeleteLevel(child.id, level.id)}
                                      className="p-0.5 rounded text-muted-foreground hover:text-red-500 transition-colors">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                  <div className="flex gap-2 flex-wrap">
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-muted-foreground">{t('campaign:mpColon')}</span>
                                      <input type="text" value={level.manaCost ?? ''}
                                        onChange={e => handleSaveLevelField(child.id, level.id, 'manaCost', e.target.value)}
                                        className="w-12 text-center text-xs font-mono text-foreground bg-input border border-border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent/50" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-muted-foreground">{t('campaign:rangeColon')}</span>
                                      <input type="text" value={level.range ?? ''}
                                        onChange={e => handleSaveLevelField(child.id, level.id, 'range', e.target.value)}
                                        className="w-14 text-center text-xs font-mono text-foreground bg-input border border-border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent/50" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-muted-foreground">{t('campaign:dmgColon')}</span>
                                      <input type="text" value={level.damage ?? ''}
                                        onChange={e => handleSaveLevelField(child.id, level.id, 'damage', e.target.value)}
                                        className="w-14 text-center text-xs font-mono text-foreground bg-input border border-border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent/50" />
                                    </div>
                                  </div>
                                  <textarea value={level.description ?? ''}
                                    onChange={e => handleSaveLevelField(child.id, level.id, 'description', e.target.value)}
                                    rows={1}
                                    className="w-full rounded bg-input border border-border px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50 resize-none"
                                    placeholder={t('campaign:levelDescriptionPlaceholder')} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Bottom spacing */}
          <div className="h-8" />
        </div>
      </div>
    </>
  )
}
