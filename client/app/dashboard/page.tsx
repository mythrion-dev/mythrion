'use client'

import { api } from '@/lib/api'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'

interface Adventure {
  id: string
  name: string
  campaign: string
  synopsis: string | null
  maxPlayers: number
  ownerId: string
  role?: string
  joinedAt?: string
  createdAt: string
  updatedAt: string
}

interface CharacterSheetSummary {
  id: string
  characterName: string
  adventure: { id: string; name: string; campaign: string }
  template: { id: string; name: string }
  createdAt: string
}

/* ── Tab type ── */
type Tab = 'adventures' | 'character-sheets'

function DashboardContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam === 'character-sheets' ? 'character-sheets' : 'adventures',
  )

  const [adventures, setAdventures] = useState<Adventure[]>([])
  const [fetchingAdv, setFetchingAdv] = useState(true)

  const [sheets, setSheets] = useState<CharacterSheetSummary[]>([])
  const [fetchingSheets, setFetchingSheets] = useState(true)

  const fetchAdventures = useCallback(async () => {
    try {
      const data = await api.get<Adventure[]>('/adventures')
      setAdventures(data)
    } catch {
      // token may be invalid
    } finally {
      setFetchingAdv(false)
    }
  }, [])

  const fetchSheets = useCallback(async () => {
    try {
      const data = await api.get<CharacterSheetSummary[]>('/character-sheets')
      setSheets(data)
    } catch {
      // ignore
    } finally {
      setFetchingSheets(false)
    }
  }, [])

  useEffect(() => {
    fetchAdventures()
    fetchSheets()
  }, [fetchAdventures, fetchSheets])

  const switchTab = (tab: Tab) => {
    setActiveTab(tab)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.replaceState(null, '', url.toString())
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your adventures and character sheets at a glance"
        icon="⚔️"
        actions={
          activeTab === 'adventures' ? (
            <Link href="/dashboard/adventures/new" className="btn-primary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Adventure</span>
            </Link>
          ) : (
            <Link href="/dashboard/character-sheets/new" className="btn-primary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Character Sheet</span>
            </Link>
          )
        }
      />

      {/* Tab Navigation */}
      <nav className="flex gap-1 mt-4 mb-6">
        <button
          onClick={() => switchTab('adventures')}
          className={`tab-pill ${activeTab === 'adventures' ? 'tab-pill-active' : ''}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Adventures
          {!fetchingAdv && adventures.length > 0 && (
            <span className="badge badge-gold ml-1">{adventures.length}</span>
          )}
        </button>
        <button
          onClick={() => switchTab('character-sheets')}
          className={`tab-pill ${activeTab === 'character-sheets' ? 'tab-pill-active' : ''}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Character Sheets
          {!fetchingSheets && sheets.length > 0 && (
            <span className="badge badge-gold ml-1">{sheets.length}</span>
          )}
        </button>
      </nav>

      {/* Content */}
      {activeTab === 'adventures' ? (
        <section className="flex-1">
          {fetchingAdv ? (
            <LoadingSkeleton variant="card" count={3} />
          ) : adventures.length === 0 ? (
            <EmptyState
              icon="🗡️"
              title="No adventures yet"
              description="Your journey begins with a single step. Create your first adventure and gather your party."
              actionLabel="Create your first adventure"
              actionHref="/dashboard/adventures/new"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {adventures.map((adventure, i) => (
                <AdventureCard
                  key={adventure.id}
                  adventure={adventure}
                  index={i}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="flex-1">
          {fetchingSheets ? (
            <LoadingSkeleton variant="card" count={3} />
          ) : sheets.length === 0 ? (
            <EmptyState
              icon="📜"
              title="No character sheets yet"
              description="Create your first character sheet from a template and start your adventure."
              actionLabel="Create your first sheet"
              actionHref="/dashboard/character-sheets/new"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sheets.map((sheet, i) => (
                <CharacterSheetCard key={sheet.id} sheet={sheet} index={i} />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  )
}

function AdventureCard({
  adventure,
  index,
}: {
  adventure: Adventure
  index: number
}) {
  return (
    <Link
      href={`/dashboard/adventures/${adventure.id}`}
      className="card-interactive group flex flex-col"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Card ornament */}
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-foreground truncate flex-1">
          {adventure.name}
        </h3>
        <span className="shrink-0 badge badge-gold ml-2 text-[0.6rem]">
          {adventure.campaign}
        </span>
      </div>

      {adventure.role && (
        <div className="mb-2">
          <span
            className={`badge text-[0.6rem] ${
              adventure.role === 'GM' ? 'badge-gold' : ''
            }`}
            style={
              adventure.role !== 'GM'
                ? {
                    background: 'rgba(124,92,231,0.15)',
                    color: '#9070f0',
                    border: '1px solid rgba(124,92,231,0.2)',
                  }
                : undefined
            }
          >
            {adventure.role}
          </span>
        </div>
      )}

      {adventure.synopsis ? (
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
          {adventure.synopsis}
        </p>
      ) : (
        <p className="text-sm text-muted italic mb-4 flex-1">
          No synopsis yet.
        </p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(adventure.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <span className="text-xs text-muted">
            <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {adventure.maxPlayers} max
          </span>
        </div>
        <span className="text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
          View details →
        </span>
      </div>
    </Link>
  )
}

function CharacterSheetCard({
  sheet,
  index,
}: {
  sheet: CharacterSheetSummary
  index: number
}) {
  return (
    <Link
      href={`/dashboard/character-sheets/${sheet.id}`}
      className="card-interactive group flex flex-col"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-foreground truncate flex-1">
          {sheet.characterName}
        </h3>
        <span className="shrink-0 badge badge-gold ml-2 text-[0.6rem]">
          {sheet.template.name}
        </span>
      </div>

      <p className="text-sm text-muted-foreground mb-2">
        {sheet.adventure.campaign}
      </p>
      <p className="text-xs text-muted italic mb-4 flex-1">
        {sheet.adventure.name}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <span className="text-xs text-muted">
          <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {new Date(sheet.createdAt).toLocaleDateString('en-US', {
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

export default function DashboardPage() {
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
          <LoadingSkeleton variant="card" count={3} />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}
