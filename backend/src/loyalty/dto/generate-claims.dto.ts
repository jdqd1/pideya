import { IsBoolean, IsInt, IsOptional, IsString, IsNumber, IsUUID, Max, MaxLength, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class GenerateClaimsDto {
  @IsInt()
  @Min(1)
  @Max(5000)
  count!: number

  @IsOptional()
  @IsBoolean()
  persist?: boolean

  @IsOptional()
  @IsString()
  prefix?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  points?: number

  @IsOptional()
  @IsUUID()
  productId?: string

  @IsOptional()
  @IsString()
  @MaxLength(180)
  productName?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number
}
