'use client'

import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import { fetchPlans, type Plan } from '@/lib/subscription-api'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export default function PricingPage() {
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
            mpPlanId: '',
          },
          {
            id: 'annual',
            slug: 'annual',
            name: 'Plano Anual',
            description:
              'Acesso completo à plataforma Mythrion com o melhor custo-benefício (equivalente a R$100/mês).',
            price: 120000,
            mpPlanId: '',
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
        <div className="text-sm text-muted-foreground">Loading...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background bg-pattern text-foreground">
      {/* Header */}
      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface shadow-[0_0_25px_rgba(201,164,75,0.08)]">
              <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4-6.2-4.5h7.6L12 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gradient">Mythrion</p>
              <p className="text-[0.65rem] uppercase tracking-[0.25em] text-muted">RPG engine</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard" className="text-sm text-muted hover:text-foreground transition-colors">
                Dashboard
              </Link>
            ) : (
              <Link href="/login?redirect=/pricing" className="text-sm text-muted hover:text-foreground transition-colors">
                Sign in
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
              Choose your plan
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Unlock the full <span className="text-gradient">Mythrion</span> experience
            </h1>
            <p className="mt-4 text-base text-muted-foreground max-w-lg mx-auto">
              Pick the plan that fits your table. Cancel anytime.
            </p>
          </div>
        </div>

        {/* Plan cards */}
        <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-3">

            {/* Free tier — always shown */}
            <div className="flex flex-col rounded-2xl border border-border bg-surface p-8 transition-shadow hover:shadow-lg">
              <h2 className="text-lg font-semibold">Free</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Get started with the essentials — no payment needed.
              </p>

              <div className="mt-6">
                <span className="text-3xl font-bold">R$ 0</span>
                <span className="ml-2 text-sm text-muted-foreground">/forever</span>
              </div>

              <ul className="mt-6 space-y-2 text-sm flex-1">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Browse public campaigns
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Browse &amp; clone public templates
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Create character sheets
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Request access to campaigns
                </li>
              </ul>

              <div className="mt-8">
                {!user ? (
                  <Link
                    href="/login?redirect=/pricing"
                    className="block w-full rounded-lg border border-border bg-surface hover:bg-background px-5 py-2.5 text-center text-sm font-medium text-foreground transition-colors"
                  >
                    Get Started — Sign up
                  </Link>
                ) : !hasActiveSubscription ? (
                  <button
                    disabled
                    className="w-full rounded-lg border border-border bg-surface/50 px-5 py-2.5 text-sm font-medium text-muted cursor-default"
                  >
                    Current Plan
                  </button>
                ) : (
                  <Link
                    href="/dashboard"
                    className="block w-full rounded-lg border border-border bg-surface hover:bg-background px-5 py-2.5 text-center text-sm font-medium text-foreground transition-colors"
                  >
                    Dashboard
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

              let cta: { label: string; href: string } | null = null
              if (!user) {
                cta = { label: 'Assinar', href: `/login?redirect=/pricing` }
              } else if (isSubscribed && hasActiveSubscription) {
                cta = { label: 'Current plan', href: '/dashboard' }
              } else if (isCancelledOrExpired && isSubscribed) {
                cta = { label: 'Renew', href: `/subscription/checkout?planId=${plan.id}` }
              } else {
                cta = { label: 'Assinar', href: `/subscription/checkout?planId=${plan.id}` }
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
                      Best value
                    </div>
                  )}

                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>

                  <div className="mt-6">
                    <span className="text-3xl font-bold">{formatPrice(plan.price)}</span>
                    {isAnnual ? (
                      <span className="ml-2 text-sm text-muted-foreground">
                        /year ({formatPrice(pricePerMonth)}/mês)
                      </span>
                    ) : (
                      <span className="ml-2 text-sm text-muted-foreground">/month</span>
                    )}
                  </div>

                  {isAnnual && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Save ~16% compared to the monthly plan
                    </p>
                  )}

                  <ul className="mt-6 space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Full platform access
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Unlimited campaigns
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Priority support
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Cancel anytime
                    </li>
                  </ul>

                  {cta && (
                    <div className="mt-8">
                      {cta.label === 'Current plan' ? (
                        <button
                          disabled
                          className="w-full rounded-lg border border-border bg-surface/50 px-5 py-2.5 text-sm font-medium text-muted cursor-default"
                        >
                          {cta.label}
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
                          {cta.label}
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
