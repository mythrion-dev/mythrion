import { IsEmail, IsString, MinLength, IsOptional, MaxLength } from 'class-validator'

export class RegisterDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8)
  password!: string

  @IsString()
  @IsOptional()
  @MaxLength(50)
  displayName?: string
}