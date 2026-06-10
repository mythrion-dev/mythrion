'use client'

import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Campaign {
  id: string
  name: string
  description: string | null
  ownerId: string
  createdAt: string
  updatedAt: string
}

export default function DashboardPage() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [fetching, setFetching] = useState(true)

  const fetchCampaigns = useCallback(async () => {
    try {
      const data = await api.get<Campaign[]>('/campaigns')
      setCampaigns(data)
    } catch {
      // token may be invalid
    } finally {
      setFetching(false)
    }
  }, [])

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

  useEffect(() => {
    if (user) {
      fetchCampaigns()
    }
  }, [user, fetchCampaigns])

  if (loading || !user) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-sm text-gray-400">Loading...</div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col p-4 max-w-4xl mx-auto w-full">
      <header className="flex items-center justify-between pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-semibold">Mythrion</h1>
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

      <section className="flex-1 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Your Campaigns</h2>
          <Link
            href="/dashboard/campaigns/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            + New Campaign
          </Link>
        </div>

        {fetching ? (
          <div className="text-sm text-gray-400">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-gray-400">
              No campaigns yet. Start your first adventure!
            </p>
            <Link
              href="/dashboard/campaigns/new"
              className="inline-block rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
            >
              Create your first campaign
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/dashboard/campaigns/${campaign.id}`}
                className="block rounded-lg border border-gray-800 bg-gray-900/50 p-5 hover:border-gray-600 transition-colors"
              >
                <h3 className="font-semibold text-lg truncate">
                  {campaign.name}
                </h3>
                {campaign.description && (
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                    {campaign.description}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-3">
                  Created{' '}
                  {new Date(campaign.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}