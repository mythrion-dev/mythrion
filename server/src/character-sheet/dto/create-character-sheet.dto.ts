import { IsString, IsOptional } from 'class-validator'

export class CreateCharacterSheetDto {
  @IsString()
  characterName!: string

  @IsString()
  templateId!: string

  @IsString()
  @IsOptional()
  adventureId?: string
}