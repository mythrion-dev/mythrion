'use client'

interface SkillModifierProfile {
  id: string
  name: string
  options: { id: string; label: string; value: number }[]
}

interface FormulaBuilderProps {
  value: string
  onChange: (formula: string) => void
  attributes: { key: string; name: string }[]
  customFields?: { key: string; label: string }[]
  skillModifierProfiles?: SkillModifierProfile[]
  pointPools?: { slug: string; name: string }[]
  acFields?: { key: string; name: string }[]
  placeholder?: string
  useModPrefix?: boolean
}

export default function FormulaBuilder({
  value,
  onChange,
  attributes,
  placeholder = 'Type formula manually...',
}: FormulaBuilderProps) {
  return (
    <div className="space-y-3">
      <textarea className="input-field resize-none font-mono text-sm" rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false} />

      {attributes.length === 0 && (
        <p className="text-xs text-muted italic">Add attributes to the template first, then come back to build formulas.</p>
      )}
    </div>
  )
}
