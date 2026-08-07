'use client'

import { useTranslation } from 'react-i18next'
import Link from 'next/link'

export default function TermsPage() {
  const { t } = useTranslation()
  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-muted">{t('legal:termsTitle')}</p>
            <h1 className="mt-3 text-3xl font-semibold text-foreground">{t('legal:termsTitle')}</h1>
          </div>
          <Link href="/" className="text-sm text-primary hover:text-primary-hover">
            {t('common:goHome')}
          </Link>
        </div>

        <div className="space-y-6 rounded-3xl border border-border bg-surface p-8 shadow-sm">
          <p className="text-sm leading-7 text-muted-foreground">
            {t('legal:termsIntro')}
          </p>
          <div className="space-y-4 text-sm leading-7 text-muted-foreground">
            <p>{t('legal:termsSubscription')}</p>
            <p>{t('legal:termsUserConduct')}</p>
            <p>{t('legal:termsTermination')}</p>
            <p>{t('legal:termsContact')}</p>
          </div>
        </div>
      </div>
    </main>
  )
}
