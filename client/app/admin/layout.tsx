'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user || !user.isAdmin) {
      router.replace('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!user || !user.isAdmin) {
    return null
  }

  return (
    <div className="flex-1 min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  )
}
