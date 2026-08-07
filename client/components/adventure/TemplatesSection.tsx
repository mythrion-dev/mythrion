'use client'

import type { SubmitEvent } from 'react'
import type { CoreResource, AcConfigDraft, ArmorClassAttributeModifierDraft, ResistanceDef } from '@/components/adventure/types'
import { useTranslation } from 'react-i18next'
import { TemplateRow } from '@/components/adventure/TemplateRow'
import { TemplateForm } from '@/components/adventure/TemplateForm'
import { EmptyState } from '@/components/shared/EmptyState'

interface TemplateData {
  id: string
  name: string
  description: string | null
  attributes: { id: string; key: string; name: string }[]
  createdAt: string
}

export function TemplatesSection(props: {
  readonly templates: TemplateData[]; readonly isGM: boolean; readonly showNewTemplate: boolean; readonly editingTemplateId: string | null
  readonly newTemplateName: string; readonly newTemplateDescription: string; readonly newTemplateAttrs: { key: string; name: string }[]; readonly newAttrModifierFormula: string; readonly newSkillFormula: string; readonly newTemplateFields?: { key: string; label: string }[]; readonly templateError: string | null; readonly templateCreating: boolean
  readonly editTemplateName: string; readonly editTemplateDescription: string; readonly editTemplateAttrs: { key: string; name: string }[]; readonly editAttrModifierFormula: string; readonly editSkillFormula: string; readonly editTemplateFields?: { key: string; label: string }[]; readonly editingTemplateError: string | null; readonly templateSaving: boolean
  readonly onNewClick: () => void; readonly onCancelNew: () => void; readonly onCreateTemplate: (e: SubmitEvent) => void; readonly onNameChange: (v: string) => void; readonly onDescriptionChange: (v: string) => void
  readonly onAddAttr: () => void; readonly onRemoveAttr: (i: number) => void; readonly onUpdateAttr: (i: number, f: 'key' | 'name', v: string) => void
  readonly onAddField?: () => void; readonly onRemoveField?: (i: number) => void; readonly onUpdateField?: (i: number, f: 'key' | 'label', v: string) => void
  readonly onStartEdit: (t: TemplateData) => void; readonly onCancelEdit: () => void; readonly onUpdateTemplate: (e: SubmitEvent) => void; readonly onDeleteTemplate: (id: string) => void
  readonly onEditNameChange: (v: string) => void; readonly onEditDescriptionChange: (v: string) => void; readonly onAddEditAttr: () => void; readonly onRemoveEditAttr: (i: number) => void; readonly onUpdateEditAttr: (i: number, f: 'key' | 'name', v: string) => void
  readonly onAddEditField?: () => void; readonly onRemoveEditField?: (i: number) => void; readonly onUpdateEditField?: (i: number, f: 'key' | 'label', v: string) => void
  readonly newTemplateSkills?: { name: string; description: string; attributeId: string; allowedAttributeIds: string[]; defaultAttributeId: string }[]
  readonly editTemplateSkills?: { name: string; description: string; attributeId: string; allowedAttributeIds: string[]; defaultAttributeId: string }[]
  readonly onAddSkill?: () => void; readonly onRemoveSkill?: (i: number) => void; readonly onUpdateSkill?: (i: number, f: string, v: string) => void
  readonly onToggleSkillAllowedAttr?: (i: number, attrKey: string) => void
  readonly onAddEditSkill?: () => void; readonly onRemoveEditSkill?: (i: number) => void; readonly onUpdateEditSkill?: (i: number, f: string, v: string) => void
  readonly onToggleEditSkillAllowedAttr?: (i: number, attrKey: string) => void
  readonly newTemplateProfiles?: { name: string; options: { label: string; value: number }[] }[]; readonly editTemplateProfiles?: { name: string; options: { label: string; value: number }[] }[]
  readonly onAddProfile?: () => void; readonly onRemoveProfile?: (i: number) => void; readonly onUpdateProfile?: (i: number, n: string) => void
  readonly onAddProfileOption?: (pIdx: number) => void; readonly onRemoveProfileOption?: (pIdx: number, oIdx: number) => void; readonly onUpdateProfileOption?: (pIdx: number, oIdx: number, f: 'label' | 'value', v: string | number) => void
  readonly onUpdateProfileTargetMode?: (i: number, mode: string) => void; readonly onToggleProfileSkill?: (i: number, skillId: string) => void
  readonly onAddEditProfile?: () => void; readonly onRemoveEditProfile?: (i: number) => void; readonly onUpdateEditProfile?: (i: number, n: string) => void
  readonly onAddEditProfileOption?: (pIdx: number) => void; readonly onRemoveEditProfileOption?: (pIdx: number, oIdx: number) => void; readonly onUpdateEditProfileOption?: (pIdx: number, oIdx: number, f: 'label' | 'value', v: string | number) => void
  readonly onUpdateEditProfileTargetMode?: (i: number, mode: string) => void; readonly onToggleEditProfileSkill?: (i: number, skillId: string) => void
  readonly newCoreResources?: CoreResource[]; readonly editCoreResources?: CoreResource[]
  readonly onAddCoreResource?: () => void; readonly onRemoveCoreResource?: (i: number) => void; readonly onUpdateCoreResource?: (i: number, f: 'displayName' | 'slug' | 'color', v: string) => void
  readonly onUpdateCoreResourceEnabled?: (i: number, v: boolean) => void; readonly onUpdateCoreResourceEditable?: (i: number, v: boolean) => void; readonly onUpdateCoreResourceShowNotes?: (i: number, v: boolean) => void
  readonly onAddEditCoreResource?: () => void; readonly onRemoveEditCoreResource?: (i: number) => void; readonly onUpdateEditCoreResource?: (i: number, f: 'displayName' | 'slug' | 'color', v: string) => void
  readonly onUpdateEditCoreResourceEnabled?: (i: number, v: boolean) => void; readonly onUpdateEditCoreResourceEditable?: (i: number, v: boolean) => void; readonly onUpdateEditCoreResourceShowNotes?: (i: number, v: boolean) => void
  readonly newAcConfigs?: AcConfigDraft[]
  readonly onAddNewAcConfig?: () => void; readonly onRemoveNewAcConfig?: (i: number) => void; readonly onUpdateNewAcConfig?: (i: number, patch: Partial<AcConfigDraft>) => void
  readonly onAddNewAcFieldForConfig?: (configIdx: number) => void; readonly onRemoveNewAcFieldForConfig?: (configIdx: number, fieldIdx: number) => void
  readonly onUpdateNewAcFieldForConfig?: (configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) => void; readonly onUpdateNewAcFieldEditableForConfig?: (configIdx: number, fieldIdx: number, v: boolean) => void
  readonly onToggleNewAcAttributeIdForConfig?: (configIdx: number, attrId: string) => void
  readonly onUpdateNewAcAttributeModifierForConfig?: (configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) => void
  readonly editAcConfigs?: AcConfigDraft[]
  readonly onAddEditAcConfig?: () => void; readonly onRemoveEditAcConfig?: (i: number) => void; readonly onUpdateEditAcConfig?: (i: number, patch: Partial<AcConfigDraft>) => void
  readonly onAddEditAcFieldForConfig?: (configIdx: number) => void; readonly onRemoveEditAcFieldForConfig?: (configIdx: number, fieldIdx: number) => void
  readonly onUpdateEditAcFieldForConfig?: (configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) => void; readonly onUpdateEditAcFieldEditableForConfig?: (configIdx: number, fieldIdx: number, v: boolean) => void
  readonly onToggleEditAcAttributeIdForConfig?: (configIdx: number, attrId: string) => void
  readonly onUpdateEditAcAttributeModifierForConfig?: (configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) => void
  readonly newAttrModifiersEnabled?: boolean
  readonly onNewAttrModifiersEnabledChange?: (v: boolean) => void
  readonly onNewAttrModifierFormulaChange?: (v: string) => void
  readonly onNewSkillFormulaChange?: (v: string) => void
  readonly editAttrModifiersEnabled?: boolean
  readonly onEditAttrModifiersEnabledChange?: (v: boolean) => void
  readonly onEditAttrModifierFormulaChange?: (v: string) => void
  readonly onEditSkillFormulaChange?: (v: string) => void
  readonly newCharacterSections?: { id?: string; name: string }[]
  readonly editCharacterSections?: { id?: string; name: string }[]
  readonly onAddNewCharacterSection?: () => void; readonly onRemoveNewCharacterSection?: (i: number) => void; readonly onUpdateNewCharacterSection?: (i: number, v: string) => void
  readonly onAddEditCharacterSection?: () => void; readonly onRemoveEditCharacterSection?: (i: number) => void; readonly onUpdateEditCharacterSection?: (i: number, v: string) => void
  readonly newResistances?: ResistanceDef[]; readonly editResistances?: ResistanceDef[]
  readonly onNewResistancesChange?: (v: ResistanceDef[]) => void
  readonly onEditResistancesChange?: (v: ResistanceDef[]) => void
  readonly newTemplateAttrsForResistance?: { key: string; name: string; id?: string }[]
  readonly editTemplateAttrsForResistance?: { key: string; name: string; id?: string }[]
  readonly newIsPublic?: boolean
  readonly onNewIsPublicChange?: (v: boolean) => void
  // Feature selection toggles — new template
  readonly newFeatureSkills: boolean; readonly onNewFeatureSkillsChange: (v: boolean) => void
  readonly newFeatureCustomFields: boolean; readonly onNewFeatureCustomFieldsChange: (v: boolean) => void
  readonly newFeatureCoreResources: boolean; readonly onNewFeatureCoreResourcesChange: (v: boolean) => void
  readonly newFeatureArmorClass: boolean; readonly onNewFeatureArmorClassChange: (v: boolean) => void
  readonly newFeatureCharacterSections: boolean; readonly onNewFeatureCharacterSectionsChange: (v: boolean) => void
  readonly newFeatureSkillProfiles: boolean; readonly onNewFeatureSkillProfilesChange: (v: boolean) => void
  readonly newFeatureResistance: boolean; readonly onNewFeatureResistanceChange: (v: boolean) => void
  // Feature selection toggles — edit template
  readonly editFeatureSkills: boolean; readonly onEditFeatureSkillsChange: (v: boolean) => void
  readonly editFeatureCustomFields: boolean; readonly onEditFeatureCustomFieldsChange: (v: boolean) => void
  readonly editFeatureCoreResources: boolean; readonly onEditFeatureCoreResourcesChange: (v: boolean) => void
  readonly editFeatureArmorClass: boolean; readonly onEditFeatureArmorClassChange: (v: boolean) => void
  readonly editFeatureCharacterSections: boolean; readonly onEditFeatureCharacterSectionsChange: (v: boolean) => void
  readonly editFeatureSkillProfiles: boolean; readonly onEditFeatureSkillProfilesChange: (v: boolean) => void
  readonly editFeatureResistance: boolean; readonly onEditFeatureResistanceChange: (v: boolean) => void
  /** When true, hides the "+ New Template" button when a campaign-owned template already exists */
  readonly hideCreateButton?: boolean
}) {
  const { t } = useTranslation()
  const attrsForNewResistance = props.newTemplateAttrsForResistance || props.newTemplateAttrs || []
  const attrsForEditResistance = props.editTemplateAttrsForResistance || props.editTemplateAttrs || []
  const emptyAction = !props.hideCreateButton && props.isGM ? props.onNewClick : undefined
  return <div className="space-y-4">
    {props.templates.length === 0 && !props.showNewTemplate ? <EmptyState icon="📋" title={t('campaign:noTemplatesYet')} description={props.isGM ? t('campaign:emptyStateDescriptionGM') : t('campaign:emptyStateDescriptionNonGM')} actionLabel={props.isGM ? t('campaign:newTemplate') : undefined} onAction={emptyAction} />
      : <div className="space-y-3">{props.templates.map(t => <TemplateRow key={t.id} template={t} isGM={props.isGM} isEditing={props.editingTemplateId === t.id} editName={props.editTemplateName} editDescription={props.editTemplateDescription} editAttrs={props.editTemplateAttrs} editAttrModifierFormula={props.editAttrModifierFormula} editSkillFormula={props.editSkillFormula} editFields={props.editTemplateFields} editSkills={props.editTemplateSkills} editError={props.editingTemplateError} saving={props.templateSaving} onStartEdit={() => props.onStartEdit(t)} onCancelEdit={props.onCancelEdit} onUpdate={props.onUpdateTemplate} onDelete={() => props.onDeleteTemplate(t.id)} onEditNameChange={props.onEditNameChange} onEditDescriptionChange={props.onEditDescriptionChange} onAddAttr={props.onAddEditAttr} onRemoveAttr={props.onRemoveEditAttr} onUpdateAttr={props.onUpdateEditAttr} onAddField={props.onAddEditField} onRemoveField={props.onRemoveEditField} onUpdateField={props.onUpdateEditField} onAddSkill={props.onAddEditSkill} onRemoveSkill={props.onRemoveEditSkill} onUpdateSkill={props.onUpdateEditSkill} onToggleSkillAllowedAttr={props.onToggleEditSkillAllowedAttr} editProfiles={props.editTemplateProfiles} onAddProfile={props.onAddEditProfile} onRemoveProfile={props.onRemoveEditProfile} onUpdateProfile={props.onUpdateEditProfile} onAddProfileOption={props.onAddEditProfileOption} onRemoveProfileOption={props.onRemoveEditProfileOption} onUpdateProfileOption={props.onUpdateEditProfileOption} onUpdateProfileTargetMode={props.onUpdateEditProfileTargetMode} onToggleProfileSkill={props.onToggleEditProfileSkill} editCoreResources={props.editCoreResources} onAddCoreResource={props.onAddEditCoreResource} onRemoveCoreResource={props.onRemoveEditCoreResource} onUpdateCoreResource={props.onUpdateEditCoreResource} onUpdateCoreResourceEnabled={props.onUpdateEditCoreResourceEnabled} onUpdateCoreResourceEditable={props.onUpdateEditCoreResourceEditable} onUpdateCoreResourceShowNotes={props.onUpdateEditCoreResourceShowNotes} editAcConfigs={props.editAcConfigs} editAttrsForAc={props.editTemplateAttrs.filter(a => a.key.trim() && a.name.trim()).map(a => ({ key: a.key.trim(), name: a.name.trim() }))} editAttrModifiersEnabled={props.editAttrModifiersEnabled} onAddEditAcConfig={props.onAddEditAcConfig} onRemoveEditAcConfig={props.onRemoveEditAcConfig} onUpdateEditAcConfig={props.onUpdateEditAcConfig} onAddEditAcFieldForConfig={props.onAddEditAcFieldForConfig} onRemoveEditAcFieldForConfig={props.onRemoveEditAcFieldForConfig} onUpdateEditAcFieldForConfig={props.onUpdateEditAcFieldForConfig} onUpdateEditAcFieldEditableForConfig={props.onUpdateEditAcFieldEditableForConfig} onToggleEditAcAttributeIdForConfig={props.onToggleEditAcAttributeIdForConfig} onUpdateEditAcAttributeModifierForConfig={props.onUpdateEditAcAttributeModifierForConfig} onEditAttrModifiersEnabledChange={props.onEditAttrModifiersEnabledChange} onEditAttrModifierFormulaChange={props.onEditAttrModifierFormulaChange} onEditSkillFormulaChange={props.onEditSkillFormulaChange} editCharacterSections={props.editCharacterSections} onAddEditCharacterSection={props.onAddEditCharacterSection} onRemoveEditCharacterSection={props.onRemoveEditCharacterSection} onUpdateEditCharacterSection={props.onUpdateEditCharacterSection} onEditResistancesChange={props.onEditResistancesChange} editResistances={props.editResistances} attrsForEditResistance={attrsForEditResistance} editFeatureSkills={props.editFeatureSkills} editFeatureCustomFields={props.editFeatureCustomFields} editFeatureCoreResources={props.editFeatureCoreResources} editFeatureArmorClass={props.editFeatureArmorClass} editFeatureCharacterSections={props.editFeatureCharacterSections} editFeatureSkillProfiles={props.editFeatureSkillProfiles} editFeatureResistance={props.editFeatureResistance} />)}</div>}
    {props.isGM && !props.showNewTemplate && !props.hideCreateButton && <button onClick={props.onNewClick} className="btn-primary text-sm">{t('campaign:newTemplate')}</button>}
    {props.isGM && props.showNewTemplate && <TemplateForm newTemplateName={props.newTemplateName} newTemplateDescription={props.newTemplateDescription} newTemplateAttrs={props.newTemplateAttrs} newAttrModifierFormula={props.newAttrModifierFormula} newSkillFormula={props.newSkillFormula} newTemplateSkills={props.newTemplateSkills} newTemplateProfiles={props.newTemplateProfiles} newTemplateFields={props.newTemplateFields} templateError={props.templateError} templateCreating={props.templateCreating} onNameChange={props.onNameChange} onDescriptionChange={props.onDescriptionChange} onAddAttr={props.onAddAttr} onRemoveAttr={props.onRemoveAttr} onUpdateAttr={props.onUpdateAttr} onAddSkill={props.onAddSkill} onRemoveSkill={props.onRemoveSkill} onUpdateSkill={props.onUpdateSkill} onToggleSkillAllowedAttr={props.onToggleSkillAllowedAttr} onAddProfile={props.onAddProfile} onRemoveProfile={props.onRemoveProfile} onUpdateProfile={props.onUpdateProfile} onAddProfileOption={props.onAddProfileOption} onRemoveProfileOption={props.onRemoveProfileOption} onUpdateProfileOption={props.onUpdateProfileOption} onAddField={props.onAddField} onRemoveField={props.onRemoveField} onUpdateField={props.onUpdateField} onUpdateProfileTargetMode={props.onUpdateProfileTargetMode} onToggleProfileSkill={props.onToggleProfileSkill} onCancelNew={props.onCancelNew} onCreateTemplate={props.onCreateTemplate} newCoreResources={props.newCoreResources} onAddCoreResource={props.onAddCoreResource} onRemoveCoreResource={props.onRemoveCoreResource} onUpdateCoreResource={props.onUpdateCoreResource} onUpdateCoreResourceEnabled={props.onUpdateCoreResourceEnabled} onUpdateCoreResourceEditable={props.onUpdateCoreResourceEditable} onUpdateCoreResourceShowNotes={props.onUpdateCoreResourceShowNotes} newAcConfigs={props.newAcConfigs} newAttrsForAc={props.newTemplateAttrs.filter(a => a.key.trim() && a.name.trim()).map(a => ({ key: a.key.trim(), name: a.name.trim() }))} newAttrModifiersEnabled={props.newAttrModifiersEnabled} onAddNewAcConfig={props.onAddNewAcConfig} onRemoveNewAcConfig={props.onRemoveNewAcConfig} onUpdateNewAcConfig={props.onUpdateNewAcConfig} onAddNewAcFieldForConfig={props.onAddNewAcFieldForConfig} onRemoveNewAcFieldForConfig={props.onRemoveNewAcFieldForConfig} onUpdateNewAcFieldForConfig={props.onUpdateNewAcFieldForConfig} onUpdateNewAcFieldEditableForConfig={props.onUpdateNewAcFieldEditableForConfig} onToggleNewAcAttributeIdForConfig={props.onToggleNewAcAttributeIdForConfig} onUpdateNewAcAttributeModifierForConfig={props.onUpdateNewAcAttributeModifierForConfig} onNewAttrModifiersEnabledChange={props.onNewAttrModifiersEnabledChange} onNewAttrModifierFormulaChange={props.onNewAttrModifierFormulaChange} onNewSkillFormulaChange={props.onNewSkillFormulaChange} newCharacterSections={props.newCharacterSections} onAddNewCharacterSection={props.onAddNewCharacterSection} onRemoveNewCharacterSection={props.onRemoveNewCharacterSection} onUpdateNewCharacterSection={props.onUpdateNewCharacterSection} onNewResistancesChange={props.onNewResistancesChange} newResistances={props.newResistances} attrsForNewResistance={attrsForNewResistance} newIsPublic={props.newIsPublic} onNewIsPublicChange={props.onNewIsPublicChange} newFeatureSkills={props.newFeatureSkills} onNewFeatureSkillsChange={props.onNewFeatureSkillsChange} newFeatureCustomFields={props.newFeatureCustomFields} onNewFeatureCustomFieldsChange={props.onNewFeatureCustomFieldsChange} newFeatureCoreResources={props.newFeatureCoreResources} onNewFeatureCoreResourcesChange={props.onNewFeatureCoreResourcesChange} newFeatureArmorClass={props.newFeatureArmorClass} onNewFeatureArmorClassChange={props.onNewFeatureArmorClassChange} newFeatureCharacterSections={props.newFeatureCharacterSections} onNewFeatureCharacterSectionsChange={props.onNewFeatureCharacterSectionsChange} newFeatureSkillProfiles={props.newFeatureSkillProfiles} onNewFeatureSkillProfilesChange={props.onNewFeatureSkillProfilesChange} newFeatureResistance={props.newFeatureResistance} onNewFeatureResistanceChange={props.onNewFeatureResistanceChange} />}
  </div>
}
