'use client'

interface ConfirmDetachModalProps {
  loading: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDetachModal({
  loading,
  error,
  onCancel,
  onConfirm,
}: ConfirmDetachModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/50" />
      <div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center">
            <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold">Detach Sheet Template</h2>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          The snapshot will be preserved for existing character sheets, but you
          won&rsquo;t be able to track the original template from this adventure.
          Future character creation will require a new template attachment.
        </p>
        {error && (
          <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading} className="btn-ghost">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} className="btn-danger-solid">
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                Detaching...
              </span>
            ) : (
              'Detach Template'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
