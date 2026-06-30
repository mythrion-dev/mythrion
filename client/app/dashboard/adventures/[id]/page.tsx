'use client'

import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import Link from 'next/link'
import FormulaBuilder from '@/lib/formula-builder'

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
interface SkillModifierProfile { id: string; name: string; options: { id: string; label: string; value: number }[] }

interface RuntimeModifierComponent {
  id?: string; name: string; defaultValue: string; locked: boolean; formula: string
}
interface RuntimeModifier {
  id?: string; key: string; name: string; description: string
  components: RuntimeModifierComponent[]
}
interface TemplateArmorClassField {
  id: string; name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string | null
}
interface TemplateArmorClass {
  id: string; enabled: boolean; formula: string | null; fields: TemplateArmorClassField[]
}
interface Template {
  id: string; name: string; description: string | null
  attributes: { id: string; key: string; name: string; modifier: string | null }[]
  templateFields?: { id: string; key: string; label: string }[]
  templateSkills?: { id: string; name: string; description: string | null; formula: string | null }[]
  skillModifierProfiles?: SkillModifierProfile[]
  runtimeModifiers?: RuntimeModifier[]
  armorClass?: TemplateArmorClass | null
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
  const [newTemplateAttrs, setNewTemplateAttrs] = useState<{ key: string; name: string; modifier: string }[]>([])
  const [newTemplateFields, setNewTemplateFields] = useState<{ key: string; label: string }[]>([])
  const [templateCreating, setTemplateCreating] = useState(false); const [templateError, setTemplateError] = useState<string | null>(null)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null); const [editTemplateName, setEditTemplateName] = useState(''); const [editTemplateDescription, setEditTemplateDescription] = useState('')
  const [editTemplateAttrs, setEditTemplateAttrs] = useState<{ key: string; name: string; modifier: string }[]>([])
  const [editTemplateFields, setEditTemplateFields] = useState<{ key: string; label: string }[]>([])
  const [newTemplateSkills, setNewTemplateSkills] = useState<{ name: string; description: string; formula: string }[]>([]); const [editTemplateSkills, setEditTemplateSkills] = useState<{ name: string; description: string; formula: string }[]>([]); const [templateSaving, setTemplateSaving] = useState(false)
  const [newTemplateProfiles, setNewTemplateProfiles] = useState<{ name: string; options: { label: string; value: number }[] }[]>([]); const [editTemplateProfiles, setEditTemplateProfiles] = useState<{ name: string; options: { label: string; value: number }[] }[]>([])
  const [newTemplateModifiers, setNewTemplateModifiers] = useState<RuntimeModifier[]>([]); const [editTemplateModifiers, setEditTemplateModifiers] = useState<RuntimeModifier[]>([])

  // Armor Class state
  const [newAcEnabled, setNewAcEnabled] = useState(false); const [newAcFormula, setNewAcFormula] = useState(''); const [newAcFields, setNewAcFields] = useState<{ name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string }[]>([])
  const [editAcEnabled, setEditAcEnabled] = useState(false); const [editAcFormula, setEditAcFormula] = useState(''); const [editAcFields, setEditAcFields] = useState<{ name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string }[]>([])
  function addNewAcField() { setNewAcFields(p => [...p, { name: '', key: '', defaultValue: '0', editableByPlayer: false, description: '' }]) }
  function removeNewAcField(i: number) { setNewAcFields(p => p.filter((_,j) => j!==i)) }
  function updateNewAcField(i: number, f: 'name'|'key'|'defaultValue'|'description', v: string) { setNewAcFields(p => p.map((a,j) => j===i ? {...a, [f]: v} : a)) }
  function updateNewAcFieldEditable(i: number, v: boolean) { setNewAcFields(p => p.map((a,j) => j===i ? {...a, editableByPlayer: v} : a)) }
  function addEditAcField() { setEditAcFields(p => [...p, { name: '', key: '', defaultValue: '0', editableByPlayer: false, description: '' }]) }
  function removeEditAcField(i: number) { setEditAcFields(p => p.filter((_,j) => j!==i)) }
  function updateEditAcField(i: number, f: 'name'|'key'|'defaultValue'|'description', v: string) { setEditAcFields(p => p.map((a,j) => j===i ? {...a, [f]: v} : a)) }
  function updateEditAcFieldEditable(i: number, v: boolean) { setEditAcFields(p => p.map((a,j) => j===i ? {...a, editableByPlayer: v} : a)) }

  function addNewModifier() { setNewTemplateModifiers(p => [...p, { key: '', name: '', description: '', components: [{ name: '', defaultValue: '', locked: false, formula: '' }] }]) }
  function removeNewModifier(i: number) { setNewTemplateModifiers(p => p.filter((_,j) => j!==i)) }
  function updateNewModifier(i: number, f: 'key'|'name'|'description', v: string) { setNewTemplateModifiers(p => p.map((m,j) => j===i ? {...m,[f]:v} : m)) }
  function addNewComponent(mIdx: number) { setNewTemplateModifiers(p => p.map((m,i) => i===mIdx ? {...m,components:[...m.components,{name:'',defaultValue:'',locked:false,formula:''}]} : m)) }
  function removeNewComponent(mIdx: number, cIdx: number) { setNewTemplateModifiers(p => p.map((m,i) => i===mIdx ? {...m,components:m.components.filter((_,j) => j!==cIdx)} : m)) }
  function updateNewComponent(mIdx: number, cIdx: number, f: 'name'|'defaultValue'|'formula', v: string) { setNewTemplateModifiers(p => p.map((m,i) => i===mIdx ? {...m,components:m.components.map((c,j) => j===cIdx ? {...c,[f]:v} : c)} : m)) }
  function updateNewComponentLocked(mIdx: number, cIdx: number, v: boolean) { setNewTemplateModifiers(p => p.map((m,i) => i===mIdx ? {...m,components:m.components.map((c,j) => j===cIdx ? {...c,locked:v, ...(v ? {formula:''} : {})} : c)} : m)) }
  function addEditModifier() { setEditTemplateModifiers(p => [...p, { key: '', name: '', description: '', components: [{ name: '', defaultValue: '', locked: false, formula: '' }] }]) }
  function removeEditModifier(i: number) { setEditTemplateModifiers(p => p.filter((_,j) => j!==i)) }
  function updateEditModifier(i: number, f: 'key'|'name'|'description', v: string) { setEditTemplateModifiers(p => p.map((m,j) => j===i ? {...m,[f]:v} : m)) }
  function addEditComponent(mIdx: number) { setEditTemplateModifiers(p => p.map((m,i) => i===mIdx ? {...m,components:[...m.components,{name:'',defaultValue:'',locked:false,formula:''}]} : m)) }
  function removeEditComponent(mIdx: number, cIdx: number) { setEditTemplateModifiers(p => p.map((m,i) => i===mIdx ? {...m,components:m.components.filter((_,j) => j!==cIdx)} : m)) }
  function updateEditComponent(mIdx: number, cIdx: number, f: 'name'|'defaultValue'|'formula', v: string) { setEditTemplateModifiers(p => p.map((m,i) => i===mIdx ? {...m,components:m.components.map((c,j) => j===cIdx ? {...c,[f]:v} : c)} : m)) }
  function updateEditComponentLocked(mIdx: number, cIdx: number, v: boolean) { setEditTemplateModifiers(p => p.map((m,i) => i===mIdx ? {...m,components:m.components.map((c,j) => j===cIdx ? {...c,locked:v, ...(v ? {formula:''} : {})} : c)} : m)) }

  function addNewProfile() { setNewTemplateProfiles(p => [...p, { name: '', options: [{ label: '', value: 0 }] }]) }
  function removeNewProfile(i: number) { setNewTemplateProfiles(p => p.filter((_,j) => j!==i)) }
  function updateNewProfile(i: number, n: string) { setNewTemplateProfiles(p => p.map((a,j) => j===i ? {...a,name:n} : a)) }
  function addNewProfileOption(pIdx: number) { setNewTemplateProfiles(p => p.map((a,i) => i===pIdx ? {...a,options:[...a.options,{label:'',value:0}]} : a)) }
  function removeNewProfileOption(pIdx: number, oIdx: number) { setNewTemplateProfiles(p => p.map((a,i) => i===pIdx ? {...a,options:a.options.filter((_,j)=>j!==oIdx)} : a)) }
  function updateNewProfileOption(pIdx: number, oIdx: number, f: 'label'|'value', v: string|number) { setNewTemplateProfiles(p => p.map((a,i) => i===pIdx ? {...a,options:a.options.map((o,j)=>j===oIdx ? {...o,[f]:f==='value'?Number(v):v} : o)} : a)) }
  function addEditProfile() { setEditTemplateProfiles(p => [...p, { name: '', options: [{ label: '', value: 0 }] }]) }
  function removeEditProfile(i: number) { setEditTemplateProfiles(p => p.filter((_,j) => j!==i)) }
  function updateEditProfile(i: number, n: string) { setEditTemplateProfiles(p => p.map((a,j) => j===i ? {...a,name:n} : a)) }
  function addEditProfileOption(pIdx: number) { setEditTemplateProfiles(p => p.map((a,i) => i===pIdx ? {...a,options:[...a.options,{label:'',value:0}]} : a)) }
  function removeEditProfileOption(pIdx: number, oIdx: number) { setEditTemplateProfiles(p => p.map((a,i) => i===pIdx ? {...a,options:a.options.filter((_,j)=>j!==oIdx)} : a)) }
  function updateEditProfileOption(pIdx: number, oIdx: number, f: 'label'|'value', v: string|number) { setEditTemplateProfiles(p => p.map((a,i) => i===pIdx ? {...a,options:a.options.map((o,j)=>j===oIdx ? {...o,[f]:f==='value'?Number(v):v} : o)} : a)) }
  function addNewSkillRow() { setNewTemplateSkills(p => [...p, { name: '', description: '', formula: '' }]) }; function removeNewSkillRow(i: number) { setNewTemplateSkills(p => p.filter((_,j)=>j!==i)) }; function updateNewSkill(i: number, f: 'name'|'description'|'formula', v: string) { setNewTemplateSkills(p => p.map((s,j)=>j===i?{...s,[f]:v}:s)) }
  function addEditSkillRow() { setEditTemplateSkills(p => [...p, { name: '', description: '', formula: '' }]) }; function removeEditSkillRow(i: number) { setEditTemplateSkills(p => p.filter((_,j)=>j!==i)) }; function updateEditSkill(i: number, f: 'name'|'description'|'formula', v: string) { setEditTemplateSkills(p => p.map((s,j)=>j===i?{...s,[f]:v}:s)) }
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

  function resetNewTemplate() { setShowNewTemplate(false); setNewTemplateName(''); setNewTemplateDescription(''); setNewTemplateAttrs([]); setNewTemplateFields([]); setNewTemplateSkills([]); setNewTemplateProfiles([]); setNewTemplateModifiers([]); setTemplateError(null) }
  function addNewAttrRow() { setNewTemplateAttrs(p => [...p, { key: '', name: '', modifier: '' }]) }; function removeNewAttrRow(i: number) { setNewTemplateAttrs(p => p.filter((_,j)=>j!==i)) }; function updateNewAttr(i: number, f: 'key'|'name'|'modifier', v: string) { setNewTemplateAttrs(p => p.map((a,j)=>j===i?{...a,[f]:v}:a)) }
  function addNewFieldRow() { setNewTemplateFields(p => [...p, { key: '', label: '' }]) }; function removeNewFieldRow(i: number) { setNewTemplateFields(p => p.filter((_,j)=>j!==i)) }; function updateNewField(i: number, f: 'key'|'label', v: string) { setNewTemplateFields(p => p.map((a,j)=>j===i?{...a,[f]:v}:a)) }
  function addEditAttrRow() { setEditTemplateAttrs(p => [...p, { key: '', name: '', modifier: '' }]) }; function removeEditAttrRow(i: number) { setEditTemplateAttrs(p => p.filter((_,j)=>j!==i)) }; function updateEditAttr(i: number, f: 'key'|'name'|'modifier', v: string) { setEditTemplateAttrs(p => p.map((a,j)=>j===i?{...a,[f]:v}:a)) }
  function addEditFieldRow() { setEditTemplateFields(p => [...p, { key: '', label: '' }]) }; function removeEditFieldRow(i: number) { setEditTemplateFields(p => p.filter((_,j)=>j!==i)) }; function updateEditField(i: number, f: 'key'|'label', v: string) { setEditTemplateFields(p => p.map((a,j)=>j===i?{...a,[f]:v}:a)) }

  function validateModifiers(modifiers: { key: string; name: string }[]) {
    const valid = modifiers.filter(m => m.key.trim() && m.name.trim()); const keys = new Set<string>(); const names = new Set<string>()
    for (const m of valid) { const k=m.key.trim(), n=m.name.trim(); if(keys.has(k)) return `Duplicate key: "${k}"`; if(names.has(n)) return `Duplicate name: "${n}"`; keys.add(k); names.add(n) }
    return null
  }

  async function handleCreateTemplate(e: FormEvent) { e.preventDefault(); setTemplateError(null)
    const ta = newTemplateAttrs.map(a=>({key:a.key.trim(),name:a.name.trim(),modifier:a.modifier.trim()||undefined}))
    if(ta.some(a=>!a.key||!a.name)){setTemplateError('All attributes must have a key and name');return}
    const ve = validateModifiers(newTemplateModifiers); if(ve){setTemplateError(ve);return}
    setTemplateCreating(true)
    try {
      await api.post(`/adventures/${id}/templates`, {
        name: newTemplateName.trim(), description: newTemplateDescription.trim()||undefined, attributes: ta,
        templateFields: newTemplateFields.filter(f=>f.key.trim()&&f.label.trim()).map(f=>({key:f.key.trim(),label:f.label.trim()})),
        skills: newTemplateSkills.filter(s=>s.name.trim()).map(s=>({name:s.name.trim(),description:s.description.trim()||undefined,formula:s.formula.trim()||undefined})),
        skillModifierProfiles: newTemplateProfiles.filter(p=>p.name.trim()).map(p=>({name:p.name.trim(),options:p.options.filter(o=>o.label.trim()).map(o=>({label:o.label.trim(),value:o.value}))})),
        runtimeModifiers: newTemplateModifiers.filter(m=>m.key.trim()&&m.name.trim()).map(m=>({key:m.key.trim(),name:m.name.trim(),description:m.description.trim()||undefined,components:m.components.filter(c=>c.name.trim()).map(c=>({name:c.name.trim(),defaultValue:c.defaultValue.trim()||undefined,locked:c.locked,formula:c.formula.trim()||undefined}))})),
        armorClass: newAcEnabled ? { enabled: true, formula: newAcFormula.trim()||undefined, fields: newAcFields.filter(f=>f.name.trim()&&f.key.trim()).map(f=>({name:f.name.trim(),key:f.key.trim(),defaultValue:f.defaultValue.trim()||'0',editableByPlayer:f.editableByPlayer,description:f.description.trim()||undefined})) } : undefined,
      })
      resetNewTemplate(); fetchTemplates()
    } catch(err) { setTemplateError(err instanceof Error ? err.message : 'Failed to create template') } finally { setTemplateCreating(false) }
  }

  function startEditTemplate(t: Template) { setEditingTemplateId(t.id); setEditTemplateName(t.name); setEditTemplateDescription(t.description??'');
    setEditTemplateAttrs(t.attributes.map(a=>({key:a.key,name:a.name,modifier:a.modifier??''})));
    setEditTemplateFields((t.templateFields||[]).map(f=>({key:f.key,label:f.label})));
    setEditTemplateSkills((t.templateSkills||[]).map(s=>({name:s.name,description:s.description??'',formula:s.formula??''})));
    setEditTemplateProfiles((t.skillModifierProfiles||[]).map(p=>({name:p.name,options:p.options.map(o=>({label:o.label,value:o.value}))})));
    setEditTemplateModifiers((t.runtimeModifiers||[]).map(m=>({key:m.key,name:m.name,description:m.description??'',components:(m as any).components?.map((c:any)=>({name:c.name,defaultValue:c.defaultValue??'',locked:c.locked??false,formula:c.formula??''}))||[]})));
    const ac = t.armorClass; if (ac) { setEditAcEnabled(ac.enabled); setEditAcFormula(ac.formula??''); setEditAcFields(ac.fields.map(f=>({name:f.name,key:f.key,defaultValue:f.defaultValue??'0',editableByPlayer:f.editableByPlayer,description:f.description??''}))) } else { setEditAcEnabled(false); setEditAcFormula(''); setEditAcFields([]) }
    setEditingTemplateError(null) }
  function cancelEditTemplate() { setEditingTemplateId(null); setEditingTemplateError(null) }

  async function handleUpdateTemplate(e: FormEvent) { e.preventDefault(); if(!editingTemplateId)return; setEditingTemplateError(null)
    const ta = editTemplateAttrs.map(a=>({key:a.key.trim(),name:a.name.trim(),modifier:a.modifier.trim()||undefined}))
    if(ta.some(a=>!a.key||!a.name)){setEditingTemplateError('All attributes must have a key and name');return}
    const ve = validateModifiers(editTemplateModifiers); if(ve){setEditingTemplateError(ve);return}
    setTemplateSaving(true)
    try {
      await api.patch(`/adventures/${id}/templates/${editingTemplateId}`, {
        name: editTemplateName.trim(), description: editTemplateDescription.trim()||undefined, attributes: ta,
        templateFields: editTemplateFields.filter(f=>f.key.trim()&&f.label.trim()).map(f=>({key:f.key.trim(),label:f.label.trim()})),
        skills: editTemplateSkills.filter(s=>s.name.trim()).map(s=>({name:s.name.trim(),description:s.description.trim()||undefined,formula:s.formula.trim()||undefined})),
        skillModifierProfiles: editTemplateProfiles.filter(p=>p.name.trim()).map(p=>({name:p.name.trim(),options:p.options.filter(o=>o.label.trim()).map(o=>({label:o.label.trim(),value:o.value}))})),
        runtimeModifiers: editTemplateModifiers.filter(m=>m.key.trim()&&m.name.trim()).map(m=>({key:m.key.trim(),name:m.name.trim(),description:m.description.trim()||undefined,components:m.components.filter(c=>c.name.trim()).map(c=>({name:c.name.trim(),defaultValue:c.defaultValue.trim()||undefined,locked:c.locked,formula:c.formula.trim()||undefined}))})),
        armorClass: editAcEnabled ? { enabled: true, formula: editAcFormula.trim()||undefined, fields: editAcFields.filter(f=>f.name.trim()&&f.key.trim()).map(f=>({name:f.name.trim(),key:f.key.trim(),defaultValue:f.defaultValue.trim()||'0',editableByPlayer:f.editableByPlayer,description:f.description.trim()||undefined})) } : { enabled: false },
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
      <div className="mb-6"><Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>Back to Dashboard</Link></div>
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
            newTemplateName={newTemplateName} newTemplateDescription={newTemplateDescription} newTemplateAttrs={newTemplateAttrs} newTemplateFields={newTemplateFields} templateError={templateError} templateCreating={templateCreating}
            editTemplateName={editTemplateName} editTemplateDescription={editTemplateDescription} editTemplateAttrs={editTemplateAttrs} editingTemplateError={editingTemplateError} templateSaving={templateSaving}
            onNewClick={()=>setShowNewTemplate(true)} onCancelNew={resetNewTemplate} onCreateTemplate={handleCreateTemplate}
            onNameChange={setNewTemplateName} onDescriptionChange={setNewTemplateDescription} onAddAttr={addNewAttrRow} onRemoveAttr={removeNewAttrRow} onUpdateAttr={updateNewAttr}
            onAddField={addNewFieldRow} onRemoveField={removeNewFieldRow} onUpdateField={updateNewField}
            newTemplateSkills={newTemplateSkills} onAddSkill={addNewSkillRow} onRemoveSkill={removeNewSkillRow} onUpdateSkill={updateNewSkill}
            onStartEdit={startEditTemplate} onCancelEdit={cancelEditTemplate} onUpdateTemplate={handleUpdateTemplate} onDeleteTemplate={handleDeleteTemplate}
            onEditNameChange={setEditTemplateName} onEditDescriptionChange={setEditTemplateDescription} onAddEditAttr={addEditAttrRow} onRemoveEditAttr={removeEditAttrRow} onUpdateEditAttr={updateEditAttr}
            editTemplateFields={editTemplateFields} onAddEditField={addEditFieldRow} onRemoveEditField={removeEditFieldRow} onUpdateEditField={updateEditField}
            editTemplateSkills={editTemplateSkills} onAddEditSkill={addEditSkillRow} onRemoveEditSkill={removeEditSkillRow} onUpdateEditSkill={updateEditSkill}
            newTemplateProfiles={newTemplateProfiles} editTemplateProfiles={editTemplateProfiles}
            onAddProfile={addNewProfile} onRemoveProfile={removeNewProfile} onUpdateProfile={updateNewProfile} onAddProfileOption={addNewProfileOption} onRemoveProfileOption={removeNewProfileOption} onUpdateProfileOption={updateNewProfileOption}
            onAddEditProfile={addEditProfile} onRemoveEditProfile={removeEditProfile} onUpdateEditProfile={updateEditProfile} onAddEditProfileOption={addEditProfileOption} onRemoveEditProfileOption={removeEditProfileOption} onUpdateEditProfileOption={updateEditProfileOption}
            newTemplateModifiers={newTemplateModifiers} editTemplateModifiers={editTemplateModifiers}
            onAddModifier={addNewModifier} onRemoveModifier={removeNewModifier} onUpdateModifier={updateNewModifier}
            onAddComponent={addNewComponent} onRemoveComponent={removeNewComponent} onUpdateComponent={updateNewComponent} onUpdateComponentLocked={updateNewComponentLocked}
            onAddEditModifier={addEditModifier} onRemoveEditModifier={removeEditModifier} onUpdateEditModifier={updateEditModifier}
            onAddEditComponent={addEditComponent} onRemoveEditComponent={removeEditComponent} onUpdateEditComponent={updateEditComponent} onUpdateEditComponentLocked={updateEditComponentLocked}
            newAcEnabled={newAcEnabled} newAcFormula={newAcFormula} newAcFields={newAcFields}
            onNewAcEnabledChange={setNewAcEnabled} onNewAcFormulaChange={setNewAcFormula}
            onAddNewAcField={addNewAcField} onRemoveNewAcField={removeNewAcField} onUpdateNewAcField={updateNewAcField} onUpdateNewAcFieldEditable={updateNewAcFieldEditable}
            editAcEnabled={editAcEnabled} editAcFormula={editAcFormula} editAcFields={editAcFields}
            onEditAcEnabledChange={setEditAcEnabled} onEditAcFormulaChange={setEditAcFormula}
            onAddEditAcField={addEditAcField} onRemoveEditAcField={removeEditAcField} onUpdateEditAcField={updateEditAcField} onUpdateEditAcFieldEditable={updateEditAcFieldEditable}
          />
        )}
        {confirmDelete && <DeleteModal name={adventure.name} error={deleteError} loading={deleting} onCancel={()=>setConfirmDelete(false)} onConfirm={handleDelete} />}
      </div>) : (<EditForm name={editName} campaign={editCampaign} synopsis={editSynopsis} maxPlayers={editMaxPlayers} error={editError} saving={saving} onNameChange={setEditName} onCampaignChange={setEditCampaign} onSynopsisChange={setEditSynopsis} onMaxPlayersChange={setEditMaxPlayers} onCancel={()=>{setEditing(false);setEditError(null)}} onSubmit={handleUpdate} />)}
    </main>
  )
}

function AdventureHeader({adventure,isGM,userRole,onEdit,onDelete}:{adventure:Adventure;isGM:boolean;userRole:string|null;onEdit:()=>void;onDelete:()=>void}){return <div className="card !p-6 space-y-4"><div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"><div className="flex-1 min-w-0"><h1 className="text-2xl font-bold text-gradient truncate">{adventure.name}</h1><div className="flex flex-wrap items-center gap-2 mt-2"><span className="badge badge-gold">{adventure.campaign}</span><span className="badge badge-gold">👥 {adventure.maxPlayers} {adventure.maxPlayers===1?'player':'players'}</span>{userRole&&<span className={`badge text-[0.6rem] ${isGM?'badge-gold':''}`} style={!isGM?{background:'rgba(124,92,231,0.15)',color:'#9070f0',border:'1px solid rgba(124,92,231,0.2)'}:undefined}>{userRole}</span>}<span className="text-xs text-muted">Created {new Date(adventure.createdAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span></div></div>{isGM&&<div className="flex gap-2 shrink-0"><button onClick={onEdit} className="btn-ghost"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>Edit</button><button onClick={onDelete} className="btn-danger"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>Delete</button></div>}</div><hr className="divider" />{adventure.synopsis?<div><h3 className="text-sm font-medium text-muted mb-2">Synopsis</h3><p className="text-foreground/80 leading-relaxed whitespace-pre-wrap text-sm">{adventure.synopsis}</p></div>:<div className="text-center py-8 text-muted-foreground text-sm italic">No synopsis yet.{isGM&&' Click edit to add one.'}</div>}</div>}
function CollapsibleSection({title,expanded,onToggle,children}:{title:string;expanded:boolean;onToggle:()=>void;children:React.ReactNode}){return <div className="card !p-6"><button onClick={onToggle} className="flex items-center justify-between w-full text-left"><h3 className="font-semibold">{title}</h3><svg className={`w-5 h-5 text-muted transition-transform ${expanded?'rotate-180':''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg></button>{expanded&&<div className="mt-4">{children}</div>}</div>}
function MemberRow({member,isGM,isSelf,onRemove}:{member:Member;isGM:boolean;isSelf:boolean;onRemove:()=>void}){return <div className="flex items-center justify-between py-2 border-b border-border last:border-0"><div className="flex items-center gap-2"><span className="text-sm text-foreground">{member.user.displayName??member.user.email}</span><span className={`badge text-[0.6rem] ${member.role==='GM'?'badge-gold':''}`} style={member.role!=='GM'?{background:'rgba(124,92,231,0.15)',color:'#9070f0',border:'1px solid rgba(124,92,231,0.2)'}:undefined}>{member.role}</span></div>{isGM&&!isSelf&&<button onClick={onRemove} className="text-xs text-danger hover:text-danger/80 transition-colors">Remove</button>}</div>}
function InvitePanel(props:{inviteRole:string;inviteEmail:string;inviteLink:string|null;inviteError:string|null;inviteSending:boolean;invitations:Invitation[];onRoleChange:(r:'PLAYER'|'GM')=>void;onEmailChange:(e:string)=>void;onInviteByEmail:(e:FormEvent)=>void;onInviteByLink:()=>void;onRevoke:(id:string)=>void}){return <div className="space-y-4"><div><label className="label">Role</label><div className="flex gap-2">{(['PLAYER','GM']as const).map(r=><button key={r} onClick={()=>props.onRoleChange(r)} className={`btn-ghost text-sm ${props.inviteRole===r?'!border-primary/40 !text-primary':''}`}>{r}</button>)}</div></div><form onSubmit={props.onInviteByEmail} className="space-y-3"><div><label className="label">Invite by Email</label><div className="flex gap-2"><input type="email" value={props.inviteEmail} onChange={e=>props.onEmailChange(e.target.value)} className="input-field flex-1" placeholder="player@example.com"/><button type="submit" disabled={props.inviteSending||props.inviteEmail.trim().length===0} className="btn-primary">Send</button></div></div></form><div><label className="label">Invite by Link</label><button onClick={props.onInviteByLink} disabled={props.inviteSending} className="btn-ghost">Generate invite link</button>{props.inviteLink&&<div className="mt-2 flex items-center gap-2"><input readOnly value={props.inviteLink} className="input-field flex-1 text-xs" onFocus={e=>e.target.select()}/><button onClick={()=>navigator.clipboard.writeText(props.inviteLink!)} className="btn-ghost text-xs">Copy</button></div>}</div>{props.inviteError&&<div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{props.inviteError}</div>}{props.invitations.length>0&&<div className="space-y-2"><h4 className="text-sm font-medium text-muted">Pending Invitations</h4>{props.invitations.map(inv=><div key={inv.id} className="flex items-center justify-between text-sm py-1"><span className="text-muted-foreground">{inv.invitedEmail??'Link invitation'}</span><button onClick={()=>props.onRevoke(inv.id)} className="text-xs text-danger hover:text-danger/80 transition-colors">Revoke</button></div>)}</div>}</div>}
function DeleteModal({name,error,loading,onCancel,onConfirm}:{name:string;error:string|null;loading:boolean;onCancel:()=>void;onConfirm:()=>void}){return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in"><div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center"><svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg></div><div><h2 className="font-semibold">Delete Adventure</h2><p className="text-sm text-muted-foreground">This action cannot be undone.</p></div></div><p className="text-sm text-muted-foreground">Are you sure you want to delete "{name}"?</p>{error&&<div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{error}</div>}<div className="flex gap-3 justify-end"><button onClick={onCancel} disabled={loading} className="btn-ghost">Cancel</button><button onClick={onConfirm} disabled={loading} className="btn-danger-solid">{loading?'Deleting...':'Delete forever'}</button></div></div></div>}
function EditForm(props:{name:string;campaign:string;synopsis:string;maxPlayers:number;error:string|null;saving:boolean;onNameChange:(v:string)=>void;onCampaignChange:(v:string)=>void;onSynopsisChange:(v:string)=>void;onMaxPlayersChange:(v:number)=>void;onCancel:()=>void;onSubmit:(e:FormEvent)=>void}){return <form onSubmit={props.onSubmit} className="card !p-6 space-y-4 animate-slide-up"><div className="flex items-center gap-3 mb-2"><svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg><h2 className="text-xl font-semibold text-gradient">Edit Adventure</h2></div><div><label className="label">Adventure Name</label><input className="input-field" value={props.name} onChange={e=>props.onNameChange(e.target.value)} maxLength={100}/></div><div><label className="label">Campaign</label><input className="input-field" value={props.campaign} onChange={e=>props.onCampaignChange(e.target.value)} maxLength={50}/></div><div><label className="label">Synopsis <span className="text-muted font-normal">(optional)</span></label><textarea className="input-field resize-none" rows={5} value={props.synopsis} onChange={e=>props.onSynopsisChange(e.target.value)} maxLength={2000}/><p className="text-xs text-muted mt-1.5 text-right">{props.synopsis.length}/2000</p></div><div><label className="label">Max Players</label><div className="flex items-center gap-3"><input type="range" min={1} max={5} value={props.maxPlayers} onChange={e=>props.onMaxPlayersChange(Number(e.target.value))} className="flex-1 h-2 rounded-lg appearance-none cursor-pointer" style={{background:`linear-gradient(to right, #c9a44b 0%, #c9a44b ${((props.maxPlayers-1)/4)*100}%, #2a2240 ${((props.maxPlayers-1)/4)*100}%, #2a2240 100%)`}}/><span className="badge badge-gold min-w-[2rem] text-center">{props.maxPlayers}</span></div></div>{props.error&&<div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{props.error}</div>}<div className="flex gap-3 justify-end pt-2"><button type="button" onClick={props.onCancel} disabled={props.saving} className="btn-ghost">Cancel</button><button type="submit" disabled={props.saving||props.name.trim().length===0} className="btn-primary">{props.saving?<><div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"/>Saving...</>:'Save Changes'}</button></div></form>}
function CharactersSection(props:{characters:CampaignCharacter[];isGM:boolean;userId:string;templates:Template[];userSheets:UserSheet[];showNewCharForm:boolean;showLinkCharForm:boolean;newCharName:string;newCharTemplateId:string;newCharError:string|null;newCharCreating:boolean;linkSheetId:string;linkCharError:string|null;linkCharLinking:boolean;onNewCharClick:()=>void;onLinkCharClick:()=>void;onCancelNewChar:()=>void;onCancelLinkChar:()=>void;onCreateCharacter:(e:FormEvent)=>void;onLinkCharacter:(e:FormEvent)=>void;onNewCharNameChange:(v:string)=>void;onNewCharTemplateChange:(v:string)=>void;onLinkSheetChange:(v:string)=>void;onRemoveCharacter:(id:string)=>void;onViewCharacter:(id:string)=>void}){return <div className="space-y-4">{props.characters.length===0&&!props.showNewCharForm&&!props.showLinkCharForm?<div className="text-center py-6 text-muted-foreground text-sm italic">No characters in this campaign yet.</div>:<div className="space-y-2">{props.characters.map(c=><div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0"><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-medium text-foreground truncate">{c.characterName}</span><span className="badge badge-gold text-[0.6rem]">{c.template.name}</span></div><p className="text-xs text-muted mt-0.5">{c.owner.displayName??c.owner.email}</p></div><div className="flex gap-1 shrink-0 ml-2"><button onClick={()=>props.onViewCharacter(c.id)} className="btn-ghost text-xs px-2 py-1">View</button>{props.isGM&&c.owner.id!==props.userId&&<button onClick={()=>props.onRemoveCharacter(c.id)} className="text-xs text-danger hover:text-danger/80 px-2 py-1 transition-colors">Remove</button>}</div></div>)}</div>}{!props.showNewCharForm&&!props.showLinkCharForm&&<div className="flex gap-2"><button onClick={props.onNewCharClick} className="btn-primary text-sm">+ New Character</button><button onClick={props.onLinkCharClick} className="btn-ghost text-sm">Link Existing Character</button></div>}{props.showNewCharForm&&<form onSubmit={props.onCreateCharacter} className="rounded-lg border border-primary/20 bg-background/50 p-4 space-y-3"><h4 className="text-sm font-semibold text-primary">Create New Character</h4><div><label className="label">Character Name</label><input className="input-field" value={props.newCharName} onChange={e=>props.onNewCharNameChange(e.target.value)} placeholder="e.g. Aragorn" maxLength={100} required/></div><div><label className="label">Template</label>{props.templates.length===0?<p className="text-sm text-muted italic">No templates available. Ask your GM to create one.</p>:<select className="input-field" value={props.newCharTemplateId} onChange={e=>props.onNewCharTemplateChange(e.target.value)} required><option value="">Select a template...</option>{props.templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>}</div>{props.newCharError&&<div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{props.newCharError}</div>}<div className="flex gap-2 justify-end"><button type="button" onClick={props.onCancelNewChar} disabled={props.newCharCreating} className="btn-ghost text-sm">Cancel</button><button type="submit" disabled={props.newCharCreating||!props.newCharName.trim()||!props.newCharTemplateId} className="btn-primary text-sm">{props.newCharCreating?'Creating...':'Create'}</button></div></form>}{props.showLinkCharForm&&<form onSubmit={props.onLinkCharacter} className="rounded-lg border border-primary/20 bg-background/50 p-4 space-y-3"><h4 className="text-sm font-semibold text-primary">Link Existing Character</h4><div><label className="label">Select Character</label>{props.userSheets.length===0?<p className="text-sm text-muted italic">No unlinked characters available.</p>:<select className="input-field" value={props.linkSheetId} onChange={e=>props.onLinkSheetChange(e.target.value)} required><option value="">Select a character...</option>{props.userSheets.map(s=><option key={s.id} value={s.id}>{s.characterName} ({s.template.name})</option>)}</select>}</div>{props.linkCharError&&<div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{props.linkCharError}</div>}<div className="flex gap-2 justify-end"><button type="button" onClick={props.onCancelLinkChar} disabled={props.linkCharLinking} className="btn-ghost text-sm">Cancel</button><button type="submit" disabled={props.linkCharLinking||!props.linkSheetId} className="btn-primary text-sm">{props.linkCharLinking?'Linking...':'Link'}</button></div></form>}</div>}

function TemplatesSection(props: {
  templates: Template[]; isGM: boolean; showNewTemplate: boolean; editingTemplateId: string | null
  newTemplateName: string; newTemplateDescription: string; newTemplateAttrs: { key: string; name: string; modifier: string }[]; newTemplateFields?: { key: string; label: string }[]; templateError: string | null; templateCreating: boolean
  editTemplateName: string; editTemplateDescription: string; editTemplateAttrs: { key: string; name: string; modifier: string }[]; editTemplateFields?: { key: string; label: string }[]; editingTemplateError: string | null; templateSaving: boolean
  onNewClick: () => void; onCancelNew: () => void; onCreateTemplate: (e: FormEvent) => void; onNameChange: (v: string) => void; onDescriptionChange: (v: string) => void
  onAddAttr: () => void; onRemoveAttr: (i: number) => void; onUpdateAttr: (i: number, f: 'key'|'name'|'modifier', v: string) => void
  onAddField?: () => void; onRemoveField?: (i: number) => void; onUpdateField?: (i: number, f: 'key'|'label', v: string) => void
  onStartEdit: (t: Template) => void; onCancelEdit: () => void; onUpdateTemplate: (e: FormEvent) => void; onDeleteTemplate: (id: string) => void
  onEditNameChange: (v: string) => void; onEditDescriptionChange: (v: string) => void; onAddEditAttr: () => void; onRemoveEditAttr: (i: number) => void; onUpdateEditAttr: (i: number, f: 'key'|'name'|'modifier', v: string) => void
  onAddEditField?: () => void; onRemoveEditField?: (i: number) => void; onUpdateEditField?: (i: number, f: 'key'|'label', v: string) => void
  newTemplateSkills?: { name: string; description: string; formula: string }[]; editTemplateSkills?: { name: string; description: string; formula: string }[]
  onAddSkill?: () => void; onRemoveSkill?: (i: number) => void; onUpdateSkill?: (i: number, f: 'name'|'description'|'formula', v: string) => void
  onAddEditSkill?: () => void; onRemoveEditSkill?: (i: number) => void; onUpdateEditSkill?: (i: number, f: 'name'|'description'|'formula', v: string) => void
  newTemplateProfiles?: { name: string; options: { label: string; value: number }[] }[]; editTemplateProfiles?: { name: string; options: { label: string; value: number }[] }[]
  onAddProfile?: () => void; onRemoveProfile?: (i: number) => void; onUpdateProfile?: (i: number, n: string) => void
  onAddProfileOption?: (pIdx: number) => void; onRemoveProfileOption?: (pIdx: number, oIdx: number) => void; onUpdateProfileOption?: (pIdx: number, oIdx: number, f: 'label'|'value', v: string|number) => void
  onAddEditProfile?: () => void; onRemoveEditProfile?: (i: number) => void; onUpdateEditProfile?: (i: number, n: string) => void
  onAddEditProfileOption?: (pIdx: number) => void; onRemoveEditProfileOption?: (pIdx: number, oIdx: number) => void; onUpdateEditProfileOption?: (pIdx: number, oIdx: number, f: 'label'|'value', v: string|number) => void
  // Runtime modifiers component-based
  newTemplateModifiers?: RuntimeModifier[]; editTemplateModifiers?: RuntimeModifier[]
  onAddModifier?: () => void; onRemoveModifier?: (i: number) => void; onUpdateModifier?: (i: number, f: 'key'|'name'|'description', v: string) => void
  onAddComponent?: (mIdx: number) => void; onRemoveComponent?: (mIdx: number, cIdx: number) => void; onUpdateComponent?: (mIdx: number, cIdx: number, f: 'name'|'defaultValue'|'formula', v: string) => void; onUpdateComponentLocked?: (mIdx: number, cIdx: number, v: boolean) => void
  onAddEditModifier?: () => void; onRemoveEditModifier?: (i: number) => void; onUpdateEditModifier?: (i: number, f: 'key'|'name'|'description', v: string) => void
  onAddEditComponent?: (mIdx: number) => void; onRemoveEditComponent?: (mIdx: number, cIdx: number) => void; onUpdateEditComponent?: (mIdx: number, cIdx: number, f: 'name'|'defaultValue'|'formula', v: string) => void; onUpdateEditComponentLocked?: (mIdx: number, cIdx: number, v: boolean) => void
  // Armor Class
  newAcEnabled?: boolean; newAcFormula?: string; newAcFields?: { name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string }[]
  onNewAcEnabledChange?: (v: boolean) => void; onNewAcFormulaChange?: (v: string) => void
  onAddNewAcField?: () => void; onRemoveNewAcField?: (i: number) => void; onUpdateNewAcField?: (i: number, f: 'name'|'key'|'defaultValue'|'description', v: string) => void; onUpdateNewAcFieldEditable?: (i: number, v: boolean) => void
  editAcEnabled?: boolean; editAcFormula?: string; editAcFields?: { name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string }[]
  onEditAcEnabledChange?: (v: boolean) => void; onEditAcFormulaChange?: (v: string) => void
  onAddEditAcField?: () => void; onRemoveEditAcField?: (i: number) => void; onUpdateEditAcField?: (i: number, f: 'name'|'key'|'defaultValue'|'description', v: string) => void; onUpdateEditAcFieldEditable?: (i: number, v: boolean) => void
}) {
  return <div className="space-y-4">
    {props.templates.length===0&&!props.showNewTemplate ? <div className="text-center py-6 text-muted-foreground text-sm italic">No templates defined yet.{props.isGM&&' Create one below to allow players to build character sheets.'}</div>
    : <div className="space-y-3">{props.templates.map(t=><TemplateRow key={t.id} template={t} isGM={props.isGM} isEditing={props.editingTemplateId===t.id} editName={props.editTemplateName} editDescription={props.editTemplateDescription} editAttrs={props.editTemplateAttrs} editFields={props.editTemplateFields} editSkills={props.editTemplateSkills} editError={props.editingTemplateError} saving={props.templateSaving} onStartEdit={()=>props.onStartEdit(t)} onCancelEdit={props.onCancelEdit} onUpdate={props.onUpdateTemplate} onDelete={()=>props.onDeleteTemplate(t.id)} onEditNameChange={props.onEditNameChange} onEditDescriptionChange={props.onEditDescriptionChange} onAddAttr={props.onAddEditAttr} onRemoveAttr={props.onRemoveEditAttr} onUpdateAttr={props.onUpdateEditAttr} onAddField={props.onAddEditField} onRemoveField={props.onRemoveEditField} onUpdateField={props.onUpdateEditField} onAddSkill={props.onAddEditSkill} onRemoveSkill={props.onRemoveEditSkill} onUpdateSkill={props.onUpdateEditSkill} editProfiles={props.editTemplateProfiles} onAddProfile={props.onAddEditProfile} onRemoveProfile={props.onRemoveEditProfile} onUpdateProfile={props.onUpdateEditProfile} onAddProfileOption={props.onAddEditProfileOption} onRemoveProfileOption={props.onRemoveEditProfileOption} onUpdateProfileOption={props.onUpdateEditProfileOption} editModifiers={props.editTemplateModifiers} onAddModifier={props.onAddEditModifier} onRemoveModifier={props.onRemoveEditModifier} onUpdateModifier={props.onUpdateEditModifier} onAddComponent={props.onAddEditComponent} onRemoveComponent={props.onRemoveEditComponent} onUpdateComponent={props.onUpdateEditComponent} onUpdateComponentLocked={props.onUpdateEditComponentLocked} editAcEnabled={props.editAcEnabled} editAcFormula={props.editAcFormula} editAcFields={props.editAcFields} onEditAcEnabledChange={props.onEditAcEnabledChange} onEditAcFormulaChange={props.onEditAcFormulaChange} onAddEditAcField={props.onAddEditAcField} onRemoveEditAcField={props.onRemoveEditAcField} onUpdateEditAcField={props.onUpdateEditAcField} onUpdateEditAcFieldEditable={props.onUpdateEditAcFieldEditable} />)}</div>}
    {props.isGM&&!props.showNewTemplate&&<button onClick={props.onNewClick} className="btn-primary text-sm">+ New Template</button>}
    {props.isGM&&props.showNewTemplate&&<NewTemplateForm newTemplateName={props.newTemplateName} newTemplateDescription={props.newTemplateDescription} newTemplateAttrs={props.newTemplateAttrs} newTemplateSkills={props.newTemplateSkills} newTemplateProfiles={props.newTemplateProfiles} newTemplateFields={props.newTemplateFields} templateError={props.templateError} templateCreating={props.templateCreating} onNameChange={props.onNameChange} onDescriptionChange={props.onDescriptionChange} onAddAttr={props.onAddAttr} onRemoveAttr={props.onRemoveAttr} onUpdateAttr={props.onUpdateAttr} onAddSkill={props.onAddSkill} onRemoveSkill={props.onRemoveSkill} onUpdateSkill={props.onUpdateSkill} onAddProfile={props.onAddProfile} onRemoveProfile={props.onRemoveProfile} onUpdateProfile={props.onUpdateProfile} onAddProfileOption={props.onAddProfileOption} onRemoveProfileOption={props.onRemoveProfileOption} onUpdateProfileOption={props.onUpdateProfileOption} onAddField={props.onAddField} onRemoveField={props.onRemoveField} onUpdateField={props.onUpdateField} onCancelNew={props.onCancelNew} onCreateTemplate={props.onCreateTemplate} newTemplateModifiers={props.newTemplateModifiers} onAddModifier={props.onAddModifier} onRemoveModifier={props.onRemoveModifier} onUpdateModifier={props.onUpdateModifier} onAddComponent={props.onAddComponent} onRemoveComponent={props.onRemoveComponent} onUpdateComponent={props.onUpdateComponent} onUpdateComponentLocked={props.onUpdateComponentLocked} newAcEnabled={props.newAcEnabled} newAcFormula={props.newAcFormula} newAcFields={props.newAcFields} onNewAcEnabledChange={props.onNewAcEnabledChange} onNewAcFormulaChange={props.onNewAcFormulaChange} onAddNewAcField={props.onAddNewAcField} onRemoveNewAcField={props.onRemoveNewAcField} onUpdateNewAcField={props.onUpdateNewAcField} onUpdateNewAcFieldEditable={props.onUpdateNewAcFieldEditable} />}
  </div>
}

function CollapsibleAttrCard({ index, attr, isExpanded, onToggle, onUpdateAttr, onRemove, allAttrs, runtimeModifiers }: { index: number; attr: { key: string; name: string; modifier: string }; isExpanded: boolean; onToggle: () => void; onUpdateAttr: (i: number, f: 'key'|'name'|'modifier', v: string) => void; onRemove: () => void; allAttrs: { key: string; name: string; modifier: string }[]; runtimeModifiers?: { key: string; name: string }[] }) {
  return <div className="rounded-lg border border-border bg-background/30 overflow-hidden"><button type="button" onClick={onToggle} className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-background/50 transition-colors"><div className="flex items-center gap-2 min-w-0"><span className="text-sm font-medium text-foreground truncate">{attr.name||'New Attribute'}</span>{attr.key&&<span className="text-[0.6rem] text-muted font-mono shrink-0">({attr.key})</span>}</div><svg className={`w-4 h-4 text-muted transition-transform shrink-0 ${isExpanded?'rotate-180':''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg></button>{isExpanded&&<div className="px-3 py-3 space-y-2 border-t border-border"><div className="flex items-center gap-1.5"><input className="input-field flex-1" value={attr.key} onChange={e=>onUpdateAttr(index,'key',e.target.value)} placeholder="Key (e.g. strength)"/><input className="input-field flex-1" value={attr.name} onChange={e=>onUpdateAttr(index,'name',e.target.value)} placeholder="Name (e.g. Strength)"/></div><div><label className="text-xs text-muted mb-1 block">Formula Builder (optional)</label><FormulaBuilder value={attr.modifier} onChange={v=>onUpdateAttr(index,'modifier',v)} attributes={allAttrs.filter(a=>a.key.trim()&&a.name.trim()).map(a=>({key:a.key.trim(),name:a.name.trim()}))} runtimeModifiers={runtimeModifiers}/></div><div className="flex justify-end"><button type="button" onClick={onRemove} className="text-xs text-danger hover:text-danger/80 transition-colors">Remove Attribute</button></div></div>}</div>
}

function CollapsibleSkillCard({ index, skill, onUpdateSkill, onRemove, attributes, customFields, skillProfiles, runtimeModifiers }: { index: number; skill: { name: string; description: string; formula: string }; onUpdateSkill?: (i: number, f: 'name'|'description'|'formula', v: string) => void; onRemove?: () => void; attributes: { key: string; name: string }[]; customFields: { key: string; label: string }[]; skillProfiles: { id: string; name: string; options: { id: string; label: string; value: number }[] }[]; runtimeModifiers?: { key: string; name: string }[] }) {
  const [expanded, setExpanded] = useState(true)
  return <div className="rounded-lg border border-border bg-background/30 overflow-hidden"><button type="button" onClick={()=>setExpanded(!expanded)} className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-background/50 transition-colors"><span className="text-sm font-medium text-foreground truncate">{skill.name||'New Skill'}</span><svg className={`w-4 h-4 text-muted transition-transform shrink-0 ${expanded?'rotate-180':''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg></button>{expanded&&<div className="px-3 py-3 space-y-2 border-t border-border"><div><label className="text-xs text-muted mb-1 block">Name</label><input className="input-field" value={skill.name} onChange={e=>onUpdateSkill?.(index,'name',e.target.value)} placeholder="Skill Name (e.g. Stealth)"/></div><div><label className="text-xs text-muted mb-1 block">Description <span className="text-muted font-normal">(optional)</span></label><input className="input-field" value={skill.description} onChange={e=>onUpdateSkill?.(index,'description',e.target.value)} placeholder="Brief description"/></div><div><label className="text-xs text-muted mb-1 block">Formula Builder</label><FormulaBuilder value={skill.formula} onChange={v=>onUpdateSkill?.(index,'formula',v)} attributes={attributes} customFields={customFields} skillModifierProfiles={skillProfiles} runtimeModifiers={runtimeModifiers} useModPrefix placeholder="Build skill formula..."/></div><div className="flex justify-end"><button type="button" onClick={onRemove} className="text-xs text-danger hover:text-danger/80 transition-colors">Remove Skill</button></div></div>}</div>
}

function NewTemplateForm(props: {
  newTemplateName: string; newTemplateDescription: string; newTemplateAttrs: { key: string; name: string; modifier: string }[]
  newTemplateSkills?: { name: string; description: string; formula: string }[]; newTemplateProfiles?: { name: string; options: { label: string; value: number }[] }[]; newTemplateFields?: { key: string; label: string }[]
  templateError: string | null; templateCreating: boolean; onNameChange: (v: string) => void; onDescriptionChange: (v: string) => void
  onAddAttr: () => void; onRemoveAttr: (i: number) => void; onUpdateAttr: (i: number, f: 'key'|'name'|'modifier', v: string) => void
  onAddSkill?: () => void; onRemoveSkill?: (i: number) => void; onUpdateSkill?: (i: number, f: 'name'|'description'|'formula', v: string) => void
  onAddProfile?: () => void; onRemoveProfile?: (i: number) => void; onUpdateProfile?: (i: number, n: string) => void
  onAddProfileOption?: (pIdx: number) => void; onRemoveProfileOption?: (pIdx: number, oIdx: number) => void; onUpdateProfileOption?: (pIdx: number, oIdx: number, f: 'label'|'value', v: string|number) => void
  onAddField?: () => void; onRemoveField?: (i: number) => void; onUpdateField?: (i: number, f: 'key'|'label', v: string) => void
  onCancelNew: () => void; onCreateTemplate: (e: FormEvent) => void
  newTemplateModifiers?: RuntimeModifier[]
  onAddModifier?: () => void; onRemoveModifier?: (i: number) => void; onUpdateModifier?: (i: number, f: 'key'|'name'|'description', v: string) => void
  onAddComponent?: (mIdx: number) => void; onRemoveComponent?: (mIdx: number, cIdx: number) => void; onUpdateComponent?: (mIdx: number, cIdx: number, f: 'name'|'defaultValue'|'formula', v: string) => void; onUpdateComponentLocked?: (mIdx: number, cIdx: number, v: boolean) => void
  // Armor Class
  newAcEnabled?: boolean; newAcFormula?: string; newAcFields?: { name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string }[]
  onNewAcEnabledChange?: (v: boolean) => void; onNewAcFormulaChange?: (v: string) => void
  onAddNewAcField?: () => void; onRemoveNewAcField?: (i: number) => void; onUpdateNewAcField?: (i: number, f: 'name'|'key'|'defaultValue'|'description', v: string) => void; onUpdateNewAcFieldEditable?: (i: number, v: boolean) => void
}) {
  const [activeTab, setActiveTab] = useState<'attrs'|'skills'|'profiles'|'modifiers'|'fields'|'ac'>('attrs')
  const [expandedAttrs, setExpandedAttrs] = useState<Record<number,boolean>>({}); const prevCount = useRef(0)
  useEffect(()=>{if(props.newTemplateAttrs.length>prevCount.current){setExpandedAttrs(p=>({...p,[props.newTemplateAttrs.length-1]:true}))};prevCount.current=props.newTemplateAttrs.length},[props.newTemplateAttrs.length])
  const tabClass = (tab:string) => `px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab===tab?'bg-primary/15 text-primary border border-primary/20':'text-muted hover:text-foreground'}`
  const activeAttrs = props.newTemplateAttrs.filter(a=>a.key.trim()&&a.name.trim()).map(a=>({key:a.key.trim(),name:a.name.trim()}))
  const activeFields = (props.newTemplateFields||[]).filter(f=>f.key.trim()&&f.label.trim()).map(f=>({key:f.key.trim(),label:f.label.trim()}))
  const activeProfiles = (props.newTemplateProfiles||[]).filter(p=>p.name.trim()).map((p,pIdx)=>({id:`new-${pIdx}`,name:p.name.trim(),options:p.options.filter(o=>o.label.trim()).map((o,oIdx)=>({id:`new-${pIdx}-${oIdx}`,label:o.label.trim(),value:o.value}))}))
  const activeModifiers = (props.newTemplateModifiers||[]).filter(m=>m.key.trim()&&m.name.trim()).map(m=>({key:m.key.trim(),name:m.name.trim()}))

  return <form onSubmit={props.onCreateTemplate} className="rounded-lg border border-primary/20 bg-background/50 p-4 space-y-3">
    <h4 className="text-sm font-semibold text-primary">Create Template</h4>
    <div><label className="label">Name</label><input className="input-field" value={props.newTemplateName} onChange={e=>props.onNameChange(e.target.value)} placeholder="e.g. D&D 5e Character Sheet" maxLength={100} required/></div>
    <div><label className="label">Description <span className="text-muted font-normal">(optional)</span></label><input className="input-field" value={props.newTemplateDescription} onChange={e=>props.onDescriptionChange(e.target.value)} placeholder="Brief description of this template" maxLength={200}/></div>
    <div className="flex gap-1 flex-wrap">
      <button type="button" onClick={()=>setActiveTab('attrs')} className={tabClass('attrs')}>Attributes</button>
      <button type="button" onClick={()=>setActiveTab('skills')} className={tabClass('skills')}>Skills</button>
      {props.onAddProfile&&<button type="button" onClick={()=>setActiveTab('profiles')} className={tabClass('profiles')}>Skill Modifier Profiles</button>}
      {props.onAddModifier&&<button type="button" onClick={()=>setActiveTab('modifiers')} className={tabClass('modifiers')}>Runtime Modifiers</button>}
      {props.onAddField&&<button type="button" onClick={()=>setActiveTab('fields')} className={tabClass('fields')}>Custom Fields</button>}
      {props.onNewAcEnabledChange&&<button type="button" onClick={()=>setActiveTab('ac')} className={tabClass('ac')}>Armor Class</button>}
    </div>

    {activeTab==='attrs'&&<div><div className="space-y-2 mt-1">{props.newTemplateAttrs.map((attr,idx)=><CollapsibleAttrCard key={idx} index={idx} attr={attr} isExpanded={!!expandedAttrs[idx]} onToggle={()=>setExpandedAttrs(p=>({...p,[idx]:!p[idx]}))} onUpdateAttr={props.onUpdateAttr} onRemove={()=>props.onRemoveAttr(idx)} allAttrs={props.newTemplateAttrs} runtimeModifiers={activeModifiers}/>)}</div><button type="button" onClick={props.onAddAttr} className="btn-ghost text-xs mt-2">+ Add Attribute</button></div>}
    {activeTab==='skills'&&<div><div className="space-y-2 mt-1">{(props.newTemplateSkills||[]).map((s,idx)=><CollapsibleSkillCard key={idx} index={idx} skill={s} onUpdateSkill={props.onUpdateSkill} onRemove={()=>props.onRemoveSkill?.(idx)} attributes={activeAttrs} customFields={activeFields} skillProfiles={activeProfiles} runtimeModifiers={activeModifiers}/>)}</div><button type="button" onClick={props.onAddSkill} className="btn-ghost text-xs mt-2">+ Add Skill</button></div>}

    {activeTab==='profiles'&&<div><div className="space-y-2 mt-1">{(props.newTemplateProfiles||[]).map((p,pIdx)=><div key={pIdx} className="rounded-lg border border-border bg-background/30 p-3 space-y-2"><div className="flex items-center gap-1.5"><input className="input-field flex-1" value={p.name} onChange={e=>props.onUpdateProfile?.(pIdx,e.target.value)} placeholder="Profile name (e.g. mastery)"/><button type="button" onClick={()=>props.onRemoveProfile?.(pIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div><div className="space-y-1 pl-2">{p.options.map((o,oIdx)=><div key={oIdx} className="flex items-center gap-1.5"><input className="input-field flex-1 text-xs" value={o.label} onChange={e=>props.onUpdateProfileOption?.(pIdx,oIdx,'label',e.target.value)} placeholder="Option label (e.g. Expert)"/><input className="input-field w-20 text-xs" type="number" value={o.value} onChange={e=>props.onUpdateProfileOption?.(pIdx,oIdx,'value',e.target.value)} placeholder="Value"/><button type="button" onClick={()=>props.onRemoveProfileOption?.(pIdx,oIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>)}</div><button type="button" onClick={()=>props.onAddProfileOption?.(pIdx)} className="btn-ghost text-xs">+ Add Option</button></div>)}</div><button type="button" onClick={props.onAddProfile} className="btn-ghost text-xs mt-2">+ Add Skill Modifier Profile</button></div>}

    {activeTab==='modifiers'&&<div><div className="space-y-2 mt-1">{(props.newTemplateModifiers||[]).map((m,mIdx)=><div key={mIdx} className="rounded-lg border border-border bg-background/30 p-3 space-y-2"><div className="flex items-center gap-1.5"><input className="input-field flex-1" value={m.key} onChange={e=>props.onUpdateModifier?.(mIdx,'key',e.target.value)} placeholder="Key (e.g. armorClass)"/><input className="input-field flex-1" value={m.name} onChange={e=>props.onUpdateModifier?.(mIdx,'name',e.target.value)} placeholder="Name (e.g. Armor Class)"/><button type="button" onClick={()=>props.onRemoveModifier?.(mIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div><input className="input-field" value={m.description} onChange={e=>props.onUpdateModifier?.(mIdx,'description',e.target.value)} placeholder="Description (optional)"/><div className="space-y-1 pl-2">{(m.components||[]).map((c,cIdx)=><div key={cIdx} className="rounded border border-border/50 bg-background/20 p-2 space-y-1"><div className="flex items-center gap-1"><input className="input-field flex-1 text-xs" value={c.name} onChange={e=>props.onUpdateComponent?.(mIdx,cIdx,'name',e.target.value)} placeholder="Component name"/><label className="flex items-center gap-1 text-xs text-muted shrink-0"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={c.locked} onChange={e=>props.onUpdateComponentLocked?.(mIdx,cIdx,e.target.checked)}/>Locked</label><button type="button" onClick={()=>props.onRemoveComponent?.(mIdx,cIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div><div className="flex items-center gap-1"><input className="input-field flex-1 text-xs" value={c.defaultValue} onChange={e=>props.onUpdateComponent?.(mIdx,cIdx,'defaultValue',e.target.value)} placeholder="Default value"/><input className="input-field flex-1 text-xs" value={c.formula} onChange={e=>props.onUpdateComponent?.(mIdx,cIdx,'formula',e.target.value)} placeholder="Formula (optional)" disabled={c.locked===false?false:false}/></div></div>)}<button type="button" onClick={()=>props.onAddComponent?.(mIdx)} className="btn-ghost text-xs">+ Add Component</button></div></div>)}</div><button type="button" onClick={props.onAddModifier} className="btn-ghost text-xs mt-2">+ Add Runtime Modifier</button></div>}

    {activeTab==='fields'&&<div><div className="space-y-2 mt-1">{(props.newTemplateFields||[]).map((f,idx)=><div key={idx} className="flex items-center gap-1.5"><input className="input-field flex-1" value={f.key} onChange={e=>props.onUpdateField?.(idx,'key',e.target.value)} placeholder="Key (e.g. class)"/><input className="input-field flex-1" value={f.label} onChange={e=>props.onUpdateField?.(idx,'label',e.target.value)} placeholder="Label (e.g. Class)"/><button type="button" onClick={()=>props.onRemoveField?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>)}</div><button type="button" onClick={props.onAddField} className="btn-ghost text-xs mt-2">+ Add Custom Field</button></div>}

    {activeTab==='ac'&&props.onNewAcEnabledChange&&<div><div className="space-y-2 mt-1">
      <div className="rounded-lg border border-border bg-background/30 p-3 space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={props.newAcEnabled??false} onChange={e=>props.onNewAcEnabledChange?.(e.target.checked)}/>
          Enable Armor Class System
        </label>
        {(props.newAcEnabled??false)&&<div className="space-y-2 pl-2">
          <div><label className="text-xs text-muted mb-1 block">Armor Class Formula</label>
            <FormulaBuilder value={props.newAcFormula??''} onChange={v=>props.onNewAcFormulaChange?.(v)} attributes={activeAttrs} customFields={activeFields} runtimeModifiers={activeModifiers} acFields={(props.newAcFields||[]).filter(f=>f.key.trim()&&f.name.trim()).map(f=>({key:f.key.trim(),name:f.name.trim()}))} placeholder="Build AC formula..."/>
          </div>
          <div className="space-y-1">
            {(props.newAcFields||[]).map((f,idx)=><div key={idx} className="rounded border border-border/50 bg-background/20 p-2 space-y-1">
              <div className="flex items-center gap-1"><input className="input-field flex-1 text-xs" value={f.name} onChange={e=>props.onUpdateNewAcField?.(idx,'name',e.target.value)} placeholder="Field name (e.g. Shield)"/><input className="input-field flex-1 text-xs" value={f.key} onChange={e=>props.onUpdateNewAcField?.(idx,'key',e.target.value)} placeholder="Key (e.g. shield)"/><button type="button" onClick={()=>props.onRemoveNewAcField?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>
              <div className="flex items-center gap-1"><input className="input-field flex-1 text-xs" value={f.defaultValue} onChange={e=>props.onUpdateNewAcField?.(idx,'defaultValue',e.target.value)} placeholder="Default value"/><input className="input-field flex-1 text-xs" value={f.description} onChange={e=>props.onUpdateNewAcField?.(idx,'description',e.target.value)} placeholder="Description (optional)"/><label className="flex items-center gap-1 text-xs text-muted shrink-0"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={f.editableByPlayer} onChange={e=>props.onUpdateNewAcFieldEditable?.(idx,e.target.checked)}/>Editable</label></div>
            </div>)}
          </div>
          <button type="button" onClick={props.onAddNewAcField} className="btn-ghost text-xs">+ Add AC Field</button>
        </div>}
      </div>
    </div></div>}

    {props.templateError&&<div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{props.templateError}</div>}
    <div className="flex gap-2 justify-end"><button type="button" onClick={props.onCancelNew} disabled={props.templateCreating} className="btn-ghost text-sm">Cancel</button><button type="submit" disabled={props.templateCreating||!props.newTemplateName.trim()||props.newTemplateAttrs.length===0} className="btn-primary text-sm">{props.templateCreating?'Creating...':'Create'}</button></div>
  </form>
}

function TemplateRow(props: {
  template: Template; isGM: boolean; isEditing: boolean; editName: string; editDescription: string; editAttrs: { key: string; name: string; modifier: string }[]; editFields?: { key: string; label: string }[]; editSkills?: { name: string; description: string; formula: string }[]; editError: string | null; saving: boolean
  onStartEdit: () => void; onCancelEdit: () => void; onUpdate: (e: FormEvent) => void; onDelete: () => void; onEditNameChange: (v: string) => void; onEditDescriptionChange: (v: string) => void
  onAddAttr: () => void; onRemoveAttr: (i: number) => void; onUpdateAttr: (i: number, f: 'key'|'name'|'modifier', v: string) => void
  onAddField?: () => void; onRemoveField?: (i: number) => void; onUpdateField?: (i: number, f: 'key'|'label', v: string) => void
  onAddSkill?: () => void; onRemoveSkill?: (i: number) => void; onUpdateSkill?: (i: number, f: 'name'|'description'|'formula', v: string) => void
  editProfiles?: { name: string; options: { label: string; value: number }[] }[]; onAddProfile?: () => void; onRemoveProfile?: (i: number) => void; onUpdateProfile?: (i: number, n: string) => void
  onAddProfileOption?: (pIdx: number) => void; onRemoveProfileOption?: (pIdx: number, oIdx: number) => void; onUpdateProfileOption?: (pIdx: number, oIdx: number, f: 'label'|'value', v: string|number) => void
  editModifiers?: RuntimeModifier[]; onAddModifier?: () => void; onRemoveModifier?: (i: number) => void; onUpdateModifier?: (i: number, f: 'key'|'name'|'description', v: string) => void
  onAddComponent?: (mIdx: number) => void; onRemoveComponent?: (mIdx: number, cIdx: number) => void; onUpdateComponent?: (mIdx: number, cIdx: number, f: 'name'|'defaultValue'|'formula', v: string) => void; onUpdateComponentLocked?: (mIdx: number, cIdx: number, v: boolean) => void
  // Armor Class edit
  editAcEnabled?: boolean; editAcFormula?: string; editAcFields?: { name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string }[]
  onEditAcEnabledChange?: (v: boolean) => void; onEditAcFormulaChange?: (v: string) => void
  onAddEditAcField?: () => void; onRemoveEditAcField?: (i: number) => void; onUpdateEditAcField?: (i: number, f: 'name'|'key'|'defaultValue'|'description', v: string) => void; onUpdateEditAcFieldEditable?: (i: number, v: boolean) => void
}) {
  const [expandedEditAttrs, setExpandedEditAttrs] = useState<Record<number,boolean>>({}); const prevEditCount = useRef(0)
  useEffect(()=>{if(props.editAttrs.length>prevEditCount.current){setExpandedEditAttrs(p=>({...p,[props.editAttrs.length-1]:true}))};prevEditCount.current=props.editAttrs.length},[props.editAttrs.length])
  const [editTab, setEditTab] = useState<'attrs'|'skills'|'profiles'|'modifiers'|'fields'|'ac'>('attrs'); const etabClass = (tab:string) => `px-3 py-1.5 rounded text-xs font-medium transition-colors ${editTab===tab?'bg-primary/15 text-primary border border-primary/20':'text-muted hover:text-foreground'}`
  const activeAttrs = props.editAttrs.filter(a=>a.key.trim()&&a.name.trim()).map(a=>({key:a.key.trim(),name:a.name.trim()}))
  const activeFields = (props.editFields||[]).filter(f=>f.key.trim()&&f.label.trim()).map(f=>({key:f.key.trim(),label:f.label.trim()}))
  const activeProfiles = (props.editProfiles||[]).filter(p=>p.name.trim()).map((p,pIdx)=>({id:`edit-${pIdx}`,name:p.name.trim(),options:p.options.filter(o=>o.label.trim()).map((o,oIdx)=>({id:`edit-${pIdx}-${oIdx}`,label:o.label.trim(),value:o.value}))}))
  const activeModifiers = (props.editModifiers||[]).filter(m=>m.key.trim()&&m.name.trim()).map(m=>({key:m.key.trim(),name:m.name.trim()}))

  if(props.isEditing) return <form onSubmit={props.onUpdate} className="rounded-lg border border-primary/30 bg-background/50 p-4 space-y-3">
    <div><label className="label">Name</label><input className="input-field" value={props.editName} onChange={e=>props.onEditNameChange(e.target.value)} maxLength={100} required/></div>
    <div><label className="label">Description <span className="text-muted font-normal">(optional)</span></label><input className="input-field" value={props.editDescription} onChange={e=>props.onEditDescriptionChange(e.target.value)} maxLength={200}/></div>
    <div className="flex gap-1 flex-wrap"><button type="button" onClick={()=>setEditTab('attrs')} className={etabClass('attrs')}>Attributes</button><button type="button" onClick={()=>setEditTab('skills')} className={etabClass('skills')}>Skills</button>{props.onAddProfile&&<button type="button" onClick={()=>setEditTab('profiles')} className={etabClass('profiles')}>Skill Modifier Profiles</button>}{props.onAddModifier&&<button type="button" onClick={()=>setEditTab('modifiers')} className={etabClass('modifiers')}>Runtime Modifiers</button>}{props.onAddField&&<button type="button" onClick={()=>setEditTab('fields')} className={etabClass('fields')}>Custom Fields</button>}{props.onAddEditAcField&&<button type="button" onClick={()=>setEditTab('ac')} className={etabClass('ac')}>Armor Class</button>}</div>

    {editTab==='attrs'&&<div><div className="space-y-2 mt-1">{props.editAttrs.map((attr,idx)=><CollapsibleAttrCard key={idx} index={idx} attr={attr} isExpanded={!!expandedEditAttrs[idx]} onToggle={()=>setExpandedEditAttrs(p=>({...p,[idx]:!p[idx]}))} onUpdateAttr={props.onUpdateAttr} onRemove={()=>props.onRemoveAttr(idx)} allAttrs={props.editAttrs} runtimeModifiers={activeModifiers}/>)}</div><button type="button" onClick={props.onAddAttr} className="btn-ghost text-xs mt-2">+ Add Attribute</button></div>}
    {editTab==='skills'&&<div><div className="space-y-2 mt-1">{(props.editSkills||[]).map((s,idx)=><CollapsibleSkillCard key={idx} index={idx} skill={s} onUpdateSkill={props.onUpdateSkill} onRemove={()=>props.onRemoveSkill?.(idx)} attributes={activeAttrs} customFields={activeFields} skillProfiles={activeProfiles} runtimeModifiers={activeModifiers}/>)}</div><button type="button" onClick={props.onAddSkill} className="btn-ghost text-xs mt-2">+ Add Skill</button></div>}
    {editTab==='profiles'&&<div><div className="space-y-2 mt-1">{(props.editProfiles||[]).map((p,pIdx)=><div key={pIdx} className="rounded-lg border border-border bg-background/30 p-3 space-y-2"><div className="flex items-center gap-1.5"><input className="input-field flex-1" value={p.name} onChange={e=>props.onUpdateProfile?.(pIdx,e.target.value)} placeholder="Profile name (e.g. mastery)"/><button type="button" onClick={()=>props.onRemoveProfile?.(pIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div><div className="space-y-1 pl-2">{p.options.map((o,oIdx)=><div key={oIdx} className="flex items-center gap-1.5"><input className="input-field flex-1 text-xs" value={o.label} onChange={e=>props.onUpdateProfileOption?.(pIdx,oIdx,'label',e.target.value)} placeholder="Option label (e.g. Expert)"/><input className="input-field w-20 text-xs" type="number" value={o.value} onChange={e=>props.onUpdateProfileOption?.(pIdx,oIdx,'value',e.target.value)} placeholder="Value"/><button type="button" onClick={()=>props.onRemoveProfileOption?.(pIdx,oIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>)}</div><button type="button" onClick={()=>props.onAddProfileOption?.(pIdx)} className="btn-ghost text-xs">+ Add Option</button></div>)}</div><button type="button" onClick={props.onAddProfile} className="btn-ghost text-xs mt-2">+ Add Skill Modifier Profile</button></div>}

    {editTab==='modifiers'&&<div><div className="space-y-2 mt-1">{(props.editModifiers||[]).map((m,mIdx)=><div key={mIdx} className="rounded-lg border border-border bg-background/30 p-3 space-y-2"><div className="flex items-center gap-1.5"><input className="input-field flex-1" value={m.key} onChange={e=>props.onUpdateModifier?.(mIdx,'key',e.target.value)} placeholder="Key"/><input className="input-field flex-1" value={m.name} onChange={e=>props.onUpdateModifier?.(mIdx,'name',e.target.value)} placeholder="Name"/><button type="button" onClick={()=>props.onRemoveModifier?.(mIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div><input className="input-field" value={m.description} onChange={e=>props.onUpdateModifier?.(mIdx,'description',e.target.value)} placeholder="Description (optional)"/><div className="space-y-1 pl-2">{(m.components||[]).map((c,cIdx)=><div key={cIdx} className="rounded border border-border/50 bg-background/20 p-2 space-y-1"><div className="flex items-center gap-1"><input className="input-field flex-1 text-xs" value={c.name} onChange={e=>props.onUpdateComponent?.(mIdx,cIdx,'name',e.target.value)} placeholder="Component name"/><label className="flex items-center gap-1 text-xs text-muted shrink-0"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={c.locked} onChange={e=>props.onUpdateComponentLocked?.(mIdx,cIdx,e.target.checked)}/>Locked</label><button type="button" onClick={()=>props.onRemoveComponent?.(mIdx,cIdx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div><div className="flex items-center gap-1"><input className="input-field flex-1 text-xs" value={c.defaultValue} onChange={e=>props.onUpdateComponent?.(mIdx,cIdx,'defaultValue',e.target.value)} placeholder="Default value"/><input className="input-field flex-1 text-xs" value={c.formula} onChange={e=>props.onUpdateComponent?.(mIdx,cIdx,'formula',e.target.value)} placeholder="Formula (optional)"/></div></div>)}<button type="button" onClick={()=>props.onAddComponent?.(mIdx)} className="btn-ghost text-xs">+ Add Component</button></div></div>)}</div><button type="button" onClick={props.onAddModifier} className="btn-ghost text-xs mt-2">+ Add Runtime Modifier</button></div>}

    {editTab==='fields'&&<div><div className="space-y-2 mt-1">{(props.editFields||[]).map((f,idx)=><div key={idx} className="flex items-center gap-1.5"><input className="input-field flex-1" value={f.key} onChange={e=>props.onUpdateField?.(idx,'key',e.target.value)} placeholder="Key (e.g. class)"/><input className="input-field flex-1" value={f.label} onChange={e=>props.onUpdateField?.(idx,'label',e.target.value)} placeholder="Label (e.g. Class)"/><button type="button" onClick={()=>props.onRemoveField?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>)}</div><button type="button" onClick={props.onAddField} className="btn-ghost text-xs mt-2">+ Add Custom Field</button></div>}

    {editTab==='ac'&&props.onAddEditAcField&&<div><div className="space-y-2 mt-1">
      <div className="rounded-lg border border-border bg-background/30 p-3 space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded accent-primary" checked={props.editAcEnabled??false} onChange={e=>props.onEditAcEnabledChange?.(e.target.checked)}/>
          Enable Armor Class System
        </label>
        {(props.editAcEnabled??false)&&<div className="space-y-2 pl-2">
          <div><label className="text-xs text-muted mb-1 block">Armor Class Formula</label>
            <FormulaBuilder value={props.editAcFormula??''} onChange={v=>props.onEditAcFormulaChange?.(v)} attributes={activeAttrs} customFields={activeFields} runtimeModifiers={activeModifiers} acFields={(props.editAcFields||[]).filter(f=>f.key.trim()&&f.name.trim()).map(f=>({key:f.key.trim(),name:f.name.trim()}))} placeholder="Build AC formula..."/>
          </div>
          <div className="space-y-1">
            {(props.editAcFields||[]).map((f,idx)=><div key={idx} className="rounded border border-border/50 bg-background/20 p-2 space-y-1">
              <div className="flex items-center gap-1"><input className="input-field flex-1 text-xs" value={f.name} onChange={e=>props.onUpdateEditAcField?.(idx,'name',e.target.value)} placeholder="Field name (e.g. Shield)"/><input className="input-field flex-1 text-xs" value={f.key} onChange={e=>props.onUpdateEditAcField?.(idx,'key',e.target.value)} placeholder="Key (e.g. shield)"/><button type="button" onClick={()=>props.onRemoveEditAcField?.(idx)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button></div>
              <div className="flex items-center gap-1"><input className="input-field flex-1 text-xs" value={f.defaultValue} onChange={e=>props.onUpdateEditAcField?.(idx,'defaultValue',e.target.value)} placeholder="Default value"/><input className="input-field flex-1 text-xs" value={f.description} onChange={e=>props.onUpdateEditAcField?.(idx,'description',e.target.value)} placeholder="Description (optional)"/><label className="flex items-center gap-1 text-xs text-muted shrink-0"><input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={f.editableByPlayer} onChange={e=>props.onUpdateEditAcFieldEditable?.(idx,e.target.checked)}/>Editable</label></div>
            </div>)}
          </div>
          <button type="button" onClick={props.onAddEditAcField} className="btn-ghost text-xs">+ Add AC Field</button>
        </div>}
      </div>
    </div></div>}

    {props.editError&&<div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{props.editError}</div>}
    <div className="flex gap-2 justify-end"><button type="button" onClick={props.onCancelEdit} disabled={props.saving} className="btn-ghost text-sm">Cancel</button><button type="submit" disabled={props.saving||!props.editName.trim()} className="btn-primary text-sm">{props.saving?'Saving...':'Save'}</button></div>
  </form>

  return <div className="flex items-start justify-between py-2.5 px-3 rounded-lg bg-background/50 border border-border"><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-sm font-medium text-foreground truncate">{props.template.name}</span><span className="badge badge-gold text-[0.6rem]">{props.template.attributes.length} Attributes</span></div>{props.template.description&&<p className="text-xs text-muted mt-0.5 truncate">{props.template.description}</p>}</div>{props.isGM&&<div className="flex gap-1 shrink-0 ml-2"><button onClick={props.onStartEdit} className="btn-ghost text-xs px-2 py-1">Edit</button><button onClick={props.onDelete} className="text-xs text-danger hover:text-danger/80 px-2 py-1 transition-colors">Delete</button></div>}</div>
}