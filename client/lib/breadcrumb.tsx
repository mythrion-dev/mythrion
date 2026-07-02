'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useNavigation } from './navigation-context'
import type { BreadcrumbSegment } from './navigation-context'

export function BreadcrumbNav() {
  const { breadcrumbs } = useNavigation()
  const router = useRouter()

  if (breadcrumbs.length === 0) return null

  return (
    <nav
      className="mb-6 flex items-center gap-2 text-sm flex-wrap"
      aria-label="Breadcrumb"
    >
      {/* Back Button */}
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-muted hover:text-foreground transition-colors shrink-0"
        aria-label="Go back"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        <span>Back</span>
      </button>

      {/* Separator and Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <>
          <span className="text-muted/50 select-none">/</span>
          <div className="flex items-center gap-1 flex-wrap">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1
              return (
                <span key={index} className="flex items-center gap-1">
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="text-accent hover:text-accent-hover transition-colors font-medium"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={`font-medium ${isLast ? 'text-foreground' : 'text-muted'}`}>
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && (
                    <span className="text-muted/40 select-none">/</span>
                  )}
                </span>
              )
            })}
          </div>
        </>
      )}
    </nav>
  )
}

/**
 * Set breadcrumbs and render a consistent navigation header.
 * Use this in page components to declare their breadcrumb path.
 *
 * Example:
 *   <PageNav crumbs={[
 *     { label: 'Dashboard', href: '/dashboard' },
 *     { label: 'My Adventure' },
 *   ]} />
 */
export function PageNav({ crumbs }: { crumbs: BreadcrumbSegment[] }) {
  const { setBreadcrumbs } = useNavigation()

  useEffect(() => {
    setBreadcrumbs(crumbs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <BreadcrumbNav />
}