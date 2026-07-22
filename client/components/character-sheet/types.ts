import type { FormEvent } from 'react'

export interface SheetAttribute { id: string; attributeId: string; value: string; attribute: { id: string; key: string; name: string } }
export interface FieldValue { id: string; templateFieldId: string; value: string; templateField: { id: string; key: string; label: string } }
export interface SkillValue { id: string; skillId: string; value: string; selectedAttributeId: string | null; selectedAttribute: { id: string; key: string; name: string } | null; skill: { id: string; name: string; description: string | null; attributeId: string | null; allowedAttributeIds: string[]; defaultAttributeId: string | null; attribute: { id: string; key: string; name: string } | null; defaultAttribute: { id: string; key: string; name: string } | null } }
export interface ProfileOption { id: string; label: string; value: number }
export interface SkillModifierProfile { id: string; name: string; options: ProfileOption[]; targetMode?: string; targetSkillIds?: string[] }
export interface SkillProfileValue { id: string; skillId: string; profileId: string; optionId: string | null; profile: { id: string; name: string }; option: { id: string; label: string; value: number } | null }

export interface CoreResourceDef {
  id: string; slug: string; displayName: string
  enabled: boolean
  editableByPlayer: boolean
  showNotes: boolean
  color?: string
}
export interface CoreResourceValue {
  id: string; coreResourceId: string; current: number | null; maximum: number | null; notes: string | null
  coreResource: CoreResourceDef
}

export interface ArmorClassAttributeModifierDef {
  id: string; attributeId: string; allowPlayerSelection: boolean; defaultAttributeId: string | null
  attribute: { id: string; key: string; name: string }
  defaultAttribute: { id: string; key: string; name: string } | null
}
export interface ArmorClassFieldDef {
  id: string; name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string | null
}
export interface ArmorClassDef {
  id: string; name?: string; enabled: boolean; attributeModifiers: ArmorClassAttributeModifierDef[]; fields: ArmorClassFieldDef[]
}
export interface ArmorClassValue {
  id: string; fieldId: string; value: string; field: ArmorClassFieldDef
}
export interface ArmorClassAttributeValue {
  id: string; sheetId: string; acAttributeModifierId: string; selectedAttributeId: string | null
  acAttributeModifier: ArmorClassAttributeModifierDef
  selectedAttribute: { id: string; key: string; name: string } | null
}

export interface TemplateCharacterSection { id: string; name: string; order: number }
export interface SectionEntry { id: string; sheetId: string; sectionId: string; name: string; description: string; order: number; section: { id: string; name: string } }

export interface AbilityLevel { id: string; abilityId: string; level: string; manaCost: number | null; range: string | null; description: string | null; notes: string | null; damage: string | null }
export interface SummonAttribute { id: string; abilityId: string; attributeId: string; value: string }
export interface SummonAcValue { id: string; abilityId: string; fieldId: string; value: string }
export interface SummonAcAttributeValue { id: string; abilityId: string; acAttributeModifierId: string; selectedAttributeId: string | null; selectedAttribute: { id: string; key: string; name: string } | null }
export interface SummonHealth { id: string; abilityId: string; current: number | null; maximum: number | null; notes: string | null }
export interface SummonResistanceValue { id: string; abilityId: string; resistanceId: string; manualValue: string | null }
export interface SummonResistanceComponentValue { id: string; abilityId: string; componentId: string; value: string }

export interface SummonSkillData {
  id: string; abilityId: string; skillId: string; selectedAttributeId: string | null
  selectedAttribute: { id: string; key: string; name: string } | null
  skill: { id: string; name: string; description: string | null; attributeId: string | null; allowedAttributeIds: string[]; defaultAttributeId: string | null; attribute: { id: string; key: string; name: string } | null; defaultAttribute: { id: string; key: string; name: string } | null }
  profileValues: SummonSkillProfileValueData[]
}
export interface SummonSkillProfileValueData { id: string; summonSkillId: string; profileId: string; optionId: string | null; profile: { id: string; name: string; targetMode?: string; targetSkillIds?: string[] }; option: { id: string; label: string; value: number } | null }

export interface Ability {
  id: string; name: string; type: string; description: string | null; notes: string | null; order: number
  summonId?: string | null
  levels: AbilityLevel[]
  summonAttributes: SummonAttribute[]
  summonAcValues: SummonAcValue[]
  summonAcAttributeValues?: SummonAcAttributeValue[]
  summonHealth: SummonHealth | null
  summonSkills?: SummonSkillData[]
  summonResistanceValues?: SummonResistanceValue[]
  summonResistanceComponentValues?: SummonResistanceComponentValue[]
  childAbilities?: Ability[]
}
export interface InventoryItem { id: string; name: string; weight: number | null; cost: string | null; description: string | null; order: number }
export interface Story { id: string; appearance: string | null; backstory: string | null; personality: string | null; goals: string | null; notes: string | null }

export interface TemplateSkill { id: string; name: string; description: string | null; attributeId: string | null; allowedAttributeIds: string[]; defaultAttributeId: string | null; attribute: { id: string; key: string; name: string } | null; defaultAttribute: { id: string; key: string; name: string } | null }

export interface CharacterSheet {
  id: string; characterName: string; playerName: string | null; level: number | null
  hpActual: number | null; hpMax: number | null; hpNotes: string | null
  adventure: { id: string; name: string; campaign: string } | null
  template: {
    id: string; name: string
    attributeModifierFormula?: string | null
    attributeModifiersEnabled?: boolean
    skillFormula?: string | null
    attributes: { id: string; key: string; name: string }[]
    templateSkills?: TemplateSkill[]
    skillModifierProfiles: SkillModifierProfile[]
    coreResources: CoreResourceDef[]
    armorClasses: ArmorClassDef[]
    characterSections: TemplateCharacterSection[]
    resistances?: TemplateResistanceDef[]
  }
  values: SheetAttribute[]; fieldValues: FieldValue[]; skillValues: SkillValue[]
  skillProfileValues: SkillProfileValue[]
  coreResourceValues: CoreResourceValue[]
  acValues: ArmorClassValue[]
  acAttributeValues: ArmorClassAttributeValue[]
  sectionEntries: SectionEntry[]
  abilities: Ability[]; inventoryItems: InventoryItem[]; story: Story | null
  ownerId: string | null; isNpc: boolean; npcType: string | null; adventureId: string | null; createdAt: string
}

export interface SheetPermissions {
  canEditCharacter: boolean
  canEditSkills: boolean
  canEditResources: boolean
  canEditInventory: boolean
  canEditStory: boolean
  canEditProfessionalSkills: boolean
  canEditPersonalAbilities: boolean
  canEditResistances: boolean
  canEditAbilities: boolean
}

export type Tab = string
export type SummonTab = 'stats' | 'skills' | 'abilities' | 'resistances'
export type AcResultMap = Record<string, { total: number; name: string }>

export interface ResistanceComponentDef {
  id: string; name: string; editableByPlayer: boolean; defaultValue: string; order: number
}
export interface ResistanceAttributeModifierDef {
  id: string; attributeId: string; attributeKey?: string; attributeName?: string; enabled: boolean
  attribute?: { id: string; key: string; name: string }
}
export interface TemplateResistanceDef {
  id: string; name: string; calculationType: string; order: number
  components: ResistanceComponentDef[]
  attributeModifiers: ResistanceAttributeModifierDef[]
}

export interface ProfessionalSkill {
  id: string
  name: string
  attributeId: string | null
  attribute: { id: string; key: string; name: string } | null
  order: number
  profileValues: ProfessionalSkillProfileValue[]
}

export interface ProfessionalSkillProfileValue {
  id: string
  professionalSkillId?: string
  profileId: string
  optionId: string | null
  profile: { id: string; name: string }
  option: { id: string; label: string; value: number } | null
}
