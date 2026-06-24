import { IsOptional, IsString, IsArray, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class AttributeValueDto {
  @IsString()
  attributeId!: string

  @IsString()
  value!: string
}

export class UpdateCharacterSheetDto {
  @IsString()
  @IsOptional()
  characterName?: string

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttributeValueDto)
  values?: AttributeValueDto[]
}