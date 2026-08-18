import { IsString, IsEnum, IsOptional } from 'class-validator'
import { i18nValidationMessage } from 'nestjs-i18n'
import { BookVisibility } from '../../generated/prisma/client.js'

export class CreateBookDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  name!: string

  @IsEnum(BookVisibility, { message: i18nValidationMessage('validation.isEnum') })
  @IsOptional()
  visibility?: BookVisibility
}
