'use client'

import { useState, useEffect, useCallback, useMemo, Suspense, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { CampaignCard } from '@/components/community/CampaignCard'
import { SearchFilterSection } from '@/components/community/SearchFilterSection'
import type { ActiveFilter, SortOption } from '@/components/community/SearchFilterSection'

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
  sessionWeekday?: string | null
  sessionTime?: string | null
  sessionType?: string | null
}

interface AdventuresResponse {
  data: Adventure[]
  total: number
  page: number
  totalPages: number
}

const SORT_OPTIONS: SortOption[] = [
  { id: 'popular', label: 'Most Popular' },
  { id: 'recent', label: 'Recently Published' },
  { id: 'players', label: 'Most Players' },
  { id: 'newest', label: 'Newest' },
  { id: 'alpha', label: 'Alphabetical' },
]

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

function DashboardExploreCampaignsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [campaign, setCampaign] = useState(searchParams.get('campaign') ?? '')
  const [sessionWeekday, setSessionWeekday] = useState(
    searchParams.get('sessionWeekday') ?? '',
  )
  const [sessionType, setSessionType] = useState(
    searchParams.get('sessionType') ?? '',
  )
  const [timePeriod, setTimePeriod] = useState(
    searchParams.get('timePeriod') ?? '',
  )
  const [sortValue, setSortValue] = useState(
    searchParams.get('sort') ?? 'popular',
  )
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [adventures, setAdventures] = useState<Adventure[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const activeTab =
    pathname.startsWith('/dashboard/public-templates')
      ? 'templates'
      : 'adventures'

  // ── Sync search params back to URL ──

  const syncUrl = useCallback(
    (
      s: string,
      c: string,
      sw: string,
      st: string,
      tp: string,
      sort: string,
      p: number,
    ) => {
      const params = new URLSearchParams()
      if (s) params.set('search', s)
      if (c) params.set('campaign', c)
      if (sw) params.set('sessionWeekday', sw)
      if (st) params.set('sessionType', st)
      if (tp) params.set('timePeriod', tp)
      if (sort && sort !== 'popular') params.set('sort', sort)
      if (p > 1) params.set('page', String(p))
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname],
  )

  // ── Debounced search ──

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

  // ── Fetch adventures ──

  const fetchAdventures = useCallback(async () => {
    setFetching(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (campaign) params.set('campaign', campaign)
      if (sessionWeekday) params.set('sessionWeekday', sessionWeekday)
      if (sessionType) params.set('sessionType', sessionType)
      if (timePeriod) params.set('timePeriod', timePeriod)
      params.set('page', String(page))
      params.set('limit', '12')
      const res = await api.get<AdventuresResponse>(
        `/public/adventures?${params.toString()}`,
      )
      setAdventures(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load adventures',
      )
    } finally {
      setFetching(false)
    }
  }, [debouncedSearch, campaign, sessionWeekday, sessionType, timePeriod, page])

  useEffect(() => {
    fetchAdventures()
  }, [fetchAdventures])

  // ── Sync URL when filters or page changes ──

  useEffect(() => {
    syncUrl(
      debouncedSearch,
      campaign,
      sessionWeekday,
      sessionType,
      timePeriod,
      sortValue,
      page,
    )
  }, [
    debouncedSearch,
    campaign,
    sessionWeekday,
    sessionType,
    timePeriod,
    sortValue,
    page,
    syncUrl,
  ])

  // ── Client-side sorting ──

  const sortedAdventures = useMemo(() => {
    // When searching, the server already ranks results by relevance —
    // skip client-side sorting so that order wins.
    if (debouncedSearch) return adventures
    const list = [...adventures]
    switch (sortValue) {
      case 'popular':
        return list.sort(
          (a, b) => (b.playerCount ?? 0) - (a.playerCount ?? 0),
        )
      case 'recent':
        return list.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
      case 'players':
        return list.sort((a, b) => b.maxPlayers - a.maxPlayers)
      case 'newest':
        return list.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
      case 'alpha':
        return list.sort((a, b) => a.name.localeCompare(b.name))
      default:
        return list
    }
  }, [adventures, sortValue, debouncedSearch])

  // ── Filter change handlers ──

  const handleCampaignChange = (value: string) => {
    setCampaign(value)
    setPage(1)
  }

  const handleSessionTypeChange = (value: string) => {
    setSessionType(value)
    setPage(1)
  }

  // ── Active filters ──

  const activeFilters: ActiveFilter[] = useMemo(() => {
    const filters: ActiveFilter[] = []
    if (debouncedSearch)
      filters.push({ id: 'search', label: `Search: ${debouncedSearch}` })
    if (campaign) filters.push({ id: 'campaign', label: campaign })
    if (sessionWeekday) filters.push({ id: 'sessionWeekday', label: sessionWeekday })
    if (sessionType)
      filters.push({
        id: 'sessionType',
        label: sessionType === 'ONLINE' ? 'Online' : 'In Person',
      })
    if (timePeriod)
      filters.push({
        id: 'timePeriod',
        label:
          timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1),
      })
    return filters
  }, [debouncedSearch, campaign, sessionWeekday, sessionType, timePeriod])

  const handleRemoveFilter = useCallback(
    (id: string) => {
      switch (id) {
        case 'search':
          setSearch('')
          break
        case 'campaign':
          setCampaign('')
          break
        case 'sessionWeekday':
          setSessionWeekday('')
          break
        case 'sessionType':
          setSessionType('')
          break
        case 'timePeriod':
          setTimePeriod('')
          break
      }
      setPage(1)
    },
    [],
  )

  const handleRemoveAll = useCallback(() => {
    setSearch('')
    setCampaign('')
    setSessionWeekday('')
    setSessionType('')
    setTimePeriod('')
    setPage(1)
  }, [])

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
          href="/dashboard/explore-campaigns"
          className={`tab-pill ${
            activeTab === 'adventures' ? 'tab-pill-active' : ''
          }`}
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
          href="/dashboard/public-templates"
          className={`tab-pill ${
            activeTab === 'templates' ? 'tab-pill-active' : ''
          }`}
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

      {/* ── Search & Filters ── */}
      <SearchFilterSection
        placeholder="Search campaigns by name, GM or description..."
        search={search}
        onSearchChange={(v) => {
          setSearch(v)
        }}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onRemoveAll={handleRemoveAll}
        sortOptions={SORT_OPTIONS}
        sortValue={sortValue}
        onSortChange={setSortValue}
      >
        {/* Campaign/System filter */}
        {/* <div className="flex flex-col gap-1.5 min-w-[160px]">
          <label className="label !mb-0">Campaign / System</label>
          <input
            type="text"
            placeholder="e.g. D&D 5e, Tormenta..."
            value={campaign}
            onChange={(e) => handleCampaignChange(e.target.value)}
            className="input-field py-2 px-3 text-sm"
          />
        </div> */}

        {/* Weekday filter */}
        <div className="flex flex-col gap-1.5 min-w-[160px]">
          <label className="label !mb-0">Day</label>
          <select
            value={sessionWeekday}
            onChange={(e) => {
              setSessionWeekday(e.target.value)
              setPage(1)
            }}
            className="input-field py-2 pr-8 pl-3 text-sm"
          >
            <option value="">Any day</option>
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>

        {/* Session type filter */}
        <div className="flex flex-col gap-1.5">
          <label className="label !mb-0">Type</label>
          <div className="flex gap-1 h-full items-end pb-[1px]">
            <button
              type="button"
              onClick={() => handleSessionTypeChange('')}
              className={`tab-pill text-xs !px-3 !py-1.5 ${
                sessionType === '' ? 'tab-pill-active' : ''
              }`}
            >
              Any
            </button>
            <button
              type="button"
              onClick={() => handleSessionTypeChange('ONLINE')}
              className={`tab-pill text-xs !px-3 !py-1.5 ${
                sessionType === 'ONLINE' ? 'tab-pill-active' : ''
              }`}
            >
              Online
            </button>
            <button
              type="button"
              onClick={() => handleSessionTypeChange('IN_PERSON')}
              className={`tab-pill text-xs !px-3 !py-1.5 ${
                sessionType === 'IN_PERSON' ? 'tab-pill-active' : ''
              }`}
            >
              In Person
            </button>
          </div>
        </div>

        {/* Time period filter */}
        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <label className="label !mb-0">Schedule</label>
          <select
            value={timePeriod}
            onChange={(e) => {
              setTimePeriod(e.target.value)
              setPage(1)
            }}
            className="input-field py-2 pr-8 pl-3 text-sm"
          >
            <option value="">Any time</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="night">Night</option>
          </select>
        </div>
      </SearchFilterSection>

      {/* ── Error state ── */}
      {error && !fetching && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={fetchAdventures} className="btn-primary">
            Try Again
          </button>
        </div>
      )}

      {/* ── Loading state ── */}
      {fetching && <LoadingSkeleton variant="card" count={6} />}

      {/* ── Empty state ── */}
      {!fetching && !error && sortedAdventures.length === 0 && (
        <EmptyState
          icon="🔍"
          title="No campaigns match your search"
          description="Try changing your filters or check back later."
        />
      )}

      {/* ── Results grid ── */}
      {!fetching && !error && sortedAdventures.length > 0 && (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sortedAdventures.map((adventure, i) => (
              <CampaignCard
                key={adventure.id}
                id={adventure.id}
                name={adventure.name}
                campaign={adventure.campaign}
                synopsis={adventure.synopsis}
                maxPlayers={adventure.maxPlayers}
                ownerDisplayName={adventure.gmDisplayName ?? null}
                playerCount={adventure.playerCount}
                index={i}
                sessionWeekday={adventure.sessionWeekday}
                sessionTime={adventure.sessionTime}
                sessionType={adventure.sessionType}
              />
            ))}
          </div>

          {/* ── Pagination ── */}
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

export default function DashboardExploreCampaignsPage() {
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
      <DashboardExploreCampaignsContent />
    </Suspense>
  )
}
