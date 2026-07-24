import { IsString, IsEnum, IsOptional } from 'class-validator'
import { BookVisibility } from '../../generated/prisma/client.js'

export class UpdateBookDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsEnum(BookVisibility)
  @IsOptional()
  visibility?: BookVisibility
}
