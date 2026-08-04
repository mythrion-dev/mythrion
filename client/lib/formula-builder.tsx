'use client'

import { useTranslation } from 'react-i18next'

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
  placeholder,
}: FormulaBuilderProps) {
  const { t } = useTranslation()
  const resolvedPlaceholder = placeholder ?? t('templates:formulaPlaceholder')
  return (
    <div className="space-y-3">
      <textarea className="input-field resize-none font-mono text-sm" rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={resolvedPlaceholder} spellCheck={false} />

      {attributes.length === 0 && (
        <p className="text-xs text-muted italic">{t('templates:formulaEmptyState')}</p>
      )}
    </div>
  )
}
