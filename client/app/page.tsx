'use client'

import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard')
    }
  }, [loading, user, router])

  if (loading || user) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-sm text-gray-400">Loading...</div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-4xl font-bold tracking-tight">Mythrion</h1>
        <p className="text-gray-400 leading-relaxed">
          Forge your legend. Build worlds, create characters, and embark on epic
          campaigns with your friends.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
        >
          Begin your adventure
        </Link>
      </div>
    </main>
  )
}