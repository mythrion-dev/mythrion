'use client'

import type { FormEvent } from 'react'
import type { CoreResource, AcConfigDraft, ArmorClassAttributeModifierDraft, ResistanceDef } from '@/components/adventure/types'
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
  templates: TemplateData[]; isGM: boolean; showNewTemplate: boolean; editingTemplateId: string | null
  newTemplateName: string; newTemplateDescription: string; newTemplateAttrs: { key: string; name: string }[]; newAttrModifierFormula: string; newSkillFormula: string; newTemplateFields?: { key: string; label: string }[]; templateError: string | null; templateCreating: boolean
  editTemplateName: string; editTemplateDescription: string; editTemplateAttrs: { key: string; name: string }[]; editAttrModifierFormula: string; editSkillFormula: string; editTemplateFields?: { key: string; label: string }[]; editingTemplateError: string | null; templateSaving: boolean
  onNewClick: () => void; onCancelNew: () => void; onCreateTemplate: (e: FormEvent) => void; onNameChange: (v: string) => void; onDescriptionChange: (v: string) => void
  onAddAttr: () => void; onRemoveAttr: (i: number) => void; onUpdateAttr: (i: number, f: 'key' | 'name', v: string) => void
  onAddField?: () => void; onRemoveField?: (i: number) => void; onUpdateField?: (i: number, f: 'key' | 'label', v: string) => void
  onStartEdit: (t: TemplateData) => void; onCancelEdit: () => void; onUpdateTemplate: (e: FormEvent) => void; onDeleteTemplate: (id: string) => void
  onEditNameChange: (v: string) => void; onEditDescriptionChange: (v: string) => void; onAddEditAttr: () => void; onRemoveEditAttr: (i: number) => void; onUpdateEditAttr: (i: number, f: 'key' | 'name', v: string) => void
  onAddEditField?: () => void; onRemoveEditField?: (i: number) => void; onUpdateEditField?: (i: number, f: 'key' | 'label', v: string) => void
  newTemplateSkills?: { name: string; description: string; attributeId: string; allowedAttributeIds: string[]; defaultAttributeId: string }[]
  editTemplateSkills?: { name: string; description: string; attributeId: string; allowedAttributeIds: string[]; defaultAttributeId: string }[]
  onAddSkill?: () => void; onRemoveSkill?: (i: number) => void; onUpdateSkill?: (i: number, f: string, v: string) => void
  onToggleSkillAllowedAttr?: (i: number, attrKey: string) => void
  onAddEditSkill?: () => void; onRemoveEditSkill?: (i: number) => void; onUpdateEditSkill?: (i: number, f: string, v: string) => void
  onToggleEditSkillAllowedAttr?: (i: number, attrKey: string) => void
  newTemplateProfiles?: { name: string; options: { label: string; value: number }[] }[]; editTemplateProfiles?: { name: string; options: { label: string; value: number }[] }[]
  onAddProfile?: () => void; onRemoveProfile?: (i: number) => void; onUpdateProfile?: (i: number, n: string) => void
  onAddProfileOption?: (pIdx: number) => void; onRemoveProfileOption?: (pIdx: number, oIdx: number) => void; onUpdateProfileOption?: (pIdx: number, oIdx: number, f: 'label' | 'value', v: string | number) => void
  onUpdateProfileTargetMode?: (i: number, mode: string) => void; onToggleProfileSkill?: (i: number, skillId: string) => void
  onAddEditProfile?: () => void; onRemoveEditProfile?: (i: number) => void; onUpdateEditProfile?: (i: number, n: string) => void
  onAddEditProfileOption?: (pIdx: number) => void; onRemoveEditProfileOption?: (pIdx: number, oIdx: number) => void; onUpdateEditProfileOption?: (pIdx: number, oIdx: number, f: 'label' | 'value', v: string | number) => void
  onUpdateEditProfileTargetMode?: (i: number, mode: string) => void; onToggleEditProfileSkill?: (i: number, skillId: string) => void
  newCoreResources?: CoreResource[]; editCoreResources?: CoreResource[]
  onAddCoreResource?: () => void; onRemoveCoreResource?: (i: number) => void; onUpdateCoreResource?: (i: number, f: 'displayName' | 'slug' | 'color', v: string) => void
  onUpdateCoreResourceEnabled?: (i: number, v: boolean) => void; onUpdateCoreResourceEditable?: (i: number, v: boolean) => void; onUpdateCoreResourceShowNotes?: (i: number, v: boolean) => void
  onAddEditCoreResource?: () => void; onRemoveEditCoreResource?: (i: number) => void; onUpdateEditCoreResource?: (i: number, f: 'displayName' | 'slug' | 'color', v: string) => void
  onUpdateEditCoreResourceEnabled?: (i: number, v: boolean) => void; onUpdateEditCoreResourceEditable?: (i: number, v: boolean) => void; onUpdateEditCoreResourceShowNotes?: (i: number, v: boolean) => void
  newAcConfigs?: AcConfigDraft[]
  onAddNewAcConfig?: () => void; onRemoveNewAcConfig?: (i: number) => void; onUpdateNewAcConfig?: (i: number, patch: Partial<AcConfigDraft>) => void
  onAddNewAcFieldForConfig?: (configIdx: number) => void; onRemoveNewAcFieldForConfig?: (configIdx: number, fieldIdx: number) => void
  onUpdateNewAcFieldForConfig?: (configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) => void; onUpdateNewAcFieldEditableForConfig?: (configIdx: number, fieldIdx: number, v: boolean) => void
  onToggleNewAcAttributeIdForConfig?: (configIdx: number, attrId: string) => void
  onUpdateNewAcAttributeModifierForConfig?: (configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) => void
  editAcConfigs?: AcConfigDraft[]
  onAddEditAcConfig?: () => void; onRemoveEditAcConfig?: (i: number) => void; onUpdateEditAcConfig?: (i: number, patch: Partial<AcConfigDraft>) => void
  onAddEditAcFieldForConfig?: (configIdx: number) => void; onRemoveEditAcFieldForConfig?: (configIdx: number, fieldIdx: number) => void
  onUpdateEditAcFieldForConfig?: (configIdx: number, fieldIdx: number, f: 'name' | 'key' | 'defaultValue' | 'description', v: string) => void; onUpdateEditAcFieldEditableForConfig?: (configIdx: number, fieldIdx: number, v: boolean) => void
  onToggleEditAcAttributeIdForConfig?: (configIdx: number, attrId: string) => void
  onUpdateEditAcAttributeModifierForConfig?: (configIdx: number, attrId: string, patch: Partial<ArmorClassAttributeModifierDraft>) => void
  newAttrModifiersEnabled?: boolean
  onNewAttrModifiersEnabledChange?: (v: boolean) => void
  onNewAttrModifierFormulaChange?: (v: string) => void
  onNewSkillFormulaChange?: (v: string) => void
  editAttrModifiersEnabled?: boolean
  onEditAttrModifiersEnabledChange?: (v: boolean) => void
  onEditAttrModifierFormulaChange?: (v: string) => void
  onEditSkillFormulaChange?: (v: string) => void
  newCharacterSections?: { id?: string; name: string }[]
  editCharacterSections?: { id?: string; name: string }[]
  onAddNewCharacterSection?: () => void; onRemoveNewCharacterSection?: (i: number) => void; onUpdateNewCharacterSection?: (i: number, v: string) => void
  onAddEditCharacterSection?: () => void; onRemoveEditCharacterSection?: (i: number) => void; onUpdateEditCharacterSection?: (i: number, v: string) => void
  newResistances?: ResistanceDef[]; editResistances?: ResistanceDef[]
  onNewResistancesChange?: (v: ResistanceDef[]) => void
  onEditResistancesChange?: (v: ResistanceDef[]) => void
  newTemplateAttrsForResistance?: { key: string; name: string; id?: string }[]
  editTemplateAttrsForResistance?: { key: string; name: string; id?: string }[]
  // Feature selection toggles — new template
  newFeatureSkills: boolean; onNewFeatureSkillsChange: (v: boolean) => void
  newFeatureCustomFields: boolean; onNewFeatureCustomFieldsChange: (v: boolean) => void
  newFeatureCoreResources: boolean; onNewFeatureCoreResourcesChange: (v: boolean) => void
  newFeatureArmorClass: boolean; onNewFeatureArmorClassChange: (v: boolean) => void
  newFeatureCharacterSections: boolean; onNewFeatureCharacterSectionsChange: (v: boolean) => void
  newFeatureSkillProfiles: boolean; onNewFeatureSkillProfilesChange: (v: boolean) => void
  newFeatureResistance: boolean; onNewFeatureResistanceChange: (v: boolean) => void
  // Feature selection toggles — edit template
  editFeatureSkills: boolean; onEditFeatureSkillsChange: (v: boolean) => void
  editFeatureCustomFields: boolean; onEditFeatureCustomFieldsChange: (v: boolean) => void
  editFeatureCoreResources: boolean; onEditFeatureCoreResourcesChange: (v: boolean) => void
  editFeatureArmorClass: boolean; onEditFeatureArmorClassChange: (v: boolean) => void
  editFeatureCharacterSections: boolean; onEditFeatureCharacterSectionsChange: (v: boolean) => void
  editFeatureSkillProfiles: boolean; onEditFeatureSkillProfilesChange: (v: boolean) => void
  editFeatureResistance: boolean; onEditFeatureResistanceChange: (v: boolean) => void
  /** When true, hides the "+ New Template" button when a campaign-owned template already exists */
  hideCreateButton?: boolean
}) {
  const attrsForNewResistance = props.newTemplateAttrsForResistance || props.newTemplateAttrs || []
  const attrsForEditResistance = props.editTemplateAttrsForResistance || props.editTemplateAttrs || []
  return <div className="space-y-4">
    {props.templates.length === 0 && !props.showNewTemplate ? <EmptyState icon="📋" title="No Templates Yet" description={props.isGM ? 'Create a template to allow players to build character sheets.' : 'No templates are available yet.'} actionLabel={props.isGM ? '+ New Template' : undefined} onAction={props.hideCreateButton ? undefined : (props.isGM ? props.onNewClick : undefined)} />
      : <div className="space-y-3">{props.templates.map(t => <TemplateRow key={t.id} template={t} isGM={props.isGM} isEditing={props.editingTemplateId === t.id} editName={props.editTemplateName} editDescription={props.editTemplateDescription} editAttrs={props.editTemplateAttrs} editAttrModifierFormula={props.editAttrModifierFormula} editSkillFormula={props.editSkillFormula} editFields={props.editTemplateFields} editSkills={props.editTemplateSkills} editError={props.editingTemplateError} saving={props.templateSaving} onStartEdit={() => props.onStartEdit(t)} onCancelEdit={props.onCancelEdit} onUpdate={props.onUpdateTemplate} onDelete={() => props.onDeleteTemplate(t.id)} onEditNameChange={props.onEditNameChange} onEditDescriptionChange={props.onEditDescriptionChange} onAddAttr={props.onAddEditAttr} onRemoveAttr={props.onRemoveEditAttr} onUpdateAttr={props.onUpdateEditAttr} onAddField={props.onAddEditField} onRemoveField={props.onRemoveEditField} onUpdateField={props.onUpdateEditField} onAddSkill={props.onAddEditSkill} onRemoveSkill={props.onRemoveEditSkill} onUpdateSkill={props.onUpdateEditSkill} onToggleSkillAllowedAttr={props.onToggleEditSkillAllowedAttr} editProfiles={props.editTemplateProfiles} onAddProfile={props.onAddEditProfile} onRemoveProfile={props.onRemoveEditProfile} onUpdateProfile={props.onUpdateEditProfile} onAddProfileOption={props.onAddEditProfileOption} onRemoveProfileOption={props.onRemoveEditProfileOption} onUpdateProfileOption={props.onUpdateEditProfileOption} onUpdateProfileTargetMode={props.onUpdateEditProfileTargetMode} onToggleProfileSkill={props.onToggleEditProfileSkill} editCoreResources={props.editCoreResources} onAddCoreResource={props.onAddEditCoreResource} onRemoveCoreResource={props.onRemoveEditCoreResource} onUpdateCoreResource={props.onUpdateEditCoreResource} onUpdateCoreResourceEnabled={props.onUpdateEditCoreResourceEnabled} onUpdateCoreResourceEditable={props.onUpdateEditCoreResourceEditable} onUpdateCoreResourceShowNotes={props.onUpdateEditCoreResourceShowNotes} editAcConfigs={props.editAcConfigs} editAttrsForAc={props.editTemplateAttrs.filter(a => a.key.trim() && a.name.trim()).map(a => ({ key: a.key.trim(), name: a.name.trim() }))} editAttrModifiersEnabled={props.editAttrModifiersEnabled} onAddEditAcConfig={props.onAddEditAcConfig} onRemoveEditAcConfig={props.onRemoveEditAcConfig} onUpdateEditAcConfig={props.onUpdateEditAcConfig} onAddEditAcFieldForConfig={props.onAddEditAcFieldForConfig} onRemoveEditAcFieldForConfig={props.onRemoveEditAcFieldForConfig} onUpdateEditAcFieldForConfig={props.onUpdateEditAcFieldForConfig} onUpdateEditAcFieldEditableForConfig={props.onUpdateEditAcFieldEditableForConfig} onToggleEditAcAttributeIdForConfig={props.onToggleEditAcAttributeIdForConfig} onUpdateEditAcAttributeModifierForConfig={props.onUpdateEditAcAttributeModifierForConfig} onEditAttrModifiersEnabledChange={props.onEditAttrModifiersEnabledChange} onEditAttrModifierFormulaChange={props.onEditAttrModifierFormulaChange} onEditSkillFormulaChange={props.onEditSkillFormulaChange} editCharacterSections={props.editCharacterSections} onAddEditCharacterSection={props.onAddEditCharacterSection} onRemoveEditCharacterSection={props.onRemoveEditCharacterSection} onUpdateEditCharacterSection={props.onUpdateEditCharacterSection} onEditResistancesChange={props.onEditResistancesChange} editResistances={props.editResistances} attrsForEditResistance={attrsForEditResistance} editFeatureSkills={props.editFeatureSkills} onEditFeatureSkillsChange={props.onEditFeatureSkillsChange} editFeatureCustomFields={props.editFeatureCustomFields} onEditFeatureCustomFieldsChange={props.onEditFeatureCustomFieldsChange} editFeatureCoreResources={props.editFeatureCoreResources} onEditFeatureCoreResourcesChange={props.onEditFeatureCoreResourcesChange} editFeatureArmorClass={props.editFeatureArmorClass} onEditFeatureArmorClassChange={props.onEditFeatureArmorClassChange} editFeatureCharacterSections={props.editFeatureCharacterSections} onEditFeatureCharacterSectionsChange={props.onEditFeatureCharacterSectionsChange} editFeatureSkillProfiles={props.editFeatureSkillProfiles} onEditFeatureSkillProfilesChange={props.onEditFeatureSkillProfilesChange} editFeatureResistance={props.editFeatureResistance} onEditFeatureResistanceChange={props.onEditFeatureResistanceChange} />)}</div>}
    {props.isGM && !props.showNewTemplate && !props.hideCreateButton && <button onClick={props.onNewClick} className="btn-primary text-sm">+ New Template</button>}
    {props.isGM && props.showNewTemplate && <TemplateForm newTemplateName={props.newTemplateName} newTemplateDescription={props.newTemplateDescription} newTemplateAttrs={props.newTemplateAttrs} newAttrModifierFormula={props.newAttrModifierFormula} newSkillFormula={props.newSkillFormula} newTemplateSkills={props.newTemplateSkills} newTemplateProfiles={props.newTemplateProfiles} newTemplateFields={props.newTemplateFields} templateError={props.templateError} templateCreating={props.templateCreating} onNameChange={props.onNameChange} onDescriptionChange={props.onDescriptionChange} onAddAttr={props.onAddAttr} onRemoveAttr={props.onRemoveAttr} onUpdateAttr={props.onUpdateAttr} onAddSkill={props.onAddSkill} onRemoveSkill={props.onRemoveSkill} onUpdateSkill={props.onUpdateSkill} onToggleSkillAllowedAttr={props.onToggleSkillAllowedAttr} onAddProfile={props.onAddProfile} onRemoveProfile={props.onRemoveProfile} onUpdateProfile={props.onUpdateProfile} onAddProfileOption={props.onAddProfileOption} onRemoveProfileOption={props.onRemoveProfileOption} onUpdateProfileOption={props.onUpdateProfileOption} onAddField={props.onAddField} onRemoveField={props.onRemoveField} onUpdateField={props.onUpdateField} onUpdateProfileTargetMode={props.onUpdateProfileTargetMode} onToggleProfileSkill={props.onToggleProfileSkill} onCancelNew={props.onCancelNew} onCreateTemplate={props.onCreateTemplate} newCoreResources={props.newCoreResources} onAddCoreResource={props.onAddCoreResource} onRemoveCoreResource={props.onRemoveCoreResource} onUpdateCoreResource={props.onUpdateCoreResource} onUpdateCoreResourceEnabled={props.onUpdateCoreResourceEnabled} onUpdateCoreResourceEditable={props.onUpdateCoreResourceEditable} onUpdateCoreResourceShowNotes={props.onUpdateCoreResourceShowNotes} newAcConfigs={props.newAcConfigs} newAttrsForAc={props.newTemplateAttrs.filter(a => a.key.trim() && a.name.trim()).map(a => ({ key: a.key.trim(), name: a.name.trim() }))} newAttrModifiersEnabled={props.newAttrModifiersEnabled} onAddNewAcConfig={props.onAddNewAcConfig} onRemoveNewAcConfig={props.onRemoveNewAcConfig} onUpdateNewAcConfig={props.onUpdateNewAcConfig} onAddNewAcFieldForConfig={props.onAddNewAcFieldForConfig} onRemoveNewAcFieldForConfig={props.onRemoveNewAcFieldForConfig} onUpdateNewAcFieldForConfig={props.onUpdateNewAcFieldForConfig} onUpdateNewAcFieldEditableForConfig={props.onUpdateNewAcFieldEditableForConfig} onToggleNewAcAttributeIdForConfig={props.onToggleNewAcAttributeIdForConfig} onUpdateNewAcAttributeModifierForConfig={props.onUpdateNewAcAttributeModifierForConfig} onNewAttrModifiersEnabledChange={props.onNewAttrModifiersEnabledChange} onNewAttrModifierFormulaChange={props.onNewAttrModifierFormulaChange} onNewSkillFormulaChange={props.onNewSkillFormulaChange} newCharacterSections={props.newCharacterSections} onAddNewCharacterSection={props.onAddNewCharacterSection} onRemoveNewCharacterSection={props.onRemoveNewCharacterSection} onUpdateNewCharacterSection={props.onUpdateNewCharacterSection} onNewResistancesChange={props.onNewResistancesChange} newResistances={props.newResistances} attrsForNewResistance={attrsForNewResistance} newFeatureSkills={props.newFeatureSkills} onNewFeatureSkillsChange={props.onNewFeatureSkillsChange} newFeatureCustomFields={props.newFeatureCustomFields} onNewFeatureCustomFieldsChange={props.onNewFeatureCustomFieldsChange} newFeatureCoreResources={props.newFeatureCoreResources} onNewFeatureCoreResourcesChange={props.onNewFeatureCoreResourcesChange} newFeatureArmorClass={props.newFeatureArmorClass} onNewFeatureArmorClassChange={props.onNewFeatureArmorClassChange} newFeatureCharacterSections={props.newFeatureCharacterSections} onNewFeatureCharacterSectionsChange={props.onNewFeatureCharacterSectionsChange} newFeatureSkillProfiles={props.newFeatureSkillProfiles} onNewFeatureSkillProfilesChange={props.onNewFeatureSkillProfilesChange} newFeatureResistance={props.newFeatureResistance} onNewFeatureResistanceChange={props.onNewFeatureResistanceChange} />}
  </div>
}
