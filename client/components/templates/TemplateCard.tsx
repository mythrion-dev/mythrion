'use client'

import Link from 'next/link'

interface TemplateCardProps {
  readonly id: string
  readonly name: string
  readonly description: string | null
  readonly campaign: string | null
  readonly createdAt: string
  readonly attributeCount: number
  readonly skillCount: number
  readonly useCount: number
  readonly isPublic?: boolean
  readonly index?: number
}

export function TemplateCard({
  id,
  name,
  description,
  campaign,
  createdAt,
  attributeCount,
  skillCount,
  useCount,
  isPublic = false,
  index = 0,
}: Readonly<TemplateCardProps>) {
  const truncatedDescription =
    description && description.length > 120
      ? description.slice(0, 120).trimEnd() + '...'
      : description

  return (
    <Link
      href={`/dashboard/templates/${id}`}
      className="card-interactive group flex flex-col"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Card ornament */}
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between mb-2 gap-2">
        <h3 className="font-semibold text-foreground truncate flex-1">
          {name}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {isPublic && (
            <span className="badge text-[0.6rem]" style={{ background: 'rgba(68,207,138,0.12)', color: '#44cf8a', border: '1px solid rgba(68,207,138,0.18)' }}>
              Public
            </span>
          )}
          {campaign && (
            <span className="badge badge-gold text-[0.6rem]">
              {campaign}
            </span>
          )}
        </div>
      </div>

      {truncatedDescription ? (
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
          {truncatedDescription}
        </p>
      ) : (
        <p className="text-sm text-muted italic mb-4 flex-1">
          No description.
        </p>
      )}

      {/* Feature chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {attributeCount > 0 && (
          <span className="badge text-[0.6rem]" style={{ background: 'rgba(124,92,231,0.12)', color: '#9070f0', border: '1px solid rgba(124,92,231,0.18)' }}>
            {attributeCount} attr
          </span>
        )}
        {skillCount > 0 && (
          <span className="badge text-[0.6rem]" style={{ background: 'rgba(201,164,75,0.12)', color: '#c9a44b', border: '1px solid rgba(201,164,75,0.18)' }}>
            {skillCount} skills
          </span>
        )}
        {useCount > 0 && (
          <span className="badge text-[0.6rem]" style={{ background: 'rgba(68,207,138,0.12)', color: '#44cf8a', border: '1px solid rgba(68,207,138,0.18)' }}>
            Used {useCount}x
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <span className="text-xs text-muted">
          <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {new Date(createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
        <span className="text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
          View details →
        </span>
      </div>
    </Link>
  )
}
