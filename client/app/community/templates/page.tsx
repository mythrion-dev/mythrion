'use client'

import { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { TemplateCard } from '@/components/community/TemplateCard'

interface Template {
  id: string
  name: string
  description: string | null
  campaign: string
  adventureName?: string
  adventureId?: string
  createdAt: string
  updatedAt: string
  useCount: number
  owner: {
    id: string
    displayName: string | null
  }
  _count: {
    attributes: number
    templateSkills: number
  }
}

interface TemplatesResponse {
  data: Template[]
  total: number
  page: number
  totalPages: number
}

function CommunityTemplatesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()

  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [campaign, setCampaign] = useState(searchParams.get('campaign') ?? '')
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [templates, setTemplates] = useState<Template[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Clone state
  const [cloningId, setCloningId] = useState<string | null>(null)
  const [cloneSuccess, setCloneSuccess] = useState<string | null>(null)
  const [showSignInPrompt, setShowSignInPrompt] = useState(false)

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

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setFetching(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (campaign) params.set('campaign', campaign)
      params.set('page', String(page))
      params.set('limit', '12')
      const res = await api.get<TemplatesResponse>(
        `/public/templates?${params.toString()}`,
      )
      setTemplates(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setFetching(false)
    }
  }, [debouncedSearch, campaign, page])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Sync URL when debouncedSearch, campaign, or page changes
  useEffect(() => {
    syncUrl(debouncedSearch, campaign, page)
  }, [debouncedSearch, campaign, page, syncUrl])

  const handleCampaignChange = (value: string) => {
    setCampaign(value)
    setPage(1)
  }

  const handleClone = async (templateId: string) => {
    if (!user) {
      setShowSignInPrompt(true)
      return
    }

    setCloningId(templateId)
    setCloneSuccess(null)
    try {
      await api.post(`/templates/${templateId}/clone`)
      setCloneSuccess(templateId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone template')
    } finally {
      setCloningId(null)
    }
  }

  return (
    <>
      <PageHeader
        icon="📄"
        title="Explore Templates"
        subtitle="Browse and clone character sheet templates from the community"
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
            placeholder="Search templates by name..."
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

      {/* Sign-in prompt */}
      {showSignInPrompt && (
        <div className="mb-4 p-3 rounded-lg bg-surface border border-border text-sm">
          <span className="text-muted-foreground">
            Please{' '}
            <Link href="/login" className="text-accent hover:text-accent-hover underline">
              sign in
            </Link>{' '}
            to clone templates.
          </span>
          <button
            onClick={() => setShowSignInPrompt(false)}
            className="ml-2 text-muted hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error state */}
      {error && !fetching && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={fetchTemplates} className="btn-primary">
            Try Again
          </button>
        </div>
      )}

      {/* Loading state */}
      {fetching && (
        <LoadingSkeleton variant="card" count={6} />
      )}

      {/* Empty state */}
      {!fetching && !error && templates.length === 0 && (
        <EmptyState
          icon="📄"
          title="No public templates found"
          description="Check back later or try different search terms."
        />
      )}

      {/* Grid */}
      {!fetching && !error && templates.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template, i) => (
              <TemplateCard
                key={template.id}
                id={template.id}
                name={template.name}
                description={template.description}
                campaign={template.campaign}
                creatorDisplayName={template.owner?.displayName ?? null}
                copyCount={template.useCount}
                attributeCount={template._count?.attributes ?? 0}
                skillCount={template._count?.templateSkills ?? 0}
                updatedAt={template.updatedAt}
                index={i}
                onClone={() => handleClone(template.id)}
                isCloning={cloningId === template.id}
                isAuthenticated={!!user}
                isOwn={user?.id === template.owner?.id}
              />
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

export default function CommunityTemplatesPage() {
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
      <CommunityTemplatesContent />
    </Suspense>
  )
}
