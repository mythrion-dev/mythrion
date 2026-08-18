'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth-context'
import { sendTwoFactorCode, confirmTwoFactor } from '@/lib/two-factor-api'

type Step = 'idle' | 'enter-code' | 'recovery-codes'

/**
 * Security card on the settings page: enable/disable email 2FA. Enabling runs
 * through an emailed OTP confirm and then reveals the one-time recovery codes
 * (returned only at enable time).
 */
export function TwoFactorSettings() {
  const { t } = useTranslation()
  const { user, refreshProfile } = useAuth()
  const enabled = user?.twoFactorEnabled ?? false

  const [step, setStep] = useState<Step>('idle')
  const [purpose, setPurpose] = useState<'ENABLE' | 'DISABLE' | null>(null)
  const [twoFactorId, setTwoFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [copied, setCopied] = useState(false)

  function resetToIdle(nextSuccess: string | null = null) {
    setStep('idle')
    setPurpose(null)
    setTwoFactorId(null)
    setCode('')
    setError(null)
    setSuccess(nextSuccess)
    setRecoveryCodes(null)
    setCopied(false)
  }

  async function handleStart(p: 'ENABLE' | 'DISABLE') {
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    try {
      const { twoFactorId: id } = await sendTwoFactorCode(p)
      setPurpose(p)
      setTwoFactorId(id)
      setStep('enter-code')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth:somethingWentWrong'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirm() {
    if (!purpose || !twoFactorId || code.length < 6 || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      if (purpose === 'ENABLE') {
        const { recoveryCodes: codes } = await confirmTwoFactor('ENABLE', twoFactorId, code)
        setRecoveryCodes(codes)
        setStep('recovery-codes')
        setCode('')
      } else {
        await confirmTwoFactor('DISABLE', twoFactorId, code)
        await refreshProfile()
        resetToIdle(t('auth:twoFactorDisabled'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth:somethingWentWrong'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSavedCodes() {
    setSubmitting(true)
    try {
      await refreshProfile()
      resetToIdle(t('auth:twoFactorSetupComplete'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth:somethingWentWrong'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopy() {
    if (!recoveryCodes) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(recoveryCodes.join('\n'))
      }
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const statusBadge = enabled ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10">
      {t('auth:twoFactorEnabled')}
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border text-muted border-border bg-surface">
      {t('auth:twoFactorDisabled')}
    </span>
  )

  return (
    <section className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-surface border border-border">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t('common:security')}</h2>
        </div>
        {statusBadge}
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

      {step === 'enter-code' && (
        <div className="space-y-3">
          <div>
            <label htmlFor="two-factor-settings-code" className="label">{t('auth:enterCode')}</label>
            <input
              id="two-factor-settings-code"
              type="text"
              required
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              minLength={6}
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="input-field text-center text-lg tracking-[0.3em]"
              placeholder={t('auth:twoFactorCodePlaceholder')}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || code.length < 6}
              className="btn-primary flex-1"
            >
              {submitting ? t('auth:pleaseWait') : t('common:confirm')}
            </button>
            <button type="button" onClick={() => resetToIdle()} disabled={submitting} className="btn-ghost">
              {t('common:cancel')}
            </button>
          </div>
        </div>
      )}

      {step === 'recovery-codes' && recoveryCodes && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">{t('auth:recoveryCodesTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('auth:recoveryCodesHint')}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {recoveryCodes.map((c) => (
              <code
                key={c}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-mono text-center text-foreground select-all"
              >
                {c}
              </code>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={handleCopy} className="btn-ghost w-full">
              {copied ? t('auth:recoveryCodesCopied') : t('common:copy')}
            </button>
            <button
              type="button"
              onClick={handleSavedCodes}
              disabled={submitting}
              className="btn-primary w-full"
            >
              {submitting ? t('auth:pleaseWait') : t('auth:recoveryCodesSaved')}
            </button>
          </div>
        </div>
      )}

      {step === 'idle' && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {enabled ? t('auth:twoFactorEnabled') : t('auth:twoFactorDisabled')}
          </p>
          {enabled ? (
            <button
              type="button"
              onClick={() => handleStart('DISABLE')}
              disabled={submitting}
              className="btn-danger"
            >
              {t('auth:disableTwoFactor')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleStart('ENABLE')}
              disabled={submitting}
              className="btn-primary"
            >
              {t('auth:enableTwoFactor')}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
