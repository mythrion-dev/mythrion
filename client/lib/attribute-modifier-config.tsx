'use client'

import { useState, useEffect, useMemo } from 'react'

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

function generateFormula(config: ConfigValues): string {
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

function parseFormula(formula: string): ConfigValues | null {
  if (!formula?.trim()) return null

  const cleaned = formula.replace(/\s+/g, '')

  // Pattern: floor((value - start) / every)
  const floorPattern = /floor\(\(value-(-?\d+)\)\/(-?\d+)\)/
  const floorMatch = cleaned.match(floorPattern)

  if (!floorMatch) return null

  const startingAttribute = parseInt(floorMatch[1], 10)
  const every = parseInt(floorMatch[2], 10)

  if (every <= 0) return null

  // Check for multiplier pattern like "2*floor" or "-2*floor" anywhere in the string
  let modifierIncrease = 1
  const multiplierPattern = /(-?\d+)\*floor/
  const multiplierMatch = cleaned.match(multiplierPattern)

  if (multiplierMatch) {
    const mult = parseInt(multiplierMatch[1], 10)
    if (!isNaN(mult) && mult !== 0) {
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
    const prefixMatch = prefix.match(/^(-?\d+)\s*[+-]?$/)
    if (prefixMatch) {
      modifier = parseInt(prefixMatch[1], 10)
    }
  }

  return { every, modifierIncrease, startingAttribute, modifier }
}

function generateProgression(config: ConfigValues): { attribute: number; modifier: number }[] {
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
    const numValue = parseInt(rawValue, 10)
    if (rawValue === '' || rawValue === '-') {
      // Allow clearing/typing intermediate state
      setConfig(prev => ({ ...prev, [field]: 0 }))
      return
    }
    if (isNaN(numValue)) return

    setConfig(prev => ({ ...prev, [field]: numValue }))
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
            This template uses a custom formula that cannot be represented with the simple configuration.
            You can switch to the simple config, but it will replace your current formula.
          </p>
          <textarea
            className="input-field resize-none font-mono text-sm"
            rows={2}
            value={customFormula}
            onChange={(e) => handleCustomFormulaChange(e.target.value)}
            placeholder={placeholder ?? 'Type formula manually...'}
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
            Switch to Simple Configuration
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-background/30 p-4 space-y-4">
        <h4 className="text-sm font-semibold text-foreground">Attribute Modifier Progression</h4>

        <div className="space-y-3">
          {/* Every N attribute points */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-foreground">Every</span>
            <input
              type="number"
              className="input-field w-20 text-sm text-center"
              value={config.every}
              onChange={(e) => handleConfigChange('every', e.target.value)}
              min={1}
              step={1}
            />
            <span className="text-sm text-foreground">attribute points</span>
          </div>

          {/* Modifier increases by */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-foreground">the modifier increases by</span>
            <input
              type="number"
              className="input-field w-20 text-sm text-center"
              value={config.modifierIncrease}
              onChange={(e) => handleConfigChange('modifierIncrease', e.target.value)}
              step={1}
            />
            <span className="text-sm text-foreground">point(s).</span>
          </div>

          {/* Starting at attribute */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-foreground">Starting at attribute</span>
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
            <span className="text-sm text-foreground">with modifier</span>
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
        {showPreview ? 'Hide Preview' : 'Preview Progression'}
      </button>

      {/* Preview modal/section */}
      {showPreview && (
        <div className="rounded-lg border border-primary/20 bg-background/50 overflow-hidden animate-slide-up">
          <div className="px-4 py-3 border-b border-border bg-background/30">
            <h4 className="text-sm font-semibold text-foreground">Modifier Progression Preview</h4>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background/80">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted uppercase tracking-wider">Attribute</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted uppercase tracking-wider">Modifier</th>
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
              Configure the fields above to see a preview of the modifier progression.
            </div>
          )}
        </div>
      )}
    </div>
  )
}