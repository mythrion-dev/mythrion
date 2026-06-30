import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsNumber,
  IsEnum,
} from 'class-validator'
import { Type } from 'class-transformer'

export class AttributeDefDto {
  @IsString()
  key!: string

  @IsString()
  name!: string

  @IsString()
  @IsOptional()
  modifier?: string
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
  formula?: string
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

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => ProfileOptionDefDto)
  options!: ProfileOptionDefDto[]
}

export class RuntimeModifierOptionDefDto {
  @IsString()
  label!: string
}

export class RuntimeModifierDefDto {
  @IsString()
  key!: string

  @IsString()
  name!: string

  @IsEnum(['NUMBER', 'BOOLEAN', 'SELECT'])
  type!: 'NUMBER' | 'BOOLEAN' | 'SELECT'

  @IsString()
  @IsOptional()
  defaultValue?: string

  @IsString()
  @IsOptional()
  description?: string

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => RuntimeModifierOptionDefDto)
  options?: RuntimeModifierOptionDefDto[]
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
  @Type(() => RuntimeModifierDefDto)
  runtimeModifiers?: RuntimeModifierDefDto[]
}
