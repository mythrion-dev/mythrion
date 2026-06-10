'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'

export default function NewCampaignPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
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
      await api.post('/campaigns', {
        name: name.trim(),
        description: description.trim() || undefined,
      })
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-sm text-gray-400">Loading...</div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            &larr; Back
          </button>
          <h1 className="text-2xl font-bold tracking-tight mt-2">
            Create Campaign
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Start a new adventure
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Campaign Name
            </label>
            <input
              id="name"
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="The Dragon's Lair"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium">
              Description <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              id="description"
              maxLength={1000}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="An epic quest to..."
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || name.trim().length === 0}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Campaign'}
          </button>
        </form>
      </div>
    </main>
  )
}