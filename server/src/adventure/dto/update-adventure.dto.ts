import { IsString, IsOptional, IsInt, IsBoolean, IsIn, Min, Max, MaxLength } from 'class-validator'
import { Type } from 'class-transformer'
import { i18nValidationMessage } from 'nestjs-i18n'

export class UpdateAdventureDto {
  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  @MaxLength(100, { message: i18nValidationMessage('validation.maxLength') })
  name?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  @MaxLength(50, { message: i18nValidationMessage('validation.maxLength') })
  campaign?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  @MaxLength(2000, { message: i18nValidationMessage('validation.maxLength') })
  synopsis?: string

  @IsInt({ message: i18nValidationMessage('validation.isInt') })
  @Min(1, { message: i18nValidationMessage('validation.min') })
  @Max(5, { message: i18nValidationMessage('validation.max') })
  @IsOptional()
  @Type(() => Number)
  maxPlayers?: number

  @IsBoolean({ message: i18nValidationMessage('validation.isBoolean') })
  @IsOptional()
  isPublic?: boolean

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  @IsIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], { message: i18nValidationMessage('validation.isIn') })
  sessionWeekday?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  sessionTime?: string

  @IsString({ message: i18nValidationMessage('validation.isString') })
  @IsOptional()
  @IsIn(['ONLINE', 'IN_PERSON'], { message: i18nValidationMessage('validation.isIn') })
  sessionType?: string
}
