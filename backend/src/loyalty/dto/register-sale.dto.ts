import { Type } from 'class-transformer'
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

class SaleItemDto {
  @IsOptional()
  @IsString()
  code?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  codes?: string[]

  @IsString()
  @IsNotEmpty()
  name!: string

  @IsNumber()
  price!: number

  @IsNumber()
  points!: number

  @IsOptional()
  @IsString()
  productId?: string

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number
}

class PaymentDetailDto {
  @IsString()
  @IsNotEmpty()
  method!: string

  @IsNumber()
  amount!: number

  @IsOptional()
  @IsString()
  currency?: string

  @IsOptional()
  @IsNumber()
  amountNative?: number

  @IsOptional()
  @IsString()
  currencyNative?: string

  @IsOptional()
  @IsNumber()
  amountUsd?: number

  @IsOptional()
  @IsNumber()
  exchangeRate?: number
}

export class RegisterSaleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[]

  @IsOptional()
  @IsEmail()
  customerEmail?: string

  @IsOptional()
  @IsString()
  @MaxLength(180)
  customerName?: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  customerPhone?: string

  @IsOptional()
  @IsString()
  @MaxLength(10)
  documentType?: string

  @IsOptional()
  @IsString()
  @MaxLength(30)
  documentNumber?: string

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  @MaxLength(30)
  customerCedula?: string

  @IsOptional()
  @IsString()
  customerId?: string

  @IsOptional()
  @IsString()
  couponId?: string

  @IsOptional()
  @IsNumber()
  subtotal?: number

  @IsOptional()
  @IsNumber()
  total?: number

  @IsOptional()
  @IsNumber()
  discount?: number

  @IsOptional()
  @IsNumber()
  exchangeRate?: number

  @IsOptional()
  @IsString()
  paymentMethod?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDetailDto)
  paymentDetails?: PaymentDetailDto[]
}
