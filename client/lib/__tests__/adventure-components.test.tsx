import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollapsibleSection } from '@/components/adventure/CollapsibleSection'
import { CollapsibleAttrCard } from '@/components/adventure/CollapsibleAttrCard'
import { CollapsibleSkillCard } from '@/components/adventure/CollapsibleSkillCard'
import { DeleteModal } from '@/components/adventure/DeleteModal'
import type { ReactNode } from 'react'

// ── CollapsibleSection ──

describe('CollapsibleSection', () => {
  it('renders title and children when expanded', () => {
    render(
      <CollapsibleSection title="Section Title" expanded={true} onToggle={() => {}}>
        <span>child content</span>
      </CollapsibleSection>,
    )
    expect(screen.getByText('Section Title')).toBeInTheDocument()
    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  it('hides children when expanded is false', () => {
    render(
      <CollapsibleSection title="Hidden" expanded={false} onToggle={() => {}}>
        <span>invisible</span>
      </CollapsibleSection>,
    )
    expect(screen.getByText('Hidden')).toBeInTheDocument()
    expect(screen.queryByText('invisible')).not.toBeInTheDocument()
  })

  it('renders custom icon when provided', () => {
    render(
      <CollapsibleSection title="With Icon" expanded={false} onToggle={() => {}} icon={<span data-testid="custom-icon" />}>
        <span>content</span>
      </CollapsibleSection>,
    )
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })

  it('does not render icon container when icon is not provided', () => {
    const { container } = render(
      <CollapsibleSection title="No Icon" expanded={false} onToggle={() => {}}>
        <span>content</span>
      </CollapsibleSection>,
    )
    // The icon is rendered inside a span with class "mr-2 shrink-0"; it should not exist
    const iconSpans = container.querySelectorAll('.mr-2')
    expect(iconSpans.length).toBe(0)
  })

  it('calls onToggle when the header button is clicked', () => {
    const onToggle = vi.fn()
    render(
      <CollapsibleSection title="Clickable" expanded={false} onToggle={onToggle}>
        <span>content</span>
      </CollapsibleSection>,
    )
    fireEvent.click(screen.getByText('Clickable'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('applies header-accent class when accent is true', () => {
    const { container } = render(
      <CollapsibleSection title="Accent" expanded={false} accent onToggle={() => {}}>
        <span>content</span>
      </CollapsibleSection>,
    )
    const button = container.querySelector('button')
    expect(button?.className).toContain('header-accent')
  })

  it('does not apply header-accent class when accent is false/undefined', () => {
    const { container } = render(
      <CollapsibleSection title="No Accent" expanded={false} onToggle={() => {}}>
        <span>content</span>
      </CollapsibleSection>,
    )
    const button = container.querySelector('button')
    expect(button?.className).not.toContain('header-accent')
  })

  it('chevron svg rotates when expanded', () => {
    const { container, rerender } = render(
      <CollapsibleSection title="Chev" expanded={false} onToggle={() => {}}>
        <span>content</span>
      </CollapsibleSection>,
    )
    let chevron = container.querySelector('svg')
    expect(chevron?.getAttribute('class')).not.toContain('rotate-180')

    rerender(
      <CollapsibleSection title="Chev" expanded={true} onToggle={() => {}}>
        <span>content</span>
      </CollapsibleSection>,
    )
    chevron = container.querySelector('svg')
    expect(chevron?.getAttribute('class')).toContain('rotate-180')
  })

  it('has card and !p-6 class on the wrapper div', () => {
    const { container } = render(
      <CollapsibleSection title="T" expanded={false} onToggle={() => {}}>
        <span>content</span>
      </CollapsibleSection>,
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('card')
    expect(wrapper.className).toContain('!p-6')
  })
})

// ── CollapsibleAttrCard ──

describe('CollapsibleAttrCard', () => {
  const defaultAttr = { key: 'str', name: 'Strength' }

  it('renders attribute name and key when expanded=false', () => {
    render(
      <CollapsibleAttrCard index={0} attr={defaultAttr} isExpanded={false} onToggle={() => {}} onUpdateAttr={() => {}} onRemove={() => {}} />,
    )
    expect(screen.getByText('Strength')).toBeInTheDocument()
    expect(screen.getByText('(str)')).toBeInTheDocument()
  })

  it('shows "New Attribute" when name is empty', () => {
    render(
      <CollapsibleAttrCard index={0} attr={{ key: '', name: '' }} isExpanded={false} onToggle={() => {}} onUpdateAttr={() => {}} onRemove={() => {}} />,
    )
    expect(screen.getByText('New Attribute')).toBeInTheDocument()
  })

  it('does not render key parentheses when key is empty', () => {
    render(
      <CollapsibleAttrCard index={0} attr={{ key: '', name: 'Attr' }} isExpanded={false} onToggle={() => {}} onUpdateAttr={() => {}} onRemove={() => {}} />,
    )
    expect(screen.getByText('Attr')).toBeInTheDocument()
    // The key span is only rendered when attr.key is truthy
    const keySpans = screen.queryByText(/^\(.*\)$/)
    expect(keySpans).not.toBeInTheDocument()
  })

  it('hides expanded content when isExpanded=false', () => {
    render(
      <CollapsibleAttrCard index={0} attr={defaultAttr} isExpanded={false} onToggle={() => {}} onUpdateAttr={() => {}} onRemove={() => {}} />,
    )
    expect(screen.queryByPlaceholderText('Key (e.g. strength)')).not.toBeInTheDocument()
    expect(screen.queryByText('Remove Attribute')).not.toBeInTheDocument()
  })

  it('shows input fields when isExpanded=true', () => {
    render(
      <CollapsibleAttrCard index={0} attr={defaultAttr} isExpanded={true} onToggle={() => {}} onUpdateAttr={() => {}} onRemove={() => {}} />,
    )
    expect(screen.getByDisplayValue('str')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Strength')).toBeInTheDocument()
    expect(screen.getByText('Remove Attribute')).toBeInTheDocument()
  })

  it('calls onToggle when header button is clicked', () => {
    const onToggle = vi.fn()
    render(
      <CollapsibleAttrCard index={0} attr={defaultAttr} isExpanded={false} onToggle={onToggle} onUpdateAttr={() => {}} onRemove={() => {}} />,
    )
    fireEvent.click(screen.getByText('Strength'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('calls onUpdateAttr when key input changes', () => {
    const onUpdateAttr = vi.fn()
    render(
      <CollapsibleAttrCard index={0} attr={defaultAttr} isExpanded={true} onToggle={() => {}} onUpdateAttr={onUpdateAttr} onRemove={() => {}} />,
    )
    const keyInput = screen.getByDisplayValue('str')
    fireEvent.change(keyInput, { target: { value: 'dex' } })
    expect(onUpdateAttr).toHaveBeenCalledWith(0, 'key', 'dex')
  })

  it('calls onUpdateAttr when name input changes', () => {
    const onUpdateAttr = vi.fn()
    render(
      <CollapsibleAttrCard index={0} attr={defaultAttr} isExpanded={true} onToggle={() => {}} onUpdateAttr={onUpdateAttr} onRemove={() => {}} />,
    )
    const nameInput = screen.getByDisplayValue('Strength')
    fireEvent.change(nameInput, { target: { value: 'Dexterity' } })
    expect(onUpdateAttr).toHaveBeenCalledWith(0, 'name', 'Dexterity')
  })

  it('calls onRemove when Remove Attribute is clicked', () => {
    const onRemove = vi.fn()
    render(
      <CollapsibleAttrCard index={0} attr={defaultAttr} isExpanded={true} onToggle={() => {}} onUpdateAttr={() => {}} onRemove={onRemove} />,
    )
    fireEvent.click(screen.getByText('Remove Attribute'))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('chevron rotates when isExpanded is true', () => {
    const { container, rerender } = render(
      <CollapsibleAttrCard index={0} attr={defaultAttr} isExpanded={false} onToggle={() => {}} onUpdateAttr={() => {}} onRemove={() => {}} />,
    )
    let chevron = container.querySelector('svg')
    expect(chevron?.getAttribute('class')).not.toContain('rotate-180')

    rerender(
      <CollapsibleAttrCard index={0} attr={defaultAttr} isExpanded={true} onToggle={() => {}} onUpdateAttr={() => {}} onRemove={() => {}} />,
    )
    chevron = container.querySelector('svg')
    expect(chevron?.getAttribute('class')).toContain('rotate-180')
  })
})

// ── CollapsibleSkillCard ──

describe('CollapsibleSkillCard', () => {
  const baseSkill = { name: 'Stealth', description: 'Move silently', attributeId: 'dex' }
  const attributes = [
    { key: 'str', name: 'Strength' },
    { key: 'dex', name: 'Dexterity' },
    { key: 'con', name: 'Constitution' },
  ]

  it('renders skill name when collapsed', () => {
    render(
      <CollapsibleSkillCard index={0} skill={baseSkill} attributes={attributes} />,
    )
    expect(screen.getByText('Stealth')).toBeInTheDocument()
  })

  it('shows "New Skill" when name is empty', () => {
    render(
      <CollapsibleSkillCard index={0} skill={{ name: '', description: '', attributeId: '' }} attributes={attributes} />,
    )
    expect(screen.getByText('New Skill')).toBeInTheDocument()
  })

  it('does not show expanded content initially', () => {
    render(
      <CollapsibleSkillCard index={0} skill={baseSkill} attributes={attributes} />,
    )
    expect(screen.queryByDisplayValue('Stealth')).not.toBeInTheDocument()
    expect(screen.queryByText('Remove Skill')).not.toBeInTheDocument()
  })

  it('expands content when header is clicked', () => {
    render(
      <CollapsibleSkillCard index={0} skill={baseSkill} attributes={attributes} />,
    )
    fireEvent.click(screen.getByText('Stealth'))
    expect(screen.getByDisplayValue('Stealth')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Move silently')).toBeInTheDocument()
    expect(screen.getByText('Remove Skill')).toBeInTheDocument()
  })

  it('collapses content when header is clicked again', () => {
    render(
      <CollapsibleSkillCard index={0} skill={baseSkill} attributes={attributes} />,
    )
    fireEvent.click(screen.getByText('Stealth'))
    expect(screen.getByDisplayValue('Stealth')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Stealth'))
    expect(screen.queryByDisplayValue('Stealth')).not.toBeInTheDocument()
  })

  it('calls onUpdateSkill when name input changes', () => {
    const onUpdateSkill = vi.fn()
    render(
      <CollapsibleSkillCard index={0} skill={baseSkill} onUpdateSkill={onUpdateSkill} attributes={attributes} />,
    )
    fireEvent.click(screen.getByText('Stealth'))
    const nameInput = screen.getByDisplayValue('Stealth')
    fireEvent.change(nameInput, { target: { value: 'Perception' } })
    expect(onUpdateSkill).toHaveBeenCalledWith(0, 'name', 'Perception')
  })

  it('calls onUpdateSkill when description input changes', () => {
    const onUpdateSkill = vi.fn()
    render(
      <CollapsibleSkillCard index={0} skill={baseSkill} onUpdateSkill={onUpdateSkill} attributes={attributes} />,
    )
    fireEvent.click(screen.getByText('Stealth'))
    const descInput = screen.getByDisplayValue('Move silently')
    fireEvent.change(descInput, { target: { value: 'Hide in shadows' } })
    expect(onUpdateSkill).toHaveBeenCalledWith(0, 'description', 'Hide in shadows')
  })

  it('renders allowed attributes checkboxes for each attribute', () => {
    render(
      <CollapsibleSkillCard index={0} skill={{ ...baseSkill, allowedAttributeIds: ['dex'] }} attributes={attributes} />,
    )
    fireEvent.click(screen.getByText('Stealth'))
    // Each attribute renders a checkbox label (the custom Select is closed, so no option text)
    expect(screen.getByRole('checkbox', { name: 'Strength' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Dexterity' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Constitution' })).toBeInTheDocument()
  })

  it('checks the checkbox for an allowed attribute', () => {
    render(
      <CollapsibleSkillCard index={0} skill={{ ...baseSkill, allowedAttributeIds: ['dex'] }} attributes={attributes} />,
    )
    fireEvent.click(screen.getByText('Stealth'))
    const dexCheckbox = screen.getByRole('checkbox', { name: 'Dexterity' })
    expect(dexCheckbox).toBeChecked()
    const strCheckbox = screen.getByRole('checkbox', { name: 'Strength' })
    expect(strCheckbox).not.toBeChecked()
  })

  it('calls onToggleAllowedAttr when a checkbox is clicked', () => {
    const onToggleAllowedAttr = vi.fn()
    render(
      <CollapsibleSkillCard index={0} skill={{ ...baseSkill, allowedAttributeIds: ['dex'] }} attributes={attributes} onToggleAllowedAttr={onToggleAllowedAttr} />,
    )
    fireEvent.click(screen.getByText('Stealth'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Dexterity' }))
    expect(onToggleAllowedAttr).toHaveBeenCalledWith(0, 'dex')
  })

  it('renders default attribute select with allowed options', () => {
    render(
      <CollapsibleSkillCard
        index={0}
        skill={{ ...baseSkill, allowedAttributeIds: ['str', 'dex', 'con'], defaultAttributeId: 'dex' }}
        attributes={attributes}
      />,
    )
    fireEvent.click(screen.getByText('Stealth'))
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    // The custom Select trigger shows the current value; open it and check the selected option
    fireEvent.click(select)
    expect(screen.getByRole('option', { name: 'Dexterity' })).toHaveAttribute('aria-selected', 'true')
  })

  it('calls onUpdateDefaultAttr when default attribute changes', () => {
    const onUpdateDefaultAttr = vi.fn()
    render(
      <CollapsibleSkillCard
        index={0}
        skill={{ ...baseSkill, allowedAttributeIds: ['str', 'dex'], defaultAttributeId: 'dex' }}
        attributes={attributes}
        onUpdateDefaultAttr={onUpdateDefaultAttr}
      />,
    )
    fireEvent.click(screen.getByText('Stealth'))
    const select = screen.getByRole('combobox')
    fireEvent.click(select) // open the custom Select
    fireEvent.click(screen.getByRole('option', { name: 'Strength' }))
    expect(onUpdateDefaultAttr).toHaveBeenCalledWith(0, 'str')
  })

  it('calls onUpdateSkill for defaultAttributeId when onUpdateDefaultAttr is not provided', () => {
    const onUpdateSkill = vi.fn()
    render(
      <CollapsibleSkillCard
        index={0}
        skill={{ ...baseSkill, allowedAttributeIds: ['str', 'dex'], defaultAttributeId: 'dex' }}
        attributes={attributes}
        onUpdateSkill={onUpdateSkill}
      />,
    )
    fireEvent.click(screen.getByText('Stealth'))
    const select = screen.getByRole('combobox')
    fireEvent.click(select) // open the custom Select
    fireEvent.click(screen.getByRole('option', { name: 'Strength' }))
    expect(onUpdateSkill).toHaveBeenCalledWith(0, 'defaultAttributeId', 'str')
  })

  it('select shows "-- Select Default --" placeholder as first option', () => {
    render(
      <CollapsibleSkillCard
        index={0}
        skill={{ ...baseSkill, allowedAttributeIds: [] }}
        attributes={attributes}
      />,
    )
    fireEvent.click(screen.getByText('Stealth'))
    // The placeholder option only exists when the custom Select dropdown is open
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('option', { name: '— Select Default —' })).toBeInTheDocument()
  })

  it('calls onRemove when Remove Skill is clicked', () => {
    const onRemove = vi.fn()
    render(
      <CollapsibleSkillCard index={0} skill={baseSkill} onRemove={onRemove} attributes={attributes} />,
    )
    fireEvent.click(screen.getByText('Stealth'))
    fireEvent.click(screen.getByText('Remove Skill'))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('does not crash when onUpdateSkill is undefined and inputs change', () => {
    render(
      <CollapsibleSkillCard index={0} skill={baseSkill} attributes={attributes} />,
    )
    fireEvent.click(screen.getByText('Stealth'))
    const nameInput = screen.getByDisplayValue('Stealth')
    expect(() => fireEvent.change(nameInput, { target: { value: 'New' } })).not.toThrow()
  })

  it('does not crash when onRemove is undefined and Remove Skill is clicked', () => {
    render(
      <CollapsibleSkillCard index={0} skill={baseSkill} attributes={attributes} />,
    )
    fireEvent.click(screen.getByText('Stealth'))
    expect(() => fireEvent.click(screen.getByText('Remove Skill'))).not.toThrow()
  })

  it('chevron rotates when expanded', () => {
    const { container } = render(
      <CollapsibleSkillCard index={0} skill={baseSkill} attributes={attributes} />,
    )
    let chevron = container.querySelector('svg')
    expect(chevron?.getAttribute('class')).not.toContain('rotate-180')

    fireEvent.click(screen.getByText('Stealth'))
    chevron = container.querySelector('svg')
    expect(chevron?.getAttribute('class')).toContain('rotate-180')
  })
})

// ── EmptyState ──
// EmptyState is tested in lib/__tests__/shared-components.test.tsx

// ── DeleteModal ──

describe('DeleteModal', () => {
  it('renders the adventure name in confirmation text', () => {
    render(
      <DeleteModal name="My Adventure" error={null} loading={false} onCancel={() => {}} onConfirm={() => {}} />,
    )
    expect(screen.getByText(/My Adventure/)).toBeInTheDocument()
  })

  it('shows "Delete Adventure" heading', () => {
    render(
      <DeleteModal name="Test" error={null} loading={false} onCancel={() => {}} onConfirm={() => {}} />,
    )
    expect(screen.getByText('Delete Adventure')).toBeInTheDocument()
  })

  it('shows warning text about irreversible action', () => {
    render(
      <DeleteModal name="Test" error={null} loading={false} onCancel={() => {}} onConfirm={() => {}} />,
    )
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
  })

  it('renders Cancel and Delete forever buttons', () => {
    render(
      <DeleteModal name="Test" error={null} loading={false} onCancel={() => {}} onConfirm={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete forever' })).toBeInTheDocument()
  })

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(
      <DeleteModal name="Test" error={null} loading={false} onCancel={onCancel} onConfirm={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm when Delete forever button is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <DeleteModal name="Test" error={null} loading={false} onCancel={() => {}} onConfirm={onConfirm} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('displays error message when error prop is provided', () => {
    render(
      <DeleteModal name="Test" error="Something went wrong" loading={false} onCancel={() => {}} onConfirm={() => {}} />,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('does not display error message when error is null', () => {
    render(
      <DeleteModal name="Test" error={null} loading={false} onCancel={() => {}} onConfirm={() => {}} />,
    )
    // The warning icon div has bg-danger-muted, but the error text container should not exist
    // Query for the error text container which has border-danger/30 class
    expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument()
  })

  it('shows "Deleting..." text when loading is true', () => {
    render(
      <DeleteModal name="Test" error={null} loading={true} onCancel={() => {}} onConfirm={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete forever' })).not.toBeInTheDocument()
  })

  it('disables both buttons when loading is true', () => {
    render(
      <DeleteModal name="Test" error={null} loading={true} onCancel={() => {}} onConfirm={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('both buttons are enabled when loading is false', () => {
    render(
      <DeleteModal name="Test" error={null} loading={false} onCancel={() => {}} onConfirm={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete forever' })).not.toBeDisabled()
  })

  it('renders warning icon svg', () => {
    const { container } = render(
      <DeleteModal name="Test" error={null} loading={false} onCancel={() => {}} onConfirm={() => {}} />,
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders the fixed overlay with z-50 class', () => {
    const { container } = render(
      <DeleteModal name="Test" error={null} loading={false} onCancel={() => {}} onConfirm={() => {}} />,
    )
    const overlay = container.querySelector('.fixed.inset-0')
    expect(overlay).toBeInTheDocument()
    expect(overlay?.className).toContain('z-50')
  })

  it('renders the dark backdrop overlay', () => {
    const { container } = render(
      <DeleteModal name="Test" error={null} loading={false} onCancel={() => {}} onConfirm={() => {}} />,
    )
    const backdrop = container.querySelector('.bg-black\\/50')
    expect(backdrop).toBeInTheDocument()
  })

  it('renders error with danger styling classes when error is provided', () => {
    const { container } = render(
      <DeleteModal name="Test" error="Failed to delete" loading={false} onCancel={() => {}} onConfirm={() => {}} />,
    )
    // The error div has rounded-lg in addition to bg-danger-muted (icon div does not)
    const errorDiv = container.querySelector('.rounded-lg.bg-danger-muted')
    expect(errorDiv).toBeInTheDocument()
    expect(errorDiv?.className).toContain('border-danger/30')
    expect(errorDiv?.textContent).toContain('Failed to delete')
  })
})
