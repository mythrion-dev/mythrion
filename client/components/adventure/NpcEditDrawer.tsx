'use client'

import { useState, useEffect, useCallback } from 'react'
import { api, API_URL, authFetch } from '@/lib/api'
import { Select } from '@/components/shared/Select'

/* ── Types ── */

interface TemplateAttribute {
  id: string; key: string; name: string
}

interface ArmorClassFieldDef {
  id: string; name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string | null
}
interface ArmorClassAttributeModifierDef {
  id: string; attributeId: string; allowPlayerSelection: boolean; defaultAttributeId: string | null
  attribute: { id: string; key: string; name: string }
  defaultAttribute: { id: string; key: string; name: string } | null
}
interface ArmorClassDef {
  id: string; name?: string; enabled: boolean
  fields: ArmorClassFieldDef[]
  attributeModifiers: ArmorClassAttributeModifierDef[]
}

interface TemplateSkillDef {
  id: string; name: string; description: string | null; attributeId: string | null
  allowedAttributeIds: string[]; defaultAttributeId: string | null
  attribute: { id: string; key: string; name: string } | null
  defaultAttribute: { id: string; key: string; name: string } | null
}

interface ProfileOption { id: string; label: string; value: number }
interface SkillModifierProfileDef { id: string; name: string; options: ProfileOption[]; targetMode?: string; targetSkillIds?: string[] }

interface ResistanceComponentDef {
  id: string; name: string; editableByPlayer: boolean; defaultValue: string; order: number
}
interface ResistanceAttributeModifierDef {
  id: string; attributeId: string; enabled: boolean
  attribute: { id: string; key: string; name: string }
}
interface TemplateResistanceDef {
  id: string; name: string; calculationType: string; order: number
  components: ResistanceComponentDef[]
  attributeModifiers: ResistanceAttributeModifierDef[]
}

interface CoreResourceDef {
  id: string; slug: string; displayName: string; enabled: boolean
  editableByPlayer: boolean; showNotes: boolean
}

interface SkillValueData {
  id: string; skillId: string; value: string; selectedAttributeId: string | null
  selectedAttribute: { id: string; key: string; name: string } | null
  skill: TemplateSkillDef
  profileValues?: SkillProfileValueData[]
}
interface SkillProfileValueData {
  id: string; profileId: string; optionId: string | null
  profile: { id: string; name: string; targetMode?: string; targetSkillIds?: string[] }
  option: { id: string; label: string; value: number } | null
}

interface CoreResourceValueData {
  id: string; coreResourceId: string; current: number | null; maximum: number | null; notes: string | null
}

interface FullSheet {
  id: string; characterName: string; playerName: string | null; level: number | null
  hpActual: number | null; hpMax: number | null; hpNotes: string | null; npcType: string | null
  description: string | null; notes: string | null
  template: {
    id: string; name: string
    attributeModifierFormula?: string | null
    attributeModifiersEnabled?: boolean
    skillFormula?: string | null
    attributes: TemplateAttribute[]
    templateSkills?: TemplateSkillDef[]
    skillModifierProfiles: SkillModifierProfileDef[]
    armorClasses: ArmorClassDef[]
    resistances?: TemplateResistanceDef[]
    coreResources?: CoreResourceDef[]
  }
  values: { id: string; attributeId: string; value: string }[]
  acValues: { id: string; fieldId: string; value: string }[]
  acAttributeValues: { id: string; acAttributeModifierId: string; selectedAttributeId: string | null }[]
  skillValues: SkillValueData[]
  skillProfileValues: SkillProfileValueData[]
  coreResourceValues?: CoreResourceValueData[]
}

/* ── Module-scope helpers ── */

const SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e']

function buildCoreResourceMaps(coreResourceValues: CoreResourceValueData[] | undefined): {
  crCurrent: Record<string, number | null>
  crMax: Record<string, number | null>
  crNotes: Record<string, string>
} {
  const crCurrent: Record<string, number | null> = {}
  const crMax: Record<string, number | null> = {}
  const crNotes: Record<string, string> = {}
  for (const crv of coreResourceValues ?? []) {
    crCurrent[crv.coreResourceId] = crv.current
    crMax[crv.coreResourceId] = crv.maximum
    crNotes[crv.coreResourceId] = crv.notes ?? ''
  }
  return { crCurrent, crMax, crNotes }
}

function buildAttrValues(values: FullSheet['values']): Record<string, string> {
  const av: Record<string, string> = {}
  for (const v of values) av[v.attributeId] = v.value
  return av
}

function buildAcFieldValues(acValues: FullSheet['acValues']): Record<string, string> {
  const fv: Record<string, string> = {}
  for (const acv of acValues) fv[acv.fieldId] = acv.value
  return fv
}

function buildAcModifierSelections(acAttributeValues: FullSheet['acAttributeValues']): Record<string, string | null> {
  const ams: Record<string, string | null> = {}
  for (const am of acAttributeValues) ams[am.acAttributeModifierId] = am.selectedAttributeId
  return ams
}

function buildSkillProfileSelections(
  skillValues: SkillValueData[],
  profiles: SkillModifierProfileDef[] | undefined,
): Record<string, Record<string, string | null>> {
  const sps: Record<string, Record<string, string | null>> = {}
  for (const sv of skillValues) {
    sps[sv.skillId] = {}
    for (const pv of sv.profileValues ?? []) {
      sps[sv.skillId][pv.profileId] = pv.optionId
    }
    for (const profile of profiles ?? []) {
      if (!(profile.id in sps[sv.skillId]) && profile.options.length > 0) {
        let lowest = profile.options[0]
        for (let i = 1; i < profile.options.length; i++) {
          if (profile.options[i].value <= lowest.value) lowest = profile.options[i]
        }
        sps[sv.skillId][profile.id] = lowest.id
      }
    }
  }
  return sps
}

function buildSkillAttributeSelections(skillValues: SkillValueData[]): Record<string, string | null> {
  const sas: Record<string, string | null> = {}
  for (const sv of skillValues) {
    sas[sv.skillId] = sv.selectedAttributeId
  }
  return sas
}

function buildModifierVars(
  attrs: Record<string, string>,
  attributes: TemplateAttribute[],
  valueAttrId: string,
): Record<string, number> {
  const vars: Record<string, number> = {}
  for (const a of attributes) {
    const v = Number.parseFloat(attrs[a.id] ?? '0')
    vars[a.key] = Number.isNaN(v) ? 0 : v
  }
  vars['value'] = Number.parseFloat(attrs[valueAttrId] ?? '0') || 0
  return vars
}

async function buildModifierVarsWithFormula(tpl: FullSheet['template'], attrs: Record<string, string>): Promise<Record<string, number>> {
  const modifierVars: Record<string, number> = {}
  const globalFormula = tpl.attributeModifierFormula
  const modifiersEnabled = (tpl as any).attributeModifiersEnabled !== false
  if (modifiersEnabled && globalFormula?.trim()) {
    for (const attr of tpl.attributes) {
      try {
        const modVars = buildModifierVars(attrs, tpl.attributes, attr.id)
        const mr = await api.post<{ result: number }>('/formula/evaluate', { formula: globalFormula, variables: modVars })
        modifierVars[`${attr.key}_mod`] = mr.result
      } catch { modifierVars[`${attr.key}_mod`] = 0 }
    }
  }
  return modifierVars
}

function parseSkillConfig(skillFormulaRaw: string): { useAttributeModifier?: boolean; customFieldKeys?: string[] } | null {
  try {
    const parsed = JSON.parse(skillFormulaRaw)
    if (parsed && typeof parsed === 'object' && typeof parsed.useAttributeModifier === 'boolean') {
      return parsed
    }
  } catch { /* not JSON */ }
  return null
}

function putIfNonEmpty(payload: Record<string, any>, key: string, arr: unknown[]) {
  if (arr.length > 0) payload[key] = arr
}

function buildSkillProfilePayload(
  sheet: FullSheet,
  skillProfileSelections: Record<string, Record<string, string | null>>,
): Array<{ skillId: string; profileId: string; optionId: string | null }> {
  const skillProfileValues: Array<{ skillId: string; profileId: string; optionId: string | null }> = []
  for (const sv of sheet.skillValues) {
    const profiles = skillProfileSelections[sv.skillId] ?? {}
    for (const pid of Object.keys(profiles)) {
      skillProfileValues.push({ skillId: sv.skillId, profileId: pid, optionId: profiles[pid] })
    }
  }
  return skillProfileValues
}

function buildAcValues(
  tpl: FullSheet['template'],
  acFieldValues: Record<string, string>,
): Array<{ fieldId: string; value: string }> {
  return tpl.armorClasses
    .filter(ac => ac.enabled)
    .flatMap(ac => ac.fields.map(f => ({
      fieldId: f.id,
      value: acFieldValues[f.id] ?? f.defaultValue,
    })))
}

function buildAcAttributeValues(
  tpl: FullSheet['template'],
  acModifierSelections: Record<string, string | null>,
): Array<{ acAttributeModifierId: string; selectedAttributeId: string | null }> {
  return tpl.armorClasses
    .filter(ac => ac.enabled)
    .flatMap(ac => ac.attributeModifiers.map(am => ({
      acAttributeModifierId: am.id,
      selectedAttributeId: acModifierSelections[am.id] ?? null,
    })))
}

async function computeSkillResult(
  sv: SkillValueData,
  tpl: FullSheet['template'],
  attrs: Record<string, string>,
  skillFormulaRaw: string,
  skillConfig: { useAttributeModifier?: boolean; customFieldKeys?: string[] } | null,
  modifierVars: Record<string, number>,
  sps: Record<string, Record<string, string | null>>,
  skillAttributeSelections: Record<string, string | null>,
  level: number | null,
): Promise<number> {
  let finalResult = 0
  if (skillConfig) {
    if (skillConfig.useAttributeModifier) {
      const selectedAttr = skillAttributeSelections[sv.skillId] ?? sv.skill.defaultAttributeId ?? sv.skill.attributeId
      const key = tpl.attributes.find(a => a.id === selectedAttr)?.key
      if (key) finalResult += modifierVars[`${key}_mod`] ?? 0
    }
  } else {
    const selectedAttrId = skillAttributeSelections[sv.skillId] ?? sv.skill.defaultAttributeId ?? sv.skill.attributeId
    const selectedAttr = tpl.attributes.find(a => a.id === selectedAttrId)
    const skillAttrValue = selectedAttr ? Number.parseFloat(attrs[selectedAttr.id] ?? '0') : 0
    const variables: Record<string, number> = { ...modifierVars }
    variables['value'] = Number.isNaN(skillAttrValue) ? 0 : skillAttrValue
    if (selectedAttr) variables['value_mod'] = modifierVars[`${selectedAttr.key}_mod`] ?? 0
    for (const a of tpl.attributes) {
      const v = Number.parseFloat(attrs[a.id] ?? '0')
      variables[a.key] = Number.isNaN(v) ? 0 : v
    }
    variables['level'] = level ?? 1
    const res = await api.post<{ result: number }>('/formula/evaluate', { formula: skillFormulaRaw, variables })
    finalResult = res.result
  }

  const skillSps = sps[sv.skillId] ?? {}
  for (const profile of tpl.skillModifierProfiles ?? []) {
    const optId = skillSps[profile.id]
    const option = profile.options.find(o => o.id === optId)
    if (option) finalResult += option.value
  }
  return finalResult
}

/* ── Props ── */

interface NpcEditDrawerProps {
  readonly npcId: string
  readonly adventureId: string
  readonly onClose: () => void
  readonly onSaved: () => void
}

/* ── Component ── */

export function NpcEditDrawer({ npcId, adventureId, onClose, onSaved }: NpcEditDrawerProps) {
  const [sheet, setSheet] = useState<FullSheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* Editable fields */
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [level, setLevel] = useState<number | null>(null)

  /* Core resource values: coreResourceId → { current, maximum, notes } */
  const [coreResourceCurrent, setCoreResourceCurrent] = useState<Record<string, number | null>>({})
  const [coreResourceMax, setCoreResourceMax] = useState<Record<string, number | null>>({})
  const [coreResourceNotes, setCoreResourceNotes] = useState<Record<string, string>>({})

  /* Attribute values: attributeId → string value */
  const [attrValues, setAttrValues] = useState<Record<string, string>>({})
  /* AC field values: fieldId → string value */
  const [acFieldValues, setAcFieldValues] = useState<Record<string, string>>({})
  /* AC attribute modifier selections: acAttributeModifierId → selectedAttributeId */
  const [acModifierSelections, setAcModifierSelections] = useState<Record<string, string | null>>({})
  /* Skill profile selections: skillId + profileId → optionId */
  const [skillProfileSelections, setSkillProfileSelections] = useState<Record<string, Record<string, string | null>>>({})
  /* Skill attribute selections: skillId → attributeId */
  const [skillAttributeSelections, setSkillAttributeSelections] = useState<Record<string, string | null>>({})

  /* Computed results */
  const [modifierResults, setModifierResults] = useState<Record<string, number | null>>({})
  const [acTotals, setAcTotals] = useState<Record<string, { total: number; name: string }>>({})
  const [skillTotals, setSkillTotals] = useState<Record<string, number | null>>({})
  const [resistanceData, setResistanceData] = useState<Array<{
    resistanceId: string; name: string; calculationType: string; total: number
    componentValues: Array<{ componentId: string; componentName: string; value: number; editableByPlayer: boolean }>
    attributeModifierValues: Array<{ attributeId: string; attributeKey: string; enabled: boolean; rawModifier: number; effectiveModifier: number }>
  }>>([])
  /* Avatar */
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  /* ── Derived: enabled core resources ── */
  const enabledCoreResources = (sheet?.template.coreResources ?? []).filter(cr => cr.enabled)

  /* ── Sheet + Template fetching ── */
  const fetchSheet = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<FullSheet>(`/character-sheets/${npcId}`)
      setSheet(data)
      setName(data.characterName)
      setDescription(data.playerName ?? '')
      setNotes(data.notes ?? '')
      setLevel(data.level)

      // Derived maps from fetched data
      const { crCurrent, crMax, crNotes } = buildCoreResourceMaps(data.coreResourceValues)
      setCoreResourceCurrent(crCurrent)
      setCoreResourceMax(crMax)
      setCoreResourceNotes(crNotes)

      const av = buildAttrValues(data.values)
      setAttrValues(av)

      setAcFieldValues(buildAcFieldValues(data.acValues))
      setAcModifierSelections(buildAcModifierSelections(data.acAttributeValues))
      setSkillProfileSelections(buildSkillProfileSelections(data.skillValues, data.template.skillModifierProfiles))
      setSkillAttributeSelections(buildSkillAttributeSelections(data.skillValues))

      // Initial computations
      if (data.template) {
        computeModifiers(data.template, av)
        fetchResistances(npcId)
      }

      // Check if avatar exists (cache-bust to avoid stale 204s)
      try {
        const avatarRes = await authFetch(`${API_URL}/images/character-sheets/${npcId}/avatar?t=${Date.now()}`, { method: 'HEAD', cache: 'no-store' })
        if (avatarRes.ok && avatarRes.status !== 204) setAvatarUrl(`${API_URL}/images/character-sheets/${npcId}/avatar?t=${Date.now()}`)
      } catch { /* no avatar */ }
    } catch {
      setError('Failed to load NPC sheet')
    } finally {
      setLoading(false)
    }
  }, [npcId])

  useEffect(() => { fetchSheet() }, [fetchSheet])

  /* ── Formula computation ── */
  const computeModifiers = useCallback(async (tpl: FullSheet['template'], attrs: Record<string, string>) => {
    const results: Record<string, number | null> = {}
    const formula = tpl.attributeModifierFormula
    const modifiersEnabled = (tpl as any).attributeModifiersEnabled !== false
    if (!modifiersEnabled || !formula?.trim()) { setModifierResults(results); return results }

    for (const attr of tpl.attributes) {
      try {
        const vars = buildModifierVars(attrs, tpl.attributes, attr.id)
        const res = await api.post<{ result: number }>('/formula/evaluate', { formula, variables: vars })
        results[attr.id] = res.result
      } catch { results[attr.id] = null }
    }
    setModifierResults(results)
    return results
  }, [])

  const computeAC = useCallback((tpl: FullSheet['template'], acFields: Record<string, string>, mods: Record<string, number | null>) => {
    const acs = tpl.armorClasses?.filter(ac => ac.enabled) ?? []
    if (acs.length === 0) { setAcTotals({}); return }
    const totals: Record<string, { total: number; name: string }> = {}
    for (const ac of acs) {
      let total = 0
      ac.fields.forEach(f => {
        const v = Number.parseFloat(acFields[f.id] ?? f.defaultValue)
        if (!Number.isNaN(v)) total += v
      })
      for (const am of ac.attributeModifiers) {
        const effectiveAttributeId = am.allowPlayerSelection
          ? (acModifierSelections[am.id] ?? am.defaultAttributeId ?? am.attributeId)
          : am.attributeId
        const modResult = mods[effectiveAttributeId]
        if (modResult !== null && modResult !== undefined && !Number.isNaN(modResult)) {
          total += Math.max(0, modResult)
        }
      }
      totals[ac.id] = { total, name: ac.name ?? 'Armor Class' }
    }
    setAcTotals(totals)
  }, [acModifierSelections])

  const computeSkills = useCallback(async (tpl: FullSheet['template'], attrs: Record<string, string>, skillVals: SkillValueData[], sps: Record<string, Record<string, string | null>>) => {
    const results: Record<string, number | null> = {}
    const skillFormulaRaw = tpl.skillFormula
    if (!skillFormulaRaw?.trim()) { setSkillTotals(results); return }

    const modifierVars = await buildModifierVarsWithFormula(tpl, attrs)
    const skillConfig = parseSkillConfig(skillFormulaRaw)

    for (const sv of skillVals) {
      try {
        results[sv.id] = await computeSkillResult(sv, tpl, attrs, skillFormulaRaw, skillConfig, modifierVars, sps, skillAttributeSelections, level)
      } catch { results[sv.id] = null }
    }
    setSkillTotals(results)
  }, [skillAttributeSelections, level])

  // Re-compute when values change
  useEffect(() => {
    if (!sheet?.template) return
    computeModifiers(sheet.template, attrValues).then(mods => {
      if (mods) {
        computeAC(sheet.template, acFieldValues, mods)
        computeSkills(sheet.template, attrValues, sheet.skillValues, skillProfileSelections)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attrValues, acFieldValues, skillProfileSelections, sheet])

  /* ── Resistance fetching ── */
  const fetchResistances = useCallback(async (sid: string) => {
    try {
      const data = await api.get<Array<any>>(`/character-sheets/${sid}/resistances`)
      setResistanceData(data)
    } catch { /* no resistances yet */ }
  }, [])

  /* ── Avatar handlers ── */
  async function handleAvatarUpload(file: File) {
    setAvatarUploading(true)
    const formData = new FormData()
    formData.append('avatar', file)
    try {
      const res = await authFetch(`${API_URL}/images/character-sheets/${npcId}/avatar`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        setAvatarUrl(`${API_URL}/images/character-sheets/${npcId}/avatar?t=${Date.now()}`)
      }
    } catch { /* silently fail */ }
    setAvatarUploading(false)
  }

  /* ── Deep-input handlers (hoisted to reduce nesting) ── */
  const handleAcFieldChange = useCallback((fieldId: string, value: string) => {
    setAcFieldValues(prev => ({ ...prev, [fieldId]: value }))
  }, [])

  const handleAcModifierSelect = useCallback((modifierId: string, id: string | null) => {
    setAcModifierSelections(prev => ({ ...prev, [modifierId]: id }))
  }, [])

  const handleProfileSelect = useCallback((skillId: string, profileId: string, id: string | null) => {
    setSkillProfileSelections(prev => ({
      ...prev,
      [skillId]: { ...prev[skillId], [profileId]: id },
    }))
  }, [])

  /* ── Save handler ── */
  async function handleSave() {
    if (!sheet) return
    setSaving(true)
    setError(null)
    try {
      // Prepare update DTO
      const payload: Record<string, any> = {}

      if (name !== sheet.characterName) payload.characterName = name
      if (level !== sheet.level) payload.level = level
      if (description !== (sheet.playerName ?? '')) payload.playerName = description

      // Core resource values
      if (enabledCoreResources.length > 0) {
        payload.coreResourceValues = enabledCoreResources.map(cr => ({
          coreResourceId: cr.id,
          current: coreResourceCurrent[cr.id] ?? null,
          maximum: coreResourceMax[cr.id] ?? null,
          notes: coreResourceNotes[cr.id] ?? '',
        }))
      }

      // Attribute values
      const values = sheet.template.attributes.map(attr => ({
        attributeId: attr.id,
        value: attrValues[attr.id] ?? '0',
      }))
      payload.values = values

      // Skill values
      const skillValues = sheet.skillValues.map(sv => ({
        skillId: sv.skillId,
        value: sv.value,
        selectedAttributeId: skillAttributeSelections[sv.skillId] ?? sv.selectedAttributeId,
      }))
      payload.skillValues = skillValues

      // Skill profile values
      putIfNonEmpty(payload, 'skillProfileValues', buildSkillProfilePayload(sheet, skillProfileSelections))

      // AC field values
      putIfNonEmpty(payload, 'acValues', buildAcValues(sheet.template, acFieldValues))

      // AC attribute modifier selections
      putIfNonEmpty(payload, 'acAttributeValues', buildAcAttributeValues(sheet.template, acModifierSelections))

      await api.patch(`/character-sheets/${npcId}`, payload)
      onSaved()
    } catch {
      setError('Failed to save NPC')
    } finally {
      setSaving(false)
    }
  }

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="skeleton h-5 w-32" />
        </div>
        {SKELETON_KEYS.map(k => (
          <div key={k} className="space-y-2">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  /* ── Error state ── */
  if (error || !sheet) {
    return (
      <div className="p-4 space-y-4">
        <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center text-2xl mb-3">⚠️</div>
          <p className="text-sm text-muted-foreground mb-3">{error ?? 'Failed to load NPC sheet'}</p>
          <button onClick={fetchSheet} className="btn-primary !py-1.5 !text-xs">Retry</button>
        </div>
      </div>
    )
  }

  const tpl = sheet.template
  const npcType = sheet.npcType ?? 'NPC'
  const enabledACs = tpl.armorClasses.filter(ac => ac.enabled)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <button
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
          aria-label="Back to list"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-foreground truncate flex-1">
          Editing: {name || 'Unnamed'}
        </h3>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
          npcType === 'MOB'
            ? 'bg-red-500/10 text-red-500 border border-red-500/20'
            : 'bg-accent/10 text-accent border border-accent/20'
        }`}>
          {npcType}
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {/* ── Basic Info ── */}
        <section className="px-4 py-4 space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Basic Info</h4>

          {/* Avatar + name row */}
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-surface border border-border">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <label className={`absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 cursor-pointer transition-opacity ${avatarUploading ? 'opacity-100 pointer-events-none' : ''}`}>
                {avatarUploading ? (
                  <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                <input type="file" accept="image/*" className="hidden" disabled={avatarUploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f) }} />
              </label>
            </div>

            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Name"
                className="input-field"
              />
            </div>
          </div>

          {/* Level */}
          <div>
            <label htmlFor="npc-level" className="label">Level</label>
            <input
              id="npc-level"
              type="number"
              min={1}
              value={level ?? ''}
              onChange={e => setLevel(e.target.value ? Number.parseInt(e.target.value) : null)}
              className="input-field"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="npc-description" className="label">Description</label>
            <textarea
              id="npc-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description..."
              className="input-field resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="npc-notes" className="label">Notes</label>
            <textarea
              id="npc-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="GM notes..."
              className="input-field resize-none"
            />
          </div>
        </section>

        {/* ── Resources (from template core resources) ── */}
        {enabledCoreResources.length > 0 && (
          <section className="px-4 py-4 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resources</h4>
            {enabledCoreResources.map(cr => (
              <div key={cr.id} className="card !p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{cr.displayName}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`npc-current-${cr.id}`} className="label">Current</label>
                    <input
                      id={`npc-current-${cr.id}`}
                      type="number"
                      min={0}
                      value={coreResourceCurrent[cr.id] ?? ''}
                      onChange={e => setCoreResourceCurrent(prev => ({ ...prev, [cr.id]: e.target.value ? Number.parseInt(e.target.value) : null }))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor={`npc-max-${cr.id}`} className="label">Maximum</label>
                    <input
                      id={`npc-max-${cr.id}`}
                      type="number"
                      min={0}
                      value={coreResourceMax[cr.id] ?? ''}
                      onChange={e => setCoreResourceMax(prev => ({ ...prev, [cr.id]: e.target.value ? Number.parseInt(e.target.value) : null }))}
                      className="input-field"
                    />
                  </div>
                </div>
                {cr.showNotes && (
                  <div>
                    <label htmlFor={`npc-cr-notes-${cr.id}`} className="label">Notes</label>
                    <input
                      id={`npc-cr-notes-${cr.id}`}
                      type="text"
                      value={coreResourceNotes[cr.id] ?? ''}
                      onChange={e => setCoreResourceNotes(prev => ({ ...prev, [cr.id]: e.target.value }))}
                      placeholder={`${cr.displayName} notes...`}
                      className="input-field"
                    />
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* ── Attributes ── */}
        {tpl.attributes.length > 0 && (
          <section className="px-4 py-4 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Attributes
              {tpl.attributeModifierFormula?.trim() && (
                <span className="ml-2 text-[10px] font-normal text-muted-foreground/60">(modifiers auto-computed)</span>
              )}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {tpl.attributes.map(attr => {
                const mod = modifierResults[attr.id]
                let modClass = 'text-muted-foreground'
                let modLabel: string | number = '?'
                if (mod !== null) {
                  if (mod >= 0) {
                    modClass = 'text-green-500'
                    modLabel = `+${mod}`
                  } else {
                    modClass = 'text-red-400'
                    modLabel = mod
                  }
                }
                return (
                  <div key={attr.id} className="card !p-3 space-y-1.5">
                    <label htmlFor={`attribute-value-${attr.id}`} className="block text-xs font-medium text-foreground">{attr.name}</label>
                    <input
                      type="text"
                      id={`attribute-value-${attr.id}`}
                      value={attrValues[attr.id] ?? ''}
                      onChange={e => setAttrValues(prev => ({ ...prev, [attr.id]: e.target.value }))}
                      placeholder="0"
                      className="input-field"
                    />
                    {mod !== undefined && (
                      <span className={`text-xs font-medium ${modClass}`}>
                        Mod: {modLabel}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Armor Class ── */}
        {enabledACs.length > 0 && (
          <section className="px-4 py-4 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Armor Class</h4>
            {enabledACs.map(ac => {
              const total = acTotals[ac.id]
              return (
                <div key={ac.id} className="card !p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{ac.name ?? 'Armor Class'}</span>
                    {total && (
                      <span className="text-sm font-bold text-accent">Total: {total.total}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {ac.fields.map(f => (
                      <div key={f.id}>
                        <label htmlFor={`ac-field-${f.id}`} className="label">{f.name}</label>
                        <input
                          type="text"
                          id={`ac-field-${f.id}`}
                          value={acFieldValues[f.id] ?? f.defaultValue}
                          onChange={e => handleAcFieldChange(f.id, e.target.value)}
                          className="input-field"
                        />
                      </div>
                    ))}
                  </div>
                  {ac.attributeModifiers.length > 0 && (
                    <div className="text-[10px] text-muted-foreground">
                      {ac.attributeModifiers.map(am => {
                        const selectedId = acModifierSelections[am.id] ?? am.defaultAttributeId ?? am.attributeId
                        const rawMod = modifierResults[am.attributeId]
                        let attrModPrefix = ''
                        let attrModLabel: string | number = '?'
                        if (rawMod !== undefined) {
                          attrModPrefix = (rawMod ?? 0) >= 0 ? '+' : ''
                          attrModLabel = rawMod ?? '?'
                        }
                        return (
                          <div key={am.id} className="flex items-center justify-between mt-1">
                            <span>{am.attribute.name} mod:</span>
                            {am.allowPlayerSelection ? (
                              <Select
                                options={tpl.attributes.map(a => ({ id: a.id, label: a.name }))}
                                value={selectedId ?? ''}
                                onChange={val => handleAcModifierSelect(am.id, val || null)}
                                disabled={!am.allowPlayerSelection}
                                size="sm"
                                className="min-w-[90px] text-xs"
                              />
                            ) : (
                              <span className="font-medium">{attrModPrefix}{attrModLabel}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        )}

        {/* ── Resistances ── */}
        {(tpl.resistances?.length ?? 0) > 0 && (
          <section className="px-4 py-4 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resistances</h4>
            {resistanceData.length === 0 ? (
              <p className="text-xs text-muted-foreground">Loading resistances...</p>
            ) : (
              resistanceData.map(r => (
                <div key={r.resistanceId} className="flex items-center justify-between card !p-3">
                  <span className="text-xs font-medium text-foreground">{r.name}</span>
                  <span className={`text-sm font-semibold ${
                    r.total >= 0 ? 'text-green-500' : 'text-red-400'
                  }`}>
                    {r.total >= 0 ? '+' : ''}{r.total}
                  </span>
                </div>
              ))
            )}
          </section>
        )}

        {/* ── Skills ── */}
        {(tpl.templateSkills?.length ?? 0) > 0 && (
          <section className="px-4 py-4 space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Skills</h4>
            {sheet.skillValues.length === 0 ? (
              <p className="text-xs text-muted-foreground">No skills for this template.</p>
            ) : (
              <div className="space-y-2">
                {sheet.skillValues.map(sv => {
                  const total = skillTotals[sv.id]
                  const skill = sv.skill
                  const hasProfile = tpl.skillModifierProfiles?.length > 0
                  const hasAttributeChoice = skill.allowedAttributeIds?.length > 1
                  let totalClass = 'text-muted-foreground'
                  let totalLabel: string | number | null | undefined = '?'
                  if (total !== null && total !== undefined) {
                    totalClass = total >= 0 ? 'text-green-500' : 'text-red-400'
                    totalLabel = total >= 0 ? `+${total}` : total
                  }
                  return (
                    <div key={sv.id} className="card !p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">{skill.name}</span>
                        <span className={`text-xs font-semibold ${totalClass}`}>
                          {totalLabel}
                        </span>
                      </div>

                      {/* Attribute selection (if multiple allowed) */}
                      {hasAttributeChoice && (
                        <div className="flex items-center gap-2">
                          <label htmlFor={`attribute-select-${sv.skillId}`} className="text-[10px] text-muted-foreground shrink-0">Attribute:</label>
                          <Select
                            id={`attribute-select-${sv.skillId}`}
                            options={skill.allowedAttributeIds.map(aid => {
                              const a = tpl.attributes.find(a => a.id === aid)
                              return a ? { id: a.id, label: a.name } : null
                            }).filter(Boolean) as { id: string; label: string }[]}
                            value={skillAttributeSelections[sv.skillId] ?? skill.defaultAttributeId ?? skill.attributeId ?? ''}
                            onChange={val => setSkillAttributeSelections(prev => ({ ...prev, [sv.skillId]: val || null }))}
                            disabled={!skill.allowedAttributeIds.length}
                            size="sm"
                            className="min-w-[90px] text-xs"
                          />
                        </div>
                      )}

                      {/* Profile selections */}
                      {hasProfile && tpl.skillModifierProfiles.map(profile => {
                        const currentOpt = skillProfileSelections[sv.skillId]?.[profile.id] ?? null
                        return (
                          <div key={profile.id} className="flex items-center gap-2">
                            <label htmlFor={`profile-select-${sv.skillId}-${profile.id}`} className="text-[10px] text-muted-foreground shrink-0">{profile.name}:</label>
                            <Select
                              id={`profile-select-${sv.skillId}-${profile.id}`}
                              options={profile.options}
                              value={currentOpt}
                              onChange={(id) => handleProfileSelect(sv.skillId, profile.id, id)}
                              showBadge
                              size="sm"
                              className="flex-1"
                            />
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Footer with save/back buttons */}
      <div className="px-4 py-3 border-t border-border shrink-0 flex items-center gap-2">
        <button
          onClick={onClose}
          className="flex-1 btn-ghost !py-2 !text-xs"
        >
          Back to List
        </button>
        <button
          onClick={() => window.open(`/dashboard/character-sheets/${npcId}`, '_blank')}
          className="btn-ghost !py-2 !text-xs"
          title="Open full sheet in new tab"
        >
          <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Full Sheet
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 btn-primary !py-2 !text-xs"
        >
          {saving ? (
            <span className="flex items-center gap-1.5 justify-center">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 justify-center">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Save
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
