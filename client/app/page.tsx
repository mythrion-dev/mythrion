'use client'

import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

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
    <main className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-b from-accent/5 via-primary/3 to-transparent blur-3xl pointer-events-none" />

      <div className="text-center space-y-8 max-w-lg relative z-10 animate-slide-up">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-surface border border-border ring-1 ring-primary/10 shadow-[0_0_40px_rgba(201,164,75,0.08)] p-3">
          <Image
            src="/logo.png"
            alt="Mythrion"
            width={72}
            height={72}
            className="w-full h-full object-contain"
            priority
          />
        </div>

        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tight text-gradient">
            Mythrion
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Forge your legend. Build worlds, create characters, and embark on
            epic campaigns with your friends.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login" className="btn-primary text-base px-8 py-3">
            Begin your adventure
          </Link>
          <Link href="/login" className="btn-ghost text-base px-8 py-3">
            Sign in
          </Link>
        </div>

        <hr className="divider" />

        <div className="grid grid-cols-3 gap-6 text-center">
          <Feature icon="🏰" title="Build Worlds" />
          <Feature icon="⚔️" title="Create Characters" />
          <Feature icon="🗺️" title="Run Campaigns" />
        </div>
      </div>
    </main>
  )
}

function Feature({
  icon,
  title,
}: {
  icon: string
  title: string
}) {
  return (
    <div className="space-y-1">
      <div className="text-2xl">{icon}</div>
      <p className="text-xs text-muted font-medium">{title}</p>
    </div>
  )
}