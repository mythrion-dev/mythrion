'use client'

import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import Link from 'next/link'
import FormulaBuilder from '@/lib/formula-builder'
import AttributeModifierConfig from '@/lib/attribute-modifier-config'
import SkillCalculationConfig from '@/lib/skill-calculation-config'
import ResistanceSystemConfig from '@/lib/resistance-system-config'
import { PageNav } from '@/lib/breadcrumb'
import MythrionPopover from '@/lib/mythrion-popover'
import { AdventureHeader } from '@/components/adventure/AdventureHeader'
import { CollapsibleSection } from '@/components/adventure/CollapsibleSection'
import { MemberRow } from '@/components/adventure/MemberRow'
import { InvitePanel } from '@/components/adventure/InvitePanel'
import { DeleteModal } from '@/components/adventure/DeleteModal'
import { EditForm } from '@/components/adventure/EditForm'
import { CharactersSection } from '@/components/adventure/CharactersSection'
import { AcConfigList } from '@/components/adventure/AcConfigList'
import { CollapsibleAttrCard } from '@/components/adventure/CollapsibleAttrCard'
import { CollapsibleSkillCard } from '@/components/adventure/CollapsibleSkillCard'

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

interface CoreResource {
  id?: string; slug: string; displayName: string
  enabled: boolean
  editableByPlayer: boolean
  showNotes: boolean
}
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
export interface ArmorClassAttributeModifierDraft {
  attributeId: string
  allowPlayerSelection: boolean
  defaultAttributeId?: string
}
export interface AcConfigDraft {
  name: string
  enabled: boolean
  fields: { name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string }[]
  attributeModifiers: ArmorClassAttributeModifierDraft[]
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
  template: { id: string; name: string }; owner: { id: string; displayName: string | null; email: string }; createdAt: string
}
interface UserSheet {
  id: string; characterName: string; adventure: { id: string; name: string; campaign: string }
  template: { id: string; name: string }; createdAt: string
}

type ResistanceDef = {
  id?: string; name: string; calculationType: 'MANUAL' | 'CALCULATED'; components: { id?: string; name: string; editableByPlayer: boolean; defaultValue: string }[]; attributeModifiers: { attributeId: string; attributeKey: string; attributeName: string; enabled: boolean }[]
}
function emptyResistance(): ResistanceDef { return { name: '', calculationType: 'MANUAL', components: [], attributeModifiers: [] } }

function emptyAcConfig(): AcConfigDraft {
  return { name: '', enabled: true, fields: [], attributeModifiers: [] }
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function AdventureDetailPage() {
  const router = useRouter(); const params = useParams(); const id = params.id as string
  const { user } = useAuth()
  const [adventure, setAdventure] = useState<Adventure | null>(null); const [fetching, setFetching] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [editing, setEditing] = useState(false); const [editName, setEditName] = useState(''); const [editCampaign, setEditCampaign] = useState(''); const [editSynopsis, setEditSynopsis] = useState(''); const [editMaxPlayers, setEditMaxPlayers] = useState(4); const [editError, setEditError] = useState<string | null>(null); const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false); const [deleting, setDeleting] = useState(false); const [deleteError, setDeleteError] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([]); const [showMembers, setShowMembers] = useState(false)
  const [showInvite, setShowInvite] = useState(false); const [inviteEmail, setInviteEmail] = useState(''); const [inviteRole, setInviteRole] = useState<'PLAYER' | 'GM'>('PLAYER'); const [inviteError, setInviteError] = useState<string | null>(null); const [inviteSending, setInviteSending] = useState(false); const [inviteLink, setInviteLink] = useState<string | null>(null); const [invitations, setInvitations] = useState<Invitation[]>([])

  const [templates, setTemplates] = useState<Template[]>([]); const [showTemplates, setShowTemplates] = useState(false)
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
  function addNewAcFieldForConfig(configIdx: number) { setNewAcConfigs(p => p.map((ac, i) => i === configIdx ? { ...ac, fields: [...ac.fields, { name: '', key: '', defaultValue: '0', editableByPlayer: false, description: '' }] } : ac)) }
  function removeNewAcFieldForConfig(configIdx: number, fieldIdx: number) { setNewAcConfigs(p => p.map((ac, i) => i === configIdx ? { ...ac, fields: ac.fields.filter((_, j) => j !== fieldIdx) } : ac)) }
  function updateNewAcFieldForConfig(configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) {
    setNewAcConfigs(p => p.map((ac, i) => {
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
  }
  function updateNewAcFieldEditableForConfig(configIdx: number, fieldIdx: number, v: boolean) { setNewAcConfigs(p => p.map((ac, i) => i === configIdx ? { ...ac, fields: ac.fields.map((field, j) => j === fieldIdx ? { ...field, editableByPlayer: v } : field) } : ac)) }
  function toggleNewAcAttributeIdForConfig(configIdx: number, attrId: string) {
    setNewAcConfigs(p => p.map((ac, i) => {
      if (i !== configIdx) return ac
      const exists = ac.attributeModifiers.some(am => am.attributeId === attrId)
      return {
        ...ac,
        attributeModifiers: exists
          ? ac.attributeModifiers.filter(am => am.attributeId !== attrId)
          : [...ac.attributeModifiers, { attributeId: attrId, allowPlayerSelection: false, defaultAttributeId: attrId }],
      }
    }))
  }
  function updateNewAcAttributeModifierForConfig(configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) {
    setNewAcConfigs(p => p.map((ac, i) => i === configIdx ? { ...ac, attributeModifiers: ac.attributeModifiers.map(am => am.attributeId === attrId ? { ...am, ...patch } : am) } : ac))
  }
  function addEditAcConfig() { setEditAcConfigs(p => [...p, emptyAcConfig()]) }
  function removeEditAcConfig(i: number) { setEditAcConfigs(p => p.filter((_, j) => j !== i)) }
  function updateEditAcConfig(i: number, patch: Partial<AcConfigDraft>) { setEditAcConfigs(p => p.map((ac, j) => j === i ? { ...ac, ...patch } : ac)) }
  function addEditAcFieldForConfig(configIdx: number) { setEditAcConfigs(p => p.map((ac, i) => i === configIdx ? { ...ac, fields: [...ac.fields, { name: '', key: '', defaultValue: '0', editableByPlayer: false, description: '' }] } : ac)) }
  function removeEditAcFieldForConfig(configIdx: number, fieldIdx: number) { setEditAcConfigs(p => p.map((ac, i) => i === configIdx ? { ...ac, fields: ac.fields.filter((_, j) => j !== fieldIdx) } : ac)) }
  function updateEditAcFieldForConfig(configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) {
    setEditAcConfigs(p => p.map((ac, i) => {
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
  }
  function updateEditAcFieldEditableForConfig(configIdx: number, fieldIdx: number, v: boolean) { setEditAcConfigs(p => p.map((ac, i) => i === configIdx ? { ...ac, fields: ac.fields.map((field, j) => j === fieldIdx ? { ...field, editableByPlayer: v } : field) } : ac)) }
  function toggleEditAcAttributeIdForConfig(configIdx: number, attrId: string) {
    setEditAcConfigs(p => p.map((ac, i) => {
      if (i !== configIdx) return ac
      const exists = ac.attributeModifiers.some(am => am.attributeId === attrId)
      return {
        ...ac,
        attributeModifiers: exists
          ? ac.attributeModifiers.filter(am => am.attributeId !== attrId)
          : [...ac.attributeModifiers, { attributeId: attrId, allowPlayerSelection: false, defaultAttributeId: attrId }],
      }
    }))
  }
  function updateEditAcAttributeModifierForConfig(configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) {
    setEditAcConfigs(p => p.map((ac, i) => i === configIdx ? { ...ac, attributeModifiers: ac.attributeModifiers.map(am => am.attributeId === attrId ? { ...am, ...patch } : am) } : ac))
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

  function addNewCoreResource() { setNewCoreResources(p => [...p, { slug: '', displayName: '', enabled: true, editableByPlayer: true, showNotes: true }]) }
  function removeNewCoreResource(i: number) { setNewCoreResources(p => p.filter((_, j) => j !== i)) }
  function updateNewCoreResource(i: number, f: 'displayName' | 'slug', v: string) { setNewCoreResources(p => p.map((m, j) => j === i ? { ...m, [f]: v } : m)) }
  function updateNewCoreResourceEnabled(i: number, v: boolean) { setNewCoreResources(p => p.map((m, j) => j === i ? { ...m, enabled: v } : m)) }
  function updateNewCoreResourceEditable(i: number, v: boolean) { setNewCoreResources(p => p.map((m, j) => j === i ? { ...m, editableByPlayer: v } : m)) }
  function updateNewCoreResourceShowNotes(i: number, v: boolean) { setNewCoreResources(p => p.map((m, j) => j === i ? { ...m, showNotes: v } : m)) }
  function addEditCoreResource() { setEditCoreResources(p => [...p, { slug: '', displayName: '', enabled: true, editableByPlayer: true, showNotes: true }]) }
  function removeEditCoreResource(i: number) { setEditCoreResources(p => p.filter((_, j) => j !== i)) }
  function updateEditCoreResource(i: number, f: 'displayName' | 'slug', v: string) { setEditCoreResources(p => p.map((m, j) => j === i ? { ...m, [f]: v } : m)) }
  function updateEditCoreResourceEnabled(i: number, v: boolean) { setEditCoreResources(p => p.map((m, j) => j === i ? { ...m, enabled: v } : m)) }
  function updateEditCoreResourceEditable(i: number, v: boolean) { setEditCoreResources(p => p.map((m, j) => j === i ? { ...m, editableByPlayer: v } : m)) }
  function updateEditCoreResourceShowNotes(i: number, v: boolean) { setEditCoreResources(p => p.map((m, j) => j === i ? { ...m, showNotes: v } : m)) }
  function addNewProfile() { setNewTemplateProfiles(p => [...p, { name: '', options: [{ label: '', value: 0 }] }]) }
  function removeNewProfile(i: number) { setNewTemplateProfiles(p => p.filter((_, j) => j !== i)) }
  function updateNewProfile(i: number, n: string) { setNewTemplateProfiles(p => p.map((a, j) => j === i ? { ...a, name: n } : a)) }
  function addNewProfileOption(pIdx: number) { setNewTemplateProfiles(p => p.map((a, i) => i === pIdx ? { ...a, options: [...a.options, { label: '', value: 0 }] } : a)) }
  function removeNewProfileOption(pIdx: number, oIdx: number) { setNewTemplateProfiles(p => p.map((a, i) => i === pIdx ? { ...a, options: a.options.filter((_, j) => j !== oIdx) } : a)) }
  function updateNewProfileOption(pIdx: number, oIdx: number, f: 'label' | 'value', v: string | number) { setNewTemplateProfiles(p => p.map((a, i) => i === pIdx ? { ...a, options: a.options.map((o, j) => j === oIdx ? { ...o, [f]: f === 'value' ? Number(v) : v } : o) } : a)) }
  function updateNewProfileTargetMode(i: number, mode: string) { setNewTemplateProfiles(p => p.map((a, j) => j === i ? { ...a, targetMode: mode, targetSkillIds: mode === 'ALL_SKILLS' ? [] : (a.targetSkillIds ?? []) } : a)) }
  function toggleNewProfileSkill(i: number, skillId: string) { setNewTemplateProfiles(p => p.map((a, j) => j === i ? { ...a, targetSkillIds: (a.targetSkillIds ?? []).includes(skillId) ? (a.targetSkillIds ?? []).filter(x => x !== skillId) : [...(a.targetSkillIds ?? []), skillId] } : a)) }
  function addEditProfile() { setEditTemplateProfiles(p => [...p, { name: '', options: [{ label: '', value: 0 }] }]) }
  function removeEditProfile(i: number) { setEditTemplateProfiles(p => p.filter((_, j) => j !== i)) }
  function updateEditProfile(i: number, n: string) { setEditTemplateProfiles(p => p.map((a, j) => j === i ? { ...a, name: n } : a)) }
  function updateEditProfileTargetMode(i: number, mode: string) { setEditTemplateProfiles(p => p.map((a, j) => j === i ? { ...a, targetMode: mode, targetSkillIds: mode === 'ALL_SKILLS' ? [] : (a.targetSkillIds ?? []) } : a)) }
  function toggleEditProfileSkill(i: number, skillId: string) { setEditTemplateProfiles(p => p.map((a, j) => j === i ? { ...a, targetSkillIds: (a.targetSkillIds ?? []).includes(skillId) ? (a.targetSkillIds ?? []).filter(x => x !== skillId) : [...(a.targetSkillIds ?? []), skillId] } : a)) }
  function addEditProfileOption(pIdx: number) { setEditTemplateProfiles(p => p.map((a, i) => i === pIdx ? { ...a, options: [...a.options, { label: '', value: 0 }] } : a)) }
  function removeEditProfileOption(pIdx: number, oIdx: number) { setEditTemplateProfiles(p => p.map((a, i) => i === pIdx ? { ...a, options: a.options.filter((_, j) => j !== oIdx) } : a)) }
  function updateEditProfileOption(pIdx: number, oIdx: number, f: 'label' | 'value', v: string | number) { setEditTemplateProfiles(p => p.map((a, i) => i === pIdx ? { ...a, options: a.options.map((o, j) => j === oIdx ? { ...o, [f]: f === 'value' ? Number(v) : v } : o) } : a)) }
  function addNewSkillRow() { setNewTemplateSkills(p => [...p, { name: '', description: '', attributeId: '', allowedAttributeIds: [], defaultAttributeId: '' }]) }; function removeNewSkillRow(i: number) { setNewTemplateSkills(p => p.filter((_, j) => j !== i)) }; function updateNewSkill(i: number, f: string, v: string) { setNewTemplateSkills(p => p.map((s, j) => j === i ? { ...s, [f]: v } : s)) }
  function toggleNewSkillAllowedAttr(i: number, attrKey: string) { setNewTemplateSkills(p => p.map((s, j) => j === i ? { ...s, allowedAttributeIds: s.allowedAttributeIds.includes(attrKey) ? s.allowedAttributeIds.filter(k => k !== attrKey) : [...s.allowedAttributeIds, attrKey] } : s)) }
  function addEditSkillRow() { setEditTemplateSkills(p => [...p, { name: '', description: '', attributeId: '', allowedAttributeIds: [], defaultAttributeId: '' }]) }; function removeEditSkillRow(i: number) { setEditTemplateSkills(p => p.filter((_, j) => j !== i)) }; function updateEditSkill(i: number, f: string, v: string) { setEditTemplateSkills(p => p.map((s, j) => j === i ? { ...s, [f]: v } : s)) }
  function toggleEditSkillAllowedAttr(i: number, attrKey: string) { setEditTemplateSkills(p => p.map((s, j) => j === i ? { ...s, allowedAttributeIds: s.allowedAttributeIds.includes(attrKey) ? s.allowedAttributeIds.filter(k => k !== attrKey) : [...s.allowedAttributeIds, attrKey] } : s)) }
  const [editingTemplateError, setEditingTemplateError] = useState<string | null>(null)

  const [campaignCharacters, setCampaignCharacters] = useState<CampaignCharacter[]>([]); const [showCharacters, setShowCharacters] = useState(false)
  const [showNewCharForm, setShowNewCharForm] = useState(false); const [newCharName, setNewCharName] = useState(''); const [newCharTemplateId, setNewCharTemplateId] = useState(''); const [newCharError, setNewCharError] = useState<string | null>(null); const [newCharCreating, setNewCharCreating] = useState(false)
  const [showLinkCharForm, setShowLinkCharForm] = useState(false); const [userSheets, setUserSheets] = useState<UserSheet[]>([]); const [linkSheetId, setLinkSheetId] = useState(''); const [linkCharError, setLinkCharError] = useState<string | null>(null); const [linkCharLinking, setLinkCharLinking] = useState(false)

  const isGM = userRole === 'GM'; const [activeTab, setActiveTab] = useState<'campaign' | 'templates'>('campaign')

  const fetchAdventure = useCallback(async () => { try { const d = await api.get<Adventure>(`/adventures/${id}`); setAdventure(d); setEditName(d.name); setEditCampaign(d.campaign); setEditSynopsis(d.synopsis ?? ''); setEditMaxPlayers(d.maxPlayers) } catch (e: unknown) { if ((e as { statusCode?: number }).statusCode === 401 || (e as { statusCode?: number }).statusCode === 403) router.replace('/login') } finally { setFetching(false) } }, [id, router])
  const resolveRole = useCallback(async () => { try { const all = await api.get<Array<{ id: string; role: string }>>('/me/adventures'); const e = all.find(a => a.id === id); if (e) setUserRole(e.role) } catch { } }, [id])
  useEffect(() => { fetchAdventure(); resolveRole() }, [fetchAdventure, resolveRole])
  const fetchMembers = useCallback(async () => { try { setMembers(await api.get<Member[]>(`/adventures/${id}/members`)) } catch { } }, [id])
  const fetchInvitations = useCallback(async () => { try { setInvitations(await api.get<Invitation[]>(`/adventures/${id}/invitations`)) } catch { } }, [id])
  const fetchTemplates = useCallback(async () => { try { setTemplates(await api.get<Template[]>(`/adventures/${id}/templates`)) } catch { } }, [id])
  useEffect(() => { if (activeTab === 'templates') fetchTemplates() }, [activeTab, fetchTemplates])
  const fetchCampaignCharacters = useCallback(async () => { try { setCampaignCharacters(await api.get<CampaignCharacter[]>(`/character-sheets/adventure/${id}`)) } catch { } }, [id])
  const fetchUserSheets = useCallback(async () => { try { const d = await api.get<UserSheet[]>('/character-sheets'); setUserSheets(d.filter(s => s.adventure.id !== id)) } catch { } }, [id])

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

  function resetNewTemplate() { setShowNewTemplate(false); setNewTemplateName(''); setNewTemplateDescription(''); setNewTemplateAttrs([]); setNewAttrModifierFormula(''); setNewSkillFormula(''); setNewTemplateFields([]); setNewTemplateSkills([]); setNewTemplateProfiles([]); setNewCoreResources([]); setNewAcConfigs([]); setNewResistances([]); setNewFeatureSkills(true); setNewFeatureCustomFields(true); setNewFeatureCoreResources(true); setNewFeatureArmorClass(true); setNewFeatureCharacterSections(true); setNewFeatureSkillProfiles(true); setNewFeatureResistance(true); setTemplateError(null) }
  function addNewAttrRow() { setNewTemplateAttrs(p => [...p, { key: '', name: '' }]) }; function removeNewAttrRow(i: number) { setNewTemplateAttrs(p => p.filter((_, j) => j !== i)) }; function updateNewAttr(i: number, f: 'key' | 'name', v: string) { setNewTemplateAttrs(p => p.map((a, j) => j === i ? { ...a, [f]: v } : a)) }
  function addNewFieldRow() { setNewTemplateFields(p => [...p, { key: '', label: '' }]) }; function removeNewFieldRow(i: number) { setNewTemplateFields(p => p.filter((_, j) => j !== i)) }; function updateNewField(i: number, f: 'key' | 'label', v: string) { setNewTemplateFields(p => p.map((a, j) => j === i ? { ...a, [f]: v } : a)) }
  function addEditAttrRow() { setEditTemplateAttrs(p => [...p, { key: '', name: '' }]) }; function removeEditAttrRow(i: number) { setEditTemplateAttrs(p => p.filter((_, j) => j !== i)) }; function updateEditAttr(i: number, f: 'key' | 'name', v: string) { setEditTemplateAttrs(p => p.map((a, j) => j === i ? { ...a, [f]: v } : a)) }
  function addEditFieldRow() { setEditTemplateFields(p => [...p, { key: '', label: '' }]) }; function removeEditFieldRow(i: number) { setEditTemplateFields(p => p.filter((_, j) => j !== i)) }; function updateEditField(i: number, f: 'key' | 'label', v: string) { setEditTemplateFields(p => p.map((a, j) => j === i ? { ...a, [f]: v } : a)) }

  function validateCoreResources(resources: { slug: string }[]) {
    const valid = resources.filter(r => r.slug.trim()); const slugs = new Set<string>()
    for (const r of valid) { const s = r.slug.trim().toLowerCase(); if (slugs.has(s)) return `Duplicate slug: "${s}"`; slugs.add(s) }
    return null
  }

  function buildResistancesPayload(resistances: ResistanceDef[]) {
    return resistances.filter(r => r.name.trim()).map((r, idx) => ({
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
        .filter(am => am.attributeId && am.attributeId.trim())
        .map(am => ({
          attributeId: am.attributeId,
          enabled: am.enabled,
        })),
    }))
  }

  async function handleCreateTemplate(e: FormEvent) {
    e.preventDefault(); setTemplateError(null)
    const ta = newTemplateAttrs.map(a => ({ key: a.key.trim(), name: a.name.trim() }))
    if (ta.some(a => !a.key || !a.name)) { setTemplateError('All attributes must have a key and name'); return }
    const ve = validateCoreResources(newCoreResources); if (ve) { setTemplateError(ve); return }
    for (const p of newTemplateProfiles) { if ((p as any).targetMode === 'SELECTED_SKILLS' && ((p as any).targetSkillIds?.length ?? 0) === 0) { setTemplateError(`Profile "${p.name || 'Unnamed'}" uses "Selected Skills" mode but no skills are selected.`); return } }
    // Validate AC configs have unique names
    const acNames = newAcConfigs.filter(ac => ac.enabled && ac.name.trim()).map(ac => ac.name.trim().toLowerCase())
    if (new Set(acNames).size !== acNames.length) { setTemplateError('Armor Class names must be unique'); return }
    // Validate AC fields have keys
    for (const ac of newAcConfigs) {
      if (!ac.enabled || !ac.name.trim()) continue
      for (const f of ac.fields) {
        if (f.name.trim() && !f.key.trim()) { setTemplateError(`Armor Class "${ac.name.trim()}" has a component with an empty key. Please fill in the Key field or remove the component.`); return }
      }
    }
    setTemplateCreating(true)
    try {
      await api.post(`/adventures/${id}/templates`, {
        name: newTemplateName.trim(), description: newTemplateDescription.trim() || undefined,
        attributeModifiersEnabled: newAttrModifiersEnabled,
        attributeModifierFormula: newAttrModifierFormula.trim() || undefined,
        skillFormula: newSkillFormula.trim() || undefined,
        attributes: ta,
        templateFields: newFeatureCustomFields ? newTemplateFields.filter(f => f.key.trim() && f.label.trim()).map(f => ({ key: f.key.trim(), label: f.label.trim() })) : undefined,
        skills: newFeatureSkills ? newTemplateSkills.filter(s => s.name.trim()).map(s => ({ name: s.name.trim(), description: s.description.trim() || undefined, attributeId: s.attributeId.trim() || undefined, allowedAttributeIds: s.allowedAttributeIds.filter(k => k.trim()), defaultAttributeId: s.defaultAttributeId.trim() || undefined })) : undefined,
        skillModifierProfiles: newFeatureSkillProfiles ? newTemplateProfiles.filter(p => p.name.trim()).map(p => ({ name: p.name.trim(), targetMode: p.targetMode ?? 'ALL_SKILLS', targetSkillIds: p.targetSkillIds ?? [], options: p.options.filter(o => o.label.trim()).map(o => ({ label: o.label.trim(), value: o.value })) })) : undefined,
        coreResources: newFeatureCoreResources ? newCoreResources.filter(r => r.slug.trim()).map(r => ({ displayName: r.displayName.trim() || r.slug.trim(), slug: r.slug.trim(), enabled: r.enabled, editableByPlayer: r.editableByPlayer, showNotes: r.showNotes })) : undefined,
        armorClasses: newFeatureArmorClass ? buildAcPayload(newAcConfigs) : undefined,
        characterSections: newFeatureCharacterSections ? newCharacterSections.filter(s => s.name.trim()).map(s => ({ name: s.name.trim() })) : undefined,
        resistances: newFeatureResistance ? buildResistancesPayload(newResistances) : undefined,
      })
      resetNewTemplate(); fetchTemplates()
    } catch (err) { setTemplateError(err instanceof Error ? err.message : 'Failed to create template') } finally { setTemplateCreating(false) }
  }

  function startEditTemplate(t: Template) {
    setEditingTemplateId(t.id); setEditTemplateName(t.name); setEditTemplateDescription(t.description ?? '');
    setEditTemplateAttrs(t.attributes.map(a => ({ id: a.id, key: a.key, name: a.name })));
    setEditAttrModifiersEnabled((t as any).attributeModifiersEnabled ?? true);
    setEditAttrModifierFormula(t.attributeModifierFormula ?? '');
    setEditSkillFormula(t.skillFormula ?? '');
    setEditTemplateFields((t.templateFields || []).map(f => ({ key: f.key, label: f.label })));
    setEditTemplateSkills((t.templateSkills || []).map(s => ({
      name: s.name,
      description: s.description ?? '',
      attributeId: s.attribute?.key ?? '',
      allowedAttributeIds: (s.allowedAttributeIds || []).map((x: string) => { const a = t.attributes.find(attr => attr.id === x); return a?.key ?? ''; }).filter(Boolean),
      defaultAttributeId: s.defaultAttribute?.key ?? (s.attribute?.key ?? ''),
    })));
    setEditTemplateProfiles((t.skillModifierProfiles || []).map(p => ({ name: p.name, targetMode: (p as any).targetMode ?? 'ALL_SKILLS', targetSkillIds: (p as any).targetSkillIds ?? [], options: p.options.map(o => ({ label: o.label, value: o.value })) })));
    setEditCoreResources((t.coreResources || []).map(cr => ({
      slug: cr.slug,
      displayName: cr.displayName ?? cr.slug,
      enabled: cr.enabled ?? true,
      editableByPlayer: cr.editableByPlayer ?? true,
      showNotes: cr.showNotes ?? true,
    })));
    // Load ALL armor classes from template
    const acConfigs: AcConfigDraft[] = (t.armorClasses || []).map(ac => ({
      name: (ac as any).name ?? 'Armor Class',
      enabled: ac.enabled,
      fields: (ac.fields || []).map(f => ({ name: f.name, key: f.key, defaultValue: f.defaultValue ?? '0', editableByPlayer: f.editableByPlayer, description: f.description ?? '' })),
      attributeModifiers: (ac.attributeModifiers || []).map(am => ({ attributeId: am.attribute.key, allowPlayerSelection: !!am.allowPlayerSelection, defaultAttributeId: am.defaultAttribute?.key ?? am.attribute.key })),
    }))
    setEditAcConfigs(acConfigs)
    setEditCharacterSections((t as any).characterSections?.map((s: any) => ({ id: s.id, name: s.name })) ?? [])
    const tResistances = t.resistances || []
    setEditResistances(tResistances.map(r => ({
      id: r.id,
      name: r.name,
      calculationType: (r.calculationType as 'MANUAL' | 'CALCULATED'),
      components: (r.components || []).map(c => ({ id: c.id, name: c.name, editableByPlayer: c.editableByPlayer, defaultValue: c.defaultValue })),
      attributeModifiers: (r.attributeModifiers || []).map(am => ({ attributeId: am.attributeId, attributeKey: am.attribute?.key || '', attributeName: am.attribute?.name || '', enabled: (am as any).enabled ?? true })),
    })))
    // Derive edit feature toggles from existing data
    setEditFeatureSkills((t.templateSkills?.length ?? 0) > 0)
    setEditFeatureCustomFields((t.templateFields?.length ?? 0) > 0)
    setEditFeatureCoreResources((t.coreResources?.length ?? 0) > 0)
    setEditFeatureArmorClass((t.armorClasses?.length ?? 0) > 0)
    setEditFeatureCharacterSections(((t as any).characterSections?.length ?? 0) > 0)
    setEditFeatureSkillProfiles((t.skillModifierProfiles?.length ?? 0) > 0)
    setEditFeatureResistance((t.resistances?.length ?? 0) > 0)
    setEditingTemplateError(null)
  }
  function cancelEditTemplate() { setEditingTemplateId(null); setEditingTemplateError(null) }

  async function handleUpdateTemplate(e: FormEvent) {
    e.preventDefault(); if (!editingTemplateId) return; setEditingTemplateError(null)
    const ta = editTemplateAttrs.map(a => ({ key: a.key.trim(), name: a.name.trim() }))
    if (ta.some(a => !a.key || !a.name)) { setEditingTemplateError('All attributes must have a key and name'); return }
    const ve = validateCoreResources(editCoreResources); if (ve) { setEditingTemplateError(ve); return }
    for (const p of editTemplateProfiles) { if ((p as any).targetMode === 'SELECTED_SKILLS' && ((p as any).targetSkillIds?.length ?? 0) === 0) { setEditingTemplateError(`Profile "${p.name || 'Unnamed'}" uses "Selected Skills" mode but no skills are selected.`); return } }
    const acNames = editAcConfigs.filter(ac => ac.enabled && ac.name.trim()).map(ac => ac.name.trim().toLowerCase())
    if (new Set(acNames).size !== acNames.length) { setEditingTemplateError('Armor Class names must be unique'); return }
    // Validate AC fields have keys
    for (const ac of editAcConfigs) {
      if (!ac.enabled || !ac.name.trim()) continue
      for (const f of ac.fields) {
        if (f.name.trim() && !f.key.trim()) { setEditingTemplateError(`Armor Class "${ac.name.trim()}" has a component with an empty key. Please fill in the Key field or remove the component.`); return }
      }
    }
    setTemplateSaving(true)
    try {
      await api.patch(`/adventures/${id}/templates/${editingTemplateId}`, {
        name: editTemplateName.trim(), description: editTemplateDescription.trim() || undefined,
        attributeModifiersEnabled: editAttrModifiersEnabled,
        attributeModifierFormula: editAttrModifierFormula.trim() || undefined,
        skillFormula: editSkillFormula.trim() || undefined,
        attributes: ta,
        templateFields: editFeatureCustomFields ? editTemplateFields.filter(f => f.key.trim() && f.label.trim()).map(f => ({ key: f.key.trim(), label: f.label.trim() })) : undefined,
        skills: editFeatureSkills ? editTemplateSkills.filter(s => s.name.trim()).map(s => ({ name: s.name.trim(), description: s.description.trim() || undefined, attributeId: s.attributeId.trim() || undefined, allowedAttributeIds: s.allowedAttributeIds.filter(k => k.trim()), defaultAttributeId: s.defaultAttributeId.trim() || undefined })) : undefined,
        skillModifierProfiles: editFeatureSkillProfiles ? editTemplateProfiles.filter(p => p.name.trim()).map(p => ({ name: p.name.trim(), targetMode: p.targetMode ?? 'ALL_SKILLS', targetSkillIds: p.targetSkillIds ?? [], options: p.options.filter(o => o.label.trim()).map(o => ({ label: o.label.trim(), value: o.value })) })) : undefined,
        coreResources: editFeatureCoreResources ? editCoreResources.filter(r => r.slug.trim()).map(r => ({ displayName: r.displayName.trim() || r.slug.trim(), slug: r.slug.trim(), enabled: r.enabled, editableByPlayer: r.editableByPlayer, showNotes: r.showNotes })) : undefined,
        armorClasses: editFeatureArmorClass ? buildAcPayload(editAcConfigs) : undefined,
        characterSections: editFeatureCharacterSections ? editCharacterSections.filter(s => s.name.trim()).map(s => ({ id: s.id, name: s.name.trim() })) : undefined,
        resistances: editFeatureResistance ? buildResistancesPayload(editResistances) : undefined,
      })
      cancelEditTemplate(); fetchTemplates()
    } catch (err) { setEditingTemplateError(err instanceof Error ? err.message : 'Failed to update template') } finally { setTemplateSaving(false) }
  }

  async function handleDeleteTemplate(tid: string) { try { await api.delete(`/adventures/${id}/templates/${tid}`); fetchTemplates() } catch { } }
  async function handleCreateCharacter(e: FormEvent) {
    e.preventDefault(); setNewCharError(null); if (!newCharName.trim() || !newCharTemplateId) return; setNewCharCreating(true)
    try { const s = await api.post<{ id: string }>('/character-sheets', { characterName: newCharName.trim(), templateId: newCharTemplateId }); router.push(`/dashboard/character-sheets/${s.id}`) } catch (err) { setNewCharError(err instanceof Error ? err.message : 'Failed to create character') } finally { setNewCharCreating(false) }
  }
  async function handleLinkCharacter(e: FormEvent) {
    e.preventDefault(); setLinkCharError(null); if (!linkSheetId) return; setLinkCharLinking(true)
    try { await api.post(`/character-sheets/${linkSheetId}/link`, { adventureId: id }); setShowLinkCharForm(false); setLinkSheetId(''); fetchCampaignCharacters() } catch (err) { setLinkCharError(err instanceof Error ? err.message : 'Failed to link character') } finally { setLinkCharLinking(false) }
  }
  async function handleRemoveCharacter(sid: string) { try { await api.post(`/character-sheets/${sid}/unlink`); fetchCampaignCharacters() } catch { } }
  async function handleUpdate(e: FormEvent) {
    e.preventDefault(); setEditError(null); setSaving(true)
    try { const u = await api.patch<Adventure>(`/adventures/${id}`, { name: editName.trim() || undefined, campaign: editCampaign.trim() || undefined, synopsis: editSynopsis.trim() || undefined, maxPlayers: editMaxPlayers }); setAdventure(u); setEditing(false) } catch (err) { setEditError(err instanceof Error ? err.message : 'Failed to update') } finally { setSaving(false) }
  }
  async function handleDelete() { setDeleteError(null); setDeleting(true); try { await api.delete(`/adventures/${id}`); router.push('/dashboard') } catch (err) { setDeleteError(err instanceof Error ? err.message : 'Failed to delete'); setDeleting(false); setConfirmDelete(false) } }
  async function handleInviteByEmail(e: FormEvent) { e.preventDefault(); setInviteError(null); setInviteSending(true); try { await api.post(`/adventures/${id}/invitations/email`, { email: inviteEmail.trim(), role: inviteRole }); setInviteEmail(''); fetchInvitations() } catch (err) { setInviteError(err instanceof Error ? err.message : 'Failed to send invitation') } finally { setInviteSending(false) } }
  async function handleInviteByLink() { setInviteError(null); setInviteSending(true); try { const r = await api.post<{ inviteUrl: string }>(`/adventures/${id}/invitations/link`, { role: inviteRole }); setInviteLink(r.inviteUrl); fetchInvitations() } catch (err) { setInviteError(err instanceof Error ? err.message : 'Failed to create link') } finally { setInviteSending(false) } }
  async function handleRevokeInvitation(invId: string) { try { await api.post(`/invitations/${invId}/revoke`); fetchInvitations() } catch { } }
  async function handleRemoveMember(uid: string) { try { await api.delete(`/adventures/${id}/members/${uid}`); fetchMembers() } catch { } }

  if (fetching) return <div className="flex items-center justify-center py-20"><div className="flex flex-col items-center gap-3 text-muted-foreground"><div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /><span className="text-sm">Loading...</span></div></div>
  if (!adventure) return <div className="flex items-center justify-center py-20"><div className="text-sm text-muted-foreground">Adventure not found.</div></div>

  return (
    <div className="max-w-3xl mx-auto w-full">
      <PageNav crumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: adventure.name }]} />
      <AdventureHeader adventure={adventure} isGM={isGM} userRole={userRole} onEdit={() => setEditing(true)} onDelete={() => setConfirmDelete(true)} />
      {!editing ? (<div className="space-y-6 mt-6">
        <nav className="flex gap-1"><button onClick={() => setActiveTab('campaign')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'campaign' ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted hover:text-foreground'}`}>Campaign</button><button onClick={() => setActiveTab('templates')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'templates' ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted hover:text-foreground'}`}>Character Sheet Templates</button></nav>
        {activeTab === 'campaign' ? (<>
          <CollapsibleSection title="Party Members" expanded={showMembers} onToggle={() => { setShowMembers(!showMembers); if (!showMembers) { fetchMembers(); if (isGM) fetchInvitations() } }}>
            {members.length === 0 ? <p className="text-sm text-muted-foreground">Loading...</p> : <div className="space-y-2">{members.map(m => <MemberRow key={m.id} member={m} isGM={isGM} isSelf={m.user.id === user?.id} onRemove={() => handleRemoveMember(m.user.id)} />)}</div>}
          </CollapsibleSection>
          {isGM && <CollapsibleSection title="Invite Players" expanded={showInvite} onToggle={() => setShowInvite(!showInvite)}>
            <InvitePanel inviteRole={inviteRole} inviteEmail={inviteEmail} inviteLink={inviteLink} inviteError={inviteError} inviteSending={inviteSending} invitations={invitations} onRoleChange={setInviteRole} onEmailChange={setInviteEmail} onInviteByEmail={handleInviteByEmail} onInviteByLink={handleInviteByLink} onRevoke={handleRevokeInvitation} />
          </CollapsibleSection>}
          <CollapsibleSection title="Characters" expanded={showCharacters} onToggle={() => { setShowCharacters(!showCharacters); if (!showCharacters) { fetchCampaignCharacters(); fetchUserSheets() } }}>
            <CharactersSection characters={campaignCharacters} isGM={isGM} userId={user?.id ?? ''} templates={templates} userSheets={userSheets} showNewCharForm={showNewCharForm} showLinkCharForm={showLinkCharForm} newCharName={newCharName} newCharTemplateId={newCharTemplateId} newCharError={newCharError} newCharCreating={newCharCreating} linkSheetId={linkSheetId} linkCharError={linkCharError} linkCharLinking={linkCharLinking} onNewCharClick={() => { setShowNewCharForm(true); setShowLinkCharForm(false); fetchTemplates() }} onLinkCharClick={() => { setShowLinkCharForm(true); setShowNewCharForm(false); fetchUserSheets() }} onCancelNewChar={() => { setShowNewCharForm(false); setNewCharName(''); setNewCharTemplateId(''); setNewCharError(null) }} onCancelLinkChar={() => { setShowLinkCharForm(false); setLinkSheetId(''); setLinkCharError(null) }} onCreateCharacter={handleCreateCharacter} onLinkCharacter={handleLinkCharacter} onNewCharNameChange={setNewCharName} onNewCharTemplateChange={setNewCharTemplateId} onLinkSheetChange={setLinkSheetId} onRemoveCharacter={handleRemoveCharacter} onViewCharacter={sid => router.push(`/dashboard/character-sheets/${sid}`)} />
          </CollapsibleSection>
        </>) : (
          <TemplatesSection templates={templates} isGM={isGM} showNewTemplate={showNewTemplate} editingTemplateId={editingTemplateId}
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
        {confirmDelete && <DeleteModal name={adventure.name} error={deleteError} loading={deleting} onCancel={() => setConfirmDelete(false)} onConfirm={handleDelete} />}
      </div>) : (<EditForm name={editName} campaign={editCampaign} synopsis={editSynopsis} maxPlayers={editMaxPlayers} error={editError} saving={saving} onNameChange={setEditName} onCampaignChange={setEditCampaign} onSynopsisChange={setEditSynopsis} onMaxPlayersChange={setEditMaxPlayers} onCancel={() => { setEditing(false); setEditError(null) }} onSubmit={handleUpdate} />)}
    </div>
  )
}



function TemplatesSection(props: {
  templates: Template[]; isGM: boolean; showNewTemplate: boolean; editingTemplateId: string | null
  newTemplateName: string; newTemplateDescription: string; newTemplateAttrs: { key: string; name: string }[]; newAttrModifierFormula: string; newSkillFormula: string; newTemplateFields?: { key: string; label: string }[]; templateError: string | null; templateCreating: boolean
  editTemplateName: string; editTemplateDescription: string; editTemplateAttrs: { key: string; name: string }[]; editAttrModifierFormula: string; editSkillFormula: string; editTemplateFields?: { key: string; label: string }[]; editingTemplateError: string | null; templateSaving: boolean
  onNewClick: () => void; onCancelNew: () => void; onCreateTemplate: (e: FormEvent) => void; onNameChange: (v: string) => void; onDescriptionChange: (v: string) => void
  onAddAttr: () => void; onRemoveAttr: (i: number) => void; onUpdateAttr: (i: number, f: 'key' | 'name', v: string) => void
  onAddField?: () => void; onRemoveField?: (i: number) => void; onUpdateField?: (i: number, f: 'key' | 'label', v: string) => void
  onStartEdit: (t: Template) => void; onCancelEdit: () => void; onUpdateTemplate: (e: FormEvent) => void; onDeleteTemplate: (id: string) => void
  onEditNameChange: (v: string) => void; onEditDescriptionChange: (v: string) => void; onAddEditAttr: () => void; onRemoveEditAttr: (i: number) => void; onUpdateEditAttr: (i: number, f: 'key' | 'name', v: string) => void
  onAddEditField?: () => void; onRemoveEditField?: (i: number) => void; onUpdateEditField?: (i: number, f: 'key' | 'label', v: string) => void
  newTemplateSkills?: { name: string; description: string; attributeId: string; allowedAttributeIds: string[]; defaultAttributeId: string }[]
  editTemplateSkills?: { name: string; description: string; attributeId: string; allowedAttributeIds: string[]; defaultAttributeId: string }[]
  onAddSkill?: () => void; onRemoveSkill?: (i: number) => void; onUpdateSkill?: (i: number, f: string, v: string) => void
  onToggleSkillAllowedAttr?: (i: number, attrKey: string) => void
  onAddEditSkill?: () => void; onRemoveEditSkill?: (i: number) => void; onUpdateEditSkill?: (i: number, f: string, v: string) => void
  onToggleEditSkillAllowedAttr?: (i: number, attrKey: string) => void
  newTemplateProfiles?: { name: string; options: { label: string; value: number }[] }[]; editTemplateProfiles?: { name: string; options: { label: string; value: number }[] }[]
  onAddProfile?: () => void; onRemoveProfile?: (i: number) => void; onUpdateProfile?: (i: number, n: string) => void
  onAddProfileOption?: (pIdx: number) => void; onRemoveProfileOption?: (pIdx: number, oIdx: number) => void; onUpdateProfileOption?: (pIdx: number, oIdx: number, f: 'label' | 'value', v: string | number) => void
  onUpdateProfileTargetMode?: (i: number, mode: string) => void; onToggleProfileSkill?: (i: number, skillId: string) => void
  onAddEditProfile?: () => void; onRemoveEditProfile?: (i: number) => void; onUpdateEditProfile?: (i: number, n: string) => void
  onAddEditProfileOption?: (pIdx: number) => void; onRemoveEditProfileOption?: (pIdx: number, oIdx: number) => void; onUpdateEditProfileOption?: (pIdx: number, oIdx: number, f: 'label' | 'value', v: string | number) => void
  onUpdateEditProfileTargetMode?: (i: number, mode: string) => void; onToggleEditProfileSkill?: (i: number, skillId: string) => void
  newCoreResources?: CoreResource[]; editCoreResources?: CoreResource[]
  onAddCoreResource?: () => void; onRemoveCoreResource?: (i: number) => void; onUpdateCoreResource?: (i: number, f: 'displayName' | 'slug', v: string) => void
  onUpdateCoreResourceEnabled?: (i: number, v: boolean) => void; onUpdateCoreResourceEditable?: (i: number, v: boolean) => void; onUpdateCoreResourceShowNotes?: (i: number, v: boolean) => void
  onAddEditCoreResource?: () => void; onRemoveEditCoreResource?: (i: number) => void; onUpdateEditCoreResource?: (i: number, f: 'displayName' | 'slug', v: string) => void
  onUpdateEditCoreResourceEnabled?: (i: number, v: boolean) => void; onUpdateEditCoreResourceEditable?: (i: number, v: boolean) => void; onUpdateEditCoreResourceShowNotes?: (i: number, v: boolean) => void
  newAcConfigs?: AcConfigDraft[]
  onAddNewAcConfig?: () => void; onRemoveNewAcConfig?: (i: number) => void; onUpdateNewAcConfig?: (i: number, patch: Partial<AcConfigDraft>) => void
  onAddNewAcFieldForConfig?: (configIdx: number) => void; onRemoveNewAcFieldForConfig?: (configIdx: number, fieldIdx: number) => void
  onUpdateNewAcFieldForConfig?: (configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) => void; onUpdateNewAcFieldEditableForConfig?: (configIdx: number, fieldIdx: number, v: boolean) => void
  onToggleNewAcAttributeIdForConfig?: (configIdx: number, attrId: string) => void
  onUpdateNewAcAttributeModifierForConfig?: (configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) => void
  editAcConfigs?: AcConfigDraft[]
  onAddEditAcConfig?: () => void; onRemoveEditAcConfig?: (i: number) => void; onUpdateEditAcConfig?: (i: number, patch: Partial<AcConfigDraft>) => void
  onAddEditAcFieldForConfig?: (configIdx: number) => void; onRemoveEditAcFieldForConfig?: (configIdx: number, fieldIdx: number) => void
  onUpdateEditAcFieldForConfig?: (configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) => void; onUpdateEditAcFieldEditableForConfig?: (configIdx: number, fieldIdx: number, v: boolean) => void
  onToggleEditAcAttributeIdForConfig?: (configIdx: number, attrId: string) => void
  onUpdateEditAcAttributeModifierForConfig?: (configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) => void
  newAttrModifiersEnabled?: boolean
  onNewAttrModifiersEnabledChange?: (v: boolean) => void
  onNewAttrModifierFormulaChange?: (v: string) => void
  onNewSkillFormulaChange?: (v: string) => void
  editAttrModifiersEnabled?: boolean
  onEditAttrModifiersEnabledChange?: (v: boolean) => void
  onEditAttrModifierFormulaChange?: (v: string) => void
  onEditSkillFormulaChange?: (v: string) => void
  newCharacterSections?: { id?: string; name: string }[]
  editCharacterSections?: { id?: string; name: string }[]
  onAddNewCharacterSection?: () => void; onRemoveNewCharacterSection?: (i: number) => void; onUpdateNewCharacterSection?: (i: number, v: string) => void
  onAddEditCharacterSection?: () => void; onRemoveEditCharacterSection?: (i: number) => void; onUpdateEditCharacterSection?: (i: number, v: string) => void
  newResistances?: ResistanceDef[]; editResistances?: ResistanceDef[]
  onNewResistancesChange?: (v: ResistanceDef[]) => void
  onEditResistancesChange?: (v: ResistanceDef[]) => void
  newTemplateAttrsForResistance?: { key: string; name: string; id?: string }[]
  editTemplateAttrsForResistance?: { key: string; name: string; id?: string }[]
  // Feature selection toggles
  newFeatureSkills: boolean; onNewFeatureSkillsChange: (v: boolean) => void
  newFeatureCustomFields: boolean; onNewFeatureCustomFieldsChange: (v: boolean) => void
  newFeatureCoreResources: boolean; onNewFeatureCoreResourcesChange: (v: boolean) => void
  newFeatureArmorClass: boolean; onNewFeatureArmorClassChange: (v: boolean) => void
  newFeatureCharacterSections: boolean; onNewFeatureCharacterSectionsChange: (v: boolean) => void
  newFeatureSkillProfiles: boolean; onNewFeatureSkillProfilesChange: (v: boolean) => void
  newFeatureResistance: boolean; onNewFeatureResistanceChange: (v: boolean) => void
  editFeatureSkills: boolean; onEditFeatureSkillsChange: (v: boolean) => void
  editFeatureCustomFields: boolean; onEditFeatureCustomFieldsChange: (v: boolean) => void
  editFeatureCoreResources: boolean; onEditFeatureCoreResourcesChange: (v: boolean) => void
  editFeatureArmorClass: boolean; onEditFeatureArmorClassChange: (v: boolean) => void
  editFeatureCharacterSections: boolean; onEditFeatureCharacterSectionsChange: (v: boolean) => void
  editFeatureSkillProfiles: boolean; onEditFeatureSkillProfilesChange: (v: boolean) => void
  editFeatureResistance: boolean; onEditFeatureResistanceChange: (v: boolean) => void
}) {
  const attrsForNewResistance = props.newTemplateAttrsForResistance || props.newTemplateAttrs || []
  const attrsForEditResistance = props.editTemplateAttrsForResistance || props.editTemplateAttrs || []
  return <div className="space-y-4">
    {props.templates.length === 0 && !props.showNewTemplate ? <div className="text-center py-6 text-muted-foreground text-sm italic">No templates defined yet.{props.isGM && ' Create one below to allow players to build character sheets.'}</div>
      : <div className="space-y-3">{props.templates.map(t => <TemplateRow key={t.id} template={t} isGM={props.isGM} isEditing={props.editingTemplateId === t.id} editName={props.editTemplateName} editDescription={props.editTemplateDescription} editAttrs={props.editTemplateAttrs} editAttrModifierFormula={props.editAttrModifierFormula} editSkillFormula={props.editSkillFormula} editFields={props.editTemplateFields} editSkills={props.editTemplateSkills} editError={props.editingTemplateError} saving={props.templateSaving} onStartEdit={() => props.onStartEdit(t)} onCancelEdit={props.onCancelEdit} onUpdate={props.onUpdateTemplate} onDelete={() => props.onDeleteTemplate(t.id)} onEditNameChange={props.onEditNameChange} onEditDescriptionChange={props.onEditDescriptionChange} onAddAttr={props.onAddEditAttr} onRemoveAttr={props.onRemoveEditAttr} onUpdateAttr={props.onUpdateEditAttr} onAddField={props.onAddEditField} onRemoveField={props.onRemoveEditField} onUpdateField={props.onUpdateEditField} onAddSkill={props.onAddEditSkill} onRemoveSkill={props.onRemoveEditSkill} onUpdateSkill={props.onUpdateEditSkill} onToggleSkillAllowedAttr={props.onToggleEditSkillAllowedAttr} editProfiles={props.editTemplateProfiles} onAddProfile={props.onAddEditProfile} onRemoveProfile={props.onRemoveEditProfile} onUpdateProfile={props.onUpdateEditProfile} onAddProfileOption={props.onAddEditProfileOption} onRemoveProfileOption={props.onRemoveEditProfileOption} onUpdateProfileOption={props.onUpdateEditProfileOption} onUpdateProfileTargetMode={props.onUpdateEditProfileTargetMode} onToggleProfileSkill={props.onToggleEditProfileSkill} editCoreResources={props.editCoreResources} onAddCoreResource={props.onAddEditCoreResource} onRemoveCoreResource={props.onRemoveEditCoreResource} onUpdateCoreResource={props.onUpdateEditCoreResource} onUpdateCoreResourceEnabled={props.onUpdateEditCoreResourceEnabled} onUpdateCoreResourceEditable={props.onUpdateEditCoreResourceEditable} onUpdateCoreResourceShowNotes={props.onUpdateEditCoreResourceShowNotes} editAcConfigs={props.editAcConfigs} editAttrsForAc={props.editTemplateAttrs.filter(a => a.key.trim() && a.name.trim()).map(a => ({ key: a.key.trim(), name: a.name.trim() }))} editAttrModifiersEnabled={props.editAttrModifiersEnabled} onAddEditAcConfig={props.onAddEditAcConfig} onRemoveEditAcConfig={props.onRemoveEditAcConfig} onUpdateEditAcConfig={props.onUpdateEditAcConfig} onAddEditAcFieldForConfig={props.onAddEditAcFieldForConfig} onRemoveEditAcFieldForConfig={props.onRemoveEditAcFieldForConfig} onUpdateEditAcFieldForConfig={props.onUpdateEditAcFieldForConfig} onUpdateEditAcFieldEditableForConfig={props.onUpdateEditAcFieldEditableForConfig} onToggleEditAcAttributeIdForConfig={props.onToggleEditAcAttributeIdForConfig} onUpdateEditAcAttributeModifierForConfig={props.onUpdateEditAcAttributeModifierForConfig} onEditAttrModifiersEnabledChange={props.onEditAttrModifiersEnabledChange} onEditAttrModifierFormulaChange={props.onEditAttrModifierFormulaChange} onEditSkillFormulaChange={props.onEditSkillFormulaChange} editCharacterSections={props.editCharacterSections} onAddEditCharacterSection={props.onAddEditCharacterSection} onRemoveEditCharacterSection={props.onRemoveEditCharacterSection} onUpdateEditCharacterSection={props.onUpdateEditCharacterSection} onEditResistancesChange={props.onEditResistancesChange} editResistances={props.editResistances} attrsForEditResistance={attrsForEditResistance} editFeatureSkills={props.editFeatureSkills} onEditFeatureSkillsChange={props.onEditFeatureSkillsChange} editFeatureCustomFields={props.editFeatureCustomFields} onEditFeatureCustomFieldsChange={props.onEditFeatureCustomFieldsChange} editFeatureCoreResources={props.editFeatureCoreResources} onEditFeatureCoreResourcesChange={props.onEditFeatureCoreResourcesChange} editFeatureArmorClass={props.editFeatureArmorClass} onEditFeatureArmorClassChange={props.onEditFeatureArmorClassChange} editFeatureCharacterSections={props.editFeatureCharacterSections} onEditFeatureCharacterSectionsChange={props.onEditFeatureCharacterSectionsChange} editFeatureSkillProfiles={props.editFeatureSkillProfiles} onEditFeatureSkillProfilesChange={props.onEditFeatureSkillProfilesChange} editFeatureResistance={props.editFeatureResistance} onEditFeatureResistanceChange={props.onEditFeatureResistanceChange} />)}</div>}
    {props.isGM && !props.showNewTemplate && <button onClick={props.onNewClick} className="btn-primary text-sm">+ New Template</button>}
    {props.isGM && props.showNewTemplate && <NewTemplateForm newTemplateName={props.newTemplateName} newTemplateDescription={props.newTemplateDescription} newTemplateAttrs={props.newTemplateAttrs} newAttrModifierFormula={props.newAttrModifierFormula} newSkillFormula={props.newSkillFormula} newTemplateSkills={props.newTemplateSkills} newTemplateProfiles={props.newTemplateProfiles} newTemplateFields={props.newTemplateFields} templateError={props.templateError} templateCreating={props.templateCreating} onNameChange={props.onNameChange} onDescriptionChange={props.onDescriptionChange} onAddAttr={props.onAddAttr} onRemoveAttr={props.onRemoveAttr} onUpdateAttr={props.onUpdateAttr} onAddSkill={props.onAddSkill} onRemoveSkill={props.onRemoveSkill} onUpdateSkill={props.onUpdateSkill} onToggleSkillAllowedAttr={props.onToggleSkillAllowedAttr} onAddProfile={props.onAddProfile} onRemoveProfile={props.onRemoveProfile} onUpdateProfile={props.onUpdateProfile} onAddProfileOption={props.onAddProfileOption} onRemoveProfileOption={props.onRemoveProfileOption} onUpdateProfileOption={props.onUpdateProfileOption} onAddField={props.onAddField} onRemoveField={props.onRemoveField} onUpdateField={props.onUpdateField} onUpdateProfileTargetMode={props.onUpdateProfileTargetMode} onToggleProfileSkill={props.onToggleProfileSkill} onCancelNew={props.onCancelNew} onCreateTemplate={props.onCreateTemplate} newCoreResources={props.newCoreResources} onAddCoreResource={props.onAddCoreResource} onRemoveCoreResource={props.onRemoveCoreResource} onUpdateCoreResource={props.onUpdateCoreResource} onUpdateCoreResourceEnabled={props.onUpdateCoreResourceEnabled} onUpdateCoreResourceEditable={props.onUpdateCoreResourceEditable} onUpdateCoreResourceShowNotes={props.onUpdateCoreResourceShowNotes} newAcConfigs={props.newAcConfigs} newAttrsForAc={props.newTemplateAttrs.filter(a => a.key.trim() && a.name.trim()).map(a => ({ key: a.key.trim(), name: a.name.trim() }))} newAttrModifiersEnabled={props.newAttrModifiersEnabled} onAddNewAcConfig={props.onAddNewAcConfig} onRemoveNewAcConfig={props.onRemoveNewAcConfig} onUpdateNewAcConfig={props.onUpdateNewAcConfig} onAddNewAcFieldForConfig={props.onAddNewAcFieldForConfig} onRemoveNewAcFieldForConfig={props.onRemoveNewAcFieldForConfig} onUpdateNewAcFieldForConfig={props.onUpdateNewAcFieldForConfig} onUpdateNewAcFieldEditableForConfig={props.onUpdateNewAcFieldEditableForConfig} onToggleNewAcAttributeIdForConfig={props.onToggleNewAcAttributeIdForConfig} onUpdateNewAcAttributeModifierForConfig={props.onUpdateNewAcAttributeModifierForConfig} onNewAttrModifiersEnabledChange={props.onNewAttrModifiersEnabledChange} onNewAttrModifierFormulaChange={props.onNewAttrModifierFormulaChange} onNewSkillFormulaChange={props.onNewSkillFormulaChange} newCharacterSections={props.newCharacterSections} onAddNewCharacterSection={props.onAddNewCharacterSection} onRemoveNewCharacterSection={props.onRemoveNewCharacterSection} onUpdateNewCharacterSection={props.onUpdateNewCharacterSection} onNewResistancesChange={props.onNewResistancesChange} newResistances={props.newResistances} attrsForNewResistance={attrsForNewResistance} newFeatureSkills={props.newFeatureSkills} onNewFeatureSkillsChange={props.onNewFeatureSkillsChange} newFeatureCustomFields={props.newFeatureCustomFields} onNewFeatureCustomFieldsChange={props.onNewFeatureCustomFieldsChange} newFeatureCoreResources={props.newFeatureCoreResources} onNewFeatureCoreResourcesChange={props.onNewFeatureCoreResourcesChange} newFeatureArmorClass={props.newFeatureArmorClass} onNewFeatureArmorClassChange={props.onNewFeatureArmorClassChange} newFeatureCharacterSections={props.newFeatureCharacterSections} onNewFeatureCharacterSectionsChange={props.onNewFeatureCharacterSectionsChange} newFeatureSkillProfiles={props.newFeatureSkillProfiles} onNewFeatureSkillProfilesChange={props.onNewFeatureSkillProfilesChange} newFeatureResistance={props.newFeatureResistance} onNewFeatureResistanceChange={props.onNewFeatureResistanceChange} />}
  </div>
}


function NewTemplateForm(props: {
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
      <h4 className="text-sm font-semibold text-primary">Create Template</h4>
      <div><label className="label">Name</label><input className="input-field" value={props.newTemplateName} onChange={e => props.onNameChange(e.target.value)} placeholder="e.g. D&D 5e Character Sheet" maxLength={100} required /></div>
      <div><label className="label">Description <span className="text-muted font-normal">(optional)</span></label><input className="input-field" value={props.newTemplateDescription} onChange={e => props.onDescriptionChange(e.target.value)} placeholder="Brief description of this template" maxLength={200} /></div>
      <div className="rounded-lg border border-border/40 bg-background/20 p-3 space-y-3">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">Choose Features</span>
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
      <div className="flex gap-2 justify-end"><button type="button" onClick={() => setWizardDone(true)} className="btn-primary text-sm">Continue</button></div>
    </div> : <form onSubmit={props.onCreateTemplate} className="rounded-lg border border-primary/20 bg-background/50 p-4 space-y-3">
    <h4 className="text-sm font-semibold text-primary">Create Template</h4>
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

function TemplateRow(props: {
  template: Template; isGM: boolean; isEditing: boolean; editName: string; editDescription: string; editAttrs: { key: string; name: string }[]; editAttrModifierFormula: string; editSkillFormula: string; editFields?: { key: string; label: string }[]; editSkills?: { name: string; description: string; attributeId: string; allowedAttributeIds?: string[]; defaultAttributeId?: string }[]; editError: string | null; saving: boolean
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

  return <div className="flex items-start justify-between py-2.5 px-3 rounded-lg bg-background/50 border border-border"><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-medium text-foreground truncate">{props.template.name}</span><span className="badge badge-gold text-[0.6rem]">{props.template.attributes.length} Attributes</span></div>{props.template.description && <p className="text-xs text-muted mt-0.5 truncate">{props.template.description}</p>}</div>{props.isGM && <div className="flex gap-1 shrink-0 ml-2"><button onClick={props.onStartEdit} className="btn-ghost text-xs px-2 py-1">Edit</button><button onClick={props.onDelete} className="text-xs text-danger hover:text-danger/80 px-2 py-1 transition-colors">Delete</button></div>}</div>
}