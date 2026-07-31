'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, API_URL, authFetch } from '@/lib/api'
import { NpcEditDrawer } from './NpcEditDrawer'

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

interface CampaignCreatureSidebarProps {
  adventureId: string
  isGM: boolean
  refreshKey?: number
  /** Called after an NPC/MOB is created or deleted so parent components can re-fetch */
  onCreaturesChange?: () => void
}

/* ── Component ── */

export function CampaignCreatureSidebar({
  adventureId,
  isGM,
  refreshKey,
  onCreaturesChange,
}: CampaignCreatureSidebarProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [npcs, setNpcs] = useState<NpcSheet[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'NPC' | 'MOB'>('all')
  const [creating, setCreating] = useState<string | null>(null) // 'NPC' | 'MOB' | null
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editingNpcId, setEditingNpcId] = useState<string | null>(null)

  /* ── Fetch NPCs ── */
  const fetchNpcs = useCallback(async () => {
    if (!adventureId) return
    setLoading(true)
    try {
      const data = await api.get<NpcSheet[]>(`/adventures/${adventureId}/npcs`)
      setNpcs(data)
    } catch {
      /* silently fail */
    } finally {
      setLoading(false)
    }
  }, [adventureId])

  useEffect(() => {
    if (isOpen) fetchNpcs()
  }, [isOpen, fetchNpcs, refreshKey])

  /* ── Create NPC/Mob and open in drawer ── */
  async function handleCreate(type: 'NPC' | 'MOB') {
    setCreating(type)
    try {
      const name = type === 'MOB' ? 'New Mob' : 'New NPC'
      const created = await api.post<NpcSheet>(`/adventures/${adventureId}/npcs`, { name, type })
      await fetchNpcs()
      onCreaturesChange?.()
      // Open the newly created NPC in the edit drawer
      if (created?.id) {
        setEditingNpcId(created.id)
      }
    } catch {
      /* silently fail */
    } finally {
      setCreating(null)
    }
  }

  /* ── Delete NPC/Mob ── */
  async function handleDelete(npcId: string) {
    setDeleting(npcId)
    try {
      await api.delete(`/adventures/${adventureId}/npcs/${npcId}`)
      await fetchNpcs()
      onCreaturesChange?.()
    } catch {
      /* silently fail */
    } finally {
      setDeleting(null)
    }
  }

  /* ── Upload avatar ── */
  async function handleAvatarUpload(npcId: string, file: File) {
    const formData = new FormData()
    formData.append('avatar', file)
    try {
      await authFetch(`${API_URL}/images/character-sheets/${npcId}/avatar`, {
        method: 'POST',
        body: formData,
      })
      await fetchNpcs()
    } catch {
      /* silently fail */
    }
  }

  /* ── Open full character sheet ── */
  function handleSelect(npcId: string) {
    router.push(`/dashboard/character-sheets/${npcId}`)
  }

  /* ── Edit drawer callbacks ── */
  function handleEditDrawerClosed() {
    setEditingNpcId(null)
  }

  async function handleEditDrawerSaved() {
    setEditingNpcId(null)
    await fetchNpcs()
    onCreaturesChange?.()
  }

  /* ── Filter & search ── */
  const filtered = npcs.filter(n => {
    if (filter === 'NPC' && n.npcType === 'NPC') return true
    if (filter === 'MOB' && n.npcType === 'MOB') return true
    if (filter === 'all') return true
    return false
  }).filter(n => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return n.characterName.toLowerCase().includes(q)
  })

  /* ── Health display ── */
  function healthLabel(n: NpcSheet): string | null {
    if (!n.hpMax) return null
    return `${n.hpActual ?? '?'} / ${n.hpMax}`
  }

  /* ── Avatar URL ── */
  function avatarUrl(npcId: string) {
    return `${API_URL}/images/character-sheets/${npcId}/avatar`
  }

  /* ── Render ── */
  if (!isGM) return null

  return (
    <>
      {/* Toggle button — fixed on right edge */}
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          if (isOpen) setEditingNpcId(null) // close sidebar → exit edit mode
        }}
        className="fixed top-24 right-0 z-40 flex items-center gap-2 px-3 py-2 rounded-l-lg bg-surface border border-r-0 border-border text-sm font-medium text-foreground hover:bg-hover transition-colors shadow-lg"
        aria-label={isOpen ? 'Close NPC sidebar' : 'Open NPC sidebar'}
      >
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="hidden sm:flex items-center gap-1.5">
          {/* Skull icon */}
          <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8 2 4 5 4 9c0 2.5 1.5 4.5 3 6l1 5h8l1-5c1.5-1.5 3-3.5 3-6 0-4-4-7-8-7z" />
            <circle cx="9" cy="9" r="1.5" fill="currentColor" />
            <circle cx="15" cy="9" r="1.5" fill="currentColor" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 14c1.5 1 4.5 1 6 0" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 3l-2 2M14 3l2 2" />
          </svg>
          {/* Vertical separator */}
          <span className="text-muted-foreground/40 font-light select-none">|</span>
          {/* User icon */}
          <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {/* <span>NPCs</span> */}
        </span>
        {npcs.length > 0 && (
          <span className="badge">{npcs.length}</span>
        )}
      </button>

      {/* Sidebar overlay (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={() => { setIsOpen(false); setEditingNpcId(null) }}
        />
      )}

      {/* Sidebar panel — wider in edit mode */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full bg-surface border-l border-border shadow-2xl transition-all duration-300 flex flex-col ${
          editingNpcId ? 'w-[500px] md:w-[560px]' : 'w-[340px]'
        } max-w-[95vw] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {editingNpcId ? (
          /* ── Edit mode: show the NpcEditDrawer ── */
          <NpcEditDrawer
            npcId={editingNpcId}
            adventureId={adventureId}
            onClose={handleEditDrawerClosed}
            onSaved={handleEditDrawerSaved}
          />
        ) : (
          /* ── List mode: existing sidebar content ── */
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-foreground">NPCs &amp; Mobs</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
                aria-label="Close sidebar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-border shrink-0">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search creatures..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 transition-shadow"
                />
              </div>
            </div>

            {/* Filter tabs + Create buttons */}
            <div className="px-4 py-3 border-b border-border space-y-3 shrink-0">
              {/* Filter pills */}
              <div className="flex gap-1">
                {(['all', 'NPC', 'MOB'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`tab-pill text-xs ${filter === t ? 'tab-pill-active' : ''}`}
                  >
                    {t === 'all' ? 'All' : t === 'NPC' ? 'NPCs' : 'Mobs'}
                    {t !== 'all' && (
                      <span className="ml-1 opacity-70">
                        ({npcs.filter(n => n.npcType === (t === 'NPC' ? 'NPC' : 'MOB')).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Create buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleCreate('NPC')}
                  disabled={creating !== null}
                  className="flex-1 btn-primary !py-1.5 !text-xs"
                >
                  {creating === 'NPC' ? (
                    <span className="flex items-center gap-1.5 justify-center">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 justify-center">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      + New NPC
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleCreate('MOB')}
                  disabled={creating !== null}
                  className="flex-1 btn-primary !py-1.5 !text-xs"
                >
                  {creating === 'MOB' ? (
                    <span className="flex items-center gap-1.5 justify-center">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 justify-center">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      + New Mob
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Creature list */}
            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="card !p-3 flex items-center gap-3">
                      <div className="skeleton w-10 h-10 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="skeleton h-4 w-28" />
                        <div className="skeleton h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="w-14 h-14 rounded-full bg-surface border border-border flex items-center justify-center text-2xl mb-3">
                    {search ? '🔍' : '👾'}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {search
                      ? 'No creatures match your search.'
                      : 'No NPCs or Mobs yet. Create one above!'}
                  </p>
                </div>
              )}

              {!loading && filtered.length > 0 && (
                <div className="p-3 space-y-2">
                  {filtered.map(npc => {
                    const type = npc.npcType === 'MOB' ? 'MOB' : 'NPC'
                    const hp = healthLabel(npc)

                    return (
                      <div
                        key={npc.id}
                        className="w-full card !p-3 flex items-center gap-3 hover:bg-hover transition-colors text-left group"
                      >
                        {/* Avatar */}
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surface border border-border">
                          <img
                            src={avatarUrl(npc.id)}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={e => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                          {/* Upload overlay */}
                          <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => {
                                const f = e.target.files?.[0]
                                if (f) handleAvatarUpload(npc.id, f)
                                e.target.value = ''
                              }}
                              onClick={e => e.stopPropagation()}
                            />
                          </label>
                        </div>

                        {/* Info — click to open full sheet */}
                        <button
                          onClick={() => handleSelect(npc.id)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">
                              {npc.characterName}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                              type === 'MOB'
                                ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                                : 'bg-accent/10 text-accent border border-accent/20'
                            }`}>
                              {type}
                            </span>
                          </div>
                          {hp && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              ❤️ {hp}
                            </p>
                          )}
                        </button>

                        {/* Action buttons */}
                        <div className="flex gap-1 shrink-0">
                          {/* Edit inline drawer */}
                          <button
                            onClick={() => setEditingNpcId(npc.id)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all"
                            aria-label={`Edit ${npc.characterName}`}
                            title="Edit inline"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {/* Navigate to full sheet */}
                          <button
                            onClick={() => handleSelect(npc.id)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all"
                            aria-label={`View ${npc.characterName}`}
                            title="Open full sheet"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                          {/* Delete */}
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              handleDelete(npc.id)
                            }}
                            disabled={deleting === npc.id}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0"
                            aria-label={`Delete ${npc.characterName}`}
                          >
                            {deleting === npc.id ? (
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-border shrink-0 text-[11px] text-muted-foreground">
              {npcs.length} creature{npcs.length !== 1 ? 's' : ''} · click name to open full sheet
            </div>
          </>
        )}
      </aside>
    </>
  )
}
