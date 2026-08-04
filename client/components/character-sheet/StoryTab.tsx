'use client'

import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const canEditStory = permissions.canEditStory
  return (
    <div className="space-y-4 animate-slide-up">
      {/* Appearance */}
      <div className="card !p-6 space-y-4">
        <div className="header-accent">
          <h2 className="text-lg font-semibold text-gradient">{t('character:storyAppearance')}</h2>
        </div>
        {canEditStory ? (
          <InlineTextarea
            value={story?.appearance ?? ''}
            label={t('character:storyAppearance')}
            onSave={(v) => onSaveField('appearance', v)}
            rows={3}
            emptyDisplay={t('character:storyAppearancePlaceholder')}
          />
        ) : (
          <StoryField label={t('character:storyAppearance')} value={story?.appearance} />
        )}
      </div>

      {/* Backstory */}
      <div className="card !p-6 space-y-4">
        <div className="header-accent">
          <h2 className="text-lg font-semibold text-gradient">{t('character:storyBackstory')}</h2>
        </div>
        {canEditStory ? (
          <InlineTextarea
            value={story?.backstory ?? ''}
            label={t('character:storyBackstory')}
            onSave={(v) => onSaveField('backstory', v)}
            rows={5}
            emptyDisplay={t('character:storyBackstoryPlaceholder')}
          />
        ) : (
          <StoryField label={t('character:storyBackstory')} value={story?.backstory} />
        )}
      </div>

      {/* Personality */}
      <div className="card !p-6 space-y-4">
        <div className="header-accent">
          <h2 className="text-lg font-semibold text-gradient">{t('character:storyPersonality')}</h2>
        </div>
        {canEditStory ? (
          <InlineTextarea
            value={story?.personality ?? ''}
            label={t('character:storyPersonality')}
            onSave={(v) => onSaveField('personality', v)}
            rows={3}
            emptyDisplay={t('character:storyPersonalityPlaceholder')}
          />
        ) : (
          <StoryField label={t('character:storyPersonality')} value={story?.personality} />
        )}
      </div>

      {/* Goals */}
      <div className="card !p-6 space-y-4">
        <div className="header-accent">
          <h2 className="text-lg font-semibold text-gradient">{t('character:storyGoals')}</h2>
        </div>
        {canEditStory ? (
          <InlineTextarea
            value={story?.goals ?? ''}
            label={t('character:storyGoals')}
            onSave={(v) => onSaveField('goals', v)}
            rows={3}
            emptyDisplay={t('character:storyGoalsPlaceholder')}
          />
        ) : (
          <StoryField label={t('character:storyGoals')} value={story?.goals} />
        )}
      </div>

      {/* Notes */}
      <div className="card !p-6 space-y-4">
        <div className="header-accent">
          <h2 className="text-lg font-semibold text-gradient">{t('character:storyNotes')}</h2>
        </div>
        {canEditStory ? (
          <InlineTextarea
            value={story?.notes ?? ''}
            label={t('character:storyNotes')}
            onSave={(v) => onSaveField('notes', v)}
            rows={3}
            emptyDisplay={t('character:storyNotesPlaceholder')}
          />
        ) : (
          <StoryField label={t('character:storyNotes')} value={story?.notes} />
        )}
      </div>
    </div>
  )
}
