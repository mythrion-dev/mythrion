'use client'

import { useTranslation } from 'react-i18next'
import type { SubmitEvent } from 'react'

interface AssignedMember {
  id: string
  user: { id: string; displayName: string | null; email: string } | null
}
interface CampaignCharacter {
  id: string; characterName: string; adventure: { id: string; name: string; campaign: string }
  template: { id: string; name: string }; owner: { id: string; displayName: string | null; email: string } | null; createdAt: string
  assignedMember: AssignedMember | null
}
interface CampaignPlayer {
  id: string; role: string; user: { id: string; email: string; displayName: string | null }
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
  players,
  showNewCharForm,
  showLinkCharForm,
  readOnly,
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
  onAssign,
  onRemoveAssignment,
}: {
  readonly characters: CampaignCharacter[]
  readonly isGM: boolean
  readonly readOnly?: boolean
  readonly userId: string
  readonly snapshotName: string | null
  readonly userSheets: UserSheet[]
  readonly players: ReadonlyArray<CampaignPlayer>
  readonly showNewCharForm: boolean
  readonly showLinkCharForm: boolean
  readonly newCharName: string
  readonly newCharError: string | null
  readonly newCharCreating: boolean
  readonly linkSheetId: string
  readonly linkCharError: string | null
  readonly linkCharLinking: boolean
  readonly onNewCharClick: () => void
  readonly onLinkCharClick: () => void
  readonly onCancelNewChar: () => void
  readonly onCancelLinkChar: () => void
  readonly onCreateCharacter: (e: SubmitEvent) => void
  readonly onLinkCharacter: (e: SubmitEvent) => void
  readonly onNewCharNameChange: (v: string) => void
  readonly onLinkSheetChange: (v: string) => void
  readonly onRemoveCharacter: (id: string) => void
  readonly onViewCharacter: (id: string) => void
  readonly onAssign: (id: string) => void
  readonly onRemoveAssignment: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      {/* Character list */}
      {characters.length === 0 && !showNewCharForm && !showLinkCharForm ? (
        <div className="text-center py-6 text-muted-foreground text-sm italic">
          {t('campaign:noCharactersYet')}
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
                  {c.owner?.displayName ?? c.owner?.email ?? t('campaign:unknownUser')}
                </p>
                {isGM && (
                  <p className="text-xs mt-0.5">
                    {c.assignedMember?.user?.displayName ?? c.assignedMember?.user?.email ? (
                      <span className="text-muted">{t('campaign:assignedTo', { name: c.assignedMember?.user?.displayName ?? c.assignedMember?.user?.email })}</span>
                    ) : (
                      <span className="text-muted italic">{t('campaign:notAssigned')}</span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <button
                  onClick={() => onViewCharacter(c.id)}
                  className="btn-ghost text-xs px-2 py-1"
                >
                  {t('common:view')}
                </button>
                {isGM && (
                  <button
                    onClick={readOnly ? undefined : () => onAssign(c.id)}
                    disabled={readOnly}
                    title={readOnly ? t('campaign:readOnlyTooltip') : undefined}
                    className={`btn-ghost text-xs px-2 py-1 ${readOnly ? '!opacity-50 !cursor-not-allowed' : ''}`}
                  >
                    {c.assignedMember ? t('campaign:changeAssignment') : t('campaign:assign')}
                  </button>
                )}
                {isGM && (c.owner?.id ?? '') !== userId && (
                  <button
                    onClick={readOnly ? undefined : () => onRemoveCharacter(c.id)}
                    disabled={readOnly}
                    title={readOnly ? t('campaign:readOnlyTooltip') : undefined}
                    className={`text-xs text-danger px-2 py-1 transition-colors ${readOnly ? 'opacity-50 cursor-not-allowed' : 'hover:text-danger/80'}`}
                  >
                    {t('common:remove')}
                  </button>
                )}
                {isGM && c.assignedMember && (
                  <button
                    onClick={readOnly ? undefined : () => onRemoveAssignment(c.id)}
                    disabled={readOnly}
                    title={readOnly ? t('campaign:readOnlyTooltip') : undefined}
                    className={`text-xs text-danger px-2 py-1 transition-colors ${readOnly ? 'opacity-50 cursor-not-allowed' : 'hover:text-danger/80'}`}
                  >
                    {t('campaign:removeAssignment')}
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
          <button
            onClick={readOnly ? undefined : onNewCharClick}
            disabled={readOnly}
            title={readOnly ? t('campaign:readOnlyTooltip') : undefined}
            className={`btn-primary text-sm ${readOnly ? '!opacity-50 !cursor-not-allowed' : ''}`}
          >
            {t('campaign:newCharacter')}
          </button>
          <button
            onClick={readOnly ? undefined : onLinkCharClick}
            disabled={readOnly}
            title={readOnly ? t('campaign:readOnlyTooltip') : undefined}
            className={`btn-ghost text-sm ${readOnly ? '!opacity-50 !cursor-not-allowed' : ''}`}
          >
            {t('campaign:linkExistingCharacter')}
          </button>
        </div>
      )}

      {/* Create new character form */}
      {showNewCharForm && !readOnly && (
        <form
          onSubmit={onCreateCharacter}
          className="rounded-lg border border-primary/20 bg-background/50 p-4 space-y-3"
        >
          <h4 className="text-sm font-semibold text-primary">{t('campaign:createNewCharacter')}</h4>

          <div>
            <label className="label">{t('campaign:characterName')}</label>
            <input
              className="input-field"
              value={newCharName}
              onChange={e => onNewCharNameChange(e.target.value)}
              placeholder={t('campaign:charNamePlaceholder')}
              maxLength={100}
              required
            />
          </div>

          {/* Snapshot-based template info */}
          <div>
            <label className="label">{t('campaign:template')}</label>
            {snapshotName ? (
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-secondary/40 border border-border/40 text-sm text-foreground">
                <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{snapshotName}</span>
              </div>
            ) : (
              <p className="text-sm text-muted italic">
                {t('campaign:noTemplateAttached')}
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
              {t('common:cancel')}
            </button>
            <button
              type="submit"
              disabled={newCharCreating || !newCharName.trim() || !snapshotName}
              className="btn-primary text-sm"
            >
              {newCharCreating ? t('campaign:creating') : t('campaign:create')}
            </button>
          </div>
        </form>
      )}

      {/* Link existing character form */}
      {showLinkCharForm && !readOnly && (
        <form
          onSubmit={onLinkCharacter}
          className="rounded-lg border border-primary/20 bg-background/50 p-4 space-y-3"
        >
          <h4 className="text-sm font-semibold text-primary">{t('campaign:linkExistingCharacter')}</h4>

          <div>
            <label className="label">{t('campaign:selectCharacter')}</label>
            {userSheets.length === 0 ? (
              <p className="text-sm text-muted italic">{t('campaign:noUnlinkedCharacters')}</p>
            ) : (
              <select
                className="input-field"
                value={linkSheetId}
                onChange={e => onLinkSheetChange(e.target.value)}
              >
                <option value="">{t('campaign:selectCharacterPlaceholder')}</option>
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
              {t('common:cancel')}
            </button>
            <button
              type="submit"
              disabled={linkCharLinking || !linkSheetId}
              className="btn-primary text-sm"
            >
              {linkCharLinking ? t('campaign:linking') : t('campaign:link')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
