'use client'

import { useEffect } from 'react'
import { flushQueuedAccountCreated } from '@/lib/gtm'

export function GtmEventBridge() {
  useEffect(() => {
    flushQueuedAccountCreated()
  }, [])

  return null
}