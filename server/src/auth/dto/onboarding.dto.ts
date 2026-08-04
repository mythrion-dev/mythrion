import { IsString, IsOptional, MaxLength } from 'class-validator'
import { i18nValidationMessage } from 'nestjs-i18n'

export class OnboardingDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(50, { message: i18nValidationMessage('validation.maxLength') })
  displayName!: string
}