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

export class AttributeDefDto {
  @IsString()
  key!: string

  @IsString()
  name!: string
}

export class TemplateFieldDefDto {
  @IsString()
  key!: string

  @IsString()
  label!: string
}

export class TemplateSkillDefDto {
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

export class ProfileOptionDefDto {
  @IsString()
  label!: string

  @IsNumber()
  value!: number
}

export class SkillModifierProfileDefDto {
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
  @Type(() => ProfileOptionDefDto)
  options!: ProfileOptionDefDto[]
}

export class PointPoolDefDto {
  @IsString()
  name!: string

  @IsString()
  slug!: string

  @IsString()
  @IsOptional()
  description?: string

  @IsBoolean()
  @IsOptional()
  editableByPlayer?: boolean
}

export class ArmorClassFieldDefDto {
  @IsString()
  name!: string

  @IsString()
  key!: string

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

export class ArmorClassDefDto {
  @IsBoolean()
  enabled!: boolean

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attributeModifierIds?: string[]

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => ArmorClassFieldDefDto)
  fields?: ArmorClassFieldDefDto[]
}

export class CreateTemplateDto {
  @IsString()
  name!: string

  @IsString()
  @IsOptional()
  description?: string

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => TemplateFieldDefDto)
  templateFields?: TemplateFieldDefDto[]

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => TemplateSkillDefDto)
  skills?: TemplateSkillDefDto[]

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => AttributeDefDto)
  attributes!: AttributeDefDto[]

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => SkillModifierProfileDefDto)
  skillModifierProfiles?: SkillModifierProfileDefDto[]

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => PointPoolDefDto)
  pointPools?: PointPoolDefDto[]

  @ValidateNested()
  @IsOptional()
  @Type(() => ArmorClassDefDto)
  armorClass?: ArmorClassDefDto

  @IsString()
  @IsOptional()
  attributeModifierFormula?: string

  @IsString()
  @IsOptional()
  skillFormula?: string
}