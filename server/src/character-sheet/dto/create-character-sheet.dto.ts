import { IsString, IsOptional, IsInt, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateCharacterSheetDto {
  @IsString()
  characterName!: string

  @IsString()
  @IsOptional()
  playerName?: string

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  level?: number

  @IsString()
  templateId!: string

  @IsString()
  @IsOptional()
  adventureId?: string
}