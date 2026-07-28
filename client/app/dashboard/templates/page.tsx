'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'

interface Adventure {
  id: string
  name: string
  campaign: string
}

interface Template {
  id: string
  name: string
  adventureId: string
  adventureName: string
  campaign: string
  createdAt: string
  updatedAt: string
}

export default function DashboardTemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setFetching(true)
    setError(null)
    try {
      const adventures = await api.get<Adventure[]>('/adventures')

      const allTemplates: Template[] = []
      for (const adv of adventures) {
        try {
          const advTemplates = await api.get<Template[]>(`/adventures/${adv.id}/templates`)
          for (const t of advTemplates) {
            allTemplates.push({
              ...t,
              adventureId: adv.id,
              adventureName: adv.name,
              campaign: adv.campaign,
            })
          }
        } catch {
          // Skip adventures we can't fetch templates for
        }
      }

      // Sort by createdAt descending
      allTemplates.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )

      setTemplates(allTemplates)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  return (
    <>
      <PageHeader
        icon="📄"
        title="My Templates"
        subtitle="Character sheet templates from your adventures"
      />

      {/* Loading */}
      {fetching && <LoadingSkeleton variant="card" count={6} />}

      {/* Error */}
      {error && !fetching && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={fetchTemplates} className="btn-primary">
            Try Again
          </button>
        </div>
      )}

      {/* Empty */}
      {!fetching && !error && templates.length === 0 && (
        <EmptyState
          icon="📄"
          title="No templates yet"
          description="Templates will appear here once you create or clone them."
        />
      )}

      {/* Grid */}
      {!fetching && !error && templates.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template, i) => (
            <div
              key={template.id}
              onClick={() =>
                router.push(`/dashboard/adventures/${template.adventureId}`)
              }
              className="card-interactive group flex flex-col cursor-pointer"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-foreground truncate flex-1">
                  {template.name}
                </h3>
                <span className="shrink-0 badge badge-gold ml-2 text-[0.6rem]">
                  {template.campaign}
                </span>
              </div>

              <p className="text-sm text-muted-foreground mb-4 flex-1">
                {template.adventureName}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-xs text-muted">
                  <svg
                    className="w-3.5 h-3.5 inline mr-1 -mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {new Date(template.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                  View adventure →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
