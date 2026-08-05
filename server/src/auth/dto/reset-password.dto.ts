import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { STRONG_PASSWORD_REGEX } from '../password-rule.js';

export class ResetPasswordDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.isNotEmpty') })
  token!: string;

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @Matches(STRONG_PASSWORD_REGEX, {
    message: i18nValidationMessage('validation.passwordPolicy'),
  })
  password!: string;
}
