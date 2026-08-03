'use client'

import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const featureHighlights = [
  {
    title: 'Create your world',
    description: 'Shape custom settings, systems, and rules that feel made for your table.',
  },
  {
    title: 'Bring stories to life',
    description: 'Craft rich characters, abilities, and encounters with an intuitive experience.',
  },
  {
    title: 'Play with elegance',
    description: 'Every screen is designed to feel immersive, polished, and easy to navigate.',
  },
]

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard')
    }
  }, [loading, user, router])

  if (loading || user) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background bg-pattern text-foreground">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface shadow-[0_0_25px_rgba(201,164,75,0.08)]">
              <Image
                src="/logo-icon.png"
                alt="Mythrion logo"
                width={532}
                height={624}
                className="h-8 w-auto"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-gradient">Mythrion</p>
              <p className="text-[0.65rem] uppercase tracking-[0.25em] text-muted">RPG engine</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="#features" className="hidden text-sm text-muted transition-colors hover:text-foreground sm:inline-flex">
              Features
            </Link>
            <Link href="/pricing" className="hidden sm:inline-flex text-sm text-muted transition-colors hover:text-foreground">
              Pricing
            </Link>
            <Link href="/login?redirect=/dashboard" className="text-sm text-muted transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Link href="/login?redirect=/pricing" className="btn-primary px-5 py-2.5 text-sm">
              Begin your adventure
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,_rgba(201,164,75,0.14),_transparent_65%)]" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-28">
          <div className="relative z-10 max-w-2xl animate-slide-up">
            <div className="mb-5 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.25em] text-primary">
              Custom RPGs, crafted with wonder
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Build a world that feels <span className="text-gradient">truly yours</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Mythrion is a powerful engine for creating custom RPGs tailored exactly to the tastes of your players. From immersive visuals to intuitive systems, every detail is designed to make your table feel legendary.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login?redirect=/dashboard" className="btn-primary px-7 py-3 text-base">
                Begin your adventure
              </Link>
              <Link href="#features" className="btn-ghost px-7 py-3 text-base">
                Explore the experience
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-4 text-sm text-muted">
              <span className="rounded-full border border-border/70 bg-background/50 px-3 py-1">Beautiful by design</span>
              <span className="rounded-full border border-border/70 bg-background/50 px-3 py-1">Flexible for every table</span>
              <span className="rounded-full border border-border/70 bg-background/50 px-3 py-1">Made for storytellers</span>
            </div>
          </div>

          <div className="relative z-10">
            <div className="card space-y-4 border-primary/20 shadow-[0_0_45px_rgba(201,164,75,0.08)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-muted">What Mythrion offers</p>
                  <h2 className="mt-1 text-xl font-semibold text-gradient">A realm for every story</h2>
                </div>
                <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  Live now
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-background/40 p-4">
                  <p className="text-sm font-semibold text-foreground">Custom worlds</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">Craft systems, rules, and encounters that fit your vision perfectly.</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/40 p-4">
                  <p className="text-sm font-semibold text-foreground">Immersive play</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">Bring your campaign to life with polished visuals and smooth interactions.</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/30 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Your next campaign starts here</p>
                  <span className="text-sm font-bold text-primary">01</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Mythrion gives you the freedom to shape every detail, whether you are building a grand saga or a intimate tabletop adventure.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="card border-border/60">
            <p className="text-xs uppercase tracking-[0.25em] text-muted">Why players love it</p>
            <h2 className="mt-3 text-2xl font-semibold text-gradient">Designed for epic storytelling, made for everyday play.</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Mythrion combines the power of a custom RPG engine with a beautiful and intuitive interface, giving game masters and players a space that feels both professional and magical.
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
              <p className="text-xs uppercase tracking-[0.25em] text-muted">Your next adventure begins now</p>
              <h2 className="mt-2 text-2xl font-semibold text-gradient">Step into a world built for imagination.</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Whether you are crafting a campaign from scratch or refining a beloved setting, Mythrion helps you shape it with elegance, freedom, and purpose.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/login?redirect=/dashboard" className="btn-primary px-6 py-3">
                Begin your adventure
              </Link>
              <Link href="/login?redirect=/dashboard" className="btn-ghost px-6 py-3">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-background/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Mythrion — Forge your legend.</p>
          <p>Built for bold stories and unforgettable tables.</p>
        </div>
      </footer>
    </main>
  )
}
