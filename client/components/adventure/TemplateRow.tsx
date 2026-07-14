'use client'

import { useState, useEffect, useRef, type FormEvent } from 'react'
import type { CoreResource, AcConfigDraft, ArmorClassAttributeModifierDraft, ResistanceDef } from '@/components/adventure/types'
import AttributeModifierConfig from '@/lib/attribute-modifier-config'
import SkillCalculationConfig from '@/lib/skill-calculation-config'
import ResistanceSystemConfig from '@/lib/resistance-system-config'
import { AcConfigList } from '@/components/adventure/AcConfigList'
import { CollapsibleAttrCard } from '@/components/adventure/CollapsibleAttrCard'
import { CollapsibleSkillCard } from '@/components/adventure/CollapsibleSkillCard'

interface TemplateSummary {
  id: string
  name: string
  description: string | null
  attributes: { id?: string; key: string; name: string }[]
  createdAt: string
}

export function TemplateRow(props: {
  template: TemplateSummary; isGM: boolean; isEditing: boolean; editName: string; editDescription: string; editAttrs: { key: string; name: string }[]; editAttrModifierFormula: string; editSkillFormula: string; editFields?: { key: string; label: string }[]; editSkills?: { name: string; description: string; attributeId: string; allowedAttributeIds?: string[]; defaultAttributeId?: string }[]; editError: string | null; saving: boolean
  onStartEdit: () => void; onCancelEdit: () => void; onUpdate: (e: FormEvent) => void; onDelete: () => void; onEditNameChange: (v: string) => void; onEditDescriptionChange: (v: string) => void
  onAddAttr: () => void; onRemoveAttr: (i: number) => void; onUpdateAttr: (i: number, f: 'key' | 'name', v: string) => void
  onAddField?: () => void; onRemoveField?: (i: number) => void; onUpdateField?: (i: number, f: 'key' | 'label', v: string) => void
  onAddSkill?: () => void; onRemoveSkill?: (i: number) => void; onUpdateSkill?: (i: number, f: string, v: string) => void
  onToggleSkillAllowedAttr?: (i: number, attrKey: string) => void
  editProfiles?: { name: string; targetMode?: string; targetSkillIds?: string[]; options: { label: string; value: number }[] }[]; onAddProfile?: () => void; onRemoveProfile?: (i: number) => void; onUpdateProfile?: (i: number, n: string) => void
  onAddProfileOption?: (pIdx: number) => void; onRemoveProfileOption?: (pIdx: number, oIdx: number) => void; onUpdateProfileOption?: (pIdx: number, oIdx: number, f: 'label' | 'value', v: string | number) => void
  onUpdateProfileTargetMode?: (i: number, mode: string) => void; onToggleProfileSkill?: (i: number, skillId: string) => void
  editCoreResources?: CoreResource[]
  onAddCoreResource?: () => void; onRemoveCoreResource?: (i: number) => void; onUpdateCoreResource?: (i: number, f: 'displayName' | 'slug', v: string) => void
  onUpdateCoreResourceEnabled?: (i: number, v: boolean) => void; onUpdateCoreResourceEditable?: (i: number, v: boolean) => void; onUpdateCoreResourceShowNotes?: (i: number, v: boolean) => void
  editAcConfigs?: AcConfigDraft[]
  editAttrsForAc?: { key: string; name: string }[]
  editAttrModifiersEnabled?: boolean
  onAddEditAcConfig?: () => void; onRemoveEditAcConfig?: (i: number) => void; onUpdateEditAcConfig?: (i: number, patch: Partial<AcConfigDraft>) => void
  onAddEditAcFieldForConfig?: (configIdx: number) => void; onRemoveEditAcFieldForConfig?: (configIdx: number, fieldIdx: number) => void
  onUpdateEditAcFieldForConfig?: (configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) => void; onUpdateEditAcFieldEditableForConfig?: (configIdx: number, fieldIdx: number, v: boolean) => void
  onToggleEditAcAttributeIdForConfig?: (configIdx: number, attrId: string) => void
  onUpdateEditAcAttributeModifierForConfig?: (configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) => void
  onEditAttrModifiersEnabledChange?: (v: boolean) => void
  onEditAttrModifierFormulaChange?: (v: string) => void
  onEditSkillFormulaChange?: (v: string) => void
  editCharacterSections?: { id?: string; name: string }[]
  onAddEditCharacterSection?: () => void; onRemoveEditCharacterSection?: (i: number) => void; onUpdateEditCharacterSection?: (i: number, v: string) => void
  onEditResistancesChange?: (v: ResistanceDef[]) => void
  editResistances?: ResistanceDef[]
  attrsForEditResistance: { key: string; name: string; id?: string }[]
  // Feature selection toggles
  editFeatureSkills: boolean; onEditFeatureSkillsChange: (v: boolean) => void
  editFeatureCustomFields: boolean; onEditFeatureCustomFieldsChange: (v: boolean) => void
  editFeatureCoreResources: boolean; onEditFeatureCoreResourcesChange: (v: boolean) => void
  editFeatureArmorClass: boolean; onEditFeatureArmorClassChange: (v: boolean) => void
  editFeatureCharacterSections: boolean; onEditFeatureCharacterSectionsChange: (v: boolean) => void
  editFeatureSkillProfiles: boolean; onEditFeatureSkillProfilesChange: (v: boolean) => void
  editFeatureResistance: boolean; onEditFeatureResistanceChange: (v: boolean) => void
}) {
  const [expandedEditAttrs, setExpandedEditAttrs] = useState<Record<number, boolean>>({}); const prevEditCount = useRef(0)
  useEffect(() => { if (props.editAttrs.length > prevEditCount.current) { setExpandedEditAttrs(p => ({ ...p, [props.editAttrs.length - 1]: true })) }; prevEditCount.current = props.editAttrs.length }, [props.editAttrs.length])
  useEffect(() => { if (props.isEditing) { setExpandedEditAttrs({}); setEditTab('attrs') } }, [props.isEditing])
  const [editTab, setEditTab] = useState<string>('attrs'); const etabClass = (tab: string) => `px-3 py-1.5 rounded text-xs font-medium transition-colors ${editTab === tab ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted hover:text-foreground'}`
  const allAttrs = props.editAttrs.filter(a => a.key.trim() && a.name.trim()).map(a => ({ key: a.key.trim(), name: a.name.trim() }))

  if (props.isEditing) return <form onSubmit={props.onUpdate} className="rounded-lg border border-primary/30 bg-background/50 p-4 space-y-3">
    <div className="flex items-center gap-3 mb-1">
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20">
        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-foreground">Edit Template</h4>
        <p className="text-xs text-muted">Modify template configuration</p>
      </div>
    </div>
    <hr className="divider" />
    <div><label className="label">Name</label><input className="input-field" value={props.editName} onChange={e => props.onEditNameChange(e.target.value)} maxLength={100} required /></div>
    <div><label className="label">Description <span className="text-muted font-normal">(optional)</span></label><input className="input-field" value={props.editDescription} onChange={e => props.onEditDescriptionChange(e.target.value)} maxLength={200} /></div>

    <div className="flex gap-1 flex-wrap">
      <button type="button" onClick={() => setEditTab('attrs')} className={etabClass('attrs')}>Attributes</button>
      {props.editFeatureSkills && <button type="button" onClick={() => setEditTab('skills')} className={etabClass('skills')}>Skills</button>}
      {props.editFeatureCustomFields && props.onAddField && <button type="button" onClick={() => setEditTab('fields')} className={etabClass('fields')}>Character Info</button>}
      {props.editFeatureCoreResources && props.onAddCoreResource && <button type="button" onClick={() => setEditTab('coreResources')} className={etabClass('coreResources')}>Character Resources</button>}
      {props.editFeatureArmorClass && props.onAddEditAcConfig && <button type="button" onClick={() => setEditTab('ac')} className={etabClass('ac')}>Armor Class</button>}
      {props.editFeatureCharacterSections && <button type="button" onClick={() => setEditTab('characterSections')} className={etabClass('characterSections')}>Personal Abilities</button>}
      {props.editFeatureSkillProfiles && props.onAddProfile && <button type="button" onClick={() => setEditTab('profiles')} className={etabClass('profiles')}>Skill Profiles</button>}
      {props.editFeatureResistance && props.onEditResistancesChange && <button type="button" onClick={() => setEditTab('resistances')} className={etabClass('resistances')}>Resistance System</button>}
    </div>

    {editTab === 'attrs' && <div><label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer mb-3"><input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={props.editAttrModifiersEnabled ?? false} onChange={e => props.onEditAttrModifiersEnabledChange?.(e.target.checked)} />Enable Attribute Modifiers</label>{(props.editAttrModifiersEnabled ?? false) && <div className="mb-3"><AttributeModifierConfig value={props.editAttrModifierFormula} onChange={v => props.onEditAttrModifierFormulaChange?.(v)} placeholder="floor((value - 10) / 2)" /></div>}<div className="space-y-2 mt-1">{props.editAttrs.map((attr, idx) => <CollapsibleAttrCard key={idx} index={idx} attr={attr} isExpanded={!!expandedEditAttrs[idx]} onToggle={() => setExpandedEditAttrs(p => ({ ...p, [idx]: !p[idx] }))} onUpdateAttr={props.onUpdateAttr} onRemove={() => props.onRemoveAttr(idx)} />)}</div><button type="button" onClick={props.onAddAttr} className="btn-ghost text-xs mt-2">+ Add Attribute</button></div>}
    {editTab === 'skills' && <div><div className="mb-3"><SkillCalculationConfig value={props.editSkillFormula} onChange={v => props.onEditSkillFormulaChange?.(v)} customFields={(props.editFields || []).filter(f => f.key.trim() && f.label.trim()).map(f => ({ key: f.key.trim(), label: f.label.trim() }))} placeholder="e.g. value + mod(value)" disabled={!(props.editAttrModifiersEnabled ?? false)} /></div><div className="space-y-2 mt-1">{(props.editSkills || []).map((s: any, idx) => <CollapsibleSkillCard key={idx} index={idx} skill={s} onUpdateSkill={props.onUpdateSkill} onRemove={() => props.onRemoveSkill?.(idx)} attributes={allAttrs} onToggleAllowedAttr={props.onToggleSkillAllowedAttr} onUpdateDefaultAttr={(i, v) => { props.onUpdateSkill?.(i, 'defaultAttributeId', v) }} />)}</div><button type="button" onClick={props.onAddSkill} className="btn-ghost text-xs mt-2">+ Add Skill</button></div>}
    {editTab === 'profiles' && <div><div className="space-y-2 mt-1">{(props.editProfiles || []).map((p: any, pIdx) => <div key={pIdx} className="rounded-lg border border-border bg-background/30 p-3 space-y-2"><div className="flex items-center gap-1.5"><input className="input-field flex-1" value={p.name} onChange={e => props.onUpdateProfile?.(pIdx, e.target.value)} placeholder="Profile name (e.g. mastery)" /><button type="button" onClick={() => props.onRemoveProfile?.(pIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div><div className="rounded border border-border/50 bg-background/20 p-2 space-y-2"><label className="text-xs font-semibold text-muted uppercase tracking-wider">Applies To</label><div className="flex gap-2">{(['ALL_SKILLS', 'SELECTED_SKILLS'] as const).map(mode => <button key={mode} type="button" onClick={() => { props.onUpdateProfileTargetMode?.(pIdx, mode) }} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${((p as any).targetMode ?? 'ALL_SKILLS') === mode ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted hover:text-foreground border border-transparent'}`}>{mode === 'ALL_SKILLS' ? 'All Skills' : 'Selected Skills'}</button>)}</div>{(p as any).targetMode === 'SELECTED_SKILLS' && <div className="space-y-1 max-h-40 overflow-y-auto">{props.editSkills?.filter((s: any) => s.name.trim()).map((s: any) => { const sid = s.name.trim(); const selected = ((p as any).targetSkillIds ?? []).includes(sid); return (<label key={sid} className="flex items-center gap-2 text-xs text-foreground cursor-pointer py-0.5"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={selected} onChange={() => { props.onToggleProfileSkill?.(pIdx, sid) }} /><span>{s.name.trim()}</span></label>) })}{(props.editSkills || []).filter((s: any) => s.name.trim()).length === 0 && <p className="text-xs text-muted italic">Add skills to the template first.</p>}</div>}</div><div className="space-y-1 pl-2">{p.options.map((o: any, oIdx: number) => <div key={oIdx} className="flex items-center gap-1.5"><input className="input-field flex-1 text-xs" value={o.label} onChange={e => props.onUpdateProfileOption?.(pIdx, oIdx, 'label', e.target.value)} placeholder="Option label (e.g. Expert)" /><input className="input-field w-20 text-xs" type="number" value={o.value} onChange={e => props.onUpdateProfileOption?.(pIdx, oIdx, 'value', e.target.value)} placeholder="Value" /><button type="button" onClick={() => props.onRemoveProfileOption?.(pIdx, oIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>)}</div><button type="button" onClick={() => props.onAddProfileOption?.(pIdx)} className="btn-ghost text-xs">+ Add Option</button></div>)}</div><button type="button" onClick={props.onAddProfile} className="btn-ghost text-xs mt-2">+ Add Skill Modifier Profile</button></div>}

    {editTab === 'coreResources' && <div><div className="space-y-2 mt-1">{(props.editCoreResources || []).map((cr: CoreResource, crIdx: number) => <div key={crIdx} className="rounded-lg border border-border bg-background/30 p-3 space-y-2"><div className="flex items-center gap-1.5"><input className="input-field flex-1" value={cr.displayName} onChange={e => props.onUpdateCoreResource?.(crIdx, 'displayName', e.target.value)} placeholder="Display Name (e.g. Health Points)" /><input className="input-field flex-1" value={cr.slug} onChange={e => props.onUpdateCoreResource?.(crIdx, 'slug', e.target.value)} placeholder="Slug (e.g. health_points)" /><button type="button" onClick={() => props.onRemoveCoreResource?.(crIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div><div className="flex items-center gap-4 flex-wrap"><label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.enabled} onChange={e => props.onUpdateCoreResourceEnabled?.(crIdx, e.target.checked)} />Enabled</label><label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.editableByPlayer} onChange={e => props.onUpdateCoreResourceEditable?.(crIdx, e.target.checked)} />Editable by Player</label><label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.showNotes} onChange={e => props.onUpdateCoreResourceShowNotes?.(crIdx, e.target.checked)} />Show Notes</label></div></div>)}</div><button type="button" onClick={props.onAddCoreResource} className="btn-ghost text-xs mt-2">+ Add Character Resource</button></div>}

    {editTab === 'fields' && <div><div className="space-y-2 mt-1">{(props.editFields || []).map((f: any, idx) => <div key={idx} className="flex items-center gap-1.5"><input className="input-field flex-1" value={f.key} onChange={e => props.onUpdateField?.(idx, 'key', e.target.value)} placeholder="Key (e.g. class)" /><input className="input-field flex-1" value={f.label} onChange={e => props.onUpdateField?.(idx, 'label', e.target.value)} placeholder="Label (e.g. Class)" /><button type="button" onClick={() => props.onRemoveField?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>)}</div><button type="button" onClick={props.onAddField} className="btn-ghost text-xs mt-2">+ Add Character Info</button></div>}

    {editTab === 'characterSections' && <div><div className="space-y-2 mt-1">{(props.editCharacterSections || []).map((s, idx) => (<div key={idx} className="flex items-center gap-1.5"><input className="input-field flex-1" value={s.name} onChange={e => props.onUpdateEditCharacterSection?.(idx, e.target.value)} placeholder="Section name (e.g. Talents)" /><button type="button" onClick={() => props.onRemoveEditCharacterSection?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>))}</div><button type="button" onClick={props.onAddEditCharacterSection} className="btn-ghost text-xs mt-2">+ Add Section</button></div>}

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

    {editTab === 'resistances' && props.onEditResistancesChange && <div>
      <ResistanceSystemConfig resistances={props.editResistances || []} attributes={props.attrsForEditResistance.map(a => ({ id: a.id || '', key: a.key, name: a.name }))} onChange={props.onEditResistancesChange} disableAttributeModifiers={!(props.editAttrModifiersEnabled ?? false)} />
    </div>}

    {props.editError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{props.editError}</div>}
    <div className="flex gap-2 justify-end"><button type="button" onClick={props.onCancelEdit} disabled={props.saving} className="btn-ghost text-sm">Cancel</button><button type="submit" disabled={props.saving || !props.editName.trim()} className="btn-primary text-sm">{props.saving ? 'Saving...' : 'Save'}</button></div>
  </form>

  return <div className="group relative flex items-start justify-between py-2.5 px-3 rounded-lg bg-background/50 border border-border hover:border-primary/20 transition-colors"><div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" /><div className="flex-1 min-w-0 relative"><div className="flex items-center gap-2"><span className="text-sm font-medium text-foreground truncate">{props.template.name}</span><span className="badge badge-gold text-[0.6rem]">{props.template.attributes.length} Attribute{props.template.attributes.length !== 1 ? 's' : ''}</span></div>{props.template.description && <p className="text-xs text-muted mt-0.5 truncate">{props.template.description}</p>}</div>{props.isGM && <div className="flex gap-1 shrink-0 ml-2 relative"><button onClick={props.onStartEdit} className="btn-ghost text-xs px-2 py-1">Edit</button><button onClick={props.onDelete} className="text-xs text-danger hover:text-danger/80 px-2 py-1 transition-colors">Delete</button></div>}</div>
}
