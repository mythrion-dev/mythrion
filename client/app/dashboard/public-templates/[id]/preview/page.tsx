'use client'

import { useState, useEffect, useReducer, useCallback, useMemo, useRef, type SubmitEvent } from 'react'
import { useParams } from 'next/navigation'
import { API_URL } from '@/lib/api'
import { PreviewBanner } from '@/components/community/PreviewBanner'
import {
  CharacterTab,
  AbilitiesTab,
  InventoryTab,
  StoryTab,
  PersonalAbilitiesTab,
  ResistanceTab,
} from '@/components/character-sheet'
import { previewReducer } from '@/lib/preview-reducer'
import { buildPreviewSheet } from '@/lib/build-preview-sheet'
import {
  computeModifiers as engineComputeModifiers,
  computeSkills as engineComputeSkills,
  computeAC as engineComputeAC,
  computeSummonModifiers as engineComputeSummonModifiers,
  computeSummonAC as engineComputeSummonAC,
  type FormulaEvaluator,
} from '@/lib/character-sheet-engine'
import { computeResistances } from '@/lib/preview-computations'
import { buildAdapter, buildPreviewSheetAsCharacterSheet } from '@/lib/preview-adapter'
import type { PreviewTemplateSnapshot, PreviewSheetState, SkillResult, AcResultMap } from '@/lib/preview-types'
import type { CalculatedResistance } from '@/lib/preview-computations'
import type {
  Ability,
  AbilityLevel,
  InventoryItem,
  Story,
  SectionEntry,
  SkillModifierProfile,
  SheetPermissions,
  Tab,
  SummonSkillData,
  SummonResistanceData,
  ArmorClassAttributeModifierDef,
} from '@/components/character-sheet/types'

// ── Loading spinner ──

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <span className="text-sm">Loading template...</span>
      </div>
    </div>
  )
}

// ── Error state ──

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-sm text-danger">{message}</div>
    </div>
  )
}

// ── Tab class helper ──

function tabClass(activeTab: Tab, tab: Tab) {
  return `flex items-center gap-2 px-5 py-3 text-base font-medium transition-colors border-b-2 ${
    activeTab === tab
      ? 'border-[#c9a84c] text-white'
      : 'border-transparent text-gray-400 hover:text-white'
  }`
}

// ── Permissions: all true in sandbox mode ──

const ALL_PERMISSIONS: SheetPermissions = {
  canEditCharacter: true,
  canEditSkills: true,
  canEditResources: true,
  canEditInventory: true,
  canEditStory: true,
  canEditProfessionalSkills: true,
  canEditPersonalAbilities: true,
  canEditResistances: true,
  canEditAbilities: true,
}

// ── Default export ──

export default function TemplatePreviewPage() {
  const params = useParams()
  const templateId = params.id as string

  // ── Fetch state ──

  const [fetching, setFetching] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // ── Reducer state ──

  const [state, dispatch] = useReducer(previewReducer, null as unknown as PreviewSheetState)

  // ── Refs for latest state values (to avoid stale closures in callbacks) ──

  const stateRef = useRef(state)
  stateRef.current = state

  // ── Computed results ──

  const [modifierResults, setModifierResults] = useState<Record<string, number>>({})
  const [skillResults, setSkillResults] = useState<Record<string, SkillResult>>({})
  const [acResults, setAcResults] = useState<AcResultMap>({})
  const [resistances, setResistances] = useState<CalculatedResistance[]>([])

  // Debounce timer ref
  const computeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── UI-only state (not persisted to reducer) ──

  const [activeTab, setActiveTab] = useState<Tab>('character')

  // AbilitiesTab UI state
  const [selectedLevels, setSelectedLevels] = useState<Record<string, string>>({})
  const [abilitiesSearch, setAbilitiesSearch] = useState('')
  const [showNewAbility, setShowNewAbility] = useState(false)
  const [newAbilityType, setNewAbilityType] = useState<'ABILITY' | 'SUMMON' | null>(null)
  const [newAbility, setNewAbility] = useState({
    name: '', description: '', manaCost: '', range: '', notes: '', damage: '',
    level: '', hpCurrent: '', hpMax: '',
  })
  const [abilitySaving, setAbilitySaving] = useState(false)
  const [abilityError, setAbilityError] = useState<string | null>(null)
  const [showAddLevelModal, setShowAddLevelModal] = useState<string | null>(null)
  const [newLevelForm, setNewLevelForm] = useState<{ level: number | string; copyFromPrevious: boolean }>({
    level: 2,
    copyFromPrevious: true,
  })
  const [levelModalSaving, setLevelModalSaving] = useState(false)
  const [levelModalError, setLevelModalError] = useState<string | null>(null)
  const [expandedAbilities, setExpandedAbilities] = useState<Record<string, boolean>>({})
  const [summonModifierResults, setSummonModifierResults] = useState<Record<string, Record<string, number | null>>>({})
  const [summonAcResults, setSummonAcResults] = useState<Record<string, number | null>>({})

  // InventoryTab UI state
  const [inventorySearch, setInventorySearch] = useState('')
  const [showNewItem, setShowNewItem] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', weight: '', cost: '', description: '' })
  const [itemSaving, setItemSaving] = useState(false)
  const [itemError, setItemError] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

  // PersonalAbilitiesTab UI state
  const [expandedSectionEntries, setExpandedSectionEntries] = useState<Record<string, boolean>>({})
  const [showNewSectionEntry, setShowNewSectionEntry] = useState<string | null>(null)
  const [newSectionEntryForm, setNewSectionEntryForm] = useState({ name: '', description: '' })
  const [sectionEntrySaving, setSectionEntrySaving] = useState(false)

  // ResistanceTab UI state
  const [sheetResistanceValues, setSheetResistanceValues] = useState<Record<string, string | null>>({})

  // ── Fetch template on mount ──

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`${API_URL}/public/templates/${templateId}`)
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Template not found.' : 'Failed to load template.')
        }
        const template: PreviewTemplateSnapshot = await res.json()
        if (cancelled) return

        const initialState = buildPreviewSheet(template)
        dispatch({ type: 'INIT', payload: initialState })
        setFetching(false)
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Failed to load template.')
          setFetching(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [templateId])

  // ── Formula evaluator for the shared engine ──

  const evaluateFormula = useCallback<FormulaEvaluator>(async (formula, variables) => {
    const res = await fetch(`${API_URL}/public/formula/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formula, variables }),
    })
    if (!res.ok) throw new Error('Formula evaluation failed')
    const data = await res.json()
    return data.result as number
  }, [])

  // ── Build CharacterSheet once (shared by engine and adapter) ──

  const previewSheet = useMemo(() => {
    if (!state) return null
    return buildPreviewSheetAsCharacterSheet(state)
  }, [state])

  // ── Debounced computation effect ──

  useEffect(() => {
    if (!state || !previewSheet) return

    if (computeTimerRef.current) {
      clearTimeout(computeTimerRef.current)
    }

    computeTimerRef.current = setTimeout(async () => {
      const s = stateRef.current
      if (!s) return

      try {
        // Compute modifiers (from shared engine)
        const mods = await engineComputeModifiers(previewSheet, evaluateFormula)
        const modsNoNull: Record<string, number> = Object.fromEntries(
          Object.entries(mods).map(([k, v]) => [k, v ?? 0]),
        )
        setModifierResults(modsNoNull)

        // Compute skills (from shared engine, depends on modifiers)
        const skills = await engineComputeSkills(
          previewSheet,
          mods,
          s.profileSelections,
          s.othersValues,
          evaluateFormula,
        )

        // Build SkillResult map from flat skills results + state
        const skillResultsMap: Record<string, SkillResult> = {}
        for (const skill of s.template.templateSkills ?? []) {
          const total = skills[skill.id]
          const selectedAttributeId = s.skillAttributes[skill.id] ?? null
          const selectedAttribute = selectedAttributeId
            ? s.template.attributes.find(a => a.id === selectedAttributeId)
            : null
          skillResultsMap[skill.id] = {
            total: total ?? 0,
            name: skill.name,
            selectedAttribute: selectedAttributeId,
            selectedAttributeName: selectedAttribute?.name ?? null,
            attributeValue: selectedAttributeId ? (modsNoNull[selectedAttributeId] ?? null) : null,
            selectedProfileValue: null,
          }
        }
        setSkillResults(skillResultsMap)

        // Compute AC (from shared engine, depends on modifiers) — synchronous
        const ac = engineComputeAC(previewSheet, mods)
        setAcResults(ac)

        // Compute resistances (stays from preview-computations) — synchronous
        const res = computeResistances(s, modsNoNull)
        setResistances(res)

        // Compute summon modifiers & AC (from shared engine)
        const newSummonModResults: Record<string, Record<string, number | null>> = {}
        const newSummonAcResults: Record<string, number | null> = {}
        for (const ability of s.abilities ?? []) {
          if (ability.type === 'SUMMON') {
            if (ability.summonAttributes?.length) {
              const sm = await engineComputeSummonModifiers(ability, previewSheet, evaluateFormula)
              if (Object.keys(sm).length > 0) {
                newSummonModResults[ability.id] = sm
              }
            }
            const sac = engineComputeSummonAC(ability)
            if (sac !== null) {
              newSummonAcResults[ability.id] = sac
            }
          }
        }
        if (Object.keys(newSummonModResults).length > 0) {
          setSummonModifierResults(prev => ({ ...prev, ...newSummonModResults }))
        }
        if (Object.keys(newSummonAcResults).length > 0) {
          setSummonAcResults(prev => ({ ...prev, ...newSummonAcResults }))
        }
      } catch (err) {
        console.error('[Preview] Computation error:', err)
      }
    }, 300)

    return () => {
      if (computeTimerRef.current) {
        clearTimeout(computeTimerRef.current)
      }
    }
  }, [state, previewSheet, evaluateFormula])

  // ── Adapter: transform state + computed results into tab props ──

  const adapterResult = useMemo(() => {
    if (!state) return null
    return buildAdapter(state, modifierResults, skillResults, acResults, resistances, dispatch)
  }, [state, modifierResults, skillResults, acResults, resistances])

  // ── Synthetic template object for non-CharacterTab components ──

  const previewTemplate = useMemo(() => {
    if (!state) return null
    return {
      id: state.template.id,
      name: state.template.name,
      attributes: state.template.attributes,
      armorClasses: state.template.armorClasses,
      characterSections: state.template.characterSections,
      coreResources: state.template.coreResources,
      resistances: state.template.resistances,
      templateSkills: state.template.templateSkills,
      skillModifierProfiles: state.template.skillModifierProfiles,
      templateFields: state.template.templateFields,
      attributeModifierFormula: state.template.attributeModifierFormula,
      attributeModifiersEnabled: state.template.attributeModifiersEnabled,
      skillFormula: state.template.skillFormula,
    }
  }, [state])

  // ── Refs for latest arrays (used in state setter wrappers) ──

  const abilitiesRef = useRef<Ability[]>([])
  abilitiesRef.current = state?.abilities ?? []
  const itemsRef = useRef<InventoryItem[]>([])
  itemsRef.current = state?.inventoryItems ?? []
  const entriesRef = useRef<SectionEntry[]>([])
  entriesRef.current = state?.sectionEntries ?? []

  // ── State setter wrappers (dispatch to reducer instead of API) ──

  const setAbilities: React.Dispatch<React.SetStateAction<Ability[]>> = useCallback((valueOrFn) => {
    const newValue = typeof valueOrFn === 'function'
      ? (valueOrFn as (prev: Ability[]) => Ability[])(abilitiesRef.current)
      : valueOrFn
    dispatch({ type: 'UPDATE_ABILITIES', payload: newValue })
  }, [dispatch])

  const setInventoryItems: React.Dispatch<React.SetStateAction<InventoryItem[]>> = useCallback((valueOrFn) => {
    const newValue = typeof valueOrFn === 'function'
      ? (valueOrFn as (prev: InventoryItem[]) => InventoryItem[])(itemsRef.current)
      : valueOrFn
    dispatch({ type: 'UPDATE_INVENTORY', payload: newValue })
  }, [dispatch])

  const setSectionEntries: React.Dispatch<React.SetStateAction<SectionEntry[]>> = useCallback((valueOrFn) => {
    const newValue = typeof valueOrFn === 'function'
      ? (valueOrFn as (prev: SectionEntry[]) => SectionEntry[])(entriesRef.current)
      : valueOrFn
    dispatch({ type: 'UPDATE_SECTION_ENTRIES', payload: newValue })
  }, [dispatch])

  // ── AbilitiesTab callbacks (preview mode — update local state only) ──

  const resetNewAbility = useCallback(() => {
    setShowNewAbility(false)
    setNewAbility({ name: '', description: '', manaCost: '', range: '', notes: '', damage: '', level: '', hpCurrent: '', hpMax: '' })
    setNewAbilityType(null)
    setAbilityError(null)
  }, [])

  const handleCreateAbility = useCallback(async (e: SubmitEvent) => {
    e.preventDefault()
    const s = stateRef.current
    if (!s || !newAbility.name.trim()) return
    setAbilitySaving(true)
    try {
      const now = Date.now()
      const newId = `preview-ability-${now}`
      const ability: Ability = {
        id: newId,
        name: newAbility.name.trim(),
        type: newAbilityType ?? 'ABILITY',
        description: newAbility.description.trim() || null,
        notes: newAbility.notes.trim() || null,
        order: 0,
        levels: [],
        summonAttributes: [],
        summonAcValues: [],
        summonHealth: null,
        childAbilities: [],
      }

      if (newAbilityType === 'SUMMON') {
        ability.summonHealth = {
          id: `preview-sh-${now}`,
          abilityId: newId,
          current: newAbility.hpCurrent.trim() ? Number.parseInt(newAbility.hpCurrent, 10) : null,
          maximum: newAbility.hpMax.trim() ? Number.parseInt(newAbility.hpMax, 10) : null,
          notes: null,
        }
      }

      // Create initial level
      if (newAbility.level.trim()) {
        const level: AbilityLevel = {
          id: `preview-level-${now}`,
          abilityId: newId,
          level: newAbility.level.trim(),
          manaCost: newAbility.manaCost.trim() ? Number.parseInt(newAbility.manaCost, 10) : null,
          range: newAbility.range.trim() || null,
          description: null,
          notes: null,
          damage: newAbility.damage.trim() || null,
        }
        ability.levels = [level]
      }

      const updated = [...abilitiesRef.current, ability]
      dispatch({ type: 'UPDATE_ABILITIES', payload: updated })
      setExpandedAbilities(prev => ({ ...prev, [newId]: true }))
      resetNewAbility()
    } catch {
      setAbilityError('Failed to create ability')
    } finally {
      setAbilitySaving(false)
    }
  }, [newAbility, newAbilityType, resetNewAbility, dispatch])

  const handleDeleteAbility = useCallback(async (abilityId: string) => {
    const updated = abilitiesRef.current.filter(a => a.id !== abilityId)
    dispatch({ type: 'UPDATE_ABILITIES', payload: updated })
  }, [dispatch])

  const saveLevelField = useCallback(async (levelId: string, field: string, value: string) => {
    const updated = abilitiesRef.current.map(a => ({
      ...a,
      levels: a.levels.map(l => {
        if (l.id !== levelId) return l
        const body: Record<string, unknown> = {}
        if (field === 'description') body.description = value.trim() || null
        else if (field === 'manaCost') body.manaCost = value.trim() ? Number.parseInt(value, 10) : null
        else if (field === 'range') body.range = value.trim() || null
        else if (field === 'notes') body.notes = value.trim() || null
        else if (field === 'damage') body.damage = value.trim() || null
        return { ...l, ...body }
      }),
    }))
    dispatch({ type: 'UPDATE_ABILITIES', payload: updated })
  }, [dispatch])

  const saveSummonAttribute = useCallback(async (abilityId: string, attributeId: string, value: string) => {
    const updated = abilitiesRef.current.map(a => {
      if (a.id !== abilityId) return a
      const existingAttributes = a.summonAttributes ?? []
      const idx = existingAttributes.findIndex(sa => sa.attributeId === attributeId)
      const newAttributes = idx >= 0
        ? existingAttributes.map((sa, i) => i === idx ? { ...sa, value } : sa)
        : [...existingAttributes, { id: `preview-sa-${Date.now()}`, abilityId, attributeId, value }]
      return { ...a, summonAttributes: newAttributes }
    })
    dispatch({ type: 'UPDATE_ABILITIES', payload: updated })
  }, [dispatch])

  const saveSummonAcValue = useCallback(async (abilityId: string, value: string) => {
    const updated = abilitiesRef.current.map(a => {
      if (a.id !== abilityId) return a
      return {
        ...a,
        summonAcValues: [{ id: `preview-sac-${Date.now()}`, abilityId, value }],
      }
    })
    dispatch({ type: 'UPDATE_ABILITIES', payload: updated })
    const parsed = Number.parseFloat(value)
    setSummonAcResults(prev => ({ ...prev, [abilityId]: Number.isNaN(parsed) ? null : parsed }))
  }, [dispatch])

  const saveSummonHealth = useCallback(async (abilityId: string, field: 'current' | 'maximum', value: number | null) => {
    const updated = abilitiesRef.current.map(a => {
      if (a.id !== abilityId) return a
      return {
        ...a,
        summonHealth: {
          ...(a.summonHealth ?? { id: `preview-sh-${Date.now()}`, abilityId, current: null, maximum: null, notes: null }),
          [field]: value,
        },
      }
    })
    dispatch({ type: 'UPDATE_ABILITIES', payload: updated })
  }, [dispatch])

  const handleAddSummonSkill = useCallback(async (abilityId: string, name: string, manualValue: number) => {
    const newSkill: SummonSkillData = {
      id: `preview-ss-${Date.now()}`,
      abilityId,
      name,
      manualValue,
    }
    const updated = abilitiesRef.current.map(a => {
      if (a.id !== abilityId) return a
      return { ...a, summonSkills: [...(a.summonSkills ?? []), newSkill] }
    })
    dispatch({ type: 'UPDATE_ABILITIES', payload: updated })
  }, [dispatch])

  const handleRemoveSummonSkill = useCallback(async (abilityId: string, summonSkillId: string) => {
    const updated = abilitiesRef.current.map(a => {
      if (a.id !== abilityId) return a
      return { ...a, summonSkills: (a.summonSkills ?? []).filter(s => s.id !== summonSkillId) }
    })
    dispatch({ type: 'UPDATE_ABILITIES', payload: updated })
  }, [dispatch])

  const handleUpdateSummonSkill = useCallback(async (abilityId: string, summonSkillId: string, name: string, manualValue: number) => {
    const updated = abilitiesRef.current.map(a => {
      if (a.id !== abilityId) return a
      return {
        ...a,
        summonSkills: (a.summonSkills ?? []).map(s => s.id === summonSkillId ? { ...s, name, manualValue } : s),
      }
    })
    dispatch({ type: 'UPDATE_ABILITIES', payload: updated })
  }, [dispatch])
  const handleAddSummonResistance = useCallback(async (abilityId: string, name: string, value: string) => {
    const newResistance: SummonResistanceData = {
      id: `preview-sr-${Date.now()}`,
      abilityId,
      name,
      value,
    }
    const updated = abilitiesRef.current.map(a => {
      if (a.id !== abilityId) return a
      return { ...a, summonResistances: [...(a.summonResistances ?? []), newResistance] }
    })
    dispatch({ type: 'UPDATE_ABILITIES', payload: updated })
  }, [dispatch])

  const handleRemoveSummonResistance = useCallback(async (abilityId: string, summonResistanceId: string) => {
    const updated = abilitiesRef.current.map(a => {
      if (a.id !== abilityId) return a
      return { ...a, summonResistances: (a.summonResistances ?? []).filter(r => r.id !== summonResistanceId) }
    })
    dispatch({ type: 'UPDATE_ABILITIES', payload: updated })
  }, [dispatch])

  const handleUpdateSummonResistance = useCallback(async (abilityId: string, summonResistanceId: string, name: string, value: string) => {
    const updated = abilitiesRef.current.map(a => {
      if (a.id !== abilityId) return a
      return {
        ...a,
        summonResistances: (a.summonResistances ?? []).map(r => r.id === summonResistanceId ? { ...r, name, value } : r),
      }
    })
    dispatch({ type: 'UPDATE_ABILITIES', payload: updated })
  }, [dispatch])

  const handleCreateSummonAbility = useCallback(async (summonId: string, e: SubmitEvent) => {
    e.preventDefault()
    const s = stateRef.current
    if (!s || !newAbility.name.trim()) return
    setAbilitySaving(true)
    try {
      const childAbility: Ability = {
        id: `preview-child-${Date.now()}`,
        name: newAbility.name.trim(),
        type: 'ABILITY',
        description: newAbility.description.trim() || null,
        notes: newAbility.notes.trim() || null,
        order: 0,
        levels: [],
        summonAttributes: [],
        summonAcValues: [],
        summonHealth: null,
        childAbilities: [],
      }
      if (newAbility.notes.trim()) childAbility.notes = newAbility.notes.trim()
      const updated = abilitiesRef.current.map(a => {
        if (a.id !== summonId) return a
        return { ...a, childAbilities: [...(a.childAbilities ?? []), childAbility] }
      })
      dispatch({ type: 'UPDATE_ABILITIES', payload: updated })
      resetNewAbility()
    } catch (err) {
      setAbilityError(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setAbilitySaving(false)
    }
  }, [newAbility, resetNewAbility, dispatch])

  // ── InventoryTab callbacks ──

  const resetNewItem = useCallback(() => {
    setShowNewItem(false)
    setNewItem({ name: '', weight: '', cost: '', description: '' })
    setItemError(null)
  }, [])

  const handleCreateItem = useCallback(async (e: SubmitEvent) => {
    e.preventDefault()
    if (!newItem.name.trim()) return
    setItemSaving(true)
    try {
      const item: InventoryItem = {
        id: `preview-item-${Date.now()}`,
        name: newItem.name.trim(),
        weight: newItem.weight.trim() ? Number.parseFloat(newItem.weight) : null,
        cost: newItem.cost.trim() || null,
        description: newItem.description.trim() || null,
        order: 0,
      }
      const updated = [...itemsRef.current, item]
      dispatch({ type: 'UPDATE_INVENTORY', payload: updated })
      resetNewItem()
    } catch (err) {
      setItemError(err instanceof Error ? err.message : 'Failed to create item')
    } finally {
      setItemSaving(false)
    }
  }, [newItem, resetNewItem, dispatch])

  const handleDeleteItem = useCallback(async (itemId: string) => {
    const updated = itemsRef.current.filter(i => i.id !== itemId)
    dispatch({ type: 'UPDATE_INVENTORY', payload: updated })
  }, [dispatch])

  const saveItemField = useCallback(async (itemId: string, field: string, value: string) => {
    const updated = itemsRef.current.map(i => {
      if (i.id !== itemId) return i
      const body: Partial<InventoryItem> = {}
      if (field === 'name') body.name = value.trim()
      else if (field === 'weight') body.weight = value.trim() ? Number.parseFloat(value) : undefined
      else if (field === 'cost') body.cost = value.trim() || undefined
      else if (field === 'description') body.description = value.trim() || undefined
      return { ...i, ...body }
    })
    dispatch({ type: 'UPDATE_INVENTORY', payload: updated })
  }, [dispatch])

  // ── StoryTab callbacks ──

  const saveStoryField = useCallback(async (field: string, value: string) => {
    const s = stateRef.current
    const current = s?.story ?? null
    const updated: Story | null = current
      ? { ...current, [field]: value.trim() || null }
      : { id: 'preview-story', [field]: value.trim() || null } as unknown as Story
    dispatch({ type: 'UPDATE_STORY', payload: updated })
  }, [dispatch])

  // ── PersonalAbilitiesTab callbacks ──

  const toSingular = useCallback((name: string) => {
    if (name.endsWith('ies')) return name.slice(0, -3) + 'y'
    if (name.endsWith('s') && !name.endsWith('ss') && !name.endsWith('us')) return name.slice(0, -1)
    return name
  }, [])

  const resetSectionEntryForm = useCallback(() => {
    setNewSectionEntryForm({ name: '', description: '' })
    setShowNewSectionEntry(null)
    setSectionEntrySaving(false)
  }, [])

  const handleCreateSectionEntry = useCallback(async (sectionId: string, e: SubmitEvent) => {
    e.preventDefault()
    if (!newSectionEntryForm.name.trim()) return
    setSectionEntrySaving(true)
    try {
      const templateSection = stateRef.current?.template.characterSections?.find(s => s.id === sectionId)
      const entry: SectionEntry = {
        id: `preview-entry-${Date.now()}`,
        sheetId: 'preview',
        sectionId,
        name: newSectionEntryForm.name.trim(),
        description: newSectionEntryForm.description.trim() || newSectionEntryForm.name.trim(),
        order: 0,
        section: templateSection ?? { id: sectionId, name: sectionId },
      }
      const updated = [...entriesRef.current, entry]
      dispatch({ type: 'UPDATE_SECTION_ENTRIES', payload: updated })
      resetSectionEntryForm()
    } catch {
      // silent
    } finally {
      setSectionEntrySaving(false)
    }
  }, [newSectionEntryForm, resetSectionEntryForm, dispatch])

  const handleUpdateSectionEntry = useCallback(async (entryId: string, field: string, value: string) => {
    const updated = entriesRef.current.map(e => {
      if (e.id !== entryId) return e
      return { ...e, [field]: value.trim() || null }
    })
    dispatch({ type: 'UPDATE_SECTION_ENTRIES', payload: updated })
  }, [dispatch])

  const handleDeleteSectionEntry = useCallback(async (entryId: string) => {
    const updated = entriesRef.current.filter(e => e.id !== entryId)
    dispatch({ type: 'UPDATE_SECTION_ENTRIES', payload: updated })
  }, [dispatch])

  // ── ResistanceTab callbacks ──

  const handleSaveResistanceComponent = useCallback(async (componentId: string, value: number) => {
    dispatch({ type: 'SET_RESISTANCE_COMPONENT', componentId, value: String(value) })
  }, [dispatch])

  const handleSaveResistanceManual = useCallback(async (resistanceId: string, value: number) => {
    setSheetResistanceValues(prev => ({ ...prev, [resistanceId]: String(value) }))
    dispatch({ type: 'SET_RESISTANCE_MANUAL', resistanceId, value: String(value) })
  }, [dispatch])

  const handleCreateResistance = useCallback(async () => {
    // Cannot create new resistance definitions in preview mode — no-op
  }, [])

  const handleDeleteResistance = useCallback(async () => {
    // Cannot delete resistance definitions in preview mode — no-op
  }, [])

  // ── Guards ──

  if (fetching || !state) return <LoadingSpinner />
  if (fetchError) return <ErrorState message={fetchError} />
  if (!adapterResult || !previewTemplate) return <ErrorState message="Failed to initialize preview." />

  // ── Derived values ──

  const { characterTabProps } = adapterResult
  const abilities = state.abilities ?? []
  const inventoryItems = state.inventoryItems ?? []
  const story = state.story ?? null
  const sectionEntries = state.sectionEntries ?? []
  const resistanceData = adapterResult.resistanceData
  const totalWeight = inventoryItems.reduce((s, i) => s + (i.weight ?? 0), 0)
  const allProfiles: SkillModifierProfile[] = (state.template.skillModifierProfiles ?? []) as SkillModifierProfile[]
  const armorClasses = state.template.armorClasses?.filter(ac => ac.enabled) ?? []
  const modifiersEnabled = state.template.attributeModifiersEnabled !== false
  const enabledCoreResources = state.template.coreResources.filter(cr => cr.enabled)

  return (
    <div className="w-full">
      <PreviewBanner templateName={state.template.name} templateId={templateId} />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Tab navigation */}
        <nav className="flex gap-1 flex-wrap border-b border-border/60">
          <button onClick={() => setActiveTab('character')} className={tabClass(activeTab, 'character')}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Character
          </button>
          <button onClick={() => setActiveTab('abilities')} className={tabClass(activeTab, 'abilities')}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 2l.5 1.5L10 4l-1.5.5L8 6l-.5-1.5L6 4l1.5-.5L8 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 1l.3 1.2L18 3l-1.7.8L16 5l-.3-1.2L14 3l1.7-.8L16 1z" />
            </svg>
            Abilities
          </button>
          <button onClick={() => setActiveTab('inventory')} className={tabClass(activeTab, 'inventory')}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 10a2 2 0 012-2h8a2 2 0 012 2v7a2 2 0 01-2 2H8a2 2 0 01-2-2V10z" />
              <path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2" />
              <rect x="9" y="12" width="6" height="3" rx="1" />
              <path d="M6 11l-2 1" />
              <path d="M18 11l2 1" />
              <path d="M11 6v-1" />
              <path d="M13 6v-1" />
              <path d="M10.5 5h3" />
            </svg>
            Inventory
          </button>
          <button onClick={() => setActiveTab('story')} className={tabClass(activeTab, 'story')}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Story
          </button>
          <button onClick={() => setActiveTab('personal-abilities')} className={tabClass(activeTab, 'personal-abilities')}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Personal Abilities
          </button>
          <button onClick={() => setActiveTab('resistances')} className={tabClass(activeTab, 'resistances')}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3C7 3 4 6 4 9v1c0 2 1.5 3.5 3 4l1 3h8l1-3c1.5-.5 3-2 3-4V9c0-3-3-6-8-6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3V1" />
            </svg>
            Resistances
          </button>
        </nav>

        {/* ── Character Tab ── */}
        {activeTab === 'character' && (
          <CharacterTab {...characterTabProps} />
        )}

        {/* ── Abilities Tab ── */}
        {activeTab === 'abilities' && (
          <AbilitiesTab
            abilities={abilities}
            permissions={ALL_PERMISSIONS}
            sheetId="preview"
            template={previewTemplate as any}
            selectedLevels={selectedLevels}
            setAbilities={setAbilities}
            setSelectedLevels={setSelectedLevels}
            searchQuery={abilitiesSearch}
            setSearchQuery={setAbilitiesSearch}
            showNewAbility={showNewAbility}
            setShowNewAbility={setShowNewAbility}
            newAbilityType={newAbilityType}
            setNewAbilityType={setNewAbilityType}
            newAbility={newAbility}
            setNewAbility={setNewAbility}
            abilitySaving={abilitySaving}
            abilityError={abilityError}
            handleCreateAbility={handleCreateAbility}
            resetNewAbility={resetNewAbility}
            handleDeleteAbility={handleDeleteAbility}
            showAddLevelModal={showAddLevelModal}
            setShowAddLevelModal={setShowAddLevelModal}
            newLevelForm={newLevelForm}
            setNewLevelForm={setNewLevelForm}
            levelModalSaving={levelModalSaving}
            setLevelModalSaving={setLevelModalSaving}
            levelModalError={levelModalError}
            setLevelModalError={setLevelModalError}
            expandedAbilities={expandedAbilities}
            setExpandedAbilities={setExpandedAbilities}
            summonModifierResults={summonModifierResults}
            summonAcResults={summonAcResults}
            saveSummonAttribute={saveSummonAttribute}
            saveSummonAcValue={saveSummonAcValue}
            saveSummonHealth={saveSummonHealth}
            handleAddSummonSkill={handleAddSummonSkill}
            handleUpdateSummonSkill={handleUpdateSummonSkill}
            handleRemoveSummonSkill={handleRemoveSummonSkill}
            handleAddSummonResistance={handleAddSummonResistance}
            handleUpdateSummonResistance={handleUpdateSummonResistance}
            handleRemoveSummonResistance={handleRemoveSummonResistance}
            handleCreateSummonAbility={handleCreateSummonAbility}
          />
        )}

        {/* ── Inventory Tab ── */}
        {activeTab === 'inventory' && (
          <InventoryTab
            inventoryItems={inventoryItems}
            permissions={ALL_PERMISSIONS}
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
          />
        )}

        {/* ── Story Tab ── */}
        {activeTab === 'story' && (
          <StoryTab
            story={story}
            permissions={ALL_PERMISSIONS}
            onSaveField={saveStoryField}
          />
        )}

        {/* ── Personal Abilities Tab ── */}
        {activeTab === 'personal-abilities' && (
          <PersonalAbilitiesTab
            sections={previewTemplate.characterSections ?? []}
            entries={sectionEntries}
            permissions={ALL_PERMISSIONS}
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
          />
        )}

        {/* ── Resistances Tab ── */}
        {activeTab === 'resistances' && (
          <ResistanceTab
            resistances={resistanceData}
            permissions={ALL_PERMISSIONS}
            onSaveComponent={handleSaveResistanceComponent}
            onSaveManual={handleSaveResistanceManual}
            sheetResistanceValues={sheetResistanceValues}
            templateAttributes={previewTemplate.attributes ?? []}
            disableAttributeModifiers={!modifiersEnabled}
            onCreateResistance={handleCreateResistance}
            onDeleteResistance={handleDeleteResistance}
          />
        )}
      </div>
    </div>
  )
}
