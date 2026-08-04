import { IsOptional, IsString, IsInt, IsArray, ValidateNested, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { i18nValidationMessage } from 'nestjs-i18n'

export class AttributeValueDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  attributeId!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  value!: string
}

export class FieldValueDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  templateFieldId!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  value!: string
}

export class SkillValueDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  skillId!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  value!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  selectedAttributeId?: string | null
}

export class SkillProfileValueDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  skillId!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  profileId!: string

  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  optionId?: string | null
}

export class CoreResourceValueDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  coreResourceId!: string

  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Type(() => Number)
  current?: number | null

  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Type(() => Number)
  maximum?: number | null

  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  notes?: string | null
}

export class ResistanceValueDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  resistanceId!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  manualValue?: string
}

export class ResistanceComponentValueDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  componentId!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  value!: string
}

export class ArmorClassValueDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  fieldId!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  value!: string
}

export class ArmorClassAttributeValueDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  acAttributeModifierId!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  selectedAttributeId?: string | null
}

export class UpdateCharacterSheetDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  characterName?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  playerName?: string

  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  @IsOptional()
  @Type(() => Number)
  level?: number

  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @IsOptional()
  @Type(() => Number)
  hpActual?: number

  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @IsOptional()
  @Type(() => Number)
  hpMax?: number

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  hpNotes?: string

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttributeValueDto)
  values?: AttributeValueDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FieldValueDto)
  fieldValues?: FieldValueDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SkillValueDto)
  skillValues?: SkillValueDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SkillProfileValueDto)
  skillProfileValues?: SkillProfileValueDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CoreResourceValueDto)
  coreResourceValues?: CoreResourceValueDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ArmorClassValueDto)
  acValues?: ArmorClassValueDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ArmorClassAttributeValueDto)
  acAttributeValues?: ArmorClassAttributeValueDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ResistanceValueDto)
  resistanceValues?: ResistanceValueDto[]

  @IsArray({ message: i18nValidationMessage('validation.isArray') })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ResistanceComponentValueDto)
  resistanceComponentValues?: ResistanceComponentValueDto[]
}
