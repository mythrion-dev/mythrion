import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator'
import { Type } from 'class-transformer'

export class AttributeDefDto {
  @IsString()
  key!: string

  @IsString()
  name!: string

  @IsBoolean()
  modifier!: boolean
}

export class CreateTemplateDto {
  @IsString()
  name!: string

  @IsString()
  @IsOptional()
  description?: string

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => AttributeDefDto)
  attributes!: AttributeDefDto[]
}