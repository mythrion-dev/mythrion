import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, ArrayMinSize, IsBoolean } from 'class-validator'
import { Type } from 'class-transformer'
import { i18nValidationMessage } from 'nestjs-i18n'

export class UpdateAttributeDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  key!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  name!: string
}

export class UpdateTemplateFieldDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  key!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  label!: string
}

export class UpdateTemplateSkillDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  name!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  description?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  attributeId?: string

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsString({ each: true, message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  allowedAttributeIds?: string[]

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  defaultAttributeId?: string
}

export class UpdateProfileOptionDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  label!: string

  @IsNumber(undefined, { message: i18nValidationMessage('validation.isNumber') })
  value!: number
}

export class UpdateSkillModifierProfileDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  name!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  targetMode?: string

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsString({ each: true, message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  targetSkillIds?: string[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({ each: true })
  @ArrayMinSize(1, { message: i18nValidationMessage('validation.arrayMinSize') })
  @Type(() => UpdateProfileOptionDefDto)
  options!: UpdateProfileOptionDefDto[]
}

export class UpdateCoreResourceDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  displayName?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  slug?: string

  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  enabled?: boolean

  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  editableByPlayer?: boolean

  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  showNotes?: boolean

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  color?: string
}

export class UpdateArmorClassFieldDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  name?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  key?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  defaultValue?: string

  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  editableByPlayer?: boolean

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  description?: string
}

export class UpdateArmorClassAttributeModifierDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  attributeId!: string

  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  allowPlayerSelection?: boolean

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  defaultAttributeId?: string
}

export class UpdateArmorClassDefDto {
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  enabled?: boolean

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  name?: string

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsString({ each: true, message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  attributeModifierIds?: string[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => UpdateArmorClassAttributeModifierDefDto)
  attributeModifiers?: UpdateArmorClassAttributeModifierDefDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => UpdateArmorClassFieldDefDto)
  fields?: UpdateArmorClassFieldDefDto[]
}

export class UpdateResistanceComponentDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  id?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  name?: string

  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  editableByPlayer?: boolean

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  defaultValue?: string
}

export class UpdateResistanceAttributeModifierDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  attributeId!: string

  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  enabled?: boolean
}

export class UpdateResistanceDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  id?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  name?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  calculationType?: string

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => UpdateResistanceComponentDefDto)
  components?: UpdateResistanceComponentDefDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => UpdateResistanceAttributeModifierDefDto)
  attributeModifiers?: UpdateResistanceAttributeModifierDefDto[]
}

export class UpdateCharacterSectionDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  id?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  name!: string
}

export class UpdateTemplateDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  name?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  description?: string

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateAttributeDefDto)
  attributes?: UpdateAttributeDefDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateTemplateFieldDefDto)
  templateFields?: UpdateTemplateFieldDefDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateTemplateSkillDefDto)
  skills?: UpdateTemplateSkillDefDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateSkillModifierProfileDefDto)
  skillModifierProfiles?: UpdateSkillModifierProfileDefDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateCoreResourceDefDto)
  coreResources?: UpdateCoreResourceDefDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => UpdateArmorClassDefDto)
  armorClasses?: UpdateArmorClassDefDto[]

  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  attributeModifiersEnabled?: boolean

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  attributeModifierFormula?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  skillFormula?: string

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateCharacterSectionDefDto)
  characterSections?: UpdateCharacterSectionDefDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateResistanceDefDto)
  resistances?: UpdateResistanceDefDto[]

  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  isPublic?: boolean
}