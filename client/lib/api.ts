const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://mythrion-dev.up.railway.app/api'

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = typeof window !== 'undefined' ? getAccessToken() : null

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    // No refresh token, clear auth
    removeAccessToken()
    removeRefreshToken()
    return null
  }

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!res.ok) {
      removeAccessToken()
      removeRefreshToken()
      return null
    }

    const data = await res.json()
    setAccessToken(data.accessToken)
    setRefreshToken(data.refreshToken)
    return data.accessToken
  } catch {
    removeAccessToken()
    removeRefreshToken()
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