'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import { Sidebar, GracePeriodBanner } from '@/components/dashboard'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (!user.onboardingComplete) {
      router.replace('/onboarding')
      return
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-background">
        <div className="space-y-4 w-full max-w-md px-4">
          <div className="skeleton h-6 w-48 mx-auto" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-3/4 mx-auto" />
          <div className="skeleton h-32 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!user || !user.onboardingComplete) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-background">
        <div className="animate-fade-in text-sm text-muted-foreground">
          Checking access...
        </div>
      </div>
    )
  }

  return <>{children}</>
}

/** Redirect non-subscribed (non-admin) users to /pricing. */
function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { subscription, loading, hasActiveSubscription } = useSubscription()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    // Admins bypass subscription check
    if (user?.isAdmin) return
    if (!hasActiveSubscription) {
      router.replace('/pricing')
    }
  }, [loading, user, hasActiveSubscription, router])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-background">
        <div className="space-y-4 w-full max-w-md px-4">
          <div className="skeleton h-6 w-48 mx-auto" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-3/4 mx-auto" />
          <div className="skeleton h-32 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  // Admin or subscribed — render children
  if (user?.isAdmin || hasActiveSubscription) {
    return <>{children}</>
  }

  // Non-subscribed non-admin — show minimal state while redirect fires
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-background">
      <div className="animate-fade-in text-sm text-muted-foreground">
        Checking subscription...
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <SubscriptionGuard>
        <div className="flex min-h-screen bg-background">
          {/* Sidebar */}
          <Sidebar />

          {/* Main content area */}
          <main className="flex-1 min-h-screen bg-pattern overflow-auto">
            <GracePeriodBanner />
            <div className="px-8 py-6 w-full animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </SubscriptionGuard>
    </AuthGuard>
  )
}
