'use client'

import { useState, useCallback, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { TemplateForm } from '@/components/adventure/TemplateForm'
import type { CoreResource, AcConfigDraft, ArmorClassAttributeModifierDraft, ResistanceDef } from '@/components/adventure/types'

export default function NewTemplatePage() {
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
    setSkills(prev => prev.map((s, idx) => {
      if (idx !== i) return s
      const exists = s.allowedAttributeIds.includes(attrKey)
      return {
        ...s,
        allowedAttributeIds: exists
          ? s.allowedAttributeIds.filter(a => a !== attrKey)
          : [...s.allowedAttributeIds, attrKey],
      }
    }))
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
    setProfiles(prev => prev.map((p, idx) => idx === pIdx
      ? { ...p, options: p.options.filter((_, oi) => oi !== oIdx) }
      : p))
  }, [])
  const handleUpdateProfileOption = useCallback((pIdx: number, oIdx: number, f: 'label' | 'value', v: string | number) => {
    setProfiles(prev => prev.map((p, idx) => idx === pIdx
      ? { ...p, options: p.options.map((o, oi) => oi === oIdx ? { ...o, [f]: v } : o) }
      : p))
  }, [])
  const handleUpdateProfileTargetMode = useCallback((i: number, mode: string) => {
    setProfiles(prev => prev.map((p, idx) => idx === i ? { ...p, targetMode: mode } : p))
  }, [])
  const handleToggleProfileSkill = useCallback((i: number, skillId: string) => {
    setProfiles(prev => prev.map((p, idx) => {
      if (idx !== i) return p
      const exists = (p.targetSkillIds ?? []).includes(skillId)
      return {
        ...p,
        targetSkillIds: exists
          ? (p.targetSkillIds ?? []).filter(s => s !== skillId)
          : [...(p.targetSkillIds ?? []), skillId],
      }
    }))
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

  // ── AC Config handlers (no-op stubs for creation — added when features are expanded) ──

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

  const handleCreate = useCallback(async (e: FormEvent) => {
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
        payload.armorClasses = acConfigs
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
      setError(err instanceof Error ? err.message : 'Failed to create template')
    } finally {
      setCreating(false)
    }
  }, [name, description, attrs, attrModifierFormula, skillFormula, attrModifiersEnabled,
      featureSkills, skills, featureCustomFields, fields, featureSkillProfiles, profiles,
      featureCoreResources, coreResources, featureArmorClass, acConfigs,
      featureCharacterSections, characterSections, featureResistance, resistances, router])

  // ── Cancel ──

  const handleCancel = useCallback(() => {
    router.push('/dashboard/templates')
  }, [router])

  // ── Attrs for resistance support ──

  const attrsForResistance = attrs.filter(a => a.key.trim() && a.name.trim()).map(a => ({ key: a.key.trim(), name: a.name.trim() }))

  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted mb-4">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
        <span>/</span>
        <Link href="/dashboard/templates" className="hover:text-foreground transition-colors">Templates</Link>
        <span>/</span>
        <span className="text-foreground">New</span>
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
        // AC config — no-op stubs for creation (can be expanded later)
        newAttrsForAc={attrs.filter(a => a.key.trim() && a.name.trim()).map(a => ({ key: a.key.trim(), name: a.name.trim() }))}
        onAddNewAcConfig={() => {}}
        onRemoveNewAcConfig={() => {}}
        onUpdateNewAcConfig={() => {}}
        onAddNewAcFieldForConfig={() => {}}
        onRemoveNewAcFieldForConfig={() => {}}
        onUpdateNewAcFieldForConfig={() => {}}
        onUpdateNewAcFieldEditableForConfig={() => {}}
        onToggleNewAcAttributeIdForConfig={() => {}}
        onUpdateNewAcAttributeModifierForConfig={() => {}}
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
