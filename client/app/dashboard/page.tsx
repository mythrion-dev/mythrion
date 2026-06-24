'use client'

import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'

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
  const { user, loading, logout } = useAuth()
  const router = useRouter()
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
      fetchAdventures()
      fetchSheets()
    }
  }, [user, fetchAdventures, fetchSheets])

  const switchTab = (tab: Tab) => {
    setActiveTab(tab)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.replaceState(null, '', url.toString())
  }

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
          {activeTab === 'adventures' && (
            <Link href="/dashboard/adventures/new" className="btn-primary">
              <span className="text-lg leading-none">+</span>
              <span className="hidden sm:inline">New Adventure</span>
            </Link>
          )}
          {activeTab === 'character-sheets' && (
            <Link href="/dashboard/character-sheets/new" className="btn-primary">
              <span className="text-lg leading-none">+</span>
              <span className="hidden sm:inline">New Character Sheet</span>
            </Link>
          )}
          <button onClick={logout} className="btn-ghost">
            Sign out
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="flex gap-1 mt-4 mb-6">
        <button
          onClick={() => switchTab('adventures')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'adventures'
              ? 'bg-primary/15 text-primary border border-primary/20'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Adventures
        </button>
        <button
          onClick={() => switchTab('character-sheets')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'character-sheets'
              ? 'bg-primary/15 text-primary border border-primary/20'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Character Sheets
        </button>
      </nav>

      {/* Content */}
      {activeTab === 'adventures' ? (
        <section className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Your Adventures</h2>
            <span className="badge badge-gold">
              {adventures.length}{' '}
              {adventures.length === 1 ? 'Adventure' : 'Adventures'}
            </span>
          </div>

          {fetchingAdv ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                <span className="text-sm">Loading adventures...</span>
              </div>
            </div>
          ) : adventures.length === 0 ? (
            <div className="card text-center py-16 space-y-4">
              <div className="text-4xl">🗡️</div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">No adventures yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Your journey begins with a single step. Create your first
                  adventure and gather your party.
                </p>
              </div>
              <Link href="/dashboard/adventures/new" className="btn-primary">
                Create your first adventure
              </Link>
            </div>
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Your Character Sheets</h2>
            <span className="badge badge-gold">
              {sheets.length}{' '}
              {sheets.length === 1 ? 'Sheet' : 'Sheets'}
            </span>
          </div>

          {fetchingSheets ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                <span className="text-sm">Loading sheets...</span>
              </div>
            </div>
          ) : sheets.length === 0 ? (
            <div className="card text-center py-16 space-y-4">
              <div className="text-4xl">📜</div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">No character sheets yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Create your first character sheet from a template and start
                  your adventure.
                </p>
              </div>
              <Link href="/dashboard/character-sheets/new" className="btn-primary">
                Create your first sheet
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sheets.map((sheet, i) => (
                <CharacterSheetCard key={sheet.id} sheet={sheet} index={i} />
              ))}
            </div>
          )}
        </section>
      )}
    </main>
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
            {new Date(adventure.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <span className="text-xs text-muted">
            👥 {adventure.maxPlayers}
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
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}