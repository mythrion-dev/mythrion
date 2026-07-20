import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineText, InlineNumber, InlineTextarea, InlineSelect, InlineCheckbox } from '@/lib/inline-editable'

// ── Helpers ──

function createDeferred() {
  let resolve!: () => void
  let reject!: (err: Error) => void
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const options = [
  { value: 'str', label: 'Strength' },
  { value: 'dex', label: 'Dexterity' },
  { value: 'con', label: 'Constitution' },
]

// ── InlineText ──

describe('InlineText', () => {
  let mockOnSave: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnSave = vi.fn()
  })

  it('renders value as text when not editing', () => {
    render(<InlineText value="Hello" onSave={mockOnSave} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows emptyDisplay when value is empty', () => {
    render(<InlineText value="" onSave={mockOnSave} emptyDisplay="---" />)
    expect(screen.getByText('---')).toBeInTheDocument()
  })

  it('shows emptyDisplay when value is whitespace', () => {
    render(<InlineText value="   " onSave={mockOnSave} emptyDisplay="empty" />)
    expect(screen.getByText('empty')).toBeInTheDocument()
  })

  it('enters edit mode on click', async () => {
    const user = userEvent.setup()
    render(<InlineText value="Edit me" onSave={mockOnSave} />)
    await user.click(screen.getByText('Edit me'))
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('Edit me')
  })

  it('shows input field in edit mode', async () => {
    const user = userEvent.setup()
    render(<InlineText value="test" onSave={mockOnSave} />)
    await user.click(screen.getByText('test'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('saves trimmed value on Enter', async () => {
    mockOnSave.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<InlineText value="Hello" onSave={mockOnSave} />)
    await user.click(screen.getByText('Hello'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '  Hello World  ')
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('Hello World')
    })
  })

  it('cancels on Escape (restores original value)', async () => {
    const user = userEvent.setup()
    render(<InlineText value="Original" onSave={mockOnSave} />)
    await user.click(screen.getByText('Original'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Changed')
    await user.keyboard('{Escape}')
    // Should exit edit mode and show original value
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('Original')).toBeInTheDocument()
    expect(mockOnSave).not.toHaveBeenCalled()
  })

  it('calls onSave with new value on blur', async () => {
    mockOnSave.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<InlineText value="Start" onSave={mockOnSave} />)
    await user.click(screen.getByText('Start'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'End')
    // Click outside to trigger blur
    await user.click(document.body)
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('End')
    })
  })

  it('shows saving spinner during async save', async () => {
    const deferred = createDeferred()
    mockOnSave.mockReturnValue(deferred.promise)
    const user = userEvent.setup()
    render(<InlineText value="Hello" onSave={mockOnSave} />)
    await user.click(screen.getByText('Hello'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'World')
    await user.keyboard('{Enter}')

    // Should show saving spinner and input should be disabled
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    deferred.resolve()
    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })

  it('restores original value on save error', async () => {
    mockOnSave.mockRejectedValue(new Error('fail'))
    const user = userEvent.setup()
    render(<InlineText value="Persist" onSave={mockOnSave} />)
    await user.click(screen.getByText('Persist'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'FailMe')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      // Input should still be in edit mode with original value restored
      expect(screen.getByRole('textbox')).toHaveValue('Persist')
    })
  })

  it('disabled prop prevents entering edit mode', async () => {
    const user = userEvent.setup()
    render(<InlineText value="Locked" onSave={mockOnSave} disabled />)
    await user.click(screen.getByText('Locked'))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('updates displayed value when value prop changes externally', () => {
    const { rerender } = render(<InlineText value="Initial" onSave={mockOnSave} />)
    expect(screen.getByText('Initial')).toBeInTheDocument()
    rerender(<InlineText value="Updated" onSave={mockOnSave} />)
    expect(screen.getByText('Updated')).toBeInTheDocument()
    expect(screen.queryByText('Initial')).not.toBeInTheDocument()
  })
})

// ── InlineNumber ──

describe('InlineNumber', () => {
  let mockOnSave: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnSave = vi.fn()
  })

  it('renders number as text when not editing', () => {
    render(<InlineNumber value={42} onSave={mockOnSave} />)
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('shows emptyDisplay when value is null/undefined', () => {
    const { rerender } = render(<InlineNumber value={null} onSave={mockOnSave} emptyDisplay="---" />)
    expect(screen.getByText('---')).toBeInTheDocument()

    rerender(<InlineNumber value={undefined} onSave={mockOnSave} emptyDisplay="---" />)
    expect(screen.getByText('---')).toBeInTheDocument()
  })

  it('enters edit mode on click', async () => {
    const user = userEvent.setup()
    render(<InlineNumber value={10} onSave={mockOnSave} />)
    await user.click(screen.getByText('10'))
    const input = screen.getByRole('spinbutton')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue(10)
  })

  it('shows number input in edit mode', async () => {
    const user = userEvent.setup()
    render(<InlineNumber value={99} onSave={mockOnSave} />)
    await user.click(screen.getByText('99'))
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('saves number value on Enter', async () => {
    mockOnSave.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<InlineNumber value={5} onSave={mockOnSave} />)
    await user.click(screen.getByText('5'))
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '25')
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(25)
    })
  })

  it('cancels on Escape', async () => {
    const user = userEvent.setup()
    render(<InlineNumber value={7} onSave={mockOnSave} />)
    await user.click(screen.getByText('7'))
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '100')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(mockOnSave).not.toHaveBeenCalled()
  })

  it('converts empty string to 0 on save', async () => {
    mockOnSave.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<InlineNumber value={42} onSave={mockOnSave} />)
    await user.click(screen.getByText('42'))
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(0)
    })
  })

  it('handles NaN gracefully (restores original)', async () => {
    const user = userEvent.setup()
    render(<InlineNumber value={42} onSave={mockOnSave} />)
    await user.click(screen.getByText('42'))
    const input = screen.getByRole('spinbutton') as HTMLInputElement

    // jsdom sanitizes non-numeric values to '' on type=number inputs.
    // Override the value getter so the onChange handler receives 'abc'
    // and setDraft('abc') is called, triggering the NaN path in commit().
    await user.clear(input)
    const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!
    Object.defineProperty(input, 'value', {
      get: () => 'abc',
      set: originalDescriptor.set!,
      configurable: true,
    })
    fireEvent.change(input)

    // Trigger blur to force commit
    fireEvent.blur(input)
    await waitFor(() => {
      // Should return to non-editing state with original value
      expect(screen.getByText('42')).toBeInTheDocument()
    })
    expect(mockOnSave).not.toHaveBeenCalled()
  })

  it('shows saving spinner during async save', async () => {
    const deferred = createDeferred()
    mockOnSave.mockReturnValue(deferred.promise)
    const user = userEvent.setup()
    render(<InlineNumber value={10} onSave={mockOnSave} />)
    await user.click(screen.getByText('10'))
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '20')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(screen.getByRole('spinbutton')).toBeDisabled()
    })

    deferred.resolve()
    await waitFor(() => {
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    })
  })

  it('disabled prop prevents entering edit mode', async () => {
    const user = userEvent.setup()
    render(<InlineNumber value={50} onSave={mockOnSave} disabled />)
    await user.click(screen.getByText('50'))
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })
})

// ── InlineTextarea ──

describe('InlineTextarea', () => {
  let mockOnSave: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnSave = vi.fn()
  })

  it('renders value as text when not editing', () => {
    render(<InlineTextarea value="Some text" onSave={mockOnSave} />)
    expect(screen.getByText('Some text')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows emptyDisplay when value is empty', () => {
    render(<InlineTextarea value="" onSave={mockOnSave} emptyDisplay="Nothing" />)
    expect(screen.getByText('Nothing')).toBeInTheDocument()
  })

  it('enters edit mode on click', async () => {
    const user = userEvent.setup()
    render(<InlineTextarea value="Click to edit" onSave={mockOnSave} />)
    await user.click(screen.getByText('Click to edit'))
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveValue('Click to edit')
  })

  it('shows textarea in edit mode', async () => {
    const user = userEvent.setup()
    render(<InlineTextarea value="edit" onSave={mockOnSave} />)
    await user.click(screen.getByText('edit'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('saves trimmed value on blur', async () => {
    mockOnSave.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<InlineTextarea value="Before" onSave={mockOnSave} />)
    await user.click(screen.getByText('Before'))
    const textarea = screen.getByRole('textbox')
    await user.clear(textarea)
    await user.type(textarea, '  After  ')
    await user.click(document.body)
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('After')
    })
  })

  it('cancels on Escape', async () => {
    const user = userEvent.setup()
    render(<InlineTextarea value="Keep" onSave={mockOnSave} />)
    await user.click(screen.getByText('Keep'))
    const textarea = screen.getByRole('textbox')
    await user.clear(textarea)
    await user.type(textarea, 'Discard')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('Keep')).toBeInTheDocument()
    expect(mockOnSave).not.toHaveBeenCalled()
  })

  it('shows saving spinner during async save', async () => {
    const deferred = createDeferred()
    mockOnSave.mockReturnValue(deferred.promise)
    const user = userEvent.setup()
    render(<InlineTextarea value="Old" onSave={mockOnSave} />)
    await user.click(screen.getByText('Old'))
    const textarea = screen.getByRole('textbox')
    await user.clear(textarea)
    await user.type(textarea, 'New')
    await user.click(document.body)

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    deferred.resolve()
    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })

  it('renders label when provided', () => {
    render(<InlineTextarea value="val" onSave={mockOnSave} label="Notes" />)
    expect(screen.getByText('Notes')).toBeInTheDocument()
  })

  it('disabled prop prevents entering edit mode', async () => {
    const user = userEvent.setup()
    render(<InlineTextarea value="Locked" onSave={mockOnSave} disabled />)
    await user.click(screen.getByText('Locked'))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})

// ── InlineSelect ──

describe('InlineSelect', () => {
  let mockOnSave: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnSave = vi.fn()
  })

  it('renders current selection text', () => {
    render(<InlineSelect value="dex" options={options} onSave={mockOnSave} />)
    expect(screen.getByText('Dexterity')).toBeInTheDocument()
  })

  it('shows placeholder when no value', () => {
    render(<InlineSelect value={null} options={options} onSave={mockOnSave} placeholder="Pick one" />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    // The placeholder is the first option with empty value
    const placeholderOption = screen.getByRole('option', { name: 'Pick one' })
    expect(placeholderOption).toBeInTheDocument()
  })

  it('renders select with all options', () => {
    render(<InlineSelect value={null} options={options} onSave={mockOnSave} />)
    const allOptions = screen.getAllByRole('option')
    // placeholder + 3 options
    expect(allOptions).toHaveLength(4)
    expect(screen.getByRole('option', { name: 'Strength' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Dexterity' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Constitution' })).toBeInTheDocument()
  })

  it('calls onSave with selected value on change', async () => {
    mockOnSave.mockResolvedValue(undefined)
    render(<InlineSelect value={null} options={options} onSave={mockOnSave} />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'con' } })
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('con')
    })
  })

  it('shows saving spinner during async save', async () => {
    const deferred = createDeferred()
    mockOnSave.mockReturnValue(deferred.promise)
    render(<InlineSelect value={null} options={options} onSave={mockOnSave} />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'str' } })

    // Saving spinner should appear - select should be disabled
    await waitFor(() => {
      expect(select).toBeDisabled()
    })

    deferred.resolve()
    await waitFor(() => {
      expect(select).not.toBeDisabled()
    })
  })

  it('restores original value on save error', async () => {
    mockOnSave.mockRejectedValue(new Error('fail'))
    render(<InlineSelect value="dex" options={options} onSave={mockOnSave} />)
    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('dex')

    fireEvent.change(select, { target: { value: 'str' } })
    await waitFor(() => {
      // After error, select value should be restored to original
      expect(select).toHaveValue('dex')
    })
  })

  it('disabled prop disables select', () => {
    render(<InlineSelect value={null} options={options} onSave={mockOnSave} disabled />)
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})

// ── InlineCheckbox ──

describe('InlineCheckbox', () => {
  let mockOnToggle: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnToggle = vi.fn()
  })

  it('renders unchecked by default', () => {
    render(<InlineCheckbox checked={false} onToggle={mockOnToggle} />)
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('renders checked when checked=true', () => {
    render(<InlineCheckbox checked={true} onToggle={mockOnToggle} />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('renders label when provided', () => {
    render(<InlineCheckbox checked={false} onToggle={mockOnToggle} label="Enable feature" />)
    expect(screen.getByText('Enable feature')).toBeInTheDocument()
  })

  it('calls onToggle on change', async () => {
    mockOnToggle.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<InlineCheckbox checked={false} onToggle={mockOnToggle} />)
    await user.click(screen.getByRole('checkbox'))
    expect(mockOnToggle).toHaveBeenCalledTimes(1)
  })

  it('shows saving spinner during async toggle', async () => {
    const deferred = createDeferred()
    mockOnToggle.mockReturnValue(deferred.promise)
    render(<InlineCheckbox checked={false} onToggle={mockOnToggle} />)
    const checkbox = screen.getByRole('checkbox')

    fireEvent.click(checkbox)

    // Checkbox should be disabled during save
    await waitFor(() => {
      expect(checkbox).toBeDisabled()
    })

    deferred.resolve()
    await waitFor(() => {
      expect(checkbox).not.toBeDisabled()
    })
  })

  it('disabled prop disables checkbox', () => {
    render(<InlineCheckbox checked={false} onToggle={mockOnToggle} disabled />)
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })
})
