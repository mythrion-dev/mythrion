'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  setAccessToken,
  setRefreshToken,
  getInvitationToken,
} from '@/lib/api'

function DiscordCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const accessToken = searchParams.get('token')
    const refreshToken = searchParams.get('refreshToken')

    if (accessToken && refreshToken) {
      setAccessToken(accessToken)
      setRefreshToken(refreshToken)

      // Check for pending invitation
      const pendingInvite = getInvitationToken()
      if (pendingInvite) {
        window.location.replace(`/invite/${pendingInvite}`)
        return
      }

      window.location.replace('/dashboard')
    } else {
      router.replace('/login?error=discord_auth_failed')
    }
  }, [searchParams, router])

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <span className="text-sm">Signing in with Discord...</span>
      </div>
    </main>
  )
}

export default function DiscordCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </main>
      }
    >
      <DiscordCallbackInner />
    </Suspense>
  )
}