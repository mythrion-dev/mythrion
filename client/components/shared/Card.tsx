'use client'

import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  variant?: 'default' | 'interactive'
  className?: string
  onClick?: () => void
  style?: React.CSSProperties
}

export function Card({ children, variant = 'default', className = '', onClick, style }: CardProps) {
  const baseClass = variant === 'interactive' ? 'card-interactive' : 'card'
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      className={`${baseClass} ${className}`}
      onClick={onClick}
      style={style}
      {...(onClick ? { type: 'button' as const } : {})}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`header-accent ${className}`}>{children}</div>
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-3 ${className}`}>{children}</div>
}

export function CardFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`pt-3 border-t border-border flex items-center justify-between ${className}`}>{children}</div>
}
