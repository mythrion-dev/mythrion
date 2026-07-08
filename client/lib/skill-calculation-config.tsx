'use client'

import { useState, useEffect, useMemo } from 'react'
import MythrionPopover from '@/lib/mythrion-popover'

export interface SkillCalculationConfig {
  useAttributeModifier: boolean
  customFieldKeys: string[]
}

interface SkillCalculationConfigProps {
  value: string
  onChange: (configJson: string) => void
  customFields: { key: string; label: string }[]
  placeholder?: string
  /** When true, the "Linked Attribute Modifier" section is disabled because
   *  the global "Enable Attribute Modifiers" feature toggle is off. */
  disabled?: boolean
}

const DEFAULT_CONFIG: SkillCalculationConfig = {
  useAttributeModifier: true,
  customFieldKeys: [],
}

/** Generate a JSON string from the config */
function configToJson(config: SkillCalculationConfig): string {
  return JSON.stringify(config)
}

/** Try to parse a stored value as JSON config; returns null if it's a legacy formula */
function parseConfig(value: string): SkillCalculationConfig | null {
  if (!value?.trim()) return null
  try {
    const parsed = JSON.parse(value)
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.useAttributeModifier === 'boolean' &&
      Array.isArray(parsed.customFieldKeys)
    ) {
      return {
        useAttributeModifier: parsed.useAttributeModifier,
        customFieldKeys: parsed.customFieldKeys.filter(
          (k: unknown) => typeof k === 'string',
        ),
      }
    }
    return null
  } catch {
    return null
  }
}

export default function SkillCalculationConfig({
  value,
  onChange,
  customFields,
  placeholder,
  disabled = false,
}: SkillCalculationConfigProps) {
  const [config, setConfig] = useState<SkillCalculationConfig>(DEFAULT_CONFIG)
  const [showPreview, setShowPreview] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [isLegacyFormula, setIsLegacyFormula] = useState(false)
  const [legacyFormula, setLegacyFormula] = useState('')

  // Parse incoming value on mount and when it changes externally
  useEffect(() => {
    if (!value?.trim()) {
      setConfig(DEFAULT_CONFIG)
      setIsLegacyFormula(false)
      setLegacyFormula('')
      setInitialized(true)
      return
    }

    const parsed = parseConfig(value)
    if (parsed) {
      setConfig(parsed)
      setIsLegacyFormula(false)
      setLegacyFormula('')
      setInitialized(true)
    } else {
      // Legacy formula string - show textarea
      setLegacyFormula(value)
      setIsLegacyFormula(true)
      setInitialized(true)
    }
  }, [value])

  // Generate JSON whenever config changes
  const generatedJson = useMemo(() => configToJson(config), [config])

  // Notify parent of config changes
  useEffect(() => {
    if (!initialized) return
    if (!isLegacyFormula) {
      onChange(generatedJson)
    }
  }, [generatedJson, isLegacyFormula, initialized, onChange])

  // When disabled is activated, force-uncheck the attribute modifier toggle.
  // When re-enabled, the user must manually re-enable — we do NOT restore.
  useEffect(() => {
    if (!initialized) return
    if (disabled && config.useAttributeModifier) {
      setConfig(prev => ({ ...prev, useAttributeModifier: false }))
    }
  }, [disabled, config.useAttributeModifier, initialized])

  const toggleAttributeModifier = () => {
    if (disabled) return
    setConfig(prev => ({
      ...prev,
      useAttributeModifier: !prev.useAttributeModifier,
    }))
  }

  const availableFields = useMemo(() => {
    return customFields.filter(
      f => !config.customFieldKeys.includes(f.key),
    )
  }, [customFields, config.customFieldKeys])

  const selectedFields = useMemo(() => {
    return customFields.filter(f =>
      config.customFieldKeys.includes(f.key),
    )
  }, [customFields, config.customFieldKeys])

  const addCustomField = (key: string) => {
    setConfig(prev => ({
      ...prev,
      customFieldKeys: [...prev.customFieldKeys, key],
    }))
  }

  const removeCustomField = (key: string) => {
    setConfig(prev => ({
      ...prev,
      customFieldKeys: prev.customFieldKeys.filter(k => k !== key),
    }))
  }

  const handleLegacyFormulaChange = (newFormula: string) => {
    setLegacyFormula(newFormula)
    onChange(newFormula)
  }

  // Build the rule description for the preview
  const ruleDescription = useMemo(() => {
    const parts: string[] = []
    if (config.useAttributeModifier) {
      parts.push('Linked Attribute Modifier')
    }
    for (const key of config.customFieldKeys) {
      const field = customFields.find(f => f.key === key)
      parts.push(field?.label ?? key)
    }
    if (parts.length === 0) {
      parts.push('0')
    }
    return parts.join(' + ')
  }, [config, customFields])

  if (!initialized) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse space-y-2">
          <div className="h-9 bg-background/50 rounded-lg" />
          <div className="h-9 bg-background/50 rounded-lg" />
        </div>
      </div>
    )
  }

  if (isLegacyFormula) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs text-amber-400 mb-2">
            This template uses a legacy skill formula that cannot be represented
            with the simple configuration. You can switch to the new config, but
            it will replace your current formula.
          </p>
          <textarea
            className="input-field resize-none font-mono text-sm"
            rows={2}
            value={legacyFormula}
            onChange={(e) => handleLegacyFormulaChange(e.target.value)}
            placeholder={placeholder ?? 'Legacy formula...'}
            spellCheck={false}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => {
              setIsLegacyFormula(false)
              setConfig(DEFAULT_CONFIG)
              onChange(configToJson(DEFAULT_CONFIG))
            }}
            className="btn-ghost text-xs mt-2"
            disabled={disabled}
          >
            Switch to Simple Configuration
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="rounded-lg border border-border bg-background/30 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-foreground">Skill Calculation</h4>
          <MythrionPopover
            side="top"
            align="center"
            content={
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-primary">How does this work?</h5>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Every skill value is calculated by adding the components you select below.
                  This rule is applied globally to all skills in this template.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="text-foreground font-medium">Linked Attribute Modifier</span> automatically resolves to the modifier of the attribute assigned to each skill (e.g., Athletics → Strength Modifier).
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="text-foreground font-medium">Custom Fields</span> let you include values like Proficiency Bonus, Equipment Bonus, etc. in every skill calculation.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You only configure this once, and every skill will use the same calculation automatically.
                </p>
              </div>
            }
          >
            <div className="w-5 h-5 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center text-[0.65rem] text-primary font-bold leading-none hover:bg-primary/20 hover:border-primary/50 transition-colors select-none">
              ?
            </div>
          </MythrionPopover>
        </div>

        <p className="text-xs text-muted-foreground">
          Every skill value is calculated by adding:
        </p>

        <div className="space-y-3">
          {/* Linked Attribute Modifier toggle */}
          <div className="flex items-center gap-3">
            <label className={`flex items-center gap-2 text-sm text-foreground select-none ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-primary"
                checked={config.useAttributeModifier}
                onChange={toggleAttributeModifier}
                disabled={disabled}
              />
              <span>Linked Attribute Modifier</span>
            </label>
            <span className="text-xs text-muted">
              (e.g., Athletics → Strength Modifier)
            </span>
          </div>

          {/* Selected custom fields */}
          {selectedFields.length > 0 && (
            <div className="space-y-1.5 pl-6 border-l-2 border-primary/20">
              {selectedFields.map(field => (
                <div
                  key={field.key}
                  className="flex items-center gap-2 py-1 px-2 rounded bg-background/50 border border-border/50"
                >
                  <span className="text-sm text-foreground flex-1">
                    {field.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCustomField(field.key)}
                    className="text-xs text-danger hover:text-danger/80 transition-colors shrink-0"
                    disabled={disabled}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add custom field */}
          {availableFields.length > 0 && (
            <div className="pl-6">
              <div className="flex items-center gap-2">
                <select
                  className="input-field text-xs flex-1"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addCustomField(e.target.value)
                    e.target.value = ''
                  }}
                  disabled={disabled}
                >
                  <option value="">+ Add Custom Field</option>
                  {availableFields.map(f => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {customFields.length === 0 && (
            <p className="text-xs text-muted italic pl-6">
              Add custom fields to the template first, then come back to include them in the skill calculation.
            </p>
          )}
        </div>
      </div>

      {/* Preview button */}
      <button
        type="button"
        onClick={() => setShowPreview(!showPreview)}
        className="btn-ghost text-sm w-full"
        disabled={disabled}
      >
        {showPreview ? 'Hide Preview' : 'Preview Calculation'}
      </button>

      {/* Preview section */}
      {showPreview && (
        <div className="rounded-lg border border-primary/20 bg-background/50 overflow-hidden animate-slide-up">
          <div className="px-4 py-3 border-b border-border bg-background/30">
            <h4 className="text-sm font-semibold text-foreground">Global Rule</h4>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              Skill = {ruleDescription}
            </p>
          </div>
          <div className="p-4 space-y-3">
            <h5 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Example results
            </h5>
            <p className="text-xs text-muted-foreground">
              The examples below show how the global rule applies to each skill
              based on its linked attribute. Actual values depend on attribute
              scores and custom field values.
            </p>
            <div className="space-y-2">
              <div className="rounded-lg bg-background/50 border border-border/50 p-3">
                <p className="text-xs text-foreground font-medium">Athletics</p>
                <p className="text-xs text-muted mt-1 font-mono">
                  = Strength Modifier
                  {config.customFieldKeys.length > 0 &&
                    ' + ' +
                    selectedFields.map(f => f.label).join(' + ')}
                </p>
              </div>
              <div className="rounded-lg bg-background/50 border border-border/50 p-3">
                <p className="text-xs text-foreground font-medium">Stealth</p>
                <p className="text-xs text-muted mt-1 font-mono">
                  = Dexterity Modifier
                  {config.customFieldKeys.length > 0 &&
                    ' + ' +
                    selectedFields.map(f => f.label).join(' + ')}
                </p>
              </div>
              <div className="rounded-lg bg-background/50 border border-border/50 p-3">
                <p className="text-xs text-foreground font-medium">Arcana</p>
                <p className="text-xs text-muted mt-1 font-mono">
                  = Intelligence Modifier
                  {config.customFieldKeys.length > 0 &&
                    ' + ' +
                    selectedFields.map(f => f.label).join(' + ')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}