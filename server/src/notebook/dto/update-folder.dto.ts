import { IsString, IsOptional, IsInt } from 'class-validator'
import { i18nValidationMessage } from 'nestjs-i18n'

export class UpdateFolderDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  name?: string

  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @IsOptional()
  sortOrder?: number
}
