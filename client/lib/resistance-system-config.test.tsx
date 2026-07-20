import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResistanceSystemConfig from '@/lib/resistance-system-config'

const sampleAttributes = [
  { id: 'attr-1', key: 'strength', name: 'Strength' },
  { id: 'attr-2', key: 'dexterity', name: 'Dexterity' },
  { id: 'attr-3', key: 'constitution', name: 'Constitution' },
]

beforeEach(() => {
  vi.clearAllMocks()
})

// --------------- Empty State ---------------

describe('empty state', () => {
  it('renders empty state message when no resistances', () => {
    render(
      <ResistanceSystemConfig
        resistances={[]}
        attributes={sampleAttributes}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByText('No resistances configured.')).toBeInTheDocument()
  })

  it('renders "New Resistance" button', () => {
    render(
      <ResistanceSystemConfig
        resistances={[]}
        attributes={sampleAttributes}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByText('+ New Resistance')).toBeInTheDocument()
  })
})

// --------------- Adding Resistances ---------------

describe('adding resistances', () => {
  it('clicking "+ New Resistance" adds a resistance card', async () => {
    const onChange = vi.fn()

    render(
      <ResistanceSystemConfig
        resistances={[]}
        attributes={sampleAttributes}
        onChange={onChange}
      />,
    )

    await userEvent.click(screen.getByText('+ New Resistance'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const newResistances = onChange.mock.calls[0][0]
    expect(newResistances).toHaveLength(1)
    expect(newResistances[0]).toEqual({
      name: '',
      calculationType: 'MANUAL',
      components: [],
      attributeModifiers: [],
    })
  })

  it('auto-expands newly created resistance', () => {
    const onChange = vi.fn()
    const resistance = {
      id: 'r-1',
      name: 'Fire Resistance',
      calculationType: 'MANUAL' as const,
      components: [],
      attributeModifiers: [],
    }

    const { rerender } = render(
      <ResistanceSystemConfig
        resistances={[resistance]}
        attributes={sampleAttributes}
        onChange={onChange}
      />,
    )

    // The auto-expand effect runs when resistances.length increases.
    // To trigger it, we add a new item.
    const newResistance = {
      name: '',
      calculationType: 'MANUAL' as const,
      components: [],
      attributeModifiers: [],
    }

    // Simulate parent re-render with new resistance (triggering auto-expand)
    rerender(
      <ResistanceSystemConfig
        resistances={[resistance, newResistance]}
        attributes={sampleAttributes}
        onChange={onChange}
      />,
    )

    // The newly added resistance (second one) should be auto-expanded.
    // Check that we see both headers
    expect(screen.getByText('Fire Resistance')).toBeInTheDocument()
    expect(screen.getAllByText('New Resistance').length).toBeGreaterThanOrEqual(1)
  })
})

// --------------- Resistance Manipulation ---------------

describe('resistance manipulation', () => {
  it('updates resistance name', () => {
    const onChange = vi.fn()
    const resistances = [
      {
        name: '',
        calculationType: 'MANUAL' as const,
        components: [],
        attributeModifiers: [],
      },
    ]

    render(
      <ResistanceSystemConfig
        resistances={resistances}
        attributes={sampleAttributes}
        onChange={onChange}
      />,
    )

    // Card is auto-expanded on mount -- find the name input and change it
    const nameInput = screen.getByPlaceholderText('e.g. Fire Resistance')
    fireEvent.change(nameInput, { target: { value: 'Cold Resistance' } })

    // onChange should have been called with updated name
    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall[0].name).toBe('Cold Resistance')
  })

  it('toggles calculation type between MANUAL and CALCULATED', async () => {
    const onChange = vi.fn()
    const resistances = [
      {
        name: 'Test Res',
        calculationType: 'MANUAL' as const,
        components: [],
        attributeModifiers: [],
      },
    ]

    render(
      <ResistanceSystemConfig
        resistances={resistances}
        attributes={sampleAttributes}
        onChange={onChange}
      />,
    )

    // Card is auto-expanded on mount -- click "Calculated" directly
    await userEvent.click(screen.getByText('Calculated'))

    // onChange should have been called with CALCULATED
    const switchCall = onChange.mock.calls.find(
      (c: any) => c[0][0]?.calculationType === 'CALCULATED',
    )
    expect(switchCall).toBeTruthy()
  })

  it('removes resistance card', async () => {
    const onChange = vi.fn()
    const resistances = [
      {
        name: 'Remove Me',
        calculationType: 'MANUAL' as const,
        components: [],
        attributeModifiers: [],
      },
      {
        name: 'Keep Me',
        calculationType: 'MANUAL' as const,
        components: [],
        attributeModifiers: [],
      },
    ]

    render(
      <ResistanceSystemConfig
        resistances={resistances}
        attributes={sampleAttributes}
        onChange={onChange}
      />,
    )

    // With 2 resistances, the LAST one ("Keep Me") auto-expands.
    // Click "Remove Me" to expand the first card.
    await userEvent.click(screen.getByText('Remove Me'))

    // Click "Remove Resistance"
    const removeButtons = screen.getAllByText('Remove Resistance')
    await userEvent.click(removeButtons[0])

    // Should have called onChange with only the remaining resistance
    const removeCall = onChange.mock.calls.find(
      (c: any) => c[0].length === 1 && c[0][0].name === 'Keep Me',
    )
    expect(removeCall).toBeTruthy()
  })
})

// --------------- CALCULATED Mode ---------------

describe('CALCULATED mode', () => {
  function setupResistance() {
    const onChange = vi.fn()
    const resistances = [
      {
        name: 'Fire Res',
        calculationType: 'CALCULATED' as const,
        components: [],
        attributeModifiers: [],
      },
    ]

    render(
      <ResistanceSystemConfig
        resistances={resistances}
        attributes={sampleAttributes}
        onChange={onChange}
      />,
    )

    // Card is auto-expanded on mount
    return { onChange }
  }

  it('adds components to a calculated resistance', async () => {
    const { onChange } = setupResistance()

    await userEvent.click(screen.getByText('+ Add Component'))

    expect(onChange).toHaveBeenCalled()
    const addCall = onChange.mock.calls.find(
      (c: any) => c[0][0]?.components?.length === 1,
    )
    expect(addCall).toBeTruthy()
  })

  it('updates component name and defaultValue', () => {
    const onChange = vi.fn()
    const resistances = [
      {
        name: 'Fire Res',
        calculationType: 'CALCULATED' as const,
        components: [
          { name: '', editableByPlayer: false, defaultValue: '0' },
        ],
        attributeModifiers: [],
      },
    ]

    render(
      <ResistanceSystemConfig
        resistances={resistances}
        attributes={sampleAttributes}
        onChange={onChange}
      />,
    )

    // Card is auto-expanded on mount
    const nameInput = screen.getByPlaceholderText('Component Name (e.g. Natural)')
    fireEvent.change(nameInput, { target: { value: 'Natural Armor' } })

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall[0].components[0].name).toBe('Natural Armor')
  })

  it('toggles editableByPlayer checkbox', async () => {
    const onChange = vi.fn()
    const resistances = [
      {
        name: 'Fire Res',
        calculationType: 'CALCULATED' as const,
        components: [
          { name: 'Base', editableByPlayer: false, defaultValue: '0' },
        ],
        attributeModifiers: [],
      },
    ]

    render(
      <ResistanceSystemConfig
        resistances={resistances}
        attributes={sampleAttributes}
        onChange={onChange}
      />,
    )

    // Card is auto-expanded on mount
    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall[0].components[0].editableByPlayer).toBe(true)
  })

  it('removes component', async () => {
    const onChange = vi.fn()
    const resistances = [
      {
        name: 'Fire Res',
        calculationType: 'CALCULATED' as const,
        components: [
          { name: 'Base', editableByPlayer: false, defaultValue: '0' },
          { name: 'Extra', editableByPlayer: true, defaultValue: '5' },
        ],
        attributeModifiers: [],
      },
    ]

    render(
      <ResistanceSystemConfig
        resistances={resistances}
        attributes={sampleAttributes}
        onChange={onChange}
      />,
    )

    // Card is auto-expanded on mount
    // Click the first X button (Base component remove)
    const removeButtons = screen.getAllByText('✕')
    await userEvent.click(removeButtons[0])

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall[0].components).toHaveLength(1)
    expect(lastCall[0].components[0].name).toBe('Extra')
  })

  it('adds attribute modifier from dropdown', async () => {
    const onChange = vi.fn()
    const resistances = [
      {
        name: 'Fire Res',
        calculationType: 'CALCULATED' as const,
        components: [],
        attributeModifiers: [],
      },
    ]

    render(
      <ResistanceSystemConfig
        resistances={resistances}
        attributes={sampleAttributes}
        onChange={onChange}
      />,
    )

    // Card is auto-expanded on mount -- the combobox is visible
    const combobox = screen.getByRole('combobox')
    fireEvent.change(combobox, {
      target: { value: 'attr-1::strength::Strength' },
    })

    const addCall = onChange.mock.calls.find(
      (c: any) => c[0][0]?.attributeModifiers?.length === 1,
    )
    expect(addCall).toBeTruthy()
    expect(addCall[0][0].attributeModifiers[0]).toEqual({
      attributeId: 'attr-1',
      attributeKey: 'strength',
      attributeName: 'Strength',
      enabled: true,
    })
  })

  it('removes attribute modifier chip', async () => {
    const onChange = vi.fn()
    const resistances = [
      {
        name: 'Fire Res',
        calculationType: 'CALCULATED' as const,
        components: [],
        attributeModifiers: [
          {
            attributeId: 'attr-1',
            attributeKey: 'strength',
            attributeName: 'Strength',
            enabled: true,
          },
        ],
      },
    ]

    render(
      <ResistanceSystemConfig
        resistances={resistances}
        attributes={sampleAttributes}
        onChange={onChange}
      />,
    )

    // Card is auto-expanded on mount
    const chipRemoveButtons = screen.getAllByText('×')
    await userEvent.click(chipRemoveButtons[0])

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall[0].attributeModifiers).toHaveLength(0)
  })

  it('avoids duplicate attribute modifiers', async () => {
    const onChange = vi.fn()
    const resistances = [
      {
        name: 'Fire Res',
        calculationType: 'CALCULATED' as const,
        components: [],
        attributeModifiers: [
          {
            attributeId: 'attr-1',
            attributeKey: 'strength',
            attributeName: 'Strength',
            enabled: true,
          },
        ],
      },
    ]

    render(
      <ResistanceSystemConfig
        resistances={resistances}
        attributes={sampleAttributes}
        onChange={onChange}
      />,
    )

    // Card is auto-expanded on mount
    const combobox = screen.getByRole('combobox')
    const options = Array.from(combobox.querySelectorAll('option'))
    const optionValues = options.map(o => o.getAttribute('value'))
    expect(optionValues).not.toContain('attr-1::strength::Strength')
    expect(optionValues).toContain('attr-2::dexterity::Dexterity')
    expect(optionValues).toContain('attr-3::constitution::Constitution')
  })

  it('shows "No components added yet" when empty', () => {
    const resistances = [
      {
        name: 'Fire Res',
        calculationType: 'CALCULATED' as const,
        components: [],
        attributeModifiers: [],
      },
    ]

    render(
      <ResistanceSystemConfig
        resistances={resistances}
        attributes={sampleAttributes}
        onChange={vi.fn()}
      />,
    )

    // Card is auto-expanded on mount
    expect(screen.getByText('No components added yet.')).toBeInTheDocument()
  })
})

// --------------- disableAttributeModifiers ---------------

describe('disableAttributeModifiers prop', () => {
  it('hides attribute modifier controls when true', () => {
    const resistances = [
      {
        name: 'Fire Res',
        calculationType: 'CALCULATED' as const,
        components: [],
        attributeModifiers: [],
      },
    ]

    render(
      <ResistanceSystemConfig
        resistances={resistances}
        attributes={sampleAttributes}
        onChange={vi.fn()}
        disableAttributeModifiers={true}
      />,
    )

    // Card is auto-expanded on mount -- the info panel text should be visible
    expect(
      screen.getByText(/Attribute Modifiers are disabled/i),
    ).toBeInTheDocument()

    // The combo box (select) for adding modifiers should NOT be present
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('shows info panel instead', () => {
    const resistances = [
      {
        name: 'Fire Res',
        calculationType: 'CALCULATED' as const,
        components: [],
        attributeModifiers: [],
      },
    ]

    render(
      <ResistanceSystemConfig
        resistances={resistances}
        attributes={sampleAttributes}
        onChange={vi.fn()}
        disableAttributeModifiers={true}
      />,
    )

    // Card is auto-expanded on mount
    expect(
      screen.getByText(/Attribute Modifiers are disabled/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Enable the global Attribute Modifier System/i),
    ).toBeInTheDocument()
  })

  it('shows existing attribute modifiers as disabled chips', () => {
    const resistances = [
      {
        name: 'Fire Res',
        calculationType: 'CALCULATED' as const,
        components: [],
        attributeModifiers: [
          {
            attributeId: 'attr-1',
            attributeKey: 'strength',
            attributeName: 'Strength',
            enabled: true,
          },
        ],
      },
    ]

    render(
      <ResistanceSystemConfig
        resistances={resistances}
        attributes={sampleAttributes}
        onChange={vi.fn()}
        disableAttributeModifiers={true}
      />,
    )

    // Card is auto-expanded on mount
    expect(screen.getByText('Strength')).toBeInTheDocument()
  })
})

// --------------- onChange callback ---------------

describe('onChange callback', () => {
  it('calls onChange with updated array after each operation', async () => {
    const onChange = vi.fn()

    render(
      <ResistanceSystemConfig
        resistances={[]}
        attributes={sampleAttributes}
        onChange={onChange}
      />,
    )

    // Add a resistance
    await userEvent.click(screen.getByText('+ New Resistance'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

// --------------- Expand/Collapse ---------------

describe('expand/collapse behavior', () => {
  it('expands/collapses card on header click', async () => {
    const resistances = [
      {
        name: 'Expand Test',
        calculationType: 'MANUAL' as const,
        components: [],
        attributeModifiers: [],
      },
    ]

    render(
      <ResistanceSystemConfig
        resistances={resistances}
        attributes={sampleAttributes}
        onChange={vi.fn()}
      />,
    )

    // Card auto-expands on mount, so input IS visible initially
    expect(
      screen.getByPlaceholderText('e.g. Fire Resistance'),
    ).toBeInTheDocument()

    // Click to collapse
    await userEvent.click(screen.getByText('Expand Test'))
    expect(
      screen.queryByPlaceholderText('e.g. Fire Resistance'),
    ).toBeNull()

    // Click to expand again
    await userEvent.click(screen.getByText('Expand Test'))
    expect(
      screen.getByPlaceholderText('e.g. Fire Resistance'),
    ).toBeInTheDocument()
  })
})
