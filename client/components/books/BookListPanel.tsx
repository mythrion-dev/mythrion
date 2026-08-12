'use client'

import { useState, useEffect, useCallback } from 'react'
import { api, API_URL, authFetch } from '@/lib/api'
import { Select } from '@/components/shared/Select'
import { useTranslation } from 'react-i18next'

/* ── Types ── */

interface Book {
  id: string
  name: string
  visibility: 'GM_BOOK' | 'PLAYER_BOOK'
  fileLength: number
  createdAt: string
  updatedAt: string
}

/* ── Props ── */

interface BookListPanelProps {
  readonly adventureId: string
  readonly isGM: boolean
  readonly readOnly?: boolean
  readonly onSelectBook: (bookId: string | null) => void
}

/* ── Helpers ── */

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/* ── Component ── */

export function BookListPanel({ adventureId, isGM, readOnly, onSelectBook }: Readonly<BookListPanelProps>) {
  const { t } = useTranslation()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [uploadVisibility, setUploadVisibility] = useState<'GM_BOOK' | 'PLAYER_BOOK'>('GM_BOOK')

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Delete confirmation state
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Replace file state
  const [replacingId, setReplacingId] = useState<string | null>(null)

  /* ── Fetch books ── */
  const fetchBooks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<Book[]>(`/adventures/${adventureId}/books`)
      setBooks(data)
    } catch {
      setError(t('books:errorLoadBooks'))
    } finally {
      setLoading(false)
    }
  }, [adventureId])

  useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

  /* ── Upload book ── */
  async function handleUpload(file: File) {
    if (!uploadName.trim()) {
      setError(t('books:uploadNameRequired'))
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', uploadName.trim())
      formData.append('visibility', uploadVisibility)

      const res = await authFetch(`${API_URL}/adventures/${adventureId}/books`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: t('books:uploadFailed') }))
        throw new Error(body.message ?? t('books:uploadFailed'))
      }

      setUploadName('')
      await fetchBooks()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('books:uploadBookFailed'))
    } finally {
      setUploading(false)
    }
  }

  /* ── Rename book ── */
  async function handleRename(bookId: string) {
    if (!renameValue.trim()) return

    try {
      await api.patch(`/adventures/${adventureId}/books/${bookId}`, {
        name: renameValue.trim(),
      })
      setRenamingId(null)
      setRenameValue('')
      await fetchBooks()
    } catch {
      setError(t('books:renameFailed'))
    }
  }

  /* ── Delete book ── */
  async function handleDelete(bookId: string) {
    setDeleting(true)
    try {
      await api.delete(`/adventures/${adventureId}/books/${bookId}`)
      setDeleteId(null)
      await fetchBooks()
    } catch {
      setError(t('books:deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  /* ── Replace file ── */
  async function handleReplace(bookId: string, file: File) {
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await authFetch(
        `${API_URL}/adventures/${adventureId}/books/${bookId}/replace`,
        {
          method: 'POST',
          body: formData,
        },
      )

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: t('books:replaceFailed') }))
        throw new Error(body.message ?? t('books:replaceFailed'))
      }

      setReplacingId(null)
      await fetchBooks()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('books:replaceFileFailed'))
    }
  }

  /* ── Render ── */

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto p-0.5 rounded hover:bg-danger-muted/50 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* GM upload controls */}
      {isGM && !readOnly && (
        <div className="card !p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{t('books:uploadNewBook')}</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={uploadName}
              onChange={e => setUploadName(e.target.value)}
              placeholder={t('books:bookNamePlaceholder')}
              className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 transition-shadow"
              disabled={uploading}
            />
            <Select
              options={[
                { id: 'GM_BOOK', label: t('books:gmOnly') },
                { id: 'PLAYER_BOOK', label: t('books:playerVisible') },
              ]}
              value={uploadVisibility}
              onChange={val => setUploadVisibility(val as 'GM_BOOK' | 'PLAYER_BOOK')}
              className="text-sm"
              disabled={uploading}
            />
          </div>
          <label className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            uploading
              ? 'bg-accent/50 text-white cursor-not-allowed'
              : 'bg-accent text-white hover:bg-accent/90'
          }`}>
            {uploading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('books:uploading')}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {t('books:selectPdfToUpload')}
              </>
            )}
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleUpload(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => `skel-${i}`).map((key) => (
            <div key={key} className="card !p-4">
              <div className="skeleton h-5 w-48 mb-2" />
              <div className="skeleton h-3 w-32" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && books.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center text-3xl mb-4">
            📚
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">{t('books:noBooksYet')}</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            {isGM
              ? t('books:uploadPromptGm')
              : t('books:uploadPromptPlayer')}
          </p>
        </div>
      )}

      {/* Book list */}
      {!loading && books.length > 0 && (
        <div className="space-y-2">
          {books.map(book => {
            const isRenaming = renamingId === book.id
            const isDeleting = deleteId === book.id
            const isReplacing = replacingId === book.id

            return (
              <div
                key={book.id}
                className="card !p-4 flex items-center gap-4 hover:bg-hover transition-colors group"
              >
                {/* Book icon */}
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>

                {/* Book info */}
                <div className="flex-1 min-w-0">
                  {isRenaming ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        className="flex-1 px-2 py-1 rounded border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename(book.id)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                      />
                      <button
                        onClick={() => handleRename(book.id)}
                        className="p-1 rounded text-accent hover:bg-accent/10 transition-colors"
                        title={t('common:save')}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
                        title={t('common:cancel')}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {book.name}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                          book.visibility === 'GM_BOOK'
                            ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                            : 'bg-green-500/10 text-green-500 border border-green-500/20'
                        }`}>
                          {book.visibility === 'GM_BOOK' ? t('books:gmBadge') : t('books:playerBadge')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatFileSize(book.fileLength)} · {formatDate(book.createdAt)}
                      </p>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* View / Open */}
                  <button
                    onClick={() => onSelectBook(book.id)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all"
                    aria-label={t('books:viewBook', { name: book.name })}
                    title={t('books:viewBookTooltip')}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>

                  {isGM && (
                    <>
                      {/* Rename */}
                      <button
                        onClick={readOnly ? undefined : () => {
                          setRenamingId(book.id)
                          setRenameValue(book.name)
                        }}
                        disabled={readOnly}
                        className={`p-1.5 rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                        aria-label={t('books:renameBook', { name: book.name })}
                        title={readOnly ? t('campaign:readOnlyTooltip') : t('common:rename')}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      {/* Replace file */}
                      <label
                        className={`p-1.5 rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all cursor-pointer ${
                          isReplacing || readOnly ? 'opacity-50 pointer-events-none' : ''
                        }`}
                        aria-disabled={readOnly || undefined}
                        title={readOnly ? t('campaign:readOnlyTooltip') : t('books:replaceFileTooltip')}
                      >
                        {isReplacing ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                        )}
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          disabled={isReplacing || readOnly}
                          onChange={e => {
                            const f = e.target.files?.[0]
                            if (f) {
                              setReplacingId(book.id)
                              handleReplace(book.id, f)
                            }
                            e.target.value = ''
                          }}
                        />
                      </label>

                      {/* Delete */}
                      {isDeleting ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(book.id)}
                            disabled={deleting}
                            className="p-1.5 rounded-md text-red-500 hover:bg-red-500/10 transition-all text-xs font-medium"
                          >
                            {deleting ? (
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              t('common:confirm')
                            )}
                          </button>
                          <button
                            onClick={() => setDeleteId(null)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-all text-xs"
                          >
                            {t('common:cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={readOnly ? undefined : () => setDeleteId(book.id)}
                          disabled={readOnly}
                          className={`p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                          aria-label={t('books:deleteBook', { name: book.name })}
                          title={readOnly ? t('campaign:readOnlyTooltip') : t('common:delete')}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
