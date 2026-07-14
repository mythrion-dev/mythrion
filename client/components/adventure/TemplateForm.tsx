'use client'

import { useState, useEffect, useRef, type FormEvent } from 'react'
import type { CoreResource, AcConfigDraft, ArmorClassAttributeModifierDraft, ResistanceDef } from '@/components/adventure/types'
import AttributeModifierConfig from '@/lib/attribute-modifier-config'
import SkillCalculationConfig from '@/lib/skill-calculation-config'
import ResistanceSystemConfig from '@/lib/resistance-system-config'
import MythrionPopover from '@/lib/mythrion-popover'
import { AcConfigList } from '@/components/adventure/AcConfigList'
import { CollapsibleAttrCard } from '@/components/adventure/CollapsibleAttrCard'
import { CollapsibleSkillCard } from '@/components/adventure/CollapsibleSkillCard'

export function TemplateForm(props: {
  newTemplateName: string; newTemplateDescription: string; newTemplateAttrs: { key: string; name: string }[]
  newAttrModifierFormula: string; newSkillFormula: string; newTemplateSkills?: { name: string; description: string; attributeId: string; allowedAttributeIds: string[]; defaultAttributeId: string }[]; newTemplateProfiles?: { name: string; options: { label: string; value: number }[] }[]; newTemplateFields?: { key: string; label: string }[]
  templateError: string | null; templateCreating: boolean; onNameChange: (v: string) => void; onDescriptionChange: (v: string) => void
  onAddAttr: () => void; onRemoveAttr: (i: number) => void; onUpdateAttr: (i: number, f: 'key' | 'name', v: string) => void
  onAddSkill?: () => void; onRemoveSkill?: (i: number) => void; onUpdateSkill?: (i: number, f: string, v: string) => void
  onToggleSkillAllowedAttr?: (i: number, attrKey: string) => void
  onAddProfile?: () => void; onRemoveProfile?: (i: number) => void; onUpdateProfile?: (i: number, n: string) => void
  onAddProfileOption?: (pIdx: number) => void; onRemoveProfileOption?: (pIdx: number, oIdx: number) => void; onUpdateProfileOption?: (pIdx: number, oIdx: number, f: 'label' | 'value', v: string | number) => void
  onAddField?: () => void; onRemoveField?: (i: number) => void; onUpdateField?: (i: number, f: 'key' | 'label', v: string) => void
  onUpdateProfileTargetMode?: (i: number, mode: string) => void; onToggleProfileSkill?: (i: number, skillId: string) => void
  onCancelNew: () => void; onCreateTemplate: (e: FormEvent) => void
  newCoreResources?: CoreResource[]
  onAddCoreResource?: () => void; onRemoveCoreResource?: (i: number) => void; onUpdateCoreResource?: (i: number, f: 'displayName' | 'slug', v: string) => void
  onUpdateCoreResourceEnabled?: (i: number, v: boolean) => void; onUpdateCoreResourceEditable?: (i: number, v: boolean) => void; onUpdateCoreResourceShowNotes?: (i: number, v: boolean) => void
  newAcConfigs?: AcConfigDraft[]
  newAttrsForAc?: { key: string; name: string }[]
  newAttrModifiersEnabled?: boolean
  onAddNewAcConfig?: () => void; onRemoveNewAcConfig?: (i: number) => void; onUpdateNewAcConfig?: (i: number, patch: Partial<AcConfigDraft>) => void
  onAddNewAcFieldForConfig?: (configIdx: number) => void; onRemoveNewAcFieldForConfig?: (configIdx: number, fieldIdx: number) => void
  onUpdateNewAcFieldForConfig?: (configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) => void; onUpdateNewAcFieldEditableForConfig?: (configIdx: number, fieldIdx: number, v: boolean) => void
  onToggleNewAcAttributeIdForConfig?: (configIdx: number, attrId: string) => void
  onUpdateNewAcAttributeModifierForConfig?: (configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) => void
  onNewAttrModifiersEnabledChange?: (v: boolean) => void
  onNewAttrModifierFormulaChange?: (v: string) => void
  onNewSkillFormulaChange?: (v: string) => void
  newCharacterSections?: { id?: string; name: string }[]
  onAddNewCharacterSection?: () => void; onRemoveNewCharacterSection?: (i: number) => void; onUpdateNewCharacterSection?: (i: number, v: string) => void
  onNewResistancesChange?: (v: ResistanceDef[]) => void
  newResistances?: ResistanceDef[]
  attrsForNewResistance: { key: string; name: string; id?: string }[]
  // Feature selection toggles
  newFeatureSkills: boolean; onNewFeatureSkillsChange: (v: boolean) => void
  newFeatureCustomFields: boolean; onNewFeatureCustomFieldsChange: (v: boolean) => void
  newFeatureCoreResources: boolean; onNewFeatureCoreResourcesChange: (v: boolean) => void
  newFeatureArmorClass: boolean; onNewFeatureArmorClassChange: (v: boolean) => void
  newFeatureCharacterSections: boolean; onNewFeatureCharacterSectionsChange: (v: boolean) => void
  newFeatureSkillProfiles: boolean; onNewFeatureSkillProfilesChange: (v: boolean) => void
  newFeatureResistance: boolean; onNewFeatureResistanceChange: (v: boolean) => void
}) {
  const [activeTab, setActiveTab] = useState<string>('attrs')
  const [wizardDone, setWizardDone] = useState(false)
  const [expandedAttrs, setExpandedAttrs] = useState<Record<number, boolean>>({}); const prevCount = useRef(0)
  useEffect(() => { if (props.newTemplateAttrs.length > prevCount.current) { setExpandedAttrs(p => ({ ...p, [props.newTemplateAttrs.length - 1]: true })) }; prevCount.current = props.newTemplateAttrs.length }, [props.newTemplateAttrs.length])
  const tabClass = (tab: string) => `px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === tab ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted hover:text-foreground'}`
  const allAttrs = props.newTemplateAttrs.filter(a => a.key.trim() && a.name.trim()).map(a => ({ key: a.key.trim(), name: a.name.trim() }))

  return <>
    {!wizardDone ? <div className="rounded-lg border border-primary/20 bg-background/50 p-4 space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20">
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Create Template</h4>
          <p className="text-xs text-muted">Step 1: Configure basic info and select features</p>
        </div>
      </div>
      <div><label className="label">Name</label><input className="input-field" value={props.newTemplateName} onChange={e => props.onNameChange(e.target.value)} placeholder="e.g. D&D 5e Character Sheet" maxLength={100} required /></div>
      <div><label className="label">Description <span className="text-muted font-normal">(optional)</span></label><input className="input-field" value={props.newTemplateDescription} onChange={e => props.onDescriptionChange(e.target.value)} placeholder="Brief description of this template" maxLength={200} /></div>
      <div className="rounded-lg border border-border/40 bg-background/30 p-3 space-y-3">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Features</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <label className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer"><input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" checked={props.newFeatureSkills} onChange={e => props.onNewFeatureSkillsChange(e.target.checked)} /><span>Skills</span><MythrionPopover side="top" align="center" sideOffset={4} content={<div className="space-y-1.5"><p className="text-xs font-semibold text-foreground">Skills</p><p className="text-xs text-foreground/80 leading-relaxed">Add skills like Stealth, Perception, or Athletics. Players can assign values to each skill and roll checks against them.</p></div>}><span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[0.6rem] font-bold text-muted-foreground border border-border/60 cursor-help hover:text-foreground hover:border-foreground/40 transition-colors">?</span></MythrionPopover></label>
          <label className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer"><input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" checked={props.newFeatureCustomFields} onChange={e => props.onNewFeatureCustomFieldsChange(e.target.checked)} /><span>Character Info</span><MythrionPopover side="top" align="center" sideOffset={4} content={<div className="space-y-1.5"><p className="text-xs font-semibold text-foreground">Character Info</p><p className="text-xs text-foreground/80 leading-relaxed">Add custom text fields for player details like Class, Race, or Background.</p></div>}><span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[0.6rem] font-bold text-muted-foreground border border-border/60 cursor-help hover:text-foreground hover:border-foreground/40 transition-colors">?</span></MythrionPopover></label>
          <label className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer"><input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" checked={props.newFeatureCoreResources} onChange={e => props.onNewFeatureCoreResourcesChange(e.target.checked)} /><span>Core Resources</span><MythrionPopover side="top" align="center" sideOffset={4} content={<div className="space-y-1.5"><p className="text-xs font-semibold text-foreground">Core Resources</p><p className="text-xs text-foreground/80 leading-relaxed">Set up trackable resources like Hit Points, Mana, or Stamina that players can edit on their sheet.</p></div>}><span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[0.6rem] font-bold text-muted-foreground border border-border/60 cursor-help hover:text-foreground hover:border-foreground/40 transition-colors">?</span></MythrionPopover></label>
          <label className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer"><input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" checked={props.newFeatureArmorClass} onChange={e => props.onNewFeatureArmorClassChange(e.target.checked)} /><span>Armor Class</span><MythrionPopover side="top" align="center" sideOffset={4} content={<div className="space-y-1.5"><p className="text-xs font-semibold text-foreground">Armor Class</p><p className="text-xs text-foreground/80 leading-relaxed">Set up armor class using components — like base AC plus Dexterity modifier — linked to your attributes.</p></div>}><span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[0.6rem] font-bold text-muted-foreground border border-border/60 cursor-help hover:text-foreground hover:border-foreground/40 transition-colors">?</span></MythrionPopover></label>
          <label className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer"><input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" checked={props.newFeatureCharacterSections} onChange={e => props.onNewFeatureCharacterSectionsChange(e.target.checked)} /><span>Personal Abilities</span><MythrionPopover side="top" align="center" sideOffset={4} content={<div className="space-y-1.5"><p className="text-xs font-semibold text-foreground">Personal Abilities</p><p className="text-xs text-foreground/80 leading-relaxed">Add free-form sections like Talents, Traits, or Inventory for additional character details.</p></div>}><span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[0.6rem] font-bold text-muted-foreground border border-border/60 cursor-help hover:text-foreground hover:border-foreground/40 transition-colors">?</span></MythrionPopover></label>
          <label className={`flex items-center gap-1.5 text-sm cursor-pointer ${props.newFeatureSkills ? 'text-foreground' : 'text-muted'}`}><input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" checked={props.newFeatureSkillProfiles} onChange={e => props.onNewFeatureSkillProfilesChange(e.target.checked)} disabled={!props.newFeatureSkills} /><span>Skill Profiles</span><MythrionPopover side="top" align="center" sideOffset={4} content={<div className="space-y-1.5"><p className="text-xs font-semibold text-foreground">Skill Profiles</p><p className="text-xs text-foreground/80 leading-relaxed">Pre-define modifier levels (Untrained, Expert, Master, etc.) that apply to skills. Requires Skills to be enabled.</p></div>}><span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[0.6rem] font-bold text-muted-foreground border border-border/60 cursor-help hover:text-foreground hover:border-foreground/40 transition-colors">?</span></MythrionPopover></label>
          <label className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer"><input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary" checked={props.newFeatureResistance} onChange={e => props.onNewFeatureResistanceChange(e.target.checked)} /><span>Resistance System</span><MythrionPopover side="top" align="center" sideOffset={4} content={<div className="space-y-1.5"><p className="text-xs font-semibold text-foreground">Resistance System</p><p className="text-xs text-foreground/80 leading-relaxed">Define damage types and configure resistance or weakness calculations for your characters.</p></div>}><span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[0.6rem] font-bold text-muted-foreground border border-border/60 cursor-help hover:text-foreground hover:border-foreground/40 transition-colors">?</span></MythrionPopover></label>
        </div>
      </div>
      <hr className="divider" />
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-semibold">1</span>
        <span className="text-sm font-medium text-foreground">Basic Info</span>
      </div>
      <hr className="divider" />
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-semibold">2</span>
        <span className="text-sm font-medium text-foreground">Choose Features</span>
      </div>
      <div className="flex gap-2 justify-end pt-1"><button type="button" onClick={() => setWizardDone(true)} className="btn-primary text-sm"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Continue</button></div>
    </div> : <form onSubmit={props.onCreateTemplate} className="rounded-lg border border-primary/20 bg-background/50 p-4 space-y-3">
    <div className="flex items-center gap-3 mb-1">
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20">
        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-foreground">Create Template</h4>
        <p className="text-xs text-muted">Step 2: Configure template details</p>
      </div>
    </div>
    <hr className="divider" />
    <div><label className="label">Name</label><input className="input-field" value={props.newTemplateName} onChange={e => props.onNameChange(e.target.value)} placeholder="e.g. D&D 5e Character Sheet" maxLength={100} required /></div>
    <div><label className="label">Description <span className="text-muted font-normal">(optional)</span></label><input className="input-field" value={props.newTemplateDescription} onChange={e => props.onDescriptionChange(e.target.value)} placeholder="Brief description of this template" maxLength={200} /></div>
    <div className="flex gap-1 flex-wrap">
      <button type="button" onClick={() => setActiveTab('attrs')} className={tabClass('attrs')}>Attributes</button>
      {props.newFeatureSkills && <button type="button" onClick={() => setActiveTab('skills')} className={tabClass('skills')}>Skills</button>}
      {props.newFeatureCustomFields && props.onAddField && <button type="button" onClick={() => setActiveTab('fields')} className={tabClass('fields')}>Character Info</button>}
      {props.newFeatureCoreResources && props.onAddCoreResource && <button type="button" onClick={() => setActiveTab('coreResources')} className={tabClass('coreResources')}>Character Resources</button>}
      {props.newFeatureArmorClass && props.onAddNewAcConfig && <button type="button" onClick={() => setActiveTab('ac')} className={tabClass('ac')}>Armor Class</button>}
      {props.newFeatureCharacterSections && <button type="button" onClick={() => setActiveTab('characterSections' as any)} className={tabClass('characterSections' as any)}>Personal Abilities</button>}
      {props.newFeatureSkillProfiles && props.onAddProfile && <button type="button" onClick={() => setActiveTab('profiles')} className={tabClass('profiles')}>Skill Profiles</button>}
      {props.newFeatureResistance && props.onNewResistancesChange && <button type="button" onClick={() => setActiveTab('resistances')} className={tabClass('resistances')}>Resistance System</button>}
    </div>

    {activeTab === 'attrs' && <div>
      <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer mb-3">
        <input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={props.newAttrModifiersEnabled ?? false} onChange={e => props.onNewAttrModifiersEnabledChange?.(e.target.checked)} />
        Enable Attribute Modifiers
      </label>
      {(props.newAttrModifiersEnabled ?? false) && <div className="mb-3"><AttributeModifierConfig value={props.newAttrModifierFormula} onChange={v => props.onNewAttrModifierFormulaChange?.(v)} placeholder="floor((value - 10) / 2)" /></div>}
      <div className="space-y-2 mt-1">{props.newTemplateAttrs.map((attr, idx) => <CollapsibleAttrCard key={idx} index={idx} attr={attr} isExpanded={!!expandedAttrs[idx]} onToggle={() => setExpandedAttrs(p => ({ ...p, [idx]: !p[idx] }))} onUpdateAttr={props.onUpdateAttr} onRemove={() => props.onRemoveAttr(idx)} />)}</div><button type="button" onClick={props.onAddAttr} className="btn-ghost text-xs mt-2">+ Add Attribute</button></div>}
    {activeTab === 'skills' && <div>
      <div className="mb-3"><SkillCalculationConfig value={props.newSkillFormula} onChange={v => props.onNewSkillFormulaChange?.(v)} customFields={(props.newTemplateFields || []).filter(f => f.key.trim() && f.label.trim()).map(f => ({ key: f.key.trim(), label: f.label.trim() }))} placeholder="e.g. value + mod(value)" disabled={!(props.newAttrModifiersEnabled ?? false)} /></div>
      <div className="space-y-2 mt-1">{(props.newTemplateSkills || []).map((s, idx) => <CollapsibleSkillCard key={idx} index={idx} skill={s} onUpdateSkill={props.onUpdateSkill} onRemove={() => props.onRemoveSkill?.(idx)} attributes={allAttrs} onToggleAllowedAttr={props.onToggleSkillAllowedAttr} onUpdateDefaultAttr={(i, v) => { props.onUpdateSkill?.(i, 'defaultAttributeId', v) }} />)}</div><button type="button" onClick={props.onAddSkill} className="btn-ghost text-xs mt-2">+ Add Skill</button></div>}

    {activeTab === 'profiles' && <div><div className="space-y-2 mt-1">{(props.newTemplateProfiles || []).map((p, pIdx) => <div key={pIdx} className="rounded-lg border border-border bg-background/30 p-3 space-y-2"><div className="flex items-center gap-1.5"><input className="input-field flex-1" value={p.name} onChange={e => props.onUpdateProfile?.(pIdx, e.target.value)} placeholder="Profile name (e.g. mastery)" /><button type="button" onClick={() => props.onRemoveProfile?.(pIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div><div className="rounded border border-border/50 bg-background/20 p-2 space-y-2"><label className="text-xs font-semibold text-muted uppercase tracking-wider">Applies To</label><div className="flex gap-2">{(['ALL_SKILLS', 'SELECTED_SKILLS'] as const).map(mode => <button key={mode} type="button" onClick={() => { props.onUpdateProfileTargetMode?.(pIdx, mode) }} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${((p as any).targetMode ?? 'ALL_SKILLS') === mode ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted hover:text-foreground border border-transparent'}`}>{mode === 'ALL_SKILLS' ? 'All Skills' : 'Selected Skills'}</button>)}</div>{(p as any).targetMode === 'SELECTED_SKILLS' && <div className="space-y-1 max-h-40 overflow-y-auto">{props.newTemplateSkills?.filter((s: any) => s.name.trim()).map((s: any) => { const sid = s.name.trim(); const selected = ((p as any).targetSkillIds ?? []).includes(sid); return (<label key={sid} className="flex items-center gap-2 text-xs text-foreground cursor-pointer py-0.5"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={selected} onChange={() => { props.onToggleProfileSkill?.(pIdx, sid) }} /><span>{s.name.trim()}</span></label>) })}{(props.newTemplateSkills || []).filter((s: any) => s.name.trim()).length === 0 && <p className="text-xs text-muted italic">Add skills to the template first.</p>}</div>}</div><div className="space-y-1 pl-2">{p.options.map((o, oIdx) => <div key={oIdx} className="flex items-center gap-1.5"><input className="input-field flex-1 text-xs" value={o.label} onChange={e => props.onUpdateProfileOption?.(pIdx, oIdx, 'label', e.target.value)} placeholder="Option label (e.g. Expert)" /><input className="input-field w-20 text-xs" type="number" value={o.value} onChange={e => props.onUpdateProfileOption?.(pIdx, oIdx, 'value', e.target.value)} placeholder="Value" /><button type="button" onClick={() => props.onRemoveProfileOption?.(pIdx, oIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>)}</div><button type="button" onClick={() => props.onAddProfileOption?.(pIdx)} className="btn-ghost text-xs">+ Add Option</button></div>)}</div><button type="button" onClick={props.onAddProfile} className="btn-ghost text-xs mt-2">+ Add Skill Modifier Profile</button></div>}

    {activeTab === 'coreResources' && <div><div className="space-y-2 mt-1">{(props.newCoreResources || []).map((cr, crIdx) => <div key={crIdx} className="rounded-lg border border-border bg-background/30 p-3 space-y-2">
      <div className="flex items-center gap-1.5"><input className="input-field flex-1" value={cr.displayName} onChange={e => props.onUpdateCoreResource?.(crIdx, 'displayName', e.target.value)} placeholder="Display Name (e.g. Health Points)" /><input className="input-field flex-1" value={cr.slug} onChange={e => props.onUpdateCoreResource?.(crIdx, 'slug', e.target.value)} placeholder="Slug (e.g. health_points)" /><button type="button" onClick={() => props.onRemoveCoreResource?.(crIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>
      <div className="flex items-center gap-4 flex-wrap"><label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.enabled} onChange={e => props.onUpdateCoreResourceEnabled?.(crIdx, e.target.checked)} />Enabled</label><label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.editableByPlayer} onChange={e => props.onUpdateCoreResourceEditable?.(crIdx, e.target.checked)} />Editable by Player</label><label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.showNotes} onChange={e => props.onUpdateCoreResourceShowNotes?.(crIdx, e.target.checked)} />Show Notes</label></div>
    </div>)}</div><button type="button" onClick={props.onAddCoreResource} className="btn-ghost text-xs mt-2">+ Add Character Resource</button></div>}

    {activeTab === 'fields' && <div><div className="space-y-2 mt-1">{(props.newTemplateFields || []).map((f, idx) => <div key={idx} className="flex items-center gap-1.5"><input className="input-field flex-1" value={f.key} onChange={e => props.onUpdateField?.(idx, 'key', e.target.value)} placeholder="Key (e.g. class)" /><input className="input-field flex-1" value={f.label} onChange={e => props.onUpdateField?.(idx, 'label', e.target.value)} placeholder="Label (e.g. Class)" /><button type="button" onClick={() => props.onRemoveField?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>)}</div><button type="button" onClick={props.onAddField} className="btn-ghost text-xs mt-2">+ Add Character Info</button></div>}

    {activeTab === 'characterSections' && <div>
      <div className="space-y-2 mt-1">{(props.newCharacterSections || []).map((s, idx) => (<div key={idx} className="flex items-center gap-1.5"><input className="input-field flex-1" value={s.name} onChange={e => props.onUpdateNewCharacterSection?.(idx, e.target.value)} placeholder="Section name (e.g. Talents)" /><button type="button" onClick={() => props.onRemoveNewCharacterSection?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>))}</div>
      <button type="button" onClick={props.onAddNewCharacterSection} className="btn-ghost text-xs mt-2">+ Add Section</button>
    </div>}

    {activeTab === 'ac' && props.onAddNewAcConfig && (
      <div className="space-y-2 mt-1">
        <AcConfigList
          configs={props.newAcConfigs ?? []}
          attrs={props.newAttrsForAc ?? allAttrs}
          attrModifiersEnabled={props.newAttrModifiersEnabled ?? false}
          onAdd={props.onAddNewAcConfig}
          onRemove={props.onRemoveNewAcConfig}
          onUpdateConfig={props.onUpdateNewAcConfig}
          onAddField={props.onAddNewAcFieldForConfig}
          onRemoveField={props.onRemoveNewAcFieldForConfig}
          onUpdateField={props.onUpdateNewAcFieldForConfig}
          onUpdateFieldEditable={props.onUpdateNewAcFieldEditableForConfig}
          onToggleAttributeId={props.onToggleNewAcAttributeIdForConfig}
          onUpdateAttributeModifier={props.onUpdateNewAcAttributeModifierForConfig}
        />
      </div>
    )}

    {activeTab === 'resistances' && props.onNewResistancesChange && <div>
      <ResistanceSystemConfig resistances={props.newResistances || []} attributes={props.attrsForNewResistance.map(a => ({ id: a.id || '', key: a.key, name: a.name }))} onChange={props.onNewResistancesChange} disableAttributeModifiers={!(props.newAttrModifiersEnabled ?? false)} />
    </div>}

    {props.templateError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{props.templateError}</div>}
    <div className="flex gap-2 justify-end"><button type="button" onClick={props.onCancelNew} disabled={props.templateCreating} className="btn-ghost text-sm">Cancel</button><button type="submit" disabled={props.templateCreating || !props.newTemplateName.trim() || props.newTemplateAttrs.length === 0} className="btn-primary text-sm">{props.templateCreating ? 'Creating...' : 'Create'}</button></div>
    </form>
  }
</>
}
