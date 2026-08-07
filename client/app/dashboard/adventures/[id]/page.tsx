'use client'

import { useState, useEffect, useCallback, type SubmitEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import { PageNav } from '@/lib/breadcrumb'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { AdventureHeader } from '@/components/adventure/AdventureHeader'
import { CollapsibleSection } from '@/components/adventure/CollapsibleSection'
import { MemberRow } from '@/components/adventure/MemberRow'
import { InvitePanel } from '@/components/adventure/InvitePanel'
import { DeleteModal } from '@/components/adventure/DeleteModal'
import { EditForm } from '@/components/adventure/EditForm'
import { CharactersSection } from '@/components/adventure/CharactersSection'
import { TemplatesSection } from '@/components/adventure/TemplatesSection'
import { TemplateAttachmentPanel } from '@/components/adventure/TemplateAttachmentPanel'
import { CampaignCreatureSidebar } from '@/components/adventure/CampaignCreatureSidebar'
import { NpcsMobsSection } from '@/components/adventure/NpcsMobsSection'
import { BookListPanel } from '@/components/books/BookListPanel'
import { PdfViewerSidebar } from '@/components/books/PdfViewerSidebar'
import { NotebookSidebar } from '@/components/notebook/NotebookSidebar'
import { VisibilityToggle } from '@/components/adventure/VisibilityToggle'
import { JoinRequestPanel } from '@/components/adventure/JoinRequestPanel'
import type { CoreResource, AcConfigDraft, ArmorClassAttributeModifierDraft, ResistanceDef } from '@/components/adventure/types'
import { emptyAcConfig, slugify } from '@/components/adventure/types'

interface Adventure {
  id: string; name: string; campaign: string; synopsis: string | null; maxPlayers: number; ownerId: string; createdAt: string; updatedAt: string
}
interface Member {
  id: string; role: string; joinedAt: string; user: { id: string; email: string; displayName: string | null }
}
interface Invitation {
  id: string; invitedEmail: string | null; token: string; role: string; status: string; expiresAt: string; createdAt: string
  createdBy: { id: string; displayName: string | null; email: string }
}
interface SkillModifierProfile { id: string; name: string; targetMode?: string; targetSkillIds?: string[]; options: { id: string; label: string; value: number }[] }

interface TemplateArmorClassField {
  id: string; name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string | null
}
interface TemplateArmorClassAttributeModifier {
  id: string; attributeId: string; allowPlayerSelection: boolean; defaultAttributeId: string | null
  attribute: { id: string; key: string; name: string }
  defaultAttribute: { id: string; key: string; name: string } | null
}
interface TemplateArmorClass {
  id: string; name?: string; enabled: boolean; attributeModifiers: TemplateArmorClassAttributeModifier[]; fields: TemplateArmorClassField[]
}
interface TemplateResistanceComponent {
  id: string; name: string; editableByPlayer: boolean; defaultValue: string
}
interface TemplateResistanceAttributeModifier {
  id: string; attributeId: string; enabled?: boolean; attribute: { id: string; key: string; name: string }
}
interface TemplateResistance {
  id: string; name: string; calculationType: string; order: number
  components: TemplateResistanceComponent[]
  attributeModifiers: TemplateResistanceAttributeModifier[]
}
interface Template {
  id: string; name: string; description: string | null
  attributeModifierFormula?: string | null
  skillFormula?: string | null
  attributes: { id: string; key: string; name: string }[]
  templateFields?: { id: string; key: string; label: string }[]
  templateSkills?: { id: string; name: string; description: string | null; attributeId: string | null; allowedAttributeIds: string[]; defaultAttributeId: string | null; attribute?: { id: string; key: string; name: string } | null; defaultAttribute?: { id: string; key: string; name: string } | null }[]
  skillModifierProfiles?: SkillModifierProfile[]
  coreResources?: CoreResource[]
  armorClasses?: TemplateArmorClass[]
  resistances?: TemplateResistance[]
  createdAt: string
}
interface CampaignCharacter {
  id: string; characterName: string; adventure: { id: string; name: string; campaign: string }
  template: { id: string; name: string }; owner: { id: string; displayName: string | null; email: string } | null; createdAt: string
}
interface UserSheet {
  id: string; characterName: string; adventure: { id: string; name: string; campaign: string }
  template: { id: string; name: string }; createdAt: string
}

function validateCoreResources(resources: { slug: string }[], t: TFunction) {
  const valid = resources.filter(r => r.slug.trim())
  const slugs = new Set<string>()
  for (const r of valid) {
    const s = r.slug.trim().toLowerCase()
    if (slugs.has(s)) return t('campaign:duplicateSlug', { slug: s })
    slugs.add(s)
  }
  return null
}

function buildAcPayload(configs: AcConfigDraft[]) {
  return configs
    .filter(ac => ac.enabled && ac.name.trim())
    .map(ac => ({
      name: ac.name.trim(),
      enabled: true,
      attributeModifiers: ac.attributeModifiers.map(am => ({
        attributeId: am.attributeId,
        allowPlayerSelection: am.allowPlayerSelection,
        defaultAttributeId: am.allowPlayerSelection ? (am.defaultAttributeId || am.attributeId) : undefined,
      })),
      fields: ac.fields.filter(f => f.name.trim() && f.key.trim()).map(f => ({
        name: f.name.trim(),
        key: f.key.trim(),
        defaultValue: f.defaultValue.trim() || '0',
        editableByPlayer: f.editableByPlayer,
        description: f.description.trim() || undefined,
      })),
    }))
}

function buildResistancesPayload(resistances: ResistanceDef[]) {
  return resistances.filter(r => r.name.trim()).map((r) => ({
    id: r.id,
    name: r.name.trim(),
    calculationType: r.calculationType,
    components: (r.components || []).filter(c => c.name.trim()).map(c => ({
      id: c.id,
      name: c.name.trim(),
      editableByPlayer: c.editableByPlayer,
      defaultValue: c.defaultValue || '0',
    })),
    attributeModifiers: (r.attributeModifiers || [])
      .filter(am => am.attributeId?.trim())
      .map(am => ({
        attributeId: am.attributeId,
        enabled: am.enabled,
      })),
  }))
}

interface TemplatePayloadSource {
  attributes: { key: string; name: string }[]
  attributeModifiersEnabled: boolean
  attributeModifierFormula: string
  skillFormula: string
  templateFields: { key: string; label: string }[]
  templateSkills: { name: string; description: string; attributeId: string; allowedAttributeIds: string[]; defaultAttributeId: string }[]
  skillModifierProfiles: { name: string; targetMode?: string; targetSkillIds?: string[]; options: { label: string; value: number }[] }[]
  coreResources: CoreResource[]
  acConfigs: AcConfigDraft[]
  characterSections: { id?: string; name: string }[]
  resistances: ResistanceDef[]
  featureSkills: boolean
  featureCustomFields: boolean
  featureCoreResources: boolean
  featureArmorClass: boolean
  featureCharacterSections: boolean
  featureSkillProfiles: boolean
  featureResistance: boolean
}

function buildTemplatePayload(s: TemplatePayloadSource) {
  return {
    attributeModifiersEnabled: s.attributeModifiersEnabled,
    attributeModifierFormula: s.attributeModifierFormula.trim() || undefined,
    skillFormula: s.skillFormula.trim() || undefined,
    attributes: s.attributes.map(a => ({ key: a.key.trim(), name: a.name.trim() })),
    templateFields: s.featureCustomFields ? s.templateFields.filter(f => f.key.trim() && f.label.trim()).map(f => ({ key: f.key.trim(), label: f.label.trim() })) : undefined,
    skills: s.featureSkills ? s.templateSkills.filter(sk => sk.name.trim()).map(sk => ({ name: sk.name.trim(), description: sk.description.trim() || undefined, attributeId: sk.attributeId.trim() || undefined, allowedAttributeIds: sk.allowedAttributeIds.filter(k => k.trim()), defaultAttributeId: sk.defaultAttributeId.trim() || undefined })) : undefined,
    skillModifierProfiles: s.featureSkillProfiles ? s.skillModifierProfiles.filter(p => p.name.trim()).map(p => ({ name: p.name.trim(), targetMode: p.targetMode ?? 'ALL_SKILLS', targetSkillIds: p.targetSkillIds ?? [], options: p.options.filter(o => o.label.trim()).map(o => ({ label: o.label.trim(), value: o.value })) })) : undefined,
    coreResources: s.featureCoreResources ? s.coreResources.filter(r => r.slug.trim()).map(r => ({ displayName: r.displayName.trim() || r.slug.trim(), slug: r.slug.trim(), enabled: r.enabled, editableByPlayer: r.editableByPlayer, showNotes: r.showNotes, color: r.color || undefined })) : undefined,
    armorClasses: s.featureArmorClass ? buildAcPayload(s.acConfigs) : undefined,
    characterSections: s.featureCharacterSections ? s.characterSections.filter(x => x.name.trim()).map(x => ({ id: x.id, name: x.name.trim() })) : undefined,
    resistances: s.featureResistance ? buildResistancesPayload(s.resistances) : undefined,
  }
}

function validateTemplateForm(args: {
  attrs: { key: string; name: string }[]
  coreResources: CoreResource[]
  profiles: { name: string; targetMode?: string; targetSkillIds?: string[] }[]
  acConfigs: AcConfigDraft[]
}, t: TFunction): string | null {
  const ta = args.attrs.map(a => ({ key: a.key.trim(), name: a.name.trim() }))
  if (ta.some(a => !a.key || !a.name)) return t('campaign:allAttributesNeedKeyName')
  const ve = validateCoreResources(args.coreResources, t)
  if (ve) return ve
  for (const p of args.profiles) {
    if (p.targetMode === 'SELECTED_SKILLS' && (p.targetSkillIds?.length ?? 0) === 0) {
      return t('campaign:profileSelectedSkillsError', { name: p.name || t('campaign:unnamed') })
    }
  }
  const acVe = validateAcConfigs(args.acConfigs, t)
  if (acVe) return acVe
  return null
}

function validateAcConfigs(acConfigs: AcConfigDraft[], t: TFunction): string | null {
  const acNames = acConfigs.filter(ac => ac.enabled && ac.name.trim()).map(ac => ac.name.trim().toLowerCase())
  if (new Set(acNames).size !== acNames.length) return t('campaign:acNamesMustBeUnique')
  for (const ac of acConfigs) {
    if (!ac.enabled || !ac.name.trim()) continue
    for (const f of ac.fields) {
      if (f.name.trim() && !f.key.trim()) {
        return t('campaign:acEmptyKeyError', { name: ac.name.trim() })
      }
    }
  }
  return null
}

interface SkillModifierProfileDraft {
  name: string
  targetMode?: string
  targetSkillIds?: string[]
  options: { label: string; value: number }[]
}
interface TemplateSkillDraft {
  name: string
  description: string
  attributeId: string
  allowedAttributeIds: string[]
  defaultAttributeId: string
}

function tabPillClass(activeTab: string, target: string): string {
  return `tab-pill ${activeTab === target ? 'tab-pill-active' : ''}`
}

function withAddedAcField(ac: AcConfigDraft): AcConfigDraft {
  return { ...ac, fields: [...ac.fields, { name: '', key: '', defaultValue: '0', editableByPlayer: false, description: '' }] }
}

function withRemovedAcField(ac: AcConfigDraft, fieldIdx: number): AcConfigDraft {
  return { ...ac, fields: ac.fields.filter((_, j) => j !== fieldIdx) }
}

function withUpdatedAcField(ac: AcConfigDraft, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string): AcConfigDraft {
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

function withUpdatedAcFieldEditable(ac: AcConfigDraft, fieldIdx: number, v: boolean): AcConfigDraft {
  return { ...ac, fields: ac.fields.map((field, j) => (j === fieldIdx ? { ...field, editableByPlayer: v } : field)) }
}

function withToggledAcAttributeId(ac: AcConfigDraft, attrId: string): AcConfigDraft {
  const exists = ac.attributeModifiers.some(am => am.attributeId === attrId)
  return {
    ...ac,
    attributeModifiers: exists
      ? ac.attributeModifiers.filter(am => am.attributeId !== attrId)
      : [...ac.attributeModifiers, { attributeId: attrId, allowPlayerSelection: false, defaultAttributeId: attrId }],
  }
}

function withUpdatedAcAttributeModifier(ac: AcConfigDraft, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>): AcConfigDraft {
  return { ...ac, attributeModifiers: ac.attributeModifiers.map(am => (am.attributeId === attrId ? { ...am, ...patch } : am)) }
}

function withRemovedProfileOption(a: SkillModifierProfileDraft, oIdx: number): SkillModifierProfileDraft {
  return { ...a, options: a.options.filter((_, j) => j !== oIdx) }
}

function withUpdatedProfileOption(a: SkillModifierProfileDraft, oIdx: number, f: 'label' | 'value', v: string | number): SkillModifierProfileDraft {
  return { ...a, options: a.options.map((o, j) => (j === oIdx ? { ...o, [f]: f === 'value' ? Number(v) : v } : o)) }
}

function withToggledProfileSkill(a: SkillModifierProfileDraft, skillId: string): SkillModifierProfileDraft {
  const current = a.targetSkillIds ?? []
  return { ...a, targetSkillIds: current.includes(skillId) ? current.filter(x => x !== skillId) : [...current, skillId] }
}

function withToggledSkillAllowedAttr(s: TemplateSkillDraft, attrKey: string): TemplateSkillDraft {
  return { ...s, allowedAttributeIds: s.allowedAttributeIds.includes(attrKey) ? s.allowedAttributeIds.filter(k => k !== attrKey) : [...s.allowedAttributeIds, attrKey] }
}

function resolveAllowedAttributeKeys(allowedIds: string[] | undefined, attributes: Template['attributes']): string[] {
  return (allowedIds || []).map((x: string) => {
    const a = attributes.find(attr => attr.id === x)
    return a?.key ?? ''
  }).filter(Boolean)
}

export default function AdventureDetailPage() {
  const router = useRouter(); const params = useParams(); const id = params.id as string
  const { user } = useAuth()
  const { t } = useTranslation()
  const [adventure, setAdventure] = useState<Adventure | null>(null); const [fetching, setFetching] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [editing, setEditing] = useState(false); const [editName, setEditName] = useState(''); const [editCampaign, setEditCampaign] = useState(''); const [editSynopsis, setEditSynopsis] = useState(''); const [editMaxPlayers, setEditMaxPlayers] = useState(4); const [editSessionWeekday, setEditSessionWeekday] = useState(''); const [editSessionTime, setEditSessionTime] = useState(''); const [editSessionType, setEditSessionType] = useState(''); const [editError, setEditError] = useState<string | null>(null); const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false); const [deleting, setDeleting] = useState(false); const [deleteError, setDeleteError] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([]); const [showMembers, setShowMembers] = useState(false)
  const [showInvite, setShowInvite] = useState(false); const [inviteEmail, setInviteEmail] = useState(''); const [inviteError, setInviteError] = useState<string | null>(null); const [inviteSending, setInviteSending] = useState(false); const [inviteLink, setInviteLink] = useState<string | null>(null); const [invitations, setInvitations] = useState<Invitation[]>([])

  const [templates, setTemplates] = useState<Template[]>([])
  const [showNewTemplate, setShowNewTemplate] = useState(false); const [newTemplateName, setNewTemplateName] = useState(''); const [newTemplateDescription, setNewTemplateDescription] = useState('')
  const [newTemplateAttrs, setNewTemplateAttrs] = useState<{ key: string; name: string }[]>([])
  const [newAttrModifierFormula, setNewAttrModifierFormula] = useState('')
  const [newSkillFormula, setNewSkillFormula] = useState('')
  const [newTemplateFields, setNewTemplateFields] = useState<{ key: string; label: string }[]>([])
  const [templateCreating, setTemplateCreating] = useState(false); const [templateError, setTemplateError] = useState<string | null>(null)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null); const [editTemplateName, setEditTemplateName] = useState(''); const [editTemplateDescription, setEditTemplateDescription] = useState('')
  const [editTemplateAttrs, setEditTemplateAttrs] = useState<{ id?: string; key: string; name: string }[]>([])
  const [editAttrModifierFormula, setEditAttrModifierFormula] = useState('')
  const [editSkillFormula, setEditSkillFormula] = useState('')
  const [editTemplateFields, setEditTemplateFields] = useState<{ key: string; label: string }[]>([])
  const [newTemplateSkills, setNewTemplateSkills] = useState<{ name: string; description: string; attributeId: string; allowedAttributeIds: string[]; defaultAttributeId: string }[]>([]); const [editTemplateSkills, setEditTemplateSkills] = useState<{ name: string; description: string; attributeId: string; allowedAttributeIds: string[]; defaultAttributeId: string }[]>([]); const [templateSaving, setTemplateSaving] = useState(false)
  const [newTemplateProfiles, setNewTemplateProfiles] = useState<{ name: string; targetMode?: string; targetSkillIds?: string[]; options: { label: string; value: number }[] }[]>([]); const [editTemplateProfiles, setEditTemplateProfiles] = useState<{ name: string; targetMode?: string; targetSkillIds?: string[]; options: { label: string; value: number }[] }[]>([])
  const [newCoreResources, setNewCoreResources] = useState<CoreResource[]>([]); const [editCoreResources, setEditCoreResources] = useState<CoreResource[]>([])
  const [newAttrModifiersEnabled, setNewAttrModifiersEnabled] = useState(true)
  const [newAcConfigs, setNewAcConfigs] = useState<AcConfigDraft[]>([])
  const [editAcConfigs, setEditAcConfigs] = useState<AcConfigDraft[]>([])
  const [editAttrModifiersEnabled, setEditAttrModifiersEnabled] = useState(true)
  const [newCharacterSections, setNewCharacterSections] = useState<{ id?: string; name: string }[]>([])
  const [editCharacterSections, setEditCharacterSections] = useState<{ id?: string; name: string }[]>([])
  const [newResistances, setNewResistances] = useState<ResistanceDef[]>([])
  const [editResistances, setEditResistances] = useState<ResistanceDef[]>([])
  const [newFeatureSkills, setNewFeatureSkills] = useState(true)
  const [editFeatureSkills, setEditFeatureSkills] = useState(true)
  const [newFeatureCustomFields, setNewFeatureCustomFields] = useState(true)
  const [editFeatureCustomFields, setEditFeatureCustomFields] = useState(true)
  const [newFeatureCoreResources, setNewFeatureCoreResources] = useState(true)
  const [editFeatureCoreResources, setEditFeatureCoreResources] = useState(true)
  const [newFeatureArmorClass, setNewFeatureArmorClass] = useState(true)
  const [editFeatureArmorClass, setEditFeatureArmorClass] = useState(true)
  const [newFeatureCharacterSections, setNewFeatureCharacterSections] = useState(true)
  const [editFeatureCharacterSections, setEditFeatureCharacterSections] = useState(true)
  const [newFeatureSkillProfiles, setNewFeatureSkillProfiles] = useState(true)
  const [editFeatureSkillProfiles, setEditFeatureSkillProfiles] = useState(true)
  const [newFeatureResistance, setNewFeatureResistance] = useState(true)
  const [editFeatureResistance, setEditFeatureResistance] = useState(true)
  const [newIsPublic, setNewIsPublic] = useState(false)

  function addNewCharacterSection() { setNewCharacterSections(p => [...p, { name: '' }]) }
  function removeNewCharacterSection(i: number) { setNewCharacterSections(p => p.filter((_, j) => j !== i)) }
  function updateNewCharacterSection(i: number, v: string) { setNewCharacterSections(p => p.map((n, j) => j === i ? { ...n, name: v } : n)) }
  function addEditCharacterSection() { setEditCharacterSections(p => [...p, { name: '' }]) }
  function removeEditCharacterSection(i: number) { setEditCharacterSections(p => p.filter((_, j) => j !== i)) }
  function updateEditCharacterSection(i: number, v: string) { setEditCharacterSections(p => p.map((n, j) => j === i ? { ...n, name: v } : n)) }

  // Multi-AC helpers
  function addNewAcConfig() { setNewAcConfigs(p => [...p, emptyAcConfig()]) }
  function removeNewAcConfig(i: number) { setNewAcConfigs(p => p.filter((_, j) => j !== i)) }
  function updateNewAcConfig(i: number, patch: Partial<AcConfigDraft>) { setNewAcConfigs(p => p.map((ac, j) => j === i ? { ...ac, ...patch } : ac)) }
  function addNewAcFieldForConfig(configIdx: number) { setNewAcConfigs(p => p.map((ac, i) => i === configIdx ? withAddedAcField(ac) : ac)) }
  function removeNewAcFieldForConfig(configIdx: number, fieldIdx: number) { setNewAcConfigs(p => p.map((ac, i) => i === configIdx ? withRemovedAcField(ac, fieldIdx) : ac)) }
  function updateNewAcFieldForConfig(configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) {
    setNewAcConfigs(p => p.map((ac, i) => i === configIdx ? withUpdatedAcField(ac, fieldIdx, f, v) : ac))
  }
  function updateNewAcFieldEditableForConfig(configIdx: number, fieldIdx: number, v: boolean) { setNewAcConfigs(p => p.map((ac, i) => i === configIdx ? withUpdatedAcFieldEditable(ac, fieldIdx, v) : ac)) }
  function toggleNewAcAttributeIdForConfig(configIdx: number, attrId: string) {
    setNewAcConfigs(p => p.map((ac, i) => i === configIdx ? withToggledAcAttributeId(ac, attrId) : ac))
  }
  function updateNewAcAttributeModifierForConfig(configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) {
    setNewAcConfigs(p => p.map((ac, i) => i === configIdx ? withUpdatedAcAttributeModifier(ac, attrId, patch) : ac))
  }
  function addEditAcConfig() { setEditAcConfigs(p => [...p, emptyAcConfig()]) }
  function removeEditAcConfig(i: number) { setEditAcConfigs(p => p.filter((_, j) => j !== i)) }
  function updateEditAcConfig(i: number, patch: Partial<AcConfigDraft>) { setEditAcConfigs(p => p.map((ac, j) => j === i ? { ...ac, ...patch } : ac)) }
  function addEditAcFieldForConfig(configIdx: number) { setEditAcConfigs(p => p.map((ac, i) => i === configIdx ? withAddedAcField(ac) : ac)) }
  function removeEditAcFieldForConfig(configIdx: number, fieldIdx: number) { setEditAcConfigs(p => p.map((ac, i) => i === configIdx ? withRemovedAcField(ac, fieldIdx) : ac)) }
  function updateEditAcFieldForConfig(configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) {
    setEditAcConfigs(p => p.map((ac, i) => i === configIdx ? withUpdatedAcField(ac, fieldIdx, f, v) : ac))
  }
  function updateEditAcFieldEditableForConfig(configIdx: number, fieldIdx: number, v: boolean) { setEditAcConfigs(p => p.map((ac, i) => i === configIdx ? withUpdatedAcFieldEditable(ac, fieldIdx, v) : ac)) }
  function toggleEditAcAttributeIdForConfig(configIdx: number, attrId: string) {
    setEditAcConfigs(p => p.map((ac, i) => i === configIdx ? withToggledAcAttributeId(ac, attrId) : ac))
  }
  function updateEditAcAttributeModifierForConfig(configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) {
    setEditAcConfigs(p => p.map((ac, i) => i === configIdx ? withUpdatedAcAttributeModifier(ac, attrId, patch) : ac))
  }

  // Clear AC attribute modifiers when attribute modifiers disabled
  useEffect(() => {
    if (!newAttrModifiersEnabled) {
      setNewAcConfigs(p => p.map(ac => ({ ...ac, attributeModifiers: [] })))
    }
  }, [newAttrModifiersEnabled])
  useEffect(() => {
    if (!editAttrModifiersEnabled) {
      setEditAcConfigs(p => p.map(ac => ({ ...ac, attributeModifiers: [] })))
    }
  }, [editAttrModifiersEnabled])

  function addNewCoreResource() { setNewCoreResources(p => [...p, { slug: '', displayName: '', enabled: true, editableByPlayer: true, showNotes: true, color: '' }]) }
  function removeNewCoreResource(i: number) { setNewCoreResources(p => p.filter((_, j) => j !== i)) }
  function updateNewCoreResource(i: number, f: 'displayName' | 'slug' | 'color', v: string) { setNewCoreResources(p => p.map((m, j) => j === i ? { ...m, [f]: v } : m)) }
  function updateNewCoreResourceEnabled(i: number, v: boolean) { setNewCoreResources(p => p.map((m, j) => j === i ? { ...m, enabled: v } : m)) }
  function updateNewCoreResourceEditable(i: number, v: boolean) { setNewCoreResources(p => p.map((m, j) => j === i ? { ...m, editableByPlayer: v } : m)) }
  function updateNewCoreResourceShowNotes(i: number, v: boolean) { setNewCoreResources(p => p.map((m, j) => j === i ? { ...m, showNotes: v } : m)) }
  function addEditCoreResource() { setEditCoreResources(p => [...p, { slug: '', displayName: '', enabled: true, editableByPlayer: true, showNotes: true, color: '' }]) }
  function removeEditCoreResource(i: number) { setEditCoreResources(p => p.filter((_, j) => j !== i)) }
  function updateEditCoreResource(i: number, f: 'displayName' | 'slug' | 'color', v: string) { setEditCoreResources(p => p.map((m, j) => j === i ? { ...m, [f]: v } : m)) }
  function updateEditCoreResourceEnabled(i: number, v: boolean) { setEditCoreResources(p => p.map((m, j) => j === i ? { ...m, enabled: v } : m)) }
  function updateEditCoreResourceEditable(i: number, v: boolean) { setEditCoreResources(p => p.map((m, j) => j === i ? { ...m, editableByPlayer: v } : m)) }
  function updateEditCoreResourceShowNotes(i: number, v: boolean) { setEditCoreResources(p => p.map((m, j) => j === i ? { ...m, showNotes: v } : m)) }
  function addNewProfile() { setNewTemplateProfiles(p => [...p, { name: '', options: [{ label: '', value: 0 }] }]) }
  function removeNewProfile(i: number) { setNewTemplateProfiles(p => p.filter((_, j) => j !== i)) }
  function updateNewProfile(i: number, n: string) { setNewTemplateProfiles(p => p.map((a, j) => j === i ? { ...a, name: n } : a)) }
  function addNewProfileOption(pIdx: number) { setNewTemplateProfiles(p => p.map((a, i) => i === pIdx ? { ...a, options: [...a.options, { label: '', value: 0 }] } : a)) }
  function removeNewProfileOption(pIdx: number, oIdx: number) { setNewTemplateProfiles(p => p.map((a, i) => i === pIdx ? withRemovedProfileOption(a, oIdx) : a)) }
  function updateNewProfileOption(pIdx: number, oIdx: number, f: 'label' | 'value', v: string | number) { setNewTemplateProfiles(p => p.map((a, i) => i === pIdx ? withUpdatedProfileOption(a, oIdx, f, v) : a)) }
  function updateNewProfileTargetMode(i: number, mode: string) { setNewTemplateProfiles(p => p.map((a, j) => j === i ? { ...a, targetMode: mode, targetSkillIds: mode === 'ALL_SKILLS' ? [] : (a.targetSkillIds ?? []) } : a)) }
  function toggleNewProfileSkill(i: number, skillId: string) { setNewTemplateProfiles(p => p.map((a, j) => j === i ? withToggledProfileSkill(a, skillId) : a)) }
  function addEditProfile() { setEditTemplateProfiles(p => [...p, { name: '', options: [{ label: '', value: 0 }] }]) }
  function removeEditProfile(i: number) { setEditTemplateProfiles(p => p.filter((_, j) => j !== i)) }
  function updateEditProfile(i: number, n: string) { setEditTemplateProfiles(p => p.map((a, j) => j === i ? { ...a, name: n } : a)) }
  function updateEditProfileTargetMode(i: number, mode: string) { setEditTemplateProfiles(p => p.map((a, j) => j === i ? { ...a, targetMode: mode, targetSkillIds: mode === 'ALL_SKILLS' ? [] : (a.targetSkillIds ?? []) } : a)) }
  function toggleEditProfileSkill(i: number, skillId: string) { setEditTemplateProfiles(p => p.map((a, j) => j === i ? withToggledProfileSkill(a, skillId) : a)) }
  function addEditProfileOption(pIdx: number) { setEditTemplateProfiles(p => p.map((a, i) => i === pIdx ? { ...a, options: [...a.options, { label: '', value: 0 }] } : a)) }
  function removeEditProfileOption(pIdx: number, oIdx: number) { setEditTemplateProfiles(p => p.map((a, i) => i === pIdx ? withRemovedProfileOption(a, oIdx) : a)) }
  function updateEditProfileOption(pIdx: number, oIdx: number, f: 'label' | 'value', v: string | number) { setEditTemplateProfiles(p => p.map((a, i) => i === pIdx ? withUpdatedProfileOption(a, oIdx, f, v) : a)) }
  function addNewSkillRow() { setNewTemplateSkills(p => [...p, { name: '', description: '', attributeId: '', allowedAttributeIds: [], defaultAttributeId: '' }]) }; function removeNewSkillRow(i: number) { setNewTemplateSkills(p => p.filter((_, j) => j !== i)) }; function updateNewSkill(i: number, f: string, v: string) { setNewTemplateSkills(p => p.map((s, j) => j === i ? { ...s, [f]: v } : s)) }
  function toggleNewSkillAllowedAttr(i: number, attrKey: string) { setNewTemplateSkills(p => p.map((s, j) => j === i ? withToggledSkillAllowedAttr(s, attrKey) : s)) }
  function addEditSkillRow() { setEditTemplateSkills(p => [...p, { name: '', description: '', attributeId: '', allowedAttributeIds: [], defaultAttributeId: '' }]) }; function removeEditSkillRow(i: number) { setEditTemplateSkills(p => p.filter((_, j) => j !== i)) }; function updateEditSkill(i: number, f: string, v: string) { setEditTemplateSkills(p => p.map((s, j) => j === i ? { ...s, [f]: v } : s)) }
  function toggleEditSkillAllowedAttr(i: number, attrKey: string) { setEditTemplateSkills(p => p.map((s, j) => j === i ? withToggledSkillAllowedAttr(s, attrKey) : s)) }
  const [editingTemplateError, setEditingTemplateError] = useState<string | null>(null)

  // Snapshot attachment state
  const [snapshotData, setSnapshotData] = useState<{
    snapshot: {
      name: string
      description: string | null
      createdAt: string
      attributes: unknown[]
      templateSkills: unknown[]
      templateFields: unknown[]
      skillModifierProfiles: unknown[]
      coreResources: unknown[]
      armorClasses: unknown[]
      characterSections: unknown[]
      resistances: unknown[]
    } | null
    originalTemplateId: string | null
  } | null>(null)
  const [snapshotFetching, setSnapshotFetching] = useState(false)

  const [campaignCharacters, setCampaignCharacters] = useState<CampaignCharacter[]>([]); const [showCharacters, setShowCharacters] = useState(false)
  const [showNewCharForm, setShowNewCharForm] = useState(false); const [newCharName, setNewCharName] = useState(''); const [newCharError, setNewCharError] = useState<string | null>(null); const [newCharCreating, setNewCharCreating] = useState(false)
  const [showLinkCharForm, setShowLinkCharForm] = useState(false); const [userSheets, setUserSheets] = useState<UserSheet[]>([]); const [linkSheetId, setLinkSheetId] = useState(''); const [linkCharError, setLinkCharError] = useState<string | null>(null); const [linkCharLinking, setLinkCharLinking] = useState(false)
  const [showNpcsMobs, setShowNpcsMobs] = useState(false)

  const [npcRefreshKey, setNpcRefreshKey] = useState(0)
  const isGM = userRole === 'GM'; const [activeTab, setActiveTab] = useState<'campaign' | 'templates' | 'books'>('campaign')
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [notebookOpen, setNotebookOpen] = useState(false)
  const [showNotebook, setShowNotebook] = useState(false)

  // Public campaigns & join requests
  const [visibilityLoading, setVisibilityLoading] = useState(false)
  const [joinRequests, setJoinRequests] = useState<{ id: string; userId: string; userDisplayName: string | null; message: string | null; status: 'pending' | 'accepted' | 'rejected'; createdAt: string }[]>([])
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false)
  const [processingIds, setProcessingIds] = useState<string[]>([])
  const [templateSource, setTemplateSource] = useState<'attached' | 'campaign' | null>(null)

  const fetchAdventure = useCallback(async () => { try { const d = await api.get<Adventure>(`/adventures/${id}`); setAdventure(d); setTemplateSource((d as any).templateSource ?? null); setEditName(d.name); setEditCampaign(d.campaign); setEditSynopsis(d.synopsis ?? ''); setEditMaxPlayers(d.maxPlayers); setEditSessionWeekday((d as any).sessionWeekday ?? ''); setEditSessionTime((d as any).sessionTime ?? ''); setEditSessionType((d as any).sessionType ?? '') } catch { /* load errors keep the adventure null; session loss is handled centrally by the layout AuthGuard via onAuthFailure */ } finally { setFetching(false) } }, [id])
  const resolveRole = useCallback(async () => { try { const all = await api.get<Array<{ id: string; role: string }>>('/me/adventures'); const e = all.find(a => a.id === id); if (e) setUserRole(e.role) } catch { } }, [id])
  useEffect(() => { fetchAdventure(); resolveRole() }, [fetchAdventure, resolveRole])
  const fetchMembers = useCallback(async () => { try { setMembers(await api.get<Member[]>(`/adventures/${id}/members`)) } catch { } }, [id])
  const fetchInvitations = useCallback(async () => { try { setInvitations(await api.get<Invitation[]>(`/adventures/${id}/invitations`)) } catch { } }, [id])
  const fetchTemplates = useCallback(async () => { try { setTemplates(await api.get<Template[]>(`/adventures/${id}/templates`)) } catch { } }, [id])
  const fetchSnapshot = useCallback(async () => {
    setSnapshotFetching(true)
    try {
      const data = await api.get<{
        snapshot: {
          name: string
          description: string | null
          createdAt: string
          attributes: unknown[]
          templateSkills: unknown[]
          templateFields: unknown[]
          skillModifierProfiles: unknown[]
          coreResources: unknown[]
          armorClasses: unknown[]
          characterSections: unknown[]
          resistances: unknown[]
        } | null
        originalTemplateId: string | null
      }>(`/adventures/${id}/template/snapshot`)
      setSnapshotData(data)
    } catch {
      setSnapshotData(null)
    } finally {
      setSnapshotFetching(false)
    }
  }, [id])
  const fetchJoinRequests = useCallback(async () => {
    setJoinRequestsLoading(true)
    try {
      const data = await api.get<{ id: string; userId: string; user: { id: string; email: string; displayName: string | null }; message: string | null; status: string; createdAt: string }[]>(`/adventures/${id}/join-requests`)
      setJoinRequests(data.map(r => ({
        id: r.id,
        userId: r.userId,
        userDisplayName: r.user.displayName ?? r.user.email,
        message: r.message,
        status: 'pending' as const,
        createdAt: r.createdAt,
      })))
    } catch { /* ignore */ } finally { setJoinRequestsLoading(false) }
  }, [id])
  // Templates + snapshot drive character creation, so fetch them on mount — not
  // only when the Templates tab is opened (otherwise the template would not be
  // available until the tab was clicked).
  useEffect(() => { fetchTemplates(); fetchSnapshot() }, [fetchTemplates, fetchSnapshot])
  useEffect(() => { if (activeTab === 'campaign' && isGM) fetchJoinRequests() }, [activeTab, isGM, fetchJoinRequests])
  const fetchCampaignCharacters = useCallback(async () => { try { setCampaignCharacters(await api.get<CampaignCharacter[]>(`/character-sheets/adventure/${id}`)) } catch { } }, [id])
  const fetchUserSheets = useCallback(async () => { try { const d = await api.get<UserSheet[]>('/character-sheets'); setUserSheets(d.filter(s => s.adventure.id !== id)) } catch { } }, [id])

  function resetNewTemplate() { setShowNewTemplate(false); setNewTemplateName(''); setNewTemplateDescription(''); setNewTemplateAttrs([]); setNewAttrModifierFormula(''); setNewSkillFormula(''); setNewTemplateFields([]); setNewTemplateSkills([]); setNewTemplateProfiles([]); setNewCoreResources([]); setNewAcConfigs([]); setNewResistances([]); setNewIsPublic(false); setNewFeatureSkills(true); setNewFeatureCustomFields(true); setNewFeatureCoreResources(true); setNewFeatureArmorClass(true); setNewFeatureCharacterSections(true); setNewFeatureSkillProfiles(true); setNewFeatureResistance(true); setTemplateError(null) }
  function addNewAttrRow() { setNewTemplateAttrs(p => [...p, { key: '', name: '' }]) }; function removeNewAttrRow(i: number) { setNewTemplateAttrs(p => p.filter((_, j) => j !== i)) }; function updateNewAttr(i: number, f: 'key' | 'name', v: string) { setNewTemplateAttrs(p => p.map((a, j) => j === i ? { ...a, [f]: v } : a)) }
  function addNewFieldRow() { setNewTemplateFields(p => [...p, { key: '', label: '' }]) }; function removeNewFieldRow(i: number) { setNewTemplateFields(p => p.filter((_, j) => j !== i)) }; function updateNewField(i: number, f: 'key' | 'label', v: string) { setNewTemplateFields(p => p.map((a, j) => j === i ? { ...a, [f]: v } : a)) }
  function addEditAttrRow() { setEditTemplateAttrs(p => [...p, { key: '', name: '' }]) }; function removeEditAttrRow(i: number) { setEditTemplateAttrs(p => p.filter((_, j) => j !== i)) }; function updateEditAttr(i: number, f: 'key' | 'name', v: string) { setEditTemplateAttrs(p => p.map((a, j) => j === i ? { ...a, [f]: v } : a)) }
  function addEditFieldRow() { setEditTemplateFields(p => [...p, { key: '', label: '' }]) }; function removeEditFieldRow(i: number) { setEditTemplateFields(p => p.filter((_, j) => j !== i)) }; function updateEditField(i: number, f: 'key' | 'label', v: string) { setEditTemplateFields(p => p.map((a, j) => j === i ? { ...a, [f]: v } : a)) }

  async function handleCreateTemplate(e: SubmitEvent) {
    e.preventDefault(); setTemplateError(null)
    const ve = validateTemplateForm({ attrs: newTemplateAttrs, coreResources: newCoreResources, profiles: newTemplateProfiles, acConfigs: newAcConfigs }, t)
    if (ve) { setTemplateError(ve); return }
    setTemplateCreating(true)
    try {
      await api.post(`/adventures/${id}/templates`, {
        name: newTemplateName.trim(),
        description: newTemplateDescription.trim() || undefined,
        isPublic: newIsPublic,
        ...buildTemplatePayload({
          attributes: newTemplateAttrs, attributeModifiersEnabled: newAttrModifiersEnabled, attributeModifierFormula: newAttrModifierFormula, skillFormula: newSkillFormula,
          templateFields: newTemplateFields, templateSkills: newTemplateSkills, skillModifierProfiles: newTemplateProfiles, coreResources: newCoreResources, acConfigs: newAcConfigs,
          characterSections: newCharacterSections, resistances: newResistances,
          featureSkills: newFeatureSkills, featureCustomFields: newFeatureCustomFields, featureCoreResources: newFeatureCoreResources, featureArmorClass: newFeatureArmorClass,
          featureCharacterSections: newFeatureCharacterSections, featureSkillProfiles: newFeatureSkillProfiles, featureResistance: newFeatureResistance,
        }),
      })
      resetNewTemplate(); fetchTemplates(); fetchAdventure()
    } catch (err) { setTemplateError(err instanceof Error ? err.message : t('campaign:failedToCreateTemplate')) } finally { setTemplateCreating(false) }
  }

  function startEditTemplate(tmpl: Template) {
    setEditingTemplateId(tmpl.id); setEditTemplateName(tmpl.name); setEditTemplateDescription(tmpl.description ?? '');
    setEditTemplateAttrs(tmpl.attributes.map(a => ({ id: a.id, key: a.key, name: a.name })));
    setEditAttrModifiersEnabled((tmpl as any).attributeModifiersEnabled ?? true);
    setEditAttrModifierFormula(tmpl.attributeModifierFormula ?? '');
    setEditSkillFormula(tmpl.skillFormula ?? '');
    setEditTemplateFields((tmpl.templateFields || []).map(f => ({ key: f.key, label: f.label })));
    setEditTemplateSkills((tmpl.templateSkills || []).map(s => ({
      name: s.name,
      description: s.description ?? '',
      attributeId: s.attribute?.key ?? '',
      allowedAttributeIds: resolveAllowedAttributeKeys(s.allowedAttributeIds, tmpl.attributes),
      defaultAttributeId: s.defaultAttribute?.key ?? (s.attribute?.key ?? ''),
    })));
    setEditTemplateProfiles((tmpl.skillModifierProfiles || []).map(p => ({ name: p.name, targetMode: (p as any).targetMode ?? 'ALL_SKILLS', targetSkillIds: (p as any).targetSkillIds ?? [], options: p.options.map(o => ({ label: o.label, value: o.value })) })));
    setEditCoreResources((tmpl.coreResources || []).map(cr => ({
      slug: cr.slug,
      displayName: cr.displayName ?? cr.slug,
      enabled: cr.enabled ?? true,
      editableByPlayer: cr.editableByPlayer ?? true,
      showNotes: cr.showNotes ?? true,
      color: cr.color ?? '',
    })));
    // Load ALL armor classes from template
    const acConfigs: AcConfigDraft[] = (tmpl.armorClasses || []).map(ac => ({
      name: (ac as any).name ?? t('campaign:acNameFallback'),
      enabled: ac.enabled,
      fields: (ac.fields || []).map(f => ({ name: f.name, key: f.key, defaultValue: f.defaultValue ?? '0', editableByPlayer: f.editableByPlayer, description: f.description ?? '' })),
      attributeModifiers: (ac.attributeModifiers || []).map(am => ({ attributeId: am.attribute.key, allowPlayerSelection: !!am.allowPlayerSelection, defaultAttributeId: am.defaultAttribute?.key ?? am.attribute.key })),
    }))
    setEditAcConfigs(acConfigs)
    setEditCharacterSections((tmpl as any).characterSections?.map((s: any) => ({ id: s.id, name: s.name })) ?? [])
    const tResistances = tmpl.resistances || []
    setEditResistances(tResistances.map(r => ({
      id: r.id,
      name: r.name,
      calculationType: (r.calculationType as 'MANUAL' | 'CALCULATED'),
      components: (r.components || []).map(c => ({ id: c.id, name: c.name, editableByPlayer: c.editableByPlayer, defaultValue: c.defaultValue })),
      attributeModifiers: (r.attributeModifiers || []).map(am => ({ attributeId: am.attributeId, attributeKey: am.attribute?.key || '', attributeName: am.attribute?.name || '', enabled: (am as any).enabled ?? true })),
    })))
    // Derive edit feature toggles from existing data
    setEditFeatureSkills((tmpl.templateSkills?.length ?? 0) > 0)
    setEditFeatureCustomFields((tmpl.templateFields?.length ?? 0) > 0)
    setEditFeatureCoreResources((tmpl.coreResources?.length ?? 0) > 0)
    setEditFeatureArmorClass((tmpl.armorClasses?.length ?? 0) > 0)
    setEditFeatureCharacterSections(((tmpl as any).characterSections?.length ?? 0) > 0)
    setEditFeatureSkillProfiles((tmpl.skillModifierProfiles?.length ?? 0) > 0)
    setEditFeatureResistance((tmpl.resistances?.length ?? 0) > 0)
    setEditingTemplateError(null)
  }
  function cancelEditTemplate() { setEditingTemplateId(null); setEditingTemplateError(null) }

  async function handleUpdateTemplate(e: SubmitEvent) {
    e.preventDefault(); if (!editingTemplateId) { return } setEditingTemplateError(null)
    const ve = validateTemplateForm({ attrs: editTemplateAttrs, coreResources: editCoreResources, profiles: editTemplateProfiles, acConfigs: editAcConfigs }, t)
    if (ve) { setEditingTemplateError(ve); return }
    setTemplateSaving(true)
    try {
      await api.patch(`/adventures/${id}/templates/${editingTemplateId}`, {
        name: editTemplateName.trim(),
        description: editTemplateDescription.trim(),
        ...buildTemplatePayload({
          attributes: editTemplateAttrs, attributeModifiersEnabled: editAttrModifiersEnabled, attributeModifierFormula: editAttrModifierFormula, skillFormula: editSkillFormula,
          templateFields: editTemplateFields, templateSkills: editTemplateSkills, skillModifierProfiles: editTemplateProfiles, coreResources: editCoreResources, acConfigs: editAcConfigs,
          characterSections: editCharacterSections, resistances: editResistances,
          featureSkills: editFeatureSkills, featureCustomFields: editFeatureCustomFields, featureCoreResources: editFeatureCoreResources, featureArmorClass: editFeatureArmorClass,
          featureCharacterSections: editFeatureCharacterSections, featureSkillProfiles: editFeatureSkillProfiles, featureResistance: editFeatureResistance,
        }),
      })
      cancelEditTemplate(); fetchTemplates()
    } catch (err) { setEditingTemplateError(err instanceof Error ? err.message : t('campaign:failedToUpdateTemplate')) } finally { setTemplateSaving(false) }
  }

  async function handleDeleteTemplate(tid: string) { try { await api.delete(`/adventures/${id}/templates/${tid}`); fetchTemplates(); fetchAdventure() } catch { } }
  async function handleTemplateAttached() { fetchSnapshot(); fetchTemplates(); fetchAdventure() }
  async function handleTemplateDetached() { setSnapshotData(null); setTemplateSource(null); fetchAdventure() }
  async function handleCreateCharacter(e: SubmitEvent) {
    e.preventDefault(); setNewCharError(null); if (!newCharName.trim()) { return; } setNewCharCreating(true)
    try { const s = await api.post<{ id: string }>('/character-sheets/from-campaign', { characterName: newCharName.trim(), adventureId: id }); router.push(`/dashboard/character-sheets/${s.id}`) } catch (err) { setNewCharError(err instanceof Error ? err.message : t('campaign:failedToCreateCharacter')) } finally { setNewCharCreating(false) }
  }
  async function handleLinkCharacter(e: SubmitEvent) {
    e.preventDefault(); setLinkCharError(null); if (!linkSheetId) { return } setLinkCharLinking(true)
    try { await api.post(`/character-sheets/${linkSheetId}/link`, { adventureId: id }); setShowLinkCharForm(false); setLinkSheetId(''); fetchCampaignCharacters() } catch (err) { setLinkCharError(err instanceof Error ? err.message : t('campaign:failedToLinkCharacter')) } finally { setLinkCharLinking(false) }
  }
  async function handleRemoveCharacter(sid: string) { try { await api.post(`/character-sheets/${sid}/unlink`); fetchCampaignCharacters() } catch { } }
  async function handleUpdate(e: SubmitEvent) {
    e.preventDefault(); setEditError(null); setSaving(true)
    try { const u = await api.patch<Adventure>(`/adventures/${id}`, { name: editName.trim() || undefined, campaign: editCampaign.trim() || undefined, synopsis: editSynopsis.trim() || undefined, maxPlayers: editMaxPlayers, sessionWeekday: editSessionWeekday || undefined, sessionTime: editSessionTime || undefined, sessionType: editSessionType || undefined }); setAdventure(u); setEditing(false) } catch (err) { setEditError(err instanceof Error ? err.message : t('campaign:failedToUpdate')) } finally { setSaving(false) }
  }
  async function handleDelete() { setDeleteError(null); setDeleting(true); try { await api.delete(`/adventures/${id}`); router.push('/dashboard') } catch (err) { setDeleteError(err instanceof Error ? err.message : t('campaign:failedToDelete')); setDeleting(false); setConfirmDelete(false) } }
  async function handleInviteByEmail(e: SubmitEvent) { e.preventDefault(); setInviteError(null); setInviteSending(true); try { await api.post(`/adventures/${id}/invitations/email`, { email: inviteEmail.trim() }); setInviteEmail(''); fetchInvitations() } catch (err) { setInviteError(err instanceof Error ? err.message : t('campaign:failedToSendInvitation')) } finally { setInviteSending(false) } }
  async function handleInviteByLink() { setInviteError(null); setInviteSending(true); try { const r = await api.post<{ inviteUrl: string }>(`/adventures/${id}/invitations/link`); setInviteLink(r.inviteUrl); fetchInvitations() } catch (err) { setInviteError(err instanceof Error ? err.message : t('campaign:failedToCreateLink')) } finally { setInviteSending(false) } }
  async function handleRevokeInvitation(invId: string) { try { await api.post(`/invitations/${invId}/revoke`); fetchInvitations() } catch { } }
  async function handleRemoveMember(uid: string) { try { await api.delete(`/adventures/${id}/members/${uid}`); fetchMembers() } catch { } }

  async function handleVisibilityToggle() {
    setVisibilityLoading(true)
    try {
      const updated = await api.patch<{ isPublic: boolean }>(`/adventures/${id}/visibility`, { isPublic: !(adventure as any).isPublic })
      setAdventure(prev => prev ? { ...prev, ...updated } : prev)
    } catch { /* ignore */ } finally { setVisibilityLoading(false) }
  }

  async function handleAcceptRequest(requestId: string) {
    setProcessingIds(prev => [...prev, requestId])
    try {
      await api.patch(`/adventures/${id}/join-requests/${requestId}`, { action: 'accept' })
      setJoinRequests(prev => prev.filter(r => r.id !== requestId))
    } catch { /* ignore */ } finally { setProcessingIds(prev => prev.filter(id => id !== requestId)) }
  }

  async function handleRejectRequest(requestId: string) {
    setProcessingIds(prev => [...prev, requestId])
    try {
      await api.patch(`/adventures/${id}/join-requests/${requestId}`, { action: 'reject' })
      setJoinRequests(prev => prev.filter(r => r.id !== requestId))
    } catch { /* ignore */ } finally { setProcessingIds(prev => prev.filter(id => id !== requestId)) }
  }

  if (fetching) return <div className="max-w-5xl mx-auto w-full py-10"><LoadingSkeleton variant="page" /></div>
  if (!adventure) return <div className="max-w-5xl mx-auto w-full py-10"><EmptyState icon="🗺️" title={t('campaign:adventureNotFound')} description={t('campaign:adventureNotFoundDescription')} actionLabel={t('campaign:backToDashboard')} actionHref="/dashboard" /></div>

  const hasSessionInfo = Boolean((adventure as any).sessionWeekday || (adventure as any).sessionTime || (adventure as any).sessionType)

  return (
    <div className="max-w-5xl mx-auto w-full relative">
      {/* Ambient glow */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-gradient-to-b from-accent/5 via-primary/3 to-transparent blur-3xl pointer-events-none" />
      <PageNav crumbs={[{ label: t('common:dashboard'), href: '/dashboard' }, { label: adventure.name }]} />
      <AdventureHeader adventure={adventure} isGM={isGM} userRole={userRole} onEdit={() => setEditing(true)} onDelete={() => setConfirmDelete(true)} />
      {!editing ? (<div className="space-y-6 mt-8">
        <div className="flex items-center justify-between gap-4">
          <nav className="flex gap-1"><button onClick={() => setActiveTab('campaign')} className={tabPillClass(activeTab, 'campaign')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>{t('campaign:campaignTab')}</button><button onClick={() => setActiveTab('books')} className={tabPillClass(activeTab, 'books')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>{t('campaign:booksTab')}</button><button onClick={() => setActiveTab('templates')} className={tabPillClass(activeTab, 'templates')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>{t('campaign:templatesTab')}</button></nav>
        </div>
        <hr className="divider" />
        {activeTab === 'campaign' && (<div className="space-y-6">
          {/* Session Information */}
          {hasSessionInfo ? (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('campaign:sessionInformation')}</h3>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {(adventure as any).sessionWeekday && (
                  <><span className="text-muted">{t('campaign:dayColon')}</span><span>{(adventure as any).sessionWeekday}</span></>
                )}
                {(adventure as any).sessionTime && (
                  <><span className="text-muted">{t('campaign:timeColon')}</span><span>{(adventure as any).sessionTime}</span></>
                )}
                {(adventure as any).sessionType && (
                  <><span className="text-muted">{t('campaign:formatColon')}</span><span>{(adventure as any).sessionType === 'ONLINE' ? t('campaign:online') : t('campaign:inPerson')}</span></>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted italic">{t('campaign:sessionScheduleNotDefined')}</p>
          )}

          <CollapsibleSection title={t('campaign:partyMembers')} accent expanded={showMembers} onToggle={() => { setShowMembers(!showMembers); if (!showMembers) { fetchMembers(); if (isGM) fetchInvitations() } }}>
            {members.length === 0 ? <LoadingSkeleton variant="list" /> : <div className="space-y-2">{members.map(m => <MemberRow key={m.id} member={m} isGM={isGM} isSelf={m.user.id === user?.id} onRemove={() => handleRemoveMember(m.user.id)} />)}</div>}
          </CollapsibleSection>
          {isGM && <CollapsibleSection title={t('campaign:invitePlayers')} accent expanded={showInvite} onToggle={() => setShowInvite(!showInvite)}>
            <InvitePanel inviteEmail={inviteEmail} inviteLink={inviteLink} inviteError={inviteError} inviteSending={inviteSending} invitations={invitations} onEmailChange={setInviteEmail} onInviteByEmail={handleInviteByEmail} onInviteByLink={handleInviteByLink} onRevoke={handleRevokeInvitation} />
          </CollapsibleSection>}
          <CollapsibleSection title={t('campaign:characters')} accent expanded={showCharacters} onToggle={() => { setShowCharacters(!showCharacters); if (!showCharacters) { fetchCampaignCharacters(); fetchUserSheets() } }}>
            <CharactersSection characters={campaignCharacters} isGM={isGM} userId={user?.id ?? ''} snapshotName={snapshotData?.snapshot?.name ?? templates[0]?.name ?? null} userSheets={userSheets} showNewCharForm={showNewCharForm} showLinkCharForm={showLinkCharForm} newCharName={newCharName} newCharError={newCharError} newCharCreating={newCharCreating} linkSheetId={linkSheetId} linkCharError={linkCharError} linkCharLinking={linkCharLinking} onNewCharClick={() => { setShowNewCharForm(true); setShowLinkCharForm(false) }} onLinkCharClick={() => { setShowLinkCharForm(true); setShowNewCharForm(false); fetchUserSheets() }} onCancelNewChar={() => { setShowNewCharForm(false); setNewCharName(''); setNewCharError(null) }} onCancelLinkChar={() => { setShowLinkCharForm(false); setLinkSheetId(''); setLinkCharError(null) }} onCreateCharacter={handleCreateCharacter} onLinkCharacter={handleLinkCharacter} onNewCharNameChange={setNewCharName} onLinkSheetChange={setLinkSheetId} onRemoveCharacter={handleRemoveCharacter} onViewCharacter={sid => router.push(`/dashboard/character-sheets/${sid}`)} />
          </CollapsibleSection>
          {isGM && (
            <>
              <CollapsibleSection title={t('campaign:npcsAndMobs')} accent expanded={showNpcsMobs} onToggle={() => setShowNpcsMobs(!showNpcsMobs)}>
                <NpcsMobsSection adventureId={id} isGM={isGM} refreshKey={npcRefreshKey} />
              </CollapsibleSection>
              <CollapsibleSection title={t('campaign:campaignNotebook')} accent expanded={showNotebook} onToggle={() => setShowNotebook(!showNotebook)}>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('campaign:notebookPrivacyNote')}
                </p>
                <button
                  type="button"
                  onClick={() => setNotebookOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {t('campaign:openNotebook')}
                </button>
              </CollapsibleSection>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('campaign:publishing')}</h3>
                <VisibilityToggle
                  isPublic={(adventure as any).isPublic ?? false}
                  loading={visibilityLoading}
                  onToggle={handleVisibilityToggle}
                />
              </div>
              <div className="space-y-4">
                <JoinRequestPanel
                  requests={joinRequests}
                  loading={joinRequestsLoading}
                  onAccept={handleAcceptRequest}
                  onReject={handleRejectRequest}
                  processingIds={processingIds}
                />
              </div>
            </>
          )}
        </div>)}
        {activeTab === 'templates' && (() => {
          const hasCampaignTemplate = templateSource !== null
          return (
          <div className="space-y-4">
            {/* CASE 1 (no template) + CASE 3 (attached): show TemplateAttachmentPanel */}
            {(!hasCampaignTemplate || templateSource === 'attached') && (
              <>
                {snapshotFetching ? (
                  <div className="card !p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <span className="text-xs text-muted">{t('campaign:loadingTemplateSnapshot')}</span>
                    </div>
                  </div>
                ) : (
                  <TemplateAttachmentPanel
                    adventureId={id}
                    originalTemplateId={snapshotData?.originalTemplateId ?? null}
                    templateSnapshot={snapshotData?.snapshot ? {
                      name: snapshotData.snapshot.name,
                      description: snapshotData.snapshot.description,
                      createdAt: snapshotData.snapshot.createdAt,
                      attributeCount: snapshotData.snapshot.attributes?.length ?? 0,
                      skillCount: snapshotData.snapshot.templateSkills?.length ?? 0,
                      fieldCount: snapshotData.snapshot.templateFields?.length ?? 0,
                      profileCount: snapshotData.snapshot.skillModifierProfiles?.length ?? 0,
                      resourceCount: snapshotData.snapshot.coreResources?.length ?? 0,
                      acCount: snapshotData.snapshot.armorClasses?.length ?? 0,
                      sectionCount: snapshotData.snapshot.characterSections?.length ?? 0,
                      resistCount: snapshotData.snapshot.resistances?.length ?? 0,
                    } : null}
                    isGM={isGM}
                    onAttached={handleTemplateAttached}
                    onDetached={handleTemplateDetached}
                  />
                )}
              </>
            )}
            {/* CASE 1 (no template) + CASE 2 (campaign-owned): show TemplatesSection */}
            {(!hasCampaignTemplate || templateSource === 'campaign') && (
              <TemplatesSection templates={templates} isGM={isGM} showNewTemplate={showNewTemplate} hideCreateButton={templateSource === 'campaign'} editingTemplateId={editingTemplateId}
                newTemplateName={newTemplateName} newTemplateDescription={newTemplateDescription} newTemplateAttrs={newTemplateAttrs} newAttrModifierFormula={newAttrModifierFormula} newSkillFormula={newSkillFormula} newTemplateFields={newTemplateFields} templateError={templateError} templateCreating={templateCreating}
                editTemplateName={editTemplateName} editTemplateDescription={editTemplateDescription} editTemplateAttrs={editTemplateAttrs} editAttrModifierFormula={editAttrModifierFormula} editSkillFormula={editSkillFormula} editingTemplateError={editingTemplateError} templateSaving={templateSaving}
                onNewClick={() => setShowNewTemplate(true)} onCancelNew={resetNewTemplate} onCreateTemplate={handleCreateTemplate}
                onNameChange={setNewTemplateName} onDescriptionChange={setNewTemplateDescription} onAddAttr={addNewAttrRow} onRemoveAttr={removeNewAttrRow} onUpdateAttr={updateNewAttr}
                onAddField={addNewFieldRow} onRemoveField={removeNewFieldRow} onUpdateField={updateNewField}
                newTemplateSkills={newTemplateSkills} onAddSkill={addNewSkillRow} onRemoveSkill={removeNewSkillRow} onUpdateSkill={updateNewSkill} onToggleSkillAllowedAttr={toggleNewSkillAllowedAttr}
                onStartEdit={startEditTemplate} onCancelEdit={cancelEditTemplate} onUpdateTemplate={handleUpdateTemplate} onDeleteTemplate={handleDeleteTemplate}
                onEditNameChange={setEditTemplateName} onEditDescriptionChange={setEditTemplateDescription} onAddEditAttr={addEditAttrRow} onRemoveEditAttr={removeEditAttrRow} onUpdateEditAttr={updateEditAttr}
                editTemplateFields={editTemplateFields} onAddEditField={addEditFieldRow} onRemoveEditField={removeEditFieldRow} onUpdateEditField={updateEditField}
                editTemplateSkills={editTemplateSkills} onAddEditSkill={addEditSkillRow} onRemoveEditSkill={removeEditSkillRow} onUpdateEditSkill={updateEditSkill} onToggleEditSkillAllowedAttr={toggleEditSkillAllowedAttr}
                newTemplateProfiles={newTemplateProfiles} editTemplateProfiles={editTemplateProfiles}
                onAddProfile={addNewProfile} onRemoveProfile={removeNewProfile} onUpdateProfile={updateNewProfile} onAddProfileOption={addNewProfileOption} onRemoveProfileOption={removeNewProfileOption} onUpdateProfileOption={updateNewProfileOption} onUpdateProfileTargetMode={updateNewProfileTargetMode} onToggleProfileSkill={toggleNewProfileSkill}
                onAddEditProfile={addEditProfile} onRemoveEditProfile={removeEditProfile} onUpdateEditProfile={updateEditProfile} onAddEditProfileOption={addEditProfileOption} onRemoveEditProfileOption={removeEditProfileOption} onUpdateEditProfileOption={updateEditProfileOption} onUpdateEditProfileTargetMode={updateEditProfileTargetMode} onToggleEditProfileSkill={toggleEditProfileSkill}
                newCoreResources={newCoreResources} editCoreResources={editCoreResources}
                onAddCoreResource={addNewCoreResource} onRemoveCoreResource={removeNewCoreResource} onUpdateCoreResource={updateNewCoreResource}
                onUpdateCoreResourceEnabled={updateNewCoreResourceEnabled} onUpdateCoreResourceEditable={updateNewCoreResourceEditable} onUpdateCoreResourceShowNotes={updateNewCoreResourceShowNotes}
                onAddEditCoreResource={addEditCoreResource} onRemoveEditCoreResource={removeEditCoreResource} onUpdateEditCoreResource={updateEditCoreResource}
                onUpdateEditCoreResourceEnabled={updateEditCoreResourceEnabled} onUpdateEditCoreResourceEditable={updateEditCoreResourceEditable} onUpdateEditCoreResourceShowNotes={updateEditCoreResourceShowNotes}
                newAcConfigs={newAcConfigs}
                onAddNewAcConfig={addNewAcConfig} onRemoveNewAcConfig={removeNewAcConfig} onUpdateNewAcConfig={updateNewAcConfig}
                onAddNewAcFieldForConfig={addNewAcFieldForConfig} onRemoveNewAcFieldForConfig={removeNewAcFieldForConfig}
                onUpdateNewAcFieldForConfig={updateNewAcFieldForConfig} onUpdateNewAcFieldEditableForConfig={updateNewAcFieldEditableForConfig}
                onToggleNewAcAttributeIdForConfig={toggleNewAcAttributeIdForConfig} onUpdateNewAcAttributeModifierForConfig={updateNewAcAttributeModifierForConfig}
                editAcConfigs={editAcConfigs}
                onAddEditAcConfig={addEditAcConfig} onRemoveEditAcConfig={removeEditAcConfig} onUpdateEditAcConfig={updateEditAcConfig}
                onAddEditAcFieldForConfig={addEditAcFieldForConfig} onRemoveEditAcFieldForConfig={removeEditAcFieldForConfig}
                onUpdateEditAcFieldForConfig={updateEditAcFieldForConfig} onUpdateEditAcFieldEditableForConfig={updateEditAcFieldEditableForConfig}
                onToggleEditAcAttributeIdForConfig={toggleEditAcAttributeIdForConfig} onUpdateEditAcAttributeModifierForConfig={updateEditAcAttributeModifierForConfig}
                newAttrModifiersEnabled={newAttrModifiersEnabled}
                onNewAttrModifiersEnabledChange={setNewAttrModifiersEnabled}
                onNewAttrModifierFormulaChange={setNewAttrModifierFormula}
                onNewSkillFormulaChange={setNewSkillFormula}
                editAttrModifiersEnabled={editAttrModifiersEnabled}
                onEditAttrModifiersEnabledChange={setEditAttrModifiersEnabled}
                onEditAttrModifierFormulaChange={setEditAttrModifierFormula}
                onEditSkillFormulaChange={setEditSkillFormula}
                newCharacterSections={newCharacterSections}
                onAddNewCharacterSection={addNewCharacterSection}
                onRemoveNewCharacterSection={removeNewCharacterSection}
                onUpdateNewCharacterSection={updateNewCharacterSection}
                editCharacterSections={editCharacterSections}
                onAddEditCharacterSection={addEditCharacterSection}
                onRemoveEditCharacterSection={removeEditCharacterSection}
                onUpdateEditCharacterSection={updateEditCharacterSection}
                newResistances={newResistances} editResistances={editResistances}
                onNewResistancesChange={setNewResistances}
                onEditResistancesChange={setEditResistances}
                newIsPublic={newIsPublic}
                onNewIsPublicChange={setNewIsPublic}
                newTemplateAttrsForResistance={newTemplateAttrs}
                editTemplateAttrsForResistance={editTemplateAttrs}
                newFeatureSkills={newFeatureSkills} onNewFeatureSkillsChange={setNewFeatureSkills}
                newFeatureCustomFields={newFeatureCustomFields} onNewFeatureCustomFieldsChange={setNewFeatureCustomFields}
                newFeatureCoreResources={newFeatureCoreResources} onNewFeatureCoreResourcesChange={setNewFeatureCoreResources}
                newFeatureArmorClass={newFeatureArmorClass} onNewFeatureArmorClassChange={setNewFeatureArmorClass}
                newFeatureCharacterSections={newFeatureCharacterSections} onNewFeatureCharacterSectionsChange={setNewFeatureCharacterSections}
                newFeatureSkillProfiles={newFeatureSkillProfiles} onNewFeatureSkillProfilesChange={setNewFeatureSkillProfiles}
                newFeatureResistance={newFeatureResistance} onNewFeatureResistanceChange={setNewFeatureResistance}
                editFeatureSkills={editFeatureSkills} onEditFeatureSkillsChange={setEditFeatureSkills}
                editFeatureCustomFields={editFeatureCustomFields} onEditFeatureCustomFieldsChange={setEditFeatureCustomFields}
                editFeatureCoreResources={editFeatureCoreResources} onEditFeatureCoreResourcesChange={setEditFeatureCoreResources}
                editFeatureArmorClass={editFeatureArmorClass} onEditFeatureArmorClassChange={setEditFeatureArmorClass}
                editFeatureCharacterSections={editFeatureCharacterSections} onEditFeatureCharacterSectionsChange={setEditFeatureCharacterSections}
                editFeatureSkillProfiles={editFeatureSkillProfiles} onEditFeatureSkillProfilesChange={setEditFeatureSkillProfiles}
                editFeatureResistance={editFeatureResistance} onEditFeatureResistanceChange={setEditFeatureResistance}
              />
            )}
          </div>
          )
        })()}
        {activeTab === 'books' && (
          <BookListPanel adventureId={id} isGM={isGM} onSelectBook={setSelectedBookId} />
        )}
        {confirmDelete && <DeleteModal name={adventure.name} error={deleteError} loading={deleting} onCancel={() => setConfirmDelete(false)} onConfirm={handleDelete} />}
      </div>) : (<EditForm name={editName} campaign={editCampaign} synopsis={editSynopsis} maxPlayers={editMaxPlayers} sessionWeekday={editSessionWeekday} sessionTime={editSessionTime} sessionType={editSessionType} error={editError} saving={saving} onNameChange={setEditName} onCampaignChange={setEditCampaign} onSynopsisChange={setEditSynopsis} onMaxPlayersChange={setEditMaxPlayers} onSessionWeekdayChange={setEditSessionWeekday} onSessionTimeChange={setEditSessionTime} onSessionTypeChange={setEditSessionType} onCancel={() => { setEditing(false); setEditError(null) }} onSubmit={handleUpdate} />)}

      {/* NPC/Mob Sidebar — fixed right edge, GM-only */}
      {!editing && activeTab === 'campaign' && (
        <CampaignCreatureSidebar
          adventureId={id}
          isGM={isGM}
          onCreaturesChange={() => setNpcRefreshKey(k => k + 1)}
        />
      )}

      {/* Books Sidebar — right-side PDF viewer */}
      <PdfViewerSidebar
        adventureId={id}
        isGM={isGM}
        bookId={selectedBookId}
        onClose={() => setSelectedBookId(null)}
        hideToggle
      />

      {/* Notebook Sidebar — private notes per user per campaign */}
      <NotebookSidebar
        adventureId={id}
        isGM={isGM}
        forceOpen={notebookOpen}
        onClose={() => setNotebookOpen(false)}
        hideToggle
      />
    </div>
  )
}
