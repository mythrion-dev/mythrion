'use client'

import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { PageNav } from '@/lib/breadcrumb'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { TemplateForm } from '@/components/adventure/TemplateForm'
import type { CoreResource, AcConfigDraft, ArmorClassAttributeModifierDraft, ResistanceDef } from '@/components/adventure/types'

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

  const fetchTemplate = useCallback(async () => {
    setFetching(true)
    setError(null)
    try {
      const data = await api.get<StandaloneTemplate>(`/templates/${id}`)
      setTemplate(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template')
    } finally {
      setFetching(false)
    }
  }, [id])

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
    setEditing(true)
    setEditError(null)
  }, [template])

  const cancelEditing = useCallback(() => {
    setEditing(false)
    setEditError(null)
  }, [])

  const handleUpdate = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!template) return
    setSaving(true)
    setEditError(null)

    try {
      const payload: Record<string, any> = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        attributes: editAttrs.filter(a => a.key.trim()).map(a => ({
          ...(a.id ? { id: a.id } : {}),
          key: a.key.trim(),
          name: a.name.trim(),
        })),
        attributeModifierFormula: editAttrModifierFormula || null,
        skillFormula: editSkillFormula || null,
        attrModifiersEnabled: editAttrModifiersEnabled,
      }

      payload.templateFields = editFields.filter(f => f.key.trim()).map(f => ({
        ...(f.id ? { id: f.id } : {}),
        key: f.key.trim(),
        label: f.label.trim(),
      }))

      if (editFeatureSkills) {
        payload.templateSkills = editSkills.map(s => ({
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
        payload.coreResources = editCoreResources
      }

      if (editFeatureArmorClass) {
        payload.armorClasses = editAcConfigs
      }

      if (editFeatureCharacterSections) {
        payload.characterSections = editCharacterSections
      }

      if (editFeatureResistance) {
        payload.resistances = editResistances
      }

      const updated = await api.patch<StandaloneTemplate>(`/templates/${template.id}`, payload)
      setTemplate(updated)
      setEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update template')
    } finally {
      setSaving(false)
    }
  }, [template, editName, editDescription, editAttrs, editAttrModifierFormula, editSkillFormula, editFields, editSkills, editProfiles, editCoreResources, editAcConfigs, editCharacterSections, editResistances, editAttrModifiersEnabled, editFeatureSkills, editFeatureCustomFields, editFeatureCoreResources, editFeatureArmorClass, editFeatureCharacterSections, editFeatureSkillProfiles, editFeatureResistance])

  // ── Delete handler ──

  const handleDelete = useCallback(async () => {
    if (!template) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await api.delete(`/templates/${template.id}`)
      router.push('/dashboard/templates')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete template')
      setDeleting(false)
    }
  }, [template, router])

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
      setCloneError(err instanceof Error ? err.message : 'Failed to clone template')
      setCloning(false)
    }
  }, [template, router])

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
    setEditCoreResources(prev => [...prev, { displayName: '', slug: '', color: '#ffffff', enabled: true, editable: true, showNotes: false }])
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

  // ── Loading / Error states ──

  if (fetching) {
    return (
      <>
        <PageNav crumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Templates', href: '/dashboard/templates' },
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
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Templates', href: '/dashboard/templates' },
          { label: 'Error' },
        ]} />
        <EmptyState
          icon="⚠️"
          title="Could not load template"
          description={error}
          actionLabel="Go back to templates"
          actionHref="/dashboard/templates"
        />
      </>
    )
  }

  if (!template) {
    return (
      <>
        <PageNav crumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Templates', href: '/dashboard/templates' },
          { label: 'Not found' },
        ]} />
        <EmptyState
          icon="🔍"
          title="Template not found"
          description="This template could not be found or you don't have access to it."
          actionLabel="Go back to templates"
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
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Templates', href: '/dashboard/templates' },
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
          onAddNewCharacterSection={() => {}}
          onRemoveNewCharacterSection={() => {}}
          onUpdateNewCharacterSection={() => {}}
          // Resistances
          onNewResistancesChange={() => {}}
          attrsForNewResistance={attrsForResistance}
          // Feature toggles
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
              Edit
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
              Clone
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn-danger text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </div>

        {template.campaign && (
          <span className="badge badge-gold text-xs">{template.campaign}</span>
        )}
        <span className="text-xs text-muted ml-2">
          Used {template.useCount} time{template.useCount !== 1 ? 's' : ''}
        </span>
        {template.isPublic && (
          <span className="badge text-xs ml-2" style={{ background: 'rgba(68,207,138,0.12)', color: '#44cf8a', border: '1px solid rgba(68,207,138,0.18)' }}>
            Public
          </span>
        )}

        {cloneError && (
          <div className="mt-4 rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
            {cloneError}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted">
          <span>
            Created {new Date(template.createdAt).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </span>
          <span>
            Updated {new Date(template.updatedAt).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Feature summary */}
      <div className="card !p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Template Features</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FeatureSummaryCard label="Attributes" count={attrCount} icon="📊" />
          <FeatureSummaryCard label="Skills" count={skillCount} icon="⚡" />
          <FeatureSummaryCard label="Custom Fields" count={fieldCount} icon="📝" />
          <FeatureSummaryCard label="Skill Profiles" count={profileCount} icon="🎯" />
          <FeatureSummaryCard label="Core Resources" count={crCount} icon="❤️" />
          <FeatureSummaryCard label="Armor Classes" count={acCount} icon="🛡️" />
          <FeatureSummaryCard label="Character Sections" count={sectionCount} icon="📋" />
          <FeatureSummaryCard label="Resistances" count={resistCount} icon="🔥" />
        </div>

        {(template.attributeModifierFormula || template.skillFormula) && (
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            {template.attributeModifierFormula && (
              <p className="text-sm text-muted">
                <span className="text-foreground font-medium">Attribute Formula:</span>{' '}
                <code className="text-xs bg-surface px-2 py-0.5 rounded border border-border">{template.attributeModifierFormula}</code>
              </p>
            )}
            {template.skillFormula && (
              <p className="text-sm text-muted">
                <span className="text-foreground font-medium">Skill Formula:</span>{' '}
                <code className="text-xs bg-surface px-2 py-0.5 rounded border border-border">{template.skillFormula}</code>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="card !p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Delete Template</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong className="text-foreground">{template.name}</strong>?
              This action cannot be undone. Templates that are currently attached to adventures
              cannot be deleted.
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
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-danger text-sm"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-danger/30 border-t-danger rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
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

function FeatureSummaryCard({ label, count, icon }: { label: string; count: number; icon: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{count}</p>
      </div>
    </div>
  )
}
