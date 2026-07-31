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

  @IsString()
  @IsOptional()
  color?: string
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

export class UpdateArmorClassAttributeModifierDefDto {
  @IsString()
  attributeId!: string

  @IsBoolean()
  @IsOptional()
  allowPlayerSelection?: boolean

  @IsString()
  @IsOptional()
  defaultAttributeId?: string
}

export class UpdateArmorClassDefDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean

  @IsString()
  @IsOptional()
  name?: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attributeModifierIds?: string[]

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => UpdateArmorClassAttributeModifierDefDto)
  attributeModifiers?: UpdateArmorClassAttributeModifierDefDto[]

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => UpdateArmorClassFieldDefDto)
  fields?: UpdateArmorClassFieldDefDto[]
}

export class UpdateResistanceComponentDefDto {
  @IsString()
  @IsOptional()
  id?: string

  @IsString()
  @IsOptional()
  name?: string

  @IsBoolean()
  @IsOptional()
  editableByPlayer?: boolean

  @IsString()
  @IsOptional()
  defaultValue?: string
}

export class UpdateResistanceAttributeModifierDefDto {
  @IsString()
  attributeId!: string

  @IsBoolean()
  @IsOptional()
  enabled?: boolean
}

export class UpdateResistanceDefDto {
  @IsString()
  @IsOptional()
  id?: string

  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  calculationType?: string

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => UpdateResistanceComponentDefDto)
  components?: UpdateResistanceComponentDefDto[]

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => UpdateResistanceAttributeModifierDefDto)
  attributeModifiers?: UpdateResistanceAttributeModifierDefDto[]
}

export class UpdateCharacterSectionDefDto {
  @IsString()
  @IsOptional()
  id?: string

  @IsString()
  name!: string
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

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => UpdateArmorClassDefDto)
  armorClasses?: UpdateArmorClassDefDto[]

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

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateResistanceDefDto)
  resistances?: UpdateResistanceDefDto[]

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean
}