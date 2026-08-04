import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n, { LANGUAGE_STORAGE_KEY } from '@/i18n'
import { LanguageSwitcher } from '../LanguageSwitcher'

const { mockPatch } = vi.hoisted(() => ({
  mockPatch: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: mockPatch,
    delete: vi.fn(),
  },
}))

let currentUser: { id: string; language?: string } | null = null
const mockUseAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

function setUser(user: { id: string; language?: string } | null) {
  currentUser = user
  mockUseAuth.mockReturnValue({ user: currentUser })
}

function openDropdown() {
  fireEvent.click(screen.getByRole('button', { name: 'Language' }))
}

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    window.localStorage.clear()
    mockPatch.mockClear()
    setUser(null)
  })

  afterEach(async () => {
    await i18n.changeLanguage('en')
    window.localStorage.clear()
  })

  it('shows the current language label in the trigger', () => {
    render(<LanguageSwitcher />)
    expect(screen.getByRole('button', { name: 'Language' })).toHaveTextContent('English')
  })

  it('opens a dropdown with both language options', () => {
    render(<LanguageSwitcher />)
    openDropdown()

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('English')
    expect(options[1]).toHaveTextContent('Português')
  })

  it('marks the current language as selected', () => {
    render(<LanguageSwitcher />)
    openDropdown()

    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveAttribute('aria-selected', 'false')
  })

  it('applies the language and closes the dropdown', async () => {
    render(<LanguageSwitcher />)
    openDropdown()

    fireEvent.click(screen.getByText('Português'))

    await waitFor(() => {
      expect(i18n.resolvedLanguage).toBe('pt-BR')
    })
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pt-BR')
    expect(document.documentElement.lang).toBe('pt-BR')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('persists the choice to the backend for authenticated users', async () => {
    setUser({ id: 'u1', language: 'en' })
    render(<LanguageSwitcher />)
    openDropdown()

    fireEvent.click(screen.getByText('Português'))

    await waitFor(() => {
      expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pt-BR')
    })
    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/auth/language', { language: 'pt-BR' })
    })
  })

  it('does not hit the backend for guests', async () => {
    render(<LanguageSwitcher />)
    openDropdown()

    fireEvent.click(screen.getByText('Português'))

    await waitFor(() => {
      expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pt-BR')
    })
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('closes on outside click', async () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <LanguageSwitcher />
      </div>,
    )
    openDropdown()
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByTestId('outside'))
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  it('closes on Escape', async () => {
    render(<LanguageSwitcher />)
    openDropdown()
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  it('renders icon-only trigger in compact mode', () => {
    render(<LanguageSwitcher compact />)
    const trigger = screen.getByRole('button', { name: 'Language' })
    expect(trigger).not.toHaveTextContent('English')
    expect(trigger).toHaveTextContent('🇺🇸')
  })

  it('compact mode still opens the dropdown with both options', () => {
    render(<LanguageSwitcher compact />)
    openDropdown()

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('English')
    expect(options[1]).toHaveTextContent('Português')
  })

  it('toggles the dropdown on repeated trigger clicks', () => {
    render(<LanguageSwitcher />)
    const trigger = screen.getByRole('button', { name: 'Language' })

    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.click(trigger)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
