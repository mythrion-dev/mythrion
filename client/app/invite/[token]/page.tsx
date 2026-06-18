'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { api, setAccessToken } from '@/lib/api'
import Link from 'next/link'

interface InvitationInfo {
  campaignName: string
  campaign?: string
  synopsis?: string | null
  role: string
  status: string
  invitedBy: string
  expiresAt?: string
  isValid: boolean
}

export default function InvitePage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const { user, loading: authLoading } = useAuth()

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)

  const fetchInvitation = useCallback(async () => {
    try {
      const data = await api.get<InvitationInfo>(`/invitations/${token}`)
      setInvitation(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load invitation',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchInvitation()
  }, [fetchInvitation])

  async function handleAccept() {
    if (!user) {
      // Store token and redirect to login
      localStorage.setItem('pendingInviteToken', token)
      setAccessToken(token) // temporary cookie for middleware
      router.push(`/login?redirect=/invite/${token}`)
      return
    }

    setAccepting(true)
    setError(null)

    try {
      const result = await api.post<{
        success: boolean
        adventureId: string
        adventureName: string
        role: string
      }>(`/invitations/${token}/accept`)
      setAccepted(true)
      setInvitation({
        ...invitation!,
        status: 'ACCEPTED',
        isValid: false,
      })
      // Redirect to adventure after brief delay
      setTimeout(() => {
        router.push(`/dashboard/adventures/${result.adventureId}`)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading invitation...</span>
        </div>
      </main>
    )
  }

  if (!invitation || error) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="card !p-8 max-w-sm w-full text-center space-y-4">
          <div className="text-3xl">🔗</div>
          <h1 className="text-lg font-semibold">Invalid Invitation</h1>
          <p className="text-sm text-muted-foreground">
            {error ?? 'This invitation link is invalid or has expired.'}
          </p>
          <Link href="/" className="btn-ghost">
            Go home
          </Link>
        </div>
      </main>
    )
  }

  const isPending = invitation.status === 'PENDING'
  const showAccept = isPending || (!user && !authLoading)

  return (
    <main className="flex-1 flex items-center justify-center p-4 relative">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-b from-accent/5 via-primary/3 to-transparent blur-3xl pointer-events-none" />

      <div className="card !p-8 max-w-md w-full space-y-6 animate-slide-up relative z-10">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface border border-border ring-1 ring-primary/10 shadow-[0_0_30px_rgba(201,164,75,0.06)] p-2">
            <img src="/logo.png" alt="Mythrion" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* Status badge */}
        <div className="text-center">
          {invitation.status === 'PENDING' && (
            <span className="badge badge-gold">Invitation</span>
          )}
          {invitation.status === 'EXPIRED' && (
            <span className="badge" style={{ background: 'rgba(110,104,120,0.15)', color: '#6e6878', border: '1px solid rgba(110,104,120,0.2)' }}>
              Expired
            </span>
          )}
          {invitation.status === 'REVOKED' && (
            <span className="badge" style={{ background: 'rgba(231,76,60,0.15)', color: '#e74c3c', border: '1px solid rgba(231,76,60,0.2)' }}>
              Revoked
            </span>
          )}
          {invitation.status === 'ACCEPTED' && (
            <span className="badge" style={{ background: 'rgba(46,204,113,0.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,0.2)' }}>
              Accepted
            </span>
          )}
        </div>

        {/* Campaign info */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-gradient">
            {invitation.campaignName}
          </h1>
          {invitation.campaign && (
            <p className="text-sm text-muted">{invitation.campaign}</p>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Invited by</span>
            <span className="text-foreground">{invitation.invitedBy}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Role</span>
            <span className="badge badge-gold">{invitation.role}</span>
          </div>
          {invitation.expiresAt && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">Expires</span>
              <span className="text-foreground">
                {new Date(invitation.expiresAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>

        {invitation.synopsis && (
          <>
            <hr className="divider" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              {invitation.synopsis}
            </p>
          </>
        )}

        {error && (
          <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}

        {accepted && (
          <div className="rounded-lg bg-success/10 border border-success/20 px-4 py-2.5 text-sm text-success text-center">
            Welcome aboard! Redirecting to the adventure...
          </div>
        )}

        {showAccept && !accepted && (
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="btn-primary w-full"
          >
            {accepting ? (
              <>
                <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                Accepting...
              </>
            ) : (
              'Accept Invitation'
            )}
          </button>
        )}

        {!isPending && !accepted && (
          <p className="text-xs text-muted text-center">
            This invitation is no longer valid.
          </p>
        )}
      </div>
    </main>
  )
}