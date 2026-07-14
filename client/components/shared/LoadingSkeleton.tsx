'use client'

interface LoadingSkeletonProps {
  variant?: 'card' | 'list' | 'page'
  count?: number
}

function SkeletonCard() {
  return (
    <div className="card space-y-3">
      <div className="skeleton h-5 w-3/4" />
      <div className="skeleton h-3 w-full" />
      <div className="skeleton h-3 w-2/3" />
      <div className="flex justify-between pt-2">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-3 w-16" />
      </div>
    </div>
  )
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="data-row">
          <div className="skeleton h-4 w-48" />
          <div className="skeleton h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

function SkeletonPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="skeleton h-12 w-12 rounded-xl" />
        <div className="space-y-2 flex-1">
          <div className="skeleton h-6 w-48" />
          <div className="skeleton h-4 w-72" />
        </div>
      </div>
      <div className="skeleton h-10 w-full rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

export function LoadingSkeleton({ variant = 'card', count = 3 }: LoadingSkeletonProps) {
  if (variant === 'page') return <SkeletonPage />
  if (variant === 'list') return <SkeletonList />

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
