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
  onAuthFailure,
  isAccessTokenExpiringSoon,
  decodeJwtPayload,
  authFetch,
  api,
} from './api'

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

/** Build a structurally-valid JWT (header.payload.signature) with the given
 *  payload. decodeJwtPayload only reads the payload segment, so the header and
 *  signature can be arbitrary. */
function fakeJwt(payload: object): string {
  const enc = (o: object) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${enc({ alg: 'none' })}.${enc(payload)}.${enc({})}`
}

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
  it('keeps tokens on network failure (transient, not a logout)', async () => {
    setAccessToken('old-at')
    setRefreshToken('old-rt')
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))

    const result = await refreshAccessToken()

    expect(result).toBeNull()
    // A network blip must not log the user out — tokens survive so the next
    // request (or the focus listener) can retry the refresh.
    expect(localStorage.getItem('accessToken')).toBe('old-at')
    expect(localStorage.getItem('refreshToken')).toBe('old-rt')
  })

  it('keeps tokens on 5xx (transient server error)', async () => {
    setRefreshToken('old-rt')
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const result = await refreshAccessToken()

    expect(result).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBe('old-rt')
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

  it('clears tokens when the server rejects the refresh token (401)', async () => {
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

  it('notifies auth-failure handlers when the refresh token is rejected', async () => {
    setRefreshToken('old-rt')
    const handler = vi.fn()
    onAuthFailure(handler)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    })

    await refreshAccessToken()

    // Definitive rejection — the whole app must learn the session is over.
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does NOT notify auth-failure handlers on transient failure', async () => {
    setRefreshToken('old-rt')
    const handler = vi.fn()
    onAuthFailure(handler)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    await refreshAccessToken()

    // A server hiccup is not a logout — no notification, no session wipe.
    expect(handler).not.toHaveBeenCalled()
  })

  it('notifies auth-failure handlers when no refresh token exists', async () => {
    const handler = vi.fn()
    onAuthFailure(handler)

    await refreshAccessToken()

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('returns null when no refresh token exists', async () => {
    const result = await refreshAccessToken()
    expect(result).toBeNull()
  })

  it('reuses a fresh stored JWT without fetching (cross-tab rotation)', async () => {
    // Regression: when another tab already rotated the tokens, the stored
    // access token is fresh — refreshAccessToken must return it instead of
    // racing the now-revoked refresh token (which the server would answer 401,
    // killing the session).
    const fresh = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 })
    setAccessToken(fresh)
    setRefreshToken('old-rt')

    const result = await refreshAccessToken()

    expect(result).toBe(fresh)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not short-circuit on a non-JWT stored token (still refreshes)', async () => {
    // The cross-tab short-circuit must only fire for valid, fresh JWTs. A
    // plain-string token falls through to a real refresh attempt so a corrupt
    // access token can self-heal (or surface a genuine 401) instead of being
    // silently reused forever.
    setAccessToken('old-at')
    setRefreshToken('old-rt')
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))

    const result = await refreshAccessToken()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result).toBeNull()
    expect(localStorage.getItem('accessToken')).toBe('old-at')
    expect(localStorage.getItem('refreshToken')).toBe('old-rt')
  })

  it('does not clear the session when a 401 answers a refresh token another tab already replaced', async () => {
    // Regression: two tabs can race the same single-use refresh token. The
    // loser's 401 is NOT a logout — another tab already stored the replacement
    // tokens. Only a 401 for the token we currently hold is definitive.
    setRefreshToken('old-rt')
    const handler = vi.fn()
    onAuthFailure(handler)

    let resolveFetch!: (value: unknown) => void
    mockFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )

    const pending = refreshAccessToken()

    // While the refresh is in flight, another tab rotates the tokens.
    setAccessToken('fresh-at')
    setRefreshToken('fresh-rt')
    resolveFetch({ ok: false, status: 401 })

    const result = await pending
    expect(result).toBe('fresh-at')
    expect(handler).not.toHaveBeenCalled()
    expect(localStorage.getItem('accessToken')).toBe('fresh-at')
    expect(localStorage.getItem('refreshToken')).toBe('fresh-rt')
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

// --------------- isAccessTokenExpiringSoon ---------------

describe('isAccessTokenExpiringSoon', () => {
  it('returns false for a non-JWT token', () => {
    expect(isAccessTokenExpiringSoon('not-a-jwt')).toBe(false)
  })

  it('returns true when the token expires within the leeway window', () => {
    const expSoon = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 30 })
    expect(isAccessTokenExpiringSoon(expSoon)).toBe(true)
  })

  it('returns false when the token expires far in the future', () => {
    const expFar = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 })
    expect(isAccessTokenExpiringSoon(expFar)).toBe(false)
  })

  it('returns false when the payload has no exp claim', () => {
    expect(isAccessTokenExpiringSoon(fakeJwt({ sub: 'user-1' }))).toBe(false)
  })
})

// --------------- decodeJwtPayload ---------------

describe('decodeJwtPayload', () => {
  it('decodes a base64url payload containing standalone - and _ chars', () => {
    // Regression: the old decoder used .replaceAll('-/', '+').replaceAll('_/', '/'),
    // which only rewrote the 2-char sequences '-/' and '_/'. A standalone '-'
    // or '_' — ubiquitous once base64url padding is stripped — was left in
    // place, atob() threw, and decodeJwtPayload returned null, disabling
    // proactive refresh and role checks.
    const payload = {
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: 'admin',
      sub: 'user~1',
    }
    const token = fakeJwt(payload)
    // Guard the premise: this segment really does exercise the buggy chars.
    expect(token.split('.')[1]).toMatch(/[-_]/)
    expect(decodeJwtPayload(token)).toMatchObject({ role: 'admin', sub: 'user~1' })
  })

  it('returns null for a token without a payload segment', () => {
    expect(decodeJwtPayload('header')).toBeNull()
  })

  it('returns null for garbage that is not JSON', () => {
    expect(decodeJwtPayload(`a.${btoa('not json')}.c`)).toBeNull()
  })
})

// --------------- Proactive Refresh ---------------

describe('proactive refresh', () => {
  it('rotates an expiring access token before sending the request', async () => {
    const expSoon = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 30 })
    setAccessToken(expSoon)
    setRefreshToken('rt-existing')
    // Call 1 = /auth/refresh, call 2 = the actual request with the new token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ accessToken: 'new-at', refreshToken: 'new-rt' }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'proactive' }),
    })

    const result = await api.get('/proactive')

    expect(mockFetch).toHaveBeenCalledTimes(2)
    const reqCall = mockFetch.mock.calls[1]
    expect(reqCall[0]).toContain('/api/proactive')
    expect((reqCall[1].headers as Record<string, string>).Authorization).toBe(
      'Bearer new-at',
    )
    expect(result).toEqual({ data: 'proactive' })
  })

  it('does not refresh when the access token is far from expiry', async () => {
    const expFar = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 })
    setAccessToken(expFar)
    setRefreshToken('rt-existing')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'ok' }),
    })

    await api.get('/no-proactive')

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

// --------------- authFetch ---------------

describe('authFetch', () => {
  it('attaches the Authorization header', async () => {
    setAccessToken('bearer-tok')
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    await authFetch('https://cdn.example.com/avatar.png')

    const [, opts] = mockFetch.mock.calls[0]
    expect((opts.headers as Headers).get('Authorization')).toBe('Bearer bearer-tok')
  })

  it('retries once on 401 with the refreshed token', async () => {
    setAccessToken('old-at')
    setRefreshToken('rt-existing')
    // Call 1 = original request 401, call 2 = /auth/refresh, call 3 = retry
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ accessToken: 'new-at', refreshToken: 'new-rt' }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    const res = await authFetch('https://cdn.example.com/avatar.png')

    expect(mockFetch).toHaveBeenCalledTimes(3)
    const retryCall = mockFetch.mock.calls[2]
    expect((retryCall[1].headers as Headers).get('Authorization')).toBe('Bearer new-at')
    expect(res.ok).toBe(true)
  })

  it('returns the 401 response when the refresh fails', async () => {
    setAccessToken('old-at')
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    })

    const res = await authFetch('https://cdn.example.com/file')

    expect(res.status).toBe(401)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
