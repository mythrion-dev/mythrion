import { IsString } from 'class-validator'

export class CreateCharacterSheetDto {
  @IsString()
  characterName!: string

  @IsString()
  templateId!: string
}