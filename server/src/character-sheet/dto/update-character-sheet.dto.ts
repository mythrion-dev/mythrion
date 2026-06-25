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
}
