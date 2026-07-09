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
  id: string; enabled: boolean; attributeModifiers: TemplateArmorClassAttributeModifier[]; fields: TemplateArmorClassField[]
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
  armorClass?: TemplateArmorClass | null
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

export default function AdventureDetailPage() {
  const router = useRouter(); const params = useParams(); const id = params.id as string
  const { user, loading: authLoading } = useAuth()
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
  const [newAcEnabled, setNewAcEnabled] = useState(false); const [newAcAttributeIds, setNewAcAttributeIds] = useState<string[]>([]); const [newAcFields, setNewAcFields] = useState<{ name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string }[]>([])
  const [editAcEnabled, setEditAcEnabled] = useState(false); const [editAcAttributeIds, setEditAcAttributeIds] = useState<string[]>([]); const [editAcFields, setEditAcFields] = useState<{ name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string }[]>([])
  const [editAttrModifiersEnabled, setEditAttrModifiersEnabled] = useState(true)
  const [newCharacterSections, setNewCharacterSections] = useState<{ id?: string; name: string }[]>([])
  const [editCharacterSections, setEditCharacterSections] = useState<{ id?: string; name: string }[]>([])
  const [newResistances, setNewResistances] = useState<ResistanceDef[]>([])
  const [editResistances, setEditResistances] = useState<ResistanceDef[]>([])

  function addNewCharacterSection() { setNewCharacterSections(p => [...p, { name: '' }]) }
  function removeNewCharacterSection(i: number) { setNewCharacterSections(p => p.filter((_,j) => j!==i)) }
  function updateNewCharacterSection(i: number, v: string) { setNewCharacterSections(p => p.map((n,j) => j===i ? { ...n, name: v } : n)) }
  function addEditCharacterSection() { setEditCharacterSections(p => [...p, { name: '' }]) }
  function removeEditCharacterSection(i: number) { setEditCharacterSections(p => p.filter((_,j) => j!==i)) }
  function updateEditCharacterSection(i: number, v: string) { setEditCharacterSections(p => p.map((n,j) => j===i ? { ...n, name: v } : n)) }
  function addNewAcField() { setNewAcFields(p => [...p, { name: '', key: '', defaultValue: '0', editableByPlayer: false, description: '' }]) }
  function removeNewAcField(i: number) { setNewAcFields(p => p.filter((_,j) => j!==i)) }
  function updateNewAcField(i: number, f: 'name'|'key'|'defaultValue'|'description', v: string) { setNewAcFields(p => p.map((a,j) => j===i ? {...a, [f]: v} : a)) }
  function updateNewAcFieldEditable(i: number, v: boolean) { setNewAcFields(p => p.map((a,j) => j===i ? {...a, editableByPlayer: v} : a)) }
  function toggleNewAcAttributeId(attrId: string) { setNewAcAttributeIds(p => p.includes(attrId) ? p.filter(x => x !== attrId) : [...p, attrId]) }
  function addEditAcField() { setEditAcFields(p => [...p, { name: '', key: '', defaultValue: '0', editableByPlayer: false, description: '' }]) }
  function removeEditAcField(i: number) { setEditAcFields(p => p.filter((_,j) => j!==i)) }
  function updateEditAcField(i: number, f: 'name'|'key'|'defaultValue'|'description', v: string) { setEditAcFields(p => p.map((a,j) => j===i ? {...a, [f]: v} : a)) }
  function updateEditAcFieldEditable(i: number, v: boolean) { setEditAcFields(p => p.map((a,j) => j===i ? {...a, editableByPlayer: v} : a)) }
  function toggleEditAcAttributeId(attrId: string) { setEditAcAttributeIds(p => p.includes(attrId) ? p.filter(x => x !== attrId) : [...p, attrId]) }

  useEffect(() => {
    if (!newAttrModifiersEnabled && newAcAttributeIds.length > 0) setNewAcAttributeIds([])
  }, [newAttrModifiersEnabled, newAcAttributeIds])
  useEffect(() => {
    if (!editAttrModifiersEnabled && editAcAttributeIds.length > 0) setEditAcAttributeIds([])
  }, [editAttrModifiersEnabled, editAcAttributeIds])

  function addNewCoreResource() { setNewCoreResources(p => [...p, { slug: '', displayName: '', enabled: true, editableByPlayer: true, showNotes: true }]) }
  function removeNewCoreResource(i: number) { setNewCoreResources(p => p.filter((_,j) => j!==i)) }
  function updateNewCoreResource(i: number, f: 'displayName'|'slug', v: string) { setNewCoreResources(p => p.map((m,j) => j===i ? {...m,[f]:v} : m)) }
  function updateNewCoreResourceEnabled(i: number, v: boolean) { setNewCoreResources(p => p.map((m,j) => j===i ? {...m, enabled: v} : m)) }
  function updateNewCoreResourceEditable(i: number, v: boolean) { setNewCoreResources(p => p.map((m,j) => j===i ? {...m, editableByPlayer: v} : m)) }
  function updateNewCoreResourceShowNotes(i: number, v: boolean) { setNewCoreResources(p => p.map((m,j) => j===i ? {...m, showNotes: v} : m)) }
  function addEditCoreResource() { setEditCoreResources(p => [...p, { slug: '', displayName: '', enabled: true, editableByPlayer: true, showNotes: true }]) }
  function removeEditCoreResource(i: number) { setEditCoreResources(p => p.filter((_,j) => j!==i)) }
  function updateEditCoreResource(i: number, f: 'displayName'|'slug', v: string) { setEditCoreResources(p => p.map((m,j) => j===i ? {...m,[f]:v} : m)) }
  function updateEditCoreResourceEnabled(i: number, v: boolean) { setEditCoreResources(p => p.map((m,j) => j===i ? {...m, enabled: v} : m)) }
  function updateEditCoreResourceEditable(i: number, v: boolean) { setEditCoreResources(p => p.map((m,j) => j===i ? {...m, editableByPlayer: v} : m)) }
  function updateEditCoreResourceShowNotes(i: number, v: boolean) { setEditCoreResources(p => p.map((m,j) => j===i ? {...m, showNotes: v} : m)) }
  function addNewProfile() { setNewTemplateProfiles(p => [...p, { name: '', options: [{ label: '', value: 0 }] }]) }
  function removeNewProfile(i: number) { setNewTemplateProfiles(p => p.filter((_,j) => j!==i)) }
  function updateNewProfile(i: number, n: string) { setNewTemplateProfiles(p => p.map((a,j) => j===i ? {...a,name:n} : a)) }
  function addNewProfileOption(pIdx: number) { setNewTemplateProfiles(p => p.map((a,i) => i===pIdx ? {...a,options:[...a.options,{label:'',value:0}]} : a)) }
  function removeNewProfileOption(pIdx: number, oIdx: number) { setNewTemplateProfiles(p => p.map((a,i) => i===pIdx ? {...a,options:a.options.filter((_,j)=>j!==oIdx)} : a)) }
  function updateNewProfileOption(pIdx: number, oIdx: number, f: 'label'|'value', v: string|number) { setNewTemplateProfiles(p => p.map((a,i) => i===pIdx ? {...a,options:a.options.map((o,j)=>j===oIdx ? {...o,[f]:f==='value'?Number(v):v} : o)} : a)) }
  function updateNewProfileTargetMode(i: number, mode: string) { setNewTemplateProfiles(p => p.map((a,j) => j===i ? {...a, targetMode: mode, targetSkillIds: mode==='ALL_SKILLS' ? [] : (a.targetSkillIds??[])} : a)) }
  function toggleNewProfileSkill(i: number, skillId: string) { setNewTemplateProfiles(p => p.map((a,j) => j===i ? {...a, targetSkillIds: (a.targetSkillIds??[]).includes(skillId) ? (a.targetSkillIds??[]).filter(x => x !== skillId) : [...(a.targetSkillIds??[]), skillId]} : a)) }
  function addEditProfile() { setEditTemplateProfiles(p => [...p, { name: '', options: [{ label: '', value: 0 }] }]) }
  function removeEditProfile(i: number) { setEditTemplateProfiles(p => p.filter((_,j) => j!==i)) }
  function updateEditProfile(i: number, n: string) { setEditTemplateProfiles(p => p.map((a,j) => j===i ? {...a,name:n} : a)) }
  function updateEditProfileTargetMode(i: number, mode: string) { setEditTemplateProfiles(p => p.map((a,j) => j===i ? {...a, targetMode: mode, targetSkillIds: mode==='ALL_SKILLS' ? [] : (a.targetSkillIds??[])} : a)) }
  function toggleEditProfileSkill(i: number, skillId: string) { setEditTemplateProfiles(p => p.map((a,j) => j===i ? {...a, targetSkillIds: (a.targetSkillIds??[]).includes(skillId) ? (a.targetSkillIds??[]).filter(x => x !== skillId) : [...(a.targetSkillIds??[]), skillId]} : a)) }
  function addEditProfileOption(pIdx: number) { setEditTemplateProfiles(p => p.map((a,i) => i===pIdx ? {...a,options:[...a.options,{label:'',value:0}]} : a)) }
  function removeEditProfileOption(pIdx: number, oIdx: number) { setEditTemplateProfiles(p => p.map((a,i) => i===pIdx ? {...a,options:a.options.filter((_,j)=>j!==oIdx)} : a)) }
  function updateEditProfileOption(pIdx: number, oIdx: number, f: 'label'|'value', v: string|number) { setEditTemplateProfiles(p => p.map((a,i) => i===pIdx ? {...a,options:a.options.map((o,j)=>j===oIdx ? {...o,[f]:f==='value'?Number(v):v} : o)} : a)) }
  function addNewSkillRow() { setNewTemplateSkills(p => [...p, { name: '', description: '', attributeId: '', allowedAttributeIds: [], defaultAttributeId: '' }]) }; function removeNewSkillRow(i: number) { setNewTemplateSkills(p => p.filter((_,j)=>j!==i)) }; function updateNewSkill(i: number, f: string, v: string) { setNewTemplateSkills(p => p.map((s,j)=>j===i?{...s,[f]:v}:s)) }
  function toggleNewSkillAllowedAttr(i: number, attrKey: string) { setNewTemplateSkills(p => p.map((s,j)=>j===i?{...s,allowedAttributeIds: s.allowedAttributeIds.includes(attrKey) ? s.allowedAttributeIds.filter(k=>k!==attrKey) : [...s.allowedAttributeIds, attrKey]} : s)) }
  function addEditSkillRow() { setEditTemplateSkills(p => [...p, { name: '', description: '', attributeId: '', allowedAttributeIds: [], defaultAttributeId: '' }]) }; function removeEditSkillRow(i: number) { setEditTemplateSkills(p => p.filter((_,j)=>j!==i)) }; function updateEditSkill(i: number, f: string, v: string) { setEditTemplateSkills(p => p.map((s,j)=>j===i?{...s,[f]:v}:s)) }
  function toggleEditSkillAllowedAttr(i: number, attrKey: string) { setEditTemplateSkills(p => p.map((s,j)=>j===i?{...s,allowedAttributeIds: s.allowedAttributeIds.includes(attrKey) ? s.allowedAttributeIds.filter(k=>k!==attrKey) : [...s.allowedAttributeIds, attrKey]} : s)) }
  const [editingTemplateError, setEditingTemplateError] = useState<string | null>(null)

  const [campaignCharacters, setCampaignCharacters] = useState<CampaignCharacter[]>([]); const [showCharacters, setShowCharacters] = useState(false)
  const [showNewCharForm, setShowNewCharForm] = useState(false); const [newCharName, setNewCharName] = useState(''); const [newCharTemplateId, setNewCharTemplateId] = useState(''); const [newCharError, setNewCharError] = useState<string | null>(null); const [newCharCreating, setNewCharCreating] = useState(false)
  const [showLinkCharForm, setShowLinkCharForm] = useState(false); const [userSheets, setUserSheets] = useState<UserSheet[]>([]); const [linkSheetId, setLinkSheetId] = useState(''); const [linkCharError, setLinkCharError] = useState<string | null>(null); const [linkCharLinking, setLinkCharLinking] = useState(false)

  const isGM = userRole === 'GM'; const [activeTab, setActiveTab] = useState<'campaign'|'templates'>('campaign')

  const fetchAdventure = useCallback(async () => { try { const d = await api.get<Adventure>(`/adventures/${id}`); setAdventure(d); setEditName(d.name); setEditCampaign(d.campaign); setEditSynopsis(d.synopsis??''); setEditMaxPlayers(d.maxPlayers) } catch(e:unknown) { if((e as {statusCode?:number}).statusCode===401||(e as {statusCode?:number}).statusCode===403) router.replace('/login') } finally { setFetching(false) } }, [id,router])
  const resolveRole = useCallback(async () => { try { const all = await api.get<Array<{id:string;role:string}>>('/me/adventures'); const e = all.find(a=>a.id===id); if(e) setUserRole(e.role) } catch {} }, [id])
  useEffect(() => { if(!authLoading&&!user){router.replace('/login');return}; if(user){fetchAdventure();resolveRole()} }, [authLoading,user,fetchAdventure,resolveRole])
  const fetchMembers = useCallback(async () => { try { setMembers(await api.get<Member[]>(`/adventures/${id}/members`)) } catch {} }, [id])
  const fetchInvitations = useCallback(async () => { try { setInvitations(await api.get<Invitation[]>(`/adventures/${id}/invitations`)) } catch {} }, [id])
  const fetchTemplates = useCallback(async () => { try { setTemplates(await api.get<Template[]>(`/adventures/${id}/templates`)) } catch {} }, [id])
  useEffect(() => { if(activeTab==='templates') fetchTemplates() }, [activeTab,fetchTemplates])
  const fetchCampaignCharacters = useCallback(async () => { try { setCampaignCharacters(await api.get<CampaignCharacter[]>(`/character-sheets/adventure/${id}`)) } catch {} }, [id])
  const fetchUserSheets = useCallback(async () => { try { const d=await api.get<UserSheet[]>('/character-sheets'); setUserSheets(d.filter(s=>s.adventure.id!==id)) } catch {} }, [id])

  function resetNewTemplate() { setShowNewTemplate(false); setNewTemplateName(''); setNewTemplateDescription(''); setNewTemplateAttrs([]); setNewAttrModifierFormula(''); setNewSkillFormula(''); setNewTemplateFields([]); setNewTemplateSkills([]); setNewTemplateProfiles([]); setNewCoreResources([]); setNewResistances([]); setTemplateError(null) }
  function addNewAttrRow() { setNewTemplateAttrs(p => [...p, { key: '', name: '' }]) }; function removeNewAttrRow(i: number) { setNewTemplateAttrs(p => p.filter((_,j)=>j!==i)) }; function updateNewAttr(i: number, f: 'key'|'name', v: string) { setNewTemplateAttrs(p => p.map((a,j)=>j===i?{...a,[f]:v}:a)) }
  function addNewFieldRow() { setNewTemplateFields(p => [...p, { key: '', label: '' }]) }; function removeNewFieldRow(i: number) { setNewTemplateFields(p => p.filter((_,j)=>j!==i)) }; function updateNewField(i: number, f: 'key'|'label', v: string) { setNewTemplateFields(p => p.map((a,j)=>j===i?{...a,[f]:v}:a)) }
  function addEditAttrRow() { setEditTemplateAttrs(p => [...p, { key: '', name: '' }]) }; function removeEditAttrRow(i: number) { setEditTemplateAttrs(p => p.filter((_,j)=>j!==i)) }; function updateEditAttr(i: number, f: 'key'|'name', v: string) { setEditTemplateAttrs(p => p.map((a,j)=>j===i?{...a,[f]:v}:a)) }
  function addEditFieldRow() { setEditTemplateFields(p => [...p, { key: '', label: '' }]) }; function removeEditFieldRow(i: number) { setEditTemplateFields(p => p.filter((_,j)=>j!==i)) }; function updateEditField(i: number, f: 'key'|'label', v: string) { setEditTemplateFields(p => p.map((a,j)=>j===i?{...a,[f]:v}:a)) }

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

  async function handleCreateTemplate(e: FormEvent) { e.preventDefault(); setTemplateError(null)
    const ta = newTemplateAttrs.map(a=>({key:a.key.trim(),name:a.name.trim()}))
    if(ta.some(a=>!a.key||!a.name)){setTemplateError('All attributes must have a key and name');return}
    const ve = validateCoreResources(newCoreResources); if(ve){setTemplateError(ve);return}
    for (const p of newTemplateProfiles) { if ((p as any).targetMode === 'SELECTED_SKILLS' && ((p as any).targetSkillIds?.length ?? 0) === 0) { setTemplateError(`Profile "${p.name || 'Unnamed'}" uses "Selected Skills" mode but no skills are selected.`); return } }
    setTemplateCreating(true)
    try {
      await api.post(`/adventures/${id}/templates`, {
        name: newTemplateName.trim(), description: newTemplateDescription.trim()||undefined,
        attributeModifiersEnabled: newAttrModifiersEnabled,
        attributeModifierFormula: newAttrModifierFormula.trim() || undefined,
        skillFormula: newSkillFormula.trim() || undefined,
        attributes: ta,
        templateFields: newTemplateFields.filter(f=>f.key.trim()&&f.label.trim()).map(f=>({key:f.key.trim(),label:f.label.trim()})),
        skills: newTemplateSkills.filter(s=>s.name.trim()).map(s=>({name:s.name.trim(),description:s.description.trim()||undefined,attributeId:s.attributeId.trim()||undefined,allowedAttributeIds:s.allowedAttributeIds.filter(k=>k.trim()),defaultAttributeId:s.defaultAttributeId.trim()||undefined})),
        skillModifierProfiles: newTemplateProfiles.filter(p=>p.name.trim()).map(p=>({name:p.name.trim(),targetMode:p.targetMode??'ALL_SKILLS',targetSkillIds:p.targetSkillIds??[],options:p.options.filter(o=>o.label.trim()).map(o=>({label:o.label.trim(),value:o.value}))})),
        coreResources: newCoreResources.filter(r=>r.slug.trim()).map(r=>({displayName:r.displayName.trim()||r.slug.trim(), slug:r.slug.trim(), enabled:r.enabled, editableByPlayer:r.editableByPlayer, showNotes:r.showNotes})),
        armorClass: newAcEnabled ? { enabled: true, attributeModifierIds: newAcAttributeIds, fields: newAcFields.filter(f=>f.name.trim()&&f.key.trim()).map(f=>({name:f.name.trim(),key:f.key.trim(),defaultValue:f.defaultValue.trim()||'0',editableByPlayer:f.editableByPlayer,description:f.description.trim()||undefined})) } : undefined,
        characterSections: newCharacterSections.filter(s => s.name.trim()).map(s => ({ name: s.name.trim() })),
        resistances: buildResistancesPayload(newResistances),
      })
      resetNewTemplate(); fetchTemplates()
    } catch(err) { setTemplateError(err instanceof Error ? err.message : 'Failed to create template') } finally { setTemplateCreating(false) }
  }

  function startEditTemplate(t: Template) { setEditingTemplateId(t.id); setEditTemplateName(t.name); setEditTemplateDescription(t.description??'');
    setEditTemplateAttrs(t.attributes.map(a=>({id:a.id,key:a.key,name:a.name})));
    setEditAttrModifiersEnabled((t as any).attributeModifiersEnabled ?? true);
    setEditAttrModifierFormula(t.attributeModifierFormula ?? '');
    setEditSkillFormula(t.skillFormula ?? '');
    setEditTemplateFields((t.templateFields||[]).map(f=>({key:f.key,label:f.label})));
    setEditTemplateSkills((t.templateSkills||[]).map(s=>({
      name:s.name,
      description:s.description??'',
      attributeId:s.attribute?.key??'',
      allowedAttributeIds:(s.allowedAttributeIds||[]).map((x: string) => { const a = t.attributes.find(attr => attr.id === x); return a?.key ?? ''; }).filter(Boolean),
      defaultAttributeId:s.defaultAttribute?.key ?? (s.attribute?.key ?? ''),
    })));
    setEditTemplateProfiles((t.skillModifierProfiles||[]).map(p=>({name:p.name,targetMode:(p as any).targetMode??'ALL_SKILLS',targetSkillIds:(p as any).targetSkillIds??[],options:p.options.map(o=>({label:o.label,value:o.value}))})));
    setEditCoreResources((t.coreResources||[]).map(cr => ({
      slug: cr.slug,
      displayName: cr.displayName ?? cr.slug,
      enabled: cr.enabled ?? true,
      editableByPlayer: cr.editableByPlayer ?? true,
      showNotes: cr.showNotes ?? true,
    })));
    const ac = t.armorClass; if (ac) { setEditAcEnabled(ac.enabled); setEditAcAttributeIds((ac.attributeModifiers ?? []).map(am => am.attribute.key)); setEditAcFields(ac.fields.map(f=>({name:f.name,key:f.key,defaultValue:f.defaultValue??'0',editableByPlayer:f.editableByPlayer,description:f.description??''}))) } else { setEditAcEnabled(false); setEditAcAttributeIds([]); setEditAcFields([]) }
    setEditCharacterSections((t as any).characterSections?.map((s: any) => ({ id: s.id, name: s.name })) ?? [])
    const tResistances = t.resistances || []
    setEditResistances(tResistances.map(r => ({
      id: r.id,
      name: r.name,
      calculationType: (r.calculationType as 'MANUAL' | 'CALCULATED'),
      components: (r.components || []).map(c => ({ id: c.id, name: c.name, editableByPlayer: c.editableByPlayer, defaultValue: c.defaultValue })),
      attributeModifiers: (r.attributeModifiers || []).map(am => ({ attributeId: am.attributeId, attributeKey: am.attribute?.key || '', attributeName: am.attribute?.name || '', enabled: (am as any).enabled ?? true })),
    })))
    setEditingTemplateError(null) }
  function cancelEditTemplate() { setEditingTemplateId(null); setEditingTemplateError(null) }

  async function handleUpdateTemplate(e: FormEvent) { e.preventDefault(); if(!editingTemplateId)return; setEditingTemplateError(null)
    const ta = editTemplateAttrs.map(a=>({key:a.key.trim(),name:a.name.trim()}))
    if(ta.some(a=>!a.key||!a.name)){setEditingTemplateError('All attributes must have a key and name');return}
    const ve = validateCoreResources(editCoreResources); if(ve){setEditingTemplateError(ve);return}
    for (const p of editTemplateProfiles) { if ((p as any).targetMode === 'SELECTED_SKILLS' && ((p as any).targetSkillIds?.length ?? 0) === 0) { setEditingTemplateError(`Profile "${p.name || 'Unnamed'}" uses "Selected Skills" mode but no skills are selected.`); return } }
    setTemplateSaving(true)
    try {
      await api.patch(`/adventures/${id}/templates/${editingTemplateId}`, {
        name: editTemplateName.trim(), description: editTemplateDescription.trim()||undefined,
        attributeModifiersEnabled: editAttrModifiersEnabled,
        attributeModifierFormula: editAttrModifierFormula.trim() || undefined,
        skillFormula: editSkillFormula.trim() || undefined,
        attributes: ta,
        templateFields: editTemplateFields.filter(f=>f.key.trim()&&f.label.trim()).map(f=>({key:f.key.trim(),label:f.label.trim()})),
        skills: editTemplateSkills.filter(s=>s.name.trim()).map(s=>({name:s.name.trim(),description:s.description.trim()||undefined,attributeId:s.attributeId.trim()||undefined,allowedAttributeIds:s.allowedAttributeIds.filter(k=>k.trim()),defaultAttributeId:s.defaultAttributeId.trim()||undefined})),
        skillModifierProfiles: editTemplateProfiles.filter(p=>p.name.trim()).map(p=>({name:p.name.trim(),targetMode:p.targetMode??'ALL_SKILLS',targetSkillIds:p.targetSkillIds??[],options:p.options.filter(o=>o.label.trim()).map(o=>({label:o.label.trim(),value:o.value}))})),
        coreResources: editCoreResources.filter(r=>r.slug.trim()).map(r=>({displayName:r.displayName.trim()||r.slug.trim(), slug:r.slug.trim(), enabled:r.enabled, editableByPlayer:r.editableByPlayer, showNotes:r.showNotes})),
        armorClass: editAcEnabled ? { enabled: true, attributeModifierIds: editAcAttributeIds, fields: editAcFields.filter(f=>f.name.trim()&&f.key.trim()).map(f=>({name:f.name.trim(),key:f.key.trim(),defaultValue:f.defaultValue.trim()||'0',editableByPlayer:f.editableByPlayer,description:f.description.trim()||undefined})) } : { enabled: false },
        characterSections: editCharacterSections.filter(s => s.name.trim()).map(s => ({ id: s.id, name: s.name.trim() })),
        resistances: buildResistancesPayload(editResistances),
      })
      cancelEditTemplate(); fetchTemplates()
    } catch(err) { setEditingTemplateError(err instanceof Error ? err.message : 'Failed to update template') } finally { setTemplateSaving(false) }
  }

  async function handleDeleteTemplate(tid: string) { try { await api.delete(`/adventures/${id}/templates/${tid}`); fetchTemplates() } catch {} }
  async function handleCreateCharacter(e: FormEvent) { e.preventDefault(); setNewCharError(null); if(!newCharName.trim()||!newCharTemplateId)return; setNewCharCreating(true)
    try { const s = await api.post<{id:string}>('/character-sheets',{characterName:newCharName.trim(),templateId:newCharTemplateId}); router.push(`/dashboard/character-sheets/${s.id}`) } catch(err) { setNewCharError(err instanceof Error ? err.message : 'Failed to create character') } finally { setNewCharCreating(false) } }
  async function handleLinkCharacter(e: FormEvent) { e.preventDefault(); setLinkCharError(null); if(!linkSheetId)return; setLinkCharLinking(true)
    try { await api.post(`/character-sheets/${linkSheetId}/link`,{adventureId:id}); setShowLinkCharForm(false); setLinkSheetId(''); fetchCampaignCharacters() } catch(err) { setLinkCharError(err instanceof Error ? err.message : 'Failed to link character') } finally { setLinkCharLinking(false) } }
  async function handleRemoveCharacter(sid: string) { try { await api.post(`/character-sheets/${sid}/unlink`); fetchCampaignCharacters() } catch {} }
  async function handleUpdate(e: FormEvent) { e.preventDefault(); setEditError(null); setSaving(true)
    try { const u = await api.patch<Adventure>(`/adventures/${id}`,{name:editName.trim()||undefined,campaign:editCampaign.trim()||undefined,synopsis:editSynopsis.trim()||undefined,maxPlayers:editMaxPlayers}); setAdventure(u); setEditing(false) } catch(err) { setEditError(err instanceof Error ? err.message : 'Failed to update') } finally { setSaving(false) } }
  async function handleDelete() { setDeleteError(null); setDeleting(true); try { await api.delete(`/adventures/${id}`); router.push('/dashboard') } catch(err) { setDeleteError(err instanceof Error ? err.message : 'Failed to delete'); setDeleting(false); setConfirmDelete(false) } }
  async function handleInviteByEmail(e: FormEvent) { e.preventDefault(); setInviteError(null); setInviteSending(true); try { await api.post(`/adventures/${id}/invitations/email`,{email:inviteEmail.trim(),role:inviteRole}); setInviteEmail(''); fetchInvitations() } catch(err) { setInviteError(err instanceof Error ? err.message : 'Failed to send invitation') } finally { setInviteSending(false) } }
  async function handleInviteByLink() { setInviteError(null); setInviteSending(true); try { const r = await api.post<{inviteUrl:string}>(`/adventures/${id}/invitations/link`,{role:inviteRole}); setInviteLink(r.inviteUrl); fetchInvitations() } catch(err) { setInviteError(err instanceof Error ? err.message : 'Failed to create link') } finally { setInviteSending(false) } }
  async function handleRevokeInvitation(invId: string) { try { await api.post(`/invitations/${invId}/revoke`); fetchInvitations() } catch {} }
  async function handleRemoveMember(uid: string) { try { await api.delete(`/adventures/${id}/members/${uid}`); fetchMembers() } catch {} }

  if(authLoading||fetching) return <main className="flex-1 flex items-center justify-center p-4"><div className="flex flex-col items-center gap-3 text-muted-foreground"><div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"/><span className="text-sm">Loading...</span></div></main>
  if(!adventure) return <main className="flex-1 flex items-center justify-center p-4"><div className="text-sm text-muted-foreground">Adventure not found.</div></main>

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 animate-fade-in">
      <PageNav crumbs={[ { label: 'Dashboard', href: '/dashboard' }, { label: adventure.name } ]} />
      <AdventureHeader adventure={adventure} isGM={isGM} userRole={userRole} onEdit={()=>setEditing(true)} onDelete={()=>setConfirmDelete(true)} />
      {!editing ? (<div className="space-y-6 mt-6">
        <nav className="flex gap-1"><button onClick={()=>setActiveTab('campaign')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab==='campaign'?'bg-primary/15 text-primary border border-primary/20':'text-muted hover:text-foreground'}`}>Campaign</button><button onClick={()=>setActiveTab('templates')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab==='templates'?'bg-primary/15 text-primary border border-primary/20':'text-muted hover:text-foreground'}`}>Character Sheet Templates</button></nav>
        {activeTab==='campaign' ? (<>
          <CollapsibleSection title="Party Members" expanded={showMembers} onToggle={()=>{setShowMembers(!showMembers);if(!showMembers){fetchMembers();if(isGM)fetchInvitations()}}}>
            {members.length===0 ? <p className="text-sm text-muted-foreground">Loading...</p> : <div className="space-y-2">{members.map(m=><MemberRow key={m.id} member={m} isGM={isGM} isSelf={m.user.id===user?.id} onRemove={()=>handleRemoveMember(m.user.id)}/>)}</div>}
          </CollapsibleSection>
          {isGM && <CollapsibleSection title="Invite Players" expanded={showInvite} onToggle={()=>setShowInvite(!showInvite)}>
            <InvitePanel inviteRole={inviteRole} inviteEmail={inviteEmail} inviteLink={inviteLink} inviteError={inviteError} inviteSending={inviteSending} invitations={invitations} onRoleChange={setInviteRole} onEmailChange={setInviteEmail} onInviteByEmail={handleInviteByEmail} onInviteByLink={handleInviteByLink} onRevoke={handleRevokeInvitation}/>
          </CollapsibleSection>}
          <CollapsibleSection title="Characters" expanded={showCharacters} onToggle={()=>{setShowCharacters(!showCharacters);if(!showCharacters){fetchCampaignCharacters();fetchUserSheets()}}}>
            <CharactersSection characters={campaignCharacters} isGM={isGM} userId={user?.id??''} templates={templates} userSheets={userSheets} showNewCharForm={showNewCharForm} showLinkCharForm={showLinkCharForm} newCharName={newCharName} newCharTemplateId={newCharTemplateId} newCharError={newCharError} newCharCreating={newCharCreating} linkSheetId={linkSheetId} linkCharError={linkCharError} linkCharLinking={linkCharLinking} onNewCharClick={()=>{setShowNewCharForm(true);setShowLinkCharForm(false);fetchTemplates()}} onLinkCharClick={()=>{setShowLinkCharForm(true);setShowNewCharForm(false);fetchUserSheets()}} onCancelNewChar={()=>{setShowNewCharForm(false);setNewCharName('');setNewCharTemplateId('');setNewCharError(null)}} onCancelLinkChar={()=>{setShowLinkCharForm(false);setLinkSheetId('');setLinkCharError(null)}} onCreateCharacter={handleCreateCharacter} onLinkCharacter={handleLinkCharacter} onNewCharNameChange={setNewCharName} onNewCharTemplateChange={setNewCharTemplateId} onLinkSheetChange={setLinkSheetId} onRemoveCharacter={handleRemoveCharacter} onViewCharacter={sid=>router.push(`/dashboard/character-sheets/${sid}`)} />
          </CollapsibleSection>
        </>) : (
          <TemplatesSection templates={templates} isGM={isGM} showNewTemplate={showNewTemplate} editingTemplateId={editingTemplateId}
            newTemplateName={newTemplateName} newTemplateDescription={newTemplateDescription} newTemplateAttrs={newTemplateAttrs} newAttrModifierFormula={newAttrModifierFormula} newSkillFormula={newSkillFormula} newTemplateFields={newTemplateFields} templateError={templateError} templateCreating={templateCreating}
            editTemplateName={editTemplateName} editTemplateDescription={editTemplateDescription} editTemplateAttrs={editTemplateAttrs} editAttrModifierFormula={editAttrModifierFormula} editSkillFormula={editSkillFormula} editingTemplateError={editingTemplateError} templateSaving={templateSaving}
            onNewClick={()=>setShowNewTemplate(true)} onCancelNew={resetNewTemplate} onCreateTemplate={handleCreateTemplate}
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
            newAcEnabled={newAcEnabled} newAcFields={newAcFields} newAcAttributeIds={newAcAttributeIds} newTemplateAttrs2={newTemplateAttrs}
            onNewAcEnabledChange={setNewAcEnabled} onAddNewAcField={addNewAcField} onRemoveNewAcField={removeNewAcField} onUpdateNewAcField={updateNewAcField} onUpdateNewAcFieldEditable={updateNewAcFieldEditable} onToggleNewAcAttributeId={toggleNewAcAttributeId}
            editAcEnabled={editAcEnabled} editAcFields={editAcFields} editAcAttributeIds={editAcAttributeIds} editTemplateAttrs2={editTemplateAttrs}
            onEditAcEnabledChange={setEditAcEnabled} onAddEditAcField={addEditAcField} onRemoveEditAcField={removeEditAcField} onUpdateEditAcField={updateEditAcField} onUpdateEditAcFieldEditable={updateEditAcFieldEditable} onToggleEditAcAttributeId={toggleEditAcAttributeId}
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
          />
        )}
        {confirmDelete && <DeleteModal name={adventure.name} error={deleteError} loading={deleting} onCancel={()=>setConfirmDelete(false)} onConfirm={handleDelete} />}
      </div>) : (<EditForm name={editName} campaign={editCampaign} synopsis={editSynopsis} maxPlayers={editMaxPlayers} error={editError} saving={saving} onNameChange={setEditName} onCampaignChange={setEditCampaign} onSynopsisChange={setEditSynopsis} onMaxPlayersChange={setEditMaxPlayers} onCancel={()=>{setEditing(false);setEditError(null)}} onSubmit={handleUpdate} />)}
    </main>
  )
}

function AdventureHeader(props: { adventure: Adventure; isGM: boolean; userRole: string | null; onEdit: () => void; onDelete: () => void }) {
  const { adventure, isGM, userRole, onEdit, onDelete } = props
  return <div className="card !p-6 space-y-4"><div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"><div className="flex-1 min-w-0"><h1 className="text-2xl font-bold text-gradient truncate">{adventure.name}</h1><div className="flex flex-wrap items-center gap-2 mt-2"><span className="badge badge-gold">{adventure.campaign}</span><span className="badge badge-gold">👥 {adventure.maxPlayers} {adventure.maxPlayers===1?'player':'players'}</span>{userRole&&<span className={`badge text-[0.6rem] ${isGM?'badge-gold':''}`} style={!isGM?{background:'rgba(124,92,231,0.15)',color:'#9070f0',border:'1px solid rgba(124,92,231,0.2)'}:undefined}>{userRole}</span>}<span className="text-xs text-muted">Created {new Date(adventure.createdAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span></div></div>{isGM&&<div className="flex gap-2 shrink-0"><button onClick={onEdit} className="btn-ghost"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>Edit</button><button onClick={onDelete} className="btn-danger"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>Delete</button></div>}</div><hr className="divider" />{adventure.synopsis?<div><h3 className="text-sm font-medium text-muted mb-2">Synopsis</h3><p className="text-foreground/80 leading-relaxed whitespace-pre-wrap text-sm">{adventure.synopsis}</p></div>:<div className="text-center py-8 text-muted-foreground text-sm italic">No synopsis yet.{isGM&&' Click edit to add one.'}</div>}</div>
}
function CollapsibleSection({title,expanded,onToggle,children}:{title:string;expanded:boolean;onToggle:()=>void;children:React.ReactNode}){return <div className="card !p-6"><button onClick={onToggle} className="flex items-center justify-between w-full text-left"><h3 className="font-semibold">{title}</h3><svg className={`w-5 h-5 text-muted transition-transform ${expanded?'rotate-180':''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg></button>{expanded&&<div className="mt-4">{children}</div>}</div>}
function MemberRow({member,isGM,isSelf,onRemove}:{member:Member;isGM:boolean;isSelf:boolean;onRemove:()=>void}){return <div className="flex items-center justify-between py-2 border-b border-border last:border-0"><div className="flex items-center gap-2"><span className="text-sm text-foreground">{member.user.displayName??member.user.email}</span><span className={`badge text-[0.6rem] ${member.role==='GM'?'badge-gold':''}`} style={member.role!=='GM'?{background:'rgba(124,92,231,0.15)',color:'#9070f0',border:'1px solid rgba(124,92,231,0.2)'}:undefined}>{member.role}</span></div>{isGM&&!isSelf&&<button onClick={onRemove} className="text-xs text-danger hover:text-danger/80 transition-colors">Remove</button>}</div>}
function InvitePanel(props:{inviteRole:string;inviteEmail:string;inviteLink:string|null;inviteError:string|null;inviteSending:boolean;invitations:Invitation[];onRoleChange:(r:'PLAYER'|'GM')=>void;onEmailChange:(e:string)=>void;onInviteByEmail:(e:FormEvent)=>void;onInviteByLink:()=>void;onRevoke:(id:string)=>void}){return <div className="space-y-4"><div><label className="label">Role</label><div className="flex gap-2">{(['PLAYER','GM']as const).map(r=><button key={r} onClick={()=>props.onRoleChange(r)} className={`btn-ghost text-sm ${props.inviteRole===r?'!border-primary/40 !text-primary':''}`}>{r}</button>)}</div></div><form onSubmit={props.onInviteByEmail} className="space-y-3"><div><label className="label">Invite by Email</label><div className="flex gap-2"><input type="email" value={props.inviteEmail} onChange={e=>props.onEmailChange(e.target.value)} className="input-field flex-1" placeholder="player@example.com"/><button type="submit" disabled={props.inviteSending||props.inviteEmail.trim().length===0} className="btn-primary">Send</button></div></div></form><div><label className="label">Invite by Link</label><button onClick={props.onInviteByLink} disabled={props.inviteSending} className="btn-ghost">Generate invite link</button>{props.inviteLink&&<div className="mt-2 flex items-center gap-2"><input readOnly value={props.inviteLink} className="input-field flex-1 text-xs" onFocus={e=>e.target.select()}/><button onClick={()=>navigator.clipboard.writeText(props.inviteLink!)} className="btn-ghost text-xs">Copy</button></div>}</div>{props.inviteError&&<div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{props.inviteError}</div>}{props.invitations.length>0&&<div className="space-y-2"><h4 className="text-sm font-medium text-muted">Pending Invitations</h4>{props.invitations.map(inv=><div key={inv.id} className="flex items-center justify-between text-sm py-1"><span className="text-muted-foreground">{inv.invitedEmail??'Link invitation'}</span><button onClick={()=>props.onRevoke(inv.id)} className="text-xs text-danger hover:text-danger/80 transition-colors">Revoke</button></div>)}</div>}</div>}
function DeleteModal({name,error,loading,onCancel,onConfirm}:{name:string;error:string|null;loading:boolean;onCancel:()=>void;onConfirm:()=>void}){return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in"><div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center"><svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg></div><div><h2 className="font-semibold">Delete Adventure</h2><p className="text-sm text-muted-foreground">This action cannot be undone.</p></div></div><p className="text-sm text-muted-foreground">Are you sure you want to delete "{name}"?</p>{error&&<div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{error}</div>}<div className="flex gap-3 justify-end"><button onClick={onCancel} disabled={loading} className="btn-ghost">Cancel</button><button onClick={onConfirm} disabled={loading} className="btn-danger-solid">{loading?'Deleting...':'Delete forever'}</button></div></div></div>}
function EditForm(props:{name:string;campaign:string;synopsis:string;maxPlayers:number;error:string|null;saving:boolean;onNameChange:(v:string)=>void;onCampaignChange:(v:string)=>void;onSynopsisChange:(v:string)=>void;onMaxPlayersChange:(v:number)=>void;onCancel:()=>void;onSubmit:(e:FormEvent)=>void}){return <form onSubmit={props.onSubmit} className="card !p-6 space-y-4 animate-slide-up"><div className="flex items-center gap-3 mb-2"><svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg><h2 className="text-xl font-semibold text-gradient">Edit Adventure</h2></div><div><label className="label">Adventure Name</label><input className="input-field" value={props.name} onChange={e=>props.onNameChange(e.target.value)} maxLength={100}/></div><div><label className="label">Campaign</label><input className="input-field" value={props.campaign} onChange={e=>props.onCampaignChange(e.target.value)} maxLength={50}/></div><div><label className="label">Synopsis <span className="text-muted font-normal">(optional)</span></label><textarea className="input-field resize-none" rows={5} value={props.synopsis} onChange={e=>props.onSynopsisChange(e.target.value)} maxLength={2000}/><p className="text-xs text-muted mt-1.5 text-right">{props.synopsis.length}/2000</p></div><div><label className="label">Max Players</label><div className="flex items-center gap-3"><input type="range" min={1} max={5} value={props.maxPlayers} onChange={e=>props.onMaxPlayersChange(Number(e.target.value))} className="flex-1 h-2 rounded-lg appearance-none cursor-pointer" style={{background:`linear-gradient(to right, #c9a44b 0%, #c9a44b ${((props.maxPlayers-1)/4)*100}%, #2a2240 ${((props.maxPlayers-1)/4)*100}%, #2a2240 100%)`}}/><span className="badge badge-gold min-w-[2rem] text-center">{props.maxPlayers}</span></div></div>{props.error&&<div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{props.error}</div>}<div className="flex gap-3 justify-end pt-2"><button type="button" onClick={props.onCancel} disabled={props.saving} className="btn-ghost">Cancel</button><button type="submit" disabled={props.saving||props.name.trim().length===0} className="btn-primary">{props.saving?<><div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"/>Saving...</>:'Save Changes'}</button></div></form>}
function CharactersSection(props:{characters:CampaignCharacter[];isGM:boolean;userId:string;templates:Template[];userSheets:UserSheet[];showNewCharForm:boolean;showLinkCharForm:boolean;newCharName:string;newCharTemplateId:string;newCharError:string|null;newCharCreating:boolean;linkSheetId:string;linkCharError:string|null;linkCharLinking:boolean;onNewCharClick:()=>void;onLinkCharClick:()=>void;onCancelNewChar:()=>void;onCancelLinkChar:()=>void;onCreateCharacter:(e:FormEvent)=>void;onLinkCharacter:(e:FormEvent)=>void;onNewCharNameChange:(v:string)=>void;onNewCharTemplateChange:(v:string)=>void;onLinkSheetChange:(v:string)=>void;onRemoveCharacter:(id:string)=>void;onViewCharacter:(id:string)=>void}){return <div className="space-y-4">{props.characters.length===0&&!props.showNewCharForm&&!props.showLinkCharForm?<div className="text-center py-6 text-muted-foreground text-sm italic">No characters in this campaign yet.</div>:<div className="space-y-2">{props.characters.map(c=><div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0"><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-medium text-foreground truncate">{c.characterName}</span><span className="badge badge-gold text-[0.6rem]">{c.template.name}</span></div><p className="text-xs text-muted mt-0.5">{c.owner.displayName??c.owner.email}</p></div><div className="flex gap-1 shrink-0 ml-2"><button onClick={()=>props.onViewCharacter(c.id)} className="btn-ghost text-xs px-2 py-1">View</button>{props.isGM&&c.owner.id!==props.userId&&<button onClick={()=>props.onRemoveCharacter(c.id)} className="text-xs text-danger hover:text-danger/80 px-2 py-1 transition-colors">Remove</button>}</div></div>)}</div>}{!props.showNewCharForm&&!props.showLinkCharForm&&<div className="flex gap-2"><button onClick={props.onNewCharClick} className="btn-primary text-sm">+ New Character</button><button onClick={props.onLinkCharClick} className="btn-ghost text-sm">Link Existing Character</button></div>}{props.showNewCharForm&&<form onSubmit={props.onCreateCharacter} className="rounded-lg border border-primary/20 bg-background/50 p-4 space-y-3"><h4 className="text-sm font-semibold text-primary">Create New Character</h4><div><label className="label">Character Name</label><input className="input-field" value={props.newCharName} onChange={e=>props.onNewCharNameChange(e.target.value)} placeholder="e.g. Aragorn" maxLength={100} required/></div><div><label className="label">Template</label>{props.templates.length===0?<p className="text-sm text-muted italic">No templates available. Ask your GM to create one.</p>:<select className="input-field" value={props.newCharTemplateId} onChange={e=>props.onNewCharTemplateChange(e.target.value)} required><option value="">Select a template...</option>{props.templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>}</div>{props.newCharError&&<div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{props.newCharError}</div>}<div className="flex gap-2 justify-end"><button type="button" onClick={props.onCancelNewChar} disabled={props.newCharCreating} className="btn-ghost text-sm">Cancel</button><button type="submit" disabled={props.newCharCreating||!props.newCharName.trim()||!props.newCharTemplateId} className="btn-primary text-sm">{props.newCharCreating?'Creating...':'Create'}</button></div></form>}{props.showLinkCharForm&&<form onSubmit={props.onLinkCharacter} className="rounded-lg border border-primary/20 bg-background/50 p-4 space-y-3"><h4 className="text-sm font-semibold text-primary">Link Existing Character</h4><div><label className="label">Select Character</label>{props.userSheets.length===0?<p className="text-sm text-muted italic">No unlinked characters available.</p>:<select className="input-field" value={props.linkSheetId} onChange={e=>props.onLinkSheetChange(e.target.value)} required><option value="">Select a character...</option>{props.userSheets.map(s=><option key={s.id} value={s.id}>{s.characterName} ({s.template.name})</option>)}</select>}</div>{props.linkCharError&&<div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{props.linkCharError}</div>}<div className="flex gap-2 justify-end"><button type="button" onClick={props.onCancelLinkChar} disabled={props.linkCharLinking} className="btn-ghost text-sm">Cancel</button><button type="submit" disabled={props.linkCharLinking||!props.linkSheetId} className="btn-primary text-sm">{props.linkCharLinking?'Linking...':'Link'}</button></div></form>}</div>}

function TemplatesSection(props: {
  templates: Template[]; isGM: boolean; showNewTemplate: boolean; editingTemplateId: string | null
  newTemplateName: string; newTemplateDescription: string; newTemplateAttrs: { key: string; name: string }[]; newAttrModifierFormula: string; newSkillFormula: string; newTemplateFields?: { key: string; label: string }[]; templateError: string | null; templateCreating: boolean
  editTemplateName: string; editTemplateDescription: string; editTemplateAttrs: { key: string; name: string }[]; editAttrModifierFormula: string; editSkillFormula: string; editTemplateFields?: { key: string; label: string }[]; editingTemplateError: string | null; templateSaving: boolean
  onNewClick: () => void; onCancelNew: () => void; onCreateTemplate: (e: FormEvent) => void; onNameChange: (v: string) => void; onDescriptionChange: (v: string) => void
  onAddAttr: () => void; onRemoveAttr: (i: number) => void; onUpdateAttr: (i: number, f: 'key'|'name', v: string) => void
  onAddField?: () => void; onRemoveField?: (i: number) => void; onUpdateField?: (i: number, f: 'key'|'label', v: string) => void
  onStartEdit: (t: Template) => void; onCancelEdit: () => void; onUpdateTemplate: (e: FormEvent) => void; onDeleteTemplate: (id: string) => void
  onEditNameChange: (v: string) => void; onEditDescriptionChange: (v: string) => void; onAddEditAttr: () => void; onRemoveEditAttr: (i: number) => void; onUpdateEditAttr: (i: number, f: 'key'|'name', v: string) => void
  onAddEditField?: () => void; onRemoveEditField?: (i: number) => void; onUpdateEditField?: (i: number, f: 'key'|'label', v: string) => void
  newTemplateSkills?: { name: string; description: string; attributeId: string; allowedAttributeIds: string[]; defaultAttributeId: string }[]
  editTemplateSkills?: { name: string; description: string; attributeId: string; allowedAttributeIds: string[]; defaultAttributeId: string }[]
  onAddSkill?: () => void; onRemoveSkill?: (i: number) => void; onUpdateSkill?: (i: number, f: string, v: string) => void
  onToggleSkillAllowedAttr?: (i: number, attrKey: string) => void
  onAddEditSkill?: () => void; onRemoveEditSkill?: (i: number) => void; onUpdateEditSkill?: (i: number, f: string, v: string) => void
  onToggleEditSkillAllowedAttr?: (i: number, attrKey: string) => void
  newTemplateProfiles?: { name: string; options: { label: string; value: number }[] }[]; editTemplateProfiles?: { name: string; options: { label: string; value: number }[] }[]
  onAddProfile?: () => void; onRemoveProfile?: (i: number) => void; onUpdateProfile?: (i: number, n: string) => void
  onAddProfileOption?: (pIdx: number) => void; onRemoveProfileOption?: (pIdx: number, oIdx: number) => void; onUpdateProfileOption?: (pIdx: number, oIdx: number, f: 'label'|'value', v: string|number) => void
  onUpdateProfileTargetMode?: (i: number, mode: string) => void; onToggleProfileSkill?: (i: number, skillId: string) => void
  onAddEditProfile?: () => void; onRemoveEditProfile?: (i: number) => void; onUpdateEditProfile?: (i: number, n: string) => void
  onAddEditProfileOption?: (pIdx: number) => void; onRemoveEditProfileOption?: (pIdx: number, oIdx: number) => void; onUpdateEditProfileOption?: (pIdx: number, oIdx: number, f: 'label'|'value', v: string|number) => void
  onUpdateEditProfileTargetMode?: (i: number, mode: string) => void; onToggleEditProfileSkill?: (i: number, skillId: string) => void
  newCoreResources?: CoreResource[]; editCoreResources?: CoreResource[]
  onAddCoreResource?: () => void; onRemoveCoreResource?: (i: number) => void; onUpdateCoreResource?: (i: number, f: 'displayName'|'slug', v: string) => void
  onUpdateCoreResourceEnabled?: (i: number, v: boolean) => void; onUpdateCoreResourceEditable?: (i: number, v: boolean) => void; onUpdateCoreResourceShowNotes?: (i: number, v: boolean) => void
  onAddEditCoreResource?: () => void; onRemoveEditCoreResource?: (i: number) => void; onUpdateEditCoreResource?: (i: number, f: 'displayName'|'slug', v: string) => void
  onUpdateEditCoreResourceEnabled?: (i: number, v: boolean) => void; onUpdateEditCoreResourceEditable?: (i: number, v: boolean) => void; onUpdateEditCoreResourceShowNotes?: (i: number, v: boolean) => void
  newAcEnabled?: boolean; newAcFields?: { name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string }[]
  newAcAttributeIds?: string[]; newTemplateAttrs2?: { key: string; name: string }[]
  onNewAcEnabledChange?: (v: boolean) => void
  onAddNewAcField?: () => void; onRemoveNewAcField?: (i: number) => void; onUpdateNewAcField?: (i: number, f: 'name'|'key'|'defaultValue'|'description', v: string) => void; onUpdateNewAcFieldEditable?: (i: number, v: boolean) => void
  onToggleNewAcAttributeId?: (attrId: string) => void
  editAcEnabled?: boolean; editAcFields?: { name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string }[]
  editAcAttributeIds?: string[]; editTemplateAttrs2?: { key: string; name: string }[]
  onEditAcEnabledChange?: (v: boolean) => void
  onAddEditAcField?: () => void; onRemoveEditAcField?: (i: number) => void; onUpdateEditAcField?: (i: number, f: 'name'|'key'|'defaultValue'|'description', v: string) => void; onUpdateEditAcFieldEditable?: (i: number, v: boolean) => void
  onToggleEditAcAttributeId?: (attrId: string) => void
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
}) {
  const attrsForNewResistance = props.newTemplateAttrsForResistance || props.newTemplateAttrs || []
  const attrsForEditResistance = props.editTemplateAttrsForResistance || props.editTemplateAttrs || []
  return <div className="space-y-4">
    {props.templates.length===0&&!props.showNewTemplate ? <div className="text-center py-6 text-muted-foreground text-sm italic">No templates defined yet.{props.isGM&&' Create one below to allow players to build character sheets.'}</div>
    : <div className="space-y-3">{props.templates.map(t=><TemplateRow key={t.id} template={t} isGM={props.isGM} isEditing={props.editingTemplateId===t.id} editName={props.editTemplateName} editDescription={props.editTemplateDescription} editAttrs={props.editTemplateAttrs} editAttrModifierFormula={props.editAttrModifierFormula} editSkillFormula={props.editSkillFormula} editFields={props.editTemplateFields} editSkills={props.editTemplateSkills} editError={props.editingTemplateError} saving={props.templateSaving} onStartEdit={()=>props.onStartEdit(t)} onCancelEdit={props.onCancelEdit} onUpdate={props.onUpdateTemplate} onDelete={()=>props.onDeleteTemplate(t.id)} onEditNameChange={props.onEditNameChange} onEditDescriptionChange={props.onEditDescriptionChange} onAddAttr={props.onAddEditAttr} onRemoveAttr={props.onRemoveEditAttr} onUpdateAttr={props.onUpdateEditAttr} onAddField={props.onAddEditField} onRemoveField={props.onRemoveEditField} onUpdateField={props.onUpdateEditField} onAddSkill={props.onAddEditSkill} onRemoveSkill={props.onRemoveEditSkill} onUpdateSkill={props.onUpdateEditSkill} onToggleSkillAllowedAttr={props.onToggleEditSkillAllowedAttr} editProfiles={props.editTemplateProfiles} onAddProfile={props.onAddEditProfile} onRemoveProfile={props.onRemoveEditProfile} onUpdateProfile={props.onUpdateEditProfile} onAddProfileOption={props.onAddEditProfileOption} onRemoveProfileOption={props.onRemoveEditProfileOption} onUpdateProfileOption={props.onUpdateEditProfileOption} onUpdateProfileTargetMode={props.onUpdateEditProfileTargetMode} onToggleProfileSkill={props.onToggleEditProfileSkill} editCoreResources={props.editCoreResources} onAddCoreResource={props.onAddEditCoreResource} onRemoveCoreResource={props.onRemoveEditCoreResource} onUpdateCoreResource={props.onUpdateEditCoreResource} onUpdateCoreResourceEnabled={props.onUpdateEditCoreResourceEnabled} onUpdateCoreResourceEditable={props.onUpdateEditCoreResourceEditable} onUpdateCoreResourceShowNotes={props.onUpdateEditCoreResourceShowNotes} editAcEnabled={props.editAcEnabled} editAcFields={props.editAcFields} editAcAttributeIds={props.editAcAttributeIds} editTemplateAttrs2={props.editTemplateAttrs2} onEditAcEnabledChange={props.onEditAcEnabledChange} onAddEditAcField={props.onAddEditAcField} onRemoveEditAcField={props.onRemoveEditAcField} onUpdateEditAcField={props.onUpdateEditAcField} onUpdateEditAcFieldEditable={props.onUpdateEditAcFieldEditable} onToggleEditAcAttributeId={props.onToggleEditAcAttributeId} editAttrModifiersEnabled={props.editAttrModifiersEnabled} onEditAttrModifiersEnabledChange={props.onEditAttrModifiersEnabledChange} onEditAttrModifierFormulaChange={props.onEditAttrModifierFormulaChange} onEditSkillFormulaChange={props.onEditSkillFormulaChange} editCharacterSections={props.editCharacterSections} onAddEditCharacterSection={props.onAddEditCharacterSection} onRemoveEditCharacterSection={props.onRemoveEditCharacterSection} onUpdateEditCharacterSection={props.onUpdateEditCharacterSection} onEditResistancesChange={props.onEditResistancesChange} editResistances={props.editResistances} attrsForEditResistance={attrsForEditResistance} />)}</div>}
    {props.isGM&&!props.showNewTemplate&&<button onClick={props.onNewClick} className="btn-primary text-sm">+ New Template</button>}
    {props.isGM&&props.showNewTemplate&&<NewTemplateForm newTemplateName={props.newTemplateName} newTemplateDescription={props.newTemplateDescription} newTemplateAttrs={props.newTemplateAttrs} newAttrModifierFormula={props.newAttrModifierFormula} newSkillFormula={props.newSkillFormula} newTemplateSkills={props.newTemplateSkills} newTemplateProfiles={props.newTemplateProfiles} newTemplateFields={props.newTemplateFields} templateError={props.templateError} templateCreating={props.templateCreating} onNameChange={props.onNameChange} onDescriptionChange={props.onDescriptionChange} onAddAttr={props.onAddAttr} onRemoveAttr={props.onRemoveAttr} onUpdateAttr={props.onUpdateAttr} onAddSkill={props.onAddSkill} onRemoveSkill={props.onRemoveSkill} onUpdateSkill={props.onUpdateSkill} onToggleSkillAllowedAttr={props.onToggleSkillAllowedAttr} onAddProfile={props.onAddProfile} onRemoveProfile={props.onRemoveProfile} onUpdateProfile={props.onUpdateProfile} onAddProfileOption={props.onAddProfileOption} onRemoveProfileOption={props.onRemoveProfileOption} onUpdateProfileOption={props.onUpdateProfileOption} onAddField={props.onAddField} onRemoveField={props.onRemoveField} onUpdateField={props.onUpdateField} onUpdateProfileTargetMode={props.onUpdateProfileTargetMode} onToggleProfileSkill={props.onToggleProfileSkill} onCancelNew={props.onCancelNew} onCreateTemplate={props.onCreateTemplate} newCoreResources={props.newCoreResources} onAddCoreResource={props.onAddCoreResource} onRemoveCoreResource={props.onRemoveCoreResource} onUpdateCoreResource={props.onUpdateCoreResource} onUpdateCoreResourceEnabled={props.onUpdateCoreResourceEnabled} onUpdateCoreResourceEditable={props.onUpdateCoreResourceEditable} onUpdateCoreResourceShowNotes={props.onUpdateCoreResourceShowNotes} newAcEnabled={props.newAcEnabled} newAcFields={props.newAcFields} newAcAttributeIds={props.newAcAttributeIds} newTemplateAttrs2={props.newTemplateAttrs2} onNewAcEnabledChange={props.onNewAcEnabledChange} onAddNewAcField={props.onAddNewAcField} onRemoveNewAcField={props.onRemoveNewAcField} onUpdateNewAcField={props.onUpdateNewAcField} onUpdateNewAcFieldEditable={props.onUpdateNewAcFieldEditable} onToggleNewAcAttributeId={props.onToggleNewAcAttributeId} newAttrModifiersEnabled={props.newAttrModifiersEnabled} onNewAttrModifiersEnabledChange={props.onNewAttrModifiersEnabledChange} onNewAttrModifierFormulaChange={props.onNewAttrModifierFormulaChange} onNewSkillFormulaChange={props.onNewSkillFormulaChange} newCharacterSections={props.newCharacterSections} onAddNewCharacterSection={props.onAddNewCharacterSection} onRemoveNewCharacterSection={props.onRemoveNewCharacterSection} onUpdateNewCharacterSection={props.onUpdateNewCharacterSection} onNewResistancesChange={props.onNewResistancesChange} newResistances={props.newResistances} attrsForNewResistance={attrsForNewResistance} />}
  </div>
}

function CollapsibleAttrCard({ index, attr, isExpanded, onToggle, onUpdateAttr, onRemove }: { index: number; attr: { key: string; name: string }; isExpanded: boolean; onToggle: () => void; onUpdateAttr: (i: number, f: 'key'|'name', v: string) => void; onRemove: () => void }) {
  return <div className="rounded-lg border border-border bg-background/30 overflow-hidden"><button type="button" onClick={onToggle} className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-background/50 transition-colors"><div className="flex items-center gap-2 min-w-0"><span className="text-sm font-medium text-foreground truncate">{attr.name||'New Attribute'}</span>{attr.key&&<span className="text-[0.6rem] text-muted font-mono shrink-0">({attr.key})</span>}</div><svg className={`w-4 h-4 text-muted transition-transform shrink-0 ${isExpanded?'rotate-180':''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg></button>{isExpanded&&<div className="px-3 py-3 space-y-2 border-t border-border"><div className="flex items-center gap-1.5"><input className="input-field flex-1" value={attr.key} onChange={e=>onUpdateAttr(index,'key',e.target.value)} placeholder="Key (e.g. strength)"/><input className="input-field flex-1" value={attr.name} onChange={e=>onUpdateAttr(index,'name',e.target.value)} placeholder="Name (e.g. Strength)"/></div><div className="flex justify-end"><button type="button" onClick={onRemove} className="text-xs text-danger hover:text-danger/80 transition-colors">Remove Attribute</button></div></div>}</div>
}
function CollapsibleSkillCard({ index, skill, onUpdateSkill, onRemove, attributes, onToggleAllowedAttr, onUpdateDefaultAttr }: { index: number; skill: { name: string; description: string; attributeId: string; allowedAttributeIds?: string[]; defaultAttributeId?: string }; onUpdateSkill?: (i: number, f: string, v: string) => void; onRemove?: () => void; attributes: { key: string; name: string }[]; onToggleAllowedAttr?: (i: number, attrKey: string) => void; onUpdateDefaultAttr?: (i: number, v: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const allowed = (skill as any).allowedAttributeIds ?? []
  const defaultAttr = (skill as any).defaultAttributeId ?? ''
  return <div className="rounded-lg border border-border bg-background/30 overflow-hidden"><button type="button" onClick={()=>setExpanded(!expanded)} className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-background/50 transition-colors"><span className="text-sm font-medium text-foreground truncate">{skill.name||'New Skill'}</span><svg className={`w-4 h-4 text-muted transition-transform shrink-0 ${expanded?'rotate-180':''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg></button>{expanded&&<div className="px-3 py-3 space-y-2 border-t border-border"><div><label className="text-xs text-muted mb-1 block">Name</label><input className="input-field" value={skill.name} onChange={e=>onUpdateSkill?.(index,'name',e.target.value)} placeholder="Skill Name (e.g. Stealth)"/></div><div><label className="text-xs text-muted mb-1 block">Description <span className="text-muted font-normal">(optional)</span></label><input className="input-field" value={skill.description} onChange={e=>onUpdateSkill?.(index,'description',e.target.value)} placeholder="Brief description"/></div>
    <div><label className="text-xs text-muted mb-1 block">Allowed Attributes</label><div className="flex flex-wrap gap-1">{(attributes||[]).map(a=><label key={a.key} className="flex items-center gap-1 text-xs text-foreground cursor-pointer py-0.5"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={allowed.includes(a.key)} onChange={()=>onToggleAllowedAttr?.(index,a.key)}/><span>{a.name}</span></label>)}</div></div>
    <div><label className="text-xs text-muted mb-1 block">Default Attribute</label><select className="input-field" value={defaultAttr} onChange={e=>{if(onUpdateDefaultAttr)onUpdateDefaultAttr(index,e.target.value);else onUpdateSkill?.(index,'defaultAttributeId',e.target.value)}}><option value="">— Select Default —</option>{allowed.map((k:string)=>{const a=attributes.find((x:any)=>x.key===k);return a?<option key={k} value={k}>{a.name}</option>:null})}</select></div>
    <div className="flex justify-end"><button type="button" onClick={onRemove} className="text-xs text-danger hover:text-danger/80 transition-colors">Remove Skill</button></div></div>}</div>
}

function NewTemplateForm(props: {
  newTemplateName: string; newTemplateDescription: string; newTemplateAttrs: { key: string; name: string }[]
  newAttrModifierFormula: string; newSkillFormula: string; newTemplateSkills?: { name: string; description: string; attributeId: string; allowedAttributeIds: string[]; defaultAttributeId: string }[]; newTemplateProfiles?: { name: string; options: { label: string; value: number }[] }[]; newTemplateFields?: { key: string; label: string }[]
  templateError: string | null; templateCreating: boolean; onNameChange: (v: string) => void; onDescriptionChange: (v: string) => void
  onAddAttr: () => void; onRemoveAttr: (i: number) => void; onUpdateAttr: (i: number, f: 'key'|'name', v: string) => void
  onAddSkill?: () => void; onRemoveSkill?: (i: number) => void; onUpdateSkill?: (i: number, f: string, v: string) => void
  onToggleSkillAllowedAttr?: (i: number, attrKey: string) => void
  onAddProfile?: () => void; onRemoveProfile?: (i: number) => void; onUpdateProfile?: (i: number, n: string) => void
  onAddProfileOption?: (pIdx: number) => void; onRemoveProfileOption?: (pIdx: number, oIdx: number) => void; onUpdateProfileOption?: (pIdx: number, oIdx: number, f: 'label'|'value', v: string|number) => void
  onAddField?: () => void; onRemoveField?: (i: number) => void; onUpdateField?: (i: number, f: 'key'|'label', v: string) => void
  onUpdateProfileTargetMode?: (i: number, mode: string) => void; onToggleProfileSkill?: (i: number, skillId: string) => void
  onCancelNew: () => void; onCreateTemplate: (e: FormEvent) => void
  newCoreResources?: CoreResource[]
  onAddCoreResource?: () => void; onRemoveCoreResource?: (i: number) => void; onUpdateCoreResource?: (i: number, f: 'displayName'|'slug', v: string) => void
  onUpdateCoreResourceEnabled?: (i: number, v: boolean) => void; onUpdateCoreResourceEditable?: (i: number, v: boolean) => void; onUpdateCoreResourceShowNotes?: (i: number, v: boolean) => void
  newAcEnabled?: boolean; newAcFields?: { name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string }[]
  newAcAttributeIds?: string[]; newTemplateAttrs2?: { key: string; name: string }[]
  onNewAcEnabledChange?: (v: boolean) => void
  onAddNewAcField?: () => void; onRemoveNewAcField?: (i: number) => void; onUpdateNewAcField?: (i: number, f: 'name'|'key'|'defaultValue'|'description', v: string) => void; onUpdateNewAcFieldEditable?: (i: number, v: boolean) => void
  onToggleNewAcAttributeId?: (attrId: string) => void
  onNewAttrModifierFormulaChange?: (v: string) => void
  onNewSkillFormulaChange?: (v: string) => void
  newAttrModifiersEnabled?: boolean
  onNewAttrModifiersEnabledChange?: (v: boolean) => void
  newCharacterSections?: { id?: string; name: string }[]
  onAddNewCharacterSection?: () => void; onRemoveNewCharacterSection?: (i: number) => void; onUpdateNewCharacterSection?: (i: number, v: string) => void
  onNewResistancesChange?: (v: ResistanceDef[]) => void
  newResistances?: ResistanceDef[]
  attrsForNewResistance: { key: string; name: string; id?: string }[]
}) {
  const [activeTab, setActiveTab] = useState<string>('attrs')
  const [expandedAttrs, setExpandedAttrs] = useState<Record<number,boolean>>({}); const prevCount = useRef(0)
  useEffect(()=>{if(props.newTemplateAttrs.length>prevCount.current){setExpandedAttrs(p=>({...p,[props.newTemplateAttrs.length-1]:true}))};prevCount.current=props.newTemplateAttrs.length},[props.newTemplateAttrs.length])
  const tabClass = (tab:string) => `px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab===tab?'bg-primary/15 text-primary border border-primary/20':'text-muted hover:text-foreground'}`
  const allAttrs = props.newTemplateAttrs.filter(a=>a.key.trim()&&a.name.trim()).map(a=>({key:a.key.trim(),name:a.name.trim()}))
  const acAttributeIds = props.newAcAttributeIds ?? []

  return <form onSubmit={props.onCreateTemplate} className="rounded-lg border border-primary/20 bg-background/50 p-4 space-y-3">
    <h4 className="text-sm font-semibold text-primary">Create Template</h4>
    <div><label className="label">Name</label><input className="input-field" value={props.newTemplateName} onChange={e=>props.onNameChange(e.target.value)} placeholder="e.g. D&D 5e Character Sheet" maxLength={100} required/></div>
    <div><label className="label">Description <span className="text-muted font-normal">(optional)</span></label><input className="input-field" value={props.newTemplateDescription} onChange={e=>props.onDescriptionChange(e.target.value)} placeholder="Brief description of this template" maxLength={200}/></div>
    <div className="flex gap-1 flex-wrap">
      <button type="button" onClick={()=>setActiveTab('attrs')} className={tabClass('attrs')}>Attributes</button>
      <button type="button" onClick={()=>setActiveTab('skills')} className={tabClass('skills')}>Skills</button>
      {props.onAddProfile&&<button type="button" onClick={()=>setActiveTab('profiles')} className={tabClass('profiles')}>Skill Modifier Profiles</button>}
      {props.onAddCoreResource&&<button type="button" onClick={()=>setActiveTab('coreResources')} className={tabClass('coreResources')}>Core Resources</button>}
      {props.onAddField&&<button type="button" onClick={()=>setActiveTab('fields')} className={tabClass('fields')}>Custom Fields</button>}
      {props.onNewAcEnabledChange&&<button type="button" onClick={()=>setActiveTab('ac')} className={tabClass('ac')}>Armor Class</button>}
      <button type="button" onClick={()=>setActiveTab('characterSections' as any)} className={tabClass('characterSections' as any)}>Character Sections</button>
      {props.onNewResistancesChange&&<button type="button" onClick={()=>setActiveTab('resistances')} className={tabClass('resistances')}>Resistance System</button>}
    </div>

    {activeTab==='attrs'&&<div>
      <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer mb-3">
        <input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={props.newAttrModifiersEnabled ?? false} onChange={e=>props.onNewAttrModifiersEnabledChange?.(e.target.checked)}/>
        Enable Attribute Modifiers
      </label>
      {(props.newAttrModifiersEnabled ?? false) && <div className="mb-3"><AttributeModifierConfig value={props.newAttrModifierFormula} onChange={v=>props.onNewAttrModifierFormulaChange?.(v)} placeholder="floor((value - 10) / 2)"/></div>}
      <div className="space-y-2 mt-1">{props.newTemplateAttrs.map((attr,idx)=><CollapsibleAttrCard key={idx} index={idx} attr={attr} isExpanded={!!expandedAttrs[idx]} onToggle={()=>setExpandedAttrs(p=>({...p,[idx]:!p[idx]}))} onUpdateAttr={props.onUpdateAttr} onRemove={()=>props.onRemoveAttr(idx)}/>)}</div><button type="button" onClick={props.onAddAttr} className="btn-ghost text-xs mt-2">+ Add Attribute</button></div>}
    {activeTab==='skills'&&<div>
      <div className="mb-3"><SkillCalculationConfig value={props.newSkillFormula} onChange={v=>props.onNewSkillFormulaChange?.(v)} customFields={(props.newTemplateFields||[]).filter(f=>f.key.trim()&&f.label.trim()).map(f=>({key:f.key.trim(),label:f.label.trim()}))} placeholder="e.g. value + mod(value)" disabled={!(props.newAttrModifiersEnabled ?? false)}/></div>
      <div className="space-y-2 mt-1">{(props.newTemplateSkills||[]).map((s,idx)=><CollapsibleSkillCard key={idx} index={idx} skill={s} onUpdateSkill={props.onUpdateSkill} onRemove={()=>props.onRemoveSkill?.(idx)} attributes={allAttrs} onToggleAllowedAttr={props.onToggleSkillAllowedAttr} onUpdateDefaultAttr={(i,v)=>{props.onUpdateSkill?.(i,'defaultAttributeId',v)}}/>)}</div><button type="button" onClick={props.onAddSkill} className="btn-ghost text-xs mt-2">+ Add Skill</button></div>}

    {activeTab==='profiles'&&<div><div className="space-y-2 mt-1">{(props.newTemplateProfiles||[]).map((p,pIdx)=><div key={pIdx} className="rounded-lg border border-border bg-background/30 p-3 space-y-2"><div className="flex items-center gap-1.5"><input className="input-field flex-1" value={p.name} onChange={e=>props.onUpdateProfile?.(pIdx,e.target.value)} placeholder="Profile name (e.g. mastery)"/><button type="button" onClick={()=>props.onRemoveProfile?.(pIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div><div className="rounded border border-border/50 bg-background/20 p-2 space-y-2"><label className="text-xs font-semibold text-muted uppercase tracking-wider">Applies To</label><div className="flex gap-2">{(['ALL_SKILLS','SELECTED_SKILLS'] as const).map(mode=><button key={mode} type="button" onClick={()=>{props.onUpdateProfileTargetMode?.(pIdx, mode)}} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${((p as any).targetMode??'ALL_SKILLS')===mode?'bg-primary/15 text-primary border border-primary/20':'text-muted hover:text-foreground border border-transparent'}`}>{mode==='ALL_SKILLS'?'All Skills':'Selected Skills'}</button>)}</div>{(p as any).targetMode==='SELECTED_SKILLS'&&<div className="space-y-1 max-h-40 overflow-y-auto">{props.newTemplateSkills?.filter((s: any)=>s.name.trim()).map((s: any)=>{const sid=s.name.trim();const selected=((p as any).targetSkillIds??[]).includes(sid);return(<label key={sid} className="flex items-center gap-2 text-xs text-foreground cursor-pointer py-0.5"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={selected} onChange={()=>{props.onToggleProfileSkill?.(pIdx, sid)}}/><span>{s.name.trim()}</span></label>)})}{(props.newTemplateSkills||[]).filter((s: any)=>s.name.trim()).length===0&&<p className="text-xs text-muted italic">Add skills to the template first.</p>}</div>}</div><div className="space-y-1 pl-2">{p.options.map((o,oIdx)=><div key={oIdx} className="flex items-center gap-1.5"><input className="input-field flex-1 text-xs" value={o.label} onChange={e=>props.onUpdateProfileOption?.(pIdx,oIdx,'label',e.target.value)} placeholder="Option label (e.g. Expert)"/><input className="input-field w-20 text-xs" type="number" value={o.value} onChange={e=>props.onUpdateProfileOption?.(pIdx,oIdx,'value',e.target.value)} placeholder="Value"/><button type="button" onClick={()=>props.onRemoveProfileOption?.(pIdx,oIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>)}</div><button type="button" onClick={()=>props.onAddProfileOption?.(pIdx)} className="btn-ghost text-xs">+ Add Option</button></div>)}</div><button type="button" onClick={props.onAddProfile} className="btn-ghost text-xs mt-2">+ Add Skill Modifier Profile</button></div>}

    {activeTab==='coreResources'&&<div><div className="space-y-2 mt-1">{(props.newCoreResources||[]).map((cr, crIdx)=><div key={crIdx} className="rounded-lg border border-border bg-background/30 p-3 space-y-2">
      <div className="flex items-center gap-1.5"><input className="input-field flex-1" value={cr.displayName} onChange={e=>props.onUpdateCoreResource?.(crIdx,'displayName',e.target.value)} placeholder="Display Name (e.g. Health Points)"/><input className="input-field flex-1" value={cr.slug} onChange={e=>props.onUpdateCoreResource?.(crIdx,'slug',e.target.value)} placeholder="Slug (e.g. health_points)"/><button type="button" onClick={()=>props.onRemoveCoreResource?.(crIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>
      <div className="flex items-center gap-4 flex-wrap"><label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.enabled} onChange={e=>props.onUpdateCoreResourceEnabled?.(crIdx,e.target.checked)}/>Enabled</label><label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.editableByPlayer} onChange={e=>props.onUpdateCoreResourceEditable?.(crIdx,e.target.checked)}/>Editable by Player</label><label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.showNotes} onChange={e=>props.onUpdateCoreResourceShowNotes?.(crIdx,e.target.checked)}/>Show Notes</label></div>
    </div>)}</div><button type="button" onClick={props.onAddCoreResource} className="btn-ghost text-xs mt-2">+ Add Core Resource</button></div>}

    {activeTab==='fields'&&<div><div className="space-y-2 mt-1">{(props.newTemplateFields||[]).map((f,idx)=><div key={idx} className="flex items-center gap-1.5"><input className="input-field flex-1" value={f.key} onChange={e=>props.onUpdateField?.(idx,'key',e.target.value)} placeholder="Key (e.g. class)"/><input className="input-field flex-1" value={f.label} onChange={e=>props.onUpdateField?.(idx,'label',e.target.value)} placeholder="Label (e.g. Class)"/><button type="button" onClick={()=>props.onRemoveField?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>)}</div><button type="button" onClick={props.onAddField} className="btn-ghost text-xs mt-2">+ Add Custom Field</button></div>}

    {activeTab==='characterSections'&&<div>
      <div className="space-y-2 mt-1">{(props.newCharacterSections||[]).map((s, idx) => (<div key={idx} className="flex items-center gap-1.5"><input className="input-field flex-1" value={s.name} onChange={e => props.onUpdateNewCharacterSection?.(idx, e.target.value)} placeholder="Section name (e.g. Talents)" /><button type="button" onClick={() => props.onRemoveNewCharacterSection?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>))}</div>
      <button type="button" onClick={props.onAddNewCharacterSection} className="btn-ghost text-xs mt-2">+ Add Section</button>
    </div>}

    {activeTab==='ac'&&props.onNewAcEnabledChange&&<div><div className="space-y-2 mt-1">
      <div className="rounded-lg border border-border bg-background/30 p-3 space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer"><input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={props.newAcEnabled??false} onChange={e=>props.onNewAcEnabledChange?.(e.target.checked)}/>Enable Armor Class System</label>
        {(props.newAcEnabled??false)&&<div className="space-y-2 pl-2">
          <div><label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">AC Components</label>
            <div className="space-y-1">{(props.newAcFields||[]).map((f,idx)=><div key={idx} className="rounded border border-border/50 bg-background/20 p-2 space-y-1"><div className="flex items-center gap-1"><input className="input-field flex-1 text-xs" value={f.name} onChange={e=>props.onUpdateNewAcField?.(idx,'name',e.target.value)} placeholder="Field name (e.g. Shield)"/><input className="input-field flex-1 text-xs" value={f.key} onChange={e=>props.onUpdateNewAcField?.(idx,'key',e.target.value)} placeholder="Key (e.g. shield)"/><button type="button" onClick={()=>props.onRemoveNewAcField?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div><div className="flex items-center gap-1"><input className="input-field flex-1 text-xs" value={f.defaultValue} onChange={e=>props.onUpdateNewAcField?.(idx,'defaultValue',e.target.value)} placeholder="Default value"/><input className="input-field flex-1 text-xs" value={f.description} onChange={e=>props.onUpdateNewAcField?.(idx,'description',e.target.value)} placeholder="Description (optional)"/><label className="flex items-center gap-1 text-xs text-muted shrink-0"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={f.editableByPlayer} onChange={e=>props.onUpdateNewAcFieldEditable?.(idx,e.target.checked)}/>Editable</label></div></div>)}</div>
            <button type="button" onClick={props.onAddNewAcField} className="btn-ghost text-xs mt-1">+ Add AC Component</button></div>
          <div className={!(props.newAttrModifiersEnabled ?? false) ? "opacity-50 pointer-events-none" : ""}><label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">Attribute Modifiers</label>
            <div className="space-y-1">{(props.newTemplateAttrs2||props.newTemplateAttrs||[]).filter(a=>a.key.trim()&&a.name.trim()).map(attr=>( <label key={attr.key} className={`flex items-center gap-2 text-xs text-foreground py-1 ${(props.newAttrModifiersEnabled ?? false) ? 'cursor-pointer' : 'cursor-not-allowed'}`}><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={acAttributeIds.includes(attr.key.trim())} onChange={()=>props.onToggleNewAcAttributeId?.(attr.key.trim())} disabled={!(props.newAttrModifiersEnabled ?? false)}/><span>{attr.name.trim()} Modifier</span></label> ))}</div></div>
        </div>}
      </div>
    </div></div>}

    {activeTab==='resistances'&&props.onNewResistancesChange&&<div>
      <ResistanceSystemConfig resistances={props.newResistances||[]} attributes={props.attrsForNewResistance.map(a => ({ id: a.id || '', key: a.key, name: a.name }))} onChange={props.onNewResistancesChange} disableAttributeModifiers={!(props.newAttrModifiersEnabled ?? false)} />
    </div>}

    {props.templateError&&<div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{props.templateError}</div>}
    <div className="flex gap-2 justify-end"><button type="button" onClick={props.onCancelNew} disabled={props.templateCreating} className="btn-ghost text-sm">Cancel</button><button type="submit" disabled={props.templateCreating||!props.newTemplateName.trim()||props.newTemplateAttrs.length===0} className="btn-primary text-sm">{props.templateCreating?'Creating...':'Create'}</button></div>
  </form>
}

function TemplateRow(props: {
  template: Template; isGM: boolean; isEditing: boolean; editName: string; editDescription: string; editAttrs: { key: string; name: string }[]; editAttrModifierFormula: string; editSkillFormula: string; editFields?: { key: string; label: string }[]; editSkills?: { name: string; description: string; attributeId: string; allowedAttributeIds?: string[]; defaultAttributeId?: string }[]; editError: string | null; saving: boolean
  onStartEdit: () => void; onCancelEdit: () => void; onUpdate: (e: FormEvent) => void; onDelete: () => void; onEditNameChange: (v: string) => void; onEditDescriptionChange: (v: string) => void
  onAddAttr: () => void; onRemoveAttr: (i: number) => void; onUpdateAttr: (i: number, f: 'key'|'name', v: string) => void
  onAddField?: () => void; onRemoveField?: (i: number) => void; onUpdateField?: (i: number, f: 'key'|'label', v: string) => void
  onAddSkill?: () => void; onRemoveSkill?: (i: number) => void; onUpdateSkill?: (i: number, f: string, v: string) => void
  onToggleSkillAllowedAttr?: (i: number, attrKey: string) => void
  editProfiles?: { name: string; targetMode?: string; targetSkillIds?: string[]; options: { label: string; value: number }[] }[]; onAddProfile?: () => void; onRemoveProfile?: (i: number) => void; onUpdateProfile?: (i: number, n: string) => void
  onAddProfileOption?: (pIdx: number) => void; onRemoveProfileOption?: (pIdx: number, oIdx: number) => void; onUpdateProfileOption?: (pIdx: number, oIdx: number, f: 'label'|'value', v: string|number) => void
  onUpdateProfileTargetMode?: (i: number, mode: string) => void; onToggleProfileSkill?: (i: number, skillId: string) => void
  editCoreResources?: CoreResource[]
  onAddCoreResource?: () => void; onRemoveCoreResource?: (i: number) => void; onUpdateCoreResource?: (i: number, f: 'displayName'|'slug', v: string) => void
  onUpdateCoreResourceEnabled?: (i: number, v: boolean) => void; onUpdateCoreResourceEditable?: (i: number, v: boolean) => void; onUpdateCoreResourceShowNotes?: (i: number, v: boolean) => void
  editAcEnabled?: boolean; editAcFields?: { name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string }[]
  editAcAttributeIds?: string[]; editTemplateAttrs2?: { key: string; name: string }[]
  onEditAcEnabledChange?: (v: boolean) => void
  onAddEditAcField?: () => void; onRemoveEditAcField?: (i: number) => void; onUpdateEditAcField?: (i: number, f: 'name'|'key'|'defaultValue'|'description', v: string) => void; onUpdateEditAcFieldEditable?: (i: number, v: boolean) => void
  onToggleEditAcAttributeId?: (attrId: string) => void
  editAttrModifiersEnabled?: boolean
  onEditAttrModifiersEnabledChange?: (v: boolean) => void
  onEditAttrModifierFormulaChange?: (v: string) => void
  onEditSkillFormulaChange?: (v: string) => void
  editCharacterSections?: { id?: string; name: string }[]
  onAddEditCharacterSection?: () => void; onRemoveEditCharacterSection?: (i: number) => void; onUpdateEditCharacterSection?: (i: number, v: string) => void
  onEditResistancesChange?: (v: ResistanceDef[]) => void
  editResistances?: ResistanceDef[]
  attrsForEditResistance: { key: string; name: string; id?: string }[]
}) {
  const [expandedEditAttrs, setExpandedEditAttrs] = useState<Record<number,boolean>>({}); const prevEditCount = useRef(0)
  useEffect(()=>{if(props.editAttrs.length>prevEditCount.current){setExpandedEditAttrs(p=>({...p,[props.editAttrs.length-1]:true}))};prevEditCount.current=props.editAttrs.length},[props.editAttrs.length])
  useEffect(()=>{if(props.isEditing){setExpandedEditAttrs({});setEditTab('attrs')}},[props.isEditing])
  const [editTab, setEditTab] = useState<string>('attrs'); const etabClass = (tab:string) => `px-3 py-1.5 rounded text-xs font-medium transition-colors ${editTab===tab?'bg-primary/15 text-primary border border-primary/20':'text-muted hover:text-foreground'}`
  const allAttrs = props.editAttrs.filter(a=>a.key.trim()&&a.name.trim()).map(a=>({key:a.key.trim(),name:a.name.trim()}))
  const allEditAttrsForAc = props.editTemplateAttrs2 || props.editAttrs
  const editAcAttributeIdsValues = props.editAcAttributeIds ?? []

  if(props.isEditing) return <form onSubmit={props.onUpdate} className="rounded-lg border border-primary/30 bg-background/50 p-4 space-y-3">
    <div><label className="label">Name</label><input className="input-field" value={props.editName} onChange={e=>props.onEditNameChange(e.target.value)} maxLength={100} required/></div>
    <div><label className="label">Description <span className="text-muted font-normal">(optional)</span></label><input className="input-field" value={props.editDescription} onChange={e=>props.onEditDescriptionChange(e.target.value)} maxLength={200}/></div>
    <div className="flex gap-1 flex-wrap">
      <button type="button" onClick={()=>setEditTab('attrs')} className={etabClass('attrs')}>Attributes</button>
      <button type="button" onClick={()=>setEditTab('skills')} className={etabClass('skills')}>Skills</button>
      {props.onAddProfile&&<button type="button" onClick={()=>setEditTab('profiles')} className={etabClass('profiles')}>Skill Profiles</button>}
      {props.onAddCoreResource&&<button type="button" onClick={()=>setEditTab('coreResources')} className={etabClass('coreResources')}>Core Resources</button>}
      {props.onAddField&&<button type="button" onClick={()=>setEditTab('fields')} className={etabClass('fields')}>Custom Fields</button>}
      {props.onAddEditAcField&&<button type="button" onClick={()=>setEditTab('ac')} className={etabClass('ac')}>Armor Class</button>}
      <button type="button" onClick={()=>setEditTab('characterSections')} className={etabClass('characterSections')}>Character Sections</button>
      {props.onEditResistancesChange&&<button type="button" onClick={()=>setEditTab('resistances')} className={etabClass('resistances')}>Resistance System</button>}
    </div>

    {editTab==='attrs'&&<div><label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer mb-3"><input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={props.editAttrModifiersEnabled ?? false} onChange={e=>props.onEditAttrModifiersEnabledChange?.(e.target.checked)}/>Enable Attribute Modifiers</label>{(props.editAttrModifiersEnabled ?? false) && <div className="mb-3"><AttributeModifierConfig value={props.editAttrModifierFormula} onChange={v=>props.onEditAttrModifierFormulaChange?.(v)} placeholder="floor((value - 10) / 2)"/></div>}<div className="space-y-2 mt-1">{props.editAttrs.map((attr,idx)=><CollapsibleAttrCard key={idx} index={idx} attr={attr} isExpanded={!!expandedEditAttrs[idx]} onToggle={()=>setExpandedEditAttrs(p=>({...p,[idx]:!p[idx]}))} onUpdateAttr={props.onUpdateAttr} onRemove={()=>props.onRemoveAttr(idx)}/>)}</div><button type="button" onClick={props.onAddAttr} className="btn-ghost text-xs mt-2">+ Add Attribute</button></div>}
    {editTab==='skills'&&<div><div className="mb-3"><SkillCalculationConfig value={props.editSkillFormula} onChange={v=>props.onEditSkillFormulaChange?.(v)} customFields={(props.editFields||[]).filter(f=>f.key.trim()&&f.label.trim()).map(f=>({key:f.key.trim(),label:f.label.trim()}))} placeholder="e.g. value + mod(value)" disabled={!(props.editAttrModifiersEnabled ?? false)}/></div><div className="space-y-2 mt-1">{(props.editSkills||[]).map((s: any,idx)=><CollapsibleSkillCard key={idx} index={idx} skill={s} onUpdateSkill={props.onUpdateSkill} onRemove={()=>props.onRemoveSkill?.(idx)} attributes={allAttrs} onToggleAllowedAttr={props.onToggleSkillAllowedAttr} onUpdateDefaultAttr={(i,v)=>{props.onUpdateSkill?.(i,'defaultAttributeId',v)}}/>)}</div><button type="button" onClick={props.onAddSkill} className="btn-ghost text-xs mt-2">+ Add Skill</button></div>}
    {editTab==='profiles'&&<div><div className="space-y-2 mt-1">{(props.editProfiles||[]).map((p: any,pIdx)=><div key={pIdx} className="rounded-lg border border-border bg-background/30 p-3 space-y-2"><div className="flex items-center gap-1.5"><input className="input-field flex-1" value={p.name} onChange={e=>props.onUpdateProfile?.(pIdx,e.target.value)} placeholder="Profile name (e.g. mastery)"/><button type="button" onClick={()=>props.onRemoveProfile?.(pIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div><div className="rounded border border-border/50 bg-background/20 p-2 space-y-2"><label className="text-xs font-semibold text-muted uppercase tracking-wider">Applies To</label><div className="flex gap-2">{(['ALL_SKILLS','SELECTED_SKILLS'] as const).map(mode=><button key={mode} type="button" onClick={()=>{props.onUpdateProfileTargetMode?.(pIdx, mode)}} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${((p as any).targetMode??'ALL_SKILLS')===mode?'bg-primary/15 text-primary border border-primary/20':'text-muted hover:text-foreground border border-transparent'}`}>{mode==='ALL_SKILLS'?'All Skills':'Selected Skills'}</button>)}</div>{(p as any).targetMode==='SELECTED_SKILLS'&&<div className="space-y-1 max-h-40 overflow-y-auto">{props.editSkills?.filter((s: any)=>s.name.trim()).map((s: any)=>{const sid=s.name.trim();const selected=((p as any).targetSkillIds??[]).includes(sid);return(<label key={sid} className="flex items-center gap-2 text-xs text-foreground cursor-pointer py-0.5"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={selected} onChange={()=>{props.onToggleProfileSkill?.(pIdx, sid)}}/><span>{s.name.trim()}</span></label>)})}{(props.editSkills||[]).filter((s: any)=>s.name.trim()).length===0&&<p className="text-xs text-muted italic">Add skills to the template first.</p>}</div>}</div><div className="space-y-1 pl-2">{p.options.map((o: any,oIdx: number)=><div key={oIdx} className="flex items-center gap-1.5"><input className="input-field flex-1 text-xs" value={o.label} onChange={e=>props.onUpdateProfileOption?.(pIdx,oIdx,'label',e.target.value)} placeholder="Option label (e.g. Expert)"/><input className="input-field w-20 text-xs" type="number" value={o.value} onChange={e=>props.onUpdateProfileOption?.(pIdx,oIdx,'value',e.target.value)} placeholder="Value"/><button type="button" onClick={()=>props.onRemoveProfileOption?.(pIdx,oIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>)}</div><button type="button" onClick={()=>props.onAddProfileOption?.(pIdx)} className="btn-ghost text-xs">+ Add Option</button></div>)}</div><button type="button" onClick={props.onAddProfile} className="btn-ghost text-xs mt-2">+ Add Skill Modifier Profile</button></div>}

    {editTab==='coreResources'&&<div><div className="space-y-2 mt-1">{(props.editCoreResources||[]).map((cr: CoreResource, crIdx: number)=><div key={crIdx} className="rounded-lg border border-border bg-background/30 p-3 space-y-2"><div className="flex items-center gap-1.5"><input className="input-field flex-1" value={cr.displayName} onChange={e=>props.onUpdateCoreResource?.(crIdx,'displayName',e.target.value)} placeholder="Display Name (e.g. Health Points)"/><input className="input-field flex-1" value={cr.slug} onChange={e=>props.onUpdateCoreResource?.(crIdx,'slug',e.target.value)} placeholder="Slug (e.g. health_points)"/><button type="button" onClick={()=>props.onRemoveCoreResource?.(crIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div><div className="flex items-center gap-4 flex-wrap"><label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.enabled} onChange={e=>props.onUpdateCoreResourceEnabled?.(crIdx,e.target.checked)}/>Enabled</label><label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.editableByPlayer} onChange={e=>props.onUpdateCoreResourceEditable?.(crIdx,e.target.checked)}/>Editable by Player</label><label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={cr.showNotes} onChange={e=>props.onUpdateCoreResourceShowNotes?.(crIdx,e.target.checked)}/>Show Notes</label></div></div>)}</div><button type="button" onClick={props.onAddCoreResource} className="btn-ghost text-xs mt-2">+ Add Core Resource</button></div>}

    {editTab==='fields'&&<div><div className="space-y-2 mt-1">{(props.editFields||[]).map((f: any,idx)=><div key={idx} className="flex items-center gap-1.5"><input className="input-field flex-1" value={f.key} onChange={e=>props.onUpdateField?.(idx,'key',e.target.value)} placeholder="Key (e.g. class)"/><input className="input-field flex-1" value={f.label} onChange={e=>props.onUpdateField?.(idx,'label',e.target.value)} placeholder="Label (e.g. Class)"/><button type="button" onClick={()=>props.onRemoveField?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>)}</div><button type="button" onClick={props.onAddField} className="btn-ghost text-xs mt-2">+ Add Custom Field</button></div>}

    {editTab==='characterSections'&&<div><div className="space-y-2 mt-1">{(props.editCharacterSections||[]).map((s, idx) => (<div key={idx} className="flex items-center gap-1.5"><input className="input-field flex-1" value={s.name} onChange={e => props.onUpdateEditCharacterSection?.(idx, e.target.value)} placeholder="Section name (e.g. Talents)" /><button type="button" onClick={() => props.onRemoveEditCharacterSection?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>))}</div><button type="button" onClick={props.onAddEditCharacterSection} className="btn-ghost text-xs mt-2">+ Add Section</button></div>}

    {editTab==='ac'&&props.onAddEditAcField&&<div><div className="space-y-2 mt-1"><div className="rounded-lg border border-border bg-background/30 p-3 space-y-2"><label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer"><input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={props.editAcEnabled??false} onChange={e=>props.onEditAcEnabledChange?.(e.target.checked)}/>Enable Armor Class System</label>{(props.editAcEnabled??false)&&<div className="space-y-2 pl-2"><div><label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">AC Components</label><div className="space-y-1">{(props.editAcFields||[]).map((f: any,idx)=><div key={idx} className="rounded border border-border/50 bg-background/20 p-2 space-y-1"><div className="flex items-center gap-1"><input className="input-field flex-1 text-xs" value={f.name} onChange={e=>props.onUpdateEditAcField?.(idx,'name',e.target.value)} placeholder="Field name (e.g. Shield)"/><input className="input-field flex-1 text-xs" value={f.key} onChange={e=>props.onUpdateEditAcField?.(idx,'key',e.target.value)} placeholder="Key (e.g. shield)"/><button type="button" onClick={()=>props.onRemoveEditAcField?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div><div className="flex items-center gap-1"><input className="input-field flex-1 text-xs" value={f.defaultValue} onChange={e=>props.onUpdateEditAcField?.(idx,'defaultValue',e.target.value)} placeholder="Default value"/><input className="input-field flex-1 text-xs" value={f.description} onChange={e=>props.onUpdateEditAcField?.(idx,'description',e.target.value)} placeholder="Description (optional)"/><label className="flex items-center gap-1 text-xs text-muted shrink-0"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={f.editableByPlayer} onChange={e=>props.onUpdateEditAcFieldEditable?.(idx,e.target.checked)}/>Editable</label></div></div>)}</div><button type="button" onClick={props.onAddEditAcField} className="btn-ghost text-xs mt-1">+ Add AC Component</button></div><div className={!(props.editAttrModifiersEnabled ?? false) ? "opacity-50 pointer-events-none" : ""}><label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">Attribute Modifiers</label><div className="space-y-1">{allEditAttrsForAc.filter(a=>a.key.trim()&&a.name.trim()).map(attr=>(<label key={attr.key} className={`flex items-center gap-2 text-xs text-foreground py-1 ${(props.editAttrModifiersEnabled ?? false) ? 'cursor-pointer' : 'cursor-not-allowed'}`}><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={editAcAttributeIdsValues.includes(attr.key.trim())} onChange={()=>props.onToggleEditAcAttributeId?.(attr.key.trim())} disabled={!(props.editAttrModifiersEnabled ?? false)}/><span>{attr.name.trim()} Modifier</span></label>))}</div></div></div>}</div></div></div>}

    {editTab==='resistances'&&props.onEditResistancesChange&&<div>
      <ResistanceSystemConfig resistances={props.editResistances||[]} attributes={props.attrsForEditResistance.map(a => ({ id: a.id || '', key: a.key, name: a.name }))} onChange={props.onEditResistancesChange} disableAttributeModifiers={!(props.editAttrModifiersEnabled ?? false)} />
    </div>}

    {props.editError&&<div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{props.editError}</div>}
    <div className="flex gap-2 justify-end"><button type="button" onClick={props.onCancelEdit} disabled={props.saving} className="btn-ghost text-sm">Cancel</button><button type="submit" disabled={props.saving||!props.editName.trim()} className="btn-primary text-sm">{props.saving?'Saving...':'Save'}</button></div>
  </form>

  return <div className="flex items-start justify-between py-2.5 px-3 rounded-lg bg-background/50 border border-border"><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-medium text-foreground truncate">{props.template.name}</span><span className="badge badge-gold text-[0.6rem]">{props.template.attributes.length} Attributes</span></div>{props.template.description&&<p className="text-xs text-muted mt-0.5 truncate">{props.template.description}</p>}</div>{props.isGM&&<div className="flex gap-1 shrink-0 ml-2"><button onClick={props.onStartEdit} className="btn-ghost text-xs px-2 py-1">Edit</button><button onClick={props.onDelete} className="text-xs text-danger hover:text-danger/80 px-2 py-1 transition-colors">Delete</button></div>}</div>
}