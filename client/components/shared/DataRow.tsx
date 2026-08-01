'use client'

import type { ReactNode } from 'react'

interface DataRowProps {
  readonly label: string
  readonly value: ReactNode
  readonly className?: string
  readonly onClick?: () => void
}

export function DataRow({ label, value, className = '', onClick }: Readonly<DataRowProps>) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      className={`data-row ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      {...(onClick ? { type: 'button' as const } : {})}
    >
      <span className="text-sm text-foreground font-medium">{label}</span>
      <span className="text-sm text-muted-foreground">{value}</span>
    </Tag>
  )
}
