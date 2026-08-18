'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'

/* ── Types ── */

interface NpcSheet {
  id: string
  characterName: string
  isNpc: boolean
  npcType: string | null
  level: number
  hpActual: number
  hpMax: number
  createdAt: string
  template: { id: string; name: string } | null
}

/* ── Props ── */

interface NpcsMobsSectionProps {
  readonly adventureId: string
  readonly isGM: boolean
  /** Increment to force a re-fetch (e.g. when a new NPC/MOB is created in the sidebar) */
  readonly refreshKey?: number
}

/* ── Component ── */

const LOADING_SKELETON_KEYS = ['a', 'b', 'c']

export function NpcsMobsSection({ adventureId, isGM, refreshKey }: NpcsMobsSectionProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [npcs, setNpcs] = useState<NpcSheet[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'npc' | 'mob'>('npc')

  /* ── Fetch NPCs ── */
  const fetchNpcs = useCallback(async () => {
    if (!adventureId) return
    setLoading(true)
    try {
      const data = await api.get<NpcSheet[]>(`/adventures/${adventureId}/npcs`)
      // [DIAGNOSTIC] log raw API response for NPC HP values
      console.debug(
        `[DIAGNOSTIC] NpcsMobsSection: received ${data.length} NPCs from API`,
        data.map(n => ({
          id: n.id,
          name: n.characterName,
          type: n.npcType,
          hpActual: n.hpActual,
          hpMax: n.hpMax,
        })),
      )
      setNpcs(data)
    } catch {
      /* silently fail */
    } finally {
      setLoading(false)
    }
  }, [adventureId])

  useEffect(() => {
    fetchNpcs()
  }, [fetchNpcs, refreshKey])

  /* ── Filter helpers ── */
  const npcsList = npcs.filter(n => n.npcType === 'NPC')
  const mobsList = npcs.filter(n => n.npcType === 'MOB')
  const currentList = activeTab === 'npc' ? npcsList : mobsList

  const filtered = currentList.filter(n => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return n.characterName.toLowerCase().includes(q)
  })

  if (!isGM) return null

  return (
    <div className="space-y-4">
      {/* Tabs + search row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('npc')}
            className={`tab-pill text-xs ${activeTab === 'npc' ? 'tab-pill-active' : ''}`}
          >
            {t('campaign:npcs')}
            <span className="ml-1 text-[10px] opacity-70">({npcsList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('mob')}
            className={`tab-pill text-xs ${activeTab === 'mob' ? 'tab-pill-active' : ''}`}
          >
            {t('campaign:mobs')}
            <span className="ml-1 text-[10px] opacity-70">({mobsList.length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('campaign:searchCreaturesPlaceholder', { type: activeTab === 'npc' ? 'NPCs' : 'Mobs' })}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-input border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 transition-shadow"
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-2">
          {LOADING_SKELETON_KEYS.map(k => (
            <div key={k} className="data-row">
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-3 w-20" />
              </div>
              <div className="skeleton h-7 w-12 rounded-md" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">{activeTab === 'npc' ? '👤' : '👾'}</div>
          <p className="text-sm text-muted-foreground">
            {search
              ? t('campaign:noCreaturesMatchSearch', { type: activeTab === 'npc' ? 'NPCs' : 'Mobs' })
              : t('campaign:noCreaturesYet', { type: activeTab === 'npc' ? 'NPCs' : 'Mobs' })}
          </p>
        </div>
      )}

      {/* NPC/Mob list */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(n => (
            <div key={n.id} className="data-row">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {n.characterName}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                      n.npcType === 'MOB'
                        ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                        : 'bg-accent/10 text-accent border border-accent/20'
                    }`}
                  >
                    {n.npcType ?? 'NPC'}
                  </span>
                  {n.template && (
                    <span className="badge badge-gold text-[0.6rem]">{n.template.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
                  <span>Lv.{n.level ?? '?'}</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <button
                  onClick={() => router.push(`/dashboard/character-sheets/${n.id}`)}
                  className="btn-ghost text-xs px-2 py-1"
                >
                  {t('common:view')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
