import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

// ── next/navigation (overrides setup.ts to expose push) ──────────────────────
const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// ── next/link ────────────────────────────────────────────────────────────────
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// ── API mock ─────────────────────────────────────────────────────────────────
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

// ── Subscription context ─────────────────────────────────────────────────────
const mockUseSubscription = vi.fn()
vi.mock('@/lib/subscription-context', () => ({
  useSubscription: () => mockUseSubscription(),
}))

// ── TemplateForm stub: captures latest props so tests can drive handlers ─────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formProps: { current: Record<string, any> | null } = { current: null }
vi.mock('@/components/adventure/TemplateForm', () => ({
  TemplateForm: (props: Record<string, unknown>) => {
    formProps.current = props
    return (
      <div data-testid="template-form">
        <form data-testid="template-create-form" onSubmit={(e) => (props.onCreateTemplate as (e: object) => void)?.(e)}>
          <button type="submit">Create Template</button>
        </form>
        <button type="button" onClick={() => (props.onCancelNew as (() => void) | undefined)?.()}>
          Cancel
        </button>
      </div>
    )
  },
}))

import { api } from '@/lib/api'
import NewTemplatePage from '@/app/dashboard/templates/new/page'

const mockApiPost = vi.mocked(api.post)

// ── Helpers ───────────────────────────────────────────────────────────────────
function setSub(hasActiveSubscription: boolean = true) {
  mockUseSubscription.mockReturnValue({
    subscription: null,
    loading: false,
    hasActiveSubscription,
    refresh: vi.fn(),
  })
}

async function renderPage() {
  render(<NewTemplatePage />)
  await waitFor(() => expect(formProps.current).toBeTruthy())
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setForm(fn: (p: Record<string, any>) => void) {
  // Drive a page handler via the latest captured props inside act().
  return act(async () => {
    fn(formProps.current ?? {})
  })
}

const preventDefault = () => {}

function submitForm() {
  fireEvent.submit(screen.getByTestId('template-create-form'))
}

const resDef = {
  id: 'r1',
  name: 'Fire',
  calculationType: 'MANUAL',
  components: [{ id: 'c1', name: 'Res', editableByPlayer: true, defaultValue: '0' }],
  attributeModifiers: [{ attributeId: 'STR', attributeKey: 'STR', attributeName: 'Strength', enabled: true }],
}

beforeEach(() => {
  vi.clearAllMocks()
  setSub(true)
  mockApiPost.mockResolvedValue({ id: 'new-1' })
  formProps.current = null
})

describe('NewTemplatePage (templates/new)', () => {
  it('shows the subscription-required screen for non-subscribers', () => {
    setSub(false)
    render(<NewTemplatePage />)
    expect(screen.getByText('Subscription Required')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Creating templates is a premium feature. Upgrade to a paid plan to create and manage your own character sheet templates.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Plans' })).toHaveAttribute('href', '/pricing')
    expect(screen.queryByTestId('template-form')).not.toBeInTheDocument()
  })

  it('renders the breadcrumb nav and cancels back to the templates list', async () => {
    await renderPage()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'Templates' })).toHaveAttribute(
      'href',
      '/dashboard/templates',
    )
    expect(screen.getByText('New')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/templates')
  })

  it('creates a template with only the base payload when features are off', async () => {
    await renderPage()
    await setForm((p) => p.onNameChange?.('  My Template  '))
    submitForm()
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/templates', {
        name: 'My Template',
        description: null,
        attributes: [],
        attributeModifierFormula: null,
        skillFormula: null,
        attributeModifiersEnabled: true,
        isPublic: false,
      })
    })
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/templates/new-1'))
    expect(mockApiPost).toHaveBeenCalledTimes(1)
  })

  it('shows the creating state while the request is in flight', async () => {
    mockApiPost.mockImplementation(() => new Promise((res) => setTimeout(() => res({ id: 'x' }), 50)))
    await renderPage()
    await setForm((p) => p.onNameChange?.('T'))
    submitForm()
    expect(formProps.current?.templateCreating).toBe(true)
    await waitFor(() => expect(formProps.current?.templateCreating).toBe(false))
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/templates/x'))
  })

  it('surfaces an Error message when creation fails', async () => {
    mockApiPost.mockRejectedValue(new Error('boom'))
    await renderPage()
    await setForm((p) => p.onNameChange?.('T'))
    submitForm()
    await waitFor(() => expect(formProps.current?.templateError).toBe('boom'))
    expect(mockRouterPush).not.toHaveBeenCalled()
  })

  it('falls back to the generic message when the failure is not an Error', async () => {
    mockApiPost.mockRejectedValue('oops')
    await renderPage()
    await setForm((p) => p.onNameChange?.('T'))
    submitForm()
    await waitFor(() => expect(formProps.current?.templateError).toBe('Failed to create template'))
    expect(mockRouterPush).not.toHaveBeenCalled()
  })

  it('builds the full payload when every feature and helper handler is exercised', async () => {
    await renderPage()

    // ── Base fields ──
    await setForm((p) => p.onNameChange?.('The Template'))
    await setForm((p) => p.onDescriptionChange?.('A desc'))
    await setForm((p) => p.onNewAttrModifierFormulaChange?.('(STR - 10) / 2'))
    await setForm((p) => p.onNewSkillFormulaChange?.('floor(STR / 2)'))
    await setForm((p) => p.onNewAttrModifiersEnabledChange?.(false))
    await setForm((p) => p.onNewIsPublicChange?.(true))

    // ── Attributes (keep one blank key to exercise the filter) ──
    await setForm((p) => p.onAddAttr?.())
    await setForm((p) => p.onUpdateAttr?.(0, 'key', 'STR'))
    await setForm((p) => p.onUpdateAttr?.(0, 'name', 'Strength'))
    await setForm((p) => p.onAddAttr?.())
    await setForm((p) => p.onAddAttr?.())
    await setForm((p) => p.onRemoveAttr?.(2))

    // ── Skills ──
    await setForm((p) => p.onNewFeatureSkillsChange?.(true))
    await setForm((p) => p.onAddSkill?.())
    await setForm((p) => p.onUpdateSkill?.(0, 'name', 'Athletics'))
    await setForm((p) => p.onUpdateSkill?.(0, 'description', 'Run'))
    await setForm((p) => p.onUpdateSkill?.(0, 'attributeId', 'STR'))
    await setForm((p) => p.onToggleSkillAllowedAttr?.(0, 'STR')) // add
    await setForm((p) => p.onToggleSkillAllowedAttr?.(0, 'STR')) // remove
    await setForm((p) => p.onToggleSkillAllowedAttr?.(0, 'STR')) // add again
    await setForm((p) => p.onUpdateSkill?.(0, 'defaultAttributeId', 'STR'))
    await setForm((p) => p.onAddSkill?.()) // second skill: empty optionals -> null
    await setForm((p) => p.onUpdateSkill?.(1, 'name', 'Acrobatics'))
    await setForm((p) => p.onAddSkill?.())
    await setForm((p) => p.onRemoveSkill?.(2))

    // ── Custom fields (keep one blank key to exercise the filter) ──
    await setForm((p) => p.onNewFeatureCustomFieldsChange?.(true))
    await setForm((p) => p.onAddField?.())
    await setForm((p) => p.onUpdateField?.(0, 'key', 'f1'))
    await setForm((p) => p.onUpdateField?.(0, 'label', 'F1'))
    await setForm((p) => p.onAddField?.())
    await setForm((p) => p.onAddField?.())
    await setForm((p) => p.onRemoveField?.(2))

    // ── Skill profiles ──
    await setForm((p) => p.onNewFeatureSkillProfilesChange?.(true))
    await setForm((p) => p.onAddProfile?.())
    await setForm((p) => p.onUpdateProfile?.(0, 'Pro1'))
    await setForm((p) => p.onUpdateProfileTargetMode?.(0, 'skill'))
    await setForm((p) => p.onToggleProfileSkill?.(0, 's1')) // add (targetSkillIds undefined)
    await setForm((p) => p.onToggleProfileSkill?.(0, 's1')) // remove (filter branch)
    await setForm((p) => p.onToggleProfileSkill?.(0, 's1')) // add again
    await setForm((p) => p.onAddProfileOption?.(0))
    await setForm((p) => p.onUpdateProfileOption?.(0, 1, 'label', 'Opt'))
    await setForm((p) => p.onUpdateProfileOption?.(0, 1, 'value', 5))
    await setForm((p) => p.onRemoveProfileOption?.(0, 1))
    await setForm((p) => p.onAddProfileOption?.(0))
    await setForm((p) => p.onUpdateProfileOption?.(0, 1, 'label', 'Opt2'))
    await setForm((p) => p.onUpdateProfileOption?.(0, 1, 'value', 7))
    await setForm((p) => p.onAddProfile?.())
    await setForm((p) => p.onRemoveProfile?.(1))

    // ── Core resources ──
    await setForm((p) => p.onNewFeatureCoreResourcesChange?.(true))
    await setForm((p) => p.onAddCoreResource?.())
    await setForm((p) => p.onUpdateCoreResource?.(0, 'displayName', 'HP'))
    await setForm((p) => p.onUpdateCoreResource?.(0, 'slug', 'hp'))
    await setForm((p) => p.onUpdateCoreResource?.(0, 'color', '#ff0000'))
    await setForm((p) => p.onUpdateCoreResourceEnabled?.(0, false))
    await setForm((p) => p.onUpdateCoreResourceEditable?.(0, false))
    await setForm((p) => p.onUpdateCoreResourceShowNotes?.(0, true))
    await setForm((p) => p.onAddCoreResource?.())
    await setForm((p) => p.onRemoveCoreResource?.(1))

    // ── Armor classes ──
    await setForm((p) => p.onNewFeatureArmorClassChange?.(true))
    await setForm((p) => p.onAddNewAcConfig?.()) // ac0
    await setForm((p) => p.onAddNewAcConfig?.()) // ac1 kept around so ac0 updates hit the map's non-matching branch
    await setForm((p) => p.onUpdateNewAcConfig?.(0, { name: 'AC', enabled: false }))
    await setForm((p) => p.onAddNewAcFieldForConfig?.(0))
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 0, 'name', 'Armor')) // slugify key
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 0, 'key', 'armor'))
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 0, 'defaultValue', '10'))
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 0, 'description', 'Desc'))
    await setForm((p) => p.onUpdateNewAcFieldEditableForConfig?.(0, 0, true))
    await setForm((p) => p.onToggleNewAcAttributeIdForConfig?.(0, 'STR')) // add
    await setForm((p) => p.onToggleNewAcAttributeIdForConfig?.(0, 'STR')) // remove
    await setForm((p) => p.onToggleNewAcAttributeIdForConfig?.(0, 'STR')) // add again
    await setForm((p) =>
      p.onUpdateNewAcAttributeModifierForConfig?.(0, 'STR', { allowPlayerSelection: true }),
    )
    await setForm((p) => p.onAddNewAcFieldForConfig?.(0))
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 1, 'name', 'Shield')) // slugify
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 1, 'name', 'Shield 2')) // key set -> no slugify
    await setForm((p) => p.onUpdateNewAcFieldForConfig?.(0, 1, 'name', '   ')) // blank -> no slugify
    await setForm((p) => p.onUpdateNewAcFieldEditableForConfig?.(0, 1, false))
    await setForm((p) => p.onRemoveNewAcFieldForConfig?.(0, 1))
    await setForm((p) => p.onToggleNewAcAttributeIdForConfig?.(0, 'DEX'))
    await setForm((p) =>
      p.onUpdateNewAcAttributeModifierForConfig?.(0, 'NONEXISTENT', { allowPlayerSelection: false }),
    )
    // Nullish fields/attributeModifiers on ac1 exercises the `?? []` fallbacks
    await setForm((p) => p.onUpdateNewAcConfig?.(1, { name: 'Throwaway', fields: undefined, attributeModifiers: undefined }))
    await setForm((p) => p.onAddNewAcConfig?.())
    await setForm((p) => p.onRemoveNewAcConfig?.(2))

    // ── Character sections ──
    await setForm((p) => p.onNewFeatureCharacterSectionsChange?.(true))
    await setForm((p) => p.onAddNewCharacterSection?.())
    await setForm((p) => p.onAddNewCharacterSection?.())
    await setForm((p) => p.onUpdateNewCharacterSection?.(0, 'Bio'))
    await setForm((p) => p.onRemoveNewCharacterSection?.(1))

    // ── Resistances ──
    await setForm((p) => p.onNewFeatureResistanceChange?.(true))
    await setForm((p) => p.onNewResistancesChange?.([resDef]))

    submitForm()

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/templates', {
        name: 'The Template',
        description: 'A desc',
        attributes: [{ key: 'STR', name: 'Strength' }],
        attributeModifierFormula: '(STR - 10) / 2',
        skillFormula: 'floor(STR / 2)',
        attributeModifiersEnabled: false,
        isPublic: true,
        skills: [
          {
            name: 'Athletics',
            description: 'Run',
            attributeId: 'STR',
            allowedAttributeIds: ['STR'],
            defaultAttributeId: 'STR',
          },
          {
            name: 'Acrobatics',
            description: null,
            attributeId: null,
            allowedAttributeIds: [],
            defaultAttributeId: null,
          },
        ],
        templateFields: [{ key: 'f1', label: 'F1' }],
        skillModifierProfiles: [
          {
            name: 'Pro1',
            targetMode: 'skill',
            targetSkillIds: ['s1'],
            options: [
              { label: '', value: 0 },
              { label: 'Opt2', value: 7 },
            ],
          },
        ],
        coreResources: [
          {
            displayName: 'HP',
            slug: 'hp',
            color: '#ff0000',
            enabled: false,
            editableByPlayer: true,
            showNotes: true,
            editable: false,
          },
        ],
        armorClasses: [
          {
            enabled: false,
            name: 'AC',
            attributeModifiers: [
              { attributeId: 'STR', allowPlayerSelection: true, defaultAttributeId: 'STR' },
              { attributeId: 'DEX', allowPlayerSelection: false, defaultAttributeId: 'DEX' },
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
        characterSections: [{ name: 'Bio' }],
        resistances: [
          {
            name: 'Fire',
            calculationType: 'MANUAL',
            components: [{ name: 'Res', editableByPlayer: true, defaultValue: '0' }],
            attributeModifiers: [{ attributeId: 'STR', enabled: true }],
          },
        ],
      })
    })
    await waitFor(() => expect(mockRouterPush).toHaveBeenCalledWith('/dashboard/templates/new-1'))
  })
})
