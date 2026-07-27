import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

// --------------- api.put ---------------

describe('api.put', () => {
  it('sends PUT with JSON body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ updated: true }),
    })

    const body = { name: 'updated' }
    const result = await api.put('/resource/1', body)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.method).toBe('PUT')
    expect(opts.body).toBe(JSON.stringify(body))
    expect(result).toEqual({ updated: true })
  })
})

// --------------- api.patch ---------------

describe('api.patch', () => {
  it('sends PATCH with JSON body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ patched: true }),
    })

    const body = { field: 'value' }
    const result = await api.patch('/resource/1', body)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.method).toBe('PATCH')
    expect(opts.body).toBe(JSON.stringify(body))
    expect(result).toEqual({ patched: true })
  })
})

// --------------- api.delete ---------------

describe('api.delete', () => {
  it('sends DELETE without body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ deleted: true }),
    })

    const result = await api.delete('/resource/1')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.method).toBe('DELETE')
    expect(opts.body).toBeUndefined()
    expect(result).toEqual({ deleted: true })
  })
})

// --------------- refreshAccessToken ---------------

describe('refreshAccessToken', () => {
  it('clears tokens on fetch error (network failure)', async () => {
    setAccessToken('old-at')
    setRefreshToken('old-rt')
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))

    const result = await refreshAccessToken()

    expect(result).toBeNull()
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBeNull()
  })

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
      await api.get('/error')
    } catch (e) {
      err = e
    }

    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('Invalid input')
    expect(err.statusCode).toBe(400)
  })

  it('falls back to Request failed when response body has no message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 418,
      statusText: "I'm a Teapot",
      json: () => Promise.resolve({}),
    })

    let err: any
    try {
      await api.get('/no-message')
    } catch (e) {
      err = e
    }

    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('Request failed')
    expect(err.statusCode).toBe(418)
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

  it('auto-refreshes token on 401 and retries successfully', async () => {
    // First call returns 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    })
    // refreshAccessToken calls /auth/refresh
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ accessToken: 'new-at', refreshToken: 'new-rt' }),
    })
    // Retry succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'retried' }),
    })

    // Pre-set a refresh token so refreshAccessToken works
    setRefreshToken('existing-rt')

    const result = await api.get('/auto-refresh')

    expect(result).toEqual({ data: 'retried' })
    expect(mockFetch).toHaveBeenCalledTimes(3)
    // Verify the retry used the new token
    const retryCall = mockFetch.mock.calls[2]
    const retryHeaders = retryCall[1].headers as Record<string, string>
    expect(retryHeaders.Authorization).toBe('Bearer new-at')
  })

  it('auto-refresh retry fails throws the retry error', async () => {
    // First call returns 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    })
    // refreshAccessToken succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ accessToken: 'new-at', refreshToken: 'new-rt' }),
    })
    // Retry fails with 403
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: () => Promise.resolve({ message: 'Not authorized' }),
    })

    setRefreshToken('existing-rt')

    let err: any
    try {
      await api.get('/auto-refresh-fail')
    } catch (e) {
      err = e
    }

    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(403)
    expect(err.message).toBe('Not authorized')
  })

  it('auto-refresh fallback to original error when refresh returns null', async () => {
    // First call returns 401 — must include json() to avoid TypeError on fallback
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ message: 'Unauthorized' }),
    })

    let err: any
    try {
      await api.get('/auto-refresh-fallback')
    } catch (e) {
      err = e
    }

    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Unauthorized')
  })

  it('auto-refresh retry failure with unparseable body uses statusText', async () => {
    // First call returns 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    })
    // refreshAccessToken succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ accessToken: 'new-at', refreshToken: 'new-rt' }),
    })
    // Retry fails — json() rejects, covering .catch(() => ({ message: retryRes.statusText }))
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    })

    setRefreshToken('existing-rt')

    let err: any
    try {
      await api.get('/retry-unparseable')
    } catch (e) {
      err = e
    }

    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(400)
    expect(err.message).toBe('Bad Request')
  })

  it('auto-refresh retry failure with neither json body nor statusText falls back to Request failed', async () => {
    // First call returns 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    })
    // refreshAccessToken succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ accessToken: 'new-at', refreshToken: 'new-rt' }),
    })
    // Retry fails — json() rejects AND statusText is undefined
    // This covers: .catch returns { message: undefined } → undefined ?? 'Request failed'
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: undefined,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    })

    setRefreshToken('existing-rt')

    let err: any
    try {
      await api.get('/retry-no-body')
    } catch (e) {
      err = e
    }

    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(500)
    expect(err.message).toBe('Request failed')
  })

  it('auto-refresh retry failure with array message picks the first element', async () => {
    // First call returns 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    })
    // refreshAccessToken succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ accessToken: 'new-at', refreshToken: 'new-rt' }),
    })
    // Retry fails — json succeeds with array message
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable',
      json: () => Promise.resolve({ message: ['First error', 'Second error'] }),
    })

    setRefreshToken('existing-rt')

    let err: any
    try {
      await api.get('/retry-array-message')
    } catch (e) {
      err = e
    }

    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(422)
    expect(err.message).toBe('First error')
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

  it('setInvitationToken does nothing when window is undefined', () => {
    // Should not throw; localStorage doesn't exist
    expect(() => setInvitationToken('some-token')).not.toThrow()
  })

  it('removeInvitationToken does nothing when window is undefined', () => {
    expect(() => removeInvitationToken()).not.toThrow()
  })

  it('removeRefreshToken does nothing when window is undefined', () => {
    expect(() => removeRefreshToken()).not.toThrow()
  })

  it('setAccessToken does nothing when window is undefined', () => {
    expect(() => setAccessToken('some-token')).not.toThrow()
  })

  it('removeAccessToken does nothing when window is undefined', () => {
    expect(() => removeAccessToken()).not.toThrow()
  })

  it('setRefreshToken does nothing when window is undefined', () => {
    expect(() => setRefreshToken('some-token')).not.toThrow()
  })

  it('request skips 401 refresh when window is undefined (SSR)', async () => {
    // First call returns 401 — but window is undefined so refresh is skipped
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ message: 'Auth error' }),
    })

    let err: any
    try {
      await api.get('/ssr-401')
    } catch (e) {
      err = e
    }

    expect(err).toBeInstanceOf(Error)
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Auth error')
    // Only the original request — no retry since refresh was skipped
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
