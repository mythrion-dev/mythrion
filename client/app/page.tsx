'use client'

import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { t } = useTranslation()

  const featureHighlights = [
    {
      title: t('dashboard:featureCreateYourWorld'),
      description: t('dashboard:featureCreateYourWorldDescription'),
    },
    {
      title: t('dashboard:featureBringStoriesToLife'),
      description: t('dashboard:featureBringStoriesToLifeDescription'),
    },
    {
      title: t('dashboard:featurePlayWithElegance'),
      description: t('dashboard:featurePlayWithEleganceDescription'),
    },
  ]

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard')
    }
  }, [loading, user, router])

  if (loading || user) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background bg-pattern text-foreground">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface shadow-[0_0_25px_rgba(201,164,75,0.08)]">
              <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4-6.2-4.5h7.6L12 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gradient">{t('common:appName')}</p>
              <p className="text-[0.65rem] uppercase tracking-[0.25em] text-muted">{t('dashboard:rpgEngine')}</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="#features" className="hidden text-sm text-muted transition-colors hover:text-foreground sm:inline-flex">
              {t('dashboard:features')}
            </Link>
            <Link href="/pricing" className="hidden sm:inline-flex text-sm text-muted transition-colors hover:text-foreground">
              {t('dashboard:pricing')}
            </Link>
            <Link href="/login?redirect=/dashboard" className="text-sm text-muted transition-colors hover:text-foreground">
              {t('dashboard:signIn')}
            </Link>
            <Link href="/login?redirect=/pricing" className="btn-primary px-5 py-2.5 text-sm">
              {t('dashboard:beginAdventure')}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,_rgba(201,164,75,0.14),_transparent_65%)]" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-28">
          <div className="relative z-10 max-w-2xl animate-slide-up">
            <div className="mb-5 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.25em] text-primary">
              {t('dashboard:customRPGs')}
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {t('dashboard:heroTitle')}{' '}
              <span className="text-gradient">{t('dashboard:heroTitleHighlight')}</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              {t('dashboard:heroDescription')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login?redirect=/dashboard" className="btn-primary px-7 py-3 text-base">
                {t('dashboard:beginAdventure')}
              </Link>
              <Link href="#features" className="btn-ghost px-7 py-3 text-base">
                {t('dashboard:exploreExperience')}
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-4 text-sm text-muted">
              <span className="rounded-full border border-border/70 bg-background/50 px-3 py-1">{t('dashboard:beautifulByDesign')}</span>
              <span className="rounded-full border border-border/70 bg-background/50 px-3 py-1">{t('dashboard:flexibleForEveryTable')}</span>
              <span className="rounded-full border border-border/70 bg-background/50 px-3 py-1">{t('dashboard:madeForStorytellers')}</span>
            </div>
          </div>

          <div className="relative z-10">
            <div className="card space-y-4 border-primary/20 shadow-[0_0_45px_rgba(201,164,75,0.08)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-muted">{t('dashboard:whatMythrionOffers')}</p>
                  <h2 className="mt-1 text-xl font-semibold text-gradient">{t('dashboard:realmForEveryStory')}</h2>
                </div>
                <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {t('dashboard:liveNow')}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-background/40 p-4">
                  <p className="text-sm font-semibold text-foreground">{t('dashboard:customWorlds')}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('dashboard:customWorldsDescription')}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/40 p-4">
                  <p className="text-sm font-semibold text-foreground">{t('dashboard:immersivePlay')}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('dashboard:immersivePlayDescription')}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/30 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{t('dashboard:nextCampaignStartsHere')}</p>
                  <span className="text-sm font-bold text-primary">01</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t('dashboard:nextCampaignStartsHereDescription')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="card border-border/60">
            <p className="text-xs uppercase tracking-[0.25em] text-muted">{t('dashboard:whyPlayersLoveIt')}</p>
            <h2 className="mt-3 text-2xl font-semibold text-gradient">{t('dashboard:designedForEpicStorytelling')}</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              {t('dashboard:whyPlayersLoveItDescription')}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {featureHighlights.map((feature) => (
              <div key={feature.title} className="card !p-5 border-border/60">
                <h3 className="text-base font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
        <div className="card border-primary/20 bg-gradient-to-br from-background/70 via-surface/40 to-background/60">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.25em] text-muted">{t('dashboard:nextAdventureBeginsNow')}</p>
              <h2 className="mt-2 text-2xl font-semibold text-gradient">{t('dashboard:stepIntoWorldBuiltForImagination')}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {t('dashboard:nextAdventureBeginsNowDescription')}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/login?redirect=/dashboard" className="btn-primary px-6 py-3">
                {t('dashboard:beginAdventure')}
              </Link>
              <Link href="/login?redirect=/dashboard" className="btn-ghost px-6 py-3">
                {t('dashboard:signIn')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-background/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>{t('dashboard:footerTagline')}</p>
          <p>{t('dashboard:footerBuiltForBoldStories')}</p>
        </div>
      </footer>
    </main>
  )
}
