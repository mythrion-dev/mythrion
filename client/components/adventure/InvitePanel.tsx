'use client'

import { useTranslation } from 'react-i18next'
import type { SubmitEvent } from 'react'

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
  disabled,
  onEmailChange,
  onInviteByEmail,
  onInviteByLink,
  onRevoke,
}: {
  readonly inviteEmail: string
  readonly inviteLink: string | null
  readonly inviteError: string | null
  readonly inviteSending: boolean
  readonly invitations: Invitation[]
  readonly disabled?: boolean
  readonly onEmailChange: (e: string) => void
  readonly onInviteByEmail: (e: SubmitEvent) => void
  readonly onInviteByLink: () => void
  readonly onRevoke: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      {/* Invite by email */}
      <form onSubmit={disabled ? undefined : onInviteByEmail} className="space-y-3">
        <div>
          <label className="label">{t('campaign:inviteByEmail')}</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => onEmailChange(e.target.value)}
              disabled={disabled}
              className="input-field flex-1"
              placeholder={t('campaign:emailPlaceholder')}
            />
            <button
              type="submit"
              disabled={inviteSending || inviteEmail.trim().length === 0 || disabled}
              title={disabled ? t('campaign:readOnlyTooltip') : undefined}
              className={`btn-primary ${disabled ? '!opacity-50 !cursor-not-allowed' : ''}`}
            >
              {t('campaign:send')}
            </button>
          </div>
        </div>
      </form>

      {/* Invite by link */}
      <div>
        <label className="label">{t('campaign:inviteByLink')}</label>
        <button
          onClick={disabled ? undefined : onInviteByLink}
          disabled={inviteSending || disabled}
          title={disabled ? t('campaign:readOnlyTooltip') : undefined}
          className={`btn-ghost ${disabled ? '!opacity-50 !cursor-not-allowed' : ''}`}
        >
          {t('campaign:generateInviteLink')}
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
              {t('common:copy')}
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
          <h4 className="text-sm font-medium text-muted">{t('campaign:pendingInvitations')}</h4>
          {invitations.map(inv => (
            <div key={inv.id} className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground">
                {inv.invitedEmail ?? t('campaign:linkInvitation')}
              </span>
              <button
                onClick={disabled ? undefined : () => onRevoke(inv.id)}
                disabled={disabled}
                title={disabled ? t('campaign:readOnlyTooltip') : undefined}
                className={`text-xs text-danger transition-colors ${disabled ? 'opacity-50 cursor-not-allowed hover:text-danger' : 'hover:text-danger/80'}`}
              >
                {t('campaign:revoke')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
