'use client'

import { InlineTextarea } from '@/lib/inline-editable'
import { StoryField } from '@/components/character-sheet'
import type { Story, SheetPermissions } from './types'

export function StoryTab({
  story,
  permissions,
  onSaveField,
}: {
  story: Story | null
  permissions: SheetPermissions
  onSaveField: (field: string, value: string) => Promise<void>
}) {
  const canEditStory = permissions.canEditStory
  return (
    <div className="space-y-4 animate-slide-up">
      {/* Appearance */}
      <div className="card !p-6 space-y-4">
        <div className="header-accent">
          <h2 className="text-lg font-semibold text-gradient">Appearance</h2>
        </div>
        {canEditStory ? (
          <InlineTextarea
            value={story?.appearance ?? ''}
            label="Appearance"
            onSave={(v) => onSaveField('appearance', v)}
            rows={3}
            emptyDisplay="Describe your character's appearance..."
          />
        ) : (
          <StoryField label="Appearance" value={story?.appearance} />
        )}
      </div>

      {/* Backstory */}
      <div className="card !p-6 space-y-4">
        <div className="header-accent">
          <h2 className="text-lg font-semibold text-gradient">Backstory</h2>
        </div>
        {canEditStory ? (
          <InlineTextarea
            value={story?.backstory ?? ''}
            label="Backstory"
            onSave={(v) => onSaveField('backstory', v)}
            rows={5}
            emptyDisplay="Write your character's backstory..."
          />
        ) : (
          <StoryField label="Backstory" value={story?.backstory} />
        )}
      </div>

      {/* Personality */}
      <div className="card !p-6 space-y-4">
        <div className="header-accent">
          <h2 className="text-lg font-semibold text-gradient">Personality</h2>
        </div>
        {canEditStory ? (
          <InlineTextarea
            value={story?.personality ?? ''}
            label="Personality"
            onSave={(v) => onSaveField('personality', v)}
            rows={3}
            emptyDisplay="Describe your character's personality..."
          />
        ) : (
          <StoryField label="Personality" value={story?.personality} />
        )}
      </div>

      {/* Goals */}
      <div className="card !p-6 space-y-4">
        <div className="header-accent">
          <h2 className="text-lg font-semibold text-gradient">Goals</h2>
        </div>
        {canEditStory ? (
          <InlineTextarea
            value={story?.goals ?? ''}
            label="Goals"
            onSave={(v) => onSaveField('goals', v)}
            rows={3}
            emptyDisplay="What are your character's goals..."
          />
        ) : (
          <StoryField label="Goals" value={story?.goals} />
        )}
      </div>

      {/* Notes */}
      <div className="card !p-6 space-y-4">
        <div className="header-accent">
          <h2 className="text-lg font-semibold text-gradient">Notes</h2>
        </div>
        {canEditStory ? (
          <InlineTextarea
            value={story?.notes ?? ''}
            label="Notes"
            onSave={(v) => onSaveField('notes', v)}
            rows={3}
            emptyDisplay="Add any additional notes..."
          />
        ) : (
          <StoryField label="Notes" value={story?.notes} />
        )}
      </div>
    </div>
  )
}
