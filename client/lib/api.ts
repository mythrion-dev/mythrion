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

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('accessToken')
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('accessToken', token)
  document.cookie = `auth_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`
}

export function removeAccessToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('accessToken')
  document.cookie = 'auth_token=; path=/; max-age=0'
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}