'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'

interface PreviewBannerProps {
  readonly templateName: string
  readonly templateId: string
}

export function PreviewBanner({ templateName, templateId }: Readonly<PreviewBannerProps>) {
  const { t } = useTranslation()
  const router = useRouter()
  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)

  const handleClone = async () => {
    setCloning(true)
    setCloneError(null)
    try {
      const cloned = await api.post<{ id: string }>(`/templates/${templateId}/clone`, {})
      router.push(`/dashboard/templates/${cloned.id}`)
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : t('community:failedToCloneTemplate'))
      setCloning(false)
    }
  }

  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        {/* Left: Sandbox mode indicator */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/20 text-[0.65rem] font-semibold text-amber-400 uppercase tracking-wider shrink-0">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            {t('community:sandboxMode')}
          </span>
          <span className="text-xs text-amber-300/80 truncate hidden sm:inline">
            {t('community:previewing')} <span className="font-medium text-amber-200">{templateName}</span>
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleClone}
            disabled={cloning}
            className="btn-ghost text-xs !px-2.5 !py-1 text-amber-300/80 hover:text-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cloning ? (
              <>
                <div className="w-3 h-3 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin mr-1" />
                {t('community:cloning')}
              </>
            ) : (
              t('community:cloneThisTemplate')
            )}
          </button>
          <Link
            href="/dashboard/public-templates"
            className="btn-ghost text-xs !px-2.5 !py-1 text-amber-300/80 hover:text-amber-200"
          >
            <svg
              className="w-3 h-3 mr-1 inline"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            {t('community:exitPreview')}
          </Link>
        </div>
      </div>

      {cloneError && (
        <div className="max-w-7xl mx-auto px-4 pb-2">
          <p className="text-xs text-red-400">{cloneError}</p>
        </div>
      )}
    </div>
  )
}
