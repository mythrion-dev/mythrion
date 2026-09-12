'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { captureMarketingAttribution } from '@/lib/marketing-attribution'

export function MarketingAttributionTracker() {
  const pathname = usePathname()

  useEffect(() => {
    captureMarketingAttribution()
  }, [pathname])

  return null
}
