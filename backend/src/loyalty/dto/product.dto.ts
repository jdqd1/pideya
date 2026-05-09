import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateProductDto {
  @IsString()
  @MaxLength(180)
  name!: string

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  points!: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  stock?: number

  @IsOptional()
  @IsString()
  @MaxLength(1500000)
  imageUrl?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string

  @IsOptional()
  @IsBoolean()
  active?: boolean
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  points?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  stock?: number

  @IsOptional()
  @IsString()
  @MaxLength(1500000)
  imageUrl?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string

  @IsOptional()
  @IsBoolean()
  active?: boolean
}

export class AdjustStockDto {
  @Type(() => Number)
  @IsInt()
  @Min(-100000)
  @Max(100000)
  delta!: number
}
