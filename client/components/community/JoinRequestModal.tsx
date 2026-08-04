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

  // Focus trap — keep focus within the modal while open
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
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
    [onCancel],
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

  // Prevent body scroll while modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  const remaining = MAX_MESSAGE_LENGTH - message.length
  const isOverLimit = remaining < 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 border-0"
        onClick={onCancel}
        aria-label={t('community:closeModal')}
      />

      {/* Card */}
      <dialog
        ref={cardRef}
        open
        className="card !p-6 max-w-sm w-full space-y-4 relative z-10 m-0"
        aria-modal="true"
        aria-labelledby="join-modal-title"
      >
        {/* Icon + Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-muted flex items-center justify-center">
            <svg
              className="w-5 h-5 text-primary"
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
            <h2 id="join-modal-title" className="font-semibold">
              {t('community:requestToJoinTitle')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('community:requestToJoinDescription')}
            </p>
          </div>
        </div>

        {/* Message textarea */}
        <div className="space-y-1.5">
          <textarea
            ref={textareaRef}
            placeholder={t('community:optionalMessagePlaceholder')}
            value={message}
            onChange={(e) => onMessageChange(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            className="input w-full h-24 resize-none"
            disabled={loading}
            aria-label={t('community:messageToGmLabel')}
          />
          <div className="flex justify-end">
            <span
              className={`text-xs ${
                remaining <= 20 ? 'text-danger' : 'text-muted'
              }`}
            >
              {remaining} / {MAX_MESSAGE_LENGTH}
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-ghost"
          >
            {t('common:cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || isOverLimit}
            className="btn-primary"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-background/30 border-t-background rounded-full animate-spin" />
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
