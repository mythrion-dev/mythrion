'use client'

import type { FormEvent } from 'react'

interface Template {
  id: string; name: string; description: string | null
}
interface CampaignCharacter {
  id: string; characterName: string; adventure: { id: string; name: string; campaign: string }
  template: { id: string; name: string }; owner: { id: string; displayName: string | null; email: string }; createdAt: string
}
interface UserSheet {
  id: string; characterName: string; adventure: { id: string; name: string; campaign: string }
  template: { id: string; name: string }; createdAt: string
}

export function CharactersSection({
  characters,
  isGM,
  userId,
  templates,
  userSheets,
  showNewCharForm,
  showLinkCharForm,
  newCharName,
  newCharTemplateId,
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
  onNewCharTemplateChange,
  onLinkSheetChange,
  onRemoveCharacter,
  onViewCharacter,
}: {
  characters: CampaignCharacter[]
  isGM: boolean
  userId: string
  templates: Template[]
  userSheets: UserSheet[]
  showNewCharForm: boolean
  showLinkCharForm: boolean
  newCharName: string
  newCharTemplateId: string
  newCharError: string | null
  newCharCreating: boolean
  linkSheetId: string
  linkCharError: string | null
  linkCharLinking: boolean
  onNewCharClick: () => void
  onLinkCharClick: () => void
  onCancelNewChar: () => void
  onCancelLinkChar: () => void
  onCreateCharacter: (e: FormEvent) => void
  onLinkCharacter: (e: FormEvent) => void
  onNewCharNameChange: (v: string) => void
  onNewCharTemplateChange: (v: string) => void
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
                  {c.owner.displayName ?? c.owner.email}
                </p>
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <button
                  onClick={() => onViewCharacter(c.id)}
                  className="btn-ghost text-xs px-2 py-1"
                >
                  View
                </button>
                {isGM && c.owner.id !== userId && (
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

          <div>
            <label className="label">Template</label>
            {templates.length === 0 ? (
              <p className="text-sm text-muted italic">
                No templates available. Ask your GM to create one.
              </p>
            ) : (
              <select
                className="input-field"
                value={newCharTemplateId}
                onChange={e => onNewCharTemplateChange(e.target.value)}
                required
              >
                <option value="">Select a template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
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
              disabled={newCharCreating || !newCharName.trim() || !newCharTemplateId}
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
                required
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
