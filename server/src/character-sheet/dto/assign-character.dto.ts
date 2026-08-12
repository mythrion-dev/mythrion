import { IsString } from 'class-validator'
import { i18nValidationMessage } from 'nestjs-i18n'

export class AssignCharacterDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  memberId!: string
}
