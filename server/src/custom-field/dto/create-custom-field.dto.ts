import { IsString } from 'class-validator'

export class CreateCustomFieldDto {
  @IsString()
  label!: string

  @IsString()
  value!: string
}