import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AttributeModifierConfig, {
  generateFormula,
  parseFormula,
  generateProgression,
} from '@/lib/attribute-modifier-config'

vi.mock('@/lib/mythrion-popover', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// --------------- generateFormula ---------------

describe('generateFormula', () => {
  it('returns "floor((value - 10) / 2)" for default config (every:2, modifierIncrease:1, startingAttribute:10, modifier:0)', () => {
    const result = generateFormula({
      every: 2,
      modifierIncrease: 1,
      startingAttribute: 10,
      modifier: 0,
    })
    expect(result).toBe('floor((value - 10) / 2)')
  })

  it('returns "5 + floor((value - 10) / 2)" with base modifier 5', () => {
    const result = generateFormula({
      every: 2,
      modifierIncrease: 1,
      startingAttribute: 10,
      modifier: 5,
    })
    expect(result).toBe('5 + floor((value - 10) / 2)')
  })

  it('returns "-2 + floor((value - 10) / 5)" with negative modifier', () => {
    const result = generateFormula({
      every: 5,
      modifierIncrease: 1,
      startingAttribute: 10,
      modifier: -2,
    })
    expect(result).toBe('-2 + floor((value - 10) / 5)')
  })

  it('returns "1 + 2 * floor((value - 8) / 3)" with non-unity modifierIncrease', () => {
    const result = generateFormula({
      every: 3,
      modifierIncrease: 2,
      startingAttribute: 8,
      modifier: 1,
    })
    expect(result).toBe('1 + 2 * floor((value - 8) / 3)')
  })

  it('returns "0" when every is <= 0', () => {
    const result = generateFormula({
      every: -1,
      modifierIncrease: 1,
      startingAttribute: 10,
      modifier: 0,
    })
    expect(result).toBe('0')
  })
})

// --------------- parseFormula ---------------

describe('parseFormula', () => {
  it('parses "floor((value - 10) / 2)" correctly', () => {
    const result = parseFormula('floor((value - 10) / 2)')
    expect(result).toEqual({
      every: 2,
      startingAttribute: 10,
      modifierIncrease: 1,
      modifier: 0,
    })
  })

  it('parses "5 + floor((value - 10) / 2)" correctly', () => {
    const result = parseFormula('5 + floor((value - 10) / 2)')
    expect(result).toEqual({
      every: 2,
      startingAttribute: 10,
      modifierIncrease: 1,
      modifier: 5,
    })
  })

  it('returns null for empty string', () => {
    expect(parseFormula('')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(parseFormula(null as any)).toBeNull()
  })

  it('returns null for invalid formula', () => {
    expect(parseFormula('invalid')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(parseFormula('   ')).toBeNull()
  })

  it('parses formula with multiplier: "2 * floor((value - 10) / 2)"', () => {
    const result = parseFormula('2 * floor((value - 10) / 2)')
    expect(result).toEqual({
      every: 2,
      startingAttribute: 10,
      modifierIncrease: 2,
      modifier: 0,
    })
  })

  it('parses formula with negative starting attribute: "floor((value - -5) / 3)"', () => {
    const result = parseFormula('floor((value - -5) / 3)')
    expect(result).toEqual({
      every: 3,
      startingAttribute: -5,
      modifierIncrease: 1,
      modifier: 0,
    })
  })

  it('returns null when formula has non-positive every: "floor((value - 10) / -2)"', () => {
    expect(parseFormula('floor((value - 10) / -2)')).toBeNull()
  })

  it('parses formula with modifier and multiplier: "5 + 2 * floor((value - 10) / 2)"', () => {
    const result = parseFormula('5 + 2 * floor((value - 10) / 2)')
    expect(result).toEqual({
      every: 2,
      startingAttribute: 10,
      modifierIncrease: 2,
      modifier: 5,
    })
  })

  it('parses formula with negative multiplier: "-2 * floor((value - 10) / 3)"', () => {
    const result = parseFormula('-2 * floor((value - 10) / 3)')
    expect(result).toEqual({
      every: 3,
      startingAttribute: 10,
      modifierIncrease: -2,
      modifier: 0,
    })
  })
})

// --------------- generateProgression ---------------

describe('generateProgression', () => {
  it('returns correct range with default config (attribute 1 to 20)', () => {
    const rows = generateProgression({
      every: 2,
      modifierIncrease: 1,
      startingAttribute: 10,
      modifier: 0,
    })
    // startingAttribute 10: minAttr = min(1, 0) = 0, maxAttr = 20
    // So range is 0 to 20
    expect(rows).toHaveLength(21)
  })

  it('attribute 10 has modifier 0', () => {
    const rows = generateProgression({
      every: 2,
      modifierIncrease: 1,
      startingAttribute: 10,
      modifier: 0,
    })
    const row = rows.find(r => r.attribute === 10)
    expect(row?.modifier).toBe(0)
  })

  it('attribute 12 has modifier 1', () => {
    const rows = generateProgression({
      every: 2,
      modifierIncrease: 1,
      startingAttribute: 10,
      modifier: 0,
    })
    const row = rows.find(r => r.attribute === 12)
    expect(row?.modifier).toBe(1)
  })

  it('attribute 8 has modifier -1', () => {
    const rows = generateProgression({
      every: 2,
      modifierIncrease: 1,
      startingAttribute: 10,
      modifier: 0,
    })
    const row = rows.find(r => r.attribute === 8)
    expect(row?.modifier).toBe(-1)
  })

  it('returns empty array when every is 0', () => {
    const rows = generateProgression({
      every: 0,
      modifierIncrease: 1,
      startingAttribute: 10,
      modifier: 0,
    })
    expect(rows).toEqual([])
  })

  it('respects non-zero base modifier: attribute 10 has modifier 5', () => {
    const rows = generateProgression({
      every: 2,
      modifierIncrease: 1,
      startingAttribute: 10,
      modifier: 5,
    })
    const row = rows.find(r => r.attribute === 10)
    expect(row?.modifier).toBe(5)
  })

  it('respects non-unity modifierIncrease: attribute 12 has modifier 3 when increase is 3', () => {
    const rows = generateProgression({
      every: 2,
      modifierIncrease: 3,
      startingAttribute: 10,
      modifier: 0,
    })
    const row = rows.find(r => r.attribute === 12)
    expect(row?.modifier).toBe(3)
  })

  it('generates correct range when startingAttribute is 5 (minAttr = -5)', () => {
    const rows = generateProgression({
      every: 2,
      modifierIncrease: 1,
      startingAttribute: 5,
      modifier: 0,
    })
    expect(rows).toHaveLength(21) // min=-5, max=15 → 21 rows
    expect(rows[0].attribute).toBe(-5)
    expect(rows[rows.length - 1].attribute).toBe(15)
  })
})

// --------------- Component Rendering ---------------

describe('AttributeModifierConfig component', () => {
  it('renders with default values', async () => {
    const onChange = vi.fn()
    render(<AttributeModifierConfig value="" onChange={onChange} />)

    await waitFor(() => {
      expect(screen.getByText('Attribute Modifier Progression')).toBeInTheDocument()
    })

    // "Every" input should be visible with default value 2
    const everyInput = screen.getByDisplayValue('2')
    expect(everyInput).toBeInTheDocument()
  })

  it('shows custom formula mode when non-standard formula passed', async () => {
    const onChange = vi.fn()
    render(
      <AttributeModifierConfig value="custom_expr(value, 3)" onChange={onChange} />,
    )

    await waitFor(() => {
      expect(
        screen.getByText(/this template uses a custom formula/i),
      ).toBeInTheDocument()
    })

    expect(
      screen.getByDisplayValue('custom_expr(value, 3)'),
    ).toBeInTheDocument()
  })

  it('renders progression preview when toggled', async () => {
    const onChange = vi.fn()
    render(<AttributeModifierConfig value="" onChange={onChange} />)

    await waitFor(() => {
      expect(screen.getByText('Attribute Modifier Progression')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Preview Progression'))

    expect(screen.getByText('Modifier Progression Preview')).toBeInTheDocument()

    // Click again to hide
    await userEvent.click(screen.getByText('Hide Preview'))

    expect(
      screen.queryByText('Modifier Progression Preview'),
    ).not.toBeInTheDocument()
  })

  it('switches to custom mode and back', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <AttributeModifierConfig value="" onChange={onChange} />,
    )

    await waitFor(() => {
      expect(screen.getByText('Attribute Modifier Progression')).toBeInTheDocument()
    })

    // There is no explicit "Switch to Custom" button in the simple mode.
    // The custom mode requires a non-parseable value.
    // The "Switch to Simple Configuration" button only appears in custom mode.
    // So we rerender with a non-standard formula to enter custom mode, then switch back.
    rerender(<AttributeModifierConfig value="custom_formula(x)" onChange={onChange} />)

    await waitFor(() => {
      expect(
        screen.getByText(/Switch to Simple Configuration/i),
      ).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText(/Switch to Simple Configuration/i))

    await waitFor(() => {
      expect(
        screen.getByText('Attribute Modifier Progression'),
      ).toBeInTheDocument()
    })
  })

  it('transitions from loading state to initialized state', async () => {
    const { container } = render(
      <AttributeModifierConfig value="" onChange={vi.fn()} />,
    )

    // In React 18 with testing-library, effects flush synchronously during render(),
    // so the component has already transitioned from loading to initialized state
    // by the time we inspect. Verify the initialized config form is present and
    // the loading indicator is gone.
    await waitFor(() => {
      expect(screen.getByText('Attribute Modifier Progression')).toBeInTheDocument()
    })
    expect(container.querySelector('.animate-pulse')).toBeNull()
  })

  // --------------- Config Input Interactions ---------------

  it('calls onChange with updated formula when "every" input changes', async () => {
    const onChange = vi.fn()
    render(<AttributeModifierConfig value="" onChange={onChange} />)
    await waitFor(() => {
      expect(screen.getByText('Attribute Modifier Progression')).toBeInTheDocument()
    })

    const everyInput = screen.getByDisplayValue('2')
    fireEvent.change(everyInput, { target: { value: '3' } })

    await waitFor(() => {
      // Every=3, startingAttribute=10, modifierIncrease=1, modifier=0
      expect(onChange).toHaveBeenCalledWith('floor((value - 10) / 3)')
    })
  })

  it('calls onChange with updated formula when modifierIncrease changes', async () => {
    const onChange = vi.fn()
    render(<AttributeModifierConfig value="" onChange={onChange} />)
    await waitFor(() => {
      expect(screen.getByText('Attribute Modifier Progression')).toBeInTheDocument()
    })

    const increaseInput = screen.getByDisplayValue('1')
    // There are multiple inputs with displayValue 1; find the modifierIncrease one
    // The modifierIncrease input is the second "1" input by display order
    const inputs = screen.getAllByDisplayValue('1')
    // First '1' is modifierIncrease (default 1), second '1' doesn't exist...
    // Actually there's only one displayValue '1' on initial render (modifierIncrease=1, modifier=0)
    fireEvent.change(increaseInput, { target: { value: '2' } })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('2 * floor((value - 10) / 2)')
    })
  })

  it('calls onChange with updated formula when modifier changes', async () => {
    const onChange = vi.fn()
    render(<AttributeModifierConfig value="" onChange={onChange} />)
    await waitFor(() => {
      expect(screen.getByText('Attribute Modifier Progression')).toBeInTheDocument()
    })

    const modifierInput = screen.getByDisplayValue('0')
    fireEvent.change(modifierInput, { target: { value: '5' } })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('5 + floor((value - 10) / 2)')
    })
  })

  it('calls onChange with updated formula when startingAttribute changes', async () => {
    const onChange = vi.fn()
    render(<AttributeModifierConfig value="" onChange={onChange} />)
    await waitFor(() => {
      expect(screen.getByText('Attribute Modifier Progression')).toBeInTheDocument()
    })

    const startInput = screen.getByDisplayValue('10')
    fireEvent.change(startInput, { target: { value: '8' } })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('floor((value - 8) / 2)')
    })
  })

  it('clamps every input to minimum of 1 when cleared', async () => {
    const onChange = vi.fn()
    render(<AttributeModifierConfig value="" onChange={onChange} />)
    await waitFor(() => {
      expect(screen.getByText('Attribute Modifier Progression')).toBeInTheDocument()
    })

    const everyInput = screen.getByDisplayValue('2')
    fireEvent.change(everyInput, { target: { value: '' } })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('floor((value - 10) / 1)')
    })
  })

  it('handles negative modifier value', async () => {
    const onChange = vi.fn()
    render(<AttributeModifierConfig value="" onChange={onChange} />)
    await waitFor(() => {
      expect(screen.getByText('Attribute Modifier Progression')).toBeInTheDocument()
    })

    const modifierInput = screen.getByDisplayValue('0')
    fireEvent.change(modifierInput, { target: { value: '-3' } })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('-3 + floor((value - 10) / 2)')
    })
  })

  // --------------- Custom Formula Interactions ---------------

  it('edits custom formula textarea and calls onChange', async () => {
    const onChange = vi.fn()
    render(
      <AttributeModifierConfig value="custom_expr(value, 3)" onChange={onChange} />,
    )

    await waitFor(() => {
      expect(
        screen.getByText(/this template uses a custom formula/i),
      ).toBeInTheDocument()
    })

    const textarea = screen.getByDisplayValue('custom_expr(value, 3)')
    fireEvent.change(textarea, { target: { value: 'my_formula(x, 5)' } })

    expect(onChange).toHaveBeenCalledWith('my_formula(x, 5)')
  })

  // --------------- External value prop with parseable formula ---------------

  it('initializes config from a parseable external formula value', async () => {
    const onChange = vi.fn()
    render(
      <AttributeModifierConfig
        value="3 + 2 * floor((value - 8) / 4)"
        onChange={onChange}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Attribute Modifier Progression')).toBeInTheDocument()
    })

    // Config should be parsed: every=4, modifierIncrease=2, startingAttribute=8, modifier=3
    expect(screen.getByDisplayValue('4')).toBeInTheDocument() // every
  })

  it('rerenders with updated values and custom placeholder', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <AttributeModifierConfig value="" onChange={onChange} placeholder="Enter formula" />,
    )

    await waitFor(() => {
      expect(screen.getByText('Attribute Modifier Progression')).toBeInTheDocument()
    })

    // Rerender into custom mode with a non-empty value to trigger the useEffect again
    rerender(
      <AttributeModifierConfig
        value="another_custom_fn(x)"
        onChange={onChange}
        placeholder="Enter formula"
      />,
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('another_custom_fn(x)')).toBeInTheDocument()
    })
  })
})
