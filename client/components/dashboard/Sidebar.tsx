'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab')

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
    if (!tab) return pathname === href
    return pathname === '/dashboard' && currentTab === tab
  }

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  const navLinks = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: '/dashboard?tab=adventures',
      label: 'Adventures',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      href: '/dashboard?tab=character-sheets',
      label: 'Character Sheets',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      href: '/dashboard/templates',
      label: 'My Templates',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
    {
      href: '/community/adventures',
      label: 'Explore Campaigns',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      href: '/community/templates',
      label: 'Public Templates',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
        </svg>
      ),
    },
  ]

  const sidebarContent = (
    <div className={`flex flex-col h-full p-3 transition-all duration-300 ${collapsed ? 'items-center' : 'p-4'}`}>
      {/* Logo + collapse toggle */}
      <div className={`flex items-center transition-all duration-300 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <Link
          href="/dashboard"
          className={`text-xl font-semibold text-gradient tracking-tight transition-all duration-300 ${collapsed ? 'text-sm w-8 h-8 flex items-center justify-center' : ''}`}
          onClick={() => setMobileOpen(false)}
          title="Dashboard"
        >
          {collapsed ? 'M' : 'Mythrion'}
        </Link>
        <button
          onClick={toggleCollapsed}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-muted hover:text-foreground hover:bg-background/40 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>
      <hr className={`divider my-4 transition-all duration-300 ${collapsed ? 'my-3 w-8 mx-auto' : ''}`} />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 w-full">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`sidebar-link ${isActive(link.href) ? 'sidebar-link-active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
            onClick={() => setMobileOpen(false)}
            title={collapsed ? link.label : undefined}
          >
            {link.icon}
            {!collapsed && <span>{link.label}</span>}
          </Link>
        ))}
      </nav>

      {/* User section */}
      <div className={`pt-4 border-t border-border space-y-3 w-full transition-all duration-300 ${collapsed ? 'pt-3 flex flex-col items-center' : ''}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'flex-col' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary shrink-0 relative">
            {getInitials(user?.displayName ?? null)}
            {user?.isAdmin && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-background" />
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.displayName ?? 'User'}
              </p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-muted truncate">{user?.email}</p>
                {user?.isAdmin && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                    Admin
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className={`btn-ghost text-xs ${collapsed ? 'w-8 h-8 flex items-center justify-center p-0' : 'w-full justify-start'}`}
          title="Sign out"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && 'Sign out'}
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
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
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
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
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
