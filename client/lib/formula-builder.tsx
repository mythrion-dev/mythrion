'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '@/lib/api'

interface FormulaBuilderProps {
  value: string
  onChange: (formula: string) => void
  attributes: { key: string; name: string }[]
  placeholder?: string
}

const OPERATORS = [
  { label: '+', value: '+' },
  { label: '−', value: '-' },
  { label: '×', value: '*' },
  { label: '÷', value: '/' },
  { label: '(', value: '(' },
  { label: ')', value: ')' },
  { label: '^', value: '^' },
]

const FUNCTIONS = [
  { label: 'Round Down', value: 'floor()', display: 'floor()' },
  { label: 'Round Up', value: 'ceil()', display: 'ceil()' },
  { label: 'Round', value: 'round()', display: 'round()' },
  { label: 'Maximum', value: 'max()', display: 'max(,)' },
  { label: 'Minimum', value: 'min()', display: 'min(,)' },
  { label: 'Absolute', value: 'abs()', display: 'abs()' },
]

export default function FormulaBuilder({
  value,
  onChange,
  attributes,
  placeholder = 'Build formula...',
}: FormulaBuilderProps) {
  const [preview, setPreview] = useState<{ result: number | null; error?: string }>({ result: null })
  const [showVariables, setShowVariables] = useState(true)
  const [showFunctions, setShowFunctions] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = value.substring(0, start)
    const after = value.substring(end)
    const newValue = before + text + after

    onChange(newValue)

    // Restore cursor position after React re-render
    setTimeout(() => {
      textarea.focus()
      const pos = start + text.length
      textarea.selectionStart = pos
      textarea.selectionEnd = pos
    }, 0)
  }

  const insertVariable = (key: string) => {
    insertAtCursor(key)
  }

  const insertOperator = (op: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    // If there's selected text, wrap it
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    if (start !== end && op === '(') {
      const selected = value.substring(start, end)
      onChange(value.substring(0, start) + '(' + selected + ')' + value.substring(end))
      return
    }

    insertAtCursor(op)
  }

  const handleChange = (newValue: string) => {
    onChange(newValue)
  }

  // Debounced preview
  const updatePreview = useCallback(async (formula: string) => {
    if (!formula.trim()) {
      setPreview({ result: null })
      return
    }

    if (attributes.length === 0) {
      setPreview({ result: null })
      return
    }

    // Create dummy variables with 0 values for preview
    const variables: Record<string, number> = {}
    attributes.forEach((a) => {
      variables[a.key] = 0
    })

    try {
      const data = await api.post<{ result: number }>('/formula/preview', {
        formula,
        variables,
      })
      setPreview({ result: data.result })
    } catch (err) {
      setPreview({
        result: null,
        error: err instanceof Error ? err.message : 'Evaluation failed',
      })
    }
  }, [attributes])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updatePreview(value)
    }, 500)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, updatePreview])

  return (
    <div className="space-y-3">
      {/* Formula input */}
      <textarea
        ref={textareaRef}
        className="input-field resize-none font-mono text-sm"
        rows={2}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
      />

      {/* Formula preview */}
      {value.trim() && (
        <div className="rounded-lg bg-background/60 border border-border px-3 py-2 text-xs space-y-1">
          <div>
            <span className="text-muted">Preview: </span>
            <span className="font-mono text-foreground">{value}</span>
          </div>
          {preview.error ? (
            <div className="text-danger">{preview.error}</div>
          ) : preview.result !== null ? (
            <div>
              <span className="text-muted">Result (with 0 values): </span>
              <span className="font-mono font-semibold text-primary">{preview.result}</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Toggle buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setShowVariables(!showVariables)
            setShowFunctions(false)
          }}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            showVariables ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted hover:text-foreground'
          }`}
        >
          Attributes
        </button>
        <button
          type="button"
          onClick={() => {
            setShowFunctions(!showFunctions)
            setShowVariables(false)
          }}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            showFunctions ? 'bg-primary/15 text-primary border border-primary/20' : 'text-muted hover:text-foreground'
          }`}
        >
          Functions
        </button>
      </div>

      {/* Variable buttons */}
      {showVariables && attributes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {attributes.map((attr) => (
            <button
              key={attr.key}
              type="button"
              onClick={() => insertVariable(attr.key)}
              className="px-2 py-1 rounded bg-background/60 border border-border text-xs text-foreground hover:border-primary/30 hover:text-primary transition-colors"
              title={`Insert ${attr.key}`}
            >
              [{attr.name}]
            </button>
          ))}
        </div>
      )}

      {/* Function buttons */}
      {showFunctions && (
        <div className="flex flex-wrap gap-1">
          {FUNCTIONS.map((fn) => (
            <button
              key={fn.label}
              type="button"
              onClick={() => insertAtCursor(fn.value)}
              className="px-2 py-1 rounded bg-background/60 border border-border text-xs text-foreground hover:border-primary/30 hover:text-primary transition-colors"
              title={`Insert ${fn.display}`}
            >
              {fn.label}
            </button>
          ))}
        </div>
      )}

      {/* Operator buttons */}
      <div className="flex flex-wrap gap-1">
        {OPERATORS.map((op) => (
          <button
            key={op.value}
            type="button"
            onClick={() => insertOperator(op.value)}
            className="w-8 h-7 flex items-center justify-center rounded bg-background/60 border border-border text-sm text-foreground hover:border-primary/30 hover:text-primary transition-colors font-mono"
          >
            {op.label}
          </button>
        ))}
      </div>

      {attributes.length === 0 && (
        <p className="text-xs text-muted italic">
          Add attributes to the template first, then come back to build formulas.
        </p>
      )}
    </div>
  )
}