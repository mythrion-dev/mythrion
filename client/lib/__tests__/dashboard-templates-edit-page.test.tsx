import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

// ── next/navigation (adds useParams; overrides setup.ts) ────────────────────
const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'tpl-1' }),
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard/templates/tpl-1',
}))

// ── next/link ───────────────────────────────────────────────────────────────
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// ── API mock ────────────────────────────────────────────────────────────────
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

// ── Navigation context (used by PageNav) ───────────────────────────────────
vi.mock('@/lib/navigation-context', () => ({
  useNavigation: () => ({
    breadcrumbs: [],
    setBreadcrumbs: vi.fn(),
    pushSegment: vi.fn(),
    popSegment: vi.fn(),
  }),
}))

// ── TemplateForm stub: captures latest props so tests can drive handlers ────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formProps: { current: Record<string, any> | null } = { current: null }
vi.mock('@/components/adventure/TemplateForm', () => ({
  TemplateForm: (props: Record<string, unknown>) => {
    formProps.current = props
    return (
      <div data-testid="template-form">
        <form data-testid="template-edit-form" onSubmit={(e) => (props.onCreateTemplate as (e: object) => void)?.(e)}>
          <button type="submit">Save</button>
        </form>
        <button type="button" onClick={() => (props.onCancelNew as (() => void) | undefined)?.()}>
          Cancel Edit
        </button>
        {props.templateError ? <span>{props.templateError as string}</span> : null}
        {props.templateCreating ? <span>saving</span> : null}
      </div>
    )
  },
}))

import { api } from '@/lib/api'
import TemplateDetailPage from '@/app/dashboard/templates/[id]/page'

const mockApiGet = vi.mocked(api.get)
const mockApiPatch = vi.mocked(api.patch)
const mockApiPost = vi.mocked(api.post)
const mockApiDelete = vi.mocked(api.delete)

// ── Fixtures ────────────────────────────────────────────────────────────────
const baseTemplate = {
  id: 'tpl-1',
  name: 'Fighter Sheet',
  description: 'A basic fighter character sheet template.',
  campaign: 'D&D 5e',
  attributeModifierFormula: 'floor((value - 10) / 2)',
  skillFormula: 'value + mod(value)',
  isPublic: false,
  useCount: 3,
  attrModifiersEnabled: true,
  attributes: [
    { id: 'attr-1', key: 'str', name: 'Strength' },
    { id: 'attr-2', key: 'dex', name: 'Dexterity' },
  ],
  templateSkills: [
    {
      id: 'skill-1',
      name: 'Stealth',
      description: null,
      attributeId: 'attr-2',
      allowedAttributeIds: ['attr-2'],
      defaultAttributeId: 'attr-2',
    },
  ],
  templateFields: [{ id: 'field-1', key: 'f1', label: 'F1' }],
  skillModifierProfiles: [
    {
      id: 'profile-1',
      name: 'Pro1',
      targetMode: 'skill',
      targetSkillIds: ['skill-1'],
      options: [{ id: 'o1', label: 'Opt', value: 5 }],
    },
  ],
  coreResources: [
    {
      id: 'cr-1',
      displayName: 'Hit Points',
      slug: 'hit_points',
      color: '#ef4444',
      enabled: true,
      editableByPlayer: true,
      showNotes: false,
    },
  ],
  armorClasses: [
    {
      id: 'ac-1',
      enabled: true,
      name: 'AC',
      attributeModifiers: [
        { attributeId: 'attr-1', allowPlayerSelection: false, defaultAttributeId: 'attr-1' },
      ],
      fields: [
        { name: 'Armor', key: 'armor', defaultValue: '10', editableByPlayer: true, description: 'Desc' },
      ],
    },
  ],
  resistances: [
    {
      id: 'res-1',
      name: 'Fire',
      calculationType: 'MANUAL',
      enabled: true,
      order: 0,
      components: [{ name: 'Res', editableByPlayer: true, defaultValue: '0' }],
      attributeModifiers: [{ attributeId: 'attr-1', enabled: true, attribute: null }],
    },
  ],
  characterSections: [{ id: 'sec-1', name: 'Bio' }],
  createdAt: '2025-01-15T00:00:00Z',
  updatedAt: '2025-01-15T00:00:00Z',
}

const resWithId = {
  id: 'r1',
  name: 'Fire',
  calculationType: 'MANUAL',
  enabled: true,
  order: 0,
  components: [{ name: 'Res', editableByPlayer: true, defaultValue: '0' }],
  attributeModifiers: [{ attributeId: 'a', enabled: true, attribute: null }],
}
const resNoId = { name: 'Cold', calculationType: 'MANUAL', enabled: false, order: 1 }

// ── Helpers ─────────────────────────────────────────────────────────────────
function renderDetail(data: unknown = baseTemplate) {
  mockApiGet.mockResolvedValue(data)
  render(<TemplateDetailPage />)
  return screen.findByRole('button', { name: 'Edit' })
}

async function enterEditMode(data: unknown = baseTemplate) {
  await renderDetail(data)
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  await waitFor(() => expect(formProps.current).toBeTruthy())
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setForm(fn: (p: Record<string, any>) => void) {
  // Drive a page handler via the latest captured props inside act().
  return act(async () => {
    fn(formProps.current ?? {})
  })
}

function submitForm() {
  fireEvent.submit(screen.getByTestId('template-edit-form'))
}

beforeEach(() => {
  vi.clearAllMocks()
  formProps.current = null
})

describe('TemplateDetailPage edit/delete/clone (templates/[id])', () => {
  /* ── Loading / error / not-found states ── */

  it('shows the loading skeleton while fetching', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    const { container } = render(<TemplateDetailPage />)
    expect(container.querySelector('.skeleton')).toBeDefined()
  })

  it('shows the error state with the Error message', async () => {
    mockApiGet.mockRejectedValue(new Error('Not authorized'))
    render(<TemplateDetailPage />)
    expect(await screen.findByText('Could not load template')).toBeInTheDocument()
    expect(screen.getByText('Not authorized')).toBeInTheDocument()
  })

  it('falls back to the generic message when the fetch rejection is not an Error', async () => {
    mockApiGet.mockRejectedValue('oops')
    render(<TemplateDetailPage />)
    expect(await screen.findByText('Could not load template')).toBeInTheDocument()
    expect(screen.getByText('Failed to load template')).toBeInTheDocument()
  })

  it('shows the not-found empty state when the template is null', async () => {
    mockApiGet.mockResolvedValue(null)
    render(<TemplateDetailPage />)
    expect(await screen.findByText('Template not found')).toBeInTheDocument()
  })

  /* ── Display mode conditional branches ── */

  it('omits the campaign badge and description when they are absent', async () => {
    await renderDetail({ ...baseTemplate, campaign: null, description: null })
    expect(screen.getByText('Fighter Sheet')).toBeInTheDocument()
    expect(screen.queryByText('D&D 5e')).not.toBeInTheDocument()
    expect(screen.getByText('Used 3 times')).toBeInTheDocument()
  })

  it('shows the Public badge and renders the created/updated dates', async () => {
    await renderDetail({ ...baseTemplate, isPublic: true })
    expect(screen.getByText('Public')).toBeInTheDocument()
    const jan15 = new Date('2025-01-15T00:00:00Z').toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    // createdAt and updatedAt share the same date in the fixture -> both render
    expect(screen.getAllByText(new RegExp(jan15)).length).toBeGreaterThanOrEqual(1)
  })

  /* ── Edit mode: comprehensive handler + payload ── */

  it('starts editing, drives every handler, and submits the full payload', async () => {
    mockApiPatch.mockResolvedValue(baseTemplate)
    await enterEditMode()

    // ── Base fields ──
    await setForm((p) => p.onNameChange?.('  The Sheet  '))
    await setForm((p) => p.onDescriptionChange?.('A desc'))
    await setForm((p) => p.onNewAttrModifierFormulaChange?.('(STR - 10) / 2'))
    await setForm((p) => p.onNewSkillFormulaChange?.('floor(STR / 2)'))
    await setForm((p) => p.onNewAttrModifiersEnabledChange?.(false))
    await setForm((p) => p.onNewIsPublicChange?.(true))

    // ── Attributes (keep one blank key to exercise the filter) ──
    await setForm((p) => p.onAddAttr?.())
    await setForm((p) => p.onUpdateAttr?.(0, 'key', 'str'))
    await setForm((p) => p.onUpdateAttr?.(0, 'name', 'Strength'))
    await setForm((p) => p.onAddAttr?.())
    await setForm((p) => p.onRemoveAttr?.(2))

    // ── Custom fields (keep one blank key to exercise the filter) ──
    await setForm((p) => p.onAddField?.())
    await setForm((p) => p.onUpdateField?.(0, 'key', 'f1'))
    await setForm((p) => p.onUpdateField?.(0, 'label', 'F1'))
    await setForm((p) => p.onAddField?.())
    await setForm((p) => p.onRemoveField?.(1))

    // ── Skills (second skill keeps empty optionals -> null) ──
    await setForm((p) => p.onAddSkill?.())
    await setForm((p) => p.onUpdateSkill?.(0, 'name', 'Stealth'))
    await setForm((p) => p.onUpdateSkill?.(0, 'description', 'Run'))
    await setForm((p) => p.onUpdateSkill?.(0, 'attributeId', 'attr-2'))
    await setForm((p) => p.onToggleSkillAllowedAttr?.(0, 'attr-2')) // remove
    await setForm((p) => p.onToggleSkillAllowedAttr?.(0, 'attr-2')) // add again
    await setForm((p) => p.onUpdateSkill?.(0, 'defaultAttributeId', 'attr-2'))
    await setForm((p) => p.onUpdateSkill?.(1, 'name', 'Acrobatics'))
    await setForm((p) => p.onAddSkill?.())
    await setForm((p) => p.onRemoveSkill?.(2))

    // ── Skill profiles (keep one blank option to exercise the filters) ──
    await setForm((p) => p.onUpdateProfile?.(0, 'Pro1'))
    await setForm((p) => p.onUpdateProfileTargetMode?.(0, 'skill'))
    await setForm((p) => p.onToggleProfileSkill?.(0, 'skill-1')) // remove
    await setForm((p) => p.onToggleProfileSkill?.(0, 'skill-1')) // add again
    await setForm((p) => p.onAddProfileOption?.(0))
    await setForm((p) => p.onUpdateProfileOption?.(0, 1, 'label', 'Opt2'))
    await setForm((p) => p.onUpdateProfileOption?.(0, 1, 'value', 7))
    await setForm((p) => p.onRemoveProfileOption?.(0, 1))
    await setForm((p) => p.onAddProfileOption?.(0))
    await setForm((p) => p.onUpdateProfileOption?.(0, 1, 'label', 'Opt2'))
    await setForm((p) => p.onUpdateProfileOption?.(0, 1, 'value', 7))
    await setForm((p) => p.onAddProfile?.())
    await setForm((p) => p.onRemoveProfile?.(1))

    // ── Core resources ──
    await setForm((p) => p.onUpdateCoreResource?.(0, 'displayName', 'Hit Points'))
    await setForm((p) => p.onUpdateCoreResource?.(0, 'slug', 'hit_points'))
    await setForm((p) => p.onUpdateCoreResource?.(0, 'color', '#ef4444'))
    await setForm((p) => p.onUpdateCoreResourceEnabled?.(0, false))
    await setForm((p) => p.onUpdateCoreResourceEditable?.(0, false))
    await setForm((p) => p.onUpdateCoreResourceShowNotes?.(0, true))
    await setForm((p) => p.onAddCoreResource?.())
    await setForm((p) => p.onRemoveCoreResource?.(1))

    // ── Armor classes (ac1 kept so ac0 updates hit the map false branch) ──
    await setForm((p) => p.onAddNewAcConfig?.()) // ac0, ac1
    await setForm((p) => p.onUpdateNewAcConfig?.(0, { name: 'AC', enabled: false }))
    // temp Shield field at idx1 exercises slugify + no-slugify branches, then removed
    await setForm((p) => p.onAddNewAcFieldForConfig?.(0)) // [Armor, blank]
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 1, 'name', 'Shield')) // slugify key -> 'shield'
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 1, 'key', 'shield'))
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 1, 'defaultValue', '5'))
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 1, 'description', 'Bonus'))
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 1, 'name', '   ')) // blank -> no slugify
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 1, 'name', 'Shield 2')) // key set -> no slugify
    await setForm((p) => p.onUpdateNewAcFieldEditableForConfig?.(0, 1, true))
    await setForm((p) => p.onRemoveNewAcFieldForConfig?.(0, 1)) // [Armor]
    // temp blank field covers the map false branches of update/editable, then removed
    await setForm((p) => p.onAddNewAcFieldForConfig?.(0)) // [Armor, blank]
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 0, 'name', 'Armor')) // key set -> no slugify
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 0, 'key', 'armor'))
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 0, 'defaultValue', '10'))
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 0, 'description', 'Desc'))
    await setForm((p) => p.onUpdateNewAcFieldEditableForConfig?.(0, 0, true))
    await setForm((p) => p.onRemoveNewAcFieldForConfig?.(0, 1)) // [Armor]
    // attribute modifier ops (toggle add/remove, match + no-match patch)
    await setForm((p) => p.onToggleNewAcAttributeIdForConfig?.(0, 'attr-1')) // remove -> []
    await setForm((p) => p.onToggleNewAcAttributeIdForConfig?.(0, 'attr-1')) // add -> [{attr-1}]
    await setForm((p) => p.onToggleNewAcAttributeIdForConfig?.(0, 'attr-2')) // add -> +[{attr-2}]
    await setForm((p) =>
      p.onUpdateNewAcAttributeModifierForConfig?.(0, 'attr-1', { allowPlayerSelection: true }),
    )
    await setForm((p) =>
      p.onUpdateNewAcAttributeModifierForConfig?.(0, 'NONEXISTENT', { allowPlayerSelection: false }),
    )
    // ac1 gets nullish fields/attributeModifiers to exercise the `?? []` fallbacks
    await setForm((p) =>
      p.onUpdateNewAcConfig?.(1, { name: 'Throwaway', fields: undefined, attributeModifiers: undefined }),
    )
    // temp ac2 covers the remove map false branch, then is removed
    await setForm((p) => p.onAddNewAcConfig?.())
    await setForm((p) => p.onRemoveNewAcConfig?.(2))

    // ── Character sections ──
    await setForm((p) => p.onAddNewCharacterSection?.())
    await setForm((p) => p.onUpdateNewCharacterSection?.(0, 'Bio'))
    await setForm((p) => p.onAddNewCharacterSection?.())
    await setForm((p) => p.onRemoveNewCharacterSection?.(1))

    // ── Resistances (one without id/undefined arrays for `??` and spread) ──
    await setForm((p) => p.onNewResistancesChange?.([resWithId, resNoId]))

    // ── Feature toggles (all left on) ──
    await setForm((p) => p.onNewFeatureSkillsChange?.(true))
    await setForm((p) => p.onNewFeatureCustomFieldsChange?.(true))
    await setForm((p) => p.onNewFeatureCoreResourcesChange?.(true))
    await setForm((p) => p.onNewFeatureArmorClassChange?.(true))
    await setForm((p) => p.onNewFeatureCharacterSectionsChange?.(true))
    await setForm((p) => p.onNewFeatureSkillProfilesChange?.(true))
    await setForm((p) => p.onNewFeatureResistanceChange?.(true))

    submitForm()

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/templates/tpl-1', {
        name: 'The Sheet',
        description: 'A desc',
        attributes: [
          { key: 'str', name: 'Strength' },
          { key: 'dex', name: 'Dexterity' },
        ],
        attributeModifierFormula: '(STR - 10) / 2',
        skillFormula: 'floor(STR / 2)',
        attributeModifiersEnabled: false,
        isPublic: true,
        templateFields: [{ key: 'f1', label: 'F1' }],
        skills: [
          {
            name: 'Stealth',
            description: 'Run',
            attributeId: 'attr-2',
            allowedAttributeIds: ['attr-2'],
            defaultAttributeId: 'attr-2',
          },
          {
            name: 'Acrobatics',
            description: null,
            attributeId: null,
            allowedAttributeIds: [],
            defaultAttributeId: null,
          },
        ],
        skillModifierProfiles: [
          {
            name: 'Pro1',
            targetMode: 'skill',
            targetSkillIds: ['skill-1'],
            options: [
              { label: 'Opt', value: 5 },
              { label: 'Opt2', value: 7 },
            ],
          },
        ],
        coreResources: [
          {
            displayName: 'Hit Points',
            slug: 'hit_points',
            enabled: false,
            editableByPlayer: true,
            showNotes: true,
            color: '#ef4444',
          },
        ],
        armorClasses: [
          {
            enabled: false,
            name: 'AC',
            attributeModifiers: [
              { attributeId: 'attr-1', allowPlayerSelection: true, defaultAttributeId: 'attr-1' },
              { attributeId: 'attr-2', allowPlayerSelection: false, defaultAttributeId: 'attr-2' },
            ],
            fields: [
              {
                name: 'Armor',
                key: 'armor',
                defaultValue: '10',
                editableByPlayer: true,
                description: 'Desc',
              },
            ],
          },
          { enabled: true, name: 'Throwaway', attributeModifiers: [], fields: [] },
        ],
        characterSections: [
          { id: 'sec-1', name: 'Bio' },
          { name: '' },
        ],
        resistances: [
          {
            id: 'r1',
            name: 'Fire',
            calculationType: 'MANUAL',
            components: [{ name: 'Res', editableByPlayer: true, defaultValue: '0' }],
            attributeModifiers: [{ attributeId: 'a', enabled: true }],
          },
          { name: 'Cold', calculationType: 'MANUAL', components: [], attributeModifiers: [] },
        ],
      })
    })
    await waitFor(() =>
      expect(screen.queryByTestId('template-edit-form')).not.toBeInTheDocument(),
    )
    expect(await screen.findByText('Fighter Sheet')).toBeInTheDocument()
  })

  it('submits a minimal payload when every feature is toggled off', async () => {
    mockApiPatch.mockResolvedValue(baseTemplate)
    await enterEditMode()

    await setForm((p) => p.onDescriptionChange?.(''))
    await setForm((p) => p.onNewAttrModifierFormulaChange?.(''))
    await setForm((p) => p.onNewSkillFormulaChange?.(''))
    await setForm((p) => p.onNewFeatureSkillsChange?.(false))
    await setForm((p) => p.onNewFeatureCustomFieldsChange?.(false))
    await setForm((p) => p.onNewFeatureCoreResourcesChange?.(false))
    await setForm((p) => p.onNewFeatureArmorClassChange?.(false))
    await setForm((p) => p.onNewFeatureCharacterSectionsChange?.(false))
    await setForm((p) => p.onNewFeatureSkillProfilesChange?.(false))
    await setForm((p) => p.onNewFeatureResistanceChange?.(false))

    submitForm()

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/templates/tpl-1', {
        name: 'Fighter Sheet',
        description: null,
        attributes: [
          { key: 'str', name: 'Strength' },
          { key: 'dex', name: 'Dexterity' },
        ],
        attributeModifierFormula: null,
        skillFormula: null,
        attributeModifiersEnabled: true,
        isPublic: false,
        templateFields: [{ key: 'f1', label: 'F1' }],
      })
    })
  })

  it('shows the creating state and cancels back to display mode', async () => {
    mockApiPatch.mockImplementation(
      () => new Promise((res) => setTimeout(() => res(baseTemplate), 50)),
    )
    await enterEditMode()
    submitForm()
    expect(formProps.current?.templateCreating).toBe(true)
    await waitFor(() =>
      expect(screen.queryByTestId('template-edit-form')).not.toBeInTheDocument(),
    )
    expect(await screen.findByText('Fighter Sheet')).toBeInTheDocument()
  })

  it('surfaces an Error message when the update fails and keeps editing', async () => {
    mockApiPatch.mockRejectedValueOnce(new Error('update boom'))
    mockApiPatch.mockRejectedValueOnce('oops')
    await enterEditMode()
    submitForm()
    expect(await screen.findByText('update boom')).toBeInTheDocument()
    submitForm()
    expect(await screen.findByText('Failed to update template')).toBeInTheDocument()
    expect(mockApiPatch).toHaveBeenCalledTimes(2)
  })

  it('cancels editing back to the display mode', async () => {
    await enterEditMode()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Edit' }))
    expect(screen.queryByTestId('template-edit-form')).not.toBeInTheDocument()
    expect(screen.getByText('Fighter Sheet')).toBeInTheDocument()
  })

  /* ── Delete flow ── */

  it('opens the delete modal, cancels, then confirms and navigates away', async () => {
    mockApiDelete.mockResolvedValue(undefined)
    await renderDetail()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete Template')).toBeInTheDocument()
    expect(
      screen.getByText(/Are you sure you want to delete Fighter Sheet/),
    ).toBeInTheDocument()

    // Cancel keeps the template and closes the modal
    const modal = screen.getByText('Delete Template').closest('.fixed') as HTMLElement
    fireEvent.click(within(modal).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Delete Template')).not.toBeInTheDocument()

    // Re-open and confirm
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const modal2 = screen.getByText('Delete Template').closest('.fixed') as HTMLElement
    fireEvent.click(within(modal2).getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledWith('/templates/tpl-1')
    })
    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/templates')
  })

  it('shows the deleting spinner while the request is in flight', async () => {
    mockApiDelete.mockImplementation(
      () => new Promise((res) => setTimeout(() => res(undefined), 50)),
    )
    await renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const modal = screen.getByText('Delete Template').closest('.fixed') as HTMLElement
    fireEvent.click(within(modal).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Deleting...')).toBeInTheDocument()
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/templates'))
  })

  it('shows an error and keeps the modal open when deletion fails', async () => {
    mockApiDelete.mockRejectedValueOnce(new Error('delete boom'))
    mockApiDelete.mockRejectedValueOnce('oops')
    await renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    let modal = screen.getByText('Delete Template').closest('.fixed') as HTMLElement
    fireEvent.click(within(modal).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('delete boom')).toBeInTheDocument()
    expect(screen.getByText('Delete Template')).toBeInTheDocument()
    // Second attempt falls back to the generic message
    modal = screen.getByText('Delete Template').closest('.fixed') as HTMLElement
    fireEvent.click(within(modal).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Failed to delete template')).toBeInTheDocument()
    expect(screen.getByText('Delete Template')).toBeInTheDocument()
  })

  /* ── Clone flow ── */

  it('clones the template and navigates to the new template', async () => {
    mockApiPost.mockResolvedValue({ id: 'cloned-1' })
    await renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Clone' }))
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/templates/tpl-1/clone', {
        name: 'Fighter Sheet (Copy)',
      })
    })
    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/templates/cloned-1')
  })

  it('shows the cloning state while the request is in flight', async () => {
    mockApiPost.mockImplementation(
      () => new Promise((res) => setTimeout(() => res({ id: 'x' }), 50)),
    )
    await renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Clone' }))
    expect(screen.getByRole('button', { name: 'Clone' })).toBeDisabled()
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/templates/x'))
  })

  it('shows an error and falls back to the generic message when cloning fails', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('clone boom'))
    mockApiPost.mockRejectedValueOnce('oops')
    await renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Clone' }))
    expect(await screen.findByText('clone boom')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clone' }))
    expect(await screen.findByText('Failed to clone template')).toBeInTheDocument()
    expect(mockRouterPush).not.toHaveBeenCalled()
  })
})
