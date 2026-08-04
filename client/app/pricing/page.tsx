'use client'

import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import { fetchPlans, type Plan } from '@/lib/subscription-api'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export default function PricingPage() {
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const { subscription, loading: subLoading, hasActiveSubscription } = useSubscription()
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)

  useEffect(() => {
    fetchPlans()
      .then(setPlans)
      .catch(() => {
        // Fallback plans if API unreachable (e.g., during development)
        setPlans([
          {
            id: 'monthly',
            slug: 'monthly',
            name: 'Plano Mensal',
            description: 'Acesso completo à plataforma Mythrion com renovação mensal.',
            price: 12000,
            pgPlanId: '',
          },
          {
            id: 'annual',
            slug: 'annual',
            name: 'Plano Anual',
            description:
              'Acesso completo à plataforma Mythrion com o melhor custo-benefício (equivalente a R$100/mês).',
            price: 120000,
            pgPlanId: '',
          },
        ])
      })
      .finally(() => setPlansLoading(false))
  }, [])

  // If user has active subscription, redirect to dashboard
  useEffect(() => {
    if (!authLoading && !subLoading && hasActiveSubscription) {
      router.replace('/dashboard')
    }
  }, [authLoading, subLoading, hasActiveSubscription, router])

  const isLoading = authLoading || plansLoading || subLoading

  // Show nothing while checking auth/subscription, to avoid flash
  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background bg-pattern">
        <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background bg-pattern text-foreground">
      {/* Header */}
      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Mythrion logo"
              width={912}
              height={703}
              className="h-11 w-auto sm:h-12"
              priority
            />
            <div>
              {/* <p className="text-sm font-semibold text-gradient">{t('common:appName')}</p> */}
              <p className="text-[0.65rem] uppercase tracking-[0.25em] text-muted">{t('billing:rpgEngine')}</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {user ? (
              <Link href="/dashboard" className="text-sm text-muted hover:text-foreground transition-colors">
                {t('common:dashboard')}
              </Link>
            ) : (
              <Link href="/login?redirect=/pricing" className="text-sm text-muted hover:text-foreground transition-colors">
                {t('billing:signIn')}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(circle_at_top,_rgba(201,164,75,0.14),_transparent_65%)]" />
        <div className="mx-auto max-w-7xl px-4 pt-16 pb-8 text-center sm:px-6 lg:px-8">
          <div className="relative z-10">
            <div className="mb-5 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.25em] text-primary">
              {t('billing:choosePlan')}
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t('billing:unlockExperience1')} <span className="text-gradient">{t('common:appName')}</span>{t('billing:unlockExperience2')}
            </h1>
            <p className="mt-4 text-base text-muted-foreground max-w-lg mx-auto">
              {t('billing:planTagline')}
            </p>
          </div>
        </div>

        {/* Plan cards */}
        <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-3">

            {/* Free tier — always shown */}
            <div className="flex flex-col rounded-2xl border border-border bg-surface p-8 transition-shadow hover:shadow-lg">
              <h2 className="text-lg font-semibold">{t('common:free')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('billing:freeTierDescription')}
              </p>

              <div className="mt-6">
                <span className="text-3xl font-bold">R$ 0</span>
                <span className="ml-2 text-sm text-muted-foreground">{t('billing:periodForever')}</span>
              </div>

              <ul className="mt-6 space-y-2 text-sm flex-1">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {t('billing:browsePublicCampaigns')}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {t('billing:browseClonePublicTemplates')}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {t('billing:createCharacterSheets')}
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {t('billing:requestCampaignAccess')}
                </li>
              </ul>

              <div className="mt-8">
                {!user ? (
                  <Link
                    href="/login?redirect=/pricing"
                    className="block w-full rounded-lg border border-border bg-surface hover:bg-background px-5 py-2.5 text-center text-sm font-medium text-foreground transition-colors"
                  >
                    {t('billing:getStartedSignUp')}
                  </Link>
                ) : !hasActiveSubscription ? (
                  <button
                    disabled
                    className="w-full rounded-lg border border-border bg-surface/50 px-5 py-2.5 text-sm font-medium text-muted cursor-default"
                  >
                    {t('billing:currentPlan')}
                  </button>
                ) : (
                  <Link
                    href="/dashboard"
                    className="block w-full rounded-lg border border-border bg-surface hover:bg-background px-5 py-2.5 text-center text-sm font-medium text-foreground transition-colors"
                  >
                    {t('common:dashboard')}
                  </Link>
                )}
              </div>
            </div>

            {plans.map((plan) => {
              const isAnnual = plan.slug === 'annual'
              const pricePerMonth = isAnnual ? Math.round(plan.price / 12) : plan.price
              const isSubscribed = subscription?.plan.slug === plan.slug
              const isCancelledOrExpired =
                subscription &&
                (subscription.status === 'CANCELLED' || subscription.status === 'EXPIRED')

              let cta: { labelKey: string; href: string } | null = null
              if (!user) {
                cta = { labelKey: 'billing:subscribe', href: `/login?redirect=/pricing` }
              } else if (isSubscribed && hasActiveSubscription) {
                cta = { labelKey: 'billing:currentPlan', href: '/dashboard' }
              } else if (isCancelledOrExpired && isSubscribed) {
                cta = { labelKey: 'billing:renew', href: `/subscription/checkout?planId=${plan.id}` }
              } else {
                cta = { labelKey: 'billing:subscribe', href: `/subscription/checkout?planId=${plan.id}` }
              }

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border p-8 transition-shadow hover:shadow-lg ${
                    isAnnual
                      ? 'border-primary/40 bg-gradient-to-b from-primary/5 to-transparent shadow-md'
                      : 'border-border bg-surface'
                  }`}
                >
                  {isAnnual && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full border border-primary/30 bg-primary/15 px-4 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary">
                      {t('billing:bestValue')}
                    </div>
                  )}

                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>

                  <div className="mt-6">
                    <span className="text-3xl font-bold">{formatPrice(plan.price)}</span>
                    {isAnnual ? (
                      <span className="ml-2 text-sm text-muted-foreground">
                        {t('billing:annualPriceSuffix', { price: formatPrice(pricePerMonth) })}
                      </span>
                    ) : (
                      <span className="ml-2 text-sm text-muted-foreground">{t('billing:periodMonth')}</span>
                    )}
                  </div>

                  {isAnnual && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('billing:saveComparedMonthly')}
                    </p>
                  )}

                  <ul className="mt-6 space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {t('billing:fullPlatformAccess')}
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {t('billing:unlimitedCampaigns')}
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {t('billing:prioritySupport')}
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {t('billing:cancelAnytime')}
                    </li>
                  </ul>

                  {cta && (
                    <div className="mt-8">
                      {cta.labelKey === 'billing:currentPlan' ? (
                        <button
                          disabled
                          className="w-full rounded-lg border border-border bg-surface/50 px-5 py-2.5 text-sm font-medium text-muted cursor-default"
                        >
                          {t(cta.labelKey)}
                        </button>
                      ) : (
                        <Link
                          href={cta.href}
                          className={`block w-full rounded-lg px-5 py-2.5 text-center text-sm font-medium transition-colors ${
                            isAnnual
                              ? 'btn-primary'
                              : 'border border-border bg-surface hover:bg-background text-foreground'
                          }`}
                        >
                          {t(cta.labelKey)}
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </main>
  )
}
