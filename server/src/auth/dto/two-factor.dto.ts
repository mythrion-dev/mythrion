import { IsIn, IsString, Matches } from 'class-validator'
import { i18nValidationMessage } from 'nestjs-i18n'

export class TwoFactorSendDto {
  @IsIn(['ENABLE', 'DISABLE'], { message: i18nValidationMessage('validation.isIn') })
  purpose!: 'ENABLE' | 'DISABLE'
}

export class TwoFactorConfirmDto {
  @IsIn(['ENABLE', 'DISABLE'], { message: i18nValidationMessage('validation.isIn') })
  purpose!: 'ENABLE' | 'DISABLE'

  @IsString({ message: i18nValidationMessage('validation.isString') })
  twoFactorId!: string

  // 6-digit OTP or a 10-char recovery code (unused by this DTO, but keep the
  // shape consistent so the client contract doesn't differ per endpoint).
  @Matches(/^[A-Za-z0-9]{6,10}$/, { message: i18nValidationMessage('validation.matches') })
  code!: string
}

export class VerifyTwoFactorDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  twoFactorId!: string

  // Accepts a 6-digit OTP or a 10-char recovery code.
  @Matches(/^[A-Za-z0-9]{6,10}$/, { message: i18nValidationMessage('validation.matches') })
  code!: string
}

export class ResendTwoFactorDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  twoFactorId!: string
}
