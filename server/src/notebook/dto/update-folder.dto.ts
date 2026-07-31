import { IsString, IsOptional, IsInt } from 'class-validator'

export class UpdateFolderDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsInt()
  @IsOptional()
  sortOrder?: number
}
