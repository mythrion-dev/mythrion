import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/* ── Mock api module ── */
const mockApiGet = vi.fn()
vi.mock('@/lib/api', () => ({
  api: { get: (...args: unknown[]) => mockApiGet(...args) },
}))

/* ── Mock sub-components used by TemplatesSection ── */
vi.mock('@/components/adventure/TemplateRow', () => ({
  TemplateRow: (props: any) => (
    <div data-testid="template-row">
      <span data-testid="template-name">{props.template.name}</span>
      {props.isEditing && <span data-testid="editing-template" />}
      {props.isGM && (
        <>
          <button data-testid="start-edit-btn" onClick={props.onStartEdit}>
            Edit
          </button>
          <button data-testid="delete-template-btn" onClick={props.onDelete}>
            Delete
          </button>
        </>
      )}
    </div>
  ),
}))

vi.mock('@/components/adventure/TemplateForm', () => ({
  TemplateForm: (props: any) => (
    <form data-testid="template-form" onSubmit={props.onCreateTemplate}>
      <span>{props.templateCreating ? 'Creating...' : 'New Template Form'}</span>
      <input
        data-testid="template-form-name"
        value={props.newTemplateName}
        onChange={(e) => props.onNameChange(e.target.value)}
      />
      <input
        data-testid="template-form-desc"
        value={props.newTemplateDescription}
        onChange={(e) => props.onDescriptionChange(e.target.value)}
      />
      {props.templateError && <span data-testid="template-form-error">{props.templateError}</span>}
      <button type="submit" data-testid="template-form-submit" disabled={props.templateCreating}>
        {props.templateCreating ? 'Creating...' : 'Create Template'}
      </button>
      <button type="button" data-testid="template-form-cancel" onClick={props.onCancelNew}>
        Cancel
      </button>
      {/* Feature toggle checkboxes */}
      <label>
        <input
          type="checkbox"
          checked={props.newFeatureSkills}
          onChange={(e) => props.onNewFeatureSkillsChange(e.target.checked)}
        />
        Skills
      </label>
      <label>
        <input
          type="checkbox"
          checked={props.newFeatureCustomFields}
          onChange={(e) => props.onNewFeatureCustomFieldsChange(e.target.checked)}
        />
        Custom Fields
      </label>
    </form>
  ),
}))

vi.mock('@/components/shared/EmptyState', () => ({
  EmptyState: ({ icon, title, description, actionLabel, onAction }: any) => (
    <div data-testid="empty-state">
      <span data-testid="empty-state-icon">{icon}</span>
      <h3 data-testid="empty-state-title">{title}</h3>
      <p data-testid="empty-state-desc">{description}</p>
      {actionLabel && (
        <button data-testid="empty-state-action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  ),
}))

/* ── Import components under test ── */
import { AdventureHeader } from '@/components/adventure/AdventureHeader'
import { CharactersSection } from '@/components/adventure/CharactersSection'
import { InvitePanel } from '@/components/adventure/InvitePanel'
import { MemberRow } from '@/components/adventure/MemberRow'
import { NpcsMobsSection } from '@/components/adventure/NpcsMobsSection'
import { TemplatesSection } from '@/components/adventure/TemplatesSection'

/* ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
            Helper factories
   ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── */

const baseAdventure = {
  id: 'adv-1',
  name: 'The Lost Mines',
  campaign: 'Phandelver',
  synopsis: 'A grand adventure begins.',
  maxPlayers: 4,
  ownerId: 'owner-1',
  createdAt: '2025-01-15T00:00:00Z',
  updatedAt: '2025-01-15T00:00:00Z',
}

const baseMember = {
  id: 'mem-1',
  role: 'PLAYER' as const,
  joinedAt: '2025-01-15T00:00:00Z',
  user: { id: 'user-1', email: 'player@test.com', displayName: 'HeroPlayer' },
}

function makeCharacter(overrides = {}) {
  return {
    id: 'char-1',
    characterName: 'Aragorn',
    adventure: { id: 'adv-1', name: 'The Lost Mines', campaign: 'Phandelver' },
    template: { id: 'tmpl-1', name: 'Fighter' },
    owner: { id: 'user-1', displayName: 'HeroPlayer', email: 'player@test.com' },
    createdAt: '2025-01-15T00:00:00Z',
    ...overrides,
  }
}

function makeTemplate(overrides = {}) {
  return {
    id: 't-1',
    name: 'Basic',
    description: 'A basic template',
    attributes: [{ id: 'a1', key: 'str', name: 'Strength' }],
    createdAt: '2025-01-15T00:00:00Z',
    ...overrides,
  }
}

function makeNpc(overrides = {}) {
  return {
    id: 'npc-1',
    characterName: 'Goblin Scout',
    isNpc: true,
    npcType: 'NPC',
    level: 3,
    hpActual: 12,
    hpMax: 12,
    createdAt: '2025-01-15T00:00:00Z',
    template: { id: 'tmpl-1', name: 'Goblin' },
    ...overrides,
  }
}

function makeInvitation(overrides = {}) {
  return {
    id: 'inv-1',
    invitedEmail: 'test@test.com',
    token: 'abc123',
    role: 'PLAYER',
    status: 'PENDING',
    expiresAt: '2025-06-01T00:00:00Z',
    createdAt: '2025-01-16T00:00:00Z',
    createdBy: { id: 'gm-1', displayName: 'GMaster', email: 'gm@test.com' },
    ...overrides,
  }
}

function defaultTemplatesProps(overrides = {}) {
  const hp = vi.fn()
  return {
    templates: [] as any[],
    isGM: true,
    showNewTemplate: false,
    editingTemplateId: null,
    newTemplateName: '',
    newTemplateDescription: '',
    newTemplateAttrs: [] as any[],
    newAttrModifierFormula: '',
    newSkillFormula: '',
    templateError: null,
    templateCreating: false,
    editTemplateName: '',
    editTemplateDescription: '',
    editTemplateAttrs: [] as any[],
    editAttrModifierFormula: '',
    editSkillFormula: '',
    editingTemplateError: null,
    templateSaving: false,
    onNewClick: vi.fn(),
    onCancelNew: vi.fn(),
    onCreateTemplate: vi.fn(),
    onNameChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onAddAttr: vi.fn(),
    onRemoveAttr: vi.fn(),
    onUpdateAttr: vi.fn(),
    onStartEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onUpdateTemplate: vi.fn(),
    onDeleteTemplate: vi.fn(),
    onEditNameChange: vi.fn(),
    onEditDescriptionChange: vi.fn(),
    onAddEditAttr: vi.fn(),
    onRemoveEditAttr: vi.fn(),
    onUpdateEditAttr: vi.fn(),
    newFeatureSkills: false,
    onNewFeatureSkillsChange: vi.fn(),
    newFeatureCustomFields: false,
    onNewFeatureCustomFieldsChange: vi.fn(),
    newFeatureCoreResources: false,
    onNewFeatureCoreResourcesChange: vi.fn(),
    newFeatureArmorClass: false,
    onNewFeatureArmorClassChange: vi.fn(),
    newFeatureCharacterSections: false,
    onNewFeatureCharacterSectionsChange: vi.fn(),
    newFeatureSkillProfiles: false,
    onNewFeatureSkillProfilesChange: vi.fn(),
    newFeatureResistance: false,
    onNewFeatureResistanceChange: vi.fn(),
    editFeatureSkills: false,
    editFeatureCustomFields: false,
    editFeatureCoreResources: false,
    editFeatureArmorClass: false,
    editFeatureCharacterSections: false,
    editFeatureSkillProfiles: false,
    editFeatureResistance: false,
    ...overrides,
  }
}

/* ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
            AdventureHeader
   ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── */

describe('AdventureHeader', () => {
  const onEdit = vi.fn()
  const onDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders name, campaign, player count, and synopsis', () => {
    render(
      <AdventureHeader
        adventure={baseAdventure}
        isGM={false}
        userRole={null}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText('The Lost Mines')).toBeInTheDocument()
    expect(screen.getByText('Phandelver')).toBeInTheDocument()
    expect(screen.getByText(/4 players/)).toBeInTheDocument()
    expect(screen.getByText('A grand adventure begins.')).toBeInTheDocument()
  })

  it('shows 1 player label as singular', () => {
    render(
      <AdventureHeader
        adventure={{ ...baseAdventure, maxPlayers: 1 }}
        isGM={false}
        userRole={null}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText(/1 player/)).toBeInTheDocument()
  })

  it('displays user role badge when userRole is provided', () => {
    render(
      <AdventureHeader
        adventure={baseAdventure}
        isGM={false}
        userRole="PLAYER"
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText('PLAYER')).toBeInTheDocument()
  })

  it('does NOT show role badge when userRole is null', () => {
    render(
      <AdventureHeader
        adventure={baseAdventure}
        isGM={false}
        userRole={null}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    expect(screen.queryByText('PLAYER')).not.toBeInTheDocument()
    expect(screen.queryByText('GM')).not.toBeInTheDocument()
  })

  it('shows GM role badge with gold styling', () => {
    render(
      <AdventureHeader
        adventure={baseAdventure}
        isGM={true}
        userRole="GM"
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    const badge = screen.getByText('GM')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('badge-gold')
  })

  it('shows Edit and Delete buttons when isGM is true', () => {
    render(
      <AdventureHeader
        adventure={baseAdventure}
        isGM={true}
        userRole={null}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('hides Edit and Delete buttons when isGM is false', () => {
    render(
      <AdventureHeader
        adventure={baseAdventure}
        isGM={false}
        userRole={null}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
  })

  it('calls onEdit when Edit is clicked', async () => {
    render(
      <AdventureHeader
        adventure={baseAdventure}
        isGM={true}
        userRole={null}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    await userEvent.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledOnce()
  })

  it('calls onDelete when Delete is clicked', async () => {
    render(
      <AdventureHeader
        adventure={baseAdventure}
        isGM={true}
        userRole={null}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    await userEvent.click(screen.getByText('Delete'))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('shows empty synopsis state when synopsis is null', () => {
    render(
      <AdventureHeader
        adventure={{ ...baseAdventure, synopsis: null }}
        isGM={false}
        userRole={null}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText('No synopsis yet.')).toBeInTheDocument()
  })

  it('shows GM hint in empty synopsis when isGM', () => {
    render(
      <AdventureHeader
        adventure={{ ...baseAdventure, synopsis: null }}
        isGM={true}
        userRole={null}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText('No synopsis yet.')).toBeInTheDocument()
    expect(
      screen.getByText('Click edit to add a campaign synopsis.'),
    ).toBeInTheDocument()
  })

  it('renders synopsis with whitespace preservation class', () => {
    render(
      <AdventureHeader
        adventure={baseAdventure}
        isGM={false}
        userRole={null}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    const synopsisEl = screen.getByText('A grand adventure begins.')
    expect(synopsisEl.className).toContain('whitespace-pre-wrap')
  })

  it('renders creation date with long format', () => {
    render(
      <AdventureHeader
        adventure={baseAdventure}
        isGM={false}
        userRole={null}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    // January ... 2025 (day may vary by timezone)
    expect(screen.getByText(/January/)).toBeInTheDocument()
    expect(screen.getByText(/2025/)).toBeInTheDocument()
  })
})

/* ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
            CharactersSection
   ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── */

describe('CharactersSection', () => {
  const handlers = {
    onNewCharClick: vi.fn(),
    onLinkCharClick: vi.fn(),
    onCancelNewChar: vi.fn(),
    onCancelLinkChar: vi.fn(),
    onCreateCharacter: vi.fn<(e: { preventDefault: () => void }) => void>(),
    onLinkCharacter: vi.fn<(e: { preventDefault: () => void }) => void>(),
    onNewCharNameChange: vi.fn(),
    onLinkSheetChange: vi.fn(),
    onRemoveCharacter: vi.fn(),
    onViewCharacter: vi.fn(),
  }

  const baseProps = {
    characters: [] as any[],
    isGM: false,
    userId: 'user-1',
    snapshotName: null as string | null,
    userSheets: [] as any[],
    showNewCharForm: false,
    showLinkCharForm: false,
    newCharName: '',
    newCharError: null as string | null,
    newCharCreating: false,
    linkSheetId: '',
    linkCharError: null as string | null,
    linkCharLinking: false,
    ...handlers,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  /* ── empty / list ── */
  it('shows empty state when no characters and no forms are open', () => {
    render(<CharactersSection {...baseProps} />)
    expect(
      screen.getByText('No characters in this campaign yet.'),
    ).toBeInTheDocument()
  })

  it('does NOT show empty state when characters exist', () => {
    render(
      <CharactersSection
        {...baseProps}
        characters={[makeCharacter()]}
      />,
    )
    expect(
      screen.queryByText('No characters in this campaign yet.'),
    ).not.toBeInTheDocument()
  })

  it('renders character names, template badges, and owner info', () => {
    render(
      <CharactersSection
        {...baseProps}
        characters={[
          makeCharacter({ characterName: 'Legolas', template: { id: 't2', name: 'Ranger' } }),
        ]}
      />,
    )
    expect(screen.getByText('Legolas')).toBeInTheDocument()
    expect(screen.getByText('Ranger')).toBeInTheDocument()
    expect(screen.getByText('HeroPlayer')).toBeInTheDocument()
  })

  it('falls back to email when displayName is null', () => {
    render(
      <CharactersSection
        {...baseProps}
        characters={[makeCharacter({ owner: { id: 'u2', displayName: null, email: 'anon@test.com' } })]}
      />,
    )
    expect(screen.getByText('anon@test.com')).toBeInTheDocument()
  })

  it('falls back to "Unknown" when both displayName and email are null', () => {
    render(
      <CharactersSection
        {...baseProps}
        characters={[makeCharacter({ owner: { id: 'u2', displayName: null, email: null } })]}
      />,
    )
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('shows View button for every character', () => {
    render(
      <CharactersSection
        {...baseProps}
        characters={[makeCharacter()]}
      />,
    )
    expect(screen.getByText('View')).toBeInTheDocument()
  })

  it('calls onViewCharacter when View is clicked', async () => {
    render(
      <CharactersSection
        {...baseProps}
        characters={[makeCharacter({ id: 'char-1' })]}
      />,
    )
    await userEvent.click(screen.getByText('View'))
    expect(handlers.onViewCharacter).toHaveBeenCalledWith('char-1')
  })

  it('shows Remove button for GM when character is not the current user\'s', () => {
    render(
      <CharactersSection
        {...baseProps}
        isGM={true}
        userId='gm-1'
        characters={[makeCharacter({ owner: { id: 'user-1', displayName: 'Other', email: '' } })]}
      />,
    )
    expect(screen.getByText('Remove')).toBeInTheDocument()
  })

  it('hides Remove button for character owned by current user, even when GM', () => {
    render(
      <CharactersSection
        {...baseProps}
        isGM={true}
        userId='user-1'
        characters={[makeCharacter()]}
      />,
    )
    expect(screen.queryByText('Remove')).not.toBeInTheDocument()
  })

  it('hides Remove button when not GM', () => {
    render(
      <CharactersSection
        {...baseProps}
        isGM={false}
        characters={[
          makeCharacter({ owner: { id: 'other', displayName: 'Other', email: '' } }),
        ]}
      />,
    )
    expect(screen.queryByText('Remove')).not.toBeInTheDocument()
  })

  it('calls onRemoveCharacter with character id', async () => {
    render(
      <CharactersSection
        {...baseProps}
        isGM={true}
        userId='gm-1'
        characters={[makeCharacter({ id: 'remove-me' })]}
      />,
    )
    await userEvent.click(screen.getByText('Remove'))
    expect(handlers.onRemoveCharacter).toHaveBeenCalledWith('remove-me')
  })

  /* ── action buttons ── */
  it('shows action buttons when no forms are open', () => {
    render(<CharactersSection {...baseProps} characters={[makeCharacter()]} />)
    expect(screen.getByText('+ New Character')).toBeInTheDocument()
    expect(screen.getByText('Link Existing Character')).toBeInTheDocument()
  })

  it('hides action buttons when new char form is open', () => {
    render(<CharactersSection {...baseProps} showNewCharForm={true} />)
    expect(screen.queryByText('+ New Character')).not.toBeInTheDocument()
    expect(screen.queryByText('Link Existing Character')).not.toBeInTheDocument()
  })

  it('hides action buttons when link char form is open', () => {
    render(<CharactersSection {...baseProps} showLinkCharForm={true} />)
    expect(screen.queryByText('+ New Character')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Link Existing Character' })).not.toBeInTheDocument()
  })

  it('calls onNewCharClick when + New Character is clicked', async () => {
    render(<CharactersSection {...baseProps} characters={[makeCharacter()]} />)
    await userEvent.click(screen.getByText('+ New Character'))
    expect(handlers.onNewCharClick).toHaveBeenCalledOnce()
  })

  it('calls onLinkCharClick when Link is clicked', async () => {
    render(<CharactersSection {...baseProps} characters={[makeCharacter()]} />)
    await userEvent.click(screen.getByText('Link Existing Character'))
    expect(handlers.onLinkCharClick).toHaveBeenCalledOnce()
  })

  /* ── create new character form ── */
  it('renders create form when showNewCharForm is true', () => {
    render(<CharactersSection {...baseProps} showNewCharForm={true} />)
    expect(screen.getByText('Create New Character')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Aragorn')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Create')).toBeInTheDocument()
  })

  it('shows no template message when no snapshot is attached', () => {
    render(<CharactersSection {...baseProps} showNewCharForm={true} snapshotName={null} />)
    expect(
      screen.getByText('No template is attached to this campaign. Ask the GM to attach one before creating a character.'),
    ).toBeInTheDocument()
    // No select should be shown
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('renders snapshot template name when one is attached', () => {
    render(
      <CharactersSection {...baseProps} showNewCharForm={true} snapshotName='Warrior' />,
    )
    expect(screen.getByText('Warrior')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('calls name change handler on input', async () => {
    render(<CharactersSection {...baseProps} showNewCharForm={true} />)
    const input = screen.getByPlaceholderText('e.g. Aragorn')
    await userEvent.type(input, 'Bilbo')
    expect(handlers.onNewCharNameChange).toHaveBeenCalledWith('B')
    expect(handlers.onNewCharNameChange).toHaveBeenCalledWith('i')
  })

  it('shows error message when newCharError is set', () => {
    render(
      <CharactersSection {...baseProps} showNewCharForm={true} newCharError='Name too short' />,
    )
    expect(screen.getByText('Name too short')).toBeInTheDocument()
  })

  it('disables Create button while creating', () => {
    render(
      <CharactersSection
        {...baseProps}
        showNewCharForm={true}
        newCharCreating={true}
        newCharName='Test'
        snapshotName='Fighter'
      />,
    )
    expect(screen.getByText('Creating...')).toBeInTheDocument()
    expect(screen.getByText('Creating...')).toBeDisabled()
  })

  it('disables Create button when name or template is empty', () => {
    // name empty, template empty
    const { rerender } = render(
      <CharactersSection
        {...baseProps}
        showNewCharForm={true}
        newCharName=''
        snapshotName={null}
      />,
    )
    expect(screen.getByText('Create')).toBeDisabled()

    // name filled, template still empty
    rerender(
      <CharactersSection
        {...baseProps}
        showNewCharForm={true}
        newCharName='Aragorn'
        snapshotName={null}
      />,
    )
    expect(screen.getByText('Create')).toBeDisabled()
  })

  it('enables Create button when name and template are filled', () => {
    render(
      <CharactersSection
        {...baseProps}
        showNewCharForm={true}
        newCharName='Aragorn'
        snapshotName='Fighter'
        newCharCreating={false}
      />,
    )
    expect(screen.getByText('Create')).not.toBeDisabled()
  })

  it('Cancel button is not disabled while creating', () => {
    render(
      <CharactersSection
        {...baseProps}
        showNewCharForm={true}
        newCharCreating={true}
      />,
    )
    // Cancel button should be disabled while creating
    expect(screen.getByText('Cancel')).toBeDisabled()
  })

  it('calls onCreateCharacter on form submit', async () => {
    const preventDefault = vi.fn()
    render(
      <CharactersSection
        {...baseProps}
        showNewCharForm={true}
        newCharName='Frodo'
        snapshotName='Fighter'
      />,
    )
    fireEvent.submit(screen.getByText('Create New Character').closest('form')!)
    expect(handlers.onCreateCharacter).toHaveBeenCalled()
  })

  it('calls onCancelNewChar when Cancel is clicked', async () => {
    render(<CharactersSection {...baseProps} showNewCharForm={true} />)
    await userEvent.click(screen.getByText('Cancel'))
    expect(handlers.onCancelNewChar).toHaveBeenCalledOnce()
  })

  /* ── link existing character form ── */
  it('renders link form when showLinkCharForm is true', () => {
    render(<CharactersSection {...baseProps} showLinkCharForm={true} />)
    expect(screen.getByText('Link Existing Character')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Link')).toBeInTheDocument()
  })

  it('shows no unlinked characters message when userSheets is empty', () => {
    render(
      <CharactersSection {...baseProps} showLinkCharForm={true} userSheets={[]} />,
    )
    expect(
      screen.getByText('No unlinked characters available.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('renders user sheet options when available', () => {
    const userSheets = [
      {
        id: 's1',
        characterName: 'Bilbo',
        adventure: { id: 'a1', name: 'Adventure', campaign: 'Camp' },
        template: { id: 't1', name: 'Rogue' },
        createdAt: '2025-01-15T00:00:00Z',
      },
    ]
    render(
      <CharactersSection
        {...baseProps}
        showLinkCharForm={true}
        userSheets={userSheets}
      />,
    )
    expect(screen.getByText('Bilbo (Rogue)')).toBeInTheDocument()
  })

  it('calls onLinkSheetChange on select', async () => {
    const userSheets = [
      {
        id: 's1',
        characterName: 'Bilbo',
        adventure: { id: 'a1', name: 'Adventure', campaign: 'Camp' },
        template: { id: 't1', name: 'Rogue' },
        createdAt: '2025-01-15T00:00:00Z',
      },
    ]
    render(
      <CharactersSection
        {...baseProps}
        showLinkCharForm={true}
        userSheets={userSheets}
      />,
    )
    const select = screen.getByRole('combobox')
    await userEvent.selectOptions(select, 's1')
    expect(handlers.onLinkSheetChange).toHaveBeenCalledWith('s1')
  })

  it('shows link error when linkCharError is set', () => {
    render(
      <CharactersSection
        {...baseProps}
        showLinkCharForm={true}
        linkCharError='Character already linked'
      />,
    )
    expect(screen.getByText('Character already linked')).toBeInTheDocument()
  })

  it('disables link submit when linking', () => {
    render(
      <CharactersSection
        {...baseProps}
        showLinkCharForm={true}
        linkCharLinking={true}
        linkSheetId='s1'
      />,
    )
    expect(screen.getByText('Linking...')).toBeDisabled()
  })

  it('disables link submit when no sheet selected', () => {
    render(
      <CharactersSection
        {...baseProps}
        showLinkCharForm={true}
        linkSheetId=''
      />,
    )
    expect(screen.getByText('Link')).toBeDisabled()
  })

  it('calls onLinkCharacter on link form submit', () => {
    render(
      <CharactersSection
        {...baseProps}
        showLinkCharForm={true}
        linkSheetId='s1'
      />,
    )
    fireEvent.submit(screen.getByText('Link Existing Character').closest('form')!)
    expect(handlers.onLinkCharacter).toHaveBeenCalled()
  })

  it('calls onCancelLinkChar when Cancel is clicked in link form', async () => {
    render(<CharactersSection {...baseProps} showLinkCharForm={true} />)
    await userEvent.click(screen.getByText('Cancel'))
    expect(handlers.onCancelLinkChar).toHaveBeenCalledOnce()
  })
})

/* ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
            InvitePanel
   ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── */

describe('InvitePanel', () => {
  const handlers = {
    onEmailChange: vi.fn(),
    onInviteByEmail: vi.fn<(e: { preventDefault: () => void }) => void>(),
    onInviteByLink: vi.fn(),
    onRevoke: vi.fn(),
  }
  const baseProps = {
    inviteEmail: '',
    inviteLink: null as string | null,
    inviteError: null as string | null,
    inviteSending: false,
    invitations: [] as any[],
    ...handlers,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  /* ── Invite by email ── */
  it('renders email input and Send button', () => {
    render(<InvitePanel {...baseProps} />)
    expect(screen.getByPlaceholderText('player@example.com')).toBeInTheDocument()
    expect(screen.getByText('Send')).toBeInTheDocument()
  })

  it('disables Send when email is empty', () => {
    render(<InvitePanel {...baseProps} inviteEmail='' />)
    expect(screen.getByText('Send')).toBeDisabled()
  })

  it('enables Send when email is non-empty', () => {
    render(<InvitePanel {...baseProps} inviteEmail='a@b.com' />)
    expect(screen.getByText('Send')).not.toBeDisabled()
  })

  it('disables Send while sending', () => {
    render(<InvitePanel {...baseProps} inviteEmail='a@b.com' inviteSending={true} />)
    expect(screen.getByText('Send')).toBeDisabled()
  })

  it('calls onEmailChange on input', async () => {
    render(<InvitePanel {...baseProps} />)
    const input = screen.getByPlaceholderText('player@example.com')
    await userEvent.type(input, 'a')
    expect(handlers.onEmailChange).toHaveBeenCalledWith('a')
  })

  it('calls onInviteByEmail on form submit', () => {
    render(<InvitePanel {...baseProps} inviteEmail='a@b.com' />)
    const form = screen.getByPlaceholderText('player@example.com').closest('form')!
    fireEvent.submit(form)
    expect(handlers.onInviteByEmail).toHaveBeenCalled()
  })

  /* ── Invite by link ── */
  it('renders Generate invite link button', () => {
    render(<InvitePanel {...baseProps} />)
    expect(screen.getByText('Generate invite link')).toBeInTheDocument()
  })

  it('disables generate button when sending', () => {
    render(<InvitePanel {...baseProps} inviteSending={true} />)
    expect(screen.getByText('Generate invite link')).toBeDisabled()
  })

  it('calls onInviteByLink when generate is clicked', async () => {
    render(<InvitePanel {...baseProps} />)
    await userEvent.click(screen.getByText('Generate invite link'))
    expect(handlers.onInviteByLink).toHaveBeenCalledOnce()
  })

  it('shows invite link input and Copy button when inviteLink is set', () => {
    render(<InvitePanel {...baseProps} inviteLink='https://example.com/invite/abc' />)
    const input = screen.getByDisplayValue('https://example.com/invite/abc')
    expect(input).toBeInTheDocument()
    expect(screen.getByText('Copy')).toBeInTheDocument()
  })

  it('selects text on focus of invite link input', () => {
    const selectFn = vi.fn()
    render(<InvitePanel {...baseProps} inviteLink='https://example.com/invite/abc' />)
    const input = screen.getByDisplayValue('https://example.com/invite/abc')
    // Simulate focus with select
    ;(input as HTMLInputElement).select = selectFn as any
    fireEvent.focus(input)
    expect(selectFn).toHaveBeenCalled()
  })

  it('copies invite link to clipboard', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
    })
    render(<InvitePanel {...baseProps} inviteLink='https://example.com/invite/abc' />)
    await userEvent.click(screen.getByText('Copy'))
    expect(writeText).toHaveBeenCalledWith('https://example.com/invite/abc')
  })

  /* ── Error display ── */
  it('shows error message when inviteError is set', () => {
    render(<InvitePanel {...baseProps} inviteError='Invalid email' />)
    expect(screen.getByText('Invalid email')).toBeInTheDocument()
  })

  /* ── Pending invitations ── */
  it('does not show pending section when invitations is empty', () => {
    render(<InvitePanel {...baseProps} invitations={[]} />)
    expect(screen.queryByText('Pending Invitations')).not.toBeInTheDocument()
  })

  it('shows pending invitations list when invitations exist', () => {
    render(
      <InvitePanel
        {...baseProps}
        invitations={[makeInvitation()]}
      />,
    )
    expect(screen.getByText('Pending Invitations')).toBeInTheDocument()
    expect(screen.getByText('test@test.com')).toBeInTheDocument()
  })

  it('shows "Link invitation" text when invitedEmail is null', () => {
    render(
      <InvitePanel
        {...baseProps}
        invitations={[makeInvitation({ invitedEmail: null })]}
      />,
    )
    expect(screen.getByText('Link invitation')).toBeInTheDocument()
  })

  it('calls onRevoke when Revoke is clicked', async () => {
    render(
      <InvitePanel
        {...baseProps}
        invitations={[makeInvitation({ id: 'inv-1' })]}
      />,
    )
    await userEvent.click(screen.getByText('Revoke'))
    expect(handlers.onRevoke).toHaveBeenCalledWith('inv-1')
  })
})

/* ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
            MemberRow
   ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── */

describe('MemberRow', () => {
  const onRemove = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders member display name and role', () => {
    render(
      <MemberRow member={baseMember} isGM={false} isSelf={false} onRemove={onRemove} />,
    )
    expect(screen.getByText('HeroPlayer')).toBeInTheDocument()
    expect(screen.getByText('PLAYER')).toBeInTheDocument()
  })

  it('falls back to email when displayName is null', () => {
    const member = {
      ...baseMember,
      user: { id: 'u1', email: 'fallback@test.com', displayName: null },
    }
    render(
      <MemberRow member={member} isGM={false} isSelf={false} onRemove={onRemove} />,
    )
    expect(screen.getByText('fallback@test.com')).toBeInTheDocument()
  })

  it('applies gold badge style when role is GM', () => {
    const gmMember = { ...baseMember, role: 'GM' as const }
    render(
      <MemberRow member={gmMember} isGM={false} isSelf={false} onRemove={onRemove} />,
    )
    const badge = screen.getByText('GM')
    expect(badge.className).toContain('badge-gold')
  })

  it('does NOT show Remove button when isGM is false', () => {
    render(
      <MemberRow member={baseMember} isGM={false} isSelf={false} onRemove={onRemove} />,
    )
    expect(screen.queryByText('Remove')).not.toBeInTheDocument()
  })

  it('does NOT show Remove button when isSelf is true even if isGM is true', () => {
    render(
      <MemberRow member={baseMember} isGM={true} isSelf={true} onRemove={onRemove} />,
    )
    expect(screen.queryByText('Remove')).not.toBeInTheDocument()
  })

  it('shows Remove button when isGM is true and isSelf is false', () => {
    render(
      <MemberRow member={baseMember} isGM={true} isSelf={false} onRemove={onRemove} />,
    )
    expect(screen.getByText('Remove')).toBeInTheDocument()
  })

  it('calls onRemove when Remove is clicked', async () => {
    render(
      <MemberRow member={baseMember} isGM={true} isSelf={false} onRemove={onRemove} />,
    )
    await userEvent.click(screen.getByText('Remove'))
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('renders inline style for non-GM role badge', () => {
    render(
      <MemberRow member={baseMember} isGM={false} isSelf={false} onRemove={onRemove} />,
    )
    const badge = screen.getByText('PLAYER')
    expect(badge.style.background).toBeTruthy()
  })
})

/* ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
            NpcsMobsSection
   ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── */

describe('NpcsMobsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when isGM is false', () => {
    const { container } = render(
      <NpcsMobsSection adventureId='adv-1' isGM={false} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('fetches NPCs on mount and shows skeleton while loading', async () => {
    // Return a promise that never resolves for initial render (loading)
    mockApiGet.mockReturnValue(new Promise(() => {}))

    render(<NpcsMobsSection adventureId='adv-1' isGM={true} />)

    // Should show skeleton placeholders
    const skeletons = document.querySelectorAll('.skeleton')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)

    expect(mockApiGet).toHaveBeenCalledWith('/adventures/adv-1/npcs')
  })

  it('shows empty state when API returns empty array', async () => {
    mockApiGet.mockResolvedValue([])

    render(<NpcsMobsSection adventureId='adv-1' isGM={true} />)

    await waitFor(() => {
      expect(screen.getByText(/No NPCs yet/)).toBeInTheDocument()
    })
  })

  it('renders NPCs list when data arrives', async () => {
    mockApiGet.mockResolvedValue([makeNpc()])

    render(<NpcsMobsSection adventureId='adv-1' isGM={true} />)

    await waitFor(() => {
      expect(screen.getByText('Goblin Scout')).toBeInTheDocument()
    })

    // Level

    // Template badge
    expect(screen.getByText('Goblin')).toBeInTheDocument()

    // Type badge
    expect(screen.getByText('NPC')).toBeInTheDocument()

    // View button
    expect(screen.getByText('View')).toBeInTheDocument()
  })

  it('renders MOBs list on mob tab', async () => {
    mockApiGet.mockResolvedValue([
      makeNpc({ id: 'mob-1', characterName: 'Wolf Pack', npcType: 'MOB' }),
    ])

    render(<NpcsMobsSection adventureId='adv-1' isGM={true} />)

    // Wait for data to load, then switch to Mobs tab
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Mobs/ }).textContent).toContain('(1)')
    })
    await userEvent.click(screen.getByRole('button', { name: /Mobs/ }))

    await waitFor(() => {
      expect(screen.getByText('Wolf Pack')).toBeInTheDocument()
    })

    // MOB badge styling
    const mobBadge = screen.getByText('MOB')
    expect(mobBadge.className).toContain('bg-red')
  })

  it('switches between NPCs and Mobs tabs', async () => {
    mockApiGet.mockResolvedValue([
      makeNpc({ id: 'npc1', characterName: 'Goblin', npcType: 'NPC', template: { id: 'tmpl-1', name: 'Goblin Template' } }),
      makeNpc({ id: 'mob1', characterName: 'Wolf', npcType: 'MOB', template: { id: 'tmpl-2', name: 'Beast' } }),
    ])

    render(<NpcsMobsSection adventureId='adv-1' isGM={true} />)

    await waitFor(() => {
      expect(screen.getByText('Goblin')).toBeInTheDocument()
    })

    // Both tabs show counts
    expect(screen.getByText(/NPCs/)).toBeInTheDocument()
    expect(screen.getByText(/Mobs/)).toBeInTheDocument()

    // Click Mobs tab
    await userEvent.click(screen.getByRole('button', { name: /Mobs/ }))

    // Now only Wolf should be visible, Goblin hidden
    await waitFor(() => {
      expect(screen.queryByText('Goblin')).not.toBeInTheDocument()
      expect(screen.getByText('Wolf')).toBeInTheDocument()
    })
  })

  it('filters by search', async () => {
    mockApiGet.mockResolvedValue([
      makeNpc({ id: 'n1', characterName: 'Goblin', npcType: 'NPC', template: { id: 'tmpl-1', name: 'Goblin Template' } }),
      makeNpc({ id: 'n2', characterName: 'Orc', npcType: 'NPC', template: { id: 'tmpl-2', name: 'Orc Template' } }),
    ])

    render(<NpcsMobsSection adventureId='adv-1' isGM={true} />)

    await waitFor(() => {
      expect(screen.getByText('Goblin')).toBeInTheDocument()
      expect(screen.getByText('Orc')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search NPCs...')
    await userEvent.type(searchInput, 'Orc')

    expect(screen.queryByText('Goblin')).not.toBeInTheDocument()
    expect(screen.getByText('Orc')).toBeInTheDocument()
  })

  it('shows no-results message when search yields nothing', async () => {
    mockApiGet.mockResolvedValue([
      makeNpc({ id: 'n1', characterName: 'Goblin', npcType: 'NPC', template: { id: 'tmpl-1', name: 'Goblin Template' } }),
    ])

    render(<NpcsMobsSection adventureId='adv-1' isGM={true} />)

    await waitFor(() => {
      expect(screen.getByText('Goblin')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search NPCs...')
    await userEvent.type(searchInput, 'ZZZ')

    expect(screen.getByText(/No NPCs match your search/)).toBeInTheDocument()
  })

  it('shows no mobs empty state on mob tab when no mobs exist', async () => {
    mockApiGet.mockResolvedValue([
      makeNpc({ id: 'n1', characterName: 'Goblin', npcType: 'NPC', template: { id: 'tmpl-1', name: 'Goblin Template' } }),
    ])

    render(<NpcsMobsSection adventureId='adv-1' isGM={true} />)

    await waitFor(() => {
      expect(screen.getByText('Goblin')).toBeInTheDocument()
    })

    // Switch to Mobs tab
    await userEvent.click(screen.getByRole('button', { name: /Mobs/ }))

    await waitFor(() => {
      expect(screen.getByText(/No Mobs yet/)).toBeInTheDocument()
    })
  })

  it('refetches when refreshKey changes', async () => {
    mockApiGet.mockResolvedValue([])

    const { rerender } = render(
      <NpcsMobsSection adventureId='adv-1' isGM={true} refreshKey={0} />,
    )

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledTimes(1)
    })

    mockApiGet.mockResolvedValue([makeNpc()])

    rerender(
      <NpcsMobsSection adventureId='adv-1' isGM={true} refreshKey={1} />,
    )

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledTimes(2)
    })
  })

  it('silently handles fetch errors', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'))

    render(<NpcsMobsSection adventureId='adv-1' isGM={true} />)

    // Error is silent, should show empty state after loading
    await waitFor(() => {
      expect(screen.getByText(/No NPCs yet/)).toBeInTheDocument()
    })
  })

  it('renders NPC with null level/hp gracefully', async () => {
    mockApiGet.mockResolvedValue([
      makeNpc({ level: null, hpActual: null, hpMax: null }),
    ])

    render(<NpcsMobsSection adventureId='adv-1' isGM={true} />)

    await waitFor(() => {
      expect(screen.getByText('Goblin Scout')).toBeInTheDocument()
    })

    // Should show fallback values
    expect(screen.getByText(/Lv\.\?/)).toBeInTheDocument()
  })

  it('renders NPC without template gracefully', async () => {
    mockApiGet.mockResolvedValue([
      makeNpc({ template: null }),
    ])

    render(<NpcsMobsSection adventureId='adv-1' isGM={true} />)

    await waitFor(() => {
      expect(screen.getByText('Goblin Scout')).toBeInTheDocument()
    })
  })

  it('provides mood emoji per tab in empty state', async () => {
    mockApiGet.mockResolvedValue([])

    render(<NpcsMobsSection adventureId='adv-1' isGM={true} />)

    // NPC tab shows 👤
    await waitFor(() => {
      expect(screen.getByText('👤')).toBeInTheDocument()
    })

    // Switch to mob tab
    await userEvent.click(screen.getByText(/^Mobs$/))

    await waitFor(() => {
      expect(screen.getByText('👾')).toBeInTheDocument()
    })
  })
})

/* ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
            TemplatesSection
   ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── */

describe('TemplatesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /* ── empty state ── */
  it('shows EmptyState when no templates and not showing new form', () => {
    render(<TemplatesSection {...defaultTemplatesProps()} />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByTestId('empty-state-title')).toHaveTextContent('No Templates Yet')
  })

  it('shows empty description for non-GM users without templates', () => {
    render(
      <TemplatesSection
        {...defaultTemplatesProps({ isGM: false })}
      />,
    )
    expect(screen.getByTestId('empty-state-desc')).toHaveTextContent(
      'No templates are available yet.',
    )
  })

  it('shows empty description for GM users without templates and an action button', () => {
    render(<TemplatesSection {...defaultTemplatesProps({ isGM: true })} />)
    expect(screen.getByTestId('empty-state-desc')).toHaveTextContent(
      'Create a template to allow players to build character sheets.',
    )
    expect(screen.getByTestId('empty-state-action')).toHaveTextContent('+ New Template')
  })

  it('calls onNewClick when empty-state action is clicked', async () => {
    const onNewClick = vi.fn()
    render(<TemplatesSection {...defaultTemplatesProps({ onNewClick })} />)
    await userEvent.click(screen.getByTestId('empty-state-action'))
    expect(onNewClick).toHaveBeenCalledOnce()
  })

  /* ── template list ── */
  it('renders template rows when templates exist', () => {
    const templates = [makeTemplate()]
    render(<TemplatesSection {...defaultTemplatesProps({ templates })} />)
    const rows = screen.getAllByTestId('template-row')
    expect(rows).toHaveLength(1)
    expect(screen.getByTestId('template-name')).toHaveTextContent('Basic')
  })

  it('does NOT show "+ New Template" standalone button while showNewTemplate is true', () => {
    render(
      <TemplatesSection
        {...defaultTemplatesProps({ showNewTemplate: true })}
      />,
    )
    expect(screen.queryByText('+ New Template')).not.toBeInTheDocument()
  })

  it('shows templates list alongside new template button for GM', () => {
    const templates = [makeTemplate()]
    render(<TemplatesSection {...defaultTemplatesProps({ templates, isGM: true })} />)
    expect(screen.getByText('+ New Template')).toBeInTheDocument()
  })

  it('does NOT show new template button for non-GM', () => {
    const templates = [makeTemplate()]
    render(
      <TemplatesSection
        {...defaultTemplatesProps({ templates, isGM: false })}
      />,
    )
    expect(screen.queryByText('+ New Template')).not.toBeInTheDocument()
  })

  it('calls onNewClick when + New Template is clicked', async () => {
    const onNewClick = vi.fn()
    const templates = [makeTemplate()]
    render(
      <TemplatesSection
        {...defaultTemplatesProps({ templates, onNewClick, isGM: true })}
      />,
    )
    await userEvent.click(screen.getByText('+ New Template'))
    expect(onNewClick).toHaveBeenCalledOnce()
  })

  /* ── template form (wizard) ── */
  it('renders TemplateForm when showNewTemplate is true', () => {
    render(<TemplatesSection {...defaultTemplatesProps({ showNewTemplate: true })} />)
    expect(screen.getByTestId('template-form')).toBeInTheDocument()
    expect(screen.getByText('New Template Form')).toBeInTheDocument()
  })

  it('passes templateCreating state to form', () => {
    render(
      <TemplatesSection
        {...defaultTemplatesProps({
          showNewTemplate: true,
          templateCreating: true,
        })}
      />,
    )
    expect(screen.getAllByText('Creating...').length).toBeGreaterThan(0)
    expect(screen.getByTestId('template-form-submit')).toBeDisabled()
  })

  it('passes templateError to form', () => {
    render(
      <TemplatesSection
        {...defaultTemplatesProps({
          showNewTemplate: true,
          templateError: 'Name is required',
        })}
      />,
    )
    expect(screen.getByTestId('template-form-error')).toHaveTextContent(
      'Name is required',
    )
  })

  it('passes newTemplateName and description change handlers', async () => {
    const onNameChange = vi.fn()
    const onDescriptionChange = vi.fn()
    render(
      <TemplatesSection
        {...defaultTemplatesProps({
          showNewTemplate: true,
          onNameChange,
          onDescriptionChange,
          newTemplateName: 'My Template',
          newTemplateDescription: 'A desc',
        })}
      />,
    )
    const nameInput = screen.getByTestId('template-form-name')
    const descInput = screen.getByTestId('template-form-desc')

    expect(nameInput).toHaveValue('My Template')
    expect(descInput).toHaveValue('A desc')

    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'New Name')
    expect(onNameChange).toHaveBeenCalled()
  })

  it('passes feature toggle callbacks to form', async () => {
    const onNewFeatureSkillsChange = vi.fn()
    render(
      <TemplatesSection
        {...defaultTemplatesProps({
          showNewTemplate: true,
          newFeatureSkills: false,
          onNewFeatureSkillsChange,
        })}
      />,
    )
    const skillsCheckbox = screen.getByLabelText('Skills')
    await userEvent.click(skillsCheckbox)
    expect(onNewFeatureSkillsChange).toHaveBeenCalledWith(true)
  })

  it('calls onCancelNew from form cancel', async () => {
    const onCancelNew = vi.fn()
    render(
      <TemplatesSection
        {...defaultTemplatesProps({
          showNewTemplate: true,
          onCancelNew,
        })}
      />,
    )
    await userEvent.click(screen.getByTestId('template-form-cancel'))
    expect(onCancelNew).toHaveBeenCalledOnce()
  })

  it('calls onCreateTemplate from form submit', () => {
    const onCreateTemplate = vi.fn()
    render(
      <TemplatesSection
        {...defaultTemplatesProps({
          showNewTemplate: true,
          onCreateTemplate,
        })}
      />,
    )
    fireEvent.submit(screen.getByTestId('template-form'))
    expect(onCreateTemplate).toHaveBeenCalled()
  })

  /* ── editing state ── */
  it('passes editing state to TemplateRow', () => {
    const templates = [makeTemplate()]
    render(
      <TemplatesSection
        {...defaultTemplatesProps({
          templates,
          editingTemplateId: 't-1',
          isGM: true,
        })}
      />,
    )
    expect(screen.getByTestId('editing-template')).toBeInTheDocument()
  })

  it('calls onDeleteTemplate when delete button is clicked on row', async () => {
    const onDeleteTemplate = vi.fn()
    const templates = [makeTemplate()]
    render(
      <TemplatesSection
        {...defaultTemplatesProps({
          templates,
          isGM: true,
          onDeleteTemplate,
        })}
      />,
    )
    await userEvent.click(screen.getByTestId('delete-template-btn'))
    expect(onDeleteTemplate).toHaveBeenCalledWith('t-1')
  })

  it('calls onStartEdit when edit button is clicked on row', async () => {
    const onStartEdit = vi.fn()
    const templates = [makeTemplate()]
    render(
      <TemplatesSection
        {...defaultTemplatesProps({
          templates,
          isGM: true,
          onStartEdit,
        })}
      />,
    )
    await userEvent.click(screen.getByTestId('start-edit-btn'))
    expect(onStartEdit).toHaveBeenCalledWith(templates[0])
  })

  /* ── edge cases ── */
  it('shows empty state when templates list is empty even if isGM is true', () => {
    render(<TemplatesSection {...defaultTemplatesProps({ isGM: true })} />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('uses newTemplateAttrs for new resistance when newTemplateAttrsForResistance is not provided', () => {
    render(
      <TemplatesSection
        {...defaultTemplatesProps({
          showNewTemplate: true,
          newTemplateAttrs: [{ key: 'str', name: 'Strength' }],
        })}
      />,
    )
    // Should not crash, internal logic computes attrsForNewResistance
    expect(screen.getByTestId('template-form')).toBeInTheDocument()
  })

  it('uses editTemplateAttrs for edit resistance when editTemplateAttrsForResistance is not provided', () => {
    const templates = [makeTemplate()]
    render(
      <TemplatesSection
        {...defaultTemplatesProps({
          templates,
          editingTemplateId: 't-1',
          editTemplateAttrs: [{ key: 'dex', name: 'Dexterity' }],
        })}
      />,
    )
    expect(screen.getByTestId('editing-template')).toBeInTheDocument()
  })
})
