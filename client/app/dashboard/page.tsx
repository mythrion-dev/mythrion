'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function DashboardPage() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (!loading && user && !user.onboardingComplete) {
      router.replace('/onboarding')
    }
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-sm text-gray-400">Loading...</div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col p-4">
      <header className="flex items-center justify-between pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-semibold">Mythrion RPG</h1>
          <p className="text-sm text-gray-400">
            Welcome, {user.displayName ?? user.email}
          </p>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
        >
          Sign out
        </button>
      </header>

      <section className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Your Dashboard</h2>
          <p className="text-gray-400 max-w-md">
            Your adventure awaits. This is your protected dashboard where you can
            manage your characters, campaigns, and more.
          </p>
        </div>
      </section>
    </main>
  )
}