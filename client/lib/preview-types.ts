/**
 * Type definitions for the Template Preview (Sandbox Mode) feature.
 * All state is local — these types mirror the server response shapes
 * and define the reducer action union.
 */

// ── Template snapshot from GET /public/templates/:id ──

export interface PreviewTemplateAttribute {
  id: string
  key: string
  name: string
}

export interface PreviewTemplateField {
  id: string
  key: string
  label: string
  fieldType?: string
}

export interface PreviewTemplateSkill {
  id: string
  name: string
  description: string | null
  attributeId: string | null
  allowedAttributeIds: string[]
  defaultAttributeId: string | null
  attribute: { id: string; key: string; name: string } | null
  defaultAttribute: { id: string; key: string; name: string } | null
}

export interface PreviewProfileOption {
  id: string
  label: string
  value: number
}

export interface PreviewSkillModifierProfile {
  id: string
  name: string
  options: PreviewProfileOption[]
  targetMode?: string
  targetSkillIds?: string[]
}

export interface PreviewCoreResourceDef {
  id: string
  slug: string
  displayName: string
  enabled: boolean
  editableByPlayer: boolean
  showNotes: boolean
  color?: string
}

export interface PreviewAcAttributeModifier {
  id: string
  attributeId: string
  allowPlayerSelection: boolean
  defaultAttributeId: string | null
  attribute: { id: string; key: string; name: string }
  defaultAttribute: { id: string; key: string; name: string } | null
}

export interface PreviewAcFieldDef {
  id: string
  name: string
  key: string
  defaultValue: string
  editableByPlayer: boolean
  description: string | null
}

export interface PreviewArmorClassDef {
  id: string
  name?: string
  enabled: boolean
  attributeModifiers: PreviewAcAttributeModifier[]
  fields: PreviewAcFieldDef[]
}

export interface PreviewCharacterSection {
  id: string
  name: string
  order: number
}

export interface PreviewResistanceComponentDef {
  id: string
  name: string
  editableByPlayer: boolean
  defaultValue: string
  order: number
}

export interface PreviewResistanceAttributeModifier {
  id: string
  attributeId: string
  enabled: boolean
  attribute?: { id: string; key: string; name: string }
}

export interface PreviewResistanceDef {
  id: string
  name: string
  calculationType: string
  order: number
  components: PreviewResistanceComponentDef[]
  attributeModifiers: PreviewResistanceAttributeModifier[]
}

export interface PreviewTemplateSnapshot {
  id: string
  name: string
  description: string | null
  campaign: string | null
  attributeModifierFormula: string | null
  attributeModifiersEnabled: boolean | null
  skillFormula: string | null
  attributes: PreviewTemplateAttribute[]
  templateFields: PreviewTemplateField[]
  templateSkills: PreviewTemplateSkill[]
  skillModifierProfiles: PreviewSkillModifierProfile[]
  coreResources: PreviewCoreResourceDef[]
  armorClasses: PreviewArmorClassDef[]
  characterSections: PreviewCharacterSection[]
  resistances: PreviewResistanceDef[] | null
}

// ── Preview sheet state (all local, no DB) ──

import type {
  Ability,
  InventoryItem,
  Story,
  SectionEntry,
  ProfessionalSkill,
} from '@/components/character-sheet/types'

export interface PreviewResourceState {
  current: number | null
  maximum: number | null
  notes: string | null
}

export interface PreviewSheetState {
  template: PreviewTemplateSnapshot
  characterName: string
  playerName: string
  level: number
  attributeValues: Record<string, string>
  fieldValues: Record<string, string>
  skillValues: Record<string, string>
  skillAttributes: Record<string, string | null>
  profileSelections: Record<string, Record<string, string | null>>
  activeSkills: Record<string, boolean>
  othersValues: Record<string, number>
  coreResources: Record<string, PreviewResourceState>
  acFieldValues: Record<string, string>
  acAttributeModifiers: Record<string, string | null>
  resistanceComponents: Record<string, string>
  resistanceManualValues: Record<string, string | null>
  abilities: Ability[]
  inventoryItems: InventoryItem[]
  story: Story | null
  sectionEntries: SectionEntry[]
  professionalSkills: ProfessionalSkill[]
}

// ── Reducer action types ──

export type PreviewAction =
  | { type: 'INIT'; payload: PreviewSheetState }
  | { type: 'SET_CHARACTER_NAME'; payload: string }
  | { type: 'SET_PLAYER_NAME'; payload: string }
  | { type: 'SET_LEVEL'; payload: number }
  | { type: 'SET_ATTRIBUTE_VALUE'; attributeId: string; value: string }
  | { type: 'SET_FIELD_VALUE'; fieldId: string; value: string }
  | { type: 'SET_SKILL_VALUE'; skillId: string; value: string }
  | { type: 'SET_SKILL_ATTRIBUTE'; skillId: string; attributeId: string | null }
  | { type: 'SET_PROFILE_SELECTION'; skillId: string; profileId: string; optionId: string | null }
  | { type: 'SET_RESOURCE'; resourceId: string; resource: Partial<PreviewResourceState> }
  | { type: 'SET_AC_FIELD'; fieldId: string; value: string }
  | { type: 'SET_AC_ATTRIBUTE_MODIFIER'; modifierId: string; attributeId: string | null }
  | { type: 'SET_RESISTANCE_COMPONENT'; componentId: string; value: string }
  | { type: 'SET_RESISTANCE_MANUAL'; resistanceId: string; value: string | null }
  | { type: 'SET_ACTIVE_SKILLS'; payload: Record<string, boolean> }
  | { type: 'SET_OTHERS_VALUES'; payload: Record<string, number> }
  | { type: 'UPDATE_ABILITIES'; payload: Ability[] }
  | { type: 'UPDATE_INVENTORY'; payload: InventoryItem[] }
  | { type: 'UPDATE_STORY'; payload: Story | null }
  | { type: 'UPDATE_SECTION_ENTRIES'; payload: SectionEntry[] }
  | { type: 'SET_PROFESSIONAL_SKILLS'; payload: ProfessionalSkill[] }
  | { type: 'RESET'; payload: PreviewSheetState }

// ── Computed result types ──

export interface SkillResult {
  total: number
  name: string
  selectedAttribute: string | null
  selectedAttributeName: string | null
  attributeValue: number | null
  selectedProfileValue: number | null
}

export type AcResultMap = Record<string, { total: number; name: string }>
