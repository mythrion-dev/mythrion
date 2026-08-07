'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import {
  api,
  getAccessToken,
  setAccessToken,
  removeAccessToken,
  getRefreshToken,
  setRefreshToken,
  removeRefreshToken,
  decodeJwtPayload,
  removeInvitationToken,
  refreshAccessToken,
  isAccessTokenExpiringSoon,
  onAuthFailure,
} from './api'

interface User {
  id: string
  email: string
  displayName: string | null
  onboardingComplete: boolean
  isAdmin: boolean
  language: string
  isEarlyAccess: boolean
  twoFactorEnabled: boolean
  emailVerified: boolean
  hasPassword: boolean
}

/** Result of a password login: either the session is established, or the
 *  server demands a 2FA code first (no tokens are issued until it is verified). */
export type LoginOutcome =
  | { requiresTwoFactor: true; twoFactorId: string; emailMasked: string }
  | { requiresTwoFactor: false }

type LoginResponse =
  | { requiresTwoFactor: true; twoFactorId: string; emailMasked: string }
  | { requiresTwoFactor: false; accessToken: string; refreshToken: string }

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<LoginOutcome>
  register: (email: string, password: string, displayName?: string) => Promise<void>
  logout: () => Promise<void>
  completeOnboarding: (displayName: string) => Promise<void>
  verifyTwoFactor: (twoFactorId: string, code: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  /** Read the admin flag from the local JWT payload (not the API response). */
  const isAdminFromToken = useCallback((): boolean => {
    const token = getAccessToken()
    if (!token) return false
    const payload = decodeJwtPayload(token)
    return payload?.role === 'admin'
  }, [])

  /** Read the early-access flag from the local JWT payload (not the API response). */
  const isEarlyAccessFromToken = useCallback((): boolean => {
    const token = getAccessToken()
    if (!token) return false
    const payload = decodeJwtPayload(token)
    return payload?.role === 'early_access'
  }, [])

  const fetchProfile = useCallback(async () => {
    try {
      const profile = await api.get<Omit<User, 'isAdmin' | 'isEarlyAccess'>>('/auth/profile')
      setUser({
        ...profile,
        isAdmin: isAdminFromToken(),
        isEarlyAccess: isEarlyAccessFromToken(),
      })
      setLoading(false)
    } catch {
      // Transient failure (network blip / server 5xx) — this is NOT a logout,
      // so do not clear the tokens. Keep loading true: guards render the
      // loading state instead of redirecting to /login, and the
      // focus/visibility listener below retries. Definitive rejection (refresh
      // token refused by the server) is handled by onAuthFailure, which resets
      // the session from a single place.
      return
    }
  }, [isAdminFromToken, isEarlyAccessFromToken])

  /**
   * Restore a session on mount (or on return to the tab). Order of preference:
   * access token present → fetch profile; else refresh token present → rotate
   * it, then fetch profile; else no session at all.
   */
  const restoreSession = useCallback(async () => {
    if (getAccessToken()) {
      await fetchProfile()
      return
    }
    if (getRefreshToken()) {
      // Refresh token but no access token — rotate first to avoid an
      // unnecessary 401 round-trip on the profile fetch.
      const newToken = await refreshAccessToken()
      if (newToken) {
        await fetchProfile()
        return
      }
      if (!getRefreshToken()) {
        // The refresh token was definitively rejected and cleared; onAuthFailure
        // already reset the session.
        return
      }
      // Transient refresh failure — tokens remain, so keep loading true and let
      // the focus/visibility listener retry. Do not redirect to /login.
      return
    }
    setLoading(false)
  }, [fetchProfile])

  useEffect(() => {
    void restoreSession()
  }, [restoreSession])

  // Single place that reacts to a definitive session loss (the refresh token
  // was rejected server-side — revoked, expired, or invalid). Clears all auth
  // state and stops the loading spinner so guards redirect to /login.
  useEffect(() => {
    return onAuthFailure(() => {
      removeAccessToken()
      removeRefreshToken()
      removeInvitationToken()
      setUser(null)
      setLoading(false)
    })
  }, [])

  // Recover from transient failures and keep long sessions alive: when the tab
  // regains focus, rotate an access token that is close to expiring so the next
  // interaction never 401s; if a previous restore was interrupted (stuck in
  // loading with tokens still present), try again.
  useEffect(() => {
    const onActive = () => {
      if (document.visibilityState !== 'visible') return
      const token = getAccessToken()
      if (token && isAccessTokenExpiringSoon(token)) {
        void refreshAccessToken()
      } else if (!token && getRefreshToken()) {
        void restoreSession()
      }
    }
    window.addEventListener('focus', onActive)
    document.addEventListener('visibilitychange', onActive)
    return () => {
      window.removeEventListener('focus', onActive)
      document.removeEventListener('visibilitychange', onActive)
    }
  }, [restoreSession])

  const login = useCallback(
    async (email: string, password: string): Promise<LoginOutcome> => {
      const res = await api.post<LoginResponse>('/auth/login', {
        email,
        password,
      })
      if (res.requiresTwoFactor) {
        // No tokens were issued — the caller must complete the code step first.
        return res
      }
      setAccessToken(res.accessToken)
      setRefreshToken(res.refreshToken)
      await fetchProfile()
      return { requiresTwoFactor: false }
    },
    [fetchProfile],
  )

  /** Complete a 2FA challenge, store the tokens it unlocks, and load the profile. */
  const verifyTwoFactor = useCallback(
    async (twoFactorId: string, code: string) => {
      const res = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/verify-2fa',
        { twoFactorId, code },
      )
      setAccessToken(res.accessToken)
      setRefreshToken(res.refreshToken)
      await fetchProfile()
    },
    [fetchProfile],
  )

  /** Re-fetch the profile (e.g. to pick up a fresh twoFactorEnabled flag). */
  const refreshProfile = useCallback(async () => {
    await fetchProfile()
  }, [fetchProfile])

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const res = await api.post<{ accessToken: string; refreshToken: string }>('/auth/register', {
        email,
        password,
        displayName,
      })
      setAccessToken(res.accessToken)
      setRefreshToken(res.refreshToken)
      await fetchProfile()
    },
    [fetchProfile],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Ignore errors on logout
    }
    removeAccessToken()
    removeRefreshToken()
    removeInvitationToken()
    setUser(null)
  }, [])

  const completeOnboarding = useCallback(
    async (displayName: string) => {
      // The server returns only { id, email, displayName, onboardingComplete },
      // so merging it would silently drop emailVerified/twoFactorEnabled/language.
      // Re-fetch the full profile instead.
      await api.post('/auth/onboarding', { displayName })
      await fetchProfile()
    },
    [fetchProfile],
  )

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, completeOnboarding, verifyTwoFactor, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}