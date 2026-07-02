'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

export interface BreadcrumbSegment {
  label: string
  href?: string // undefined = current page (not clickable)
}

interface NavigationContextValue {
  breadcrumbs: BreadcrumbSegment[]
  setBreadcrumbs: (segments: BreadcrumbSegment[]) => void
  pushSegment: (segment: BreadcrumbSegment) => void
  popSegment: () => void
}

const NavigationContext = createContext<NavigationContextValue | null>(null)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([])
  // Use a ref to track mounted segments per location to avoid stale closures
  const segmentsRef = useRef<BreadcrumbSegment[]>([])

  const pushSegment = useCallback((segment: BreadcrumbSegment) => {
    setBreadcrumbs(prev => {
      // Avoid duplicates - if the same segment is already the last one, skip
      if (prev.length > 0 && prev[prev.length - 1].label === segment.label &&
          prev[prev.length - 1].href === segment.href) {
        return prev
      }
      const next = [...prev, segment]
      segmentsRef.current = next
      return next
    })
  }, [])

  const popSegment = useCallback(() => {
    setBreadcrumbs(prev => {
      const next = prev.slice(0, -1)
      segmentsRef.current = next
      return next
    })
  }, [])

  const setCrumbs = useCallback((segments: BreadcrumbSegment[]) => {
    segmentsRef.current = segments
    setBreadcrumbs(segments)
  }, [])

  return (
    <NavigationContext.Provider value={{ breadcrumbs, setBreadcrumbs: setCrumbs, pushSegment, popSegment }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const ctx = useContext(NavigationContext)
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider')
  return ctx
}

/**
 * Hook to set breadcrumbs when a page mounts.
 * Pass the full breadcrumb path (from root to current).
 * The last segment should have no href (current page, not clickable).
 *
 * Example:
 *   useBreadcrumbs([
 *     { label: 'Dashboard', href: '/dashboard' },
 *     { label: 'Adventure Name', href: '/dashboard/adventures/123' },
 *     { label: 'Character Name' },  // current page, no href
 *   ])
 */
export function useBreadcrumbs(segments: BreadcrumbSegment[]) {
  const { setBreadcrumbs } = useNavigation()

  useEffect(() => {
    setBreadcrumbs(segments)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // Intentionally only run on mount; segments should be stable
}