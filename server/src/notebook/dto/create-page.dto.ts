import { IsString, IsOptional } from 'class-validator'
import { i18nValidationMessage } from 'nestjs-i18n'

export class CreatePageDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  title!: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  folderId?: string
}
