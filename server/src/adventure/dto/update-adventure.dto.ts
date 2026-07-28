import { IsString, IsOptional, IsInt, IsBoolean, IsIn, Min, Max, MaxLength } from 'class-validator'
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

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean

  @IsString()
  @IsOptional()
  @IsIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
  sessionWeekday?: string

  @IsString()
  @IsOptional()
  sessionTime?: string

  @IsString()
  @IsOptional()
  @IsIn(['ONLINE', 'IN_PERSON'])
  sessionType?: string
}
