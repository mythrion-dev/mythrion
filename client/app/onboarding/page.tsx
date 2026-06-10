'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function OnboardingPage() {
  const router = useRouter()
  const { user, completeOnboarding, loading } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Redirect if already onboarded
  if (!loading && user?.onboardingComplete) {
    router.replace('/dashboard')
    return null
  }

  // Redirect if not logged in (shouldn't happen because of middleware)
  if (!loading && !user) {
    router.replace('/login')
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await completeOnboarding(displayName.trim())
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-sm text-gray-400">Loading...</div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome to Mythrion
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Choose a display name for your adventure
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              required
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Your adventurer name"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || displayName.trim().length === 0}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Saving...' : 'Begin your journey'}
          </button>
        </form>
      </div>
    </main>
  )
}