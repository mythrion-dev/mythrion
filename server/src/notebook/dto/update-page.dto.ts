import { IsString, IsOptional, IsInt } from 'class-validator'
import { i18nValidationMessage } from 'nestjs-i18n'

export class UpdatePageDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  title?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  content?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  folderId?: string | null

  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @IsOptional()
  sortOrder?: number
}
