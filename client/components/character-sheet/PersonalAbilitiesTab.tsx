'use client'

import { useTranslation } from 'react-i18next'
import { InlineClickEdit } from '@/components/character-sheet'
import type { TemplateCharacterSection, SectionEntry, SheetPermissions } from './types'
import type { SubmitEvent } from 'react'

interface PersonalAbilitiesTabProps {
  readonly sections: TemplateCharacterSection[]
  readonly entries: SectionEntry[]
  readonly permissions: SheetPermissions
  readonly toSingular: (name: string) => string
  readonly expandedEntries: Record<string, boolean>
  readonly setExpandedEntries: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  readonly handleUpdateEntry: (entryId: string, field: 'name' | 'description', value: string) => Promise<void>
  readonly handleDeleteEntry: (entryId: string) => Promise<void>
  readonly showNewEntry: string | null
  readonly setShowNewEntry: React.Dispatch<React.SetStateAction<string | null>>
  readonly newEntryForm: { name: string; description: string }
  readonly setNewEntryForm: React.Dispatch<React.SetStateAction<{ name: string; description: string }>>
  readonly handleCreateEntry: (sectionId: string, e: SubmitEvent) => Promise<void>
  readonly saving: boolean
  readonly resetForm: () => void
}

export function PersonalAbilitiesTab({
  sections, entries, permissions, toSingular,
  expandedEntries, setExpandedEntries,
  handleUpdateEntry, handleDeleteEntry,
  showNewEntry, setShowNewEntry,
  newEntryForm, setNewEntryForm,
  handleCreateEntry, saving, resetForm,
}: Readonly<PersonalAbilitiesTabProps>) {
  const { t } = useTranslation()
  const canEditPersonalAbilities = permissions.canEditPersonalAbilities
  if (sections.length === 0) {
    return (
      <div className="card !p-6 animate-slide-up">
        <div className="text-center py-8 text-muted-foreground">
          <svg className="w-10 h-10 mx-auto text-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p className="text-sm italic mb-1">{t('character:noCharacterSectionsConfigured')}</p>
          <p className="text-xs text-muted">{t('character:askGmDefineSections')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {sections.map(section => {
        const sectionEntries = entries.filter(e => e.sectionId === section.id)
        const singular = toSingular(section.name)
        return (
          <div key={section.id} className="card !p-6 space-y-4">
            {/* Section header with gold accent */}
            <div className="header-accent">
              <h3 className="text-lg font-semibold text-gradient">{section.name}</h3>
            </div>

            {/* Empty state */}
            {sectionEntries.length === 0 && showNewEntry !== section.id && (
              <div className="text-center py-6 text-muted-foreground">
                <svg className="w-8 h-8 mx-auto text-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                </svg>
                <p className="text-sm italic">{t('character:noEntriesYet')}</p>
                {canEditPersonalAbilities && (
                  <button
                    onClick={() => setShowNewEntry(section.id)}
                    className="btn-primary text-xs mt-3"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    {t('character:addEntry', { singular })}
                  </button>
                )}
              </div>
            )}

            {/* Entries list */}
            {sectionEntries.length > 0 && (
              <div className="space-y-2">
                {sectionEntries.map((entry, idx) => {
                  const isExpanded = expandedEntries[entry.id] ?? false
                  let descriptionElement: React.JSX.Element = (
                    <p className="text-sm text-muted italic">{t('character:noDescription')}</p>
                  )
                  if (canEditPersonalAbilities) {
                    descriptionElement = (
                      <InlineClickEdit
                        value={entry.description ?? ''}
                        onSave={(v) => handleUpdateEntry(entry.id, 'description', v)}
                        as="textarea"
                        className="text-sm text-muted-foreground whitespace-pre-wrap"
                        emptyDisplay={t('character:addDescriptionPlaceholder')}
                        rows={2}
                      />
                    )
                  } else if (entry.description) {
                    descriptionElement = (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.description}</p>
                    )
                  }
                  return (
                    <div
                      key={entry.id}
                      className={`rounded-lg border transition-all duration-200 ${
                        isExpanded
                          ? 'border-primary/20 bg-background/40'
                          : 'border-border bg-background/20 hover:bg-foreground/5'
                      }`}
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                      {/* Entry header */}
                      <button
                        type="button"
                        onClick={() => setExpandedEntries(p => ({ ...p, [entry.id]: !p[entry.id] }))}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      >
                        <svg
                          className={`w-3.5 h-3.5 text-muted transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                        </svg>
                        <span className="text-sm font-medium flex-1 truncate">
                          {canEditPersonalAbilities ? (
                            <InlineClickEdit
                              value={entry.name}
                              onSave={(v) => handleUpdateEntry(entry.id, 'name', v)}
                              className="!text-sm !font-medium"
                              inputClassName="!text-sm"
                            />
                          ) : entry.name}
                        </span>
                        {canEditPersonalAbilities && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); handleDeleteEntry(entry.id) }}
                            className="text-muted hover:text-danger p-1 transition-colors shrink-0"
                            title={t('character:deleteEntryTitle')}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        )}
                      </button>

                      {/* Expanded description */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-3 border-t border-border animate-fade-in">
                          <h5 className="text-xs font-medium text-muted mb-1.5">{t('common:description')}</h5>
                          {descriptionElement}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* New entry button or form */}
            {canEditPersonalAbilities && showNewEntry !== section.id && sectionEntries.length > 0 && (
              <button
                onClick={() => setShowNewEntry(section.id)}
                className="btn-primary text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                </svg>
                {t('character:newEntry', { singular })}
              </button>
            )}

            {canEditPersonalAbilities && showNewEntry === section.id && (
              <form onSubmit={(e) => handleCreateEntry(section.id, e)} className="card !p-5 space-y-4 border-primary/20 mt-4">
                <div className="header-accent">
                  <h4 className="text-sm font-semibold text-gradient">{t('character:newEntry', { singular })}</h4>
                </div>
                <div>
                  <label htmlFor={`new-${section.id}-name`} className="label">{t('common:name')}</label>
                  <input
                    id={`new-${section.id}-name`}
                    className="input-field"
                    value={newEntryForm.name}
                    onChange={e => setNewEntryForm(p => ({ ...p, name: e.target.value }))}
                    required
                    placeholder={t('character:entryNamePlaceholder', { singular })}
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor={`new-${section.id}-desc`} className="label">{t('common:description')}</label>
                  <textarea
                    id={`new-${section.id}-desc`}
                    className="input-field resize-none"
                    rows={3}
                    value={newEntryForm.description}
                    onChange={e => setNewEntryForm(p => ({ ...p, description: e.target.value }))}
                    placeholder={t('character:describeEntryPlaceholder', { singular: singular.toLowerCase() })}
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2 border-t border-border/40">
                  <button type="button" onClick={resetForm} disabled={saving} className="btn-ghost text-sm">{t('common:cancel')}</button>
                  <button type="submit" disabled={saving || !newEntryForm.name.trim()} className="btn-primary text-sm">
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                        {t('character:creating')}
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                        </svg>
                        {t('character:createEntry', { singular })}
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )
      })}
    </div>
  )
}
