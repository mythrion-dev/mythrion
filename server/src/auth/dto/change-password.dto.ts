import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { STRONG_PASSWORD_REGEX } from '../password-rule.js';

export class ChangePasswordDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  currentPassword!: string;

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @Matches(STRONG_PASSWORD_REGEX, {
    message: i18nValidationMessage('validation.passwordPolicy'),
  })
  newPassword!: string;

  @IsOptional()
  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  logoutOtherDevices?: boolean;

  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.isString') })
  currentRefreshToken?: string;
}
