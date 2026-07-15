'use client'

import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { api, API_URL } from '@/lib/api'

/* ── Types (mirroring the backend for type safety) ── */

interface TemplateAttribute {
  id: string; key: string; name: string
}
interface ArmorClassField {
  id: string; name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string | null
}
interface ArmorClassAttributeModifier {
  id: string; attributeId: string; allowPlayerSelection: boolean; defaultAttributeId: string | null
  attribute: { id: string; key: string; name: string }
  defaultAttribute: { id: string; key: string; name: string } | null
}
interface TemplateArmorClass {
  id: string; name: string; enabled: boolean
  fields: ArmorClassField[]
  attributeModifiers: ArmorClassAttributeModifier[]
}
interface TemplateSkill {
  id: string; name: string; description: string | null; attributeId: string | null
  allowedAttributeIds: string[]; defaultAttributeId: string | null
  attribute: { id: string; key: string; name: string } | null
  defaultAttribute: { id: string; key: string; name: string } | null
}
interface SkillModifierProfile {
  id: string; name: string; targetMode: string; targetSkillIds: string[]
  options: { id: string; label: string; value: number }[]
}
interface ResistanceComponent {
  id: string; name: string; editableByPlayer: boolean; defaultValue: string
}
interface ResistanceAttributeModifier {
  id: string; attributeId: string; enabled: boolean
  attribute: { id: string; key: string; name: string }
}
interface TemplateResistance {
  id: string; name: string; calculationType: string; order: number
  components: ResistanceComponent[]
  attributeModifiers: ResistanceAttributeModifier[]
}
interface Template {
  id: string; name: string; description: string | null
  attributeModifierFormula: string | null; skillFormula: string | null
  attributes: TemplateAttribute[]
  templateFields: { id: string; key: string; label: string }[]
  templateSkills: TemplateSkill[]
  skillModifierProfiles: SkillModifierProfile[]
  coreResources: { id: string; slug: string; displayName: string }[]
  armorClasses: TemplateArmorClass[]
  characterSections: { id: string; name: string }[]
  resistances: TemplateResistance[]
}

interface SummonAttribute {
  id: string; abilityId: string; attributeId: string; value: string
}
interface SummonSkillProfileValue {
  profileId: string; optionId: string | null
  profile: { id: string; name: string; targetMode: string; targetSkillIds: string[] }
  option: { id: string; label: string; value: number } | null
}
interface SummonSkill {
  id: string; skillId: string; selectedAttributeId: string | null
  skill: {
    id: string; name: string; description: string | null; attributeId: string | null
    allowedAttributeIds: string[]; defaultAttributeId: string | null
    attribute: { id: string; key: string; name: string } | null
    defaultAttribute: { id: string; key: string; name: string } | null
  }
  selectedAttribute: { id: string; key: string; name: string } | null
  profileValues: SummonSkillProfileValue[]
}
interface SummonAcAttributeValue {
  id: string; acAttributeModifierId: string; selectedAttributeId: string | null
  selectedAttribute: { id: string; key: string; name: string } | null
}

interface CreatureAbility {
  id: string; name: string; type: string; description: string | null; notes: string | null
  sheetId: string
  summonAttributes: SummonAttribute[]
  summonAcValues: { id: string; abilityId: string; fieldId: string; value: string }[]
  summonAcAttributeValues: SummonAcAttributeValue[]
  summonHealth: { id: string; abilityId: string; current: number | null; maximum: number | null; notes: string | null } | null
  summonResistanceValues: { id: string; resistanceId: string; manualValue: string | null }[]
  summonResistanceComponentValues: { id: string; componentId: string; value: string }[]
  summonSkills: SummonSkill[]
  childAbilities: CreatureAbility[]
  levels: { id: string; level: string; description: string | null; manaCost: number | null; range: string | null; notes: string | null; damage: string | null }[]
}

/* ── Props ── */

interface CreatureDrawerProps {
  ability: CreatureAbility | null
  sheetId: string | null
  onClose: () => void
  onUpdate: () => void
}

/* ── Component ── */

export function CreatureDrawer({ ability, sheetId, onClose, onUpdate }: CreatureDrawerProps) {
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
  const [acValues, setAcValues] = useState<Record<string, string>>({})
  const [resistValues, setResistValues] = useState<Record<string, string | null>>({})
  const [resistComponentValues, setResistComponentValues] = useState<Record<string, string>>({})

  /* Copy ability data into local state when it changes */
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
    const acv: Record<string, string> = {}
    for (const sa of ability.summonAcValues) acv[sa.fieldId] = sa.value
    setAcValues(acv)
    const rv: Record<string, string | null> = {}
    for (const sr of ability.summonResistanceValues) rv[sr.resistanceId] = sr.manualValue
    setResistValues(rv)
    const rcv: Record<string, string> = {}
    for (const sc of ability.summonResistanceComponentValues) rcv[sc.componentId] = sc.value
    setResistComponentValues(rcv)
  }, [ability])

  /* Fetch template */
  useEffect(() => {
    if (!ability || !sheetId) return
    setTemplateLoading(true)
    api.get<Template>(`/character-sheets/${sheetId}`)
      .then(sheet => {
        const tplId = (sheet as any).templateId
        if (tplId) {
          return api.get<Template>(`/adventures/${(sheet as any).adventureId}/templates/${tplId}`)
        }
        return null
      })
      .then(tpl => {
        if (tpl) setTemplate(tpl)
      })
      .catch(() => {
        /* If we can't fetch the template, attributes etc. still show raw IDs */
      })
      .finally(() => setTemplateLoading(false))
  }, [ability, sheetId])

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

      /* Save attribute values */
      for (const [attributeId, value] of Object.entries(attrValues)) {
        await api.patch(`/character-sheets/${sheetId}/abilities/${ability.id}/summon-attributes/${attributeId}`, { value })
      }

      /* Save AC values */
      for (const [fieldId, value] of Object.entries(acValues)) {
        await api.patch(`/character-sheets/${sheetId}/abilities/${ability.id}/summon-ac/${fieldId}`, { value })
      }

      /* Save resistance component values */
      for (const [componentId, value] of Object.entries(resistComponentValues)) {
        await api.patch(`/character-sheets/${sheetId}/abilities/${ability.id}/summon-resistance-components/${componentId}`, { value })
      }

      /* Save resistance manual values */
      for (const [resistanceId, value] of Object.entries(resistValues)) {
        await api.patch(`/character-sheets/${sheetId}/abilities/${ability.id}/summon-resistances/${resistanceId}`, { value })
      }

      onUpdate()
    } catch {
      /* silently fail */
    } finally {
      setSaving(false)
    }
  }, [ability, sheetId, saveAbilityMetadata, saveHealth, attrValues, acValues, resistValues, resistComponentValues, onUpdate])

  /* ── Avatar upload ── */
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !ability) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const token = localStorage.getItem('accessToken')
      await fetch(`${API_URL}/images/abilities/${ability.id}/avatar`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      // Force re-render by toggling a key on the img
      setAvatarKey(k => k + 1)
    } catch {
      /* silently fail */
    } finally {
      setUploading(false)
    }
  }
  const [avatarKey, setAvatarKey] = useState(0)

  /* ── Helpers ── */

  function findAttr(id: string): TemplateAttribute | undefined {
    return template?.attributes.find(a => a.id === id)
  }

  function findAcField(fieldId: string): ArmorClassField | undefined {
    return template?.armorClasses.flatMap(ac => ac.fields).find(f => f.id === fieldId)
  }

  function findResistance(id: string): TemplateResistance | undefined {
    return template?.resistances.find(r => r.id === id)
  }

  function findResistanceComponent(id: string) {
    for (const r of template?.resistances ?? []) {
      const c = r.components.find(c => c.id === id)
      if (c) return { ...c, resistanceName: r.name }
    }
    return null
  }

  /* ── Render ── */
  if (!ability) return null

  const isMob = ability.notes?.startsWith('[MOB]')
  const displayNotes = isMob ? (ability.notes?.replace(/^\[MOB\]\s*/, '') ?? '') : (ability.notes ?? '')

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed top-0 right-0 z-50 h-full w-[70vw] max-w-[900px] min-w-[400px] bg-surface border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-surface border border-border shrink-0">
              <img
                key={avatarKey}
                src={`${API_URL}/images/abilities/${ability.id}/avatar`}
                alt=""
                className="w-full h-full object-cover"
                onError={e => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 cursor-pointer transition-opacity">
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
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </label>
            </div>

            <div>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="text-xl font-bold text-foreground bg-transparent border-none focus:outline-none focus:ring-0 w-full"
                placeholder="Creature name"
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
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="btn-primary !py-2 !px-4"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Save
                </span>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Description & Notes */}
          <section>
            <h3 className="header-accent mb-3">Details</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                  placeholder="Brief description or appearance..."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
                <textarea
                  value={displayNotes}
                  onChange={e => setNotes(isMob ? `[MOB] ${e.target.value}` : e.target.value)}
                  rows={2}
                  className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                  placeholder="GM notes..."
                />
              </div>
            </div>
          </section>

          {/* Health */}
          <section>
            <h3 className="header-accent mb-3">Health</h3>
            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Current HP</label>
                <input
                  type="number"
                  value={hpCurrent ?? ''}
                  onChange={e => setHpCurrent(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Max HP</label>
                <input
                  type="number"
                  value={hpMax ?? ''}
                  onChange={e => setHpMax(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div className="flex-[2] min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">HP Notes</label>
                <input
                  type="text"
                  value={hpNotes}
                  onChange={e => setHpNotes(e.target.value)}
                  className="w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                  placeholder="e.g. temp HP, damage resistance..."
                />
              </div>
            </div>
          </section>

          {/* Attributes */}
          {template && (
            <section>
              <h3 className="header-accent mb-3">Attributes</h3>
              {templateLoading ? (
                <div className="flex gap-2 flex-wrap">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="skeleton h-20 w-20 rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="flex gap-3 flex-wrap">
                  {template.attributes.map(attr => (
                    <div key={attr.id} className="flex flex-col items-center gap-1 min-w-[80px]">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{attr.name}</span>
                      <input
                        type="text"
                        value={attrValues[attr.id] ?? ''}
                        onChange={e => setAttrValues(p => ({ ...p, [attr.id]: e.target.value }))}
                        className="w-16 text-center rounded-lg bg-input border border-border px-2 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Armor Class */}
          {template && template.armorClasses.filter(ac => ac.enabled).length > 0 && (
            <section>
              <h3 className="header-accent mb-3">Armor Class</h3>
              {template.armorClasses.filter(ac => ac.enabled).map(ac => (
                <div key={ac.id} className="card !p-4 mb-3">
                  <h4 className="text-sm font-semibold text-foreground mb-2">{ac.name}</h4>
                  <div className="flex gap-3 flex-wrap">
                    {/* Attribute modifiers (read-only display) */}
                    {ac.attributeModifiers.map(mod => {
                      const selected = ability.summonAcAttributeValues.find(
                        v => v.acAttributeModifierId === mod.id
                      )
                      const attrName = selected?.selectedAttribute?.name ?? mod.attribute.name
                      return (
                        <div key={mod.id} className="flex flex-col items-center gap-1 min-w-[70px]">
                          <span className="text-xs text-muted-foreground">{attrName}</span>
                          <span className="w-12 text-center rounded bg-surface border border-border px-2 py-1.5 text-xs font-mono text-foreground">
                            {attrValues[mod.attributeId] || '—'}
                          </span>
                        </div>
                      )
                    })}
                    {/* Editable fields */}
                    {ac.fields.map(field => (
                      <div key={field.id} className="flex flex-col items-center gap-1 min-w-[80px]">
                        <span className="text-xs text-muted-foreground">{field.name}</span>
                        <input
                          type="text"
                          value={acValues[field.id] ?? field.defaultValue}
                          onChange={e => setAcValues(p => ({ ...p, [field.id]: e.target.value }))}
                          className="w-16 text-center rounded-lg bg-input border border-border px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Resistances */}
          {template && template.resistances.length > 0 && (
            <section>
              <h3 className="header-accent mb-3">Resistances</h3>
              <div className="space-y-2">
                {template.resistances.map(r => (
                  <div key={r.id} className="card !p-3 flex items-center gap-4">
                    <span className="text-sm font-medium text-foreground min-w-[100px]">{r.name}</span>
                    {r.components.map(c => (
                      <div key={c.id} className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">{c.name}:</span>
                        <input
                          type="text"
                          value={resistComponentValues[c.id] ?? c.defaultValue}
                          onChange={e => setResistComponentValues(p => ({ ...p, [c.id]: e.target.value }))}
                          className="w-16 text-center rounded bg-input border border-border px-1.5 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
                        />
                      </div>
                    ))}
                    {r.calculationType === 'MANUAL' && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-xs text-muted-foreground">Manual:</span>
                        <input
                          type="text"
                          value={resistValues[r.id] ?? ''}
                          onChange={e => setResistValues(p => ({ ...p, [r.id]: e.target.value || null }))}
                          className="w-16 text-center rounded bg-input border border-border px-1.5 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Skills */}
          {template && template.templateSkills.length > 0 && (
            <section>
              <h3 className="header-accent mb-3">Skills</h3>
              {template.templateSkills.map(skill => {
                const summonSkill = ability.summonSkills.find(s => s.skillId === skill.id)
                const selectedAttr = summonSkill?.selectedAttribute
                const profileValue = summonSkill?.profileValues?.[0]
                return (
                  <div key={skill.id} className="data-row">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-foreground">{skill.name}</span>
                      {selectedAttr && (
                        <span className="text-xs text-muted-foreground">({selectedAttr.name})</span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground text-right">
                      {profileValue?.option ? profileValue.option.label : '—'}
                    </span>
                  </div>
                )
              })}
            </section>
          )}

          {/* Abilities (child abilities on the summon) */}
          {ability.childAbilities.length > 0 && (
            <section>
              <h3 className="header-accent mb-3">Abilities</h3>
              <div className="space-y-2">
                {ability.childAbilities.map(child => (
                  <div key={child.id} className="card !p-3">
                    <h4 className="text-sm font-semibold text-foreground">{child.name}</h4>
                    {child.description && (
                      <p className="text-xs text-muted-foreground mt-1">{child.description}</p>
                    )}
                    {child.levels.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {child.levels.map(l => (
                          <div key={l.id} className="text-xs text-muted-foreground">
                            <span className="font-medium">Lv.{l.level}</span>
                            {l.manaCost != null && <span> · {l.manaCost} MP</span>}
                            {l.range && <span> · Range: {l.range}</span>}
                            {l.damage && <span> · Damage: {l.damage}</span>}
                            {l.description && <p className="mt-0.5">{l.description}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bottom spacing */}
          <div className="h-8" />
        </div>
      </div>
    </>
  )
}
