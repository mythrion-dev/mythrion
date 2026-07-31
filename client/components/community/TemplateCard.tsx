'use client'

import Link from 'next/link'

interface TemplateCardProps {
  id: string
  name: string
  description: string | null
  campaign: string | null
  creatorDisplayName: string | null
  copyCount?: number
  attributeCount?: number
  skillCount?: number
  updatedAt?: string
  index?: number
  onClone?: (id: string) => void
  isCloning?: boolean
  isAuthenticated?: boolean
  isOwn?: boolean
}

export function TemplateCard({
  id,
  name,
  description,
  campaign,
  creatorDisplayName,
  copyCount = 0,
  attributeCount = 0,
  skillCount = 0,
  updatedAt,
  index = 0,
  onClone,
  isCloning = false,
  isAuthenticated = false,
  isOwn = false,
}: TemplateCardProps) {
  const truncatedDescription =
    description && description.length > 100
      ? description.slice(0, 100).trimEnd() + '...'
      : description

  return (
    <div
      className="card-interactive group flex flex-col"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Card ornament */}
      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between mb-2 gap-2">
        <h3 className="font-semibold text-foreground truncate flex-1">
          {name}
        </h3>
        {campaign && (
          <span className="shrink-0 badge badge-gold text-[0.6rem]">
            {campaign}
          </span>
        )}
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

      {/* Feature badges */}
      {(attributeCount > 0 || skillCount > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
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
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-3 min-w-0">
          {creatorDisplayName && (
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {creatorDisplayName}
            </span>
          )}
          {updatedAt && (
            <span className="text-xs text-muted shrink-0 hidden sm:inline">
              <svg className="w-3 h-3 inline mr-0.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {copyCount > 0 && (
            <span className="text-xs text-muted shrink-0">
              <svg
                className="w-3.5 h-3.5 inline mr-0.5 -mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              {copyCount}
            </span>
          )}
        </div>

        <div className="shrink-0 ml-2 flex items-center gap-2">
          <Link
            href={`/dashboard/public-templates/${id}/preview`}
            onClick={(e) => e.stopPropagation()}
            className="btn-ghost text-xs !px-2.5 !py-1"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            Preview
          </Link>
          {isOwn ? (
            <span className="badge text-[0.6rem]" style={{ background: 'rgba(124,92,231,0.15)', color: '#9070f0', border: '1px solid rgba(124,92,231,0.2)' }}>
              Owned
            </span>
          ) : isAuthenticated ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClone?.(id)
              }}
              disabled={isCloning}
              className={`text-xs btn-primary !px-3 !py-1 ${isCloning ? '!opacity-50 !cursor-not-allowed' : ''}`}
            >
              {isCloning ? (
                <>
                  <div className="w-3 h-3 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  Cloning...
                </>
              ) : (
                <>
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Clone
                </>
              )}
            </button>
          ) : (
            <Link
              href="/login"
              className="btn-ghost text-xs !px-3 !py-1"
              onClick={(e) => e.stopPropagation()}
            >
              Sign in to clone
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
