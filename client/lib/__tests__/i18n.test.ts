import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n, {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  NAMESPACES,
  applyLanguage,
  detectLanguage,
  normalizeLanguage,
} from '@/i18n'

afterEach(async () => {
  vi.restoreAllMocks()
  await i18n.changeLanguage(DEFAULT_LANGUAGE)
})

describe('normalizeLanguage', () => {
  it('maps empty/null/undefined input to the default language', () => {
    expect(normalizeLanguage()).toBe(DEFAULT_LANGUAGE)
    expect(normalizeLanguage('')).toBe(DEFAULT_LANGUAGE)
    expect(normalizeLanguage(null)).toBe(DEFAULT_LANGUAGE)
    expect(normalizeLanguage('   ')).toBe(DEFAULT_LANGUAGE)
  })

  it('maps any pt prefix to pt-BR and any en prefix to en', () => {
    expect(normalizeLanguage('pt')).toBe('pt-BR')
    expect(normalizeLanguage('pt-BR')).toBe('pt-BR')
    expect(normalizeLanguage('pt-PT')).toBe('pt-BR')
    expect(normalizeLanguage('PT')).toBe('pt-BR')
    expect(normalizeLanguage('en')).toBe('en')
    expect(normalizeLanguage('en-US')).toBe('en')
  })

  it('falls back to the default for unsupported codes', () => {
    expect(normalizeLanguage('fr')).toBe(DEFAULT_LANGUAGE)
    expect(normalizeLanguage('de')).toBe(DEFAULT_LANGUAGE)
    expect(normalizeLanguage('ptbr')).toBe('pt-BR')
  })
})

describe('applyLanguage', () => {
  it('switches i18next, persists the preference, and updates <html lang>', async () => {
    await applyLanguage('pt-BR')
    expect(i18n.resolvedLanguage).toBe('pt-BR')
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pt-BR')
    expect(document.documentElement.lang).toBe('pt-BR')
  })

  it('does not call changeLanguage when the language is already active', async () => {
    await applyLanguage('pt-BR')
    const spy = vi.spyOn(i18n, 'changeLanguage')
    await applyLanguage('pt-BR')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('calls changeLanguage when the language differs', async () => {
    const spy = vi.spyOn(i18n, 'changeLanguage')
    await applyLanguage('pt-BR')
    expect(spy).toHaveBeenCalledWith('pt-BR')
    spy.mockRestore()
  })

  it('survives a throwing localStorage', async () => {
    // Switch first so the second call skips changeLanguage (whose language
    // detector also writes localStorage). The only write left is the direct
    // one inside applyLanguage — exactly the path the try/catch protects.
    await applyLanguage('pt-BR')
    const setItem = vi.spyOn(window.localStorage, 'setItem')
    setItem.mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    await expect(applyLanguage('pt-BR')).resolves.toBeUndefined()
    expect(document.documentElement.lang).toBe('pt-BR')
    setItem.mockRestore()
  })

  it('skips the storage write when window is unavailable', async () => {
    const original = globalThis.window
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
    })
    try {
      await expect(applyLanguage('en')).resolves.toBeUndefined()
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: original,
        configurable: true,
      })
    }
  })
})

describe('detectLanguage', () => {
  const detector = (i18n.services as { languageDetector?: { detect: () => unknown } })
    .languageDetector

  it('normalizes a detected string code', () => {
    const spy = vi.spyOn(detector!, 'detect').mockReturnValue('pt-BR')
    expect(detectLanguage()).toBe('pt-BR')
    spy.mockRestore()
  })

  it('uses the first element when the detector returns an array', () => {
    const spy = vi.spyOn(detector!, 'detect').mockReturnValue(['pt-BR', 'en'])
    expect(detectLanguage()).toBe('pt-BR')
    spy.mockRestore()
  })

  it('falls back for unsupported detected codes', () => {
    const spy = vi.spyOn(detector!, 'detect').mockReturnValue('de')
    expect(detectLanguage()).toBe(DEFAULT_LANGUAGE)
    spy.mockRestore()
  })

  it('returns the default when the detector throws', () => {
    const spy = vi.spyOn(detector!, 'detect').mockImplementation(() => {
      throw new Error('detection failed')
    })
    expect(detectLanguage()).toBe(DEFAULT_LANGUAGE)
    spy.mockRestore()
  })
})

describe('pt-BR lazy loading via resourcesToBackend', () => {
  it('loads pt-BR namespaces through the backend', async () => {
    await i18n.changeLanguage('pt-BR')
    await i18n.loadNamespaces([...NAMESPACES])
    expect(i18n.resolvedLanguage).toBe('pt-BR')
    expect(i18n.hasResourceBundle('pt-BR', 'common')).toBe(true)
    expect(i18n.hasResourceBundle('pt-BR', 'legal')).toBe(true)
  })
})
