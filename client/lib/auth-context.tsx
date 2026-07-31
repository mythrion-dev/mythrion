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
  getInvitationToken,
  removeInvitationToken,
  refreshAccessToken,
} from './api'

interface User {
  id: string
  email: string
  displayName: string | null
  onboardingComplete: boolean
  isAdmin: boolean
}

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName?: string) => Promise<void>
  logout: () => Promise<void>
  completeOnboarding: (displayName: string) => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  /** Read the admin flag from the local JWT payload (not the API response). */
  const isAdminFromToken = useCallback((): boolean => {
    const token = getAccessToken()
    if (!token) return false
    const payload = decodeJwtPayload(token)
    return payload?.role === 'admin'
  }, [])

  const fetchProfile = useCallback(async () => {
    try {
      const profile = await api.get<Omit<User, 'isAdmin'>>('/auth/profile')
      setUser({ ...profile, isAdmin: isAdminFromToken() })
    } catch {
      removeAccessToken()
      removeRefreshToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [isAdminFromToken])

  useEffect(() => {
    const token = getAccessToken()
    if (token) {
      fetchProfile()
    } else {
      const storedRefresh = getRefreshToken()
      if (storedRefresh) {
        // We have a refresh token but no access token — refresh first,
        // then fetch the profile, avoiding an unnecessary 401 round-trip.
        refreshAccessToken().then((newToken) => {
          if (newToken) {
            fetchProfile()
          } else {
            setLoading(false)
          }
        })
      } else {
        setLoading(false)
      }
    }
  }, [fetchProfile])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ accessToken: string; refreshToken: string }>('/auth/login', {
      email,
      password,
    })
    setAccessToken(res.accessToken)
    setRefreshToken(res.refreshToken)
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
      const updated = await api.post<Omit<User, 'isAdmin'>>('/auth/onboarding', {
        displayName,
      })
      setUser({ ...updated, isAdmin: isAdminFromToken() })
    },
    [isAdminFromToken],
  )

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, completeOnboarding }}
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