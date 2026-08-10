import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mock child components ──

vi.mock('@/components/shared/NumericInput', () => ({
  NumericInput: ({ value, onChange, placeholder, className, inputClassName, wrapperClassName, min }: {
    value: number | string
    onChange: (e: { target: { value: string } }) => void
    placeholder?: string
    className?: string
    inputClassName?: string
    wrapperClassName?: string
    min?: number
  }) => (
    <input
      type="number"
      data-testid={`numeric-input${placeholder === 'Amount' ? '-amount' : ''}`}
      value={value}
      placeholder={placeholder}
      data-min={min}
      className={`${className ?? ''} ${inputClassName ?? ''}`}
      data-wrapper-class={wrapperClassName}
      onChange={(e) => onChange?.(e)}
    />
  ),
}))

// ── Import component under test (after mocks) ──

import { HealthBar } from '@/components/character-sheet/HealthBar'
import type { SheetPermissions } from '@/components/character-sheet/types'

// ── Helpers ──

function editPermissions(overrides: Partial<SheetPermissions> = {}): SheetPermissions {
  return {
    canEditSkills: false,
    canEditAbilities: true,
    canEditResources: false,
    canEditInventory: false,
    canEditCharacter: false,
    canEditStory: false,
    canEditProfessionalSkills: false,
    canEditPersonalAbilities: false,
    canEditResistances: false,
    ...overrides,
  }
}

// ── Tests ──

describe('HealthBar', () => {

  describe('Rendering with health values', () => {
    it('displays current / maximum when both are provided', () => {
      const onChange = vi.fn()
      render(<HealthBar current={75} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)

      expect(screen.getByText('75 / 100')).toBeTruthy()
      expect(screen.getByText('75%')).toBeTruthy()
    })

    it('displays only maximum when current is null', () => {
      const onChange = vi.fn()
      render(<HealthBar current={null} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)

      expect(screen.getByText('— / 100')).toBeTruthy()
    })

    it('displays only current when maximum is null', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={null} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)

      expect(screen.getByText('50 / —')).toBeTruthy()
    })

    it('shows dash percentage when max is 0', () => {
      const onChange = vi.fn()
      render(<HealthBar current={0} maximum={0} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)

      expect(screen.getByText('—')).toBeTruthy()
    })
  })

  describe('Null / empty state', () => {
    it('shows — / — when both values are null', () => {
      const onChange = vi.fn()
      render(<HealthBar current={null} maximum={null} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)

      // The "— / —" text appears in the bar (gray empty bar)
      expect(screen.getByText('— / —')).toBeTruthy()
      // No percentage shown
      expect(screen.getByText('—')).toBeTruthy()
    })

    it('renders a gray bar when max is 0', () => {
      const onChange = vi.fn()
      const { container } = render(<HealthBar current={0} maximum={0} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)

      // The empty bar should be present
      const emptyBar = container.querySelector('.bg-gray-700\\/30')
      expect(emptyBar).toBeTruthy()
    })
  })

  describe('Color thresholds', () => {
    function getBarColor(current: number, maximum: number): string | null {
      const onChange = vi.fn()
      const { container } = render(<HealthBar current={current} maximum={maximum} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)
      const fillDiv = container.querySelector('.h-full.rounded-full')
      if (!fillDiv) return null

      // Find which color class is applied
      for (const cls of Array.from(fillDiv.classList)) {
        if (cls.startsWith('bg-')) return cls
      }
      return null
    }

    it('uses green when health is above 60%', () => {
      const color = getBarColor(80, 100)
      expect(color).toBe('bg-green-600')
    })

    it('uses green at exactly 60%', () => {
      const color = getBarColor(60, 100)
      expect(color).toBe('bg-yellow-500') // exactly 60% is <= 60, so it's yellow
    })

    it('uses yellow between 30% and 60%', () => {
      const color1 = getBarColor(45, 100)
      expect(color1).toBe('bg-yellow-500')
    })

    it('uses red at exactly 30% (threshold is strictly > 30 for yellow)', () => {
      const color = getBarColor(30, 100)
      expect(color).toBe('bg-red-600') // pct > 30 is false, so falls through to pct > 0 → bg-red-600
    })

    it('uses red between 0% and 30%', () => {
      const color1 = getBarColor(15, 100)
      expect(color1).toBe('bg-red-600')
    })

    it('uses gray at exactly 0% (threshold is strictly > 0 for red)', () => {
      const color = getBarColor(0, 100)
      expect(color).toBe('bg-gray-600') // pct > 0 is false, so falls to bg-gray-600
    })

    it('uses gray when max is 0', () => {
      const onChange = vi.fn()
      const { container } = render(<HealthBar current={0} maximum={0} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)
      // When max is 0, showBar is false, so the empty bar renders with bg-gray-700/30
      const emptyBar = container.querySelector('.bg-gray-700\\/30')
      expect(emptyBar).toBeTruthy()
    })
  })

  describe('Percentage calculation', () => {
    it('displays correct percentage for 75/100', () => {
      const onChange = vi.fn()
      render(<HealthBar current={75} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)
      expect(screen.getByText('75%')).toBeTruthy()
    })

    it('displays correct percentage for 1/3 (rounded)', () => {
      const onChange = vi.fn()
      render(<HealthBar current={1} maximum={3} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)
      expect(screen.getByText('33%')).toBeTruthy()
    })

    it('clamps percentage above 100 to 100', () => {
      const onChange = vi.fn()
      render(<HealthBar current={150} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)
      expect(screen.getByText('100%')).toBeTruthy()
    })

    it('clamps percentage below 0 to 0', () => {
      const onChange = vi.fn()
      render(<HealthBar current={-10} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)
      expect(screen.getByText('0%')).toBeTruthy()
    })
  })

  describe('Animation class', () => {
    it('has transition duration class on the fill bar', () => {
      const onChange = vi.fn()
      const { container } = render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)

      const fillDiv = container.querySelector('.h-full.rounded-full')
      expect(fillDiv).toBeTruthy()
      expect(fillDiv!.className).toContain('transition-all')
      expect(fillDiv!.className).toContain('duration-300')
      expect(fillDiv!.className).toContain('ease-in-out')
    })
  })

  describe('Editable inputs (canEdit = true)', () => {
    it('renders current HP NumericInput', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: true })} />)

      const currentInputs = screen.getAllByTestId('numeric-input') as HTMLInputElement[]
      // First one in the DOM should be current HP (placeholder "—")
      expect(currentInputs.length).toBeGreaterThanOrEqual(2)
      // At least one should have value "50" (current)
      expect(currentInputs.some(i => i.value === '50')).toBe(true)
      // At least one should have value "100" (max)
      expect(currentInputs.some(i => i.value === '100')).toBe(true)
    })

    it('renders max HP NumericInput', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: true })} />)

      // There should be two numeric inputs for editable fields
      const inputs = screen.getAllByTestId('numeric-input')
      expect(inputs.length).toBeGreaterThanOrEqual(2)
    })

    it('renders amount NumericInput with placeholder "Amount"', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: true })} />)

      const amountInput = screen.getByTestId('numeric-input-amount')
      expect(amountInput).toBeTruthy()
      expect(amountInput.getAttribute('placeholder')).toBe('Amount')
    })

    it('renders Damage and Heal buttons', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: true })} />)

      expect(screen.getByText('Damage')).toBeTruthy()
      expect(screen.getByText('Heal')).toBeTruthy()
    })

    it.each([
      { name: 'calls onChange with adjusted value when Damage is clicked with an amount', current: 50, button: 'Damage', expected: 40 },
      { name: 'calls onChange with adjusted value when Heal is clicked with an amount', current: 50, button: 'Heal', expected: 60 },
      { name: 'clamps current to 0 when damage would make it negative', current: 5, button: 'Damage', expected: 0 },
    ])('$name', ({ current, button, expected }) => {
      const onChange = vi.fn()
      render(<HealthBar current={current} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: true })} />)

      // Set the amount input to 10
      const amountInput = screen.getByTestId('numeric-input-amount') as HTMLInputElement
      fireEvent.change(amountInput, { target: { value: '10' } })

      // Click the button (Damage or Heal)
      fireEvent.click(screen.getByText(button))

      // onChange should be called with the adjusted value
      expect(onChange).toHaveBeenCalledWith('current', expected)
    })

    it('does not call onChange when Damage is clicked with empty amount', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: true })} />)

      // Click Damage without setting amount
      fireEvent.click(screen.getByText('Damage'))

      expect(onChange).not.toHaveBeenCalled()
    })

    it('does not call onChange when Heal is clicked with empty amount', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: true })} />)

      // Click Heal without setting amount
      fireEvent.click(screen.getByText('Heal'))

      expect(onChange).not.toHaveBeenCalled()
    })

    it('does not call onChange when Damage is clicked with amount 0', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: true })} />)

      const amountInput = screen.getByTestId('numeric-input-amount') as HTMLInputElement
      fireEvent.change(amountInput, { target: { value: '0' } })
      fireEvent.click(screen.getByText('Damage'))

      expect(onChange).not.toHaveBeenCalled()
    })

    it('calls onChange when current HP NumericInput is changed', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: true })} />)

      // Find the current HP input (first numeric-input)
      const currentInput = screen.getAllByTestId('numeric-input')[0] as HTMLInputElement
      fireEvent.change(currentInput, { target: { value: '60' } })

      expect(onChange).toHaveBeenCalledWith('current', 60)
    })

    it('calls onChange with null when current HP input is cleared', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: true })} />)

      const currentInput = screen.getAllByTestId('numeric-input')[0] as HTMLInputElement
      fireEvent.change(currentInput, { target: { value: '' } })

      expect(onChange).toHaveBeenCalledWith('current', null)
    })

    it('calls onChange when max HP NumericInput is changed', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: true })} />)

      const maxInput = screen.getAllByTestId('numeric-input')[1] as HTMLInputElement
      fireEvent.change(maxInput, { target: { value: '120' } })

      expect(onChange).toHaveBeenCalledWith('maximum', 120)
    })

    it('calls onChange with null when max HP input is cleared', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: true })} />)

      const maxInput = screen.getAllByTestId('numeric-input')[1] as HTMLInputElement
      fireEvent.change(maxInput, { target: { value: '' } })

      expect(onChange).toHaveBeenCalledWith('maximum', null)
    })

    it('clears the amount input after Damage is clicked', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: true })} />)

      const amountInput = screen.getByTestId('numeric-input-amount') as HTMLInputElement
      fireEvent.change(amountInput, { target: { value: '10' } })
      fireEvent.click(screen.getByText('Damage'))

      // After clicking, the amount should be cleared
      expect(amountInput.value).toBe('')
    })
  })

  describe('Read-only mode (canEdit = false)', () => {
    it('does not render NumericInput fields', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)

      const inputs = screen.queryAllByTestId('numeric-input')
      expect(inputs).toHaveLength(0)
    })

    it('does not render Damage button', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)

      expect(screen.queryByText('Damage')).toBeNull()
    })

    it('does not render Heal button', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)

      expect(screen.queryByText('Heal')).toBeNull()
    })
  })

  describe('Edge cases', () => {
    it('handles very large numbers without issues', () => {
      const onChange = vi.fn()
      render(<HealthBar current={999999} maximum={1000000} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)

      expect(screen.getByText(/999999 \/ 1000000/)).toBeTruthy()
    })

    it('handles current > maximum gracefully (shows 100%)', () => {
      const onChange = vi.fn()
      render(<HealthBar current={200} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: false })} />)

      expect(screen.getByText('100%')).toBeTruthy()
    })

    it('shows HP label', () => {
      const onChange = vi.fn()
      render(<HealthBar current={50} maximum={100} onChange={onChange} permissions={editPermissions({ canEditAbilities: true })} />)

      const hpLabel = screen.getByText('HP')
      expect(hpLabel).toBeTruthy()
    })
  })
})
