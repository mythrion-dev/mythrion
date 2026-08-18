'use client'

import { useTranslation } from 'react-i18next'
import { passwordChecks, passwordStrengthScore } from '@/lib/password'

const REQUIREMENT_KEYS: Record<string, string> = {
  length: 'auth:passwordRequirementLength',
  lowercase: 'auth:passwordRequirementLowercase',
  uppercase: 'auth:passwordRequirementUppercase',
  digit: 'auth:passwordRequirementDigit',
  special: 'auth:passwordRequirementSpecial',
} as const

function strengthLabel(t: (key: string) => string, score: number): string {
  if (score >= 5) return t('auth:passwordStrengthStrong')
  if (score >= 4) return t('auth:passwordStrengthGood')
  if (score >= 3) return t('auth:passwordStrengthFair')
  return t('auth:passwordStrengthWeak')
}

function strengthBarClass(score: number): string {
  if (score >= 4) return 'bg-success'
  if (score >= 3) return 'bg-primary'
  return 'bg-danger'
}

function strengthTextClass(score: number): string {
  if (score >= 4) return 'text-success'
  if (score >= 3) return 'text-primary'
  return 'text-danger'
}

/**
 * Live password-strength feedback: a checklist of the five policy requirements
 * plus a meter bar. Renders nothing until the field has content.
 */
export function PasswordStrength({ password }: Readonly<{ password: string }>) {
  const { t } = useTranslation()

  if (password.length === 0) return null

  const checks = passwordChecks(password)
  const score = passwordStrengthScore(password)

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${strengthBarClass(score)}`}
            style={{ width: `${(score / 5) * 100}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${strengthTextClass(score)}`}>
          {strengthLabel(t, score)}
        </span>
      </div>
      <ul className="space-y-1">
        {checks.map((check) => (
          <li
            key={check.key}
            className="flex items-center gap-1.5 text-xs"
          >
            {check.met ? (
              <svg className="w-3.5 h-3.5 text-success shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className={check.met ? 'text-muted-foreground' : 'text-muted'}>
              {t(REQUIREMENT_KEYS[check.key])}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
