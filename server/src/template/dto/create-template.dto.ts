import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
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
  @ArrayMinSize(1)
  @Type(() => AttributeDefDto)
  attributes!: AttributeDefDto[]
}

export class TemplateFieldDefDto {
  @IsString()
  key!: string

  @IsString()
  label!: string
}
