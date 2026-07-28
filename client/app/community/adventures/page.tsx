'use client'

import { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { CampaignCard } from '@/components/community/CampaignCard'

interface Adventure {
  id: string
  name: string
  campaign: string
  synopsis: string | null
  maxPlayers: number
  ownerId: string
  createdAt: string
  updatedAt: string
  gmDisplayName?: string
  playerCount?: number
}

interface AdventuresResponse {
  data: Adventure[]
  total: number
  page: number
  totalPages: number
}

function CommunityAdventuresContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [campaign, setCampaign] = useState(searchParams.get('campaign') ?? '')
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [adventures, setAdventures] = useState<Adventure[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const activeTab = pathname.startsWith('/community/templates') ? 'templates' : 'adventures'

  // Sync search params back to URL
  const syncUrl = useCallback(
    (s: string, c: string, p: number) => {
      const params = new URLSearchParams()
      if (s) params.set('search', s)
      if (c) params.set('campaign', c)
      if (p > 1) params.set('page', String(p))
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname],
  )

  // Debounced search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState(search)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  // Fetch adventures
  const fetchAdventures = useCallback(async () => {
    setFetching(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (campaign) params.set('campaign', campaign)
      params.set('page', String(page))
      params.set('limit', '12')
      const res = await api.get<AdventuresResponse>(
        `/public/adventures?${params.toString()}`,
      )
      setAdventures(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load adventures')
    } finally {
      setFetching(false)
    }
  }, [debouncedSearch, campaign, page])

  useEffect(() => {
    fetchAdventures()
  }, [fetchAdventures])

  // Sync URL when debouncedSearch, campaign, or page changes
  useEffect(() => {
    syncUrl(debouncedSearch, campaign, page)
  }, [debouncedSearch, campaign, page, syncUrl])

  const handleCampaignChange = (value: string) => {
    setCampaign(value)
    setPage(1)
  }

  return (
    <>
      <PageHeader
        icon="🌍"
        title="Explore Campaigns"
        subtitle="Discover public campaigns from the Mythrion community"
      />

      {/* Tab Navigation */}
      <nav className="flex gap-1 mb-6">
        <Link
          href="/community/adventures"
          className={`tab-pill ${activeTab === 'adventures' ? 'tab-pill-active' : ''}`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          Campaigns
        </Link>
        <Link
          href="/community/templates"
          className={`tab-pill ${activeTab === 'templates' ? 'tab-pill-active' : ''}`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Templates
        </Link>
      </nav>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search adventures by name or synopsis..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        <input
          type="text"
          placeholder="Filter by campaign/system..."
          value={campaign}
          onChange={(e) => handleCampaignChange(e.target.value)}
          className="input w-full sm:w-64"
        />
      </div>

      {/* Error state */}
      {error && !fetching && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={fetchAdventures} className="btn-primary">
            Try Again
          </button>
        </div>
      )}

      {/* Loading state */}
      {fetching && (
        <LoadingSkeleton variant="card" count={6} />
      )}

      {/* Empty state */}
      {!fetching && !error && adventures.length === 0 && (
        <EmptyState
          icon="🔍"
          title="No public campaigns found"
          description="Check back later or try different search terms."
        />
      )}

      {/* Grid */}
      {!fetching && !error && adventures.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {adventures.map((adventure, i) => (
              <CampaignCard key={adventure.id} id={adventure.id} name={adventure.name} campaign={adventure.campaign} synopsis={adventure.synopsis} maxPlayers={adventure.maxPlayers} ownerDisplayName={adventure.gmDisplayName ?? null} playerCount={adventure.playerCount} index={i} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-secondary disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}

export default function CommunityAdventuresPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="skeleton h-12 w-12 rounded-xl" />
            <div className="space-y-2 flex-1">
              <div className="skeleton h-6 w-48" />
              <div className="skeleton h-4 w-72" />
            </div>
          </div>
          <LoadingSkeleton variant="card" count={6} />
        </div>
      }
    >
      <CommunityAdventuresContent />
    </Suspense>
  )
}
