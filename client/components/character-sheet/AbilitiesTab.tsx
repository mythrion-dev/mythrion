'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { InlineText, InlineNumber } from '@/lib/inline-editable'
import { InlineClickEdit } from '@/components/character-sheet'
import type { Ability, AbilityLevel, SummonTab, CharacterSheet } from './types'
import type { FormEvent } from 'react'

export function AbilitiesTab({
  abilities, isOwner, sheetId, template,
  selectedLevels, setAbilities, setSelectedLevels,
  showNewAbility, setShowNewAbility,
  searchQuery, setSearchQuery,
  newAbilityType, setNewAbilityType,
  newAbility, setNewAbility,
  abilitySaving, abilityError,
  handleCreateAbility, resetNewAbility,
  handleDeleteAbility,
  showAddLevelModal, setShowAddLevelModal,
  newLevelForm, setNewLevelForm,
  levelModalSaving, setLevelModalSaving,
  levelModalError, setLevelModalError,
  expandedAbilities, setExpandedAbilities,
  summonModifierResults, summonAcResults,
  saveSummonAttribute, saveSummonAcValue, saveSummonHealth,
  summonTabs, setSummonTabs,
  summonSkillResults,
  handleAddSummonSkill, handleRemoveSummonSkill,
  handleSummonSkillAttributeChange, handleSummonSkillProfileChange,
  handleCreateSummonAbility,
}: {
  abilities: Ability[]; isOwner: boolean; sheetId: string
  template: CharacterSheet['template']
  selectedLevels: Record<string, string>; setAbilities: React.Dispatch<React.SetStateAction<Ability[]>>
  setSelectedLevels: React.Dispatch<React.SetStateAction<Record<string, string>>>
  showNewAbility: boolean; setShowNewAbility: React.Dispatch<React.SetStateAction<boolean>>
  newAbilityType: 'ABILITY' | 'SUMMON' | null; setNewAbilityType: React.Dispatch<React.SetStateAction<'ABILITY' | 'SUMMON' | null>>
  newAbility: { name: string; description: string; manaCost: string; range: string; notes: string; damage: string }
  setNewAbility: React.Dispatch<React.SetStateAction<{ name: string; description: string; manaCost: string; range: string; notes: string; damage: string }>>
  abilitySaving: boolean; abilityError: string | null
  handleCreateAbility: (e: FormEvent) => Promise<void>; resetNewAbility: () => void
  handleDeleteAbility: (aid: string) => Promise<void>
  showAddLevelModal: string | null; setShowAddLevelModal: React.Dispatch<React.SetStateAction<string | null>>
  newLevelForm: { level: number | string; copyFromPrevious: boolean }; setNewLevelForm: React.Dispatch<React.SetStateAction<{ level: number | string; copyFromPrevious: boolean }>>
  levelModalSaving: boolean; setLevelModalSaving: React.Dispatch<React.SetStateAction<boolean>>
  levelModalError: string | null; setLevelModalError: React.Dispatch<React.SetStateAction<string | null>>
  expandedAbilities: Record<string, boolean>; setExpandedAbilities: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  searchQuery: string; setSearchQuery: React.Dispatch<React.SetStateAction<string>>
  summonModifierResults: Record<string, Record<string, number | null>>
  summonAcResults: Record<string, number | null>
  saveSummonAttribute: (abilityId: string, attributeId: string, value: string) => Promise<void>
  saveSummonAcValue: (abilityId: string, fieldId: string, value: string) => Promise<void>
  saveSummonHealth: (abilityId: string, field: 'current' | 'maximum', value: number | null) => Promise<void>
  summonTabs: Record<string, SummonTab>; setSummonTabs: React.Dispatch<React.SetStateAction<Record<string, SummonTab>>>
  summonSkillResults: Record<string, Record<string, number | null>>
  handleAddSummonSkill: (abilityId: string, skillId: string) => Promise<void>
  handleRemoveSummonSkill: (abilityId: string, summonSkillId: string) => Promise<void>
  handleSummonSkillAttributeChange: (abilityId: string, summonSkillId: string, attributeId: string | null) => Promise<void>
  handleSummonSkillProfileChange: (abilityId: string, summonSkillId: string, profileId: string, optionId: string | null) => Promise<void>
  handleCreateSummonAbility: (summonId: string, e: FormEvent) => Promise<void>
}) {
  const [confirmDeleteAbility, setConfirmDeleteAbility] = useState<string | null>(null)
  const [confirmDeleteLevel, setConfirmDeleteLevel] = useState<string | null>(null)
  const [deletingAbility, setDeletingAbility] = useState(false)
  const [deletingLevel, setDeletingLevel] = useState(false)

  // Summon skill search state per summon
  const [skillSearchOpen, setSkillSearchOpen] = useState<string | null>(null)
  const [skillSearchQuery, setSkillSearchQuery] = useState('')

  // Summon-scoped ability creation state
  const [showNewSummonAbility, setShowNewSummonAbility] = useState<string | null>(null)

  const toggleExpand = (aid: string) => setExpandedAbilities(prev => ({ ...prev, [aid]: !prev[aid] }))

  function getSelectedLevel(ability: Ability): AbilityLevel | undefined {
    const selId = selectedLevels[ability.id]
    if (selId) return ability.levels.find(l => l.id === selId)
    return ability.levels[ability.levels.length - 1]
  }

  async function handleAddLevel(abilityId: string) {
    if (!sheetId) return
    setLevelModalSaving(true)
    try {
      const level = await api.post<AbilityLevel>(`/character-sheets/${sheetId}/abilities/${abilityId}/levels`, { level: newLevelForm.level, copyFromPrevious: newLevelForm.copyFromPrevious })
      setAbilities(prev => prev.map(a => a.id === abilityId ? { ...a, levels: [...a.levels, level] } : a))
      setSelectedLevels(prev => ({ ...prev, [abilityId]: level.id }))
      setShowAddLevelModal(null)
    } catch (err) { setLevelModalError(err instanceof Error ? err.message : 'Failed to create level') }
    finally { setLevelModalSaving(false) }
  }

  const armorClasses = template.armorClasses?.filter(ac => ac.enabled) ?? []
  const allTemplateSkills = template.templateSkills ?? []

  const summonSkillTabClass = (aid: string, t: SummonTab) => {
    const active = summonTabs[aid] ?? 'stats'
    return `px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${active === t ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted hover:text-foreground'}`
  }

  const q = searchQuery.toLowerCase()
  const filteredAbilities = q ? abilities.filter(a => a.name.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q) || (a.type || '').toLowerCase().includes(q)) : abilities

  return (
    <div className="space-y-4">
      <div className="relative">
        <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input className="input-field pl-8 py-1.5 text-sm w-full" placeholder="Search abilities & summons..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>
      {filteredAbilities.length === 0 && !showNewAbility && searchQuery && (
        <div className="text-center py-4 text-muted-foreground text-sm italic">No entries match your search.</div>
      )}
      {(!abilities || abilities.length === 0) && !showNewAbility && !searchQuery && (
        <div className="text-center py-6 text-muted-foreground text-sm italic">
          No abilities or summons yet. {isOwner && 'Create one below.'}
        </div>
      )}

      <div className="space-y-3">
        {filteredAbilities.map(a => {
          const isExpanded = expandedAbilities[a.id] ?? false
          const isAbility = a.type !== 'SUMMON'
          const selLevel = isAbility ? getSelectedLevel(a) : undefined
          const currentSummonTab = summonTabs[a.id] ?? 'stats'

          return (
            <div key={a.id} className={`card !p-0 overflow-hidden transition-all duration-200 ${isExpanded ? 'border-primary/20' : ''}`}>
              <button
                type="button"
                onClick={() => toggleExpand(a.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-foreground/5 transition-colors"
              >
                <svg className={`w-4 h-4 text-muted transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
                <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-foreground truncate">{a.name}</span>
                  <span className={`badge text-xs ${isAbility ? 'badge-gold' : 'badge-gold'} opacity-70`}>
                    {isAbility ? 'Ability' : 'Summon'}
                  </span>
                  {isAbility && selLevel && (
                    <span className="text-[0.65rem] text-muted">Level {selLevel.level}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                  {isAbility && a.levels.length > 0 && (
                    <select
                      className="input-field py-0.5 px-2 text-xs"
                      value={selLevel?.id ?? ''}
                      onChange={e => setSelectedLevels(prev => ({ ...prev, [a.id]: e.target.value }))}
                    >
                      {a.levels.map(l => <option key={l.id} value={l.id}>Level {l.level}</option>)}
                    </select>
                  )}
                  {isOwner && (
                    <button
                      onClick={() => setConfirmDeleteAbility(a.id)}
                      className="text-xs text-danger hover:text-danger/80 px-1 py-1 transition-colors"
                      title={`Delete ${isAbility ? 'ability' : 'summon'}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border animate-fade-in">
                  {isAbility && selLevel ? (
                    <>
                      {isOwner && a.levels.length > 1 && (
                        <div className="flex justify-end pt-3">
                          <button onClick={() => setConfirmDeleteLevel(selLevel.id)} className="text-[0.6rem] text-danger/70 hover:text-danger px-1 py-0.5 transition-colors">
                            Delete Level {selLevel.level}
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-muted">
                        {isOwner ? (
                          <>
                            <span className="inline-flex items-center gap-1">Mana: <InlineClickEdit value={selLevel.manaCost?.toString() ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${selLevel.id}`, { manaCost: v.trim() ? parseInt(v, 10) : null }); setAbilities(prev => prev.map(ab => ({ ...ab, levels: ab.levels.map(l => l.id === selLevel.id ? { ...l, manaCost: v.trim() ? parseInt(v, 10) : null } : l) }))) } catch {} }} className="!text-xs !text-muted" inputClassName="!text-xs w-16" emptyDisplay="—" /></span>
                            <span className="inline-flex items-center gap-1">Range: <InlineClickEdit value={selLevel.range ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${selLevel.id}`, { range: v.trim() || null }); setAbilities(prev => prev.map(ab => ({ ...ab, levels: ab.levels.map(l => l.id === selLevel.id ? { ...l, range: v.trim() || null } : l) }))) } catch {} }} className="!text-xs !text-muted" inputClassName="!text-xs w-20" emptyDisplay="—" /></span>
                            {selLevel.damage != null && <span className="inline-flex items-center gap-1">Damage: <InlineClickEdit value={selLevel.damage ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${selLevel.id}`, { damage: v.trim() || null }); setAbilities(prev => prev.map(ab => ({ ...ab, levels: ab.levels.map(l => l.id === selLevel.id ? { ...l, damage: v.trim() || null } : l) }))) } catch {} }} className="!text-xs !text-muted" inputClassName="!text-xs w-16" emptyDisplay="—" /></span>}
                          </>
                        ) : (
                          <>
                            {selLevel.manaCost != null && <span>Mana: {selLevel.manaCost}</span>}
                            {selLevel.range && <span>Range: {selLevel.range}</span>}
                            {selLevel.damage && <span>Damage: {selLevel.damage}</span>}
                          </>
                        )}
                      </div>
                      {isOwner ? (
                        <>
                          <div><h5 className="text-xs font-medium text-muted mb-1">Description</h5><InlineClickEdit value={selLevel.description ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${selLevel.id}`, { description: v.trim() || null }); setAbilities(prev => prev.map(ab => ({ ...ab, levels: ab.levels.map(l => l.id === selLevel.id ? { ...l, description: v.trim() || null } : l) }))) } catch {} }} as="textarea" className="text-sm text-muted-foreground whitespace-pre-wrap" emptyDisplay="Add description..." /></div>
                          <div><h5 className="text-xs font-medium text-muted mb-1">Notes</h5><InlineClickEdit value={selLevel.notes ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${selLevel.id}`, { notes: v.trim() || null }); setAbilities(prev => prev.map(ab => ({ ...ab, levels: ab.levels.map(l => l.id === selLevel.id ? { ...l, notes: v.trim() || null } : l) }))) } catch {} }} as="textarea" className="text-xs text-muted italic whitespace-pre-wrap" emptyDisplay="Add notes..." /></div>
                        </>
                      ) : (
                        <>
                          {selLevel.description && <div><h5 className="text-xs font-medium text-muted mb-1">Description</h5><p className="text-sm text-muted-foreground whitespace-pre-wrap">{selLevel.description}</p></div>}
                          {selLevel.notes && <div><h5 className="text-xs font-medium text-muted mb-1">Notes</h5><p className="text-xs text-muted italic whitespace-pre-wrap">{selLevel.notes}</p></div>}
                        </>
                      )}

                      {isOwner && (
                        <button
                          onClick={() => { setShowAddLevelModal(a.id); setNewLevelForm({ level: a.levels.length + 1, copyFromPrevious: a.levels.length > 0 }); setLevelModalError(null) }}
                          className="btn-ghost text-xs"
                        >
                          + Add Level
                        </button>
                      )}
                    </>
                  ) : isAbility && !selLevel ? (
                    <p className="text-xs text-muted italic pt-2">No levels added yet.</p>
                  ) : null}

                  {!isAbility && (
                    <div className="pt-2">
                      <div className="flex gap-1 mb-3 border-b border-border pb-2">
                        <button type="button" onClick={() => setSummonTabs(prev => ({ ...prev, [a.id]: 'stats' }))} className={summonSkillTabClass(a.id, 'stats')}>Stats</button>
                        <button type="button" onClick={() => setSummonTabs(prev => ({ ...prev, [a.id]: 'skills' }))} className={summonSkillTabClass(a.id, 'skills')}>Skills</button>
                        <button type="button" onClick={() => setSummonTabs(prev => ({ ...prev, [a.id]: 'abilities' }))} className={summonSkillTabClass(a.id, 'abilities')}>Abilities</button>
                      </div>

                      {currentSummonTab === 'stats' && <div className="space-y-3">
                        <div className="space-y-2">
                          {isOwner ? (
                            <>
                              <div><h5 className="text-xs font-medium text-muted mb-1">Description</h5><InlineClickEdit value={a.description ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/${a.id}`, { description: v.trim() || null }); setAbilities(prev => prev.map(ab => ab.id === a.id ? { ...ab, description: v.trim() || null } : ab)) } catch {} }} as="textarea" className="text-sm text-muted-foreground whitespace-pre-wrap" emptyDisplay="Add description..." /></div>
                              <div><h5 className="text-xs font-medium text-muted mb-1">Notes</h5><InlineClickEdit value={a.notes ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/${a.id}`, { notes: v.trim() || null }); setAbilities(prev => prev.map(ab => ab.id === a.id ? { ...ab, notes: v.trim() || null } : ab)) } catch {} }} as="textarea" className="text-xs text-muted italic whitespace-pre-wrap" emptyDisplay="Add notes..." /></div>
                            </>
                          ) : (
                            <>
                              {a.description && <div><h5 className="text-xs font-medium text-muted mb-1">Description</h5><p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.description}</p></div>}
                              {a.notes && <div><h5 className="text-xs font-medium text-muted mb-1">Notes</h5><p className="text-xs text-muted italic whitespace-pre-wrap">{a.notes}</p></div>}
                            </>
                          )}
                        </div>

                        {a.summonHealth && (
                          <div className="card !p-3 !bg-background/30">
                            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Health</h4>
                            <div className="flex items-center justify-center gap-3">
                              <div className="text-center">
                                <span className="text-muted text-xs block">Current</span>
                                {isOwner ? (
                                  <InlineNumber value={a.summonHealth.current ?? 0} onSave={(v) => saveSummonHealth(a.id, 'current', v)} min={0} className="text-xl font-bold text-foreground" />
                                ) : (
                                  <span className="text-xl font-bold text-foreground">{a.summonHealth.current ?? '—'}</span>
                                )}
                              </div>
                              <span className="text-muted text-lg">/</span>
                              <div className="text-center">
                                <span className="text-muted text-xs block">Max</span>
                                {isOwner ? (
                                  <InlineNumber value={a.summonHealth.maximum ?? 0} onSave={(v) => saveSummonHealth(a.id, 'maximum', v)} min={0} className="text-xl font-bold text-foreground" />
                                ) : (
                                  <span className="text-xl font-bold text-foreground">{a.summonHealth.maximum ?? '—'}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {(a.summonAttributes ?? []).length > 0 && (
                          <div className="card !p-3 !bg-background/30">
                            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Attributes</h4>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {a.summonAttributes.map(sa => {
                                const attr = template.attributes.find(at => at.id === sa.attributeId)
                                if (!attr) return null
                                const modResult = (summonModifierResults[a.id] ?? {})[attr.id]
                                return (
                                  <div key={sa.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-background/50 border border-border">
                                    <span className="text-sm text-foreground">{attr.name}</span>
                                    <div className="flex items-center gap-2">
                                      {isOwner ? (
                                        <InlineText value={sa.value} onSave={(v) => saveSummonAttribute(a.id, sa.attributeId, v)} className="text-sm font-semibold text-foreground" />
                                      ) : (
                                        <span className="text-sm font-semibold text-foreground">{sa.value || '—'}</span>
                                      )}
                                      {template.attributeModifiersEnabled !== false && modResult !== undefined && modResult !== null && (
                                        <span className="text-sm font-semibold text-primary">({modResult >= 0 ? '+' : ''}{modResult})</span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {armorClasses.map(ac => ((a.summonAcValues ?? []).length > 0) ? (
                          <div key={ac.id} className="card !p-3 !bg-background/30">
                            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Armor Class: {(ac as any).name ?? 'AC'}</h4>
                            <div className="flex items-center justify-center mb-3">
                              <div className="w-20 h-20 rounded-full border-3 border-primary/30 flex items-center justify-center bg-background/50">
                                <span className="text-3xl font-bold text-primary">{summonAcResults[a.id] !== null && summonAcResults[a.id] !== undefined ? summonAcResults[a.id] : '—'}</span>
                              </div>
                            </div>
                            {ac.fields.map(field => {
                              const acv = a.summonAcValues.find(v => v.fieldId === field.id)
                              const val = acv?.value ?? field.defaultValue
                              const canEdit = isOwner && field.editableByPlayer
                              return (
                                <div key={field.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-background/50 border border-border mb-1">
                                  <div className="flex items-center gap-1 min-w-0">
                                    <span className="text-sm text-foreground truncate">{field.name}</span>
                                    {field.description && <span className="text-[0.6rem] text-muted hidden sm:inline">— {field.description}</span>}
                                  </div>
                                  {canEdit ? (
                                    <input type="number" className="input-field py-0.5 text-xs w-16 text-right" value={val} onChange={e => saveSummonAcValue(a.id, field.id, e.target.value)} />
                                  ) : (
                                    <span className="text-sm font-semibold text-foreground">{val}</span>
                                  )}
                                </div>
                              )
                            })}
                            {template.attributeModifiersEnabled !== false && (ac.attributeModifiers ?? []).length > 0 && (
                              <div className="mt-2">
                                <h5 className="text-[0.6rem] font-semibold text-muted uppercase tracking-wider mb-1">Attribute Modifiers</h5>
                                <div className="grid gap-1 sm:grid-cols-2">
                                  {(ac.attributeModifiers ?? []).map(am => {
                                    const attr = template.attributes.find(at => at.id === am.attributeId)
                                    if (!attr) return null
                                    const modResult = (summonModifierResults[a.id] ?? {})[attr.id]
                                    return (
                                      <div key={am.id} className="flex items-center justify-between py-1 px-2 rounded-lg bg-background/50 border border-border opacity-80">
                                        <span className="text-xs text-foreground truncate">{attr.name} Mod</span>
                                        <span className="text-xs font-semibold text-muted" style={{ opacity: 0.6 }}>
                                          {modResult !== null && modResult !== undefined ? `${modResult >= 0 ? '+' : ''}${modResult}` : '—'}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null)}
                      </div>}

                      {currentSummonTab === 'skills' && <div className="space-y-3">
                        {isOwner && (
                          <div>
                            {skillSearchOpen !== a.id ? (
                              <button
                                type="button"
                                onClick={() => { setSkillSearchOpen(a.id); setSkillSearchQuery('') }}
                                className="btn-ghost text-xs inline-flex items-center gap-1"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                                Add Skill
                              </button>
                            ) : (
                              <div className="space-y-1">
                                <div className="relative">
                                  <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                                  <input
                                    className="input-field pl-8 py-1 text-xs w-full"
                                    placeholder="Search Skill..."
                                    value={skillSearchQuery}
                                    onChange={e => setSkillSearchQuery(e.target.value)}
                                    autoFocus
                                    onKeyDown={e => { if (e.key === 'Escape') setSkillSearchOpen(null) }}
                                  />
                                </div>
                                <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                                  {allTemplateSkills
                                    .filter(s => {
                                      const alreadyAdded = (a.summonSkills ?? []).some(ss => ss.skillId === s.id)
                                      if (alreadyAdded) return false
                                      if (!skillSearchQuery.trim()) return true
                                      return s.name.toLowerCase().includes(skillSearchQuery.toLowerCase())
                                    })
                                    .slice(0, 25)
                                    .map(s => (
                                      <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => { handleAddSummonSkill(a.id, s.id); setSkillSearchOpen(null); setSkillSearchQuery('') }}
                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-foreground/5 transition-colors"
                                      >{s.name}</button>
                                    ))}
                                  {allTemplateSkills.filter(s => !(a.summonSkills ?? []).some(ss => ss.skillId === s.id) && (!skillSearchQuery.trim() || s.name.toLowerCase().includes(skillSearchQuery.toLowerCase()))).length === 0 && (
                                    <div className="px-3 py-2 text-xs text-muted italic">No skills found</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {(a.summonSkills ?? []).length === 0 ? (
                          <div className="text-xs text-muted italic py-2">No skills added. Click "Add Skill" to select from the template.</div>
                        ) : (
                          <div className="space-y-1.5">
                            {(a.summonSkills ?? []).map(ss => {
                              const result = (summonSkillResults[a.id] ?? {})[ss.id]
                              const hasAttrDropdown = (ss.skill.allowedAttributeIds?.length ?? 0) > 0
                              return (
                                <div key={ss.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-background/50 border border-border">
                                  <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <span className="text-sm font-medium text-foreground truncate">{ss.skill.name}</span>
                                    {isOwner && hasAttrDropdown && template.attributeModifiersEnabled !== false ? <select
                                        className="input-field py-0.5 text-xs w-auto min-w-[80px]"
                                        value={ss.selectedAttributeId ?? ''}
                                        onChange={e => handleSummonSkillAttributeChange(a.id, ss.id, e.target.value || null)}
                                      >
                                        {ss.skill.allowedAttributeIds.map(attrId => {
                                          const attr = template.attributes.find(x => x.id === attrId)
                                          if (!attr) return null
                                          return <option key={attrId} value={attrId}>{attr.name}</option>
                                        })}
                                      </select> : isOwner && hasAttrDropdown ? <span className="text-xs text-muted opacity-40 min-w-[80px] inline-block">{ss.selectedAttribute?.name || ss.skill.defaultAttribute?.name || ss.skill.attribute?.name || '—'}</span> : null}
                                  </div>
                                  <span className="text-sm font-bold text-primary shrink-0">{result != null ? (result >= 0 ? '+' : '') + result : '—'}</span>
                                  {isOwner && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSummonSkill(a.id, ss.id)}
                                      className="text-muted hover:text-danger shrink-0 p-0.5 transition-colors"
                                      title="Remove skill"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>}

                      {currentSummonTab === 'abilities' && <div className="space-y-2">
                        {(a.childAbilities ?? []).length === 0 && !showNewSummonAbility ? (
                          <div className="text-xs text-muted italic py-2">No abilities yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {(a.childAbilities ?? []).map((ca: Ability) => {
                              const caExpanded = expandedAbilities[ca.id] ?? false
                              const caSelLevel = ca.levels[ca.levels.length - 1]
                              return (
                                <div key={ca.id} className={`card !p-0 overflow-hidden transition-all duration-200 ${caExpanded ? 'border-primary/20' : ''}`}>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedAbilities(prev => ({ ...prev, [ca.id]: !prev[ca.id] }))}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-foreground/5 transition-colors"
                                  >
                                    <svg className={`w-3.5 h-3.5 text-muted transition-transform duration-200 shrink-0 ${caExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                                    <span className="text-sm font-medium text-foreground truncate flex-1">{ca.name}</span>
                                    {caSelLevel && <span className="text-[0.6rem] text-muted">Lv {caSelLevel.level}</span>}
                                    <div onClick={e => e.stopPropagation()}>
                                      {isOwner && (
                                        <button onClick={() => handleDeleteAbility(ca.id)} className="text-xs text-danger hover:text-danger/80 px-1 py-0.5 transition-colors shrink-0">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                        </button>
                                      )}
                                    </div>
                                  </button>
                                  {caExpanded && caSelLevel && (
                                    <div className="px-3 pb-3 space-y-2 border-t border-border">
                                      <div className="flex flex-wrap gap-2 text-xs text-muted pt-2">
                                        {isOwner ? (
                                          <>
                                            <span className="inline-flex items-center gap-1">Mana: <InlineClickEdit value={caSelLevel.manaCost?.toString() ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${caSelLevel.id}`, { manaCost: v.trim() ? parseInt(v, 10) : null }); setAbilities(prev => prev.map(ab => ({ ...ab, childAbilities: (ab.childAbilities ?? []).map(c => c.id === ca.id ? { ...c, levels: c.levels.map(l => l.id === caSelLevel.id ? { ...l, manaCost: v.trim() ? parseInt(v, 10) : null } : l) } : c) }))) } catch {} }} className="!text-xs !text-muted" inputClassName="!text-xs w-16" emptyDisplay="—" /></span>
                                            <span className="inline-flex items-center gap-1">Range: <InlineClickEdit value={caSelLevel.range ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${caSelLevel.id}`, { range: v.trim() || null }); setAbilities(prev => prev.map(ab => ({ ...ab, childAbilities: (ab.childAbilities ?? []).map(c => c.id === ca.id ? { ...c, levels: c.levels.map(l => l.id === caSelLevel.id ? { ...l, range: v.trim() || null } : l) } : c) }))) } catch {} }} className="!text-xs !text-muted" inputClassName="!text-xs w-20" emptyDisplay="—" /></span>
                                          </>
                                        ) : (
                                          <>
                                            {caSelLevel.manaCost != null && <span>Mana: {caSelLevel.manaCost}</span>}
                                            {caSelLevel.range && <span>Range: {caSelLevel.range}</span>}
                                          </>
                                        )}
                                      </div>
                                      {isOwner ? (
                                        <>
                                          <div><h5 className="text-xs font-medium text-muted mb-1">Description</h5><InlineClickEdit value={caSelLevel.description ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${caSelLevel.id}`, { description: v.trim() || null }); setAbilities(prev => prev.map(ab => ({ ...ab, childAbilities: (ab.childAbilities ?? []).map(c => c.id === ca.id ? { ...c, levels: c.levels.map(l => l.id === caSelLevel.id ? { ...l, description: v.trim() || null } : l) } : c) }))) } catch {} }} as="textarea" className="text-xs text-muted-foreground whitespace-pre-wrap" emptyDisplay="Add description..." /></div>
                                          <div><h5 className="text-xs font-medium text-muted mb-1">Notes</h5><InlineClickEdit value={caSelLevel.notes ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${caSelLevel.id}`, { notes: v.trim() || null }); setAbilities(prev => prev.map(ab => ({ ...ab, childAbilities: (ab.childAbilities ?? []).map(c => c.id === ca.id ? { ...c, levels: c.levels.map(l => l.id === caSelLevel.id ? { ...l, notes: v.trim() || null } : l) } : c) }))) } catch {} }} as="textarea" className="text-xs text-muted italic whitespace-pre-wrap" emptyDisplay="Add notes..." /></div>
                                        </>
                                      ) : (
                                        <>
                                          {caSelLevel.description && <div><h5 className="text-xs font-medium text-muted mb-1">Description</h5><p className="text-xs text-muted-foreground whitespace-pre-wrap">{caSelLevel.description}</p></div>}
                                          {caSelLevel.notes && <div><h5 className="text-xs font-medium text-muted mb-1">Notes</h5><p className="text-xs text-muted italic whitespace-pre-wrap">{caSelLevel.notes}</p></div>}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {isOwner && (
                          <>
                            {showNewSummonAbility === a.id ? (
                              <form onSubmit={(e) => { handleCreateSummonAbility(a.id, e); setShowNewSummonAbility(null) }} className="card !p-3 space-y-2 border-primary/20">
                                <h5 className="text-xs font-semibold text-primary">New Ability for {a.name}</h5>
                                <div><label className="text-[0.65rem] text-muted">Name</label><input className="input-field text-xs" value={newAbility.name} onChange={e => setNewAbility(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Bite" /></div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div><label className="text-[0.65rem] text-muted">Mana Cost</label><input type="number" className="input-field text-xs" value={newAbility.manaCost} onChange={e => setNewAbility(p => ({ ...p, manaCost: e.target.value }))} placeholder="0" /></div>
                                  <div><label className="text-[0.65rem] text-muted">Range</label><input className="input-field text-xs" value={newAbility.range} onChange={e => setNewAbility(p => ({ ...p, range: e.target.value }))} placeholder="melee" /></div>
                                </div>
                                <div><label className="text-[0.65rem] text-muted">Damage</label><input className="input-field text-xs" value={newAbility.damage} onChange={e => setNewAbility(p => ({ ...p, damage: e.target.value }))} placeholder="1d6" /></div>
                                <div><label className="text-[0.65rem] text-muted">Description</label><textarea className="input-field resize-none text-xs" rows={2} value={newAbility.description} onChange={e => setNewAbility(p => ({ ...p, description: e.target.value }))} /></div>
                                <div><label className="text-[0.65rem] text-muted">Notes</label><textarea className="input-field resize-none text-xs" rows={1} value={newAbility.notes} onChange={e => setNewAbility(p => ({ ...p, notes: e.target.value }))} /></div>
                                {abilityError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-2 py-1 text-[0.65rem] text-danger">{abilityError}</div>}
                                <div className="flex gap-2 justify-end">
                                  <button type="button" onClick={() => { setShowNewSummonAbility(null); resetNewAbility() }} className="btn-ghost text-xs">Cancel</button>
                                  <button type="submit" disabled={abilitySaving || !newAbility.name.trim()} className="btn-primary text-xs">{abilitySaving ? 'Creating...' : 'Create'}</button>
                                </div>
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setShowNewSummonAbility(a.id); setNewAbility({ name: '', description: '', manaCost: '', range: '', notes: '', damage: '' }) }}
                                className="btn-ghost text-xs inline-flex items-center gap-1"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>Add Ability
                              </button>
                            )}
                          </>
                        )}
                      </div>}
                    </div>
                  )}

                  {isAbility && isOwner && !selLevel && (
                    <button
                      onClick={() => { setShowAddLevelModal(a.id); setNewLevelForm({ level: 1, copyFromPrevious: false }); setLevelModalError(null) }}
                      className="btn-ghost text-xs"
                    >+ Add Level</button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {isOwner && !showNewAbility && (
        <button onClick={() => setShowNewAbility(true)} className="btn-primary text-sm">
          + New Ability or Summon
        </button>
      )}

      {isOwner && showNewAbility && (
        <div className="card !p-4 space-y-3 border-primary/20">
          {!newAbilityType ? (
            <>
              <h4 className="text-sm font-semibold text-primary">What would you like to create?</h4>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setNewAbilityType('ABILITY')} className="card !p-4 hover:border-primary/30 transition-colors text-center space-y-2">
                  <svg className="w-8 h-8 mx-auto text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  <div><div className="font-semibold text-foreground text-sm">Ability</div><div className="text-xs text-muted">Spells, skills, attacks, etc.</div></div>
                </button>
                <button type="button" onClick={() => setNewAbilityType('SUMMON')} className="card !p-4 hover:border-primary/30 transition-colors text-center space-y-2">
                  <svg className="w-8 h-8 mx-auto text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>
                  <div><div className="font-semibold text-foreground text-sm">Summon</div><div className="text-xs text-muted">Creatures, companions, minions</div></div>
                </button>
              </div>
              <div className="flex gap-2 justify-end"><button type="button" onClick={resetNewAbility} className="btn-ghost text-sm">Cancel</button></div>
            </>
          ) : newAbilityType === 'ABILITY' ? (
            <form onSubmit={handleCreateAbility} className="space-y-3">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                <button type="button" onClick={() => setNewAbilityType(null)} className="text-muted hover:text-foreground transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                </button>New Ability
              </h4>
              <div><label className="text-xs text-muted">Name</label><input className="input-field" value={newAbility.name} onChange={e => setNewAbility(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Fireball" /></div>
              <div><label className="text-xs text-muted">Description</label><textarea className="input-field resize-none" rows={2} value={newAbility.description} onChange={e => setNewAbility(p => ({ ...p, description: e.target.value }))} placeholder="Throws a fireball causing area damage." /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-muted">Mana Cost</label><input type="number" className="input-field" value={newAbility.manaCost} onChange={e => setNewAbility(p => ({ ...p, manaCost: e.target.value }))} placeholder="20" /></div>
                <div><label className="text-xs text-muted">Range</label><input className="input-field" value={newAbility.range} onChange={e => setNewAbility(p => ({ ...p, range: e.target.value }))} placeholder="30m" /></div>
              </div>
              <div><label className="text-xs text-muted">Damage</label><input className="input-field" value={newAbility.damage} onChange={e => setNewAbility(p => ({ ...p, damage: e.target.value }))} placeholder="2d6" /></div>
              <div><label className="text-xs text-muted">Notes</label><textarea className="input-field resize-none" rows={2} value={newAbility.notes} onChange={e => setNewAbility(p => ({ ...p, notes: e.target.value }))} /></div>
              {abilityError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{abilityError}</div>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={resetNewAbility} disabled={abilitySaving} className="btn-ghost text-sm">Cancel</button>
                <button type="submit" disabled={abilitySaving || !newAbility.name.trim()} className="btn-primary text-sm">{abilitySaving ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateAbility} className="space-y-3">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                <button type="button" onClick={() => setNewAbilityType(null)} className="text-muted hover:text-foreground transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                </button>New Summon
              </h4>
              <div><label className="text-xs text-muted">Name</label><input className="input-field" value={newAbility.name} onChange={e => setNewAbility(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Spirit Wolf" /></div>
              <div><label className="text-xs text-muted">Description</label><textarea className="input-field resize-none" rows={2} value={newAbility.description} onChange={e => setNewAbility(p => ({ ...p, description: e.target.value }))} placeholder="A loyal spirit wolf that follows commands." /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-muted">Health (Current)</label><input type="number" className="input-field" value={newAbility.manaCost} onChange={e => setNewAbility(p => ({ ...p, manaCost: e.target.value }))} placeholder="20" /></div>
                <div><label className="text-xs text-muted">Health (Max)</label><input type="number" className="input-field" value={newAbility.range} onChange={e => setNewAbility(p => ({ ...p, range: e.target.value }))} placeholder="20" /></div>
              </div>
              <div><label className="text-xs text-muted">Notes</label><textarea className="input-field resize-none" rows={2} value={newAbility.notes} onChange={e => setNewAbility(p => ({ ...p, notes: e.target.value }))} /></div>
              <p className="text-[0.65rem] text-muted italic">Attributes and Armor Class are automatically inherited from the sheet template. They can be customized after creation.</p>
              {abilityError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{abilityError}</div>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={resetNewAbility} disabled={abilitySaving} className="btn-ghost text-sm">Cancel</button>
                <button type="submit" disabled={abilitySaving || !newAbility.name.trim()} className="btn-primary text-sm">{abilitySaving ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          )}
        </div>
      )}

      {showAddLevelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card !p-6 max-w-sm w-full space-y-4 border-primary/20">
            <h3 className="font-semibold text-primary">Create Ability Level</h3>
            <div><label className="text-xs text-muted block mb-1">Level</label><input className="input-field w-full" value={newLevelForm.level} onChange={e => setNewLevelForm(p => ({ ...p, level: e.target.value }))} /></div>
            <div><label className="text-xs text-muted block mb-2">Copy information from previous level?</label><div className="flex gap-4"><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="copyPrev" checked={newLevelForm.copyFromPrevious} onChange={() => setNewLevelForm(p => ({ ...p, copyFromPrevious: true }))} className="accent-primary" /><span className="text-sm">Yes</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="copyPrev" checked={!newLevelForm.copyFromPrevious} onChange={() => setNewLevelForm(p => ({ ...p, copyFromPrevious: false }))} className="accent-primary" /><span className="text-sm">No</span></label></div></div>
            {levelModalError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{levelModalError}</div>}
            <div className="flex gap-2 justify-end"><button type="button" onClick={() => setShowAddLevelModal(null)} disabled={levelModalSaving} className="btn-ghost text-sm">Cancel</button><button type="button" onClick={() => handleAddLevel(showAddLevelModal)} disabled={levelModalSaving} className="btn-primary text-sm">{levelModalSaving ? 'Creating...' : 'Create'}</button></div>
          </div>
        </div>
      )}

      {confirmDeleteAbility && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center">
                <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
              </div>
              <div><h2 className="font-semibold">Delete Entry</h2><p className="text-sm text-muted-foreground">This will permanently delete this entry and all its data (levels, attributes, etc.).</p></div>
            </div>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{abilities.find(a => a.id === confirmDeleteAbility)?.name ?? 'this entry'}</strong>?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteAbility(null)} disabled={deletingAbility} className="btn-ghost">Cancel</button>
              <button onClick={() => { setDeletingAbility(true); handleDeleteAbility(confirmDeleteAbility).finally(() => { setDeletingAbility(false); setConfirmDeleteAbility(null) }) }} disabled={deletingAbility} className="btn-danger-solid">{deletingAbility ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteLevel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center">
                <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
              </div>
              <div><h2 className="font-semibold">Delete Level</h2><p className="text-sm text-muted-foreground">This will permanently delete this level and all its data.</p></div>
            </div>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>Level {(() => { for (const a of abilities) { const l = a.levels.find(l => l.id === confirmDeleteLevel); if (l) return l.level } return '?' })()}</strong>?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteLevel(null)} disabled={deletingLevel} className="btn-ghost">Cancel</button>
              <button onClick={async () => { setDeletingLevel(true); try { await api.delete(`/character-sheets/${sheetId}/abilities/x/levels/${confirmDeleteLevel}`); setAbilities(prev => prev.map(a => ({ ...a, levels: a.levels.filter(l => l.id !== confirmDeleteLevel) }))); setSelectedLevels(prev => { const next = { ...prev }; for (const a of abilities) { if (a.levels.some(l => l.id === confirmDeleteLevel)) { const remaining = a.levels.filter(l => l.id !== confirmDeleteLevel); if (next[a.id] === confirmDeleteLevel) next[a.id] = remaining.length > 0 ? remaining[remaining.length - 1].id : ''; break } } return next }) } catch {} finally { setDeletingLevel(false); setConfirmDeleteLevel(null) } }} disabled={deletingLevel} className="btn-danger-solid">{deletingLevel ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
