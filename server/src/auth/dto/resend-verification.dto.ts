import { IsEmail } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class ResendVerificationDto {
  @IsEmail({}, { message: i18nValidationMessage('validation.isEmail') })
  email!: string;
}
