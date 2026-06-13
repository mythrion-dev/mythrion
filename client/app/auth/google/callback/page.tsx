'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { setAccessToken, getAccessToken } from '@/lib/api'

function GoogleCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      setAccessToken(token)
      router.replace('/dashboard')
    } else {
      router.replace('/login?error=google_auth_failed')
    }
  }, [searchParams, router])

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <span className="text-sm">Signing in with Google...</span>
      </div>
    </main>
  )
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </main>
      }
    >
      <GoogleCallbackInner />
    </Suspense>
  )
}