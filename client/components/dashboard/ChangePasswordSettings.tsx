'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth-context'
import { changePassword } from '@/lib/auth-api'
import { getRefreshToken } from '@/lib/api'
import { isStrongPassword } from '@/lib/password'
import { PasswordStrength } from '@/components/auth/PasswordStrength'

/**
 * Security card on the settings page: change the account password, optionally
 * revoking every other session in the process.
 */
export function ChangePasswordSettings() {
  const { t } = useTranslation()
  const { user, refreshProfile } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [logoutOtherDevices, setLogoutOtherDevices] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Google-only accounts have no password set to change.
  if (user?.hasPassword === false) return null

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!isStrongPassword(newPassword)) {
      setError(t('auth:passwordNotStrongEnough'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth:confirmPasswordMismatch'))
      return
    }

    setSubmitting(true)
    try {
      await changePassword({
        currentPassword,
        newPassword,
        logoutOtherDevices,
        ...(logoutOtherDevices ? { currentRefreshToken: getRefreshToken() ?? undefined } : {}),
      })
      await refreshProfile()
      setSuccess(t('auth:passwordChanged'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth:somethingWentWrong'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-surface border border-border">
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
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-foreground">{t('auth:changePassword')}</h2>
      </div>

      {success && (
        <div className="rounded-lg bg-success-muted border border-success/30 px-4 py-2.5 text-sm text-success">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="change-password-current" className="label">
            {t('auth:currentPassword')}
          </label>
          <input
            id="change-password-current"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input-field"
            placeholder={t('auth:passwordPlaceholder')}
          />
        </div>

        <div>
          <label htmlFor="change-password-new" className="label">
            {t('auth:newPassword')}
          </label>
          <input
            id="change-password-new"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input-field"
            placeholder={t('auth:passwordPlaceholder')}
          />
          <PasswordStrength password={newPassword} />
        </div>

        <div>
          <label htmlFor="change-password-confirm" className="label">
            {t('auth:confirmPassword')}
          </label>
          <input
            id="change-password-confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input-field"
            placeholder={t('auth:passwordPlaceholder')}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={logoutOtherDevices}
            onChange={(e) => setLogoutOtherDevices(e.target.checked)}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-sm text-muted-foreground">{t('auth:logoutOtherDevices')}</span>
        </label>

        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? t('auth:pleaseWait') : t('auth:updatePassword')}
        </button>
      </form>
    </section>
  )
}
