'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { useAuth } from './auth-context'
import { fetchMySubscription, type MySubscription } from './subscription-api'

interface SubscriptionState {
  subscription: MySubscription | null
  loading: boolean
  hasActiveSubscription: boolean
  refresh: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionState | undefined>(undefined)

export function SubscriptionProvider({ children }: { readonly children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [subscription, setSubscription] = useState<MySubscription | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setSubscription(null)
      setLoading(false)
      return
    }

    try {
      const sub = await fetchMySubscription()
      setSubscription(sub)
    } catch {
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    refresh()
  }, [authLoading, refresh])

  // hasActiveSubscription is computed server-side by getMySubscription, so the
  // client trusts that single boolean instead of re-deriving it from a status
  // list. Admin/early-access override regardless of subscription state.
  const hasActiveSubscription =
    subscription?.hasActiveSubscription === true ||
    user?.isAdmin === true ||
    user?.isEarlyAccess === true

  const value = useMemo(
    () => ({ subscription, loading, hasActiveSubscription, refresh }),
    [subscription, loading, hasActiveSubscription, refresh],
  )

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) {
    throw new Error('useSubscription must be used within a SubscriptionProvider')
  }
  return ctx
}
