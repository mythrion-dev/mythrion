'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import Link from 'next/link'

export default function NewAdventurePage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [name, setName] = useState('')
  const [campaign, setCampaign] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && !user) {
    router.replace('/login')
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const created = await api.post<{ id: string }>('/adventures', {
        name: name.trim(),
        campaign: campaign.trim(),
        synopsis: synopsis.trim() || undefined,
        maxPlayers,
      })
      router.push(`/dashboard/adventures/${created.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create adventure')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex items-center justify-center p-4 relative">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-b from-accent/5 via-primary/3 to-transparent blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 animate-slide-up relative z-10">
        {/* Back link */}
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-surface border border-border">
            <svg
              className="w-5 h-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gradient">
              Create Adventure
            </h1>
            <p className="text-sm text-muted-foreground">
              Your new adventure awaits
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card !p-6 space-y-4">
          <div>
            <label htmlFor="name" className="label">
              Adventure Name
            </label>
            <input
              id="name"
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="e.g. The Dragon's Lair"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="campaign" className="label">
              Campaign
            </label>
            <input
              id="campaign"
              type="text"
              required
              maxLength={50}
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              className="input-field"
              placeholder="e.g. D&D, Tormenta, Call of Cthulhu"
            />
            <p className="text-xs text-muted mt-1.5">
              Type the RPG system for this adventure.
            </p>
          </div>

          <div>
            <label htmlFor="synopsis" className="label">
              Synopsis{' '}
              <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="synopsis"
              maxLength={2000}
              rows={4}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              className="input-field resize-none"
              placeholder="Briefly describe the adventure..."
            />
            <p className="text-xs text-muted mt-1.5 text-right">
              {synopsis.length}/2000
            </p>
          </div>

          <div>
            <label htmlFor="maxPlayers" className="label">
              Max Players
            </label>
            <div className="flex items-center gap-3">
              <input
                id="maxPlayers"
                type="range"
                min={1}
                max={5}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #c9a44b 0%, #c9a44b ${((maxPlayers - 1) / 4) * 100}%, #2a2240 ${((maxPlayers - 1) / 4) * 100}%, #2a2240 100%)`,
                }}
              />
              <span className="badge badge-gold min-w-[2rem] text-center">
                {maxPlayers}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted mt-1.5">
              <span>1</span>
              <span>5</span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || name.trim().length === 0 || campaign.trim().length === 0}
            className="btn-primary w-full"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create Adventure
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  )
}