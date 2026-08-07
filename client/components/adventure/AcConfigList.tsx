'use client'

import { useTranslation } from 'react-i18next'
import { Select } from '@/components/shared/Select'
import type { AcConfigDraft, ArmorClassAttributeModifierDraft } from '@/components/adventure/types'

/* Stable keys for draft items that have no id field of their own. */
const draftKeyCache = new WeakMap<object, string>()
function draftKey(obj: object): string {
  let key = draftKeyCache.get(obj)
  if (!key) {
    key = Math.random().toString(36).slice(2)
    draftKeyCache.set(obj, key)
  }
  return key
}

export function AcConfigList(props: {
  readonly configs?: AcConfigDraft[]
  readonly attrs?: { key: string; name: string }[]
  readonly attrModifiersEnabled?: boolean
  readonly onAdd?: () => void
  readonly onRemove?: (i: number) => void
  readonly onUpdateConfig?: (i: number, patch: Partial<AcConfigDraft>) => void
  readonly onAddField?: (configIdx: number) => void
  readonly onRemoveField?: (configIdx: number, fieldIdx: number) => void
  readonly onUpdateField?: (configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) => void
  readonly onUpdateFieldEditable?: (configIdx: number, fieldIdx: number, v: boolean) => void
  readonly onToggleAttributeId?: (configIdx: number, attrId: string) => void
  readonly onUpdateAttributeModifier?: (configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) => void
}) {
  const configs = props.configs ?? []
  const attrs = props.attrs ?? []
  const attrModifiersEnabled = props.attrModifiersEnabled ?? false
  const onAdd = props.onAdd ?? (() => { })
  const onRemove = props.onRemove ?? (() => { })
  const onUpdateConfig = props.onUpdateConfig ?? (() => { })
  const onAddField = props.onAddField ?? (() => { })
  const onRemoveField = props.onRemoveField ?? (() => { })
  const onUpdateField = props.onUpdateField ?? (() => { })
  const onUpdateFieldEditable = props.onUpdateFieldEditable ?? (() => { })
  const onToggleAttributeId = props.onToggleAttributeId ?? (() => { })
  const onUpdateAttributeModifier = props.onUpdateAttributeModifier ?? (() => { })
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      {configs.map((ac, ci) => (
        <div key={draftKey(ac)} className="rounded-lg border border-border bg-background/30 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <input className="input-field flex-1 text-sm" value={ac.name} onChange={e => onUpdateConfig(ci, { name: e.target.value })} placeholder={t('campaign:acNamePlaceholder')} />
            <label className="flex items-center gap-1 text-xs text-muted shrink-0">
              <input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={ac.enabled} onChange={e => onUpdateConfig(ci, { enabled: e.target.checked })} />{t('campaign:enabled')}
            </label>
            <button type="button" onClick={() => onRemove(ci)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button>
          </div>

          {ac.enabled && (
            <div className="space-y-2 pl-2">
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">{t('campaign:acComponents')}</label>
                <div className="space-y-1">
                  {ac.fields.map((f, fi) => (
                    <div key={draftKey(f)} className="rounded border border-border/50 bg-background/20 p-2 space-y-1">
                      <div className="flex items-center gap-1">
                        <input className="input-field flex-1 text-xs" value={f.name} onChange={e => onUpdateField(ci, fi, 'name', e.target.value)} placeholder={t('campaign:fieldNamePlaceholder')} />
                        <input className="input-field flex-1 text-xs" value={f.key} onChange={e => onUpdateField(ci, fi, 'key', e.target.value)} placeholder={t('campaign:fieldKeyPlaceholder')} />
                        <button type="button" onClick={() => onRemoveField(ci, fi)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button>
                      </div>
                      <div className="flex items-center gap-1">
                        <input className="input-field flex-1 text-xs" value={f.defaultValue} onChange={e => onUpdateField(ci, fi, 'defaultValue', e.target.value)} placeholder={t('campaign:defaultValue')} />
                        <input className="input-field flex-1 text-xs" value={f.description} onChange={e => onUpdateField(ci, fi, 'description', e.target.value)} placeholder={t('campaign:descriptionOptional')} />
                        <label className="flex items-center gap-1 text-xs text-muted shrink-0">
                          <input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={f.editableByPlayer} onChange={e => onUpdateFieldEditable(ci, fi, e.target.checked)} />{t('campaign:editable')}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => onAddField(ci)} className="btn-ghost text-xs mt-1">{t('campaign:addAcComponent')}</button>
              </div>

              {attrModifiersEnabled ? (
                <div>
                  <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">{t('campaign:attributeModifiers')}</label>
                  <div className="space-y-1 mb-2">
                    {attrs.filter(a => a.key.trim() && a.name.trim()).map(attr => (
                      <label key={attr.key} className="flex items-center gap-2 text-xs text-foreground py-1 cursor-pointer">
                        <input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={ac.attributeModifiers.some(am => am.attributeId === attr.key.trim())} onChange={() => onToggleAttributeId(ci, attr.key.trim())} />
                        <span>{t('campaign:attributeModifierSuffix', { name: attr.name.trim() })}</span>
                      </label>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {ac.attributeModifiers.map(am => {
                      const defaultAttributeId = am.defaultAttributeId || am.attributeId
                      return (
                        <div key={am.attributeId} className="rounded border border-border/50 bg-background/20 p-2 space-y-2">
                          <div>
                            <label className="text-[0.65rem] font-semibold text-muted uppercase tracking-wider mb-1 block">{t('campaign:attribute')}</label>
                            <Select
                              options={attrs.filter(a => a.key.trim() && a.name.trim()).map(attr => ({ id: attr.key.trim(), label: attr.name.trim() }))}
                              value={am.attributeId}
                              onChange={val => onUpdateAttributeModifier(ci, am.attributeId, { attributeId: val, defaultAttributeId: val })}
                              size="sm"
                              className="text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[0.65rem] font-semibold text-muted uppercase tracking-wider mb-1 block">{t('campaign:playerSelection')}</label>
                            <div className="space-y-1">
                              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer"><input type="radio" className="w-3 h-3 accent-primary" checked={!am.allowPlayerSelection} onChange={() => onUpdateAttributeModifier(ci, am.attributeId, { allowPlayerSelection: false })} />{t('campaign:fixed')}</label>
                              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer"><input type="radio" className="w-3 h-3 accent-primary" checked={am.allowPlayerSelection} onChange={() => onUpdateAttributeModifier(ci, am.attributeId, { allowPlayerSelection: true, defaultAttributeId })} />{t('campaign:playerCanChange')}</label>
                            </div>
                          </div>
                          {am.allowPlayerSelection && (
                            <div>
                              <label className="text-[0.65rem] font-semibold text-muted uppercase tracking-wider mb-1 block">{t('campaign:defaultAttribute')}</label>
                              <Select
                                options={attrs.filter(a => a.key.trim() && a.name.trim()).map(attr => ({ id: attr.key.trim(), label: attr.name.trim() }))}
                                value={defaultAttributeId}
                                onChange={val => onUpdateAttributeModifier(ci, am.attributeId, { defaultAttributeId: val })}
                                size="sm"
                                className="text-xs"
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted italic">{t('campaign:attributeModifiersDisabledGlobally')}</p>
              )}
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={onAdd} className="btn-ghost text-xs">{t('campaign:addArmorClassConfig')}</button>
    </div>
  )
}
