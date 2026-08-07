'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const RESEND_COOLDOWN_SECONDS = 30

interface TwoFactorCodeFormProps {
  emailMasked: string
  onVerify: (code: string) => Promise<void>
  onResend: () => Promise<void>
  onBack: () => void
}

/**
 * The email-OTP step shown after a password login when the account has 2FA
 * enabled. Accepts a 6-digit code or a 10-character recovery code. Callers own
 * navigation after a successful verify (via onVerify resolving).
 */
export function TwoFactorCodeForm({
  emailMasked,
  onVerify,
  onResend,
  onBack,
}: Readonly<TwoFactorCodeFormProps>) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Countdown for the resend link: one timeout per tick, rescheduled each
  // second until the cooldown reaches zero.
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (code.length < 6 || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await onVerify(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth:invalidCode'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || submitting) return
    setError(null)
    try {
      await onResend()
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth:somethingWentWrong'))
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <p className="mt-1 text-sm text-muted-foreground">{t('auth:twoFactorTitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="card !p-6 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {t('auth:twoFactorSubtitle', { email: emailMasked })}
          </p>
          <input
            id="two-factor-code"
            type="text"
            required
            autoFocus
            autoComplete="one-time-code"
            autoCapitalize="characters"
            autoCorrect="off"
            inputMode="text"
            minLength={6}
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
            className="input-field mt-3 text-center text-lg tracking-[0.3em]"
            placeholder={t('auth:twoFactorCodePlaceholder')}
          />
        </div>

        {error && (
          <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || code.length < 6}
          className="btn-primary w-full"
        >
          {submitting ? t('auth:pleaseWait') : t('auth:verifyButton')}
        </button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || submitting}
            className="font-medium text-primary hover:text-primary-hover transition-colors disabled:text-muted disabled:cursor-not-allowed"
          >
            {resendCooldown > 0
              ? t('auth:resendCooldown', { count: resendCooldown })
              : t('auth:resendCode')}
          </button>
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="text-muted hover:text-foreground transition-colors"
          >
            {t('auth:backToSignIn')}
          </button>
        </div>
      </form>
    </div>
  )
}
