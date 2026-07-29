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
import { NumericInput } from '@/components/shared/NumericInput'

interface FeatureCard {
  key: string; label: string; description: string; icon: string; enabled: boolean; onToggle: (v: boolean) => void; disabled?: boolean; disabledReason?: string
}

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
  onAddCoreResource?: () => void; onRemoveCoreResource?: (i: number) => void; onUpdateCoreResource?: (i: number, f: 'displayName' | 'slug' | 'color', v: string) => void
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
  // Public visibility toggle
  newIsPublic?: boolean; onNewIsPublicChange?: (v: boolean) => void
}) {
  const [activeTab, setActiveTab] = useState<string>('attrs')
  const [wizardDone, setWizardDone] = useState(false)
  const [expandedAttrs, setExpandedAttrs] = useState<Record<number, boolean>>({}); const prevCount = useRef(0)
  useEffect(() => { if (props.newTemplateAttrs.length > prevCount.current) { setExpandedAttrs(p => ({ ...p, [props.newTemplateAttrs.length - 1]: true })) }; prevCount.current = props.newTemplateAttrs.length }, [props.newTemplateAttrs.length])
  const [wizardStep, setWizardStep] = useState(1)

  const tabClass = (tab: string) =>
    `relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
      activeTab === tab
        ? 'bg-primary/15 text-primary shadow-sm border border-primary/20'
        : 'text-muted hover:text-foreground hover:bg-background/40 border border-transparent'
    }`

  const allAttrs = props.newTemplateAttrs.filter(a => a.key.trim() && a.name.trim()).map(a => ({ key: a.key.trim(), name: a.name.trim() }))

  const features: FeatureCard[] = [
    {
      key: 'skills', label: 'Skills', enabled: props.newFeatureSkills, onToggle: props.onNewFeatureSkillsChange,
      icon: '<path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />',
      description: 'Add skills like Stealth, Perception, or Athletics. Players can assign values and roll checks.',
    },
    {
      key: 'customfields', label: 'Character Info', enabled: props.newFeatureCustomFields, onToggle: props.onNewFeatureCustomFieldsChange,
      icon: '<path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />',
      description: 'Add custom fields like Class, Race, Background, or other character details.',
    },
    {
      key: 'coreResources', label: 'Core Resources', enabled: props.newFeatureCoreResources, onToggle: props.onNewFeatureCoreResourcesChange,
      icon: '<path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />',
      description: 'Set up trackable resources like Hit Points, Mana, or Stamina for your characters.',
    },
    {
      key: 'armorClass', label: 'Armor Class', enabled: props.newFeatureArmorClass, onToggle: props.onNewFeatureArmorClassChange,
      icon: '<path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />',
      description: 'Configure armor class using components like base AC + Dexterity modifier from your attributes.',
    },
    {
      key: 'sections', label: 'Personal Abilities', enabled: props.newFeatureCharacterSections, onToggle: props.onNewFeatureCharacterSectionsChange,
      icon: '<path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />',
      description: 'Add free-form sections like Talents, Traits, or Inventory for additional character details.',
    },
    {
      key: 'profiles', label: 'Skill Profiles', enabled: props.newFeatureSkillProfiles, onToggle: props.onNewFeatureSkillProfilesChange,
      disabled: !props.newFeatureSkills,
      disabledReason: 'Requires Skills to be enabled',
      icon: '<path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />',
      description: 'Pre-define modifier levels (Untrained, Expert, Master) that apply to your skills.',
    },
    {
      key: 'resistances', label: 'Resistance System', enabled: props.newFeatureResistance, onToggle: props.onNewFeatureResistanceChange,
      icon: '<path strokeLinecap="round" strokeLinejoin="round" d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016zM12 9v2m0 4h.01" />',
      description: 'Define damage types and configure resistance or weakness calculations for characters.',
    },
  ]

  return (
    <div className="card !p-6 space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <div>
          <h4 className="text-base font-semibold text-gradient">
            {wizardDone ? 'Configure Template Details' : 'Create New Template'}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {wizardDone
              ? 'Fill in the details for each section of your template.'
              : 'First, give your template a name and choose which features to include.'}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {[
          { num: 1, label: 'Basic Info & Features', done: wizardDone },
          { num: 2, label: 'Configure Details', done: false },
        ].map((step, idx) => (
          <div key={step.num} className={`flex-1 flex items-center ${idx === 0 ? '' : ''}`}>
            <div className={`flex items-center gap-2.5 px-4 py-2.5 ${
              step.done ? 'text-primary' : step.num === (wizardDone ? 2 : 1) ? 'text-foreground' : 'text-muted'
            }`}>
              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border transition-all duration-300 ${
                step.done
                  ? 'bg-primary text-background border-primary shadow-sm'
                  : step.num === (wizardDone ? 2 : 1)
                  ? 'border-primary/50 text-primary bg-primary/10'
                  : 'border-border/50 text-muted'
              }`}>
                {step.done ? '✓' : step.num}
              </span>
              <span className={`text-sm font-medium hidden sm:inline ${step.done ? 'text-primary' : step.num === (wizardDone ? 2 : 1) ? 'text-foreground' : 'text-muted'}`}>
                {step.label}
              </span>
            </div>
            {idx === 0 && (
              <div className={`flex-1 h-px ${wizardDone ? 'bg-primary/40' : 'bg-border/40'}`} />
            )}
          </div>
        ))}
      </div>

      <hr className="divider" />

      {/* ── Step 1: Feature Selection ── */}
      {!wizardDone ? (
        <div className="space-y-6">
          {/* Name & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Template Name</label>
              <input
                className="input-field"
                value={props.newTemplateName}
                onChange={e => props.onNameChange(e.target.value)}
                placeholder="e.g. D&D 5e Character Sheet"
                maxLength={100}
                required
              />
            </div>
            <div>
              <label className="label">Description <span className="text-muted font-normal">(optional)</span></label>
              <input
                className="input-field"
                value={props.newTemplateDescription}
                onChange={e => props.onDescriptionChange(e.target.value)}
                placeholder="Brief description of this template"
                maxLength={200}
              />
            </div>
          </div>

          {/* Divider with label */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#15101f] px-3 text-xs font-semibold text-muted uppercase tracking-wider">Choose Features</span>
            </div>
          </div>

          {/* Public visibility toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/40 p-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border border-border/40 bg-background/60">
                <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-medium text-foreground">Make Public</span>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">
                  Anyone can view and clone this template. Other users will see it in the community gallery.
                </p>
              </div>
            </div>
            <div className="shrink-0 pt-1">
              <div
                className="relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer"
                style={{ backgroundColor: props.newIsPublic ? '#7c5ce7' : 'rgba(255,255,255,0.1)' }}
                onClick={() => props.onNewIsPublicChange?.(!props.newIsPublic)}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${props.newIsPublic ? 'left-[17px]' : 'left-0.5'}`} />
              </div>
            </div>
          </div>

          {/* Feature cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map(f => {
              const isDisabled = f.disabled
              const isOn = f.enabled
              return (
                <div
                  key={f.key}
                  className={`group relative rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
                    isDisabled
                      ? 'border-border/30 bg-background/20 opacity-50 cursor-not-allowed'
                      : isOn
                      ? 'border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/8'
                      : 'border-border/50 bg-background/40 hover:border-border hover:bg-background/60'
                  }`}
                  onClick={() => !isDisabled && f.onToggle(!isOn)}
                >
                  <div className={`absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity ${isDisabled ? 'hidden' : ''}`} />
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
                      isOn ? 'bg-primary/10 border-primary/20' : 'bg-background/60 border-border/40'
                    }`}>
                      <svg className={`w-4 h-4 ${isOn ? 'text-primary' : 'text-muted'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
                        dangerouslySetInnerHTML={{ __html: f.icon.replace(/^<path /, '<path ') }}
                      />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${isOn ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {f.label}
                        </span>
                        {isDisabled && f.disabledReason && (
                          <span className="text-[0.55rem] text-muted bg-background/60 px-1.5 py-0.5 rounded-full border border-border/30">
                            {f.disabledReason}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 leading-relaxed ${isOn ? 'text-muted-foreground' : 'text-muted'}`}>
                        {f.description}
                      </p>
                    </div>
                    {/* Toggle */}
                    <div className="shrink-0 pt-1">
                      <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                        isDisabled ? 'bg-border/20' : isOn ? 'bg-primary' : 'bg-border/50'
                      }`}>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background shadow-sm transition-transform duration-200 ${
                          isOn ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Continue button */}
          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={props.onCancelNew} className="btn-ghost text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setWizardDone(true)}
              disabled={!props.newTemplateName.trim()}
              className="btn-primary text-sm"
            >
              Continue to Details
              <svg className="w-3.5 h-3.5 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
      /* ── Step 2: Detail Configuration ── */
      <form onSubmit={props.onCreateTemplate} className="space-y-5">
        {/* Name & Description inline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Name</label>
            <input className="input-field" value={props.newTemplateName} onChange={e => props.onNameChange(e.target.value)} placeholder="e.g. D&D 5e" maxLength={100} required />
          </div>
          <div>
            <label className="label">Description <span className="text-muted font-normal">(optional)</span></label>
            <input className="input-field" value={props.newTemplateDescription} onChange={e => props.onDescriptionChange(e.target.value)} placeholder="Brief description" maxLength={200} />
          </div>
        </div>

        {/* Back to features button */}
        <button type="button" onClick={() => setWizardDone(false)} className="btn-ghost text-xs flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Change features
        </button>

        {/* Sub-tab pills */}
        <div className="flex gap-1.5 flex-wrap">
          <button type="button" onClick={() => setActiveTab('attrs')} className={tabClass('attrs')}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Attributes
          </button>
          {props.newFeatureSkills && (
            <button type="button" onClick={() => setActiveTab('skills')} className={tabClass('skills')}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Skills
            </button>
          )}
          {props.newFeatureCustomFields && props.onAddField && (
            <button type="button" onClick={() => setActiveTab('fields')} className={tabClass('fields')}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
              </svg>
              Character Info
            </button>
          )}
          {props.newFeatureCoreResources && props.onAddCoreResource && (
            <button type="button" onClick={() => setActiveTab('coreResources')} className={tabClass('coreResources')}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Resources
            </button>
          )}
          {props.newFeatureArmorClass && props.onAddNewAcConfig && (
            <button type="button" onClick={() => setActiveTab('ac')} className={tabClass('ac')}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Armor Class
            </button>
          )}
          {props.newFeatureCharacterSections && (
            <button type="button" onClick={() => setActiveTab('characterSections' as any)} className={tabClass('characterSections' as any)}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Abilities
            </button>
          )}
          {props.newFeatureSkillProfiles && props.onAddProfile && (
            <button type="button" onClick={() => setActiveTab('profiles')} className={tabClass('profiles')}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Profiles
            </button>
          )}
          {props.newFeatureResistance && props.onNewResistancesChange && (
            <button type="button" onClick={() => setActiveTab('resistances')} className={tabClass('resistances')}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Resistances
            </button>
          )}
        </div>

        <hr className="divider" />

        {/* ── Tab Content ── */}
        {activeTab === 'attrs' && <div>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Attributes are the core stats that define a character — like Strength, Dexterity, or Intelligence. Players will assign values to each.
          </p>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer mb-3">
            <input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={props.newAttrModifiersEnabled ?? false} onChange={e => props.onNewAttrModifiersEnabledChange?.(e.target.checked)} />
            Enable Attribute Modifiers
          </label>
          {(props.newAttrModifiersEnabled ?? false) && <div className="mb-4"><AttributeModifierConfig value={props.newAttrModifierFormula} onChange={v => props.onNewAttrModifierFormulaChange?.(v)} placeholder="floor((value - 10) / 2)" /></div>}
          <div className="space-y-2 mt-1">{props.newTemplateAttrs.map((attr, idx) => <CollapsibleAttrCard key={idx} index={idx} attr={attr} isExpanded={!!expandedAttrs[idx]} onToggle={() => setExpandedAttrs(p => ({ ...p, [idx]: !p[idx] }))} onUpdateAttr={props.onUpdateAttr} onRemove={() => props.onRemoveAttr(idx)} />)}</div>
          <button type="button" onClick={props.onAddAttr} className="btn-ghost text-xs mt-3 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Attribute
          </button>
        </div>}

        {activeTab === 'skills' && <div>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Skills represent trained abilities like Stealth or Persuasion. Configure how they&apos;re calculated and which attributes they rely on.
          </p>
          <div className="mb-4"><SkillCalculationConfig value={props.newSkillFormula} onChange={v => props.onNewSkillFormulaChange?.(v)} customFields={(props.newTemplateFields || []).filter(f => f.key.trim() && f.label.trim()).map(f => ({ key: f.key.trim(), label: f.label.trim() }))} placeholder="e.g. value + mod(value)" disabled={!(props.newAttrModifiersEnabled ?? false)} /></div>
          <div className="space-y-2 mt-1">{(props.newTemplateSkills || []).map((s, idx) => <CollapsibleSkillCard key={idx} index={idx} skill={s} onUpdateSkill={props.onUpdateSkill} onRemove={() => props.onRemoveSkill?.(idx)} attributes={allAttrs} onToggleAllowedAttr={props.onToggleSkillAllowedAttr} onUpdateDefaultAttr={(i, v) => { props.onUpdateSkill?.(i, 'defaultAttributeId', v) }} />)}</div>
          <button type="button" onClick={props.onAddSkill} className="btn-ghost text-xs mt-3 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Skill
          </button>
        </div>}

        {activeTab === 'fields' && <div>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Add custom text fields for character details like Class, Race, or Background.
          </p>
          <div className="space-y-2 mt-1">{(props.newTemplateFields || []).map((f, idx) => <div key={idx} className="flex items-center gap-1.5"><input className="input-field flex-1" value={f.key} onChange={e => props.onUpdateField?.(idx, 'key', e.target.value)} placeholder="Key (e.g. class)" /><input className="input-field flex-1" value={f.label} onChange={e => props.onUpdateField?.(idx, 'label', e.target.value)} placeholder="Label (e.g. Class)" /><button type="button" onClick={() => props.onRemoveField?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0 px-1">✕</button></div>)}</div>
          <button type="button" onClick={props.onAddField} className="btn-ghost text-xs mt-3 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Field
          </button>
        </div>}

        {activeTab === 'coreResources' && <div>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Core resources are trackable values like Hit Points, Mana, or Stamina that appear on your character sheet.
          </p>
          <div className="space-y-2 mt-1">{(props.newCoreResources || []).map((cr, crIdx) => <div key={crIdx} className="rounded-lg border border-border bg-background/30 p-3 space-y-2">
            <div className="flex items-center gap-1.5"><input className="input-field flex-1" value={cr.displayName} onChange={e => props.onUpdateCoreResource?.(crIdx, 'displayName', e.target.value)} placeholder="Display Name (e.g. Hit Points)" /><input className="input-field flex-[0.35]" value={cr.slug} onChange={e => props.onUpdateCoreResource?.(crIdx, 'slug', e.target.value)} placeholder="Slug (e.g. hit_points)" /><input type="color" value={cr.color || '#f59e0b'} onChange={e => props.onUpdateCoreResource?.(crIdx, 'color', e.target.value)} className="w-7 h-7 p-0.5 rounded cursor-pointer shrink-0 bg-transparent" /><button type="button" onClick={() => props.onRemoveCoreResource?.(crIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0 px-1">✕</button></div>
            <div className="flex items-center gap-4 flex-wrap"><label className="flex items-center gap-1 text-xs text-muted cursor-pointer"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.enabled} onChange={e => props.onUpdateCoreResourceEnabled?.(crIdx, e.target.checked)} />Enabled</label><label className="flex items-center gap-1 text-xs text-muted cursor-pointer"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.editableByPlayer} onChange={e => props.onUpdateCoreResourceEditable?.(crIdx, e.target.checked)} />Editable by Player</label><label className="flex items-center gap-1 text-xs text-muted cursor-pointer"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.showNotes} onChange={e => props.onUpdateCoreResourceShowNotes?.(crIdx, e.target.checked)} />Show Notes</label></div>
          </div>)}</div>
          <button type="button" onClick={props.onAddCoreResource} className="btn-ghost text-xs mt-3 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Resource
          </button>
        </div>}

        {activeTab === 'characterSections' && <div>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Create free-form sections where players can write about their character&apos;s unique abilities and traits.
          </p>
          <div className="space-y-2 mt-1">{(props.newCharacterSections || []).map((s, idx) => (<div key={idx} className="flex items-center gap-1.5"><input className="input-field flex-1" value={s.name} onChange={e => props.onUpdateNewCharacterSection?.(idx, e.target.value)} placeholder="Section name (e.g. Talents)" /><button type="button" onClick={() => props.onRemoveNewCharacterSection?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0 px-1">✕</button></div>))}</div>
          <button type="button" onClick={props.onAddNewCharacterSection} className="btn-ghost text-xs mt-3 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Section
          </button>
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

        {activeTab === 'profiles' && <div className="space-y-2 mt-1">
          {(props.newTemplateProfiles || []).map((p, pIdx) => <div key={pIdx} className="rounded-lg border border-border bg-background/30 p-3 space-y-2">
            <div className="flex items-center gap-1.5"><input className="input-field flex-1" value={p.name} onChange={e => props.onUpdateProfile?.(pIdx, e.target.value)} placeholder="Profile name (e.g. mastery)" /><button type="button" onClick={() => props.onRemoveProfile?.(pIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>
            <div className="rounded border border-border/50 bg-background/20 p-2 space-y-2"><label className="text-xs font-semibold text-muted uppercase tracking-wider">Applies To</label><div className="flex gap-2">{(['ALL_SKILLS', 'SELECTED_SKILLS'] as const).map(mode => <button key={mode} type="button" onClick={() => { props.onUpdateProfileTargetMode?.(pIdx, mode) }} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${((p as any).targetMode ?? 'ALL_SKILLS') === mode ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted hover:text-foreground border border-transparent'}`}>{mode === 'ALL_SKILLS' ? 'All Skills' : 'Selected Skills'}</button>)}</div>{(p as any).targetMode === 'SELECTED_SKILLS' && <div className="space-y-1 max-h-40 overflow-y-auto">{props.newTemplateSkills?.filter((s: any) => s.name.trim()).map((s: any) => { const sid = s.name.trim(); const selected = ((p as any).targetSkillIds ?? []).includes(sid); return (<label key={sid} className="flex items-center gap-2 text-xs text-foreground cursor-pointer py-0.5"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={selected} onChange={() => { props.onToggleProfileSkill?.(pIdx, sid) }} /><span>{s.name.trim()}</span></label>) })}{(props.newTemplateSkills || []).filter((s: any) => s.name.trim()).length === 0 && <p className="text-xs text-muted italic">Add skills to the template first.</p>}</div>}</div>
            <div className="space-y-1 pl-2">{p.options.map((o, oIdx) => <div key={oIdx} className="flex items-center gap-1.5"><input className="input-field flex-1 text-xs" value={o.label} onChange={e => props.onUpdateProfileOption?.(pIdx, oIdx, 'label', e.target.value)} placeholder="Option label (e.g. Expert)" /><NumericInput className="input-field w-20 text-xs" value={o.value} onChange={e => props.onUpdateProfileOption?.(pIdx, oIdx, 'value', e.target.value)} placeholder="Value" wrapperClassName="w-20" inputClassName="!text-xs" /><button type="button" onClick={() => props.onRemoveProfileOption?.(pIdx, oIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>)}</div>
            <button type="button" onClick={() => props.onAddProfileOption?.(pIdx)} className="btn-ghost text-xs">+ Add Option</button>
          </div>)}
          <button type="button" onClick={props.onAddProfile} className="btn-ghost text-xs mt-2 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Skill Profile
          </button>
        </div>}

        {activeTab === 'resistances' && props.onNewResistancesChange && <div>
          <ResistanceSystemConfig resistances={props.newResistances || []} attributes={props.attrsForNewResistance.map(a => ({ id: a.id || '', key: a.key, name: a.name }))} onChange={props.onNewResistancesChange} disableAttributeModifiers={!(props.newAttrModifiersEnabled ?? false)} />
        </div>}

        {/* Error & Actions */}
        {props.templateError && (
          <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{props.templateError}</div>
        )}
        <div className="flex gap-3 justify-end pt-2 border-t border-border/40">
          <button type="button" onClick={props.onCancelNew} disabled={props.templateCreating} className="btn-ghost text-sm">Cancel</button>
          <button type="submit" disabled={props.templateCreating || !props.newTemplateName.trim() || props.newTemplateAttrs.length === 0} className="btn-primary text-sm">
            {props.templateCreating ? (
              <><div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />Creating...</>
            ) : 'Create Template'}
          </button>
        </div>
      </form>
      )}
    </div>
  )
}
