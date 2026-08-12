'use client'

import { useTranslation } from 'react-i18next'
import Link from 'next/link'

export default function CancelTermsPage() {
  const { t } = useTranslation()
  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-muted">{t('legal:cancelTermsTitle')}</p>
            <h1 className="mt-3 text-3xl font-semibold text-foreground">{t('legal:cancelTermsTitle')}</h1>
          </div>
          <Link href="/" className="text-sm text-primary hover:text-primary-hover">
            {t('common:goHome')}
          </Link>
        </div>

        <div className="space-y-6 rounded-3xl border border-border bg-surface p-8 shadow-sm">
          <p className="text-sm leading-7 text-muted-foreground">
            {t('legal:cancelTermsIntro')}
          </p>
          <div className="space-y-4 text-sm leading-7 text-muted-foreground">
            <p>{t('legal:cancelTermsEffect')}</p>
            <p>{t('legal:cancelTermsAccess')}</p>
            <p>{t('legal:cancelTermsCharges')}</p>
            <p>{t('legal:cancelTermsHowToCancel')}</p>
            <p>{t('legal:cancelTermsAfterCancellation')}</p>
            <p>{t('legal:cancelTermsContact')}</p>
          </div>
        </div>
      </div>
    </main>
  )
}
