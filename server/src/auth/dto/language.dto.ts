import { IsIn } from 'class-validator'
import { i18nValidationMessage } from 'nestjs-i18n'

export const SUPPORTED_LANGUAGES = ['en', 'pt-BR'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export class LanguageDto {
  @IsIn(SUPPORTED_LANGUAGES, { message: i18nValidationMessage('validation.isIn') })
  language!: Language
}
