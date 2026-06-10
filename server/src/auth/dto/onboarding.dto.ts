import { IsString, IsOptional, MaxLength } from 'class-validator'

export class OnboardingDto {
  @IsString()
  @MaxLength(50)
  displayName!: string
}