'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useSubscription } from '@/lib/subscription-context'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { TemplateCard } from '@/components/templates/TemplateCard'

interface TemplateSummary {
  id: string
  name: string
  description: string | null
  campaign: string | null
  createdAt: string
  updatedAt: string
  useCount: number
  isPublic: boolean
  _count: {
    attributes: number
    templateSkills: number
  }
}

export default function DashboardTemplatesPage() {
  const { hasActiveSubscription } = useSubscription()
  const { t } = useTranslation()
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setFetching(true)
    setError(null)
    try {
      const data = await api.get<TemplateSummary[]>('/templates')
      setTemplates(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('templates:failedToLoad'))
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
        title={t('common:myTemplates')}
        subtitle={t('templates:myTemplatesSubtitle')}
        actions={
          hasActiveSubscription ? (
            <Link href="/dashboard/templates/new" className="btn-primary text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">{t('templates:newTemplate')}</span>
            </Link>
          ) : (
            <Link
              href="/pricing"
              className="btn-ghost text-xs border border-accent/30 bg-accent/10 text-accent hover:bg-accent/15"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="hidden sm:inline">{t('templates:upgradeToCreate')}</span>
            </Link>
          )
        }
      />

      {/* Loading */}
      {fetching && <LoadingSkeleton variant="card" count={6} />}

      {/* Error */}
      {error && !fetching && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={fetchTemplates} className="btn-primary">
            {t('templates:tryAgain')}
          </button>
        </div>
      )}

      {/* Empty */}
      {!fetching && !error && templates.length === 0 && (
        <EmptyState
          icon="📄"
          title={t('templates:noTemplatesYet')}
          description={hasActiveSubscription ? t('templates:emptyDescriptionSubscribed') : t('templates:emptyDescriptionFree')}
          actionLabel={hasActiveSubscription ? t('templates:createFirstTemplate') : t('templates:viewPlansArrow')}
          actionHref={hasActiveSubscription ? "/dashboard/templates/new" : "/pricing"}
        />
      )}

      {/* Grid */}
      {!fetching && !error && templates.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template, i) => (
            <TemplateCard
              key={template.id}
              id={template.id}
              name={template.name}
              description={template.description}
              campaign={template.campaign}
              createdAt={template.createdAt}
              attributeCount={template._count?.attributes ?? 0}
              skillCount={template._count?.templateSkills ?? 0}
              useCount={template.useCount}
              isPublic={template.isPublic}
              index={i}
            />
          ))}
        </div>
      )}
    </>
  )
}
