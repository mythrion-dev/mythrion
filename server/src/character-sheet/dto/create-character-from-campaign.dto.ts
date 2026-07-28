import { IsString, IsOptional, IsInt, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateCharacterFromCampaignDto {
  @IsString()
  characterName!: string

  @IsString()
  adventureId!: string

  @IsString()
  @IsOptional()
  playerName?: string

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  level?: number
}
