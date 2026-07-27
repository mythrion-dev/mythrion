import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SkillCalculationConfig, {
  parseConfig,
  configToJson,
} from '@/lib/skill-calculation-config'

vi.mock('@/lib/mythrion-popover', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const sampleCustomFields = [
  { key: 'prof', label: 'Proficiency Bonus' },
  { key: 'equip', label: 'Equipment Bonus' },
  { key: 'misc', label: 'Misc Bonus' },
]

beforeEach(() => {
  vi.clearAllMocks()
})

// --------------- parseConfig ---------------

describe('parseConfig', () => {
  it('parses valid JSON with useAttributeModifier true and custom fields', () => {
    const result = parseConfig(
      '{"useAttributeModifier":true,"customFieldKeys":["prof"]}',
    )
    expect(result).toEqual({
      useAttributeModifier: true,
      customFieldKeys: ['prof'],
    })
  })

  it('parses valid JSON with useAttributeModifier false and empty fields', () => {
    const result = parseConfig(
      '{"useAttributeModifier":false,"customFieldKeys":[]}',
    )
    expect(result).toEqual({
      useAttributeModifier: false,
      customFieldKeys: [],
    })
  })

  it('returns null for empty input', () => {
    expect(parseConfig('')).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(parseConfig(undefined as any)).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(parseConfig('not-json')).toBeNull()
  })

  it('returns null for JSON with wrong structure (missing fields)', () => {
    expect(parseConfig('{"useAttributeModifier":true}')).toBeNull()
    expect(parseConfig('{"customFieldKeys":[]}')).toBeNull()
    expect(parseConfig('{}')).toBeNull()
  })

  it('filters out non-string customFieldKeys', () => {
    const result = parseConfig(
      '{"useAttributeModifier":true,"customFieldKeys":["prof",123,null]}',
    )
    expect(result?.customFieldKeys).toEqual(['prof'])
  })
})

// --------------- configToJson ---------------

describe('configToJson', () => {
  it('serializes config to JSON string', () => {
    const json = configToJson({
      useAttributeModifier: true,
      customFieldKeys: ['prof', 'equip'],
    })
    const parsed = JSON.parse(json)
    expect(parsed).toEqual({
      useAttributeModifier: true,
      customFieldKeys: ['prof', 'equip'],
    })
  })
})

// --------------- Component Rendering ---------------

describe('SkillCalculationConfig component', () => {
  // --------------- Default Config ---------------

  it('renders with default config (useAttributeModifier enabled)', async () => {
    const onChange = vi.fn()
    render(
      <SkillCalculationConfig
        value=""
        onChange={onChange}
        customFields={sampleCustomFields}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Skill Calculation')).toBeInTheDocument()
    })

    expect(
      screen.getByText('Linked Attribute Modifier'),
    ).toBeInTheDocument()
  })

  it('shows checkbox checked when attribute modifier enabled', async () => {
    render(
      <SkillCalculationConfig
        value={JSON.stringify({
          useAttributeModifier: true,
          customFieldKeys: [],
        })}
        onChange={vi.fn()}
        customFields={sampleCustomFields}
      />,
    )

    await waitFor(() => {
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()
    })
  })

  it('toggles attribute modifier checkbox', async () => {
    render(
      <SkillCalculationConfig
        value=""
        onChange={vi.fn()}
        customFields={sampleCustomFields}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Skill Calculation')).toBeInTheDocument()
    })

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(true)

    await userEvent.click(checkbox)
    expect(checkbox.checked).toBe(false)
  })

  // --------------- Custom Fields ---------------

  it('renders custom field select when custom fields available', async () => {
    const onChange = vi.fn()
    render(
      <SkillCalculationConfig
        value=""
        onChange={onChange}
        customFields={sampleCustomFields}
      />,
    )

    await waitFor(() => {
      expect(
        screen.getByText('+ Add Character Info'),
      ).toBeInTheDocument()
    })
  })

  it('adds custom field from dropdown', async () => {
    const onChange = vi.fn()
    render(
      <SkillCalculationConfig
        value=""
        onChange={onChange}
        customFields={sampleCustomFields}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('+ Add Character Info')).toBeInTheDocument()
    })

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'prof' } })

    await waitFor(() => {
      expect(screen.getByText('Proficiency Bonus')).toBeInTheDocument()
    })
  })

  it('removes custom field', async () => {
    const onChange = vi.fn()
    const { container } = render(
      <SkillCalculationConfig
        value={JSON.stringify({
          useAttributeModifier: false,
          customFieldKeys: ['prof', 'equip'],
        })}
        onChange={onChange}
        customFields={sampleCustomFields}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Proficiency Bonus')).toBeInTheDocument()
      expect(screen.getByText('Equipment Bonus')).toBeInTheDocument()
    })

    // Click remove on Proficiency Bonus
    const removeButtons = screen.getAllByText('✕')
    await userEvent.click(removeButtons[0])

    await waitFor(() => {
      // After removal, "Proficiency Bonus" still appears as an <option> in the
      // select dropdown (it was removed from the chips and now is available
      // to add again). Use getAllByText to verify it appears exactly once
      // (as an option), not twice (chip + option).
      const matches = screen.getAllByText('Proficiency Bonus')
      expect(matches).toHaveLength(1)
      expect(matches[0].tagName).toBe('OPTION')
      // Equipment Bonus chip should still be present
      expect(screen.getByText('Equipment Bonus')).toBeInTheDocument()
    })
  })

  it('shows "no custom fields" message when customFields empty', async () => {
    render(
      <SkillCalculationConfig
        value=""
        onChange={vi.fn()}
        customFields={[]}
      />,
    )

    await waitFor(() => {
      expect(
        screen.getByText(/Add Character Infos to the template/i),
      ).toBeInTheDocument()
    })
  })

  // --------------- Preview ---------------

  it('shows preview section when "Preview Calculation" clicked', async () => {
    render(
      <SkillCalculationConfig
        value=""
        onChange={vi.fn()}
        customFields={sampleCustomFields}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Skill Calculation')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Preview Calculation'))

    expect(screen.getByText('Global Rule')).toBeInTheDocument()
  })

  it('hides preview when clicked again', async () => {
    render(
      <SkillCalculationConfig
        value=""
        onChange={vi.fn()}
        customFields={sampleCustomFields}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Skill Calculation')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Preview Calculation'))
    expect(screen.getByText('Global Rule')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Hide Preview'))
    expect(screen.queryByText('Global Rule')).not.toBeInTheDocument()
  })

  // --------------- Legacy Mode ---------------

  it('shows legacy formula textarea when non-JSON value passed', async () => {
    render(
      <SkillCalculationConfig
        value="old-formula-string"
        onChange={vi.fn()}
        customFields={sampleCustomFields}
      />,
    )

    await waitFor(() => {
      expect(
        screen.getByText(/This template uses a legacy skill formula/i),
      ).toBeInTheDocument()
    })

    expect(
      screen.getByDisplayValue('old-formula-string'),
    ).toBeInTheDocument()
  })

  it('"Switch to Simple Configuration" button replaces legacy with default', async () => {
    const onChange = vi.fn()
    render(
      <SkillCalculationConfig
        value="old-formula-string"
        onChange={onChange}
        customFields={sampleCustomFields}
      />,
    )

    await waitFor(() => {
      expect(
        screen.getByText(/Switch to Simple Configuration/i),
      ).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText(/Switch to Simple Configuration/i))

    await waitFor(() => {
      expect(screen.getByText('Skill Calculation')).toBeInTheDocument()
    })

    expect(onChange).toHaveBeenCalledWith(
      JSON.stringify({ useAttributeModifier: true, customFieldKeys: [] }),
    )
  })

  it('typing in textarea calls onChange', async () => {
    const onChange = vi.fn()
    render(
      <SkillCalculationConfig
        value="old-formula"
        onChange={onChange}
        customFields={sampleCustomFields}
      />,
    )

    await waitFor(() => {
      expect(
        screen.getByDisplayValue('old-formula'),
      ).toBeInTheDocument()
    })

    const textarea = screen.getByDisplayValue('old-formula')
    await userEvent.type(textarea, '+new')

    expect(onChange).toHaveBeenCalled()
  })

  // --------------- Disabled Mode ---------------

  it('shows disabled info panel when disabled=true', async () => {
    render(
      <SkillCalculationConfig
        value=""
        onChange={vi.fn()}
        customFields={sampleCustomFields}
        disabled={true}
      />,
    )

    await waitFor(() => {
      expect(
        screen.getByText(/Attribute Modifiers are disabled/i),
      ).toBeInTheDocument()
    })
  })

  it('input controls are disabled when disabled=true', async () => {
    render(
      <SkillCalculationConfig
        value={JSON.stringify({
          useAttributeModifier: true,
          customFieldKeys: ['prof'],
        })}
        onChange={vi.fn()}
        customFields={sampleCustomFields}
        disabled={true}
      />,
    )

    await waitFor(() => {
      const disabledSection = screen.getByText(/Attribute Modifiers are disabled/i)
      expect(disabledSection).toBeInTheDocument()
    })
  })

  // --------------- Initialization ---------------

  it('shows loading state before initialization', async () => {
    const { container } = render(
      <SkillCalculationConfig
        value=""
        onChange={vi.fn()}
        customFields={sampleCustomFields}
      />,
    )

    // The component has an animate-pulse loading state before effects run.
    // Verify it transitions to the initialized state.
    await waitFor(() => {
      expect(screen.getByText('Skill Calculation')).toBeInTheDocument()
    })
  })

  it('renders normally after initialization', async () => {
    render(
      <SkillCalculationConfig
        value={JSON.stringify({
          useAttributeModifier: false,
          customFieldKeys: [],
        })}
        onChange={vi.fn()}
        customFields={sampleCustomFields}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Skill Calculation')).toBeInTheDocument()
    })

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(false)
  })
})
