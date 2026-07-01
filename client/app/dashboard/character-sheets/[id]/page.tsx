'use client'

import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import { InlineText, InlineNumber, InlineTextarea } from '@/lib/inline-editable'
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
  id: string; fieldId: string; value: string; field: ArmorClassFieldDef
}

interface Ability { id: string; name: string; description: string | null; manaCost: number | null; cooldown: string | null; notes: string | null; order: number }
interface InventoryItem { id: string; name: string; weight: number | null; cost: string | null; description: string | null; order: number }
interface Story { id: string; appearance: string | null; backstory: string | null; personality: string | null; goals: string | null; notes: string | null }

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
  abilities: Ability[]; inventoryItems: InventoryItem[]; story: Story | null
  ownerId: string; createdAt: string
}

type Tab = 'character' | 'abilities' | 'inventory' | 'story'

export default function CharacterSheetDetailPage() {
  const router = useRouter(); const params = useParams(); const id = params.id as string
  const { user, loading: authLoading } = useAuth()
  const [sheet, setSheet] = useState<CharacterSheet | null>(null); const [fetching, setFetching] = useState(true)
  const [modifierResults, setModifierResults] = useState<Record<string, number | null>>({})
  const [skillResults, setSkillResults] = useState<Record<string, number | null>>({})
  const [acResult, setAcResult] = useState<number | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false); const [deleting, setDeleting] = useState(false); const [deleteError, setDeleteError] = useState<string | null>(null)
  const [profileSelections, setProfileSelections] = useState<Record<string, Record<string, string | null>>>({})
  const profileSelectionsRef = useRef(profileSelections)
  profileSelectionsRef.current = profileSelections
  const [activeSkills, setActiveSkills] = useState<Record<string, boolean>>({})
  const [othersValues, setOthersValues] = useState<Record<string, number>>({})
  const othersValuesRef = useRef(othersValues)
  othersValuesRef.current = othersValues
  const [hpModifier, setHpModifier] = useState(0)
  const [activeTab, setActiveTab] = useState<Tab>('character')
  const isOwner = sheet?.ownerId === user?.id

  // ability/inventory/story state
  const [abilities, setAbilities] = useState<Ability[]>([]); const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]); const [story, setStory] = useState<Story | null>(null)
  const [showNewAbility, setShowNewAbility] = useState(false); const [newAbility, setNewAbility] = useState({ name: '', description: '', manaCost: '', cooldown: '', notes: '' })
  const [abilitySaving, setAbilitySaving] = useState(false); const [abilityError, setAbilityError] = useState<string | null>(null)
  const [showNewItem, setShowNewItem] = useState(false); const [newItem, setNewItem] = useState({ name: '', weight: '', cost: '', description: '' })
  const [itemSaving, setItemSaving] = useState(false); const [itemError, setItemError] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

  // ── Shared sheet update helper ──
  const updateSheet = useCallback(async (data: Record<string, unknown>): Promise<CharacterSheet> => {
    const current = sheet!
    const updated = await api.patch<CharacterSheet>(`/character-sheets/${current.id}`, data)
    setSheet(updated)
    return updated
  }, [sheet])

  // ── Formula computation ──
  const computeAC = useCallback(async (sd: CharacterSheet) => {
    const ac = sd.template.armorClass
    if (!ac?.enabled || !ac.formula?.trim()) { setAcResult(null); return }
    try {
      const vars: Record<string, number> = {}
      sd.template.attributes.forEach(a => { const v = parseFloat(sd.values.find(sv => sv.attributeId === a.id)?.value || '0'); vars[a.key] = isNaN(v) ? 0 : v })
      sd.runtimeModifierComponentValues.forEach(rcv => { const v = parseFloat(rcv.value); vars[rcv.component.modifier.key] = isNaN(v) ? 0 : v })
      sd.fieldValues.forEach(fv => { const v = parseFloat(fv.value); vars[fv.templateField.key] = isNaN(v) ? 0 : v })
      sd.acValues.forEach(acv => { const v = parseFloat(acv.value); vars[acv.field.key] = isNaN(v) ? 0 : v })
      // Compute attribute modifiers for formula support
      for (const attr of sd.template.attributes) {
        if (!attr.modifier?.trim()) continue
        try {
          const modVars: Record<string, number> = {}
          sd.template.attributes.forEach(a => { const v = parseFloat(sd.values.find(sv => sv.attributeId === a.id)?.value || '0'); modVars[a.key] = isNaN(v) ? 0 : v })
          sd.runtimeModifierComponentValues.forEach(rcv => { const v = parseFloat(rcv.value); modVars[rcv.component.modifier.key] = isNaN(v) ? 0 : v })
          const mr = await api.post<{ result: number }>('/formula/evaluate', { formula: attr.modifier, variables: modVars })
          vars[`${attr.key}_mod`] = mr.result
        } catch { vars[`${attr.key}_mod`] = 0 }
      }
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
    const results: Record<string, number | null> = {}; const selMap = selections || profileSelectionsRef.current; const effOthers = othersOverrides ?? othersValuesRef.current
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
  }, [])

  const fetchSheet = useCallback(async () => {
    try {
      const d = await api.get<CharacterSheet>(`/character-sheets/${id}`)
      setSheet(d)
      const actives: Record<string, boolean> = {}; const others: Record<string, number> = {}
      d.skillValues.forEach(sv => { const parts = (sv.value || '').split('|'); actives[sv.skillId] = parts[0] === '1'; others[sv.skillId] = parseInt(parts[1] || '0', 10) || 0 })
      setActiveSkills(actives); setOthersValues(others)
      const selMap: Record<string, Record<string, string | null>> = {}; d.skillProfileValues.forEach(spv => { if (!selMap[spv.skillId]) selMap[spv.skillId] = {}; selMap[spv.skillId][spv.profileId] = spv.optionId }); setProfileSelections(selMap)
      setAbilities(d.abilities || []); setInventoryItems(d.inventoryItems || []); setStory(d.story || null)
      computeModifiers(d); computeSkills(d, selMap, others); computeAC(d)
    } catch (e: unknown) { if ((e as { statusCode?: number }).statusCode === 401 || (e as { statusCode?: number }).statusCode === 403) router.replace('/login') }
    finally { setFetching(false) }
  }, [id, router, computeModifiers, computeSkills, computeAC])

  useEffect(() => { if (!authLoading && !user) { router.replace('/login'); return }; if (user) fetchSheet() }, [authLoading, user, fetchSheet])

  // ── Inline save handlers ──
  async function saveCharacterName(name: string) {
    const updated = await updateSheet({ characterName: name })
    computeModifiers(updated); computeSkills(updated, profileSelections); computeAC(updated)
  }

  async function savePlayerName(name: string) {
    await updateSheet({ playerName: name || undefined })
  }

  async function saveLevel(level: number) {
    const updated = await updateSheet({ level })
    computeModifiers(updated); computeSkills(updated, profileSelections); computeAC(updated)
  }

  async function saveHpActual(hp: number) {
    await updateSheet({ hpActual: hp })
  }

  async function saveHpMax(hp: number) {
    await updateSheet({ hpMax: hp })
  }

  async function saveHpNotes(notes: string) {
    await updateSheet({ hpNotes: notes || undefined })
  }

  async function saveAttributeValue(attributeId: string, value: string) {
    const updated = await updateSheet({ values: [{ attributeId, value }] })
    computeModifiers(updated); computeSkills(updated, profileSelections); computeAC(updated)
  }

  async function saveFieldValue(templateFieldId: string, value: string) {
    const updated = await updateSheet({ fieldValues: [{ templateFieldId, value }] })
    computeModifiers(updated); computeSkills(updated, profileSelections); computeAC(updated)
  }

  async function handleComponentChange(componentId: string, value: string) {
    if (!sheet) return
    const optimisticSheet = { ...sheet, runtimeModifierComponentValues: sheet.runtimeModifierComponentValues.map(rcv => rcv.componentId === componentId ? { ...rcv, value } : rcv) }
    setSheet(optimisticSheet)
    try {
      const updated = await updateSheet({ runtimeModifierComponentValues: [{ componentId, value }] })
      computeModifiers(updated); computeSkills(updated, profileSelections); computeAC(updated)
    } catch {
      setSheet(sheet)
    }
  }

  async function handleAcFieldChange(fieldId: string, value: string) {
    if (!sheet) return
    const optimisticSheet = { ...sheet, acValues: sheet.acValues.map(acv => acv.fieldId === fieldId ? { ...acv, value } : acv) }
    setSheet(optimisticSheet)
    try {
      const updated = await updateSheet({ acValues: [{ fieldId, value }] })
      computeAC(updated)
    } catch {
      setSheet(sheet)
    }
  }

  async function handleHpModify(delta: number) {
    if (!sheet) return; const a = Math.abs(hpModifier) || 0; if (a === 0) return
    const nh = Math.max(0, (sheet.hpActual ?? 0) + delta * a)
    const optimistic = { ...sheet, hpActual: nh }
    setSheet(optimistic)
    try { await updateSheet({ hpActual: nh }) } catch { setSheet(sheet) }
  }

  async function handleProfileChange(skillId: string, profileId: string, optionId: string | null) {
    if (!sheet) return
    setProfileSelections(p => { const n = { ...p }; if (!n[skillId]) n[skillId] = {}; n[skillId] = { ...n[skillId], [profileId]: optionId }; return n })
    try {
      await api.patch(`/character-sheets/${sheet.id}/skills/${skillId}/profiles/${profileId}`, { optionId })
    } catch {
      const s = sheet.skillProfileValues.find(spv => spv.skillId === skillId && spv.profileId === profileId)
      setProfileSelections(p => { const n = { ...p }; if (!n[skillId]) n[skillId] = {}; n[skillId] = { ...n[skillId], [profileId]: s?.optionId ?? null }; return n })
      return
    }
    const us = { ...profileSelections }; if (!us[skillId]) us[skillId] = {}; us[skillId] = { ...us[skillId], [profileId]: optionId }
    computeSkills(sheet, us)
  }

  async function handleSkillToggle(skillId: string) {
    const nv = !activeSkills[skillId]
    setActiveSkills(p => ({ ...p, [skillId]: nv }))
    const ov = othersValues[skillId] ?? 0
    try {
      await api.patch(`/character-sheets/${sheet!.id}`, { skillValues: [{ skillId, value: `${nv ? '1' : '0'}|${ov}` }] })
    } catch {
      setActiveSkills(p => ({ ...p, [skillId]: !nv }))
    }
  }

  async function handleOthersChange(skillId: string, no: number) {
    const ov = Math.max(0, Math.floor(no))
    const next = { ...othersValues, [skillId]: ov }
    setOthersValues(next)
    if (sheet) computeSkills(sheet, profileSelections, next)
    const av = activeSkills[skillId] ?? false
    try {
      await api.patch(`/character-sheets/${sheet!.id}`, { skillValues: [{ skillId, value: `${av ? '1' : '0'}|${ov}` }] })
    } catch {
      setOthersValues(p => ({ ...p, [skillId]: othersValues[skillId] ?? 0 }))
    }
  }

  // ── Inline ability field saves ──
  async function saveAbilityField(abilityId: string, field: string, value: string) {
    if (!sheet) return
    const body: Record<string, unknown> = {}
    if (field === 'manaCost') body.manaCost = value.trim() ? parseInt(value, 10) : undefined
    else if (field === 'cooldown') body.cooldown = value.trim() || undefined
    else if (field === 'notes') body.notes = value.trim() || undefined
    else if (field === 'description') body.description = value.trim() || undefined
    else if (field === 'name') body.name = value.trim()
    const updated = await api.patch<Ability>(`/character-sheets/${sheet.id}/abilities/${abilityId}`, body)
    setAbilities(p => p.map(a => a.id === abilityId ? updated : a))
  }

  // ── Inline item field saves ──
  async function saveItemField(itemId: string, field: string, value: string) {
    if (!sheet) return
    const body: Record<string, unknown> = {}
    if (field === 'name') body.name = value.trim()
    else if (field === 'weight') body.weight = value.trim() ? parseFloat(value) : undefined
    else if (field === 'cost') body.cost = value.trim() || undefined
    else if (field === 'description') body.description = value.trim() || undefined
    const updated = await api.patch<InventoryItem>(`/character-sheets/${sheet.id}/inventory/${itemId}`, body)
    setInventoryItems(p => p.map(i => i.id === itemId ? updated : i))
  }

  async function handleDelete() { setDeleteError(null); setDeleting(true); try { await api.delete(`/character-sheets/${id}`); router.push('/dashboard?tab=character-sheets') } catch (err) { setDeleteError(err instanceof Error ? err.message : 'Failed to delete'); setDeleting(false); setConfirmDelete(false) } }

  // ── Abilities CRUD ──
  function resetNewAbility() { setShowNewAbility(false); setNewAbility({ name: '', description: '', manaCost: '', cooldown: '', notes: '' }); setAbilityError(null) }
  async function handleCreateAbility(e: FormEvent) { e.preventDefault(); if (!newAbility.name.trim() || !sheet) return; setAbilitySaving(true); setAbilityError(null)
    try { const a = await api.post<Ability>(`/character-sheets/${sheet.id}/abilities`, { name: newAbility.name.trim(), description: newAbility.description.trim() || undefined, manaCost: newAbility.manaCost.trim() ? parseInt(newAbility.manaCost, 10) : undefined, cooldown: newAbility.cooldown.trim() || undefined, notes: newAbility.notes.trim() || undefined })
      setAbilities(p => [...p, a]); resetNewAbility()
    } catch (err) { setAbilityError(err instanceof Error ? err.message : 'Failed to create ability') } finally { setAbilitySaving(false) } }
  async function handleDeleteAbility(aid: string) { if (!sheet) return; try { await api.delete(`/character-sheets/${sheet.id}/abilities/${aid}`); setAbilities(p => p.filter(a => a.id !== aid)) } catch {} }

  // ── Inventory CRUD ──
  function resetNewItem() { setShowNewItem(false); setNewItem({ name: '', weight: '', cost: '', description: '' }); setItemError(null) }
  async function handleCreateItem(e: FormEvent) { e.preventDefault(); if (!newItem.name.trim() || !sheet) return; setItemSaving(true); setItemError(null)
    try { const i = await api.post<InventoryItem>(`/character-sheets/${sheet.id}/inventory`, { name: newItem.name.trim(), weight: newItem.weight.trim() ? parseFloat(newItem.weight) : undefined, cost: newItem.cost.trim() || undefined, description: newItem.description.trim() || undefined })
      setInventoryItems(p => [...p, i]); resetNewItem()
    } catch (err) { setItemError(err instanceof Error ? err.message : 'Failed to create item') } finally { setItemSaving(false) } }
  async function handleDeleteItem(iid: string) { if (!sheet) return; try { await api.delete(`/character-sheets/${sheet.id}/inventory/${iid}`); setInventoryItems(p => p.filter(i => i.id !== iid)) } catch {} }

  // ── Story inline saves ──
  async function saveStoryField(field: string, value: string) {
    if (!sheet) return
    try {
      const s = await api.patch<Story>(`/character-sheets/${sheet.id}/story`, { [field]: value.trim() || null })
      setStory(s)
    } catch {}
  }

  if (authLoading || fetching) return <main className="flex-1 flex items-center justify-center p-4"><div className="flex flex-col items-center gap-3 text-muted-foreground"><div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"/><span className="text-sm">Loading...</span></div></main>
  if (!sheet) return <main className="flex-1 flex items-center justify-center p-4"><div className="text-sm text-muted-foreground">Character sheet not found.</div></main>

  const allProfiles: SkillModifierProfile[] = sheet?.template.skillModifierProfiles ?? []
  const armorClass = sheet?.template.armorClass
  const totalWeight = inventoryItems.reduce((s, i) => s + (i.weight ?? 0), 0)
  const tabClass = (t: Tab) => `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted hover:text-foreground'}`

  return (<main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 animate-fade-in">
    <div className="mb-6"><Link href="/dashboard?tab=character-sheets" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>Back to Character Sheets</Link></div>

    <div className="space-y-6">
      {/* Header Card */}
      <div className="card !p-6 space-y-4">
        <div className="flex gap-4">
          <div className="shrink-0">
            {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-lg object-cover border border-border"/> : isOwner ? <label className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/30 transition-colors"><span className="text-2xl text-muted">+</span><input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)setAvatarUrl(URL.createObjectURL(f))}}/></label> : null}
          </div>
          <div className="flex-1 min-w-0">
            {isOwner ? (
              <InlineText value={sheet.characterName} onSave={saveCharacterName} maxLength={100} className="text-2xl font-bold text-gradient truncate block" />
            ) : (
              <h1 className="text-2xl font-bold text-gradient truncate">{sheet.characterName}</h1>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {isOwner ? (
                <>
                  <span className="badge badge-gold inline-flex items-center gap-1">Player: <InlineText value={sheet.playerName ?? ''} onSave={savePlayerName} maxLength={100} emptyDisplay="—" /></span>
                  <span className="badge badge-gold inline-flex items-center gap-1">Level: <InlineNumber value={sheet.level} onSave={saveLevel} min={1} /></span>
                </>
              ) : (
                <>
                  {sheet.playerName && <span className="badge badge-gold">Player: {sheet.playerName}</span>}
                  {sheet.level && <span className="badge badge-gold">Level: {sheet.level}</span>}
                </>
              )}
              {sheet.adventure && <span className="badge badge-gold">{sheet.adventure.campaign}</span>}
              <span className="badge badge-gold">{sheet.template.name}</span>
              <span className="text-xs text-muted">Created {new Date(sheet.createdAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span>
            </div>
          </div>
          {isOwner && (
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setConfirmDelete(true)} className="btn-danger">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>Delete
              </button>
            </div>
          )}
        </div>
        {sheet.adventure && <><hr className="divider"/><div><h3 className="text-sm font-medium text-muted mb-1">Adventure</h3><p className="text-foreground/80 text-sm">{sheet.adventure.name}</p></div></>}
      </div>

      {/* Tab Navigation */}
      <nav className="flex gap-1 flex-wrap">
        <button onClick={()=>setActiveTab('character')} className={tabClass('character')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>Character</button>
        <button onClick={()=>setActiveTab('abilities')} className={tabClass('abilities')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>Abilities</button>
        <button onClick={()=>setActiveTab('inventory')} className={tabClass('inventory')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>Inventory</button>
        <button onClick={()=>setActiveTab('story')} className={tabClass('story')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>Story</button>
      </nav>

      {/* Character Tab */}
      {activeTab === 'character' && <div className="space-y-6">
        {/* HP Card */}
        <div className="card !p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            Health Points
            {isOwner ? (
              <InlineText value={sheet.hpNotes ?? ''} onSave={saveHpNotes} placeholder="notes..." emptyDisplay="add notes" className="!text-xs !text-muted !font-normal" />
            ) : (
              sheet.hpNotes && <span className="text-xs text-muted font-normal">— {sheet.hpNotes}</span>
            )}
          </h3>
          <div className="flex items-center justify-between gap-3">
            <div className="text-center">
              <span className="text-muted text-xs block">Actual</span>
              {isOwner ? (
                <InlineNumber value={sheet.hpActual ?? 0} onSave={saveHpActual} min={0} className="text-xl font-bold text-foreground" />
              ) : (
                <span className="text-xl font-bold text-foreground">{sheet.hpActual ?? 0}</span>
              )}
            </div>
            <span className="text-muted text-lg">/</span>
            <div className="text-center">
              <span className="text-muted text-xs block">Max</span>
              {isOwner ? (
                <InlineNumber value={sheet.hpMax ?? 0} onSave={saveHpMax} min={0} className="text-xl font-bold text-foreground" />
              ) : (
                <span className="text-xl font-bold text-foreground">{sheet.hpMax ?? 0}</span>
              )}
            </div>
          </div>
          {isOwner && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <input type="number" min={0} className="input-field py-1 text-xs flex-1" value={hpModifier||''} placeholder="Amount" onChange={e=>setHpModifier(parseInt(e.target.value,10)||0)}/>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={()=>handleHpModify(1)} disabled={!hpModifier} className="btn-primary text-xs flex-1 py-1">+ Heal</button>
                <button type="button" onClick={()=>handleHpModify(-1)} disabled={!hpModifier} className="btn-danger text-xs flex-1 py-1">− Damage</button>
              </div>
            </div>
          )}
        </div>

        {/* Character Info */}
        {sheet.fieldValues.length > 0 && (
          <div className="card !p-6">
            <h3 className="font-semibold mb-3">Character Info</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {sheet.fieldValues.map(fv => (
                <div key={fv.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border">
                  <span className="text-sm text-muted">{fv.templateField.label}</span>
                  {isOwner ? (
                    <InlineText value={fv.value} onSave={(v) => saveFieldValue(fv.templateFieldId, v)} className="text-sm font-medium text-foreground" />
                  ) : (
                    <span className="text-sm font-medium text-foreground">{fv.value || '—'}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attributes */}
        <div className="card !p-6">
          <h3 className="font-semibold mb-4">Attributes</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {sheet.template.attributes.map(attr => {
              const val = sheet.values.find(v => v.attributeId === attr.id)
              const modResult = modifierResults[attr.id]
              return (
                <div key={attr.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border">
                  <span className="text-sm text-foreground">{attr.name}{attr.modifier && <span className="text-[0.6rem] text-primary ml-1">mod</span>}</span>
                  <div className="flex items-center gap-3">
                    {isOwner ? (
                      <InlineText value={val?.value ?? ''} onSave={(v) => saveAttributeValue(attr.id, v)} className="text-sm font-semibold text-foreground" />
                    ) : (
                      <span className="text-sm font-semibold text-foreground">{val?.value || '—'}</span>
                    )}
                    {modResult !== undefined && modResult !== null && (
                      <span className="text-sm font-semibold text-primary">({modResult >= 0 ? '+' : ''}{modResult})</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Armor Class */}
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
                      <input type="number" className="input-field py-1 text-xs w-16 text-right" value={val} onChange={e => handleAcFieldChange(field.id, e.target.value)} />
                    ) : (
                      <span className="text-sm font-semibold text-foreground">{val}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Runtime Modifiers */}
        {sheet.template.runtimeModifiers.length > 0 && (
          <div className="card !p-6">
            <h3 className="font-semibold mb-4">Runtime Modifiers</h3>
            <div className="grid gap-3 sm:grid-cols-1">
              {sheet.template.runtimeModifiers.map(modDef => {
                const compValues = sheet.runtimeModifierComponentValues.filter(rcv => rcv.component.modifier.id === modDef.id)
                const total = compValues.reduce((sum, rcv) => { const v = parseFloat(rcv.value); return sum + (isNaN(v) ? 0 : v) }, 0)
                return <CollapsibleRuntimeModifier key={modDef.id} modDef={modDef} compValues={compValues} total={total} isOwner={isOwner} onChange={handleComponentChange} />
              })}
            </div>
          </div>
        )}

        {/* Skills */}
        {sheet.skillValues.length > 0 && (
          <div className="card !p-6">
            <h3 className="font-semibold mb-4">Skills</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {sheet.skillValues.map(sv => (
                <CollapsibleSkillRow
                  key={sv.id}
                  skill={sv}
                  result={skillResults[sv.skillId]}
                  profiles={allProfiles}
                  selections={profileSelections[sv.skillId] || {}}
                  active={activeSkills[sv.skillId] ?? false}
                  others={othersValues[sv.skillId] ?? 0}
                  onToggleActive={() => handleSkillToggle(sv.skillId)}
                  onOthersChange={(no) => handleOthersChange(sv.skillId, no)}
                  onProfileChange={(pid, oid) => handleProfileChange(sv.skillId, pid, oid)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="text-center">
          <p className="text-xs text-muted">{isOwner ? 'You own this character sheet.' : 'This character sheet belongs to another player.'}</p>
        </div>
      </div>}

      {/* Abilities Tab */}
      {activeTab === 'abilities' && <div className="space-y-4">
        {abilities.length === 0 && !showNewAbility && <div className="text-center py-6 text-muted-foreground text-sm italic">No abilities yet. {isOwner && 'Create one below.'}</div>}
        <div className="space-y-3">
          {abilities.map(a => (
            <div key={a.id} className="card !p-4 space-y-2">
              <div className="flex items-start justify-between">
                {isOwner ? (
                  <InlineClickEdit
                    value={a.name}
                    onSave={async (v) => saveAbilityField(a.id, 'name', v)}
                    className="font-semibold text-foreground"
                    inputClassName="font-semibold text-foreground"
                  />
                ) : (
                  <h4 className="font-semibold text-foreground">{a.name}</h4>
                )}
                {isOwner && (
                  <button onClick={() => handleDeleteAbility(a.id)} className="text-xs text-danger hover:text-danger/80 px-2 py-1 transition-colors shrink-0 ml-2">Delete</button>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted">
                {isOwner ? (
                  <>
                    <span className="inline-flex items-center gap-1">Mana: <InlineClickEdit value={a.manaCost?.toString() ?? ''} onSave={async (v) => saveAbilityField(a.id, 'manaCost', v)} className="!text-xs !text-muted" inputClassName="!text-xs w-16" emptyDisplay="—" /></span>
                    <span className="inline-flex items-center gap-1">Cooldown: <InlineClickEdit value={a.cooldown ?? ''} onSave={async (v) => saveAbilityField(a.id, 'cooldown', v)} className="!text-xs !text-muted" inputClassName="!text-xs w-20" emptyDisplay="—" /></span>
                  </>
                ) : (
                  <>
                    {a.manaCost != null && <span>Mana: {a.manaCost}</span>}
                    {a.cooldown && <span>Cooldown: {a.cooldown}</span>}
                  </>
                )}
              </div>
              {isOwner ? (
                <div>
                  <h5 className="text-xs font-medium text-muted mb-1">Description</h5>
                  <InlineClickEdit
                    value={a.description ?? ''}
                    onSave={async (v) => saveAbilityField(a.id, 'description', v)}
                    as="textarea"
                    className="text-sm text-muted-foreground whitespace-pre-wrap"
                    emptyDisplay="Add description..."
                  />
                </div>
              ) : (
                a.description && (
                  <div>
                    <h5 className="text-xs font-medium text-muted mb-1">Description</h5>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.description}</p>
                  </div>
                )
              )}
              {isOwner ? (
                <div>
                  <h5 className="text-xs font-medium text-muted mb-1">Notes</h5>
                  <InlineClickEdit
                    value={a.notes ?? ''}
                    onSave={async (v) => saveAbilityField(a.id, 'notes', v)}
                    as="textarea"
                    className="text-xs text-muted italic whitespace-pre-wrap"
                    emptyDisplay="Add notes..."
                  />
                </div>
              ) : (
                a.notes && (
                  <div>
                    <h5 className="text-xs font-medium text-muted mb-1">Notes</h5>
                    <p className="text-xs text-muted italic whitespace-pre-wrap">{a.notes}</p>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
        {isOwner && !showNewAbility && <button onClick={() => setShowNewAbility(true)} className="btn-primary text-sm">+ New Ability</button>}
        {isOwner && showNewAbility && <form onSubmit={handleCreateAbility} className="card !p-4 space-y-3 border-primary/20">
          <h4 className="text-sm font-semibold text-primary">New Ability</h4>
          <div><label className="text-xs text-muted">Name</label><input className="input-field" value={newAbility.name} onChange={e => setNewAbility(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Fireball"/></div>
          <div><label className="text-xs text-muted">Description</label><textarea className="input-field resize-none" rows={2} value={newAbility.description} onChange={e => setNewAbility(p => ({ ...p, description: e.target.value }))} placeholder="Throws a fireball causing area damage."/></div>
          <div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-muted">Mana Cost</label><input type="number" className="input-field" value={newAbility.manaCost} onChange={e => setNewAbility(p => ({ ...p, manaCost: e.target.value }))} placeholder="20"/></div><div><label className="text-xs text-muted">Cooldown</label><input className="input-field" value={newAbility.cooldown} onChange={e => setNewAbility(p => ({ ...p, cooldown: e.target.value }))} placeholder="2 Turns"/></div></div>
          <div><label className="text-xs text-muted">Notes</label><textarea className="input-field resize-none" rows={2} value={newAbility.notes} onChange={e => setNewAbility(p => ({ ...p, notes: e.target.value }))}/></div>
          {abilityError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{abilityError}</div>}
          <div className="flex gap-2 justify-end"><button type="button" onClick={resetNewAbility} disabled={abilitySaving} className="btn-ghost text-sm">Cancel</button><button type="submit" disabled={abilitySaving || !newAbility.name.trim()} className="btn-primary text-sm">{abilitySaving ? 'Creating...' : 'Create'}</button></div>
        </form>}
      </div>}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && <div className="space-y-4">
        {inventoryItems.length > 0 && <div className="text-sm text-muted text-right">Total Weight: <span className="font-semibold text-foreground">{totalWeight.toFixed(1)} kg</span></div>}
        {inventoryItems.length === 0 && !showNewItem && <div className="text-center py-6 text-muted-foreground text-sm italic">No items in inventory. {isOwner && 'Add one below.'}</div>}
        <div className="space-y-3">
          {inventoryItems.map(item => (
            <div key={item.id} className="card !p-4 space-y-2">
              <div className="flex items-start justify-between">
                {isOwner ? (
                  <InlineClickEdit value={item.name} onSave={async (v) => saveItemField(item.id, 'name', v)} className="font-semibold text-foreground" />
                ) : (
                  <h4 className="font-semibold text-foreground">{item.name}</h4>
                )}
                {isOwner && (
                  <button onClick={() => handleDeleteItem(item.id)} className="text-xs text-danger hover:text-danger/80 px-2 py-1 transition-colors shrink-0 ml-2">Delete</button>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted">
                {isOwner ? (
                  <>
                    <span className="inline-flex items-center gap-1">Weight: <InlineClickEdit value={item.weight?.toString() ?? ''} onSave={async (v) => saveItemField(item.id, 'weight', v)} className="!text-xs !text-muted" inputClassName="!text-xs w-16" emptyDisplay="—" /> kg</span>
                    <span className="inline-flex items-center gap-1">Cost: <InlineClickEdit value={item.cost ?? ''} onSave={async (v) => saveItemField(item.id, 'cost', v)} className="!text-xs !text-muted" inputClassName="!text-xs w-20" emptyDisplay="—" /></span>
                  </>
                ) : (
                  <>
                    {item.weight != null && <span>Weight: {item.weight} kg</span>}
                    {item.cost && <span>Cost: {item.cost}</span>}
                  </>
                )}
              </div>
              {isOwner ? (
                <div>
                  <button type="button" onClick={() => setExpandedItems(p => ({ ...p, [item.id]: !p[item.id] }))} className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors">
                    <svg className={`w-3 h-3 transition-transform ${expandedItems[item.id] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                    Description
                  </button>
                  {expandedItems[item.id] && (
                    <div className="mt-1 pl-4">
                      <InlineClickEdit
                        value={item.description ?? ''}
                        onSave={async (v) => saveItemField(item.id, 'description', v)}
                        as="textarea"
                        className="text-sm text-muted-foreground whitespace-pre-wrap"
                        emptyDisplay="Add description..."
                      />
                    </div>
                  )}
                </div>
              ) : (
                item.description && (
                  <div>
                    <button type="button" onClick={() => setExpandedItems(p => ({ ...p, [item.id]: !p[item.id] }))} className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors">
                      <svg className={`w-3 h-3 transition-transform ${expandedItems[item.id] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                      Description
                    </button>
                    {expandedItems[item.id] && <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1 pl-4">{item.description}</p>}
                  </div>
                )
              )}
            </div>
          ))}
        </div>
        {isOwner && !showNewItem && <button onClick={() => setShowNewItem(true)} className="btn-primary text-sm">+ Add Item</button>}
        {isOwner && showNewItem && <form onSubmit={handleCreateItem} className="card !p-4 space-y-3 border-primary/20">
          <h4 className="text-sm font-semibold text-primary">New Item</h4>
          <div><label className="text-xs text-muted">Name</label><input className="input-field" value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Long Sword"/></div>
          <div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-muted">Weight (kg)</label><input type="number" step="any" className="input-field" value={newItem.weight} onChange={e => setNewItem(p => ({ ...p, weight: e.target.value }))} placeholder="3"/></div><div><label className="text-xs text-muted">Cost</label><input className="input-field" value={newItem.cost} onChange={e => setNewItem(p => ({ ...p, cost: e.target.value }))} placeholder="150 gp"/></div></div>
          <div><label className="text-xs text-muted">Description</label><textarea className="input-field resize-none" rows={2} value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} placeholder="Steel longsword forged by..."/></div>
          {itemError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{itemError}</div>}
          <div className="flex gap-2 justify-end"><button type="button" onClick={resetNewItem} disabled={itemSaving} className="btn-ghost text-sm">Cancel</button><button type="submit" disabled={itemSaving || !newItem.name.trim()} className="btn-primary text-sm">{itemSaving ? 'Creating...' : 'Create'}</button></div>
        </form>}
      </div>}

      {/* Story Tab */}
      {activeTab === 'story' && <div className="space-y-4">
        <div className="card !p-6 space-y-4">
          {isOwner ? (
            <>
              <InlineTextarea value={story?.appearance ?? ''} label="Appearance" onSave={(v) => saveStoryField('appearance', v)} rows={3} emptyDisplay="Add appearance description..." />
              <InlineTextarea value={story?.backstory ?? ''} label="Backstory" onSave={(v) => saveStoryField('backstory', v)} rows={5} emptyDisplay="Add backstory..." />
              <InlineTextarea value={story?.personality ?? ''} label="Personality" onSave={(v) => saveStoryField('personality', v)} rows={3} emptyDisplay="Add personality description..." />
              <InlineTextarea value={story?.goals ?? ''} label="Goals" onSave={(v) => saveStoryField('goals', v)} rows={3} emptyDisplay="Add character goals..." />
              <InlineTextarea value={story?.notes ?? ''} label="Notes" onSave={(v) => saveStoryField('notes', v)} rows={3} emptyDisplay="Add notes..." />
            </>
          ) : (
            <>
              <StoryField label="Appearance" value={story?.appearance} />
              <StoryField label="Backstory" value={story?.backstory} />
              <StoryField label="Personality" value={story?.personality} />
              <StoryField label="Goals" value={story?.goals} />
              <StoryField label="Notes" value={story?.notes} />
            </>
          )}
        </div>
      </div>}

      {confirmDelete && <DeleteModal name={sheet.characterName} error={deleteError} loading={deleting} onCancel={() => setConfirmDelete(false)} onConfirm={handleDelete} />}
    </div>
  </main>)
}

// ── Helper components ──

function StoryField({ label, value }: { label: string; value: string | null | undefined }) {
  const text = value?.trim()
  if (!text) return null
  return <div><h4 className="text-sm font-medium text-muted mb-1">{label}</h4><p className="text-sm text-foreground/80 whitespace-pre-wrap">{text}</p></div>
}

function CollapsibleRuntimeModifier({ modDef, compValues, total, isOwner, onChange }: { modDef: RuntimeModifierDef; compValues: RuntimeModifierComponentValue[]; total: number; isOwner: boolean; onChange: (componentId: string, value: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  return <div className="rounded-lg border border-border bg-background/30 overflow-hidden">
    <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-background/50 transition-colors">
      <div className="min-w-0"><span className="text-sm font-medium text-foreground">{modDef.name}</span>{modDef.description && <span className="text-xs text-muted ml-2">— {modDef.description}</span>}</div>
      <div className="flex items-center gap-2 shrink-0 ml-3"><span className="text-base font-bold text-primary">{total}</span><svg className={`w-4 h-4 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg></div>
    </button>
    {expanded && <div className="px-4 py-3 space-y-2 border-t border-border ml-4">
      {modDef.components.map(comp => {
        const rcv = compValues.find(v => v.componentId === comp.id)
        const val = rcv?.value ?? comp.defaultValue ?? '0'
        const isLocked = comp.locked || !!comp.formula
        const displayVal = comp.formula ? comp.formula : val
        return (
          <div key={comp.id} className="flex items-center gap-2">
            <span className="text-xs text-muted shrink-0 min-w-[100px]">{comp.name}</span>
            {isOwner && !isLocked ? (
              <input type="number" className="input-field py-1 text-xs w-20" value={val} onChange={e => onChange(comp.id, e.target.value)} />
            ) : (
              <span className="text-sm font-semibold text-foreground">{displayVal}</span>
            )}
            {comp.formula && <span className="text-[0.6rem] text-primary ml-1">formula</span>}
            {comp.locked && !comp.formula && <span className="text-[0.6rem] text-muted ml-1">locked</span>}
          </div>
        )
      })}
    </div>}
  </div>
}

function CollapsibleSkillRow({ skill, result, profiles, selections, active, others, onToggleActive, onOthersChange, onProfileChange }: { skill: SkillValue; result: number | null; profiles: SkillModifierProfile[]; selections: Record<string, string | null>; active: boolean; others: number; onToggleActive: () => void; onOthersChange: (v: number) => void; onProfileChange: (profileId: string, optionId: string | null) => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`rounded-lg border border-border bg-background/30 overflow-hidden transition-opacity ${active ? '' : 'opacity-40'}`}>
      <div className="flex items-center px-4 py-3">
        <input type="checkbox" checked={active} onChange={onToggleActive} className="shrink-0 w-4 h-4 rounded border-border accent-primary cursor-pointer mr-3" />
        <button type="button" onClick={() => setExpanded(!expanded)} disabled={!active} className="flex items-center justify-between flex-1 min-w-0 text-left hover:bg-background/50 transition-colors disabled:cursor-default disabled:hover:bg-transparent">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground truncate">{skill.skill.name}</span>
              {skill.skill.description && <span className="text-xs text-muted truncate hidden sm:inline">— {skill.skill.description}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <span className="text-base font-bold text-primary">{active ? (result != null ? result : '—') : '0'}</span>
            <svg className={`w-4 h-4 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </div>
        </button>
      </div>
      {expanded && active && (
        <div className="px-4 py-3 space-y-2 border-t border-border ml-10">
          {profiles.map(profile => {
            const sid = selections[profile.id]
            const so = sid ? profile.options.find(o => o.id === sid) : null
            return (
              <div key={profile.id} className="flex items-center gap-2">
                <span className="text-xs text-muted shrink-0 min-w-[80px]">{profile.name}:</span>
                <select className="input-field py-1 text-xs flex-1" value={sid ?? ''} onChange={e => { onProfileChange(profile.id, e.target.value || null) }}>
                  <option value="">— Select —</option>
                  {profile.options.map(opt => <option key={opt.id} value={opt.id}>{opt.label} ({opt.value >= 0 ? '+' : ''}{opt.value})</option>)}
                </select>
                {so && <span className="text-xs font-mono text-primary shrink-0">{so.value >= 0 ? '+' : ''}{so.value}</span>}
              </div>
            )
          })}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted shrink-0 min-w-[80px]">Others:</span>
            <input type="number" min={0} step={1} className="input-field py-1 text-xs w-20" value={others || ''} placeholder="0" onChange={e => onOthersChange(parseInt(e.target.value, 10) || 0)} />
            {others > 0 && <span className="text-xs font-mono text-primary">+{others}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── InlineClickEdit: click-to-edit for ability/item fields ──
function InlineClickEdit({
  value,
  onSave,
  as = 'input',
  className = '',
  inputClassName = '',
  emptyDisplay = '—',
  rows = 2,
}: {
  value: string
  onSave: (value: string) => Promise<void>
  as?: 'input' | 'textarea'
  className?: string
  inputClassName?: string
  emptyDisplay?: string
  rows?: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  useEffect(() => { setDraft(value) }, [value])

  const commit = useCallback(async () => {
    const trimmed = draft.trim()
    if (trimmed === value.trim()) { setEditing(false); return }
    setSaving(true)
    try { await onSave(trimmed); setEditing(false) }
    catch { setDraft(value) }
    finally { setSaving(false) }
  }, [draft, value, onSave])

  if (!editing) {
    const display = value?.trim()
    return (
      <button
        type="button"
        onClick={() => { setEditing(true); setTimeout(() => { if (inputRef.current) (inputRef.current as HTMLInputElement).focus() }, 0) }}
        className={`text-left hover:bg-foreground/5 rounded px-1 -mx-1 transition-colors cursor-pointer ${display ? '' : 'text-muted italic'} ${className}`}
      >
        {display || emptyDisplay}
      </button>
    )
  }

  if (as === 'textarea') {
    return (
      <div className="relative">
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          rows={rows}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
          className={`input-field resize-none text-sm w-full ${inputClassName}`}
          autoFocus
          disabled={saving}
        />
        {saving && <div className="absolute top-2 right-2 w-3 h-3 border border-primary/30 border-t-primary rounded-full animate-spin" />}
      </div>
    )
  }

  return (
    <div className="relative inline-block">
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        className={`input-field py-0.5 px-1 text-sm ${inputClassName}`}
        autoFocus
        disabled={saving}
      />
      {saving && <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 border border-primary/30 border-t-primary rounded-full animate-spin" />}
    </div>
  )
}

function DeleteModal({ name, error, loading, onCancel, onConfirm }: { name: string; error: string | null; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in"><div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center"><svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg></div><div><h2 className="font-semibold">Delete Character Sheet</h2><p className="text-sm text-muted-foreground">This action cannot be undone.</p></div></div><p className="text-sm text-muted-foreground">Are you sure you want to delete "{name}"?</p>{error && <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{error}</div>}<div className="flex gap-3 justify-end"><button onClick={onCancel} disabled={loading} className="btn-ghost">Cancel</button><button onClick={onConfirm} disabled={loading} className="btn-danger-solid">{loading ? 'Deleting...' : 'Delete forever'}</button></div></div></div>
}