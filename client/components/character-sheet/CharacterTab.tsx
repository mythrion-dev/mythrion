'use client'

import { InlineText } from '@/lib/inline-editable'
import { CoreResourceCard, CollapsibleSkillRow } from '@/components/character-sheet'
import type { CharacterSheet, AcResultMap, SkillModifierProfile } from './types'

export function CharacterTab({
  sheet, isOwner,
  enabledCoreResources,
  handleCoreResourceChange, handleCoreResourceModify,
  saveFieldValue, modifierResults, saveAttributeValue, modifiersEnabled,
  armorClasses, acResults, handleAcFieldChange, handleAcAttributeModifierChange,
  allProfiles, profileSelections, activeSkills, othersValues,
  handleSkillToggle, handleOthersChange, handleProfileChange,
  handleSkillAttributeChange, expandedSkillId, setExpandedSkillId,
  skillResults,
}: {
  sheet: CharacterSheet; isOwner: boolean
  enabledCoreResources: CharacterSheet['template']['coreResources']
  handleCoreResourceChange: (coreResourceId: string, field: 'current' | 'maximum' | 'notes', value: string) => Promise<void>
  handleCoreResourceModify?: (coreResourceId: string, delta: number) => void
  saveFieldValue: (fieldId: string, value: string) => Promise<void>
  modifierResults: Record<string, number | null>
  saveAttributeValue: (attributeId: string, value: string) => Promise<void>
  modifiersEnabled: boolean | undefined
  armorClasses: CharacterSheet['template']['armorClasses']
  acResults: AcResultMap
  handleAcFieldChange: (fieldId: string, value: string) => void
  handleAcAttributeModifierChange: (acModifierId: string, attributeId: string | null) => Promise<void>
  allProfiles: SkillModifierProfile[]
  profileSelections: Record<string, Record<string, string | null>>
  activeSkills: Record<string, boolean>
  othersValues: Record<string, number>
  handleSkillToggle: (skillId: string) => void
  handleOthersChange: (skillId: string, value: number) => void
  handleProfileChange: (skillId: string, profileId: string, optionId: string | null) => void
  handleSkillAttributeChange: (skillId: string, attributeId: string | null) => void
  expandedSkillId: string | null
  setExpandedSkillId: React.Dispatch<React.SetStateAction<string | null>>
  skillResults: Record<string, number | null>
}) {
  return (
    <div className="space-y-6">
      {enabledCoreResources.map(cr => {
        const crv = sheet.coreResourceValues.find(v => v.coreResourceId === cr.id)
        if (!crv) return null
        return (
          <CoreResourceCard
            key={cr.id}
            resource={cr}
            value={crv}
            isOwner={!!isOwner}
            onSave={handleCoreResourceChange}
            onModify={isOwner && cr.editableByPlayer ? handleCoreResourceModify : undefined}
          />
        )
      })}

      {sheet.fieldValues.length > 0 && (
        <div className="card !p-6">
          <h3 className="font-semibold mb-3">Character Info</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {sheet.fieldValues.map(fv => (
              <div key={fv.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border">
                <span className="text-sm text-muted">{fv.templateField.label}</span>
                {isOwner ? (
                  <InlineText value={fv.value} onSave={(v) => saveFieldValue(fv.templateFieldId, v)} className="text-sm font-medium text-foreground" />
                ) : (
                  <span className="text-sm font-medium text-foreground">{fv.value || '—'}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card !p-6">
        <h3 className="font-semibold mb-4">Attributes</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {sheet.template.attributes.map(attr => {
            const val = sheet.values.find(v => v.attributeId === attr.id)
            const modResult = modifierResults[attr.id]
            return (
              <div key={attr.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border">
                <span className="text-sm text-foreground">{attr.name}{modifiersEnabled && sheet.template.attributeModifierFormula && <span className="text-[0.6rem] text-primary ml-1">mod</span>}</span>
                <div className="flex items-center gap-3">
                  {isOwner ? (
                    <InlineText value={val?.value ?? ''} onSave={(v) => saveAttributeValue(attr.id, v)} className="text-sm font-semibold text-foreground" />
                  ) : (
                    <span className="text-sm font-semibold text-foreground">{val?.value || '—'}</span>
                  )}
                  {modifiersEnabled && modResult !== undefined && modResult !== null && (
                    <span className="text-sm font-semibold text-primary">({modResult >= 0 ? '+' : ''}{modResult})</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {armorClasses.map(ac => (
        <div key={ac.id} className="card !p-6">
          <h3 className="font-semibold mb-4">{(ac as any).name ?? 'Armor Class'}</h3>
          <div className="flex items-center justify-center mb-4">
            <div className="w-24 h-24 rounded-full border-4 border-primary/30 flex items-center justify-center bg-background/50">
              <span className="text-4xl font-bold text-primary">{acResults[ac.id]?.total !== undefined ? acResults[ac.id].total : '—'}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Components</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {ac.fields.map(field => {
                  const acv = sheet.acValues.find(v => v.fieldId === field.id)
                  const val = acv?.value ?? field.defaultValue
                  const canEdit = isOwner && field.editableByPlayer
                  return (
                    <div key={field.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-sm text-foreground truncate">{field.name}</span>
                        {field.description && <span className="text-[0.6rem] text-muted hidden sm:inline">— {field.description}</span>}
                      </div>
                      {canEdit
                        ? <input type="number" className="input-field py-1 text-xs w-16 text-right" value={val} onChange={e => handleAcFieldChange(field.id, e.target.value)} />
                        : <span className="text-sm font-semibold text-foreground">{val}</span>
                      }
                    </div>
                  )
                })}
              </div>
            </div>
            {modifiersEnabled && (ac.attributeModifiers ?? []).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Attribute Modifiers</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(ac.attributeModifiers ?? []).map(am => {
                    const acAttrValue = sheet.acAttributeValues.find(v => v.acAttributeModifierId === am.id)
                    const selectedAttributeId = acAttrValue?.selectedAttributeId ?? am.defaultAttributeId ?? am.attributeId
                    const selectedAttribute = sheet.template.attributes.find(a => a.id === selectedAttributeId) ?? am.defaultAttribute ?? am.attribute
                    const modResult = selectedAttribute ? modifierResults[selectedAttribute.id] : null
                    const canChangeAttribute = isOwner && am.allowPlayerSelection
                    return (
                      <div key={am.id} className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-background/50 border border-border opacity-80">
                        {canChangeAttribute ? (
                          <select
                            className="input-field py-0.5 text-xs w-auto min-w-[120px]"
                            value={selectedAttribute?.id ?? ''}
                            onChange={e => handleAcAttributeModifierChange(am.id, e.target.value || null)}
                          >
                            {sheet.template.attributes.map(attr => (
                              <option key={attr.id} value={attr.id}>{attr.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm text-foreground truncate">{(selectedAttribute?.name ?? am.attribute.name)} Modifier</span>
                        )}
                        <span className="text-sm font-semibold text-muted" style={{ opacity: 0.6 }}>
                          {modResult !== null && modResult !== undefined ? `${modResult >= 0 ? '+' : ''}${modResult}` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {sheet.skillValues.length > 0 && (
        <div className="card !p-6">
          <h3 className="font-semibold mb-4">Skills</h3>
          <div className="grid gap-3 sm:grid-cols-2 items-start">
            {sheet.skillValues.map(sv => (
              <CollapsibleSkillRow
                key={sv.id}
                skill={sv}
                result={skillResults[sv.skillId]}
                profiles={allProfiles.filter(p => {
                  const tm = (p as any).targetMode ?? 'ALL_SKILLS'
                  const tids: string[] = (p as any).targetSkillIds ?? []
                  return tm === 'ALL_SKILLS' || tids.length === 0 || tids.includes(sv.skill.name)
                })}
                selections={profileSelections[sv.skillId] || {}}
                active={activeSkills[sv.skillId] ?? false}
                others={othersValues[sv.skillId] ?? 0}
                onToggleActive={() => handleSkillToggle(sv.skillId)}
                onOthersChange={(no) => handleOthersChange(sv.skillId, no)}
                onProfileChange={(pid, oid) => handleProfileChange(sv.skillId, pid, oid)}
                onAttributeChange={(attrId) => handleSkillAttributeChange(sv.skillId, attrId)}
                templateAttributes={sheet.template.attributes}
                expandedSkillId={expandedSkillId}
                onExpandToggle={(id) => setExpandedSkillId(prev => prev === id ? null : id)}
                modifiersEnabled={modifiersEnabled}
              />
            ))}
          </div>
        </div>
      )}

      <div className="text-center">
        <p className="text-xs text-muted">{isOwner ? 'You own this character sheet.' : 'This character sheet belongs to another player.'}</p>
      </div>
    </div>
  )
}
