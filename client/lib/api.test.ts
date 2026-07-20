import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normalizeApiUrl,
  getAccessToken,
  setAccessToken,
  removeAccessToken,
  getRefreshToken,
  setRefreshToken,
  removeRefreshToken,
  getInvitationToken,
  setInvitationToken,
  removeInvitationToken,
  refreshAccessToken,
  api,
} from './api'

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  document.cookie = ''
})

// --------------- normalizeApiUrl ---------------

describe('normalizeApiUrl', () => {
  it('returns default URL when input is undefined', () => {
    expect(normalizeApiUrl(undefined)).toBe('https://mythrion-dev.up.railway.app/api')
  })

  it('adds protocol and /api to bare host:port', () => {
    expect(normalizeApiUrl('localhost:3000')).toBe('https://localhost:3000/api')
  })

  it('adds /api to https URL without it', () => {
    expect(normalizeApiUrl('https://api.example.com')).toBe('https://api.example.com/api')
  })

  it('preserves URL that already ends with /api', () => {
    expect(normalizeApiUrl('https://mythrion-dev.up.railway.app/api')).toBe('https://mythrion-dev.up.railway.app/api')
  })

  it('strips trailing slashes before adding /api', () => {
    expect(normalizeApiUrl('https://api.example.com/')).toBe('https://api.example.com/api')
    expect(normalizeApiUrl('https://api.example.com//')).toBe('https://api.example.com/api')
  })
})

// --------------- Access Token ---------------

describe('accessToken', () => {
  it('set then get returns the value', () => {
    setAccessToken('tok-123')
    expect(getAccessToken()).toBe('tok-123')
  })

  it('remove then get returns null', () => {
    setAccessToken('tok-123')
    removeAccessToken()
    expect(getAccessToken()).toBeNull()
  })

  it('stores to localStorage and sets document.cookie', () => {
    setAccessToken('tok-456')
    expect(localStorage.getItem('accessToken')).toBe('tok-456')
    expect(document.cookie).toContain('auth_token=tok-456')
  })
})

// --------------- Refresh Token ---------------

describe('refreshToken', () => {
  it('set then get returns the value', () => {
    setRefreshToken('rt-abc')
    expect(getRefreshToken()).toBe('rt-abc')
  })

  it('remove then get returns null', () => {
    setRefreshToken('rt-abc')
    removeRefreshToken()
    expect(getRefreshToken()).toBeNull()
  })
})

// --------------- Invitation Token ---------------

describe('invitationToken', () => {
  it('set then get returns the value', () => {
    setInvitationToken('inv-xyz')
    expect(getInvitationToken()).toBe('inv-xyz')
  })

  it('remove then get returns null', () => {
    setInvitationToken('inv-xyz')
    removeInvitationToken()
    expect(getInvitationToken()).toBeNull()
  })
})

// --------------- api.get ---------------

describe('api.get', () => {
  it('calls fetch with correct URL and headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'ok' }),
    })

    const result = await api.get('/test-endpoint')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/test-endpoint')
    expect(opts.headers).toMatchObject({
      'Content-Type': 'application/json',
    })
    expect(result).toEqual({ data: 'ok' })
  })

  it('includes Bearer token when available', async () => {
    setAccessToken('bearer-tok')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    })

    await api.get('/secure')

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers.Authorization).toBe('Bearer bearer-tok')
  })

  it('parses JSON response', async () => {
    const payload = { id: 1, name: 'test' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(payload),
    })

    const result = await api.get('/data')
    expect(result).toEqual(payload)
  })
})

// --------------- api.post ---------------

describe('api.post', () => {
  it('sends POST with JSON body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })

    const body = { email: 'a@b.com', password: 'secret' }
    const result = await api.post('/auth/login', body)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(opts.method).toBe('POST')
    expect(opts.body).toBe(JSON.stringify(body))
    expect(result).toEqual({ success: true })
  })
})

// --------------- refreshAccessToken ---------------

describe('refreshAccessToken', () => {
  it('calls /auth/refresh with current refresh token', async () => {
    setRefreshToken('rt-existing')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ accessToken: 'new-at', refreshToken: 'new-rt' }),
    })

    const result = await refreshAccessToken()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/auth/refresh')
    expect(opts.method).toBe('POST')
    expect(opts.body).toContain('rt-existing')
    expect(result).toBe('new-at')
  })

  it('stores new tokens on success', async () => {
    setRefreshToken('rt-existing')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ accessToken: 'new-at', refreshToken: 'new-rt' }),
    })

    await refreshAccessToken()

    expect(localStorage.getItem('accessToken')).toBe('new-at')
    expect(localStorage.getItem('refreshToken')).toBe('new-rt')
    expect(document.cookie).toContain('auth_token=new-at')
  })

  it('clears tokens on failure', async () => {
    setAccessToken('old-at')
    setRefreshToken('old-rt')
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    })

    const result = await refreshAccessToken()

    expect(result).toBeNull()
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBeNull()
  })

  it('returns null when no refresh token exists', async () => {
    const result = await refreshAccessToken()
    expect(result).toBeNull()
  })
})

// --------------- Request Error Handling ---------------

describe('request error handling', () => {
  it('throws Error with message from body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ message: 'Invalid input' }),
    })

    let err: any
    try {
      await api.get('/fail')
    } catch (e) {
      err = e
    }

    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('Invalid input')
    expect(err.statusCode).toBe(400)
  })

  it('handles array messages (uses first element)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable',
      json: () => Promise.resolve({ message: ['First error', 'Second error'] }),
    })

    let err: any
    try {
      await api.get('/fail-array')
    } catch (e) {
      err = e
    }

    expect(err.message).toBe('First error')
  })

  it('handles missing body gracefully (uses statusText)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('parse failed')),
    })

    let err: any
    try {
      await api.get('/server-error')
    } catch (e) {
      err = e
    }

    expect(err.message).toBe('Internal Server Error')
  })
})

// --------------- SSR Guard ---------------

describe('SSR guard', () => {
  beforeEach(() => {
    vi.stubGlobal('window', undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getAccessToken returns null when window is undefined', () => {
    expect(getAccessToken()).toBeNull()
  })

  it('getRefreshToken returns null when window is undefined', () => {
    expect(getRefreshToken()).toBeNull()
  })

  it('getInvitationToken returns null when window is undefined', () => {
    expect(getInvitationToken()).toBeNull()
  })
})
