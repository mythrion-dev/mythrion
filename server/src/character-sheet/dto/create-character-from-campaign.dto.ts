import { IsString, IsOptional, IsInt, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { i18nValidationMessage } from 'nestjs-i18n'

export class CreateCharacterFromCampaignDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  characterName!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  adventureId!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  playerName?: string

  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  @IsOptional()
  @Type(() => Number)
  level?: number
}
