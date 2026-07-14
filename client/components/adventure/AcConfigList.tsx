'use client'

import type { AcConfigDraft, ArmorClassAttributeModifierDraft } from '@/app/dashboard/adventures/[id]/page'

export function AcConfigList(props: {
  configs?: AcConfigDraft[]
  attrs?: { key: string; name: string }[]
  attrModifiersEnabled?: boolean
  onAdd?: () => void
  onRemove?: (i: number) => void
  onUpdateConfig?: (i: number, patch: Partial<AcConfigDraft>) => void
  onAddField?: (configIdx: number) => void
  onRemoveField?: (configIdx: number, fieldIdx: number) => void
  onUpdateField?: (configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) => void
  onUpdateFieldEditable?: (configIdx: number, fieldIdx: number, v: boolean) => void
  onToggleAttributeId?: (configIdx: number, attrId: string) => void
  onUpdateAttributeModifier?: (configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) => void
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
  return (
    <div className="space-y-4">
      {configs.map((ac, ci) => (
        <div key={ci} className="rounded-lg border border-border bg-background/30 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <input className="input-field flex-1 text-sm" value={ac.name} onChange={e => onUpdateConfig(ci, { name: e.target.value })} placeholder="AC Name (e.g. Standard Armor)" />
            <label className="flex items-center gap-1 text-xs text-muted shrink-0">
              <input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={ac.enabled} onChange={e => onUpdateConfig(ci, { enabled: e.target.checked })} />Enabled
            </label>
            <button type="button" onClick={() => onRemove(ci)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button>
          </div>

          {ac.enabled && (
            <div className="space-y-2 pl-2">
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">AC Components</label>
                <div className="space-y-1">
                  {ac.fields.map((f, fi) => (
                    <div key={fi} className="rounded border border-border/50 bg-background/20 p-2 space-y-1">
                      <div className="flex items-center gap-1">
                        <input className="input-field flex-1 text-xs" value={f.name} onChange={e => onUpdateField(ci, fi, 'name', e.target.value)} placeholder="Field name (e.g. Shield)" />
                        <input className="input-field flex-1 text-xs" value={f.key} onChange={e => onUpdateField(ci, fi, 'key', e.target.value)} placeholder="Key (e.g. shield)" />
                        <button type="button" onClick={() => onRemoveField(ci, fi)} className="text-xs text-danger hover:text-danger/80 shrink-0">✕</button>
                      </div>
                      <div className="flex items-center gap-1">
                        <input className="input-field flex-1 text-xs" value={f.defaultValue} onChange={e => onUpdateField(ci, fi, 'defaultValue', e.target.value)} placeholder="Default value" />
                        <input className="input-field flex-1 text-xs" value={f.description} onChange={e => onUpdateField(ci, fi, 'description', e.target.value)} placeholder="Description (optional)" />
                        <label className="flex items-center gap-1 text-xs text-muted shrink-0">
                          <input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={f.editableByPlayer} onChange={e => onUpdateFieldEditable(ci, fi, e.target.checked)} />Editable
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => onAddField(ci)} className="btn-ghost text-xs mt-1">+ Add AC Component</button>
              </div>

              {attrModifiersEnabled ? (
                <div>
                  <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 block">Attribute Modifiers</label>
                  <div className="space-y-1 mb-2">
                    {attrs.filter(a => a.key.trim() && a.name.trim()).map(attr => (
                      <label key={attr.key} className="flex items-center gap-2 text-xs text-foreground py-1 cursor-pointer">
                        <input type="checkbox" className="w-3 h-3 rounded accent-primary" checked={ac.attributeModifiers.some(am => am.attributeId === attr.key.trim())} onChange={() => onToggleAttributeId(ci, attr.key.trim())} />
                        <span>{attr.name.trim()} Modifier</span>
                      </label>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {ac.attributeModifiers.map(am => {
                      const defaultAttributeId = am.defaultAttributeId || am.attributeId
                      return (
                        <div key={am.attributeId} className="rounded border border-border/50 bg-background/20 p-2 space-y-2">
                          <div>
                            <label className="text-[0.65rem] font-semibold text-muted uppercase tracking-wider mb-1 block">Attribute</label>
                            <select className="input-field text-xs" value={am.attributeId} onChange={e => onUpdateAttributeModifier(ci, am.attributeId, { attributeId: e.target.value, defaultAttributeId: e.target.value })}>
                              {attrs.filter(a => a.key.trim() && a.name.trim()).map(attr => <option key={attr.key} value={attr.key.trim()}>{attr.name.trim()}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[0.65rem] font-semibold text-muted uppercase tracking-wider mb-1 block">Player Selection</label>
                            <div className="space-y-1">
                              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer"><input type="radio" className="w-3 h-3 accent-primary" checked={!am.allowPlayerSelection} onChange={() => onUpdateAttributeModifier(ci, am.attributeId, { allowPlayerSelection: false })} />Fixed</label>
                              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer"><input type="radio" className="w-3 h-3 accent-primary" checked={am.allowPlayerSelection} onChange={() => onUpdateAttributeModifier(ci, am.attributeId, { allowPlayerSelection: true, defaultAttributeId })} />Player Can Change</label>
                            </div>
                          </div>
                          {am.allowPlayerSelection && (
                            <div>
                              <label className="text-[0.65rem] font-semibold text-muted uppercase tracking-wider mb-1 block">Default Attribute</label>
                              <select className="input-field text-xs" value={defaultAttributeId} onChange={e => onUpdateAttributeModifier(ci, am.attributeId, { defaultAttributeId: e.target.value })}>
                                {attrs.filter(a => a.key.trim() && a.name.trim()).map(attr => <option key={attr.key} value={attr.key.trim()}>{attr.name.trim()}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted italic">Attribute Modifiers are disabled globally.</p>
              )}
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={onAdd} className="btn-ghost text-xs">+ Add Armor Class Configuration</button>
    </div>
  )
}
