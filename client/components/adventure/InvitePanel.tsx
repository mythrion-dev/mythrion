'use client'

import type { FormEvent } from 'react'

interface Invitation {
  id: string
  invitedEmail: string | null
  token: string
  role: string
  status: string
  expiresAt: string
  createdAt: string
  createdBy: { id: string; displayName: string | null; email: string }
}

export function InvitePanel({
  inviteEmail,
  inviteLink,
  inviteError,
  inviteSending,
  invitations,
  onEmailChange,
  onInviteByEmail,
  onInviteByLink,
  onRevoke,
}: {
  inviteEmail: string
  inviteLink: string | null
  inviteError: string | null
  inviteSending: boolean
  invitations: Invitation[]
  onEmailChange: (e: string) => void
  onInviteByEmail: (e: FormEvent) => void
  onInviteByLink: () => void
  onRevoke: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      {/* Invite by email */}
      <form onSubmit={onInviteByEmail} className="space-y-3">
        <div>
          <label className="label">Invite by Email</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => onEmailChange(e.target.value)}
              className="input-field flex-1"
              placeholder="player@example.com"
            />
            <button
              type="submit"
              disabled={inviteSending || inviteEmail.trim().length === 0}
              className="btn-primary"
            >
              Send
            </button>
          </div>
        </div>
      </form>

      {/* Invite by link */}
      <div>
        <label className="label">Invite by Link</label>
        <button
          onClick={onInviteByLink}
          disabled={inviteSending}
          className="btn-ghost"
        >
          Generate invite link
        </button>
        {inviteLink && (
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={inviteLink}
              className="input-field flex-1 text-xs"
              onFocus={e => e.target.select()}
            />
            <button
              onClick={() => navigator.clipboard.writeText(inviteLink!)}
              className="btn-ghost text-xs"
            >
              Copy
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {inviteError && (
        <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
          {inviteError}
        </div>
      )}

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted">Pending Invitations</h4>
          {invitations.map(inv => (
            <div key={inv.id} className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground">
                {inv.invitedEmail ?? 'Link invitation'}
              </span>
              <button
                onClick={() => onRevoke(inv.id)}
                className="text-xs text-danger hover:text-danger/80 transition-colors"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
