'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface JoinRequestModalProps {
  readonly open: boolean
  readonly message: string
  readonly onMessageChange: (value: string) => void
  readonly onCancel: () => void
  readonly onConfirm: () => void
  readonly loading: boolean
  readonly error: string | null
}

const MAX_MESSAGE_LENGTH = 500

export function JoinRequestModal({
  open,
  message,
  onMessageChange,
  onCancel,
  onConfirm,
  loading,
  error,
}: Readonly<JoinRequestModalProps>) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cardRef = useRef<HTMLDialogElement>(null)
  const cancelFiredRef = useRef(false)

  // Route Escape closes through this so onCancel fires exactly once per press:
  // native <dialog> dispatches a cancel event in real browsers in addition to the
  // manual keydown listener below (which is needed for jsdom).
  const handleCancel = useCallback(() => {
    if (cancelFiredRef.current) return
    cancelFiredRef.current = true
    setTimeout(() => { cancelFiredRef.current = false }, 0)
    onCancel()
  }, [onCancel])

  // Focus trap — keep focus within the modal while open
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel()
        return
      }

      if (e.key === 'Tab') {
        const focusable = cardRef.current?.querySelectorAll<HTMLElement>(
          'button, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [handleCancel],
  )

  // ESC and focus trap listener
  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  // Autofocus textarea when modal opens
  useEffect(() => {
    if (open && textareaRef.current) {
      // Small delay to let the animation settle
      const id = setTimeout(() => textareaRef.current?.focus(), 100)
      return () => clearTimeout(id)
    }
  }, [open])

  // Prevent body scroll while modal is open and open/close the native dialog
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      try { cardRef.current?.showModal() } catch { /* jsdom */ }
    } else {
      document.body.style.overflow = ''
      try { cardRef.current?.close() } catch { /* jsdom */ }
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  const remaining = MAX_MESSAGE_LENGTH - message.length
  const isOverLimit = remaining < 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <button
        type="button"
        className="absolute inset-0 bg-transparent"
        onClick={onCancel}
        aria-label={t('community:closeModal')}
      />

      <dialog
        ref={cardRef}
        className="card !p-6 max-w-md w-full space-y-6 border-border/20 shadow-[0_24px_80px_rgba(0,0,0,0.45)] relative z-10"
        aria-modal="true"
        aria-labelledby="join-modal-title"
        onCancel={(e) => { e.preventDefault(); handleCancel() }}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner shadow-primary/10">
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <div>
            <h2 id="join-modal-title" className="text-xl font-semibold text-foreground">
              {t('community:requestToJoinTitle')}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t('community:requestToJoinDescription')}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label htmlFor="join-request-message" className="text-sm font-medium text-foreground">
            {t('community:messageToGmLabel')}
          </label>
          <textarea
            id="join-request-message"
            ref={textareaRef}
            placeholder={t('community:optionalMessagePlaceholder')}
            value={message}
            onChange={(e) => onMessageChange(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            className="input-field min-h-[12rem] resize-none"
            disabled={loading}
            aria-label={t('community:messageToGmLabel')}
          />
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{t('community:messageHelpText')}</span>
            <span className={remaining <= 20 ? 'text-danger' : 'text-muted'}>
              {remaining} / {MAX_MESSAGE_LENGTH}
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-danger/30 bg-danger-muted/80 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn-ghost"
          >
            {t('common:cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || isOverLimit}
            className="btn-primary"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3 w-3 rounded-full border-2 border-background/30 border-t-background animate-spin" />
                {t('community:sending')}
              </span>
            ) : (
              t('community:sendRequest')
            )}
          </button>
        </div>
      </dialog>
    </div>
  )
}
