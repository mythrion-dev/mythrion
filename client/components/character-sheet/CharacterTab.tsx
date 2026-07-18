'use client'

import { useState, useMemo } from 'react'
import { InlineText, InlineNumber } from '@/lib/inline-editable'
import { ProfessionalSkillsSection } from './ProfessionalSkillsSection'
import type { CharacterSheet, AcResultMap, SkillModifierProfile } from './types'

// ── Helpers ──

function getAttrModifier(
  attributeId: string | null | undefined,
  modResults: Record<string, number | null>,
): number | null {
  if (!attributeId) return null
  return modResults[attributeId] ?? null
}

// ── Props ──

interface CharacterTabProps {
  sheet: CharacterSheet
  isOwner: boolean
  enabledCoreResources: CharacterSheet['template']['coreResources']
  handleCoreResourceChange: (coreResourceId: string, field: 'current' | 'maximum' | 'notes', value: string) => Promise<void>
  handleCoreResourceModify?: (coreResourceId: string, delta: number) => void
  saveFieldValue: (fieldId: string, value: string) => Promise<void>
  modifierResults: Record<string, number | null>
  saveAttributeValue: (attributeId: string, value: string) => Promise<void>
  modifiersEnabled: boolean | undefined
  armorClasses: CharacterSheet['template']['armorClasses']
  acResults: AcResultMap
  handleAcFieldChange: (fieldId: string, value: string) => void
  handleAcAttributeModifierChange: (acModifierId: string, attributeId: string | null) => Promise<void>
  allProfiles: SkillModifierProfile[]
  profileSelections: Record<string, Record<string, string | null>>
  activeSkills: Record<string, boolean>
  othersValues: Record<string, number>
  handleSkillToggle: (skillId: string) => void
  handleOthersChange: (skillId: string, value: number) => void
  handleProfileChange: (skillId: string, profileId: string, optionId: string | null) => void
  handleSkillAttributeChange: (skillId: string, attributeId: string | null) => void
  expandedSkillId: string | null
  setExpandedSkillId: React.Dispatch<React.SetStateAction<string | null>>
  skillResults: Record<string, number | null>
  sheetId: string
}

export function CharacterTab(props: CharacterTabProps) {
  const {
    sheet, isOwner,
    enabledCoreResources,
    handleCoreResourceChange, handleCoreResourceModify,
    saveFieldValue, modifierResults, saveAttributeValue, modifiersEnabled,
    armorClasses, acResults, handleAcFieldChange, handleAcAttributeModifierChange,
    allProfiles, profileSelections, activeSkills, othersValues,
    handleSkillToggle, handleOthersChange, handleProfileChange,
    handleSkillAttributeChange, expandedSkillId, setExpandedSkillId,
    skillResults,
    sheetId,
  } = props

  const [modifierInputs, setModifierInputs] = useState<Record<string, number>>({})

  // ── Derived data ──

  const activeSkillValues = useMemo(
    () => sheet.skillValues.filter(sv => activeSkills[sv.skillId] === true),
    [sheet.skillValues, activeSkills],
  )
  const inactiveSkillValues = useMemo(
    () => sheet.skillValues.filter(sv => !activeSkills[sv.skillId]),
    [sheet.skillValues, activeSkills],
  )

  const hasSkills = sheet.skillValues.length > 0
  const hasArmor = armorClasses.length > 0
  const hasResources = enabledCoreResources.length > 0
  const hasFields = sheet.fieldValues.length > 0
  const hasAttributes = sheet.template.attributes.length > 0

  // ── Resource modifier input handler ──

  function setModifierInput(id: string, val: number) {
    setModifierInputs(prev => ({ ...prev, [id]: val }))
  }

  function handleResourceHeal(id: string) {
    const val = modifierInputs[id] || 0
    if (handleCoreResourceModify) {
      handleCoreResourceModify(id, Math.abs(val))
    }
    setModifierInputs(prev => ({ ...prev, [id]: 0 }))
  }

  function handleResourceDamage(id: string) {
    const val = modifierInputs[id] || 0
    if (handleCoreResourceModify) {
      handleCoreResourceModify(id, -Math.abs(val))
    }
    setModifierInputs(prev => ({ ...prev, [id]: 0 }))
  }

  // ── Render ──

  return (
    <div className="space-y-8">
      {/* ─────────────────────────────────────────────── */}
      {/* Three-Column Dashboard Layout                  */}
      {/* ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1.15fr_0.95fr] items-start">

        {/* ─── LEFT COLUMN — Character Info + Attributes ─── */}
        <div className="space-y-6">
          {/* Character Information */}
          {hasFields && (
            <div className="card !p-6">
              <div className="flex items-center gap-2 mb-5">
                <h3 className="font-semibold text-foreground">Character Information</h3>
                <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {sheet.fieldValues.map(fv => (
                  <div
                    key={fv.id}
                    className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-background/40 border border-border/60"
                  >
                    <span className="text-sm text-muted font-medium">{fv.templateField.label}</span>
                    {isOwner ? (
                      <InlineText
                        value={fv.value}
                        onSave={(v) => saveFieldValue(fv.templateFieldId, v)}
                        className="text-sm font-semibold text-foreground text-right"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-foreground text-right">{fv.value || '—'}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attributes */}
          {hasAttributes && (
            <div className="card !p-6">
              <div className="flex items-center gap-2 mb-5">
                <h3 className="font-semibold text-foreground">Attributes</h3>
                {modifiersEnabled && sheet.template.attributeModifierFormula && (
                  <span className="badge-gold text-[0.6rem] px-1.5 py-0.5 rounded">mod</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                {sheet.template.attributes.map(attr => {
                  const val = sheet.values.find(v => v.attributeId === attr.id)
                  const modResult = modifierResults[attr.id]
                  return (
                    <div
                      key={attr.id}
                      className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-background/40 border border-border/60"
                    >
                      <span className="text-sm font-medium text-foreground">{attr.name}</span>
                      <div className="flex items-center gap-3">
                        {isOwner ? (
                          <InlineText
                            value={val?.value ?? ''}
                            onSave={(v) => saveAttributeValue(attr.id, v)}
                            className="text-sm font-semibold text-foreground tabular-nums text-right"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-foreground tabular-nums">{val?.value || '—'}</span>
                        )}
                        {modifiersEnabled && modResult !== undefined && modResult !== null && (
                          <span className="text-sm font-semibold tabular-nums text-primary min-w-[2.5rem] text-right">
                            ({modResult >= 0 ? '+' : ''}{modResult})
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ─── CENTER COLUMN — Resources (2×2 grid) + AC (bottom-right) ─── */}
        <div className="space-y-6">
          {(hasResources || hasArmor) && (
            <div className="grid grid-cols-2 gap-3 auto-rows-fr">
              {/* Resource cards */}
              {enabledCoreResources.map(cr => {
                const crv = sheet.coreResourceValues.find(v => v.coreResourceId === cr.id)
                if (!crv) return null
                const canEdit = isOwner && cr.editableByPlayer
                const modVal = modifierInputs[cr.id] || 0
                return (
                  <div key={cr.id} className="card !p-4 space-y-2.5 flex flex-col">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-foreground truncate">{cr.displayName}</h4>
                      {cr.showNotes && canEdit && (
                        <InlineText
                          value={crv.notes ?? ''}
                          onSave={(v) => handleCoreResourceChange(crv.coreResourceId, 'notes', v)}
                          placeholder="notes"
                          emptyDisplay="notes"
                          className="!text-[0.65rem] !text-muted !font-normal"
                        />
                      )}
                      {cr.showNotes && crv.notes && !canEdit && (
                        <span className="text-[0.65rem] text-muted truncate max-w-[80px]">{crv.notes}</span>
                      )}
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-2 py-1">
                      <div className="text-center">
                        <span className="text-[0.55rem] text-muted font-medium uppercase tracking-wider block mb-0.5">
                          Current
                        </span>
                        {canEdit ? (
                          <InlineNumber
                            value={crv.current ?? 0}
                            onSave={(v) => handleCoreResourceChange(crv.coreResourceId, 'current', String(v))}
                            min={0}
                            className="text-xl font-bold text-foreground tabular-nums"
                          />
                        ) : (
                          <span className="text-xl font-bold text-foreground tabular-nums">{crv.current ?? '—'}</span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground font-light">/</span>
                      <div className="text-center">
                        <span className="text-[0.55rem] text-muted font-medium uppercase tracking-wider block mb-0.5">
                          Max
                        </span>
                        {canEdit ? (
                          <InlineNumber
                            value={crv.maximum ?? 0}
                            onSave={(v) => handleCoreResourceChange(crv.coreResourceId, 'maximum', String(v))}
                            min={0}
                            className="text-xl font-bold text-foreground tabular-nums"
                          />
                        ) : (
                          <span className="text-xl font-bold text-foreground tabular-nums">{crv.maximum ?? '—'}</span>
                        )}
                      </div>
                    </div>
                    {canEdit && handleCoreResourceModify && (
                      <div className="space-y-1.5 pt-2 border-t border-border/50">
                        <input
                          type="number"
                          min={0}
                          className="input-field py-0.5 text-[0.65rem] w-full text-center"
                          value={modVal || ''}
                          placeholder="Amount"
                          onChange={e => setModifierInput(cr.id, parseInt(e.target.value, 10) || 0)}
                        />
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => handleResourceHeal(cr.id)}
                            disabled={!modVal}
                            className="btn-primary text-[0.6rem] py-0.5 disabled:opacity-40"
                          >
                            + Heal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResourceDamage(cr.id)}
                            disabled={!modVal}
                            className="btn-danger text-[0.6rem] py-0.5 disabled:opacity-40"
                          >
                            − Damage
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Armor Class card — bottom-right, same height as resources */}
              {hasArmor && armorClasses.map(ac => (
                <div key={ac.id} className="card !p-4 flex flex-col items-center justify-center space-y-2">
                  <h4 className="text-sm font-semibold text-foreground text-center">
                    {(ac as any).name ?? 'Armor Class'}
                  </h4>
                  <div className="w-14 h-14 rounded-full border-[2px] border-primary/25 flex items-center justify-center bg-background/40">
                    <span className="text-xl font-bold text-primary tracking-tight tabular-nums">
                      {acResults[ac.id]?.total !== undefined ? acResults[ac.id].total : '—'}
                    </span>
                  </div>
                  <div className="w-full space-y-1 mt-1">
                    {ac.fields.map(field => {
                      const acv = sheet.acValues.find(v => v.fieldId === field.id)
                      const val = acv?.value ?? field.defaultValue
                      const canEdit = isOwner && field.editableByPlayer
                      return (
                        <div key={field.id} className="flex items-center justify-between gap-1 text-[0.6rem]">
                          <span className="text-muted truncate">{field.name}</span>
                          {canEdit ? (
                            <input
                              type="number"
                              className="input-field py-0.5 text-[0.6rem] w-12 text-right"
                              value={val}
                              onChange={e => handleAcFieldChange(field.id, e.target.value)}
                            />
                          ) : (
                            <span className="font-semibold text-foreground tabular-nums">{val}</span>
                          )}
                        </div>
                      )
                    })}
                    {modifiersEnabled && (ac.attributeModifiers ?? []).length > 0 && (
                      <div className="border-t border-border/30 pt-1 mt-1 space-y-1">
                        {(ac.attributeModifiers ?? []).map(am => {
                          const acAttrValue = sheet.acAttributeValues.find(v => v.acAttributeModifierId === am.id)
                          const selectedAttributeId = acAttrValue?.selectedAttributeId ?? am.defaultAttributeId ?? am.attributeId
                          const selectedAttribute = sheet.template.attributes.find(a => a.id === selectedAttributeId) ?? am.defaultAttribute ?? am.attribute
                          const modResult = selectedAttribute ? modifierResults[selectedAttribute.id] : null
                          const canChangeAttribute = isOwner && am.allowPlayerSelection
                          return (
                            <div key={am.id} className="flex items-center justify-between gap-1 text-[0.6rem]">
                              {canChangeAttribute ? (
                                <select
                                  className="input-field py-0.5 text-[0.6rem] w-auto min-w-[90px]"
                                  value={selectedAttribute?.id ?? ''}
                                  onChange={e => handleAcAttributeModifierChange(am.id, e.target.value || null)}
                                >
                                  {sheet.template.attributes.map(attr => (
                                    <option key={attr.id} value={attr.id}>{attr.name}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-muted truncate">
                                  {(selectedAttribute?.name ?? am.attribute.name)}
                                </span>
                              )}
                              <span className="font-semibold tabular-nums text-muted-foreground">
                                {modResult !== null && modResult !== undefined
                                  ? `${modResult >= 0 ? '+' : ''}${modResult}`
                                  : '—'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── RIGHT COLUMN — Skills ─── */}
        <div className="space-y-6">
          {hasSkills ? (
            <div className="space-y-5">
              {/* Active Skills Table */}
              <SkillTable
                title="Active"
                skills={activeSkillValues}
                isActiveSide
                allProfiles={allProfiles}
                profileSelections={profileSelections}
                othersValues={othersValues}
                skillResults={skillResults}
                modifierResults={modifierResults}
                modifiersEnabled={modifiersEnabled ?? true}
                expandedSkillId={expandedSkillId}
                onExpandToggle={setExpandedSkillId}
                onToggle={handleSkillToggle}
                onOthersChange={handleOthersChange}
                onProfileChange={handleProfileChange}
                onAttributeChange={handleSkillAttributeChange}
                templateAttributes={sheet.template.attributes}
              />

              {/* Inactive Skills Table */}
              <SkillTable
                title="Inactive"
                skills={inactiveSkillValues}
                isActiveSide={false}
                allProfiles={allProfiles}
                profileSelections={profileSelections}
                othersValues={othersValues}
                skillResults={skillResults}
                modifierResults={modifierResults}
                modifiersEnabled={modifiersEnabled ?? true}
                expandedSkillId={expandedSkillId}
                onExpandToggle={setExpandedSkillId}
                onToggle={handleSkillToggle}
                onOthersChange={handleOthersChange}
                onProfileChange={handleProfileChange}
                onAttributeChange={handleSkillAttributeChange}
                templateAttributes={sheet.template.attributes}
              />
            </div>
          ) : (
            <div className="card !p-6 border-dashed border-border/40 bg-background/20">
              <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
                <svg className="w-8 h-8 text-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p className="text-xs text-muted/60 italic">No skills defined for this template</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── FULL WIDTH: Professional Skills ─── */}
      <ProfessionalSkillsSection
        sheetId={sheetId}
        isOwner={isOwner}
        modifierResults={modifierResults}
        templateAttributes={sheet.template.attributes}
      />

      {/* ── Footer ── */}
      <div className="text-center pt-2">
        <p className="text-xs text-muted">
          {isOwner ? 'You own this character sheet.' : 'This character sheet belongs to another player.'}
        </p>
      </div>
    </div>
  )
}

// ── Skill Table Sub-component (with internal search + sticky header) ──

interface SkillTableProps {
  title: string
  skills: CharacterSheet['skillValues']
  isActiveSide: boolean
  allProfiles: SkillModifierProfile[]
  profileSelections: Record<string, Record<string, string | null>>
  othersValues: Record<string, number>
  skillResults: Record<string, number | null>
  modifierResults: Record<string, number | null>
  modifiersEnabled: boolean
  expandedSkillId: string | null
  onExpandToggle: React.Dispatch<React.SetStateAction<string | null>>
  onToggle: (skillId: string) => void
  onOthersChange: (skillId: string, value: number) => void
  onProfileChange: (skillId: string, profileId: string, optionId: string | null) => void
  onAttributeChange: (skillId: string, attributeId: string | null) => void
  templateAttributes: { id: string; key: string; name: string }[]
}

function SkillTable({
  title,
  skills,
  isActiveSide,
  allProfiles,
  profileSelections,
  othersValues,
  skillResults,
  modifierResults,
  modifiersEnabled,
  expandedSkillId,
  onExpandToggle,
  onToggle,
  onOthersChange,
  onProfileChange,
  onAttributeChange,
  templateAttributes,
}: SkillTableProps) {
  const [search, setSearch] = useState('')

  const filteredSkills = useMemo(() => {
    if (!search.trim()) return skills
    const q = search.toLowerCase()
    return skills.filter(sv => sv.skill.name.toLowerCase().includes(q))
  }, [skills, search])

  const hasSearch = skills.length > 0

  return (
    <div className="card !p-0 overflow-hidden">
      {/* Sticky header with title, badge, and search */}
      <div className="sticky top-0 z-10 px-5 py-3.5 border-b border-border/60 space-y-2.5 bg-card">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">{title} Skills</h4>
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary/10 border border-primary/20 text-[0.65rem] font-medium text-primary">
              {skills.length}
            </span>
          </div>
        </div>
        {hasSearch && (
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="input-field py-1.5 pl-7 text-xs w-full"
              placeholder={`Search ${title.toLowerCase()} skills...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Sticky column headers */}
      {filteredSkills.length > 0 && (
        <div className="sticky top-[73px] z-10 hidden sm:flex items-center px-5 py-2 bg-background/90 backdrop-blur-sm text-[0.65rem] font-semibold text-muted uppercase tracking-wider border-b border-border/40">
          <div className="w-10 shrink-0" />
          <div className="flex-1 min-w-0">Skill</div>
          <div className="w-[110px] shrink-0 text-left">Attribute</div>
          <div className="w-16 shrink-0 text-right">Total</div>
          <div className="w-12 shrink-0 text-right">Mod</div>
          <div className="w-8 shrink-0" />
        </div>
      )}

      {/* Table body */}
      {filteredSkills.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted">
          {search.trim()
            ? 'No skills match your search.'
            : isActiveSide
              ? 'No active skills.'
              : 'No inactive skills.'}
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {filteredSkills.map(sv => {
            const isExpanded = expandedSkillId === sv.skillId
            const selectedAttr = sv.selectedAttribute || sv.skill.defaultAttribute || sv.skill.attribute
            const attrMod = isActiveSide
              ? getAttrModifier(selectedAttr?.id, modifierResults)
              : null
            const total = isActiveSide
              ? (skillResults[sv.skillId] != null ? skillResults[sv.skillId] : '—')
              : 0
            const modDisplay = isActiveSide
              ? (attrMod !== null && attrMod !== undefined ? attrMod : '—')
              : 0

            const skillProfiles = allProfiles.filter(p => {
              const tm = (p as any).targetMode ?? 'ALL_SKILLS'
              const tids: string[] = (p as any).targetSkillIds ?? []
              return tm === 'ALL_SKILLS' || tids.length === 0 || tids.includes(sv.skill.name)
            })
            const hasAttrDropdown = (sv.skill.allowedAttributeIds?.length ?? 0) > 0

            return (
              <div key={sv.id} className={`${isActiveSide ? '' : 'opacity-45'}`}>
                {/* Main row */}
                <div className="flex items-center gap-2 px-4 sm:px-5 py-3 hover:bg-background/20 transition-colors">
                  {/* Checkbox */}
                  <div className="w-10 shrink-0 flex items-center justify-start">
                    <input
                      type="checkbox"
                      checked={isActiveSide}
                      onChange={() => onToggle(sv.skillId)}
                      className="shrink-0 w-4 h-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </div>

                  {/* Skill name (clickable to expand) */}
                  <button
                    type="button"
                    onClick={() => onExpandToggle(isExpanded ? null : sv.skillId)}
                    disabled={!isActiveSide}
                    className="flex-1 min-w-0 text-left disabled:cursor-default"
                  >
                    <span className="text-sm font-medium text-foreground truncate block leading-tight">
                      {sv.skill.name}
                    </span>
                    {sv.skill.description && (
                      <span className="text-[0.65rem] text-muted truncate block leading-tight mt-0.5">
                        {sv.skill.description}
                      </span>
                    )}
                  </button>

                  {/* Attribute selector */}
                  <div className="w-[110px] shrink-0">
                    {hasAttrDropdown && isActiveSide && modifiersEnabled ? (
                      <select
                        className="input-field py-0.5 text-[0.65rem] w-full"
                        value={sv.selectedAttributeId ?? ''}
                        onChange={e => onAttributeChange(sv.skillId, e.target.value || null)}
                      >
                        {sv.skill.allowedAttributeIds.map(attrId => {
                          const a = templateAttributes.find(x => x.id === attrId)
                          if (!a) return null
                          return <option key={attrId} value={attrId}>{a.name}</option>
                        })}
                      </select>
                    ) : (
                      <span className="text-[0.65rem] text-muted block truncate">
                        {selectedAttr?.name ?? '—'}
                      </span>
                    )}
                  </div>

                  {/* Total */}
                  <div className="w-16 shrink-0 text-right">
                    <span className={`text-sm font-bold tabular-nums ${isActiveSide ? 'text-primary' : 'text-muted'}`}>
                      {total}
                    </span>
                  </div>

                  {/* Mod */}
                  <div className="w-12 shrink-0 text-right">
                    <span className={`text-xs font-semibold tabular-nums ${isActiveSide ? 'text-muted-foreground' : 'text-muted'}`}>
                      {modDisplay !== '—' && modDisplay >= 0 ? '+' : ''}{modDisplay}
                    </span>
                  </div>

                  {/* Expand chevron */}
                  <button
                    type="button"
                    onClick={() => onExpandToggle(isExpanded ? null : sv.skillId)}
                    disabled={!isActiveSide}
                    className="w-8 shrink-0 flex items-center justify-center disabled:cursor-default"
                  >
                    <svg
                      className={`w-3.5 h-3.5 text-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Expandable content (profiles + others) */}
                <div
                  className={`transition-all duration-200 overflow-hidden ${
                    isExpanded && isActiveSide ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-4 sm:px-5 py-3 space-y-2.5 border-t border-border/40 ml-12 bg-background/20">
                    {skillProfiles.map(profile => {
                      const sid = profileSelections[sv.skillId]?.[profile.id]
                      return (
                        <div key={profile.id} className="flex items-center gap-2">
                          <span className="text-[0.65rem] text-muted shrink-0 min-w-[80px]">{profile.name}:</span>
                          <select
                            className="input-field py-1 text-[0.65rem] flex-1"
                            value={sid ?? ''}
                            onChange={e => onProfileChange(sv.skillId, profile.id, e.target.value || null)}
                          >
                            <option value="">— Select —</option>
                            {profile.options.map(opt => (
                              <option key={opt.id} value={opt.id}>{opt.label} ({opt.value >= 0 ? '+' : ''}{opt.value})</option>
                            ))}
                          </select>
                          {sid && (
                            <span className="text-[0.65rem] font-mono text-primary shrink-0 tabular-nums">
                              {profile.options.find(o => o.id === sid)?.value ?? 0 >= 0 ? '+' : ''}
                              {profile.options.find(o => o.id === sid)?.value ?? 0}
                            </span>
                          )}
                        </div>
                      )
                    })}
                    <div className="flex items-center gap-2">
                      <span className="text-[0.65rem] text-muted shrink-0 min-w-[80px]">Others:</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="input-field py-1 text-[0.65rem] w-20"
                        value={othersValues[sv.skillId] || ''}
                        placeholder="0"
                        onChange={e => onOthersChange(sv.skillId, parseInt(e.target.value, 10) || 0)}
                      />
                      <span className="text-[0.65rem] font-mono text-primary tabular-nums">
                        +{othersValues[sv.skillId] || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
