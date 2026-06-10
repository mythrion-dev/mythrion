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
        <div className="text-sm text-muted-foreground">Loading...</div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 py-6 animate-fade-in">
      {/* Header */}
      <header className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold text-gradient">Mythrion</h1>
          <p className="text-sm text-muted">
            Welcome, {user.displayName ?? user.email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/campaigns/new" className="btn-primary">
            <span className="text-lg leading-none">+</span>
            <span className="hidden sm:inline">New Campaign</span>
          </Link>
          <button onClick={logout} className="btn-ghost">
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <section className="flex-1 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Your Campaigns</h2>
          <span className="badge badge-gold">
            {campaigns.length} {campaigns.length === 1 ? 'Campaign' : 'Campaigns'}
          </span>
        </div>

        {fetching ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              <span className="text-sm">Loading campaigns...</span>
            </div>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="card text-center py-16 space-y-4">
            <div className="text-4xl">🗡️</div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">No campaigns yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Your journey begins with a single step. Create your first campaign
                and gather your party.
              </p>
            </div>
            <Link href="/dashboard/campaigns/new" className="btn-primary">
              Create your first campaign
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign, i) => (
              <CampaignCard key={campaign.id} campaign={campaign} index={i} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function CampaignCard({
  campaign,
  index,
}: {
  campaign: Campaign
  index: number
}) {
  return (
    <Link
      href={`/dashboard/campaigns/${campaign.id}`}
      className="card-interactive group flex flex-col"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Card ornament */}
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-foreground truncate flex-1">
          {campaign.name}
        </h3>
        <span className="shrink-0 badge badge-gold ml-2 text-[0.6rem]">
          Active
        </span>
      </div>

      {campaign.description ? (
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
          {campaign.description}
        </p>
      ) : (
        <p className="text-sm text-muted italic mb-4 flex-1">
          No description yet.
        </p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <span className="text-xs text-muted">
          {new Date(campaign.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
        <span className="text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
          View details →
        </span>
      </div>
    </Link>
  )
}