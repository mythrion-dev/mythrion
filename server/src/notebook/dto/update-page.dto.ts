import { IsString, IsOptional, IsInt } from 'class-validator'

export class UpdatePageDto {
  @IsString()
  @IsOptional()
  title?: string

  @IsString()
  @IsOptional()
  content?: string

  @IsString()
  @IsOptional()
  folderId?: string | null

  @IsInt()
  @IsOptional()
  sortOrder?: number
}
