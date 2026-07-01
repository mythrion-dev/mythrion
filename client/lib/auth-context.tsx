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
  getInvitationToken,
  removeInvitationToken,
} from './api'

interface User {
  id: string
  email: string
  displayName: string | null
  onboardingComplete: boolean
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

  const fetchProfile = useCallback(async () => {
    try {
      const profile = await api.get<User>('/auth/profile')
      setUser(profile)
    } catch {
      removeAccessToken()
      removeRefreshToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const token = getAccessToken()
    if (token) {
      fetchProfile()
    } else {
      const refreshToken = getRefreshToken()
      if (refreshToken) {
        // Try to refresh on page load
        fetchProfile()
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
      const updated = await api.post<User>('/auth/onboarding', {
        displayName,
      })
      setUser(updated)
    },
    [],
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