import { IsOptional, IsString, IsInt, IsArray, ValidateNested, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class AttributeValueDto {
  @IsString()
  attributeId!: string

  @IsString()
  value!: string
}

export class FieldValueDto {
  @IsString()
  templateFieldId!: string

  @IsString()
  value!: string
}

export class SkillValueDto {
  @IsString()
  skillId!: string

  @IsString()
  value!: string

  @IsString()
  @IsOptional()
  selectedAttributeId?: string | null
}

export class SkillProfileValueDto {
  @IsString()
  skillId!: string

  @IsString()
  profileId!: string

  @IsOptional()
  @IsString()
  optionId?: string | null
}

export class CoreResourceValueDto {
  @IsString()
  coreResourceId!: string

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  current?: number | null

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  maximum?: number | null

  @IsOptional()
  @IsString()
  notes?: string | null
}

export class ResistanceValueDto {
  @IsString()
  resistanceId!: string

  @IsString()
  @IsOptional()
  manualValue?: string
}

export class ResistanceComponentValueDto {
  @IsString()
  componentId!: string

  @IsString()
  value!: string
}

export class ArmorClassValueDto {
  @IsString()
  fieldId!: string

  @IsString()
  value!: string
}

export class UpdateCharacterSheetDto {
  @IsString()
  @IsOptional()
  characterName?: string

  @IsString()
  @IsOptional()
  playerName?: string

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  level?: number

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  hpActual?: number

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  hpMax?: number

  @IsString()
  @IsOptional()
  hpNotes?: string

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttributeValueDto)
  values?: AttributeValueDto[]

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FieldValueDto)
  fieldValues?: FieldValueDto[]

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SkillValueDto)
  skillValues?: SkillValueDto[]

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SkillProfileValueDto)
  skillProfileValues?: SkillProfileValueDto[]

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CoreResourceValueDto)
  coreResourceValues?: CoreResourceValueDto[]

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ArmorClassValueDto)
  acValues?: ArmorClassValueDto[]

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ResistanceValueDto)
  resistanceValues?: ResistanceValueDto[]

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ResistanceComponentValueDto)
  resistanceComponentValues?: ResistanceComponentValueDto[]
}
