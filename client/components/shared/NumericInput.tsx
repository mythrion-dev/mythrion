'use client'

import { useRef, type ChangeEvent, type InputHTMLAttributes } from 'react'

type NumericInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  wrapperClassName?: string
  inputClassName?: string
}

export function NumericInput({
  className = '',
  inputClassName = '',
  wrapperClassName = '',
  onChange,
  min,
  max,
  step = 1,
  value,
  disabled,
  ...props
}: NumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const toNumber = (rawValue: string | number | readonly string[] | undefined) => {
    if (typeof rawValue === 'number') return rawValue
    if (typeof rawValue === 'string') return Number(rawValue)
    return 0
  }

  const setValue = (nextValue: number) => {
    if (!inputRef.current) return

    const clampedValue = (() => {
      if (typeof min === 'number' && nextValue < min) return min
      if (typeof max === 'number' && nextValue > max) return max
      return nextValue
    })()

    const normalizedValue = Number.isInteger(step) ? Math.round(clampedValue) : Number(clampedValue.toFixed(10))
    const rawValue = Number.isNaN(normalizedValue) ? '' : String(normalizedValue)

    inputRef.current.value = rawValue
    onChange?.({
      target: { value: rawValue },
      currentTarget: inputRef.current,
      bubbles: true,
      cancelable: false,
    } as ChangeEvent<HTMLInputElement>)
  }

  return (
    <div className={`inline-flex items-stretch overflow-hidden rounded-lg border border-border/70 bg-background/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${wrapperClassName}`}>
      <input
        {...props}
        ref={inputRef}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        disabled={disabled}
        className={`min-w-0 h-full border-0 bg-transparent px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted transition-colors focus:ring-0 ${className} ${inputClassName}`}
      />
      <div className={`flex flex-col border-l border-border/70 bg-background/40 ${disabled ? 'opacity-50' : ''}`}>
        <button
          type="button"
          onClick={() => {
            const currentValue = toNumber(inputRef.current?.value || value || 0)
            setValue((Number.isFinite(currentValue) ? currentValue : 0) + Number(step))
          }}
          disabled={disabled}
          className="flex h-5 w-6 items-center justify-center text-[10px] leading-none text-muted transition-colors hover:bg-background/70 hover:text-foreground"
          aria-label="Increase value"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-3 w-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            const currentValue = toNumber(inputRef.current?.value || value || 0)
            setValue((Number.isFinite(currentValue) ? currentValue : 0) - Number(step))
          }}
          disabled={disabled}
          className="flex h-5 w-6 items-center justify-center border-t border-border/50 text-[10px] leading-none text-muted transition-colors hover:bg-background/70 hover:text-foreground"
          aria-label="Decrease value"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-3 w-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
