'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
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

export function SubscriptionProvider({ children }: { children: ReactNode }) {
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

  const activeStatuses = ['AUTHORIZED', 'ACTIVE', 'GRACE']
  const hasActiveSubscription =
    (subscription !== null && activeStatuses.includes(subscription.status)) ||
    user?.isAdmin === true

  return (
    <SubscriptionContext.Provider
      value={{ subscription, loading, hasActiveSubscription, refresh }}
    >
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
