'use client'

import type { ReactNode } from 'react'

interface DataRowProps {
  label: string
  value: ReactNode
  className?: string
  onClick?: () => void
}

export function DataRow({ label, value, className = '', onClick }: DataRowProps) {
  return (
    <div
      className={`data-row ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <span className="text-sm text-foreground font-medium">{label}</span>
      <span className="text-sm text-muted-foreground">{value}</span>
    </div>
  )
}
