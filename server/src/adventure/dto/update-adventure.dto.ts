import { IsString, IsOptional, IsInt, Min, Max, MaxLength } from 'class-validator'
import { Type } from 'class-transformer'

export class UpdateAdventureDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string

  @IsString()
  @IsOptional()
  @MaxLength(50)
  campaign?: string

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  synopsis?: string

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  @Type(() => Number)
  maxPlayers?: number
}