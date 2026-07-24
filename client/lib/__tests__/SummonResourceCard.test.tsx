import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ── Mock child components ──

const mockOnSaveInlineText = vi.fn()
const mockOnSaveInlineNumber = vi.fn()

vi.mock('@/lib/inline-editable', () => ({
  InlineText: ({ value, onSave, placeholder, className, emptyDisplay }: {
    value: string; onSave: (v: string) => Promise<void>; placeholder?: string; className?: string; emptyDisplay?: string
  }) => (
    <button
      type="button"
      data-testid="inline-text"
      data-value={value}
      data-placeholder={placeholder}
      className={className}
      data-empty-display={emptyDisplay}
      onClick={() => { mockOnSaveInlineText.mockImplementation(onSave); onSave('saved-name') }}
    >
      {value?.trim() || emptyDisplay || placeholder || '—'}
    </button>
  ),
  InlineNumber: ({ value, onSave, className, inputClassName }: {
    value: number | string | null | undefined; onSave: (v: number) => Promise<void>; className?: string; inputClassName?: string
  }) => (
    <button
      type="button"
      data-testid="inline-number"
      data-value={String(value ?? '')}
      className={className}
      onClick={() => { mockOnSaveInlineNumber.mockImplementation(onSave); onSave(Number(value) || 0) }}
    >
      {value != null && value !== '' ? String(value) : '—'}
    </button>
  ),
}))

vi.mock('@/components/shared/NumericInput', () => ({
  NumericInput: ({ value, onChange, placeholder, className, inputClassName, wrapperClassName, min }: {
    value: number | string; onChange: (e: { target: { value: string } }) => void; placeholder?: string
    className?: string; inputClassName?: string; wrapperClassName?: string; min?: number
  }) => (
    <input
      type="number"
      data-testid="numeric-input"
      value={value}
      placeholder={placeholder}
      data-min={min}
      className={`${className ?? ''} ${inputClassName ?? ''}`}
      data-wrapper-class={wrapperClassName}
      onChange={(e) => onChange?.(e)}
    />
  ),
}))

vi.mock('@/components/character-sheet/HealthBar', () => ({
  HealthBar: ({ current, maximum, onChange, permissions }: {
    current: number | null; maximum: number | null
    onChange: (field: 'current' | 'maximum', value: number | null) => void
    permissions: { canEditAbilities: boolean }
  }) => (
    <div data-testid="health-bar" data-current={current} data-maximum={maximum} data-can-edit={permissions.canEditAbilities}>
      <button
        data-testid="health-bar-damage"
        onClick={() => onChange('current', Math.max(0, (current ?? 0) - 10))}
      >
        Damage
      </button>
      <button
        data-testid="health-bar-heal"
        onClick={() => onChange('current', (current ?? 0) + 10)}
      >
        Heal
      </button>
    </div>
  ),
}))

// ── Import component under test (after mocks) ──

import { SummonResourceCard, type AttributeDisplay } from '@/components/character-sheet/SummonResourceCard'
import type { SheetPermissions, Ability, SummonSkillData } from '@/components/character-sheet/types'

// ── Helpers ──

function editPermissions(overrides: Partial<SheetPermissions> = {}): SheetPermissions {
  return {
    isOwner: false,
    canEditSkills: false,
    canEditAbilities: true,
    canEditAttributes: false,
    canEditResources: false,
    canEditInventory: false,
    canEditCharacter: false,
    ...overrides,
  }
}

function makeAbility(overrides: Partial<Ability> = {}): Ability {
  return {
    id: 'summon-1',
    name: 'Spirit Wolf',
    type: 'SUMMON',
    description: 'A loyal spirit wolf',
    notes: null,
    levels: [],
    summonAttributes: [
      { id: 'sa-1', abilityId: 'summon-1', attributeId: 'attr-1', value: '14' },
      { id: 'sa-2', abilityId: 'summon-1', attributeId: 'attr-2', value: '8' },
    ],
    summonAcValues: [{ id: 'acv-1', abilityId: 'summon-1', value: '15' }],
    summonHealth: { id: 'sh-1', abilityId: 'summon-1', current: 30, maximum: 50, notes: null },
    childAbilities: [],
    ...overrides,
    summonSkills: (overrides.summonSkills ?? []) as SummonSkillData[],
  }
}

function makeAttributeDisplays(overrides: Partial<AttributeDisplay>[] = []): AttributeDisplay[] {
  const defaults: AttributeDisplay[] = [
    { key: 'str', name: 'Strength', value: '14', modifier: 2, attributeId: 'attr-1' },
    { key: 'dex', name: 'Dexterity', value: '8', modifier: -1, attributeId: 'attr-2' },
  ]
  return defaults.map((d, i) => ({ ...d, ...(overrides[i] ?? {}) }))
}

// ── Tests ──

describe('SummonResourceCard', () => {

  beforeEach(() => {
    mockOnSaveInlineText.mockReset()
    mockOnSaveInlineNumber.mockReset()
  })

  describe('Full render', () => {
    it('renders all sections when provided with full data', () => {
      const saveSummonAttribute = vi.fn()
      const saveSummonAcValue = vi.fn()
      const saveSummonHealth = vi.fn()
      const handleAddSummonSkill = vi.fn()
      const handleUpdateSummonSkill = vi.fn()
      const handleRemoveSummonSkill = vi.fn()

      const ability = makeAbility({
        summonSkills: [
          { id: 'sk-1', abilityId: 'summon-1', name: 'Athletics', manualValue: 5 },
        ],
      })
      const attrs = makeAttributeDisplays()

      render(
        <SummonResourceCard
          ability={ability}
          attributeDisplays={attrs}
          acResult={15}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={saveSummonAttribute}
          saveSummonAcValue={saveSummonAcValue}
          saveSummonHealth={saveSummonHealth}
          handleAddSummonSkill={handleAddSummonSkill}
          handleUpdateSummonSkill={handleUpdateSummonSkill}
          handleRemoveSummonSkill={handleRemoveSummonSkill}
        />
      )

      // Attributes section
      expect(screen.getByText('Attributes')).toBeTruthy()
      expect(screen.getByText('str')).toBeTruthy()
      expect(screen.getByText('dex')).toBeTruthy()

      // AC section
      expect(screen.getByText('CA / AC')).toBeTruthy()
      // AC value appears both as display text and InlineNumber when editable
      const acValueDisplays = screen.getAllByText('15')
      expect(acValueDisplays.length).toBeGreaterThanOrEqual(1)

      // Health bar
      expect(screen.getByTestId('health-bar')).toBeTruthy()

      // Skills section
      expect(screen.getByText('Skills')).toBeTruthy()
      expect(screen.getByText('+ Add Skill')).toBeTruthy()
    })

    it('renders attributes with modifier values', () => {
      const saveSummonAttribute = vi.fn()
      const attrs = makeAttributeDisplays()

      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={attrs}
          acResult={15}
          permissions={editPermissions({ canEditAbilities: false })}
          saveSummonAttribute={saveSummonAttribute}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      // Positive modifier displayed as +2
      expect(screen.getByText('+2')).toBeTruthy()
      // Negative modifier displayed as -1
      expect(screen.getByText('-1')).toBeTruthy()
    })
  })

  describe('Attribute display', () => {
    it('shows attribute value from attributeDisplays', () => {
      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={makeAttributeDisplays()}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: false })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      // The value "14" and "8" should be displayed somewhere
      expect(screen.getByText('14')).toBeTruthy()
      expect(screen.getByText('8')).toBeTruthy()
    })

    it('renders InlineNumber for attribute values when canEdit is true', () => {
      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={makeAttributeDisplays()}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      const inlineNumbers = screen.getAllByTestId('inline-number')
      // There should be at least the attribute InlineNumbers (one per attribute)
      expect(inlineNumbers.length).toBeGreaterThanOrEqual(2)
    })

    it('renders plain text for attribute values when canEdit is false', () => {
      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={makeAttributeDisplays()}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: false })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      // No InlineNumber for attributes when canEdit is false
      const inlineNumbers = screen.queryAllByTestId('inline-number')
      expect(inlineNumbers.length).toBe(0) // AC InlineNumber also hidden
    })

    it('shows dash modifier when modifier is null', () => {
      const attrs: AttributeDisplay[] = [
        { key: 'str', name: 'Strength', value: '14', modifier: null, attributeId: 'attr-1' },
      ]

      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={attrs}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: false })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      expect(screen.getByText('—')).toBeTruthy()
    })

    it('calls saveSummonAttribute when attribute InlineNumber is saved', () => {
      const saveSummonAttribute = vi.fn()

      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={makeAttributeDisplays()}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={saveSummonAttribute}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      // Click an InlineNumber to trigger onSave
      const inlineNumbers = screen.getAllByTestId('inline-number')
      fireEvent.click(inlineNumbers[0])

      expect(saveSummonAttribute).toHaveBeenCalledWith('summon-1', 'attr-1', '14')
    })
  })

  describe('AC section', () => {
    it('shows acResult when provided', () => {
      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={[]}
          acResult={18}
          permissions={editPermissions({ canEditAbilities: false })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      expect(screen.getByText('18')).toBeTruthy()
    })

    it('shows raw AC value when acResult is null', () => {
      render(
        <SummonResourceCard
          ability={makeAbility({ summonAcValues: [{ id: 'acv-1', abilityId: 'summon-1', value: '12' }] })}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: false })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      expect(screen.getByText('12')).toBeTruthy()
    })

    it('shows dash when both acResult and acValue are absent', () => {
      render(
        <SummonResourceCard
          ability={makeAbility({ summonAcValues: [] })}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: false })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      const acSection = screen.getByText('CA / AC').parentElement!
      expect(acSection.textContent).toContain('—')
    })

    it('renders InlineNumber for AC when canEdit is true', () => {
      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={[]}
          acResult={15}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      const inlineNumbers = screen.getAllByTestId('inline-number')
      const acInlineNumber = inlineNumbers.find(el => el.getAttribute('data-value') === '15')
      expect(acInlineNumber).toBeTruthy()
    })

    it('calls saveSummonAcValue when AC InlineNumber is saved', () => {
      const saveSummonAcValue = vi.fn()

      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={[]}
          acResult={15}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={saveSummonAcValue}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      // Click InlineNumbers until we find the AC one (value '15')
      const inlineNumbers = screen.getAllByTestId('inline-number')
      for (const el of inlineNumbers) {
        fireEvent.click(el)
      }

      expect(saveSummonAcValue).toHaveBeenCalledWith('summon-1', '15')
    })
  })

  describe('HealthBar', () => {
    it('renders HealthBar with current and maximum from summonHealth', () => {
      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      const healthBar = screen.getByTestId('health-bar')
      expect(healthBar).toBeTruthy()
      expect(healthBar.getAttribute('data-current')).toBe('30')
      expect(healthBar.getAttribute('data-maximum')).toBe('50')
    })

    it('renders HealthBar with null values when summonHealth is null', () => {
      render(
        <SummonResourceCard
          ability={makeAbility({ summonHealth: null })}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      const healthBar = screen.getByTestId('health-bar')
      // null props are not rendered as attributes by React, so getAttribute returns null
      expect(healthBar.getAttribute('data-current')).toBeNull()
      expect(healthBar.getAttribute('data-maximum')).toBeNull()
    })

    it('passes canEdit to HealthBar based on permissions', () => {
      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      const healthBar = screen.getByTestId('health-bar')
      expect(healthBar.getAttribute('data-can-edit')).toBe('true')
    })

    it('forwards HealthBar onChange to saveSummonHealth', () => {
      const saveSummonHealth = vi.fn()

      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={saveSummonHealth}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      const damageBtn = screen.getByTestId('health-bar-damage')
      fireEvent.click(damageBtn)

      expect(saveSummonHealth).toHaveBeenCalledWith('summon-1', 'current', 20) // 30 - 10 = 20
    })
  })

  describe('Skills list', () => {
    it('shows skills from summonSkills array', () => {
      const ability = makeAbility({
        summonSkills: [
          { id: 'sk-1', abilityId: 'summon-1', name: 'Athletics', manualValue: 5 },
          { id: 'sk-2', abilityId: 'summon-1', name: 'Stealth', manualValue: 3 },
        ],
      })

      render(
        <SummonResourceCard
          ability={ability}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: false })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      expect(screen.getByText('Athletics')).toBeTruthy()
      expect(screen.getByText('Stealth')).toBeTruthy()
      expect(screen.getByText('5')).toBeTruthy()
      expect(screen.getByText('3')).toBeTruthy()
    })

    it('shows empty state when no skills', () => {
      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      expect(screen.getByText('No skills yet. Add one!')).toBeTruthy()
    })

    it('shows InlineText and InlineNumber for each skill when canEdit is true', () => {
      const ability = makeAbility({
        summonSkills: [
          { id: 'sk-1', abilityId: 'summon-1', name: 'Athletics', manualValue: 5 },
        ],
      })

      render(
        <SummonResourceCard
          ability={ability}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      const inlineTexts = screen.getAllByTestId('inline-text')
      const inlineNumbers = screen.getAllByTestId('inline-number')

      expect(inlineTexts.length).toBeGreaterThanOrEqual(1)
      expect(inlineNumbers.length).toBeGreaterThanOrEqual(1)
    })

    it('renders plain text for skill name and value when canEdit is false', () => {
      const ability = makeAbility({
        summonSkills: [
          { id: 'sk-1', abilityId: 'summon-1', name: 'Athletics', manualValue: 5 },
        ],
      })

      render(
        <SummonResourceCard
          ability={ability}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: false })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      // Should not have inline-edit buttons
      expect(screen.queryAllByTestId('inline-text').length).toBe(0)
      expect(screen.queryAllByTestId('inline-number').length).toBe(0)
    })

    it('calls handleUpdateSummonSkill when skill name is saved', () => {
      const handleUpdateSummonSkill = vi.fn()
      const ability = makeAbility({
        summonSkills: [
          { id: 'sk-1', abilityId: 'summon-1', name: 'Athletics', manualValue: 5 },
        ],
      })

      render(
        <SummonResourceCard
          ability={ability}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={handleUpdateSummonSkill}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      // Click the InlineText for the skill name
      const inlineTexts = screen.getAllByTestId('inline-text')
      fireEvent.click(inlineTexts[0])

      expect(handleUpdateSummonSkill).toHaveBeenCalledWith('summon-1', 'sk-1', 'saved-name', 5)
    })

    it('calls handleUpdateSummonSkill when skill value is saved', () => {
      const handleUpdateSummonSkill = vi.fn()
      const ability = makeAbility({
        summonSkills: [
          { id: 'sk-1', abilityId: 'summon-1', name: 'Athletics', manualValue: 5 },
        ],
      })

      render(
        <SummonResourceCard
          ability={ability}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={handleUpdateSummonSkill}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      // Click the InlineNumber for the skill value
      const inlineNumbers = screen.getAllByTestId('inline-number')
      // AC InlineNumber has value '15' from acResult, skill InlineNumber has value '5'
      // Find the one with '5'
      const skillValueInline = inlineNumbers.find(el => el.getAttribute('data-value') === '5')
      expect(skillValueInline).toBeTruthy()
      if (skillValueInline) {
        fireEvent.click(skillValueInline)
      }

      expect(handleUpdateSummonSkill).toHaveBeenCalledWith('summon-1', 'sk-1', 'Athletics', 5)
    })

    it('calls handleRemoveSummonSkill when remove button is clicked', () => {
      const handleRemoveSummonSkill = vi.fn()
      const ability = makeAbility({
        summonSkills: [
          { id: 'sk-1', abilityId: 'summon-1', name: 'Athletics', manualValue: 5 },
        ],
      })

      render(
        <SummonResourceCard
          ability={ability}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={handleRemoveSummonSkill}
        />
      )

      // Click the remove button (X icon)
      const removeBtn = screen.getByTitle('Remove skill')
      expect(removeBtn).toBeTruthy()
      fireEvent.click(removeBtn)

      expect(handleRemoveSummonSkill).toHaveBeenCalledWith('summon-1', 'sk-1')
    })
  })

  describe('Add skill form', () => {
    it('shows add skill form when "+ Add Skill" is clicked', async () => {
      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      // Click add skill
      await act(async () => {
        fireEvent.click(screen.getByText('+ Add Skill'))
      })

      // The add form should now be visible
      const skillInput = screen.getByPlaceholderText('Skill name')
      expect(skillInput).toBeTruthy()
      expect(screen.getByText('Add')).toBeTruthy()
      expect(screen.getByText('Cancel')).toBeTruthy()
    })

    it('calls handleAddSummonSkill when add form is submitted', async () => {
      const handleAddSummonSkill = vi.fn()

      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={handleAddSummonSkill}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      // Open add form
      await act(async () => {
        fireEvent.click(screen.getByText('+ Add Skill'))
      })

      // Fill in the name
      const skillNameInput = screen.getByPlaceholderText('Skill name')
      fireEvent.change(skillNameInput, { target: { value: 'Perception' } })

      // Fill in the value
      const valueInput = screen.getByPlaceholderText('Value')
      fireEvent.change(valueInput, { target: { value: '7' } })

      // Click Add
      await act(async () => {
        fireEvent.click(screen.getByText('Add'))
      })

      expect(handleAddSummonSkill).toHaveBeenCalledWith('summon-1', 'Perception', 7)
    })

    it('does not call handleAddSummonSkill with empty name', async () => {
      const handleAddSummonSkill = vi.fn()

      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={handleAddSummonSkill}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      // Open add form
      await act(async () => {
        fireEvent.click(screen.getByText('+ Add Skill'))
      })

      // Click Add without filling name
      await act(async () => {
        fireEvent.click(screen.getByText('Add'))
      })

      expect(handleAddSummonSkill).not.toHaveBeenCalled()
    })

    it('hides add form on Cancel', async () => {
      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      // Open add form
      await act(async () => {
        fireEvent.click(screen.getByText('+ Add Skill'))
      })
      expect(screen.getByPlaceholderText('Skill name')).toBeTruthy()

      // Cancel
      await act(async () => {
        fireEvent.click(screen.getByText('Cancel'))
      })
      expect(screen.queryByPlaceholderText('Skill name')).toBeNull()
      // Add skill button should be back
      expect(screen.getByText('+ Add Skill')).toBeTruthy()
    })

    it('disables Add button when name is empty', async () => {
      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      await act(async () => {
        fireEvent.click(screen.getByText('+ Add Skill'))
      })
      const addBtn = screen.getByText('Add') as HTMLButtonElement
      expect(addBtn.disabled).toBe(true)
    })
  })

  describe('Permissions disabled state', () => {
    it('does not show Add Skill button when canEdit is false', () => {
      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: false })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      expect(screen.queryByText('+ Add Skill')).toBeNull()
    })

    it('does not show remove buttons when canEdit is false', () => {
      const ability = makeAbility({
        summonSkills: [
          { id: 'sk-1', abilityId: 'summon-1', name: 'Athletics', manualValue: 5 },
        ],
      })

      render(
        <SummonResourceCard
          ability={ability}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: false })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      expect(screen.queryByTitle('Remove skill')).toBeNull()
    })
  })

  describe('No attributes', () => {
    it('does not render attribute section when attributeDisplays is empty', () => {
      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: false })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={vi.fn()}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      expect(screen.queryByText('Attributes')).toBeNull()
    })
  })

  describe('Edge cases', () => {
    it('handles empty skill add form with only whitespace name', async () => {
      const handleAddSummonSkill = vi.fn()

      render(
        <SummonResourceCard
          ability={makeAbility()}
          attributeDisplays={[]}
          acResult={null}
          permissions={editPermissions({ canEditAbilities: true })}
          saveSummonAttribute={vi.fn()}
          saveSummonAcValue={vi.fn()}
          saveSummonHealth={vi.fn()}
          handleAddSummonSkill={handleAddSummonSkill}
          handleUpdateSummonSkill={vi.fn()}
          handleRemoveSummonSkill={vi.fn()}
        />
      )

      await act(async () => {
        fireEvent.click(screen.getByText('+ Add Skill'))
      })
      const nameInput = screen.getByPlaceholderText('Skill name')
      fireEvent.change(nameInput, { target: { value: '   ' } })
      const valueInput = screen.getByPlaceholderText('Value')
      fireEvent.change(valueInput, { target: { value: '5' } })
      await act(async () => {
        fireEvent.click(screen.getByText('Add'))
      })

      expect(handleAddSummonSkill).not.toHaveBeenCalled()
    })
  })
})
