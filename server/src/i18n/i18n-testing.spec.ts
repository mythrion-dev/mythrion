import { createI18nServiceMock } from './i18n-testing.js'

describe('createI18nServiceMock', () => {
  it('returns a service with t, translate and getSupportedLanguages', () => {
    const service = createI18nServiceMock()
    expect(typeof service.t).toBe('function')
    expect(typeof service.translate).toBe('function')
    expect(typeof service.getSupportedLanguages).toBe('function')
    expect(service.getSupportedLanguages()).toEqual(['en', 'pt-BR'])
  })

  describe('t / translate', () => {
    it('resolves a key using the ":" separator', () => {
      const service = createI18nServiceMock()
      expect(service.t('auth:csrfOriginRejected')).toBe('Request origin not allowed.')
      expect(service.translate('auth:csrfOriginRejected')).toBe(
        'Request origin not allowed.',
      )
    })

    it('resolves a key using the "." separator', () => {
      const service = createI18nServiceMock()
      expect(service.t('auth.csrfOriginRejected')).toBe('Request origin not allowed.')
    })

    it('returns a raw template string when no args are provided', () => {
      const service = createI18nServiceMock()
      expect(service.t('auth:tooManyRequests')).toBe(
        'Too many requests. Try again in {retryAfter} seconds.',
      )
    })

    it('interpolates string args', () => {
      const service = createI18nServiceMock()
      expect(service.t('auth:tooManyRequests', { args: { retryAfter: 5 } })).toBe(
        'Too many requests. Try again in 5 seconds.',
      )
    })

    it('interpolates nested / array paths and JSON-stringifies non-strings', () => {
      const service = createI18nServiceMock()
      expect(
        service.t('validation:arrayMinSize', {
          args: { property: 'options', constraints: [2] },
        }),
      ).toBe('options must contain at least 2 elements')
    })

    it('interpolates a string leaf without JSON.stringify', () => {
      const service = createI18nServiceMock()
      expect(
        service.t('validation:isIn', {
          args: { property: 'language', allowedValues: 'en, pt-BR' },
        }),
      ).toBe('language must be one of the following values: en, pt-BR')
    })

    it('keeps the placeholder when a path resolves to undefined (missing arg)', () => {
      const service = createI18nServiceMock()
      expect(
        service.t('validation:arrayMinSize', { args: { property: 'options' } }),
      ).toBe('options must contain at least {constraints.0} elements')
    })

    it('keeps the placeholder when an intermediate path value is not an object', () => {
      const service = createI18nServiceMock()
      expect(
        service.t('validation:arrayMinSize', {
          args: { property: 'options', constraints: 'nope' },
        }),
      ).toBe('options must contain at least {constraints.0} elements')
    })

    it('keeps the placeholder when the resolved value is null', () => {
      const service = createI18nServiceMock()
      expect(
        service.t('validation:arrayMinSize', {
          args: { property: 'options', constraints: [null] },
        }),
      ).toBe('options must contain at least {constraints.0} elements')
    })

    it('returns the key itself when the catalog entry is missing', () => {
      const service = createI18nServiceMock()
      expect(service.t('auth:definitelyNotARealKey')).toBe(
        'auth:definitelyNotARealKey',
      )
      expect(service.t('noSeparatorKey')).toBe('noSeparatorKey')
    })

    it('accepts a lang option without changing the resolved English value', () => {
      const service = createI18nServiceMock()
      expect(
        service.t('auth:csrfOriginRejected', { lang: 'pt-BR' }),
      ).toBe('Request origin not allowed.')
    })
  })

  it('reads the catalogs from the real en/*.json files (idempotent across calls)', () => {
    const a = createI18nServiceMock()
    const b = createI18nServiceMock()
    expect(a.t('notebook:folderNotFound')).toBe('Folder not found')
    expect(b.t('notebook:folderNotFound')).toBe('Folder not found')
    expect(a.t('validation:isString')).toBe('{property} must be a string')
  })
})
