'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import MythrionPopover from '@/lib/mythrion-popover'

export interface SkillCalculationConfig {
  useAttributeModifier: boolean
  customFieldKeys: string[]
}

interface SkillCalculationConfigProps {
  readonly value: string
  readonly onChange: (configJson: string) => void
  readonly customFields: { key: string; label: string }[]
  readonly placeholder?: string
  /** When true, the "Linked Attribute Modifier" section is disabled because
   *  the global "Enable Attribute Modifiers" feature toggle is off. */
  readonly disabled?: boolean
}

const DEFAULT_CONFIG: SkillCalculationConfig = {
  useAttributeModifier: true,
  customFieldKeys: [],
}

/** Generate a JSON string from the config */
export function configToJson(config: SkillCalculationConfig): string {
  return JSON.stringify(config)
}

/** Try to parse a stored value as JSON config; returns null if it's a legacy formula */
export function parseConfig(value: string): SkillCalculationConfig | null {
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
  const { t } = useTranslation()
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
      parts.push(t('campaign:linkedAttributeModifier'))
    }
    for (const key of config.customFieldKeys) {
      const field = customFields.find(f => f.key === key)
      parts.push(field?.label ?? key)
    }
    if (parts.length === 0) {
      parts.push('0')
    }
    return parts.join(' + ')
  }, [config, customFields, t])

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
            {t('campaign:skillLegacyFormulaWarning')}
          </p>
          <textarea
            className="input-field resize-none font-mono text-sm"
            rows={2}
            value={legacyFormula}
            onChange={(e) => handleLegacyFormulaChange(e.target.value)}
            placeholder={placeholder ?? t('campaign:legacyFormulaPlaceholder')}
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
            {t('campaign:switchToSimpleConfig')}
          </button>
        </div>
      </div>
    )
  }

  if (disabled) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-amber-300/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <h4 className="text-sm font-semibold text-amber-300/90">{t('campaign:skillCalculation')}</h4>
          </div>
          <p className="text-xs text-amber-300/80 leading-relaxed">
            {t('campaign:skillCalcDisabledInfo')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-background/30 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-foreground">{t('campaign:skillCalculation')}</h4>
          <MythrionPopover
            side="top"
            align="center"
            content={
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-primary">{t('campaign:howDoesThisWork')}</h5>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('campaign:skillCalcPopoverIntro')}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <Trans i18nKey="campaign:skillCalcPopoverLinked" values={{ name: t('campaign:linkedAttributeModifier') }} components={[<span key="a" className="text-foreground font-medium" />]} />
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <Trans i18nKey="campaign:skillCalcPopoverCustomFields" values={{ name: t('campaign:customFields') }} components={[<span key="a" className="text-foreground font-medium" />]} />
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('campaign:skillCalcPopoverFootnote')}
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
          {t('campaign:skillCalcAdding')}
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
              <span>{t('campaign:linkedAttributeModifier')}</span>
            </label>
            <span className="text-xs text-muted">
              {t('campaign:linkedAttributeModifierExample')}
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

          {/* Add Character Info */}
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
                  <option value="">{t('campaign:addCharacterInfo')}</option>
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
              {t('campaign:addCharacterInfosFirst')}
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
        {showPreview ? t('campaign:hidePreview') : t('campaign:previewCalculation')}
      </button>

      {/* Preview section */}
      {showPreview && (
        <div className="rounded-lg border border-primary/20 bg-background/50 overflow-hidden animate-slide-up">
          <div className="px-4 py-3 border-b border-border bg-background/30">
            <h4 className="text-sm font-semibold text-foreground">{t('campaign:globalRule')}</h4>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {t('campaign:skillEquals', { rule: ruleDescription })}
            </p>
          </div>
          <div className="p-4 space-y-3">
            <h5 className="text-xs font-semibold text-muted uppercase tracking-wider">
              {t('campaign:exampleResults')}
            </h5>
            <p className="text-xs text-muted-foreground">
              {t('campaign:skillCalcExampleDescription')}
            </p>
            <div className="space-y-2">
              <div className="rounded-lg bg-background/50 border border-border/50 p-3">
                <p className="text-xs text-foreground font-medium">{t('campaign:exampleAthletics')}</p>
                <p className="text-xs text-muted mt-1 font-mono">
                  = {t('campaign:strengthModifier')}
                  {config.customFieldKeys.length > 0 &&
                    ' + ' +
                    selectedFields.map(f => f.label).join(' + ')}
                </p>
              </div>
              <div className="rounded-lg bg-background/50 border border-border/50 p-3">
                <p className="text-xs text-foreground font-medium">{t('campaign:exampleStealth')}</p>
                <p className="text-xs text-muted mt-1 font-mono">
                  = {t('campaign:dexterityModifier')}
                  {config.customFieldKeys.length > 0 &&
                    ' + ' +
                    selectedFields.map(f => f.label).join(' + ')}
                </p>
              </div>
              <div className="rounded-lg bg-background/50 border border-border/50 p-3">
                <p className="text-xs text-foreground font-medium">{t('campaign:exampleArcana')}</p>
                <p className="text-xs text-muted mt-1 font-mono">
                  = {t('campaign:intelligenceModifier')}
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