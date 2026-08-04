import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../I18nProvider'

const { mockApplyLanguage, mockDetectLanguage } = vi.hoisted(() => ({
  mockApplyLanguage: vi.fn(async (_language: string) => {}),
  mockDetectLanguage: vi.fn(() => 'en'),
}))

vi.mock('@/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/i18n')>()
  return {
    ...actual,
    applyLanguage: mockApplyLanguage,
    detectLanguage: mockDetectLanguage,
  }
})

// Mutable user so tests can drive the DB-authoritative effect across re-renders.
let currentUser: { id: string; language?: string } | null = null
const mockUseAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

function setUser(user: { id: string; language?: string } | null) {
  currentUser = user
  mockUseAuth.mockReturnValue({ user: currentUser })
}

function renderProvider() {
  return render(
    <I18nProvider>
      <div>provider-child</div>
    </I18nProvider>,
  )
}

describe('I18nProvider', () => {
  beforeEach(() => {
    mockApplyLanguage.mockClear()
    mockDetectLanguage.mockClear()
    mockDetectLanguage.mockReturnValue('en')
    setUser(null)
  })

  it('renders its children', () => {
    renderProvider()
    expect(screen.getByText('provider-child')).toBeInTheDocument()
  })

  it('applies the detected language once after mount', async () => {
    mockDetectLanguage.mockReturnValue('pt-BR')
    renderProvider()

    await waitFor(() => {
      expect(mockDetectLanguage).toHaveBeenCalledTimes(1)
      expect(mockApplyLanguage).toHaveBeenCalledWith('pt-BR')
    })
  })

  it('does not re-run initial detection on re-render', () => {
    const { rerender } = renderProvider()
    rerender(
      <I18nProvider>
        <div>provider-child</div>
      </I18nProvider>,
    )
    expect(mockDetectLanguage).toHaveBeenCalledTimes(1)
  })

  it('applies the authenticated user language (DB authoritative)', async () => {
    setUser({ id: 'u1', language: 'pt-BR' })
    renderProvider()

    await waitFor(() => {
      expect(mockApplyLanguage).toHaveBeenCalledWith('pt-BR')
    })
  })

  it('normalizes the user language before applying', async () => {
    setUser({ id: 'u1', language: 'fr' })
    renderProvider()

    await waitFor(() => {
      expect(mockApplyLanguage).toHaveBeenCalledWith('en')
    })
  })

  it('only applies the detected language when the user has none', async () => {
    setUser({ id: 'u1' })
    renderProvider()

    await waitFor(() => {
      expect(mockDetectLanguage).toHaveBeenCalledTimes(1)
    })
    expect(mockApplyLanguage).toHaveBeenCalledTimes(1)
    expect(mockApplyLanguage).toHaveBeenCalledWith('en')
  })

  it('re-applies when the user language changes', async () => {
    setUser({ id: 'u1', language: 'pt-BR' })
    const { rerender } = renderProvider()

    await waitFor(() => {
      expect(mockApplyLanguage).toHaveBeenCalledWith('pt-BR')
    })

    setUser({ id: 'u1', language: 'en' })
    rerender(
      <I18nProvider>
        <div>provider-child</div>
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(mockApplyLanguage).toHaveBeenCalledWith('en')
    })
  })
})
