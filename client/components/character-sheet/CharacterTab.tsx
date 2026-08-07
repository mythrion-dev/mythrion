'use client'

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { InlineText, InlineNumber } from '@/lib/inline-editable'
import { Select } from '@/components/shared/Select'
import { ProfessionalSkillsSection } from './ProfessionalSkillsSection'
import type { CharacterSheet, AcResultMap, SkillModifierProfile, SheetPermissions } from './types'

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
  readonly sheet: CharacterSheet
  readonly permissions: SheetPermissions
  readonly enabledCoreResources: CharacterSheet['template']['coreResources']
  readonly handleCoreResourceChange: (coreResourceId: string, field: 'current' | 'maximum' | 'notes', value: string) => Promise<void>
  readonly handleCoreResourceModify?: (coreResourceId: string, delta: number) => void
  readonly saveFieldValue: (fieldId: string, value: string) => Promise<void>
  readonly modifierResults: Record<string, number | null>
  readonly saveAttributeValue: (attributeId: string, value: string) => Promise<void>
  readonly modifiersEnabled: boolean | undefined
  readonly armorClasses: CharacterSheet['template']['armorClasses']
  readonly acResults: AcResultMap
  readonly handleAcFieldChange: (fieldId: string, value: string) => void
  readonly handleAcAttributeModifierChange: (acModifierId: string, attributeId: string | null) => Promise<void>
  readonly allProfiles: SkillModifierProfile[]
  readonly profileSelections: Record<string, Record<string, string | null>>
  readonly activeSkills: Record<string, boolean>
  readonly othersValues: Record<string, number>
  readonly handleSkillToggle: (skillId: string) => void
  readonly handleOthersChange: (skillId: string, value: number) => void
  readonly handleProfileChange: (skillId: string, profileId: string, optionId: string | null) => void
  readonly handleSkillAttributeChange: (skillId: string, attributeId: string | null) => void
  readonly expandedSkillId: string | null
  readonly setExpandedSkillId: React.Dispatch<React.SetStateAction<string | null>>
  readonly skillResults: Record<string, number | null>
  readonly sheetId: string
  /** When true, ProfessionalSkillsSection operates in local mode (no API calls). */
  readonly localMode?: boolean
  /** Professional skills state for local mode (required when localMode is true). */
  readonly localSkills?: import('./types').ProfessionalSkill[]
  /** Called when professional skills change in local mode. */
  readonly onLocalSkillsChange?: (skills: import('./types').ProfessionalSkill[]) => void
}

export function CharacterTab(props: CharacterTabProps) {
  const {
    sheet, permissions,
    enabledCoreResources,
    handleCoreResourceChange, handleCoreResourceModify,
    saveFieldValue, modifierResults, saveAttributeValue, modifiersEnabled,
    armorClasses, acResults, handleAcFieldChange, handleAcAttributeModifierChange,
    allProfiles, profileSelections, activeSkills, othersValues,
    handleSkillToggle, handleOthersChange, handleProfileChange,
    handleSkillAttributeChange, expandedSkillId, setExpandedSkillId,
    skillResults,
    sheetId,
    localMode,
    localSkills,
    onLocalSkillsChange,
  } = props
  const { canEditCharacter, canEditResources, canEditSkills } = permissions
  const { t } = useTranslation()

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
      {/* Three-Column 16:9 Dashboard Layout            */}
      {/* ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,0.85fr)_minmax(300px,0.85fr)_minmax(400px,1.3fr)] items-start">

        {/* ─── LEFT COLUMN — Character Info + Attributes ─── */}
        <div className="space-y-4 lg:overflow-y-auto lg:pr-2 lg:max-h-[calc(100vh-10rem)] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {/* Character Information */}
          {hasFields && (
            <div className="card !p-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-semibold text-sm text-foreground">{t('character:characterInformation')}</h3>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {sheet.fieldValues.map(fv => (
                  <div
                    key={fv.id}
                    className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-background/40 border border-border/60"
                  >
                    <span className="text-xs text-muted font-medium">{fv.templateField.label}</span>
                    {canEditCharacter ? (
                      <InlineText
                        value={fv.value}
                        onSave={(v) => saveFieldValue(fv.templateFieldId, v)}
                        className="text-xs font-semibold text-foreground text-right"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-foreground text-right">{fv.value || '—'}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attributes */}
          {hasAttributes && (
            <div className="card !p-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-semibold text-sm text-foreground">{t('character:attributes')}</h3>
                {modifiersEnabled && sheet.template.attributeModifierFormula && (
                  <span className="badge-gold text-[0.55rem] px-1 py-0.5 rounded">{t('character:mod')}</span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {sheet.template.attributes.map(attr => {
                  const val = sheet.values.find(v => v.attributeId === attr.id)
                  const modResult = modifierResults[attr.id]
                  return (
                    <div
                      key={attr.id}
                      className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-background/40 border border-border/60"
                    >
                      <span className="text-xs font-medium text-foreground">{attr.name}</span>
                      <div className="flex items-center gap-2">
                        {canEditCharacter ? (
                          <InlineText
                            value={val?.value ?? ''}
                            onSave={(v) => saveAttributeValue(attr.id, v)}
                            className="text-xs font-semibold text-foreground tabular-nums text-right"
                          />
                        ) : (
                          <span className="text-xs font-semibold text-foreground tabular-nums">{val?.value || '—'}</span>
                        )}
                        {modifiersEnabled && modResult !== undefined && modResult !== null && (
                          <span className="text-xs font-semibold tabular-nums text-primary min-w-[2rem] text-right">
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

        {/* ─── CENTER COLUMN — Resources (optimized layout) + AC ─── */}
        <div className="space-y-4 lg:overflow-y-auto lg:pr-2 lg:max-h-[calc(100vh-10rem)] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {(hasResources || hasArmor) && (
            <div className="grid grid-cols-1 gap-3">
              {/* Resource cards — stacked vertically */}
              {enabledCoreResources.map(cr => {
                const crv = sheet.coreResourceValues.find(v => v.coreResourceId === cr.id)
                if (!crv) return null
                const canEdit = canEditResources && cr.editableByPlayer
                const modVal = modifierInputs[cr.id] || 0
                return (
                  <div key={cr.id} className="card !p-3 space-y-2 flex flex-col">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold text-foreground truncate">{cr.displayName}</h4>
                      {cr.showNotes && canEdit && (
                        <InlineText
                          value={crv.notes ?? ''}
                          onSave={(v) => handleCoreResourceChange(crv.coreResourceId, 'notes', v)}
                          placeholder={t('character:notesPlaceholder')}
                          emptyDisplay={t('character:notesPlaceholder')}
                          className="!text-[0.6rem] !text-muted !font-normal"
                        />
                      )}
                      {cr.showNotes && crv.notes && !canEdit && (
                        <span className="text-[0.6rem] text-muted truncate max-w-[70px]">{crv.notes}</span>
                      )}
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-2 py-2">
                      <div className="text-center flex-1">
                        <span className="text-[0.5rem] text-muted font-medium uppercase tracking-wider block mb-1">
                          {t('character:current')}
                        </span>
                        {canEdit ? (
                          <InlineNumber
                            value={crv.current ?? 0}
                            onSave={(v) => handleCoreResourceChange(crv.coreResourceId, 'current', String(v))}
                            min={0}
                            className="text-lg font-bold text-foreground tabular-nums"
                          />
                        ) : (
                          <span className="text-lg font-bold text-foreground tabular-nums">{crv.current ?? '—'}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-light">/</span>
                      <div className="text-center flex-1">
                        <span className="text-[0.5rem] text-muted font-medium uppercase tracking-wider block mb-1">
                          {t('character:max')}
                        </span>
                        {canEdit ? (
                          <InlineNumber
                            value={crv.maximum ?? 0}
                            onSave={(v) => handleCoreResourceChange(crv.coreResourceId, 'maximum', String(v))}
                            min={0}
                            className="text-lg font-bold text-foreground tabular-nums"
                          />
                        ) : (
                          <span className="text-lg font-bold text-foreground tabular-nums">{crv.maximum ?? '—'}</span>
                        )}
                      </div>
                    </div>
                    {crv.maximum != null && crv.maximum > 0 && (
                      <div className="w-full h-2 rounded-full bg-background/60 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300 ease-out"
                          style={{
                            width: `${Math.min(100, Math.max(0, ((crv.current ?? 0) / crv.maximum) * 100))}%`,
                            backgroundColor: cr.color || 'var(--color-primary)',
                            filter: 'brightness(1.15)',
                          }}
                        />
                      </div>
                    )}
                    {canEdit && handleCoreResourceModify && (
                      <div className="space-y-1.5 pt-2 border-t border-border/50">
                        <input
                          type="number"
                          min={0}
                          className="input-field py-1 text-[0.6rem] w-full text-center"
                          value={modVal || ''}
                          placeholder={t('character:amount')}
                          onChange={e => setModifierInput(cr.id, Number.parseInt(e.target.value, 10) || 0)}
                        />
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => handleResourceHeal(cr.id)}
                            disabled={!modVal}
                            className="btn-primary text-[0.55rem] py-1 disabled:opacity-40"
                          >
                            {t('character:healButton')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResourceDamage(cr.id)}
                            disabled={!modVal}
                            className="btn-danger text-[0.55rem] py-1 disabled:opacity-40"
                          >
                            {t('character:damageButton')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Armor Class card */}
              {hasArmor && armorClasses.map(ac => (
                <div key={ac.id} className="card !p-3 flex flex-col items-center justify-center space-y-2">
                  <h4 className="text-xs font-semibold text-foreground text-center">
                    {(ac as any).name ?? t('character:armorClass')}
                  </h4>
                  <div className="w-16 h-16 rounded-full border-[2px] border-primary/25 flex items-center justify-center bg-background/40">
                    <span className="text-2xl font-bold text-primary tracking-tight tabular-nums">
                      {acResults[ac.id]?.total ?? '—'}
                    </span>
                  </div>
                  <div className="w-full space-y-1 mt-1">
                    {ac.fields.map(field => {
                      const acv = sheet.acValues.find(v => v.fieldId === field.id)
                      const val = acv?.value ?? field.defaultValue
                      const canEdit = canEditCharacter && field.editableByPlayer
                      return (
                        <div key={field.id} className="flex items-center justify-between gap-1 text-[0.7rem]">
                          <span className="text-muted truncate">{field.name}</span>
                          {canEdit ? (
                            <input
                              type="number"
                              className="input-field py-0.5 text-[0.7rem] w-20 text-right"
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
                          const canChangeAttribute = canEditCharacter && am.allowPlayerSelection
                          const sign = modResult != null && modResult >= 0 ? '+' : ''
                          const modDisplay = modResult != null ? `${sign}${modResult}` : '—'
                          return (
                            <div key={am.id} className="flex items-center justify-between gap-1 text-[0.7rem]">
                              {canChangeAttribute ? (
                                <Select
                                  options={sheet.template.attributes.map(attr => ({ id: attr.id, label: attr.name }))}
                                  value={selectedAttribute?.id ?? ''}
                                  onChange={val => handleAcAttributeModifierChange(am.id, val || null)}
                                  size="sm"
                                  className="min-w-[80px] text-[0.7rem]"
                                />
                              ) : (
                                <span className="text-muted truncate">
                                  {(selectedAttribute?.name ?? am.attribute.name)}
                                </span>
                              )}
                              <span className="font-semibold tabular-nums text-muted-foreground">
                                {modDisplay}
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
        <div className="space-y-3">
          {hasSkills ? (
            <div className="space-y-5">
              {/* Active Skills Table */}
              <SkillTable
                title={t('character:active')}
                skills={activeSkillValues}
                isActiveSide
                canEditSkills={canEditSkills}
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
                title={t('character:inactive')}
                skills={inactiveSkillValues}
                isActiveSide={false}
                canEditSkills={canEditSkills}
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
                <p className="text-xs text-muted/60 italic">{t('character:noSkillsDefinedForTemplate')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── FULL WIDTH: Professional Skills ─── */}
      <ProfessionalSkillsSection
        sheetId={sheetId}
        permissions={permissions}
        modifierResults={modifierResults}
        templateAttributes={sheet.template.attributes}
        allProfiles={allProfiles}
        localMode={localMode}
        localSkills={localSkills}
        onLocalSkillsChange={onLocalSkillsChange}
      />

    </div>
  )
}

// ── Skill Table Sub-component (with internal search + sticky header) ──

interface SkillTableProps {
  readonly title: string
  readonly skills: CharacterSheet['skillValues']
  readonly isActiveSide: boolean
  readonly canEditSkills: boolean
  readonly allProfiles: SkillModifierProfile[]
  readonly profileSelections: Record<string, Record<string, string | null>>
  readonly othersValues: Record<string, number>
  readonly skillResults: Record<string, number | null>
  readonly modifierResults: Record<string, number | null>
  readonly modifiersEnabled: boolean
  readonly expandedSkillId: string | null
  readonly onExpandToggle: React.Dispatch<React.SetStateAction<string | null>>
  readonly onToggle: (skillId: string) => void
  readonly onOthersChange: (skillId: string, value: number) => void
  readonly onProfileChange: (skillId: string, profileId: string, optionId: string | null) => void
  readonly onAttributeChange: (skillId: string, attributeId: string | null) => void
  readonly templateAttributes: { id: string; key: string; name: string }[]
}

function SkillTable({
  title,
  skills,
  isActiveSide,
  canEditSkills,
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
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const filteredSkills = useMemo(() => {
    if (!search.trim()) return skills
    const q = search.toLowerCase()
    return skills.filter(sv => sv.skill.name.toLowerCase().includes(q))
  }, [skills, search])

  const hasSearch = skills.length > 0

  const emptyText = search.trim()
    ? t('character:noSkillsMatchSearch')
    : isActiveSide
      ? t('character:noActiveSkills')
      : t('character:noInactiveSkills')

  return (
    <div className="card !p-0 max-h-[400px] overflow-hidden flex flex-col">
      <div className="shrink-0 px-4 py-2.5 border-b border-border/60 space-y-2 bg-card">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold text-foreground">{title}</h4>
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full bg-primary/10 border border-primary/20 text-[0.55rem] font-medium text-primary">
              {skills.length}
            </span>
          </div>
        </div>
        {hasSearch && (
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="input-field py-1 pl-7 text-xs w-full"
              placeholder={t('character:searchSkillsPlaceholder', { title: title.toLowerCase() })}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {filteredSkills.length > 0 && (
          <div className="sticky top-0 z-10 hidden sm:flex items-center px-4 py-1.5 bg-background/90 backdrop-blur-sm text-[0.55rem] font-semibold text-muted uppercase tracking-wider border-b border-border/40">
            <div className="w-8 shrink-0" />
            <div className="flex-1 shrink-0">{t('character:skillColumn')}</div>
            <div className="w-16 shrink-0 text-right">{t('character:total')}</div>
            <div className="w-8 shrink-0" />
          </div>
        )}

        {filteredSkills.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted">
            {emptyText}
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filteredSkills.map(sv => {
              const isExpanded = expandedSkillId === sv.skillId
              const selectedAttr = sv.selectedAttribute || sv.skill.defaultAttribute || sv.skill.attribute
              const attrMod = isActiveSide
                ? getAttrModifier(selectedAttr?.id, modifierResults)
                : null
              const result = skillResults[sv.skillId]
              const activeTotal = result ?? '—'
              const total = isActiveSide ? activeTotal : 0

              const skillProfiles = allProfiles.filter(p => {
                const tm = (p as any).targetMode ?? 'ALL_SKILLS'
                const tids: string[] = (p as any).targetSkillIds ?? []
                return tm === 'ALL_SKILLS' || tids.length === 0 || tids.includes(sv.skill.name)
              })

              return (
                <div key={sv.id} className={`${isActiveSide ? '' : 'opacity-50'}`}>
                  <div className="flex items-center gap-1.5 px-3 sm:px-4 py-2 hover:bg-background/20 transition-colors">
                    <div className="w-8 shrink-0 flex items-center justify-start">
                      <input
                        type="checkbox"
                        checked={isActiveSide}
                        onChange={() => onToggle(sv.skillId)}
                        disabled={!canEditSkills}
                        className="shrink-0 w-3.5 h-3.5 rounded border-border accent-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => onExpandToggle(isExpanded ? null : sv.skillId)}
                      disabled={!isActiveSide || !canEditSkills}
                      className="flex-1 shrink-0 text-left disabled:cursor-default"
                    >
                      <span className="text-xs font-medium text-foreground truncate block leading-tight">
                        {sv.skill.name}
                      </span>
                      {selectedAttr && (
                        <span className="text-[0.6rem] text-muted font-normal truncate block leading-tight">
                          · {selectedAttr.name}
                        </span>
                      )}
                      {sv.skill.description && (
                        <span className="text-[0.6rem] text-muted truncate block leading-tight mt-0.5">
                          {sv.skill.description}
                        </span>
                      )}
                    </button>

                    <div className="w-16 shrink-0 text-right">
                      <span className={`text-sm font-bold tabular-nums ${isActiveSide ? 'text-primary' : 'text-muted'}`}>
                        {total}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onExpandToggle(isExpanded ? null : sv.skillId)}
                      disabled={!isActiveSide || !canEditSkills}
                      className="w-8 shrink-0 flex items-center justify-center disabled:cursor-default"
                    >
                      <svg
                        className={`w-3 h-3 text-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  <div
                    className={`transition-all duration-200 overflow-hidden ${
                      isExpanded && isActiveSide ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-3 sm:px-4 py-2 space-y-2 border-t border-border/40 ml-10 bg-background/20">
                      {/* Attribute selector */}
                      {(sv.skill.allowedAttributeIds?.length ?? 0) > 0 ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[0.6rem] text-muted shrink-0 min-w-[70px]">{t('character:attributeField')}</span>
                          <Select
                            options={sv.skill.allowedAttributeIds.map(attrId => {
                              const a = templateAttributes.find(x => x.id === attrId)
                              return a ? { id: attrId, label: a.name } : null
                            }).filter(Boolean) as { id: string; label: string }[]}
                            value={sv.selectedAttributeId ?? ''}
                            onChange={val => onAttributeChange(sv.skillId, val || null)}
                            disabled={!canEditSkills}
                            size="sm"
                            className="flex-1 min-w-0 text-[0.6rem]"
                          />
                          {modifiersEnabled && attrMod !== null && (
                            <span className="text-[0.6rem] font-mono text-primary tabular-nums shrink-0">
                              ({attrMod >= 0 ? '+' : ''}{attrMod})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[0.6rem] text-muted shrink-0 min-w-[70px]">{t('character:attributeField')}</span>
                          <span className="text-[0.6rem] text-foreground">
                            {selectedAttr?.name || '—'}
                          </span>
                          {modifiersEnabled && attrMod !== null && (
                            <span className="text-[0.6rem] font-mono text-primary tabular-nums">
                              ({attrMod >= 0 ? '+' : ''}{attrMod})
                            </span>
                          )}
                        </div>
                      )}
                      {skillProfiles.map(profile => {
                        const sid = profileSelections[sv.skillId]?.[profile.id]
                        return (
                          <div key={profile.id} className="flex items-center gap-2">
                            <span className="text-[0.6rem] text-muted shrink-0 min-w-[70px]">{profile.name}:</span>
                            <Select
                              options={profile.options}
                              value={sid}
                              onChange={(id) => onProfileChange(sv.skillId, profile.id, id)}
                              disabled={!canEditSkills}
                              showBadge
                              size="sm"
                              className="flex-1"
                            />
                          </div>
                        )
                      })}
                      <div className="flex items-center gap-2">
                        <span className="text-[0.6rem] text-muted shrink-0 min-w-[70px]">{t('character:others')}</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="input-field py-0.5 text-[0.6rem] w-16"
                          value={othersValues[sv.skillId] || ''}
                          placeholder={t('character:othersPlaceholder')}
                          onChange={e => onOthersChange(sv.skillId, Number.parseInt(e.target.value, 10) || 0)}
                          disabled={!canEditSkills}
                        />
                        <span className="text-[0.6rem] font-mono text-primary tabular-nums">
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
    </div>
  )
}
