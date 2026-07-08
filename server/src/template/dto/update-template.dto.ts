import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, ArrayMinSize, IsBoolean } from 'class-validator'
import { Type } from 'class-transformer'

export class UpdateAttributeDefDto {
  @IsString()
  key!: string

  @IsString()
  name!: string
}

export class UpdateTemplateFieldDefDto {
  @IsString()
  key!: string

  @IsString()
  label!: string
}

export class UpdateTemplateSkillDefDto {
  @IsString()
  name!: string

  @IsString()
  @IsOptional()
  description?: string

  @IsString()
  @IsOptional()
  attributeId?: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedAttributeIds?: string[]

  @IsString()
  @IsOptional()
  defaultAttributeId?: string
}

export class UpdateProfileOptionDefDto {
  @IsString()
  label!: string

  @IsNumber()
  value!: number
}

export class UpdateSkillModifierProfileDefDto {
  @IsString()
  name!: string

  @IsString()
  @IsOptional()
  targetMode?: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetSkillIds?: string[]

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => UpdateProfileOptionDefDto)
  options!: UpdateProfileOptionDefDto[]
}

export class UpdateCoreResourceDefDto {
  @IsString()
  @IsOptional()
  displayName?: string

  @IsString()
  @IsOptional()
  slug?: string

  @IsBoolean()
  @IsOptional()
  enabled?: boolean

  @IsBoolean()
  @IsOptional()
  editableByPlayer?: boolean

  @IsBoolean()
  @IsOptional()
  showNotes?: boolean
}

export class UpdateArmorClassFieldDefDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  key?: string

  @IsString()
  @IsOptional()
  defaultValue?: string

  @IsBoolean()
  @IsOptional()
  editableByPlayer?: boolean

  @IsString()
  @IsOptional()
  description?: string
}

export class UpdateArmorClassDefDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attributeModifierIds?: string[]

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => UpdateArmorClassFieldDefDto)
  fields?: UpdateArmorClassFieldDefDto[]
}

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  description?: string

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateAttributeDefDto)
  attributes?: UpdateAttributeDefDto[]

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateTemplateFieldDefDto)
  templateFields?: UpdateTemplateFieldDefDto[]

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateTemplateSkillDefDto)
  skills?: UpdateTemplateSkillDefDto[]

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateSkillModifierProfileDefDto)
  skillModifierProfiles?: UpdateSkillModifierProfileDefDto[]

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateCoreResourceDefDto)
  coreResources?: UpdateCoreResourceDefDto[]

  @ValidateNested()
  @IsOptional()
  @Type(() => UpdateArmorClassDefDto)
  armorClass?: UpdateArmorClassDefDto

  @IsBoolean()
  @IsOptional()
  attributeModifiersEnabled?: boolean

  @IsString()
  @IsOptional()
  attributeModifierFormula?: string

  @IsString()
  @IsOptional()
  skillFormula?: string

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateCharacterSectionDefDto)
  characterSections?: UpdateCharacterSectionDefDto[]
}

export class UpdateCharacterSectionDefDto {
  @IsString()
  @IsOptional()
  id?: string

  @IsString()
  name!: string
}
