'use client'

import { InlineClickEdit } from '@/components/character-sheet'
import type { TemplateCharacterSection, SectionEntry } from './types'
import type { FormEvent } from 'react'

export function PersonalAbilitiesTab({
  sections, entries, isOwner, toSingular,
  expandedEntries, setExpandedEntries,
  handleUpdateEntry, handleDeleteEntry,
  showNewEntry, setShowNewEntry,
  newEntryForm, setNewEntryForm,
  handleCreateEntry, saving, resetForm,
}: {
  sections: TemplateCharacterSection[]; entries: SectionEntry[]; isOwner: boolean
  toSingular: (name: string) => string
  expandedEntries: Record<string, boolean>
  setExpandedEntries: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  handleUpdateEntry: (entryId: string, field: 'name' | 'description', value: string) => Promise<void>
  handleDeleteEntry: (entryId: string) => Promise<void>
  showNewEntry: string | null
  setShowNewEntry: React.Dispatch<React.SetStateAction<string | null>>
  newEntryForm: { name: string; description: string }
  setNewEntryForm: React.Dispatch<React.SetStateAction<{ name: string; description: string }>>
  handleCreateEntry: (sectionId: string, e: FormEvent) => Promise<void>
  saving: boolean
  resetForm: () => void
}) {
  if (sections.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm italic">
        No character sections configured. Ask your GM to define sections in the Sheet Template.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {sections.map(section => {
        const sectionEntries = entries.filter(e => e.sectionId === section.id)
        const singular = toSingular(section.name)
        return (
          <div key={section.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border/50" />
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider shrink-0">{section.name}</h3>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {sectionEntries.length === 0 && showNewEntry !== section.id && (
              <div className="text-center py-4 text-muted-foreground text-sm italic">
                No entries yet.
              </div>
            )}

            <div className="space-y-1.5">
              {sectionEntries.map(entry => {
                const isExpanded = expandedEntries[entry.id] ?? false
                return (
                  <div key={entry.id} className="rounded-lg border border-border bg-background/30 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedEntries(p => ({ ...p, [entry.id]: !p[entry.id] }))}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-foreground/5 transition-colors"
                    >
                      <svg className={`w-3.5 h-3.5 text-muted transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                      </svg>
                      <span className="text-sm font-medium flex-1 truncate">
                        {isOwner ? (
                          <InlineClickEdit value={entry.name} onSave={(v) => handleUpdateEntry(entry.id, 'name', v)} className="!text-sm !font-medium" inputClassName="!text-sm" />
                        ) : entry.name}
                      </span>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleDeleteEntry(entry.id) }}
                          className="text-xs text-danger hover:text-danger/80 px-1 py-0.5 transition-colors shrink-0"
                        >
                          Delete
                        </button>
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-2 border-t border-border animate-fade-in">
                        <h5 className="text-xs font-medium text-muted mb-1">Description</h5>
                        {isOwner ? (
                          <InlineClickEdit value={entry.description ?? ''} onSave={(v) => handleUpdateEntry(entry.id, 'description', v)} as="textarea" className="text-sm text-muted-foreground whitespace-pre-wrap" emptyDisplay="Add description..." rows={2} />
                        ) : (
                          entry.description ? <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.description}</p> : <p className="text-sm text-muted italic">No description.</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {isOwner && showNewEntry !== section.id && (
              <button onClick={() => setShowNewEntry(section.id)} className="btn-primary text-sm">
                + New {singular}
              </button>
            )}
            {isOwner && showNewEntry === section.id && (
              <form onSubmit={(e) => handleCreateEntry(section.id, e)} className="card !p-4 space-y-3 border-primary/20">
                <h4 className="text-sm font-semibold text-primary">New {singular}</h4>
                <div>
                  <label className="text-xs text-muted">Name</label>
                  <input className="input-field" value={newEntryForm.name} onChange={e => setNewEntryForm(p => ({ ...p, name: e.target.value }))} required placeholder={`e.g. ${singular} name`} />
                </div>
                <div>
                  <label className="text-xs text-muted">Description</label>
                  <textarea className="input-field resize-none" rows={3} value={newEntryForm.description} onChange={e => setNewEntryForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the entry..." />
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={resetForm} disabled={saving} className="btn-ghost text-sm">Cancel</button>
                  <button type="submit" disabled={saving || !newEntryForm.name.trim()} className="btn-primary text-sm">{saving ? 'Creating...' : 'Create'}</button>
                </div>
              </form>
            )}
          </div>
        )
      })}
    </div>
  )
}
