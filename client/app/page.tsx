'use client'

import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchPlans, type Plan } from '@/lib/subscription-api'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'

function formatPrice(cents: number, language: string): string {
  return (cents / 100).toLocaleString(language === 'pt-BR' ? 'pt-BR' : 'en-US', {
    style: 'currency',
    currency: 'BRL',
  })
}

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const [plans, setPlans] = useState<Plan[]>([])
  const [featurePage, setFeaturePage] = useState(0)
  const features = [
    { label: t('landing:available'), title: t('landing:featureCampaigns'), description: t('landing:featureCampaignsDescription') },
    { label: t('landing:available'), title: t('landing:featureSheets'), description: t('landing:featureSheetsDescription') },
    { label: t('landing:available'), title: t('landing:featureTemplates'), description: t('landing:featureTemplatesDescription') },
    { label: t('landing:comingSoon'), title: t('landing:featureNewSheets'), description: t('landing:featureNewSheetsDescription') },
    { label: t('landing:comingSoon'), title: t('landing:featureMaps'), description: t('landing:featureMapsDescription') },
    { label: t('landing:comingSoon'), title: t('landing:featureDice'), description: t('landing:featureDiceDescription') },
  ]
  const visibleFeatures = features.slice(featurePage * 3, featurePage * 3 + 3)

  useEffect(() => {
    fetchPlans()
      .then(setPlans)
      .catch(() => setPlans([
        { id: 'monthly', slug: 'monthly', name: 'Plano Mensal', description: 'Acesso completo à plataforma Mythrion com renovação mensal.', price: 12000, pgPlanId: '' },
        { id: 'annual', slug: 'annual', name: 'Plano Anual', description: 'Acesso completo à plataforma Mythrion com o melhor custo-benefício.', price: 120000, pgPlanId: '' },
      ]))
  }, [])

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard')
    }
  }, [loading, user, router])

  if (loading || user) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">{t('landing:loading')}</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background bg-pattern text-foreground">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="Mythrion logo" width={912} height={703} className="h-11 w-auto sm:h-12" priority />
            <span className="text-[0.65rem] uppercase tracking-[0.25em] text-muted">{t('landing:brandTagline')}</span>
          </Link>
          <nav className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link href="#features" className="hidden text-sm text-muted hover:text-foreground sm:inline-flex">{t('landing:navFeatures')}</Link>
            <Link href="/pricing" className="hidden text-sm text-muted hover:text-foreground sm:inline-flex">{t('landing:navPricing')}</Link>
            <Link href="/login?redirect=/dashboard" className="text-sm text-muted hover:text-foreground">{t('landing:signIn')}</Link>
            <Link href="/login?redirect=/dashboard" className="btn-primary px-5 py-2.5 text-sm">{t('landing:startCampaign')}</Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,_rgba(201,164,75,0.14),_transparent_65%)]" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-28">
          <div className="relative z-10 max-w-2xl animate-slide-up">
            <div className="mb-5 inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.25em] text-primary">{t('landing:eyebrow')}</div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">{t('landing:heroTitle')} <span className="text-gradient">{t('landing:heroHighlight')}</span></h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">{t('landing:heroDescription')}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login?redirect=/dashboard" className="btn-primary px-7 py-3 text-base">{t('landing:createCampaign')}</Link>
              <Link href="#features" className="btn-ghost px-7 py-3 text-base">{t('landing:explorePlatform')}</Link>
            </div>
            <p className="mt-6 text-sm leading-6 text-muted-foreground">{t('landing:heroNote')}</p>
          </div>
          <div className="relative z-10">
            <div className="overflow-hidden rounded-2xl border border-border-bright bg-surface shadow-[0_18px_56px_rgba(109,62,255,0.19)]">
              <div className="flex min-h-[410px]">
                <aside className="hidden w-14 shrink-0 flex-col items-center gap-6 border-r border-border bg-background py-5 sm:flex" aria-label="Dashboard preview navigation">
                  <span className="text-xl font-bold text-primary">◇</span>
                  <span className="text-primary" aria-hidden="true">◈</span>
                  <span className="text-muted" aria-hidden="true">▤</span>
                  <span className="text-muted" aria-hidden="true">▥</span>
                  <span className="text-muted" aria-hidden="true">⌖</span>
                  <span className="text-muted" aria-hidden="true">⚙</span>
                </aside>
                <div className="min-w-0 flex-1 bg-background p-5 sm:p-7">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-xl font-bold text-primary sm:text-2xl">{t('landing:dashboardTitle')}</p><p className="mt-1 text-xs text-muted-foreground sm:text-sm">{t('landing:dashboardSubtitle')}</p></div>
                    <button type="button" className="btn-primary shrink-0 px-3 py-2 text-xs sm:px-4">+ {t('landing:newCampaign')}</button>
                  </div>
                  <div className="my-5 h-px bg-primary/30" />
                  <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-xl border border-border-bright bg-surface-raised p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-2"><p className="text-base font-bold text-foreground sm:text-lg">{t('landing:campaignName')}</p><span className="text-[0.55rem] font-bold tracking-[0.12em] text-primary sm:text-[0.65rem]">{t('landing:campaignSystem')}</span></div>
                      <p className="mt-4 text-xs leading-6 text-muted-foreground sm:text-sm">{t('landing:campaignDescription')}</p>
                      <div className="my-4 h-px bg-border-bright" />
                      <p className="text-[0.65rem] text-muted sm:text-xs">▣ {t('landing:campaignMeta')}</p>
                    </div>
                    <div className="rounded-xl border border-border-bright bg-background/70 p-4 sm:p-5">
                      <p className="text-[0.65rem] font-bold tracking-[0.15em] text-primary">{t('landing:continueStory')}</p>
                      <p className="mt-4 text-lg font-bold text-foreground sm:text-xl">{t('landing:characterName')}</p>
                      <p className="mt-2 text-xs text-muted sm:text-sm">{t('landing:characterStats')}</p>
                      <div className="mt-5 h-2 overflow-hidden rounded-full bg-border-bright"><div className="h-full w-4/5 rounded-full bg-primary" /></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-10 text-center sm:grid-cols-3 sm:px-6 lg:px-8">
          <div><p className="text-2xl text-primary">{t('landing:statsPlatform')}</p><p className="text-sm text-muted">{t('landing:statsPlatformLabel')}</p></div>
          <div><p className="text-2xl text-primary">{t('landing:statsFocus')}</p><p className="text-sm text-muted">{t('landing:statsFocusLabel')}</p></div>
          <div><p className="text-2xl text-primary">{t('landing:statsGrowth')}</p><p className="text-sm text-muted">{t('landing:statsGrowthLabel')}</p></div>
        </div>
      </section>

      <section id="features" className="border-y border-border/60 bg-surface/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center"><div className="mb-5 inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.25em] text-primary">{t('landing:featuresEyebrow')}</div><h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t('landing:featuresTitle')}</h2><p className="mt-4 text-base leading-7 text-muted-foreground">{t('landing:featuresDescription')}</p></div>
          <div key={featurePage} className="mt-12 grid gap-4 animate-fade-in md:grid-cols-3">{visibleFeatures.map((feature, index) => <article key={feature.title} className="card animate-slide-up border-border/60 transition-transform duration-300 hover:-translate-y-1" style={{ animationDelay: `${index * 90}ms` }}><span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary">{feature.label}</span><h3 className="mt-4 text-lg font-semibold text-foreground">{feature.title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{feature.description}</p></article>)}</div>
          <div className="mt-8 flex items-center justify-center gap-4 animate-fade-in"><button type="button" aria-label={t('landing:featurePrevious')} title={t('landing:featurePrevious')} onClick={() => setFeaturePage(0)} disabled={featurePage === 0} className="btn-ghost h-9 w-9 p-0 transition-transform duration-200 hover:-translate-x-1 disabled:opacity-40">&lt;</button><span className="text-xs uppercase tracking-[0.2em] text-muted">{t('landing:featurePage', { page: featurePage + 1 })}</span><button type="button" aria-label={t('landing:featureNext')} title={t('landing:featureNext')} onClick={() => setFeaturePage(1)} disabled={featurePage === 1} className="btn-ghost h-9 w-9 p-0 transition-transform duration-200 hover:translate-x-1 disabled:opacity-40">&gt;</button></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
          <div className="animate-slide-up">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{t('landing:characterEyebrow')}</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">{t('landing:characterTitle')}</h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">{t('landing:characterDescription')}</p>
            <Link href="/login?redirect=/dashboard/character-sheets" className="btn-ghost mt-7 px-6 py-3">{t('landing:characterCta')}</Link>
          </div>
          <div className="animate-fade-in overflow-hidden rounded-xl border border-border-bright bg-surface shadow-[0_18px_56px_rgba(109,62,255,0.14)]" style={{ animationDelay: '120ms' }}>
            <div className="flex min-h-[360px]">
              <div className="hidden w-12 shrink-0 flex-col items-center gap-5 border-r border-border bg-background py-5 sm:flex"><span className="text-lg text-primary">◇</span><span className="text-muted">□</span><span className="text-muted">□</span><span className="text-muted">□</span><span className="text-muted">□</span></div>
              <div className="min-w-0 flex-1 bg-background p-5 sm:p-6">
                <p className="text-xl font-bold text-primary">{t('landing:characterPageTitle')}</p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{t('landing:characterPageSubtitle')}</p>
                <div className="my-4 h-px bg-primary/30" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-surface-raised p-4"><p className="text-xs font-bold text-foreground">{t('landing:characterInfoTitle')}</p><div className="mt-3 space-y-2 text-xs text-muted-foreground"><p className="rounded bg-background p-2">{t('landing:characterClass')}</p><p className="rounded bg-background p-2">{t('landing:characterLevel')}</p><p className="rounded bg-background p-2">{t('landing:characterNation')}</p><p className="rounded bg-background p-2">{t('landing:characterOrigin')}</p></div></div>
                  <div className="rounded-lg bg-surface-raised p-4"><p className="text-xs font-bold text-foreground">{t('landing:hitPoints')}</p><p className="mt-3 text-2xl font-bold text-foreground">18 / 18</p><div className="mt-3 h-2 rounded-full bg-danger"><div className="h-full w-full rounded-full bg-danger" /></div><p className="mt-5 text-xs font-bold text-foreground">{t('landing:effort')}</p><p className="mt-2 text-2xl font-bold text-primary">6 / 7</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-surface/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14">
            <div className="order-2 animate-fade-in lg:order-1" style={{ animationDelay: '180ms' }}>
              <div className="overflow-hidden rounded-xl border border-border-bright bg-surface shadow-[0_18px_56px_rgba(109,62,255,0.14)]">
                <div className="flex min-h-[360px]">
                  <div className="hidden w-12 shrink-0 flex-col items-center gap-5 border-r border-border bg-background py-5 sm:flex"><span className="text-lg text-primary">◇</span><span className="text-muted">□</span><span className="text-muted">□</span><span className="text-muted">□</span><span className="text-muted">□</span></div>
                  <div className="min-w-0 flex-1 bg-background p-5 sm:p-6"><p className="text-xl font-bold text-primary">{t('landing:templatesPageTitle')}</p><p className="mt-1 text-xs text-muted-foreground sm:text-sm">{t('landing:templatesPageSubtitle')}</p><div className="my-4 h-px bg-primary/30" /><div className="grid gap-3 sm:grid-cols-2">
                    {[['templateOne', 'templateOneMeta'], ['templateTwo', 'templateTwoMeta']].map(([titleKey, metaKey]) => <div key={titleKey} className="rounded-lg border border-border-bright bg-surface-raised p-4 transition-transform duration-300 hover:-translate-y-1"><p className="text-base font-bold text-foreground">{t(`landing:${titleKey}`)}</p><p className="mt-2 text-xs italic text-muted">{t('landing:templateDescription')}</p><p className="mt-4 text-[0.6rem] font-bold tracking-[0.12em] text-accent">{t(`landing:${metaKey}`)}</p><div className="mt-4 flex gap-2"><button type="button" className="btn-ghost px-3 py-2 text-xs">{t('landing:viewTemplate')}</button><button type="button" className="btn-primary px-3 py-2 text-xs">{t('landing:cloneTemplate')}</button></div></div>)}
                  </div></div>
                </div>
              </div>
            </div>
            <div className="order-1 animate-slide-up lg:order-2"><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{t('landing:templatesEyebrow')}</p><h2 className="mt-4 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">{t('landing:templatesTitle')}</h2><p className="mt-5 text-base leading-7 text-muted-foreground">{t('landing:templatesDescription')}</p><Link href="/login?redirect=/dashboard/public-templates" className="btn-ghost mt-7 px-6 py-3">{t('landing:templatesCta')}</Link></div>
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8"><div className="mx-auto max-w-2xl text-center"><div className="mb-5 inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.25em] text-primary">{t('landing:pricingEyebrow')}</div><h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t('landing:pricingTitle')}</h2><p className="mt-4 text-base text-muted-foreground">{t('landing:pricingDescription')}</p></div><div className="mt-12 grid gap-5 md:grid-cols-3">
        <div className="card flex flex-col"><h3 className="text-lg font-semibold">{t('landing:free')}</h3><p className="mt-2 text-sm text-muted-foreground">{t('landing:freeDescription')}</p><p className="mt-6 text-3xl font-bold">{formatPrice(0, i18n.resolvedLanguage ?? 'en')}</p><span className="mt-1 text-sm text-muted-foreground">{t('landing:forever')}</span><ul className="mt-6 flex-1 space-y-3 text-sm text-muted-foreground"><li>{t('billing:browsePublicCampaigns')}</li><li>{t('billing:browseClonePublicTemplates')}</li><li>{t('billing:createCharacterSheets')}</li><li>{t('billing:requestCampaignAccess')}</li></ul><Link href="/login?redirect=/pricing" className="btn-ghost mt-8 w-full">{t('landing:startFree')}</Link></div>
        {plans.map((plan) => { const annual = plan.slug === 'annual'; return <div key={plan.id} className={`card relative flex flex-col ${annual ? 'border-primary/50 shadow-[0_0_30px_rgba(201,164,75,0.12)]' : ''}`}>{annual && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-primary">{t('landing:bestValue')}</span>}<h3 className="text-lg font-semibold">{plan.name}</h3><p className="mt-2 text-sm text-muted-foreground">{plan.description}</p><p className="mt-6 text-3xl font-bold">{formatPrice(plan.price, i18n.resolvedLanguage ?? 'en')}</p><p className="mt-1 text-sm text-muted-foreground">{annual ? t('landing:perYear') : t('landing:perMonth')}</p><ul className="mt-6 flex-1 space-y-3 text-sm text-muted-foreground"><li>{t('landing:fullAccess')}</li><li>{t('landing:unlimitedCampaigns')}</li><li>{t('landing:prioritySupport')}</li></ul><Link href="/login?redirect=/pricing" className="btn-primary mt-8 w-full">{t('landing:subscribe')}</Link></div> })}
      </div></section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24"><div className="card border-primary/20 bg-gradient-to-br from-background/70 via-surface/40 to-background/60"><div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-2xl"><p className="text-xs uppercase tracking-[0.25em] text-muted">{t('landing:ctaEyebrow')}</p><h2 className="mt-2 text-2xl font-semibold text-gradient">{t('landing:ctaTitle')}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{t('landing:ctaDescription')}</p></div><div className="flex flex-col gap-3 sm:flex-row"><Link href="/login?redirect=/dashboard" className="btn-primary px-6 py-3">{t('landing:startMyCampaign')}</Link><Link href="/login?redirect=/dashboard" className="btn-ghost px-6 py-3">{t('landing:signIn')}</Link></div></div></div></section>

      <footer className="border-t border-border/60 bg-background/60"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3 px-4 py-6 text-sm text-muted sm:px-6 lg:px-8"><Link href="/privacy" className="hover:text-foreground">{t('landing:privacy')}</Link><span>·</span><Link href="/terms" className="hover:text-foreground">{t('landing:terms')}</Link><span>·</span><Link href="/cancel-terms" className="hover:text-foreground">{t('landing:cancellation')}</Link><span>·</span><a href="https://instagram.com/mythrion.app" target="_blank" rel="noreferrer" className="hover:text-foreground">{t('landing:instagram')}</a></div></footer>
    </main>
  )
}
