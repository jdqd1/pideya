import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  email!: string

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/)
  @MaxLength(30)
  cedula!: string

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string

  @IsString()
  @MinLength(6)
  password!: string

  @IsOptional()
  @IsString()
  role?: 'client' | 'seller' | 'admin'
}
