import { IsString, IsOptional } from 'class-validator'

export class CreatePageDto {
  @IsString()
  title!: string

  @IsString()
  @IsOptional()
  folderId?: string
}
