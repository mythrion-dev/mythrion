'use client'

import { useState, useCallback, type SubmitEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { TemplateForm } from '@/components/adventure/TemplateForm'
import type { CoreResource, AcConfigDraft, ArmorClassAttributeModifierDraft, ResistanceDef } from '@/components/adventure/types'
import { emptyAcConfig, slugify } from '@/components/adventure/types'
import { useSubscription } from '@/lib/subscription-context'
import { useTranslation } from 'react-i18next'

interface NewSkillDraft {
  name: string
  description: string
  attributeId: string
  allowedAttributeIds: string[]
  defaultAttributeId: string
}

interface NewProfileDraft {
  name: string
  targetMode?: string
  targetSkillIds?: string[]
  options: { label: string; value: number }[]
}

function toggleSkillAllowedAttr(skill: NewSkillDraft, attrKey: string): NewSkillDraft {
  const exists = skill.allowedAttributeIds.includes(attrKey)
  return {
    ...skill,
    allowedAttributeIds: exists
      ? skill.allowedAttributeIds.filter(a => a !== attrKey)
      : [...skill.allowedAttributeIds, attrKey],
  }
}

function removeProfileOption(profile: NewProfileDraft, oIdx: number): NewProfileDraft {
  return { ...profile, options: profile.options.filter((_, oi) => oi !== oIdx) }
}

function updateProfileOption(
  profile: NewProfileDraft,
  oIdx: number,
  f: 'label' | 'value',
  v: string | number,
): NewProfileDraft {
  return { ...profile, options: profile.options.map((o, oi) => (oi === oIdx ? { ...o, [f]: v } : o)) }
}

function toggleProfileSkill(profile: NewProfileDraft, skillId: string): NewProfileDraft {
  const exists = (profile.targetSkillIds ?? []).includes(skillId)
  return {
    ...profile,
    targetSkillIds: exists
      ? (profile.targetSkillIds ?? []).filter(s => s !== skillId)
      : [...(profile.targetSkillIds ?? []), skillId],
  }
}

function removeAcField(ac: AcConfigDraft, fieldIdx: number): AcConfigDraft {
  return { ...ac, fields: ac.fields.filter((_, j) => j !== fieldIdx) }
}

function updateAcField(
  ac: AcConfigDraft,
  fieldIdx: number,
  f: 'name' | 'key' | 'defaultValue' | 'description',
  v: string,
): AcConfigDraft {
  return {
    ...ac,
    fields: ac.fields.map((field, j) => {
      if (j !== fieldIdx) return field
      const updated = { ...field, [f]: v }
      if (f === 'name' && v.trim() && !field.key.trim()) updated.key = slugify(v.trim())
      return updated
    }),
  }
}

function updateAcFieldEditable(ac: AcConfigDraft, fieldIdx: number, v: boolean): AcConfigDraft {
  return {
    ...ac,
    fields: ac.fields.map((field, j) => (j === fieldIdx ? { ...field, editableByPlayer: v } : field)),
  }
}

function toggleAcAttributeId(ac: AcConfigDraft, attrId: string): AcConfigDraft {
  const exists = ac.attributeModifiers.some(am => am.attributeId === attrId)
  return {
    ...ac,
    attributeModifiers: exists
      ? ac.attributeModifiers.filter(am => am.attributeId !== attrId)
      : [...ac.attributeModifiers, { attributeId: attrId, allowPlayerSelection: false, defaultAttributeId: attrId }],
  }
}

function updateAcAttributeModifier(
  ac: AcConfigDraft,
  attrId: string,
  patch: Partial<ArmorClassAttributeModifierDraft>,
): AcConfigDraft {
  return {
    ...ac,
    attributeModifiers: ac.attributeModifiers.map(am => (am.attributeId === attrId ? { ...am, ...patch } : am)),
  }
}

export default function NewTemplatePage() {
  const { hasActiveSubscription } = useSubscription()
  const { t } = useTranslation()
  const router = useRouter()

  // ── Feature toggles ──
  const [featureSkills, setFeatureSkills] = useState(false)
  const [featureCustomFields, setFeatureCustomFields] = useState(false)
  const [featureCoreResources, setFeatureCoreResources] = useState(false)
  const [featureArmorClass, setFeatureArmorClass] = useState(false)
  const [featureCharacterSections, setFeatureCharacterSections] = useState(false)
  const [featureSkillProfiles, setFeatureSkillProfiles] = useState(false)
  const [featureResistance, setFeatureResistance] = useState(false)

  // ── Creation state ──
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [attrs, setAttrs] = useState<{ key: string; name: string }[]>([])
  const [skills, setSkills] = useState<{ name: string; description: string; attributeId: string; allowedAttributeIds: string[]; defaultAttributeId: string }[]>([])
  const [fields, setFields] = useState<{ key: string; label: string }[]>([])
  const [profiles, setProfiles] = useState<{ name: string; targetMode?: string; targetSkillIds?: string[]; options: { label: string; value: number }[] }[]>([])
  const [coreResources, setCoreResources] = useState<CoreResource[]>([])
  const [acConfigs, setAcConfigs] = useState<AcConfigDraft[]>([])
  const [characterSections, setCharacterSections] = useState<{ name: string }[]>([])
  const [resistances, setResistances] = useState<ResistanceDef[]>([])
  const [attrModifierFormula, setAttrModifierFormula] = useState('')
  const [skillFormula, setSkillFormula] = useState('')
  const [attrModifiersEnabled, setAttrModifiersEnabled] = useState(true)
  const [isPublic, setIsPublic] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Attribute handlers ──

  const handleAddAttr = useCallback(() => {
    setAttrs(prev => [...prev, { key: '', name: '' }])
  }, [])
  const handleRemoveAttr = useCallback((i: number) => {
    setAttrs(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  const handleUpdateAttr = useCallback((i: number, f: 'key' | 'name', v: string) => {
    setAttrs(prev => prev.map((a, idx) => idx === i ? { ...a, [f]: v } : a))
  }, [])

  // ── Skill handlers ──

  const handleAddSkill = useCallback(() => {
    setSkills(prev => [...prev, { name: '', description: '', attributeId: '', allowedAttributeIds: [], defaultAttributeId: '' }])
  }, [])
  const handleRemoveSkill = useCallback((i: number) => {
    setSkills(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  const handleUpdateSkill = useCallback((i: number, f: string, v: string) => {
    setSkills(prev => prev.map((s, idx) => idx === i ? { ...s, [f]: v } : s))
  }, [])
  const handleToggleSkillAllowedAttr = useCallback((i: number, attrKey: string) => {
    setSkills(prev => prev.map((s, idx) => (idx === i ? toggleSkillAllowedAttr(s, attrKey) : s)))
  }, [])

  // ── Field handlers ──

  const handleAddField = useCallback(() => {
    setFields(prev => [...prev, { key: '', label: '' }])
  }, [])
  const handleRemoveField = useCallback((i: number) => {
    setFields(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  const handleUpdateField = useCallback((i: number, f: 'key' | 'label', v: string) => {
    setFields(prev => prev.map((fd, idx) => idx === i ? { ...fd, [f]: v } : fd))
  }, [])

  // ── Profile handlers ──

  const handleAddProfile = useCallback(() => {
    setProfiles(prev => [...prev, { name: '', options: [{ label: '', value: 0 }] }])
  }, [])
  const handleRemoveProfile = useCallback((i: number) => {
    setProfiles(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  const handleUpdateProfile = useCallback((i: number, name: string) => {
    setProfiles(prev => prev.map((p, idx) => idx === i ? { ...p, name } : p))
  }, [])
  const handleAddProfileOption = useCallback((pIdx: number) => {
    setProfiles(prev => prev.map((p, idx) => idx === pIdx
      ? { ...p, options: [...p.options, { label: '', value: 0 }] }
      : p))
  }, [])
  const handleRemoveProfileOption = useCallback((pIdx: number, oIdx: number) => {
    setProfiles(prev => prev.map((p, idx) => (idx === pIdx ? removeProfileOption(p, oIdx) : p)))
  }, [])
  const handleUpdateProfileOption = useCallback((pIdx: number, oIdx: number, f: 'label' | 'value', v: string | number) => {
    setProfiles(prev => prev.map((p, idx) => (idx === pIdx ? updateProfileOption(p, oIdx, f, v) : p)))
  }, [])
  const handleUpdateProfileTargetMode = useCallback((i: number, mode: string) => {
    setProfiles(prev => prev.map((p, idx) => idx === i ? { ...p, targetMode: mode } : p))
  }, [])
  const handleToggleProfileSkill = useCallback((i: number, skillId: string) => {
    setProfiles(prev => prev.map((p, idx) => (idx === i ? toggleProfileSkill(p, skillId) : p)))
  }, [])

  // ── Core Resource handlers ──

  const handleAddCoreResource = useCallback(() => {
    setCoreResources(prev => [...prev, { displayName: '', slug: '', color: '#ffffff', enabled: true, editableByPlayer: true, showNotes: false }])
  }, [])
  const handleRemoveCoreResource = useCallback((i: number) => {
    setCoreResources(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  const handleUpdateCoreResource = useCallback((i: number, f: 'displayName' | 'slug' | 'color', v: string) => {
    setCoreResources(prev => prev.map((cr, idx) => idx === i ? { ...cr, [f]: v } : cr))
  }, [])
  const handleUpdateCoreResourceEnabled = useCallback((i: number, v: boolean) => {
    setCoreResources(prev => prev.map((cr, idx) => idx === i ? { ...cr, enabled: v } : cr))
  }, [])
  const handleUpdateCoreResourceEditable = useCallback((i: number, v: boolean) => {
    setCoreResources(prev => prev.map((cr, idx) => idx === i ? { ...cr, editable: v } : cr))
  }, [])
  const handleUpdateCoreResourceShowNotes = useCallback((i: number, v: boolean) => {
    setCoreResources(prev => prev.map((cr, idx) => idx === i ? { ...cr, showNotes: v } : cr))
  }, [])

  // ── AC Config handlers ──

  const handleAddNewAcConfig = useCallback(() => {
    setAcConfigs(prev => [...prev, emptyAcConfig()])
  }, [])
  const handleRemoveNewAcConfig = useCallback((i: number) => {
    setAcConfigs(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  const handleUpdateNewAcConfig = useCallback((i: number, patch: Partial<AcConfigDraft>) => {
    setAcConfigs(prev => prev.map((ac, idx) => idx === i ? { ...ac, ...patch } : ac))
  }, [])
  const handleAddNewAcFieldForConfig = useCallback((configIdx: number) => {
    setAcConfigs(prev => prev.map((ac, i) => i === configIdx
      ? { ...ac, fields: [...ac.fields, { name: '', key: '', defaultValue: '0', editableByPlayer: false, description: '' }] }
      : ac))
  }, [])
  const handleRemoveNewAcFieldForConfig = useCallback((configIdx: number, fieldIdx: number) => {
    setAcConfigs(prev => prev.map((ac, i) => (i === configIdx ? removeAcField(ac, fieldIdx) : ac)))
  }, [])
  const handleUpdateNewAcFieldForConfig = useCallback((configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) => {
    setAcConfigs(prev => prev.map((ac, i) => (i === configIdx ? updateAcField(ac, fieldIdx, f, v) : ac)))
  }, [])
  const handleUpdateNewAcFieldEditableForConfig = useCallback((configIdx: number, fieldIdx: number, v: boolean) => {
    setAcConfigs(prev => prev.map((ac, i) => (i === configIdx ? updateAcFieldEditable(ac, fieldIdx, v) : ac)))
  }, [])
  const handleToggleNewAcAttributeIdForConfig = useCallback((configIdx: number, attrId: string) => {
    setAcConfigs(prev => prev.map((ac, i) => (i === configIdx ? toggleAcAttributeId(ac, attrId) : ac)))
  }, [])
  const handleUpdateNewAcAttributeModifierForConfig = useCallback((configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) => {
    setAcConfigs(prev => prev.map((ac, i) => (i === configIdx ? updateAcAttributeModifier(ac, attrId, patch) : ac)))
  }, [])

  // ── Character Section handlers ──

  const handleAddCharacterSection = useCallback(() => {
    setCharacterSections(prev => [...prev, { name: '' }])
  }, [])
  const handleRemoveCharacterSection = useCallback((i: number) => {
    setCharacterSections(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  const handleUpdateCharacterSection = useCallback((i: number, v: string) => {
    setCharacterSections(prev => prev.map((s, idx) => idx === i ? { ...s, name: v } : s))
  }, [])

  // ── Create handler ──

  const handleCreate = useCallback(async (e: SubmitEvent) => {
    e.preventDefault()
    setCreating(true)
    setError(null)

    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        description: description.trim() || null,
        attributes: attrs.filter(a => a.key.trim()).map(a => ({
          key: a.key.trim(),
          name: a.name.trim(),
        })),
        attributeModifierFormula: attrModifierFormula || null,
        skillFormula: skillFormula || null,
        attributeModifiersEnabled: attrModifiersEnabled,
        isPublic,
      }

      if (featureSkills) {
        payload.skills = skills.map(s => ({
          name: s.name,
          description: s.description || null,
          attributeId: s.attributeId || null,
          allowedAttributeIds: s.allowedAttributeIds,
          defaultAttributeId: s.defaultAttributeId || null,
        }))
      }

      if (featureCustomFields) {
        payload.templateFields = fields.filter(f => f.key.trim()).map(f => ({
          key: f.key.trim(),
          label: f.label.trim(),
        }))
      }

      if (featureSkillProfiles) {
        payload.skillModifierProfiles = profiles.map(p => ({
          name: p.name,
          targetMode: p.targetMode,
          targetSkillIds: p.targetSkillIds,
          options: p.options.map(o => ({ label: o.label, value: o.value })),
        }))
      }

      if (featureCoreResources) {
        payload.coreResources = coreResources
      }

      if (featureArmorClass) {
        payload.armorClasses = acConfigs.map(ac => ({
          enabled: ac.enabled,
          name: ac.name,
          attributeModifiers: (ac.attributeModifiers ?? []).map(am => ({
            attributeId: am.attributeId,
            allowPlayerSelection: am.allowPlayerSelection,
            defaultAttributeId: am.defaultAttributeId,
          })),
          fields: (ac.fields ?? []).map(f => ({
            name: f.name,
            key: f.key,
            defaultValue: f.defaultValue,
            editableByPlayer: f.editableByPlayer,
            description: f.description,
          })),
        }))
      }

      if (featureCharacterSections) {
        payload.characterSections = characterSections
      }

      if (featureResistance) {
        payload.resistances = resistances
      }

      const created = await api.post<{ id: string }>('/templates', payload)
      router.push(`/dashboard/templates/${created.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('templates:failedToCreate'))
    } finally {
      setCreating(false)
    }
  }, [name, description, attrs, attrModifierFormula, skillFormula, attrModifiersEnabled,
      featureSkills, skills, featureCustomFields, fields, featureSkillProfiles, profiles,
      featureCoreResources, coreResources, featureArmorClass, acConfigs,
      featureCharacterSections, characterSections, featureResistance, resistances, router, t])

  // ── Cancel ──

  const handleCancel = useCallback(() => {
    router.push('/dashboard/templates')
  }, [router])

  if (!hasActiveSubscription) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 2.25h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">{t('templates:subscriptionRequired')}</h2>
        <p className="text-sm text-muted-foreground max-w-sm mb-8">
          {t('templates:subscriptionRequiredBody')}
        </p>
        <Link href="/pricing" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {t('common:viewPlans')}
        </Link>
      </div>
    )
  }

  // ── Attrs for resistance support ──

  const attrsForResistance = attrs.filter(a => a.key.trim() && a.name.trim()).map(a => ({ key: a.key.trim(), name: a.name.trim() }))

  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted mb-4">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">{t('common:dashboard')}</Link>
        <span>/</span>
        <Link href="/dashboard/templates" className="hover:text-foreground transition-colors">{t('templates:templates')}</Link>
        <span>/</span>
        <span className="text-foreground">{t('templates:new')}</span>
      </nav>

      <TemplateForm
        newTemplateName={name}
        newTemplateDescription={description}
        newTemplateAttrs={attrs}
        newAttrModifierFormula={attrModifierFormula}
        newSkillFormula={skillFormula}
        newTemplateSkills={skills}
        newTemplateProfiles={profiles}
        newTemplateFields={fields}
        newCoreResources={coreResources}
        newAcConfigs={acConfigs}
        newAttrModifiersEnabled={attrModifiersEnabled}
        newCharacterSections={characterSections}
        newResistances={resistances}
        newIsPublic={isPublic}
        onNewIsPublicChange={setIsPublic}
        templateError={error}
        templateCreating={creating}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onAddAttr={handleAddAttr}
        onRemoveAttr={handleRemoveAttr}
        onUpdateAttr={handleUpdateAttr}
        onAddField={handleAddField}
        onRemoveField={handleRemoveField}
        onUpdateField={handleUpdateField}
        onAddSkill={handleAddSkill}
        onRemoveSkill={handleRemoveSkill}
        onUpdateSkill={handleUpdateSkill}
        onToggleSkillAllowedAttr={handleToggleSkillAllowedAttr}
        onAddProfile={handleAddProfile}
        onRemoveProfile={handleRemoveProfile}
        onUpdateProfile={handleUpdateProfile}
        onAddProfileOption={handleAddProfileOption}
        onRemoveProfileOption={handleRemoveProfileOption}
        onUpdateProfileOption={handleUpdateProfileOption}
        onUpdateProfileTargetMode={handleUpdateProfileTargetMode}
        onToggleProfileSkill={handleToggleProfileSkill}
        onCancelNew={handleCancel}
        onCreateTemplate={handleCreate}
        onAddCoreResource={handleAddCoreResource}
        onRemoveCoreResource={handleRemoveCoreResource}
        onUpdateCoreResource={handleUpdateCoreResource}
        onUpdateCoreResourceEnabled={handleUpdateCoreResourceEnabled}
        onUpdateCoreResourceEditable={handleUpdateCoreResourceEditable}
        onUpdateCoreResourceShowNotes={handleUpdateCoreResourceShowNotes}
        onNewAttrModifiersEnabledChange={setAttrModifiersEnabled}
        onNewAttrModifierFormulaChange={setAttrModifierFormula}
        onNewSkillFormulaChange={setSkillFormula}
        // AC config
        newAttrsForAc={attrs.filter(a => a.key.trim() && a.name.trim()).map(a => ({ key: a.key.trim(), name: a.name.trim() }))}
        onAddNewAcConfig={handleAddNewAcConfig}
        onRemoveNewAcConfig={handleRemoveNewAcConfig}
        onUpdateNewAcConfig={handleUpdateNewAcConfig}
        onAddNewAcFieldForConfig={handleAddNewAcFieldForConfig}
        onRemoveNewAcFieldForConfig={handleRemoveNewAcFieldForConfig}
        onUpdateNewAcFieldForConfig={handleUpdateNewAcFieldForConfig}
        onUpdateNewAcFieldEditableForConfig={handleUpdateNewAcFieldEditableForConfig}
        onToggleNewAcAttributeIdForConfig={handleToggleNewAcAttributeIdForConfig}
        onUpdateNewAcAttributeModifierForConfig={handleUpdateNewAcAttributeModifierForConfig}
        // Character sections
        onAddNewCharacterSection={handleAddCharacterSection}
        onRemoveNewCharacterSection={handleRemoveCharacterSection}
        onUpdateNewCharacterSection={handleUpdateCharacterSection}
        // Resistances
        onNewResistancesChange={setResistances}
        attrsForNewResistance={attrsForResistance}
        // Feature toggles
        newFeatureSkills={featureSkills}
        onNewFeatureSkillsChange={setFeatureSkills}
        newFeatureCustomFields={featureCustomFields}
        onNewFeatureCustomFieldsChange={setFeatureCustomFields}
        newFeatureCoreResources={featureCoreResources}
        onNewFeatureCoreResourcesChange={setFeatureCoreResources}
        newFeatureArmorClass={featureArmorClass}
        onNewFeatureArmorClassChange={setFeatureArmorClass}
        newFeatureCharacterSections={featureCharacterSections}
        onNewFeatureCharacterSectionsChange={setFeatureCharacterSections}
        newFeatureSkillProfiles={featureSkillProfiles}
        onNewFeatureSkillProfilesChange={setFeatureSkillProfiles}
        newFeatureResistance={featureResistance}
        onNewFeatureResistanceChange={setFeatureResistance}
      />
    </>
  )
}
