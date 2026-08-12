'use client'

import Link from 'next/link'

interface EmptyStateProps {
  readonly icon: string
  readonly title: string
  readonly description: string
  readonly actionLabel?: string
  readonly actionHref?: string
  readonly onAction?: () => void
  readonly disabled?: boolean
  readonly actionTitle?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  disabled,
  actionTitle,
}: Readonly<EmptyStateProps>) {
  let actionEl: React.ReactNode = null
  if (actionLabel) {
    if (actionHref) {
      actionEl = (
        <Link href={actionHref} className="btn-primary">
          {actionLabel}
        </Link>
      )
    } else {
      actionEl = (
        <button
          onClick={disabled ? undefined : onAction}
          disabled={disabled}
          title={actionTitle}
          className={`btn-primary ${disabled ? '!opacity-50 !cursor-not-allowed' : ''}`}
        >
          {actionLabel}
        </button>
      )
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
      <div className="w-20 h-20 rounded-full bg-surface border border-border flex items-center justify-center text-4xl">
        {icon}
      </div>
      <div className="space-y-1 max-w-sm">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actionEl}
    </div>
  )
}
