'use client'

import { useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Sidebar } from '@/components/dashboard'
import { useTranslation } from 'react-i18next'

/* ── Breadcrumbs ──────────────────────────────────── */

interface Crumb {
  labelKey?: string
  label?: string
  href?: string
}

const breadcrumbMap: Record<string, Crumb[]> = {
  '/admin/plans': [
    { labelKey: 'common:admin', href: '/admin/plans' },
    { labelKey: 'billing:plans' },
  ],
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const { t } = useTranslation()
  const crumbs = useMemo<Crumb[]>(() => {
    // Exact match first
    if (breadcrumbMap[pathname]) return breadcrumbMap[pathname]
    // Fallback: build from path segments
    const segments = pathname.split('/').filter(Boolean)
    return segments.map((seg, i) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1).replaceAll('-', ' '),
      href: i < segments.length - 1 ? '/' + segments.slice(0, i + 1).join('/') : undefined,
    }))
  }, [pathname])

  return (
    <nav aria-label={t('billing:breadcrumb')} className="mb-6">
      <ol className="flex items-center gap-2 text-sm text-muted-foreground">
        {crumbs.map((crumb, i) => (
          <li key={i} className="flex items-center gap-2">
            {i > 0 && (
              <svg className="w-3.5 h-3.5 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="hover:text-foreground transition-colors"
              >
                {crumb.labelKey ? t(crumb.labelKey) : crumb.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium">{crumb.labelKey ? t(crumb.labelKey) : crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/* ── Admin sub-navigation ─────────────────────────── */

const adminNavLinks = [
  {
    href: '/admin/plans',
    labelKey: 'billing:plans',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
]

function AdminNav({ pathname }: { pathname: string }) {
  const { t } = useTranslation()
  return (
    <nav className="flex gap-1 mb-6 p-1 rounded-xl bg-surface border border-border">
      {adminNavLinks.map((link) => {
        const active = pathname === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              active
                ? 'bg-primary text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
          >
            {link.icon}
            {t(link.labelKey)}
          </Link>
        )
      })}
    </nav>
  )
}

/* ── Layout ────────────────────────────────────────── */

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user || !user.isAdmin) {
      router.replace('/dashboard')
      return
    }
    if (!user.emailVerified) {
      router.replace('/verify-email')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!user || !user.isAdmin || !user.emailVerified) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      {/* Main content area */}
      <main className="flex-1 min-h-screen bg-pattern overflow-auto">
        <div className="px-8 py-6 w-full animate-fade-in max-w-5xl">
          <Breadcrumbs pathname={pathname} />
          <AdminNav pathname={pathname} />
          {children}
        </div>
      </main>
    </div>
  )
}
