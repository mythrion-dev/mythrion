import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class UpdateAttributeDefDto {
  @IsString()
  key!: string

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
}