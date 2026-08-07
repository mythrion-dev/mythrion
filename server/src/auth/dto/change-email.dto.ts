import { IsEmail, IsString, MaxLength } from 'class-validator'
import { i18nValidationMessage } from 'nestjs-i18n'

export class ChangeEmailDto {
  @IsEmail({}, { message: i18nValidationMessage('validation.isEmail') })
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MaxLength(254, { message: i18nValidationMessage('validation.maxLength') })
  email!: string
}
