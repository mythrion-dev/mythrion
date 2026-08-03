'use client'

import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, icon, actions }: Readonly<PageHeaderProps>) {
  return (
    <header className="flex items-center justify-between pb-4 header-accent">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-surface border border-border text-xl">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold text-gradient">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
