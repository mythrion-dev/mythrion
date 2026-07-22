import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Mocks ──

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}))

// Mock InlineText / InlineNumber from inline-editable for CoreResourceCard tests
vi.mock('@/lib/inline-editable', () => ({
  InlineText: ({ value, onSave, emptyDisplay, className }: {
    value: string; onSave: (v: string) => Promise<void>; emptyDisplay?: string; className?: string
  }) => (
    <button
      type="button"
      data-testid="inline-text"
      data-value={value}
      data-empty-display={emptyDisplay}
      className={className}
      onClick={() => onSave('saved-text')}
    >
      {value?.trim() || emptyDisplay || '—'}
    </button>
  ),
  InlineNumber: ({ value, onSave, min, className }: {
    value: number | string | null | undefined; onSave: (v: number) => Promise<void>; min?: number; className?: string
  }) => (
    <button
      type="button"
      data-testid="inline-number"
      data-value={String(value ?? '')}
      data-min={min}
      className={className}
      onClick={() => onSave(Number(value) || 0)}
    >
      {value != null && value !== '' ? String(value) : '—'}
    </button>
  ),
}))

// Mock NumericInput
vi.mock('@/components/shared/NumericInput', () => ({
  NumericInput: ({ value, onChange, placeholder, className, inputClassName, wrapperClassName }: {
    value: number | string; onChange: (e: { target: { value: string } }) => void; placeholder?: string
    className?: string; inputClassName?: string; wrapperClassName?: string
  }) => (
    <input
      type="number"
      data-testid="numeric-input"
      value={value}
      placeholder={placeholder}
      className={`${className ?? ''} ${inputClassName ?? ''}`}
      data-wrapper-class={wrapperClassName}
      onChange={(e) => onChange?.(e)}
    />
  ),
}))

// ── Helpers ──

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (err: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

// ── Imports (after mocks) ──

import { ProfessionalSkillsSection } from '@/components/character-sheet/ProfessionalSkillsSection'
import type { ProfessionalSkill } from '@/components/character-sheet/types'
import { InlineClickEdit } from '@/components/character-sheet/InlineClickEdit'
import { CoreResourceCard } from '@/components/character-sheet/CoreResourceCard'
import { StoryField } from '@/components/character-sheet/StoryField'

// ════════════════════════════════════════════════════════════
// ProfessionalSkillsSection
// ════════════════════════════════════════════════════════════

const defaultTemplateAttrs = [
  { id: 'attr-1', key: 'str', name: 'Strength' },
  { id: 'attr-2', key: 'dex', name: 'Dexterity' },
]

const defaultProps = {
  sheetId: 'sheet-1',
  permissions: {
    canEditProfessionalSkills: true,
    canEditAbilities: false,
    canEditCharacter: false,
    canEditInventory: false,
    canEditPersonalAbilities: false,
    canEditResistances: false,
    canEditResources: false,
    canEditSkills: false,
    canEditStory: false,
  },
  modifierResults: { str: 3, dex: 5 } as Record<string, number | null>,
  templateAttributes: defaultTemplateAttrs,
  allProfiles: [],
}

interface MakeSkillOverrides extends Partial<ProfessionalSkill> {}

function makeSkill(overrides: MakeSkillOverrides = {}) {
  const base: ProfessionalSkill = {
    id: 'sk-1',
    name: 'Blacksmith',
    attributeId: 'attr-1',
    attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
    order: 0,
    profileValues: [],
  }
  return { ...base, ...overrides }
}

describe('ProfessionalSkillsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue([])
  })

  // ── Loading state ──

  it('shows loading indicator while fetching skills', () => {
    mockGet.mockReturnValue(new Promise(() => {})) // never resolves
    render(<ProfessionalSkillsSection {...defaultProps} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  // ── Empty state ──

  it('shows empty state when no skills and not loading', async () => {
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('No Professional Skills added yet.')).toBeInTheDocument()
    })
    expect(screen.getByText('Click \'+ Add Professional Skill\' to create one.')).toBeInTheDocument()
  })

  it('shows skill count badge with 0 when empty', async () => {
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  it('does not show "+ Add Professional Skill" button when canEditProfessionalSkills is false', async () => {
    render(<ProfessionalSkillsSection {...defaultProps} permissions={{ ...defaultProps.permissions, canEditProfessionalSkills: false }} />)
    await waitFor(() => {
      expect(screen.getByText('No Professional Skills added yet.')).toBeInTheDocument()
    })
    expect(screen.queryByText('+ Add Professional Skill')).not.toBeInTheDocument()
  })

  // ── Renders skill rows ──

  it('renders skill rows with name, attribute, total, and MOD', async () => {
    const skills = [
      makeSkill({ id: 'sk-1', name: 'Blacksmith', attributeId: 'attr-1', attribute: { id: 'attr-1', key: 'str', name: 'Strength' } }),
      makeSkill({ id: 'sk-2', name: 'Alchemy', attributeId: 'attr-2', attribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' } }),
    ]
    mockGet.mockResolvedValue(skills)
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Blacksmith')).toBeInTheDocument()
    })
    expect(screen.getByText('Alchemy')).toBeInTheDocument()
    expect(screen.getByText('Strength')).toBeInTheDocument()
    expect(screen.getByText('Dexterity')).toBeInTheDocument()
    // Total values from modifierResults: str=3, dex=5
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1)
    // MOD column shows dash when no profile values
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })

  it('renders skill count badge with correct count', async () => {
    const skills = [
      makeSkill({ id: 'sk-1' }),
      makeSkill({ id: 'sk-2' }),
    ]
    mockGet.mockResolvedValue(skills)
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('displays Edit and Delete buttons for each skill when isOwner is true', async () => {
    const skills = [makeSkill()]
    mockGet.mockResolvedValue(skills)
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('hides Edit and Delete buttons when canEditProfessionalSkills is false', async () => {
    const skills = [makeSkill()]
    mockGet.mockResolvedValue(skills)
    render(<ProfessionalSkillsSection {...defaultProps} permissions={{ ...defaultProps.permissions, canEditProfessionalSkills: false }} />)
    await waitFor(() => {
      expect(screen.getByText('Blacksmith')).toBeInTheDocument()
    })
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
  })

  it('shows dash for total when skill has no attributeId', async () => {
    const skills = [makeSkill({ attributeId: null, attribute: null })]
    mockGet.mockResolvedValue(skills)
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(3) // total, MOD, and profile columns
    })
  })

  it('shows dash for total when modifierResults has no matching key', async () => {
    const skills = [makeSkill({ attributeId: 'attr-99', attribute: { id: 'attr-99', key: 'unk', name: 'Unknown' } })]
    mockGet.mockResolvedValue(skills)
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(3)
    })
  })

  it('uses attribute key for modifierResults lookup first, then attributeId fallback', async () => {
    // modifierResults has 'str' key, skill uses attribute key 'str'
    const skills = [makeSkill({ attributeId: 'attr-1', attribute: { id: 'attr-1', key: 'str', name: 'Strength' } })]
    mockGet.mockResolvedValue(skills)
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
      // MOD shows dash when no profile values
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('calls api.get with correct URL on mount', async () => {
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/character-sheets/sheet-1/professional-skills')
    })
  })

  it('re-fetches when sheetId changes', async () => {
    const { rerender } = render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(1)
    })
    rerender(<ProfessionalSkillsSection {...defaultProps} sheetId="sheet-2" />)
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(2)
    })
    expect(mockGet).toHaveBeenLastCalledWith('/character-sheets/sheet-2/professional-skills')
  })

  it('silently fails when fetch errors', async () => {
    mockGet.mockRejectedValue(new Error('Network error'))
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('No Professional Skills added yet.')).toBeInTheDocument()
    })
  })

  // ── Create modal ──

  it('opens create modal on button click', async () => {
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('+ Add Professional Skill')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('+ Add Professional Skill'))
    expect(screen.getByText('Add Professional Skill')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('closes create modal on Cancel click', async () => {
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('+ Add Professional Skill')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('+ Add Professional Skill'))
    expect(screen.getByText('Add Professional Skill')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Add Professional Skill')).not.toBeInTheDocument()
  })

  it('creates a new skill via API and adds it to the list', async () => {
    const deferred = createDeferred()
    mockPost.mockReturnValue(deferred.promise)
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('+ Add Professional Skill')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('+ Add Professional Skill'))

    const nameInput = screen.getByRole('textbox')
    await userEvent.type(nameInput, 'Mining')
    const attrSelect = screen.getByRole('combobox')
    await userEvent.selectOptions(attrSelect, 'attr-2')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(mockPost).toHaveBeenCalledWith(
      '/character-sheets/sheet-1/professional-skills',
      { name: 'Mining', attributeId: 'attr-2' },
    )

    const newSkill: ProfessionalSkill = { id: 'sk-new', name: 'Mining', attributeId: 'attr-2', attribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' }, order: 0, profileValues: [] }
    // After create, handleCreate calls fetchSkills() — mock the refetch
    mockGet.mockResolvedValue([newSkill])
    deferred.resolve(newSkill)
    await waitFor(() => {
      expect(screen.getByText('Mining')).toBeInTheDocument()
    })
  })

  it('shows "Adding..." on submit button while saving', async () => {
    mockPost.mockReturnValue(new Promise(() => {}))
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('+ Add Professional Skill')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('+ Add Professional Skill'))
    await userEvent.type(screen.getByRole('textbox'), 'Mining')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('Adding...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adding...'})).toBeDisabled()
  })

  it('does not submit create when name is empty', async () => {
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('+ Add Professional Skill')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('+ Add Professional Skill'))
    const addBtn = screen.getByRole('button', { name: 'Add' })
    expect(addBtn).toBeDisabled()
  })

  it('shows error banner when create fails', async () => {
    mockPost.mockRejectedValue(new Error('Name already taken'))
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('+ Add Professional Skill')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('+ Add Professional Skill'))
    await userEvent.type(screen.getByRole('textbox'), 'Duplicate')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => {
      expect(screen.getByText('Name already taken')).toBeInTheDocument()
      expect(screen.getByText('Add Professional Skill')).toBeInTheDocument() // modal stays open
    })
  })

  it('shows "Failed to create" when error has no message', async () => {
    mockPost.mockRejectedValue('string error')
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('+ Add Professional Skill')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('+ Add Professional Skill'))
    await userEvent.type(screen.getByRole('textbox'), 'Something')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => {
      expect(screen.getByText('Failed to create')).toBeInTheDocument()
    })
  })

  it('creates with attributeId null when no attribute selected', async () => {
    const deferred = createDeferred()
    mockPost.mockReturnValue(deferred.promise)
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('+ Add Professional Skill')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('+ Add Professional Skill'))
    await userEvent.type(screen.getByRole('textbox'), 'Cooking')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(mockPost).toHaveBeenCalledWith(
      '/character-sheets/sheet-1/professional-skills',
      { name: 'Cooking', attributeId: null },
    )
  })

  // ── Edit mode ──

  it('enters edit mode when Edit is clicked', async () => {
    const skills = [makeSkill()]
    mockGet.mockResolvedValue(skills)
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Edit'))
    // Name input appears with skill name
    const nameInput = screen.getByDisplayValue('Blacksmith')
    expect(nameInput).toBeInTheDocument()
    // Select for attribute appears
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    // Save and Cancel buttons appear
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('cancels edit mode and restores original values', async () => {
    const skills = [makeSkill()]
    mockGet.mockResolvedValue(skills)
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Edit'))
    // Modify the input
    const input = screen.getByDisplayValue('Blacksmith') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Edited' } })
    await userEvent.click(screen.getByText('Cancel'))
    // Should show original name
    expect(screen.getByText('Blacksmith')).toBeInTheDocument()
    expect(screen.queryByText('Edited')).not.toBeInTheDocument()
  })

  it('saves edited skill via API', async () => {
    const deferred = createDeferred()
    mockPatch.mockReturnValue(deferred.promise)
    const skills = [makeSkill()]
    mockGet.mockResolvedValue(skills)
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Edit'))

    // Change the name input
    const nameInput = screen.getByDisplayValue('Blacksmith')
    fireEvent.change(nameInput, { target: { value: 'Master Blacksmith' } })
    // Change the select — find the select by role and select a different option
    const select = screen.getByRole('combobox')
    await userEvent.selectOptions(select, 'attr-2')

    await userEvent.click(screen.getByText('Save'))

    expect(mockPatch).toHaveBeenCalledWith(
      '/character-sheets/sheet-1/professional-skills/sk-1',
      { name: 'Master Blacksmith', attributeId: 'attr-2' },
    )

    const updatedSkill = {
      id: 'sk-1',
      name: 'Master Blacksmith',
      attributeId: 'attr-2',
      attribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' },
      order: 0,
    }
    deferred.resolve(updatedSkill)
    await waitFor(() => {
      expect(screen.getByText('Master Blacksmith')).toBeInTheDocument()
    })
  })

  it('does not save when edited name is empty', async () => {
    const skills = [makeSkill()]
    mockGet.mockResolvedValue(skills)
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Edit'))

    const input = screen.getByDisplayValue('Blacksmith')
    fireEvent.change(input, { target: { value: '' } })
    await userEvent.click(screen.getByText('Save'))

    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('shows error banner on update failure', async () => {
    mockPatch.mockRejectedValue(new Error('Update failed'))
    const skills = [makeSkill()]
    mockGet.mockResolvedValue(skills)
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Edit'))
    const input = screen.getByDisplayValue('Blacksmith')
    fireEvent.change(input, { target: { value: 'Changed' } })
    await userEvent.click(screen.getByText('Save'))
    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument()
    })
  })

  // ── Delete ──

  it('deletes a skill via API and removes from list', async () => {
    mockDelete.mockResolvedValue(undefined)
    const skills = [makeSkill({ id: 'sk-1' })]
    mockGet.mockResolvedValue(skills)
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Delete'))

    expect(mockDelete).toHaveBeenCalledWith('/character-sheets/sheet-1/professional-skills/sk-1')
    await waitFor(() => {
      expect(screen.getByText('No Professional Skills added yet.')).toBeInTheDocument()
    })
  })

  it('silently fails on delete error', async () => {
    mockDelete.mockRejectedValue(new Error('Delete failed'))
    const skills = [makeSkill({ id: 'sk-1' })]
    mockGet.mockResolvedValue(skills)
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Delete'))
    // Skill still visible
    await waitFor(() => {
      expect(screen.getByText('Blacksmith')).toBeInTheDocument()
    })
  })

  // ── Helper text ──

  it('shows helper text when skills exist', async () => {
    const skills = [makeSkill()]
    mockGet.mockResolvedValue(skills)
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText(/Professional Skills use/)).toBeInTheDocument()
    })
  })

  it('does not show helper text when no skills', async () => {
    render(<ProfessionalSkillsSection {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('No Professional Skills added yet.')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Professional Skills use/)).not.toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════════════
// InlineClickEdit
// ════════════════════════════════════════════════════════════

describe('InlineClickEdit', () => {
  let mockOnSave: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnSave = vi.fn().mockResolvedValue(undefined)
  })

  // ── Display mode ──

  it('renders value as button text when not editing', () => {
    render(<InlineClickEdit value="Hello" onSave={mockOnSave} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('shows emptyDisplay when value is empty string', () => {
    render(<InlineClickEdit value="" onSave={mockOnSave} emptyDisplay="<empty>" />)
    expect(screen.getByText('<empty>')).toBeInTheDocument()
  })

  it('shows emptyDisplay when value is only whitespace', () => {
    render(<InlineClickEdit value="   " onSave={mockOnSave} emptyDisplay="blank" />)
    expect(screen.getByText('blank')).toBeInTheDocument()
  })

  it('uses default emptyDisplay — when not specified', () => {
    render(<InlineClickEdit value="" onSave={mockOnSave} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders as button in display mode', () => {
    render(<InlineClickEdit value="test" onSave={mockOnSave} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('applies custom className to display button', () => {
    const { container } = render(<InlineClickEdit value="test" onSave={mockOnSave} className="custom-cls" />)
    const btn = container.querySelector('button')
    expect(btn?.className).toContain('custom-cls')
  })

  // ── Enter edit mode ──

  it('enters edit mode (input) on click', async () => {
    const user = userEvent.setup()
    render(<InlineClickEdit value="Edit me" onSave={mockOnSave} />)
    await user.click(screen.getByText('Edit me'))
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('Edit me')
    expect(input).toHaveFocus()
  })

  it('enters edit mode (textarea) on click when as="textarea"', async () => {
    const user = userEvent.setup()
    render(<InlineClickEdit value="Long text" onSave={mockOnSave} as="textarea" />)
    await user.click(screen.getByText('Long text'))
    const textarea = screen.getByRole('textbox')
    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea).toHaveValue('Long text')
  })

  it('renders input by default', async () => {
    const user = userEvent.setup()
    render(<InlineClickEdit value="val" onSave={mockOnSave} />)
    await user.click(screen.getByText('val'))
    const input = screen.getByRole('textbox')
    expect(input.tagName).toBe('INPUT')
  })

  it('uses specified rows for textarea', async () => {
    const user = userEvent.setup()
    render(<InlineClickEdit value="val" onSave={mockOnSave} as="textarea" rows={5} />)
    await user.click(screen.getByText('val'))
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.rows).toBe(5)
  })

  // ── Save on blur (input) ──

  it('saves trimmed value on blur (input)', async () => {
    const user = userEvent.setup()
    mockOnSave.mockResolvedValue(undefined)
    render(<InlineClickEdit value="original" onSave={mockOnSave} />)
    await user.click(screen.getByText('original'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '  updated  ')
    fireEvent.blur(input)
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('updated')
    })
  })

  it('does not call onSave if trimmed value equals original', async () => {
    const user = userEvent.setup()
    render(<InlineClickEdit value="same" onSave={mockOnSave} />)
    await user.click(screen.getByText('same'))
    const input = screen.getByRole('textbox')
    fireEvent.blur(input)
    await waitFor(() => {
      expect(mockOnSave).not.toHaveBeenCalled()
    })
  })

  // ── Save on Enter (input) ──

  it('saves on Enter key (input)', async () => {
    const user = userEvent.setup()
    mockOnSave.mockResolvedValue(undefined)
    render(<InlineClickEdit value="start" onSave={mockOnSave} />)
    await user.click(screen.getByText('start'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'new')
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('new')
    })
  })

  // ── Cancel on Escape (input) ──

  it('cancels edit on Escape key (input) and restores original value', async () => {
    const user = userEvent.setup()
    render(<InlineClickEdit value="original" onSave={mockOnSave} />)
    await user.click(screen.getByText('original'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'changed')
    fireEvent.keyDown(input, { key: 'Escape' })
    // Should show original value again
    expect(screen.getByText('original')).toBeInTheDocument()
    expect(mockOnSave).not.toHaveBeenCalled()
  })

  // ── Save on blur (textarea) ──

  it('saves trimmed value on blur (textarea)', async () => {
    const user = userEvent.setup()
    mockOnSave.mockResolvedValue(undefined)
    render(<InlineClickEdit value="orig" onSave={mockOnSave} as="textarea" />)
    await user.click(screen.getByText('orig'))
    const textarea = screen.getByRole('textbox')
    await user.clear(textarea)
    await user.type(textarea, '  paragraph  ')
    fireEvent.blur(textarea)
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('paragraph')
    })
  })

  // ── Cancel on Escape (textarea) ──

  it('cancels edit on Escape key (textarea) and restores original', async () => {
    const user = userEvent.setup()
    render(<InlineClickEdit value="original" onSave={mockOnSave} as="textarea" />)
    await user.click(screen.getByText('original'))
    const textarea = screen.getByRole('textbox')
    await user.clear(textarea)
    await user.type(textarea, 'changed')
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(screen.getByText('original')).toBeInTheDocument()
    expect(mockOnSave).not.toHaveBeenCalled()
  })

  // ── Save rejection ──

  it('reverts draft when onSave rejects (input)', async () => {
    const user = userEvent.setup()
    mockOnSave.mockRejectedValue(new Error('fail'))
    render(<InlineClickEdit value="original" onSave={mockOnSave} />)
    await user.click(screen.getByText('original'))
    const input = screen.getByRole('textbox') as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'broken')
    fireEvent.blur(input)
    await waitFor(() => {
      expect(input).toHaveValue('original')
      // Should still be in edit mode (input visible)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  it('reverts draft when onSave rejects (textarea)', async () => {
    const user = userEvent.setup()
    mockOnSave.mockRejectedValue(new Error('fail'))
    render(<InlineClickEdit value="original" onSave={mockOnSave} as="textarea" />)
    await user.click(screen.getByText('original'))
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    await user.clear(textarea)
    await user.type(textarea, 'broken')
    fireEvent.blur(textarea)
    await waitFor(() => {
      expect(textarea).toHaveValue('original')
      // Should still be in edit mode (textarea visible)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  // ── Saving spinner ──

  it('shows spinner during save (input)', async () => {
    mockOnSave.mockReturnValue(new Promise(() => {})) // never resolves
    const user = userEvent.setup()
    render(<InlineClickEdit value="edit" onSave={mockOnSave} />)
    await user.click(screen.getByText('edit'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'saving')
    fireEvent.blur(input)
    await waitFor(() => {
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  it('shows spinner during save (textarea)', async () => {
    mockOnSave.mockReturnValue(new Promise(() => {})) // never resolves
    const user = userEvent.setup()
    render(<InlineClickEdit value="edit" onSave={mockOnSave} as="textarea" />)
    await user.click(screen.getByText('edit'))
    const textarea = screen.getByRole('textbox')
    await user.clear(textarea)
    await user.type(textarea, 'saving')
    fireEvent.blur(textarea)
    await waitFor(() => {
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  it('disables input while saving', async () => {
    mockOnSave.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(<InlineClickEdit value="edit" onSave={mockOnSave} />)
    await user.click(screen.getByText('edit'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'saving')
    fireEvent.blur(input)
    await waitFor(() => {
      expect(input).toBeDisabled()
    })
  })

  // ── Input className ──

  it('applies inputClassName to the input', async () => {
    const user = userEvent.setup()
    render(<InlineClickEdit value="test" onSave={mockOnSave} inputClassName="custom-input" />)
    await user.click(screen.getByText('test'))
    const input = screen.getByRole('textbox')
    expect(input.className).toContain('custom-input')
  })

  // ── Sync value prop ──

  it('syncs draft when value prop changes externally', async () => {
    const { rerender } = render(<InlineClickEdit value="first" onSave={mockOnSave} />)
    rerender(<InlineClickEdit value="second" onSave={mockOnSave} />)
    // Click to enter edit mode — should show the latest value
    const user = userEvent.setup()
    await user.click(screen.getByText('second'))
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('second')
  })
})

// ════════════════════════════════════════════════════════════
// CoreResourceCard
// ════════════════════════════════════════════════════════════

describe('CoreResourceCard', () => {
  let mockOnSave: ReturnType<typeof vi.fn>
  let mockOnModify: ReturnType<typeof vi.fn>

  const defaultResource = {
    id: 'res-1',
    slug: 'hp',
    displayName: 'Hit Points',
    enabled: true,
    editableByPlayer: true,
    showNotes: false,
  }

  const defaultValue = {
    id: 'val-1',
    coreResourceId: 'res-1',
    current: 50,
    maximum: 100,
    notes: null,
    coreResource: defaultResource,
  }

  const defaultPermissions = {
    canEditResources: true,
    canEditAbilities: false,
    canEditCharacter: false,
    canEditInventory: false,
    canEditPersonalAbilities: false,
    canEditResistances: false,
    canEditSkills: false,
    canEditStory: false,
    canEditProfessionalSkills: false,
  }

  beforeEach(() => {
    mockOnSave = vi.fn()
    mockOnModify = vi.fn()
  })

  // ── Basic rendering ──

  it('renders the resource display name', () => {
    render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
      />,
    )
    expect(screen.getByText('Hit Points')).toBeInTheDocument()
  })

  it('renders current and maximum values', () => {
    render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
      />,
    )
    expect(screen.getByText('Current')).toBeInTheDocument()
    expect(screen.getByText('Max')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('shows dash for null current value when not editable', () => {
    render(
      <CoreResourceCard
        resource={defaultResource}
        value={{ ...defaultValue, current: null, maximum: null }}
        isOwner={false}
        permissions={{ ...defaultPermissions, canEditResources: false }}
        onSave={mockOnSave}
      />,
    )
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })

  // ── Progress bar ──

  it('renders progress bar when maximum is positive', () => {
    const { container } = render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
      />,
    )
    // The inner bar uses an inline style with width
    const innerBar = container.querySelector('[style*="width"]') as HTMLElement
    expect(innerBar).toBeInTheDocument()
    expect(innerBar.style.width).toBe('50%')
  })

  it('does not render progress bar when maximum is null', () => {
    const { container } = render(
      <CoreResourceCard
        resource={defaultResource}
        value={{ ...defaultValue, current: 50, maximum: null }}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
      />,
    )
    const innerBar = container.querySelector('[style*="width"]')
    expect(innerBar).not.toBeInTheDocument()
  })

  it('does not render progress bar when maximum is 0', () => {
    const { container } = render(
      <CoreResourceCard
        resource={defaultResource}
        value={{ ...defaultValue, current: 0, maximum: 0 }}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
      />,
    )
    const innerBar = container.querySelector('[style*="width"]')
    expect(innerBar).not.toBeInTheDocument()
  })

  it('clamps progress bar width between 0 and 100 percent', () => {
    const { container } = render(
      <CoreResourceCard
        resource={defaultResource}
        value={{ ...defaultValue, current: 150, maximum: 100 }}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
      />,
    )
    const innerBar = container.querySelector('[style*="width"]') as HTMLElement
    expect(innerBar?.style.width).toBe('100%')
  })

  it('sets progress bar to 0% when current is negative', () => {
    const { container } = render(
      <CoreResourceCard
        resource={defaultResource}
        value={{ ...defaultValue, current: -10, maximum: 100 }}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
      />,
    )
    const innerBar = container.querySelector('[style*="width"]') as HTMLElement
    expect(innerBar?.style.width).toBe('0%')
  })

  it('uses resource color for progress bar when provided', () => {
    const { container } = render(
      <CoreResourceCard
        resource={{ ...defaultResource, color: '#ff0000' }}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
      />,
    )
    const innerBar = container.querySelector('[style*="background-color"]') as HTMLElement
    expect(innerBar?.style.backgroundColor).toBe('rgb(255, 0, 0)')
  })

  it('uses primary color fallback for progress bar when no color set', () => {
    const { container } = render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
      />,
    )
    const innerBar = container.querySelector('[style*="background-color"]') as HTMLElement
    expect(innerBar?.style.backgroundColor).toBe('var(--color-primary)')
  })

  // ── Notes (showNotes) ──

  it('shows InlineText for notes when showNotes is true and isOwner is true', () => {
    render(
      <CoreResourceCard
        resource={{ ...defaultResource, showNotes: true }}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
      />,
    )
    expect(screen.getByTestId('inline-text')).toBeInTheDocument()
  })

  it('shows plain notes text when showNotes is true but isOwner is false and notes exist', () => {
    render(
      <CoreResourceCard
        resource={{ ...defaultResource, showNotes: true }}
        value={{ ...defaultValue, notes: 'Emergency only' }}
        isOwner={false}
        permissions={{ ...defaultPermissions, canEditResources: false }}
        onSave={mockOnSave}
      />,
    )
    expect(screen.getByText((content) => content.includes('Emergency only'))).toBeInTheDocument()
  })

  it('shows nothing extra when showNotes is true, isOwner is false, and notes is null', () => {
    const { container } = render(
      <CoreResourceCard
        resource={{ ...defaultResource, showNotes: true }}
        value={defaultValue}
        isOwner={false}
        permissions={{ ...defaultPermissions, canEditResources: false }}
        onSave={mockOnSave}
      />,
    )
    // No InlineText, no notes span
    expect(screen.queryByTestId('inline-text')).not.toBeInTheDocument()
  })

  it('does not show notes section when showNotes is false even if isOwner is true', () => {
    render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
      />,
    )
    expect(screen.queryByTestId('inline-text')).not.toBeInTheDocument()
    const heading = screen.getByText('Hit Points')
    // No notes following the heading
    const headingContainer = heading.closest('h3')!
    expect(headingContainer.textContent).not.toContain('add notes')
  })

  // ── InlineNumber for editable current/max ──

  it('renders InlineNumber for current when canEdit is true', () => {
    render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
      />,
    )
    const numbers = screen.getAllByTestId('inline-number')
    expect(numbers.length).toBeGreaterThanOrEqual(2)
  })

  it('renders plain text for current and max when canEdit is false (not owner)', () => {
    render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={false}
        permissions={{ ...defaultPermissions, canEditResources: false }}
        onSave={mockOnSave}
      />,
    )
    expect(screen.queryByTestId('inline-number')).not.toBeInTheDocument()
    // Should still render numbers as plain text
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('renders plain text for current and max when editableByPlayer is false', () => {
    render(
      <CoreResourceCard
        resource={{ ...defaultResource, editableByPlayer: false }}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
      />,
    )
    expect(screen.queryByTestId('inline-number')).not.toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  // ── Modifier controls ──

  it('renders modifier controls when canEdit and onModify provided', () => {
    render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
        onModify={mockOnModify}
      />,
    )
    expect(screen.getByTestId('numeric-input')).toBeInTheDocument()
    expect(screen.getByText('+ Heal / Recover')).toBeInTheDocument()
    expect(screen.getByText('− Damage / Lose')).toBeInTheDocument()
  })

  it('does not render modifier controls when onModify is not provided', () => {
    render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
      />,
    )
    expect(screen.queryByTestId('numeric-input')).not.toBeInTheDocument()
    expect(screen.queryByText('+ Heal / Recover')).not.toBeInTheDocument()
    expect(screen.queryByText('− Damage / Lose')).not.toBeInTheDocument()
  })

  it('does not render modifier controls when canEdit is false', () => {
    render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={false}
        permissions={{ ...defaultPermissions, canEditResources: false }}
        onSave={mockOnSave}
        onModify={mockOnModify}
      />,
    )
    expect(screen.queryByTestId('numeric-input')).not.toBeInTheDocument()
    expect(screen.queryByText('+ Heal / Recover')).not.toBeInTheDocument()
  })

  it('disables Heal and Damage buttons when modifier is 0', () => {
    render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
        onModify={mockOnModify}
      />,
    )
    const healBtn = screen.getByText('+ Heal / Recover')
    const dmgBtn = screen.getByText('− Damage / Lose')
    expect(healBtn).toBeDisabled()
    expect(dmgBtn).toBeDisabled()
  })

  it('calls onModify with positive delta on Heal click', async () => {
    const user = userEvent.setup()
    render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
        onModify={mockOnModify}
      />,
    )
    const input = screen.getByTestId('numeric-input')
    fireEvent.change(input, { target: { value: '5' } })
    await user.click(screen.getByText('+ Heal / Recover'))
    expect(mockOnModify).toHaveBeenCalledWith('res-1', 5)
  })

  it('calls onModify with negative delta on Damage click', async () => {
    const user = userEvent.setup()
    render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
        onModify={mockOnModify}
      />,
    )
    const input = screen.getByTestId('numeric-input')
    fireEvent.change(input, { target: { value: '8' } })
    await user.click(screen.getByText('− Damage / Lose'))
    expect(mockOnModify).toHaveBeenCalledWith('res-1', -8)
  })

  it('resets modifier to 0 after click', async () => {
    const user = userEvent.setup()
    render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
        onModify={mockOnModify}
      />,
    )
    const input = screen.getByTestId('numeric-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '5' } })
    await user.click(screen.getByText('+ Heal / Recover'))
    // After clicking Heal, setModifier(0) is called, which sets value={0 || ''} -> ''
    await waitFor(() => {
      expect(input.value).toBe('')
    })
  })

  it('converts NaN input to 0 for modifier', async () => {
    const user = userEvent.setup()
    render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
        onModify={mockOnModify}
      />,
    )
    // Type a valid number first so button becomes enabled
    const input = screen.getByTestId('numeric-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '5' } })
    // Then type NaN
    fireEvent.change(input, { target: { value: 'abc' } })
    // When the value is 'abc', parseInt('abc', 10) || 0 => 0, so modifier stays 0
    // This means the Heal button should be disabled since modifier is 0
    const healBtn = screen.getByText('+ Heal / Recover')
    expect(healBtn).toBeDisabled()
  })

  // ── Inline save callbacks ──

  it('calls onSave for notes when InlineText is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CoreResourceCard
        resource={{ ...defaultResource, showNotes: true }}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
      />,
    )
    const inlineText = screen.getByTestId('inline-text')
    await user.click(inlineText)
    expect(mockOnSave).toHaveBeenCalledWith('res-1', 'notes', 'saved-text')
  })

  it('calls onSave for current when InlineNumber is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
        onModify={mockOnModify}
      />,
    )
    const [currentInline, _maxInline] = screen.getAllByTestId('inline-number')
    await user.click(currentInline)
    expect(mockOnSave).toHaveBeenCalledWith('res-1', 'current', '50')
  })

  it('calls onSave for maximum when second InlineNumber is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CoreResourceCard
        resource={defaultResource}
        value={defaultValue}
        isOwner={true}
        permissions={defaultPermissions}
        onSave={mockOnSave}
        onModify={mockOnModify}
      />,
    )
    const [_currentInline, maxInline] = screen.getAllByTestId('inline-number')
    await user.click(maxInline)
    expect(mockOnSave).toHaveBeenCalledWith('res-1', 'maximum', '100')
  })
})

// ════════════════════════════════════════════════════════════
// StoryField
// ════════════════════════════════════════════════════════════

describe('StoryField', () => {
  it('renders label and value when value is provided', () => {
    render(<StoryField label="Backstory" value="A long tale..." />)
    expect(screen.getByText('Backstory')).toBeInTheDocument()
    expect(screen.getByText('A long tale...')).toBeInTheDocument()
  })

  it('returns null when value is null', () => {
    const { container } = render(<StoryField label="Backstory" value={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when value is undefined', () => {
    const { container } = render(<StoryField label="Backstory" value={undefined} />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when value is empty string', () => {
    const { container } = render(<StoryField label="Backstory" value="" />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when value is only whitespace', () => {
    const { container } = render(<StoryField label="Backstory" value="   " />)
    expect(container.innerHTML).toBe('')
  })

  it('preserves whitespace in value with whitespace-pre-wrap class', () => {
    render(<StoryField label="Notes" value="Line 1\n\nLine 2" />)
    const p = screen.getByText((content) => content.includes('Line 1') && content.includes('Line 2'))
    expect(p.className).toContain('whitespace-pre-wrap')
  })

  it('renders multiple StoryField instances independently', () => {
    render(
      <div>
        <StoryField label="Appearance" value="Tall" />
        <StoryField label="Backstory" value="Rich" />
      </div>,
    )
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByText('Backstory')).toBeInTheDocument()
    expect(screen.getByText('Tall')).toBeInTheDocument()
    expect(screen.getByText('Rich')).toBeInTheDocument()
  })
})
