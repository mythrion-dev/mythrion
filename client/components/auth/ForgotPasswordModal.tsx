'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { forgotPassword } from '@/lib/auth-api'

interface ForgotPasswordModalProps {
  open: boolean
  initialEmail: string
  onClose: () => void
}

export function ForgotPasswordModal({
  open,
  initialEmail,
  onClose,
}: Readonly<ForgotPasswordModalProps>) {
  const { t } = useTranslation()
  const [email, setEmail] = useState(initialEmail)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state every time the modal opens so a previous submission never
  // leaks into the next session.
  useEffect(() => {
    if (open) {
      setEmail(initialEmail)
      setSent(false)
      setError(null)
      setSubmitting(false)
    }
  }, [open, initialEmail])

  if (!open) return null

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      // The endpoint always answers success (no user enumeration), so the UI
      // always lands on the confirmation state.
      await forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth:somethingWentWrong'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/50" />
      <div className="card !p-6 max-w-sm w-full space-y-4 border-border/20 relative z-10">
        {sent ? (
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success-muted flex items-center justify-center">
                <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold">{t('auth:forgotPasswordTitle')}</h2>
                <p className="text-sm text-muted-foreground">
                  {t('auth:forgotPasswordSent')}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="btn-primary">
                {t('common:close')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-muted flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold">{t('auth:forgotPasswordTitle')}</h2>
                <p className="text-sm text-muted-foreground">
                  {t('auth:forgotPasswordDescription')}
                </p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="forgot-password-email" className="label">
                  {t('auth:email')}
                </label>
                <input
                  id="forgot-password-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder={t('auth:emailPlaceholder')}
                />
              </div>
              {error && (
                <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
                  {error}
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="btn-ghost"
                >
                  {t('common:cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? t('auth:pleaseWait') : t('auth:sendResetLink')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
