'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import MythrionPopover from '@/lib/mythrion-popover'

interface AttributeModifierConfigProps {
  value: string
  onChange: (formula: string) => void
  placeholder?: string
}

interface ConfigValues {
  every: number
  modifierIncrease: number
  startingAttribute: number
  modifier: number
}

const DEFAULT_CONFIG: ConfigValues = {
  every: 2,
  modifierIncrease: 1,
  startingAttribute: 10,
  modifier: 0,
}

export function generateFormula(config: ConfigValues): string {
  const { every, modifierIncrease, startingAttribute, modifier } = config
  if (every <= 0) return '0'

  const divPart = `floor((value - ${startingAttribute}) / ${every})`
  const needsMultiplier = modifierIncrease !== 1
  const incTerm = needsMultiplier ? `${modifierIncrease} * ${divPart}` : divPart

  // If base modifier is 0, just return the increment term
  if (modifier === 0) return incTerm

  // Full formula: modifier + modifierIncrease * floor(...)
  // Use the sign of the modifier to determine the operator
  if (modifier > 0) {
    return `${modifier} + ${incTerm}`
  }
  // modifier is negative: e.g., -5 + floor(...) is correct
  return `${modifier} + ${incTerm}`
}

export function parseFormula(formula: string): ConfigValues | null {
  if (!formula?.trim()) return null

  const cleaned = formula.replace(/\s+/g, '')

  // Pattern: floor((value - start) / every)
  const floorPattern = /floor\(\(value-(-?\d+)\)\/(-?\d+)\)/
  const floorMatch = cleaned.match(floorPattern)

  if (!floorMatch) return null

  const startingAttribute = Number.parseInt(floorMatch[1], 10)
  const every = Number.parseInt(floorMatch[2], 10)

  if (every <= 0) return null

  // Check for multiplier pattern like "2*floor" or "-2*floor" anywhere in the string
  let modifierIncrease = 1
  const multiplierPattern = /(-?\d+)\*floor/
  const multiplierMatch = cleaned.match(multiplierPattern)

  if (multiplierMatch) {
    const mult = Number.parseInt(multiplierMatch[1], 10)
    if (!Number.isNaN(mult) && mult !== 0) {
      modifierIncrease = mult
    }
  }

  // Determine the base modifier: extract the part before the floor expression
  // The formula looks like: modifier +/- multiplier*floor(...)
  // or just: floor(...) or multiplier*floor(...)
  let modifier = 0
  const floorExprStart = cleaned.indexOf('floor')
  if (floorExprStart > 0) {
    const prefix = cleaned.substring(0, floorExprStart)
    // The prefix should be like "5+" or "-5+" or "5" which is incomplete but handle common cases
    // Match pattern: optional number, optional sign
    // The prefix may have a multiplier before floor, e.g. "5+3*" or "-2+1*".
    // Only match the base modifier (the leading number and its sign operator).
    const prefixMatch = prefix.match(/^(-?\d+)\s*[+-]/)
    if (prefixMatch) {
      modifier = Number.parseInt(prefixMatch[1], 10)
    }
  }

  return { every, modifierIncrease, startingAttribute, modifier }
}

export function generateProgression(config: ConfigValues): { attribute: number; modifier: number }[] {
  const { every, modifierIncrease, startingAttribute, modifier } = config
  if (every <= 0) return []

  const rows: { attribute: number; modifier: number }[] = []
  // Generate a range from startingAttribute - 10 to startingAttribute + 10
  const minAttr = Math.min(1, startingAttribute - 10)
  const maxAttr = startingAttribute + 10

  for (let attr = minAttr; attr <= maxAttr; attr++) {
    const offset = Math.floor((attr - startingAttribute) / every)
    const mod = modifier + modifierIncrease * offset
    rows.push({ attribute: attr, modifier: mod })
  }

  return rows
}

export default function AttributeModifierConfig({
  value,
  onChange,
  placeholder,
}: AttributeModifierConfigProps) {
  const { t } = useTranslation()
  const [config, setConfig] = useState<ConfigValues>(DEFAULT_CONFIG)
  const [showPreview, setShowPreview] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [isCustomFormula, setIsCustomFormula] = useState(false)
  const [customFormula, setCustomFormula] = useState('')

  // Parse incoming formula on mount and when value changes externally
  useEffect(() => {
    if (!value?.trim()) {
      setConfig(DEFAULT_CONFIG)
      setIsCustomFormula(false)
      setCustomFormula('')
      setInitialized(true)
      return
    }

    const parsed = parseFormula(value)
    if (parsed) {
      setConfig(parsed)
      setIsCustomFormula(false)
      setCustomFormula('')
      setInitialized(true)
    } else {
      // Existing non-standard formula - show custom mode
      setCustomFormula(value)
      setIsCustomFormula(true)
      setInitialized(true)
    }
  }, [value])

  // Generate formula whenever config changes
  const generatedFormula = useMemo(() => generateFormula(config), [config])

  // Notify parent of formula changes
  useEffect(() => {
    if (!initialized) return
    if (!isCustomFormula) {
      onChange(generatedFormula)
    }
  }, [generatedFormula, isCustomFormula, initialized, onChange])

  const handleConfigChange = (field: keyof ConfigValues, rawValue: string) => {
    const numValue = Number.parseInt(rawValue, 10)
    if (rawValue === '' || rawValue === '-') {
      // Allow clearing/typing intermediate state; enforce min of 1 for 'every'
      setConfig(prev => ({ ...prev, [field]: field === 'every' ? 1 : 0 }))
      return
    }
    if (Number.isNaN(numValue)) return

    // Enforce min of 1 for 'every'
    const clamped = field === 'every' ? Math.max(1, numValue) : numValue
    setConfig(prev => ({ ...prev, [field]: clamped }))
  }

  const handleSwitchToCustom = () => {
    setIsCustomFormula(true)
    setCustomFormula(generatedFormula)
    onChange(generatedFormula)
  }

  const handleCustomFormulaChange = (newFormula: string) => {
    setCustomFormula(newFormula)
    onChange(newFormula)
  }

  const progression = useMemo(() => {
    if (isCustomFormula) return []
    return generateProgression(config)
  }, [config, isCustomFormula])

  const formatModifier = (mod: number): string => {
    if (mod > 0) return `+${mod}`
    return `${mod}`
  }

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

  if (isCustomFormula) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs text-amber-400 mb-2">
            {t('campaign:attrModifierCustomFormulaWarning')}
          </p>
          <textarea
            className="input-field resize-none font-mono text-sm"
            rows={2}
            value={customFormula}
            onChange={(e) => handleCustomFormulaChange(e.target.value)}
            placeholder={placeholder ?? t('templates:formulaPlaceholder')}
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => {
              setIsCustomFormula(false)
              setConfig(DEFAULT_CONFIG)
              onChange(generateFormula(DEFAULT_CONFIG))
            }}
            className="btn-ghost text-xs mt-2"
          >
            {t('campaign:switchToSimpleConfig')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-background/30 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-foreground">{t('campaign:attrModifierProgression')}</h4>
          <MythrionPopover
            side="top"
            align="center"
            content={
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-primary">{t('campaign:howDoesThisWork')}</h5>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('campaign:attrModifierProgressionHelp')}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="text-foreground font-medium">{t('campaign:exampleColon')}</span>{' '}
                  <Trans i18nKey="campaign:attrModifierProgressionExample" values={{ every: 5, increase: 1, start: 10, base: 0 }} components={[<strong key="a" className="text-foreground font-medium" />]} />
                </p>
                <ul className="space-y-0.5 pl-3 border-l-2 border-primary/20">
                  {[
                    { range: '10–14', mod: '0' },
                    { range: '15–19', mod: '+1' },
                    { range: '20–24', mod: '+2' },
                    { range: '25–29', mod: '+3' },
                  ].map(row => (
                    <li key={row.range} className="text-xs text-muted-foreground">
                      <Trans i18nKey="campaign:attrModifierExampleRow" values={{ range: row.range, mod: row.mod }} components={[<strong key="a" className="font-medium text-foreground" />, <span key="b" className="text-foreground" />]} />
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('campaign:attrModifierProgressionFootnote')}
                </p>
              </div>
            }
          >
            <div className="w-5 h-5 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center text-[0.65rem] text-primary font-bold leading-none hover:bg-primary/20 hover:border-primary/50 transition-colors select-none">
              ?
            </div>
          </MythrionPopover>
        </div>

        <div className="space-y-3">
          {/* Every N attribute points */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-foreground">{t('campaign:every')}</span>
            <input
              type="number"
              className="input-field w-20 text-sm text-center"
              value={config.every}
              onChange={(e) => handleConfigChange('every', e.target.value)}
              min={1}
              step={1}
            />
            <span className="text-sm text-foreground">{t('campaign:attributePoints')}</span>
          </div>

          {/* Modifier increases by */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-foreground">{t('campaign:modifierIncreasesBy')}</span>
            <input
              type="number"
              className="input-field w-20 text-sm text-center"
              value={config.modifierIncrease}
              onChange={(e) => handleConfigChange('modifierIncrease', e.target.value)}
              min={1}
              step={1}
            />
            <span className="text-sm text-foreground">{t('campaign:pointSuffix')}</span>
          </div>

          {/* Starting at attribute */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-foreground">{t('campaign:startingAtAttribute')}</span>
            <input
              type="number"
              className="input-field w-20 text-sm text-center"
              value={config.startingAttribute}
              onChange={(e) => handleConfigChange('startingAttribute', e.target.value)}
              step={1}
            />
          </div>

          {/* With modifier */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-foreground">{t('campaign:withModifier')}</span>
            <input
              type="number"
              className="input-field w-20 text-sm text-center"
              value={config.modifier}
              onChange={(e) => handleConfigChange('modifier', e.target.value)}
              step={1}
            />
          </div>
        </div>

      </div>

      {/* Preview button */}
      <button
        type="button"
        onClick={() => setShowPreview(!showPreview)}
        className="btn-ghost text-sm w-full"
      >
        {showPreview ? t('campaign:hidePreview') : t('campaign:previewProgression')}
      </button>

      {/* Preview modal/section */}
      {showPreview && (
        <div className="rounded-lg border border-primary/20 bg-background/50 overflow-hidden animate-slide-up">
          <div className="px-4 py-3 border-b border-border bg-background/30">
            <h4 className="text-sm font-semibold text-foreground">{t('campaign:attrModifierProgressionPreview')}</h4>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background/80">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted uppercase tracking-wider">{t('campaign:attribute')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted uppercase tracking-wider">{t('campaign:modifier')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {progression.map((row) => (
                  <tr key={row.attribute} className="hover:bg-background/30 transition-colors">
                    <td className="px-4 py-1.5 text-foreground">{row.attribute}</td>
                    <td className="px-4 py-1.5 font-medium text-foreground">{formatModifier(row.modifier)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {progression.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted italic">
              {t('campaign:attrModifierPreviewEmpty')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}