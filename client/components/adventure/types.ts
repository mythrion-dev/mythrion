export interface CoreResource {
  id?: string
  slug: string
  displayName: string
  enabled: boolean
  editableByPlayer: boolean
  showNotes: boolean
}

export interface SkillModifierProfile {
  id: string
  name: string
  targetMode?: string
  targetSkillIds?: string[]
  options: { id: string; label: string; value: number }[]
}

export interface ArmorClassAttributeModifierDraft {
  attributeId: string
  allowPlayerSelection: boolean
  defaultAttributeId?: string
}

export interface AcConfigDraft {
  name: string
  enabled: boolean
  fields: { name: string; key: string; defaultValue: string; editableByPlayer: boolean; description: string }[]
  attributeModifiers: ArmorClassAttributeModifierDraft[]
}

export type ResistanceDef = {
  id?: string
  name: string
  calculationType: 'MANUAL' | 'CALCULATED'
  components: { id?: string; name: string; editableByPlayer: boolean; defaultValue: string }[]
  attributeModifiers: { attributeId: string; attributeKey: string; attributeName: string; enabled: boolean }[]
}

export function emptyAcConfig(): AcConfigDraft {
  return { name: '', enabled: true, fields: [], attributeModifiers: [] }
}

export function emptyResistance(): ResistanceDef {
  return { name: '', calculationType: 'MANUAL', components: [], attributeModifiers: [] }
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}
