import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsNumber,
  IsBoolean,
} from 'class-validator'
import { Type } from 'class-transformer'
import { i18nValidationMessage } from 'nestjs-i18n'

export class ResistanceComponentDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  name!: string

  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  editableByPlayer?: boolean

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  defaultValue?: string
}

export class ResistanceAttributeModifierDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  attributeId!: string

  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  enabled?: boolean
}

export class ResistanceDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  name!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  calculationType?: string

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => ResistanceComponentDefDto)
  components?: ResistanceComponentDefDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => ResistanceAttributeModifierDefDto)
  attributeModifiers?: ResistanceAttributeModifierDefDto[]
}

export class CharacterSectionDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  name!: string
}

export class AttributeDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  key!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  name!: string
}

export class TemplateFieldDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  key!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  label!: string
}

export class TemplateSkillDefDto {
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

export class ProfileOptionDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  label!: string

  @IsNumber(undefined, { message: i18nValidationMessage('validation.isNumber') })
  value!: number
}

export class SkillModifierProfileDefDto {
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
  @Type(() => ProfileOptionDefDto)
  options!: ProfileOptionDefDto[]
}

export class CoreResourceDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  displayName?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  slug!: string

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

export class ArmorClassFieldDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  name!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  key!: string

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

export class ArmorClassAttributeModifierDefDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  attributeId!: string

  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  allowPlayerSelection?: boolean

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  defaultAttributeId?: string
}

export class ArmorClassDefDto {
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  enabled!: boolean

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
  @Type(() => ArmorClassAttributeModifierDefDto)
  attributeModifiers?: ArmorClassAttributeModifierDefDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => ArmorClassFieldDefDto)
  fields?: ArmorClassFieldDefDto[]
}

export class CreateTemplateDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  name!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  description?: string

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => TemplateFieldDefDto)
  templateFields?: TemplateFieldDefDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => TemplateSkillDefDto)
  skills?: TemplateSkillDefDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({ each: true })
  @ArrayMinSize(1, { message: i18nValidationMessage('validation.arrayMinSize') })
  @Type(() => AttributeDefDto)
  attributes!: AttributeDefDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => SkillModifierProfileDefDto)
  skillModifierProfiles?: SkillModifierProfileDefDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => CoreResourceDefDto)
  coreResources?: CoreResourceDefDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => ArmorClassDefDto)
  armorClasses?: ArmorClassDefDto[]

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
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => CharacterSectionDefDto)
  characterSections?: CharacterSectionDefDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => ResistanceDefDto)
  resistances?: ResistanceDefDto[]

  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  isPublic?: boolean
}
