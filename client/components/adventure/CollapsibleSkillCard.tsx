'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Select } from '@/components/shared/Select'

export function CollapsibleSkillCard({ index, skill, onUpdateSkill, onRemove, attributes, onToggleAllowedAttr, onUpdateDefaultAttr }: {
  index: number
  skill: { name: string; description: string; attributeId: string; allowedAttributeIds?: string[]; defaultAttributeId?: string }
  onUpdateSkill?: (i: number, f: string, v: string) => void
  onRemove?: () => void
  attributes: { key: string; name: string }[]
  onToggleAllowedAttr?: (i: number, attrKey: string) => void
  onUpdateDefaultAttr?: (i: number, v: string) => void
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const allowed = (skill as any).allowedAttributeIds ?? []
  const defaultAttr = (skill as any).defaultAttributeId ?? ''
  return (
    <div className="rounded-lg border border-border bg-background/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-background/50 transition-colors"
      >
        <span className="text-sm font-medium text-foreground truncate">{skill.name || t('campaign:newSkill')}</span>
        <svg className={`w-4 h-4 text-muted transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 py-3 space-y-2 border-t border-border">
          <div>
            <label className="text-xs text-muted mb-1 block">{t('common:name')}</label>
            <input className="input-field" value={skill.name} onChange={e => onUpdateSkill?.(index, 'name', e.target.value)} placeholder={t('campaign:skillNamePlaceholder')} />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">{t('common:description')} <span className="text-muted font-normal">{t('campaign:optionalLower')}</span></label>
            <input className="input-field" value={skill.description} onChange={e => onUpdateSkill?.(index, 'description', e.target.value)} placeholder={t('campaign:briefDescription')} />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">{t('campaign:allowedAttributes')}</label>
            <div className="flex flex-wrap gap-1">
              {(attributes || []).map(a => (
                <label key={a.key} className="flex items-center gap-1 text-xs text-foreground cursor-pointer py-0.5">
                  <input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={allowed.includes(a.key)} onChange={() => onToggleAllowedAttr?.(index, a.key)} />
                  <span>{a.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">{t('campaign:defaultAttribute')}</label>
            <Select
              options={[
                { id: '', label: t('campaign:selectDefault') },
                ...allowed.map((k: string) => {
                  const a = attributes.find((x: any) => x.key === k)
                  return a ? { id: k, label: a.name } : null
                }).filter(Boolean) as { id: string; label: string }[],
              ]}
              value={defaultAttr}
              onChange={val => { if (onUpdateDefaultAttr) onUpdateDefaultAttr(index, val); else onUpdateSkill?.(index, 'defaultAttributeId', val) }}
              className="text-xs"
              size="sm"
            />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={onRemove} className="text-xs text-danger hover:text-danger/80 transition-colors">{t('campaign:removeSkill')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
