'use client'

import { useState, useEffect, useRef, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CoreResource, AcConfigDraft, ArmorClassAttributeModifierDraft, ResistanceDef } from '@/components/adventure/types'
import AttributeModifierConfig from '@/lib/attribute-modifier-config'
import SkillCalculationConfig from '@/lib/skill-calculation-config'
import ResistanceSystemConfig from '@/lib/resistance-system-config'
import { AcConfigList } from '@/components/adventure/AcConfigList'
import { CollapsibleAttrCard } from '@/components/adventure/CollapsibleAttrCard'
import { CollapsibleSkillCard } from '@/components/adventure/CollapsibleSkillCard'
import { NumericInput } from '@/components/shared/NumericInput'

const genId = () => crypto.randomUUID()

interface TemplateSummary {
  id: string
  name: string
  description: string | null
  attributes: { id?: string; key: string; name: string }[]
  skills?: { name: string }[]
  sections?: { name: string }[]
  fields?: { key: string }[]
  profiles?: { name: string }[]
  createdAt: string
}

export function TemplateRow(props: {
  readonly template: TemplateSummary; readonly isGM: boolean; readonly isEditing: boolean; readonly editName: string; readonly editDescription: string; readonly editAttrs: { key: string; name: string }[]; readonly editAttrModifierFormula: string; readonly editSkillFormula: string; readonly editFields?: { key: string; label: string }[]; readonly editSkills?: { name: string; description: string; attributeId: string; allowedAttributeIds?: string[]; defaultAttributeId?: string }[]; readonly editError: string | null; readonly saving: boolean
  readonly onStartEdit: () => void; readonly onCancelEdit: () => void; readonly onUpdate: (e: SubmitEvent) => void; readonly onDelete: () => void; readonly onEditNameChange: (v: string) => void; readonly onEditDescriptionChange: (v: string) => void
  readonly onAddAttr: () => void; readonly onRemoveAttr: (i: number) => void; readonly onUpdateAttr: (i: number, f: 'key' | 'name', v: string) => void
  readonly onAddField?: () => void; readonly onRemoveField?: (i: number) => void; readonly onUpdateField?: (i: number, f: 'key' | 'label', v: string) => void
  readonly onAddSkill?: () => void; readonly onRemoveSkill?: (i: number) => void; readonly onUpdateSkill?: (i: number, f: string, v: string) => void
  readonly onToggleSkillAllowedAttr?: (i: number, attrKey: string) => void
  readonly editProfiles?: { name: string; targetMode?: string; targetSkillIds?: string[]; options: { label: string; value: number }[] }[]; readonly onAddProfile?: () => void; readonly onRemoveProfile?: (i: number) => void; readonly onUpdateProfile?: (i: number, n: string) => void
  readonly onAddProfileOption?: (pIdx: number) => void; readonly onRemoveProfileOption?: (pIdx: number, oIdx: number) => void; readonly onUpdateProfileOption?: (pIdx: number, oIdx: number, f: 'label' | 'value', v: string | number) => void
  readonly onUpdateProfileTargetMode?: (i: number, mode: string) => void; readonly onToggleProfileSkill?: (i: number, skillId: string) => void
  readonly editCoreResources?: CoreResource[]
  readonly onAddCoreResource?: () => void; readonly onRemoveCoreResource?: (i: number) => void; readonly onUpdateCoreResource?: (i: number, f: 'displayName' | 'slug' | 'color', v: string) => void
  readonly onUpdateCoreResourceEnabled?: (i: number, v: boolean) => void; readonly onUpdateCoreResourceEditable?: (i: number, v: boolean) => void; readonly onUpdateCoreResourceShowNotes?: (i: number, v: boolean) => void
  readonly editAcConfigs?: AcConfigDraft[]
  readonly editAttrsForAc?: { key: string; name: string }[]
  readonly editAttrModifiersEnabled?: boolean
  readonly onAddEditAcConfig?: () => void; readonly onRemoveEditAcConfig?: (i: number) => void; readonly onUpdateEditAcConfig?: (i: number, patch: Partial<AcConfigDraft>) => void
  readonly onAddEditAcFieldForConfig?: (configIdx: number) => void; readonly onRemoveEditAcFieldForConfig?: (configIdx: number, fieldIdx: number) => void
  readonly onUpdateEditAcFieldForConfig?: (configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) => void; readonly onUpdateEditAcFieldEditableForConfig?: (configIdx: number, fieldIdx: number, v: boolean) => void
  readonly onToggleEditAcAttributeIdForConfig?: (configIdx: number, attrId: string) => void
  readonly onUpdateEditAcAttributeModifierForConfig?: (configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) => void
  readonly onEditAttrModifiersEnabledChange?: (v: boolean) => void
  readonly onEditAttrModifierFormulaChange?: (v: string) => void
  readonly onEditSkillFormulaChange?: (v: string) => void
  readonly editCharacterSections?: { id?: string; name: string }[]
  readonly onAddEditCharacterSection?: () => void; readonly onRemoveEditCharacterSection?: (i: number) => void; readonly onUpdateEditCharacterSection?: (i: number, v: string) => void
  readonly onEditResistancesChange?: (v: ResistanceDef[]) => void
  readonly editResistances?: ResistanceDef[]
  readonly attrsForEditResistance: { key: string; name: string; id?: string }[]
  // Feature selection toggles
  readonly editFeatureSkills: boolean
  readonly editFeatureCustomFields: boolean
  readonly editFeatureCoreResources: boolean
  readonly editFeatureArmorClass: boolean
  readonly editFeatureCharacterSections: boolean
  readonly editFeatureSkillProfiles: boolean
  readonly editFeatureResistance: boolean
}) {
  const { t } = useTranslation()
  const itemKeys = useRef<Record<string, string>>({})
  const keyFor = (k: string | number) => (itemKeys.current[k] ??= genId())
  const [expandedEditAttrs, setExpandedEditAttrs] = useState<Record<number, boolean>>({})
  const prevEditCount = useRef(0)
  const [editTab, setEditTab] = useState<string>('attrs')

  useEffect(() => {
    if (props.editAttrs.length > prevEditCount.current) {
      setExpandedEditAttrs(p => ({ ...p, [props.editAttrs.length - 1]: true }))
    }
    prevEditCount.current = props.editAttrs.length
  }, [props.editAttrs.length])

  useEffect(() => {
    if (props.isEditing) {
      setExpandedEditAttrs({})
      setEditTab('attrs')
    }
  }, [props.isEditing])

  const etabClass = (tab: string) =>
    `relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
      editTab === tab
        ? 'bg-primary/15 text-primary shadow-sm border border-primary/20'
        : 'text-muted hover:text-foreground hover:bg-background/40 border border-transparent'
    }`

  const allAttrs = props.editAttrs.filter(a => a.key.trim() && a.name.trim()).map(a => ({ key: a.key.trim(), name: a.name.trim() }))

  // ── EDIT MODE ──
  if (props.isEditing) {
    return (
      <form onSubmit={props.onUpdate} className="card !p-5 animate-slide-up space-y-4 border-primary/20">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 border border-primary/20">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gradient">{t('campaign:editTemplate')}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{t('campaign:modifyNamed', { name: props.template.name })}</p>
          </div>
        </div>
        <hr className="divider" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">{t('common:name')}</label>
            <input className="input-field" value={props.editName} onChange={e => props.onEditNameChange(e.target.value)} maxLength={100} required />
          </div>
          <div>
            <label className="label">{t('common:description')} <span className="text-muted font-normal">{t('campaign:optionalLower')}</span></label>
            <input className="input-field" value={props.editDescription} onChange={e => props.onEditDescriptionChange(e.target.value)} maxLength={200} />
          </div>
        </div>

        {/* Sub-tab pills */}
        <div className="flex gap-1.5 flex-wrap">
          <button type="button" onClick={() => setEditTab('attrs')} className={etabClass('attrs')}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('campaign:attributes')}
          </button>
          {props.editFeatureSkills && (
            <button type="button" onClick={() => setEditTab('skills')} className={etabClass('skills')}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t('campaign:skills')}
            </button>
          )}
          {props.editFeatureCustomFields && props.onAddField && (
            <button type="button" onClick={() => setEditTab('fields')} className={etabClass('fields')}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
              </svg>
              {t('campaign:characterInfo')}
            </button>
          )}
          {props.editFeatureCoreResources && props.onAddCoreResource && (
            <button type="button" onClick={() => setEditTab('coreResources')} className={etabClass('coreResources')}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {t('campaign:resources')}
            </button>
          )}
          {props.editFeatureArmorClass && props.onAddEditAcConfig && (
            <button type="button" onClick={() => setEditTab('ac')} className={etabClass('ac')}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {t('campaign:armorClass')}
            </button>
          )}
          {props.editFeatureCharacterSections && (
            <button type="button" onClick={() => setEditTab('characterSections')} className={etabClass('characterSections')}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {t('campaign:abilities')}
            </button>
          )}
          {props.editFeatureSkillProfiles && props.onAddProfile && (
            <button type="button" onClick={() => setEditTab('profiles')} className={etabClass('profiles')}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {t('campaign:profiles')}
            </button>
          )}
          {props.editFeatureResistance && props.onEditResistancesChange && (
            <button type="button" onClick={() => setEditTab('resistances')} className={etabClass('resistances')}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {t('campaign:resistances')}
            </button>
          )}
        </div>

        <hr className="divider" />

        {/* Tab content */}
        {editTab === 'attrs' && (
          <div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{t('campaign:attributesDescriptionShort')}</p>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer mb-3">
              <input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={props.editAttrModifiersEnabled ?? false} onChange={e => props.onEditAttrModifiersEnabledChange?.(e.target.checked)} />
              {t('campaign:enableAttributeModifiers')}
            </label>
            {(props.editAttrModifiersEnabled ?? false) && (
              <div className="mb-3"><AttributeModifierConfig value={props.editAttrModifierFormula} onChange={v => props.onEditAttrModifierFormulaChange?.(v)} placeholder={t('campaign:attrModifierFormulaPlaceholder')} /></div>
            )}
            <div className="space-y-2 mt-1">{props.editAttrs.map((attr, idx) => <CollapsibleAttrCard key={keyFor(idx)} index={idx} attr={attr} isExpanded={!!expandedEditAttrs[idx]} onToggle={() => setExpandedEditAttrs(p => ({ ...p, [idx]: !p[idx] }))} onUpdateAttr={props.onUpdateAttr} onRemove={() => props.onRemoveAttr(idx)} />)}</div>
            <button type="button" onClick={props.onAddAttr} className="btn-ghost text-xs mt-3 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              {t('campaign:addAttribute')}
            </button>
          </div>
        )}
        {editTab === 'skills' && (
          <div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{t('campaign:skillsDescriptionShort')}</p>
            <div className="mb-3"><SkillCalculationConfig value={props.editSkillFormula} onChange={v => props.onEditSkillFormulaChange?.(v)} customFields={(props.editFields || []).filter(f => f.key.trim() && f.label.trim()).map(f => ({ key: f.key.trim(), label: f.label.trim() }))} placeholder={t('campaign:skillFormulaPlaceholder')} disabled={!(props.editAttrModifiersEnabled ?? false)} /></div>
            <div className="space-y-2 mt-1">{(props.editSkills || []).map((s: any, idx) => <CollapsibleSkillCard key={keyFor(idx)} index={idx} skill={s} onUpdateSkill={props.onUpdateSkill} onRemove={() => props.onRemoveSkill?.(idx)} attributes={allAttrs} onToggleAllowedAttr={props.onToggleSkillAllowedAttr} onUpdateDefaultAttr={(i, v) => { props.onUpdateSkill?.(i, 'defaultAttributeId', v) }} />)}</div>
            <button type="button" onClick={props.onAddSkill} className="btn-ghost text-xs mt-3 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              {t('campaign:addSkill')}
            </button>
          </div>
        )}
        {editTab === 'fields' && (
          <div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{t('campaign:fieldsDescription')}</p>
            <div className="space-y-2 mt-1">{(props.editFields || []).map((f: any, idx) => <div key={keyFor(idx)} className="flex items-center gap-1.5"><input className="input-field flex-1" value={f.key} onChange={e => props.onUpdateField?.(idx, 'key', e.target.value)} placeholder={t('campaign:fieldKeyPlaceholderClass')} /><input className="input-field flex-1" value={f.label} onChange={e => props.onUpdateField?.(idx, 'label', e.target.value)} placeholder={t('campaign:fieldLabelPlaceholder')} /><button type="button" onClick={() => props.onRemoveField?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0 px-1">✕</button></div>)}</div>
            <button type="button" onClick={props.onAddField} className="btn-ghost text-xs mt-3 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              {t('campaign:addField')}
            </button>
          </div>
        )}
        {editTab === 'coreResources' && (
          <div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{t('campaign:coreResourcesDescriptionShort')}</p>
            <div className="space-y-2 mt-1">{(props.editCoreResources || []).map((cr: CoreResource, crIdx: number) => <div key={keyFor(crIdx)} className="rounded-lg border border-border bg-background/30 p-3 space-y-2">
              <div className="flex items-center gap-1.5"><input className="input-field flex-1" value={cr.displayName} onChange={e => props.onUpdateCoreResource?.(crIdx, 'displayName', e.target.value)} placeholder={t('campaign:displayNamePlaceholderHealth')} /><input className="input-field flex-[0.35]" value={cr.slug} onChange={e => props.onUpdateCoreResource?.(crIdx, 'slug', e.target.value)} placeholder={t('campaign:slugPlaceholderHealth')} /><input type="color" value={cr.color || '#f59e0b'} onChange={e => props.onUpdateCoreResource?.(crIdx, 'color', e.target.value)} className="w-7 h-7 p-0.5 rounded cursor-pointer shrink-0 bg-transparent" /><button type="button" onClick={() => props.onRemoveCoreResource?.(crIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0 px-1">✕</button></div>
              <div className="flex items-center gap-4 flex-wrap"><label className="flex items-center gap-1 text-xs text-muted cursor-pointer"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.enabled} onChange={e => props.onUpdateCoreResourceEnabled?.(crIdx, e.target.checked)} />{t('campaign:enabled')}</label><label className="flex items-center gap-1 text-xs text-muted cursor-pointer"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.editableByPlayer} onChange={e => props.onUpdateCoreResourceEditable?.(crIdx, e.target.checked)} />{t('campaign:editable')}</label><label className="flex items-center gap-1 text-xs text-muted cursor-pointer"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.showNotes} onChange={e => props.onUpdateCoreResourceShowNotes?.(crIdx, e.target.checked)} />{t('campaign:showNotes')}</label></div>
            </div>)}</div>
            <button type="button" onClick={props.onAddCoreResource} className="btn-ghost text-xs mt-3 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              {t('campaign:addResource')}
            </button>
          </div>
        )}
        {editTab === 'characterSections' && (
          <div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{t('campaign:characterSectionsDescriptionShort')}</p>
            <div className="space-y-2 mt-1">{(props.editCharacterSections || []).map((s, idx) => (<div key={keyFor(idx)} className="flex items-center gap-1.5"><input className="input-field flex-1" value={s.name} onChange={e => props.onUpdateEditCharacterSection?.(idx, e.target.value)} placeholder={t('campaign:sectionNamePlaceholder')} /><button type="button" onClick={() => props.onRemoveEditCharacterSection?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0 px-1">✕</button></div>))}</div>
            <button type="button" onClick={props.onAddEditCharacterSection} className="btn-ghost text-xs mt-3 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              {t('campaign:addSection')}
            </button>
          </div>
        )}
        {editTab === 'ac' && props.onAddEditAcConfig && (
          <div className="space-y-2 mt-1">
            <AcConfigList
              configs={props.editAcConfigs ?? []}
              attrs={props.editAttrsForAc ?? allAttrs}
              attrModifiersEnabled={props.editAttrModifiersEnabled ?? false}
              onAdd={props.onAddEditAcConfig}
              onRemove={props.onRemoveEditAcConfig}
              onUpdateConfig={props.onUpdateEditAcConfig}
              onAddField={props.onAddEditAcFieldForConfig}
              onRemoveField={props.onRemoveEditAcFieldForConfig}
              onUpdateField={props.onUpdateEditAcFieldForConfig}
              onUpdateFieldEditable={props.onUpdateEditAcFieldEditableForConfig}
              onToggleAttributeId={props.onToggleEditAcAttributeIdForConfig}
              onUpdateAttributeModifier={props.onUpdateEditAcAttributeModifierForConfig}
            />
          </div>
        )}
        {editTab === 'profiles' && (
          <div className="space-y-2 mt-1">
            {(props.editProfiles || []).map((p: any, pIdx: number) => (
              <div key={keyFor(pIdx)} className="rounded-lg border border-border bg-background/30 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <input className="input-field flex-1" value={p.name} onChange={e => props.onUpdateProfile?.(pIdx, e.target.value)} placeholder={t('campaign:profileNamePlaceholder')} />
                  <button type="button" onClick={() => props.onRemoveProfile?.(pIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button>
                </div>
                <div className="rounded border border-border/50 bg-background/20 p-2 space-y-2">
                  <label className="text-xs font-semibold text-muted uppercase tracking-wider">{t('campaign:appliesTo')}</label>
                  <div className="flex gap-2">
                    {(['ALL_SKILLS', 'SELECTED_SKILLS'] as const).map(mode => (
                      <button key={mode} type="button" onClick={() => { props.onUpdateProfileTargetMode?.(pIdx, mode) }}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${((p as any).targetMode ?? 'ALL_SKILLS') === mode ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted hover:text-foreground border border-transparent'}`}>
                        {mode === 'ALL_SKILLS' ? t('campaign:allSkills') : t('campaign:selectedSkills')}
                      </button>
                    ))}
                  </div>
                  {(p as any).targetMode === 'SELECTED_SKILLS' && (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {props.editSkills?.filter((s: any) => s.name.trim()).map((s: any) => {
                        const sid = s.name.trim()
                        const selected = ((p as any).targetSkillIds ?? []).includes(sid)
                        return (
                          <label key={sid} className="flex items-center gap-2 text-xs text-foreground cursor-pointer py-0.5">
                            <input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={selected} onChange={() => { props.onToggleProfileSkill?.(pIdx, sid) }} />
                            <span>{s.name.trim()}</span>
                          </label>
                        )
                      })}
                      {(props.editSkills || []).filter((s: any) => s.name.trim()).length === 0 && (
                        <p className="text-xs text-muted italic">{t('campaign:addSkillsToTemplateFirst')}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-1 pl-2">
                  {p.options.map((o: any, oIdx: number) => (
                    <div key={keyFor(`p${pIdx}:o${oIdx}`)} className="flex items-center gap-1.5">
                      <input className="input-field flex-1 text-xs" value={o.label} onChange={e => props.onUpdateProfileOption?.(pIdx, oIdx, 'label', e.target.value)} placeholder={t('campaign:optionLabelPlaceholder')} />
                      <NumericInput className="input-field w-20 text-xs" value={o.value} onChange={e => props.onUpdateProfileOption?.(pIdx, oIdx, 'value', e.target.value)} placeholder={t('campaign:value')} wrapperClassName="w-20" inputClassName="!text-xs" />
                      <button type="button" onClick={() => props.onRemoveProfileOption?.(pIdx, oIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => props.onAddProfileOption?.(pIdx)} className="btn-ghost text-xs">{t('campaign:addOption')}</button>
              </div>
            ))}
            <button type="button" onClick={props.onAddProfile} className="btn-ghost text-xs mt-2 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              {t('campaign:addSkillProfile')}
            </button>
          </div>
        )}
        {editTab === 'resistances' && props.onEditResistancesChange && (
          <div>
            <ResistanceSystemConfig resistances={props.editResistances || []} attributes={props.attrsForEditResistance.map(a => ({ id: a.id || '', key: a.key, name: a.name }))} onChange={props.onEditResistancesChange} disableAttributeModifiers={!(props.editAttrModifiersEnabled ?? false)} />
          </div>
        )}

        {props.editError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{props.editError}</div>}
        <div className="flex gap-3 justify-end pt-2 border-t border-border/40">
          <button type="button" onClick={props.onCancelEdit} disabled={props.saving} className="btn-ghost text-sm">{t('common:cancel')}</button>
          <button type="submit" disabled={props.saving || !props.editName.trim()} className="btn-primary text-sm">
            {props.saving ? (
              <><div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />{t('campaign:saving')}</>
            ) : t('campaign:saveChanges')}
          </button>
        </div>
      </form>
    )
  }

  // ── READ-ONLY CARD VIEW ──
  return (
    <div className="relative group">
      {/* Gold accent line at top */}
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />

      <div className="relative rounded-xl border border-border/60 bg-background/40 hover:bg-background/60 hover:border-primary/20 transition-all duration-200 p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h4 className="text-sm font-semibold text-foreground truncate max-w-[250px]">{props.template.name}</h4>
              {/* attribute count removed */}
            </div>
            {props.template.description && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{props.template.description}</p>
            )}
            {/* attribute chips removed */}
            {/* Feature indicators */}
            <div className="flex gap-1.5 mt-2.5 flex-wrap">
              {props.template.skills && props.template.skills.length > 0 && (
                <span className="text-[0.5rem] px-2 py-0.5 rounded bg-accent/8 text-accent/70 border border-accent/10 font-medium inline-flex items-center gap-1">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  {t('campaign:rowSkillsCount', { count: props.template.skills.length })}
                </span>
              )}
              {props.template.sections && props.template.sections.length > 0 && (
                <span className="text-[0.5rem] px-2 py-0.5 rounded bg-emerald-500/8 text-emerald-400/70 border border-emerald-500/10 font-medium inline-flex items-center gap-1">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  {t('campaign:rowSectionCount', { count: props.template.sections.length })}
                </span>
              )}
              {props.template.fields && props.template.fields.length > 0 && (
                <span className="text-[0.5rem] px-2 py-0.5 rounded bg-sky-500/8 text-sky-400/70 border border-sky-500/10 font-medium inline-flex items-center gap-1">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" /></svg>
                  {t('campaign:rowFieldCount', { count: props.template.fields.length })}
                </span>
              )}
              {props.template.profiles && props.template.profiles.length > 0 && (
                <span className="text-[0.5rem] px-2 py-0.5 rounded bg-amber-500/8 text-amber-400/70 border border-amber-500/10 font-medium inline-flex items-center gap-1">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  {t('campaign:rowProfileCount', { count: props.template.profiles.length })}
                </span>
              )}
              {/* basic-template message removed */}
            </div>
          </div>

          {/* Right actions */}
          {props.isGM && (
            <div className="flex gap-1.5 shrink-0">
              <button onClick={props.onStartEdit} className="btn-ghost text-xs px-3 py-1.5 inline-flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t('common:edit')}
              </button>
              <button onClick={props.onDelete} className="btn-danger text-xs px-3 py-1.5 inline-flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {t('common:delete')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
