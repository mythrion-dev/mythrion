'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useSubscription } from '@/lib/subscription-context'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts.at(-1)![0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { subscription, hasActiveSubscription } = useSubscription()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab')
  const { t } = useTranslation()

  // Persist collapse state
  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }

  const isActive = (href: string) => {
    const tab = href.split('tab=')[1] ?? null
    if (tab) return pathname === '/dashboard' && currentTab === tab
    return pathname === href
  }

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  const navLinks = [
    {
      href: '/dashboard?tab=adventures',
      label: 'common:adventures',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      href: '/dashboard?tab=character-sheets',
      label: 'common:characterSheets',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      href: '/dashboard/templates',
      label: 'common:myTemplates',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
    {
      href: '/dashboard/subscription',
      label: 'common:subscription',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
      ),
    },
    {
      href: '/dashboard/explore-campaigns',
      label: 'common:exploreCampaigns',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      href: '/dashboard/public-templates',
      label: 'common:publicTemplates',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
        </svg>
      ),
    },
    {
      href: '/dashboard/settings',
      label: 'common:settings',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ]

  // Admin link — only shown for admin users
  if (user?.isAdmin) {
    navLinks.push(
      { type: 'divider' } as any,
      {
        href: '/admin/plans',
        label: 'common:admin',
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    )
  }

  const sidebarContent = (
    <div className={`flex flex-col h-full p-3 transition-all duration-300 ${collapsed ? 'items-center' : 'p-4'}`}>
      {/* Logo + collapse toggle */}
      <div className={`flex items-center transition-all duration-300 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <Link
          href="/dashboard"
          className={`flex items-center transition-all duration-300 ${collapsed ? 'w-8 h-8 justify-center' : 'gap-2'}`}
          onClick={() => setMobileOpen(false)}
          title={t('common:dashboard')}
        >
          <Image
            src="/logo-icon.png"
            alt="Mythrion"
            width={532}
            height={624}
            className="h-8 w-auto rounded-lg"
          />
          {!collapsed && (
            <span className="text-xl font-semibold text-gradient tracking-tight">Mythrion</span>
          )}
        </Link>
        <button
          onClick={toggleCollapsed}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-muted hover:text-foreground hover:bg-background/40 transition-colors"
          title={collapsed ? t('common:expandSidebar') : t('common:collapseSidebar')}
        >
          <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>
      <hr className={`divider my-4 transition-all duration-300 ${collapsed ? 'my-3 w-8 mx-auto' : ''}`} />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 w-full">
        {navLinks.map((link: any) =>
          link.type === 'divider' ? (
            <hr key="nav-divider" className={`divider my-2 transition-all duration-300 ${collapsed ? 'w-8 mx-auto' : ''}`} />
          ) : (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${isActive(link.href) ? 'sidebar-link-active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? t(link.label) : undefined}
            >
              {link.icon}
              {!collapsed && <span>{t(link.label)}</span>}
            </Link>
          )
        )}
      </nav>

      {/* User section */}
      <div className={`pt-4 border-t border-border space-y-3 w-full transition-all duration-300 ${collapsed ? 'pt-3 flex flex-col items-center' : ''}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'flex-col' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary shrink-0 relative">
            {getInitials(user?.displayName ?? null)}
            {user?.isAdmin && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-background" />
            )}
            {!user?.isAdmin && user?.isEarlyAccess && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-violet-500 border-2 border-background" />
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.displayName ?? t('common:user')}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-xs text-muted truncate">{user?.email}</p>
                {user?.isAdmin && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                    {t('common:admin')}
                  </span>
                )}
                {!user?.isAdmin && user?.isEarlyAccess && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20 shrink-0">
                    Early Access
                  </span>
                )}
                {!user?.isAdmin && !user?.isEarlyAccess && hasActiveSubscription && subscription?.plan?.name && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                    {subscription.plan.name}
                  </span>
                )}
                {!user?.isAdmin && !user?.isEarlyAccess && !hasActiveSubscription && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-muted text-muted-foreground border border-border shrink-0">
                    {t('common:free')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Upgrade CTA for free users */}
        {!user?.isAdmin && !user?.isEarlyAccess && !hasActiveSubscription && !collapsed && (
          <Link
            href="/pricing"
            className="flex items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/15 hover:border-accent/50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {t('common:viewPlans')}
          </Link>
        )}
        {!user?.isAdmin && !user?.isEarlyAccess && !hasActiveSubscription && collapsed && (
          <Link
            href="/pricing"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-accent/30 bg-accent/10 text-accent hover:bg-accent/15 hover:border-accent/50 transition-colors"
            title={t('common:viewPlans')}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </Link>
        )}
        <LanguageSwitcher compact={collapsed} />
        <button
          onClick={handleLogout}
          className={`btn-ghost text-xs ${collapsed ? 'w-8 h-8 flex items-center justify-center p-0' : 'w-full justify-start'}`}
          title={t('common:signOut')}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && t('common:signOut')}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        className="fixed top-4 left-4 z-50 lg:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-surface border border-border text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? t('common:closeMenu') : t('common:openMenu')}
      >
        {mobileOpen ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden border-0"
          onClick={() => setMobileOpen(false)}
          aria-label={t('common:closeSidebar')}
        />
      )}

      {/* Sidebar — persistent on desktop, overlay on mobile */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 z-40 h-full overflow-hidden
          bg-background border-r border-border flex flex-col
          transition-all duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          ${collapsed ? 'w-16' : 'w-60'}
        `}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
