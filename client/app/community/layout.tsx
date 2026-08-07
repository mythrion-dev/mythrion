'use client'

import { VerifiedGate } from '@/components/auth/VerifiedGate'

export default function CommunityLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <VerifiedGate>
      {children}
    </VerifiedGate>
  )
}
