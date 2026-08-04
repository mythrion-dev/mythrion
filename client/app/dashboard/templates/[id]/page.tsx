'use client'

import { useState, useEffect, useCallback, type SubmitEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation, Trans } from 'react-i18next'
import { api } from '@/lib/api'
import { PageNav } from '@/lib/breadcrumb'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { TemplateForm } from '@/components/adventure/TemplateForm'
import type { CoreResource, AcConfigDraft, ArmorClassAttributeModifierDraft, ResistanceDef } from '@/components/adventure/types'
import { emptyAcConfig, slugify } from '@/components/adventure/types'

interface TemplateAttribute {
  id: string
  key: string
  name: string
}

interface TemplateSkill {
  id: string
  name: string
  description: string | null
  attributeId: string | null
  allowedAttributeIds: string[]
  defaultAttributeId: string | null
}

interface TemplateField {
  id: string
  key: string
  label: string
}

interface SkillModifierProfile {
  id: string
  name: string
  targetMode?: string
  targetSkillIds?: string[]
  options: { id: string; label: string; value: number }[]
}

interface StandaloneTemplate {
  id: string
  name: string
  description: string | null
  campaign: string | null
  attributeModifierFormula: string | null
  skillFormula: string | null
  isPublic: boolean
  useCount: number
  attributes: TemplateAttribute[]
  templateSkills: TemplateSkill[]
  templateFields: TemplateField[]
  skillModifierProfiles: SkillModifierProfile[]
  coreResources: CoreResource[]
  armorClasses: any[]
  resistances: any[]
  characterSections: any[]
  attrModifiersEnabled: boolean
  createdAt: string
  updatedAt: string
}

export default function TemplateDetailPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const params = useParams()
  const id = params.id as string

  const [template, setTemplate] = useState<StandaloneTemplate | null>(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAttrs, setEditAttrs] = useState<{ id?: string; key: string; name: string }[]>([])
  const [editAttrModifierFormula, setEditAttrModifierFormula] = useState('')
  const [editSkillFormula, setEditSkillFormula] = useState('')
  const [editFields, setEditFields] = useState<{ id?: string; key: string; label: string }[]>([])
  const [editSkills, setEditSkills] = useState<{ name: string; description: string; attributeId: string; allowedAttributeIds: string[]; defaultAttributeId: string }[]>([])
  const [editProfiles, setEditProfiles] = useState<{ name: string; targetMode?: string; targetSkillIds?: string[]; options: { label: string; value: number }[] }[]>([])
  const [editCoreResources, setEditCoreResources] = useState<CoreResource[]>([])
  const [editAcConfigs, setEditAcConfigs] = useState<AcConfigDraft[]>([])
  const [editCharacterSections, setEditCharacterSections] = useState<{ id?: string; name: string }[]>([])
  const [editResistances, setEditResistances] = useState<ResistanceDef[]>([])
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Clone state
  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)

  // Feature toggles for edit mode
  const [editFeatureSkills, setEditFeatureSkills] = useState(true)
  const [editFeatureCustomFields, setEditFeatureCustomFields] = useState(true)
  const [editFeatureCoreResources, setEditFeatureCoreResources] = useState(true)
  const [editFeatureArmorClass, setEditFeatureArmorClass] = useState(true)
  const [editFeatureCharacterSections, setEditFeatureCharacterSections] = useState(true)
  const [editFeatureSkillProfiles, setEditFeatureSkillProfiles] = useState(true)
  const [editFeatureResistance, setEditFeatureResistance] = useState(true)
  const [editAttrModifiersEnabled, setEditAttrModifiersEnabled] = useState(true)
  const [editIsPublic, setEditIsPublic] = useState(false)

  const fetchTemplate = useCallback(async () => {
    setFetching(true)
    setError(null)
    try {
      const data = await api.get<StandaloneTemplate>(`/templates/${id}`)
      setTemplate(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('templates:failedToLoadTemplate'))
    } finally {
      setFetching(false)
    }
  }, [id, t])

  useEffect(() => {
    fetchTemplate()
  }, [fetchTemplate])

  // ── Edit handlers ──

  const startEditing = useCallback(() => {
    if (!template) return
    setEditName(template.name)
    setEditDescription(template.description ?? '')
    setEditAttrs(template.attributes.map(a => ({ id: a.id, key: a.key, name: a.name })))
    setEditAttrModifierFormula(template.attributeModifierFormula ?? '')
    setEditSkillFormula(template.skillFormula ?? '')
    setEditFields(template.templateFields.map(f => ({ id: f.id, key: f.key, label: f.label })))
    setEditSkills(template.templateSkills.map(s => ({
      name: s.name,
      description: s.description ?? '',
      attributeId: s.attributeId ?? '',
      allowedAttributeIds: s.allowedAttributeIds ?? [],
      defaultAttributeId: s.defaultAttributeId ?? '',
    })))
    setEditProfiles((template.skillModifierProfiles ?? []).map(p => ({
      name: p.name,
      targetMode: p.targetMode,
      targetSkillIds: p.targetSkillIds,
      options: p.options.map(o => ({ label: o.label, value: o.value })),
    })))
    setEditCoreResources(template.coreResources ?? [])
    setEditAcConfigs((template.armorClasses ?? []).map((ac: any) => ({
      id: ac.id,
      enabled: ac.enabled,
      name: ac.name ?? '',
      attributeModifiers: (ac.attributeModifiers ?? []).map((am: any) => ({
        attributeId: am.attributeId,
        allowPlayerSelection: am.allowPlayerSelection ?? false,
        defaultAttributeId: am.defaultAttributeId ?? null,
      })),
      fields: (ac.fields ?? []).map((f: any) => ({
        name: f.name,
        key: f.key,
        defaultValue: f.defaultValue,
        editableByPlayer: f.editableByPlayer ?? false,
        description: f.description ?? null,
      })),
    })))
    setEditCharacterSections((template as any).characterSections ?? [])
    setEditResistances((template.resistances ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      calculationType: r.calculationType ?? 'MANUAL',
      enabled: r.enabled ?? true,
      order: r.order ?? 0,
      components: (r.components ?? []).map((c: any) => ({
        name: c.name,
        editableByPlayer: c.editableByPlayer ?? false,
        defaultValue: c.defaultValue ?? '',
      })),
      attributeModifiers: (r.attributeModifiers ?? []).map((am: any) => ({
        attributeId: am.attributeId,
        enabled: am.enabled ?? true,
        attribute: am.attribute ?? null,
      })),
    })))
    setEditAttrModifiersEnabled(template.attrModifiersEnabled ?? true)
    setEditIsPublic(template.isPublic)
    setEditing(true)
    setEditError(null)
  }, [template])

  const cancelEditing = useCallback(() => {
    setEditing(false)
    setEditError(null)
  }, [])

  const handleUpdate = useCallback(async (e: SubmitEvent) => {
    e.preventDefault()
    if (!template) return
    setSaving(true)
    setEditError(null)

    try {
      const payload: Record<string, any> = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        attributes: editAttrs.filter(a => a.key.trim()).map(a => ({
          key: a.key.trim(),
          name: a.name.trim(),
        })),
        attributeModifierFormula: editAttrModifierFormula || null,
        skillFormula: editSkillFormula || null,
        attributeModifiersEnabled: editAttrModifiersEnabled,
        isPublic: editIsPublic,
      }

      payload.templateFields = editFields.filter(f => f.key.trim()).map(f => ({
        key: f.key.trim(),
        label: f.label.trim(),
      }))

      if (editFeatureSkills) {
        payload.skills = editSkills.map(s => ({
          name: s.name,
          description: s.description || null,
          attributeId: s.attributeId || null,
          allowedAttributeIds: s.allowedAttributeIds,
          defaultAttributeId: s.defaultAttributeId || null,
        }))
      }

      if (editFeatureSkillProfiles) {
        payload.skillModifierProfiles = editProfiles.map(p => ({
          name: p.name,
          targetMode: p.targetMode,
          targetSkillIds: p.targetSkillIds,
          options: p.options.map(o => ({ label: o.label, value: o.value })),
        }))
      }

      if (editFeatureCoreResources) {
        payload.coreResources = editCoreResources.map(cr => ({
          displayName: cr.displayName,
          slug: cr.slug,
          enabled: cr.enabled,
          editableByPlayer: cr.editableByPlayer,
          showNotes: cr.showNotes,
          color: cr.color,
        }))
      }

      if (editFeatureArmorClass) {
        payload.armorClasses = editAcConfigs.map(ac => ({
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

      if (editFeatureCharacterSections) {
        payload.characterSections = editCharacterSections.map(s => ({
          ...(s.id ? { id: s.id } : {}),
          name: s.name,
        }))
      }

      if (editFeatureResistance) {
        payload.resistances = editResistances.map(r => ({
          ...(r.id ? { id: r.id } : {}),
          name: r.name,
          calculationType: r.calculationType,
          components: (r.components ?? []).map(c => ({
            name: c.name,
            editableByPlayer: c.editableByPlayer,
            defaultValue: c.defaultValue,
          })),
          attributeModifiers: (r.attributeModifiers ?? []).map(am => ({
            attributeId: am.attributeId,
            enabled: am.enabled,
          })),
        }))
      }

      const updated = await api.patch<StandaloneTemplate>(`/templates/${template.id}`, payload)
      setTemplate(updated)
      setEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('templates:failedToUpdate'))
    } finally {
      setSaving(false)
    }
  }, [template, editName, editDescription, editAttrs, editAttrModifierFormula, editSkillFormula, editFields, editSkills, editProfiles, editCoreResources, editAcConfigs, editCharacterSections, editResistances, editAttrModifiersEnabled, editIsPublic, editFeatureSkills, editFeatureCustomFields, editFeatureCoreResources, editFeatureArmorClass, editFeatureCharacterSections, editFeatureSkillProfiles, editFeatureResistance, t])

  // ── Delete handler ──

  const handleDelete = useCallback(async () => {
    if (!template) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await api.delete(`/templates/${template.id}`)
      router.push('/dashboard/templates')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('templates:failedToDelete'))
      setDeleting(false)
    }
  }, [template, router, t])

  // ── Clone handler ──

  const handleClone = useCallback(async () => {
    if (!template) return
    setCloning(true)
    setCloneError(null)
    try {
      const cloned = await api.post<StandaloneTemplate>(`/templates/${template.id}/clone`, {
        name: `${template.name} (Copy)`,
      })
      router.push(`/dashboard/templates/${cloned.id}`)
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : t('templates:failedToClone'))
      setCloning(false)
    }
  }, [template, router, t])

  // ── Attribute list helpers (for edit mode form compat) ──

  const handleAddEditAttr = useCallback(() => {
    setEditAttrs(prev => [...prev, { key: '', name: '' }])
  }, [])
  const handleRemoveEditAttr = useCallback((i: number) => {
    setEditAttrs(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  const handleUpdateEditAttr = useCallback((i: number, f: 'key' | 'name', v: string) => {
    setEditAttrs(prev => prev.map((a, idx) => idx === i ? { ...a, [f]: v } : a))
  }, [])

  const handleAddEditField = useCallback(() => {
    setEditFields(prev => [...prev, { key: '', label: '' }])
  }, [])
  const handleRemoveEditField = useCallback((i: number) => {
    setEditFields(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  const handleUpdateEditField = useCallback((i: number, f: 'key' | 'label', v: string) => {
    setEditFields(prev => prev.map((fd, idx) => idx === i ? { ...fd, [f]: v } : fd))
  }, [])

  const handleAddEditSkill = useCallback(() => {
    setEditSkills(prev => [...prev, { name: '', description: '', attributeId: '', allowedAttributeIds: [], defaultAttributeId: '' }])
  }, [])
  const handleRemoveEditSkill = useCallback((i: number) => {
    setEditSkills(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  const handleUpdateEditSkill = useCallback((i: number, f: string, v: string) => {
    setEditSkills(prev => prev.map((s, idx) => idx === i ? { ...s, [f]: v } : s))
  }, [])
  const handleToggleEditSkillAllowedAttr = useCallback((i: number, attrKey: string) => {
    setEditSkills(prev => prev.map((s, idx) => {
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

  // ── Profile edit helpers ──

  const handleAddEditProfile = useCallback(() => {
    setEditProfiles(prev => [...prev, { name: '', options: [{ label: '', value: 0 }] }])
  }, [])
  const handleRemoveEditProfile = useCallback((i: number) => {
    setEditProfiles(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  const handleUpdateEditProfile = useCallback((i: number, name: string) => {
    setEditProfiles(prev => prev.map((p, idx) => idx === i ? { ...p, name } : p))
  }, [])
  const handleAddEditProfileOption = useCallback((pIdx: number) => {
    setEditProfiles(prev => prev.map((p, idx) => idx === pIdx
      ? { ...p, options: [...p.options, { label: '', value: 0 }] }
      : p))
  }, [])
  const handleRemoveEditProfileOption = useCallback((pIdx: number, oIdx: number) => {
    setEditProfiles(prev => prev.map((p, idx) => idx === pIdx
      ? { ...p, options: p.options.filter((_, oi) => oi !== oIdx) }
      : p))
  }, [])
  const handleUpdateEditProfileOption = useCallback((pIdx: number, oIdx: number, f: 'label' | 'value', v: string | number) => {
    setEditProfiles(prev => prev.map((p, idx) => idx === pIdx
      ? { ...p, options: p.options.map((o, oi) => oi === oIdx ? { ...o, [f]: v } : o) }
      : p))
  }, [])
  const handleUpdateEditProfileTargetMode = useCallback((i: number, mode: string) => {
    setEditProfiles(prev => prev.map((p, idx) => idx === i ? { ...p, targetMode: mode } : p))
  }, [])
  const handleToggleEditProfileSkill = useCallback((i: number, skillId: string) => {
    setEditProfiles(prev => prev.map((p, idx) => {
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

  // ── Core resource edit helpers ──

  const handleAddEditCoreResource = useCallback(() => {
    setEditCoreResources(prev => [...prev, { displayName: '', slug: '', color: '#ffffff', enabled: true, editableByPlayer: true, showNotes: false }])
  }, [])
  const handleRemoveEditCoreResource = useCallback((i: number) => {
    setEditCoreResources(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  const handleUpdateEditCoreResource = useCallback((i: number, f: 'displayName' | 'slug' | 'color', v: string) => {
    setEditCoreResources(prev => prev.map((cr, idx) => idx === i ? { ...cr, [f]: v } : cr))
  }, [])
  const handleUpdateEditCoreResourceEnabled = useCallback((i: number, v: boolean) => {
    setEditCoreResources(prev => prev.map((cr, idx) => idx === i ? { ...cr, enabled: v } : cr))
  }, [])
  const handleUpdateEditCoreResourceEditable = useCallback((i: number, v: boolean) => {
    setEditCoreResources(prev => prev.map((cr, idx) => idx === i ? { ...cr, editable: v } : cr))
  }, [])
  const handleUpdateEditCoreResourceShowNotes = useCallback((i: number, v: boolean) => {
    setEditCoreResources(prev => prev.map((cr, idx) => idx === i ? { ...cr, showNotes: v } : cr))
  }, [])

  // ── AC Config edit handlers ──

  const handleAddEditAcConfig = useCallback(() => {
    setEditAcConfigs(prev => [...prev, emptyAcConfig()])
  }, [])
  const handleRemoveEditAcConfig = useCallback((i: number) => {
    setEditAcConfigs(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  const handleUpdateEditAcConfig = useCallback((i: number, patch: Partial<AcConfigDraft>) => {
    setEditAcConfigs(prev => prev.map((ac, idx) => idx === i ? { ...ac, ...patch } : ac))
  }, [])
  const handleAddEditAcFieldForConfig = useCallback((configIdx: number) => {
    setEditAcConfigs(prev => prev.map((ac, i) => i === configIdx
      ? { ...ac, fields: [...ac.fields, { name: '', key: '', defaultValue: '0', editableByPlayer: false, description: '' }] }
      : ac))
  }, [])
  const handleRemoveEditAcFieldForConfig = useCallback((configIdx: number, fieldIdx: number) => {
    setEditAcConfigs(prev => prev.map((ac, i) => i === configIdx
      ? { ...ac, fields: ac.fields.filter((_, j) => j !== fieldIdx) }
      : ac))
  }, [])
  const handleUpdateEditAcFieldForConfig = useCallback((configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) => {
    setEditAcConfigs(prev => prev.map((ac, i) => {
      if (i !== configIdx) return ac
      return {
        ...ac, fields: ac.fields.map((field, j) => {
          if (j !== fieldIdx) return field
          const updated = { ...field, [f]: v }
          if (f === 'name' && v.trim() && !field.key.trim()) updated.key = slugify(v.trim())
          return updated
        })
      }
    }))
  }, [])
  const handleUpdateEditAcFieldEditableForConfig = useCallback((configIdx: number, fieldIdx: number, v: boolean) => {
    setEditAcConfigs(prev => prev.map((ac, i) => i === configIdx
      ? { ...ac, fields: ac.fields.map((field, j) => j === fieldIdx ? { ...field, editableByPlayer: v } : field) }
      : ac))
  }, [])
  const handleToggleEditAcAttributeIdForConfig = useCallback((configIdx: number, attrId: string) => {
    setEditAcConfigs(prev => prev.map((ac, i) => {
      if (i !== configIdx) return ac
      const exists = ac.attributeModifiers.some(am => am.attributeId === attrId)
      return {
        ...ac,
        attributeModifiers: exists
          ? ac.attributeModifiers.filter(am => am.attributeId !== attrId)
          : [...ac.attributeModifiers, { attributeId: attrId, allowPlayerSelection: false, defaultAttributeId: attrId }],
      }
    }))
  }, [])
  const handleUpdateEditAcAttributeModifierForConfig = useCallback((configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) => {
    setEditAcConfigs(prev => prev.map((ac, i) => i === configIdx
      ? { ...ac, attributeModifiers: ac.attributeModifiers.map(am => am.attributeId === attrId ? { ...am, ...patch } : am) }
      : ac))
  }, [])

  // ── Character section edit handlers ──

  const handleAddEditCharacterSection = useCallback(() => {
    setEditCharacterSections(prev => [...prev, { name: '' }])
  }, [])
  const handleRemoveEditCharacterSection = useCallback((i: number) => {
    setEditCharacterSections(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  const handleUpdateEditCharacterSection = useCallback((i: number, v: string) => {
    setEditCharacterSections(prev => prev.map((s, idx) => idx === i ? { ...s, name: v } : s))
  }, [])

  // ── Resistance edit handler ──

  const handleEditResistancesChange = useCallback((v: ResistanceDef[]) => {
    setEditResistances(v)
  }, [])

  // ── Loading / Error states ──

  if (fetching) {
    return (
      <>
        <PageNav crumbs={[
          { label: t('common:dashboard'), href: '/dashboard' },
          { label: t('templates:templates'), href: '/dashboard/templates' },
          { label: '...' },
        ]} />
        <LoadingSkeleton variant="page" />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageNav crumbs={[
          { label: t('common:dashboard'), href: '/dashboard' },
          { label: t('templates:templates'), href: '/dashboard/templates' },
          { label: t('templates:error') },
        ]} />
        <EmptyState
          icon="⚠️"
          title={t('templates:couldNotLoad')}
          description={error}
          actionLabel={t('templates:goBackToTemplates')}
          actionHref="/dashboard/templates"
        />
      </>
    )
  }

  if (!template) {
    return (
      <>
        <PageNav crumbs={[
          { label: t('common:dashboard'), href: '/dashboard' },
          { label: t('templates:templates'), href: '/dashboard/templates' },
          { label: t('templates:notFoundCrumb') },
        ]} />
        <EmptyState
          icon="🔍"
          title={t('templates:templateNotFound')}
          description={t('templates:templateNotFoundBody')}
          actionLabel={t('templates:goBackToTemplates')}
          actionHref="/dashboard/templates"
        />
      </>
    )
  }

  // ── Edit Mode ──
  if (editing) {
    const attrsForResistance = editAttrs.filter(a => a.key.trim() && a.name.trim()).map(a => ({ key: a.key.trim(), name: a.name.trim() }))

    return (
      <>
        <PageNav crumbs={[
          { label: t('common:dashboard'), href: '/dashboard' },
          { label: t('templates:templates'), href: '/dashboard/templates' },
          { label: template.name },
        ]} />
        <TemplateForm
          newTemplateName={editName}
          newTemplateDescription={editDescription}
          newTemplateAttrs={editAttrs as any}
          newAttrModifierFormula={editAttrModifierFormula}
          newSkillFormula={editSkillFormula}
          newTemplateSkills={editSkills}
          newTemplateProfiles={editProfiles}
          newTemplateFields={editFields}
          newCoreResources={editCoreResources}
          newAcConfigs={editAcConfigs}
          newAttrModifiersEnabled={editAttrModifiersEnabled}
          newCharacterSections={editCharacterSections}
          newResistances={editResistances}
          templateError={editError}
          templateCreating={saving}
          onNameChange={setEditName}
          onDescriptionChange={setEditDescription}
          onAddAttr={handleAddEditAttr}
          onRemoveAttr={handleRemoveEditAttr}
          onUpdateAttr={handleUpdateEditAttr}
          onAddField={handleAddEditField}
          onRemoveField={handleRemoveEditField}
          onUpdateField={handleUpdateEditField}
          onAddSkill={handleAddEditSkill}
          onRemoveSkill={handleRemoveEditSkill}
          onUpdateSkill={handleUpdateEditSkill}
          onToggleSkillAllowedAttr={handleToggleEditSkillAllowedAttr}
          onAddProfile={handleAddEditProfile}
          onRemoveProfile={handleRemoveEditProfile}
          onUpdateProfile={handleUpdateEditProfile}
          onAddProfileOption={handleAddEditProfileOption}
          onRemoveProfileOption={handleRemoveEditProfileOption}
          onUpdateProfileOption={handleUpdateEditProfileOption}
          onUpdateProfileTargetMode={handleUpdateEditProfileTargetMode}
          onToggleProfileSkill={handleToggleEditProfileSkill}
          onCancelNew={cancelEditing}
          onCreateTemplate={handleUpdate}
          onAddCoreResource={handleAddEditCoreResource}
          onRemoveCoreResource={handleRemoveEditCoreResource}
          onUpdateCoreResource={handleUpdateEditCoreResource}
          onUpdateCoreResourceEnabled={handleUpdateEditCoreResourceEnabled}
          onUpdateCoreResourceEditable={handleUpdateEditCoreResourceEditable}
          onUpdateCoreResourceShowNotes={handleUpdateEditCoreResourceShowNotes}
          onNewAttrModifiersEnabledChange={setEditAttrModifiersEnabled}
          onNewAttrModifierFormulaChange={setEditAttrModifierFormula}
          onNewSkillFormulaChange={setEditSkillFormula}
          // AC config
          newAttrsForAc={editAttrs.filter(a => a.key.trim() && a.name.trim()).map(a => ({ key: a.key.trim(), name: a.name.trim() }))}
          onAddNewAcConfig={handleAddEditAcConfig}
          onRemoveNewAcConfig={handleRemoveEditAcConfig}
          onUpdateNewAcConfig={handleUpdateEditAcConfig}
          onAddNewAcFieldForConfig={handleAddEditAcFieldForConfig}
          onRemoveNewAcFieldForConfig={handleRemoveEditAcFieldForConfig}
          onUpdateNewAcFieldForConfig={handleUpdateEditAcFieldForConfig}
          onUpdateNewAcFieldEditableForConfig={handleUpdateEditAcFieldEditableForConfig}
          onToggleNewAcAttributeIdForConfig={handleToggleEditAcAttributeIdForConfig}
          onUpdateNewAcAttributeModifierForConfig={handleUpdateEditAcAttributeModifierForConfig}
          // Character sections
          onAddNewCharacterSection={handleAddEditCharacterSection}
          onRemoveNewCharacterSection={handleRemoveEditCharacterSection}
          onUpdateNewCharacterSection={handleUpdateEditCharacterSection}
          // Resistances
          onNewResistancesChange={handleEditResistancesChange}
          attrsForNewResistance={attrsForResistance}
          // Feature toggles
          newIsPublic={editIsPublic}
          onNewIsPublicChange={setEditIsPublic}
          newFeatureSkills={editFeatureSkills}
          onNewFeatureSkillsChange={setEditFeatureSkills}
          newFeatureCustomFields={editFeatureCustomFields}
          onNewFeatureCustomFieldsChange={setEditFeatureCustomFields}
          newFeatureCoreResources={editFeatureCoreResources}
          onNewFeatureCoreResourcesChange={setEditFeatureCoreResources}
          newFeatureArmorClass={editFeatureArmorClass}
          onNewFeatureArmorClassChange={setEditFeatureArmorClass}
          newFeatureCharacterSections={editFeatureCharacterSections}
          onNewFeatureCharacterSectionsChange={setEditFeatureCharacterSections}
          newFeatureSkillProfiles={editFeatureSkillProfiles}
          onNewFeatureSkillProfilesChange={setEditFeatureSkillProfiles}
          newFeatureResistance={editFeatureResistance}
          onNewFeatureResistanceChange={setEditFeatureResistance}
        />
      </>
    )
  }

  // ── Display Mode ──
  const attrCount = template.attributes.length
  const skillCount = template.templateSkills.length
  const fieldCount = template.templateFields.length
  const profileCount = template.skillModifierProfiles?.length ?? 0
  const crCount = template.coreResources?.length ?? 0
  const acCount = template.armorClasses?.length ?? 0
  const sectionCount = (template as any).characterSections?.length ?? 0
  const resistCount = template.resistances?.length ?? 0

  return (
    <>
      <PageNav crumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Templates', href: '/dashboard/templates' },
        { label: template.name },
      ]} />

      {/* Template header */}
      <div className="card !p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gradient mb-1">{template.name}</h1>
            {template.description && (
              <p className="text-sm text-muted-foreground">{template.description}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={startEditing}
              className="btn-primary text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {t('common:edit')}
            </button>
            <button
              onClick={handleClone}
              disabled={cloning}
              className="btn-ghost text-sm"
            >
              {cloning ? (
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
              {t('templates:clone')}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn-danger text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {t('common:delete')}
            </button>
          </div>
        </div>

        {template.campaign && (
          <span className="badge badge-gold text-xs">{template.campaign}</span>
        )}
        <span className="text-xs text-muted ml-2">
          {t('templates:usedTime', { count: template.useCount })}
        </span>
        {template.isPublic && (
          <span className="badge text-xs ml-2" style={{ background: 'rgba(68,207,138,0.12)', color: '#44cf8a', border: '1px solid rgba(68,207,138,0.18)' }}>
            {t('common:public')}
          </span>
        )}

        {cloneError && (
          <div className="mt-4 rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
            {cloneError}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted">
          <span>
            {t('templates:createdDate', { date: new Date(template.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) })}
          </span>
          <span>
            {t('templates:updatedDate', { date: new Date(template.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) })}
          </span>
        </div>
      </div>

      {/* Feature summary */}
      <div className="card !p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">{t('templates:templateFeatures')}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FeatureSummaryCard label={t('templates:featureAttributes')} count={attrCount} iconKey="attributes" />
          <FeatureSummaryCard label={t('templates:featureSkills')} count={skillCount} iconKey="skills" />
          <FeatureSummaryCard label={t('templates:featureCustomFields')} count={fieldCount} iconKey="customfields" />
          <FeatureSummaryCard label={t('templates:featureSkillProfiles')} count={profileCount} iconKey="profiles" />
          <FeatureSummaryCard label={t('templates:featureCoreResources')} count={crCount} iconKey="coreResources" />
          <FeatureSummaryCard label={t('templates:featureArmorClasses')} count={acCount} iconKey="armorClass" />
          <FeatureSummaryCard label={t('templates:featureCharacterSections')} count={sectionCount} iconKey="sections" />
          <FeatureSummaryCard label={t('templates:featureResistances')} count={resistCount} iconKey="resistances" />
        </div>

      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="card !p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-foreground">{t('templates:deleteTemplate')}</h3>
            <p className="text-sm text-muted-foreground">
              <Trans
                i18nKey="templates:deleteConfirm"
                values={{ name: template.name }}
                components={[<strong key="name" className="text-foreground" />]}
              />
            </p>

            {deleteError && (
              <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => { setConfirmDelete(false); setDeleteError(null) }}
                className="btn-ghost text-sm"
              >
                {t('common:cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-danger text-sm"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-danger/30 border-t-danger rounded-full animate-spin" />
                    {t('templates:deleting')}
                  </>
                ) : (
                  t('common:delete')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Feature summary card ── */

const FEATURE_ICONS: Record<string, string> = {
  attributes: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  skills: 'M13 10V3L4 14h7v7l9-11h-7z',
  customfields: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 0 0 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2',
  coreResources: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  armorClass: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  sections: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  profiles: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  resistances: 'M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016zM12 9v2m0 4h.01',
}

function FeatureSummaryCard({ label, count, iconKey }: { label: string; count: number; iconKey: string }) {
  const pathData = FEATURE_ICONS[iconKey] ?? ''
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border">
      <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20">
        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d={pathData} />
        </svg>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{count}</p>
      </div>
    </div>
  )
}
