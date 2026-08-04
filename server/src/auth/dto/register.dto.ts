import { IsEmail, IsString, MinLength, IsOptional, MaxLength } from 'class-validator'
import { i18nValidationMessage } from 'nestjs-i18n'

export class RegisterDto {
  @IsEmail({}, { message: i18nValidationMessage('validation.isEmail') })
  email!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @MinLength(8, { message: i18nValidationMessage('validation.minLength') })
  password!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  @MaxLength(50, { message: i18nValidationMessage('validation.maxLength') })
  displayName?: string
}