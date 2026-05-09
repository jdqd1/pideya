import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

export class LookupUserDto {
  @IsOptional()
  @IsEmail()
  @IsString()
  @MaxLength(180)
  email?: string

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  @MaxLength(30)
  cedula?: string
}
