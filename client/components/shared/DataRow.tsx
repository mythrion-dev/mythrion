'use client'

import type { ReactNode } from 'react'

interface DataRowProps {
  readonly label: string
  readonly value: ReactNode
  readonly className?: string
  readonly onClick?: () => void
}

export function DataRow({ label, value, className = '', onClick }: Readonly<DataRowProps>) {
  const Tag = 'div'

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <Tag
      className={`data-row ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      {...(onClick ? { role: 'button', tabIndex: 0 } : {})}
    >
      <span className="text-sm text-foreground font-medium">{label}</span>
      <span className="text-sm text-muted-foreground">{value}</span>
    </Tag>
  )
}
