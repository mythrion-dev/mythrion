import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchFilterSection } from '@/components/community/SearchFilterSection'
import type { ActiveFilter, SortOption } from '@/components/community/SearchFilterSection'

const sortOptions: SortOption[] = [
  { id: 'popular', label: 'Most Popular' },
  { id: 'newest', label: 'Newest' },
]

const activeFilters: ActiveFilter[] = [
  { id: 'online', label: 'Online' },
  { id: 'monday', label: 'Monday' },
]

function renderSection(
  overrides: Partial<React.ComponentProps<typeof SearchFilterSection>> = {},
) {
  const props: React.ComponentProps<typeof SearchFilterSection> = {
    placeholder: 'Search campaigns...',
    search: '',
    onSearchChange: vi.fn(),
    children: <input aria-label="extra-filter" />,
    activeFilters,
    onRemoveFilter: vi.fn(),
    onRemoveAll: vi.fn(),
    sortOptions,
    sortValue: 'popular',
    onSortChange: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<SearchFilterSection {...props} />) }
}

describe('SearchFilterSection', () => {
  it('renders the search input with placeholder and value', () => {
    renderSection({ search: 'dragon' })
    const input = screen.getByPlaceholderText('Search campaigns...')
    expect(input).toHaveValue('dragon')
  })

  it('calls onSearchChange when the search input changes', () => {
    const { props } = renderSection()
    const input = screen.getByPlaceholderText('Search campaigns...')
    fireEvent.change(input, { target: { value: 'goblin' } })
    expect(props.onSearchChange).toHaveBeenCalledWith('goblin')
  })

  it('hides filter children initially and reveals them after toggling', () => {
    const { props } = renderSection()
    expect(screen.queryByLabelText('extra-filter')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
    expect(screen.getByLabelText('extra-filter')).toBeInTheDocument()
    // Toggle again hides the children
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
    expect(screen.queryByLabelText('extra-filter')).not.toBeInTheDocument()
    expect(props.onSearchChange).not.toHaveBeenCalled()
  })

  it('renders sort options and calls onSortChange when changed', () => {
    const { props } = renderSection()
    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('popular')
    expect(screen.getByRole('option', { name: 'Most Popular' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Newest' })).toBeInTheDocument()
    fireEvent.change(select, { target: { value: 'newest' } })
    expect(props.onSortChange).toHaveBeenCalledWith('newest')
  })

  it('shows the active filter count badge on the Filters button', () => {
    renderSection()
    const filtersButton = screen.getByRole('button', { name: /Filters/ })
    expect(filtersButton).toHaveTextContent('2')
  })

  it('renders active filter chips and calls onRemoveFilter when a chip is clicked', () => {
    const { props } = renderSection()
    expect(screen.getByRole('button', { name: /Online/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Monday/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Online/ }))
    expect(props.onRemoveFilter).toHaveBeenCalledWith('online')
  })

  it('calls onRemoveAll when Remove All is clicked', () => {
    const { props } = renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Remove All' }))
    expect(props.onRemoveAll).toHaveBeenCalledTimes(1)
  })

  it('does not render chips or Remove All when there are no active filters', () => {
    renderSection({ activeFilters: [] })
    expect(screen.queryByRole('button', { name: /Online/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove All' })).not.toBeInTheDocument()
    // No badge either
    const filtersButton = screen.getByRole('button', { name: /Filters/ })
    expect(filtersButton).not.toHaveTextContent(/^\d+$/)
  })

  it('renders without children when children not provided', () => {
    renderSection({ children: undefined })
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
    // Nothing extra to find; just ensure no crash and sort still works
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
