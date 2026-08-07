'use client'

import { useTranslation } from 'react-i18next'
import { Select } from '@/components/shared/Select'

interface SkillValue {
  id: string; skillId: string; value: string; selectedAttributeId: string | null
  selectedAttribute: { id: string; key: string; name: string } | null
  skill: {
    id: string; name: string; description: string | null; attributeId: string | null
    allowedAttributeIds: string[]; defaultAttributeId: string | null
    attribute: { id: string; key: string; name: string } | null
    defaultAttribute: { id: string; key: string; name: string } | null
  }
}
interface ProfileOption { id: string; label: string; value: number }
interface SkillModifierProfile { id: string; name: string; options: ProfileOption[]; targetMode?: string; targetSkillIds?: string[] }

export function CollapsibleSkillRow({
  skill, result, profiles, selections, active, others,
  onToggleActive, onOthersChange, onProfileChange, onAttributeChange,
  templateAttributes, expandedSkillId, onExpandToggle, modifiersEnabled,
}: {
  skill: SkillValue
  result: number | null
  profiles: SkillModifierProfile[]
  selections: Record<string, string | null>
  active: boolean
  others: number
  onToggleActive: () => void
  onOthersChange: (v: number) => void
  onProfileChange: (profileId: string, optionId: string | null) => void
  onAttributeChange?: (attributeId: string | null) => void
  templateAttributes?: { id: string; key: string; name: string }[]
  expandedSkillId: string | null
  onExpandToggle: (id: string) => void
  modifiersEnabled?: boolean
}) {
  const { t } = useTranslation()
  const expanded = expandedSkillId === skill.skillId
  const skillId = skill.skillId
  const hasAttrDropdown = (skill.skill.allowedAttributeIds?.length ?? 0) > 0 && !!templateAttributes && !!onAttributeChange

  return (
    <div className={`rounded-lg border border-border bg-background/30 overflow-hidden transition-opacity ${active ? '' : 'opacity-40'}`}>
      <div className="flex items-center px-4 py-3">
        <input type="checkbox" checked={active} onChange={onToggleActive} className="shrink-0 w-4 h-4 rounded border-border accent-primary cursor-pointer mr-3" />
        <button
          type="button"
          onClick={() => onExpandToggle(skillId)}
          disabled={!active}
          className="flex items-center justify-between flex-1 min-w-0 text-left hover:bg-background/50 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
        >
          <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">{skill.skill.name}</span>
            {skill.skill.description && (
              <span className="text-xs text-muted truncate hidden sm:inline">— {skill.skill.description}</span>
            )}
          </div>
          <div role="presentation" className="flex items-center gap-2 shrink-0 ml-3" onClick={e => e.stopPropagation()}>
            {hasAttrDropdown && modifiersEnabled !== false ? (
              <Select
                options={skill.skill.allowedAttributeIds.map(attrId => {
                  const a = templateAttributes!.find(x => x.id === attrId)
                  return a ? { id: attrId, label: a.name } : null
                }).filter(Boolean) as { id: string; label: string }[]}
                value={skill.selectedAttributeId ?? ''}
                onChange={val => onAttributeChange!(val || null)}
                size="sm"
                className="w-auto min-w-[90px] text-xs"
              />
            ) : (
              <span className="text-xs text-muted opacity-40 min-w-[90px] inline-block">
                {skill.selectedAttribute
                  ? skill.selectedAttribute.name
                  : (skill.skill.defaultAttribute?.name || skill.skill.attribute?.name || '—')}
              </span>
            )}
            <span className="text-base font-bold text-primary">{active ? (result != null ? result : '—') : '0'}</span>
            <svg className={`w-4 h-4 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
        </button>
      </div>
      <div className={`transition-all duration-200 overflow-hidden ${expanded && active ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 py-3 space-y-2 border-t border-border ml-10">
          {profiles.map(profile => {
            const sid = selections[profile.id]
            return (
              <div key={profile.id} className="flex items-center gap-2">
                <span className="text-xs text-muted shrink-0 min-w-[80px]">{profile.name}:</span>
                <Select
                  options={profile.options}
                  value={sid}
                  onChange={(id) => onProfileChange(profile.id, id)}
                  showBadge
                  size="sm"
                  className="flex-1"
                />
              </div>
            )
          })}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted shrink-0 min-w-[80px]">{t('character:others')}</span>
            <input
              type="number"
              min={0}
              step={1}
              className="input-field py-1 text-xs w-20"
              value={others || ''}
              placeholder={t('character:othersPlaceholder')}
              onChange={e => onOthersChange(Number.parseInt(e.target.value, 10) || 0)}
            />
            <span className="text-xs font-mono text-primary">+{others}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
