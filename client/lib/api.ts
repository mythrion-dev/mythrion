export function normalizeApiUrl(raw: string | undefined): string {
  if (!raw) return 'https://mythrion-dev.up.railway.app/api'
  let url = raw.trim()
  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`
  }
  // Add /api suffix if missing
  if (!url.endsWith('/api')) {
    url = url.replace(/\/+$/, '') + '/api'
  }
  return url
}

import i18n, { DEFAULT_LANGUAGE } from '@/i18n'

export const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

/**
 * Auth-failure notification. Fired ONLY when the session is definitively over
 * (the refresh token was rejected by the server — revoked/expired/invalid) —
 * never on transient failures. AuthProvider subscribes so the whole app can
 * clear the user immediately instead of limping along with a dead session.
 */
type AuthFailureHandler = () => void
const authFailureHandlers = new Set<AuthFailureHandler>()

export function onAuthFailure(handler: AuthFailureHandler): () => void {
  authFailureHandlers.add(handler)
  return () => {
    authFailureHandlers.delete(handler)
  }
}

function notifyAuthFailure() {
  authFailureHandlers.forEach((h) => h())
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let token = typeof window !== 'undefined' ? getAccessToken() : null

  // Proactive refresh: if the access token is within the leeway window of
  // expiry, rotate before sending so the request never rides on an expiring
  // token (avoids a 401 round-trip and its retry). Failure here is non-fatal —
  // the request proceeds with the current token and the 401 path below can
  // still recover it.
  if (token && typeof window !== 'undefined' && isAccessTokenExpiringSoon(token)) {
    const fresh = await refreshAccessToken()
    if (fresh) token = fresh
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Language':
      typeof window !== 'undefined' ? i18n.language : DEFAULT_LANGUAGE,
    ...(options.headers as Record<string, string> | undefined),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  // If 401, try to refresh the token
  if (res.status === 401 && typeof window !== 'undefined') {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`
      const retryRes = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
      })
      if (retryRes.ok) {
        return retryRes.json()
      }
      if (!retryRes.ok) {
        const body = await retryRes.json().catch(() => ({
          message: retryRes.statusText,
        }))
        const err = new Error(
          Array.isArray(body.message)
            ? body.message[0]
            : body.message ?? 'Request failed',
        ) as Error & { statusCode: number }
        err.statusCode = retryRes.status
        throw err
      }
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({
      message: res.statusText,
    }))
    const err = new Error(
      Array.isArray(body.message)
        ? body.message[0]
        : body.message ?? 'Request failed',
    ) as Error & { statusCode: number }
    err.statusCode = res.status
    throw err
  }

  return res.json()
}

/** Guard: only one refresh-in-flight at a time.
 *  Multiple concurrent 401 responses all await the same
 *  single refresh, avoiding race conditions where parallel
 *  requests revoke each other's newly-issued tokens. */
let refreshPromise: Promise<string | null> | null = null

export async function refreshAccessToken(): Promise<string | null> {
  // If a refresh is already in-flight, wait for it instead of firing a second one
  if (refreshPromise) {
    return refreshPromise
  }
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    // No refresh token means there is nothing to refresh — the session is
    // definitively over.
    removeAccessToken()
    removeRefreshToken()
    notifyAuthFailure()
    return null
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (res.status === 401 || res.status === 403) {
        // The server definitively rejected the refresh token (revoked,
        // expired, or invalid). The session is over — clear it.
        removeAccessToken()
        removeRefreshToken()
        notifyAuthFailure()
        return null
      }

      if (!res.ok) {
        // Transient failure (5xx, gateway, etc.). Keep the tokens so a later
        // attempt can succeed — a server hiccup is not a logout.
        return null
      }

      const data = await res.json()
      setAccessToken(data.accessToken)
      setRefreshToken(data.refreshToken)
      return data.accessToken
    } catch {
      // Network error — transient. Keep the tokens and let the next request
      // (or the focus listener) retry the refresh.
      return null
    }
  })()

  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

/** Leeway before expiry (ms) at which we proactively rotate the access token. */
const PROACTIVE_REFRESH_LEEWAY_MS = 60_000

/** True when the access token will expire within the proactive-refresh leeway.
 *  Non-JWT or unparseable tokens are treated as not expiring-soon so callers
 *  never block on a bogus token. */
export function isAccessTokenExpiringSoon(token: string): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') return false
  return payload.exp * 1000 - Date.now() < PROACTIVE_REFRESH_LEEWAY_MS
}

/** Decode the payload of a JWT without verifying the signature.
 *  Security note: the decoded payload is not verified — it is extracted
 *  from the JWT only for presentation (e.g. checking `role`). All
 *  authorization decisions MUST be enforced server-side by guards. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    return JSON.parse(atob(payload.replaceAll('-/', '+').replaceAll('_/', '/')))
  } catch {
    return null
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('accessToken')
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('accessToken', token)
  document.cookie = `auth_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=None; Secure`
}

export function removeAccessToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('accessToken')
  document.cookie = 'auth_token=; path=/; max-age=0'
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('refreshToken')
}

export function setRefreshToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('refreshToken', token)
}

export function removeRefreshToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('refreshToken')
}

export function getInvitationToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('pendingInviteToken')
}

export function setInvitationToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('pendingInviteToken', token)
}

export function removeInvitationToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('pendingInviteToken')
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/**
 * fetch() that participates in the same auth lifecycle as `api`: attaches the
 * current access token (refreshing proactively if near expiry) and follows a
 * 401 with one refresh + retry. Use for endpoints that need raw fetch — HEAD
 * checks, FormData/multipart uploads, etc. — instead of the JSON api helpers.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  let token = typeof window !== 'undefined' ? getAccessToken() : null
  if (token && typeof window !== 'undefined' && isAccessTokenExpiringSoon(token)) {
    const fresh = await refreshAccessToken()
    if (fresh) token = fresh
  }

  const headers = new Headers(init.headers)
  if (!headers.has('Accept-Language')) {
    headers.set(
      'Accept-Language',
      typeof window !== 'undefined' ? i18n.language : DEFAULT_LANGUAGE,
    )
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(input, { ...init, headers })

  if (res.status === 401 && typeof window !== 'undefined') {
    const newToken = await refreshAccessToken()
    if (newToken) {
      const retryHeaders = new Headers(init.headers)
      retryHeaders.set('Authorization', `Bearer ${newToken}`)
      return fetch(input, { ...init, headers: retryHeaders })
    }
  }

  return res
}