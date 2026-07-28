'use client'

interface VisibilityToggleProps {
  isPublic: boolean
  loading: boolean
  onToggle: () => void
  disabled?: boolean
}

export function VisibilityToggle({
  isPublic,
  loading,
  onToggle,
  disabled = false,
}: VisibilityToggleProps) {
  return (
    <div className="card !p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPublic ? (
            <svg
              className="w-4 h-4 text-primary shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-muted-foreground shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
          )}
          <span className="text-sm font-medium text-foreground">
            {isPublic ? 'Public Campaign' : 'Private Campaign'}
          </span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          disabled={loading || disabled}
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
            isPublic
              ? 'bg-primary'
              : 'bg-border'
          } ${loading || disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform duration-200 ${
              isPublic ? 'translate-x-[1.375rem]' : 'translate-x-[0.1875rem]'
            }`}
          />
        </button>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {isPublic
          ? 'Anyone can see this campaign and request to join.'
          : 'Only invited members can see this campaign.'}
      </p>
    </div>
  )
}
