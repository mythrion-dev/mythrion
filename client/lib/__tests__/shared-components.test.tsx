import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/shared/Card'
import { DataRow } from '@/components/shared/DataRow'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { NumericInput } from '@/components/shared/NumericInput'
import { PageHeader } from '@/components/shared/PageHeader'
import { Select } from '@/components/shared/Select'

// Mock next/link for EmptyState
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, className }: any) => <a href={href} className={className}>{children}</a>,
}))

// ── Card ──

describe('Card', () => {
  it('renders children correctly', () => {
    render(<Card><span>child</span></Card>)
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('has "card" class by default (variant "default")', () => {
    const { container } = render(<Card>content</Card>)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('card')
    expect(el.className).not.toContain('card-interactive')
  })

  it('has "card-interactive" class for variant="interactive"', () => {
    const { container } = render(<Card variant="interactive">content</Card>)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('card-interactive')
  })

  it('renders as button when onClick provided', () => {
    const onClick = vi.fn()
    const { container } = render(<Card onClick={onClick}>click me</Card>)
    const el = container.firstChild as HTMLElement
    expect(el.tagName).toBe('BUTTON')
    expect(el).toHaveAttribute('type', 'button')
  })

  it('renders as div when no onClick', () => {
    const { container } = render(<Card>static</Card>)
    const el = container.firstChild as HTMLElement
    expect(el.tagName).toBe('DIV')
  })
})

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader><span>header</span></CardHeader>)
    expect(screen.getByText('header')).toBeInTheDocument()
  })
})

describe('CardBody', () => {
  it('renders children', () => {
    render(<CardBody><span>body</span></CardBody>)
    expect(screen.getByText('body')).toBeInTheDocument()
  })
})

describe('CardFooter', () => {
  it('renders children', () => {
    render(<CardFooter><span>footer</span></CardFooter>)
    expect(screen.getByText('footer')).toBeInTheDocument()
  })
})

// ── DataRow ──

describe('DataRow', () => {
  it('renders label and value', () => {
    render(<DataRow label="Name" value="Alice" />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('has cursor-pointer class when onClick provided', () => {
    const { container } = render(<DataRow label="L" value="V" onClick={() => {}} />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('cursor-pointer')
  })

  it('has role="button" when onClick provided', () => {
    render(<DataRow label="L" value="V" onClick={() => {}} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('has role undefined when no onClick', () => {
    const { container } = render(<DataRow label="L" value="V" />)
    const el = container.firstChild as HTMLElement
    expect(el.getAttribute('role')).toBeNull()
  })

  it('calls onClick on Enter key press', () => {
    const onClick = vi.fn()
    render(<DataRow label="L" value="V" onClick={onClick} />)
    const row = screen.getByRole('button')
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('calls onClick on Space key press', () => {
    const onClick = vi.fn()
    render(<DataRow label="L" value="V" onClick={onClick} />)
    const row = screen.getByRole('button')
    fireEvent.keyDown(row, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

// ── EmptyState ──

describe('EmptyState', () => {
  it('renders icon, title, description', () => {
    render(<EmptyState icon="🔍" title="Not Found" description="No results match your search." />)
    expect(screen.getByText('🔍')).toBeInTheDocument()
    expect(screen.getByText('Not Found')).toBeInTheDocument()
    expect(screen.getByText('No results match your search.')).toBeInTheDocument()
  })

  it('renders action button when actionLabel provided', () => {
    render(<EmptyState icon="X" title="Empty" description="desc" actionLabel="Create" />)
    expect(screen.getByRole('button')).toHaveTextContent('Create')
  })

  it('renders Link when actionHref provided', () => {
    render(<EmptyState icon="X" title="Empty" description="desc" actionLabel="Go" actionHref="/create" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/create')
    expect(link).toHaveTextContent('Go')
  })

  it('renders button with onAction when actionHref not provided', () => {
    const onAction = vi.fn()
    render(<EmptyState icon="X" title="Empty" description="desc" actionLabel="Click" onAction={onAction} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('does not render action when actionLabel not provided', () => {
    render(<EmptyState icon="X" title="Empty" description="desc" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})

// ── LoadingSkeleton ──

describe('LoadingSkeleton', () => {
  it('renders card variant by default', () => {
    const { container } = render(<LoadingSkeleton />)
    // Card variant renders skeleton divs with "card" class
    const cardEls = container.querySelectorAll('.card')
    expect(cardEls).toHaveLength(3) // default count is 3
  })

  it('renders correct number of cards (count prop)', () => {
    const { container } = render(<LoadingSkeleton count={5} />)
    const cardEls = container.querySelectorAll('.card')
    expect(cardEls).toHaveLength(5)
  })

  it('renders list variant', () => {
    const { container } = render(<LoadingSkeleton variant="list" />)
    // List variant renders data-row divs
    const rows = container.querySelectorAll('.data-row')
    // SkeletonList creates 4 data-rows
    expect(rows).toHaveLength(4)
  })

  it('renders page variant', () => {
    const { container } = render(<LoadingSkeleton variant="page" />)
    // Page variant renders card skeletons inside, but no top-level card grid class
    const cardEls = container.querySelectorAll('.card')
    // SkeletonPage renders 2 SkeletonCards
    expect(cardEls).toHaveLength(2)
  })
})

// ── NumericInput ──

describe('NumericInput', () => {
  it('renders input with type="number"', () => {
    render(<NumericInput />)
    const input = screen.getByRole('spinbutton')
    expect(input).toHaveAttribute('type', 'number')
  })

  it('renders increment/decrement buttons', () => {
    render(<NumericInput />)
    expect(screen.getByRole('button', { name: 'Increase value' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decrease value' })).toBeInTheDocument()
  })

  it('calls onChange when value changes', () => {
    const onChange = vi.fn()
    render(<NumericInput onChange={onChange} />)
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '42' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('increment button increases value', () => {
    const onChange = vi.fn()
    render(<NumericInput value={5} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Increase value' }))
    expect(onChange).toHaveBeenCalled()
    // The onChange synthetic event should have target.value = '6'
    const eventArg = onChange.mock.calls[0][0]
    expect(eventArg.target.value).toBe('6')
  })

  it('decrement button decreases value', () => {
    const onChange = vi.fn()
    render(<NumericInput value={5} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Decrease value' }))
    expect(onChange).toHaveBeenCalled()
    const eventArg = onChange.mock.calls[0][0]
    expect(eventArg.target.value).toBe('4')
  })

  it('clamps to min', () => {
    const onChange = vi.fn()
    render(<NumericInput value={1} min={0} max={10} onChange={onChange} />)
    // Click decrement: 1 - 1 = 0, within min
    fireEvent.click(screen.getByRole('button', { name: 'Decrease value' }))
    expect(onChange.mock.calls[0][0].target.value).toBe('0')

    // Click decrement again: 0 - 1 = -1, clamped to 0
    fireEvent.click(screen.getByRole('button', { name: 'Decrease value' }))
    expect(onChange.mock.calls[1][0].target.value).toBe('0')
  })

  it('clamps to max', () => {
    const onChange = vi.fn()
    render(<NumericInput value={9} min={0} max={10} onChange={onChange} />)
    // Click increment: 9 + 1 = 10, within max
    fireEvent.click(screen.getByRole('button', { name: 'Increase value' }))
    expect(onChange.mock.calls[0][0].target.value).toBe('10')

    // Click increment again: 10 + 1 = 11, clamped to 10
    fireEvent.click(screen.getByRole('button', { name: 'Increase value' }))
    expect(onChange.mock.calls[1][0].target.value).toBe('10')
  })

  it('handles disabled state (adds opacity class to controls)', () => {
    const { container } = render(<NumericInput disabled />)
    // The controls div (containing the buttons) gets opacity-50 when disabled
    const controls = container.querySelector('.opacity-50')
    expect(controls).toBeInTheDocument()
    // The increment button should also be disabled
    expect(screen.getByRole('button', { name: 'Increase value' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decrease value' })).toBeDisabled()
  })

  it('falls back to 0 when no value prop is provided and input ref is empty', () => {
    const onChange = vi.fn()
    render(<NumericInput onChange={onChange} />)
    // No value prop set; toNumber should resolve to 0 via the || 0 fallback
    fireEvent.click(screen.getByRole('button', { name: 'Increase value' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].target.value).toBe('1')
  })

  it('does not call onChange when disabled buttons are clicked', () => {
    const onChange = vi.fn()
    render(<NumericInput disabled onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Increase value' }))
    fireEvent.click(screen.getByRole('button', { name: 'Decrease value' }))
    // React suppresses synthetic events on disabled elements
    expect(onChange).not.toHaveBeenCalled()
  })

  it('handles non-integer step values', () => {
    const onChange = vi.fn()
    render(<NumericInput value={0} step={0.1} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Increase value' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    // Number.isInteger(0.1) is false, so toFixed(10) path is used
    expect(onChange.mock.calls[0][0].target.value).toBe('0.1')
  })

  it('decrement does not go below min when value equals min', () => {
    const onChange = vi.fn()
    render(<NumericInput value={0} min={0} max={10} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Decrease value' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].target.value).toBe('0')
  })

  it('increment does not go above max when value equals max', () => {
    const onChange = vi.fn()
    render(<NumericInput value={10} min={0} max={10} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Increase value' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].target.value).toBe('10')
  })
})

// ── PageHeader ──

describe('PageHeader', () => {
  it('renders title', () => {
    render(<PageHeader title="Dashboard" />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<PageHeader title="Dashboard" subtitle="Welcome back" />)
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    render(<PageHeader title="Dashboard" icon="⚙️" />)
    expect(screen.getByText('⚙️')).toBeInTheDocument()
  })

  it('renders actions when provided', () => {
    render(<PageHeader title="Dashboard" actions={<button>Action</button>} />)
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })

  it('does not render icon div when no icon', () => {
    const { container } = render(<PageHeader title="Dashboard" />)
    // The icon div has classes "inline-flex items-center justify-center w-10 h-10 rounded-xl ..."
    // We look for the container holding the icon area - the icon div is inside a flex container
    const iconContainers = container.querySelectorAll('.w-10')
    // Without an icon, no icon container div should exist
    expect(iconContainers).toHaveLength(0)
  })
})

// ── Select ──

describe('Select', () => {
  it('closes when clicking outside', () => {
    const onChange = vi.fn()
    render(
      <Select
        options={[
          { id: 'one', label: 'One' },
          { id: 'two', label: 'Two' },
        ]}
        value={null}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
