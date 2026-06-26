import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, ArrayMinSize } from 'class-validator'
import { Type } from 'class-transformer'

export class UpdateAttributeDefDto {
  @IsString()
  key!: string

  @IsString()
  name!: string

  @IsString()
  @IsOptional()
  modifier?: string
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
  formula?: string
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

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => UpdateProfileOptionDefDto)
  options!: UpdateProfileOptionDefDto[]
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
}