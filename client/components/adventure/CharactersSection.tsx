'use client'

import type { SubmitEvent } from 'react'

interface CampaignCharacter {
  id: string; characterName: string; adventure: { id: string; name: string; campaign: string }
  template: { id: string; name: string }; owner: { id: string; displayName: string | null; email: string } | null; createdAt: string
}
interface UserSheet {
  id: string; characterName: string; adventure: { id: string; name: string; campaign: string }
  template: { id: string; name: string }; createdAt: string
}

export function CharactersSection({
  characters,
  isGM,
  userId,
  snapshotName,
  userSheets,
  showNewCharForm,
  showLinkCharForm,
  newCharName,
  newCharError,
  newCharCreating,
  linkSheetId,
  linkCharError,
  linkCharLinking,
  onNewCharClick,
  onLinkCharClick,
  onCancelNewChar,
  onCancelLinkChar,
  onCreateCharacter,
  onLinkCharacter,
  onNewCharNameChange,
  onLinkSheetChange,
  onRemoveCharacter,
  onViewCharacter,
}: {
  characters: CampaignCharacter[]
  isGM: boolean
  userId: string
  snapshotName: string | null
  userSheets: UserSheet[]
  showNewCharForm: boolean
  showLinkCharForm: boolean
  newCharName: string
  newCharError: string | null
  newCharCreating: boolean
  linkSheetId: string
  linkCharError: string | null
  linkCharLinking: boolean
  onNewCharClick: () => void
  onLinkCharClick: () => void
  onCancelNewChar: () => void
  onCancelLinkChar: () => void
  onCreateCharacter: (e: SubmitEvent) => void
  onLinkCharacter: (e: SubmitEvent) => void
  onNewCharNameChange: (v: string) => void
  onLinkSheetChange: (v: string) => void
  onRemoveCharacter: (id: string) => void
  onViewCharacter: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      {/* Character list */}
      {characters.length === 0 && !showNewCharForm && !showLinkCharForm ? (
        <div className="text-center py-6 text-muted-foreground text-sm italic">
          No characters in this campaign yet.
        </div>
      ) : (
        <div className="space-y-2">
          {characters.map(c => (
            <div key={c.id} className="data-row">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {c.characterName}
                  </span>
                  <span className="badge badge-gold text-[0.6rem]">{c.template.name}</span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {c.owner?.displayName ?? c.owner?.email ?? 'Unknown'}
                </p>
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <button
                  onClick={() => onViewCharacter(c.id)}
                  className="btn-ghost text-xs px-2 py-1"
                >
                  View
                </button>
                {isGM && (c.owner?.id ?? '') !== userId && (
                  <button
                    onClick={() => onRemoveCharacter(c.id)}
                    className="text-xs text-danger hover:text-danger/80 px-2 py-1 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {!showNewCharForm && !showLinkCharForm && (
        <div className="flex gap-2">
          <button onClick={onNewCharClick} className="btn-primary text-sm">
            + New Character
          </button>
          <button onClick={onLinkCharClick} className="btn-ghost text-sm">
            Link Existing Character
          </button>
        </div>
      )}

      {/* Create new character form */}
      {showNewCharForm && (
        <form
          onSubmit={onCreateCharacter}
          className="rounded-lg border border-primary/20 bg-background/50 p-4 space-y-3"
        >
          <h4 className="text-sm font-semibold text-primary">Create New Character</h4>

          <div>
            <label className="label">Character Name</label>
            <input
              className="input-field"
              value={newCharName}
              onChange={e => onNewCharNameChange(e.target.value)}
              placeholder="e.g. Aragorn"
              maxLength={100}
              required
            />
          </div>

          {/* Snapshot-based template info */}
          <div>
            <label className="label">Template</label>
            {snapshotName ? (
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-secondary/40 border border-border/40 text-sm text-foreground">
                <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{snapshotName}</span>
              </div>
            ) : (
              <p className="text-sm text-muted italic">
                No template is attached to this campaign. Ask the GM to attach one before creating a character.
              </p>
            )}
          </div>

          {newCharError && (
            <div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">
              {newCharError}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancelNewChar}
              disabled={newCharCreating}
              className="btn-ghost text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={newCharCreating || !newCharName.trim() || !snapshotName}
              className="btn-primary text-sm"
            >
              {newCharCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {/* Link existing character form */}
      {showLinkCharForm && (
        <form
          onSubmit={onLinkCharacter}
          className="rounded-lg border border-primary/20 bg-background/50 p-4 space-y-3"
        >
          <h4 className="text-sm font-semibold text-primary">Link Existing Character</h4>

          <div>
            <label className="label">Select Character</label>
            {userSheets.length === 0 ? (
              <p className="text-sm text-muted italic">No unlinked characters available.</p>
            ) : (
              <select
                className="input-field"
                value={linkSheetId}
                onChange={e => onLinkSheetChange(e.target.value)}
              >
                <option value="">Select a character...</option>
                {userSheets.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.characterName} ({s.template.name})
                  </option>
                ))}
              </select>
            )}
          </div>

          {linkCharError && (
            <div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">
              {linkCharError}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancelLinkChar}
              disabled={linkCharLinking}
              className="btn-ghost text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={linkCharLinking || !linkSheetId}
              className="btn-primary text-sm"
            >
              {linkCharLinking ? 'Linking...' : 'Link'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
