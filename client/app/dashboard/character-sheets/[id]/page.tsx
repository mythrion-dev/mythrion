'use client'

import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import { InlineText, InlineNumber, InlineTextarea } from '@/lib/inline-editable'
import Link from 'next/link'
import { PageNav } from '@/lib/breadcrumb'

interface SheetAttribute { id: string; attributeId: string; value: string; attribute: { id: string; key: string; name: string } }
interface FieldValue { id: string; templateFieldId: string; value: string; templateField: { id: string; key: string; label: string } }
interface SkillValue { id: string; skillId: string; value: string; selectedAttributeId: string | null; selectedAttribute: { id: string; key: string; name: string } | null; skill: { id: string; name: string; description: string | null; attributeId: string | null; allowedAttributeIds: string[]; defaultAttributeId: string | null; attribute: { id: string; key: string; name: string } | null; defaultAttribute: { id: string; key: string; name: string } | null } }
interface ProfileOption { id: string; label: string; value: number }
interface SkillModifierProfile { id: string; name: string; options: ProfileOption[]; targetMode?: string; targetSkillIds?: string[] }
interface SkillProfileValue { id: string; skillId: string; profileId: string; optionId: string | null; profile: { id: string; name: string }; option: { id: string; label: string; value: number } | null }

interface CoreResourceDef {
  id: string; slug: string; displayName: string
  enabled: boolean
  editableByPlayer: boolean
  showNotes: boolean
}
interface CoreResourceValue {
  id: string; coreResourceId: string; current: number | null; maximum: number | null; notes: string | null
  coreResource: CoreResourceDef
}

interface ArmorClassFieldDef {
  id: string; name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string | null
  armorClass: { id: string; attributeModifierIds: string[] }
}
interface ArmorClassDef {
  id: string; enabled: boolean; attributeModifierIds: string[]; fields: ArmorClassFieldDef[]
}
interface ArmorClassValue {
  id: string; fieldId: string; value: string; field: ArmorClassFieldDef
}

interface AbilityLevel { id: string; abilityId: string; level: number; manaCost: number | null; range: string | null; description: string | null; notes: string | null; damage: string | null }
interface SummonAttribute { id: string; abilityId: string; attributeId: string; value: string }
interface SummonAcValue { id: string; abilityId: string; fieldId: string; value: string }
interface SummonHealth { id: string; abilityId: string; current: number | null; maximum: number | null; notes: string | null }

interface SummonSkillData {
  id: string; abilityId: string; skillId: string; selectedAttributeId: string | null
  selectedAttribute: { id: string; key: string; name: string } | null
  skill: { id: string; name: string; description: string | null; attributeId: string | null; allowedAttributeIds: string[]; defaultAttributeId: string | null; attribute: { id: string; key: string; name: string } | null; defaultAttribute: { id: string; key: string; name: string } | null }
  profileValues: SummonSkillProfileValueData[]
}
interface SummonSkillProfileValueData { id: string; summonSkillId: string; profileId: string; optionId: string | null; profile: { id: string; name: string; targetMode?: string; targetSkillIds?: string[] }; option: { id: string; label: string; value: number } | null }

interface Ability {
  id: string; name: string; type: string; description: string | null; notes: string | null; order: number
  summonId?: string | null
  levels: AbilityLevel[]
  summonAttributes: SummonAttribute[]
  summonAcValues: SummonAcValue[]
  summonHealth: SummonHealth | null
  summonSkills?: SummonSkillData[]
  childAbilities?: Ability[]
}
interface InventoryItem { id: string; name: string; weight: number | null; cost: string | null; description: string | null; order: number }
interface Story { id: string; appearance: string | null; backstory: string | null; personality: string | null; goals: string | null; notes: string | null }

interface TemplateSkill { id: string; name: string; description: string | null; attributeId: string | null; allowedAttributeIds: string[]; defaultAttributeId: string | null; attribute: { id: string; key: string; name: string } | null; defaultAttribute: { id: string; key: string; name: string } | null }

interface CharacterSheet {
  id: string; characterName: string; playerName: string | null; level: number | null
  hpActual: number | null; hpMax: number | null; hpNotes: string | null
  adventure: { id: string; name: string; campaign: string } | null
  template: {
    id: string; name: string
    attributeModifierFormula?: string | null
    skillFormula?: string | null
    attributes: { id: string; key: string; name: string }[]
    templateSkills?: TemplateSkill[]
    skillModifierProfiles: SkillModifierProfile[]
    coreResources: CoreResourceDef[]
    armorClass: ArmorClassDef | null
  }
  values: SheetAttribute[]; fieldValues: FieldValue[]; skillValues: SkillValue[]
  skillProfileValues: SkillProfileValue[]
  coreResourceValues: CoreResourceValue[]
  acValues: ArmorClassValue[]
  abilities: Ability[]; inventoryItems: InventoryItem[]; story: Story | null
  ownerId: string; createdAt: string
}

type Tab = 'character' | 'abilities' | 'inventory' | 'story'
type SummonTab = 'stats' | 'skills' | 'abilities'

function CoreResourceCard({ resource, value, isOwner, onSave, onModify }: {
  resource: CoreResourceDef
  value: CoreResourceValue
  isOwner: boolean
  onSave: (coreResourceId: string, field: 'current' | 'maximum' | 'notes', val: string) => Promise<void>
  onModify?: (coreResourceId: string, delta: number) => void
}) {
  const [modifier, setModifier] = useState(0)
  const canEdit = isOwner && resource.editableByPlayer

  return (
    <div className="card !p-4 space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        {resource.displayName}
        {resource.showNotes && (
          isOwner
            ? <InlineText value={value.notes ?? ''} onSave={(v) => onSave(value.coreResourceId, 'notes', v)} placeholder="notes..." emptyDisplay="add notes" className="!text-xs !text-muted !font-normal" />
            : value.notes && <span className="text-xs text-muted font-normal">— {value.notes}</span>
        )}
      </h3>
      <div className="flex items-center justify-between gap-3">
        <div className="text-center">
          <span className="text-muted text-xs block">Current</span>
          {canEdit
            ? <InlineNumber value={value.current ?? 0} onSave={(v) => onSave(value.coreResourceId, 'current', String(v))} min={0} className="text-xl font-bold text-foreground" />
            : <span className="text-xl font-bold text-foreground">{value.current ?? '—'}</span>
          }
        </div>
        <span className="text-muted text-lg">/</span>
        <div className="text-center">
          <span className="text-muted text-xs block">Max</span>
          {canEdit
            ? <InlineNumber value={value.maximum ?? 0} onSave={(v) => onSave(value.coreResourceId, 'maximum', String(v))} min={0} className="text-xl font-bold text-foreground" />
            : <span className="text-xl font-bold text-foreground">{value.maximum ?? '—'}</span>
          }
        </div>
      </div>
      {canEdit && onModify && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <input type="number" min={0} className="input-field py-1 text-xs flex-1" value={modifier || ''} placeholder="Amount" onChange={e => setModifier(parseInt(e.target.value, 10) || 0)} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { onModify(value.coreResourceId, Math.abs(modifier)); setModifier(0) }} disabled={!modifier} className="btn-primary text-xs flex-1 py-1">+ Heal / Recover</button>
            <button type="button" onClick={() => { onModify(value.coreResourceId, -Math.abs(modifier)); setModifier(0) }} disabled={!modifier} className="btn-danger text-xs flex-1 py-1">− Damage / Lose</button>
          </div>
        </div>
      )}
    </div>
  )
}

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
  const [activeTab, setActiveTab] = useState<Tab>('character')
  const isOwner = sheet?.ownerId === user?.id

  const [abilities, setAbilities] = useState<Ability[]>([]); const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]); const [story, setStory] = useState<Story | null>(null)
  const [selectedLevels, setSelectedLevels] = useState<Record<string, string>>({})
  const [showNewAbility, setShowNewAbility] = useState(false); const [newAbilityType, setNewAbilityType] = useState<'ABILITY' | 'SUMMON' | null>(null)
  const [newAbility, setNewAbility] = useState({ name: '', description: '', manaCost: '', range: '', notes: '', damage: '' })
  const [abilitySaving, setAbilitySaving] = useState(false); const [abilityError, setAbilityError] = useState<string | null>(null)
  const [showAddLevelModal, setShowAddLevelModal] = useState<string | null>(null)
  const [newLevelForm, setNewLevelForm] = useState({ level: 2, copyFromPrevious: true })
  const [levelModalSaving, setLevelModalSaving] = useState(false); const [levelModalError, setLevelModalError] = useState<string | null>(null)
  const [showNewItem, setShowNewItem] = useState(false); const [newItem, setNewItem] = useState({ name: '', weight: '', cost: '', description: '' })
  const [itemSaving, setItemSaving] = useState(false); const [itemError, setItemError] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
  const [expandedAbilities, setExpandedAbilities] = useState<Record<string, boolean>>({})

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
    const ac = sd.template.armorClass
    if (!ac?.enabled) return null
    let total = 0
    ;(ability.summonAcValues ?? []).forEach(acv => {
      const v = parseFloat(acv.value)
      if (!isNaN(v)) total += v
    })
    const attrModKeys = ac.attributeModifierIds ?? []
    for (const attrKey of attrModKeys) {
      const attr = sd.template.attributes.find(a => a.key === attrKey)
      if (!attr) continue
      const modResult = mods[attr.id]
      if (modResult !== null && modResult !== undefined && !isNaN(modResult)) {
        total += Math.max(0, modResult)
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
    const ac = sd.template.armorClass
    if (!ac?.enabled) { setAcResult(null); return }
    let total = 0
    sd.acValues.forEach(acv => {
      const v = parseFloat(acv.value)
      if (!isNaN(v)) total += v
    })
    const attrModKeys = ac.attributeModifierIds ?? []
    for (const attrKey of attrModKeys) {
      const attr = sd.template.attributes.find(a => a.key === attrKey)
      if (!attr) continue
      const modResult = mods[attr.id]
      if (modResult !== null && modResult !== undefined && !isNaN(modResult)) {
        total += Math.max(0, modResult)
      }
    }
    setAcResult(total)
  }, [])

  const computeModifiers = useCallback(async (sd: CharacterSheet) => {
    const results: Record<string, number | null> = {}
    const globalFormula = sd.template.attributeModifierFormula
    if (!globalFormula?.trim()) { setModifierResults(results); return results }
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
      // Expand first ability by default
      if (d.abilities && d.abilities.length > 0) {
        setExpandedAbilities({ [d.abilities[0].id]: true })
      }
      // Initialize summon tabs
      const st: Record<string, SummonTab> = {}
      d.abilities.forEach(a => { if (a.type === 'SUMMON') { st[a.id] = 'stats' } })
      setSummonTabs(st)

      const mods = await computeModifiers(d); computeSkills(d, selMap, others); computeAC(d, mods)
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
    } catch (e: unknown) { if ((e as { statusCode?: number }).statusCode === 401 || (e as { statusCode?: number }).statusCode === 403) router.replace('/login') }
    finally { setFetching(false) }
  }, [id, router, computeModifiers, computeSkills, computeAC, computeSummonModifiers, computeSummonAC, computeSummonSkills])

  useEffect(() => { if (!authLoading && !user) { router.replace('/login'); return }; if (user) fetchSheet() }, [authLoading, user, fetchSheet])

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

  function resetNewAbility() { setShowNewAbility(false); setNewAbility({ name: '', description: '', manaCost: '', range: '', notes: '', damage: '' }); setNewAbilityType(null); setAbilityError(null) }
  async function handleCreateAbility(e: FormEvent) { e.preventDefault(); if (!newAbility.name.trim() || !sheet) return; setAbilitySaving(true)
    try {
      const body: Record<string, unknown> = { name: newAbility.name.trim(), type: newAbilityType ?? 'ABILITY', description: newAbility.description.trim() || undefined, notes: newAbility.notes.trim() || undefined }
      if (newAbilityType === 'ABILITY') {
        body.manaCost = newAbility.manaCost.trim() ? parseInt(newAbility.manaCost, 10) : undefined
        body.range = newAbility.range.trim() || undefined
        body.damage = newAbility.damage.trim() || undefined
      }
      const a = await api.post<Ability>(`/character-sheets/${sheet.id}/abilities`, body)
      setAbilities(p => [...p, a])
      // Compute summon data if summon
      if (a.type === 'SUMMON') {
        const sm = await computeSummonModifiers(a, sheet)
        setSummonModifierResults(prev => ({ ...prev, [a.id]: sm }))
        setSummonAcResults(prev => ({ ...prev, [a.id]: computeSummonAC(a, sheet, sm) }))
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

  async function handleDelete() { setDeleting(true); try { await api.delete(`/character-sheets/${id}`); router.push('/dashboard?tab=character-sheets') } catch (err) { setDeleteError(err instanceof Error ? err.message : 'Failed to delete'); setDeleting(false); setConfirmDelete(false) } }

  if (authLoading || fetching) return <main className="flex-1 flex items-center justify-center p-4"><div className="flex flex-col items-center gap-3 text-muted-foreground"><div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"/><span className="text-sm">Loading...</span></div></main>
  if (!sheet) return <main className="flex-1 flex items-center justify-center p-4"><div className="text-sm text-muted-foreground">Character sheet not found.</div></main>

  const allProfiles: SkillModifierProfile[] = sheet?.template.skillModifierProfiles ?? []
  const armorClass = sheet?.template.armorClass
  const totalWeight = inventoryItems.reduce((s, i) => s + (i.weight ?? 0), 0)
  const tabClass = (t: Tab) => `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted hover:text-foreground'}`
  const enabledCoreResources = (sheet.template.coreResources || []).filter(cr => cr.enabled)

  return (<main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 animate-fade-in">
    <PageNav crumbs={[
      { label: 'Dashboard', href: '/dashboard' },
      ...(sheet.adventure ? [{ label: sheet.adventure.name, href: `/dashboard/adventures/${sheet.adventure.id}` }] : []),
      { label: sheet.characterName },
    ]} />

    <div className="space-y-6">
      <div className="card !p-6 space-y-4">
        <div className="flex gap-4">
          <div className="shrink-0">
            {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-lg object-cover border border-border"/> : isOwner ? <label className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/30 transition-colors"><span className="text-2xl text-muted">+</span><input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)setAvatarUrl(URL.createObjectURL(f))}}/></label> : null}
          </div>
          <div className="flex-1 min-w-0">
            {isOwner ? <InlineText value={sheet.characterName} onSave={saveCharacterName} maxLength={100} className="text-2xl font-bold text-gradient truncate block" /> : <h1 className="text-2xl font-bold text-gradient truncate">{sheet.characterName}</h1>}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {isOwner ? (<><span className="badge badge-gold inline-flex items-center gap-1">Player: <InlineText value={sheet.playerName ?? ''} onSave={savePlayerName} maxLength={100} emptyDisplay="—" /></span><span className="badge badge-gold inline-flex items-center gap-1">Level: <InlineNumber value={sheet.level} onSave={saveLevel} min={1} /></span></>) : (<>{sheet.playerName && <span className="badge badge-gold">Player: {sheet.playerName}</span>}{sheet.level && <span className="badge badge-gold">Level: {sheet.level}</span>}</>)}
              {sheet.adventure && <span className="badge badge-gold">{sheet.adventure.campaign}</span>}
              <span className="badge badge-gold">{sheet.template.name}</span>
              <span className="text-xs text-muted">Created {new Date(sheet.createdAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span>
            </div>
          </div>
          {isOwner && <div className="flex gap-2 shrink-0"><button onClick={() => setConfirmDelete(true)} className="btn-danger"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>Delete</button></div>}
        </div>
        {sheet.adventure && <><hr className="divider"/><div><h3 className="text-sm font-medium text-muted mb-1">Adventure</h3><p className="text-foreground/80 text-sm">{sheet.adventure.name}</p></div></>}
      </div>

      <nav className="flex gap-1 flex-wrap">
        <button onClick={()=>setActiveTab('character')} className={tabClass('character')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>Character</button>
        <button onClick={()=>setActiveTab('abilities')} className={tabClass('abilities')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>Abilities</button>
        <button onClick={()=>setActiveTab('inventory')} className={tabClass('inventory')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>Inventory</button>
        <button onClick={()=>setActiveTab('story')} className={tabClass('story')}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>Story</button>
      </nav>

      {activeTab === 'character' && <div className="space-y-6">
        {enabledCoreResources.map(cr => {
          const crv = sheet.coreResourceValues.find(v => v.coreResourceId === cr.id)
          if (!crv) return null
          return (
            <CoreResourceCard
              key={cr.id}
              resource={cr}
              value={crv}
              isOwner={!!isOwner}
              onSave={handleCoreResourceChange}
              onModify={isOwner && cr.editableByPlayer ? handleCoreResourceModify : undefined}
            />
          )
        })}

        {sheet.fieldValues.length > 0 && <div className="card !p-6"><h3 className="font-semibold mb-3">Character Info</h3><div className="grid gap-2 sm:grid-cols-2">{sheet.fieldValues.map(fv => <div key={fv.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border"><span className="text-sm text-muted">{fv.templateField.label}</span>{isOwner ? <InlineText value={fv.value} onSave={(v) => saveFieldValue(fv.templateFieldId, v)} className="text-sm font-medium text-foreground" /> : <span className="text-sm font-medium text-foreground">{fv.value || '—'}</span>}</div>)}</div></div>}

        <div className="card !p-6"><h3 className="font-semibold mb-4">Attributes</h3><div className="grid gap-3 sm:grid-cols-2">{sheet.template.attributes.map(attr => { const val = sheet.values.find(v => v.attributeId === attr.id); const modResult = modifierResults[attr.id]; return <div key={attr.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border"><span className="text-sm text-foreground">{attr.name}{sheet.template.attributeModifierFormula && <span className="text-[0.6rem] text-primary ml-1">mod</span>}</span><div className="flex items-center gap-3">{isOwner ? <InlineText value={val?.value ?? ''} onSave={(v) => saveAttributeValue(attr.id, v)} className="text-sm font-semibold text-foreground" /> : <span className="text-sm font-semibold text-foreground">{val?.value || '—'}</span>}{modResult !== undefined && modResult !== null && <span className="text-sm font-semibold text-primary">({modResult >= 0 ? '+' : ''}{modResult})</span>}</div></div> })}</div></div>

        {armorClass?.enabled && armorClass.fields.length > 0 && <div className="card !p-6"><h3 className="font-semibold mb-4">Armor Class</h3><div className="flex items-center justify-center mb-4"><div className="w-24 h-24 rounded-full border-4 border-primary/30 flex items-center justify-center bg-background/50"><span className="text-4xl font-bold text-primary">{acResult !== null ? acResult : '—'}</span></div></div><div className="space-y-3"><div><h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Components</h4><div className="grid gap-2 sm:grid-cols-2">{armorClass.fields.map(field => { const acv = sheet.acValues.find(v => v.fieldId === field.id); const val = acv?.value ?? field.defaultValue; const canEdit = isOwner && field.editableByPlayer; return <div key={field.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border"><div className="flex items-center gap-1 min-w-0"><span className="text-sm text-foreground truncate">{field.name}</span>{field.description && <span className="text-[0.6rem] text-muted hidden sm:inline">— {field.description}</span>}</div>{canEdit ? <input type="number" className="input-field py-1 text-xs w-16 text-right" value={val} onChange={e => handleAcFieldChange(field.id, e.target.value)} /> : <span className="text-sm font-semibold text-foreground">{val}</span>}</div> })}</div></div>{armorClass.attributeModifierIds.length > 0 && <div><h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Attribute Modifiers</h4><div className="grid gap-2 sm:grid-cols-2">{armorClass.attributeModifierIds.map(attrKey => { const attr = sheet.template.attributes.find(a => a.key === attrKey); if (!attr) return null; const modResult = modifierResults[attr.id]; return <div key={attrKey} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border opacity-80"><span className="text-sm text-foreground truncate">{attr.name} Modifier</span><span className="text-sm font-semibold text-muted" style={{opacity: 0.6}}>{modResult !== null && modResult !== undefined ? `${modResult >= 0 ? '+' : ''}${modResult}` : '—'}</span></div> })}</div></div>}</div></div>}

        {sheet.skillValues.length > 0 && <div className="card !p-6"><h3 className="font-semibold mb-4">Skills</h3><div className="grid gap-3 sm:grid-cols-2">{sheet.skillValues.map(sv => <CollapsibleSkillRow key={sv.id} skill={sv} result={skillResults[sv.skillId]} profiles={allProfiles.filter(p => { const tm = (p as any).targetMode ?? 'ALL_SKILLS'; const tids: string[] = (p as any).targetSkillIds ?? []; return tm === 'ALL_SKILLS' || tids.length === 0 || tids.includes(sv.skill.name) })} selections={profileSelections[sv.skillId] || {}} active={activeSkills[sv.skillId] ?? false} others={othersValues[sv.skillId] ?? 0} onToggleActive={() => handleSkillToggle(sv.skillId)} onOthersChange={(no) => handleOthersChange(sv.skillId, no)} onProfileChange={(pid, oid) => handleProfileChange(sv.skillId, pid, oid)} onAttributeChange={(attrId) => handleSkillAttributeChange(sv.skillId, attrId)} templateAttributes={sheet.template.attributes} />)}</div></div>}
        <div className="text-center"><p className="text-xs text-muted">{isOwner ? 'You own this character sheet.' : 'This character sheet belongs to another player.'}</p></div>
      </div>}

      {activeTab === 'abilities' && <AbilitiesTab
        abilities={abilities} isOwner={isOwner} sheetId={sheet.id} template={sheet.template}
        selectedLevels={selectedLevels} setAbilities={setAbilities} setSelectedLevels={setSelectedLevels}
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
        saveSummonHealth={saveSummonHealth}
        summonTabs={summonTabs} setSummonTabs={setSummonTabs}
        summonSkillResults={summonSkillResults}
        handleAddSummonSkill={handleAddSummonSkill}
        handleRemoveSummonSkill={handleRemoveSummonSkill}
        handleSummonSkillAttributeChange={handleSummonSkillAttributeChange}
        handleSummonSkillProfileChange={handleSummonSkillProfileChange}
        handleCreateSummonAbility={handleCreateSummonAbility}
      />}
      {activeTab === 'inventory' && <div className="space-y-4">{inventoryItems.length > 0 && <div className="text-sm text-muted text-right">Total Weight: <span className="font-semibold text-foreground">{totalWeight.toFixed(1)} kg</span></div>}{inventoryItems.length === 0 && !showNewItem && <div className="text-center py-6 text-muted-foreground text-sm italic">No items in inventory. {isOwner && 'Add one below.'}</div>}<div className="space-y-3">{inventoryItems.map(item => <div key={item.id} className="card !p-4 space-y-2"><div className="flex items-start justify-between">{isOwner ? <InlineClickEdit value={item.name} onSave={async (v) => saveItemField(item.id, 'name', v)} className="font-semibold text-foreground" /> : <h4 className="font-semibold text-foreground">{item.name}</h4>}{isOwner && <button onClick={() => handleDeleteItem(item.id)} className="text-xs text-danger hover:text-danger/80 px-2 py-1 transition-colors shrink-0 ml-2">Delete</button>}</div><div className="flex flex-wrap gap-3 text-xs text-muted">{isOwner ? <><span className="inline-flex items-center gap-1">Weight: <InlineClickEdit value={item.weight?.toString() ?? ''} onSave={async (v) => saveItemField(item.id, 'weight', v)} className="!text-xs !text-muted" inputClassName="!text-xs w-16" emptyDisplay="—" /> kg</span><span className="inline-flex items-center gap-1">Cost: <InlineClickEdit value={item.cost ?? ''} onSave={async (v) => saveItemField(item.id, 'cost', v)} className="!text-xs !text-muted" inputClassName="!text-xs w-20" emptyDisplay="—" /></span></> : <>{item.weight != null && <span>Weight: {item.weight} kg</span>}{item.cost && <span>Cost: {item.cost}</span>}</>}</div>{isOwner ? <div><button type="button" onClick={() => setExpandedItems(p => ({ ...p, [item.id]: !p[item.id] }))} className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"><svg className={`w-3 h-3 transition-transform ${expandedItems[item.id] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>Description</button>{expandedItems[item.id] && <div className="mt-1 pl-4"><InlineClickEdit value={item.description ?? ''} onSave={async (v) => saveItemField(item.id, 'description', v)} as="textarea" className="text-sm text-muted-foreground whitespace-pre-wrap" emptyDisplay="Add description..." /></div>}</div> : item.description && <div><button type="button" onClick={() => setExpandedItems(p => ({ ...p, [item.id]: !p[item.id] }))} className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"><svg className={`w-3 h-3 transition-transform ${expandedItems[item.id] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>Description</button>{expandedItems[item.id] && <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1 pl-4">{item.description}</p>}</div>}</div>)}</div>{isOwner && !showNewItem && <button onClick={() => setShowNewItem(true)} className="btn-primary text-sm">+ Add Item</button>}{isOwner && showNewItem && <form onSubmit={handleCreateItem} className="card !p-4 space-y-3 border-primary/20"><h4 className="text-sm font-semibold text-primary">New Item</h4><div><label className="text-xs text-muted">Name</label><input className="input-field" value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Long Sword"/></div><div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-muted">Weight (kg)</label><input type="number" step="any" className="input-field" value={newItem.weight} onChange={e => setNewItem(p => ({ ...p, weight: e.target.value }))} placeholder="3"/></div><div><label className="text-xs text-muted">Cost</label><input className="input-field" value={newItem.cost} onChange={e => setNewItem(p => ({ ...p, cost: e.target.value }))} placeholder="150 gp"/></div></div><div><label className="text-xs text-muted">Description</label><textarea className="input-field resize-none" rows={2} value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} placeholder="Steel longsword forged by..."/></div>{itemError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{itemError}</div>}<div className="flex gap-2 justify-end"><button type="button" onClick={resetNewItem} disabled={itemSaving} className="btn-ghost text-sm">Cancel</button><button type="submit" disabled={itemSaving || !newItem.name.trim()} className="btn-primary text-sm">{itemSaving ? 'Creating...' : 'Create'}</button></div></form>}</div>}
      {activeTab === 'story' && <div className="space-y-4"><div className="card !p-6 space-y-4">{isOwner ? <><InlineTextarea value={story?.appearance ?? ''} label="Appearance" onSave={(v) => saveStoryField('appearance', v)} rows={3} emptyDisplay="Add appearance description..." /><InlineTextarea value={story?.backstory ?? ''} label="Backstory" onSave={(v) => saveStoryField('backstory', v)} rows={5} emptyDisplay="Add backstory..." /><InlineTextarea value={story?.personality ?? ''} label="Personality" onSave={(v) => saveStoryField('personality', v)} rows={3} emptyDisplay="Add personality description..." /><InlineTextarea value={story?.goals ?? ''} label="Goals" onSave={(v) => saveStoryField('goals', v)} rows={3} emptyDisplay="Add character goals..." /><InlineTextarea value={story?.notes ?? ''} label="Notes" onSave={(v) => saveStoryField('notes', v)} rows={3} emptyDisplay="Add notes..." /></> : <><StoryField label="Appearance" value={story?.appearance} /><StoryField label="Backstory" value={story?.backstory} /><StoryField label="Personality" value={story?.personality} /><StoryField label="Goals" value={story?.goals} /><StoryField label="Notes" value={story?.notes} /></>}</div></div>}
      {confirmDelete && <DeleteModal name={sheet.characterName} error={deleteError} loading={deleting} onCancel={() => setConfirmDelete(false)} onConfirm={handleDelete} />}
    </div>
  </main>)
}

function StoryField({ label, value }: { label: string; value: string | null | undefined }) { const text = value?.trim(); if (!text) return null; return <div><h4 className="text-sm font-medium text-muted mb-1">{label}</h4><p className="text-sm text-foreground/80 whitespace-pre-wrap">{text}</p></div> }

function CollapsibleSkillRow({ skill, result, profiles, selections, active, others, onToggleActive, onOthersChange, onProfileChange, onAttributeChange, templateAttributes }: { skill: SkillValue; result: number | null; profiles: SkillModifierProfile[]; selections: Record<string, string | null>; active: boolean; others: number; onToggleActive: () => void; onOthersChange: (v: number) => void; onProfileChange: (profileId: string, optionId: string | null) => void; onAttributeChange?: (attributeId: string | null) => void; templateAttributes?: { id: string; key: string; name: string }[] }) {
  const [expanded, setExpanded] = useState(false)
  const hasAttrDropdown = (skill.skill.allowedAttributeIds?.length ?? 0) > 0 && !!templateAttributes && !!onAttributeChange
  return <div className={`rounded-lg border border-border bg-background/30 overflow-hidden transition-opacity ${active ? '' : 'opacity-40'}`}><div className="flex items-center px-4 py-3"><input type="checkbox" checked={active} onChange={onToggleActive} className="shrink-0 w-4 h-4 rounded border-border accent-primary cursor-pointer mr-3" /><button type="button" onClick={() => setExpanded(!expanded)} disabled={!active} className="flex items-center justify-between flex-1 min-w-0 text-left hover:bg-background/50 transition-colors disabled:cursor-default disabled:hover:bg-transparent"><div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap"><span className="text-sm font-medium text-foreground truncate">{skill.skill.name}</span>{skill.skill.description && <span className="text-xs text-muted truncate hidden sm:inline">— {skill.skill.description}</span>}</div><div className="flex items-center gap-2 shrink-0 ml-3" onClick={e => e.stopPropagation()}>{hasAttrDropdown && <select className="input-field py-0.5 text-xs w-auto min-w-[90px]" value={skill.selectedAttributeId ?? ''} onChange={e => onAttributeChange!(e.target.value || null)}>{skill.skill.allowedAttributeIds.map(attrId => { const a = templateAttributes!.find(x => x.id === attrId); if (!a) return null; return <option key={attrId} value={attrId}>{a.name}</option> })}</select>}<span className="text-base font-bold text-primary">{active ? (result != null ? result : '—') : '0'}</span><svg className={`w-4 h-4 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg></div></button></div>{expanded && active && <div className="px-4 py-3 space-y-2 border-t border-border ml-10">{profiles.map(profile => { const sid = selections[profile.id]; const so = sid ? profile.options.find(o => o.id === sid) : null; return <div key={profile.id} className="flex items-center gap-2"><span className="text-xs text-muted shrink-0 min-w-[80px]">{profile.name}:</span><select className="input-field py-1 text-xs flex-1" value={sid ?? ''} onChange={e => { onProfileChange(profile.id, e.target.value || null) }}><option value="">— Select —</option>{profile.options.map(opt => <option key={opt.id} value={opt.id}>{opt.label} ({opt.value >= 0 ? '+' : ''}{opt.value})</option>)}</select>{so && <span className="text-xs font-mono text-primary shrink-0">{so.value >= 0 ? '+' : ''}{so.value}</span>}</div> })}<div className="flex items-center gap-2"><span className="text-xs text-muted shrink-0 min-w-[80px]">Others:</span><input type="number" min={0} step={1} className="input-field py-1 text-xs w-20" value={others || ''} placeholder="0" onChange={e => onOthersChange(parseInt(e.target.value, 10) || 0)} /><span className="text-xs font-mono text-primary">+{others}</span></div></div>}</div>
}

function InlineClickEdit({ value, onSave, as = 'input', className = '', inputClassName = '', emptyDisplay = '—', rows = 2 }: { value: string; onSave: (value: string) => Promise<void>; as?: 'input' | 'textarea'; className?: string; inputClassName?: string; emptyDisplay?: string; rows?: number }) {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(value); const [saving, setSaving] = useState(false); const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  useEffect(() => { setDraft(value) }, [value])
  const commit = useCallback(async () => { const trimmed = draft.trim(); if (trimmed === value.trim()) { setEditing(false); return }; setSaving(true); try { await onSave(trimmed); setEditing(false) } catch { setDraft(value) } finally { setSaving(false) } }, [draft, value, onSave])
  if (!editing) { const display = value?.trim(); return <button type="button" onClick={() => { setEditing(true); setTimeout(() => { if (inputRef.current) (inputRef.current as HTMLInputElement).focus() }, 0) }} className={`text-left hover:bg-foreground/5 rounded px-1 -mx-1 transition-colors cursor-pointer ${display ? '' : 'text-muted italic'} ${className}`}>{display || emptyDisplay}</button> }
  if (as === 'textarea') return (
    <div className="relative">
      <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} value={draft} rows={rows} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false) } }} className={`input-field resize-none text-sm w-full ${inputClassName}`} autoFocus disabled={saving} />
      {saving && <div className="absolute top-2 right-2 w-3 h-3 border border-primary/30 border-t-primary rounded-full animate-spin" />}
    </div>
  )
  return (
    <div className="relative inline-block">
      <input ref={inputRef as React.RefObject<HTMLInputElement>} type="text" value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }} className={`input-field py-0.5 px-1 text-sm ${inputClassName}`} autoFocus disabled={saving} />
      {saving && <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 border border-primary/30 border-t-primary rounded-full animate-spin" />}
    </div>
  )
}

// ── Abilities Tab Component ──

function AbilitiesTab({
  abilities, isOwner, sheetId, template,
  selectedLevels, setAbilities, setSelectedLevels,
  showNewAbility, setShowNewAbility,
  newAbilityType, setNewAbilityType,
  newAbility, setNewAbility,
  abilitySaving, abilityError,
  handleCreateAbility, resetNewAbility,
  handleDeleteAbility,
  showAddLevelModal, setShowAddLevelModal,
  newLevelForm, setNewLevelForm,
  levelModalSaving, setLevelModalSaving,
  levelModalError, setLevelModalError,
  expandedAbilities, setExpandedAbilities,
  summonModifierResults, summonAcResults,
  saveSummonAttribute, saveSummonAcValue, saveSummonHealth,
  summonTabs, setSummonTabs,
  summonSkillResults,
  handleAddSummonSkill, handleRemoveSummonSkill,
  handleSummonSkillAttributeChange, handleSummonSkillProfileChange,
  handleCreateSummonAbility,
}: {
  abilities: Ability[]; isOwner: boolean; sheetId: string
  template: CharacterSheet['template']
  selectedLevels: Record<string, string>; setAbilities: React.Dispatch<React.SetStateAction<Ability[]>>
  setSelectedLevels: React.Dispatch<React.SetStateAction<Record<string, string>>>
  showNewAbility: boolean; setShowNewAbility: React.Dispatch<React.SetStateAction<boolean>>
  newAbilityType: 'ABILITY' | 'SUMMON' | null; setNewAbilityType: React.Dispatch<React.SetStateAction<'ABILITY' | 'SUMMON' | null>>
  newAbility: { name: string; description: string; manaCost: string; range: string; notes: string; damage: string }
  setNewAbility: React.Dispatch<React.SetStateAction<{ name: string; description: string; manaCost: string; range: string; notes: string; damage: string }>>
  abilitySaving: boolean; abilityError: string | null
  handleCreateAbility: (e: FormEvent) => Promise<void>; resetNewAbility: () => void
  handleDeleteAbility: (aid: string) => Promise<void>
  showAddLevelModal: string | null; setShowAddLevelModal: React.Dispatch<React.SetStateAction<string | null>>
  newLevelForm: { level: number; copyFromPrevious: boolean }; setNewLevelForm: React.Dispatch<React.SetStateAction<{ level: number; copyFromPrevious: boolean }>>
  levelModalSaving: boolean; setLevelModalSaving: React.Dispatch<React.SetStateAction<boolean>>
  levelModalError: string | null; setLevelModalError: React.Dispatch<React.SetStateAction<string | null>>
  expandedAbilities: Record<string, boolean>; setExpandedAbilities: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  summonModifierResults: Record<string, Record<string, number | null>>
  summonAcResults: Record<string, number | null>
  saveSummonAttribute: (abilityId: string, attributeId: string, value: string) => Promise<void>
  saveSummonAcValue: (abilityId: string, fieldId: string, value: string) => Promise<void>
  saveSummonHealth: (abilityId: string, field: 'current' | 'maximum', value: number | null) => Promise<void>
  summonTabs: Record<string, SummonTab>; setSummonTabs: React.Dispatch<React.SetStateAction<Record<string, SummonTab>>>
  summonSkillResults: Record<string, Record<string, number | null>>
  handleAddSummonSkill: (abilityId: string, skillId: string) => Promise<void>
  handleRemoveSummonSkill: (abilityId: string, summonSkillId: string) => Promise<void>
  handleSummonSkillAttributeChange: (abilityId: string, summonSkillId: string, attributeId: string | null) => Promise<void>
  handleSummonSkillProfileChange: (abilityId: string, summonSkillId: string, profileId: string, optionId: string | null) => Promise<void>
  handleCreateSummonAbility: (summonId: string, e: FormEvent) => Promise<void>
}) {
  const [confirmDeleteAbility, setConfirmDeleteAbility] = useState<string | null>(null)
  const [confirmDeleteLevel, setConfirmDeleteLevel] = useState<string | null>(null)
  const [deletingAbility, setDeletingAbility] = useState(false)
  const [deletingLevel, setDeletingLevel] = useState(false)

  // Summon skill search state per summon
  const [skillSearchOpen, setSkillSearchOpen] = useState<string | null>(null)
  const [skillSearchQuery, setSkillSearchQuery] = useState('')

  // Summon-scoped ability creation state
  const [showNewSummonAbility, setShowNewSummonAbility] = useState<string | null>(null)

  const toggleExpand = (aid: string) => setExpandedAbilities(prev => ({ ...prev, [aid]: !prev[aid] }))

  function getSelectedLevel(ability: Ability): AbilityLevel | undefined {
    const selId = selectedLevels[ability.id]
    if (selId) return ability.levels.find(l => l.id === selId)
    return ability.levels[ability.levels.length - 1]
  }

  async function handleAddLevel(abilityId: string) {
    if (!sheetId) return
    setLevelModalSaving(true)
    try {
      const level = await api.post<AbilityLevel>(`/character-sheets/${sheetId}/abilities/${abilityId}/levels`, { level: newLevelForm.level, copyFromPrevious: newLevelForm.copyFromPrevious })
      setAbilities(prev => prev.map(a => a.id === abilityId ? { ...a, levels: [...a.levels, level] } : a))
      setSelectedLevels(prev => ({ ...prev, [abilityId]: level.id }))
      setShowAddLevelModal(null)
    } catch (err) { setLevelModalError(err instanceof Error ? err.message : 'Failed to create level') }
    finally { setLevelModalSaving(false) }
  }

  const armorClass = template.armorClass
  const allTemplateSkills = template.templateSkills ?? []

  const summonSkillTabClass = (aid: string, t: SummonTab) => {
    const active = summonTabs[aid] ?? 'stats'
    return `px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${active === t ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted hover:text-foreground'}`
  }

  return (
    <div className="space-y-4">
      {abilities.length === 0 && !showNewAbility && (
        <div className="text-center py-6 text-muted-foreground text-sm italic">
          No abilities or summons yet. {isOwner && 'Create one below.'}
        </div>
      )}

      <div className="space-y-3">
        {abilities.map(a => {
          const isExpanded = expandedAbilities[a.id] ?? false
          const isAbility = a.type !== 'SUMMON'
          const selLevel = isAbility ? getSelectedLevel(a) : undefined
          const maxLevel = a.levels.length > 0 ? Math.max(...a.levels.map(l => l.level)) : 0
          const currentSummonTab = summonTabs[a.id] ?? 'stats'

          return (
            <div key={a.id} className={`card !p-0 overflow-hidden transition-all duration-200 ${isExpanded ? 'border-primary/20' : ''}`}>
              {/* Collapsed Header */}
              <button
                type="button"
                onClick={() => toggleExpand(a.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-foreground/5 transition-colors"
              >
                <svg className={`w-4 h-4 text-muted transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
                <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-foreground truncate">{a.name}</span>
                  <span className={`badge text-xs ${isAbility ? 'badge-gold' : 'badge-gold'} opacity-70`}>
                    {isAbility ? 'Ability' : 'Summon'}
                  </span>
                  {isAbility && selLevel && (
                    <span className="text-[0.65rem] text-muted">Level {selLevel.level}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                  {isAbility && a.levels.length > 0 && (
                    <select
                      className="input-field py-0.5 px-2 text-xs"
                      value={selLevel?.id ?? ''}
                      onChange={e => setSelectedLevels(prev => ({ ...prev, [a.id]: e.target.value }))}
                    >
                      {a.levels.map(l => <option key={l.id} value={l.id}>Level {l.level}</option>)}
                    </select>
                  )}
                  {isOwner && (
                    <button
                      onClick={() => setConfirmDeleteAbility(a.id)}
                      className="text-xs text-danger hover:text-danger/80 px-1 py-1 transition-colors"
                      title={`Delete ${isAbility ? 'ability' : 'summon'}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border animate-fade-in">
                  {/* ABILITY type - show level details */}
                  {isAbility && selLevel ? (
                    <>
                      {isOwner && a.levels.length > 1 && (
                        <div className="flex justify-end pt-3">
                          <button onClick={() => setConfirmDeleteLevel(selLevel.id)} className="text-[0.6rem] text-danger/70 hover:text-danger px-1 py-0.5 transition-colors">
                            Delete Level {selLevel.level}
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-muted">
                        {isOwner ? (
                          <>
                            <span className="inline-flex items-center gap-1">Mana: <InlineClickEdit value={selLevel.manaCost?.toString() ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${selLevel.id}`, { manaCost: v.trim() ? parseInt(v, 10) : null }); setAbilities(prev => prev.map(ab => ({ ...ab, levels: ab.levels.map(l => l.id === selLevel.id ? { ...l, manaCost: v.trim() ? parseInt(v, 10) : null } : l) }))) } catch {} }} className="!text-xs !text-muted" inputClassName="!text-xs w-16" emptyDisplay="—" /></span>
                            <span className="inline-flex items-center gap-1">Range: <InlineClickEdit value={selLevel.range ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${selLevel.id}`, { range: v.trim() || null }); setAbilities(prev => prev.map(ab => ({ ...ab, levels: ab.levels.map(l => l.id === selLevel.id ? { ...l, range: v.trim() || null } : l) }))) } catch {} }} className="!text-xs !text-muted" inputClassName="!text-xs w-20" emptyDisplay="—" /></span>
                            {selLevel.damage != null && <span className="inline-flex items-center gap-1">Damage: <InlineClickEdit value={selLevel.damage ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${selLevel.id}`, { damage: v.trim() || null }); setAbilities(prev => prev.map(ab => ({ ...ab, levels: ab.levels.map(l => l.id === selLevel.id ? { ...l, damage: v.trim() || null } : l) }))) } catch {} }} className="!text-xs !text-muted" inputClassName="!text-xs w-16" emptyDisplay="—" /></span>}
                          </>
                        ) : (
                          <>
                            {selLevel.manaCost != null && <span>Mana: {selLevel.manaCost}</span>}
                            {selLevel.range && <span>Range: {selLevel.range}</span>}
                            {selLevel.damage && <span>Damage: {selLevel.damage}</span>}
                          </>
                        )}
                      </div>
                      {isOwner ? (
                        <>
                          <div><h5 className="text-xs font-medium text-muted mb-1">Description</h5><InlineClickEdit value={selLevel.description ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${selLevel.id}`, { description: v.trim() || null }); setAbilities(prev => prev.map(ab => ({ ...ab, levels: ab.levels.map(l => l.id === selLevel.id ? { ...l, description: v.trim() || null } : l) }))) } catch {} }} as="textarea" className="text-sm text-muted-foreground whitespace-pre-wrap" emptyDisplay="Add description..." /></div>
                          <div><h5 className="text-xs font-medium text-muted mb-1">Notes</h5><InlineClickEdit value={selLevel.notes ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${selLevel.id}`, { notes: v.trim() || null }); setAbilities(prev => prev.map(ab => ({ ...ab, levels: ab.levels.map(l => l.id === selLevel.id ? { ...l, notes: v.trim() || null } : l) }))) } catch {} }} as="textarea" className="text-xs text-muted italic whitespace-pre-wrap" emptyDisplay="Add notes..." /></div>
                        </>
                      ) : (
                        <>
                          {selLevel.description && <div><h5 className="text-xs font-medium text-muted mb-1">Description</h5><p className="text-sm text-muted-foreground whitespace-pre-wrap">{selLevel.description}</p></div>}
                          {selLevel.notes && <div><h5 className="text-xs font-medium text-muted mb-1">Notes</h5><p className="text-xs text-muted italic whitespace-pre-wrap">{selLevel.notes}</p></div>}
                        </>
                      )}

                      {/* Description & Notes from ability itself */}
                      {isOwner && (
                        <div className="space-y-2 pt-2 border-t border-border">
                          <div><h5 className="text-xs font-medium text-muted mb-1">Ability Description</h5><InlineClickEdit value={a.description ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/${a.id}`, { description: v.trim() || null }); setAbilities(prev => prev.map(ab => ab.id === a.id ? { ...ab, description: v.trim() || null } : ab)) } catch {} }} as="textarea" className="text-sm text-muted-foreground whitespace-pre-wrap" emptyDisplay="Add description..." /></div>
                          <div><h5 className="text-xs font-medium text-muted mb-1">Ability Notes</h5><InlineClickEdit value={a.notes ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/${a.id}`, { notes: v.trim() || null }); setAbilities(prev => prev.map(ab => ab.id === a.id ? { ...ab, notes: v.trim() || null } : ab)) } catch {} }} as="textarea" className="text-xs text-muted italic whitespace-pre-wrap" emptyDisplay="Add notes..." /></div>
                        </div>
                      )}
                      {isOwner && (
                        <button
                          onClick={() => { setShowAddLevelModal(a.id); setNewLevelForm({ level: maxLevel + 1, copyFromPrevious: a.levels.length > 0 }); setLevelModalError(null) }}
                          className="btn-ghost text-xs"
                        >
                          + Add Level
                        </button>
                      )}
                    </>
                  ) : isAbility && !selLevel ? (
                    <p className="text-xs text-muted italic pt-2">No levels added yet.</p>
                  ) : null}

                  {/* SUMMON type - Internal Tabs */}
                  {!isAbility && (
                    <div className="pt-2">
                      {/* Internal tab nav */}
                      <div className="flex gap-1 mb-3 border-b border-border pb-2">
                        <button type="button" onClick={() => setSummonTabs(prev => ({ ...prev, [a.id]: 'stats' }))} className={summonSkillTabClass(a.id, 'stats')}>
                          Stats
                        </button>
                        <button type="button" onClick={() => setSummonTabs(prev => ({ ...prev, [a.id]: 'skills' }))} className={summonSkillTabClass(a.id, 'skills')}>
                          Skills
                        </button>
                        <button type="button" onClick={() => setSummonTabs(prev => ({ ...prev, [a.id]: 'abilities' }))} className={summonSkillTabClass(a.id, 'abilities')}>
                          Abilities
                        </button>
                      </div>

                      {/* ── Stats Tab ── */}
                      {currentSummonTab === 'stats' && <div className="space-y-3">
                        {/* Description & Notes */}
                        <div className="space-y-2">
                          {isOwner ? (
                            <>
                              <div><h5 className="text-xs font-medium text-muted mb-1">Description</h5><InlineClickEdit value={a.description ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/${a.id}`, { description: v.trim() || null }); setAbilities(prev => prev.map(ab => ab.id === a.id ? { ...ab, description: v.trim() || null } : ab)) } catch {} }} as="textarea" className="text-sm text-muted-foreground whitespace-pre-wrap" emptyDisplay="Add description..." /></div>
                              <div><h5 className="text-xs font-medium text-muted mb-1">Notes</h5><InlineClickEdit value={a.notes ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/${a.id}`, { notes: v.trim() || null }); setAbilities(prev => prev.map(ab => ab.id === a.id ? { ...ab, notes: v.trim() || null } : ab)) } catch {} }} as="textarea" className="text-xs text-muted italic whitespace-pre-wrap" emptyDisplay="Add notes..." /></div>
                            </>
                          ) : (
                            <>
                              {a.description && <div><h5 className="text-xs font-medium text-muted mb-1">Description</h5><p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.description}</p></div>}
                              {a.notes && <div><h5 className="text-xs font-medium text-muted mb-1">Notes</h5><p className="text-xs text-muted italic whitespace-pre-wrap">{a.notes}</p></div>}
                            </>
                          )}
                        </div>

                        {/* Health */}
                        {a.summonHealth && (
                          <div className="card !p-3 !bg-background/30">
                            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Health</h4>
                            <div className="flex items-center justify-center gap-3">
                              <div className="text-center">
                                <span className="text-muted text-xs block">Current</span>
                                {isOwner ? (
                                  <InlineNumber value={a.summonHealth.current ?? 0} onSave={(v) => saveSummonHealth(a.id, 'current', v)} min={0} className="text-xl font-bold text-foreground" />
                                ) : (
                                  <span className="text-xl font-bold text-foreground">{a.summonHealth.current ?? '—'}</span>
                                )}
                              </div>
                              <span className="text-muted text-lg">/</span>
                              <div className="text-center">
                                <span className="text-muted text-xs block">Max</span>
                                {isOwner ? (
                                  <InlineNumber value={a.summonHealth.maximum ?? 0} onSave={(v) => saveSummonHealth(a.id, 'maximum', v)} min={0} className="text-xl font-bold text-foreground" />
                                ) : (
                                  <span className="text-xl font-bold text-foreground">{a.summonHealth.maximum ?? '—'}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Attributes */}
                        {(a.summonAttributes ?? []).length > 0 && (
                          <div className="card !p-3 !bg-background/30">
                            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Attributes</h4>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {a.summonAttributes.map(sa => {
                                const attr = template.attributes.find(at => at.id === sa.attributeId)
                                if (!attr) return null
                                const modResult = (summonModifierResults[a.id] ?? {})[attr.id]
                                return (
                                  <div key={sa.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-background/50 border border-border">
                                    <span className="text-sm text-foreground">{attr.name}</span>
                                    <div className="flex items-center gap-2">
                                      {isOwner ? (
                                        <InlineText value={sa.value} onSave={(v) => saveSummonAttribute(a.id, sa.attributeId, v)} className="text-sm font-semibold text-foreground" />
                                      ) : (
                                        <span className="text-sm font-semibold text-foreground">{sa.value || '—'}</span>
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
                        )}

                        {/* Armor Class */}
                        {armorClass?.enabled && armorClass.fields.length > 0 && (a.summonAcValues ?? []).length > 0 && (
                          <div className="card !p-3 !bg-background/30">
                            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Armor Class</h4>
                            <div className="flex items-center justify-center mb-3">
                              <div className="w-20 h-20 rounded-full border-3 border-primary/30 flex items-center justify-center bg-background/50">
                                <span className="text-3xl font-bold text-primary">{summonAcResults[a.id] !== null && summonAcResults[a.id] !== undefined ? summonAcResults[a.id] : '—'}</span>
                              </div>
                            </div>
                            {armorClass.fields.map(field => {
                              const acv = a.summonAcValues.find(v => v.fieldId === field.id)
                              const val = acv?.value ?? field.defaultValue
                              const canEdit = isOwner && field.editableByPlayer
                              return (
                                <div key={field.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-background/50 border border-border mb-1">
                                  <div className="flex items-center gap-1 min-w-0">
                                    <span className="text-sm text-foreground truncate">{field.name}</span>
                                    {field.description && <span className="text-[0.6rem] text-muted hidden sm:inline">— {field.description}</span>}
                                  </div>
                                  {canEdit ? (
                                    <input type="number" className="input-field py-0.5 text-xs w-16 text-right" value={val} onChange={e => saveSummonAcValue(a.id, field.id, e.target.value)} />
                                  ) : (
                                    <span className="text-sm font-semibold text-foreground">{val}</span>
                                  )}
                                </div>
                              )
                            })}
                            {armorClass.attributeModifierIds.length > 0 && (
                              <div className="mt-2">
                                <h5 className="text-[0.6rem] font-semibold text-muted uppercase tracking-wider mb-1">Attribute Modifiers</h5>
                                <div className="grid gap-1 sm:grid-cols-2">
                                  {armorClass.attributeModifierIds.map(attrKey => {
                                    const attr = template.attributes.find(at => at.key === attrKey)
                                    if (!attr) return null
                                    const modResult = (summonModifierResults[a.id] ?? {})[attr.id]
                                    return (
                                      <div key={attrKey} className="flex items-center justify-between py-1 px-2 rounded-lg bg-background/50 border border-border opacity-80">
                                        <span className="text-xs text-foreground truncate">{attr.name} Mod</span>
                                        <span className="text-xs font-semibold text-muted" style={{ opacity: 0.6 }}>
                                          {modResult !== null && modResult !== undefined ? `${modResult >= 0 ? '+' : ''}${modResult}` : '—'}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>}

                      {/* ── Skills Tab ── */}
                      {currentSummonTab === 'skills' && <div className="space-y-3">
                        {/* Add skill button + search */}
                        {isOwner && (
                          <div>
                            {skillSearchOpen !== a.id ? (
                              <button
                                type="button"
                                onClick={() => { setSkillSearchOpen(a.id); setSkillSearchQuery('') }}
                                className="btn-ghost text-xs inline-flex items-center gap-1"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                                Add Skill
                              </button>
                            ) : (
                              <div className="space-y-1">
                                <div className="relative">
                                  <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                                  <input
                                    className="input-field pl-8 py-1 text-xs w-full"
                                    placeholder="Search Skill..."
                                    value={skillSearchQuery}
                                    onChange={e => setSkillSearchQuery(e.target.value)}
                                    autoFocus
                                    onKeyDown={e => { if (e.key === 'Escape') setSkillSearchOpen(null) }}
                                  />
                                </div>
                                <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                                  {allTemplateSkills
                                    .filter(s => {
                                      const alreadyAdded = (a.summonSkills ?? []).some(ss => ss.skillId === s.id)
                                      if (alreadyAdded) return false
                                      if (!skillSearchQuery.trim()) return true
                                      return s.name.toLowerCase().includes(skillSearchQuery.toLowerCase())
                                    })
                                    .slice(0, 25)
                                    .map(s => (
                                      <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => { handleAddSummonSkill(a.id, s.id); setSkillSearchOpen(null); setSkillSearchQuery('') }}
                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-foreground/5 transition-colors"
                                      >
                                        {s.name}
                                      </button>
                                    ))}
                                  {allTemplateSkills.filter(s => !(a.summonSkills ?? []).some(ss => ss.skillId === s.id) && (!skillSearchQuery.trim() || s.name.toLowerCase().includes(skillSearchQuery.toLowerCase()))).length === 0 && (
                                    <div className="px-3 py-2 text-xs text-muted italic">No skills found</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Skill list */}
                        {(a.summonSkills ?? []).length === 0 ? (
                          <div className="text-xs text-muted italic py-2">No skills added. Click "Add Skill" to select from the template.</div>
                        ) : (
                          <div className="space-y-1.5">
                            {(a.summonSkills ?? []).map(ss => {
                              const result = (summonSkillResults[a.id] ?? {})[ss.id]
                              const hasAttrDropdown = (ss.skill.allowedAttributeIds?.length ?? 0) > 0
                              const skillProfiles = template.skillModifierProfiles.filter(p => {
                                const tm = (p as any).targetMode ?? 'ALL_SKILLS'
                                const tids: string[] = (p as any).targetSkillIds ?? []
                                return tm === 'ALL_SKILLS' || tids.length === 0 || tids.includes(ss.skill.name)
                              })
                              return (
                                <div key={ss.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-background/50 border border-border">
                                  <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <span className="text-sm font-medium text-foreground truncate">{ss.skill.name}</span>
                                    {isOwner && hasAttrDropdown && (
                                      <select
                                        className="input-field py-0.5 text-xs w-auto min-w-[80px]"
                                        value={ss.selectedAttributeId ?? ''}
                                        onChange={e => handleSummonSkillAttributeChange(a.id, ss.id, e.target.value || null)}
                                      >
                                        {ss.skill.allowedAttributeIds.map(attrId => {
                                          const attr = template.attributes.find(x => x.id === attrId)
                                          if (!attr) return null
                                          return <option key={attrId} value={attrId}>{attr.name}</option>
                                        })}
                                      </select>
                                    )}
                                  </div>
                                  <span className="text-sm font-bold text-primary shrink-0">{result != null ? (result >= 0 ? '+' : '') + result : '—'}</span>
                                  {isOwner && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSummonSkill(a.id, ss.id)}
                                      className="text-muted hover:text-danger shrink-0 p-0.5 transition-colors"
                                      title="Remove skill"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>}

                      {/* ── Abilities Tab ── */}
                      {currentSummonTab === 'abilities' && <div className="space-y-2">
                        {(a.childAbilities ?? []).length === 0 && !showNewSummonAbility ? (
                          <div className="text-xs text-muted italic py-2">No abilities yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {(a.childAbilities ?? []).map((ca: Ability) => {
                              const caExpanded = expandedAbilities[ca.id] ?? false
                              const caSelLevel = ca.levels[ca.levels.length - 1]
                              const caMaxLevel = ca.levels.length > 0 ? Math.max(...ca.levels.map(l => l.level)) : 0
                              return (
                                <div key={ca.id} className={`card !p-0 overflow-hidden transition-all duration-200 ${caExpanded ? 'border-primary/20' : ''}`}>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedAbilities(prev => ({ ...prev, [ca.id]: !prev[ca.id] }))}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-foreground/5 transition-colors"
                                  >
                                    <svg className={`w-3.5 h-3.5 text-muted transition-transform duration-200 shrink-0 ${caExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                                    </svg>
                                    <span className="text-sm font-medium text-foreground truncate flex-1">{ca.name}</span>
                                    {caSelLevel && <span className="text-[0.6rem] text-muted">Lv {caSelLevel.level}</span>}
                                    <div onClick={e => e.stopPropagation()}>
                                      {isOwner && (
                                        <button onClick={() => handleDeleteAbility(ca.id)} className="text-xs text-danger hover:text-danger/80 px-1 py-0.5 transition-colors shrink-0">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                        </button>
                                      )}
                                    </div>
                                  </button>
                                  {caExpanded && caSelLevel && (
                                    <div className="px-3 pb-3 space-y-2 border-t border-border">
                                      <div className="flex flex-wrap gap-2 text-xs text-muted pt-2">
                                        {isOwner ? (
                                          <>
                                            <span className="inline-flex items-center gap-1">Mana: <InlineClickEdit value={caSelLevel.manaCost?.toString() ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${caSelLevel.id}`, { manaCost: v.trim() ? parseInt(v, 10) : null }); setAbilities(prev => prev.map(ab => ({ ...ab, childAbilities: (ab.childAbilities ?? []).map(c => c.id === ca.id ? { ...c, levels: c.levels.map(l => l.id === caSelLevel.id ? { ...l, manaCost: v.trim() ? parseInt(v, 10) : null } : l) } : c) }))) } catch {} }} className="!text-xs !text-muted" inputClassName="!text-xs w-16" emptyDisplay="—" /></span>
                                            <span className="inline-flex items-center gap-1">Range: <InlineClickEdit value={caSelLevel.range ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${caSelLevel.id}`, { range: v.trim() || null }); setAbilities(prev => prev.map(ab => ({ ...ab, childAbilities: (ab.childAbilities ?? []).map(c => c.id === ca.id ? { ...c, levels: c.levels.map(l => l.id === caSelLevel.id ? { ...l, range: v.trim() || null } : l) } : c) }))) } catch {} }} className="!text-xs !text-muted" inputClassName="!text-xs w-20" emptyDisplay="—" /></span>
                                          </>
                                        ) : (
                                          <>
                                            {caSelLevel.manaCost != null && <span>Mana: {caSelLevel.manaCost}</span>}
                                            {caSelLevel.range && <span>Range: {caSelLevel.range}</span>}
                                          </>
                                        )}
                                      </div>
                                      {isOwner ? (
                                        <>
                                          <div><h5 className="text-xs font-medium text-muted mb-1">Description</h5><InlineClickEdit value={caSelLevel.description ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${caSelLevel.id}`, { description: v.trim() || null }); setAbilities(prev => prev.map(ab => ({ ...ab, childAbilities: (ab.childAbilities ?? []).map(c => c.id === ca.id ? { ...c, levels: c.levels.map(l => l.id === caSelLevel.id ? { ...l, description: v.trim() || null } : l) } : c) }))) } catch {} }} as="textarea" className="text-xs text-muted-foreground whitespace-pre-wrap" emptyDisplay="Add description..." /></div>
                                          <div><h5 className="text-xs font-medium text-muted mb-1">Notes</h5><InlineClickEdit value={caSelLevel.notes ?? ''} onSave={async (v) => { try { await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${caSelLevel.id}`, { notes: v.trim() || null }); setAbilities(prev => prev.map(ab => ({ ...ab, childAbilities: (ab.childAbilities ?? []).map(c => c.id === ca.id ? { ...c, levels: c.levels.map(l => l.id === caSelLevel.id ? { ...l, notes: v.trim() || null } : l) } : c) }))) } catch {} }} as="textarea" className="text-xs text-muted italic whitespace-pre-wrap" emptyDisplay="Add notes..." /></div>
                                        </>
                                      ) : (
                                        <>
                                          {caSelLevel.description && <div><h5 className="text-xs font-medium text-muted mb-1">Description</h5><p className="text-xs text-muted-foreground whitespace-pre-wrap">{caSelLevel.description}</p></div>}
                                          {caSelLevel.notes && <div><h5 className="text-xs font-medium text-muted mb-1">Notes</h5><p className="text-xs text-muted italic whitespace-pre-wrap">{caSelLevel.notes}</p></div>}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {isOwner && (
                          <>
                            {showNewSummonAbility === a.id ? (
                              <form onSubmit={(e) => { handleCreateSummonAbility(a.id, e); setShowNewSummonAbility(null) }} className="card !p-3 space-y-2 border-primary/20">
                                <h5 className="text-xs font-semibold text-primary">New Ability for {a.name}</h5>
                                <div><label className="text-[0.65rem] text-muted">Name</label><input className="input-field text-xs" value={newAbility.name} onChange={e => setNewAbility(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Bite" /></div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div><label className="text-[0.65rem] text-muted">Mana Cost</label><input type="number" className="input-field text-xs" value={newAbility.manaCost} onChange={e => setNewAbility(p => ({ ...p, manaCost: e.target.value }))} placeholder="0" /></div>
                                  <div><label className="text-[0.65rem] text-muted">Range</label><input className="input-field text-xs" value={newAbility.range} onChange={e => setNewAbility(p => ({ ...p, range: e.target.value }))} placeholder="melee" /></div>
                                </div>
                                <div><label className="text-[0.65rem] text-muted">Damage</label><input className="input-field text-xs" value={newAbility.damage} onChange={e => setNewAbility(p => ({ ...p, damage: e.target.value }))} placeholder="1d6" /></div>
                                <div><label className="text-[0.65rem] text-muted">Description</label><textarea className="input-field resize-none text-xs" rows={2} value={newAbility.description} onChange={e => setNewAbility(p => ({ ...p, description: e.target.value }))} /></div>
                                <div><label className="text-[0.65rem] text-muted">Notes</label><textarea className="input-field resize-none text-xs" rows={1} value={newAbility.notes} onChange={e => setNewAbility(p => ({ ...p, notes: e.target.value }))} /></div>
                                {abilityError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-2 py-1 text-[0.65rem] text-danger">{abilityError}</div>}
                                <div className="flex gap-2 justify-end">
                                  <button type="button" onClick={() => { setShowNewSummonAbility(null); resetNewAbility() }} className="btn-ghost text-xs">Cancel</button>
                                  <button type="submit" disabled={abilitySaving || !newAbility.name.trim()} className="btn-primary text-xs">{abilitySaving ? 'Creating...' : 'Create'}</button>
                                </div>
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setShowNewSummonAbility(a.id); setNewAbility({ name: '', description: '', manaCost: '', range: '', notes: '', damage: '' }) }}
                                className="btn-ghost text-xs inline-flex items-center gap-1"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                                Add Ability
                              </button>
                            )}
                          </>
                        )}
                      </div>}
                    </div>
                  )}

                  {/* Add Level button for ABILITY type only (shown also when no levels yet) */}
                  {isAbility && isOwner && !selLevel && (
                    <button
                      onClick={() => { setShowAddLevelModal(a.id); setNewLevelForm({ level: 1, copyFromPrevious: false }); setLevelModalError(null) }}
                      className="btn-ghost text-xs"
                    >
                      + Add Level
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Type Selection Modal / New Ability/Summon form */}
      {isOwner && !showNewAbility && (
        <button onClick={() => setShowNewAbility(true)} className="btn-primary text-sm">
          + New Ability or Summon
        </button>
      )}

      {isOwner && showNewAbility && (
        <div className="card !p-4 space-y-3 border-primary/20">
          {!newAbilityType ? (
            <>
              <h4 className="text-sm font-semibold text-primary">What would you like to create?</h4>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewAbilityType('ABILITY')}
                  className="card !p-4 hover:border-primary/30 transition-colors text-center space-y-2"
                >
                  <svg className="w-8 h-8 mx-auto text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                  <div>
                    <div className="font-semibold text-foreground text-sm">Ability</div>
                    <div className="text-xs text-muted">Spells, skills, attacks, etc.</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setNewAbilityType('SUMMON')}
                  className="card !p-4 hover:border-primary/30 transition-colors text-center space-y-2"
                >
                  <svg className="w-8 h-8 mx-auto text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/>
                  </svg>
                  <div>
                    <div className="font-semibold text-foreground text-sm">Summon</div>
                    <div className="text-xs text-muted">Creatures, companions, minions</div>
                  </div>
                </button>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={resetNewAbility} className="btn-ghost text-sm">Cancel</button>
              </div>
            </>
          ) : newAbilityType === 'ABILITY' ? (
            <form onSubmit={handleCreateAbility} className="space-y-3">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                <button type="button" onClick={() => setNewAbilityType(null)} className="text-muted hover:text-foreground transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                </button>
                New Ability
              </h4>
              <div><label className="text-xs text-muted">Name</label><input className="input-field" value={newAbility.name} onChange={e => setNewAbility(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Fireball" /></div>
              <div><label className="text-xs text-muted">Description</label><textarea className="input-field resize-none" rows={2} value={newAbility.description} onChange={e => setNewAbility(p => ({ ...p, description: e.target.value }))} placeholder="Throws a fireball causing area damage." /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-muted">Mana Cost</label><input type="number" className="input-field" value={newAbility.manaCost} onChange={e => setNewAbility(p => ({ ...p, manaCost: e.target.value }))} placeholder="20" /></div>
                <div><label className="text-xs text-muted">Range</label><input className="input-field" value={newAbility.range} onChange={e => setNewAbility(p => ({ ...p, range: e.target.value }))} placeholder="30m" /></div>
              </div>
              <div><label className="text-xs text-muted">Damage</label><input className="input-field" value={newAbility.damage} onChange={e => setNewAbility(p => ({ ...p, damage: e.target.value }))} placeholder="2d6" /></div>
              <div><label className="text-xs text-muted">Notes</label><textarea className="input-field resize-none" rows={2} value={newAbility.notes} onChange={e => setNewAbility(p => ({ ...p, notes: e.target.value }))} /></div>
              {abilityError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{abilityError}</div>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={resetNewAbility} disabled={abilitySaving} className="btn-ghost text-sm">Cancel</button>
                <button type="submit" disabled={abilitySaving || !newAbility.name.trim()} className="btn-primary text-sm">{abilitySaving ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateAbility} className="space-y-3">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                <button type="button" onClick={() => setNewAbilityType(null)} className="text-muted hover:text-foreground transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                </button>
                New Summon
              </h4>
              <div><label className="text-xs text-muted">Name</label><input className="input-field" value={newAbility.name} onChange={e => setNewAbility(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Spirit Wolf" /></div>
              <div><label className="text-xs text-muted">Description</label><textarea className="input-field resize-none" rows={2} value={newAbility.description} onChange={e => setNewAbility(p => ({ ...p, description: e.target.value }))} placeholder="A loyal spirit wolf that follows commands." /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-muted">Health (Current)</label><input type="number" className="input-field" value={newAbility.manaCost} onChange={e => setNewAbility(p => ({ ...p, manaCost: e.target.value }))} placeholder="20" /></div>
                <div><label className="text-xs text-muted">Health (Max)</label><input type="number" className="input-field" value={newAbility.range} onChange={e => setNewAbility(p => ({ ...p, range: e.target.value }))} placeholder="20" /></div>
              </div>
              <div><label className="text-xs text-muted">Notes</label><textarea className="input-field resize-none" rows={2} value={newAbility.notes} onChange={e => setNewAbility(p => ({ ...p, notes: e.target.value }))} /></div>
              <p className="text-[0.65rem] text-muted italic">Attributes and Armor Class are automatically inherited from the sheet template. They can be customized after creation.</p>
              {abilityError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{abilityError}</div>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={resetNewAbility} disabled={abilitySaving} className="btn-ghost text-sm">Cancel</button>
                <button type="submit" disabled={abilitySaving || !newAbility.name.trim()} className="btn-primary text-sm">{abilitySaving ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Add Level Modal */}
      {showAddLevelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card !p-6 max-w-sm w-full space-y-4 border-primary/20">
            <h3 className="font-semibold text-primary">Create Ability Level</h3>
            <div><label className="text-xs text-muted block mb-1">Level</label><input type="number" min={2} className="input-field w-full" value={newLevelForm.level} onChange={e => setNewLevelForm(p => ({ ...p, level: parseInt(e.target.value, 10) || 1 }))} /></div>
            <div><label className="text-xs text-muted block mb-2">Copy information from previous level?</label><div className="flex gap-4"><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="copyPrev" checked={newLevelForm.copyFromPrevious} onChange={() => setNewLevelForm(p => ({ ...p, copyFromPrevious: true }))} className="accent-primary" /><span className="text-sm">Yes</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="copyPrev" checked={!newLevelForm.copyFromPrevious} onChange={() => setNewLevelForm(p => ({ ...p, copyFromPrevious: false }))} className="accent-primary" /><span className="text-sm">No</span></label></div></div>
            {levelModalError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{levelModalError}</div>}
            <div className="flex gap-2 justify-end"><button type="button" onClick={() => setShowAddLevelModal(null)} disabled={levelModalSaving} className="btn-ghost text-sm">Cancel</button><button type="button" onClick={() => handleAddLevel(showAddLevelModal)} disabled={levelModalSaving} className="btn-primary text-sm">{levelModalSaving ? 'Creating...' : 'Create'}</button></div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteAbility && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center">
                <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
              </div>
              <div><h2 className="font-semibold">Delete Entry</h2><p className="text-sm text-muted-foreground">This will permanently delete this entry and all its data (levels, attributes, etc.).</p></div>
            </div>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{abilities.find(a => a.id === confirmDeleteAbility)?.name ?? 'this entry'}</strong>?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteAbility(null)} disabled={deletingAbility} className="btn-ghost">Cancel</button>
              <button onClick={() => { setDeletingAbility(true); handleDeleteAbility(confirmDeleteAbility).finally(() => { setDeletingAbility(false); setConfirmDeleteAbility(null) }) }} disabled={deletingAbility} className="btn-danger-solid">{deletingAbility ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Level Modal */}
      {confirmDeleteLevel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center">
                <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
              </div>
              <div><h2 className="font-semibold">Delete Level</h2><p className="text-sm text-muted-foreground">This will permanently delete this level and all its data.</p></div>
            </div>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>Level {(() => { for (const a of abilities) { const l = a.levels.find(l => l.id === confirmDeleteLevel); if (l) return l.level } return '?' })()}</strong>?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteLevel(null)} disabled={deletingLevel} className="btn-ghost">Cancel</button>
              <button onClick={async () => { setDeletingLevel(true); try { await api.delete(`/character-sheets/${sheetId}/abilities/x/levels/${confirmDeleteLevel}`); setAbilities(prev => prev.map(a => ({ ...a, levels: a.levels.filter(l => l.id !== confirmDeleteLevel) }))); setSelectedLevels(prev => { const next = { ...prev }; for (const a of abilities) { if (a.levels.some(l => l.id === confirmDeleteLevel)) { const remaining = a.levels.filter(l => l.id !== confirmDeleteLevel); if (next[a.id] === confirmDeleteLevel) next[a.id] = remaining.length > 0 ? remaining[remaining.length - 1].id : ''; break } } return next }) } catch {} finally { setDeletingLevel(false); setConfirmDeleteLevel(null) } }} disabled={deletingLevel} className="btn-danger-solid">{deletingLevel ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DeleteModal({ name, error, loading, onCancel, onConfirm }: { name: string; error: string | null; loading: boolean; onCancel: () => void; onConfirm: () => void }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in"><div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center"><svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg></div><div><h2 className="font-semibold">Delete Character Sheet</h2><p className="text-sm text-muted-foreground">This action cannot be undone.</p></div></div><p className="text-sm text-muted-foreground">Are you sure you want to delete "{name}"?</p>{error && <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{error}</div>}<div className="flex gap-3 justify-end"><button onClick={onCancel} disabled={loading} className="btn-ghost">Cancel</button><button onClick={onConfirm} disabled={loading} className="btn-danger-solid">{loading ? 'Deleting...' : 'Delete forever'}</button></div></div></div> }