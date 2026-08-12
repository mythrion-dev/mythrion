import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

// ── Hoisted mocks referenced inside vi.mock factories (TDZ guard) ──
const {
  mockUseParams,
  mockRouterPush,
  mockRouterReplace,
  mockAuth,
  mockApiGet,
  mockApiPost,
  mockApiPut,
  mockApiPatch,
  mockApiDelete,
  mockAuthFetch,
} = vi.hoisted(() => ({
  mockUseParams: vi.fn(),
  mockRouterPush: vi.fn(),
  mockRouterReplace: vi.fn(),
  mockAuth: vi.fn(),
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPut: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiDelete: vi.fn(),
  mockAuthFetch: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => mockUseParams(),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard/adventures/adv-1',
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/api', () => ({
  api: { get: mockApiGet, post: mockApiPost, put: mockApiPut, patch: mockApiPatch, delete: mockApiDelete },
  API_URL: 'http://api.test',
  authFetch: mockAuthFetch,
}))

vi.mock('@/lib/auth-context', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => mockAuth(),
}))

vi.mock('@/lib/breadcrumb', () => ({ PageNav: () => null }))

// ── Heavy component test doubles (wire the page's own handlers) ──
vi.mock('@/components/adventure/AdventureHeader', () => ({
  AdventureHeader: (p: any) => (
    <div data-testid="AdventureHeader">
      <span>{p.adventure?.name}</span>
      <button data-testid="header-edit" onClick={p.onEdit}>
        edit
      </button>
      <button data-testid="header-delete" onClick={p.onDelete}>
        delete
      </button>
    </div>
  ),
}))

vi.mock('@/components/adventure/CollapsibleSection', () => ({
  CollapsibleSection: (p: any) => (
    <section data-testid="collapsible">
      <button data-testid={`toggle-${p.title}`} onClick={p.onToggle}>
        toggle
      </button>
      {p.children}
    </section>
  ),
}))

vi.mock('@/components/adventure/MemberRow', () => ({
  MemberRow: (p: any) => (
    <div data-testid="MemberRow">
      <span>{p.member?.user?.displayName ?? p.member?.user?.email}</span>
      <button data-testid="member-remove" onClick={p.onRemove}>
        remove
      </button>
    </div>
  ),
}))

vi.mock('@/components/adventure/InvitePanel', () => ({
  InvitePanel: (p: any) => (
    <div data-testid="InvitePanel">
      <span data-testid="invite-error">{p.inviteError}</span>
      <span data-testid="invite-link-value">{p.inviteLink}</span>
      <button data-testid="invite-email-change" onClick={() => p.onEmailChange('carol@example.com')}>
        email-change
      </button>
      <button data-testid="invite-email" onClick={() => p.onInviteByEmail({ preventDefault: () => {} })}>
        email
      </button>
      <button data-testid="invite-link" onClick={p.onInviteByLink}>
        link
      </button>
      {(p.invitations || []).map((inv: any) => (
        <button key={inv.id} data-testid={`revoke-${inv.id}`} onClick={() => p.onRevoke(inv.id)}>
          revoke
        </button>
      ))}
    </div>
  ),
}))

vi.mock('@/components/adventure/DeleteModal', () => ({
  DeleteModal: (p: any) => (
    <div data-testid="DeleteModal">
      <span data-testid="delete-error">{p.error}</span>
      <button data-testid="delete-cancel" onClick={p.onCancel}>
        cancel
      </button>
      <button data-testid="delete-confirm" onClick={p.onConfirm}>
        confirm
      </button>
    </div>
  ),
}))

vi.mock('@/components/adventure/LeaveModal', () => ({
  LeaveModal: (p: any) => (
    <div data-testid="LeaveModal">
      <span data-testid="leave-error">{p.error}</span>
      <button data-testid="leave-cancel" onClick={p.onCancel}>
        cancel
      </button>
      <button data-testid="leave-confirm" onClick={p.onConfirm}>
        confirm
      </button>
    </div>
  ),
}))

vi.mock('@/components/adventure/TransferGmModal', () => ({
  TransferGmModal: (p: any) => (
    <div data-testid="TransferGmModal">
      <span data-testid="transfer-error">{p.error}</span>
      <select data-testid="transfer-select" value={p.value} onChange={(e) => p.onValueChange(e.target.value)}>
        <option value="">none</option>
        <option value="user-2">Bob</option>
      </select>
      <button data-testid="transfer-cancel" onClick={p.onCancel}>
        cancel
      </button>
      <button data-testid="transfer-confirm" onClick={p.onConfirm} disabled={!p.value || p.loading}>
        confirm
      </button>
    </div>
  ),
}))

vi.mock('@/components/adventure/EditForm', () => ({
  EditForm: (p: any) => (
    <div data-testid="EditForm">
      <span data-testid="edit-error">{p.error}</span>
      <button data-testid="edit-name" onClick={() => p.onNameChange('New Name')}>
        name
      </button>
      <button data-testid="edit-campaign" onClick={() => p.onCampaignChange('New Campaign')}>
        campaign
      </button>
      <button data-testid="edit-synopsis" onClick={() => p.onSynopsisChange('New synopsis')}>
        synopsis
      </button>
      <button data-testid="edit-maxplayers" onClick={() => p.onMaxPlayersChange(6)}>
        max
      </button>
      <button data-testid="edit-weekday" onClick={() => p.onSessionWeekdayChange('Friday')}>
        weekday
      </button>
      <button data-testid="edit-time" onClick={() => p.onSessionTimeChange('18:30')}>
        time
      </button>
      <button data-testid="edit-type" onClick={() => p.onSessionTypeChange('ONLINE')}>
        type
      </button>
      <button data-testid="edit-name-clear" onClick={() => p.onNameChange('')}>
        name-clear
      </button>
      <button data-testid="edit-campaign-clear" onClick={() => p.onCampaignChange('')}>
        campaign-clear
      </button>
      <button data-testid="edit-synopsis-clear" onClick={() => p.onSynopsisChange('')}>
        synopsis-clear
      </button>
      <button data-testid="edit-weekday-clear" onClick={() => p.onSessionWeekdayChange('')}>
        weekday-clear
      </button>
      <button data-testid="edit-time-clear" onClick={() => p.onSessionTimeChange('')}>
        time-clear
      </button>
      <button data-testid="edit-type-clear" onClick={() => p.onSessionTypeChange('')}>
        type-clear
      </button>
      <button data-testid="edit-submit" onClick={() => p.onSubmit({ preventDefault: () => {} })}>
        submit
      </button>
      <button data-testid="edit-cancel" onClick={p.onCancel}>
        cancel
      </button>
    </div>
  ),
}))

vi.mock('@/components/adventure/CharactersSection', () => ({
  CharactersSection: (p: any) => (
    <div data-testid="CharactersSection">
      <span data-testid="char-new-error">{p.newCharError}</span>
      <span data-testid="char-link-error">{p.linkCharError}</span>
      <button data-testid="char-new" onClick={p.onNewCharClick}>
        new
      </button>
      <button data-testid="char-link" onClick={p.onLinkCharClick}>
        link
      </button>
      <button data-testid="char-name" onClick={() => p.onNewCharNameChange('Aria')}>
        name
      </button>
      <button data-testid="char-create" onClick={() => p.onCreateCharacter({ preventDefault: () => {} })}>
        create
      </button>
      <button data-testid="char-sheet" onClick={() => p.onLinkSheetChange('sheet-9')}>
        sheet
      </button>
      <button data-testid="char-link-submit" onClick={() => p.onLinkCharacter({ preventDefault: () => {} })}>
        link-submit
      </button>
      <button data-testid="char-cancel-new" onClick={p.onCancelNewChar}>
        cancel-new
      </button>
      <button data-testid="char-cancel-link" onClick={p.onCancelLinkChar}>
        cancel-link
      </button>
      <button data-testid="char-view" onClick={() => p.onViewCharacter('sheet-1')}>
        view
      </button>
      {(p.characters || []).map((c: any) => (
        <button key={c.id} data-testid={`char-remove-${c.id}`} onClick={() => p.onRemoveCharacter(c.id)}>
          remove
        </button>
      ))}
    </div>
  ),
}))

vi.mock('@/components/adventure/TemplateAttachmentPanel', () => ({
  TemplateAttachmentPanel: (p: any) => (
    <div data-testid="TemplateAttachmentPanel">
      <button data-testid="ts-attach" onClick={p.onAttached}>
        attach
      </button>
      <button data-testid="ts-detach" onClick={p.onDetached}>
        detach
      </button>
    </div>
  ),
}))

vi.mock('@/components/adventure/CampaignCreatureSidebar', () => ({
  CampaignCreatureSidebar: (p: any) => (
    <div data-testid="CampaignCreatureSidebar">
      <button data-testid="creatures-change" onClick={p.onCreaturesChange}>
        change
      </button>
    </div>
  ),
}))

vi.mock('@/components/adventure/NpcsMobsSection', () => ({
  NpcsMobsSection: (p: any) => <div data-testid="NpcsMobsSection" />,
}))

vi.mock('@/components/books/BookListPanel', () => ({
  BookListPanel: (p: any) => (
    <div data-testid="BookListPanel">
      <button data-testid="book-select" onClick={() => p.onSelectBook('book-1')}>
        select
      </button>
    </div>
  ),
}))

vi.mock('@/components/books/PdfViewerSidebar', () => ({
  PdfViewerSidebar: (p: any) => (
    <div data-testid="PdfViewerSidebar">
      <span data-testid="pdf-book-id">{p.bookId ?? 'none'}</span>
    </div>
  ),
}))

vi.mock('@/components/notebook/NotebookSidebar', () => ({
  NotebookSidebar: (p: any) => (
    <div data-testid="NotebookSidebar">
      <span data-testid="notebook-force-open">{String(p.forceOpen)}</span>
    </div>
  ),
}))

vi.mock('@/components/adventure/VisibilityToggle', () => ({
  VisibilityToggle: (p: any) => (
    <div data-testid="VisibilityToggle">
      <span data-testid="visibility-value">{String(p.isPublic)}</span>
      <button data-testid="visibility-toggle" onClick={p.onToggle}>
        toggle
      </button>
    </div>
  ),
}))

vi.mock('@/components/adventure/JoinRequestPanel', () => ({
  JoinRequestPanel: (p: any) => (
    <div data-testid="JoinRequestPanel">
      {(p.requests || []).map((r: any) => (
        <div key={r.id}>
          <span>{r.userDisplayName}</span>
          <button data-testid={`join-accept-${r.id}`} onClick={() => p.onAccept(r.id)}>
            accept
          </button>
          <button data-testid={`join-reject-${r.id}`} onClick={() => p.onReject(r.id)}>
            reject
          </button>
        </div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/adventure/TemplatesSection', () => ({
  TemplatesSection: (p: any) => (
    <div data-testid="TemplatesSection">
      <span data-testid="ts-template-source-state">{p.hideCreateButton ? 'campaign' : 'free'}</span>
      <span data-testid="ts-template-error">{p.templateError}</span>
      <span data-testid="ts-editing-template-error">{p.editingTemplateError}</span>
      <span data-testid="ts-editing-id">{p.editingTemplateId}</span>
      {/* new template */}
      <button data-testid="ts-new" onClick={p.onNewClick}>
        new
      </button>
      <button data-testid="ts-cancel-new" onClick={p.onCancelNew}>
        cancel-new
      </button>
      <button data-testid="ts-name" onClick={() => p.onNameChange('My Template')}>
        name
      </button>
      <button data-testid="ts-desc" onClick={() => p.onDescriptionChange('A template')}>
        desc
      </button>
      <button data-testid="ts-create" onClick={() => p.onCreateTemplate({ preventDefault: () => {} })}>
        create
      </button>
      {/* attrs */}
      <button data-testid="ts-add-attr" onClick={p.onAddAttr}>
        add-attr
      </button>
      <button data-testid="ts-remove-attr" onClick={() => p.onRemoveAttr(0)}>
        remove-attr
      </button>
      <button data-testid="ts-update-attr-key" onClick={() => p.onUpdateAttr(0, 'key', 'str')}>
        attr-key
      </button>
      <button data-testid="ts-update-attr-name" onClick={() => p.onUpdateAttr(0, 'name', 'Strength')}>
        attr-name
      </button>
      {/* fields */}
      <button data-testid="ts-add-field" onClick={p.onAddField}>
        add-field
      </button>
      <button data-testid="ts-remove-field" onClick={() => p.onRemoveField(0)}>
        remove-field
      </button>
      <button data-testid="ts-update-field-key" onClick={() => p.onUpdateField(0, 'key', 'f1')}>
        field-key
      </button>
      <button data-testid="ts-update-field-label" onClick={() => p.onUpdateField(0, 'label', 'Field 1')}>
        field-label
      </button>
      {/* skills */}
      <button data-testid="ts-add-skill" onClick={p.onAddSkill}>
        add-skill
      </button>
      <button data-testid="ts-remove-skill" onClick={() => p.onRemoveSkill(0)}>
        remove-skill
      </button>
      <button data-testid="ts-update-skill-name" onClick={() => p.onUpdateSkill(0, 'name', 'Athletics')}>
        skill-name
      </button>
      <button data-testid="ts-update-skill-desc" onClick={() => p.onUpdateSkill(0, 'description', 'desc')}>
        skill-desc
      </button>
      <button data-testid="ts-update-skill-attr" onClick={() => p.onUpdateSkill(0, 'attributeId', 'attr-1')}>
        skill-attr
      </button>
      <button data-testid="ts-toggle-skill-allowed" onClick={() => p.onToggleSkillAllowedAttr(0, 'attr-1')}>
        skill-allowed
      </button>
      {/* profiles */}
      <button data-testid="ts-add-profile" onClick={p.onAddProfile}>
        add-profile
      </button>
      <button data-testid="ts-remove-profile" onClick={() => p.onRemoveProfile(0)}>
        remove-profile
      </button>
      <button data-testid="ts-update-profile-name" onClick={() => p.onUpdateProfile(0, 'Prof')}>
        profile-name
      </button>
      <button data-testid="ts-add-profile-option" onClick={() => p.onAddProfileOption(0)}>
        add-profile-option
      </button>
      <button data-testid="ts-remove-profile-option" onClick={() => p.onRemoveProfileOption(0, 0)}>
        remove-profile-option
      </button>
      <button data-testid="ts-update-profile-option-label" onClick={() => p.onUpdateProfileOption(0, 0, 'label', 'X')}>
        profile-option-label
      </button>
      <button data-testid="ts-update-profile-option-value" onClick={() => p.onUpdateProfileOption(0, 0, 'value', 2)}>
        profile-option-value
      </button>
      <button data-testid="ts-profile-target-mode" onClick={() => p.onUpdateProfileTargetMode(0, 'SELECTED_SKILLS')}>
        profile-target-mode
      </button>
      <button data-testid="ts-toggle-profile-skill" onClick={() => p.onToggleProfileSkill(0, 'skill-1')}>
        toggle-profile-skill
      </button>
      {/* core resources */}
      <button data-testid="ts-add-core" onClick={p.onAddCoreResource}>
        add-core
      </button>
      <button data-testid="ts-remove-core" onClick={() => p.onRemoveCoreResource(0)}>
        remove-core
      </button>
      <button data-testid="ts-update-core-slug" onClick={() => p.onUpdateCoreResource(0, 'slug', 'hp')}>
        core-slug
      </button>
      <button data-testid="ts-update-core-display" onClick={() => p.onUpdateCoreResource(0, 'displayName', 'Health')}>
        core-display
      </button>
      <button data-testid="ts-update-core-color" onClick={() => p.onUpdateCoreResource(0, 'color', '#f00')}>
        core-color
      </button>
      <button data-testid="ts-core-enabled" onClick={() => p.onUpdateCoreResourceEnabled(0, false)}>
        core-enabled
      </button>
      <button data-testid="ts-core-editable" onClick={() => p.onUpdateCoreResourceEditable(0, false)}>
        core-editable
      </button>
      <button data-testid="ts-core-show-notes" onClick={() => p.onUpdateCoreResourceShowNotes(0, false)}>
        core-show-notes
      </button>
      <button data-testid="ts-add-core2" onClick={p.onAddCoreResource}>
        add-core2
      </button>
      <button data-testid="ts-remove-core2" onClick={() => p.onRemoveCoreResource(1)}>
        remove-core2
      </button>
      <button data-testid="ts-update-core2-slug" onClick={() => p.onUpdateCoreResource(1, 'slug', 'mana')}>
        core2-slug
      </button>
      <button data-testid="ts-update-core2-slug-dup" onClick={() => p.onUpdateCoreResource(1, 'slug', 'hp')}>
        core2-slug-dup
      </button>
      <button data-testid="ts-update-core2-display" onClick={() => p.onUpdateCoreResource(1, 'displayName', 'Mana')}>
        core2-display
      </button>
      <button data-testid="ts-update-core2-color" onClick={() => p.onUpdateCoreResource(1, 'color', '#00f')}>
        core2-color
      </button>
      <button data-testid="ts-core2-enabled" onClick={() => p.onUpdateCoreResourceEnabled(1, false)}>
        core2-enabled
      </button>
      <button data-testid="ts-core2-editable" onClick={() => p.onUpdateCoreResourceEditable(1, false)}>
        core2-editable
      </button>
      <button data-testid="ts-core2-show-notes" onClick={() => p.onUpdateCoreResourceShowNotes(1, false)}>
        core2-show-notes
      </button>
      {/* armor classes */}
      <button data-testid="ts-add-ac" onClick={p.onAddNewAcConfig}>
        add-ac
      </button>
      <button data-testid="ts-remove-ac" onClick={() => p.onRemoveNewAcConfig(0)}>
        remove-ac
      </button>
      <button data-testid="ts-update-ac-name" onClick={() => p.onUpdateNewAcConfig(0, { name: 'AC' })}>
        ac-name
      </button>
      <button data-testid="ts-ac-enabled" onClick={() => p.onUpdateNewAcConfig(0, { enabled: false })}>
        ac-enabled
      </button>
      <button data-testid="ts-add-ac-field" onClick={() => p.onAddNewAcFieldForConfig(0)}>
        add-ac-field
      </button>
      <button data-testid="ts-remove-ac-field" onClick={() => p.onRemoveNewAcFieldForConfig(0, 0)}>
        remove-ac-field
      </button>
      <button data-testid="ts-update-ac-field-name" onClick={() => p.onUpdateNewAcFieldForConfig(0, 0, 'name', 'Base')}>
        ac-field-name
      </button>
      <button data-testid="ts-update-ac-field-key" onClick={() => p.onUpdateNewAcFieldForConfig(0, 0, 'key', 'base')}>
        ac-field-key
      </button>
      <button data-testid="ts-update-ac-field-key-clear" onClick={() => p.onUpdateNewAcFieldForConfig(0, 0, 'key', '')}>
        ac-field-key-clear
      </button>
      <button data-testid="ts-update-ac-field-default" onClick={() => p.onUpdateNewAcFieldForConfig(0, 0, 'defaultValue', '10')}>
        ac-field-default
      </button>
      <button data-testid="ts-update-ac-field-desc" onClick={() => p.onUpdateNewAcFieldForConfig(0, 0, 'description', 'desc')}>
        ac-field-desc
      </button>
      <button data-testid="ts-ac-field-editable" onClick={() => p.onUpdateNewAcFieldEditableForConfig(0, 0, true)}>
        ac-field-editable
      </button>
      <button data-testid="ts-toggle-ac-attr" onClick={() => p.onToggleNewAcAttributeIdForConfig(0, 'attr-1')}>
        toggle-ac-attr
      </button>
      <button data-testid="ts-update-ac-attr-mod" onClick={() => p.onUpdateNewAcAttributeModifierForConfig(0, 'attr-1', { allowPlayerSelection: true })}>
        ac-attr-mod
      </button>
      <button data-testid="ts-add-ac2" onClick={p.onAddNewAcConfig}>
        add-ac2
      </button>
      <button data-testid="ts-remove-ac2" onClick={() => p.onRemoveNewAcConfig(1)}>
        remove-ac2
      </button>
      <button data-testid="ts-update-ac2-name" onClick={() => p.onUpdateNewAcConfig(1, { name: 'AC' })}>
        ac2-name
      </button>
      <button data-testid="ts-update-ac2-name-flat" onClick={() => p.onUpdateNewAcConfig(1, { name: 'Flat' })}>
        ac2-name-flat
      </button>
      {/* character sections */}
      <button data-testid="ts-add-char-section" onClick={p.onAddNewCharacterSection}>
        add-char-section
      </button>
      <button data-testid="ts-remove-char-section" onClick={() => p.onRemoveNewCharacterSection(0)}>
        remove-char-section
      </button>
      <button data-testid="ts-update-char-section" onClick={() => p.onUpdateNewCharacterSection(0, 'Backstory')}>
        char-section
      </button>
      {/* resistances + visibility + formulas */}
      <button
        data-testid="ts-set-resistances"
        onClick={() =>
          p.onNewResistancesChange([
            {
              id: 'res-1',
              name: 'Fire',
              calculationType: 'MANUAL',
              components: [{ id: 'rc-1', name: 'Base', editableByPlayer: true, defaultValue: '0' }],
              attributeModifiers: [{ attributeId: 'attr-1', enabled: true }],
            },
          ])
        }
      >
        set-resistances
      </button>
      <button data-testid="ts-set-is-public" onClick={() => p.onNewIsPublicChange(true)}>
        set-is-public
      </button>
      <button data-testid="ts-new-attr-modifiers-enabled" onClick={() => p.onNewAttrModifiersEnabledChange(false)}>
        new-attr-modifiers-enabled
      </button>
      <button data-testid="ts-new-attr-formula" onClick={() => p.onNewAttrModifierFormulaChange('(x-10)/2')}>
        new-attr-formula
      </button>
      <button data-testid="ts-new-skill-formula" onClick={() => p.onNewSkillFormulaChange('x+1')}>
        new-skill-formula
      </button>
      {/* feature toggles */}
      <button data-testid="ts-feature-skills" onClick={() => p.onNewFeatureSkillsChange(false)}>
        feature-skills
      </button>
      <button data-testid="ts-feature-fields" onClick={() => p.onNewFeatureCustomFieldsChange(false)}>
        feature-fields
      </button>
      <button data-testid="ts-feature-core" onClick={() => p.onNewFeatureCoreResourcesChange(false)}>
        feature-core
      </button>
      <button data-testid="ts-feature-ac" onClick={() => p.onNewFeatureArmorClassChange(false)}>
        feature-ac
      </button>
      <button data-testid="ts-feature-sections" onClick={() => p.onNewFeatureCharacterSectionsChange(false)}>
        feature-sections
      </button>
      <button data-testid="ts-feature-profiles" onClick={() => p.onNewFeatureSkillProfilesChange(false)}>
        feature-profiles
      </button>
      <button data-testid="ts-feature-res" onClick={() => p.onNewFeatureResistanceChange(false)}>
        feature-res
      </button>
      {/* edit template */}
      <button data-testid="ts-edit-tpl-1" onClick={() => p.onStartEdit(p.templates[0])}>
        start-edit
      </button>
      <button data-testid="ts-delete-tpl-1" onClick={() => p.onDeleteTemplate('tpl-1')}>
        delete-template
      </button>
      <button data-testid="ts-cancel-edit" onClick={p.onCancelEdit}>
        cancel-edit
      </button>
      <button data-testid="ts-edit-submit" onClick={() => p.onUpdateTemplate({ preventDefault: () => {} })}>
        edit-submit
      </button>
      <button data-testid="ts-edit-name" onClick={() => p.onEditNameChange('Edited')}>
        edit-name
      </button>
      <button data-testid="ts-edit-desc" onClick={() => p.onEditDescriptionChange('Edited desc')}>
        edit-desc
      </button>
      <button data-testid="ts-add-edit-attr" onClick={p.onAddEditAttr}>
        add-edit-attr
      </button>
      <button data-testid="ts-remove-edit-attr" onClick={() => p.onRemoveEditAttr(0)}>
        remove-edit-attr
      </button>
      <button data-testid="ts-update-edit-attr-key" onClick={() => p.onUpdateEditAttr(0, 'key', 'str2')}>
        edit-attr-key
      </button>
      <button data-testid="ts-update-edit-attr-name" onClick={() => p.onUpdateEditAttr(0, 'name', 'Str2')}>
        edit-attr-name
      </button>
      <button data-testid="ts-add-edit-field" onClick={p.onAddEditField}>
        add-edit-field
      </button>
      <button data-testid="ts-remove-edit-field" onClick={() => p.onRemoveEditField(0)}>
        remove-edit-field
      </button>
      <button data-testid="ts-update-edit-field-key" onClick={() => p.onUpdateEditField(0, 'key', 'f1b')}>
        edit-field-key
      </button>
      <button data-testid="ts-update-edit-field-label" onClick={() => p.onUpdateEditField(0, 'label', 'F1b')}>
        edit-field-label
      </button>
      <button data-testid="ts-add-edit-skill" onClick={p.onAddEditSkill}>
        add-edit-skill
      </button>
      <button data-testid="ts-remove-edit-skill" onClick={() => p.onRemoveEditSkill(0)}>
        remove-edit-skill
      </button>
      <button data-testid="ts-update-edit-skill" onClick={() => p.onUpdateEditSkill(0, 'name', 'Stealth')}>
        edit-skill
      </button>
      <button data-testid="ts-toggle-edit-skill-allowed" onClick={() => p.onToggleEditSkillAllowedAttr(0, 'str')}>
        edit-skill-allowed
      </button>
      <button data-testid="ts-add-edit-profile" onClick={p.onAddEditProfile}>
        add-edit-profile
      </button>
      <button data-testid="ts-remove-edit-profile" onClick={() => p.onRemoveEditProfile(0)}>
        remove-edit-profile
      </button>
      <button data-testid="ts-update-edit-profile" onClick={() => p.onUpdateEditProfile(0, 'Prof2')}>
        edit-profile
      </button>
      <button data-testid="ts-add-edit-profile-option" onClick={() => p.onAddEditProfileOption(0)}>
        add-edit-profile-option
      </button>
      <button data-testid="ts-remove-edit-profile-option" onClick={() => p.onRemoveEditProfileOption(0, 0)}>
        remove-edit-profile-option
      </button>
      <button data-testid="ts-update-edit-profile-option" onClick={() => p.onUpdateEditProfileOption(0, 0, 'label', 'Y')}>
        edit-profile-option
      </button>
      <button data-testid="ts-edit-profile-target-mode" onClick={() => p.onUpdateEditProfileTargetMode(0, 'SELECTED_SKILLS')}>
        edit-profile-target-mode
      </button>
      <button data-testid="ts-toggle-edit-profile-skill" onClick={() => p.onToggleEditProfileSkill(0, 'skill-1')}>
        toggle-edit-profile-skill
      </button>
      <button data-testid="ts-add-edit-core" onClick={p.onAddEditCoreResource}>
        add-edit-core
      </button>
      <button data-testid="ts-remove-edit-core" onClick={() => p.onRemoveEditCoreResource(0)}>
        remove-edit-core
      </button>
      <button data-testid="ts-update-edit-core-slug" onClick={() => p.onUpdateEditCoreResource(0, 'slug', 'mana')}>
        edit-core-slug
      </button>
      <button data-testid="ts-update-edit-core-display" onClick={() => p.onUpdateEditCoreResource(0, 'displayName', 'Mana')}>
        edit-core-display
      </button>
      <button data-testid="ts-update-edit-core-color" onClick={() => p.onUpdateEditCoreResource(0, 'color', '#00f')}>
        edit-core-color
      </button>
      <button data-testid="ts-edit-core-enabled" onClick={() => p.onUpdateEditCoreResourceEnabled(0, false)}>
        edit-core-enabled
      </button>
      <button data-testid="ts-edit-core-editable" onClick={() => p.onUpdateEditCoreResourceEditable(0, false)}>
        edit-core-editable
      </button>
      <button data-testid="ts-edit-core-show-notes" onClick={() => p.onUpdateEditCoreResourceShowNotes(0, false)}>
        edit-core-show-notes
      </button>
      <button data-testid="ts-add-edit-ac" onClick={p.onAddEditAcConfig}>
        add-edit-ac
      </button>
      <button data-testid="ts-remove-edit-ac" onClick={() => p.onRemoveEditAcConfig(2)}>
        remove-edit-ac
      </button>
      <button data-testid="ts-update-edit-ac-name" onClick={() => p.onUpdateEditAcConfig(2, { name: 'Flat AC' })}>
        edit-ac-name
      </button>
      <button data-testid="ts-edit-ac-enabled" onClick={() => p.onUpdateEditAcConfig(2, { enabled: false })}>
        edit-ac-enabled
      </button>
      <button data-testid="ts-add-edit-ac-field" onClick={() => p.onAddEditAcFieldForConfig(2)}>
        add-edit-ac-field
      </button>
      <button data-testid="ts-remove-edit-ac-field" onClick={() => p.onRemoveEditAcFieldForConfig(2, 0)}>
        remove-edit-ac-field
      </button>
      <button data-testid="ts-update-edit-ac-field-name" onClick={() => p.onUpdateEditAcFieldForConfig(2, 0, 'name', 'Base2')}>
        edit-ac-field-name
      </button>
      <button data-testid="ts-update-edit-ac-field-key" onClick={() => p.onUpdateEditAcFieldForConfig(2, 0, 'key', 'base2')}>
        edit-ac-field-key
      </button>
      <button data-testid="ts-update-edit-ac-field-default" onClick={() => p.onUpdateEditAcFieldForConfig(2, 0, 'defaultValue', '12')}>
        edit-ac-field-default
      </button>
      <button data-testid="ts-update-edit-ac-field-desc" onClick={() => p.onUpdateEditAcFieldForConfig(2, 0, 'description', 'd2')}>
        edit-ac-field-desc
      </button>
      <button data-testid="ts-edit-ac-field-editable" onClick={() => p.onUpdateEditAcFieldEditableForConfig(2, 0, true)}>
        edit-ac-field-editable
      </button>
      <button data-testid="ts-toggle-edit-ac-attr" onClick={() => p.onToggleEditAcAttributeIdForConfig(2, 'attr-2')}>
        toggle-edit-ac-attr
      </button>
      <button data-testid="ts-update-edit-ac-attr-mod" onClick={() => p.onUpdateEditAcAttributeModifierForConfig(2, 'attr-2', { allowPlayerSelection: true })}>
        edit-ac-attr-mod
      </button>
      <button data-testid="ts-add-edit-char-section" onClick={p.onAddEditCharacterSection}>
        add-edit-char-section
      </button>
      <button data-testid="ts-remove-edit-char-section" onClick={() => p.onRemoveEditCharacterSection(0)}>
        remove-edit-char-section
      </button>
      <button data-testid="ts-update-edit-char-section" onClick={() => p.onUpdateEditCharacterSection(0, 'Bio')}>
        edit-char-section
      </button>
      <button
        data-testid="ts-set-edit-resistances"
        onClick={() =>
          p.onEditResistancesChange([
            {
              id: 'res-9',
              name: 'Cold',
              calculationType: 'CALCULATED',
              components: [{ id: 'rc-9', name: 'Base', editableByPlayer: false, defaultValue: '2' }],
              attributeModifiers: [{ attributeId: 'attr-2', enabled: false }],
            },
          ])
        }
      >
        set-edit-resistances
      </button>
      <button data-testid="ts-edit-attr-modifiers-enabled" onClick={() => p.onEditAttrModifiersEnabledChange(false)}>
        edit-attr-modifiers-enabled
      </button>
      <button data-testid="ts-edit-attr-formula" onClick={() => p.onEditAttrModifierFormulaChange('(x-10)/2')}>
        edit-attr-formula
      </button>
      <button data-testid="ts-edit-skill-formula" onClick={() => p.onEditSkillFormulaChange('x+1')}>
        edit-skill-formula
      </button>
    </div>
  ),
}))

import AdventureDetailPage from '@/app/dashboard/adventures/[id]/page'

// ── Fixtures ──
const baseAdventure = {
  id: 'adv-1',
  name: 'The Lost Mine',
  campaign: 'Forgotten Realms',
  synopsis: 'A dungeon crawl',
  maxPlayers: 5,
  ownerId: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  sessionWeekday: 'Friday',
  sessionTime: '18:30',
  sessionType: 'ONLINE',
  isPublic: false,
  templateSource: null,
}

const templates = [
  {
    id: 'tpl-1',
    name: 'Core Template',
    description: 'A base template',
    attributeModifiersEnabled: true,
    attributeModifierFormula: '(x-10)/2',
    skillFormula: 'x+1',
    attributes: [
      { id: 'attr-1', key: 'str', name: 'Strength' },
      { id: 'attr-2', key: 'dex', name: 'Dexterity' },
    ],
    templateFields: [{ id: 'field-1', key: 'f1', label: 'Field 1' }],
    templateSkills: [
      {
        id: 'skill-1',
        name: 'Athletics',
        description: 'Physical',
        attributeId: 'attr-1',
        allowedAttributeIds: ['attr-1', 'attr-2'],
        defaultAttributeId: 'attr-1',
        attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
        defaultAttribute: { id: 'attr-1', key: 'str', name: 'Strength' },
      },
    ],
    skillModifierProfiles: [
      {
        id: 'profile-1',
        name: 'Combat',
        targetMode: 'SELECTED_SKILLS',
        targetSkillIds: ['skill-1'],
        options: [
          { id: 'opt-0', label: 'None', value: 0 },
          { id: 'opt-1', label: 'Proficient', value: 2 },
        ],
      },
    ],
    coreResources: [
      { id: 'cr-1', slug: 'hp', displayName: 'Health', enabled: true, editableByPlayer: true, showNotes: true, color: '#f00' },
    ],
    armorClasses: [
      {
        id: 'ac-1',
        name: 'Armor Class',
        enabled: true,
        attributeModifiers: [
          {
            id: 'am-1',
            attributeId: 'attr-1',
            allowPlayerSelection: true,
            defaultAttributeId: 'attr-2',
            attribute: { id: 'attr-1', key: 'str', name: 'Strength' },
            defaultAttribute: { id: 'attr-2', key: 'dex', name: 'Dexterity' },
          },
        ],
        fields: [{ id: 'acf-1', name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: 'd' }],
      },
      { id: 'ac-2', enabled: false, attributeModifiers: [], fields: [] },
    ],
    resistances: [
      {
        id: 'res-1',
        name: 'Fire',
        calculationType: 'MANUAL',
        order: 0,
        components: [{ id: 'rc-1', name: 'Base', editableByPlayer: true, defaultValue: '0' }],
        attributeModifiers: [
          { id: 'ram-1', attributeId: 'attr-1', enabled: true, attribute: { id: 'attr-1', key: 'str', name: 'Strength' } },
        ],
      },
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
]

const snapshotData = {
  originalTemplateId: 'tpl-1',
  snapshot: {
    name: 'Snapshot',
    description: 'snap',
    createdAt: '2026-01-01T00:00:00Z',
    attributes: [{ id: 'attr-1' }],
    templateSkills: [{ id: 'skill-1' }],
    templateFields: [{ id: 'field-1' }],
    skillModifierProfiles: [{ id: 'profile-1' }],
    coreResources: [{ id: 'cr-1' }],
    armorClasses: [{ id: 'ac-1' }],
    characterSections: [{ id: 'sec-1' }],
    resistances: [{ id: 'res-1' }],
  },
}

const members = [
  {
    id: 'm-1',
    role: 'GM',
    joinedAt: '2026-01-01T00:00:00Z',
    user: { id: 'user-1', email: 'alice@example.com', displayName: 'Alice' },
  },
  {
    id: 'm-2',
    role: 'PLAYER',
    joinedAt: '2026-01-01T00:00:00Z',
    user: { id: 'user-2', email: 'bob@example.com', displayName: null },
  },
]

const invitations = [
  {
    id: 'inv-1',
    invitedEmail: 'carol@example.com',
    token: 'tok-1',
    role: 'PLAYER',
    status: 'pending',
    expiresAt: '2026-02-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: { id: 'user-1', displayName: 'Alice', email: 'alice@example.com' },
  },
  {
    id: 'inv-2',
    invitedEmail: null,
    token: 'tok-2',
    role: 'PLAYER',
    status: 'pending',
    expiresAt: '2026-02-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: { id: 'user-1', displayName: null, email: 'alice@example.com' },
  },
]

const campaignCharacters = [
  {
    id: 'sheet-1',
    characterName: 'Aria',
    adventure: { id: 'adv-1', name: 'The Lost Mine', campaign: 'Forgotten Realms' },
    template: { id: 'tpl-1', name: 'Core Template' },
    owner: { id: 'user-1', displayName: 'Alice', email: 'alice@example.com' },
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'sheet-2',
    characterName: 'Borin',
    adventure: { id: 'adv-1', name: 'The Lost Mine', campaign: 'Forgotten Realms' },
    template: { id: 'tpl-1', name: 'Core Template' },
    owner: { id: 'user-2', displayName: null, email: 'bob@example.com' },
    createdAt: '2026-01-01T00:00:00Z',
  },
]

const userSheets = [
  {
    id: 'sheet-9',
    characterName: 'Unlinked',
    adventure: { id: 'adv-9', name: 'Other', campaign: 'Other' },
    template: { id: 'tpl-9', name: 'Other Template' },
    createdAt: '2026-01-01T00:00:00Z',
  },
]

const joinRequests = [
  { id: 'jr-1', userId: 'user-3', user: { id: 'user-3', displayName: 'Carol', email: 'carol@example.com' }, message: 'Let me join', status: 'pending', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'jr-2', userId: 'user-4', user: { id: 'user-4', displayName: null, email: 'dave@example.com' }, message: null, status: 'pending', createdAt: '2026-01-01T00:00:00Z' },
]

function apiGetImpl(url: string) {
  switch (url) {
    case '/adventures/adv-1':
      return Promise.resolve(baseAdventure)
    case '/me/adventures':
      return Promise.resolve([{ id: 'adv-1', role: 'GM' }])
    case '/adventures/adv-1/templates':
      return Promise.resolve(templates)
    case '/adventures/adv-1/template/snapshot':
      return Promise.resolve(snapshotData)
    case '/adventures/adv-1/join-requests':
      return Promise.resolve(joinRequests)
    case '/adventures/adv-1/members':
      return Promise.resolve(members)
    case '/adventures/adv-1/invitations':
      return Promise.resolve(invitations)
    case '/character-sheets/adventure/adv-1':
      return Promise.resolve(campaignCharacters)
    case '/character-sheets':
      return Promise.resolve(userSheets)
    default:
      return Promise.resolve([])
  }
}

const baseUser = {
  id: 'user-1',
  email: 'alice@example.com',
  displayName: 'Alice',
  onboardingComplete: true,
  isAdmin: false,
  isEarlyAccess: false,
  language: 'en',
  twoFactorEnabled: false,
  emailVerified: true,
  hasPassword: true,
}

function setAuth(overrides: { user?: typeof baseUser | null; loading?: boolean } = {}) {
  mockAuth.mockReturnValue({
    user: overrides.user !== undefined ? overrides.user : baseUser,
    loading: overrides.loading !== undefined ? overrides.loading : false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    completeOnboarding: vi.fn(),
    verifyTwoFactor: vi.fn(),
    refreshProfile: vi.fn(),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRouterPush.mockReset()
  mockRouterReplace.mockReset()
  mockUseParams.mockReturnValue({ id: 'adv-1' })
  mockApiGet.mockImplementation(apiGetImpl)
  mockApiPost.mockResolvedValue({})
  mockApiPut.mockResolvedValue({})
  mockApiPatch.mockResolvedValue({})
  mockApiDelete.mockResolvedValue({})
  setAuth()
})

function renderPage() {
  return render(<AdventureDetailPage />)
}

// ════════════════════════════════════════════════════════════
// Loading + empty states
// ════════════════════════════════════════════════════════════

describe('AdventureDetailPage — loading & empty states', () => {
  it('shows a page loading skeleton while the adventure is being fetched', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    const { container } = renderPage()
    expect(container.querySelector('.skeleton')).toBeTruthy()
  })

  it('shows the empty state when the adventure cannot be fetched', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('boom'))
    renderPage()
    expect(await screen.findByText('Campaign Not Found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toHaveAttribute('href', '/dashboard')
  })
})

// ════════════════════════════════════════════════════════════
// Campaign tab
// ════════════════════════════════════════════════════════════

describe('AdventureDetailPage — campaign tab', () => {
  it('renders session information and GM-only sections for a GM', async () => {
    renderPage()
    expect(await screen.findByText('The Lost Mine')).toBeInTheDocument()
    expect(screen.getByText('Session Information')).toBeInTheDocument()
    expect(screen.getByText('Day:')).toBeInTheDocument()
    expect(screen.getByText('Friday')).toBeInTheDocument()
    expect(screen.getByText('Time:')).toBeInTheDocument()
    expect(screen.getByText('6:30 PM')).toBeInTheDocument()
    expect(screen.getByText('Format:')).toBeInTheDocument()
    expect(screen.getByText('🌐 Online')).toBeInTheDocument()
    // tabs
    expect(screen.getByRole('button', { name: 'Campaign' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Books' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Templates' })).toBeInTheDocument()
    // GM-only sections
    expect(screen.getByTestId('toggle-Invite Players')).toBeInTheDocument()
    expect(screen.getByTestId('toggle-NPCs & Mobs')).toBeInTheDocument()
    expect(screen.getByTestId('toggle-Campaign Notebook')).toBeInTheDocument()
    expect(screen.getByText('Publishing')).toBeInTheDocument()
    expect(screen.getByText('Open Notebook')).toBeInTheDocument()
    expect(screen.getByTestId('JoinRequestPanel')).toBeInTheDocument()
    expect(screen.getByTestId('CampaignCreatureSidebar')).toBeInTheDocument()
    expect(screen.getByTestId('AdventureHeader')).toBeInTheDocument()
  })

  it('renders the in-person format', async () => {
    mockApiGet.mockImplementation((url: string) =>
      url === '/adventures/adv-1' ? Promise.resolve({ ...baseAdventure, sessionType: 'IN_PERSON' }) : apiGetImpl(url),
    )
    renderPage()
    expect(await screen.findByText('📍 In Person')).toBeInTheDocument()
  })

  it('shows the session-not-defined note when no session info exists', async () => {
    mockApiGet.mockImplementation((url: string) =>
      url === '/adventures/adv-1'
        ? Promise.resolve({ ...baseAdventure, sessionWeekday: '', sessionTime: '', sessionType: '' })
        : apiGetImpl(url),
    )
    renderPage()
    expect(await screen.findByText('Session schedule not defined')).toBeInTheDocument()
  })

  it('hides GM-only sections for a non-GM member', async () => {
    mockApiGet.mockImplementation((url: string) =>
      url === '/me/adventures' ? Promise.resolve([{ id: 'adv-1', role: 'PLAYER' }]) : apiGetImpl(url),
    )
    renderPage()
    expect(await screen.findByText('The Lost Mine')).toBeInTheDocument()
    expect(screen.queryByTestId('toggle-Invite Players')).not.toBeInTheDocument()
    expect(screen.queryByTestId('toggle-NPCs & Mobs')).not.toBeInTheDocument()
    expect(screen.queryByTestId('toggle-Campaign Notebook')).not.toBeInTheDocument()
    expect(screen.queryByText('Publishing')).not.toBeInTheDocument()
    expect(screen.queryByTestId('VisibilityToggle')).not.toBeInTheDocument()
    expect(screen.queryByTestId('JoinRequestPanel')).not.toBeInTheDocument()
    // characters section is visible to everyone
    expect(screen.getByTestId('toggle-Characters')).toBeInTheDocument()
  })

  it('toggles the party members list, fetches members/invitations, and removes a member', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    fireEventClick('toggle-Party Members')
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/adventures/adv-1/members'))
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/adventures/adv-1/invitations'))
    await waitFor(() => expect(screen.getAllByTestId('MemberRow')).toHaveLength(2))
    // displayName null fallback to email
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    screen.getAllByTestId('member-remove')[0].click()
    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith('/adventures/adv-1/members/user-1'))
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/adventures/adv-1/members'))
  })

  it('swallows member fetch/removal errors without crashing', async () => {
    let rejectMembers = true
    mockApiGet.mockImplementation((url: string) =>
      url === '/adventures/adv-1/members'
        ? rejectMembers
          ? Promise.reject(new Error('boom'))
          : Promise.resolve(members)
        : apiGetImpl(url),
    )
    renderPage()
    await screen.findByText('The Lost Mine')
    // first open: fetch fails, no rows render
    fireEventClick('toggle-Party Members')
    await tick()
    // close + reopen so a successful refetch renders rows
    rejectMembers = false
    fireEventClick('toggle-Party Members')
    fireEventClick('toggle-Party Members')
    await waitFor(() => expect(screen.getAllByTestId('MemberRow')).toHaveLength(2))
    mockApiDelete.mockRejectedValueOnce(new Error('boom2'))
    const removeBtn = screen.getAllByTestId('member-remove')[0]
    removeBtn.click()
    await tick()
    expect(mockApiDelete).toHaveBeenCalledWith('/adventures/adv-1/members/user-1')
  })
})

// ════════════════════════════════════════════════════════════
// Invitations
// ════════════════════════════════════════════════════════════

describe('AdventureDetailPage — invitations', () => {
  it('sends an email invitation, creates a link, and revokes an invitation', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    // fetch invitations first so revoke buttons exist
    fireEventClick('toggle-Party Members')
    await waitFor(() => expect(screen.getByTestId('revoke-inv-1')).toBeInTheDocument())

    fireEventClick('invite-email-change')
    mockApiPost.mockResolvedValueOnce({})
    fireEventClick('invite-email')
    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/adventures/adv-1/invitations/email', { email: 'carol@example.com' }),
    )

    mockApiPost.mockResolvedValueOnce({ inviteUrl: 'http://invite/abc' })
    fireEventClick('invite-link')
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/adventures/adv-1/invitations/link'))
    expect(await screen.findByTestId('invite-link-value')).toHaveTextContent('http://invite/abc')

    mockApiPost.mockResolvedValueOnce({})
    fireEventClick('revoke-inv-2')
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/invitations/inv-2/revoke'))
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/adventures/adv-1/invitations'))
  })

  it('shows an error when sending an email invitation fails', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    mockApiPost.mockRejectedValueOnce(new Error('invite-boom'))
    fireEventClick('invite-email')
    await tick()
    expect(await screen.findByTestId('invite-error')).toHaveTextContent('invite-boom')
  })

  it('shows an error when creating an invite link fails', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    mockApiPost.mockRejectedValueOnce(new Error('link-boom'))
    fireEventClick('invite-link')
    await tick()
    expect(await screen.findByTestId('invite-error')).toHaveTextContent('link-boom')
  })
})

// ════════════════════════════════════════════════════════════
// Characters
// ════════════════════════════════════════════════════════════

describe('AdventureDetailPage — characters', () => {
  it('creates, links, removes, and views characters', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    // toggle characters to load campaign + user sheets
    fireEventClick('toggle-Characters')
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/character-sheets/adventure/adv-1'))
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/character-sheets'))
    await waitFor(() => expect(screen.getByTestId('char-remove-sheet-1')).toBeInTheDocument())

    // create
    fireEventClick('char-new')
    fireEventClick('char-name')
    mockApiPost.mockResolvedValueOnce({ id: 'sheet-new' })
    fireEventClick('char-create')
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/from-campaign', { characterName: 'Aria', adventureId: 'adv-1' }))
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/character-sheets/sheet-new'))

    // link
    fireEventClick('char-link')
    fireEventClick('char-sheet')
    mockApiPost.mockResolvedValueOnce({})
    fireEventClick('char-link-submit')
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-9/link', { adventureId: 'adv-1' }))
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/character-sheets/adventure/adv-1'))

    // remove
    mockApiPost.mockResolvedValueOnce({})
    fireEventClick('char-remove-sheet-1')
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/character-sheets/sheet-1/unlink'))

    // view
    fireEventClick('char-view')
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/character-sheets/sheet-1'))
  })

  it('shows errors when creating/linking a character fails', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    mockApiPost.mockRejectedValueOnce(new Error('char-boom'))
    fireEventClick('char-new')
    fireEventClick('char-name')
    fireEventClick('char-create')
    await tick()
    expect(await screen.findByTestId('char-new-error')).toHaveTextContent('char-boom')

    mockApiPost.mockRejectedValueOnce(new Error('link-boom'))
    fireEventClick('char-link')
    fireEventClick('char-sheet')
    fireEventClick('char-link-submit')
    await tick()
    expect(await screen.findByTestId('char-link-error')).toHaveTextContent('link-boom')
  })
})

// ════════════════════════════════════════════════════════════
// Adventure edit / delete
// ════════════════════════════════════════════════════════════

describe('AdventureDetailPage — edit & delete', () => {
  it('edits the adventure and saves the full body', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    fireEventClick('header-edit')
    await screen.findByTestId('EditForm')
    fireEventClick('edit-name')
    fireEventClick('edit-campaign')
    fireEventClick('edit-synopsis')
    fireEventClick('edit-maxplayers')
    fireEventClick('edit-weekday')
    fireEventClick('edit-time')
    fireEventClick('edit-type')
    mockApiPatch.mockResolvedValueOnce(baseAdventure)
    fireEventClick('edit-submit')
    await waitFor(() =>
      expect(mockApiPatch).toHaveBeenCalledWith('/adventures/adv-1', {
        name: 'New Name',
        campaign: 'New Campaign',
        synopsis: 'New synopsis',
        maxPlayers: 6,
        sessionWeekday: 'Friday',
        sessionTime: '18:30',
        sessionType: 'ONLINE',
      }),
    )
    await waitFor(() => expect(screen.queryByTestId('EditForm')).not.toBeInTheDocument())
  })

  it('saves an adventure with the trimmed-falsy fallbacks', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    fireEventClick('header-edit')
    await screen.findByTestId('EditForm')
    fireEventClick('edit-name-clear')
    fireEventClick('edit-campaign-clear')
    fireEventClick('edit-synopsis-clear')
    fireEventClick('edit-weekday-clear')
    fireEventClick('edit-time-clear')
    fireEventClick('edit-type-clear')
    mockApiPatch.mockResolvedValueOnce(baseAdventure)
    fireEventClick('edit-submit')
    await waitFor(() => {
      const [, body] = mockApiPatch.mock.calls.find(([u]) => u === '/adventures/adv-1') ?? []
      expect(body.name).toBeUndefined()
      expect(body.campaign).toBeUndefined()
      expect(body.synopsis).toBeUndefined()
      expect(body.sessionWeekday).toBeUndefined()
      expect(body.sessionTime).toBeUndefined()
      expect(body.sessionType).toBeUndefined()
      expect(body).toMatchObject({ maxPlayers: 5 })
    })
  })

  it('shows an edit error when saving fails', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    fireEventClick('header-edit')
    await screen.findByTestId('EditForm')
    mockApiPatch.mockRejectedValueOnce(new Error('edit-boom'))
    fireEventClick('edit-submit')
    await tick()
    expect(await screen.findByTestId('edit-error')).toHaveTextContent('edit-boom')
  })

  it('cancels editing and returns to the main view', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    fireEventClick('header-edit')
    await screen.findByTestId('EditForm')
    fireEventClick('edit-cancel')
    await waitFor(() => expect(screen.queryByTestId('EditForm')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Campaign' })).toBeInTheDocument()
  })

  it('deletes the adventure and redirects to the dashboard', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    fireEventClick('header-delete')
    await screen.findByTestId('DeleteModal')
    fireEventClick('delete-confirm')
    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith('/adventures/adv-1'))
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard'))
  })

  it('closes the delete modal when deletion fails', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    fireEventClick('header-delete')
    await screen.findByTestId('DeleteModal')
    mockApiDelete.mockRejectedValueOnce(new Error('delete-boom'))
    fireEventClick('delete-confirm')
    await tick()
    await waitFor(() => expect(screen.queryByTestId('DeleteModal')).not.toBeInTheDocument())
    expect(mockRouterPush).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════
// Leave campaign + transfer GM
// ════════════════════════════════════════════════════════════

describe('AdventureDetailPage — leave & transfer GM', () => {
  function asPlayer() {
    mockApiGet.mockImplementation((url: string) =>
      url === '/me/adventures' ? Promise.resolve([{ id: 'adv-1', role: 'PLAYER' }]) : apiGetImpl(url),
    )
  }

  it('shows the leave button for a non-GM member and not the transfer button', async () => {
    asPlayer()
    renderPage()
    const leave = await screen.findByRole('button', { name: 'Leave Campaign' })
    expect(leave).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Transfer GM Role' })).not.toBeInTheDocument()
  })

  it('leaves the campaign as a non-GM member and redirects to the dashboard', async () => {
    asPlayer()
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Leave Campaign' }))
    await screen.findByTestId('LeaveModal')
    fireEvent.click(screen.getByTestId('leave-confirm'))
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/adventures/adv-1/leave'))
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard'))
  })

  it('keeps the leave modal open and shows the error when leaving fails', async () => {
    asPlayer()
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Leave Campaign' }))
    await screen.findByTestId('LeaveModal')
    mockApiPost.mockRejectedValueOnce(new Error('leave-boom'))
    fireEvent.click(screen.getByTestId('leave-confirm'))
    expect(await screen.findByTestId('leave-error')).toHaveTextContent('leave-boom')
    expect(screen.getByTestId('LeaveModal')).toBeInTheDocument()
    expect(mockRouterPush).not.toHaveBeenCalled()
  })

  it('cancels leaving and closes the modal', async () => {
    asPlayer()
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Leave Campaign' }))
    await screen.findByTestId('LeaveModal')
    fireEvent.click(screen.getByTestId('leave-cancel'))
    await waitFor(() => expect(screen.queryByTestId('LeaveModal')).not.toBeInTheDocument())
    expect(mockApiPost).not.toHaveBeenCalledWith('/adventures/adv-1/leave')
  })

  it('shows the transfer button for the GM and not the leave button', async () => {
    renderPage()
    const transfer = await screen.findByRole('button', { name: 'Transfer GM Role' })
    expect(transfer).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leave Campaign' })).not.toBeInTheDocument()
  })

  it('transfers the GM role, refreshes members/role/access, and closes the modal', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Transfer GM Role' }))
    await screen.findByTestId('TransferGmModal')
    fireEvent.change(screen.getByTestId('transfer-select'), { target: { value: 'user-2' } })
    fireEvent.click(screen.getByTestId('transfer-confirm'))
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/adventures/adv-1/transfer-gm', { newGmId: 'user-2' })
      expect(mockApiGet).toHaveBeenCalledWith('/adventures/adv-1/members')
      expect(mockApiGet).toHaveBeenCalledWith('/me/adventures')
      expect(mockApiGet).toHaveBeenCalledWith('/adventures/adv-1/access')
    })
    await waitFor(() => expect(screen.queryByTestId('TransferGmModal')).not.toBeInTheDocument())
  })

  it('keeps the transfer modal open and shows the error when transfer fails', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Transfer GM Role' }))
    await screen.findByTestId('TransferGmModal')
    fireEvent.change(screen.getByTestId('transfer-select'), { target: { value: 'user-2' } })
    mockApiPost.mockRejectedValueOnce(new Error('transfer-boom'))
    fireEvent.click(screen.getByTestId('transfer-confirm'))
    expect(await screen.findByTestId('transfer-error')).toHaveTextContent('transfer-boom')
    expect(screen.getByTestId('TransferGmModal')).toBeInTheDocument()
  })

  it('disables the transfer confirm until a player is selected', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Transfer GM Role' }))
    await screen.findByTestId('TransferGmModal')
    expect(screen.getByTestId('transfer-confirm')).toBeDisabled()
    fireEvent.change(screen.getByTestId('transfer-select'), { target: { value: 'user-2' } })
    expect(screen.getByTestId('transfer-confirm')).toBeEnabled()
  })

  it('cancels the transfer and closes the modal', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Transfer GM Role' }))
    await screen.findByTestId('TransferGmModal')
    fireEvent.click(screen.getByTestId('transfer-cancel'))
    await waitFor(() => expect(screen.queryByTestId('TransferGmModal')).not.toBeInTheDocument())
    expect(mockApiPost).not.toHaveBeenCalledWith('/adventures/adv-1/transfer-gm', expect.anything())
  })

  it('shows the read-only banner when the campaign access state is read-only', async () => {
    mockApiGet.mockImplementation((url: string) =>
      url === '/adventures/adv-1/access'
        ? Promise.resolve({ accessState: 'READ_ONLY' })
        : apiGetImpl(url),
    )
    renderPage()
    const badge = await screen.findByText('Read-only')
    expect(badge).toBeInTheDocument()
    expect(
      screen.getByText(/This campaign is read-only because the Game Master's subscription has ended/),
    ).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════════════
// Templates tab
// ════════════════════════════════════════════════════════════

describe('AdventureDetailPage — templates tab', () => {
  it('renders both the attachment panel and the template section when no template is sourced', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    clickRole('Templates')
    expect(await screen.findByTestId('TemplatesSection')).toBeInTheDocument()
    expect(screen.getByTestId('TemplateAttachmentPanel')).toBeInTheDocument()
    expect(screen.getByTestId('ts-template-source-state')).toHaveTextContent('free')
  })

  it('renders only the attachment panel when a template is attached', async () => {
    mockApiGet.mockImplementation((url: string) =>
      url === '/adventures/adv-1' ? Promise.resolve({ ...baseAdventure, templateSource: 'attached' }) : apiGetImpl(url),
    )
    renderPage()
    await screen.findByText('The Lost Mine')
    clickRole('Templates')
    expect(await screen.findByTestId('TemplateAttachmentPanel')).toBeInTheDocument()
    expect(screen.queryByTestId('TemplatesSection')).not.toBeInTheDocument()
  })

  it('renders only the template section when the template is campaign-owned', async () => {
    mockApiGet.mockImplementation((url: string) =>
      url === '/adventures/adv-1' ? Promise.resolve({ ...baseAdventure, templateSource: 'campaign' }) : apiGetImpl(url),
    )
    renderPage()
    await screen.findByText('The Lost Mine')
    clickRole('Templates')
    expect(await screen.findByTestId('TemplatesSection')).toBeInTheDocument()
    expect(screen.queryByTestId('TemplateAttachmentPanel')).not.toBeInTheDocument()
    expect(screen.getByTestId('ts-template-source-state')).toHaveTextContent('campaign')
  })

  it('shows the snapshot loading spinner while the snapshot is fetching', async () => {
    mockApiGet.mockImplementation((url: string) =>
      url === '/adventures/adv-1/template/snapshot' ? new Promise(() => {}) : apiGetImpl(url),
    )
    renderPage()
    await screen.findByText('The Lost Mine')
    clickRole('Templates')
    expect(await screen.findByText('Loading template snapshot...')).toBeInTheDocument()
  })

  it('falls back to no snapshot data when the snapshot fetch fails', async () => {
    mockApiGet.mockImplementation((url: string) =>
      url === '/adventures/adv-1/template/snapshot' ? Promise.reject(new Error('snap-boom')) : apiGetImpl(url),
    )
    renderPage()
    await screen.findByText('The Lost Mine')
    clickRole('Templates')
    // the attachment panel still renders and the snapshot spinner clears
    expect(await screen.findByTestId('TemplateAttachmentPanel')).toBeInTheDocument()
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/adventures/adv-1/template/snapshot'))
    expect(screen.queryByText('Loading template snapshot...')).not.toBeInTheDocument()
  })

  it('attaches and detaches a template', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    clickRole('Templates')
    await screen.findByTestId('TemplateAttachmentPanel')
    fireEventClick('ts-attach')
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/adventures/adv-1/template/snapshot'))
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/adventures/adv-1/templates'))
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/adventures/adv-1'))
    fireEventClick('ts-detach')
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/adventures/adv-1'))
  })

  it('shows an error when template creation fails', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    clickRole('Templates')
    await screen.findByTestId('TemplatesSection')
    fireEventClick('ts-name')
    mockApiPost.mockRejectedValueOnce(new Error('create-boom'))
    fireEventClick('ts-create')
    await tick()
    expect(await screen.findByTestId('ts-template-error')).toHaveTextContent('create-boom')
  })
})

// ════════════════════════════════════════════════════════════
// Template creation payload
// ════════════════════════════════════════════════════════════

describe('AdventureDetailPage — create template', () => {
  async function openTemplatesTab() {
    renderPage()
    await screen.findByText('The Lost Mine')
    clickRole('Templates')
    await screen.findByTestId('TemplatesSection')
  }

  it('creates a template with a full payload (all features enabled)', async () => {
    await openTemplatesTab()
    fireEventClick('ts-new')
    fireEventClick('ts-name')
    fireEventClick('ts-desc')
    // attributes
    fireEventClick('ts-add-attr')
    fireEventClick('ts-update-attr-key')
    fireEventClick('ts-update-attr-name')
    // fields
    fireEventClick('ts-add-field')
    fireEventClick('ts-update-field-key')
    fireEventClick('ts-update-field-label')
    // skills
    fireEventClick('ts-add-skill')
    fireEventClick('ts-update-skill-name')
    fireEventClick('ts-update-skill-desc')
    fireEventClick('ts-update-skill-attr')
    fireEventClick('ts-toggle-skill-allowed')
    // profiles
    fireEventClick('ts-add-profile')
    fireEventClick('ts-update-profile-name')
    fireEventClick('ts-add-profile-option')
    fireEventClick('ts-update-profile-option-label')
    fireEventClick('ts-update-profile-option-value')
    fireEventClick('ts-profile-target-mode')
    fireEventClick('ts-toggle-profile-skill')
    // core resources (index 0: displayName left empty -> slug fallback)
    fireEventClick('ts-add-core')
    fireEventClick('ts-update-core-slug')
    fireEventClick('ts-core-enabled')
    fireEventClick('ts-core-editable')
    fireEventClick('ts-core-show-notes')
    // core resource index 1: displayName provided
    fireEventClick('ts-add-core2')
    fireEventClick('ts-update-core2-slug')
    fireEventClick('ts-update-core2-display')
    fireEventClick('ts-update-core2-color')
    fireEventClick('ts-core2-enabled')
    fireEventClick('ts-core2-editable')
    fireEventClick('ts-core2-show-notes')
    // armor classes
    fireEventClick('ts-add-ac')
    fireEventClick('ts-update-ac-name')
    fireEventClick('ts-add-ac-field')
    fireEventClick('ts-update-ac-field-name')
    fireEventClick('ts-update-ac-field-name') // key already set -> false arm of slugify
    fireEventClick('ts-update-ac-field-key')
    fireEventClick('ts-update-ac-field-default')
    fireEventClick('ts-update-ac-field-desc')
    fireEventClick('ts-ac-field-editable')
    fireEventClick('ts-toggle-ac-attr')
    fireEventClick('ts-update-ac-attr-mod')
    // character sections
    fireEventClick('ts-add-char-section')
    fireEventClick('ts-update-char-section')
    // resistances + visibility + formulas
    fireEventClick('ts-set-resistances')
    fireEventClick('ts-set-is-public')
    fireEventClick('ts-new-attr-formula')
    fireEventClick('ts-new-skill-formula')

    mockApiPost.mockResolvedValueOnce({})
    fireEventClick('ts-create')
    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/adventures/adv-1/templates', expect.any(Object)),
    )
    const [, body] = mockApiPost.mock.calls.find(([u]) => u === '/adventures/adv-1/templates') ?? []
    expect(body).toMatchObject({
      name: 'My Template',
      description: 'A template',
      isPublic: true,
      attributeModifiersEnabled: true,
      attributeModifierFormula: '(x-10)/2',
      skillFormula: 'x+1',
      attributes: [{ key: 'str', name: 'Strength' }],
      templateFields: [{ key: 'f1', label: 'Field 1' }],
      skills: [
        {
          name: 'Athletics',
          description: 'desc',
          attributeId: 'attr-1',
          allowedAttributeIds: ['attr-1'],
          defaultAttributeId: undefined,
        },
      ],
      skillModifierProfiles: [
        { name: 'Prof', targetMode: 'SELECTED_SKILLS', targetSkillIds: ['skill-1'], options: [{ label: 'X', value: 2 }] },
      ],
      coreResources: [
        { displayName: 'hp', slug: 'hp', enabled: false, editableByPlayer: false, showNotes: false, color: undefined },
        { displayName: 'Mana', slug: 'mana', enabled: false, editableByPlayer: false, showNotes: false, color: '#00f' },
      ],
      armorClasses: [
        {
          name: 'AC',
          enabled: true,
          attributeModifiers: [{ attributeId: 'attr-1', allowPlayerSelection: true, defaultAttributeId: 'attr-1' }],
          fields: [{ name: 'Base', key: 'base', defaultValue: '10', editableByPlayer: true, description: 'desc' }],
        },
      ],
      characterSections: [{ id: undefined, name: 'Backstory' }],
      resistances: [
        {
          id: 'res-1',
          name: 'Fire',
          calculationType: 'MANUAL',
          components: [{ id: 'rc-1', name: 'Base', editableByPlayer: true, defaultValue: '0' }],
          attributeModifiers: [{ attributeId: 'attr-1', enabled: true }],
        },
      ],
    })
  })

  it('creates a minimal template when every feature is toggled off', async () => {
    await openTemplatesTab()
    fireEventClick('ts-name')
    fireEventClick('ts-feature-skills')
    fireEventClick('ts-feature-fields')
    fireEventClick('ts-feature-core')
    fireEventClick('ts-feature-ac')
    fireEventClick('ts-feature-sections')
    fireEventClick('ts-feature-profiles')
    fireEventClick('ts-feature-res')
    mockApiPost.mockResolvedValueOnce({})
    fireEventClick('ts-create')
    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/adventures/adv-1/templates', expect.any(Object)),
    )
    const [, body] = mockApiPost.mock.calls.find(([u]) => u === '/adventures/adv-1/templates') ?? []
    expect(body).toMatchObject({
      name: 'My Template',
      attributeModifiersEnabled: true,
      attributeModifierFormula: undefined,
      skillFormula: undefined,
      templateFields: undefined,
      skills: undefined,
      skillModifierProfiles: undefined,
      coreResources: undefined,
      armorClasses: undefined,
      characterSections: undefined,
      resistances: undefined,
    })
  })

  it('surfaces every template validation error in order', async () => {
    await openTemplatesTab()
    fireEventClick('ts-name')

    // 1) attributes need key + name
    fireEventClick('ts-add-attr')
    fireEventClick('ts-create')
    await waitFor(() => expect(screen.getByTestId('ts-template-error')).toHaveTextContent('All attributes must have a key and name'))
    fireEventClick('ts-update-attr-key')
    fireEventClick('ts-update-attr-name')

    // 2) duplicate core resource slug
    fireEventClick('ts-add-core')
    fireEventClick('ts-update-core-slug')
    fireEventClick('ts-add-core2')
    fireEventClick('ts-update-core2-slug-dup') // 'hp' duplicates core0
    fireEventClick('ts-create')
    await waitFor(() =>
      expect(screen.getByTestId('ts-template-error')).toHaveTextContent('Duplicate slug: "hp"'),
    )
    fireEventClick('ts-update-core2-slug') // 'mana' distinct -> passes
    fireEventClick('ts-remove-core2')

    // 3) profile with SELECTED_SKILLS but no selected skills
    fireEventClick('ts-add-profile')
    fireEventClick('ts-update-profile-name')
    fireEventClick('ts-profile-target-mode')
    fireEventClick('ts-create')
    await waitFor(() =>
      expect(screen.getByTestId('ts-template-error')).toHaveTextContent('Profile "Prof" uses "Selected Skills" mode but no skills are selected.'),
    )
    fireEventClick('ts-toggle-profile-skill')

    // 4) duplicate armor-class names
    fireEventClick('ts-add-ac')
    fireEventClick('ts-update-ac-name')
    fireEventClick('ts-add-ac2')
    fireEventClick('ts-update-ac2-name') // 'AC' duplicates ac0
    fireEventClick('ts-create')
    await waitFor(() => expect(screen.getByTestId('ts-template-error')).toHaveTextContent('Armor Class names must be unique'))
    fireEventClick('ts-update-ac2-name-flat') // 'Flat'

    // 5) AC field with a name but an empty key
    fireEventClick('ts-add-ac-field')
    fireEventClick('ts-update-ac-field-name') // 'Base' -> key auto 'base'
    fireEventClick('ts-update-ac-field-key-clear')
    fireEventClick('ts-create')
    await waitFor(() =>
      expect(screen.getByTestId('ts-template-error')).toHaveTextContent('Armor Class "AC" has a component with an empty key'),
    )
    fireEventClick('ts-update-ac-field-key') // 'base'

    // finally create succeeds
    mockApiPost.mockResolvedValueOnce({})
    fireEventClick('ts-create')
    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/adventures/adv-1/templates', expect.any(Object)),
    )
  })

  it('resets the new-template form when cancel is clicked', async () => {
    await openTemplatesTab()
    fireEventClick('ts-new')
    fireEventClick('ts-name')
    fireEventClick('ts-cancel-new')
    // no crash; template error cleared
    expect(screen.getByTestId('ts-template-error')).toBeEmptyDOMElement()
  })
})

// ════════════════════════════════════════════════════════════
// Template editing / deleting
// ════════════════════════════════════════════════════════════

describe('AdventureDetailPage — edit & delete template', () => {
  it('starts editing a template, saves the update, and can delete it', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    clickRole('Templates')
    await screen.findByTestId('TemplatesSection')

    fireEventClick('ts-edit-tpl-1')
    await waitFor(() => expect(screen.getByTestId('ts-editing-id')).toHaveTextContent('tpl-1'))
    fireEventClick('ts-edit-name')
    fireEventClick('ts-edit-desc')
    fireEventClick('ts-update-edit-attr-key')
    fireEventClick('ts-update-edit-attr-name')
    fireEventClick('ts-update-edit-field-key')
    fireEventClick('ts-update-edit-field-label')
    fireEventClick('ts-update-edit-skill')
    fireEventClick('ts-toggle-edit-skill-allowed')
    fireEventClick('ts-edit-profile-target-mode')
    fireEventClick('ts-toggle-edit-profile-skill') // removes 'skill-1'
    fireEventClick('ts-toggle-edit-profile-skill') // re-adds 'skill-1' so SELECTED_SKILLS passes
    fireEventClick('ts-update-edit-core-slug')
    fireEventClick('ts-update-edit-core-display')
    fireEventClick('ts-update-edit-core-color')
    fireEventClick('ts-edit-core-enabled')
    fireEventClick('ts-edit-core-editable')
    fireEventClick('ts-edit-core-show-notes')
    fireEventClick('ts-add-edit-ac')
    fireEventClick('ts-update-edit-ac-name')
    fireEventClick('ts-add-edit-ac-field')
    fireEventClick('ts-update-edit-ac-field-name')
    fireEventClick('ts-update-edit-ac-field-key')
    fireEventClick('ts-update-edit-ac-field-default')
    fireEventClick('ts-update-edit-ac-field-desc')
    fireEventClick('ts-edit-ac-field-editable')
    fireEventClick('ts-toggle-edit-ac-attr')
    fireEventClick('ts-update-edit-ac-attr-mod')
    fireEventClick('ts-add-edit-char-section')
    fireEventClick('ts-update-edit-char-section')
    fireEventClick('ts-set-edit-resistances')
    fireEventClick('ts-edit-attr-formula')
    fireEventClick('ts-edit-skill-formula')

    mockApiPatch.mockResolvedValueOnce({})
    fireEventClick('ts-edit-submit')
    await waitFor(() =>
      expect(mockApiPatch).toHaveBeenCalledWith('/adventures/adv-1/templates/tpl-1', expect.any(Object)),
    )
    const [, body] = mockApiPatch.mock.calls.find(([u]) => u === '/adventures/adv-1/templates/tpl-1') ?? []
    expect(body).toMatchObject({
      name: 'Edited',
      description: 'Edited desc',
      attributeModifiersEnabled: true,
      attributeModifierFormula: '(x-10)/2',
      skillFormula: 'x+1',
      armorClasses: [
        { name: 'Armor Class', enabled: true },
        { name: 'Flat AC', enabled: true, fields: [{ name: 'Base2', key: 'base2', defaultValue: '12', editableByPlayer: true, description: 'd2' }] },
      ],
    })
    expect(body.attributes).toEqual([
      { key: 'str2', name: 'Str2' },
      { key: 'dex', name: 'Dexterity' },
    ])
    expect(body.skills[0]).toMatchObject({
      name: 'Stealth',
      attributeId: 'str',
      defaultAttributeId: 'str',
      allowedAttributeIds: ['dex'],
    })

    // delete template
    mockApiDelete.mockResolvedValueOnce({})
    fireEventClick('ts-delete-tpl-1')
    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith('/adventures/adv-1/templates/tpl-1'))
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/adventures/adv-1/templates'))
  })

  it('shows an error when updating a template fails', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    clickRole('Templates')
    await screen.findByTestId('TemplatesSection')
    fireEventClick('ts-edit-tpl-1')
    await waitFor(() => expect(screen.getByTestId('ts-editing-id')).toHaveTextContent('tpl-1'))
    mockApiPatch.mockRejectedValueOnce(new Error('update-boom'))
    fireEventClick('ts-edit-submit')
    await tick()
    expect(await screen.findByTestId('ts-editing-template-error')).toHaveTextContent('update-boom')
  })

  it('cancels editing a template', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    clickRole('Templates')
    await screen.findByTestId('TemplatesSection')
    fireEventClick('ts-edit-tpl-1')
    await waitFor(() => expect(screen.getByTestId('ts-editing-id')).toHaveTextContent('tpl-1'))
    fireEventClick('ts-cancel-edit')
    await waitFor(() => expect(screen.getByTestId('ts-editing-id')).toBeEmptyDOMElement())
  })
})

// ════════════════════════════════════════════════════════════
// Builder helpers (add/remove/update every row type)
// ════════════════════════════════════════════════════════════

describe('AdventureDetailPage — builder row helpers', () => {
  it('exercises add/remove/update for every row type without crashing', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    clickRole('Templates')
    await screen.findByTestId('TemplatesSection')

    // new-mode removes
    fireEventClick('ts-add-attr')
    fireEventClick('ts-remove-attr')
    fireEventClick('ts-add-field')
    fireEventClick('ts-remove-field')
    fireEventClick('ts-add-skill')
    fireEventClick('ts-remove-skill')
    fireEventClick('ts-add-profile')
    fireEventClick('ts-add-profile-option')
    fireEventClick('ts-remove-profile-option')
    fireEventClick('ts-remove-profile')
    fireEventClick('ts-add-core')
    fireEventClick('ts-remove-core')
    fireEventClick('ts-add-ac')
    fireEventClick('ts-add-ac-field')
    fireEventClick('ts-remove-ac-field')
    fireEventClick('ts-remove-ac')
    fireEventClick('ts-add-char-section')
    fireEventClick('ts-remove-char-section')
    // toggle AC attr on/off (both branches of withToggledAcAttributeId)
    fireEventClick('ts-add-ac')
    fireEventClick('ts-toggle-ac-attr')
    fireEventClick('ts-toggle-ac-attr')
    // toggle the "attribute modifiers enabled" switch (clears attr mods effect)
    fireEventClick('ts-new-attr-modifiers-enabled')
    await tick()

    // edit-mode rows
    fireEventClick('ts-edit-tpl-1')
    await waitFor(() => expect(screen.getByTestId('ts-editing-id')).toHaveTextContent('tpl-1'))
    fireEventClick('ts-add-edit-attr')
    fireEventClick('ts-remove-edit-attr')
    fireEventClick('ts-add-edit-field')
    fireEventClick('ts-remove-edit-field')
    fireEventClick('ts-add-edit-skill')
    fireEventClick('ts-remove-edit-skill')
    fireEventClick('ts-add-edit-profile')
    fireEventClick('ts-add-edit-profile-option')
    fireEventClick('ts-remove-edit-profile-option')
    fireEventClick('ts-remove-edit-profile')
    fireEventClick('ts-add-edit-core')
    fireEventClick('ts-remove-edit-core')
    fireEventClick('ts-add-edit-ac')
    fireEventClick('ts-add-edit-ac-field')
    fireEventClick('ts-remove-edit-ac-field')
    fireEventClick('ts-remove-edit-ac')
    fireEventClick('ts-add-edit-char-section')
    fireEventClick('ts-remove-edit-char-section')
    fireEventClick('ts-edit-attr-modifiers-enabled')
    await tick()
    // cancel edit after mutating state
    fireEventClick('ts-cancel-edit')
    await waitFor(() => expect(screen.getByTestId('ts-editing-id')).toBeEmptyDOMElement())
  })
})

// ════════════════════════════════════════════════════════════
// Books, visibility, join requests, notebook
// ════════════════════════════════════════════════════════════

describe('AdventureDetailPage — books & misc', () => {
  it('opens the books tab and selects a book into the PDF viewer', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    clickRole('Books')
    expect(await screen.findByTestId('BookListPanel')).toBeInTheDocument()
    expect(screen.queryByTestId('TemplatesSection')).not.toBeInTheDocument()
    fireEventClick('book-select')
    await waitFor(() => expect(screen.getByTestId('pdf-book-id')).toHaveTextContent('book-1'))
  })

  it('toggles campaign visibility', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    expect(screen.getByTestId('visibility-value')).toHaveTextContent('false')
    mockApiPatch.mockResolvedValueOnce({ isPublic: true })
    fireEventClick('visibility-toggle')
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/adventures/adv-1/visibility', { isPublic: true }))
    await waitFor(() => expect(screen.getByTestId('visibility-value')).toHaveTextContent('true'))
  })

  it('accepts and rejects join requests', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/adventures/adv-1/join-requests'))
    expect(await screen.findByTestId('join-accept-jr-1')).toBeInTheDocument()
    expect(screen.getByTestId('join-reject-jr-2')).toBeInTheDocument()
    mockApiPatch.mockResolvedValueOnce({})
    fireEventClick('join-accept-jr-1')
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/adventures/adv-1/join-requests/jr-1', { action: 'accept' }))
    await waitFor(() => expect(screen.queryByTestId('join-accept-jr-1')).not.toBeInTheDocument())
    mockApiPatch.mockResolvedValueOnce({})
    fireEventClick('join-reject-jr-2')
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/adventures/adv-1/join-requests/jr-2', { action: 'reject' }))
    await waitFor(() => expect(screen.queryByTestId('join-reject-jr-2')).not.toBeInTheDocument())
  })

  it('keeps a join request when accepting it fails', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    await screen.findByTestId('join-accept-jr-1')
    mockApiPatch.mockRejectedValueOnce(new Error('accept-boom'))
    fireEventClick('join-accept-jr-1')
    await tick()
    expect(screen.getByTestId('join-accept-jr-1')).toBeInTheDocument()
  })

  it('opens the notebook via the Open Notebook button', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    expect(screen.getByTestId('notebook-force-open')).toHaveTextContent('false')
    clickRole('Open Notebook')
    await waitFor(() => expect(screen.getByTestId('notebook-force-open')).toHaveTextContent('true'))
  })

  it('notifies the creature sidebar refresh when creatures change', async () => {
    renderPage()
    await screen.findByText('The Lost Mine')
    fireEventClick('creatures-change')
    fireEventClick('creatures-change')
    expect(screen.getByTestId('CampaignCreatureSidebar')).toBeInTheDocument()
  })
})

// helper to click a button by data-testid (keeps tests terse)
// fireEvent.click wraps the click in act(), flushing React state so a
// following synchronous submit click reads the latest state.
function fireEventClick(testId: string) {
  fireEvent.click(screen.getByTestId(testId))
}

// helper to click a plain <button> by its accessible name (tab buttons, Open Notebook)
function clickRole(name: string) {
  fireEvent.click(screen.getByRole('button', { name }))
}
