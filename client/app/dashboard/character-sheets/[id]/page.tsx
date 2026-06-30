'use client'

import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import Link from 'next/link'

interface SheetAttribute { id: string; attributeId: string; value: string; attribute: { id: string; key: string; name: string; modifier: string | null } }
interface FieldValue { id: string; templateFieldId: string; value: string; templateField: { id: string; key: string; label: string } }
interface SkillValue { id: string; skillId: string; value: string; skill: { id: string; name: string; description: string | null; formula: string | null } }
interface ProfileOption { id: string; label: string; value: number }
interface SkillModifierProfile { id: string; name: string; options: ProfileOption[] }
interface SkillProfileValue { id: string; skillId: string; profileId: string; optionId: string | null; profile: { id: string; name: string }; option: { id: string; label: string; value: number } | null }

interface RuntimeModifierComponentDef {
  id: string; name: string; defaultValue: string | null; locked: boolean; formula: string | null
  modifier: { id: string; key: string; name: string; description: string | null }
}
interface RuntimeModifierDef {
  id: string; key: string; name: string; description: string | null; components: RuntimeModifierComponentDef[]
}
interface RuntimeModifierComponentValue {
  id: string; componentId: string; value: string
  component: RuntimeModifierComponentDef
}

interface ArmorClassFieldDef {
  id: string; name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string | null
  armorClass: { id: string; formula: string | null }
}
interface ArmorClassDef {
  id: string; enabled: boolean; formula: string | null; fields: ArmorClassFieldDef[]
}
interface ArmorClassValue {
  id: string; fieldId: string; value: string
  field: ArmorClassFieldDef
}

interface CharacterSheet {
  id: string; characterName: string; playerName: string | null; level: number | null
  hpActual: number | null; hpMax: number | null; hpNotes: string | null
  adventure: { id: string; name: string; campaign: string } | null
  template: {
    id: string; name: string
    attributes: { id: string; key: string; name: string; modifier: string | null }[]
    skillModifierProfiles: SkillModifierProfile[]
    runtimeModifiers: RuntimeModifierDef[]
    armorClass: ArmorClassDef | null
  }
  values: SheetAttribute[]; fieldValues: FieldValue[]; skillValues: SkillValue[]
  skillProfileValues: SkillProfileValue[]
  runtimeModifierComponentValues: RuntimeModifierComponentValue[]
  acValues: ArmorClassValue[]
  ownerId: string; createdAt: string
}

export default function CharacterSheetDetailPage() {
  const router = useRouter(); const params = useParams(); const id = params.id as string
  const { user, loading: authLoading } = useAuth()
  const [sheet, setSheet] = useState<CharacterSheet | null>(null); const [fetching, setFetching] = useState(true)
  const [modifierResults, setModifierResults] = useState<Record<string, number | null>>({})
  const [skillResults, setSkillResults] = useState<Record<string, number | null>>({})
  const [acResult, setAcResult] = useState<number | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [editing, setEditing] = useState(false); const [editName, setEditName] = useState(''); const [editPlayerName, setEditPlayerName] = useState(''); const [editLevel, setEditLevel] = useState(1)
  const [editHpActual, setEditHpActual] = useState(0); const [editHpMax, setEditHpMax] = useState(0); const [editHpNotes, setEditHpNotes] = useState('')
  const [editValues, setEditValues] = useState<Record<string, string>>({}); const [editFieldValues, setEditFieldValues] = useState<Record<string, string>>({})
  const [editCompValues, setEditCompValues] = useState<Record<string, string>>({})
  const [editAcValues, setEditAcValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false); const [editError, setEditError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false); const [deleting, setDeleting] = useState(false); const [deleteError, setDeleteError] = useState<string | null>(null)
  const [profileSelections, setProfileSelections] = useState<Record<string, Record<string, string | null>>>({})
  const [activeSkills, setActiveSkills] = useState<Record<string, boolean>>({})
  const [othersValues, setOthersValues] = useState<Record<string, number>>({})
  const [hpModifier, setHpModifier] = useState(0)
  const isOwner = sheet?.ownerId === user?.id

  const computeAC = useCallback(async (sd: CharacterSheet) => {
    const ac = sd.template.armorClass
    if (!ac?.enabled || !ac.formula?.trim()) { setAcResult(null); return }
    try {
      const vars: Record<string, number> = {}
      sd.template.attributes.forEach(a => { const v = parseFloat(sd.values.find(sv => sv.attributeId === a.id)?.value || '0'); vars[a.key] = isNaN(v) ? 0 : v })
      sd.runtimeModifierComponentValues.forEach(rcv => { const v = parseFloat(rcv.value); vars[rcv.component.modifier.key] = isNaN(v) ? 0 : v })
      sd.fieldValues.forEach(fv => { const v = parseFloat(fv.value); vars[fv.templateField.key] = isNaN(v) ? 0 : v })
      sd.acValues.forEach(acv => { const v = parseFloat(acv.value); vars[acv.field.key] = isNaN(v) ? 0 : v })
      const res = await api.post<{ result: number }>('/formula/evaluate', { formula: ac.formula, variables: vars })
      setAcResult(res.result)
    } catch { setAcResult(null) }
  }, [])

  const computeModifiers = useCallback(async (sd: CharacterSheet) => {
    const results: Record<string, number | null> = {}
    for (const attr of sd.template.attributes) {
      if (!attr.modifier?.trim()) continue
      try {
        const vars: Record<string, number> = {}
        sd.template.attributes.forEach(a => { const v = parseFloat(sd.values.find(sv => sv.attributeId === a.id)?.value || '0'); vars[a.key] = isNaN(v) ? 0 : v })
        sd.runtimeModifierComponentValues.forEach(rcv => { const v = parseFloat(rcv.value); vars[rcv.component.modifier.key] = isNaN(v) ? 0 : v })
        const res = await api.post<{ result: number }>('/formula/evaluate', { formula: attr.modifier, variables: vars })
        results[attr.id] = res.result
      } catch { results[attr.id] = null }
    }
    setModifierResults(results)
  }, [])

  const computeSkills = useCallback(async (sd: CharacterSheet, selections?: Record<string, Record<string, string | null>>, othersOverrides?: Record<string, number>) => {
    const results: Record<string, number | null> = {}; const selMap = selections || profileSelections; const effOthers = othersOverrides ?? othersValues
    const modifierVars: Record<string, number> = {}
    for (const attr of sd.template.attributes) {
      if (!attr.modifier?.trim()) continue
      try {
        const modVars: Record<string, number> = {}
        sd.template.attributes.forEach(a => { const v = parseFloat(sd.values.find(sv => sv.attributeId === a.id)?.value || '0'); modVars[a.key] = isNaN(v) ? 0 : v })
        sd.runtimeModifierComponentValues.forEach(rcv => { const v = parseFloat(rcv.value); modVars[rcv.component.modifier.key] = isNaN(v) ? 0 : v })
        const mr = await api.post<{ result: number }>('/formula/evaluate', { formula: attr.modifier, variables: modVars })
        modifierVars[`${attr.key}_mod`] = mr.result
      } catch { modifierVars[`${attr.key}_mod`] = 0 }
    }
    for (const sv of sd.skillValues) {
      if (!sv.skill.formula?.trim()) continue
      try {
        const variables: Record<string, number> = { ...modifierVars }
        sd.template.attributes.forEach(a => { const v = parseFloat(sd.values.find(sv2 => sv2.attributeId === a.id)?.value || '0'); variables[a.key] = isNaN(v) ? 0 : v })
        sd.fieldValues.forEach(fv => { const v = parseFloat(fv.value); variables[fv.templateField.key] = isNaN(v) ? 0 : v })
        sd.runtimeModifierComponentValues.forEach(rcv => { const v = parseFloat(rcv.value); variables[rcv.component.modifier.key] = isNaN(v) ? 0 : v })
        variables['level'] = sd.level ?? 1
        const res = await api.post<{ result: number }>('/formula/evaluate', { formula: sv.skill.formula, variables })
        let finalResult = res.result + (effOthers[sv.skillId] ?? 0)
        const skillSelections = selMap[sv.skillId] || {}
        for (const profile of sd.template.skillModifierProfiles) {
          const selId = skillSelections[profile.id]
          if (selId) { const opt = profile.options.find(o => o.id === selId); if (opt) finalResult += opt.value }
          else { const stored = sd.skillProfileValues.find(spv => spv.skillId === sv.skillId && spv.profileId === profile.id); if (stored?.option?.value !== undefined) finalResult += stored.option.value }
        }
        results[sv.skillId] = finalResult
      } catch { results[sv.skillId] = null }
    }
    setSkillResults(results)
  }, []) // profileSelections/othersValues passed as params, not deps

  const fetchSheet = useCallback(async () => {
    try {
      const d = await api.get<CharacterSheet>(`/character-sheets/${id}`)
      setSheet(d); setEditName(d.characterName); setEditPlayerName(d.playerName ?? ''); setEditLevel(d.level ?? 1); setEditHpActual(d.hpActual ?? 0); setEditHpMax(d.hpMax ?? 0); setEditHpNotes(d.hpNotes ?? '')
      const vals: Record<string, string> = {}; d.values.forEach(v => { vals[v.attributeId] = v.value }); setEditValues(vals)
      const fvals: Record<string, string> = {}; d.fieldValues.forEach(fv => { fvals[fv.templateFieldId] = fv.value }); setEditFieldValues(fvals)
      const cvals: Record<string, string> = {}; d.runtimeModifierComponentValues.forEach(rcv => { cvals[rcv.componentId] = rcv.value }); setEditCompValues(cvals)
      const acvals: Record<string, string> = {}; d.acValues.forEach(acv => { acvals[acv.fieldId] = acv.value }); setEditAcValues(acvals)
      const actives: Record<string, boolean> = {}; const others: Record<string, number> = {}
      d.skillValues.forEach(sv => { const parts = (sv.value || '').split('|'); actives[sv.skillId] = parts[0] === '1'; others[sv.skillId] = parseInt(parts[1] || '0', 10) || 0 })
      setActiveSkills(actives); setOthersValues(others)
      const selMap: Record<string, Record<string, string | null>> = {}; d.skillProfileValues.forEach(spv => { if (!selMap[spv.skillId]) selMap[spv.skillId] = {}; selMap[spv.skillId][spv.profileId] = spv.optionId }); setProfileSelections(selMap)
      computeModifiers(d); computeSkills(d, selMap, others); computeAC(d)
    } catch (e: unknown) { if ((e as { statusCode?: number }).statusCode === 401 || (e as { statusCode?: number }).statusCode === 403) router.replace('/login') }
    finally { setFetching(false) }
  }, [id, router, computeModifiers, computeSkills, computeAC])

  useEffect(() => { if (!authLoading && !user) { router.replace('/login'); return }; if (user) fetchSheet() }, [authLoading, user, fetchSheet])

  async function handleComponentChange(componentId: string, value: string) {
    if (!sheet) return
    const updatedCvals = { ...editCompValues, [componentId]: value }; setEditCompValues(updatedCvals)
    const updatedSheet = { ...sheet, runtimeModifierComponentValues: sheet.runtimeModifierComponentValues.map(rcv => rcv.componentId === componentId ? { ...rcv, value } : rcv) }
    setSheet(updatedSheet)
    try { await api.patch(`/character-sheets/${sheet.id}`, { runtimeModifierComponentValues: [{ componentId, value }] }) }
    catch { const stored = sheet.runtimeModifierComponentValues.find(rcv => rcv.componentId === componentId); setEditCompValues(p => ({ ...p, [componentId]: stored?.value ?? '' })); setSheet(sheet); return }
    computeModifiers(updatedSheet); computeSkills(updatedSheet); computeAC(updatedSheet)
  }

  async function handleAcFieldChange(fieldId: string, value: string) {
    if (!sheet) return
    const updatedAcVals = { ...editAcValues, [fieldId]: value }; setEditAcValues(updatedAcVals)
    const updatedSheet = { ...sheet, acValues: sheet.acValues.map(acv => acv.fieldId === fieldId ? { ...acv, value } : acv) }
    setSheet(updatedSheet)
    try { await api.patch(`/character-sheets/${sheet.id}`, { acValues: [{ fieldId, value }] }) }
    catch { const stored = sheet.acValues.find(acv => acv.fieldId === fieldId); setEditAcValues(p => ({ ...p, [fieldId]: stored?.value ?? '0' })); setSheet(sheet); return }
    computeAC(updatedSheet)
  }

  async function handleHpModify(delta: number) { if (!sheet) return; const a = Math.abs(hpModifier) || 0; if (a === 0) return; const nh = Math.max(0, (sheet.hpActual ?? 0) + delta * a); setSheet(p => p ? { ...p, hpActual: nh } : p); try { await api.patch(`/character-sheets/${sheet.id}`, { hpActual: nh }) } catch { setSheet(p => p ? { ...p, hpActual: sheet.hpActual } : p) } }
  async function handleProfileChange(skillId: string, profileId: string, optionId: string | null) { if (!sheet) return; setProfileSelections(p => { const n = { ...p }; if (!n[skillId]) n[skillId] = {}; n[skillId] = { ...n[skillId], [profileId]: optionId }; return n }); try { await api.patch(`/character-sheets/${sheet.id}/skills/${skillId}/profiles/${profileId}`, { optionId }) } catch { const s = sheet.skillProfileValues.find(spv => spv.skillId === skillId && spv.profileId === profileId); setProfileSelections(p => { const n = { ...p }; if (!n[skillId]) n[skillId] = {}; n[skillId] = { ...n[skillId], [profileId]: s?.optionId ?? null }; return n }); return }; const us = { ...profileSelections }; if (!us[skillId]) us[skillId] = {}; us[skillId] = { ...us[skillId], [profileId]: optionId }; computeSkills(sheet, us) }

  async function handleSave(e: FormEvent) { e.preventDefault(); setEditError(null); setSaving(true)
    try { const values = Object.entries(editValues).map(([aid, v]) => ({ attributeId: aid, value: v })); const fvs = Object.entries(editFieldValues).map(([tfId, v]) => ({ templateFieldId: tfId, value: v })); const cvs = Object.entries(editCompValues).map(([cid, v]) => ({ componentId: cid, value: v })); const acvs = Object.entries(editAcValues).map(([fid, v]) => ({ fieldId: fid, value: v }))
      const u = await api.patch<CharacterSheet>(`/character-sheets/${id}`, { characterName: editName.trim() || undefined, playerName: editPlayerName.trim() || undefined, level: editLevel, hpActual: editHpActual, hpMax: editHpMax, hpNotes: editHpNotes || undefined, values, fieldValues: fvs, runtimeModifierComponentValues: cvs, acValues: acvs })
      setSheet(u); setEditing(false); computeModifiers(u); computeSkills(u, profileSelections); computeAC(u)
    } catch (err) { setEditError(err instanceof Error ? err.message : 'Failed to update') } finally { setSaving(false) }
  }
  async function handleDelete() { setDeleteError(null); setDeleting(true); try { await api.delete(`/character-sheets/${id}`); router.push('/dashboard?tab=character-sheets') } catch (err) { setDeleteError(err instanceof Error ? err.message : 'Failed to delete'); setDeleting(false); setConfirmDelete(false) } }

  if (authLoading || fetching) return <main className="flex-1 flex items-center justify-center p-4"><div className="flex flex-col items-center gap-3 text-muted-foreground"><div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"/><span className="text-sm">Loading...</span></div></main>
  if (!sheet) return <main className="flex-1 flex items-center justify-center p-4"><div className="text-sm text-muted-foreground">Character sheet not found.</div></main>

  const allProfiles: SkillModifierProfile[] = sheet?.template.skillModifierProfiles ?? []
  const armorClass = sheet?.template.armorClass

  return (<main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 animate-fade-in">
    <div className="mb-6"><Link href="/dashboard?tab=character-sheets" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>Back to Character Sheets</Link></div>
    {!editing ? (<div className="space-y-6">
      <div className="card !p-6 space-y-4"><div className="flex gap-4"><div className="shrink-0">{avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-lg object-cover border border-border"/> : isOwner ? <label className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/30 transition-colors"><span className="text-2xl text-muted">+</span><input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)setAvatarUrl(URL.createObjectURL(f))}}/></label> : null}</div><div className="flex-1 min-w-0"><h1 className="text-2xl font-bold text-gradient truncate">{sheet.characterName}</h1><div className="flex flex-wrap items-center gap-2 mt-2">{sheet.playerName&&<span className="badge badge-gold">Player: {sheet.playerName}</span>}{sheet.level&&<span className="badge badge-gold">Level: {sheet.level}</span>}{sheet.adventure&&<span className="badge badge-gold">{sheet.adventure.campaign}</span>}<span className="badge badge-gold">{sheet.template.name}</span><span className="text-xs text-muted">Created {new Date(sheet.createdAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span></div></div>{isOwner&&<div className="flex gap-2 shrink-0"><button onClick={()=>setEditing(true)} className="btn-ghost"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>Edit</button><button onClick={()=>setConfirmDelete(true)} className="btn-danger"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>Delete</button></div>}</div>{sheet.adventure&&<><hr className="divider"/><div><h3 className="text-sm font-medium text-muted mb-1">Adventure</h3><p className="text-foreground/80 text-sm">{sheet.adventure.name}</p></div></>}</div>
      <div className="card !p-4 space-y-3"><h3 className="font-semibold text-sm">Health Points{sheet.hpNotes&&<span className="text-xs text-muted ml-2 font-normal">— {sheet.hpNotes}</span>}</h3><div className="flex items-center justify-between gap-3"><div className="text-center"><span className="text-muted text-xs block">Actual</span><span className="text-xl font-bold text-foreground">{sheet.hpActual??0}</span></div><span className="text-muted text-lg">/</span><div className="text-center"><span className="text-muted text-xs block">Max</span><span className="text-xl font-bold text-foreground">{sheet.hpMax??0}</span></div></div>{isOwner&&<div className="space-y-2 pt-2 border-t border-border"><div className="flex items-center gap-2"><input type="number" min={0} className="input-field py-1 text-xs flex-1" value={hpModifier||''} placeholder="Amount" onChange={e=>setHpModifier(parseInt(e.target.value,10)||0)}/></div><div className="flex gap-2"><button type="button" onClick={()=>handleHpModify(1)} disabled={!hpModifier} className="btn-primary text-xs flex-1 py-1">+ Heal</button><button type="button" onClick={()=>handleHpModify(-1)} disabled={!hpModifier} className="btn-danger text-xs flex-1 py-1">− Damage</button></div></div>}</div>
      {sheet.fieldValues.length>0&&<div className="card !p-6"><h3 className="font-semibold mb-3">Character Info</h3><div className="grid gap-2 sm:grid-cols-2">{sheet.fieldValues.map(fv=><div key={fv.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border"><span className="text-sm text-muted">{fv.templateField.label}</span><span className="text-sm font-medium text-foreground">{fv.value||'—'}</span></div>)}</div></div>}
      <div className="card !p-6"><h3 className="font-semibold mb-4">Attributes</h3><div className="grid gap-3 sm:grid-cols-2">{sheet.template.attributes.map(attr=>{const val=sheet.values.find(v=>v.attributeId===attr.id);const modResult=modifierResults[attr.id];return <div key={attr.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border"><span className="text-sm text-foreground">{attr.name}{attr.modifier&&<span className="text-[0.6rem] text-primary ml-1">mod</span>}</span><div className="flex items-center gap-3"><span className="text-sm font-semibold text-foreground">{val?.value||'—'}</span>{modResult!==undefined&&modResult!==null&&<span className="text-sm font-semibold text-primary">({modResult>=0?'+':''}{modResult})</span>}</div></div>})}</div></div>

      {/* Armor Class Card */}
      {armorClass?.enabled && armorClass.fields.length > 0 && (
        <div className="card !p-6">
          <h3 className="font-semibold mb-4">Armor Class</h3>
          <div className="flex items-center justify-center mb-4">
            <div className="w-24 h-24 rounded-full border-4 border-primary/30 flex items-center justify-center bg-background/50">
              <span className="text-4xl font-bold text-primary">{acResult !== null ? acResult : '—'}</span>
            </div>
          </div>
          {armorClass.formula && (
            <div className="text-center mb-3 text-xs text-muted">Formula: <span className="font-mono text-foreground">{armorClass.formula}</span></div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {armorClass.fields.map(field => {
              const acv = sheet.acValues.find(v => v.fieldId === field.id)
              const val = acv?.value ?? field.defaultValue
              const canEdit = isOwner && field.editableByPlayer
              return (
                <div key={field.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-sm text-foreground truncate">{field.name}</span>
                    {field.description && <span className="text-[0.6rem] text-muted hidden sm:inline">— {field.description}</span>}
                  </div>
                  {canEdit ? (
                    <input
                      type="number"
                      className="input-field py-1 text-xs w-16 text-right"
                      value={val}
                      onChange={e => handleAcFieldChange(field.id, e.target.value)}
                    />
                  ) : (
                    <span className="text-sm font-semibold text-foreground">{val}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Runtime Modifiers — expandable component-based */}
      {sheet.template.runtimeModifiers.length>0&&<div className="card !p-6"><h3 className="font-semibold mb-4">Runtime Modifiers</h3><div className="grid gap-3 sm:grid-cols-1">
        {sheet.template.runtimeModifiers.map(modDef=>{
          const compValues = sheet.runtimeModifierComponentValues.filter(rcv=>rcv.component.modifier.id===modDef.id)
          const total = compValues.reduce((sum,rcv)=>{const v=parseFloat(rcv.value);return sum+(isNaN(v)?0:v)},0)
          return <CollapsibleRuntimeModifier key={modDef.id} modDef={modDef} compValues={compValues} total={total} isOwner={isOwner} onChange={handleComponentChange} />
        })}
      </div></div>}

      {sheet.skillValues.length>0&&<div className="card !p-6"><h3 className="font-semibold mb-4">Skills</h3><div className="grid gap-3 sm:grid-cols-2">{sheet.skillValues.map(sv=><CollapsibleSkillRow key={sv.id} skill={sv} result={skillResults[sv.skillId]} profiles={allProfiles} selections={profileSelections[sv.skillId]||{}} active={activeSkills[sv.skillId]??false} others={othersValues[sv.skillId]??0} onToggleActive={async()=>{const nv=!activeSkills[sv.skillId];setActiveSkills(p=>({...p,[sv.skillId]:nv}));const ov=othersValues[sv.skillId]??0;try{await api.patch(`/character-sheets/${sheet.id}`,{skillValues:[{skillId:sv.skillId,value:`${nv?'1':'0'}|${ov}`}]})}catch{setActiveSkills(p=>({...p,[sv.skillId]:!nv}))}}} onOthersChange={async(no:number)=>{const ov=Math.max(0,Math.floor(no));const next={...othersValues,[sv.skillId]:ov};setOthersValues(next);computeSkills(sheet,profileSelections,next);const av=activeSkills[sv.skillId]??false;try{await api.patch(`/character-sheets/${sheet.id}`,{skillValues:[{skillId:sv.skillId,value:`${av?'1':'0'}|${ov}`}]})}catch{setOthersValues(p=>({...p,[sv.skillId]:othersValues[sv.skillId]??0}))}}} onProfileChange={(pid,oid)=>handleProfileChange(sv.skillId,pid,oid)}/>)}</div></div>}
      <div className="text-center"><p className="text-xs text-muted">{isOwner?'You own this character sheet.':'This character sheet belongs to another player.'}</p></div>
      {confirmDelete&&<DeleteModal name={sheet.characterName} error={deleteError} loading={deleting} onCancel={()=>setConfirmDelete(false)} onConfirm={handleDelete}/>}
    </div>) : (<EditForm name={editName} playerName={editPlayerName} level={editLevel} hpActual={editHpActual} hpMax={editHpMax} hpNotes={editHpNotes} attributes={sheet.template.attributes} values={editValues} fieldValues={sheet.fieldValues} editFieldValues={editFieldValues} runtimeModifiers={sheet.template.runtimeModifiers} editCompValues={editCompValues} armorClass={armorClass} editAcValues={editAcValues} error={editError} saving={saving} onNameChange={setEditName} onPlayerNameChange={setEditPlayerName} onLevelChange={setEditLevel} onHpActualChange={setEditHpActual} onHpMaxChange={setEditHpMax} onHpNotesChange={setEditHpNotes} onValueChange={(aid,v)=>setEditValues(p=>({...p,[aid]:v}))} onFieldValueChange={(tfId,v)=>setEditFieldValues(p=>({...p,[tfId]:v}))} onCompValueChange={(cid,v)=>setEditCompValues(p=>({...p,[cid]:v}))} onAcValueChange={(fid,v)=>setEditAcValues(p=>({...p,[fid]:v}))} onCancel={()=>{setEditing(false);setEditError(null);setEditName(sheet.characterName);setEditPlayerName(sheet.playerName??'');setEditLevel(sheet.level??1);setEditHpActual(sheet.hpActual??0);setEditHpMax(sheet.hpMax??0);setEditHpNotes(sheet.hpNotes??'');const vals:Record<string,string>={};sheet.values.forEach(v=>{vals[v.attributeId]=v.value});setEditValues(vals);const fvals:Record<string,string>={};sheet.fieldValues.forEach(fv=>{fvals[fv.templateFieldId]=fv.value});setEditFieldValues(fvals);const cvals:Record<string,string>={};sheet.runtimeModifierComponentValues.forEach(rcv=>{cvals[rcv.componentId]=rcv.value});setEditCompValues(cvals);const acvals:Record<string,string>={};sheet.acValues.forEach(acv=>{acvals[acv.fieldId]=acv.value});setEditAcValues(acvals)}} onSubmit={handleSave}/>)}
  </main>)
}

function CollapsibleRuntimeModifier({ modDef, compValues, total, isOwner, onChange }: { modDef: RuntimeModifierDef; compValues: RuntimeModifierComponentValue[]; total: number; isOwner: boolean; onChange: (componentId: string, value: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  return <div className="rounded-lg border border-border bg-background/30 overflow-hidden">
    <button type="button" onClick={()=>setExpanded(!expanded)} className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-background/50 transition-colors">
      <div className="min-w-0"><span className="text-sm font-medium text-foreground">{modDef.name}</span>{modDef.description&&<span className="text-xs text-muted ml-2">— {modDef.description}</span>}</div>
      <div className="flex items-center gap-2 shrink-0 ml-3"><span className="text-base font-bold text-primary">{total}</span><svg className={`w-4 h-4 text-muted transition-transform ${expanded?'rotate-180':''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg></div>
    </button>
    {expanded&&<div className="px-4 py-3 space-y-2 border-t border-border ml-4">
      {modDef.components.map(comp=>{
        const rcv = compValues.find(v=>v.componentId===comp.id); const val = rcv?.value ?? comp.defaultValue ?? '0'
        const isLocked = comp.locked || !!comp.formula
        const displayVal = comp.formula ? comp.formula : val
        return <div key={comp.id} className="flex items-center gap-2">
          <span className="text-xs text-muted shrink-0 min-w-[100px]">{comp.name}</span>
          {isOwner&&!isLocked ? <input type="number" className="input-field py-1 text-xs w-20" value={val} onChange={e=>onChange(comp.id,e.target.value)}/> : <span className="text-sm font-semibold text-foreground">{displayVal}</span>}
          {comp.formula&&<span className="text-[0.6rem] text-primary ml-1">formula</span>}
          {comp.locked&&!comp.formula&&<span className="text-[0.6rem] text-muted ml-1">locked</span>}
        </div>
      })}
    </div>}
  </div>
}

function CollapsibleSkillRow({ skill, result, profiles, selections, active, others, onToggleActive, onOthersChange, onProfileChange }: { skill: SkillValue; result: number | null; profiles: SkillModifierProfile[]; selections: Record<string, string | null>; active: boolean; others: number; onToggleActive: () => void; onOthersChange: (v: number) => void; onProfileChange: (profileId: string, optionId: string | null) => void }) {
  const [expanded, setExpanded] = useState(false)
  return <div className={`rounded-lg border border-border bg-background/30 overflow-hidden transition-opacity ${active?'':'opacity-40'}`}><div className="flex items-center px-4 py-3"><input type="checkbox" checked={active} onChange={onToggleActive} className="shrink-0 w-4 h-4 rounded border-border accent-primary cursor-pointer mr-3"/><button type="button" onClick={()=>setExpanded(!expanded)} disabled={!active} className="flex items-center justify-between flex-1 min-w-0 text-left hover:bg-background/50 transition-colors disabled:cursor-default disabled:hover:bg-transparent"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-sm font-medium text-foreground truncate">{skill.skill.name}</span>{skill.skill.description&&<span className="text-xs text-muted truncate hidden sm:inline">— {skill.skill.description}</span>}</div></div><div className="flex items-center gap-3 shrink-0 ml-3"><span className="text-base font-bold text-primary">{active?(result!=null?result:'—'):'0'}</span><svg className={`w-4 h-4 text-muted transition-transform ${expanded?'rotate-180':''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg></div></button></div>{expanded&&active&&<div className="px-4 py-3 space-y-2 border-t border-border ml-10">{profiles.map(profile=>{const sid=selections[profile.id];const so=sid?profile.options.find(o=>o.id===sid):null;return <div key={profile.id} className="flex items-center gap-2"><span className="text-xs text-muted shrink-0 min-w-[80px]">{profile.name}:</span><select className="input-field py-1 text-xs flex-1" value={sid??''} onChange={e=>{onProfileChange(profile.id,e.target.value||null)}}><option value="">— Select —</option>{profile.options.map(opt=><option key={opt.id} value={opt.id}>{opt.label} ({opt.value>=0?'+':''}{opt.value})</option>)}</select>{so&&<span className="text-xs font-mono text-primary shrink-0">{so.value>=0?'+':''}{so.value}</span>}</div>})}<div className="flex items-center gap-2"><span className="text-xs text-muted shrink-0 min-w-[80px]">Others:</span><input type="number" min={0} step={1} className="input-field py-1 text-xs w-20" value={others||''} placeholder="0" onChange={e=>onOthersChange(parseInt(e.target.value,10)||0)}/>{others>0&&<span className="text-xs font-mono text-primary">+{others}</span>}</div></div>}</div>
}

function EditForm(props: { name: string; playerName: string; level: number; hpActual: number; hpMax: number; hpNotes: string; attributes: { id: string; key: string; name: string }[]; values: Record<string, string>; fieldValues: FieldValue[]; editFieldValues: Record<string, string>; runtimeModifiers: RuntimeModifierDef[]; editCompValues: Record<string, string>; armorClass: ArmorClassDef | null; editAcValues: Record<string, string>; error: string | null; saving: boolean; onNameChange: (v: string) => void; onPlayerNameChange: (v: string) => void; onLevelChange: (v: number) => void; onHpActualChange: (v: number) => void; onHpMaxChange: (v: number) => void; onHpNotesChange: (v: string) => void; onValueChange: (aid: string, v: string) => void; onFieldValueChange: (tfId: string, v: string) => void; onCompValueChange: (cid: string, v: string) => void; onAcValueChange: (fid: string, v: string) => void; onCancel: () => void; onSubmit: (e: FormEvent) => void }) {
  return <form onSubmit={props.onSubmit} className="card !p-6 space-y-4 animate-slide-up">
    <div className="flex items-center gap-3 mb-2"><svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg><h2 className="text-xl font-semibold text-gradient">Edit Character Sheet</h2></div>
    <div className="grid gap-4 sm:grid-cols-3"><div><label className="label">Character Name</label><input className="input-field" value={props.name} onChange={e=>props.onNameChange(e.target.value)} maxLength={100}/></div><div><label className="label">Player Name</label><input className="input-field" value={props.playerName} onChange={e=>props.onPlayerNameChange(e.target.value)} maxLength={100} placeholder="Player name"/></div><div><label className="label">Level</label><input type="number" className="input-field" value={props.level} onChange={e=>props.onLevelChange(Number(e.target.value))} min={1}/></div></div>
    <div><label className="label">Health Points</label><div className="grid gap-2 sm:grid-cols-3 mt-1"><div><label className="text-xs text-muted mb-1 block">Actual</label><input type="number" className="input-field" value={props.hpActual} onChange={e=>props.onHpActualChange(Number(e.target.value))} min={0}/></div><div><label className="text-xs text-muted mb-1 block">Max</label><input type="number" className="input-field" value={props.hpMax} onChange={e=>props.onHpMaxChange(Number(e.target.value))} min={0}/></div><div><label className="text-xs text-muted mb-1 block">Notes</label><input className="input-field" value={props.hpNotes} onChange={e=>props.onHpNotesChange(e.target.value)} placeholder="e.g. 1d8 per level"/></div></div></div>
    {props.fieldValues.length>0&&<div><label className="label">Character Info (Template)</label><div className="space-y-3 mt-1">{props.fieldValues.map(fv=><div key={fv.id}><label className="text-xs text-muted mb-1 block">{fv.templateField.label}</label><input className="input-field" value={props.editFieldValues[fv.templateFieldId]??''} onChange={e=>props.onFieldValueChange(fv.templateFieldId,e.target.value)} placeholder={`Enter ${fv.templateField.label}...`}/></div>)}</div></div>}
    <div><label className="label">Attributes</label><div className="space-y-3 mt-1">{props.attributes.map(attr=><div key={attr.id}><label className="text-xs text-muted flex items-center gap-1 mb-1">{attr.name}</label><input className="input-field" value={props.values[attr.id]??''} onChange={e=>props.onValueChange(attr.id,e.target.value)} placeholder={`Enter ${attr.name}...`}/></div>)}</div></div>
    {props.armorClass?.enabled && props.armorClass.fields.length > 0 && <div><label className="label">Armor Class Fields</label><div className="space-y-3 mt-1">{props.armorClass.fields.map(field=>{const isEditable=field.editableByPlayer;return <div key={field.id}><label className="text-xs text-muted flex items-center gap-1 mb-1">{field.name}{field.description&&<span className="font-normal italic ml-1">— {field.description}</span>}{!isEditable&&<span className="text-[0.6rem] text-muted ml-1">(fixed)</span>}</label>{isEditable?<input type="number" className="input-field" value={props.editAcValues[field.id]??field.defaultValue} onChange={e=>props.onAcValueChange(field.id,e.target.value)} placeholder={field.defaultValue}/>:<span className="text-sm font-semibold text-foreground block py-2">{props.editAcValues[field.id]??field.defaultValue}</span>}</div>})}</div></div>}
    {props.runtimeModifiers.length>0&&<div><label className="label">Runtime Modifiers</label><div className="space-y-3 mt-1">{props.runtimeModifiers.map(modDef=><div key={modDef.id} className="rounded-lg border border-border bg-background/30 p-3 space-y-2"><span className="text-sm font-medium text-foreground">{modDef.name}{modDef.description&&<span className="text-xs text-muted ml-2">— {modDef.description}</span>}</span><div className="space-y-1 pl-2">{modDef.components.map(comp=>{const isLocked=comp.locked||!!comp.formula;return <div key={comp.id} className="flex items-center gap-2"><span className="text-xs text-muted min-w-[100px]">{comp.name}</span>{isLocked?<span className="text-xs font-medium text-foreground italic">{comp.formula||comp.defaultValue||'0'}</span>:<input type="number" className="input-field py-1 text-xs w-20" value={props.editCompValues[comp.id]??comp.defaultValue??'0'} onChange={e=>props.onCompValueChange(comp.id,e.target.value)}/>}{comp.formula&&<span className="text-[0.6rem] text-primary">formula</span>}{comp.locked&&!comp.formula&&<span className="text-[0.6rem] text-muted">locked</span>}</div>})}</div></div>)}</div></div>}
    {props.error&&<div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{props.error}</div>}
    <div className="flex gap-3 justify-end pt-2"><button type="button" onClick={props.onCancel} disabled={props.saving} className="btn-ghost">Cancel</button><button type="submit" disabled={props.saving||props.name.trim().length===0} className="btn-primary">{props.saving?<><div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"/>Saving...</>:'Save Changes'}</button></div>
  </form>
}

function DeleteModal({ name, error, loading, onCancel, onConfirm }: { name: string; error: string | null; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in"><div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center"><svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg></div><div><h2 className="font-semibold">Delete Character Sheet</h2><p className="text-sm text-muted-foreground">This action cannot be undone.</p></div></div><p className="text-sm text-muted-foreground">Are you sure you want to delete "{name}"?</p>{error&&<div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{error}</div>}<div className="flex gap-3 justify-end"><button onClick={onCancel} disabled={loading} className="btn-ghost">Cancel</button><button onClick={onConfirm} disabled={loading} className="btn-danger-solid">{loading?'Deleting...':'Delete forever'}</button></div></div></div>
}