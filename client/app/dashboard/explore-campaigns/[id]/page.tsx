'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { PageNav } from '@/lib/breadcrumb'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { JoinRequestModal } from '@/components/community/JoinRequestModal'

interface Adventure {
  id: string
  name: string
  campaign: string
  synopsis: string | null
  maxPlayers: number
  ownerId: string
  gmDisplayName?: string
  playerCount?: number
  createdAt: string
  updatedAt: string
  sessionWeekday?: string | null
  sessionTime?: string | null
  sessionType?: string | null
}

interface AdventureMember {
  id: string
  userId: string
  role: string
}

interface JoinRequest {
  id: string
  status: string
}

function AdventureDetailContent() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { user } = useAuth()

  const [adventure, setAdventure] = useState<Adventure | null>(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Membership state
  const [members, setMembers] = useState<AdventureMember[]>([])
  const [fetchingMembers, setFetchingMembers] = useState(false)
  const [userMembership, setUserMembership] = useState<AdventureMember | null>(null)

  // Join request state
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [fetchingJoinRequests, setFetchingJoinRequests] = useState(false)
  const [pendingRequest, setPendingRequest] = useState(false)
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [joinMessage, setJoinMessage] = useState('')
  const [submittingJoin, setSubmittingJoin] = useState(false)
  const [joinSuccess, setJoinSuccess] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const fetchAdventure = useCallback(async () => {
    setFetching(true)
    setError(null)
    try {
      const data = await api.get<Adventure>(`/public/adventures/${id}`)
      setAdventure(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load adventure')
    } finally {
      setFetching(false)
    }
  }, [id])

  const fetchMembers = useCallback(async () => {
    if (!user) return
    setFetchingMembers(true)
    try {
      const data = await api.get<AdventureMember[]>(`/adventures/${id}/members`)
      setMembers(data)
      const membership = data.find((m) => m.userId === user.id)
      setUserMembership(membership ?? null)
    } catch {
      // Not authenticated or not a member — ignore
    } finally {
      setFetchingMembers(false)
    }
  }, [id, user])

  const fetchJoinRequests = useCallback(async () => {
    if (!user) return
    setFetchingJoinRequests(true)
    try {
      const data = await api.get<JoinRequest[]>(`/adventures/${id}/join-requests`)
      setJoinRequests(data)
      const pending = data.some((r) => r.status === 'pending')
      setPendingRequest(pending)
    } catch {
      // ignore
    } finally {
      setFetchingJoinRequests(false)
    }
  }, [id, user])

  useEffect(() => {
    fetchAdventure()
  }, [fetchAdventure])

  useEffect(() => {
    if (user) {
      fetchMembers()
      fetchJoinRequests()
    }
  }, [user, fetchMembers, fetchJoinRequests])

  const handleJoinRequest = async () => {
    if (!user) return
    setSubmittingJoin(true)
    setJoinError(null)
    try {
      await api.post(`/adventures/${id}/join-requests`, { message: joinMessage })
      setJoinSuccess(true)
      setPendingRequest(true)
      setShowJoinForm(false)
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to send join request')
    } finally {
      setSubmittingJoin(false)
    }
  }

  if (fetching) {
    return <LoadingSkeleton variant="page" />
  }

  if (error || !adventure) {
    return (
      <div className="space-y-6">
        <PageNav crumbs={[{ label: 'Community', href: '/dashboard/explore-campaigns' }, { label: 'Not found' }]} />
        <EmptyState
          icon="🔍"
          title="Campaign not found"
          description="The campaign you're looking for doesn't exist or has been removed."
        />
      </div>
    )
  }

  const isMember = !!userMembership
  const canJoin = !isMember && !pendingRequest && !joinSuccess

  return (
    <>
      <PageNav
        crumbs={[
          { label: 'Community', href: '/dashboard/explore-campaigns' },
          { label: adventure.name },
        ]}
      />

      <div className="card p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-gradient">
              {adventure.name}
            </h1>
            <span className="badge badge-gold">{adventure.campaign}</span>
          </div>

          {/* Action area */}
          <div className="shrink-0">
            {isMember ? (
              <Link
                href={`/dashboard/adventures/${adventure.id}`}
                className="btn-primary"
              >
                Go to Dashboard
              </Link>
            ) : pendingRequest ? (
              <span className="badge" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                Request Pending
              </span>
            ) : user ? (
              <div className="space-y-2">
                <button
                  onClick={() => setShowJoinForm(true)}
                  className="btn-primary"
                >
                  Request to Join
                </button>
              </div>
            ) : (
              <Link href="/login" className="btn-primary">
                Sign in to join
              </Link>
            )}

            {joinSuccess && (
              <p className="text-sm text-green-400 mt-2">
                Join request sent successfully!
              </p>
            )}
          </div>
        </div>

        {/* Synopsis */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-1">
            Synopsis
          </h3>
          <p className="text-sm text-foreground">
            {adventure.synopsis || 'No synopsis provided.'}
          </p>
        </div>

        {/* Session Information */}
        {adventure.sessionWeekday || adventure.sessionTime || adventure.sessionType ? (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Session Information</h3>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {adventure.sessionWeekday && (
                <><span className="text-muted">Day:</span><span>{adventure.sessionWeekday}</span></>
              )}
              {adventure.sessionTime && (
                <><span className="text-muted">Time:</span><span>{adventure.sessionTime}</span></>
              )}
              {adventure.sessionType && (
                <><span className="text-muted">Format:</span><span>{adventure.sessionType === 'ONLINE' ? '🌐 Online' : '📍 In Person'}</span></>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-400 italic text-sm mt-2">
            Session schedule not defined
          </p>
        )}

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border">
          <div>
            <span className="text-xs text-muted-foreground block">Players</span>
            <span className="text-sm font-medium">
              {adventure.playerCount ?? '?'} / {adventure.maxPlayers}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">GM</span>
            <span className="text-sm font-medium">
              {adventure.gmDisplayName || 'Unknown'}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Campaign</span>
            <span className="text-sm font-medium">{adventure.campaign}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Created</span>
            <span className="text-sm font-medium">
              {new Date(adventure.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      <JoinRequestModal
        open={showJoinForm}
        message={joinMessage}
        onMessageChange={setJoinMessage}
        onCancel={() => {
          setShowJoinForm(false)
          setJoinMessage('')
          setJoinError(null)
        }}
        onConfirm={handleJoinRequest}
        loading={submittingJoin}
        error={joinError}
      />
    </>
  )
}

export default function AdventureDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="skeleton h-5 w-48" />
          <LoadingSkeleton variant="page" />
        </div>
      }
    >
      <AdventureDetailContent />
    </Suspense>
  )
}
