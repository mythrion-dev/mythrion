import { IsString, IsOptional, MaxLength } from 'class-validator'

export class CreateCampaignDto {
  @IsString()
  @MaxLength(100)
  name!: string

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string
}