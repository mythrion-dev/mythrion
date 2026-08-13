'use client'

import { useState, useEffect, useCallback, useRef, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { api, API_URL, authFetch } from '@/lib/api'
import { InlineText, InlineNumber } from '@/lib/inline-editable'
import { StoryTab, CharacterTab, InventoryTab, PersonalAbilitiesTab, AbilitiesTab, ResistanceTab } from '@/components/character-sheet'
import { PageNav } from '@/lib/breadcrumb'
import { PdfViewerSidebar } from '@/components/books/PdfViewerSidebar'
import { NotebookSidebar } from '@/components/notebook/NotebookSidebar'
import type { SkillModifierProfile, ArmorClassAttributeModifierDef, SectionEntry, SummonSkillData, SummonResistanceData, Ability, AbilityLevel, InventoryItem, Story, CharacterSheet, AcResultMap, SheetPermissions } from '@/components/character-sheet/types'
import {
  computeModifiers as engineComputeModifiers,
  computeSkills as engineComputeSkills,
  computeAC as engineComputeAC,
  computeSummonModifiers as engineComputeSummonModifiers,
  computeSummonAC as engineComputeSummonAC,
  type FormulaEvaluator,
} from '@/lib/character-sheet-engine'


// ── Module-scope helpers (extracted to reduce function nesting / cognitive complexity) ──

function toSingular(name: string) {
  if (name.endsWith('ies')) { return name.slice(0, -3) + 'y' }
  if (name.endsWith('s') && !name.endsWith('ss') && !name.endsWith('us')) { return name.slice(0, -1) }
  return name
}

function buildProfileSelections(d: CharacterSheet): Record<string, Record<string, string | null>> {
  const selMap: Record<string, Record<string, string | null>> = {}
  d.skillProfileValues.forEach(spv => {
    if (!selMap[spv.skillId]) { selMap[spv.skillId] = {} }
    selMap[spv.skillId][spv.profileId] = spv.optionId
  })
  const skillModifierProfiles = d.template?.skillModifierProfiles || []
  for (const sv of d.skillValues) {
    if (!selMap[sv.skillId]) selMap[sv.skillId] = {}
    for (const profile of skillModifierProfiles) {
      const targetMode = (profile as any).targetMode ?? 'ALL_SKILLS'
      const targetSkillIds: string[] = (profile as any).targetSkillIds ?? []
      if (targetMode === 'SELECTED_SKILLS' && targetSkillIds.length > 0 && !targetSkillIds.includes(sv.skill.name)) continue
      if (selMap[sv.skillId][profile.id] === undefined && profile.options.length > 0) {
        const lowest = profile.options.reduce((a, b) => a.value <= b.value ? a : b, profile.options[0])
        selMap[sv.skillId][profile.id] = lowest.id
      }
    }
  }
  return selMap
}

async function createInitialLevel(sheet: CharacterSheet, ability: Ability, levelValue: string): Promise<void> {
  if (ability.levels?.length) {
    await api.patch(`/character-sheets/${sheet.id}/abilities/${ability.id}/levels/${ability.levels[0].id}`, { level: levelValue })
    ability.levels[0].level = levelValue
  } else {
    const nl = await api.post<AbilityLevel>(`/character-sheets/${sheet.id}/abilities/${ability.id}/levels`, { level: levelValue, copyFromPrevious: false })
    ability.levels = [nl]
  }
}

function applySkillAttributeSelection(prev: CharacterSheet, skillId: string, attributeId: string | null): CharacterSheet {
  return { ...prev, skillValues: prev.skillValues.map(sv => sv.skillId === skillId ? { ...sv, selectedAttributeId: attributeId, selectedAttribute: attributeId ? { id: attributeId, key: prev.template.attributes.find(a => a.id === attributeId)?.key ?? '', name: prev.template.attributes.find(a => a.id === attributeId)?.name ?? '' } : null } : sv) }
}

function updateAbilityLevel(abilities: Ability[], levelId: string, body: Record<string, unknown>): Ability[] {
  return abilities.map(a => ({ ...a, levels: a.levels.map(l => l.id === levelId ? { ...l, ...body } : l) }))
}

function updateSummonAttribute(abilities: Ability[], abilityId: string, attributeId: string, value: string): Ability[] {
  return abilities.map(a => a.id === abilityId ? { ...a, summonAttributes: a.summonAttributes.map(sa => sa.attributeId === attributeId ? { ...sa, value } : sa) } : a)
}

function updateSummonSkill(abilities: Ability[], abilityId: string, summonSkillId: string, name: string, manualValue: number): Ability[] {
  return abilities.map(a => a.id === abilityId ? { ...a, summonSkills: (a.summonSkills ?? []).map(s => s.id === summonSkillId ? { ...s, name, manualValue } : s) } : a)
}

function removeSummonSkill(abilities: Ability[], abilityId: string, summonSkillId: string): Ability[] {
  return abilities.map(a => a.id === abilityId ? { ...a, summonSkills: (a.summonSkills ?? []).filter(s => s.id !== summonSkillId) } : a)
}

function updateSummonResistance(abilities: Ability[], abilityId: string, summonResistanceId: string, name: string, value: string): Ability[] {
  return abilities.map(a => a.id === abilityId ? { ...a, summonResistances: (a.summonResistances ?? []).map(r => r.id === summonResistanceId ? { ...r, name, value } : r) } : a)
}

function removeSummonResistance(abilities: Ability[], abilityId: string, summonResistanceId: string): Ability[] {
  return abilities.map(a => a.id === abilityId ? { ...a, summonResistances: (a.summonResistances ?? []).filter(r => r.id !== summonResistanceId) } : a)
}

function deleteAbility(abilities: Ability[], abilityId: string): Ability[] {
  return abilities.filter(a => a.id !== abilityId).map(a => ({ ...a, childAbilities: (a.childAbilities ?? []).filter(c => c.id !== abilityId) }))
}


// ── Module-scope presentational components (extracted to reduce per-function cognitive complexity) ──

function SheetAvatar(props: {
  avatarUrl: string | null
  isOwner: boolean
  readOnly: boolean
  avatarUploading: boolean
  onAvatarDelete: () => void
  onAvatarUpload: (file: File) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="shrink-0 w-full max-w-[10rem]">
      {props.avatarUrl ? (
        <div className="relative group aspect-square w-full">
          <img src={props.avatarUrl} alt={t('character:avatar')} className="w-full h-full rounded-xl object-cover border border-border" />
          {props.isOwner && (
            <button
              type="button"
              onClick={props.readOnly ? undefined : props.onAvatarDelete}
              disabled={props.readOnly}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title={props.readOnly ? t('campaign:readOnlyTooltip') : t('character:removeAvatar')}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      ) : (
        props.isOwner && (
          <label className={`aspect-square w-full max-w-[10rem] rounded-xl border-2 border-dashed border-border flex items-center justify-center transition-colors ${props.avatarUploading ? 'opacity-50 pointer-events-none' : ''} ${props.readOnly ? 'cursor-not-allowed' : 'cursor-pointer hover:border-primary/30'}`} title={props.readOnly ? t('campaign:readOnlyTooltip') : undefined}>
            {props.avatarUploading ? (
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : (
              <span className="text-2xl text-muted">+</span>
            )}
            <input type="file" accept="image/*" className="hidden" disabled={props.avatarUploading || props.readOnly} onChange={e=>{const f=e.target.files?.[0];if(f)props.onAvatarUpload(f)}}/>
          </label>
        )
      )}
    </div>
  )
}

function SheetInfo(props: {
  sheet: CharacterSheet
  isOwner: boolean
  readOnly: boolean
  onSaveCharacterName: (name: string) => Promise<void>
  onSavePlayerName: (name: string) => Promise<void>
  onSaveLevel: (level: number) => Promise<void>
}) {
  const { t } = useTranslation()
  const s = props.sheet
  return (
    <div className="flex-1 min-w-0 flex flex-col justify-between">
      <div>
        {props.isOwner ? (
          <InlineText value={s.characterName} onSave={props.onSaveCharacterName} maxLength={100} className="text-2xl font-bold text-gradient truncate block" disabled={props.readOnly} title={props.readOnly ? t('campaign:readOnlyTooltip') : undefined} />
        ) : (
          <h1 className="text-2xl font-bold text-gradient truncate">{s.characterName}</h1>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {props.isOwner ? (
            <>
              <span className="badge badge-gold inline-flex items-center gap-1">{t('character:playerLabel')}<InlineText value={s.playerName ?? ''} onSave={props.onSavePlayerName} maxLength={100} emptyDisplay="—" disabled={props.readOnly} title={props.readOnly ? t('campaign:readOnlyTooltip') : undefined} /></span>
              <span className="badge badge-gold inline-flex items-center gap-1">{t('character:levelField')}<InlineNumber value={s.level} onSave={props.onSaveLevel} min={1} disabled={props.readOnly} title={props.readOnly ? t('campaign:readOnlyTooltip') : undefined} /></span>
            </>
          ) : (
            <>
              {s.playerName && <span className="badge badge-gold">{t('character:playerLabel')}{s.playerName}</span>}
              {s.level && <span className="badge badge-gold">{t('character:levelField')}{s.level}</span>}
            </>
          )}
          {s.adventure && <span className="badge badge-gold">{s.adventure.campaign}</span>}
          <span className="badge badge-gold">{s.template.name}</span>
          {s.assignedMember && (
            <span className="badge badge-gold">
              {t('campaign:assignedTo', { name: s.assignedMember.user.displayName ?? s.assignedMember.user.email })}
            </span>
          )}
        </div>
        <p className="text-xs text-muted mt-1.5">
          {t('character:createdDate', { date: new Date(s.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) })}
        </p>
      </div>
      {s.adventure && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs text-muted uppercase tracking-wider">{t('character:adventureLabel')}</span>
          <span className="font-medium">{s.adventure.name}</span>
        </div>
      )}
    </div>
  )
}

function SheetActions(props: { readOnly: boolean; onRequestDelete: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3 justify-center shrink-0 sm:min-h-[170px]">
      <button onClick={props.readOnly ? undefined : props.onRequestDelete} disabled={props.readOnly} title={props.readOnly ? t('campaign:readOnlyTooltip') : undefined} className="btn-danger text-sm px-6 py-2.5 w-full sm:w-auto">
        <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>{t('common:delete')}
      </button>
    </div>
  )
}

function SheetHeaderCard(props: {
  sheet: CharacterSheet
  isOwner: boolean
  readOnly: boolean
  avatarUrl: string | null
  avatarUploading: boolean
  onAvatarDelete: () => void
  onAvatarUpload: (file: File) => void
  onSaveCharacterName: (name: string) => Promise<void>
  onSavePlayerName: (name: string) => Promise<void>
  onSaveLevel: (level: number) => Promise<void>
  onRequestDelete: () => void
}) {
  return (
    <div className="card !p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <SheetAvatar avatarUrl={props.avatarUrl} isOwner={props.isOwner} readOnly={props.readOnly} avatarUploading={props.avatarUploading} onAvatarDelete={props.onAvatarDelete} onAvatarUpload={props.onAvatarUpload} />
        <SheetInfo sheet={props.sheet} isOwner={props.isOwner} readOnly={props.readOnly} onSaveCharacterName={props.onSaveCharacterName} onSavePlayerName={props.onSavePlayerName} onSaveLevel={props.onSaveLevel} />
        {props.isOwner && <SheetActions readOnly={props.readOnly} onRequestDelete={props.onRequestDelete} />}
      </div>
    </div>
  )
}

function ReadOnlyBanner() {
  const { t } = useTranslation()
  return (
    <output className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">{t('campaign:readOnlyBadge')}</p>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">{t('campaign:readOnlyBanner')}</p>
        </div>
      </div>
    </output>
  )
}

function SheetTabNav(props: { activeTab: string; onTabChange: (tab: string) => void }) {
  const { t } = useTranslation()
  const tabClass = (tab: string) => `flex items-center gap-2 px-3 py-2 text-sm sm:px-5 sm:py-3 sm:text-base font-medium transition-colors border-b-2 ${props.activeTab === tab ? 'border-[#c9a84c] text-white' : 'border-transparent text-gray-400 hover:text-white'}`
  return (
    <nav className="flex gap-1 flex-wrap border-b border-border/60">
      <button onClick={() => props.onTabChange('character')} className={tabClass('character')}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>{t('character:tabCharacter')}</button>
      <button onClick={() => props.onTabChange('abilities')} className={tabClass('abilities')}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/><path strokeLinecap="round" strokeLinejoin="round" d="M8 2l.5 1.5L10 4l-1.5.5L8 6l-.5-1.5L6 4l1.5-.5L8 2z"/><path strokeLinecap="round" strokeLinejoin="round" d="M16 1l.3 1.2L18 3l-1.7.8L16 5l-.3-1.2L14 3l1.7-.8L16 1z"/></svg>{t('character:tabAbilities')}</button>
      <button onClick={() => props.onTabChange('inventory')} className={tabClass('inventory')}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6 10a2 2 0 012-2h8a2 2 0 012 2v7a2 2 0 01-2 2H8a2 2 0 01-2-2V10z"/><path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2"/><rect x="9" y="12" width="6" height="3" rx="1"/><path d="M6 11l-2 1"/><path d="M18 11l2 1"/><path d="M11 6v-1"/><path d="M13 6v-1"/><path d="M10.5 5h3"/></svg>{t('character:tabInventory')}</button>
      <button onClick={() => props.onTabChange('story')} className={tabClass('story')}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>{t('character:tabStory')}</button>
      <button onClick={() => props.onTabChange('personal-abilities')} className={tabClass('personal-abilities')}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>{t('character:tabPersonalAbilities')}</button>
      <button onClick={() => props.onTabChange('resistances')} className={tabClass('resistances')}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3C7 3 4 6 4 9v1c0 2 1.5 3.5 3 4l1 3h8l1-3c1.5-.5 3-2 3-4V9c0-3-3-6-8-6z"/><path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 3V1"/></svg>{t('character:tabResistances')}</button>
    </nav>
  )
}


export default function CharacterSheetDetailPage() {
  const router = useRouter(); const params = useParams(); const id = params.id as string
  const { user } = useAuth()
  const { t } = useTranslation()
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
  const modifierResultsRef = useRef(modifierResults)
  modifierResultsRef.current = modifierResults
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [notebookOpen, setNotebookOpen] = useState(false)
  const [accessState, setAccessState] = useState<'ACTIVE' | 'READ_ONLY' | null>(null)
  const [activeTab, setActiveTab] = useState<string>('character')
  const isOwner = sheet?.ownerId === user?.id || (sheet?.isNpc === true)
  const isAssignedPlayer = sheet?.assignedMember?.userId === user?.id
  const canEdit = isOwner || isAssignedPlayer
  const readOnly = accessState === 'READ_ONLY'
  const permissions: SheetPermissions = {
    canEditCharacter: canEdit && !readOnly,
    canEditSkills: canEdit && !readOnly,
    canEditResources: canEdit && !readOnly,
    canEditInventory: canEdit && !readOnly,
    canEditStory: canEdit && !readOnly,
    canEditProfessionalSkills: canEdit && !readOnly,
    canEditPersonalAbilities: canEdit && !readOnly,
    canEditResistances: canEdit && !readOnly,
    canEditAbilities: canEdit && !readOnly,
  }

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

  // Summon AC results per ability
  const [summonAcResults, setSummonAcResults] = useState<Record<string, number | null>>({})
  // Summon modifier results per ability (computed from summon attributes)
  const [summonModifierResults, setSummonModifierResults] = useState<Record<string, Record<string, number | null>>>({})


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

  const evaluateFormula = useCallback<FormulaEvaluator>(async (formula, variables) => {
    const res = await api.post<{ result: number }>('/formula/evaluate', { formula, variables })
    return res.result
  }, [])

  const computeSummonModifiers = useCallback(async (ability: Ability, sd: CharacterSheet) => {
    return engineComputeSummonModifiers(ability, sd, evaluateFormula)
  }, [evaluateFormula])

  const computeSummonAC = useCallback((ability: Ability, _sd: CharacterSheet, _mods: Record<string, number | null>) => {
    return engineComputeSummonAC(ability)
  }, [])

  const computeAC = useCallback((sd: CharacterSheet, mods: Record<string, number | null>) => {
    const results = engineComputeAC(sd, mods)
    setAcResults(results)
  }, [])

  const computeModifiers = useCallback(async (sd: CharacterSheet) => {
    const results = await engineComputeModifiers(sd, evaluateFormula)
    setModifierResults(results)
    return results
  }, [evaluateFormula])

  const computeSkills = useCallback(async (sd: CharacterSheet, selections?: Record<string, Record<string, string | null>>, othersOverrides?: Record<string, number>) => {
    const selMap = selections || profileSelectionsRef.current
    const effOthers = othersOverrides ?? othersValuesRef.current
    const results = await engineComputeSkills(sd, modifierResultsRef.current, selMap, effOthers, evaluateFormula)
    setSkillResults(results)
  }, [evaluateFormula])

  const fetchSheet = useCallback(async () => {
    try {
      const d = await api.get<CharacterSheet>(`/character-sheets/${id}`)
      setSheet(d)
      const actives: Record<string, boolean> = {}; const others: Record<string, number> = {}
      d.skillValues.forEach(sv => { const parts = (sv.value || '').split('|'); actives[sv.skillId] = parts[0] === '1'; others[sv.skillId] = Number.parseInt(parts[1] || '0', 10) || 0 })
      setActiveSkills(actives); setOthersValues(others)
      const selMap = buildProfileSelections(d)
      setProfileSelections(selMap)
      setAbilities(d.abilities || []); setInventoryItems(d.inventoryItems || []); setStory(d.story || null)
      setSectionEntries(d.sectionEntries || [])
      // All abilities start collapsed

      const mods = await computeModifiers(d); computeSkills(d, selMap, others); computeAC(d, mods)
      // Fetch resistances on load
      fetchResistances(d.id)
      // Compute summon ACs, skills
      const summonAc: Record<string, number | null> = {}
      const summonMods: Record<string, Record<string, number | null>> = {}
      for (const ability of d.abilities || []) {
        if (ability.type === 'SUMMON') {
          const sm = await computeSummonModifiers(ability, d)
          summonMods[ability.id] = sm
          summonAc[ability.id] = computeSummonAC(ability, d, sm)
        }
      }
      setSummonModifierResults(summonMods); setSummonAcResults(summonAc)
      // Check if an avatar exists on the server (cache-bust to avoid stale 204s)
      try {
        const avatarRes = await authFetch(avatarServerUrl + '?t=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
        if (avatarRes.ok && avatarRes.status !== 204) setAvatarUrl(avatarServerUrl + '?t=' + Date.now())
      } catch { /* no avatar */ }
    } catch { /* load errors keep the sheet null; session loss is handled centrally by the layout AuthGuard via onAuthFailure */ }
    finally { setFetching(false) }
  }, [id, computeModifiers, computeSkills, computeAC, computeSummonModifiers, computeSummonAC, evaluateFormula])

  useEffect(() => { fetchSheet() }, [fetchSheet])

  const fetchAccessState = useCallback(async (adventureId: string | null) => {
    if (!adventureId) { setAccessState(null); return }
    try {
      const res = await api.get<{ accessState: 'ACTIVE' | 'READ_ONLY' }>(`/adventures/${adventureId}/access`)
      setAccessState(res.accessState)
    } catch { setAccessState(null) }
  }, [])

  useEffect(() => { fetchAccessState(sheet?.adventure?.id ?? null) }, [fetchAccessState, sheet?.adventure?.id])

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
    const parsedNumVal = field === 'notes' ? value : Number.parseInt(value, 10)
    const numVal = value.trim() === '' ? null : parsedNumVal
    const originalSheet = sheet
    const optimisticSheet = {
      ...originalSheet,
      coreResourceValues: originalSheet.coreResourceValues.map(v =>
        v.coreResourceId === coreResourceId ? { ...v, [field]: numVal } : v
      ),
    }
    setSheet(optimisticSheet)
    try {
      await updateSheet({ coreResourceValues: [{ coreResourceId, [field]: numVal }] })
    } catch {
      setSheet(originalSheet)
    }
  }

  async function handleCoreResourceModify(coreResourceId: string, delta: number) {
    if (!sheet) return
    const crv = sheet.coreResourceValues.find(v => v.coreResourceId === coreResourceId)
    if (!crv) return
    const originalSheet = sheet
    const newVal = Math.max(0, (crv.current ?? 0) + delta)
    const optimisticSheet = {
      ...originalSheet,
      coreResourceValues: originalSheet.coreResourceValues.map(v =>
        v.coreResourceId === coreResourceId ? { ...v, current: newVal } : v
      ),
    }
    setSheet(optimisticSheet)
    try {
      await updateSheet({ coreResourceValues: [{ coreResourceId, current: newVal }] })
    } catch {
      setSheet(originalSheet)
    }
  }

  async function handleAcFieldChange(fieldId: string, value: string) {
    if (!sheet) return
    const originalSheet = sheet
    const optimisticSheet = { ...originalSheet, acValues: originalSheet.acValues.map(acv => acv.fieldId === fieldId ? { ...acv, value } : acv) }
    setSheet(optimisticSheet)
    try { const updated = await updateSheet({ acValues: [{ fieldId, value }] }); computeAC(updated, modifierResults) } catch { setSheet(originalSheet) }
  }
  async function handleAcAttributeModifierChange(acAttributeModifierId: string, selectedAttributeId: string | null) {
    if (!sheet) return
    const originalSheet = sheet
    const selectedAttribute = selectedAttributeId
      ? (originalSheet.template.attributes.find(a => a.id === selectedAttributeId) ?? null)
      : null
    const existing = originalSheet.acAttributeValues.some(v => v.acAttributeModifierId === acAttributeModifierId)
    const optimisticSheet: CharacterSheet = {
      ...originalSheet,
      acAttributeValues: existing
        ? originalSheet.acAttributeValues.map(v => v.acAttributeModifierId === acAttributeModifierId ? { ...v, selectedAttributeId, selectedAttribute } : v)
        : [...originalSheet.acAttributeValues, {
          id: `temp-${acAttributeModifierId}`,
          sheetId: originalSheet.id,
          acAttributeModifierId,
          selectedAttributeId,
          acAttributeModifier: (originalSheet.template.armorClasses?.flatMap(ac => ac.attributeModifiers ?? []) ?? []).find(am => am.id === acAttributeModifierId) as ArmorClassAttributeModifierDef,
          selectedAttribute,
        }],
    }
    setSheet(optimisticSheet)
    computeAC(optimisticSheet, modifierResults)
    try {
      const updated = await updateSheet({ acAttributeValues: [{ acAttributeModifierId, selectedAttributeId }] })
      computeAC(updated, modifierResults)
    } catch {
      setSheet(originalSheet)
      computeAC(originalSheet, modifierResults)
    }
  }
  async function handleProfileChange(skillId: string, profileId: string, optionId: string | null) {
    if (!sheet) return
    setProfileSelections(p => { const n = { ...p }; if (!n[skillId]) { n[skillId] = {}; } n[skillId] = { ...n[skillId], [profileId]: optionId }; return n })
    try { await api.patch(`/character-sheets/${sheet.id}/skills/${skillId}/profiles/${profileId}`, { optionId }) } catch {
      const s = sheet.skillProfileValues.find(spv => spv.skillId === skillId && spv.profileId === profileId)
      setProfileSelections(p => { const n = { ...p }; if (!n[skillId]) { n[skillId] = {}; } n[skillId] = { ...n[skillId], [profileId]: s?.optionId ?? null }; return n })
      return
    }
    computeSkills(sheet, { ...profileSelections, [skillId]: { ...profileSelections[skillId], [profileId]: optionId } })
  }
  async function handleSkillAttributeChange(skillId: string, attributeId: string | null) {
    if (!sheet) return
    setSheet(prev => prev ? applySkillAttributeSelection(prev, skillId, attributeId) : prev)
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
    else if (field === 'manaCost') body.manaCost = value.trim() ? Number.parseInt(value, 10) : null
    else if (field === 'range') body.range = value.trim() || null
    else if (field === 'notes') body.notes = value.trim() || null
    else if (field === 'damage') body.damage = value.trim() || null
    try { await api.patch(`/character-sheets/${sheet.id}/abilities/x/levels/${levelId}`, body); setAbilities(prev => updateAbilityLevel(prev, levelId, body)) } catch {}
  }
  async function saveItemField(itemId: string, field: string, value: string) {
    if (!sheet) return
    const body: Record<string, unknown> = {}
    if (field === 'name') body.name = value.trim()
    else if (field === 'weight') body.weight = value.trim() ? Number.parseFloat(value) : undefined
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
      setAbilities(prev => updateSummonAttribute(prev, abilityId, attributeId, value))
      // Recompute summon modifiers & skills
      const updatedAbilities = updateSummonAttribute(abilities, abilityId, attributeId, value)
      const ability = updatedAbilities.find(a => a.id === abilityId)
      if (ability) {
        const sm = await computeSummonModifiers(ability, sheet)
        setSummonModifierResults(prev => ({ ...prev, [abilityId]: sm }))
        setSummonAcResults(prev => ({ ...prev, [abilityId]: computeSummonAC(ability, sheet, sm) }))
      }
    } catch {}
  }

  async function saveSummonAcValue(abilityId: string, value: string) {
    if (!sheet) return
    try {
      await api.patch(`/character-sheets/${sheet.id}/abilities/${abilityId}/summon-ac`, { value })
      setAbilities(prev => prev.map(a => a.id === abilityId ? { ...a, summonAcValues: [{ id: a.summonAcValues[0]?.id ?? 'temp', abilityId, value }] } : a))
      const parsed = Number.parseFloat(value)
      setSummonAcResults(prev => ({ ...prev, [abilityId]: Number.isNaN(parsed) ? null : parsed }))
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
  async function handleAddSummonSkill(abilityId: string, name: string, manualValue: number) {
    if (!sheet) return
    try {
      const ss = await api.post<SummonSkillData>(`/character-sheets/${sheet.id}/abilities/${abilityId}/summon-skills`, { name, manualValue })
      setAbilities(prev => prev.map(a => a.id === abilityId ? { ...a, summonSkills: [...(a.summonSkills ?? []), ss] } : a))
    } catch {}
  }

  async function handleRemoveSummonSkill(abilityId: string, summonSkillId: string) {
    if (!sheet) return
    try {
      await api.delete(`/character-sheets/${sheet.id}/abilities/${abilityId}/summon-skills/${summonSkillId}`)
      setAbilities(prev => removeSummonSkill(prev, abilityId, summonSkillId))
    } catch {}
  }


  async function handleUpdateSummonSkill(abilityId: string, summonSkillId: string, name: string, manualValue: number) {
    if (!sheet) return
    try {
      await api.patch(`/character-sheets/${sheet.id}/abilities/${abilityId}/summon-skills/${summonSkillId}`, { name, manualValue })
      setAbilities(prev => updateSummonSkill(prev, abilityId, summonSkillId, name, manualValue))
    } catch {}
  }

  // ── Summon Resistance operations ──
  async function handleAddSummonResistance(abilityId: string, name: string, value: string) {
    if (!sheet) return
    try {
      const sr = await api.post<SummonResistanceData>(`/character-sheets/${sheet.id}/abilities/${abilityId}/summon-resistances`, { name, value })
      setAbilities(prev => prev.map(a => a.id === abilityId ? { ...a, summonResistances: [...(a.summonResistances ?? []), sr] } : a))
    } catch {}
  }

  async function handleRemoveSummonResistance(abilityId: string, summonResistanceId: string) {
    if (!sheet) return
    try {
      await api.delete(`/character-sheets/${sheet.id}/abilities/${abilityId}/summon-resistances/${summonResistanceId}`)
      setAbilities(prev => removeSummonResistance(prev, abilityId, summonResistanceId))
    } catch {}
  }

  async function handleUpdateSummonResistance(abilityId: string, summonResistanceId: string, name: string, value: string) {
    if (!sheet) return
    try {
      await api.patch(`/character-sheets/${sheet.id}/abilities/${abilityId}/summon-resistances/${summonResistanceId}`, { name, value })
      setAbilities(prev => updateSummonResistance(prev, abilityId, summonResistanceId, name, value))
    } catch {}
  }

  // ── Summon-scoped ability CRUD ──
  async function handleCreateSummonAbility(summonId: string, e: SubmitEvent) {
    e.preventDefault()
    if (!sheet || !newAbility.name.trim()) return
    setAbilitySaving(true)
    try {
      const body: Record<string, unknown> = { name: newAbility.name.trim(), description: newAbility.description.trim() || undefined, notes: newAbility.notes.trim() || undefined }
      if (newAbility.manaCost) body.manaCost = Number.parseInt(newAbility.manaCost, 10)
      if (newAbility.range) body.range = newAbility.range.trim()
      if (newAbility.damage) body.damage = newAbility.damage.trim()
      const a = await api.post<Ability>(`/character-sheets/${sheet.id}/abilities/${summonId}/summon-abilities`, body)
      setAbilities(prev => prev.map(ab => ab.id === summonId ? { ...ab, childAbilities: [...(ab.childAbilities ?? []), a] } : ab))
      resetNewAbility()
    } catch (err) { setAbilityError(err instanceof Error ? err.message : t('character:failedToCreate')) }
    finally { setAbilitySaving(false) }
  }

  async function handleDeleteAbility(abilityId: string) { if (!sheet) { return } try { await api.delete(`/character-sheets/${sheet.id}/abilities/${abilityId}`); setAbilities(p => deleteAbility(p, abilityId)) } catch {} }

  function resetNewAbility() { setShowNewAbility(false); setNewAbility({ name: '', description: '', manaCost: '', range: '', notes: '', damage: '', level: '', hpCurrent: '', hpMax: '' }); setNewAbilityType(null); setAbilityError(null) }
  async function handleCreateAbility(e: SubmitEvent) { e.preventDefault(); if (!newAbility.name.trim() || !sheet) { return } setAbilitySaving(true)
    try {
      const body: Record<string, unknown> = { name: newAbility.name.trim(), type: newAbilityType ?? 'ABILITY', description: newAbility.description.trim() || undefined, notes: newAbility.notes.trim() || undefined }
      if (newAbilityType === 'ABILITY') {
        body.manaCost = newAbility.manaCost.trim() ? Number.parseInt(newAbility.manaCost, 10) : undefined
        body.range = newAbility.range.trim() || undefined
        body.damage = newAbility.damage.trim() || undefined
      }
      if (newAbilityType === 'SUMMON') {
        body.summonHealthCurrent = newAbility.hpCurrent.trim() ? Number.parseInt(newAbility.hpCurrent, 10) : undefined
        body.summonHealthMax = newAbility.hpMax.trim() ? Number.parseInt(newAbility.hpMax, 10) : undefined
      }
      const a = await api.post<Ability>(`/character-sheets/${sheet.id}/abilities`, body)
      // Create/update initial level if user specified one
      if (newAbility.level.trim()) {
        await createInitialLevel(sheet, a, newAbility.level.trim())
      }
      setAbilities(p => [...p, a])
      // Compute summon data if summon
      if (a.type === 'SUMMON') {
        const sm = await computeSummonModifiers(a, sheet)
        setSummonModifierResults(prev => ({ ...prev, [a.id]: sm }))
        setSummonAcResults(prev => ({ ...prev, [a.id]: computeSummonAC(a, sheet, sm) }))
      }
      setExpandedAbilities(prev => ({ ...prev, [a.id]: true }))
      resetNewAbility()
    } catch (err) { setAbilityError(err instanceof Error ? err.message : t('character:failedToCreateEntry')) } finally { setAbilitySaving(false) } }
  function resetNewItem() { setShowNewItem(false); setNewItem({ name: '', weight: '', cost: '', description: '' }); setItemError(null) }
  async function handleCreateItem(e: SubmitEvent) { e.preventDefault(); if (!newItem.name.trim() || !sheet) { return } setItemSaving(true)
    try { const i = await api.post<InventoryItem>(`/character-sheets/${sheet.id}/inventory`, { name: newItem.name.trim(), weight: newItem.weight.trim() ? Number.parseFloat(newItem.weight) : undefined, cost: newItem.cost.trim() || undefined, description: newItem.description.trim() || undefined }); setInventoryItems(p => [...p, i]); resetNewItem() } catch (err) { setItemError(err instanceof Error ? err.message : t('character:failedToCreateItem')) } finally { setItemSaving(false) } }
  async function handleDeleteItem(iid: string) { if (!sheet) { return } try { await api.delete(`/character-sheets/${sheet.id}/inventory/${iid}`); setInventoryItems(p => p.filter(i => i.id !== iid)) } catch {} }
  async function saveStoryField(field: string, value: string) { if (!sheet) { return } try { const s = await api.patch<Story>(`/character-sheets/${sheet.id}/story`, { [field]: value.trim() || null }); setStory(s) } catch {} }

  // ── Section entry handlers ──
  function resetSectionEntryForm() { setNewSectionEntryForm({ name: '', description: '' }); setShowNewSectionEntry(null); setSectionEntrySaving(false) }
  async function handleCreateSectionEntry(sectionId: string, e: SubmitEvent) {
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

  async function handleDelete() { setDeleting(true); try { await api.delete(`/character-sheets/${id}`); router.push('/dashboard?tab=character-sheets') } catch (err) { setDeleteError(err instanceof Error ? err.message : t('character:failedToDelete')); setDeleting(false); setConfirmDelete(false) } }

  async function handleAvatarUpload(file: File) {
    if (!file || !sheet) return
    setAvatarUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const res = await authFetch(avatarServerUrl, {
        method: 'POST',
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
      await authFetch(avatarServerUrl, {
        method: 'DELETE',
      })
      setAvatarUrl(null)
    } catch { /* delete failed */ }
  }

  if (fetching) return <div className="flex items-center justify-center py-20"><div className="flex flex-col items-center gap-3 text-muted-foreground"><div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"/><span className="text-sm">{t('common:loading')}</span></div></div>
  if (!sheet) return <div className="flex items-center justify-center py-20"><div className="text-sm text-muted-foreground">{t('character:characterSheetNotFound')}</div></div>

  const allProfiles: SkillModifierProfile[] = sheet?.template.skillModifierProfiles ?? []
  const armorClasses = sheet?.template.armorClasses?.filter(ac => ac.enabled) ?? []
  const modifiersEnabled = sheet.template.attributeModifiersEnabled !== false
  const totalWeight = inventoryItems.reduce((s, i) => s + (i.weight ?? 0), 0)
  const enabledCoreResources = (sheet.template.coreResources ?? []).filter(cr => cr.enabled)

  return (<div className="w-full">
    <PageNav crumbs={[
      { label: t('common:dashboard'), href: '/dashboard' },
      ...(sheet.adventure ? [{ label: sheet.adventure.name, href: `/dashboard/adventures/${sheet.adventure.id}` }] : []),
      { label: sheet.characterName },
    ]} />

    <div className="space-y-6">
      <SheetHeaderCard
        sheet={sheet}
        isOwner={isOwner}
        readOnly={readOnly}
        avatarUrl={avatarUrl}
        avatarUploading={avatarUploading}
        onAvatarDelete={handleAvatarDelete}
        onAvatarUpload={handleAvatarUpload}
        onSaveCharacterName={saveCharacterName}
        onSavePlayerName={savePlayerName}
        onSaveLevel={saveLevel}
        onRequestDelete={() => setConfirmDelete(true)}
      />

      {readOnly && <ReadOnlyBanner />}

      <SheetTabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'character' && <CharacterTab
        sheet={sheet}
        permissions={permissions}
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
        abilities={abilities} permissions={permissions} sheetId={sheet.id} template={sheet.template}
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
        saveSummonHealth={saveSummonHealth}
        handleAddSummonSkill={handleAddSummonSkill}
        handleUpdateSummonSkill={handleUpdateSummonSkill}
        handleRemoveSummonSkill={handleRemoveSummonSkill}
        handleAddSummonResistance={handleAddSummonResistance}
        handleUpdateSummonResistance={handleUpdateSummonResistance}
        handleRemoveSummonResistance={handleRemoveSummonResistance}
        handleCreateSummonAbility={handleCreateSummonAbility}
      />}
      {activeTab === 'inventory' && <InventoryTab
        inventoryItems={inventoryItems}
        permissions={permissions}
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
      {activeTab === 'story' && <StoryTab story={story} permissions={permissions} onSaveField={saveStoryField} />}

      {activeTab === 'personal-abilities' && <PersonalAbilitiesTab
        sections={sheet.template.characterSections ?? []}
        entries={sectionEntries}
        permissions={permissions}
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
          permissions={permissions}
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

      {sheet.adventure && (
        <PdfViewerSidebar
          adventureId={sheet.adventure.id}
          isGM={isOwner}
          bookId={selectedBookId ?? null}
          onClose={() => setSelectedBookId(null)}
        />
      )}

      {sheet.adventure && (
        <NotebookSidebar
          adventureId={sheet.adventure.id}
          isGM={isOwner}
          forceOpen={notebookOpen}
          readOnly={readOnly}
          onClose={() => setNotebookOpen(false)}
        />
      )}
    </div>
  </div>)
}




function DeleteModal({ name, error, loading, onCancel, onConfirm }: { readonly name: string; readonly error: string | null; readonly loading: boolean; readonly onCancel: () => void; readonly onConfirm: () => void }) {
  const { t } = useTranslation()
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in"><div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center"><svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg></div><div><h2 className="font-semibold">{t('character:deleteCharacterSheetTitle')}</h2><p className="text-sm text-muted-foreground">{t('character:deleteActionCannotBeUndone')}</p></div></div><p className="text-sm text-muted-foreground">{t('character:deleteConfirm', { name })}</p>{error && <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{error}</div>}<div className="flex gap-3 justify-end"><button onClick={onCancel} disabled={loading} className="btn-ghost">{t('common:cancel')}</button><button onClick={onConfirm} disabled={loading} className="btn-danger-solid">{loading ? t('character:deleting') : t('character:deleteForever')}</button></div></div></div> }
