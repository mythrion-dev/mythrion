'use client'

import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { api, API_URL, getAccessToken } from '@/lib/api'
import { InlineText, InlineNumber } from '@/lib/inline-editable'
import { StoryTab, CharacterTab, InventoryTab, PersonalAbilitiesTab, AbilitiesTab, ResistanceTab } from '@/components/character-sheet'
import { PageNav } from '@/lib/breadcrumb'
import type { SkillModifierProfile, ArmorClassAttributeModifierDef, SectionEntry, SummonSkillData, Ability, AbilityLevel, InventoryItem, Story, CharacterSheet, Tab, SummonTab, AcResultMap } from '@/components/character-sheet/types'


export default function CharacterSheetDetailPage() {
  const router = useRouter(); const params = useParams(); const id = params.id as string
  const { user } = useAuth()
  const [sheet, setSheet] = useState<CharacterSheet | null>(null); const [fetching, setFetching] = useState(true)
  const [modifierResults, setModifierResults] = useState<Record<string, number | null>>({})
  const [skillResults, setSkillResults] = useState<Record<string, number | null>>({})
  const [acResults, setAcResults] = useState<AcResultMap>({})
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarServerUrl = API_URL + `/images/character-sheets/${id}/avatar`
  const [confirmDelete, setConfirmDelete] = useState(false); const [deleting, setDeleting] = useState(false); const [deleteError, setDeleteError] = useState<string | null>(null)
  const [profileSelections, setProfileSelections] = useState<Record<string, Record<string, string | null>>>({})
  const profileSelectionsRef = useRef(profileSelections)
  profileSelectionsRef.current = profileSelections
  const [activeSkills, setActiveSkills] = useState<Record<string, boolean>>({})
  const [othersValues, setOthersValues] = useState<Record<string, number>>({})
  const othersValuesRef = useRef(othersValues)
  othersValuesRef.current = othersValues
  const [activeTab, setActiveTab] = useState<Tab>('character')
  const isOwner = sheet?.ownerId === user?.id || (sheet?.isNpc === true)

  const [abilities, setAbilities] = useState<Ability[]>([]); const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]); const [story, setStory] = useState<Story | null>(null)
  const [selectedLevels, setSelectedLevels] = useState<Record<string, string>>({})
  const [showNewAbility, setShowNewAbility] = useState(false); const [newAbilityType, setNewAbilityType] = useState<'ABILITY' | 'SUMMON' | null>(null)
  const [newAbility, setNewAbility] = useState({ name: '', description: '', manaCost: '', range: '', notes: '', damage: '', level: '', hpCurrent: '', hpMax: '' })
  const [abilitySaving, setAbilitySaving] = useState(false); const [abilityError, setAbilityError] = useState<string | null>(null)
  const [showAddLevelModal, setShowAddLevelModal] = useState<string | null>(null)
  const [newLevelForm, setNewLevelForm] = useState<{ level: number | string; copyFromPrevious: boolean }>({ level: 2, copyFromPrevious: true })
  const [levelModalSaving, setLevelModalSaving] = useState(false); const [levelModalError, setLevelModalError] = useState<string | null>(null)
  const [showNewItem, setShowNewItem] = useState(false); const [newItem, setNewItem] = useState({ name: '', weight: '', cost: '', description: '' })
  const [itemSaving, setItemSaving] = useState(false); const [itemError, setItemError] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
  const [expandedAbilities, setExpandedAbilities] = useState<Record<string, boolean>>({})
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null)

  // Section entry state
  const [sectionEntries, setSectionEntries] = useState<SectionEntry[]>([])
  const [expandedSectionEntries, setExpandedSectionEntries] = useState<Record<string, boolean>>({})
  const [showNewSectionEntry, setShowNewSectionEntry] = useState<string | null>(null)
  const [newSectionEntryForm, setNewSectionEntryForm] = useState({ name: '', description: '' })
  const [sectionEntrySaving, setSectionEntrySaving] = useState(false)

  // Search state
  const [abilitiesSearch, setAbilitiesSearch] = useState('')
  const [inventorySearch, setInventorySearch] = useState('')

  // Summon internal tab state
  const [summonTabs, setSummonTabs] = useState<Record<string, SummonTab>>({})

  // Summon AC results per ability
  const [summonAcResults, setSummonAcResults] = useState<Record<string, number | null>>({})
  // Summon modifier results per ability (computed from summon attributes)
  const [summonModifierResults, setSummonModifierResults] = useState<Record<string, Record<string, number | null>>>({})

  // Summon skill results
  const [summonSkillResults, setSummonSkillResults] = useState<Record<string, Record<string, number | null>>>({})
  // Summon skill profile selections per summon -> summonSkillId -> profile selection
  const [summonSkillProfileSelections, setSummonSkillProfileSelections] = useState<Record<string, Record<string, string | null>>>({})

  // Resistance state
  const [resistanceData, setResistanceData] = useState<Array<{ resistanceId: string; name: string; calculationType: string; total: number; componentValues: Array<{ componentId: string; componentName: string; value: number; editableByPlayer: boolean }>; attributeModifierValues: Array<{ attributeId: string; attributeKey: string; attributeName: string; enabled: boolean; rawModifier: number; effectiveModifier: number }> }>>([])
  const [sheetResistanceValues, setSheetResistanceValues] = useState<Record<string, string | null>>({})

  async function fetchResistances(sheetId: string) {
    try {
      const data = await api.get<Array<any>>(`/character-sheets/${sheetId}/resistances`)
      setResistanceData(data)
    } catch {}
  }

  async function handleSaveResistanceComponent(componentId: string, value: number) {
    if (!sheet) return
    try {
      await api.patch(`/character-sheets/${sheet.id}`, { resistanceComponentValues: [{ componentId, value: String(value) }] })
      const updated = await api.get<Array<any>>(`/character-sheets/${sheet.id}/resistances`)
      setResistanceData(updated)
    } catch {}
  }

  async function handleSaveResistanceManual(resistanceId: string, value: number) {
    if (!sheet) return
    setSheetResistanceValues(prev => ({ ...prev, [resistanceId]: String(value) }))
    try {
      await api.patch(`/character-sheets/${sheet.id}`, { resistanceValues: [{ resistanceId, manualValue: String(value) }] })
      const updated = await api.get<Array<any>>(`/character-sheets/${sheet.id}/resistances`)
      setResistanceData(updated)
    } catch {
      setSheetResistanceValues(prev => ({ ...prev, [resistanceId]: null }))
    }
  }

  async function handleCreateResistance(draft: { name: string; calculationType: 'MANUAL' | 'CALCULATED'; components?: { name: string; editableByPlayer?: boolean; defaultValue?: string }[]; attributeModifiers?: { attributeId: string; enabled?: boolean }[] }) {
    if (!sheet) return
    try {
      await api.post(`/character-sheets/${sheet.id}/resistances`, draft)
      await fetchResistances(sheet.id)
    } catch {}
  }

  async function handleDeleteResistance(resistanceId: string) {
    if (!sheet) return
    try {
      await api.delete(`/character-sheets/${sheet.id}/resistances/${resistanceId}`)
      setResistanceData(prev => prev.filter(r => r.resistanceId !== resistanceId))
    } catch {}
  }

  const updateSheet = useCallback(async (data: Record<string, unknown>): Promise<CharacterSheet> => {
    const current = sheet!
    const updated = await api.patch<CharacterSheet>(`/character-sheets/${current.id}`, data)
    setSheet(updated)
    return updated
  }, [sheet])

  const computeSummonModifiers = useCallback(async (ability: Ability, sd: CharacterSheet) => {
    const results: Record<string, number | null> = {}
    const globalFormula = sd.template.attributeModifierFormula
    if (!globalFormula?.trim() || !ability.summonAttributes?.length) return results
    for (const sa of ability.summonAttributes) {
      const attr = sd.template.attributes.find(a => a.id === sa.attributeId)
      if (!attr) continue
      try {
        const vars: Record<string, number> = {}
        ability.summonAttributes.forEach(a => {
          const ta = sd.template.attributes.find(x => x.id === a.attributeId)
          if (ta) { const v = parseFloat(a.value || '0'); vars[ta.key] = isNaN(v) ? 0 : v }
        })
        vars['value'] = parseFloat(sa.value || '0') || 0
        const res = await api.post<{ result: number }>('/formula/evaluate', { formula: globalFormula, variables: vars })
        results[attr.id] = res.result
      } catch { results[attr.id] = null }
    }
    return results
  }, [])

  const computeSummonAC = useCallback((ability: Ability, sd: CharacterSheet, mods: Record<string, number | null>) => {
    const acs = sd.template.armorClasses?.filter(ac => ac.enabled) ?? []
    if (acs.length === 0) return null
    let total = 0
    ;(ability.summonAcValues ?? []).forEach(acv => {
      const v = parseFloat(acv.value)
      if (!isNaN(v)) total += v
    })
    const selectedByAcModifierId = new Map((ability.summonAcAttributeValues ?? []).map(v => [v.acAttributeModifierId, v.selectedAttributeId]))
    for (const ac of acs) {
      const acMods = ac.attributeModifiers ?? []
      for (const am of acMods) {
        const effectiveAttributeId = am.allowPlayerSelection
          ? (selectedByAcModifierId.get(am.id) ?? am.defaultAttributeId ?? am.attributeId)
          : am.attributeId
        const modResult = mods[effectiveAttributeId]
        if (modResult !== null && modResult !== undefined && !isNaN(modResult)) {
          total += Math.max(0, modResult)
        }
      }
    }
    return total
  }, [])

  const computeSkillFormula = useCallback(async (
    sd: CharacterSheet,
    attributeValues: Record<string, string>,
    summonModifierResultsLocal: Record<string, number | null>,
    fieldValuesLocal: { key: string; value: string }[],
    skillFormulaRaw: string | undefined | null,
    level: number | null | undefined,
  ): Promise<Record<string, number>> => {
    const results: Record<string, number> = {}
    if (!skillFormulaRaw?.trim()) return results

    // Compute modifier vars
    const modifierVars: Record<string, number> = {}
    const globalFormula = sd.template.attributeModifierFormula
    if (globalFormula?.trim()) {
      for (const attr of sd.template.attributes) {
        try {
          const modVars: Record<string, number> = {}
          sd.template.attributes.forEach(a => {
            const v = parseFloat(attributeValues[a.id] ?? '0')
            modVars[a.key] = isNaN(v) ? 0 : v
          })
          modVars['value'] = parseFloat(attributeValues[attr.id] ?? '0') || 0
          const mr = await api.post<{ result: number }>('/formula/evaluate', { formula: globalFormula, variables: modVars })
          modifierVars[`${attr.key}_mod`] = mr.result
        } catch { modifierVars[`${attr.key}_mod`] = 0 }
      }
    } else {
      // Use provided summon modifier results directly
      for (const attr of sd.template.attributes) {
        modifierVars[`${attr.key}_mod`] = summonModifierResultsLocal[attr.id] ?? 0
      }
    }

    let skillConfig: { useAttributeModifier?: boolean; customFieldKeys?: string[] } | null = null
    try {
      const parsed = JSON.parse(skillFormulaRaw)
      if (parsed && typeof parsed === 'object' && typeof parsed.useAttributeModifier === 'boolean') {
        skillConfig = parsed
      }
    } catch { /* not JSON */ }

    const skillFormulaFn = async (variables: Record<string, number>) => {
      const res = await api.post<{ result: number }>('/formula/evaluate', { formula: skillFormulaRaw!, variables })
      return res.result
    }

    return { modifierVars, skillConfig: skillConfig as any, evaluateFn: skillFormulaFn } as any
  }, [])

  const computeSummonSkills = useCallback(async (ability: Ability, sd: CharacterSheet) => {
    const results: Record<string, number | null> = {}
    const globalFormula = sd.template.attributeModifierFormula
    const skillFormulaRaw = sd.template.skillFormula

    if (!skillFormulaRaw?.trim() || !ability.summonSkills?.length) {
      return results
    }

    // Compute modifier vars from summon attributes
    const modifierVars: Record<string, number> = {}
    if (globalFormula?.trim()) {
      for (const attr of sd.template.attributes) {
        try {
          const modVars: Record<string, number> = {}
          sd.template.attributes.forEach(a => {
            const sa = ability.summonAttributes.find(s => s.attributeId === a.id)
            const v = parseFloat(sa?.value ?? '0')
            modVars[a.key] = isNaN(v) ? 0 : v
          })
          modVars['value'] = parseFloat(ability.summonAttributes.find(s => s.attributeId === attr.id)?.value ?? '0') || 0
          const mr = await api.post<{ result: number }>('/formula/evaluate', { formula: globalFormula, variables: modVars })
          modifierVars[`${attr.key}_mod`] = mr.result
        } catch { modifierVars[`${attr.key}_mod`] = 0 }
      }
    }

    let skillConfig: { useAttributeModifier?: boolean; customFieldKeys?: string[] } | null = null
    try {
      const parsed = JSON.parse(skillFormulaRaw)
      if (parsed && typeof parsed === 'object' && typeof parsed.useAttributeModifier === 'boolean') {
        skillConfig = parsed
      }
    } catch { /* not JSON */ }

    for (const ss of ability.summonSkills) {
      try {
        let finalResult = 0
        if (skillConfig) {
          if (skillConfig.useAttributeModifier) {
            const selectedAttr = ss.selectedAttribute || ss.skill.defaultAttribute || ss.skill.attribute
            if (selectedAttr) finalResult += modifierVars[`${selectedAttr.key}_mod`] ?? 0
          }
          const customKeys = skillConfig.customFieldKeys || []
          for (const key of customKeys) {
            const fv = sd.fieldValues.find(f => f.templateField.key === key)
            if (fv) { const v = parseFloat(fv.value); if (!isNaN(v)) finalResult += v }
          }
        } else {
          const selectedAttr = ss.selectedAttribute || ss.skill.defaultAttribute || ss.skill.attribute
          const skillAttrValue = selectedAttr ? parseFloat(ability.summonAttributes.find(sa => sa.attributeId === selectedAttr.id)?.value ?? '0') : 0
          const variables: Record<string, number> = { ...modifierVars }
          variables['value'] = isNaN(skillAttrValue) ? 0 : skillAttrValue
          if (selectedAttr) variables['value_mod'] = modifierVars[`${selectedAttr.key}_mod`] ?? 0
          sd.template.attributes.forEach(a => {
            const sa = ability.summonAttributes.find(s => s.attributeId === a.id)
            const v = parseFloat(sa?.value ?? '0')
            variables[a.key] = isNaN(v) ? 0 : v
          })
          sd.fieldValues.forEach(fv => { const v = parseFloat(fv.value); variables[fv.templateField.key] = isNaN(v) ? 0 : v })
          variables['level'] = sd.level ?? 1
          const res = await api.post<{ result: number }>('/formula/evaluate', { formula: skillFormulaRaw, variables })
          finalResult = res.result
        }

        // Add profile values
        for (const spv of ss.profileValues ?? []) {
          if (spv.option) finalResult += spv.option.value
        }

        results[ss.id] = finalResult
      } catch { results[ss.id] = null }
    }
    return results
  }, [])

  const computeAC = useCallback((sd: CharacterSheet, mods: Record<string, number | null>) => {
    const acs = sd.template.armorClasses?.filter(ac => ac.enabled) ?? []
    if (acs.length === 0) { setAcResults({}); return }
    const selectedByModifierId = new Map(sd.acAttributeValues.map(v => [v.acAttributeModifierId, v.selectedAttributeId]))
    const results: AcResultMap = {}
    for (const ac of acs) {
      let total = 0
      const acFields = sd.acValues.filter(acv => ac.fields.some(f => f.id === acv.fieldId))
      acFields.forEach(acv => {
        const v = parseFloat(acv.value)
        if (!isNaN(v)) total += v
      })
      const acMods = ac.attributeModifiers ?? []
      for (const am of acMods) {
        const effectiveAttributeId = am.allowPlayerSelection
          ? (selectedByModifierId.get(am.id) ?? am.defaultAttributeId ?? am.attributeId)
          : am.attributeId
        const modResult = mods[effectiveAttributeId]
        if (modResult !== null && modResult !== undefined && !isNaN(modResult)) {
          total += Math.max(0, modResult)
        }
      }
      results[ac.id] = { total, name: (ac as any).name ?? 'Armor Class' }
    }
    setAcResults(results)
  }, [])

  const computeModifiers = useCallback(async (sd: CharacterSheet) => {
    const results: Record<string, number | null> = {}
    const modifiersEnabled = (sd.template as any).attributeModifiersEnabled !== false
    const globalFormula = sd.template.attributeModifierFormula
    if (!modifiersEnabled || !globalFormula?.trim()) { setModifierResults(results); return results }
    for (const attr of sd.template.attributes) {
      try {
        const vars: Record<string, number> = {}
        sd.template.attributes.forEach(a => { const v = parseFloat(sd.values.find(sv => sv.attributeId === a.id)?.value || '0'); vars[a.key] = isNaN(v) ? 0 : v })
        vars['value'] = parseFloat(sd.values.find(sv => sv.attributeId === attr.id)?.value || '0') || 0
        const res = await api.post<{ result: number }>('/formula/evaluate', { formula: globalFormula, variables: vars })
        results[attr.id] = res.result
      } catch { results[attr.id] = null }
    }
    setModifierResults(results)
    return results
  }, [])

  const computeSkills = useCallback(async (sd: CharacterSheet, selections?: Record<string, Record<string, string | null>>, othersOverrides?: Record<string, number>) => {
    const results: Record<string, number | null> = {}; const selMap = selections || profileSelectionsRef.current; const effOthers = othersOverrides ?? othersValuesRef.current
    const modifierVars: Record<string, number> = {}
    const globalFormula = sd.template.attributeModifierFormula
    if (globalFormula?.trim()) {
      for (const attr of sd.template.attributes) {
        try {
          const modVars: Record<string, number> = {}
          sd.template.attributes.forEach(a => { const v = parseFloat(sd.values.find(sv => sv.attributeId === a.id)?.value || '0'); modVars[a.key] = isNaN(v) ? 0 : v })
          modVars['value'] = parseFloat(sd.values.find(sv => sv.attributeId === attr.id)?.value || '0') || 0
          const mr = await api.post<{ result: number }>('/formula/evaluate', { formula: globalFormula, variables: modVars })
          modifierVars[`${attr.key}_mod`] = mr.result
        } catch { modifierVars[`${attr.key}_mod`] = 0 }
      }
    }
    const skillFormulaRaw = sd.template.skillFormula?.trim()
    if (!skillFormulaRaw) { setSkillResults({}); return }

    let skillConfig: { useAttributeModifier?: boolean; customFieldKeys?: string[] } | null = null
    try {
      const parsed = JSON.parse(skillFormulaRaw)
      if (parsed && typeof parsed === 'object' && typeof parsed.useAttributeModifier === 'boolean') {
        skillConfig = parsed
      }
    } catch { /* not JSON */ }

    for (const sv of sd.skillValues) {
      try {
        let finalResult = 0
        if (skillConfig) {
          if (skillConfig.useAttributeModifier) {
            const selectedAttr = sv.selectedAttribute || sv.skill.defaultAttribute || sv.skill.attribute
            if (selectedAttr) finalResult += modifierVars[`${selectedAttr.key}_mod`] ?? 0
          }
          const customKeys = skillConfig.customFieldKeys || []
          for (const key of customKeys) {
            const fv = sd.fieldValues.find(f => f.templateField.key === key)
            if (fv) { const v = parseFloat(fv.value); if (!isNaN(v)) finalResult += v }
          }
        } else {
          const selectedAttr = sv.selectedAttribute || sv.skill.defaultAttribute || sv.skill.attribute
          const skillAttrValue = selectedAttr ? parseFloat(sd.values.find(sv2 => sv2.attributeId === selectedAttr.id)?.value || '0') : 0
          const variables: Record<string, number> = { ...modifierVars }
          variables['value'] = isNaN(skillAttrValue) ? 0 : skillAttrValue
          if (selectedAttr) variables['value_mod'] = modifierVars[`${selectedAttr.key}_mod`] ?? 0
          sd.template.attributes.forEach(a => { const v = parseFloat(sd.values.find(sv2 => sv2.attributeId === a.id)?.value || '0'); variables[a.key] = isNaN(v) ? 0 : v })
          sd.fieldValues.forEach(fv => { const v = parseFloat(fv.value); variables[fv.templateField.key] = isNaN(v) ? 0 : v })
          variables['level'] = sd.level ?? 1
          const res = await api.post<{ result: number }>('/formula/evaluate', { formula: skillFormulaRaw, variables })
          finalResult = res.result
        }
        finalResult += (effOthers[sv.skillId] ?? 0)
        const skillSelections = selMap[sv.skillId] || {}
        for (const profile of sd.template.skillModifierProfiles) {
          const targetMode = (profile as any).targetMode ?? 'ALL_SKILLS'
          const targetSkillIds: string[] = (profile as any).targetSkillIds ?? []
          if (targetMode === 'SELECTED_SKILLS' && targetSkillIds.length > 0 && !targetSkillIds.includes(sv.skill.name)) continue
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
      setSectionEntries(d.sectionEntries || [])
      // All abilities start collapsed
      // Initialize summon tabs
      const st: Record<string, SummonTab> = {}
      d.abilities.forEach(a => { if (a.type === 'SUMMON') { st[a.id] = 'stats' } })
      setSummonTabs(st)

      const mods = await computeModifiers(d); computeSkills(d, selMap, others); computeAC(d, mods)
      // Fetch resistances on load
      fetchResistances(d.id)
      // Compute summon ACs, skills
      const summonAc: Record<string, number | null> = {}
      const summonMods: Record<string, Record<string, number | null>> = {}
      const summonSkills: Record<string, Record<string, number | null>> = {}
      for (const ability of d.abilities || []) {
        if (ability.type === 'SUMMON') {
          const sm = await computeSummonModifiers(ability, d)
          summonMods[ability.id] = sm
          summonAc[ability.id] = computeSummonAC(ability, d, sm)
          if (ability.summonSkills?.length) {
            summonSkills[ability.id] = await computeSummonSkills(ability, d)
          }
        }
      }
      setSummonModifierResults(summonMods); setSummonAcResults(summonAc)
      setSummonSkillResults(summonSkills)
      // Check if an avatar exists on the server (cache-bust to avoid stale 204s)
      try {
        const avatarRes = await fetch(avatarServerUrl + '?t=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
        if (avatarRes.ok && avatarRes.status !== 204) setAvatarUrl(avatarServerUrl + '?t=' + Date.now())
      } catch { /* no avatar */ }
    } catch (e: unknown) { if ((e as { statusCode?: number }).statusCode === 401 || (e as { statusCode?: number }).statusCode === 403) router.replace('/login') }
    finally { setFetching(false) }
  }, [id, router, computeModifiers, computeSkills, computeAC, computeSummonModifiers, computeSummonAC, computeSummonSkills])

  useEffect(() => { fetchSheet() }, [fetchSheet])

  async function saveCharacterName(name: string) {
    const updated = await updateSheet({ characterName: name })
    const mods = await computeModifiers(updated); computeSkills(updated, profileSelections); computeAC(updated, mods)
  }
  async function savePlayerName(name: string) { await updateSheet({ playerName: name || undefined }) }
  async function saveLevel(level: number) {
    const updated = await updateSheet({ level })
    const mods = await computeModifiers(updated); computeSkills(updated, profileSelections); computeAC(updated, mods)
  }
  async function saveAttributeValue(attributeId: string, value: string) {
    const updated = await updateSheet({ values: [{ attributeId, value }] })
    const mods = await computeModifiers(updated); computeSkills(updated, profileSelections); computeAC(updated, mods)
  }
  async function saveFieldValue(templateFieldId: string, value: string) {
    const updated = await updateSheet({ fieldValues: [{ templateFieldId, value }] })
    const mods = await computeModifiers(updated); computeSkills(updated, profileSelections); computeAC(updated, mods)
  }

  async function handleCoreResourceChange(coreResourceId: string, field: 'current' | 'maximum' | 'notes', value: string) {
    if (!sheet) return
    const numVal = value.trim() === '' ? null : (field === 'notes' ? value : parseInt(value, 10))
    const optimisticSheet = {
      ...sheet,
      coreResourceValues: sheet.coreResourceValues.map(v =>
        v.coreResourceId === coreResourceId ? { ...v, [field]: numVal } : v
      ),
    }
    setSheet(optimisticSheet)
    try {
      await updateSheet({ coreResourceValues: [{ coreResourceId, [field]: numVal }] })
    } catch {
      setSheet(sheet)
    }
  }

  async function handleCoreResourceModify(coreResourceId: string, delta: number) {
    if (!sheet) return
    const crv = sheet.coreResourceValues.find(v => v.coreResourceId === coreResourceId)
    if (!crv) return
    const newVal = Math.max(0, (crv.current ?? 0) + delta)
    const optimisticSheet = {
      ...sheet,
      coreResourceValues: sheet.coreResourceValues.map(v =>
        v.coreResourceId === coreResourceId ? { ...v, current: newVal } : v
      ),
    }
    setSheet(optimisticSheet)
    try {
      await updateSheet({ coreResourceValues: [{ coreResourceId, current: newVal }] })
    } catch {
      setSheet(sheet)
    }
  }

  async function handleAcFieldChange(fieldId: string, value: string) {
    if (!sheet) return
    const optimisticSheet = { ...sheet, acValues: sheet.acValues.map(acv => acv.fieldId === fieldId ? { ...acv, value } : acv) }
    setSheet(optimisticSheet)
    try { const updated = await updateSheet({ acValues: [{ fieldId, value }] }); computeAC(updated, modifierResults) } catch { setSheet(sheet) }
  }
  async function handleAcAttributeModifierChange(acAttributeModifierId: string, selectedAttributeId: string | null) {
    if (!sheet) return
    const selectedAttribute = selectedAttributeId
      ? (sheet.template.attributes.find(a => a.id === selectedAttributeId) ?? null)
      : null
    const existing = sheet.acAttributeValues.find(v => v.acAttributeModifierId === acAttributeModifierId)
    const optimisticSheet: CharacterSheet = {
      ...sheet,
      acAttributeValues: existing
        ? sheet.acAttributeValues.map(v => v.acAttributeModifierId === acAttributeModifierId ? { ...v, selectedAttributeId, selectedAttribute } : v)
        : [...sheet.acAttributeValues, {
          id: `temp-${acAttributeModifierId}`,
          sheetId: sheet.id,
          acAttributeModifierId,
          selectedAttributeId,
          acAttributeModifier: (sheet.template.armorClasses?.flatMap(ac => ac.attributeModifiers ?? []) ?? []).find(am => am.id === acAttributeModifierId) as ArmorClassAttributeModifierDef,
          selectedAttribute,
        }],
    }
    setSheet(optimisticSheet)
    computeAC(optimisticSheet, modifierResults)
    try {
      const updated = await updateSheet({ acAttributeValues: [{ acAttributeModifierId, selectedAttributeId }] })
      computeAC(updated, modifierResults)
    } catch {
      setSheet(sheet)
      computeAC(sheet, modifierResults)
    }
  }
  async function handleProfileChange(skillId: string, profileId: string, optionId: string | null) {
    if (!sheet) return
    setProfileSelections(p => { const n = { ...p }; if (!n[skillId]) n[skillId] = {}; n[skillId] = { ...n[skillId], [profileId]: optionId }; return n })
    try { await api.patch(`/character-sheets/${sheet.id}/skills/${skillId}/profiles/${profileId}`, { optionId }) } catch {
      const s = sheet.skillProfileValues.find(spv => spv.skillId === skillId && spv.profileId === profileId)
      setProfileSelections(p => { const n = { ...p }; if (!n[skillId]) n[skillId] = {}; n[skillId] = { ...n[skillId], [profileId]: s?.optionId ?? null }; return n })
      return
    }
    computeSkills(sheet, { ...profileSelections, [skillId]: { ...profileSelections[skillId], [profileId]: optionId } })
  }
  async function handleSkillAttributeChange(skillId: string, attributeId: string | null) {
    if (!sheet) return
    setSheet(prev => {
      if (!prev) return prev
      return { ...prev, skillValues: prev.skillValues.map(sv => sv.skillId === skillId ? { ...sv, selectedAttributeId: attributeId, selectedAttribute: attributeId ? { id: attributeId, key: prev.template.attributes.find(a => a.id === attributeId)?.key ?? '', name: prev.template.attributes.find(a => a.id === attributeId)?.name ?? '' } : null } : sv) }
    })
    try { await api.patch(`/character-sheets/${sheet.id}/skills/${skillId}/attribute`, { attributeId }) } catch { fetchSheet(); return }
    const updated = await api.get<CharacterSheet>(`/character-sheets/${sheet.id}`)
    setSheet(updated); computeSkills(updated, profileSelections)
  }
  async function handleSkillToggle(skillId: string) {
    const nv = !activeSkills[skillId]; setActiveSkills(p => ({ ...p, [skillId]: nv }))
    try { await api.patch(`/character-sheets/${sheet!.id}`, { skillValues: [{ skillId, value: `${nv ? '1' : '0'}|${othersValues[skillId] ?? 0}` }] }) } catch { setActiveSkills(p => ({ ...p, [skillId]: !nv })) }
  }
  async function handleOthersChange(skillId: string, no: number) {
    const ov = Math.max(0, Math.floor(no)); setOthersValues(p => ({ ...p, [skillId]: ov }))
    if (sheet) computeSkills(sheet, profileSelections, { ...othersValues, [skillId]: ov })
    try { await api.patch(`/character-sheets/${sheet!.id}`, { skillValues: [{ skillId, value: `${activeSkills[skillId] ?? false ? '1' : '0'}|${ov}` }] }) } catch { setOthersValues(p => ({ ...p, [skillId]: othersValues[skillId] ?? 0 })) }
  }

  // ── Ability Level field save (for ABILITY type) ──
  async function saveLevelField(levelId: string, field: string, value: string) {
    if (!sheet) return
    const body: Record<string, unknown> = {}
    if (field === 'description') body.description = value.trim() || null
    else if (field === 'manaCost') body.manaCost = value.trim() ? parseInt(value, 10) : null
    else if (field === 'range') body.range = value.trim() || null
    else if (field === 'notes') body.notes = value.trim() || null
    else if (field === 'damage') body.damage = value.trim() || null
    try { await api.patch(`/character-sheets/${sheet.id}/abilities/x/levels/${levelId}`, body); setAbilities(prev => prev.map(a => ({ ...a, levels: a.levels.map(l => l.id === levelId ? { ...l, ...body } : l) }))) } catch {}
  }
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

  // ── Summon field saves ──
  async function saveSummonAttribute(abilityId: string, attributeId: string, value: string) {
    if (!sheet) return
    try {
      await api.patch(`/character-sheets/${sheet.id}/abilities/${abilityId}/summon-attributes/${attributeId}`, { value })
      setAbilities(prev => prev.map(a => a.id === abilityId ? { ...a, summonAttributes: a.summonAttributes.map(sa => sa.attributeId === attributeId ? { ...sa, value } : sa) } : a))
      // Recompute summon modifiers & skills
      const updatedAbilities = abilities.map(a => a.id === abilityId ? { ...a, summonAttributes: a.summonAttributes.map(sa => sa.attributeId === attributeId ? { ...sa, value } : sa) } : a)
      const ability = updatedAbilities.find(a => a.id === abilityId)
      if (ability) {
        const sm = await computeSummonModifiers(ability, sheet)
        setSummonModifierResults(prev => ({ ...prev, [abilityId]: sm }))
        setSummonAcResults(prev => ({ ...prev, [abilityId]: computeSummonAC({ ...ability, summonAttributes: ability.summonAttributes.map(sa => sa.attributeId === attributeId ? { ...sa, value } : sa) }, sheet, sm) }))
        if (ability.summonSkills?.length) {
          const ss = await computeSummonSkills({ ...ability, summonAttributes: ability.summonAttributes.map(sa => sa.attributeId === attributeId ? { ...sa, value } : sa) }, sheet)
          setSummonSkillResults(prev => ({ ...prev, [abilityId]: ss }))
        }
      }
    } catch {}
  }

  async function saveSummonAcValue(abilityId: string, fieldId: string, value: string) {
    if (!sheet) return
    try {
      await api.patch(`/character-sheets/${sheet.id}/abilities/${abilityId}/summon-ac/${fieldId}`, { value })
      setAbilities(prev => prev.map(a => a.id === abilityId ? { ...a, summonAcValues: a.summonAcValues.map(acv => acv.fieldId === fieldId ? { ...acv, value } : acv) } : a))
      const ability = abilities.find(a => a.id === abilityId)
      if (ability) {
        const mods = summonModifierResults[abilityId] || {}
        const updatedAcValues = ability.summonAcValues.map(acv => acv.fieldId === fieldId ? { ...acv, value } : acv)
        setSummonAcResults(prev => ({ ...prev, [abilityId]: computeSummonAC({ ...ability, summonAcValues: updatedAcValues }, sheet, mods) }))
      }
    } catch {}
  }

  async function saveSummonAcAttributeValue(abilityId: string, acAttributeModifierId: string, selectedAttributeId: string | null) {
    if (!sheet) return
    try {
      await api.patch(`/character-sheets/${sheet.id}/abilities/${abilityId}/summon-ac-attribute-modifier/${acAttributeModifierId}`, { selectedAttributeId })
      const selectedAttribute = selectedAttributeId ? sheet.template.attributes.find(a => a.id === selectedAttributeId) ?? null : null
      setAbilities(prev => prev.map(a =>
        a.id === abilityId
          ? {
              ...a,
              summonAcAttributeValues: [
                ...(a.summonAcAttributeValues ?? []).filter(v => v.acAttributeModifierId !== acAttributeModifierId),
                { id: `temp-${acAttributeModifierId}`, abilityId, acAttributeModifierId, selectedAttributeId, selectedAttribute: selectedAttribute as { id: string; key: string; name: string } | null },
              ],
            }
          : a,
      ))
      const ability = abilities.find(a => a.id === abilityId)
      if (ability) {
        const mods = summonModifierResults[abilityId] || {}
        setSummonAcResults(prev => ({ ...prev, [abilityId]: computeSummonAC({
          ...ability,
          summonAcAttributeValues: [
            ...(ability.summonAcAttributeValues ?? []).filter(v => v.acAttributeModifierId !== acAttributeModifierId),
            { id: `temp-${acAttributeModifierId}`, abilityId, acAttributeModifierId, selectedAttributeId, selectedAttribute: selectedAttribute as { id: string; key: string; name: string } | null },
          ],
        }, sheet, mods) }))
      }
    } catch {}
  }

  async function saveSummonHealth(abilityId: string, field: 'current' | 'maximum', value: number | null) {
    if (!sheet) return
    const body: Record<string, unknown> = {}
    if (field === 'current') body.current = value
    else body.maximum = value
    try {
      await api.patch(`/character-sheets/${sheet.id}/abilities/${abilityId}/summon-health`, body)
      setAbilities(prev => prev.map(a => a.id === abilityId ? { ...a, summonHealth: { ...(a.summonHealth ?? { id: '', abilityId, current: null, maximum: null, notes: null }), [field]: value } } : a))
    } catch {}
  }

  // ── Summon Skill operations ──
  async function handleAddSummonSkill(abilityId: string, skillId: string) {
    if (!sheet) return
    try {
      const ss = await api.post<SummonSkillData>(`/character-sheets/${sheet.id}/abilities/${abilityId}/summon-skills`, { skillId })
      setAbilities(prev => prev.map(a => a.id === abilityId ? { ...a, summonSkills: [...(a.summonSkills ?? []), ss] } : a))
      // Recompute summon skills
      const ability = abilities.find(a => a.id === abilityId)
      if (ability) {
        const updated = { ...ability, summonSkills: [...(ability.summonSkills ?? []), ss] }
        const sk = await computeSummonSkills(updated, sheet)
        setSummonSkillResults(prev => ({ ...prev, [abilityId]: sk }))
      }
    } catch {}
  }

  async function handleRemoveSummonSkill(abilityId: string, summonSkillId: string) {
    if (!sheet) return
    try {
      await api.delete(`/character-sheets/${sheet.id}/abilities/${abilityId}/summon-skills/${summonSkillId}`)
      setAbilities(prev => prev.map(a => a.id === abilityId ? { ...a, summonSkills: (a.summonSkills ?? []).filter(s => s.id !== summonSkillId) } : a))
      const ability = abilities.find(a => a.id === abilityId)
      if (ability) {
        const updated = { ...ability, summonSkills: (ability.summonSkills ?? []).filter(s => s.id !== summonSkillId) }
        const sk = await computeSummonSkills(updated, sheet)
        setSummonSkillResults(prev => ({ ...prev, [abilityId]: sk }))
      }
    } catch {}
  }

  async function handleSummonSkillAttributeChange(abilityId: string, summonSkillId: string, attributeId: string | null) {
    if (!sheet) return
    try {
      const updatedSs = await api.patch<SummonSkillData>(`/character-sheets/${sheet.id}/abilities/${abilityId}/summon-skills/${summonSkillId}/attribute`, { attributeId })
      setAbilities(prev => prev.map(a => a.id === abilityId ? {
        ...a, summonSkills: (a.summonSkills ?? []).map(s => s.id === summonSkillId ? { ...s, selectedAttributeId: attributeId, selectedAttribute: updatedSs.selectedAttribute } : s)
      } : a))
      const ability = abilities.find(a => a.id === abilityId)
      if (ability) {
        const updated = {
          ...ability, summonSkills: (ability.summonSkills ?? []).map(s => s.id === summonSkillId ? { ...s, selectedAttributeId: attributeId, selectedAttribute: updatedSs.selectedAttribute } : s)
        }
        const sk = await computeSummonSkills(updated, sheet)
        setSummonSkillResults(prev => ({ ...prev, [abilityId]: sk }))
      }
    } catch {}
  }

  async function handleSummonSkillProfileChange(abilityId: string, summonSkillId: string, profileId: string, optionId: string | null) {
    if (!sheet) return
    // Optimistic update
    setAbilities(prev => prev.map(a => {
      if (a.id !== abilityId) return a
      return {
        ...a,
        summonSkills: (a.summonSkills ?? []).map(s => {
          if (s.id !== summonSkillId) return s
          const existing = s.profileValues ?? []
          const newPv = existing.map(pv => pv.profileId === profileId ? { ...pv, optionId, option: optionId ? (pv.option?.id === optionId ? pv.option : pv.option) : null } : pv)
          return { ...s, profileValues: newPv }
        })
      }
    }))
    try {
      await api.patch(`/character-sheets/${sheet.id}/abilities/${abilityId}/summon-skills/${summonSkillId}/profiles/${profileId}`, { optionId })
      const ability = abilities.find(a => a.id === abilityId)
      if (ability) {
        const updated = {
          ...ability,
          summonSkills: (ability.summonSkills ?? []).map(s => {
            if (s.id !== summonSkillId) return s
            return { ...s, profileValues: (s.profileValues ?? []).map(pv => pv.profileId === profileId ? { ...pv, optionId, option: optionId ? (pv.option?.id === optionId ? pv.option : pv.option) : null } : pv) }
          })
        }
        const sk = await computeSummonSkills(updated, sheet)
        setSummonSkillResults(prev => ({ ...prev, [abilityId]: sk }))
      }
    } catch { fetchSheet() }
  }

  // ── Summon-scoped ability CRUD ──
  async function handleCreateSummonAbility(summonId: string, e: FormEvent) {
    e.preventDefault()
    if (!sheet || !newAbility.name.trim()) return
    setAbilitySaving(true)
    try {
      const body: Record<string, unknown> = { name: newAbility.name.trim(), description: newAbility.description.trim() || undefined, notes: newAbility.notes.trim() || undefined }
      if (newAbility.manaCost) body.manaCost = parseInt(newAbility.manaCost, 10)
      if (newAbility.range) body.range = newAbility.range.trim()
      if (newAbility.damage) body.damage = newAbility.damage.trim()
      const a = await api.post<Ability>(`/character-sheets/${sheet.id}/abilities/${summonId}/summon-abilities`, body)
      setAbilities(prev => prev.map(ab => ab.id === summonId ? { ...ab, childAbilities: [...(ab.childAbilities ?? []), a] } : ab))
      resetNewAbility()
    } catch (err) { setAbilityError(err instanceof Error ? err.message : 'Failed to create') }
    finally { setAbilitySaving(false) }
  }

  async function handleDeleteAbility(abilityId: string) { if (!sheet) return; try { await api.delete(`/character-sheets/${sheet.id}/abilities/${abilityId}`); setAbilities(p => p.filter(a => a.id !== abilityId).map(a => ({ ...a, childAbilities: (a.childAbilities ?? []).filter(c => c.id !== abilityId) }))) } catch {} }

  function resetNewAbility() { setShowNewAbility(false); setNewAbility({ name: '', description: '', manaCost: '', range: '', notes: '', damage: '', level: '', hpCurrent: '', hpMax: '' }); setNewAbilityType(null); setAbilityError(null) }
  async function handleCreateAbility(e: FormEvent) { e.preventDefault(); if (!newAbility.name.trim() || !sheet) return; setAbilitySaving(true)
    try {
      const body: Record<string, unknown> = { name: newAbility.name.trim(), type: newAbilityType ?? 'ABILITY', description: newAbility.description.trim() || undefined, notes: newAbility.notes.trim() || undefined }
      if (newAbilityType === 'ABILITY') {
        body.manaCost = newAbility.manaCost.trim() ? parseInt(newAbility.manaCost, 10) : undefined
        body.range = newAbility.range.trim() || undefined
        body.damage = newAbility.damage.trim() || undefined
      }
      if (newAbilityType === 'SUMMON') {
        body.summonHealthCurrent = newAbility.hpCurrent.trim() ? parseInt(newAbility.hpCurrent, 10) : undefined
        body.summonHealthMax = newAbility.hpMax.trim() ? parseInt(newAbility.hpMax, 10) : undefined
      }
      const a = await api.post<Ability>(`/character-sheets/${sheet.id}/abilities`, body)
      // Create/update initial level if user specified one
      if (newAbility.level.trim()) {
        if (a.levels?.length) {
          await api.patch(`/character-sheets/${sheet.id}/abilities/${a.id}/levels/${a.levels[0].id}`, { level: newAbility.level.trim() })
          a.levels[0].level = newAbility.level.trim()
        } else {
          const nl = await api.post<AbilityLevel>(`/character-sheets/${sheet.id}/abilities/${a.id}/levels`, { level: newAbility.level.trim(), copyFromPrevious: false })
          a.levels = [nl]
        }
      }
      setAbilities(p => [...p, a])
      // Compute summon data if summon
      if (a.type === 'SUMMON') {
        const sm = await computeSummonModifiers(a, sheet)
        setSummonModifierResults(prev => ({ ...prev, [a.id]: sm }))
        setSummonAcResults(prev => ({ ...prev, [a.id]: computeSummonAC(a, sheet, sm) }))
        computeSummonSkills(a, sheet).then(sk => setSummonSkillResults(prev => ({ ...prev, [a.id]: sk })))
        setSummonTabs(prev => ({ ...prev, [a.id]: 'stats' }))
      }
      setExpandedAbilities(prev => ({ ...prev, [a.id]: true }))
      resetNewAbility()
    } catch (err) { setAbilityError(err instanceof Error ? err.message : 'Failed to create entry') } finally { setAbilitySaving(false) } }
  function resetNewItem() { setShowNewItem(false); setNewItem({ name: '', weight: '', cost: '', description: '' }); setItemError(null) }
  async function handleCreateItem(e: FormEvent) { e.preventDefault(); if (!newItem.name.trim() || !sheet) return; setItemSaving(true)
    try { const i = await api.post<InventoryItem>(`/character-sheets/${sheet.id}/inventory`, { name: newItem.name.trim(), weight: newItem.weight.trim() ? parseFloat(newItem.weight) : undefined, cost: newItem.cost.trim() || undefined, description: newItem.description.trim() || undefined }); setInventoryItems(p => [...p, i]); resetNewItem() } catch (err) { setItemError(err instanceof Error ? err.message : 'Failed to create item') } finally { setItemSaving(false) } }
  async function handleDeleteItem(iid: string) { if (!sheet) return; try { await api.delete(`/character-sheets/${sheet.id}/inventory/${iid}`); setInventoryItems(p => p.filter(i => i.id !== iid)) } catch {} }
  async function saveStoryField(field: string, value: string) { if (!sheet) return; try { const s = await api.patch<Story>(`/character-sheets/${sheet.id}/story`, { [field]: value.trim() || null }); setStory(s) } catch {} }

  // ── Section entry handlers ──
  function toSingular(name: string) { if (name.endsWith('ies')) return name.slice(0, -3) + 'y'; if (name.endsWith('s') && !name.endsWith('ss') && !name.endsWith('us')) return name.slice(0, -1); return name }

  function resetSectionEntryForm() { setNewSectionEntryForm({ name: '', description: '' }); setShowNewSectionEntry(null); setSectionEntrySaving(false) }
  async function handleCreateSectionEntry(sectionId: string, e: FormEvent) {
    e.preventDefault()
    if (!sheet || !newSectionEntryForm.name.trim()) return
    setSectionEntrySaving(true)
    try {
      const entry = await api.post<SectionEntry>(`/character-sheets/${sheet.id}/section-entries`, { sectionId, name: newSectionEntryForm.name.trim(), description: newSectionEntryForm.description.trim() })
      setSectionEntries(p => [...p, entry])
      resetSectionEntryForm()
    } catch {} finally { setSectionEntrySaving(false) }
  }
  async function handleUpdateSectionEntry(entryId: string, field: string, value: string) {
    if (!sheet) return
    try {
      const body: Record<string, unknown> = {}
      if (field === 'name') body.name = value.trim()
      else if (field === 'description') body.description = value.trim()
      const updated = await api.patch<SectionEntry>(`/character-sheets/${sheet.id}/section-entries/${entryId}`, body)
      setSectionEntries(p => p.map(e => e.id === entryId ? updated : e))
    } catch {}
  }
  async function handleDeleteSectionEntry(entryId: string) {
    if (!sheet) return
    try { await api.delete(`/character-sheets/${sheet.id}/section-entries/${entryId}`); setSectionEntries(p => p.filter(e => e.id !== entryId)) } catch {}
  }

  async function handleDelete() { setDeleting(true); try { await api.delete(`/character-sheets/${id}`); router.push('/dashboard?tab=character-sheets') } catch (err) { setDeleteError(err instanceof Error ? err.message : 'Failed to delete'); setDeleting(false); setConfirmDelete(false) } }

  async function handleAvatarUpload(file: File) {
    if (!file || !sheet) return
    setAvatarUploading(true)
    try {
      const token = getAccessToken()
      const formData = new FormData()
      formData.append('avatar', file)
      const res = await fetch(avatarServerUrl, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (res.ok) {
        // Bust cache by appending a timestamp
        setAvatarUrl(avatarServerUrl + '?t=' + Date.now())
      }
    } catch { /* upload failed */ }
    finally { setAvatarUploading(false) }
  }

  async function handleAvatarDelete() {
    if (!sheet) return
    try {
      const token = getAccessToken()
      await fetch(avatarServerUrl, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {},
      })
      setAvatarUrl(null)
    } catch { /* delete failed */ }
  }

  if (fetching) return <div className="flex items-center justify-center py-20"><div className="flex flex-col items-center gap-3 text-muted-foreground"><div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"/><span className="text-sm">Loading...</span></div></div>
  if (!sheet) return <div className="flex items-center justify-center py-20"><div className="text-sm text-muted-foreground">Character sheet not found.</div></div>

  const allProfiles: SkillModifierProfile[] = sheet?.template.skillModifierProfiles ?? []
  const armorClasses = sheet?.template.armorClasses?.filter(ac => ac.enabled) ?? []
  const modifiersEnabled = sheet.template.attributeModifiersEnabled !== false
  const totalWeight = inventoryItems.reduce((s, i) => s + (i.weight ?? 0), 0)
  const tabClass = (t: Tab) => `flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === t ? 'border-[#c9a84c] text-white' : 'border-transparent text-gray-400 hover:text-white'}`
  const enabledCoreResources = (sheet.template.coreResources || []).filter(cr => cr.enabled)

  return (<div className="w-full">
    <PageNav crumbs={[
      { label: 'Dashboard', href: '/dashboard' },
      ...(sheet.adventure ? [{ label: sheet.adventure.name, href: `/dashboard/adventures/${sheet.adventure.id}` }] : []),
      { label: sheet.characterName },
    ]} />

    <div className="space-y-6">
      <div className="card !p-6">
        <div className="flex gap-6 items-start" style={{ minHeight: '170px' }}>
          {/* Avatar - 160x160 */}
          <div className="shrink-0">
            {avatarUrl ? (
              <div className="relative group">
                <img src={avatarUrl} alt="Avatar" className="w-40 h-40 rounded-xl object-cover border border-border" />
                {isOwner && (
                  <button
                    type="button"
                    onClick={handleAvatarDelete}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove avatar"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
            ) : isOwner ? (
              <label className={`w-40 h-40 rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/30 transition-colors ${avatarUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {avatarUploading ? (
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                ) : (
                  <span className="text-2xl text-muted">+</span>
                )}
                <input type="file" accept="image/*" className="hidden" disabled={avatarUploading} onChange={e=>{const f=e.target.files?.[0];if(f)handleAvatarUpload(f)}}/>
              </label>
            ) : null}
          </div>

          {/* Info - center column */}
          <div className="flex-1 min-w-0 flex flex-col justify-between" style={{ minHeight: '170px' }}>
            <div>
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
              </div>
              <p className="text-xs text-muted mt-1.5">
                Created {new Date(sheet.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            {sheet.adventure && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-xs text-muted uppercase tracking-wider">Adventure:</span>
                <span className="font-medium">{sheet.adventure.name}</span>
              </div>
            )}
          </div>

          {/* Actions - delete button vertically centered */}
          {isOwner && (
            <div className="flex flex-col gap-3 justify-center shrink-0" style={{ minHeight: '170px' }}>
              <button onClick={() => setConfirmDelete(true)} className="btn-danger text-sm px-6 py-2.5">
                <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <nav className="flex gap-1 flex-wrap border-b border-border/60">
        <button onClick={()=>setActiveTab('character')} className={tabClass('character')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>Character</button>
        <button onClick={()=>setActiveTab('abilities')} className={tabClass('abilities')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/><path strokeLinecap="round" strokeLinejoin="round" d="M8 2l.5 1.5L10 4l-1.5.5L8 6l-.5-1.5L6 4l1.5-.5L8 2z"/><path strokeLinecap="round" strokeLinejoin="round" d="M16 1l.3 1.2L18 3l-1.7.8L16 5l-.3-1.2L14 3l1.7-.8L16 1z"/></svg>Abilities</button>
        <button onClick={()=>setActiveTab('inventory')} className={tabClass('inventory')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>Inventory</button>
        <button onClick={()=>setActiveTab('story')} className={tabClass('story')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>Story</button>
        <button onClick={()=>setActiveTab('personal-abilities')} className={tabClass('personal-abilities')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>Personal Abilities</button>
        <button onClick={()=>setActiveTab('resistances')} className={tabClass('resistances')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3C7 3 4 6 4 9v1c0 2 1.5 3.5 3 4l1 3h8l1-3c1.5-.5 3-2 3-4V9c0-3-3-6-8-6z"/><path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 3V1"/></svg>Resistances</button>
      </nav>

      {activeTab === 'character' && <CharacterTab
        sheet={sheet}
        isOwner={isOwner}
        enabledCoreResources={enabledCoreResources}
        handleCoreResourceChange={handleCoreResourceChange}
        handleCoreResourceModify={handleCoreResourceModify}
        saveFieldValue={saveFieldValue}
        modifierResults={modifierResults}
        saveAttributeValue={saveAttributeValue}
        modifiersEnabled={modifiersEnabled}
        armorClasses={armorClasses}
        acResults={acResults}
        handleAcFieldChange={handleAcFieldChange}
        handleAcAttributeModifierChange={handleAcAttributeModifierChange}
        allProfiles={allProfiles}
        profileSelections={profileSelections}
        activeSkills={activeSkills}
        othersValues={othersValues}
        handleSkillToggle={handleSkillToggle}
        handleOthersChange={handleOthersChange}
        handleProfileChange={handleProfileChange}
        handleSkillAttributeChange={handleSkillAttributeChange}
        expandedSkillId={expandedSkillId}
        setExpandedSkillId={setExpandedSkillId}
        skillResults={skillResults}
        sheetId={sheet.id}
      />}

      {activeTab === 'abilities' && <AbilitiesTab
        abilities={abilities} isOwner={isOwner} sheetId={sheet.id} template={sheet.template}
        selectedLevels={selectedLevels} setAbilities={setAbilities} setSelectedLevels={setSelectedLevels}
        searchQuery={abilitiesSearch} setSearchQuery={setAbilitiesSearch}
        showNewAbility={showNewAbility} setShowNewAbility={setShowNewAbility}
        newAbilityType={newAbilityType} setNewAbilityType={setNewAbilityType}
        newAbility={newAbility} setNewAbility={setNewAbility}
        abilitySaving={abilitySaving} abilityError={abilityError}
        handleCreateAbility={handleCreateAbility} resetNewAbility={resetNewAbility}
        handleDeleteAbility={handleDeleteAbility}
        showAddLevelModal={showAddLevelModal} setShowAddLevelModal={setShowAddLevelModal}
        newLevelForm={newLevelForm} setNewLevelForm={setNewLevelForm}
        levelModalSaving={levelModalSaving} setLevelModalSaving={setLevelModalSaving}
        levelModalError={levelModalError} setLevelModalError={setLevelModalError}
        expandedAbilities={expandedAbilities} setExpandedAbilities={setExpandedAbilities}
        summonModifierResults={summonModifierResults} summonAcResults={summonAcResults}
        saveSummonAttribute={saveSummonAttribute} saveSummonAcValue={saveSummonAcValue}
        saveSummonAcAttributeValue={saveSummonAcAttributeValue}
        saveSummonHealth={saveSummonHealth}
        summonTabs={summonTabs} setSummonTabs={setSummonTabs}
        summonSkillResults={summonSkillResults}
        handleAddSummonSkill={handleAddSummonSkill}
        handleRemoveSummonSkill={handleRemoveSummonSkill}
        handleSummonSkillAttributeChange={handleSummonSkillAttributeChange}
        handleSummonSkillProfileChange={handleSummonSkillProfileChange}
        handleCreateSummonAbility={handleCreateSummonAbility}
      />}
      {activeTab === 'inventory' && <InventoryTab
        inventoryItems={inventoryItems}
        isOwner={isOwner}
        searchQuery={inventorySearch}
        setSearchQuery={setInventorySearch}
        totalWeight={totalWeight}
        saveItemField={saveItemField}
        handleDeleteItem={handleDeleteItem}
        showNewItem={showNewItem}
        setShowNewItem={setShowNewItem}
        newItem={newItem}
        setNewItem={setNewItem}
        itemSaving={itemSaving}
        itemError={itemError}
        handleCreateItem={handleCreateItem}
        resetNewItem={resetNewItem}
        expandedItems={expandedItems}
        setExpandedItems={setExpandedItems}
      />}
      {activeTab === 'story' && <StoryTab story={story} isOwner={isOwner} onSaveField={saveStoryField} />}

      {activeTab === 'personal-abilities' && <PersonalAbilitiesTab
        sections={sheet.template.characterSections || []}
        entries={sectionEntries}
        isOwner={isOwner}
        toSingular={toSingular}
        expandedEntries={expandedSectionEntries}
        setExpandedEntries={setExpandedSectionEntries}
        handleUpdateEntry={handleUpdateSectionEntry}
        handleDeleteEntry={handleDeleteSectionEntry}
        showNewEntry={showNewSectionEntry}
        setShowNewEntry={setShowNewSectionEntry}
        newEntryForm={newSectionEntryForm}
        setNewEntryForm={setNewSectionEntryForm}
        handleCreateEntry={handleCreateSectionEntry}
        saving={sectionEntrySaving}
        resetForm={resetSectionEntryForm}
      />}

      {activeTab === 'resistances' && (
        <ResistanceTab
          resistances={resistanceData}
          isOwner={!!isOwner}
          onSaveComponent={handleSaveResistanceComponent}
          onSaveManual={handleSaveResistanceManual}
          sheetResistanceValues={sheetResistanceValues}
          templateAttributes={sheet.template.attributes}
          disableAttributeModifiers={!modifiersEnabled}
          onCreateResistance={handleCreateResistance}
          onDeleteResistance={handleDeleteResistance}
        />
      )}

      {confirmDelete && <DeleteModal name={sheet.characterName} error={deleteError} loading={deleting} onCancel={() => setConfirmDelete(false)} onConfirm={handleDelete} />}
    </div>
  </div>)
}




function DeleteModal({ name, error, loading, onCancel, onConfirm }: { name: string; error: string | null; loading: boolean; onCancel: () => void; onConfirm: () => void }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in"><div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center"><svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg></div><div><h2 className="font-semibold">Delete Character Sheet</h2><p className="text-sm text-muted-foreground">This action cannot be undone.</p></div></div><p className="text-sm text-muted-foreground">Are you sure you want to delete "{name}"?</p>{error && <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{error}</div>}<div className="flex gap-3 justify-end"><button onClick={onCancel} disabled={loading} className="btn-ghost">Cancel</button><button onClick={onConfirm} disabled={loading} className="btn-danger-solid">{loading ? 'Deleting...' : 'Delete forever'}</button></div></div></div> }
